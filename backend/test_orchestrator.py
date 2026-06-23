"""End-to-end test for the LangGraph orchestrator pipeline."""
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

from app.agents.orchestrator import run_full_pipeline

def _p(s: str) -> None:
    print(s.encode("ascii", errors="replace").decode("ascii"))

_p("\n" + "=" * 68)
_p("  ENERGY RESILIENCE -- FULL PIPELINE RUN")
_p("=" * 68)

result = run_full_pipeline()

# ── Node 1: Risk scores ───────────────────────────────────────────────────
_p("\n" + "-" * 68)
_p("  [NODE 1] CORRIDOR RISK SCORES")
_p("-" * 68)
for corridor, data in result["corridor_risk_scores"].items():
    _p(f"  {corridor:<12}  avg risk: {data['avg_risk_score']:>5.1f} / 100")
    for h in data.get("top_headlines", [])[:2]:
        _p(f"            -> {h[:80]}")

_p(f"\n  Highest-risk corridor selected: {result['highest_risk_corridor'].upper()}")

# ── Node 2: Scenario simulation ───────────────────────────────────────────
_p("\n" + "-" * 68)
_p("  [NODE 2] SCENARIO SIMULATION")
_p("-" * 68)
sr = result["scenario_result"]
_p(f"  Scenario      : {sr['description']}")
_p(f"  Supply cut    : {sr['global_supply_cut_pct']}% global  |  gap: {sr['supply_gap_bpd']:,} bpd")
_p(f"  Price impact  : +{sr['price_impact_pct']}%  (${sr['baseline_oil_price_usd']:.2f} -> ${sr['projected_price_usd']:.2f}/bbl)")
_p(f"  INR impact    : +{sr['inr_depreciation_pct']}%  ({sr['baseline_usdinr']:.2f} -> {sr['projected_usdinr']:.2f} USD/INR)")
_p(f"  SPR cover     : {sr['spr_days_remaining']} days remaining")
_p(f"\n  Policymaker summary:")
for sentence in result["scenario_summary"].split(". "):
    s = sentence.strip()
    if s:
        _p(f"  {s}.")

# ── Node 3: Rerouting ─────────────────────────────────────────────────────
_p("\n" + "-" * 68)
_p("  [NODE 3] PROCUREMENT REROUTING")
_p("-" * 68)
_p(f"  {'Rank':<5} {'Score':<7} {'Feasible':<10} {'$/bbl':<10} {'Transit':<10} Source")
_p("  " + "-" * 80)
for i, alt in enumerate(result["ranked_alternatives"], 1):
    sign = "+" if alt["price_vs_brent"] >= 0 else ""
    _p(f"  {i:<5} {alt['score']:<7} {'YES' if alt['feasible'] else 'NO':<10} "
       f"{sign}{alt['price_vs_brent']:.1f}{'':>5} "
       f"{alt['transit_days']}d{'':>5} "
       f"{alt['label']}")

_p(f"\n  Trading desk memo:")
_p("  " + "-" * 64)
for sentence in result["recommendation_text"].split(". "):
    s = sentence.strip()
    if s:
        _p(f"  {s}.")

_p("\n" + "=" * 68)
_p("  Pipeline complete.")
_p("=" * 68)
