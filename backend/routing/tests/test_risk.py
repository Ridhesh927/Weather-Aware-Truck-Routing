"""
Unit tests for the pure-function weather risk classification engine.
Tests cover every boundary value, each load rule, route metrics, and route ranking
including a hand-computed example.
"""

import pytest

from routing.risk import (
    Level,
    apply_load_rules,
    checkpoint_risk,
    classify_rain,
    classify_snow,
    classify_wind,
    get_recommended_route,
    rank_routes,
    route_metrics,
)


class TestWindClassification:
    """
    Wind thresholds:
    - Low: < 25
    - Moderate: 25-34
    - High: 35-44
    - Severe: 45-54
    - No Travel: >= 55
    """

    @pytest.mark.parametrize(
        "mph, expected",
        [
            (-10.0, Level.LOW),
            (0.0, Level.LOW),
            (10.0, Level.LOW),
            (24.9, Level.LOW),
            # Boundary: 25.0 -> MODERATE
            (25.0, Level.MODERATE),
            (30.0, Level.MODERATE),
            (34.9, Level.MODERATE),
            # Boundary: 35.0 -> HIGH
            (35.0, Level.HIGH),
            (40.0, Level.HIGH),
            (44.9, Level.HIGH),
            # Boundary: 45.0 -> SEVERE
            (45.0, Level.SEVERE),
            (50.0, Level.SEVERE),
            (54.9, Level.SEVERE),
            # Boundary: 55.0 -> NO_TRAVEL
            (55.0, Level.NO_TRAVEL),
            (75.0, Level.NO_TRAVEL),
        ],
    )
    def test_wind_boundaries(self, mph: float, expected: Level):
        assert classify_wind(mph) == expected


class TestRainClassification:
    """
    Rain thresholds (in/hr):
    - Low: < 0.10
    - Moderate: 0.10-0.25
    - High: 0.25-0.50
    - Severe: 0.50-1.00 (inclusive)
    - No Travel: > 1.00
    """

    @pytest.mark.parametrize(
        "in_hr, expected",
        [
            (-0.5, Level.LOW),
            (0.0, Level.LOW),
            (0.05, Level.LOW),
            (0.09, Level.LOW),
            # Boundary: 0.10 -> MODERATE
            (0.10, Level.MODERATE),
            (0.20, Level.MODERATE),
            (0.24, Level.MODERATE),
            # Boundary: 0.25 -> HIGH
            (0.25, Level.HIGH),
            (0.40, Level.HIGH),
            (0.49, Level.HIGH),
            # Boundary: 0.50 -> SEVERE
            (0.50, Level.SEVERE),
            (0.75, Level.SEVERE),
            # Upper boundary: exactly 1.00 -> SEVERE
            (1.00, Level.SEVERE),
            # Boundary: > 1.00 -> NO_TRAVEL
            (1.01, Level.NO_TRAVEL),
            (2.50, Level.NO_TRAVEL),
        ],
    )
    def test_rain_boundaries(self, in_hr: float, expected: Level):
        assert classify_rain(in_hr) == expected


class TestSnowClassification:
    """
    Snow thresholds (in/hr):
    - Low: < 0.5
    - Moderate: 0.5-1.0
    - High: 1.0-2.0
    - Severe: 2.0-3.0 (inclusive)
    - No Travel: > 3.0
    """

    @pytest.mark.parametrize(
        "in_hr, expected",
        [
            (-1.0, Level.LOW),
            (0.0, Level.LOW),
            (0.2, Level.LOW),
            (0.49, Level.LOW),
            # Boundary: 0.5 -> MODERATE
            (0.5, Level.MODERATE),
            (0.8, Level.MODERATE),
            (0.99, Level.MODERATE),
            # Boundary: 1.0 -> HIGH
            (1.0, Level.HIGH),
            (1.5, Level.HIGH),
            (1.99, Level.HIGH),
            # Boundary: 2.0 -> SEVERE
            (2.0, Level.SEVERE),
            (2.5, Level.SEVERE),
            # Upper boundary: exactly 3.0 -> SEVERE
            (3.0, Level.SEVERE),
            # Boundary: > 3.0 -> NO_TRAVEL
            (3.01, Level.NO_TRAVEL),
            (5.0, Level.NO_TRAVEL),
        ],
    )
    def test_snow_boundaries(self, in_hr: float, expected: Level):
        assert classify_snow(in_hr) == expected


class TestCheckpointRisk:
    def test_max_of_three_conditions(self):
        # LOW across all
        assert checkpoint_risk(10, 0.0, 0.0) == Level.LOW
        # Wind dominates (MODERATE)
        assert checkpoint_risk(28, 0.05, 0.1) == Level.MODERATE
        # Rain dominates (HIGH)
        assert checkpoint_risk(15, 0.30, 0.2) == Level.HIGH
        # Snow dominates (SEVERE)
        assert checkpoint_risk(20, 0.10, 2.5) == Level.SEVERE
        # Wind causes NO_TRAVEL
        assert checkpoint_risk(60, 0.0, 0.0) == Level.NO_TRAVEL
        # Rain causes NO_TRAVEL
        assert checkpoint_risk(10, 1.2, 0.0) == Level.NO_TRAVEL
        # Snow causes NO_TRAVEL
        assert checkpoint_risk(10, 0.0, 3.5) == Level.NO_TRAVEL


