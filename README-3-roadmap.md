# Roadmap and Build Plan

**Time budget:** 4 days, 16 hours maximum. Work in 4-hour blocks, one block per day.

## 1. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript | Required stack, fast builds |
| Map | react-leaflet + Leaflet (OpenStreetMap tiles) | Free, no key, handles polylines and markers well |
| Heatmap | leaflet.heat | Small, works directly with Leaflet |
| Backend | Django 5 + Django REST Framework | Required stack; DRF gives serializers and tests quickly |
| Routing and geocoding | OpenRouteService | Free key, supports alternative routes and an HGV profile |
| Weather | Open-Meteo | No key, hourly forecast up to 16 days, multi-location batching |
| Cache | Django locmem cache (Redis optional) | Enough for an assessment, zero setup |
| Testing | pytest, Vitest | Fast, standard |
| Lint | ruff, ESLint | Standard, fast |
| CI/CD | GitHub Actions | Required, runs on push and PR |
| Hosting | Render (one web service) | Django serves the built React app, so one deploy covers both |

Why one host: the spec asks for a hosted app. Serving the React build from Django removes CORS and two-deploy complexity.

## 2. Architecture

```
Browser (React + Leaflet)
   │  POST /api/trips/plan/
   ▼
Django + DRF  ──► OpenRouteService  (geocode, 3 alternative routes)
   │
   ├─ geo.py        sample checkpoints every N miles, ETA per checkpoint
   ├─ clients/      Open-Meteo (batched, cached 60 min)
   ├─ risk.py       pure functions: tiers, load rules, route metrics, ranking
   ▼
JSON: routes, checkpoints, summaries, recommendation, 49-hour heatmap grid
   │
Browser: map, cards, slider (client-side, no extra API calls)
```

Key design choice: the plan endpoint returns all 49 forecast hours per checkpoint. The slider then runs entirely in the browser, which keeps it smooth.

## 3. Core logic (short form)

```
for each of 3 routes:
    points = sample every N miles
    for each point i:
        eta_i   = departure + (mile_i / total_miles) * total_minutes
        wx_i    = forecast at nearest hour to eta_i
        level_i = max(tier(wind), tier(rain), tier(snow))
        level_i = load_rule(level_i, wind, load)
        severe_miles += N if level_i == SEVERE
        high_miles   += N if level_i == HIGH
    blocked = any level_i == NO_TRAVEL

eligible = routes where not blocked
recommended = sort eligible by (severe_miles, high_miles, avg_risk, minutes)[0]
```

Hand-check one route on paper before coding the ranking. Write the numbers in a table and confirm the test expects the same result.

## 4. Day-by-day plan

### Day 1: Foundation and risk engine (4 h)

| Time | Task | Done when |
|---|---|---|
| 0:00–0:30 | Create GitHub repo, sign up for OpenRouteService, create `.env.example` | Repo exists, key works in a curl test |
| 0:30–1:30 | Scaffold Django (DRF, health endpoint, CORS) and Vite React TS | Both dev servers run |
| 1:30–3:30 | `risk.py` pure functions and tests: tier boundaries, load rules, metrics, ranking | All tests green, ranking example hand-checked |
| 3:30–4:00 | Push CI workflow, confirm first green run | Green check on GitHub |

### Day 2: Routing, checkpoints, weather (4 h)

| Time | Task | Done when |
|---|---|---|
| 0:00–1:00 | ORS client: geocode and 3 alternative routes, mocked tests | Parsed routes match fixture |
| 1:00–2:00 | `geo.py`: haversine, polyline sampling, ETA | Straight-line test passes |
| 2:00–3:30 | Open-Meteo batched client, unit checks against `hourly_units`, caching | One real call returns 49 hours for 2 points |
| 3:30–4:00 | `POST /api/trips/plan/` end to end with mocked clients | Integration test passes |

### Day 3: Recommendation and UI (4 h)

| Time | Task | Done when |
|---|---|---|
| 0:00–0:30 | Wire recommendation and `blocked` handling into the response | Recommended index correct in tests |
| 0:30–2:00 | Form and map: 3 colored polylines, checkpoint markers, popups | Real trip renders on map |
| 2:00–2:45 | Route summary cards, recommended badge | Summaries match API numbers |
| 2:45–3:45 | Heatmap layer and 0–48 h slider, client-side | Slider updates without a network call |
| 3:45–4:00 | Loading, empty, and error states | Bad address shows a message, not a crash |

### Day 4: Deploy, docs, walkthrough (4 h)

| Time | Task | Done when |
|---|---|---|
| 0:00–1:30 | Render service, build command, deploy hook secret, deploy job in CI | Hosted URL loads and plans a trip |
| 1:30–2:00 | Smoke test on hosted app, check heatmap and slider speed | Works on a phone-sized window too |
| 2:00–2:45 | Final README: setup, env, architecture, API, assumptions, hosted URL | Someone else could run it from the README |
| 2:45–3:45 | Loom: script, one take, one retake, 5–10 minutes | Video under 10 minutes, shows all deliverables |
| 3:45–4:00 | Final push, verify CI and deploy green | Repo, app, and video all linked |

Total: 16 hours.

## 5. Cut list (if running late)

Cut in this order, and never cut the risk logic or its tests:

1. Sampling interval selector (fix at 25 miles, state it in the README).
2. Caching (correct but slower).
3. Heatmap polish (use simple colored markers for the slider instead).
4. Mobile layout polish.

## 6. CI/CD (GitHub Actions)

The workflow file is `.github/workflows/ci-cd.yml`. It runs on push and pull request.

- **backend job:** Python 3.12, install requirements, `ruff check`, `manage.py check`, `pytest`. Tests run with dummy keys and no network.
- **frontend job:** Node 20, `npm ci`, `npm run lint`, `npm test`, `npm run build`.
- **deploy job:** only on push to `main`, after both jobs pass. It calls the Render deploy hook stored in the `RENDER_DEPLOY_HOOK` secret.

Setup steps:
1. In Render, create the web service and copy its deploy hook URL.
2. In GitHub, go to Settings → Secrets and variables → Actions, and add `RENDER_DEPLOY_HOOK`.
3. Set `ORS_API_KEY` and `DJANGO_SECRET_KEY` as environment variables in Render (not in the repo).
4. Protect `main` so CI must pass before merge (optional, but it shows good practice).

## 7. Deliverables checklist

- [ ] GitHub repo is public, with a clear README and no secrets
- [ ] Hosted app loads and plans a real trip from start to finish
- [ ] 3 routes, checkpoints, risk levels, ETAs, and summaries on the map
- [ ] Recommended route with a reason
- [ ] Heatmap with 0–48 hour slider
- [ ] Tests for risk thresholds, load rules, and ranking pass in CI
- [ ] CI and deploy workflows are green
- [ ] Loom walkthrough, 5–10 minutes, covers the architecture, the risk logic, one live demo, and assumptions

## 8. Main risks

| Risk | Mitigation |
|---|---|
| ORS alternatives not available for the HGV profile | Fall back to driving-car and note it in the README |
| Open-Meteo snowfall units differ from expectation | Read `hourly_units` and convert in code, with a unit test |
| Free-tier rate limits during demo | Cache the weather, and test with a short route first |
| Render cold start slows the first load | Open the URL 5 minutes before recording |
| Running over 16 hours | Follow the cut list; stop at the 16-hour mark and submit what works |
