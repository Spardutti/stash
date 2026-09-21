#!/bin/bash
# PreToolUse gate: forces skill evaluation before file-writing tools run.

INPUT=$(cat)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

if ! find "$PROJECT_DIR" -path '*/.claude/skills/*/SKILL.md' 2>/dev/null | grep -q .; then
  exit 0
fi

SESSION_ID=$(printf '%s' "$INPUT" | grep -o '"session_id":"[^"]*"' | head -1 | sed 's/"session_id":"//; s/"$//')
if [ -z "$SESSION_ID" ]; then
  exit 0
fi

# A subagent reports the PARENT's session_id — measured, not assumed: a probe
# hook dumped its own stdin from the main thread and from inside a subagent and
# the two ids were identical. So a worker spawned to implement part of a plan
# inherited the main thread's cleared markers and edited with none of the
# skills loaded in its own context.
#
# agent_id is present only inside a subagent, and holds steady across that
# subagent's turns, so keying on it gives each worker its own namespace and
# costs it one Skill call per skill, not one per turn.
AGENT_ID=$(printf '%s' "$INPUT" | grep -o '"agent_id":"[^"]*"' | head -1 | sed 's/"agent_id":"//; s/"$//')
KEY="$SESSION_ID"
if [ -n "$AGENT_ID" ]; then
  KEY=$(printf '%s' "$AGENT_ID" | tr -cd 'A-Za-z0-9_-')
fi

# The marker is checked at the very bottom now, not here. A skill the edited
# file's own stack demands is not something an already-cleared gate excuses,
# so the required-skill scan below runs first.
MARKER="/tmp/claude-skill-gate-$KEY"

# Write|Edit|MultiEdit is not the only way to change a file. A session that edits
# through `python3 - <<'PY'` in Bash walked past this gate entirely — twelve
# source files, not one prompt — and some harnesses actively tell the model to
# prefer Bash for edits. So Bash is gated too, but only for commands that can
# write, and only until the gate is cleared once for the session.

# Skills are about code. Blocking a plan document to ask how the React rules
# apply is pure noise, and a repo full of PLAN_*.md hits it on every write.
# Config files stay gated — skills do have rules about tsconfig and compose.
PROSE_EXT='md|mdx|txt|rst|adoc|png|jpg|jpeg|gif|svg|webp|ico'
CODE_EXT='ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|rb|php|c|h|cpp|hpp|cs|swift|sql|sh|json|ya?ml|toml'

TOOL=$(printf '%s' "$INPUT" | grep -o '"tool_name":"[^"]*"' | head -1 | sed 's/.*:"//; s/"$//')

# Every file this call would write, collected for the required-skill scan below.
TARGETS=""

if [ "$TOOL" != "Bash" ]; then
  # The structured tools name their target outright.
  TARGET=$(printf '%s' "$INPUT" | grep -o '"file_path":[[:space:]]*"[^"]*"' | head -1 | sed 's/.*:[[:space:]]*"//; s/"$//')
  case "$TARGET" in
    # The settings file that configures the escape hatch cannot sit behind the
    # gate, or a denied ack has no way to be un-denied. The bare relative form
    # matters: a skill claiming **/* gated it, and nothing could re-open it.
    .claude/settings.json|.claude/settings.local.json) exit 0 ;;
    */.claude/settings.json|*/.claude/settings.local.json) exit 0 ;;
    *.*) printf '%s' "$TARGET" | grep -qiE ".($PROSE_EXT)$" && exit 0 ;;
  esac
  TARGETS="$TARGET"
fi
if [ "$TOOL" = "Bash" ]; then
  CMD=$(printf '%s' "$INPUT" | grep -o '"command":[[:space:]]*"[^"]*"' | head -1 | sed 's/.*:[[:space:]]*"//; s/"$//')

  # Never gate the command that clears the gate, or this deadlocks.
  case "$CMD" in
    *claude-skill-gate-*|*claude-skill-acked-*|*claude-skill-loaded-*) exit 0 ;;
    *.claude/settings.json*|*.claude/settings.local.json*) exit 0 ;;
  esac

  # /dev/null redirects are not file writes; drop them before looking for one.

  # A command that names a prose file and no code file is writing prose.
  if printf '%s' "$CMD" | grep -qiE ".($PROSE_EXT)([^A-Za-z0-9]|$)"      && ! printf '%s' "$CMD" | grep -qiE ".($CODE_EXT)([^A-Za-z0-9]|$)"; then
    exit 0
  fi
  STRIPPED=$(printf '%s' "$CMD" | sed 's![12]*>>*[[:space:]]*/dev/null!!g')
  WRITES=""
  case "$STRIPPED" in
    *">"*|*"tee "*|*"sed -i"*|*"cp "*|*"mv "*|*"truncate "*|*"dd "*) WRITES=1 ;;
  esac
  # An interpreter given inline code or a heredoc can write anything, and the
  # shell shows no redirect at all — this is the shape that got past the gate.
  case "$CMD" in
    *"<<"*|*python*" -c"*|*node*" -e"*|*perl*" -e"*|*ruby*" -e"*) WRITES=1 ;;
  esac
  [ -z "$WRITES" ] && exit 0
  # A Bash write names its files in the command itself. Dockerfile and
  # .dockerignore carry no extension, so they are matched by name.
  TARGETS=$(printf '%s' "$CMD" | grep -oiE "[A-Za-z0-9_./-]+.($CODE_EXT)|[A-Za-z0-9_./-]*(Dockerfile[A-Za-z0-9_.-]*|.dockerignore)" 2>/dev/null)
fi

