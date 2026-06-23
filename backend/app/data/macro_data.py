import logging
import os
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

_CSV_PATH = Path(__file__).resolve().parents[3] / "data" / "macro_panel.csv"

_REQUIRED_COLUMNS = {
    "USDINR",
    "CPI_Index",
    "CPI_Infl",
    "WPI_All",
    "WPI_All_yoy",
    "WPI_Fuel",
    "WPI_Fuel_yoy",
    "Year",
    "MonthNo",
}


def _load() -> pd.DataFrame:
    df = pd.read_csv(_CSV_PATH, parse_dates=["Date"])
    df.sort_values("Date", inplace=True)
    df.reset_index(drop=True, inplace=True)
    return df


_df: pd.DataFrame = _load()


def get_latest_values() -> dict:
    """Return the most recent row's key macro indicators plus a configurable oil price.

    Sparse yoy columns (WPI_All_yoy, WPI_Fuel_yoy) use the last non-NaN row so
    the dict never contains NaN — the raw index columns (USDINR, CPI_*, WPI_All,
    WPI_Fuel) are taken from the true latest row.
    """
    row = _df.iloc[-1]

    # For yoy columns that are often blank on the most recent rows, fall back to
    # the last populated row rather than returning NaN to callers.
    def _last_valid(col: str) -> float:
        idx = _df[col].last_valid_index()
        return float(_df.loc[idx, col]) if idx is not None else float("nan")

    raw_oil = os.getenv("BASE_OIL_PRICE_USD")
    if raw_oil is None:
        logger.warning(
            "BASE_OIL_PRICE_USD is not set — defaulting to $75.0. "
            "Update this to a real current Brent price before the demo."
        )
        oil_price = 75.0
    else:
        oil_price = float(raw_oil)

    return {
        "USDINR": float(row["USDINR"]),
        "CPI_Index": float(row["CPI_Index"]),
        "CPI_Infl": _last_valid("CPI_Infl"),
        "WPI_All": float(row["WPI_All"]),
        "WPI_All_yoy": _last_valid("WPI_All_yoy"),
        "WPI_Fuel": float(row["WPI_Fuel"]),
        "WPI_Fuel_yoy": _last_valid("WPI_Fuel_yoy"),
        "Year": int(row["Year"]),
        "MonthNo": int(row["MonthNo"]),
        "oil_price_usd": oil_price,
    }


def get_historical_series(column: str, months: int = 12) -> list[dict]:
    """Return the last *months* rows for *column* as [{date, value}, ...] dicts.

    Raises ValueError listing all valid column names if *column* is not present.
    """
    valid = [c for c in _df.columns if c != "Date"]
    if column not in valid:
        raise ValueError(
            f"Column '{column}' not found. Valid columns are:\n  " + ", ".join(sorted(valid))
        )

    # Drop NaN first so sparse columns (e.g. yoy fields) don't eat into the
    # requested window — then take the last *months* populated rows.
    populated = _df[["Date", column]].dropna(subset=[column])
    subset = populated.tail(months)
    return [
        {"date": row["Date"].strftime("%Y-%m-%d"), "value": float(row[column])}
        for _, row in subset.iterrows()
    ]


def get_fuel_inflation_trend(months: int = 6) -> float:
    """Return the average WPI_Fuel_yoy over the last *months* months.

    This is the primary domestic fuel-price-pressure signal for the scenario agent.
    """
    series = _df["WPI_Fuel_yoy"].dropna().tail(months)
    return float(series.mean())
