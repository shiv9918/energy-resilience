"""Quick sanity-check: load the macro CSV and call every public function."""
import json
import sys
from pathlib import Path

# Allow running from the backend/ directory without installing the package.
sys.path.insert(0, str(Path(__file__).parent))

import logging
logging.basicConfig(level=logging.WARNING, format="%(levelname)s: %(message)s")

from app.data.macro_data import (
    get_fuel_inflation_trend,
    get_historical_series,
    get_latest_values,
)

print("=" * 60)
print("get_latest_values()")
print("=" * 60)
latest = get_latest_values()
for k, v in latest.items():
    print(f"  {k}: {v}")

print()
print("=" * 60)
print("get_historical_series('WPI_Fuel_yoy', months=6)")
print("=" * 60)
series = get_historical_series("WPI_Fuel_yoy", months=6)
for entry in series:
    print(f"  {entry['date']}  {entry['value']:.4f}")

print()
print("=" * 60)
print("get_historical_series('USDINR', months=12)")
print("=" * 60)
usdinr = get_historical_series("USDINR", months=12)
for entry in usdinr:
    print(f"  {entry['date']}  {entry['value']:.4f}")

print()
print("=" * 60)
print("get_fuel_inflation_trend(months=6)")
print("=" * 60)
trend = get_fuel_inflation_trend(months=6)
print(f"  avg WPI_Fuel_yoy (last 6 months): {trend:.4f}")

print()
print("=" * 60)
print("ValueError on bad column name")
print("=" * 60)
try:
    get_historical_series("NONEXISTENT_COL")
except ValueError as e:
    print(f"  Caught expected ValueError:\n  {e}")

print()
print("All checks passed.")
