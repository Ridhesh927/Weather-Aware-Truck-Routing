# Weather-Aware Truck Routing

A full-stack commercial trucking safety and dispatch platform. It evaluates multi-route highway alternatives by combining high-resolution meteorological forecasts with commercial vehicle weight-load escalation rules, recommending the safest route first and fastest route second.

![Theme](https://img.shields.io/badge/Theme-Industrial%20Safety%20Yellow-facc15)
![Backend](https://img.shields.io/badge/Backend-Django%205%20%7C%20DRF-092e20)
![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite%20%7C%20TypeScript-61dafb)
![Maps](https://img.shields.io/badge/Maps-Leaflet%20%7C%20leaflet.heat-199900)
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088ff)
![Status](https://img.shields.io/badge/Tests-82%20Backend%20%2F%2010%20Frontend%20Passing-brightgreen)

---

## 🎯 Problem Statement

Commercial truck drivers routinely select routes based only on transit time and distance. However, adverse weather—severe crosswinds, monsoon rains, and freezing snow—poses critical rollover and jackknife hazards. Commercial haulers carrying heavy freight (e.g. 30,000–45,000+ lb) are particularly vulnerable to sudden wind shear.

This platform solves this by providing:
1. **Multi-Corridor Comparison**: Evaluates 3 distinct highway route alternatives via OpenRouteService (with zero-config Indian freight corridor fallback).
2. **Dynamic Checkpoint Sampling**: Samples coordinates every 10, 25, or 50 miles (default 25 mi) and projects arrival ETAs based on commercial road speeds.
3. **High-Resolution Forecasts**: Queries Open-Meteo hourly forecasts at each checkpoint for its projected arrival time (cached 60 minutes).
4. **Pure Risk Engine & Load Escalation**: Classifies Spotter wind, rain, and snow risk, then applies commercial cargo escalation rules.
5. **Intelligent Route Ranking**: Recommends the best route balancing weather risk and travel time (fewest Severe miles, fewest High miles, lowest average risk, shortest duration).
6. **Corridor Weather Heatmap & 0–48h Scrubber**: Interactive Leaflet map with a 100% client-side 0–48 hour timeline scrubber that models evolving weather fronts with zero network latency.

---

## 🏗️ Architecture

```
Browser (React 18 + TypeScript + Leaflet + leaflet.heat)
   │
   │  POST /api/trips/plan/ (origin, destination, departure_at, load_lb, interval_miles)
   ▼
Django 5 + Django REST Framework + WhiteNoise (Single Web Service on Render)
   │
   ├─ routing/clients/ors.py      ──► OpenRouteService (Geocoding & 3 alternative routes + Hub Registry)
   ├─ routing/geo.py              ──► Haversine interpolation & uniform ETA per checkpoint
   ├─ routing/clients/weather.py  ──► Open-Meteo batched hourly forecasts (60-min in-memory cache)
   ├─ routing/risk.py             ──► Pure functions: Spotter risk tiers, load escalation, ranking
   ▼
JSON Response:
   - 3 candidate routes with polyline geometries, summary statistics, and classified checkpoints
   - Recommended route index & decision explanation (or blocked status if all routes are unsafe)
   - 49-hour corridor heatmap risk matrix (0 to 48 hours from departure)
```

---

## ⚖️ Risk Classification Engine

The risk engine is implemented in `backend/routing/risk.py` as pure functions with zero Django or HTTP dependencies.

### 1. Spotter Risk Tiers

Each environmental factor is classified into five tiers (`LOW`, `MODERATE`, `HIGH`, `SEVERE`, `NO_TRAVEL`):

| Condition | Low | Moderate | High | Severe | No Travel |
|---|---|---|---|---|---|
| **Wind (mph)** | < 25 | 25–34 | 35–44 | 45–54 | ≥ 55 |
| **Rain (in/hr)** | < 0.10 | 0.10–0.25 | 0.25–0.50 | 0.50–1.00 | > 1.00 |
| **Snow (in/hr)** | < 0.5 | 0.5–1.0 | 1.0–2.0 | 2.0–3.0 | > 3.0 |

*A checkpoint's base risk is the maximum of its wind, rain, and snow risk levels.*

### 2. Truck Load Escalation Rules

Load rules **only escalate** the risk tier, never lower it:
- **Wind ≥ 55 mph**: `No Travel` (any load weight).
- **Wind 45–54 mph and cargo > 30,000 lb**: Escalates to `No Travel`.
- **Wind 35–44 mph and cargo > 40,000 lb**: Escalates to `Severe`.

### 3. Route Recommendation Priority

Routes are evaluated in strict priority order:
1. **Fewest Severe miles**
2. **Fewest High miles**
3. **Lowest average risk** (weighted: `LOW=1`, `MODERATE=2`, `HIGH=3`, `SEVERE=4`, `NO_TRAVEL=5`)
4. **Shortest travel time**

*Any route containing a `No Travel` checkpoint is ineligible for recommendation. If all 3 routes contain `No Travel` hazards, the system flags the corridor as blocked and details the blocking checkpoints.*

---

## 🌐 South Asia & India Freight Corridors

The application features dedicated presets for major Indian commercial logistics arteries:
- **Mumbai ➔ Delhi**: Western Freight Corridor via NH48 (1,420 km) — Auto-loaded on initial launch.
- **Delhi ➔ Kolkata**: Grand Trunk Road via NH19 (1,510 km).
- **Bengaluru ➔ Chennai**: Industrial Manufacturing Expressway (345 km).
- **Delhi ➔ Srinagar**: Himalayan Pass with freezing snow & mountain elevation risks (810 km).
- **Pune ➔ Hyderabad**: Deccan Plateau transit corridor (560 km).

*Includes a built-in regional city registry and highway generator that enables full offline/demo operation without requiring external API keys if OpenRouteService is unavailable.*

---

## 🚀 Live Deployment (Render Single Service)

The production app runs on **Render** as a single unified web service where Django serves both the DRF API and the compiled React frontend via **WhiteNoise**.

### Render Setup Steps
1. Fork or push this repository to GitHub.
2. Log into [Render](https://render.com/) and click **New → Blueprint** (or **New → Web Service**).
3. Select your repository. Render reads `render.yaml` automatically:
   - **Build Command**: `./build.sh`
   - **Start Command**: `cd backend && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`
   - **Python Version**: `3.12.3`
   - **Node Version**: `20.12.0`
4. Set Environment Variables in Render Dashboard (optional):
   - `ORS_API_KEY`: Your OpenRouteService API key (optional; system includes offline fallback).
   - `DEBUG`: `False`
5. Copy the **Deploy Hook URL** from the Render Settings tab.
6. In GitHub, go to **Settings → Secrets and variables → Actions**, and add the secret:
   - Name: `RENDER_DEPLOY_HOOK`
   - Value: `<Your Render Deploy Hook URL>`
7. Every push to `main` will automatically run CI (tests & linting) and trigger seamless deployment!

---

## 💻 Local Development Setup

### Prerequisites
- Python 3.11 or 3.12
- Node.js 20+
- npm 10+

### 1. Clone & Environment Configuration

```bash
git clone https://github.com/Ridhesh927/Weather-Aware-Truck-Routing.git
cd Weather-Aware-Truck-Routing
cp .env.example .env
```

### 2. Backend Setup (Django + DRF)

```bash
cd backend
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000
```
- API Health Check: [http://localhost:8000/api/health/](http://localhost:8000/api/health/)

### 3. Frontend Setup (React + Vite + TypeScript)

In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
- Web Application: [http://localhost:5173/](http://localhost:5173/)

---

## 🧪 Testing & Verification

### Backend Test Suite (Pytest & Ruff)
```bash
cd backend
# 82 unit and integration tests covering risk thresholds, load rules, ranking, and API
python -m pytest -q

# Code style and linting
python -m ruff check .

# Django system checks
python manage.py check
```

### Frontend Test Suite (Vitest & ESLint)
```bash
cd frontend
# 10 unit tests covering App, TimelineSlider, and CheckpointTable
npm test

# Linter check
npm run lint

# Production bundle build
npm run build
```

---

## 📡 API Reference

### 1. Health Check
`GET /api/health/`

**Response:**
```json
{
  "status": "ok",
  "service": "weather-aware-truck-routing",
  "timestamp": "2026-11-06T09:00:00Z"
}
```

### 2. Trip Route & Weather Planning
`POST /api/trips/plan/`

**Request Payload:**
```json
{
  "origin": "Mumbai, Maharashtra, India",
  "destination": "New Delhi, Delhi, India",
  "departure_at": "2026-11-06T18:00:00Z",
  "load_lb": 35000,
  "interval_miles": 25
}
```

**Response Payload Structure:**
```json
{
  "origin": { "label": "Mumbai, Maharashtra, India", "lat": 19.076, "lon": 72.877 },
  "destination": { "label": "New Delhi, Delhi, India", "lat": 28.613, "lon": 77.209 },
  "departure_at": "2026-11-06T18:00:00Z",
  "load_lb": 35000,
  "interval_miles": 25.0,
  "recommended_index": 0,
  "recommendation_reason": "Route 1 (via NH48) has the fewest severe weather hazard miles (0.0 mi) and lowest average risk (1.2).",
  "routes": [
    {
      "id": 0,
      "name": "Route 1 (via NH48)",
      "profile": "driving-hgv",
      "geometry": [[72.877, 19.076], [75.812, 26.912], [77.209, 28.613]],
      "total_miles": 882.5,
      "total_minutes": 980.0,
      "summary": {
        "total_miles": 882.5,
        "total_minutes": 980.0,
        "severe_miles": 0.0,
        "high_miles": 25.0,
        "average_risk": 1.2,
        "blocked": false
      },
      "checkpoints": [
        {
          "id": 0,
          "lat": 19.076,
          "lon": 72.877,
          "mile_marker": 25.0,
          "segment_miles": 25.0,
          "eta": "2026-11-06T18:28:00Z",
          "wind_mph": 18.0,
          "rain_in_hr": 0.0,
          "snow_in_hr": 0.0,
          "level": "LOW"
        }
      ]
    }
  ],
  "heatmap": [
    {
      "lat": 19.076,
      "lon": 72.877,
      "hourly_risks": ["LOW", "LOW", "MODERATE", "LOW", "..."]
    }
  ]
}
```

---

## 📜 Key Design Assumptions

1. **Sampling Interval**: Defaults to 25 miles, with 10 and 50 miles supported via UI selector.
2. **Segment Distance Attribution**: Each checkpoint accounts for the risk across the segment distance leading up to it ($N$ miles).
3. **Arrival Time (ETA)**: Uniformly projected based on road network distance and route duration.
4. **Weather Alignment**: Forecast hour selected is the closest hour to the projected arrival ETA.
5. **Corridor Heatmap**: Models forecast conditions at hour offsets $T \in [0, 48]$ hours from query time across route coordinates without modifying ETA-based trip recommendation metrics.
6. **Single-Service Architecture**: React frontend is built into `frontend/dist` and served directly by Django with WhiteNoise, eliminating cross-origin CORS latency in production.

---

## 🎥 Loom Video Walkthrough Guide (5–10 Minutes)

A detailed speaking script and demo flow is provided in [`WALKTHROUGH_SCRIPT.md`](./WALKTHROUGH_SCRIPT.md) covering:
1. **Introduction & Problem Statement** (1 min)
2. **System Architecture & Stack** (1 min)
3. **Pure Risk Engine & Load Escalation** (1.5 min)
4. **Live Interactive Demo** (3 min): Mumbai-Delhi auto-load, route switching, Leaflet map pins, 0–48h scrubber instant playback, and corridor checkpoint logs.
5. **Testing, CI/CD & Deploy Verification** (1.5 min)
