# 5–10 Minute Loom Walkthrough Script
## Weather-Aware Commercial Truck Routing Engine

> **Guiding Principle:** *Prioritize correctness and clarity over extra features.*
>
> **Deliverables Covered:**
> 1. ✅ **GitHub Repository**: Clean modular codebase, 100% passing test suites, strict linting.
> 2. ✅ **Hosted Application**: Live Vercel Frontend + Production Render Backend.
> 3. ✅ **5–10 Min Loom Walkthrough**: Directly mapped to the assessment's 4-part evaluation rubric.

---

### Evaluation Weight Breakdown & Timing Guide (Target: 7–8 Minutes)

| Weight | Assessment Area | Duration | Core Focus |
|---|---|---|---|
| **40%** | **Routes, Weather, Risk & Recommendation Logic** | 3:00 | Spotter hazard tiers, pure risk engine, cargo load escalation, 4-tier tiebreak ranking, ETA/geometry math |
| **40%** | **UI, Map & Heatmap Smoothness & Performance** | 2:30 | Esri clean tiles, 3 corridor alternatives, hazard pins, instantaneous 0–48h client-side heatmap scrubber |
| **15%** | **Code Quality & Correctness** | 1:30 | Pure functions in `risk.py`, no framework coupling, 82 backend pytest tests, 10 Vitest tests, Ruff linting |
| **5%** | **Documentation & Deliverables** | 0:30 | Live app links, GitHub repo, transparent assumptions & wrap-up |

---

## 🎙️ Spoken Script & Screen Actions

### 0. Introduction & Live Application (0:00 – 0:45)
**Screen to show**: Live hosted web application (`https://weather-aware-truck-routing-ridhesh.vercel.app/`).

> *"Hello! Today I'm demonstrating our **Weather-Aware Commercial Truck Routing application** built for commercial logistics dispatchers.
>
> In commercial freight, picking routes strictly on shortest distance or shortest transit time leads to disasters. Heavy 30,000 to 45,000-pound semi-trucks face severe rollover and jackknife risks when hit with high crosswinds, freezing rain, or heavy snow.
>
> Our application evaluates highway alternatives, samples road corridors at regular intervals, projects exact arrival ETAs, queries weather forecasts, and applies pure-function cargo risk rules to **recommend the safest route first and fastest second**."*

---

### Part 1: Routes, Weather, Risk & Recommendation Logic (40% Evaluation) (0:45 – 3:45)
**Screen to show**: Split screen between VS Code (`backend/routing/risk.py` & `backend/routing/geo.py`) and the app.

> *"Let's dive into the core logic, which accounts for 40% of the evaluation:
>
> #### 1. Pure Risk Classification Engine (`backend/routing/risk.py`)
> The risk engine is built completely from **pure functions** with zero external or HTTP dependencies:
> - **Wind, Rain, and Snow Tiers**: We strictly classify weather into five Spotter levels: `LOW`, `MODERATE`, `HIGH`, `SEVERE`, and `NO_TRAVEL`.
> - **Boundary Precision**:
>   - Wind: 25 mph is Moderate, 35 mph is High, 55 mph is No Travel.
>   - Rain: 0.10 in/hr is Moderate, 1.00 in/hr is Severe, >1.00 in/hr is No Travel.
>   - Snow: 0.10 in/hr is Moderate, 0.50 in/hr is High, 1.50 in/hr is Severe, >1.50 in/hr is No Travel.
> - **Load Rules (Escalate Only)**: The rules can **only escalate risk, never lower it**:
>   - Any wind ≥ 55 mph: Immediate `NO_TRAVEL` for *any* cargo weight.
>   - Winds 45–54 mph: Escalates to `NO_TRAVEL` if the gross cargo weight exceeds **30,000 lbs**.
>   - Winds 35–44 mph: Escalates to `SEVERE` if the cargo weight exceeds **40,000 lbs**.
>
> #### 2. Four-Tier Recommendation Hierarchy
> When evaluating candidate routes, our ranking engine strictly enforces the specification's 4-tier priority:
> 1. **Fewest Severe miles**
> 2. **Fewest High miles**
> 3. **Lowest average risk score**
> 4. **Shortest travel time**
> Any route with even a single `NO_TRAVEL` checkpoint is disqualified and marked as **BLOCKED** with the exact mile marker and blocking hazard reported to the dispatcher.
>
> #### 3. Geometry & ETA Correctness (`backend/routing/geo.py`)
> - **No ETA Drift**: We calculate the cumulative polyline distance using haversine geometry and pass that exact geometry length into `calculate_eta`. This guarantees the destination arrival time matches departure plus duration exactly without clamping.
> - **No Missing Remainder Miles**: The final destination is always included whenever remainder distance > 0, ensuring that the sum of checkpoint segment miles matches the corridor length precisely.
> - **Safe Weather Fallbacks**: Missing or unqueried checkpoints are labeled `UNKNOWN` and excluded from low-risk calculations so bad data is never masked as safe."*

