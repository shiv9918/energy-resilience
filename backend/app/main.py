"""FastAPI application — Energy Resilience Platform."""
import os
import time
import logging
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.data.macro_data import get_historical_series, get_latest_values
from app.agents.risk_agent import get_corridor_risk_scores
from app.agents.scenario_agent import (
    SCENARIOS,
    simulate_scenario,
    generate_scenario_summary,
)
from app.agents.reroute_agent import rank_alternatives, generate_recommendation
from app.agents.orchestrator import run_full_pipeline

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Energy Resilience API",
    description="AI-powered energy supply chain resilience platform — "
                "monitors geopolitical risk, simulates disruption scenarios, "
                "recommends procurement rerouting.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory cache (TTL-based, keyed by cache key)
# ---------------------------------------------------------------------------

_CACHE_TTL_SECONDS = 300   # 5 minutes

_cache: dict[str, dict] = {}   # key -> {"data": Any, "expires_at": float}


def _cache_get(key: str) -> Any | None:
    entry = _cache.get(key)
    if entry and time.time() < entry["expires_at"]:
        return entry["data"]
    return None


def _cache_set(key: str, data: Any) -> None:
    _cache[key] = {"data": data, "expires_at": time.time() + _CACHE_TTL_SECONDS}


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class SimulateRequest(BaseModel):
    scenario_id: str

class RecommendRequest(BaseModel):
    corridor: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/health", summary="Pre-demo system health check")
def api_health():
    """Check that all three dependencies are ready before going on stage.

    Returns a dict with individual status for:
      - macro_data  : CSV loaded and latest row readable
      - groq_api    : reachable with a minimal ping (model list call)
      - news_api    : reachable with a minimal request (or notes demo-mode fallback)
    Overall 'status' is 'ok' only if macro_data and groq_api are both healthy
    (news_api failure degrades gracefully to demo fallback, so it's non-blocking).
    """
    checks: dict[str, dict] = {}

    # --- Macro data ---
    try:
        latest = get_latest_values()
        checks["macro_data"] = {
            "status": "ok",
            "detail": f"Loaded — latest row: {latest['Year']}-{latest['MonthNo']:02d}",
        }
    except Exception as exc:
        checks["macro_data"] = {"status": "error", "detail": str(exc)}

    # --- Groq API ---
    groq_key = os.getenv("GROK_API_KEY")
    if not groq_key:
        checks["groq_api"] = {"status": "error", "detail": "GROK_API_KEY not set"}
    else:
        try:
            resp = httpx.get(
                "https://api.groq.com/openai/v1/models",
                headers={"Authorization": f"Bearer {groq_key}"},
                timeout=8,
            )
            resp.raise_for_status()
            checks["groq_api"] = {"status": "ok", "detail": "Reachable"}
        except httpx.HTTPStatusError as exc:
            checks["groq_api"] = {
                "status": "error",
                "detail": f"HTTP {exc.response.status_code} — check GROK_API_KEY",
            }
        except Exception as exc:
            checks["groq_api"] = {"status": "error", "detail": str(exc)}

    # --- News API (non-blocking — demo fallback exists) ---
    news_key = os.getenv("NEWS_API_KEY")
    if not news_key:
        checks["news_api"] = {
            "status": "demo_fallback",
            "detail": "NEWS_API_KEY not set — hardcoded fallback headlines will be used",
        }
    else:
        try:
            resp = httpx.get(
                "https://newsapi.org/v2/top-headlines",
                params={"sources": "bbc-news", "pageSize": 1, "apiKey": news_key},
                timeout=8,
            )
            resp.raise_for_status()
            checks["news_api"] = {"status": "ok", "detail": "Reachable"}
        except httpx.HTTPStatusError as exc:
            code = exc.response.status_code
            checks["news_api"] = {
                "status": "demo_fallback",
                "detail": f"HTTP {code} — fallback headlines will be used (non-blocking)",
            }
        except Exception as exc:
            checks["news_api"] = {
                "status": "demo_fallback",
                "detail": f"Unreachable ({exc}) — fallback headlines will be used (non-blocking)",
            }

    # Overall status: degraded if news is on fallback, error only if macro/groq fail
    critical_ok = all(
        checks[k]["status"] == "ok" for k in ("macro_data", "groq_api")
    )
    overall = "ok" if critical_ok else "error"
    if critical_ok and checks["news_api"]["status"] != "ok":
        overall = "degraded"   # live news unavailable but demo will still run

    logger.info("Health check: %s | %s", overall, checks)
    return {"status": overall, "checks": checks}


