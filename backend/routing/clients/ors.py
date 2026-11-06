"""
OpenRouteService (ORS) API client for geocoding and alternative truck routes.
Supports driving-hgv with graceful fallback to driving-car and zero-config demo routing.
"""

import logging
import math
import os
import re
from typing import Any

import requests
from django.conf import settings
from django.core.cache import cache

from routing.geo import haversine_distance

logger = logging.getLogger(__name__)

# Major US & Global commercial freight hubs fallback registry
CITY_REGISTRY: dict[str, tuple[float, float, str]] = {
    # US Major Logistics & Freight Hubs
    "chicago": (41.8781, -87.6298, "Chicago, Illinois, USA"),
    "dallas": (32.7767, -96.7970, "Dallas, Texas, USA"),
    "fort worth": (32.7555, -97.3308, "Fort Worth, Texas, USA"),
    "los angeles": (34.0522, -118.2437, "Los Angeles, California, USA"),
    "phoenix": (33.4484, -112.0740, "Phoenix, Arizona, USA"),
    "denver": (39.7392, -104.9903, "Denver, Colorado, USA"),
    "salt lake city": (40.7608, -111.8910, "Salt Lake City, Utah, USA"),
    "salt lake": (40.7608, -111.8910, "Salt Lake City, Utah, USA"),
    "atlanta": (33.7490, -84.3880, "Atlanta, Georgia, USA"),
    "new york": (40.7128, -74.0060, "New York, New York, USA"),
    "seattle": (47.6062, -122.3321, "Seattle, Washington, USA"),
    "houston": (29.7604, -95.3698, "Houston, Texas, USA"),
    "memphis": (35.1495, -90.0490, "Memphis, Tennessee, USA"),
    "kansas city": (39.0997, -94.5786, "Kansas City, Missouri, USA"),
    # Indian & South Asian Commercial Corridors
    "mumbai": (19.0760, 72.8777, "Mumbai, Maharashtra, India"),
    "delhi": (28.6139, 77.2090, "New Delhi, Delhi, India"),
    "new delhi": (28.6139, 77.2090, "New Delhi, Delhi, India"),
    "bengaluru": (12.9716, 77.5946, "Bengaluru, Karnataka, India"),
    "bangalore": (12.9716, 77.5946, "Bengaluru, Karnataka, India"),
    "chennai": (13.0827, 80.2707, "Chennai, Tamil Nadu, India"),
    "kolkata": (22.5726, 88.3639, "Kolkata, West Bengal, India"),
    "hyderabad": (17.3850, 78.4867, "Hyderabad, Telangana, India"),
    "pune": (18.5204, 73.8567, "Pune, Maharashtra, India"),
    "srinagar": (34.0837, 74.7973, "Srinagar, Jammu & Kashmir, India"),
    "ahmedabad": (23.0225, 72.5714, "Ahmedabad, Gujarat, India"),
    "jaipur": (26.9124, 75.7873, "Jaipur, Rajasthan, India"),
    "surat": (21.1702, 72.8311, "Surat, Gujarat, India"),
    "lucknow": (26.8467, 80.9462, "Lucknow, Uttar Pradesh, India"),
    "nagpur": (21.1458, 79.0882, "Nagpur, Maharashtra, India"),
    "patna": (25.5941, 85.1376, "Patna, Bihar, India"),
    "bhopal": (23.2599, 77.4126, "Bhopal, Madhya Pradesh, India"),
    "chandigarh": (30.7333, 76.7794, "Chandigarh, India"),
    "coimbatore": (11.0168, 76.9558, "Coimbatore, Tamil Nadu, India"),
    "kochi": (9.9312, 76.2673, "Kochi, Kerala, India"),
    "dhaka": (23.8103, 90.4125, "Dhaka, Bangladesh"),
    "colombo": (6.9271, 79.8612, "Colombo, Sri Lanka"),
    "kathmandu": (27.7172, 85.3240, "Kathmandu, Nepal"),
}


class ORSClientError(Exception):
    """Custom exception raised when an OpenRouteService request fails."""

    pass