class TestLoadRules:
    """
    Load rules:
    - Wind >= 55 mph: No Travel, any load
    - Wind 45-54 mph and load > 30,000 lb: No Travel
    - Wind 35-44 mph and load > 40,000 lb: Severe
    Escalate only, never lower.
    """

    def test_wind_over_55_no_travel_any_load(self):
        assert apply_load_rules(Level.LOW, 55.0, 0) == Level.NO_TRAVEL
        assert apply_load_rules(Level.LOW, 55.0, 10_000) == Level.NO_TRAVEL
        assert apply_load_rules(Level.SEVERE, 60.0, 50_000) == Level.NO_TRAVEL

    def test_wind_45_to_54_with_load_threshold(self):
        # At exactly 30,000 lb (not > 30,000), does not escalate to NO_TRAVEL
        assert apply_load_rules(Level.SEVERE, 45.0, 30_000) == Level.SEVERE
        assert apply_load_rules(Level.SEVERE, 50.0, 30_000) == Level.SEVERE
        # Above 30,000 lb: escalates to NO_TRAVEL
        assert apply_load_rules(Level.SEVERE, 45.0, 30_001) == Level.NO_TRAVEL
        assert apply_load_rules(Level.LOW, 50.0, 35_000) == Level.NO_TRAVEL
        assert apply_load_rules(Level.SEVERE, 54.9, 45_000) == Level.NO_TRAVEL

    def test_wind_35_to_44_with_load_threshold(self):
        # At exactly 40,000 lb (not > 40,000), does not escalate to SEVERE
        assert apply_load_rules(Level.HIGH, 35.0, 40_000) == Level.HIGH
        assert apply_load_rules(Level.HIGH, 40.0, 40_000) == Level.HIGH
        # Above 40,000 lb: escalates to SEVERE
        assert apply_load_rules(Level.LOW, 35.0, 40_001) == Level.SEVERE
        assert apply_load_rules(Level.MODERATE, 38.0, 45_000) == Level.SEVERE
        assert apply_load_rules(Level.HIGH, 44.9, 50_000) == Level.SEVERE

    def test_load_rules_never_lower_risk(self):
        # If already NO_TRAVEL due to rain/snow, wind 35-44 & load 45,000 should NOT downgrade to SEVERE
        assert apply_load_rules(Level.NO_TRAVEL, 40.0, 45_000) == Level.NO_TRAVEL
        # If already SEVERE, wind 30 (no rule) and heavy load does not lower or change
        assert apply_load_rules(Level.SEVERE, 30.0, 50_000) == Level.SEVERE


class TestRouteMetrics:
    def test_empty_checkpoints(self):
        metrics = route_metrics([], interval_miles=25.0, total_minutes=90.0)
        assert metrics == {
            "total_miles": 0.0,
            "severe_miles": 0.0,
            "high_miles": 0.0,
            "unknown_miles": 0.0,
            "average_risk": 1.0,
            "blocked": False,
            "total_minutes": 90.0,
        }

    def test_standard_route_metrics(self):
        # 4 checkpoints, 25 miles each: LOW (1), MODERATE (2), HIGH (3), SEVERE (4)
        checkpoints = [
            {"level": Level.LOW, "segment_miles": 25.0},
            {"level": Level.MODERATE, "segment_miles": 25.0},
            {"level": Level.HIGH, "segment_miles": 25.0},
            {"level": Level.SEVERE, "segment_miles": 25.0},
        ]
        metrics = route_metrics(checkpoints, total_minutes=120.0)
        assert metrics["severe_miles"] == 25.0
        assert metrics["high_miles"] == 25.0
        # Average risk: (1*25 + 2*25 + 3*25 + 4*25) / 100 = 250 / 100 = 2.5
        assert metrics["average_risk"] == 2.5
        assert metrics["blocked"] is False
        assert metrics["total_minutes"] == 120.0

    def test_blocked_route_detection(self):
        checkpoints = [
            {"level": Level.LOW, "segment_miles": 25.0},
            {"level": Level.NO_TRAVEL, "segment_miles": 25.0},
        ]
        metrics = route_metrics(checkpoints)
        assert metrics["blocked"] is True
        # (1*25 + 5*25) / 50 = 150 / 50 = 3.0
        assert metrics["average_risk"] == 3.0


