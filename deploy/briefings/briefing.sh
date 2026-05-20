#!/usr/bin/env bash
# Morning + evening household briefing. Replaces openclaw `daily-briefing`
# and `faber-winddown` agentic crons. Gathers facts locally, generates the
# narrative via the local llama-server, and pushes via HA Companion.
#
# Usage: briefing.sh morning|evening
set -euo pipefail

MODE="${1:-}"
case "$MODE" in
  morning|evening) ;;
  *) echo "usage: $0 morning|evening" >&2; exit 2 ;;
esac

ENV_FILE="${BRIEFINGS_ENV:-/home/faber/.config/briefings.env}"
# shellcheck disable=SC1090
[ -r "$ENV_FILE" ] && set -a && . "$ENV_FILE" && set +a

: "${HA_BASE_URL:?HA_BASE_URL required}"
: "${HA_TOKEN_FILE:?HA_TOKEN_FILE required}"
: "${NOTIFY_SERVICE:?NOTIFY_SERVICE required}"
: "${LLAMA_BASE_URL:?LLAMA_BASE_URL required}"
: "${BRIEFING_MODEL:=gemma4-26b-heretic-128k}"
: "${GOG_KEYRING_PASSWORD:=openclaw}"
: "${GOG_ACCOUNT:=faberalarcon1@gmail.com}"
: "${MEMORY_DIR:=/home/faber/.openclaw/workspace/memory}"
: "${BACKUP_LOG:=/var/log/bristoe-backup/backup.log}"
: "${WEATHER_LAT:=39.6579}"
: "${WEATHER_LON:=-77.1758}"

HA_TOKEN="$(tr -d '\n\r' < "$HA_TOKEN_FILE")"

# --- helpers ---
log() { printf '[briefing:%s] %s\n' "$MODE" "$*" >&2; }

fetch_weather() {
  # Today + tomorrow conditions/high/low/precip.
  local url
  url="https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}"
  url+="&current=temperature_2m,weathercode,windspeed_10m,precipitation"
  url+="&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode"
  url+="&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=2&timezone=America%2FNew_York"
  curl -s --max-time 10 "$url" 2>/dev/null || echo '{}'
}

fetch_calendar() {
  local from to
  from="$1"
  to="$2"
  timeout 20 env GOG_KEYRING_PASSWORD="$GOG_KEYRING_PASSWORD" GOG_ACCOUNT="$GOG_ACCOUNT" \
    gog calendar events primary --from "$from" --to "$to" --json 2>/dev/null \
    || echo '{"events":[],"error":"calendar fetch failed"}'
}

fetch_gmail() {
  timeout 20 env GOG_KEYRING_PASSWORD="$GOG_KEYRING_PASSWORD" GOG_ACCOUNT="$GOG_ACCOUNT" \
    gog gmail search "is:unread is:inbox newer_than:1d" --max 5 --json 2>/dev/null \
    || echo '{"threads":[],"error":"gmail fetch failed"}'
}

read_memory() {
  local day="$1"
  local path="${MEMORY_DIR}/${day}.md"
  [ -r "$path" ] && head -c 4000 "$path" || true
}

backup_status() {
  # Last "Success" or "Failed" line from the backup log.
  [ -r "$BACKUP_LOG" ] || { echo "backup log missing"; return; }
  tail -n 200 "$BACKUP_LOG" 2>/dev/null \
    | grep -E "^\[.*\] \[(daily|weekly|monthly|quarterly)\] (Success|Failure|Failed|Pruning|Starting)" \
    | tail -n 8 \
    || echo "no recent backup entries"
}

# --- collect dates ---
TODAY="$(date +%Y-%m-%d)"
TOMORROW="$(date -d '+1 day' +%Y-%m-%d)"
TODAY_UTC="$(date -u +%Y-%m-%dT00:00:00Z)"
TOMORROW_UTC="$(date -u -d '+1 day' +%Y-%m-%dT00:00:00Z)"
DAY_AFTER_UTC="$(date -u -d '+2 days' +%Y-%m-%dT00:00:00Z)"
WEEKDAY="$(date '+%A')"
HUMAN_DATE="$(date '+%A, %B %-d, %Y')"

# --- collect facts ---
log "collecting facts"
WEATHER_JSON="$(fetch_weather)"
BACKUP_STATUS="$(backup_status)"

if [ "$MODE" = "morning" ]; then
  CAL_JSON="$(fetch_calendar "$TODAY_UTC" "$DAY_AFTER_UTC")"
  GMAIL_JSON="$(fetch_gmail)"
  MEM_TODAY="$(read_memory "$TODAY")"
  MEM_NEXT=""
  SYSTEM_PROMPT=$(cat <<'PROMPT'
You are Hank, Faber's home assistant, writing his morning briefing. Tone: warm, dry, observational — concise and useful, not chatty. Use only the structured facts I give you in the user message. Include in order:
1) A warm one-line greeting that names the day of the week and date.
2) Today's weather (current temp, conditions, high/low, rain chance).
3) Tomorrow's weather outlook (high/low, conditions, rain chance).
4) Today's and tomorrow's calendar — list each event by time + title, skip if none.
5) Notable unread emails (1-2 lines each, skip newsletters/promotions). Say inbox is clear if empty.
6) Backup status — one short sentence.
7) Anything worth flagging from today's memory notes.
Sign off "— Hank 🏠". No emojis except that one. No preamble. Plain text, fits a phone push.
PROMPT
)
else
  # evening: tomorrow-leaning
  CAL_JSON="$(fetch_calendar "$TOMORROW_UTC" "$DAY_AFTER_UTC")"
  GMAIL_JSON="$(fetch_gmail)"
  MEM_TODAY="$(read_memory "$TODAY")"
  MEM_NEXT=""
  SYSTEM_PROMPT=$(cat <<'PROMPT'
You are Hank, Faber's home assistant, writing his evening winddown. Address him only as "Faber". Tone: warm, calm, personal — like the close of a long day. Use only the structured facts I give you in the user message. Include in order:
1) A warm evening greeting with today's date.
2) Notable developments from today (from the memory notes if present).
3) A brief overnight + tomorrow weather outlook (high/low, conditions, rain chance).
4) Tomorrow's calendar — list each event by time + title, skip if none.
5) Important unread emails received today — flag them briefly, skip newsletters/promotions. Say inbox is clear if empty.
6) Backup status — one short sentence.
7) Anything worth flagging for tomorrow.
Sign off "— Hank 🏠". No emojis except that one. No preamble. Plain text, fits a phone push.
PROMPT
)
fi

