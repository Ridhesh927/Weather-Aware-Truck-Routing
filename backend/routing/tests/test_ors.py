from unittest.mock import MagicMock, patch

import pytest

from routing.clients.ors import ORSClient, ORSClientError


@pytest.fixture
def mock_geocode_response():
    return {
        "features": [
            {
                "geometry": {"coordinates": [72.8777, 19.0760]},
                "properties": {"label": "Mumbai, Maharashtra, India"},
            }
        ]
    }


@pytest.fixture
def mock_directions_response():
    return {
        "features": [
            {
                "geometry": {
                    "coordinates": [
                        [72.8777, 19.0760],
                        [73.8567, 18.5204],
                    ]
                },
                "properties": {
                    "summary": {
                        "distance": 145000.0,
                        "duration": 10800.0,
                    }
                },
            },
            {
                "geometry": {
                    "coordinates": [
                        [72.8777, 19.0760],
                        [73.5000, 18.9000],
                        [73.8567, 18.5204],
                    ]
                },
                "properties": {
                    "summary": {
                        "distance": 160000.0,
                        "duration": 12000.0,
                    }
                },
            },
            {
                "geometry": {
                    "coordinates": [
                        [72.8777, 19.0760],
                        [73.2000, 19.1000],
                        [73.8567, 18.5204],
                    ]
                },
                "properties": {
                    "summary": {
                        "distance": 175000.0,
                        "duration": 13500.0,
                    }
                },
            },
        ]
    }


def test_geocode_success(mock_geocode_response):
    client = ORSClient(api_key="test-key")

    with patch("requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.json.return_value = mock_geocode_response
        mock_resp.raise_for_status.return_value = None
        mock_get.return_value = mock_resp

        lat, lon, label = client.geocode("Mumbai")
        assert lat == 19.0760
        assert lon == 72.8777
        assert "Mumbai" in label


def test_geocode_empty_query():
    client = ORSClient(api_key="test-key")
    with pytest.raises(ORSClientError, match="cannot be empty"):
        client.geocode("   ")


def test_geocode_no_results():
    client = ORSClient(api_key="test-key")
    with patch("requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"features": []}
        mock_resp.raise_for_status.return_value = None
        mock_get.return_value = mock_resp

        with pytest.raises(ORSClientError, match="No coordinates found"):
            client.geocode("NonExistentCityXYZ")


def test_get_alternative_routes_success(mock_directions_response):
    client = ORSClient(api_key="test-key")

    with patch("requests.post") as mock_post:
        mock_resp = MagicMock()
        mock_resp.json.return_value = mock_directions_response
        mock_resp.raise_for_status.return_value = None
        mock_post.return_value = mock_resp

        origin = (19.0760, 72.8777)
        dest = (18.5204, 73.8567)

        routes = client.get_alternative_routes(origin, dest, target_count=3)
        assert len(routes) == 3
        assert routes[0]["name"] == "Route 1"
        assert routes[0]["distance_meters"] == 145000.0
        assert routes[0]["duration_seconds"] == 10800.0
        assert len(routes[0]["geometry"]) == 2


def test_get_alternative_routes_fallback_to_car(mock_directions_response):
    client = ORSClient(api_key="test-key")

    # driving-hgv fails, driving-car succeeds
    def mock_post_side_effect(url, **kwargs):
        if "driving-hgv" in url:
            err_resp = MagicMock()
            err_resp.raise_for_status.side_effect = Exception("HGV alternatives not supported")
            return err_resp

        good_resp = MagicMock()
        good_resp.json.return_value = mock_directions_response
        good_resp.raise_for_status.return_value = None
        return good_resp

    with patch("requests.post", side_effect=mock_post_side_effect):
        routes = client.get_alternative_routes((19.07, 72.87), (18.52, 73.85), target_count=3)
        assert len(routes) == 3
        assert routes[0]["profile"] == "driving-car"
