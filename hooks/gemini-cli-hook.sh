#!/bin/bash
# Fail-silent Gemini CLI telemetry hook for iherk-hell-factory
URL="${HELL_FACTORY_URL:-http://127.0.0.1:7140}/api/events"
command -v jq >/dev/null 2>&1 || exit 0
input=$(cat)
[ -z "$input" ] && exit 0

event=$(jq -r '.hook_event_name // .event // empty' <<<"$input" 2>/dev/null)
session_id=$(jq -r '.session_id // "gemini-cli-default"' <<<"$input" 2>/dev/null)
cwd=$(jq -r '.cwd // empty' <<<"$input" 2>/dev/null)
[ -z "$cwd" ] && cwd="$PWD"
tool=$(jq -r '.tool_name // .tool // empty' <<<"$input" 2>/dev/null)
msg=$(jq -r '.message // empty' <<<"$input" 2>/dev/null)

case "$event" in
  SessionStart)                   ev_type="session_start"; detail="Gemini CLI started" ;;
  BeforeAgent|UserPromptSubmit)   ev_type="prompt_submit"; detail="New Gemini prompt" ;;
  BeforeTool|PreToolUse)          ev_type="tool_start";    detail="Gemini · ${tool:-tool}" ;;
  AfterTool|PostToolUse)          ev_type="tool_end";      detail="Finished ${tool:-tool}" ;;
  Notification)                   ev_type="waiting_user";  detail="${msg:-Waiting for input}" ;;
  AfterAgent|Stop)                ev_type="turn_stop";     detail="Gemini finished turn" ;;
  SessionEnd)                     ev_type="session_end";   detail="Gemini session ended" ;;
  *) exit 0 ;;
esac

jq -n \
  --arg provider "gemini" \
  --arg source "gemini-cli" \
  --arg sessionId "$session_id" \
  --arg projectPath "$cwd" \
  --arg eventType "$ev_type" \
  --arg toolName "$tool" \
  --arg detail "$detail" \
  '{provider:$provider, source:$source, sessionId:$sessionId, projectPath:$projectPath, eventType:$eventType, detail:$detail}
   + (if $toolName != "" then {toolName:$toolName} else {} end)' 2>/dev/null |
  curl -sS -o /dev/null --max-time 1 -X POST -H 'Content-Type: application/json' -d @- "$URL" 2>/dev/null || true

exit 0
