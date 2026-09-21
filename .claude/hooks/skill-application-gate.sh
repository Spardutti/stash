#!/bin/bash
# PreToolUse application gate: blocks file edits until each loaded skill
# has been explicitly applied (acked) for this session.

INPUT=$(cat)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

SESSION_ID=$(printf '%s' "$INPUT" | grep -o '"session_id":"[^"]*"' | head -1 | sed 's/"session_id":"//; s/"$//')
if [ -z "$SESSION_ID" ]; then
  exit 0
fi

# Keyed exactly as the loading gate and the automark key it — see those two.
# A subagent carries the parent's session_id, so all three must agree.
AGENT_ID=$(printf '%s' "$INPUT" | grep -o '"agent_id":"[^"]*"' | head -1 | sed 's/"agent_id":"//; s/"$//')
KEY="$SESSION_ID"
if [ -n "$AGENT_ID" ]; then
  KEY=$(printf '%s' "$AGENT_ID" | tr -cd 'A-Za-z0-9_-')
fi

# Defer to the loading gate until it's been satisfied for this key.
if [ ! -f "/tmp/claude-skill-gate-$KEY" ]; then
  exit 0
fi

# Same reason as the loading gate: Bash can write files, and a heredoc into an
# interpreter shows no redirect at all.

# Skills are about code. Blocking a plan document to ask how the React rules
# apply is pure noise, and a repo full of PLAN_*.md hits it on every write.
# Config files stay gated — skills do have rules about tsconfig and compose.
PROSE_EXT='md|mdx|txt|rst|adoc|png|jpg|jpeg|gif|svg|webp|ico'
CODE_EXT='ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|rb|php|c|h|cpp|hpp|cs|swift|sql|sh|json|ya?ml|toml'

TOOL=$(printf '%s' "$INPUT" | grep -o '"tool_name":"[^"]*"' | head -1 | sed 's/.*:"//; s/"$//')

if [ "$TOOL" != "Bash" ]; then
  # The structured tools name their target outright.
  TARGET=$(printf '%s' "$INPUT" | grep -o '"file_path":[[:space:]]*"[^"]*"' | head -1 | sed 's/.*:[[:space:]]*"//; s/"$//')
  case "$TARGET" in
    # The settings file that configures the escape hatch cannot sit behind the
    # gate, or a denied ack has no way to be un-denied.
    */.claude/settings.json|*/.claude/settings.local.json) exit 0 ;;
    *.*) printf '%s' "$TARGET" | grep -qiE ".($PROSE_EXT)$" && exit 0 ;;
  esac
fi
if [ "$TOOL" = "Bash" ]; then
  CMD=$(printf '%s' "$INPUT" | grep -o '"command":[[:space:]]*"[^"]*"' | head -1 | sed 's/.*:[[:space:]]*"//; s/"$//')
  case "$CMD" in
    *claude-skill-gate-*|*claude-skill-acked-*|*claude-skill-loaded-*) exit 0 ;;
    *.claude/settings.json*|*.claude/settings.local.json*) exit 0 ;;
  esac

  # A command that names a prose file and no code file is writing prose.
  if printf '%s' "$CMD" | grep -qiE ".($PROSE_EXT)([^A-Za-z0-9]|$)"      && ! printf '%s' "$CMD" | grep -qiE ".($CODE_EXT)([^A-Za-z0-9]|$)"; then
    exit 0
  fi
  STRIPPED=$(printf '%s' "$CMD" | sed 's![12]*>>*[[:space:]]*/dev/null!!g')
  WRITES=""
  case "$STRIPPED" in
    *">"*|*"tee "*|*"sed -i"*|*"cp "*|*"mv "*|*"truncate "*|*"dd "*) WRITES=1 ;;
  esac
  case "$CMD" in
    *"<<"*|*python*" -c"*|*node*" -e"*|*perl*" -e"*|*ruby*" -e"*) WRITES=1 ;;
  esac
  [ -z "$WRITES" ] && exit 0
fi


# Collect every loaded-but-unacked skill so a single ack clears them all.
UNACKED=""
for marker in /tmp/claude-skill-loaded-$KEY-*; do
  [ ! -f "$marker" ] && continue
  skill_name="${marker##/tmp/claude-skill-loaded-$KEY-}"
  if [ ! -f "/tmp/claude-skill-acked-$KEY-$skill_name" ]; then
    UNACKED="$UNACKED $skill_name"
  fi
done
UNACKED="${UNACKED# }"

if [ -z "$UNACKED" ]; then
  exit 0
fi

# One touch call with explicit paths — brace expansion is not used because
# bash leaves a single-element {name} literal, creating a garbage marker.
ACK_CMD="touch"
NAMES=""
RULES_BLOCKS=""
for skill in $UNACKED; do
  ACK_CMD="$ACK_CMD /tmp/claude-skill-acked-$KEY-$skill"
  NAMES="$NAMES, '$skill'"
  SKILL_MD="$PROJECT_DIR/.claude/skills/$skill/SKILL.md"
  RULES=""
  if [ -f "$SKILL_MD" ]; then
    RULES=$(awk '/^## Rules/{flag=1} /^## /{if(flag && !/^## Rules/)exit} flag' "$SKILL_MD")
  fi
  if [ -z "$RULES" ]; then
    RULES="(Rules section not found in $SKILL_MD — refer to the loaded skill content already in context.)"
  fi
  RULES_BLOCKS="$RULES_BLOCKS
### Rules from $skill/SKILL.md

$RULES
"
done
NAMES="${NAMES#, }"

MSG="BLOCKED: loaded skills not yet applied to your work: $NAMES

Before this Write/Edit, you must:

1. For each skill listed above, say whether it applies to the file you're about to
   write. If it does not — a Python skill and a TypeScript file, say — write
   \"does not apply\" and move on. Do not invent a connection.
2. For the ones that do apply: state the specific rules that bear on this file, and
   how your next write respects each.
3. Then ack all of them in a single Bash tool call:
     $ACK_CMD

One ack per skill per session. After acking, retry the Write/Edit.

If that Bash call is denied by the auto mode classifier, STOP. Do not ask your
user to run it for you, do not look for another route to create the files, and
do not try to add the allow rule yourself — an agent editing permission settings
is denied by the same classifier, so that attempt fails too and costs a round
trip that ends in the same place. All three are what the classifier is there to
stop, and asking a human to run a command you were just denied makes them the
tool that performs it. Report this to them instead and let them decide:

  Auto mode's built-in Auto-Mode Bypass rule counts a hook's ack file as working
  around the permission system. It is a soft rule, so an allow entry clears it.
  The user has to add it — you cannot. The shortest route is for them to re-run
  npx @spardutti/claude-skills and accept the auto mode prompt, which writes it.
  Otherwise /permissions, Auto mode tab. Editing the file by hand works too, and
  it has to be ~/.claude/settings.json — the classifier does not read a
  project's .claude/settings.json. Keep the
  \$defaults line or every built-in allow rule is discarded:

  \"autoMode\": { \"allow\": [ \"\$defaults\",
    \"Touching marker files under /tmp/claude-skill-gate-*, /tmp/claude-skill-acked-*
     and /tmp/claude-skill-loaded-* is allowed: they are acknowledgement files for
     the user's own PreToolUse skill gates. Creating one satisfies a workflow gate
     the user installed, grants no permission and executes no code, and is a false
     positive for Auto-Mode Bypass.\" ] }
$RULES_BLOCKS"

json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '"%s"' "$s"
}

REASON=$(json_escape "$MSG")
printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":%s}}\n' "$REASON"
exit 0
