"""
Open-Meteo weather client with batched multi-location queries and 60-minute caching.
Fetches hourly wind speed, rain, and snowfall, converting units as needed.
"""

from datetime import UTC, datetime
from typing import Any

import requests
from django.core.cache import cache

from routing.risk import Level, apply_load_rules, checkpoint_risk


class WeatherClientError(Exception):
    """Custom exception raised when an Open-Meteo weather request fails."""

    pass


class WeatherClient:
    """Client for Open-Meteo hourly weather forecast API."""

    FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
    CACHE_TIMEOUT = 3600  # 60 minutes in seconds

    def __init__(self, timeout: int = 15):
        self.timeout = timeout

    @staticmethod
    def _cache_key(lat: float, lon: float, date_hour: str) -> str:
        """Cache key rounding coordinates to ~1.1km grid and hourly bucket."""
        return f"wx_{round(lat, 2)}_{round(lon, 2)}_{date_hour}"

    def get_forecasts_for_points(
        self,
        points: list[tuple[float, float]],
    ) -> dict[tuple[float, float], list[dict[str, Any]]]:
        """
        Fetch hourly weather forecasts for multiple (lat, lon) coordinates.
        Checks cache first, then batches any missing coordinates into one Open-Meteo call.

        Returns a dictionary mapping (lat, lon) -> list of hourly forecast dicts:
        {
            (19.07, 72.87): [
                {
                    "time": "2026-11-06T08:00",
                    "timestamp": 1793952000,
                    "wind_speed_mph": 14.5,
                    "rain_in_hr": 0.0,
                    "snow_in_hr": 0.0,
                },
                ...
            ]
        }
        """
        if not points:
            return {}

        now_utc = datetime.now(UTC)
        current_hour_str = now_utc.strftime("%Y%m%d%H")

        # Deduplicate points by ~1.1km grid
        results: dict[tuple[float, float], list[dict[str, Any]]] = {}
        uncached_points: list[tuple[float, float]] = []

        for pt in points:
            lat, lon = round(pt[0], 4), round(pt[1], 4)
            key = self._cache_key(lat, lon, current_hour_str)
            cached_data = cache.get(key)
            if cached_data is not None:
                results[pt] = cached_data
            else:
                uncached_points.append(pt)

        # Batch request all uncached points in a single HTTP call
        if uncached_points:
            fetched_data = self._batch_fetch_from_api(uncached_points)
            for pt, series in fetched_data.items():
                lat, lon = round(pt[0], 4), round(pt[1], 4)
                key = self._cache_key(lat, lon, current_hour_str)
                cache.set(key, series, timeout=self.CACHE_TIMEOUT)
                results[pt] = series

        return results

    def _batch_fetch_from_api(
        self,
        points: list[tuple[float, float]],
    ) -> dict[tuple[float, float], list[dict[str, Any]]]:
        """Execute a batched HTTP request to Open-Meteo for multiple coordinates."""
        latitudes = [str(round(p[0], 4)) for p in points]
        longitudes = [str(round(p[1], 4)) for p in points]

        params = {
            "latitude": ",".join(latitudes),
            "longitude": ",".join(longitudes),
            "hourly": "wind_speed_10m,rain,snowfall,precipitation",
            "wind_speed_unit": "mph",
            "precipitation_unit": "inch",
            "timezone": "auto",
            "forecast_days": 3,
        }

        try:
            response = requests.get(self.FORECAST_URL, params=params, timeout=self.timeout)
            response.raise_for_status()
            api_data = response.json()
        except requests.RequestException as e:
            raise WeatherClientError(f"Open-Meteo request failed: {e}") from e

        # Single location returns dict, multiple returns list of dicts
        responses = api_data if isinstance(api_data, list) else [api_data]

        parsed_by_point: dict[tuple[float, float], list[dict[str, Any]]] = {}
        for idx, pt in enumerate(points):
            if idx < len(responses):
                series = self._parse_hourly_response(responses[idx])
                parsed_by_point[pt] = series
            else:
                parsed_by_point[pt] = []

        return parsed_by_point

    def _parse_hourly_response(self, raw_data: dict[str, Any]) -> list[dict[str, Any]]:
        """Parse one location's Open-Meteo response, verifying units and converting cm to inches."""
        hourly = raw_data.get("hourly", {})
        hourly_units = raw_data.get("hourly_units", {})

        times: list[str] = hourly.get("time", [])
        wind_speeds: list[float] = hourly.get("wind_speed_10m", [])
        rains: list[float] = hourly.get("rain", [])
        snows: list[float] = hourly.get("snowfall", [])

        # Check snowfall unit: convert cm to inches if not already inch
        snow_unit = str(hourly_units.get("snowfall", "inch")).lower()
        snow_to_inch_factor = 0.393701 if ("cm" in snow_unit) else 1.0

        series: list[dict[str, Any]] = []
        count = min(len(times), len(wind_speeds), len(rains), len(snows), 49)

        for i in range(count):
            t_str = times[i]
            # Parse ISO time
            try:
                dt = datetime.fromisoformat(t_str)
                ts = int(dt.timestamp())
            except Exception:
                ts = 0

            wind = float(wind_speeds[i] or 0.0)
            rain = float(rains[i] or 0.0)
            snow_raw = float(snows[i] or 0.0)
            snow = snow_raw * snow_to_inch_factor

            series.append(
                {
                    "time": t_str,
                    "timestamp": ts,
                    "wind_speed_mph": round(wind, 1),
                    "rain_in_hr": round(rain, 2),
                    "snow_in_hr": round(snow, 2),
                }
            )

        return series

    @staticmethod
    def get_weather_at_eta(
        hourly_series: list[dict[str, Any]],
        eta: datetime,
    ) -> dict[str, Any]:
        """
        Find the forecast hour in hourly_series nearest to the checkpoint ETA.
        """
        if not hourly_series:
            return {
                "time": eta.isoformat(),
                "wind_speed_mph": 0.0,
                "rain_in_hr": 0.0,
                "snow_in_hr": 0.0,
            }

        eta_ts = int(eta.timestamp())
        closest = min(
            hourly_series,
            key=lambda x: abs(x.get("timestamp", eta_ts) - eta_ts),
        )
        return closest

    @staticmethod
    def compute_hourly_risk_series(
        hourly_series: list[dict[str, Any]],
        load_lb: float = 0.0,
    ) -> list[str]:
        """
        Compute risk level strings for hours 0 through 48 at this coordinate.
        Returns a 49-element array of risk level strings (e.g. ['LOW', 'MODERATE', ...]).
        """
        risks: list[str] = []
        for hour_item in hourly_series[:49]:
            wind = hour_item.get("wind_speed_mph", 0.0)
            rain = hour_item.get("rain_in_hr", 0.0)
            snow = hour_item.get("snow_in_hr", 0.0)

            base = checkpoint_risk(wind, rain, snow)
            final_level = apply_load_rules(base, wind, load_lb)
            risks.append(final_level.value)

        # Pad with LOW if fewer than 49 hours are available
        while len(risks) < 49:
            risks.append(Level.LOW.value)

        return risks
