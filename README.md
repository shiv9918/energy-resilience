# Project Sentinel — AI Energy Supply Chain Resilience Platform

> **Built for Global Risk Intelligence Hackathon**

Project Sentinel is an AI-powered platform that detects geopolitical disruption risks in global energy corridors, simulates their impact on India's supply chain, and recommends procurement rerouting — automatically.

---

## The Problem

India imports **88% of its crude oil**, with 45% transiting the Strait of Hormuz alone. Strategic Petroleum Reserve cover stands at just **9.5 days**. Without predictive intelligence, national response to corridor disruptions remains reactive — costing billions in volatility and delayed decision-making.

---

## What It Does

| Agent | Function |
|---|---|
| **Risk Intelligence** | Fetches live headlines via NewsAPI, scores geopolitical risk per corridor (Hormuz, Red Sea, Iran/OPEC) using Groq LLM |
| **Scenario Modeller** | Simulates supply gap, oil price impact, INR depreciation, and SPR runway for 3 preset disruption scenarios |
| **Procurement Recommender** | Ranks 5 alternative crude sources (Russia Urals, WTI, Bonny Light, Saudi Cape route, UAE Murban) by price, transit, grade, and sanctions risk |
| **Pipeline Orchestrator** | LangGraph graph that chains all 3 agents: signal → scenario → rerouting in one call |

---

## Architecture

```
energy-resilience/
├── backend/                        FastAPI + LangGraph
│   ├── app/
│   │   ├── agents/
│   │   │   ├── risk_agent.py       NewsAPI + Groq headline scoring
│   │   │   ├── scenario_agent.py   Supply/price/INR impact simulation
│   │   │   ├── reroute_agent.py    Procurement route ranking + memo
│   │   │   ├── orchestrator.py     LangGraph pipeline (3 nodes)
│   │   │   └── groq_utils.py       Shared retry/backoff for Groq API
│   │   ├── data/
│   │   │   └── macro_data.py       Macro panel CSV loader
│   │   └── main.py                 FastAPI endpoints + 5-min cache
│   ├── requirements.txt
│   └── .env.example
├── frontend/                       React + Vite + Tailwind
│   ├── src/
│   │   ├── pages/
│   │   │   └── LandingPage.jsx     Static marketing page (/)
│   │   ├── components/
│   │   │   ├── Shell.jsx           Shared nav/header/footer
│   │   │   ├── RiskScoreCards.jsx  Screen 1 — corridor risk scores
│   │   │   ├── ScenarioPanel.jsx   Screen 2 — scenario modeller
│   │   │   ├── RecommendPanel.jsx  Screen 3 — procurement recs
│   │   │   ├── PipelinePanel.jsx   Screen 4 — pipeline log
│   │   │   └── MacroChart.jsx      Historical macro chart (Recharts)
│   │   └── App.jsx                 Dashboard app (/dashboard)
│   └── vite.config.js
└── data/
    └── macro_panel.csv             India macro panel (CPI, WPI, USDINR — 2013–2025)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | FastAPI + Uvicorn |
| AI orchestration | LangGraph |
| LLM inference | Groq (llama-3.3-70b-versatile) |
| News data | NewsAPI (GNews fallback) |
| Frontend | React 18 + Vite + Tailwind CSS v4 |
| Charts | Recharts |
| Routing | React Router DOM v6 |
| HTTP client | Axios |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Basic health check |
| GET | `/api/health` | Full system health (Groq + NewsAPI + macro data) |
| GET | `/api/risk-scores` | Live corridor risk scores (cached 5 min) |
| GET | `/api/scenarios` | List preset disruption scenarios |
| POST | `/api/simulate` | Run scenario simulation `{scenario_id}` |
| POST | `/api/recommend` | Get procurement recommendations `{corridor}` |
| GET | `/api/pipeline` | Full pipeline end-to-end (cached 5 min) |
| GET | `/api/macro-history` | Historical macro series `?column=USDINR&months=24` |

---

## Quick Start (Local)

### Backend

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Mac/Linux:
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env        # add your API keys
uvicorn app.main:app --reload
# → http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## Environment Variables

Create `backend/.env` with:

```env
GROK_API_KEY=gsk_...          # Groq API key (get free at console.groq.com)
NEWS_API_KEY=...              # NewsAPI key (get free at newsapi.org)
BASE_OIL_PRICE_USD=75.0       # Reference Brent price — update before demo
```

---

## Demo Mode (No Internet)

If NewsAPI is unreachable at the venue (bad wifi, rate limit), the backend automatically falls back to **hardcoded realistic headlines** for each corridor and logs:

```
WARNING: DEMO MODE: using fallback headlines for corridor 'hormuz'
```

The LLM scoring still runs on the fallback headlines — scores are real, only the input is static.

---

## Pre-Demo Health Check

```bash
curl http://localhost:8000/api/health
```

Returns:
```json
{
  "status": "ok",
  "checks": {
    "macro_data": { "status": "ok", "detail": "Loaded — latest row: 2025-12" },
    "groq_api":   { "status": "ok", "detail": "Reachable" },
    "news_api":   { "status": "ok", "detail": "Reachable" }
  }
}
```

`"degraded"` means news API is down but demo will still run. `"error"` means Groq or macro data is broken.

---

## Pipeline Speed Notes

- **Risk scoring alone:** ~35s (15 headlines × 1.5s inter-call sleep to stay under Groq 30 RPM)
- **Pipeline after risk scores cached:** ~10s (skips Node 1, runs scenario + rerouting only)
- **Tip:** Load the dashboard first to cache risk scores, then click **RUN PIPELINE** for a fast demo

---

## Deployment

- **Backend:** Render (free tier) — set `GROK_API_KEY`, `NEWS_API_KEY`, `BASE_OIL_PRICE_USD` as env vars
- **Frontend:** Vercel (free tier) — set `VITE_API_URL=https://your-render-url.onrender.com`

---

## Assumptions & Model Notes

All simulation formulas use documented, auditable assumptions:

- **Price elasticity:** 3.5× (1% supply cut → 3.5% price rise) — IMF WEO 2011, Baumeister & Peersman 2013
- **INR pass-through:** 0.30× oil price impact (elevated to 0.35× if WPI Fuel YoY > 5%)
- **SPR depletion:** India's 9.5-day cover divided by scenario severity multiplier
- **Baseline oil price:** configured via `BASE_OIL_PRICE_USD` env var — not a live market feed

> All outputs are model estimates, not market forecasts.
