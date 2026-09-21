#!/bin/bash
# PostToolUse on Skill: marks gate satisfied + records loaded skill.

INPUT=$(cat)

SESSION_ID=$(printf '%s' "$INPUT" | grep -o '"session_id":"[^"]*"' | head -1 | sed 's/"session_id":"//; s/"$//')
if [ -z "$SESSION_ID" ]; then
  exit 0
fi

# Keyed exactly as the gate keys it. A subagent carries the parent's
# session_id, so both scripts fall back to agent_id when one is present — and
# they must agree, or a loaded skill writes a marker the gate never looks for
# and every edit is denied forever.
AGENT_ID=$(printf '%s' "$INPUT" | grep -o '"agent_id":"[^"]*"' | head -1 | sed 's/"agent_id":"//; s/"$//')
KEY="$SESSION_ID"
if [ -n "$AGENT_ID" ]; then
  KEY=$(printf '%s' "$AGENT_ID" | tr -cd 'A-Za-z0-9_-')
fi

touch "/tmp/claude-skill-gate-$KEY"

SKILL_NAME=$(printf '%s' "$INPUT" | grep -o '"skill":"[^"]*"' | head -1 | sed 's/"skill":"//; s/"$//')
if [ -n "$SKILL_NAME" ]; then
  # Sanitize: only allow [A-Za-z0-9_-] in the marker filename.
  SAFE_NAME=$(printf '%s' "$SKILL_NAME" | tr -cd 'A-Za-z0-9_-')
  if [ -n "$SAFE_NAME" ]; then
    touch "/tmp/claude-skill-loaded-$KEY-$SAFE_NAME"
    # The ack path holds a key the model cannot know, so without this line its
    # first write is always denied just to learn it.
    if [ ! -f "/tmp/claude-skill-acked-$KEY-$SAFE_NAME" ]; then
      CTX="Skill $SAFE_NAME is loaded. Before your next code write, say which of its rules bear on that file, or that it does not apply. Then run this Bash call, or the write is blocked:\\n  touch /tmp/claude-skill-acked-$KEY-$SAFE_NAME\\nLoaded several skills? Put every path in one touch."
      printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"%s"}}\n' "$CTX"
    fi
  fi
fi

exit 0
