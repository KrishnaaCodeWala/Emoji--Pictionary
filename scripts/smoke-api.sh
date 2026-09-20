#!/usr/bin/env bash
# Smoke test for the Track A room lifecycle API.
# Requires: `npm run dev` running locally on http://localhost:3000
# and a Supabase project connected via .env.local.
#
# Usage: bash scripts/smoke-api.sh

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

json_get() {
  # $1 = json string, $2 = key
  python3 -c "import sys, json; d = json.loads(sys.argv[1]); print(d.get(sys.argv[2], ''))" "$1" "$2" 2>/dev/null \
    || node -e "const d = JSON.parse(process.argv[1]); process.stdout.write(String(d[process.argv[2]] ?? ''))" "$1" "$2"
}

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

echo "== create room =="
CREATE_RESP=$(curl -s -X POST "$BASE_URL/api/rooms/create" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"Host"}')
echo "$CREATE_RESP"

ROOM_CODE=$(json_get "$CREATE_RESP" "roomCode")
HOST_ID=$(json_get "$CREATE_RESP" "playerId")

if [ -z "$ROOM_CODE" ] || [ -z "$HOST_ID" ]; then
  fail "create room did not return roomCode/playerId"
fi
pass "created room $ROOM_CODE with host $HOST_ID"

echo "== join second player =="
JOIN_RESP=$(curl -s -X POST "$BASE_URL/api/rooms/join" \
  -H "Content-Type: application/json" \
  -d "{\"roomCode\":\"$ROOM_CODE\",\"nickname\":\"Guesser\"}")
echo "$JOIN_RESP"

GUESSER_ID=$(json_get "$JOIN_RESP" "playerId")
if [ -z "$GUESSER_ID" ]; then
  fail "join did not return playerId"
fi
pass "second player joined: $GUESSER_ID"

echo "== join players 3-5 to reach MAX_PLAYERS (5), all while room is still in lobby =="
for i in 3 4 5; do
  RESP=$(curl -s -o /tmp/join_n.json -w "%{http_code}" -X POST "$BASE_URL/api/rooms/join" \
    -H "Content-Type: application/json" \
    -d "{\"roomCode\":\"$ROOM_CODE\",\"nickname\":\"Player$i\"}")
  BODY=$(cat /tmp/join_n.json)
  echo "join attempt $i -> status $RESP, body $BODY"
  if [ "$RESP" != "200" ]; then
    fail "expected 200 for player $i join, got $RESP"
  fi
done
pass "reached 5 players in the room"

echo "== join 6th player, expect 403 (room full) =="
SIXTH_STATUS=$(curl -s -o /tmp/join_6.json -w "%{http_code}" -X POST "$BASE_URL/api/rooms/join" \
  -H "Content-Type: application/json" \
  -d "{\"roomCode\":\"$ROOM_CODE\",\"nickname\":\"Player6\"}")
echo "join attempt 6 -> status $SIXTH_STATUS, body $(cat /tmp/join_6.json)"
if [ "$SIXTH_STATUS" != "403" ]; then
  fail "expected 403 on 6th join, got $SIXTH_STATUS"
fi
pass "6th join correctly rejected with 403 (room full)"

echo "== start game =="
START_STATUS=$(curl -s -o /tmp/start_body.json -w "%{http_code}" -X POST "$BASE_URL/api/rooms/start" \
  -H "Content-Type: application/json" \
  -d "{\"roomCode\":\"$ROOM_CODE\",\"playerId\":\"$HOST_ID\"}")
cat /tmp/start_body.json
if [ "$START_STATUS" != "200" ]; then
  fail "start expected 200, got $START_STATUS"
fi
pass "game started"

echo "== fetch word: expect 200 for the drawer, 403 for a non-drawer =="
HOST_WORD_STATUS=$(curl -s -o /tmp/host_word.json -w "%{http_code}" \
  "$BASE_URL/api/rooms/word?roomCode=$ROOM_CODE&playerId=$HOST_ID")

GUESSER_WORD_STATUS=$(curl -s -o /tmp/guesser_word.json -w "%{http_code}" \
  "$BASE_URL/api/rooms/word?roomCode=$ROOM_CODE&playerId=$GUESSER_ID")

echo "host word status: $HOST_WORD_STATUS, body: $(cat /tmp/host_word.json)"
echo "guesser word status: $GUESSER_WORD_STATUS, body: $(cat /tmp/guesser_word.json)"

if [ "$HOST_WORD_STATUS" = "200" ] && [ "$GUESSER_WORD_STATUS" = "403" ]; then
  pass "host is drawer (200), guesser correctly forbidden (403)"
elif [ "$GUESSER_WORD_STATUS" = "200" ] && [ "$HOST_WORD_STATUS" = "403" ]; then
  pass "guesser is drawer (200), host correctly forbidden (403)"
else
  fail "expected exactly one of host/guesser to get 200 and the other 403, got host=$HOST_WORD_STATUS guesser=$GUESSER_WORD_STATUS"
fi

echo ""
echo "All smoke tests passed."