# --- build user prompt JSON ---
FACTS_JSON="$(MODE="$MODE" HUMAN_DATE="$HUMAN_DATE" WEEKDAY="$WEEKDAY" \
  TODAY="$TODAY" TOMORROW="$TOMORROW" \
  WEATHER_JSON="$WEATHER_JSON" CAL_JSON="$CAL_JSON" GMAIL_JSON="$GMAIL_JSON" \
  MEM_TODAY="$MEM_TODAY" BACKUP_STATUS="$BACKUP_STATUS" \
  python3 -c '
import os, json
def parse(v, default):
    try:
        return json.loads(v) if v.strip() else default
    except Exception:
        return default
print(json.dumps({
    "mode": os.environ["MODE"],
    "date": os.environ["HUMAN_DATE"],
    "weekday": os.environ["WEEKDAY"],
    "today": os.environ["TODAY"],
    "tomorrow": os.environ["TOMORROW"],
    "weather": parse(os.environ["WEATHER_JSON"], {}),
    "calendar": parse(os.environ["CAL_JSON"], {"events": []}),
    "gmail": parse(os.environ["GMAIL_JSON"], {"threads": []}),
    "memory_today": os.environ["MEM_TODAY"],
    "backup": os.environ["BACKUP_STATUS"],
}))
'
)"

# --- LLM call (one retry on 5xx for llama autoload race) ---
log "calling LLM model=$BRIEFING_MODEL"
LLM_REQ="$(BRIEFING_MODEL="$BRIEFING_MODEL" SYSTEM_PROMPT="$SYSTEM_PROMPT" \
  FACTS_JSON="$FACTS_JSON" \
  python3 -c '
import os, json
print(json.dumps({
    "model": os.environ["BRIEFING_MODEL"],
    "max_tokens": 600,
    "temperature": 0.7,
    "messages": [
        {"role": "system", "content": os.environ["SYSTEM_PROMPT"]},
        {"role": "user", "content": os.environ["FACTS_JSON"]},
    ],
    "chat_template_kwargs": {"enable_thinking": False},
}))
'
)"

call_llm() {
  curl -s --max-time 90 -X POST \
    -H "Content-Type: application/json" \
    -d "$LLM_REQ" \
    "${LLAMA_BASE_URL%/}/v1/chat/completions"
}

extract_narrative() {
  python3 -c '
import sys, json
try:
    d = json.loads(sys.stdin.read())
    print((d.get("choices") or [{}])[0].get("message", {}).get("content", "") or "")
except Exception:
    pass
'
}

LLM_RAW="$(call_llm)"
NARRATIVE="$(printf '%s' "$LLM_RAW" | extract_narrative)"

if [ -z "$NARRATIVE" ]; then
  log "LLM returned empty narrative on first attempt, retrying in 5s"
  sleep 5
  LLM_RAW="$(call_llm)"
  NARRATIVE="$(printf '%s' "$LLM_RAW" | extract_narrative)"
fi

# Strip leaked <think>...</think> blocks defensively.
NARRATIVE="$(printf '%s' "$NARRATIVE" | sed -E 's|<think>.*</think>||g' | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"

if [ -z "$NARRATIVE" ]; then
  log "LLM produced no narrative"
  printf '%s\n' "$LLM_RAW" >&2
  exit 1
fi

log "narrative length=${#NARRATIVE} chars"
[ "${BRIEFING_DEBUG:-0}" = "1" ] && printf -- '----- narrative -----\n%s\n---------------------\n' "$NARRATIVE" >&2

# --- push via HA notify ---
TITLE="21 Bristoe — $([ "$MODE" = "morning" ] && echo "Morning briefing" || echo "Evening winddown")"
PUSH_REQ="$(TITLE="$TITLE" NARRATIVE="$NARRATIVE" python3 -c '
import os, json
print(json.dumps({"title": os.environ["TITLE"], "message": os.environ["NARRATIVE"]}))
')"

log "pushing to HA notify/$NOTIFY_SERVICE"
PUSH_RES="$(curl -s --max-time 15 -o /tmp/_briefing_push.out -w '%{http_code}' \
  -X POST \
  -H "Authorization: Bearer $HA_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PUSH_REQ" \
  "${HA_BASE_URL%/}/api/services/notify/${NOTIFY_SERVICE}")"

if [ "$PUSH_RES" != "200" ]; then
  log "HA notify failed http=$PUSH_RES"
  cat /tmp/_briefing_push.out >&2
  exit 1
fi

log "done"
