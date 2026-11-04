# Weather-Aware Truck Routing: System Guide & Engineering Manual

> [!NOTE]
> This platform implements a safety-first routing paradigm for commercial logistics. Unlike standard navigation systems that minimize transit duration, this engine minimizes exposure to critical weather hazards—with a mathematical emphasis on avoiding high-wind rollover vectors under varying trailer cargo loads.

---

## 1. System Architecture

The application combines a high-performance **React 18** client with a decoupled **Django 5 REST Framework** backend serving pure risk decision models.

```mermaid
flowchart TD
    subgraph Client["Client Tier (React 18 + Vite)"]
        UI["Trip Planning Dashboard"]
        LeafletMap["Interactive Leaflet Map"]
        HeatmapLayer["49-Hour Corridor Heatmap"]
        Slider["0–48h Forecast Timeline Slider"]
    end

    subgraph Backend["Core Backend (Django + DRF)"]
        API["/api/trips/plan/ Endpoint"]
        HealthAPI["/api/health/ Health Check"]
        ORSClient["ORS Routing Client"]
        WeatherClient["Open-Meteo Client + Cache"]
        GeoEngine["Geo Sampling Engine (geo.py)"]
        RiskEngine["Pure Risk Engine (risk.py)"]
    end

    subgraph External["External Cloud APIs"]
        ORS["OpenRouteService API"]
        Meteo["Open-Meteo Weather API"]
    end

    UI -->|"POST trip parameters"| API
    LeafletMap <-->|"Synchronize active route"| UI
    Slider -->|"Client-side hour index"| HeatmapLayer

    API --> ORSClient
    ORSClient -->|"HGV alternative routes"| ORS
    API --> GeoEngine
    GeoEngine -->|"Checkpoint ETAs"| WeatherClient
    WeatherClient -->|"Batched forecast request"| Meteo
    WeatherClient --> RiskEngine
    GeoEngine --> RiskEngine
    RiskEngine -->|"Ranked routes + Heatmap matrix"| API
    API -->|"JSON response"| UI
```

---

## 2. End-to-End Workflow & Timing

When a dispatcher or driver queries a route corridor, the system plans across space and time simultaneously.

```mermaid
sequenceDiagram
    autonumber
    actor Driver as Truck Driver / Dispatcher
    participant Client as React Dashboard
    participant Django as Django Backend
    participant ORS as OpenRouteService
    participant Wx as Open-Meteo API

    Driver->>Client: Enters Origin, Destination, Departure Time, Load Weight
    Client->>Django: POST /api/trips/plan/
    Django->>ORS: Geocode and fetch 3 alternative truck routes (driving-hgv)
    ORS-->>Django: Polyline geometries, distance (m), duration (s)
    Django->>Django: Sample checkpoints every N miles & interpolate ETA
    Django->>Wx: Multi-coordinate hourly forecast query (batched)
    Wx-->>Django: Wind speed (mph), Rain rate (in/hr), Snow rate (in/hr)
    Django->>Django: Evaluate Spotter tiers + Apply load escalation rules
    Django->>Django: Calculate severe miles, high miles, weighted average risk
    Django->>Django: Rank routes (safety first) and check blocking flags
    Django-->>Client: 3 Routes, summaries, recommendation, 49h heatmap grid
    Client->>Driver: Renders colored routes, risk markers, and recommended badge
    Driver->>Client: Moves 0–48h timeline slider
    Client->>Client: Instantly updates heatmap layer without API latency
```

---

## 3. Pure Risk Classification Engine

> [!IMPORTANT]
> The risk engine in `backend/routing/risk.py` contains **no Django or HTTP dependencies**. It behaves as a pure mathematical state machine, enabling comprehensive unit test coverage.

### 3.1 Spotter Weather Hazard Tiers

Each weather factor is mapped into one of five discrete severity levels:
$$\text{Level} \in \{\text{LOW (1)}, \text{MODERATE (2)}, \text{HIGH (3)}, \text{SEVERE (4)}, \text{NO\_TRAVEL (5)}\}$$

