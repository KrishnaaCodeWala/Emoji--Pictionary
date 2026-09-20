#!/usr/bin/env bash
# Smoke test for the Canvas Relay game mode API. BASE_URL env overrides host.
# Requires: `npm run dev` running locally and migration 003_relay.sql applied.
#
# Usage: bash scripts/smoke-relay.sh

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

echo "== join player 2 =="
JOIN2_RESP=$(curl -s -X POST "$BASE_URL/api/rooms/join" \
  -H "Content-Type: application/json" \
  -d "{\"roomCode\":\"$ROOM_CODE\",\"nickname\":\"P2\"}")
echo "$JOIN2_RESP"
P2=$(json_get "$JOIN2_RESP" "playerId")
if [ -z "$P2" ]; then
  fail "join (p2) did not return playerId"
fi
pass "p2 joined: $P2"

echo "== join player 3 =="
JOIN3_RESP=$(curl -s -X POST "$BASE_URL/api/rooms/join" \
  -H "Content-Type: application/json" \
  -d "{\"roomCode\":\"$ROOM_CODE\",\"nickname\":\"P3\"}")
echo "$JOIN3_RESP"
P3=$(json_get "$JOIN3_RESP" "playerId")
if [ -z "$P3" ]; then
  fail "join (p3) did not return playerId"
fi
pass "p3 joined: $P3"

N=3

echo "== set mode to relay with quick timers =="
MODE_STATUS=$(curl -s -o /tmp/relay_mode_body.json -w "%{http_code}" -X POST "$BASE_URL/api/rooms/mode" \
  -H "Content-Type: application/json" \
  -d "{\"roomCode\":\"$ROOM_CODE\",\"playerId\":\"$P1\",\"mode\":\"relay\",\"settings\":{\"relayTimers\":{\"write\":15,\"draw\":15,\"guess\":15}}}")
cat /tmp/relay_mode_body.json
if [ "$MODE_STATUS" != "200" ]; then
  fail "set mode expected 200, got $MODE_STATUS"
fi
pass "mode set to relay"

echo "== start game =="
START_STATUS=$(curl -s -o /tmp/relay_start_body.json -w "%{http_code}" -X POST "$BASE_URL/api/rooms/start" \
  -H "Content-Type: application/json" \
  -d "{\"roomCode\":\"$ROOM_CODE\",\"playerId\":\"$P1\"}")
cat /tmp/relay_start_body.json
if [ "$START_STATUS" != "200" ]; then
  fail "start expected 200, got $START_STATUS"
fi
pass "relay started"

# ---- Step 0: write ----
echo "== step 0 (write): each player fetches task, expect phase=write step=0 input=null =="
for PID in "$P1" "$P2" "$P3"; do
  TASK_RESP=$(curl -s "$BASE_URL/api/relay/task?roomCode=$ROOM_CODE&playerId=$PID")
  echo "$TASK_RESP"
  PHASE=$(json_get "$TASK_RESP" "phase")
  STEP=$(json_get "$TASK_RESP" "step")
  INPUT=$(json_get "$TASK_RESP" "input")
  if [ "$PHASE" != "write" ]; then fail "expected phase=write for $PID, got $PHASE"; fi
  if [ "$STEP" != "0" ]; then fail "expected step=0 for $PID, got $STEP"; fi
  if [ -n "$INPUT" ] && [ "$INPUT" != "None" ]; then fail "expected input=null at step 0 for $PID, got $INPUT"; fi
done
pass "all players see write task at step 0 with no input"

echo "== step 0: each player submits a phrase =="
i=1
for PID in "$P1" "$P2" "$P3"; do
  SUBMIT_STATUS=$(curl -s -o /tmp/relay_submit0_$i.json -w "%{http_code}" -X POST "$BASE_URL/api/relay/submit" \
    -H "Content-Type: application/json" \
    -d "{\"roomCode\":\"$ROOM_CODE\",\"playerId\":\"$PID\",\"step\":0,\"content\":\"a cat stealing pizza $i\"}")
  cat /tmp/relay_submit0_$i.json
  if [ "$SUBMIT_STATUS" != "200" ]; then fail "submit step0 for $PID expected 200, got $SUBMIT_STATUS"; fi
  i=$((i + 1))
done
pass "all players submitted step 0 phrases"

# ---- Step 1: draw ----
echo "== step 1 (draw): each player fetches task, expect phase=draw step=1 input=previous phrase =="
for PID in "$P1" "$P2" "$P3"; do
  TASK_RESP=$(curl -s "$BASE_URL/api/relay/task?roomCode=$ROOM_CODE&playerId=$PID")
  echo "$TASK_RESP"
  PHASE=$(json_get "$TASK_RESP" "phase")
  STEP=$(json_get "$TASK_RESP" "step")
  INPUT_CONTENT=$(json_get_nested "$TASK_RESP" "input" "content")
  if [ "$PHASE" != "draw" ]; then fail "expected phase=draw for $PID, got $PHASE"; fi
  if [ "$STEP" != "1" ]; then fail "expected step=1 for $PID, got $STEP"; fi
  if [ -z "$INPUT_CONTENT" ]; then fail "expected non-empty input content at step 1 for $PID"; fi
done
pass "all players see draw task at step 1 with a phrase as input"

