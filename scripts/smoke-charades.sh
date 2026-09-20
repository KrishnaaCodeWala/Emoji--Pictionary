#!/usr/bin/env bash
# Smoke test for the charades game mode API. BASE_URL env overrides host.
# Requires: `npm run dev` running locally, prompts seeded via `npm run seed:prompts`,
# and migration 002_charades.sql applied.
#
# Usage: bash scripts/smoke-charades.sh

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

json_get() {
  # $1 = json string, $2 = key
  python3 -c "import sys, json; d = json.loads(sys.argv[1]); print(d.get(sys.argv[2], ''))" "$1" "$2" 2>/dev/null \
    || node -e "const d = JSON.parse(process.argv[1]); process.stdout.write(String(d[process.argv[2]] ?? ''))" "$1" "$2"
}

json_get_nested() {
  # $1 = json string, $2 = top key, $3 = nested key
  python3 -c "
import sys, json
d = json.loads(sys.argv[1])
v = d.get(sys.argv[2]) or {}
print(v.get(sys.argv[3], '') if isinstance(v, dict) else '')
" "$1" "$2" "$3"
}

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

echo "== create room =="
CREATE_RESP=$(curl -s -X POST "$BASE_URL/api/rooms/create" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"Actor"}')
echo "$CREATE_RESP"

ROOM_CODE=$(json_get "$CREATE_RESP" "roomCode")
HOST_ID=$(json_get "$CREATE_RESP" "playerId")

if [ -z "$ROOM_CODE" ] || [ -z "$HOST_ID" ]; then
  fail "create room did not return roomCode/playerId"
fi
pass "created room $ROOM_CODE with host (actor) $HOST_ID"

echo "== join guesser =="
JOIN_RESP=$(curl -s -X POST "$BASE_URL/api/rooms/join" \
  -H "Content-Type: application/json" \
  -d "{\"roomCode\":\"$ROOM_CODE\",\"nickname\":\"Guesser\"}")
echo "$JOIN_RESP"

GUESSER_ID=$(json_get "$JOIN_RESP" "playerId")
if [ -z "$GUESSER_ID" ]; then
  fail "join did not return playerId"
fi
pass "guesser joined: $GUESSER_ID"

echo "== set mode to charades (kinds: movie) =="
MODE_STATUS=$(curl -s -o /tmp/mode_body.json -w "%{http_code}" -X POST "$BASE_URL/api/rooms/mode" \
  -H "Content-Type: application/json" \
  -d "{\"roomCode\":\"$ROOM_CODE\",\"playerId\":\"$HOST_ID\",\"mode\":\"charades\",\"settings\":{\"kinds\":[\"movie\"]}}")
cat /tmp/mode_body.json
if [ "$MODE_STATUS" != "200" ]; then
  fail "set mode expected 200, got $MODE_STATUS"
fi
pass "mode set to charades"

echo "== start game =="
START_STATUS=$(curl -s -o /tmp/start_body.json -w "%{http_code}" -X POST "$BASE_URL/api/rooms/start" \
  -H "Content-Type: application/json" \
  -d "{\"roomCode\":\"$ROOM_CODE\",\"playerId\":\"$HOST_ID\"}")
cat /tmp/start_body.json
if [ "$START_STATUS" != "200" ]; then
  fail "start expected 200, got $START_STATUS"
fi
pass "game started"

echo "== determine actor (current drawer) =="
# The host may or may not be the first drawer depending on turn order; probe both.
HOST_WORD_STATUS=$(curl -s -o /tmp/host_word.json -w "%{http_code}" \
  "$BASE_URL/api/rooms/word?roomCode=$ROOM_CODE&playerId=$HOST_ID")
GUESSER_WORD_STATUS=$(curl -s -o /tmp/guesser_word.json -w "%{http_code}" \
  "$BASE_URL/api/rooms/word?roomCode=$ROOM_CODE&playerId=$GUESSER_ID")

