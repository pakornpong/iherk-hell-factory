#!/bin/bash
# Fail-silent lifecycle telemetry. Send only the fields used by Hell Factory.
URL="${HELL_FACTORY_URL:-http://127.0.0.1:7140}/api/events"
jq_bin=$(command -v jq)
if [ -z "$jq_bin" ]; then
  for candidate in /opt/homebrew/bin/jq /usr/local/bin/jq; do
    if [ -x "$candidate" ]; then
      jq_bin="$candidate"
      break
    fi
  done
fi
[ -n "$jq_bin" ] || exit 0

"$jq_bin" -c '
  ({
    SessionStart:"session_start",
    UserPromptSubmit:"prompt_submit",
    PreToolUse:"tool_start",
    PostToolUse:"tool_end",
    PermissionRequest:"waiting_user",
    SubagentStart:"subagent_start",
    SubagentStop:"subagent_stop",
    Stop:"turn_stop",
    Interrupt:"turn_stop",
    SessionEnd:"session_end"
  }[.hook_event_name]) as $event
  | def has_text: type == "string" and length > 0;
  select($event and (.session_id | has_text) and (.cwd | has_text))
  | {provider:"codex", source:"codex", sessionId:.session_id, projectPath:.cwd, eventType:$event}
    + (if (.tool_name | has_text) then {toolName:(.tool_name | .[:128])} else {} end)
    + (if (.agent_id | has_text) then {agentId:.agent_id} else {} end)
' 2>/dev/null |
while IFS= read -r payload; do
  curl -sS -o /dev/null --max-time 1 -X POST -H 'Content-Type: application/json' --data-binary "$payload" "$URL" 2>/dev/null || true
done

exit 0