---

### Part 2: UI, Map & Heatmap Smoothness & Performance (40% Evaluation) (3:45 – 6:15)
**Screen to show**: Live Browser on Vercel (`https://weather-aware-truck-routing-ridhesh.vercel.app/`).

> *"Now let's examine the user experience, mapping, and responsiveness (40% of the evaluation):
>
> #### 1. High-Performance Mapping & Tile Reliability
> - Notice the crisp base map: we use **Esri World Street Map tiles**, which provide fast, unmetered, watermark-free vector rendering across all devices, completely eliminating OpenStreetMap 403 blocks and Carto watermark overlays.
> - The map displays three distinct route alternatives:
>   - **Recommended Corridor (Route 1)**: Highlighted in bold **Industrial Safety Yellow** (#f59e0b) with high-contrast outer casing.
>   - **Alternative Corridors (Routes 2 & 3)**: Rendered in contrasting cyan and violet for instant distinction.
>
> #### 2. Route Checkpoint Markers & Popups
> - Along the selected route, checkpoints are sampled every 25 miles (configurable to 10 or 50 miles).
> - Each checkpoint is rendered as a clean circular pin colored by its risk tier (Green for Low, Yellow for Moderate, Orange for High, Red for Severe, Dark Slate for No Travel).
> - Clicking on any checkpoint pin shows an interactive popup displaying the **projected arrival ETA**, **exact mile marker**, **wind speed**, **precipitation rate**, **snowfall**, and the **active load rule** applied.
>
> #### 3. 0–48 Hour Timeline Scrubber & Corridor Heatmap
> *(Click Play or drag the slider)*:
> - Notice how smoothly the timeline scrubs from hour 0 to hour 48:
> - As I drag the scrubber, the corridor heatmap and risk metrics update **instantaneously at 60 fps**.
> - **Performance Architecture**: All 48 hours of weather forecasts are returned in a compact matrix in the initial plan response. Zero network requests occur while scrubbing. Everything computes client-side in memory for butter-smooth interaction."*

---

### Part 3: Code Quality & Automated Testing (15% Evaluation) (6:15 – 7:45)
**Screen to show**: Terminal in VS Code running `pytest` and frontend tests.

> *"Code quality accounts for 15% of the evaluation:
>
> #### 1. Automated Backend Test Suite
> Let's run our backend test suite:
> ```bash
> python -m pytest -q
> ```
> *(Point to terminal output)*:
> - **82 unit and integration tests** pass in under 2 seconds.
> - Tests cover exact boundary thresholds for wind, rain, and snow, cargo weight escalation, strict 4-tier ranking, polyline haversine distance consistency, and API error handling.
> - Linter compliance: `python -m ruff check .` passes with zero violations.
>
> #### 2. Frontend Test Suite & TypeScript Rigor
> On the frontend:
> ```bash
> npm test
> ```
> - **10 Vitest tests** pass across 3 test suites, validating form state management, preset loading, timeline scrubber interactions, and accessibility.
> - Strict TypeScript compiler checks ensure zero type errors."*

---

### Part 4: Documentation, Deliverables & Conclusion (5% Evaluation) (7:45 – 8:30)
**Screen to show**: GitHub repository page (`https://github.com/Ridhesh927/Weather-Aware-Truck-Routing`) and `README.md`.

> *"To close with the deliverables and documentation:
> 1. **Hosted Application**: Fully deployed with frontend on Vercel and backend on Render with CORS and production static asset serving.
> 2. **GitHub Repository**: Includes comprehensive documentation in `README.md`, architectural sequence diagrams, API schema documentation, and setup steps for both local and Docker environments.
> 3. **Transparent Assumptions**:
>    - Checkpoint weather uses the forecast hour closest to its projected arrival ETA.
>    - Load rules apply to gross cargo weight and strictly escalate risk.
>    - The timeline scrubber visualizes corridor weather fronts across 48 hours, while recommendation decisions evaluate ETA-specific weather.
>
> By prioritizing correctness, mathematical consistency, and silky-smooth client-side responsiveness, this application delivers a reliable dispatch tool that truly protects drivers and cargo.
>
> Thank you!"*

---

### Quick Recording Checklist Before You Record
- [ ] Browser window sized to 1080p (1920x1080) for sharp readability.
- [ ] Live URL loaded: `https://weather-aware-truck-routing-ridhesh.vercel.app/`
- [ ] Have VS Code ready with `backend/routing/risk.py` and a terminal open.
- [ ] Test the play/pause button on the 0–48h timeline scrubber once before recording to verify smooth 60fps animation.
- [ ] Keep Loom duration between 6 to 8 minutes.
