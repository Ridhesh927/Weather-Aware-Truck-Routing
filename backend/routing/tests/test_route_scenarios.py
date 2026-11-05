"""
End-to-end scenario tests for realistic trucking corridors across India and South Asia.
Tests multi-route weather evaluation, cargo load escalation differences, and corridor blocking.
"""

from unittest.mock import MagicMock, patch

import pytest
from rest_framework.test import APIClient

from routing.risk import Level, apply_load_rules, checkpoint_risk, rank_routes, route_metrics


@pytest.fixture
def client():
    return APIClient()


def test_cargo_weight_escalation_contrast():
    """
    Verify that identical weather produces different risk decisions based on load weight:
    - Wind: 40 mph (in 35-44 mph range)
    - Truck A: 25,000 lb (<= 40k) -> stays HIGH
    - Truck B: 45,000 lb (> 40k) -> escalates to SEVERE
    """
    wind_mph = 40.0
    rain_in_hr = 0.05
    snow_in_hr = 0.0

    base = checkpoint_risk(wind_mph, rain_in_hr, snow_in_hr)
    assert base == Level.HIGH

    # Light/Medium load: stays HIGH
    risk_light = apply_load_rules(base, wind_mph, load_lb=25_000.0)
    assert risk_light == Level.HIGH

    # Heavy load (> 40,000 lb): escalates to SEVERE
    risk_heavy = apply_load_rules(base, wind_mph, load_lb=45_000.0)
    assert risk_heavy == Level.SEVERE


def test_mumbai_to_delhi_corridor_evaluation():
    """
    Simulate Mumbai to Delhi (880 miles, 36 checkpoints @ 25 mi):
    - Route 1: NH48 Western Corridor - mild wind, 0 severe miles, 50 high miles
    - Route 2: NH52 Inland - dust storm in Rajasthan, 75 severe miles
    - Route 3: Coastal NH66 detour - cyclonic gust at 58 mph (NO_TRAVEL)
    """
    # Route 1: 36 checkpoints
    r1_checkpoints = [
        {
            "level": Level.HIGH if i in (10, 11) else Level.MODERATE if i < 15 else Level.LOW,
            "segment_miles": 25.0,
        }
        for i in range(36)
    ]
    m1 = route_metrics(r1_checkpoints, interval_miles=25.0, total_minutes=980.0)
    assert m1["severe_miles"] == 0.0
    assert m1["high_miles"] == 50.0
    assert m1["blocked"] is False

    # Route 2: 3 checkpoints in severe dust storm
    r2_checkpoints = [
        {"level": Level.SEVERE if i in (12, 13, 14) else Level.LOW, "segment_miles": 25.0}
        for i in range(36)
    ]
    m2 = route_metrics(r2_checkpoints, interval_miles=25.0, total_minutes=940.0)
    assert m2["severe_miles"] == 75.0
    assert m2["blocked"] is False

    # Route 3: checkpoint 8 has 58 mph crosswind (NO_TRAVEL)
    r3_checkpoints = [
        {"level": Level.NO_TRAVEL if i == 8 else Level.LOW, "segment_miles": 25.0}
        for i in range(36)
    ]
    m3 = route_metrics(r3_checkpoints, interval_miles=25.0, total_minutes=920.0)
    assert m3["blocked"] is True

    # Ranking: Route 3 is eliminated (blocked). Route 1 beats Route 2 on fewest severe miles!
    routes = [
        {"name": "NH48 Western Corridor", "summary": m1},
        {"name": "NH52 Inland Expressway", "summary": m2},
        {"name": "NH66 Coastal Detour", "summary": m3},
    ]

    ranked = rank_routes(routes)
    assert len(ranked) == 2
    assert ranked[0]["name"] == "NH48 Western Corridor"
    assert ranked[1]["name"] == "NH52 Inland Expressway"


def test_himalayan_corridor_snow_hazard():
    """
    Delhi to Srinagar corridor through Pir Panjal mountains:
    - Pass checkpoint has 2.5 in/hr snowfall -> SEVERE
    - Over 3.0 in/hr snowfall -> NO_TRAVEL (blocks mountain pass)
    """
    # 2.5 in/hr snow
    pass_risk_moderate_snow = checkpoint_risk(wind_mph=15.0, rain_in_hr=0.0, snow_in_hr=2.5)
    assert pass_risk_moderate_snow == Level.SEVERE

    # 3.2 in/hr blizzard
    pass_risk_blizzard = checkpoint_risk(wind_mph=25.0, rain_in_hr=0.0, snow_in_hr=3.2)
    assert pass_risk_blizzard == Level.NO_TRAVEL


@pytest.mark.django_db
def test_full_route_api_simulation(client):
    """
    Test POST /api/trips/plan/ with real-world coordinate structures.
    """
    with (
        patch("routing.views.ORSClient") as mock_ors_cls,
        patch("routing.views.WeatherClient") as mock_wx_cls,
    ):
        mock_ors = MagicMock()
        mock_wx = MagicMock()
        mock_ors_cls.return_value = mock_ors
        mock_wx_cls.return_value = mock_wx

        mock_ors.geocode.side_effect = [
            (12.9716, 77.5946, "Bengaluru, Karnataka, India"),
            (13.0827, 80.2707, "Chennai, Tamil Nadu, India"),
        ]

        mock_ors.get_alternative_routes.return_value = [
            {
                "id": 0,
                "name": "Route 1 (via NH48)",
                "profile": "driving-hgv",
                "geometry": [
                    [77.5946, 12.9716],
                    [78.5000, 12.9000],
                    [79.5000, 12.9500],
                    [80.2707, 13.0827],
                ],
                "distance_meters": 345000.0,  # ~214 mi
                "duration_seconds": 21600.0,  # 6 hours
            },
            {
                "id": 1,
                "name": "Route 2 (via Chittoor)",
                "profile": "driving-hgv",
                "geometry": [
                    [77.5946, 12.9716],
                    [78.8000, 13.2000],
                    [80.2707, 13.0827],
                ],
                "distance_meters": 360000.0,
                "duration_seconds": 23400.0,
            },
        ]

        mock_wx.get_forecasts_for_points.return_value = {}
        mock_wx.get_weather_at_eta.return_value = {
            "wind_speed_mph": 22.0,
            "rain_in_hr": 0.05,
            "snow_in_hr": 0.0,
        }
        mock_wx.compute_hourly_risk_series.return_value = ["LOW"] * 49

        payload = {
            "origin": "Bengaluru, India",
            "destination": "Chennai, India",
            "departure_at": "2026-11-06T06:00:00Z",
            "load_lb": 42000,
            "interval_miles": 25,
        }

        response = client.post("/api/trips/plan/", payload, format="json")
        assert response.status_code == 200
        data = response.json()

        assert data["origin"]["label"] == "Bengaluru, Karnataka, India"
        assert data["destination"]["label"] == "Chennai, Tamil Nadu, India"
        assert len(data["routes"]) == 2
        assert data["recommended_index"] == 0
        assert data["routes"][0]["checkpoints"][0]["level"] == "LOW"