class TestRouteRanking:
    """
    Verification of ranking priority and hand-computed example:
    1. Fewest Severe miles
    2. Fewest High miles
    3. Lowest average risk
    4. Shortest travel time
    Blocked routes excluded from recommendation.
    """

    def test_hand_computed_ranking_example(self):
        """
        Hand-computed scenario with 3 routes:
        - Route A:
            4 checkpoints @ 25 miles = 100 miles.
            Levels: [LOW, MODERATE, HIGH, HIGH]
            Severe miles: 0
            High miles: 50
            Average risk: (1 + 2 + 3 + 3) / 4 = 2.25
            Blocked: False
            Total minutes: 120
        - Route B:
            4 checkpoints @ 25 miles = 100 miles.
            Levels: [LOW, LOW, LOW, SEVERE]
            Severe miles: 25
            High miles: 0
            Average risk: (1 + 1 + 1 + 4) / 4 = 1.75
            Blocked: False
            Total minutes: 100
        - Route C:
            4 checkpoints @ 25 miles = 100 miles.
            Levels: [LOW, MODERATE, NO_TRAVEL, LOW]
            Severe miles: 0
            High miles: 0
            Average risk: (1 + 2 + 5 + 1) / 4 = 2.25
            Blocked: True
            Total minutes: 90

        Expected Ranking:
        - Route C is BLOCKED (has NO_TRAVEL), so it is excluded.
        - Comparing Route A and Route B:
            Route A has 0 severe miles.
            Route B has 25 severe miles.
            Rule 1 (fewest Severe miles) decides immediately: Route A > Route B.
            Even though Route B is faster and has lower average risk, Route A wins on safety!
        """
        route_a = {
            "name": "Route A",
            "summary": {
                "severe_miles": 0.0,
                "high_miles": 50.0,
                "average_risk": 2.25,
                "total_minutes": 120.0,
                "blocked": False,
            },
        }
        route_b = {
            "name": "Route B",
            "summary": {
                "severe_miles": 25.0,
                "high_miles": 0.0,
                "average_risk": 1.75,
                "total_minutes": 100.0,
                "blocked": False,
            },
        }
        route_c = {
            "name": "Route C",
            "summary": {
                "severe_miles": 0.0,
                "high_miles": 0.0,
                "average_risk": 2.25,
                "total_minutes": 90.0,
                "blocked": True,
            },
        }

        routes = [route_a, route_b, route_c]
        ranked = rank_routes(routes)

        # Route C must be excluded because it is blocked
        assert len(ranked) == 2
        assert ranked[0]["name"] == "Route A"
        assert ranked[1]["name"] == "Route B"

        best_route, best_index, reason = get_recommended_route(routes)
        assert best_route["name"] == "Route A"
        assert best_index == 0
        assert reason is None

    def test_tie_breakers(self):
        # Tie on severe_miles, tie-broken by high_miles
        r1 = {
            "name": "R1",
            "severe_miles": 10.0,
            "high_miles": 20.0,
            "average_risk": 2.0,
            "total_minutes": 60.0,
            "blocked": False,
        }
        r2 = {
            "name": "R2",
            "severe_miles": 10.0,
            "high_miles": 10.0,
            "average_risk": 2.5,
            "total_minutes": 70.0,
            "blocked": False,
        }
        ranked = rank_routes([r1, r2])
        assert ranked[0]["name"] == "R2"

        # Tie on severe & high miles, tie-broken by average_risk
        r3 = {
            "name": "R3",
            "severe_miles": 10.0,
            "high_miles": 10.0,
            "average_risk": 2.1,
            "total_minutes": 80.0,
            "blocked": False,
        }
        r4 = {
            "name": "R4",
            "severe_miles": 10.0,
            "high_miles": 10.0,
            "average_risk": 2.4,
            "total_minutes": 50.0,
            "blocked": False,
        }
        ranked2 = rank_routes([r3, r4])
        assert ranked2[0]["name"] == "R3"

        # Tie on severe, high, and avg risk, tie-broken by total_minutes
        r5 = {
            "name": "R5",
            "severe_miles": 0.0,
            "high_miles": 0.0,
            "average_risk": 1.5,
            "total_minutes": 100.0,
            "blocked": False,
        }
        r6 = {
            "name": "R6",
            "severe_miles": 0.0,
            "high_miles": 0.0,
            "average_risk": 1.5,
            "total_minutes": 90.0,
            "blocked": False,
        }
        ranked3 = rank_routes([r5, r6])
        assert ranked3[0]["name"] == "R6"

    def test_all_routes_blocked(self):
        r1 = {
            "name": "R1",
            "blocked": True,
            "severe_miles": 0.0,
            "high_miles": 0.0,
            "average_risk": 5.0,
            "total_minutes": 60.0,
        }
        r2 = {
            "name": "R2",
            "blocked": True,
            "severe_miles": 0.0,
            "high_miles": 0.0,
            "average_risk": 5.0,
            "total_minutes": 70.0,
        }
        assert rank_routes([r1, r2]) == []
        best, idx, reason = get_recommended_route([r1, r2])
        assert best is None
        assert idx is None
        assert "No Travel" in reason