class ORSClient:
    """Client for OpenRouteService geocoding and direction APIs."""

    GEOCODE_URL = "https://api.openrouteservice.org/geocode/search"
    DIRECTIONS_BASE_URL = "https://api.openrouteservice.org/v2/directions"
    NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

    PLACEHOLDER_KEYS = {
        "",
        "your-openrouteservice-api-key-here",
        "ci-dummy-key",
        "change-me",
    }

    def __init__(self, api_key: str | None = None, timeout: int = 15):
        if api_key is not None:
            raw_key = api_key
        elif settings.configured:
            raw_key = getattr(settings, "ORS_API_KEY", "")
        else:
            raw_key = os.getenv("ORS_API_KEY", "")
        self.api_key = str(raw_key).strip()
        self.timeout = timeout

    @property
    def has_valid_api_key(self) -> bool:
        return bool(self.api_key and self.api_key.lower() not in self.PLACEHOLDER_KEYS)

    def _get_headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.has_valid_api_key:
            headers["Authorization"] = self.api_key
        return headers

    def geocode(self, text: str) -> tuple[float, float, str]:
        """
        Geocode a location query string into (lat, lon, label).
        Tries ORS geocode first if an active key is present; otherwise gracefully falls back
        to the regional city registry and OpenStreetMap Nominatim.
        """
        clean_text = text.strip() if text else ""
        if not clean_text:
            raise ORSClientError("Geocoding query text cannot be empty.")

        # Check local regional hub registry with word boundaries
        lower_query = clean_text.lower()
        for city_key in sorted(CITY_REGISTRY, key=len, reverse=True):
            if re.search(rf"\b{re.escape(city_key)}\b", lower_query):
                return CITY_REGISTRY[city_key]

        # Check cache for geocode results
        cache_key = f"nom_geo_{re.sub(r'[^a-zA-Z0-9_]', '_', lower_query)[:60]}"
        cached_coords = cache.get(cache_key)
        if cached_coords is not None:
            return cached_coords

        # If user provided a real ORS API key, try ORS geocode
        if self.has_valid_api_key:
            try:
                params = {
                    "api_key": self.api_key,
                    "text": clean_text,
                    "size": 1,
                }
                response = requests.get(self.GEOCODE_URL, params=params, timeout=self.timeout)
                if response.status_code == 200:
                    data = response.json()
                    features = data.get("features", [])
                    if features:
                        feature = features[0]
                        coords = feature.get("geometry", {}).get("coordinates", [])
                        if len(coords) >= 2:
                            lon, lat = coords[0], coords[1]
                            label = feature.get("properties", {}).get("label", clean_text)
                            return (float(lat), float(lon), str(label))
            except Exception:
                pass  # Fall through to Nominatim

        # Zero-key fallback: OpenStreetMap Nominatim
        try:
            nom_params = {
                "q": clean_text,
                "format": "json",
                "limit": 1,
            }
            nom_headers = {"User-Agent": "WeatherAwareTruckRouting/1.0"}
            nom_resp = requests.get(
                self.NOMINATIM_URL,
                params=nom_params,
                headers=nom_headers,
                timeout=self.timeout,
            )
            if nom_resp.status_code == 200:
                nom_data = nom_resp.json()
                if nom_data and isinstance(nom_data, list):
                    item = nom_data[0]
                    res = (
                        float(item["lat"]),
                        float(item["lon"]),
                        str(item.get("display_name", clean_text)),
                    )
                    cache.set(cache_key, res, timeout=86400)
                    return res
        except Exception as e:
            raise ORSClientError(f"Geocoding service unavailable for '{clean_text}': {e}") from e

        raise ORSClientError(f"No coordinates found for location: '{clean_text}'")

    def get_alternative_routes(
        self,
        origin_coords: tuple[float, float],
        dest_coords: tuple[float, float],
        target_count: int = 3,
    ) -> list[dict[str, Any]]:
        """
        Request up to `target_count` alternative routes from origin to destination.
        Tries driving-hgv, then driving-car if ORS key is configured.
        If no key is configured or ORS returns an authorization error, generates
        3 realistic alternative highway routes based on geographical waypoints.
        """
        if self.has_valid_api_key:
            profiles = ["driving-hgv", "driving-car"]
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
                    logger.warning("ORS directions request failed for %s: %s", profile, e)
                    continue

        # Zero-key / Offline fallback: Synthesize 3 realistic alternative route corridors
        logger.info("Using simulated route fallback for (%s -> %s)", origin_coords, dest_coords)
        return self._generate_simulated_alternatives(
            origin_coords=origin_coords,
            dest_coords=dest_coords,
            target_count=target_count,
        )

    def _request_directions(
        self,
        profile: str,
        origin_coords: tuple[float, float],
        dest_coords: tuple[float, float],
        target_count: int = 3,
    ) -> list[dict[str, Any]]:
        url = f"{self.DIRECTIONS_BASE_URL}/{profile}/geojson"
        headers = self._get_headers()

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
                    "source": "ors",
                }
            )

        return parsed_routes

    @staticmethod
    def _generate_simulated_alternatives(
        origin_coords: tuple[float, float],
        dest_coords: tuple[float, float],
        target_count: int = 3,
    ) -> list[dict[str, Any]]:
        """
        Generate 3 realistic alternative highway route polylines between two coordinates.
        Uses realistic commercial truck speeds (~70 km/h or ~44 mph) and highway curvature arcs.
        """
        lat1, lon1 = origin_coords
        lat2, lon2 = dest_coords

        crow_dist_miles = haversine_distance(origin_coords, dest_coords)
        # Commercial road distance is typically 1.18x crow-flies distance
        base_road_miles = max(10.0, crow_dist_miles * 1.18)

        # Average commercial truck speed: ~44 mph (~70 km/h)
        truck_speed_mph = 44.0

        # Offsets for 3 alternative corridors (direct highway, northern bypass, southern bypass)
        corridors = [
            ("Route 1 (Primary Freight Corridor)", 1.0, 0.0),
            ("Route 2 (Inland Highway Alternative)", 1.08, 0.25),
            ("Route 3 (Expressway Bypass Corridor)", 1.16, -0.28),
        ]

        routes: list[dict[str, Any]] = []
        num_points = 25

        for idx, (route_name, dist_mult, curvature) in enumerate(corridors[:target_count]):
            route_dist_miles = base_road_miles * dist_mult
            route_duration_seconds = (route_dist_miles / truck_speed_mph) * 3600.0

            # Generate polyline with smooth curve
            coords: list[list[float]] = []
            for i in range(num_points):
                f = i / (num_points - 1)
                # Linear base
                lat = lat1 + f * (lat2 - lat1)
                lon = lon1 + f * (lon2 - lon1)

                # Add smooth parabolic curvature perpendicular to line
                arc = math.sin(f * math.pi) * curvature
                d_lat = -(lon2 - lon1) * 0.15 * arc
                d_lon = (lat2 - lat1) * 0.15 * arc

                final_lat = round(lat + d_lat, 5)
                final_lon = round(lon + d_lon, 5)
                coords.append([final_lon, final_lat])

            routes.append(
                {
                    "id": idx,
                    "profile": "driving-hgv",
                    "geometry": coords,
                    "distance_meters": round(route_dist_miles * 1609.344, 1),
                    "duration_seconds": round(route_duration_seconds, 1),
                    "name": route_name,
                    "source": "simulated",
                }
            )

        return routes
