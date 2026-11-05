from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

import pytest
from django.core.cache import cache

from routing.clients.weather import WeatherClient


@pytest.fixture(autouse=True)
def clear_django_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def mock_open_meteo_response():
    # 3 hourly points
    return {
        "latitude": 19.07,
        "longitude": 72.87,
        "hourly_units": {
            "time": "iso8601",
            "wind_speed_10m": "mph",
            "rain": "inch",
            "snowfall": "inch",
        },
        "hourly": {
            "time": [
                "2026-11-06T08:00",
                "2026-11-06T09:00",
                "2026-11-06T10:00",
            ],
            "wind_speed_10m": [15.0, 38.0, 56.0],
            "rain": [0.05, 0.40, 1.20],
            "snowfall": [0.0, 0.0, 0.0],
        },
    }


def test_batch_forecast_and_cache(mock_open_meteo_response):
    client = WeatherClient()
    point = (19.0760, 72.8777)

    with patch("requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.json.return_value = mock_open_meteo_response
        mock_resp.raise_for_status.return_value = None
        mock_get.return_value = mock_resp

        # First call fetches via API
        results = client.get_forecasts_for_points([point])
        assert point in results
        assert len(results[point]) == 3
        assert mock_get.call_count == 1

        # Second call with the same point should hit cache
        results_cached = client.get_forecasts_for_points([point])
        assert point in results_cached
        # mock_get should not be called a second time
        assert mock_get.call_count == 1


def test_snowfall_unit_conversion():
    client = WeatherClient()
    raw_data_cm = {
        "latitude": 34.0,
        "longitude": 74.0,
        "hourly_units": {
            "snowfall": "cm",
        },
        "hourly": {
            "time": ["2026-11-06T12:00"],
            "wind_speed_10m": [10.0],
            "rain": [0.0],
            "snowfall": [5.0],  # 5.0 cm -> ~1.97 inches
        },
    }

    series = client._parse_hourly_response(raw_data_cm)
    assert len(series) == 1
    # 5.0 cm * 0.393701 = ~1.97 in
    assert pytest.approx(series[0]["snow_in_hr"], rel=1e-2) == 1.97


def test_get_weather_at_eta():
    client = WeatherClient()
    series = [
        {"time": "2026-11-06T08:00", "timestamp": 1793952000, "wind_speed_mph": 10.0},
        {"time": "2026-11-06T09:00", "timestamp": 1793955600, "wind_speed_mph": 25.0},
        {"time": "2026-11-06T10:00", "timestamp": 1793959200, "wind_speed_mph": 40.0},
    ]

    # Target ETA at 09:10 -> closest to 09:00 (1793955600)
    eta = datetime(2026, 11, 6, 9, 10, 0, tzinfo=UTC)
    match = client.get_weather_at_eta(series, eta)
    assert match["wind_speed_mph"] == 25.0


def test_compute_hourly_risk_series():
    client = WeatherClient()
    series = [
        {"wind_speed_mph": 10.0, "rain_in_hr": 0.0, "snow_in_hr": 0.0},  # LOW
        {"wind_speed_mph": 30.0, "rain_in_hr": 0.0, "snow_in_hr": 0.0},  # MODERATE
        {
            "wind_speed_mph": 38.0,
            "rain_in_hr": 0.0,
            "snow_in_hr": 0.0,
        },  # HIGH (load rule escalates to SEVERE if > 40k)
    ]

    # With heavy load (> 40,000 lb), 38 mph wind escalates to SEVERE
    risks = client.compute_hourly_risk_series(series, load_lb=45_000.0)
    assert len(risks) == 49
    assert risks[0] == "LOW"
    assert risks[1] == "MODERATE"
    assert risks[2] == "SEVERE"  # Escalated by load rule