echo "== step 1: each player submits emoji =="
for PID in "$P1" "$P2" "$P3"; do
  SUBMIT_STATUS=$(curl -s -o /tmp/relay_submit1.json -w "%{http_code}" -X POST "$BASE_URL/api/relay/submit" \
    -H "Content-Type: application/json" \
    -d "{\"roomCode\":\"$ROOM_CODE\",\"playerId\":\"$PID\",\"step\":1,\"content\":\"🍕🐱🚀\"}")
  cat /tmp/relay_submit1.json
  if [ "$SUBMIT_STATUS" != "200" ]; then fail "submit step1 for $PID expected 200, got $SUBMIT_STATUS"; fi
done
pass "all players submitted step 1 drawings"

# ---- Step 2: guess ----
echo "== step 2 (guess): each player fetches task, expect phase=guess step=2 input=previous emoji =="
for PID in "$P1" "$P2" "$P3"; do
  TASK_RESP=$(curl -s "$BASE_URL/api/relay/task?roomCode=$ROOM_CODE&playerId=$PID")
  echo "$TASK_RESP"
  PHASE=$(json_get "$TASK_RESP" "phase")
  STEP=$(json_get "$TASK_RESP" "step")
  INPUT_CONTENT=$(json_get_nested "$TASK_RESP" "input" "content")
  if [ "$PHASE" != "guess" ]; then fail "expected phase=guess for $PID, got $PHASE"; fi
  if [ "$STEP" != "2" ]; then fail "expected step=2 for $PID, got $STEP"; fi
  if [ -z "$INPUT_CONTENT" ]; then fail "expected non-empty input content at step 2 for $PID"; fi
done
pass "all players see guess task at step 2 with a drawing as input"

echo "== step 2: each player submits a guess =="
for PID in "$P1" "$P2" "$P3"; do
  SUBMIT_STATUS=$(curl -s -o /tmp/relay_submit2.json -w "%{http_code}" -X POST "$BASE_URL/api/relay/submit" \
    -H "Content-Type: application/json" \
    -d "{\"roomCode\":\"$ROOM_CODE\",\"playerId\":\"$PID\",\"step\":2,\"content\":\"a cat riding a rocket\"}")
  cat /tmp/relay_submit2.json
  if [ "$SUBMIT_STATUS" != "200" ]; then fail "submit step2 for $PID expected 200, got $SUBMIT_STATUS"; fi
done
pass "all players submitted step 2 guesses (n=3, so this completes every chain)"

# ---- Album ----
echo "== album: any player can view chain 0, revealed up to step 0 =="
ALBUM_RESP=$(curl -s "$BASE_URL/api/relay/album?roomCode=$ROOM_CODE&playerId=$P2")
echo "$ALBUM_RESP"
REVEALED_UP_TO=$(json_get "$ALBUM_RESP" "revealedUpTo")
TOTAL_CHAINS=$(json_get "$ALBUM_RESP" "totalChains")
TOTAL_STEPS=$(json_get "$ALBUM_RESP" "totalSteps")
if [ "$REVEALED_UP_TO" != "0" ]; then fail "expected revealedUpTo=0 at album start, got $REVEALED_UP_TO"; fi
if [ "$TOTAL_CHAINS" != "$N" ]; then fail "expected totalChains=$N, got $TOTAL_CHAINS"; fi
if [ "$TOTAL_STEPS" != "$N" ]; then fail "expected totalSteps=$N, got $TOTAL_STEPS"; fi
pass "album shows chain 0 with exactly 1 revealed step"

echo "== non-host cannot advance the album =="
NONHOST_ADVANCE_STATUS=$(curl -s -o /tmp/relay_nonhost_advance.json -w "%{http_code}" -X POST "$BASE_URL/api/relay/album-advance" \
  -H "Content-Type: application/json" \
  -d "{\"roomCode\":\"$ROOM_CODE\",\"playerId\":\"$P2\"}")
cat /tmp/relay_nonhost_advance.json
if [ "$NONHOST_ADVANCE_STATUS" != "403" ]; then
  fail "expected 403 for non-host album-advance, got $NONHOST_ADVANCE_STATUS"
fi
pass "non-host correctly forbidden from advancing the album"

echo "== host pages through the album (n*n = $((N * N)) advances total) =="
TOTAL_ADVANCES=$((N * N))
for ((i = 1; i <= TOTAL_ADVANCES; i++)); do
  ADV_STATUS=$(curl -s -o /tmp/relay_advance_$i.json -w "%{http_code}" -X POST "$BASE_URL/api/relay/album-advance" \
    -H "Content-Type: application/json" \
    -d "{\"roomCode\":\"$ROOM_CODE\",\"playerId\":\"$P1\"}")
  if [ "$ADV_STATUS" != "200" ]; then
    cat /tmp/relay_advance_$i.json
    fail "album-advance #$i expected 200, got $ADV_STATUS"
  fi
done
pass "host advanced the album $TOTAL_ADVANCES times"

echo "== verify game finished (join now returns 409) =="
JOIN_AFTER_RESP=$(curl -s -o /tmp/relay_join_after.json -w "%{http_code}" -X POST "$BASE_URL/api/rooms/join" \
  -H "Content-Type: application/json" \
  -d "{\"roomCode\":\"$ROOM_CODE\",\"nickname\":\"Late\"}")
if [ "$JOIN_AFTER_RESP" != "409" ]; then
  cat /tmp/relay_join_after.json
  fail "expected 409 joining a finished room, got $JOIN_AFTER_RESP"
fi
pass "room is finished (join correctly rejected with 409)"

echo ""
echo "All relay smoke tests passed."