if [ "$HOST_WORD_STATUS" = "200" ]; then
  ACTOR_ID="$HOST_ID"
  NON_ACTOR_ID="$GUESSER_ID"
  ACTOR_WORD_JSON=$(cat /tmp/host_word.json)
  NON_ACTOR_STATUS="$GUESSER_WORD_STATUS"
elif [ "$GUESSER_WORD_STATUS" = "200" ]; then
  ACTOR_ID="$GUESSER_ID"
  NON_ACTOR_ID="$HOST_ID"
  ACTOR_WORD_JSON=$(cat /tmp/guesser_word.json)
  NON_ACTOR_STATUS="$HOST_WORD_STATUS"
else
  fail "expected exactly one of host/guesser to get 200 for /api/rooms/word, got host=$HOST_WORD_STATUS guesser=$GUESSER_WORD_STATUS"
fi

echo "actor word response: $ACTOR_WORD_JSON"
if [ "$NON_ACTOR_STATUS" != "403" ]; then
  fail "expected non-actor to get 403 from /api/rooms/word, got $NON_ACTOR_STATUS"
fi
pass "actor is $ACTOR_ID (200), non-actor correctly forbidden (403)"

PROMPT_TITLE=$(json_get_nested "$ACTOR_WORD_JSON" "prompt" "title")
if [ -z "$PROMPT_TITLE" ]; then
  fail "expected a prompt object with a title in charades mode word response"
fi
pass "actor received prompt: $PROMPT_TITLE"

echo "== actor reveals hint 'year' =="
HINT_STATUS=$(curl -s -o /tmp/hint_body.json -w "%{http_code}" -X POST "$BASE_URL/api/rooms/hint" \
  -H "Content-Type: application/json" \
  -d "{\"roomCode\":\"$ROOM_CODE\",\"playerId\":\"$ACTOR_ID\",\"hint\":\"year\"}")
cat /tmp/hint_body.json
if [ "$HINT_STATUS" != "200" ]; then
  fail "hint reveal expected 200, got $HINT_STATUS"
fi
pass "hint 'year' revealed"

echo "== actor reveals hint 'year' again (idempotent) =="
HINT_STATUS_2=$(curl -s -o /tmp/hint_body2.json -w "%{http_code}" -X POST "$BASE_URL/api/rooms/hint" \
  -H "Content-Type: application/json" \
  -d "{\"roomCode\":\"$ROOM_CODE\",\"playerId\":\"$ACTOR_ID\",\"hint\":\"year\"}")
cat /tmp/hint_body2.json
if [ "$HINT_STATUS_2" != "200" ]; then
  fail "repeated hint reveal expected 200, got $HINT_STATUS_2"
fi
pass "repeated hint reveal is idempotent (200)"

echo "== guesser sends a wrong guess =="
WRONG_RESP=$(curl -s -X POST "$BASE_URL/api/guess" \
  -H "Content-Type: application/json" \
  -d "{\"roomCode\":\"$ROOM_CODE\",\"playerId\":\"$NON_ACTOR_ID\",\"guess\":\"definitely not the title xyz\"}")
echo "$WRONG_RESP"
WRONG_CORRECT=$(json_get "$WRONG_RESP" "correct")
if [ "$WRONG_CORRECT" != "False" ] && [ "$WRONG_CORRECT" != "false" ]; then
  fail "expected wrong guess to return correct:false, got: $WRONG_RESP"
fi
pass "wrong guess correctly rejected"

