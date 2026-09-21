#!/usr/bin/env bash
# Smoke test for the v4 canvas drawing input mode. BASE_URL env overrides host.
# Requires: `npm run dev` running locally.
#
# Usage: bash scripts/smoke-canvas.sh

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

json_get() {
  # $1 = json string, $2 = key
  python3 -c "import sys, json; d = json.loads(sys.argv[1]); print(d.get(sys.argv[2], ''))" "$1" "$2"
}

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

# A 1x1 transparent PNG, well under MAX_CANVAS_DATA_URL_LENGTH.
TINY_PNG="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="

echo "== create room (host) =="
CREATE_RESP=$(curl -s -X POST "$BASE_URL/api/rooms/create" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"Host"}')
echo "$CREATE_RESP"
ROOM_CODE=$(json_get "$CREATE_RESP" "roomCode")
P1=$(json_get "$CREATE_RESP" "playerId")
if [ -z "$ROOM_CODE" ] || [ -z "$P1" ]; then
  fail "create room did not return roomCode/playerId"
fi
pass "created room $ROOM_CODE with host $P1"

echo "== join guesser =="
JOIN_RESP=$(curl -s -X POST "$BASE_URL/api/rooms/join" \
  -H "Content-Type: application/json" \
  -d "{\"roomCode\":\"$ROOM_CODE\",\"nickname\":\"Guesser\"}")
echo "$JOIN_RESP"
P2=$(json_get "$JOIN_RESP" "playerId")
if [ -z "$P2" ]; then
  fail "join (guesser) did not return playerId"
fi
pass "guesser joined: $P2"

echo "== set mode classic with canvas input =="
MODE_STATUS=$(curl -s -o "$TMP_DIR/mode.json" -w "%{http_code}" -X POST "$BASE_URL/api/rooms/mode" \
  -H "Content-Type: application/json" \
  -d "{\"roomCode\":\"$ROOM_CODE\",\"playerId\":\"$P1\",\"mode\":\"classic\",\"settings\":{\"input\":\"canvas\"}}")
cat "$TMP_DIR/mode.json"
if [ "$MODE_STATUS" != "200" ]; then
  fail "set mode expected 200, got $MODE_STATUS"
fi
pass "mode set to classic with canvas input"

echo "== start game =="
START_STATUS=$(curl -s -o "$TMP_DIR/start.json" -w "%{http_code}" -X POST "$BASE_URL/api/rooms/start" \
  -H "Content-Type: application/json" \
  -d "{\"roomCode\":\"$ROOM_CODE\",\"playerId\":\"$P1\"}")
cat "$TMP_DIR/start.json"
if [ "$START_STATUS" != "200" ]; then
  fail "start expected 200, got $START_STATUS"
fi
pass "game started (host draws round 1)"

echo "== host posts a tiny PNG data URL to /api/draw =="
python3 -c "
import json
body = {'roomCode': '$ROOM_CODE', 'playerId': '$P1', 'emojis': '$TINY_PNG'}
print(json.dumps(body))
" > "$TMP_DIR/draw_ok.json"
DRAW_OK_STATUS=$(curl -s -o "$TMP_DIR/draw_ok_resp.json" -w "%{http_code}" -X POST "$BASE_URL/api/draw" \
  -H "Content-Type: application/json" \
  --data @"$TMP_DIR/draw_ok.json")
cat "$TMP_DIR/draw_ok_resp.json"
if [ "$DRAW_OK_STATUS" != "200" ]; then
  fail "draw with tiny PNG expected 200, got $DRAW_OK_STATUS"
fi
pass "tiny PNG snapshot accepted"

echo "== host posts an oversized (~250 KB) PNG data URL to /api/draw =="
python3 -c "
import json
big = 'data:image/png;base64,' + ('A' * 250000)
body = {'roomCode': '$ROOM_CODE', 'playerId': '$P1', 'emojis': big}
print(json.dumps(body))
" > "$TMP_DIR/draw_big.json"
DRAW_BIG_STATUS=$(curl -s -o "$TMP_DIR/draw_big_resp.json" -w "%{http_code}" -X POST "$BASE_URL/api/draw" \
  -H "Content-Type: application/json" \
  --data @"$TMP_DIR/draw_big.json")
cat "$TMP_DIR/draw_big_resp.json"
if [ "$DRAW_BIG_STATUS" != "400" ]; then
  fail "draw with oversized PNG expected 400, got $DRAW_BIG_STATUS"
fi
pass "oversized PNG snapshot correctly rejected with 400"

echo "== confirm room is still playing (word route) =="
WORD_RESP=$(curl -s -o "$TMP_DIR/word.json" -w "%{http_code}" "$BASE_URL/api/rooms/word?roomCode=$ROOM_CODE&playerId=$P1")
cat "$TMP_DIR/word.json"
if [ "$WORD_RESP" != "200" ]; then
  fail "word route expected 200 (room still playing), got $WORD_RESP"
fi
WORD=$(json_get "$(cat "$TMP_DIR/word.json")" "word")
if [ -z "$WORD" ]; then
  fail "expected a non-empty current word, room may not still be playing"
fi
pass "room still playing after the rejected oversized draw (word: $WORD)"

echo ""
echo "All canvas smoke tests passed."
