#!/bin/bash
# Fail-silent Antigravity lifecycle hook for iherk-hell-factory
URL="${HELL_FACTORY_URL:-http://127.0.0.1:7140}/api/events"
if ! command -v jq >/dev/null 2>&1; then
  echo '{}'
  exit 0
fi

input=$(cat)
if [ -n "$input" ]; then
  event=$(jq -r '.hookEventName // empty' <<<"$input" 2>/dev/null)
  conv_id=$(jq -r '.conversationId // "antigravity-default"' <<<"$input" 2>/dev/null)
  cwd=$(jq -r '.workspacePaths[0] // .cwd // empty' <<<"$input" 2>/dev/null)
  [ -z "$cwd" ] && cwd="$PWD"
  tool=$(jq -r '.toolName // .tool // empty' <<<"$input" 2>/dev/null)

  case "$event" in
    SessionStart)    ev_type="session_start"; detail="Antigravity session" ;;
    PreInvocation)   ev_type="prompt_submit"; detail="Antigravity thinking" ;;
    PreToolUse)      ev_type="tool_start";    detail="Antigravity · ${tool:-tool}" ;;
    PostToolUse)     ev_type="tool_end";      detail="Finished ${tool:-tool}" ;;
    PostInvocation)  ev_type="tool_end";      detail="Completed step" ;;
    Stop)            ev_type="turn_stop";     detail="Antigravity finished" ;;
    *)               ev_type="" ;;
  esac

  if [ -n "$ev_type" ]; then
    jq -n \
      --arg provider "gemini" \
      --arg source "antigravity" \
      --arg sessionId "$conv_id" \
      --arg projectPath "$cwd" \
      --arg eventType "$ev_type" \
      --arg toolName "$tool" \
      --arg detail "$detail" \
      '{provider:$provider, source:$source, sessionId:$sessionId, projectPath:$projectPath, eventType:$eventType, detail:$detail}
       + (if $toolName != "" then {toolName:$toolName} else {} end)' 2>/dev/null |
      curl -sS -o /dev/null --max-time 1 -X POST -H 'Content-Type: application/json' -d @- "$URL" 2>/dev/null || true
  fi
fi

# Antigravity hook contract expects JSON object on stdout
echo '{}'
exit 0
