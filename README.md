# Weather-Aware Truck Routing

A full-stack web application designed for commercial trucking safety. It evaluates route alternatives by combining high-resolution weather forecasts with truck load-weight risk escalation rules, recommending the safest route first and fastest route second.

---

## 🎯 Problem Statement

Truck drivers typically select routes based primarily on transit time and distance. However, adverse weather—especially high winds, freezing precipitation, and severe storms—poses massive safety risks. Commercial trucks with heavy loads are particularly vulnerable to rollover and jackknife accidents under high wind conditions.

This system provides:
1. **Multi-route comparison**: Retrieves 3 route alternatives via OpenRouteService.
2. **Dynamic checkpoint sampling**: Samples coordinates every 10, 25, or 50 miles (default 25 mi) and projects arrival times (ETA).
3. **Weather forecasting**: Fetches hourly weather forecasts at each checkpoint for its projected ETA via Open-Meteo.
4. **Risk classification & load rules**: Classifies wind, rain, and snow risk, then applies load-weight escalation rules.
5. **Intelligent route recommendation**: Ranks routes by safety first (fewest severe miles, fewest high miles, lowest average risk) and duration second.
6. **Corridor weather heatmap & 0–48h slider**: Visualizes changing weather conditions along the trip corridor over time.

---

## 🏗️ Architecture

```
Browser (React 18 + TypeScript + Leaflet)
   │
   │  POST /api/trips/plan/ (origin, destination, departure, load_lb, interval)
   ▼
Django 5 + Django REST Framework
   │
   ├─ routing/clients/ors.py      ──► OpenRouteService (Geocoding & 3 alternative routes)
   ├─ routing/geo.py              ──► Haversine interpolation & ETA per checkpoint
   ├─ routing/clients/weather.py  ──► Open-Meteo hourly batched forecast (cached 60 min)
   ├─ routing/risk.py             ──► Pure functions: Spotter risk tiers, load escalation, ranking
   ▼
JSON Response:
   - 3 routes with geometries, summary metrics, and classified checkpoints
   - Recommended route index & decision explanation
   - 49-hour corridor heatmap risk matrix
```

---

## ⚖️ Risk Classification Engine

The risk engine is implemented in `backend/routing/risk.py` as pure functions with zero external HTTP or framework dependencies, enabling isolated unit testing.

### 1. Spotter Risk Tiers

Each condition is classified into five tiers (`LOW`, `MODERATE`, `HIGH`, `SEVERE`, `NO_TRAVEL`):

| Condition | Low | Moderate | High | Severe | No Travel |
|---|---|---|---|---|---|
| **Wind (mph)** | < 25 | 25–34 | 35–44 | 45–54 | ≥ 55 |
| **Rain (in/hr)** | < 0.10 | 0.10–0.25 | 0.25–0.50 | 0.50–1.00 | > 1.00 |
| **Snow (in/hr)** | < 0.5 | 0.5–1.0 | 1.0–2.0 | 2.0–3.0 | > 3.0 |

*A checkpoint's base risk is the maximum of its wind, rain, and snow risk levels.*

### 2. Truck Load Escalation Rules

Load rules can **only escalate** the risk level, never lower it:
- **Wind ≥ 55 mph**: `No Travel` (any load).
- **Wind 45–54 mph and load > 30,000 lb**: `No Travel`.
- **Wind 35–44 mph and load > 40,000 lb**: `Severe`.

### 3. Route Recommendation Priority

Routes are evaluated in strict priority order:
1. **Fewest Severe miles**
2. **Fewest High miles**
3. **Lowest average risk** (weighted: `LOW=1` to `NO_TRAVEL=5`)
4. **Shortest travel time**

*Any route containing a `No Travel` checkpoint is blocked and excluded from recommendation. If all candidate routes are blocked, the system identifies the blocking hazards.*

---

## 🛠️ Tech Stack

- **Backend**: Python 3.11+, Django 5, Django REST Framework, Requests, WhiteNoise, Pytest, Ruff.
- **Frontend**: React 18, Vite, TypeScript, Leaflet, React-Leaflet, Leaflet.heat, Lucide React, Vitest, ESLint.
- **External APIs**:
  - [OpenRouteService](https://openrouteservice.org/) (geocoding, alternative truck routes)
  - [Open-Meteo](https://open-meteo.com/) (hourly multi-coordinate forecast)
- **CI/CD**: GitHub Actions (backend lint/check/test + frontend lint/test/build).

---

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 20+
- OpenRouteService API Key ([Sign up here](https://openrouteservice.org/dev/#/signup))

### 1. Clone & Configure Environment

```bash
git clone https://github.com/Ridhesh927/Weather-Aware-Truck-Routing.git
cd Weather-Aware-Truck-Routing
cp .env.example .env
```

Edit `.env` and fill in your `ORS_API_KEY`:
```ini
DJANGO_SECRET_KEY=dev-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
ORS_API_KEY=your_ors_api_key_here
```

### 2. Backend Setup

```bash
cd backend
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000
```
- Health Check: [http://localhost:8000/api/health/](http://localhost:8000/api/health/)

### 3. Frontend Setup

In a new terminal:
```bash
cd frontend
npm install
npm run dev
```
- Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Testing & Code Quality

### Backend
```bash
cd backend
# Run all unit tests (57 tests covering boundaries, load rules, ranking)
python -m pytest -q

# Run Ruff linter
python -m ruff check .

# Django system checks
python manage.py check
```

### Frontend
```bash
cd frontend
# Run Vitest test suite
npm test -- --run

# Run ESLint
npm run lint

# Build production bundle
npm run build
```

---

## 📂 Repository Structure

```
.
├── .github/
│   └── workflows/
│       └── ci-cd.yml           # GitHub Actions CI/CD workflow
├── backend/
│   ├── config/                 # Django project settings & URL configuration
│   ├── routing/
│   │   ├── risk.py             # Pure-function risk classification engine
│   │   ├── views.py            # API endpoints (health check, planning)
│   │   ├── urls.py             # API route definitions
│   │   └── tests/
│   │       ├── test_risk.py    # Risk boundary & load rule unit tests
│   │       └── test_health.py  # Health check integration tests
│   ├── manage.py
│   ├── pytest.ini
│   ├── pyproject.toml
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx             # Root React application
│   │   ├── App.test.tsx        # Frontend unit tests
│   │   └── index.css / App.css
│   ├── package.json
│   ├── vite.config.ts
│   └── eslint.config.js
├── .env.example
├── .gitignore
└── README.md
```

---

## 📜 Assumptions

1. **Sampling Interval**: Default interval is 25 miles, with 10 and 50 miles supported as configurable options.
2. **Segment Distance Attribution**: Miles attributed to a checkpoint equal the sample interval (each checkpoint represents the route segment leading up to it).
3. **Arrival Time (ETA)**: Distributed uniformly across total route duration by distance marker.
4. **Weather Alignment**: Forecast hour selected is the closest hour to the projected ETA.
5. **Corridor Heatmap**: Visualizes forecast conditions for hour offsets $T \in [0, 48]$ hours from query time across route checkpoints.