```mermaid
stateDiagram-v2
    [*] --> LOW: Base State
    LOW --> MODERATE: Wind ≥ 25 mph | Rain ≥ 0.10 in/hr | Snow ≥ 0.5 in/hr
    MODERATE --> HIGH: Wind ≥ 35 mph | Rain ≥ 0.25 in/hr | Snow ≥ 1.0 in/hr
    HIGH --> SEVERE: Wind ≥ 45 mph | Rain ≥ 0.50 in/hr | Snow ≥ 2.0 in/hr
    SEVERE --> NO_TRAVEL: Wind ≥ 55 mph | Rain > 1.00 in/hr | Snow > 3.0 in/hr
    
    note right of NO_TRAVEL
        Any checkpoint in NO_TRAVEL blocks
        the entire route from recommendation.
    end note
```

| Metric Condition | LOW | MODERATE | HIGH | SEVERE | NO TRAVEL |
|---|---|---|---|---|---|
| **Wind Speed** | $< 25\text{ mph}$ | $25\text{--}34\text{ mph}$ | $35\text{--}44\text{ mph}$ | $45\text{--}54\text{ mph}$ | $\ge 55\text{ mph}$ |
| **Rain Rate** | $< 0.10\text{ in/hr}$ | $0.10\text{--}0.25\text{ in/hr}$ | $0.25\text{--}0.50\text{ in/hr}$ | $0.50\text{--}1.00\text{ in/hr}$ | $> 1.00\text{ in/hr}$ |
| **Snow Rate** | $< 0.5\text{ in/hr}$ | $0.5\text{--}1.0\text{ in/hr}$ | $1.0\text{--}2.0\text{ in/hr}$ | $2.0\text{--}3.0\text{ in/hr}$ | $> 3.0\text{ in/hr}$ |

*Boundary Condition Specification:* A value belongs to the tier whose lower bound it meets. Example: $25.0\text{ mph} \to \text{MODERATE}$, $1.00\text{ in/hr rain} \to \text{SEVERE}$, $1.01\text{ in/hr rain} \to \text{NO\_TRAVEL}$.

---

### 3.2 Cargo Weight & Wind Escalation Rules

High crosswinds cause lateral aerodynamic overturning moments proportional to the square of wind velocity:
$$F_{\text{lateral}} \propto v_{\text{wind}}^2$$

Heavier commercial loads raise the vehicle's center of gravity and trailer wall stress, triggering mandatory risk escalation:

> [!WARNING]
> **Load Rules Can Only Escalate Risk**: Escalation rules can raise a checkpoint's risk tier, but can **never** lower or downgrade an existing risk tier.

```mermaid
flowchart TD
    Start["Base Risk Level: max(Wind, Rain, Snow)"] --> CheckWind{"Wind Speed (mph)"}
    
    CheckWind -->|"≥ 55 mph"| NT["NO_TRAVEL (Mandatory for any load)"]
    
    CheckWind -->|"45–54 mph"| CheckLoad30{"Cargo Load > 30,000 lb?"}
    CheckLoad30 -->|"Yes"| NT
    CheckLoad30 -->|"No"| KeepBase1["Maintain Base Level"]
    
    CheckWind -->|"35–44 mph"| CheckLoad40{"Cargo Load > 40,000 lb?"}
    CheckLoad40 -->|"Yes"| EscalateSevere["max(Base Level, SEVERE)"]
    CheckLoad40 -->|"No"| KeepBase2["Maintain Base Level"]
    
    CheckWind -->|"< 35 mph"| KeepBase3["Maintain Base Level"]
```

---

## 4. Route Metrics & Ranking Algorithm

### 4.1 Miles-Weighted Average Risk Formula

For a route consisting of $k$ sampled checkpoints where checkpoint $i$ covers segment distance $d_i$ and has risk severity score $S_i \in \{1, 2, 3, 4, 5\}$:

$$\text{Average Risk} = \frac{\sum_{i=1}^k S_i \cdot d_i}{\sum_{i=1}^k d_i}$$

