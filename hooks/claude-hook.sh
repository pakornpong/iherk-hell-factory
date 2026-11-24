#!/bin/bash
# Fail-silent Claude Code telemetry hook for iherk-hell-factory
URL="${HELL_FACTORY_URL:-http://127.0.0.1:7140}/api/events"
command -v jq >/dev/null 2>&1 || exit 0
input=$(cat)
[ -z "$input" ] && exit 0

event=$(jq -r '.hook_event_name // empty' <<<"$input" 2>/dev/null)
session_id=$(jq -r '.session_id // "claude-default"' <<<"$input" 2>/dev/null)
cwd=$(jq -r '.cwd // empty' <<<"$input" 2>/dev/null)
[ -z "$cwd" ] && cwd="$PWD"
tool=$(jq -r '.tool_name // empty' <<<"$input" 2>/dev/null)
agent_id=$(jq -r '.agent_id // empty' <<<"$input" 2>/dev/null)
agent_type=$(jq -r '.agent_type // empty' <<<"$input" 2>/dev/null)
msg=$(jq -r '.message // empty' <<<"$input" 2>/dev/null)

case "$event" in
  SessionStart)       ev_type="session_start";  detail="Claude started session" ;;
  UserPromptSubmit)   ev_type="prompt_submit";  detail="New prompt received" ;;
  PreToolUse)         ev_type="tool_start";     detail="Running ${tool:-tool}" ;;
  PostToolUse)        ev_type="tool_end";       detail="Finished ${tool:-tool}" ;;
  PostToolUseFailure) ev_type="tool_error";     detail="${tool:-Tool} failed" ;;
  SubagentStart)      ev_type="subagent_start"; detail="Subagent ${agent_type:-worker} joined" ;;
  SubagentStop)       ev_type="subagent_stop";  detail="Subagent completed" ;;
  Notification)       ev_type="waiting_user";   detail="${msg:-Needs your input}" ;;
  Stop)               ev_type="turn_stop";      detail="Finished turn" ;;
  SessionEnd)         ev_type="session_end";    detail="Session ended" ;;
  *) exit 0 ;;
esac

jq -n \
  --arg provider "claude" \
  --arg source "claude-code" \
  --arg sessionId "$session_id" \
  --arg projectPath "$cwd" \
  --arg eventType "$ev_type" \
  --arg toolName "$tool" \
  --arg agentId "$agent_id" \
  --arg agentRole "$agent_type" \
  --arg detail "$detail" \
  '{provider:$provider, source:$source, sessionId:$sessionId, projectPath:$projectPath, eventType:$eventType, detail:$detail}
   + (if $toolName != "" then {toolName:$toolName} else {} end)
   + (if $agentId != "" then {agentId:$agentId} else {} end)
   + (if $agentRole != "" then {agentRole:$agentRole} else {} end)' 2>/dev/null |
  curl -sS -o /dev/null --max-time 1 -X POST -H 'Content-Type: application/json' -d @- "$URL" 2>/dev/null || true

exit 0
