import logging
from datetime import UTC, datetime
from typing import Any

from django.utils import timezone as dj_timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from routing.clients.ors import ORSClient, ORSClientError
from routing.clients.weather import WeatherClient, WeatherClientError
from routing.geo import calculate_eta, sample_checkpoints
from routing.risk import (
    apply_load_rules,
    checkpoint_risk,
    get_recommended_route,
    route_metrics,
)

logger = logging.getLogger(__name__)


@api_view(["GET"])
def health_check(request):
    """Health check endpoint to verify backend service status."""
    return Response(
        {
            "status": "ok",
            "service": "weather-aware-truck-routing",
            "timestamp": dj_timezone.now().isoformat(),
        }
    )


@api_view(["POST"])
def plan_trip(request):
    """
    Plan a weather-aware trip across multiple alternative routes:
    Accepts:
    - origin: text (geocoded)
    - destination: text (geocoded)
    - departure_at: datetime ISO string (must not be in the past)
    - load_lb: truck cargo weight in pounds (default 0)
    - interval_miles: sample interval (10, 25, or 50; default 25)

    Returns:
    - routes: 3 items with geometry, summary, and checkpoints
    - recommended_index: best route index (or null if all blocked)
    - recommendation_reason: explanation for recommendation or blocking
    - heatmap: corridor weather forecast grid for hours 0-48
    """
    data: dict[str, Any] = request.data or {}

    origin_text = str(data.get("origin", "")).strip()
    destination_text = str(data.get("destination", "")).strip()

    if not origin_text:
        return Response(
            {"error": "Origin address or location is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not destination_text:
        return Response(
            {"error": "Destination address or location is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Validate interval_miles
    raw_interval = data.get("interval_miles", 25)
    try:
        interval_miles = float(raw_interval)
        if interval_miles not in [10.0, 25.0, 50.0]:
            interval_miles = 25.0
    except (ValueError, TypeError):
        interval_miles = 25.0

    # Validate load_lb
    try:
        load_lb = max(0.0, float(data.get("load_lb", 0.0)))
    except (ValueError, TypeError):
        load_lb = 0.0

    # Validate departure_at
    raw_departure = data.get("departure_at")
    now_utc = datetime.now(UTC)
    if raw_departure:
        try:
            # Handle trailing 'Z' or ISO string
            dep_str = str(raw_departure).replace("Z", "+00:00")
            departure_time = datetime.fromisoformat(dep_str)
            if departure_time.tzinfo is None:
                departure_time = departure_time.replace(tzinfo=UTC)
        except Exception:
            return Response(
                {"error": "Invalid departure_at format. Please use ISO 8601 format."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Allow 15-minute grace tolerance for past dates
        if departure_time < (now_utc - dj_timezone.timedelta(minutes=15)):
            return Response(
                {"error": "Departure date/time must not be in the past."},
                status=status.HTTP_400_BAD_REQUEST,
            )
    else:
        departure_time = now_utc

    # 1. Geocode origin and destination
    ors_client = ORSClient()
    try:
        origin_lat, origin_lon, origin_label = ors_client.geocode(origin_text)
        dest_lat, dest_lon, dest_label = ors_client.geocode(destination_text)
    except ORSClientError as e:
        return Response(
            {"error": f"Geocoding error: {e}"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception as e:
        logger.exception("Unexpected error during geocoding")
        return Response(
            {"error": f"Internal geocoding failure: {e}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # 2. Fetch alternative routes from ORS
    try:
        raw_routes = ors_client.get_alternative_routes(
            origin_coords=(origin_lat, origin_lon),
            dest_coords=(dest_lat, dest_lon),
            target_count=3,
        )
    except ORSClientError as e:
        return Response(
            {"error": f"Routing service error: {e}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )
    except Exception as e:
        logger.exception("Unexpected error during route fetching")
        return Response(
            {"error": f"Internal routing failure: {e}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # 3. Process routes, sample checkpoints, compute ETAs
    processed_routes: list[dict[str, Any]] = []
    all_points: list[tuple[float, float]] = []

    for r_idx, raw_r in enumerate(raw_routes):
        geom_coords = raw_r.get("geometry", [])
        # Convert GeoJSON [lon, lat] -> (lat, lon)
        lat_lon_coords = [(pt[1], pt[0]) for pt in geom_coords]

        dist_meters = raw_r.get("distance_meters", 0.0)
        dur_seconds = raw_r.get("duration_seconds", 0.0)
        route_miles = round(dist_meters * 0.000621371, 2)
        route_minutes = round(dur_seconds / 60.0, 2)

        checkpoints = sample_checkpoints(lat_lon_coords, interval_miles=interval_miles)

        for cp in checkpoints:
            eta = calculate_eta(
                departure_time=departure_time,
                mile_marker=cp["mile_marker"],
                total_miles=route_miles,
                total_duration_seconds=dur_seconds,
            )
            cp["eta"] = eta.isoformat()
            cp["_eta_dt"] = eta
            all_points.append((cp["lat"], cp["lon"]))

        processed_routes.append(
            {
                "id": r_idx,
                "name": raw_r.get("name", f"Route {r_idx + 1}"),
                "profile": raw_r.get("profile", "driving-hgv"),
                "geometry": geom_coords,
                "total_miles": route_miles,
                "total_minutes": route_minutes,
                "checkpoints": checkpoints,
            }
        )

    # 4. Batch query weather for all unique checkpoint points
    weather_client = WeatherClient()
    unique_points = list({(round(p[0], 4), round(p[1], 4)) for p in all_points})

    try:
        forecasts_map = weather_client.get_forecasts_for_points(unique_points)
    except WeatherClientError as e:
        logger.error(f"Weather forecast query failed: {e}")
        # Continue with empty forecasts rather than hard-failing
        forecasts_map = {}
    except Exception:
        logger.exception("Unexpected error during weather fetching")
        forecasts_map = {}

    # Helper to lookup cached/fetched point in map by approximate match
    def get_series(lat: float, lon: float) -> list[dict[str, Any]]:
        key = (round(lat, 4), round(lon, 4))
        return forecasts_map.get(key, [])

    # 5. Classify weather and evaluate load risk per checkpoint
    for route in processed_routes:
        cps = route["checkpoints"]
        for cp in cps:
            series = get_series(cp["lat"], cp["lon"])
            wx = weather_client.get_weather_at_eta(series, cp.pop("_eta_dt"))

            wind = wx.get("wind_speed_mph", 0.0)
            rain = wx.get("rain_in_hr", 0.0)
            snow = wx.get("snow_in_hr", 0.0)

            base_risk = checkpoint_risk(wind, rain, snow)
            final_risk = apply_load_rules(base_risk, wind, load_lb)

            cp["wind_mph"] = wind
            cp["rain_in_hr"] = rain
            cp["snow_in_hr"] = snow
            cp["level"] = final_risk.value

        # Calculate metrics for this route
        summary = route_metrics(
            checkpoints=cps,
            interval_miles=interval_miles,
            total_minutes=route["total_minutes"],
        )
        summary["total_miles"] = route["total_miles"]
        route["summary"] = summary

    # 6. Rank routes & select recommendation
    best_route, best_index, reason = get_recommended_route(processed_routes)
    if best_route is not None and not reason:
        reason = (
            f"Recommended: {best_route['name']} has the fewest severe weather hazard miles "
            f"({best_route['summary']['severe_miles']} mi) and lowest average risk."
        )

    # 7. Generate corridor weather heatmap matrix for hours 0 through 48
    heatmap: list[dict[str, Any]] = []
    for pt in unique_points:
        series = forecasts_map.get(pt, [])
        hourly_risks = weather_client.compute_hourly_risk_series(series, load_lb=load_lb)
        heatmap.append(
            {
                "lat": pt[0],
                "lon": pt[1],
                "hourly_risks": hourly_risks,
            }
        )

    # Format response
    response_payload = {
        "origin": {
            "label": origin_label,
            "lat": origin_lat,
            "lon": origin_lon,
        },
        "destination": {
            "label": dest_label,
            "lat": dest_lat,
            "lon": dest_lon,
        },
        "departure_at": departure_time.isoformat(),
        "load_lb": load_lb,
        "interval_miles": interval_miles,
        "routes": processed_routes,
        "recommended_index": best_index,
        "recommendation_reason": reason,
        "heatmap": heatmap,
    }

    return Response(response_payload, status=status.HTTP_200_OK)
