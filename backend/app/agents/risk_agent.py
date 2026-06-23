"""Geopolitical risk scoring agent.

Fetches live news headlines via NewsAPI / GNews and scores them with a
Groq-hosted LLM to produce per-corridor risk scores (0-100).
"""
import json
import logging
import os
import re
import time  # still used for inter-headline sleep
from pathlib import Path

import httpx
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from app.agents.groq_utils import invoke_with_backoff

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

logger = logging.getLogger(__name__)

_MODEL = "llama-3.3-70b-versatile"

_SYSTEM_PROMPT = """\
You are a geopolitical energy-risk analyst.
Given a news headline, return ONLY a valid JSON object — no markdown, no code
fences, no explanation — with exactly these three fields:
  "corridor": one of "hormuz", "red_sea", or "general"
  "risk_score": an integer from 0 (no risk) to 100 (extreme risk)
  "reasoning": a single sentence explaining the score

Example output:
{"corridor": "hormuz", "risk_score": 72, "reasoning": "Drone attacks on tankers raise closure probability."}
"""

_CORRIDORS: dict[str, str] = {
    "hormuz": "Strait of Hormuz oil tanker",
    "red_sea": "Red Sea shipping Houthi",
    "general": "Iran oil sanctions OPEC supply disruption",
}

# ---------------------------------------------------------------------------
# Demo-mode fallback headlines
# Used when NEWS_API_KEY is absent, rate-limited, or the network is down.
# Realistic but static — clearly flagged in logs as fallback data.
# ---------------------------------------------------------------------------
_FALLBACK_HEADLINES: dict[str, list[str]] = {
    "hormuz": [
        "Iran warns of Strait of Hormuz closure if US sanctions escalate further",
        "IRGC naval drills near Hormuz raise tanker insurance premiums by 15%",
        "Crude oil futures spike 4% as Hormuz tension mounts after US carrier deployment",
        "Lloyd's of London widens Hormuz war-risk zone following drone incidents",
        "Saudi Aramco activates East-West pipeline as Hormuz contingency buffer",
    ],
    "red_sea": [
        "Houthi missile strikes two more commercial vessels in Red Sea, shipping diversion continues",
        "Maersk suspends Red Sea transits indefinitely citing unacceptable crew safety risk",
        "Red Sea attacks add $1.2M per voyage in Cape of Good Hope rerouting costs",
        "US Navy destroys three Houthi drones in latest Red Sea engagement",
        "Container shipping rates from Asia to Europe surge 140% on Red Sea avoidance",
    ],
    "general": [
        "US Treasury expands Iran oil sanctions list, targets shadow fleet operators",
        "OPEC+ agrees emergency 1.5 million bpd output cut amid demand uncertainty",
        "Brent crude rallies above $90 on combined Hormuz and OPEC supply fears",
        "India accelerates strategic petroleum reserve refill ahead of monsoon season",
        "IEA warns global spare capacity at decade low amid multiple supply disruptions",
    ],
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _strip_fences(text: str) -> str:
    """Remove markdown code fences that the LLM sometimes wraps JSON in."""
    return re.sub(r"```(?:json)?\s*|\s*```", "", text).strip()


def _parse_score_response(raw: str) -> dict:
    """Try to parse JSON from *raw*; return None on failure."""
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def _fallback_for_query(query: str) -> list[str]:
    """Map a query string back to its corridor key and return fallback headlines."""
    for corridor_key, corridor_query in _CORRIDORS.items():
        if corridor_query == query:
            headlines = _FALLBACK_HEADLINES[corridor_key]
            logger.warning(
                "DEMO MODE: using fallback headlines for corridor '%s' "
                "(live news unavailable)", corridor_key
            )
            return headlines
    # generic fallback if query doesn't match exactly
    logger.warning("DEMO MODE: using general fallback headlines for query '%s'", query)
    return _FALLBACK_HEADLINES["general"]


def fetch_headlines(query: str, max_results: int = 10) -> list[str]:
    """Return up to *max_results* headline strings from NewsAPI or GNews.

    Tries NewsAPI first, then GNews. If both fail for any reason (missing key,
    rate limit, no network) falls back to hardcoded demo headlines so the app
    never crashes on stage. Fallback is clearly logged as DEMO MODE.
    """
    api_key = os.getenv("NEWS_API_KEY")
    if not api_key:
        logger.warning(
            "DEMO MODE: NEWS_API_KEY not set — using fallback headlines for query '%s'", query
        )
        return _fallback_for_query(query)[:max_results]

    # --- NewsAPI (newsapi.org) ---
    try:
        resp = httpx.get(
            "https://newsapi.org/v2/everything",
            params={
                "q": query,
                "pageSize": max_results,
                "sortBy": "publishedAt",
                "language": "en",
                "apiKey": api_key,
            },
            timeout=10,
        )
        resp.raise_for_status()
        articles = resp.json().get("articles", [])
        headlines = [
            a["title"] for a in articles if a.get("title") and a["title"] != "[Removed]"
        ]
        if headlines:
            logger.debug("NewsAPI returned %d headlines for '%s'", len(headlines), query)
            return headlines[:max_results]
        # Empty result set — fall through to GNews
        logger.warning("NewsAPI returned 0 usable headlines for '%s' — trying GNews", query)
    except httpx.HTTPStatusError as exc:
        logger.warning("NewsAPI HTTP %s for '%s' — trying GNews", exc.response.status_code, query)
    except Exception as exc:  # noqa: BLE001
        logger.warning("NewsAPI request failed (%s) for '%s' — trying GNews", exc, query)

    # --- GNews fallback (gnews.io) ---
    try:
        resp = httpx.get(
            "https://gnews.io/api/v4/search",
            params={
                "q": query,
                "max": max_results,
                "lang": "en",
                "token": api_key,
            },
            timeout=10,
        )
        resp.raise_for_status()
        articles = resp.json().get("articles", [])
        headlines = [a["title"] for a in articles if a.get("title")]
        if headlines:
            logger.debug("GNews returned %d headlines for '%s'", len(headlines), query)
            return headlines[:max_results]
        logger.warning("GNews returned 0 usable headlines for '%s' — using demo fallback", query)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "DEMO MODE: GNews also failed (%s) for '%s' — using fallback headlines", exc, query
        )

    # --- Demo fallback (both APIs failed) ---
    return _fallback_for_query(query)[:max_results]


