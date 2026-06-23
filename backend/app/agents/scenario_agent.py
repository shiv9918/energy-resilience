"""Disruption scenario simulator.

Computes supply/price/currency impact estimates for three preset energy
disruption scenarios using macro indicators from get_latest_values().

All formulas are intentional simplifications — assumptions are documented
inline so reviewers/judges can audit and challenge them.
"""
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from app.agents.groq_utils import invoke_with_backoff

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

logger = logging.getLogger(__name__)

_MODEL = "llama-3.3-70b-versatile"

# ---------------------------------------------------------------------------
# Preset scenarios
# ---------------------------------------------------------------------------
# Each scenario defines:
#   description   : human-readable label
#   volume_cut_pct: fraction of affected corridor's throughput removed (0-1)
#   global_supply_cut_pct: fraction of global supply affected — Hormuz carries
#     ~20% of global oil, Red Sea ~10%, OPEC cut is stated in bpd directly
#   duration_days : expected disruption window
#   severity      : dimensionless multiplier used for SPR depletion estimate
#   india_bpd     : India's approximate crude import rate (~4.9 mbpd, 2024)

_INDIA_IMPORT_BPD = 4_900_000   # barrels per day (approx. 2024 average)
_INDIA_SPR_DAYS   = 9.5         # India's strategic petroleum reserve cover (days)
_GLOBAL_SUPPLY_BPD = 102_000_000  # approximate global supply (bpd, 2024)

SCENARIOS: dict[str, dict] = {
    "hormuz_closure": {
        "description": "Strait of Hormuz partial closure (50% volume cut, 30 days)",
        "volume_cut_pct": 0.50,
        # Hormuz ~20% of global seaborne oil; 50% closure => ~10% global supply shock
        "global_supply_cut_pct": 0.10,
        "duration_days": 30,
        "severity": 2.0,
    },
    "opec_cut": {
        "description": "Emergency OPEC+ production cut of 2 million bpd",
        "volume_cut_pct": None,            # stated directly in bpd below
        "supply_cut_bpd": 2_000_000,
        # 2 mbpd / 102 mbpd global supply ≈ 1.96% global supply shock
        "global_supply_cut_pct": round(2_000_000 / _GLOBAL_SUPPLY_BPD, 4),
        "duration_days": None,             # indefinite / until next OPEC meeting
        "severity": 1.0,
    },
    "red_sea_suspension": {
        "description": "Red Sea shipping suspension (45 days)",
        "volume_cut_pct": 1.00,            # full suspension of Red Sea route
        # Red Sea carries ~10% of global seaborne oil; rerouting adds cost/delay
        # but supply isn't fully lost — effective supply shock estimated at ~5%
        "global_supply_cut_pct": 0.05,
        "duration_days": 45,
        "severity": 1.5,
    },
}


# ---------------------------------------------------------------------------
# Core simulation
# ---------------------------------------------------------------------------