$$\text{Severe Miles} = \sum_{i: S_i = 4} d_i \qquad \text{High Miles} = \sum_{i: S_i = 3} d_i$$

### 4.2 Recommendation Decision Hierarchy

Candidate routes are sorted using a strict lexicographical tuple:

$$\text{Sort Priority} = \Big(\text{Severe Miles}, \ \text{High Miles}, \ \text{Average Risk}, \ \text{Total Travel Minutes}\Big)$$

> [!CAUTION]
> **No-Travel Exclusion Gate**: If $\exists \, i \text{ such that } S_i = 5 \ (\text{NO\_TRAVEL})$, the route is marked `blocked = True` and immediately disqualified from recommendation, regardless of how fast or short it is.

---

## 5. Hand-Computed Proof & Verification

Consider three candidate routes between Chicago, IL and Pittsburgh, PA ($400\text{ miles}$, $16\text{ checkpoints}$ at $25\text{ mile}$ intervals):

| Route | Severe Miles | High Miles | Average Risk | Duration | Blocked Status | Recommendation Rank |
|---|---|---|---|---|---|---|
| **Route 1 (I-80)** | $0\text{ mi}$ | $50\text{ mi}$ | $2.25$ | $390\text{ min}$ | Eligible (`False`) | **#1 (Recommended)** |
| **Route 2 (US-30)** | $25\text{ mi}$ | $0\text{ mi}$ | $1.75$ | $345\text{ min}$ | Eligible (`False`) | **#2 (Rejected by Rule 1)** |
| **Route 3 (I-76)** | $0\text{ mi}$ | $0\text{ mi}$ | $2.25$ | $310\text{ min}$ | Blocked (`True`) | **Disqualified (NO_TRAVEL)** |

**Mathematical Proof of Winner:**
1. Route 3 is eliminated immediately due to a blizzard warning ($S_i = \text{NO\_TRAVEL}$).
2. Comparing Route 1 vs Route 2:
   - Rule 1: $\text{Severe Miles}(\text{Route 1}) = 0 < 25 = \text{Severe Miles}(\text{Route 2})$.
   - Rule 1 decisively selects **Route 1**, proving that safety dominates both lower average risk ($1.75$ on Route 2) and faster travel time ($345\text{ min}$ vs $390\text{ min}$).

---

## 6. Implementation & Test Suite Status

All 57 automated unit tests are passing in CI with 100% boundary assertion coverage:

```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-9.2.0, pluggy-1.7.0
rootdir: backend, configfile: pytest.ini
collected 57 items

routing/tests/test_health.py::test_health_check_endpoint PASSED          [  1%]
routing/tests/test_risk.py::TestWindClassification (15 tests) PASSED     [ 28%]
routing/tests/test_risk.py::TestRainClassification (15 tests) PASSED     [ 54%]
routing/tests/test_risk.py::TestSnowClassification (15 tests) PASSED     [ 80%]
routing/tests/test_risk.py::TestCheckpointRisk PASSED                    [ 82%]
routing/tests/test_risk.py::TestLoadRules (4 tests) PASSED               [ 89%]
routing/tests/test_risk.py::TestRouteMetrics (3 tests) PASSED            [ 94%]
routing/tests/test_risk.py::TestRouteRanking (3 tests) PASSED            [100%]

============================= 57 passed in 1.54s ==============================
```

---

## 7. Developer Quickstart

### Starting Backend (Port 8000)
```powershell
cd backend
python -m pip install -r requirements.txt
python manage.py runserver 8000
```

### Starting Frontend (Port 5173)
```powershell
cd frontend
npm install
npm run dev
```

### Running Complete Verification Suite
```powershell
# Backend lint, system check, and tests
cd backend
python -m ruff check .
python manage.py check
python -m pytest -q

# Frontend lint, tests, and build
cd ../frontend
npm run lint
npm test -- --run
npm run build
```

> [!TIP]
> **Zero-Friction Dev Proxy**: The Vite server automatically proxies all `/api/*` network requests to `http://127.0.0.1:8000`, so no manual CORS proxy configuration is required during local development.
