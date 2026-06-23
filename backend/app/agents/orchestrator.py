"""LangGraph orchestrator — chains risk, scenario, and reroute agents."""
import logging
from pathlib import Path
from typing import TypedDict

from dotenv import load_dotenv
from langgraph.graph import StateGraph, END

from app.data.macro_data import get_latest_values, get_fuel_inflation_trend
from app.agents.risk_agent import get_corridor_risk_scores
from app.agents.scenario_agent import simulate_scenario, generate_scenario_summary
from app.agents.reroute_agent import rank_alternatives, generate_recommendation

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

logger = logging.getLogger(__name__)

# Corridor key -> scenario_id mapping
_CORRIDOR_TO_SCENARIO: dict[str, str] = {
    "hormuz":  "hormuz_closure",
    "red_sea": "red_sea_suspension",
    "general": "opec_cut",
}


# ---------------------------------------------------------------------------
# LangGraph state
# ---------------------------------------------------------------------------

class PipelineState(TypedDict, total=False):
    # Node 1 outputs
    corridor_risk_scores: dict
    highest_risk_corridor: str
    scenario_id: str
    latest_values: dict

    # Node 2 outputs
    scenario_result: dict
    scenario_summary: str

    # Node 3 outputs
    ranked_alternatives: list
    recommendation_text: str


# ---------------------------------------------------------------------------
# Node functions
# ---------------------------------------------------------------------------

def node_risk(state: PipelineState) -> PipelineState:
    """Fetch live headlines and score geopolitical risk for all three corridors."""
    logger.info("[Node 1] Fetching corridor risk scores ...")
    scores = get_corridor_risk_scores()

    # Pick the corridor with the highest average risk score
    highest = max(scores, key=lambda k: scores[k]["avg_risk_score"])
    scenario_id = _CORRIDOR_TO_SCENARIO.get(highest, "hormuz_closure")

    logger.info("[Node 1] Highest-risk corridor: %s (score %.1f) -> scenario: %s",
                highest, scores[highest]["avg_risk_score"], scenario_id)

    latest = get_latest_values()

    return {
        **state,
        "corridor_risk_scores": scores,
        "highest_risk_corridor": highest,
        "scenario_id": scenario_id,
        "latest_values": latest,
    }


def node_scenario(state: PipelineState) -> PipelineState:
    """Run disruption scenario simulation for the highest-risk corridor."""
    scenario_id  = state["scenario_id"]
    latest       = state["latest_values"]

    logger.info("[Node 2] Simulating scenario: %s ...", scenario_id)
    result  = simulate_scenario(scenario_id, latest)
    summary = generate_scenario_summary(scenario_id, result)

    logger.info("[Node 2] Price impact: +%.1f%% | Projected oil: $%.2f",
                result["price_impact_pct"], result["projected_price_usd"])

    return {
        **state,
        "scenario_result": result,
        "scenario_summary": summary,
    }


def node_reroute(state: PipelineState) -> PipelineState:
    """Rank alternative procurement routes and generate a trading desk memo."""
    corridor    = state["highest_risk_corridor"]
    scenario_id = state["scenario_id"]

    logger.info("[Node 3] Ranking rerouting alternatives for corridor: %s ...", corridor)
    ranked = rank_alternatives(scenario_id)
    top_3  = [r for r in ranked if r["feasible"]][:3]

    # Fall back to top-3 overall if fewer than 3 feasible options exist
    if len(top_3) < 3:
        top_3 = ranked[:3]

    memo = generate_recommendation(scenario_id, top_3)

    logger.info("[Node 3] Top alternative: %s (score %.4f)",
                top_3[0]["label"] if top_3 else "N/A",
                top_3[0]["score"] if top_3 else 0)

    return {
        **state,
        "ranked_alternatives": ranked,
        "recommendation_text": memo,
    }


# ---------------------------------------------------------------------------
# Build the graph
# ---------------------------------------------------------------------------

def _build_graph() -> StateGraph:
    graph = StateGraph(PipelineState)

    graph.add_node("risk",     node_risk)
    graph.add_node("scenario", node_scenario)
    graph.add_node("reroute",  node_reroute)

    graph.set_entry_point("risk")
    graph.add_edge("risk",     "scenario")
    graph.add_edge("scenario", "reroute")
    graph.add_edge("reroute",  END)

    return graph.compile()


_graph = _build_graph()


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def run_full_pipeline(prefetched_risk_scores: dict | None = None) -> dict:
    """Execute the full risk -> scenario -> reroute pipeline.

    Pass prefetched_risk_scores to skip Node 1 and reuse already-cached
    risk scores (saves ~45s of LLM calls when /api/risk-scores was recently hit).
    """
    logger.info("Starting full pipeline (prefetched_risk=%s) ...",
                prefetched_risk_scores is not None)

    initial: PipelineState = {}
    if prefetched_risk_scores is not None:
        highest = max(prefetched_risk_scores, key=lambda k: prefetched_risk_scores[k]["avg_risk_score"])
        scenario_id = _CORRIDOR_TO_SCENARIO.get(highest, "hormuz_closure")
        from app.data.macro_data import get_latest_values
        initial = {
            "corridor_risk_scores":  prefetched_risk_scores,
            "highest_risk_corridor": highest,
            "scenario_id":           scenario_id,
            "latest_values":         get_latest_values(),
        }
        logger.info("Skipping Node 1 — reusing cached risk scores. Highest: %s", highest)
        # Run only scenario + reroute nodes
        scenario_state = node_scenario(initial)
        final_state    = node_reroute(scenario_state)
    else:
        final_state = _graph.invoke({})

    return {
        "corridor_risk_scores":  final_state["corridor_risk_scores"],
        "highest_risk_corridor": final_state["highest_risk_corridor"],
        "scenario_result":       final_state["scenario_result"],
        "scenario_summary":      final_state["scenario_summary"],
        "ranked_alternatives":   final_state["ranked_alternatives"],
        "recommendation_text":   final_state["recommendation_text"],
    }
