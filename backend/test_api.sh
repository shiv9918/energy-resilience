#!/usr/bin/env bash
# test_api.sh — smoke-test all endpoints.
# Usage: start the server first, then run:
#   bash test_api.sh
#
# Requires: curl, python3 (for pretty-printing JSON)

BASE="http://localhost:8000"
PASS=0
FAIL=0

_check() {
    local label="$1"
    local status="$2"
    local expected="$3"
    if [ "$status" -eq "$expected" ]; then
        echo "  [PASS] $label (HTTP $status)"
        PASS=$((PASS + 1))
    else
        echo "  [FAIL] $label (HTTP $status, expected $expected)"
        FAIL=$((FAIL + 1))
    fi
}

echo ""
echo "============================================================"
echo "  Energy Resilience API -- endpoint smoke tests"
echo "  Server: $BASE"
echo "============================================================"

# ── Health ────────────────────────────────────────────────────────────────
echo ""
echo "GET /health"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/health")
_check "health check" "$STATUS" 200

# ── Scenarios list (fast, no LLM) ────────────────────────────────────────
echo ""
echo "GET /api/scenarios"
RESP=$(curl -s -w "\n%{http_code}" "$BASE/api/scenarios")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
_check "list scenarios" "$STATUS" 200
echo "$BODY" | python3 -m json.tool 2>/dev/null | head -30

# ── Macro history (fast, no LLM) ──────────────────────────────────────────
echo ""
echo "GET /api/macro-history?column=USDINR&months=6"
RESP=$(curl -s -w "\n%{http_code}" "$BASE/api/macro-history?column=USDINR&months=6")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
_check "macro history USDINR" "$STATUS" 200
echo "$BODY" | python3 -m json.tool 2>/dev/null

echo ""
echo "GET /api/macro-history?column=INVALID_COL&months=6  (expect 422)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/macro-history?column=INVALID_COL&months=6")
_check "macro history bad column" "$STATUS" 422

# ── Simulate (calls LLM) ─────────────────────────────────────────────────
echo ""
echo "POST /api/simulate  {scenario_id: hormuz_closure}"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/simulate" \
    -H "Content-Type: application/json" \
    -d '{"scenario_id": "hormuz_closure"}')
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
_check "simulate hormuz_closure" "$STATUS" 200
echo "$BODY" | python3 -m json.tool 2>/dev/null | grep -E '"description"|"projected_price|"scenario_summary"' | head -10

echo ""
echo "POST /api/simulate  {scenario_id: bad_id}  (expect 422)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/simulate" \
    -H "Content-Type: application/json" \
    -d '{"scenario_id": "bad_id"}')
_check "simulate bad scenario_id" "$STATUS" 422

# ── Recommend (calls LLM) ────────────────────────────────────────────────
echo ""
echo "POST /api/recommend  {corridor: hormuz}"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/recommend" \
    -H "Content-Type: application/json" \
    -d '{"corridor": "hormuz"}')
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
_check "recommend hormuz" "$STATUS" 200
echo "$BODY" | python3 -m json.tool 2>/dev/null | grep -E '"label"|"score"|"feasible"' | head -15

echo ""
echo "POST /api/recommend  {corridor: bad_corridor}  (expect 422)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/recommend" \
    -H "Content-Type: application/json" \
    -d '{"corridor": "bad_corridor"}')
_check "recommend bad corridor" "$STATUS" 422

# ── Risk scores (calls News API + LLM, slow) ─────────────────────────────
echo ""
echo "GET /api/risk-scores  (this calls News API + LLM, ~30s)"
RESP=$(curl -s -w "\n%{http_code}" --max-time 120 "$BASE/api/risk-scores")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
_check "risk scores" "$STATUS" 200
echo "$BODY" | python3 -m json.tool 2>/dev/null | grep -E '"avg_risk_score"|"cached"' | head -10

echo ""
echo "GET /api/risk-scores  (second call — should be cached)"
RESP=$(curl -s -w "\n%{http_code}" "$BASE/api/risk-scores")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
_check "risk scores (cached)" "$STATUS" 200
echo "$BODY" | python3 -m json.tool 2>/dev/null | grep '"cached"'

# ── Full pipeline (slowest — runs all three agents) ───────────────────────
echo ""
echo "GET /api/pipeline  (full end-to-end, ~60-90s)"
RESP=$(curl -s -w "\n%{http_code}" --max-time 180 "$BASE/api/pipeline")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
_check "full pipeline" "$STATUS" 200
echo "$BODY" | python3 -m json.tool 2>/dev/null | grep -E '"highest_risk_corridor"|"avg_risk_score"|"projected_price_usd"|"cached"' | head -10

echo ""
echo "============================================================"
echo "  Results: $PASS passed, $FAIL failed"
echo "============================================================"
echo ""
