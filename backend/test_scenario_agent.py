"""Smoke-test for scenario_agent -- runs all three scenarios and prints results."""
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
logging.basicConfig(level=logging.WARNING, format="%(levelname)s: %(message)s")

from app.data.macro_data import get_latest_values
from app.agents.scenario_agent import SCENARIOS, simulate_scenario, generate_scenario_summary

latest = get_latest_values()

print("=" * 68)
print("  MACRO SNAPSHOT (inputs to all scenarios)")
print("=" * 68)
print(f"  Baseline oil price (configured) : ${latest['oil_price_usd']:.2f} / bbl")
print(f"  USD/INR                         : {latest['USDINR']:.2f}")
print(f"  WPI Fuel inflation (yoy)        : {latest['WPI_Fuel_yoy']:.2f}%")
print(f"  CPI inflation                   : {latest['CPI_Infl']:.2f}%")
print(f"  Data as of                      : {latest['Year']}-{latest['MonthNo']:02d}")

for scenario_id in SCENARIOS:
    print("\n" + "=" * 68)
    result = simulate_scenario(scenario_id, latest)

    print(f"  SCENARIO: {result['description']}")
    print("=" * 68)
    print(f"  Global supply cut        : {result['global_supply_cut_pct']}%")
    print(f"  India supply gap         : {result['supply_gap_bpd']:,} bpd")
    print(f"  Duration                 : {result['duration_days'] or 'indefinite'} days")
    print()
    print(f"  Price elasticity assumed : {result['price_elasticity_used']}x (1% supply cut -> {result['price_elasticity_used']}% price rise)")
    print(f"  Price impact             : +{result['price_impact_pct']}%")
    print(f"  Baseline oil price       : ${result['baseline_oil_price_usd']:.2f} / bbl")
    print(f"  Projected oil price      : ${result['projected_price_usd']:.2f} / bbl")
    print()
    print(f"  INR pass-through used    : {result['inr_passthrough_used']} (fuel_yoy={result['fuel_yoy_at_simulation']:.2f}%)")
    print(f"  INR depreciation         : {result['inr_depreciation_pct']}%")
    print(f"  Baseline USD/INR         : {result['baseline_usdinr']:.2f}")
    print(f"  Projected USD/INR        : {result['projected_usdinr']:.2f}")
    print()
    print(f"  SPR effective cover      : {result['spr_days_remaining']} days")
    print()
    print("  Policymaker summary (LLM):")
    print("  " + "-" * 64)
    summary = generate_scenario_summary(scenario_id, result)
    safe = summary.encode("ascii", errors="replace").decode("ascii")
    for line in safe.split(". "):
        line = line.strip()
        if line:
            print(f"  {line}.")
    print()

print("=" * 68)
print("All scenarios completed.")
