"""
Pure functions for weather risk classification, load rules, route metrics, and route ranking.
This module has no Django or HTTP dependencies so it can be unit-tested cleanly in isolation.
"""

from collections.abc import Mapping
from enum import StrEnum
from typing import Any


class Level(StrEnum):
    """
    Weather risk levels ordered by increasing severity.
    Numeric values: LOW=1, MODERATE=2, HIGH=3, SEVERE=4, NO_TRAVEL=5.
    UNKNOWN represents unclassified or missing weather data (severity 0).
    """

    UNKNOWN = "UNKNOWN"
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    SEVERE = "SEVERE"
    NO_TRAVEL = "NO_TRAVEL"

    @property
    def severity(self) -> int:
        order = {
            Level.UNKNOWN: 0,
            Level.LOW: 1,
            Level.MODERATE: 2,
            Level.HIGH: 3,
            Level.SEVERE: 4,
            Level.NO_TRAVEL: 5,
        }
        return order[self]

    def _resolve_other(self, other: Any) -> int:
        if isinstance(other, Level):
            return other.severity
        if isinstance(other, str):
            return Level[other.strip().upper()].severity
        raise TypeError(f"Cannot compare Level with {type(other)}")

    def __lt__(self, other: Any) -> bool:
        try:
            return self.severity < self._resolve_other(other)
        except (KeyError, TypeError):
            return NotImplemented

    def __le__(self, other: Any) -> bool:
        try:
            return self.severity <= self._resolve_other(other)
        except (KeyError, TypeError):
            return NotImplemented

    def __gt__(self, other: Any) -> bool:
        try:
            return self.severity > self._resolve_other(other)
        except (KeyError, TypeError):
            return NotImplemented

    def __ge__(self, other: Any) -> bool:
        try:
            return self.severity >= self._resolve_other(other)
        except (KeyError, TypeError):
            return NotImplemented

    def __str__(self) -> str:
        return self.value


def to_level(val: Level | str) -> Level:
    """Normalize a Level instance or string name to a Level enum."""
    if isinstance(val, Level):
        return val
    if isinstance(val, str):
        normalized = val.strip().upper()
        if normalized in Level.__members__:
            return Level[normalized]
    raise ValueError(f"Invalid risk level: {val}")


def classify_wind(mph: float) -> Level:
    """
    Classify wind speed (mph) according to Spotter risk thresholds:
    - Low: < 25
    - Moderate: 25-34 (lower bound: 25)
    - High: 35-44 (lower bound: 35)
    - Severe: 45-54 (lower bound: 45)
    - No Travel: >= 55
    """
    if mph < 0:
        return Level.LOW
    if mph >= 55.0:
        return Level.NO_TRAVEL
    if mph >= 45.0:
        return Level.SEVERE
    if mph >= 35.0:
        return Level.HIGH
    if mph >= 25.0:
        return Level.MODERATE
    return Level.LOW


def classify_rain(in_hr: float) -> Level:
    """
    Classify rain rate (in/hr) according to Spotter risk thresholds:
    - Low: < 0.10
    - Moderate: 0.10-0.25 (lower bound: 0.10)
    - High: 0.25-0.50 (lower bound: 0.25)
    - Severe: 0.50-1.00 (lower bound: 0.50, up to 1.00 inclusive)
    - No Travel: > 1.00
    """
    if in_hr < 0:
        return Level.LOW
    if in_hr > 1.00:
        return Level.NO_TRAVEL
    if in_hr >= 0.50:
        return Level.SEVERE
    if in_hr >= 0.25:
        return Level.HIGH
    if in_hr >= 0.10:
        return Level.MODERATE
    return Level.LOW


def classify_snow(in_hr: float) -> Level:
    """
    Classify snow rate (in/hr) according to Spotter risk thresholds:
    - Low: < 0.5
    - Moderate: 0.5-1.0 (lower bound: 0.5)
    - High: 1.0-2.0 (lower bound: 1.0)
    - Severe: 2.0-3.0 (lower bound: 2.0, up to 3.0 inclusive)
    - No Travel: > 3.0
    """
    if in_hr < 0:
        return Level.LOW
    if in_hr > 3.0:
        return Level.NO_TRAVEL
    if in_hr >= 2.0:
        return Level.SEVERE
    if in_hr >= 1.0:
        return Level.HIGH
    if in_hr >= 0.5:
        return Level.MODERATE
    return Level.LOW


def checkpoint_risk(wind_mph: float, rain_in_hr: float, snow_in_hr: float) -> Level:
    """
    Determine a checkpoint's base risk level.
    The base risk is the highest of wind, rain, and snow classifications.
    """
    w_level = classify_wind(wind_mph)
    r_level = classify_rain(rain_in_hr)
    s_level = classify_snow(snow_in_hr)
    return max(w_level, r_level, s_level)


