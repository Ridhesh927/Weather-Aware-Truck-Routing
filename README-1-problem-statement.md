# Weather-Aware Truck Routing: Problem Statement

## Problem

Truck drivers choose routes mostly on distance and time. They rarely see how wind, rain, or snow along the way will affect their safety, and heavy loads make high wind much more dangerous. This app helps a driver compare routes and pick the one that is safest first and fastest second.

## Goal

Build a React + Django web app that:

1. Takes origin, destination, departure date/time, and load weight.
2. Generates 3 route options from a third-party routing API.
3. Samples points along each route every 10, 25, or 50 miles (configurable).
4. Estimates the truck's arrival time at each checkpoint.
5. Fetches the forecast for that checkpoint at that arrival time.
6. Classifies weather risk per checkpoint using the Spotter risk and load rules.
7. Recommends the best route, balancing weather risk and travel time.
8. Shows all routes, checkpoints, risk levels, ETAs, and route summaries on a map.
9. Shows a weather heatmap along the trip corridor with a 0–48 hour forecast slider.

Third-party APIs are allowed for routing, geocoding, and weather. A routing engine does not need to be built.

## Inputs

| Field | Type | Notes |
|---|---|---|
| Origin | text | Geocoded to lat/lon |
| Destination | text | Geocoded to lat/lon |
| Departure | datetime | Must not be in the past |
| Load weight | number (lb) | Used by load rules |
| Sample interval | 10 / 25 / 50 mi | Default 25 |

## Risk Classification

Each condition is classified separately. The checkpoint's base risk is the highest of the three.

| Condition | Low | Moderate | High | Severe | No Travel |
|---|---|---|---|---|---|
| Wind (mph) | < 25 | 25–34 | 35–44 | 45–54 | ≥ 55 |
| Rain (in/hr) | < 0.10 | 0.10–0.25 | 0.25–0.50 | 0.50–1.00 | > 1.00 |
| Snow (in/hr) | < 0.5 | 0.5–1.0 | 1.0–2.0 | 2.0–3.0 | > 3.0 |

## Load Rules (escalation)

Load rules can only raise the risk level, never lower it.

- Wind ≥ 55 mph: **No Travel**, any load.
- Wind 45–54 mph and load > 30,000 lb: **No Travel**.
- Wind 35–44 mph and load > 40,000 lb: **Severe**.

## Route Recommendation

Routes are compared in this order:

1. Fewest Severe miles
2. Fewest High miles
3. Lowest average risk
4. Shortest travel time

A route containing any No Travel checkpoint is not eligible for recommendation. If all three routes are ineligible, the app says so and shows the blocking checkpoints.

## Deliverables

- GitHub repository
- Hosted application
- 5–10 minute Loom walkthrough

## Evaluation

| Weight | Area | What it means in practice |
|---|---|---|
| 40% | Routes, weather, risk, and recommendation logic | Correct thresholds, correct load rules, correct ranking, verifiable with tests |
| 40% | UI, map, and heatmap smoothness and performance | Responsive map, slider that does not lag, sensible loading states |
| 15% | Code quality | Clear structure, tests, linting, no secrets in the repo |
| 5% | Documentation and walkthrough | Clear README, clear 5–10 minute video |

The brief says: **prioritize correctness and clarity over extra features.**

## Assumptions (state these in the README and the Loom)

- "Sample every 10 / 25 / 50 miles" is read as a configurable interval. The default is 25 miles.
- Miles attributed to a checkpoint equal the sampling interval (each checkpoint covers the segment behind it).
- Average speed is taken from the routing API's route duration, distributed by distance along the route.
- Weather at a checkpoint uses the forecast hour closest to its ETA.
- The heatmap shows the forecast at a chosen hour offset (0–48 h from now) at each checkpoint location. It does not show the ETA-based risk. The recommendation uses ETA-based risk.
- Rain and snow rates are hourly totals, which equal in/hr.
- Forecast data is taken from Open-Meteo. ETAs beyond its forecast range are marked as unavailable.
