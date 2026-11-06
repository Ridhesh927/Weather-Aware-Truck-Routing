# 5–10 Minute Loom Video Walkthrough Script

Use this script as your guide when recording your Loom demonstration video. It covers all evaluation areas: the core problem, system architecture, pure risk engine, live UI demo, assumptions, and CI/CD.

---

### Timing Breakdown (Target: 6–8 minutes total)

| Section | Target Duration | Focus |
|---|---|---|
| **1. Introduction & Problem** | 1:00 | Why truck routing needs weather awareness & load escalation |
| **2. Architecture Overview** | 1:00 | Single Render service, React 18, Django 5, ORS, Open-Meteo |
| **3. Pure Risk Engine Code Tour** | 1:30 | `backend/routing/risk.py`, Spotter tiers, load rules, ranking |
| **4. Live Interactive UI Demo** | 2:30 | Mumbai-Delhi corridor, 3 routes, Leaflet pins, 0-48h scrubber |
| **5. Testing & CI/CD** | 1:00 | 82 pytest tests, 10 Vitest tests, GitHub Actions green check |
| **6. Assumptions & Wrap-up** | 0:30 | Key assumptions & submission wrap-up |

---

## 🎙️ Spoken Script & Screen Actions

### 1. Introduction (0:00 – 1:00)
**Screen to show**: Browser showing the home page of the application (`http://localhost:5173` or your live Render URL).

> *"Hello everyone! Today I’m walking through our **Weather-Aware Commercial Truck Routing application**.*
>
> *In commercial logistics, drivers and dispatchers traditionally pick routes based strictly on mileage or the shortest travel time. However, commercial freight—especially heavy 30,000 to 45,000-pound rigs—faces extreme rollover and jackknife hazards when exposed to high crosswinds, torrential monsoon rains, or mountain freezing snow.*
>
> *Our goal with this application is simple: **recommend the route that is safest first and fastest second**."*

---

### 2. Architecture & Tech Stack (1:00 – 2:00)
**Screen to show**: Open `README.md` or show the architecture diagram.

> *"Let's look at how the system is designed:*
>
> *On the frontend, we use **React 18 with Vite and TypeScript**, styled in an **Industrial Safety Yellow** high-visibility theme with **React-Leaflet** for interactive mapping and **leaflet.heat** for corridor weather heatmaps.*
>
> *On the backend, we use **Django 5 and Django REST Framework**, served in production with **WhiteNoise** as a single unified service on Render. This eliminates cross-origin latency and CORS complications.*
>
> *For routing, we connect to **OpenRouteService** with an intelligent South Asian city registry fallback. For weather, we query **Open-Meteo's** hourly forecast with a 60-minute in-memory cache."*

---

### 3. Pure Risk Engine Code Tour (2:00 – 3:30)
**Screen to show**: Open `backend/routing/risk.py` in VS Code / IDE.

> *"A critical requirement of the assessment was keeping the risk classification engine as pure functions with zero framework or HTTP dependencies.*
>
> *(Point to `classify_wind`, `classify_rain`, `classify_snow`): Here we classify each weather variable into five Spotter tiers: Low, Moderate, High, Severe, and No Travel based on exact boundary definitions.*
>
> *(Point to `apply_load_rules`): Next is the load escalation logic. The rules state that load rules can only escalate risk, never lower it:
> - Any wind ≥ 55 mph is an immediate **No Travel** for any load.
> - High winds between 45 and 54 mph escalate to **No Travel** if the cargo load exceeds 30,000 pounds.
> - Winds between 35 and 44 mph escalate to **Severe** if the load exceeds 40,000 pounds.
>
> *(Point to `rank_routes`): Finally, our route ranking prioritizes safety:
> 1. Fewest Severe miles
> 2. Fewest High miles
> 3. Lowest average risk
> 4. Shortest travel duration
> Any route with a single No Travel checkpoint is disqualified."*

---

### 4. Live Interactive UI Demo (3:30 – 6:00)
**Screen to show**: Live Browser (`http://localhost:5173` or Render hosted URL).

> *"Now let's see the application in action.*
>
> *Notice that upon loading, the application immediately evaluates our default corridor: the **Mumbai to New Delhi Western Corridor (NH48)**.*
>
> *(Point to the map): On the Leaflet map, we see three distinct highway alternatives:
> - Route 1 via NH48 is highlighted in bold Industrial Safety Yellow with an outer contrast casing because it was determined to be the safest recommended haul.
> - Routes 2 and 3 are displayed in contrasting cyan and purple.
> - Along the route, checkpoints are sampled every 25 miles and rendered as circular pins colored by their risk tier.
>
> *(Click a checkpoint pin on the map): Clicking on any pin displays a detailed popup showing the projected arrival ETA, wind speed, rain, snow rate, and exact risk level.*
>
> *(Scroll to Route Comparison Cards): Below the map, each route card displays its total mileage, duration, severe miles, high miles, average risk score, and blocked status.*
>
> *(Scroll to the 0–48 Hour Scrubber): Here is the 0–48 hour timeline scrubber. Notice that as I click Play or slide the scrubber, the corridor heatmap and risk breakdown counts update **instantaneously client-side with zero network calls**. This allows a dispatcher to inspect how weather fronts will evolve over the next two days."*

---

### 5. Automated Testing & CI/CD (6:00 – 7:00)
**Screen to show**: Terminal running tests or GitHub Actions page.

> *"Let’s look at quality assurance and automated testing:*
>
> *(Show terminal): In the backend, we run `python -m pytest`:
> - All **82 backend tests** pass in under 2 seconds, verifying every boundary threshold, cargo escalation rule, route ranking scenario, and API endpoint.
> - Our code style is enforced with `ruff check .` with zero errors.
>
> *(Show frontend test run): In the frontend, Vitest runs:
> - **10 unit tests** pass across 3 test suites verifying the form inputs, quick presets, timeline scrubber, and checkpoint table.
>
> *All tests, linters, and production builds are integrated into our GitHub Actions workflow, which automatically runs on every push and deploys to Render via a secure deploy hook."*

---

### 6. Key Assumptions & Conclusion (7:00 – 7:30)
**Screen to show**: Return to app home screen.

> *"To summarize our key design assumptions:
> 1. Miles attributed to each checkpoint equal the sampling interval (covering the segment behind it).
> 2. Average travel speeds are distributed uniformly across route distance.
> 3. Checkpoint weather uses the forecast hour closest to its projected arrival ETA.
> 4. The 0–48h timeline scrubber visualizes corridor conditions at future hours from departure, while the route recommendation evaluates ETA-based risk.
>
> Thank you for watching!"*