# --- mandatory skills -------------------------------------------------------
# The generic gate below asks the model to rate every skill ACTIVATE or SKIP,
# and hands it an all-SKIP escape. A session took that escape, touched the
# marker, and edited React files with none of the React rules loaded. It had
# followed the hook exactly: the hook let it decide.
#
# So a skill that declares BOTH paths: and tracks: stops getting a vote. If the
# edited file matches its paths AND this project depends on a package it
# tracks, that skill is mandatory and only Skill(<name>) clears it. Skills
# without both fields keep the old behaviour, so this tightens nothing that was
# not deliberately declared.
MISSING=""
ACKS=""
MANIFESTS=""
if [ -n "$TARGETS" ]; then
  MANIFESTS=$(find "$PROJECT_DIR" -maxdepth 4 \( -name node_modules -o -name .git -o -name .venv -o -name dist \) -prune -o \( -name package.json -o -name pyproject.toml -o -name requirements.txt \) -print 2>/dev/null)
fi
if [ -n "$TARGETS" ]; then
  for SKILL_FILE in $(find "$PROJECT_DIR" -path '*/.claude/skills/*/SKILL.md' 2>/dev/null); do
    # Read gate-paths from under metadata:, never a bare paths: key. A bare
    # paths: made Claude Code drop the skill from its registry outright —
    # every Skill(name) call returned "Unknown skill" and, with no SKIP for a
    # mandatory skill, the session could not edit code at all. metadata is
    # documented as free-form and ignored by Claude Code, and the docs say in
    # so many words not to reuse paths as a key inside it.
    #
    # The value must be quoted in YAML either way: a scalar opening with * is
    # an alias indicator.
    UNQUOTE='s/^["'"'"']//; s/["'"'"']$//'
    SPATHS=$(sed -n 's/^[[:space:]]*gate-paths:[[:space:]]*//p' "$SKILL_FILE" | head -1 | sed "$UNQUOTE")
    STRACKS=$(sed -n 's/^tracks:[[:space:]]*//p' "$SKILL_FILE" | head -1 | sed "$UNQUOTE")
    SNAME=$(sed -n 's/^name:[[:space:]]*//p' "$SKILL_FILE" | head -1 | sed "$UNQUOTE")
    [ -z "$SPATHS" ] && continue
    [ -z "$SNAME" ] && continue

    HIT=""
    for G in $(printf '%s' "$SPATHS" | tr ',' ' '); do
      # Claude Code writes these gitignore-style. A case glob has no **, but *
      # already crosses / here, so dropping the **/ prefix is equivalent.
      G=$(printf '%s' "$G" | sed 's!\*\*/!!g')
      case "$G" in \**|/*) ;; *) G="*$G" ;; esac
      for T in $TARGETS; do
        case "$T" in $G) HIT=1 ;; esac
      done
    done
    [ -z "$HIT" ] && continue

    # A .tsx file is not proof of React — it could be Astro, Solid or Preact.
    # The packages the skill tracks are the proof, so the manifests decide.
    #
    # Some skills need no such proof: a .sql file is SQL and a Dockerfile is a
    # Dockerfile, and no package declares either. A skill that names paths and
    # no tracks is taken at its word.
    PY=""
    case "$STRACKS" in *pypi*) PY=1 ;; esac
    DEP=""
    [ -z "$STRACKS" ] && DEP=1
    for P in $(printf '%s' "$STRACKS" | tr ',' ' '); do
      case "$P" in *@*) ;; *) continue ;; esac
      PKG=$(printf '%s' "$P" | sed 's/@[^@]*$//')
      [ -z "$PKG" ] && continue
      for M in $MANIFESTS; do
        if [ -n "$PY" ]; then
          grep -qiE "(^|[^A-Za-z0-9_.-])$PKG([^A-Za-z0-9_.-]|$)" "$M" 2>/dev/null && DEP=1
        else
          grep -qs "\"$PKG\"" "$M" && DEP=1
        fi
      done
    done
    [ -z "$DEP" ] && continue

    SAFE=$(printf '%s' "$SNAME" | tr -cd 'A-Za-z0-9_-')
    [ -f "/tmp/claude-skill-loaded-$KEY-$SAFE" ] && continue
    case " $MISSING " in *" $SNAME "*) ;; *) MISSING="$MISSING $SNAME"; ACKS="$ACKS /tmp/claude-skill-acked-$KEY-$SAFE" ;; esac
  done
fi

if [ -n "$MISSING" ]; then
  LIST=$(printf '%s' "$MISSING" | sed 's/^ //; s/ /, /g')
  FIRST=$(printf '%s' "$MISSING" | awk '{print $1}')
  cat <<EOF
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"BLOCKED: this file's stack has mandatory skills that are not loaded: $LIST.\n\nThere is no SKIP for these. The file matches each skill's declared paths AND this project depends on a package that skill tracks, so they apply as a matter of fact, not judgement. Touching the gate marker will not clear them.\n\nCall Skill($FIRST) now — then every other name in the list. Then say which of their rules bear on this file, ack them in one Bash call, and retry the edit:\n  touch$ACKS"}}
EOF
  exit 0
fi

if [ -f "$MARKER" ]; then
  exit 0
fi


cat <<EOF
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"BLOCKED: skill evaluation required before file edits in this session.\n\nStep 1 — evaluate every available skill as ACTIVATE or SKIP with a one-line reason.\n\nStep 2 — you MUST take EXACTLY ONE of these tool actions to clear the gate. Listing skills in text is NOT enough; retrying the edit without doing one of these will be denied again:\n  (a) If any skill is ACTIVATE → call Skill(name) for it. This auto-clears the gate.\n  (b) If ALL skills are SKIP → run this Bash tool call: touch /tmp/claude-skill-gate-$KEY\n\nStep 3 — only after Step 2 completes, retry the file edit."}}
EOF
exit 0
