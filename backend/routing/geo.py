"""
Geographic utility functions for polyline distance calculation,
coordinate interpolation, checkpoint sampling, and ETA estimation.
"""

import math
from datetime import datetime, timedelta
from typing import Any

# Mean radius of Earth in miles
EARTH_RADIUS_MILES = 3958.7613


def haversine_distance(coord1: tuple[float, float], coord2: tuple[float, float]) -> float:
    """
    Calculate the great circle distance between two points (lat, lon) in miles
    using the Haversine formula.
    """
    lat1, lon1 = coord1
    lat2, lon2 = coord2

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return EARTH_RADIUS_MILES * c


def interpolate_coords(
    start: tuple[float, float],
    end: tuple[float, float],
    fraction: float,
) -> tuple[float, float]:
    """
    Linearly interpolate between start (lat, lon) and end (lat, lon) coordinates
    by a fraction between 0.0 and 1.0.
    """
    lat1, lon1 = start
    lat2, lon2 = end
    lat = lat1 + fraction * (lat2 - lat1)
    lon = lon1 + fraction * (lon2 - lon1)
    return (round(lat, 6), round(lon, 6))


def calculate_polyline_distance(coords: list[tuple[float, float]]) -> float:
    """
    Compute total distance in miles along a polyline of (lat, lon) coordinates.
    """
    if len(coords) < 2:
        return 0.0
    total = 0.0
    for i in range(len(coords) - 1):
        total += haversine_distance(coords[i], coords[i + 1])
    return total


def sample_checkpoints(
    coords: list[tuple[float, float]],
    interval_miles: float = 25.0,
) -> list[dict[str, Any]]:
    """
    Sample checkpoints along a polyline at fixed intervals of `interval_miles`.
    Each checkpoint represents the route segment behind it.

    Returns a list of checkpoint dictionaries:
    [
        {
            "id": 0,
            "lat": 19.123456,
            "lon": 72.987654,
            "mile_marker": 25.0,
            "segment_miles": 25.0
        },
        ...
    ]
    """
    if len(coords) < 2 or interval_miles <= 0:
        return []

    # Calculate cumulative distances along the polyline segments
    segment_lengths: list[float] = []
    total_length = 0.0
    for i in range(len(coords) - 1):
        d = haversine_distance(coords[i], coords[i + 1])
        segment_lengths.append(d)
        total_length += d

    if total_length == 0.0:
        return []

    checkpoints: list[dict[str, Any]] = []
    target_mile = interval_miles
    current_segment_idx = 0
    traversed_dist = 0.0  # distance up to start of current_segment_idx
    cp_id = 0

    while target_mile < total_length - 0.1:
        # Advance through segments until target_mile is within current_segment_idx
        while (
            current_segment_idx < len(segment_lengths)
            and traversed_dist + segment_lengths[current_segment_idx] < target_mile
        ):
            traversed_dist += segment_lengths[current_segment_idx]
            current_segment_idx += 1

        if current_segment_idx >= len(segment_lengths):
            break

        seg_len = segment_lengths[current_segment_idx]
        if seg_len > 0:
            fraction = (target_mile - traversed_dist) / seg_len
        else:
            fraction = 0.0

        fraction = max(0.0, min(1.0, fraction))
        lat, lon = interpolate_coords(
            coords[current_segment_idx],
            coords[current_segment_idx + 1],
            fraction,
        )

        checkpoints.append(
            {
                "id": cp_id,
                "lat": lat,
                "lon": lon,
                "mile_marker": round(target_mile, 2),
                "segment_miles": round(interval_miles, 2),
            }
        )
        cp_id += 1
        target_mile += interval_miles

    # Add final checkpoint at the destination if there's remaining distance
    last_marker = checkpoints[-1]["mile_marker"] if checkpoints else 0.0
    remainder = total_length - last_marker
    if remainder > 0.0:  # append destination whenever remainder exists
        dest_lat, dest_lon = coords[-1]
        checkpoints.append(
            {
                "id": cp_id,
                "lat": round(dest_lat, 6),
                "lon": round(dest_lon, 6),
                "mile_marker": round(total_length, 2),
                "segment_miles": round(remainder, 2),
            }
        )

    return checkpoints


def calculate_eta(
    departure_time: datetime,
    mile_marker: float,
    total_miles: float,
    total_duration_seconds: float,
) -> datetime:
    """
    Estimate checkpoint arrival time (ETA) based on distance ratio along the route:
    ETA = departure + (mile_marker / total_miles) * total_duration
    """
    if total_miles <= 0:
        return departure_time

    fraction = min(1.0, max(0.0, mile_marker / total_miles))
    elapsed_seconds = fraction * total_duration_seconds
    return departure_time + timedelta(seconds=elapsed_seconds)
