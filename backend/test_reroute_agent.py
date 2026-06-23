"""Smoke-test for reroute_agent -- runs hormuz_closure scenario."""
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
logging.basicConfig(level=logging.WARNING, format="%(levelname)s: %(message)s")

from app.agents.reroute_agent import rank_alternatives, generate_recommendation

SCENARIO = "hormuz_closure"

print("=" * 68)
print(f"  REROUTING ANALYSIS: {SCENARIO.replace('_', ' ').upper()}")
print("=" * 68)

ranked = rank_alternatives(SCENARIO)

print("\nALL ALTERNATIVES RANKED (best to worst):\n")
print(f"  {'#':<3} {'Score':<7} {'Feasible':<10} {'$/bbl vs Brent':<16} {'Transit':<10} {'Grade':<8} Source")
print("  " + "-" * 100)
def _p(s: str) -> None:
    print(s.encode("ascii", errors="replace").decode("ascii"))

for i, src in enumerate(ranked, 1):
    sign = "+" if src["price_vs_brent"] >= 0 else ""
    feasible_str = "YES" if src["feasible"] else "NO"
    _p(
        f"  {i:<3} {src['score']:<7} {feasible_str:<10} "
        f"{sign}{src['price_vs_brent']:.1f}{'':>10} "
        f"{src['transit_days']}d{'':>5} "
        f"{src['grade']:<8} "
        f"{src['label']}"
    )
    if src["sanctions_risk"]:
        _p(f"       ** SANCTIONS RISK ** {src['note']}")
    else:
        _p(f"       {src['note']}")

top_3 = ranked[:3]

print("\n" + "=" * 68)
print("  TOP 3 FEASIBLE OPTIONS")
print("=" * 68)
for i, src in enumerate(top_3, 1):
    sign = "+" if src["price_vs_brent"] >= 0 else ""
    _p(f"\n  [{i}] {src['label']}")
    _p(f"      Score      : {src['score']}")
    _p(f"      Price      : {sign}{src['price_vs_brent']:.1f} $/bbl vs Brent")
    _p(f"      Transit    : {src['transit_days']} days to Indian port")
    _p(f"      Grade      : {src['grade'].capitalize()}")
    _p(f"      Feasible   : {'Yes' if src['feasible'] else 'No -- corridor overlap'}")
    _p(f"      Note       : {src['note']}")

print("\n" + "=" * 68)
print("  TRADING DESK MEMO (LLM-generated)")
print("=" * 68 + "\n")
memo = generate_recommendation(SCENARIO, top_3)
safe_memo = memo.encode("ascii", errors="replace").decode("ascii")
print(safe_memo)
print()
