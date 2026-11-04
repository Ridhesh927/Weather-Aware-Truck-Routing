# Agent Prompt: Build the Weather-Aware Truck Routing App

Paste everything below the line into a coding agent (Claude Code, Cursor, or similar) from an empty folder. Read `README-1-problem-statement.md` and `README-3-roadmap.md` first so you know the rules and the plan.

---

You are a senior full-stack engineer building a take-home assessment: a **weather-aware truck routing web app** using **React (Vite + TypeScript)** for the frontend and **Django + Django REST Framework** for the backend.

## Hard constraints

- Total human-time budget is 16 hours across 4 days. Work in the phases below in order. Do not add features outside the spec.
- Correctness and clarity matter more than extra features. Prefer fewer features that are right and tested.
- Never commit API keys. Read them from environment variables. Provide `.env.example`.
- Backend tests must not call external APIs. Mock or use recorded fixtures.
- Keep the risk engine as pure functions with no Django or HTTP imports, so it can be unit-tested.

## Stack

- Backend: Python 3.12, Django, DRF, requests, pytest, ruff.
- Frontend: React 18, Vite, TypeScript, react-leaflet + Leaflet, leaflet.heat, Vitest, ESLint.
- Routing and geocoding: OpenRouteService (driving-hgv profile, alternative_routes target_count 3; fall back to driving-car if alternatives are unsupported for hgv).
- Weather: Open-Meteo hourly forecast (no key). Request `wind_speed_unit=mph`, `precipitation_unit=inch`, and `timezone=auto`. Read `hourly_units` in the response and convert snowfall to in/hr if it is not already in inches.
- Production: Django serves the built React app with WhiteNoise. One Render web service.

## Phase 1: Foundation and risk engine

1. Create `backend/` (Django project `config`, app `routing`) and `frontend/` (Vite React TS).
2. Add a `/api/health/` endpoint. Configure CORS for the Vite dev server.
3. Implement `backend/routing/risk.py` with pure functions:
   - `classify_wind(mph) -> Level`, `classify_rain(in_hr) -> Level`, `classify_snow(in_hr) -> Level`.
   - Level enum: LOW, MODERATE, HIGH, SEVERE, NO_TRAVEL.
   - Boundaries: a value belongs to the tier whose lower bound it meets. Example: 25 mph is MODERATE, 0.10 in/hr rain is MODERATE. Rain at exactly 1.00 is SEVERE. Rain above 1.00 is NO_TRAVEL.
   - `checkpoint_risk(wind, rain, snow) -> Level` (max of the three).
   - `apply_load_rules(level, wind_mph, load_lb) -> Level` (escalate only).
   - `route_metrics(checkpoints) -> dict` with severe_miles, high_miles, average_risk (miles-weighted, LOW=1 to NO_TRAVEL=5), blocked (bool), total_minutes.
   - `rank_routes(routes) -> list` using the priority order in the problem statement. Exclude blocked routes from recommendation.
4. Write pytest tests for every boundary value and each load rule. Include a hand-computed example for route ranking. Make the tests pass before moving on.
5. Set up ruff, pytest, Vitest, and ESLint. Confirm `npm run build` and `pytest` both pass locally.

## Phase 2: Routing, checkpoints, and weather

1. `backend/routing/clients/ors.py`: geocode(text) and get_alternative_routes(origin, dest) returning 3 routes with GeoJSON geometry, distance in meters, and duration in seconds.
2. `backend/routing/geo.py`: haversine distance and `sample_checkpoints(coords, interval_miles) -> list[(lat, lon, mile_marker)]` using linear interpolation along the polyline. Test with a straight line of known length.
3. ETA for each checkpoint = departure + (mile_marker / total_miles) × total_duration.
4. `backend/routing/clients/weather.py`: fetch hourly forecast for many lat/lon points in one batched Open-Meteo request. Cache results for 60 minutes with Django's cache framework, keyed by rounded coordinates and hour.
5. For each checkpoint, pick the forecast hour nearest its ETA, classify wind, rain, and snow, and compute checkpoint risk and the load-adjusted risk.
6. `POST /api/trips/plan/` accepts `{origin, destination, departure_at, load_lb, interval_miles}` and returns:
   - `routes`: 3 items, each with geometry, summary (miles, minutes, severe_miles, high_miles, average_risk, blocked), and checkpoints (lat, lon, mile, eta, wind, rain, snow, level).
   - `recommended_index` (or null with a reason).
   - `heatmap`: for each checkpoint location across all routes, a 49-element array of risk levels for forecast hours 0 through 48.
7. Write an integration test for the plan endpoint with the external clients mocked.

## Phase 3: Frontend

1. Input form: origin, destination, departure datetime-local, load weight, interval selector (10 / 25 / 50). Validate client-side. Disable submit while loading.
2. Map (react-leaflet): draw all 3 routes as polylines, one color each. The recommended route is bold. Checkpoints are circle markers colored by risk level. Clicking a checkpoint shows ETA, wind, rain, snow, and level.
3. Route summary cards: name, miles, duration, severe miles, high miles, average risk, blocked status. Mark the recommended route clearly.
4. Heatmap: a leaflet.heat layer built from the checkpoints in the `heatmap` payload for the selected hour. Map level to intensity (LOW 0.2 … NO_TRAVEL 1.0).
5. 0–48 hour slider: updates the heatmap client-side from the precomputed payload. Do not call the API on each slider move. Keep the slider responsive.
6. Handle loading, empty, and error states. Show a clear message if no route is recommendable.

## Phase 4: Deploy, docs, CI/CD

1. Add `.github/workflows/ci-cd.yml` (provided separately). CI runs backend lint, check, and tests, and frontend lint, test, and build. Deploy runs on push to main via a Render deploy hook stored as a GitHub secret.
2. Render build command: install backend requirements, build the frontend, and copy `frontend/dist` into the Django static location. Start command: gunicorn.
3. Write the final `README.md` with: setup steps, env variables, architecture diagram, API reference, risk logic summary, assumptions, and the hosted URL.

## Output expectations

After each phase, print a short status: what was built, which tests pass, and anything skipped. Do not start the next phase until the current one's tests pass. If an API or spec detail is unclear, state the assumption in the README instead of asking me to decide.
