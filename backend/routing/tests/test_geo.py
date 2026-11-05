from datetime import UTC, datetime

import pytest

from routing.geo import (
    calculate_eta,
    calculate_polyline_distance,
    haversine_distance,
    interpolate_coords,
    sample_checkpoints,
)


def test_haversine_same_point():
    point = (19.0760, 72.8777)
    assert haversine_distance(point, point) == 0.0


def test_haversine_one_degree_latitude():
    # 1 degree of latitude is approximately 69 miles
    p1 = (0.0, 0.0)
    p2 = (1.0, 0.0)
    dist = haversine_distance(p1, p2)
    assert 68.5 < dist < 69.5


def test_haversine_mumbai_to_pune():
    mumbai = (19.0760, 72.8777)
    pune = (18.5204, 73.8567)
    dist = haversine_distance(mumbai, pune)
    # Distance between Mumbai and Pune is ~74 miles as the crow flies
    assert 70.0 < dist < 80.0


def test_interpolate_coords():
    start = (10.0, 20.0)
    end = (20.0, 40.0)

    # At fraction 0.0
    assert interpolate_coords(start, end, 0.0) == (10.0, 20.0)
    # At fraction 0.5 (midpoint)
    assert interpolate_coords(start, end, 0.5) == (15.0, 30.0)
    # At fraction 1.0
    assert interpolate_coords(start, end, 1.0) == (20.0, 40.0)


def test_sample_checkpoints_straight_line_exact_multiple():
    # Create a straight north-south line of ~100 miles
    # 100 miles / 69.05 miles/degree = ~1.448 degrees
    start = (0.0, 0.0)
    end = (100.0 / 69.054, 0.0)

    coords = [start, end]
    total_dist = calculate_polyline_distance(coords)
    assert pytest.approx(total_dist, rel=1e-2) == 100.0

    # Sample every 25 miles
    checkpoints = sample_checkpoints(coords, interval_miles=25.0)

    # Should have 4 checkpoints: 25, 50, 75, 100 miles
    assert len(checkpoints) == 4
    assert checkpoints[0]["mile_marker"] == 25.0
    assert checkpoints[1]["mile_marker"] == 50.0
    assert checkpoints[2]["mile_marker"] == 75.0
    assert pytest.approx(checkpoints[3]["mile_marker"], abs=0.5) == 100.0


def test_sample_checkpoints_with_remainder():
    # Create a straight line of ~110 miles
    start = (0.0, 0.0)
    end = (110.0 / 69.054, 0.0)
    coords = [start, end]

    # Sample every 25 miles
    checkpoints = sample_checkpoints(coords, interval_miles=25.0)

    # Checkpoints at 25, 50, 75, 100, and final destination at ~110
    assert len(checkpoints) == 5
    assert checkpoints[0]["mile_marker"] == 25.0
    assert checkpoints[1]["mile_marker"] == 50.0
    assert checkpoints[2]["mile_marker"] == 75.0
    assert checkpoints[3]["mile_marker"] == 100.0
    assert pytest.approx(checkpoints[4]["mile_marker"], abs=0.5) == 110.0
    assert pytest.approx(checkpoints[4]["segment_miles"], abs=0.5) == 10.0


def test_sample_checkpoints_empty_or_short():
    assert sample_checkpoints([], 25.0) == []
    assert sample_checkpoints([(19.0, 72.0)], 25.0) == []


def test_calculate_eta():
    departure = datetime(2026, 11, 6, 8, 0, 0, tzinfo=UTC)
    total_miles = 100.0
    total_duration = 7200.0  # 2 hours (120 minutes)

    # Start (0 miles) -> departure time
    eta_0 = calculate_eta(departure, 0.0, total_miles, total_duration)
    assert eta_0 == departure

    # Halfway (50 miles) -> 1 hour later
    eta_50 = calculate_eta(departure, 50.0, total_miles, total_duration)
    assert eta_50 == datetime(2026, 11, 6, 9, 0, 0, tzinfo=UTC)

    # End (100 miles) -> 2 hours later
    eta_100 = calculate_eta(departure, 100.0, total_miles, total_duration)
    assert eta_100 == datetime(2026, 11, 6, 10, 0, 0, tzinfo=UTC)
