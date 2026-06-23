"""Smoke-test for risk_agent -- calls get_corridor_risk_scores() and prints results."""
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

from app.agents.risk_agent import get_corridor_risk_scores

CORRIDOR_LABELS = {
    "hormuz": "Strait of Hormuz",
    "red_sea": "Red Sea / Houthi",
    "general": "Iran / OPEC / General",
}

print("\n" + "=" * 65)
print("  ENERGY CORRIDOR GEOPOLITICAL RISK SCORES")
print("=" * 65)

scores = get_corridor_risk_scores()

for key, label in CORRIDOR_LABELS.items():
    data = scores.get(key, {})
    avg = data.get("avg_risk_score", "N/A")
    headlines = data.get("top_headlines", [])
    top_scores = data.get("top_scores", [])
    reasoning = data.get("top_reasoning", [])

    print("\n" + "-" * 65)
    print(f"  {label}")
    print(f"  Average risk score: {avg} / 100")
    print("-" * 65)
    if not headlines:
        print("  (no headlines scored)")
    for i, (h, s, r) in enumerate(zip(headlines, top_scores, reasoning), 1):
        print(f"  [{s:3d}] {h}")
        print(f"        -> {r}")

print("\n" + "=" * 65)
print("Raw JSON output:")
print(json.dumps(scores, indent=2))