def apply_load_rules(level: Level | str, wind_mph: float, load_lb: float) -> Level:
    """
    Apply load escalation rules. Load rules can only raise the risk level, never lower it:
    - Wind >= 55 mph: No Travel, any load.
    - Wind 45-54 mph and load > 30,000 lb: No Travel.
    - Wind 35-44 mph and load > 40,000 lb: Severe.
    """
    current = to_level(level)

    # Rule 1: Wind >= 55 mph -> No Travel, any load
    if wind_mph >= 55.0:
        return Level.NO_TRAVEL

    # Rule 2: Wind 45-54 mph and load > 30,000 lb -> No Travel
    if 45.0 <= wind_mph < 55.0 and load_lb > 30_000.0:
        return Level.NO_TRAVEL

    # Rule 3: Wind 35-44 mph and load > 40,000 lb -> Severe (escalate only)
    if 35.0 <= wind_mph < 45.0 and load_lb > 40_000.0:
        return max(current, Level.SEVERE)

    return current


def route_metrics(
    checkpoints: list[Any],
    interval_miles: float = 25.0,
    total_minutes: float = 0.0,
) -> dict[str, Any]:
    """
    Compute summary metrics for a route's checkpoints:
    - total_miles: total route distance evaluated across checkpoints
    - severe_miles: miles spent in SEVERE risk
    - high_miles: miles spent in HIGH risk
    - unknown_miles: miles where weather data was unavailable
    - average_risk: miles-weighted average risk level (LOW=1 to NO_TRAVEL=5, excluding UNKNOWN)
    - blocked: True if any checkpoint is NO_TRAVEL
    - total_minutes: total travel duration in minutes
    """
    if not checkpoints:
        return {
            "total_miles": 0.0,
            "severe_miles": 0.0,
            "high_miles": 0.0,
            "unknown_miles": 0.0,
            "average_risk": 1.0,
            "blocked": False,
            "total_minutes": round(float(total_minutes), 2),
        }

    severe_miles = 0.0
    high_miles = 0.0
    unknown_miles = 0.0
    total_miles = 0.0
    known_miles = 0.0
    weighted_risk_sum = 0.0
    blocked = False

    for cp in checkpoints:
        # Support dicts or objects
        if isinstance(cp, Mapping):
            raw_level = cp.get("level") or cp.get("risk_level") or Level.LOW
            miles = float(cp.get("segment_miles", interval_miles))
        else:
            raw_level = getattr(cp, "level", getattr(cp, "risk_level", Level.LOW))
            miles = float(getattr(cp, "segment_miles", interval_miles))

        level = to_level(raw_level)

        if level == Level.UNKNOWN:
            unknown_miles += miles
        elif level == Level.NO_TRAVEL:
            blocked = True
        elif level == Level.SEVERE:
            severe_miles += miles
        elif level == Level.HIGH:
            high_miles += miles

        if level != Level.UNKNOWN:
            weighted_risk_sum += level.severity * miles
            known_miles += miles
        total_miles += miles

    avg_risk = weighted_risk_sum / known_miles if known_miles > 0 else 1.0

    return {
        "total_miles": round(total_miles, 2),
        "severe_miles": round(severe_miles, 2),
        "high_miles": round(high_miles, 2),
        "unknown_miles": round(unknown_miles, 2),
        "average_risk": round(avg_risk, 2),
        "blocked": blocked,
        "total_minutes": round(float(total_minutes), 2),
    }


def _get_summary(route: Any) -> Mapping[str, Any]:
    """Helper to extract metric summary dictionary from a route dict or object."""
    if isinstance(route, Mapping):
        if "summary" in route and isinstance(route["summary"], Mapping):
            return route["summary"]
        return route
    if hasattr(route, "summary") and isinstance(route.summary, Mapping):
        return route.summary
    return getattr(route, "__dict__", {})


def rank_routes(routes: list[Any]) -> list[Any]:
    """
    Rank routes using the strict priority order from the problem statement:
    1. Fewest Severe miles
    2. Fewest High miles
    3. Lowest average risk
    4. Shortest travel time (total_minutes)

    Routes containing any NO_TRAVEL checkpoint (blocked == True) are excluded.
    Returns the list of eligible routes sorted from best to worst.
    """
    eligible: list[Any] = []
    for r in routes:
        summary = _get_summary(r)
        is_blocked = summary.get("blocked", False)
        if not is_blocked:
            eligible.append(r)

    def sort_key(r: Any) -> tuple[float, float, float, float]:
        summary = _get_summary(r)
        return (
            float(summary.get("severe_miles", 0.0)),
            float(summary.get("high_miles", 0.0)),
            float(summary.get("average_risk", 1.0)),
            float(summary.get("total_minutes", 0.0)),
        )

    return sorted(eligible, key=sort_key)


def get_recommended_route(
    routes: list[Any],
) -> tuple[Any | None, int | None, str | None]:
    """
    Select the top recommended route from a list of route options.
    Returns:
    - recommended_route: The best route object/dict, or None if none are eligible.
    - recommended_index: Original 0-based index of the recommended route, or None.
    - reason: Explanation if no route is eligible, or None.
    """
    ranked = rank_routes(routes)
    if not ranked:
        return (
            None,
            None,
            "All routes contain No Travel checkpoints due to hazardous weather conditions.",
        )
    best = ranked[0]
    best_index = routes.index(best)
    return best, best_index, None
