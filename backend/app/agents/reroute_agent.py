"""Procurement rerouting recommender.

Ranks alternative crude sources when a shipping corridor is disrupted and
generates a trading-desk-style memo via the Groq LLM.
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
# Reference table of alternative crude sources
# ---------------------------------------------------------------------------
# price_vs_brent  : typical $/bbl premium (+) or discount (-) vs Brent
# transit_days    : approximate sea transit to Indian west-coast ports
# grade           : light / medium / heavy  (refinery compatibility note)
# availability    : qualitative flag --affects scoring weight
# sanctions_risk  : True if under active US/EU sanctions (Russia)
# corridors_ok    : list of corridors this route avoids (safe alternatives)

CRUDE_SOURCES: dict[str, dict] = {
    "russia_urals": {
        "label": "Russia -- Urals (Vladivostok / Eastern ports to Vizag)",
        "price_vs_brent": -3.5,   # deep discount due to sanctions pressure
        "transit_days": 18,
        "grade": "medium",
        "sanctions_risk": True,
        "corridors_ok": ["hormuz_closure", "red_sea_suspension"],
        "note": "Pacific route avoids both Hormuz and Red Sea; sanctions risk requires secondary market mechanism",
    },
    "usa_wti": {
        "label": "USA --WTI (Gulf Coast -> Suez / Cape of Good Hope -> India)",
        "price_vs_brent": +1.5,   # slight premium; long haul
        "transit_days": 35,
        "grade": "light",
        "sanctions_risk": False,
        "corridors_ok": ["hormuz_closure", "red_sea_suspension", "opec_cut"],
        "note": "Reliable supply; long transit --suitable for strategic buffer stock, not spot cover",
    },
    "nigeria_bonny": {
        "label": "Nigeria --Bonny Light (Atlantic -> Cape of Good Hope -> India)",
        "price_vs_brent": +0.8,
        "transit_days": 22,
        "grade": "light",
        "sanctions_risk": False,
        "corridors_ok": ["hormuz_closure", "red_sea_suspension", "opec_cut"],
        "note": "High-quality light sweet crude; avoids all disrupted corridors via Atlantic/Cape route",
    },
    "saudi_cape": {
        "label": "Saudi Arabia --Arab Light (Cape of Good Hope reroute, avoiding Red Sea)",
        "price_vs_brent": +2.0,   # premium reflects longer Cape route freight uplift
        "transit_days": 28,
        "grade": "medium",
        "sanctions_risk": False,
        "corridors_ok": ["red_sea_suspension"],   # not viable for Hormuz closure
        "note": "Existing Saudi supply rerouted around Cape; freight premium applies; Hormuz-dependent volumes not covered",
    },
    "uae_murban": {
        "label": "UAE --Murban (ADNOC; pipeline to Fujairah, then Indian Ocean -> India)",
        "price_vs_brent": +1.0,
        "transit_days": 8,
        "grade": "light",
        "sanctions_risk": False,
        "corridors_ok": ["red_sea_suspension"],   # Fujairah pipeline bypasses Red Sea but not Hormuz
        "note": "Shortest transit via Fujairah export terminal; bypasses Red Sea but still exits via Gulf --not viable if Hormuz is closed",
    },
}

# Scoring weights (must sum to 1.0)
_W_PRICE      = 0.40   # lower cost = higher score
_W_TRANSIT    = 0.35   # shorter transit = higher score
_W_GRADE      = 0.15   # light > medium > heavy for most Indian refineries
_W_SANCTIONS  = 0.10   # penalise sanctioned sources

_GRADE_SCORE = {"light": 1.0, "medium": 0.7, "heavy": 0.4}

# Normalisation anchors (worst-case reference values for scoring)
_MAX_PREMIUM   = 5.0    # $/bbl --anything above this gets score 0 on price
_MIN_DISCOUNT  = -5.0   # $/bbl --best possible price score
_MAX_TRANSIT   = 40     # days


# ---------------------------------------------------------------------------
# Ranking
# ---------------------------------------------------------------------------

def rank_alternatives(disrupted_corridor: str) -> list[dict]:
    """Score and rank all 5 crude sources for a given disrupted corridor.

    Sources that cannot physically avoid the disrupted corridor are still
    listed but flagged as infeasible and ranked last.

    Scoring formula (each component normalised to [0, 1]):
      price_score    = 1 - (price_vs_brent - MIN_DISCOUNT) / (MAX_PREMIUM - MIN_DISCOUNT)
      transit_score  = 1 - transit_days / MAX_TRANSIT
      grade_score    = lookup from GRADE_SCORE
      sanctions_score = 1.0 if no sanctions risk, 0.0 if sanctioned

    Final score = W_PRICE * price + W_TRANSIT * transit + W_GRADE * grade
                + W_SANCTIONS * sanctions_score
    """
    ranked = []

    for key, src in CRUDE_SOURCES.items():
        feasible = disrupted_corridor in src["corridors_ok"]

        # Normalised component scores
        price_score = 1.0 - (src["price_vs_brent"] - _MIN_DISCOUNT) / (_MAX_PREMIUM - _MIN_DISCOUNT)
        price_score = max(0.0, min(1.0, price_score))

        transit_score = 1.0 - src["transit_days"] / _MAX_TRANSIT
        transit_score = max(0.0, min(1.0, transit_score))

        grade_score = _GRADE_SCORE.get(src["grade"], 0.5)

        sanctions_score = 0.0 if src["sanctions_risk"] else 1.0

        composite = (
            _W_PRICE     * price_score
            + _W_TRANSIT * transit_score
            + _W_GRADE   * grade_score
            + _W_SANCTIONS * sanctions_score
        )

        # Heavily penalise infeasible routes so they sort to the bottom
        if not feasible:
            composite = composite * 0.1

        ranked.append({
            "id": key,
            "label": src["label"],
            "price_vs_brent": src["price_vs_brent"],
            "transit_days": src["transit_days"],
            "grade": src["grade"],
            "sanctions_risk": src["sanctions_risk"],
            "feasible": feasible,
            "score": round(composite, 4),
            "note": src["note"],
        })

    ranked.sort(key=lambda x: x["score"], reverse=True)
    return ranked


# ---------------------------------------------------------------------------
# LLM recommendation memo
# ---------------------------------------------------------------------------

_MEMO_SYSTEM = """\
You are a senior crude oil trader at an Indian state oil company (IOC / HPCL / BPCL).
Write a short, concrete procurement recommendation memo --3-4 sentences --in the style
of an actual trading desk note. Be specific: name the route, the price premium or
discount per barrel, the transit time, and the volume shift percentage.
Use professional but direct language. Do not use bullet points.
Do not hedge excessively --give a clear recommendation with the key trade-off stated.
"""


def generate_recommendation(disrupted_corridor: str, top_3: list) -> str:
    """Call the Groq LLM to produce a trading-desk procurement memo."""
    groq_key = os.getenv("GROK_API_KEY")
    if not groq_key:
        raise EnvironmentError("GROK_API_KEY is not set in the environment.")

    llm = ChatGroq(model=_MODEL, api_key=groq_key, temperature=0.4)

    # Build a concise briefing of the top-3 options for the LLM
    options_text = ""
    for i, src in enumerate(top_3, 1):
        sign = "+" if src["price_vs_brent"] >= 0 else ""
        feasibility = "FEASIBLE" if src["feasible"] else "INFEASIBLE (corridor overlap)"
        options_text += (
            f"\n  Option {i}: {src['label']}"
            f"\n    Price vs Brent: {sign}{src['price_vs_brent']:.1f} $/bbl"
            f"\n    Transit: {src['transit_days']} days | Grade: {src['grade']}"
            f"\n    Status: {feasibility} | Score: {src['score']}"
            f"\n    Note: {src['note']}\n"
        )

    corridor_label = disrupted_corridor.replace("_", " ").title()
    prompt = (
        f"Disrupted corridor: {corridor_label}\n"
        f"Top-ranked procurement alternatives (scored by price, transit, grade, sanctions risk):\n"
        f"{options_text}\n"
        "Write a trading desk memo recommending the best rerouting action."
    )

    messages = [
        SystemMessage(content=_MEMO_SYSTEM),
        HumanMessage(content=prompt),
    ]
    return invoke_with_backoff(llm, messages)