def score_headline(headline: str) -> dict:
    """Score a single headline with the Groq LLM.

    Returns a dict with keys: corridor, risk_score (int), reasoning (str).
    On double parse failure falls back to {"corridor": "general", "risk_score": 50,
    "reasoning": "Parse failure — default score applied."}.
    """
    groq_key = os.getenv("GROK_API_KEY")
    if not groq_key:
        raise EnvironmentError("GROK_API_KEY is not set in the environment.")

    llm = ChatGroq(model=_MODEL, api_key=groq_key, temperature=0)
    messages = [
        SystemMessage(content=_SYSTEM_PROMPT),
        HumanMessage(content=f"Headline: {headline}"),
    ]

    # Attempt 1
    raw = invoke_with_backoff(llm, messages)
    result = _parse_score_response(_strip_fences(raw))
    if result is not None:
        return result

    # Attempt 2 — retry once for JSON parse failures
    logger.warning("JSON parse failed on first attempt for headline: %s", headline[:80])
    raw = invoke_with_backoff(llm, messages)
    result = _parse_score_response(_strip_fences(raw))
    if result is not None:
        return result

    # Fallback
    logger.error("JSON parse failed twice for headline: %s", headline[:80])
    return {
        "corridor": "general",
        "risk_score": 50,
        "reasoning": "Parse failure — default score applied.",
    }


def get_corridor_risk_scores() -> dict:
    """Fetch headlines and score them for all three corridors.

    Returns:
        {
          "hormuz":  {"avg_risk_score": float, "top_headlines": [str, ...]},
          "red_sea": {"avg_risk_score": float, "top_headlines": [str, ...]},
          "general": {"avg_risk_score": float, "top_headlines": [str, ...]},
        }
    """
    results: dict[str, dict] = {k: {"scores": [], "headlines": []} for k in _CORRIDORS}

    for corridor_key, query in _CORRIDORS.items():
        logger.info("Fetching headlines for corridor '%s' (query: %s)", corridor_key, query)
        try:
            headlines = fetch_headlines(query, max_results=5)
        except Exception as exc:  # noqa: BLE001
            logger.error("Could not fetch headlines for '%s': %s", corridor_key, exc)
            continue

        for headline in headlines:
            time.sleep(1.5)   # 1.5s gap keeps us safely under Groq's 30 RPM free-tier limit
            scored = score_headline(headline)
            # The LLM may route the headline to any corridor; record it under
            # whichever corridor the model chose so the aggregation stays honest.
            target = scored.get("corridor", corridor_key)
            if target not in results:
                target = corridor_key  # guard against unexpected values
            results[target]["scores"].append(scored["risk_score"])
            results[target]["headlines"].append(
                {"text": headline, "risk_score": scored["risk_score"], "reasoning": scored["reasoning"]}
            )

    # Build final output: average score + top-3 headlines per corridor
    output: dict[str, dict] = {}
    for corridor_key in _CORRIDORS:
        entry = results[corridor_key]
        scores = entry["scores"]
        avg = round(sum(scores) / len(scores), 1) if scores else 0.0
        # Top-3 by descending risk score
        top3 = sorted(entry["headlines"], key=lambda h: h["risk_score"], reverse=True)[:3]
        output[corridor_key] = {
            "avg_risk_score": avg,
            "top_headlines": [h["text"] for h in top3],
            "top_scores": [h["risk_score"] for h in top3],
            "top_reasoning": [h["reasoning"] for h in top3],
        }

    return output