@app.get("/api/risk-scores", summary="Live geopolitical risk scores per corridor")
def risk_scores():
    """Fetch headlines and return LLM-scored risk for Hormuz, Red Sea, and general corridors.

    Results are cached for 5 minutes to avoid hammering the News API and Groq on
    every request.
    """
    cached = _cache_get("risk_scores")
    if cached is not None:
        logger.info("/api/risk-scores — serving from cache")
        return {"cached": True, "data": cached}

    try:
        scores = get_corridor_risk_scores()
    except Exception as exc:
        logger.exception("risk_scores failed")
        raise HTTPException(status_code=502, detail=f"Upstream error: {exc}") from exc

    _cache_set("risk_scores", scores)
    return {"cached": False, "data": scores}


@app.get("/api/scenarios", summary="List all available preset disruption scenarios")
def list_scenarios():
    """Return the preset scenario catalogue with descriptions and key parameters."""
    return {
        key: {
            "description": sc["description"],
            "global_supply_cut_pct": round(sc["global_supply_cut_pct"] * 100, 2),
            "duration_days": sc.get("duration_days"),
            "severity": sc["severity"],
        }
        for key, sc in SCENARIOS.items()
    }


@app.post("/api/simulate", summary="Run a disruption scenario simulation")
def simulate(req: SimulateRequest):
    """Simulate supply, price, and currency impact for a given scenario_id.

    Returns numeric results plus a plain-English LLM summary for policymakers.
    Valid scenario_ids: hormuz_closure, opec_cut, red_sea_suspension.
    """
    if req.scenario_id not in SCENARIOS:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown scenario_id '{req.scenario_id}'. "
                   f"Valid values: {list(SCENARIOS.keys())}",
        )

    try:
        latest  = get_latest_values()
        result  = simulate_scenario(req.scenario_id, latest)
        summary = generate_scenario_summary(req.scenario_id, result)
    except Exception as exc:
        logger.exception("simulate failed for scenario_id=%s", req.scenario_id)
        raise HTTPException(status_code=502, detail=f"Upstream error: {exc}") from exc

    return {"scenario_result": result, "scenario_summary": summary}


@app.post("/api/recommend", summary="Rank alternative procurement routes for a disrupted corridor")
def recommend(req: RecommendRequest):
    """Score and rank the 5 crude source alternatives for the given corridor.

    Returns the ranked list plus a trading-desk-style memo from the LLM.
    Valid corridors map to scenario_ids:
      hormuz -> hormuz_closure, red_sea -> red_sea_suspension, general -> opec_cut.
    """
    corridor_map = {
        "hormuz":  "hormuz_closure",
        "red_sea": "red_sea_suspension",
        "general": "opec_cut",
    }
    scenario_id = corridor_map.get(req.corridor)
    if scenario_id is None:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown corridor '{req.corridor}'. "
                   f"Valid values: {list(corridor_map.keys())}",
        )

    try:
        ranked = rank_alternatives(scenario_id)
        top_3  = [r for r in ranked if r["feasible"]][:3] or ranked[:3]
        memo   = generate_recommendation(scenario_id, top_3)
    except Exception as exc:
        logger.exception("recommend failed for corridor=%s", req.corridor)
        raise HTTPException(status_code=502, detail=f"Upstream error: {exc}") from exc

    return {"ranked_alternatives": ranked, "recommendation_text": memo}


@app.get("/api/pipeline", summary="Run the full risk -> scenario -> reroute pipeline")
def pipeline():
    """Single demo endpoint — runs the complete LangGraph pipeline end-to-end.

    Identifies the highest-risk corridor from live news, simulates its disruption
    scenario, and returns procurement rerouting recommendations.
    Cached for 5 minutes.
    """
    cached = _cache_get("pipeline")
    if cached is not None:
        logger.info("/api/pipeline — serving from cache")
        return {"cached": True, "data": cached}

    try:
        # Reuse cached risk scores if fresh — skips ~45s of LLM calls in Node 1
        cached_risk = _cache_get("risk_scores")
        result = run_full_pipeline(prefetched_risk_scores=cached_risk)
    except Exception as exc:
        logger.exception("pipeline failed")
        raise HTTPException(status_code=502, detail=f"Upstream error: {exc}") from exc

    _cache_set("pipeline", result)
    return {"cached": False, "data": result}


@app.get("/api/macro-history", summary="Historical time series for a macro column")
def macro_history(
    column: str = Query(..., description="Column name from macro_panel.csv"),
    months: int = Query(12, ge=1, le=120, description="Number of months to return"),
):
    """Return the last N months of data for any column in macro_panel.csv.

    Useful for front-end charting. Example: ?column=USDINR&months=24.
    """
    try:
        series = get_historical_series(column, months)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("macro_history failed for column=%s", column)
        raise HTTPException(status_code=500, detail=f"Internal error: {exc}") from exc

    return {"column": column, "months_requested": months, "data": series}
