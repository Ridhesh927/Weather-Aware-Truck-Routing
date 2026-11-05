"""
OpenRouteService (ORS) API client for geocoding and alternative truck routes.
Supports driving-hgv with graceful fallback to driving-car.
"""

from typing import Any

import requests
from django.conf import settings


class ORSClientError(Exception):
    """Custom exception raised when an OpenRouteService request fails."""

    pass


class ORSClient:
    """Client for OpenRouteService geocoding and direction APIs."""

    GEOCODE_URL = "https://api.openrouteservice.org/geocode/search"
    DIRECTIONS_BASE_URL = "https://api.openrouteservice.org/v2/directions"

    def __init__(self, api_key: str | None = None, timeout: int = 15):
        self.api_key = api_key or getattr(settings, "ORS_API_KEY", "")
        self.timeout = timeout

    def _get_headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = self.api_key
        return headers

    def geocode(self, text: str) -> tuple[float, float, str]:
        """
        Geocode a location query string into (lat, lon, label).
        Returns (latitude, longitude, formatted_label).
        """
        if not text or not text.strip():
            raise ORSClientError("Geocoding query text cannot be empty.")

        params = {
            "api_key": self.api_key,
            "text": text.strip(),
            "size": 1,
        }

        try:
            response = requests.get(self.GEOCODE_URL, params=params, timeout=self.timeout)
            response.raise_for_status()
            data = response.json()
        except requests.RequestException as e:
            raise ORSClientError(f"Geocoding request failed for '{text}': {e}") from e

        features = data.get("features", [])
        if not features:
            raise ORSClientError(f"No coordinates found for location: '{text}'")

        feature = features[0]
        coords = feature.get("geometry", {}).get("coordinates", [])
        if len(coords) < 2:
            raise ORSClientError(f"Invalid coordinate response for location: '{text}'")

        # GeoJSON is [lon, lat]
        lon, lat = coords[0], coords[1]
        label = feature.get("properties", {}).get("label", text.strip())
        return (float(lat), float(lon), str(label))

    def get_alternative_routes(
        self,
        origin_coords: tuple[float, float],
        dest_coords: tuple[float, float],
        target_count: int = 3,
    ) -> list[dict[str, Any]]:
        """
        Request up to `target_count` alternative routes from origin to destination.
        Tries profile 'driving-hgv' first; falls back to 'driving-car' if alternatives
        are unsupported or fail.

        Returns a list of parsed routes:
        [
            {
                "id": 0,
                "profile": "driving-hgv",
                "geometry": [[lon, lat], ...], # GeoJSON coordinate format
                "distance_meters": 1420500.0,
                "duration_seconds": 58200.0,
                "name": "Route 1",
            },
            ...
        ]
        """
        profiles = ["driving-hgv", "driving-car"]
        last_error: Exception | None = None

        for profile in profiles:
            try:
                routes = self._request_directions(
                    profile=profile,
                    origin_coords=origin_coords,
                    dest_coords=dest_coords,
                    target_count=target_count,
                )
                if routes:
                    return routes
            except Exception as e:
                last_error = e
                # Fall back to next profile
                continue

        raise ORSClientError(f"Failed to fetch alternative routes: {last_error}")

    def _request_directions(
        self,
        profile: str,
        origin_coords: tuple[float, float],
        dest_coords: tuple[float, float],
        target_count: int = 3,
    ) -> list[dict[str, Any]]:
        url = f"{self.DIRECTIONS_BASE_URL}/{profile}/geojson"
        headers = self._get_headers()

        # Origin and dest coords in ORS request format: [[lon, lat], [lon, lat]]
        origin_lat, origin_lon = origin_coords
        dest_lat, dest_lon = dest_coords

        payload = {
            "coordinates": [[origin_lon, origin_lat], [dest_lon, dest_lat]],
            "alternative_routes": {
                "target_count": target_count,
            },
        }

        response = requests.post(url, json=payload, headers=headers, timeout=self.timeout)
        response.raise_for_status()
        geojson_data = response.json()

        features = geojson_data.get("features", [])
        if not features:
            raise ORSClientError(f"No routes returned by ORS for profile '{profile}'.")

        parsed_routes: list[dict[str, Any]] = []
        for idx, feat in enumerate(features[:target_count]):
            props = feat.get("properties", {})
            summary = props.get("summary", {})
            geom = feat.get("geometry", {})
            coordinates = geom.get("coordinates", [])

            distance_m = float(summary.get("distance", 0.0))
            duration_s = float(summary.get("duration", 0.0))

            parsed_routes.append(
                {
                    "id": idx,
                    "profile": profile,
                    "geometry": coordinates,
                    "distance_meters": distance_m,
                    "duration_seconds": duration_s,
                    "name": f"Route {idx + 1}",
                }
            )

        return parsed_routes