echo "== guesser sends a fuzzy guess (title with one letter changed, if long enough) =="
# Contract note (GuessRes / api/guess): a fuzzy ('close') match returns
# {correct:false, close:true}, never correct:true -- only an exact (post-normalisation)
# match returns correct:true. So this step verifies close:true, and the following step
# sends the exact title to verify correct:true + round advance.
TITLE_LEN=${#PROMPT_TITLE}
if [ "$TITLE_LEN" -ge 6 ]; then
  # Flip the first character to something else to create a 1-edit-distance fuzzy guess.
  FIRST_CHAR="${PROMPT_TITLE:0:1}"
  REST="${PROMPT_TITLE:1}"
  if [ "$FIRST_CHAR" = "x" ] || [ "$FIRST_CHAR" = "X" ]; then
    FUZZY_GUESS="y${REST}"
  else
    FUZZY_GUESS="x${REST}"
  fi
  echo "using fuzzy guess: $FUZZY_GUESS (original: $PROMPT_TITLE)"

  CLOSE_RESP=$(curl -s -X POST "$BASE_URL/api/guess" \
    -H "Content-Type: application/json" \
    -d "{\"roomCode\":\"$ROOM_CODE\",\"playerId\":\"$NON_ACTOR_ID\",\"guess\":\"$FUZZY_GUESS\"}")
  echo "$CLOSE_RESP"
  CLOSE_VAL=$(json_get "$CLOSE_RESP" "close")
  CLOSE_CORRECT_VAL=$(json_get "$CLOSE_RESP" "correct")
  if { [ "$CLOSE_VAL" != "True" ] && [ "$CLOSE_VAL" != "true" ]; } || { [ "$CLOSE_CORRECT_VAL" = "True" ] || [ "$CLOSE_CORRECT_VAL" = "true" ]; }; then
    fail "expected close:true, correct:false for fuzzy guess, got: $CLOSE_RESP"
  fi
  pass "fuzzy guess correctly reported as close:true, correct:false"
else
  echo "title too short for fuzzy test (< 6 chars normalised), skipping close check"
fi

echo "== guesser sends the exact title, expect correct:true =="
CORRECT_RESP=$(curl -s -X POST "$BASE_URL/api/guess" \
  -H "Content-Type: application/json" \
  -d "{\"roomCode\":\"$ROOM_CODE\",\"playerId\":\"$NON_ACTOR_ID\",\"guess\":\"$PROMPT_TITLE\"}")
echo "$CORRECT_RESP"
CORRECT_VAL=$(json_get "$CORRECT_RESP" "correct")
if [ "$CORRECT_VAL" != "True" ] && [ "$CORRECT_VAL" != "true" ]; then
  fail "expected correct:true for exact guess, got: $CORRECT_RESP"
fi
pass "exact guess accepted as correct"

echo "== verify next round started (actor rotates or stays, but round advanced) =="
sleep 1
NEXT_HOST_WORD_STATUS=$(curl -s -o /tmp/next_host_word.json -w "%{http_code}" \
  "$BASE_URL/api/rooms/word?roomCode=$ROOM_CODE&playerId=$HOST_ID")
NEXT_GUESSER_WORD_STATUS=$(curl -s -o /tmp/next_guesser_word.json -w "%{http_code}" \
  "$BASE_URL/api/rooms/word?roomCode=$ROOM_CODE&playerId=$GUESSER_ID")

if [ "$NEXT_HOST_WORD_STATUS" = "200" ]; then
  NEXT_ACTOR_JSON=$(cat /tmp/next_host_word.json)
elif [ "$NEXT_GUESSER_WORD_STATUS" = "200" ]; then
  NEXT_ACTOR_JSON=$(cat /tmp/next_guesser_word.json)
else
  fail "expected a new active round with exactly one actor able to fetch the word (game may have ended if round limit reached), host=$NEXT_HOST_WORD_STATUS guesser=$NEXT_GUESSER_WORD_STATUS"
fi

NEXT_PROMPT_TITLE=$(json_get_nested "$NEXT_ACTOR_JSON" "prompt" "title")
if [ -z "$NEXT_PROMPT_TITLE" ]; then
  fail "expected next round's actor word response to include a prompt title"
fi
pass "next round started with a new prompt: $NEXT_PROMPT_TITLE"

echo ""
echo "All charades smoke tests passed."