def simulate_scenario(scenario_id: str, latest_values: dict) -> dict:
    """Compute impact estimates for a named scenario.

    Parameters
    ----------
    scenario_id   : key in SCENARIOS dict
    latest_values : output of macro_data.get_latest_values()

    Returns a dict with all computed fields plus the scenario metadata.

    Assumptions (documented for review):
    - Price elasticity: each 1% reduction in global oil supply raises Brent
      by ~3-4%. We use 3.5x as the mid-point, consistent with IMF (2011) and
      Baumeister & Peersman (2013) short-run supply elasticity estimates.
    - INR depreciation pass-through: India imports ~85% of its crude. A rise
      in the oil import bill widens the current account deficit and weakens the
      rupee. We model INR depreciation as 0.3x the oil price impact percentage
      as a first-order approximation (i.e. a 10% oil price rise -> ~3% INR
      depreciation). This is blended with the recent WPI_Fuel_yoy trend as a
      sanity check: if domestic fuel inflation is already elevated, pass-through
      is assumed to be at the higher end (multiplier raised to 0.35).
    - SPR cover: India holds ~9.5 days of strategic reserves. Under a more
      severe scenario the government draws down faster; we divide by the
      scenario severity multiplier to get remaining effective cover.
    - The baseline oil price (oil_price_usd) is a configured reference value
      set via BASE_OIL_PRICE_USD env var, NOT a live market feed. All
      projections should be treated as indicative model estimates.
    """
    if scenario_id not in SCENARIOS:
        raise ValueError(
            f"Unknown scenario '{scenario_id}'. "
            f"Valid options: {list(SCENARIOS.keys())}"
        )

    sc = SCENARIOS[scenario_id]
    oil_price   = latest_values["oil_price_usd"]   # configured reference Brent price
    usdinr      = latest_values["USDINR"]
    fuel_yoy    = latest_values["WPI_Fuel_yoy"]     # domestic fuel inflation trend

    global_cut  = sc["global_supply_cut_pct"]       # fraction of global supply removed

    # --- Supply gap (bpd) ---
    if sc.get("supply_cut_bpd"):
        # OPEC cut is given directly
        supply_gap_bpd = sc["supply_cut_bpd"]
    else:
        # For route-based scenarios, estimate India-specific import shortfall
        supply_gap_bpd = int(_INDIA_IMPORT_BPD * global_cut)

    # --- Price impact ---
    # Elasticity assumption: 1% supply cut => ~3.5% price rise (short-run)
    # Source: IMF WEO 2011; Baumeister & Peersman (2013)
    PRICE_ELASTICITY = 3.5
    price_impact_pct = global_cut * PRICE_ELASTICITY    # e.g. 10% cut => 35% price rise

    projected_price_usd = round(oil_price * (1 + price_impact_pct), 2)

    # --- INR depreciation ---
    # Base pass-through: 0.30x oil price impact
    # Elevated pass-through (0.35x) if recent domestic fuel inflation > 5% yoy,
    # indicating the economy is already under fuel-cost stress.
    PASSTHROUGH_BASE     = 0.30
    PASSTHROUGH_ELEVATED = 0.35
    passthrough = PASSTHROUGH_ELEVATED if (fuel_yoy is not None and fuel_yoy > 5.0) else PASSTHROUGH_BASE

    inr_depreciation_pct = price_impact_pct * passthrough
    projected_usdinr     = round(usdinr * (1 + inr_depreciation_pct), 2)

    # --- SPR runway ---
    # India's ~9.5 days of cover depletes faster under higher-severity scenarios
    spr_days_remaining = round(_INDIA_SPR_DAYS / sc["severity"], 1)

    return {
        "scenario_id":           scenario_id,
        "description":           sc["description"],
        "duration_days":         sc.get("duration_days"),
        "global_supply_cut_pct": round(global_cut * 100, 2),   # as percentage
        "supply_gap_bpd":        supply_gap_bpd,
        "price_elasticity_used": PRICE_ELASTICITY,
        "price_impact_pct":      round(price_impact_pct * 100, 2),  # as percentage
        "baseline_oil_price_usd":  oil_price,
        "projected_price_usd":   projected_price_usd,
        "inr_passthrough_used":  passthrough,
        "inr_depreciation_pct":  round(inr_depreciation_pct * 100, 2),  # as percentage
        "baseline_usdinr":       usdinr,
        "projected_usdinr":      projected_usdinr,
        "spr_days_remaining":    spr_days_remaining,
        "fuel_yoy_at_simulation": fuel_yoy,
    }


# ---------------------------------------------------------------------------
# LLM narrative summary
# ---------------------------------------------------------------------------

_SUMMARY_SYSTEM = """\
You are a senior energy policy analyst briefing India's Ministry of Petroleum.
Given structured scenario simulation results, write a 2-3 sentence plain English
summary for a policymaker. Be factual, concise, and always explicitly state that
these are model estimates based on simplified assumptions, not a market forecast.
Do not use bullet points — write in flowing prose.
"""


def generate_scenario_summary(scenario_id: str, result: dict) -> str:
    """Call the Groq LLM to produce a plain-English policymaker briefing."""
    groq_key = os.getenv("GROK_API_KEY")
    if not groq_key:
        raise EnvironmentError("GROK_API_KEY is not set in the environment.")

    llm = ChatGroq(model=_MODEL, api_key=groq_key, temperature=0.3)

    prompt = f"""Scenario: {result['description']}
Global supply reduction: {result['global_supply_cut_pct']}%
India supply gap: {result['supply_gap_bpd']:,} bpd
Estimated oil price impact: +{result['price_impact_pct']}% (baseline ${result['baseline_oil_price_usd']:.1f} → projected ${result['projected_price_usd']:.1f}/bbl)
Estimated INR depreciation: {result['inr_depreciation_pct']}% (baseline ₹{result['baseline_usdinr']:.2f} → projected ₹{result['projected_usdinr']:.2f} per USD)
India SPR effective cover: {result['spr_days_remaining']} days
Duration: {result['duration_days'] or 'indefinite'}"""

    messages = [
        SystemMessage(content=_SUMMARY_SYSTEM),
        HumanMessage(content=prompt),
    ]
    return invoke_with_backoff(llm, messages)
