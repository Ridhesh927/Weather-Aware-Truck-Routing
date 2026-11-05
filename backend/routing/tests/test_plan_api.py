from unittest.mock import MagicMock, patch

import pytest
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def mock_external_services():
    """Mock ORS and Open-Meteo services for clean end-to-end testing."""
    with (
        patch("routing.views.ORSClient") as mock_ors_cls,
        patch("routing.views.WeatherClient") as mock_wx_cls,
    ):
        mock_ors = MagicMock()
        mock_wx = MagicMock()
        mock_ors_cls.return_value = mock_ors
        mock_wx_cls.return_value = mock_wx

        # Geocoding mock
        mock_ors.geocode.side_effect = [
            (19.0760, 72.8777, "Mumbai, Maharashtra, India"),
            (18.5204, 73.8567, "Pune, Maharashtra, India"),
        ]

        # Alternative routes mock: 3 routes
        mock_ors.get_alternative_routes.return_value = [
            {
                "id": 0,
                "name": "Route 1 (via Expressway)",
                "profile": "driving-hgv",
                "geometry": [
                    [72.8777, 19.0760],
                    [73.2000, 18.8000],
                    [73.8567, 18.5204],
                ],
                "distance_meters": 150000.0,  # ~93 miles
                "duration_seconds": 10800.0,  # 3 hours (180 mins)
            },
            {
                "id": 1,
                "name": "Route 2 (via Old Highway)",
                "profile": "driving-hgv",
                "geometry": [
                    [72.8777, 19.0760],
                    [73.1000, 18.7000],
                    [73.8567, 18.5204],
                ],
                "distance_meters": 160000.0,
                "duration_seconds": 12000.0,
            },
            {
                "id": 2,
                "name": "Route 3 (via Valley Pass)",
                "profile": "driving-hgv",
                "geometry": [
                    [72.8777, 19.0760],
                    [73.3000, 18.6000],
                    [73.8567, 18.5204],
                ],
                "distance_meters": 170000.0,
                "duration_seconds": 13000.0,
            },
        ]

        # Weather mock
        # Return moderate weather for Route 1, high for Route 2, and severe/blocked for Route 3
        def mock_get_forecasts(points):
            return {
                pt: [
                    {
                        "time": f"2026-11-06T{h:02d}:00",
                        "timestamp": 1793952000 + h * 3600,
                        "wind_speed_mph": 20.0,
                        "rain_in_hr": 0.05,
                        "snow_in_hr": 0.0,
                    }
                    for h in range(49)
                ]
                for pt in points
            }

        mock_wx.get_forecasts_for_points.side_effect = mock_get_forecasts
        mock_wx.get_weather_at_eta.return_value = {
            "wind_speed_mph": 22.0,
            "rain_in_hr": 0.04,
            "snow_in_hr": 0.0,
        }
        mock_wx.compute_hourly_risk_series.return_value = ["LOW"] * 49

        yield mock_ors, mock_wx


@pytest.mark.django_db
def test_plan_trip_success(api_client, mock_external_services):
    payload = {
        "origin": "Mumbai, India",
        "destination": "Pune, India",
        "departure_at": "2026-11-06T08:00:00Z",
        "load_lb": 32000,
        "interval_miles": 25,
    }

    response = api_client.post("/api/trips/plan/", payload, format="json")
    assert response.status_code == 200
    data = response.json()

    # Validate high-level structure
    assert data["origin"]["label"] == "Mumbai, Maharashtra, India"
    assert data["destination"]["label"] == "Pune, Maharashtra, India"
    assert data["load_lb"] == 32000
    assert data["interval_miles"] == 25.0
    assert data["recommended_index"] == 0
    assert "Recommended" in data["recommendation_reason"]

    # Validate routes
    routes = data["routes"]
    assert len(routes) == 3
    for r in routes:
        assert "geometry" in r
        assert "summary" in r
        summary = r["summary"]
        assert "severe_miles" in summary
        assert "high_miles" in summary
        assert "average_risk" in summary
        assert "blocked" in summary
        assert summary["blocked"] is False

        # Validate checkpoints
        checkpoints = r["checkpoints"]
        assert len(checkpoints) > 0
        for cp in checkpoints:
            assert "lat" in cp
            assert "lon" in cp
            assert "mile_marker" in cp
            assert "eta" in cp
            assert "wind_mph" in cp
            assert "rain_in_hr" in cp
            assert "snow_in_hr" in cp
            assert cp["level"] == "LOW"

    # Validate heatmap
    heatmap = data["heatmap"]
    assert len(heatmap) > 0
    for hm in heatmap:
        assert "lat" in hm
        assert "lon" in hm
        assert len(hm["hourly_risks"]) == 49


@pytest.mark.django_db
def test_plan_trip_missing_fields(api_client):
    # Missing destination
    res1 = api_client.post("/api/trips/plan/", {"origin": "Mumbai"}, format="json")
    assert res1.status_code == 400
    assert "Destination" in res1.json()["error"]

    # Missing origin
    res2 = api_client.post("/api/trips/plan/", {"destination": "Delhi"}, format="json")
    assert res2.status_code == 400
    assert "Origin" in res2.json()["error"]


@pytest.mark.django_db
def test_plan_trip_past_departure(api_client):
    past_time = "2020-01-01T00:00:00Z"
    payload = {
        "origin": "Mumbai",
        "destination": "Pune",
        "departure_at": past_time,
    }
    response = api_client.post("/api/trips/plan/", payload, format="json")
    assert response.status_code == 400
    assert "past" in response.json()["error"]


@pytest.mark.django_db
def test_plan_trip_all_routes_blocked(api_client, mock_external_services):
    _, mock_wx = mock_external_services

    # Make weather at all checkpoints NO_TRAVEL (wind > 55 mph)
    mock_wx.get_weather_at_eta.return_value = {
        "wind_speed_mph": 60.0,
        "rain_in_hr": 0.0,
        "snow_in_hr": 0.0,
    }

    payload = {
        "origin": "Mumbai",
        "destination": "Pune",
        "departure_at": "2026-11-06T12:00:00Z",
    }
    response = api_client.post("/api/trips/plan/", payload, format="json")
    assert response.status_code == 200
    data = response.json()

    # All routes should be marked blocked
    assert data["recommended_index"] is None
    assert "No Travel" in data["recommendation_reason"]
    for r in data["routes"]:
        assert r["summary"]["blocked"] is True
