#!/usr/bin/env bash
# gauntlet.sh — Stop hook: fast deterministic gates on the changed diff.
#
# Runs when Claude finishes a turn. Silent when green. On a red gate it exits 2:
# the turn keeps going, the user is shown why, and Claude is handed the failure.
#
# Two things the hook contract makes non-negotiable:
#   - stop_hook_active must short-circuit, or a red gate loops forever.
#   - A hook that hits its timeout (600s default for command hooks) is cancelled
#     and its output discarded, so the turn ends as if the hook never ran. Keep
#     the gates fast; that is a silent pass, not a block.
#
# Only cheap gates belong here (target: under ~30s). Mutation testing, deep
# review, and the spec checklist are the /gauntlet command's job, not this hook's.
#
# Skip ladder, cheapest first — quits at the first "no":
#   1. no changed files
#   2. no changed *code* files (docs/config only)
#   3. this exact diff already passed
#   4. no gates detected for this repo
#
# Config, both optional and both KEY=value files that get sourced in this order:
#   ~/.claude/gauntlet.conf          your defaults for every project
#   <project>/.claude/gauntlet.conf  overrides for this one; wins key by key
#   GAUNTLET_OFF=1                 disable entirely
#   GAUNTLET_TYPECHECK="cmd"       explicit typecheck command ("" to skip)
#   GAUNTLET_TEST="cmd"            explicit test command; $FILES = changed code files
#   GAUNTLET_CODE_EXT="ts|tsx|py"  override which extensions count as code
#   GAUNTLET_DEBUG=1               print the outcome to stderr on every run
#   GAUNTLET_REQUIRE_TESTS=1       block when a runner matched 0 test files
#
# Setting either command switches the whole repo to explicit mode — auto-detection
# is off, and only what you set runs.
#
# Per-project runners, for tests that cannot run on the host at all:
#   <project>/.gauntlet-test        executable; run instead of the detected test
#                                   command, with $FILES as its arguments
#   <project>/.gauntlet-typecheck   executable; run instead of the detected
#                                   typecheck command
#
# <project> is any directory holding a package.json or pyproject.toml, so one
# half of a monorepo can run on the host while the other runs in a container.
# Unlike GAUNTLET_TEST these do not disable detection anywhere else. Typically a
# two-line `docker compose run --rm -T api pytest "$@"`. Same shape as
# ship-gate's .mutmut-run.
#
# Every run records why it ended in /tmp/claude-gauntlet-<session>.why, so a green
# run and a skipped one are told apart without re-running the hook.

set -uo pipefail

INPUT=$(cat 2>/dev/null || true)

# Never re-block a turn we already blocked — this would loop forever.
case "$INPUT" in
  *'"stop_hook_active":true'*) exit 0 ;;
esac

SESSION_ID=$(printf '%s' "$INPUT" | grep -o '"session_id":"[^"]*"' | head -1 \
             | sed 's/"session_id":"//; s/"$//')
if [ -z "$SESSION_ID" ]; then SESSION_ID="nosession"; fi
MARKER="/tmp/claude-gauntlet-$SESSION_ID"
WHY="$MARKER.why"

# Records why this run ended, so "green" and "never ran" stop looking identical.
quit() {
  printf '%s\n' "$1" > "$WHY" 2>/dev/null
  if [ -n "${GAUNTLET_DEBUG:-}" ]; then printf 'gauntlet: %s\n' "$1" >&2; fi
  exit 0
}

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-}"
if [ -z "$PROJECT_DIR" ]; then PROJECT_DIR="$PWD"; fi
cd "$PROJECT_DIR" 2>/dev/null || quit "skipped: project dir unreadable"

git rev-parse --git-dir >/dev/null 2>&1 || quit "skipped: not a git repo"

GAUNTLET_OFF=""
GAUNTLET_TYPECHECK="__auto__"
GAUNTLET_TEST="__auto__"
GAUNTLET_CODE_EXT="ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|rb|php|c|h|cpp|hpp|cs|swift|sql"
# Global defaults first, then the project's on top — project wins, key by key.
if [ -n "${HOME:-}" ] && [ -f "$HOME/.claude/gauntlet.conf" ]; then . "$HOME/.claude/gauntlet.conf"; fi
if [ -f "$PROJECT_DIR/.claude/gauntlet.conf" ]; then . "$PROJECT_DIR/.claude/gauntlet.conf"; fi
if [ -n "$GAUNTLET_OFF" ]; then quit "skipped: GAUNTLET_OFF is set"; fi

# ---------------------------------------------------------------- skip rule 1
CHANGED=$( { git diff --name-only HEAD 2>/dev/null; \
             git ls-files --others --exclude-standard 2>/dev/null; } | sort -u )
if [ -z "$CHANGED" ] && [ -z "${GAUNTLET_DRYRUN:-}" ]; then quit "skipped: no changed files"; fi

# ---------------------------------------------------------------- skip rule 2
# .stryker-tmp holds Stryker's sandbox — a full copy of the project. A crashed
# run leaves it behind, and then every file in it looks like a changed file.
FILES_NL=$(printf '%s\n' "$CHANGED" | grep -E "\.($GAUNTLET_CODE_EXT)$" \
           | grep -vE '(^|/)\.stryker-tmp/' || true)
if [ -z "$FILES_NL" ] && [ -z "${GAUNTLET_DRYRUN:-}" ]; then
  quit "skipped: no changed code files (docs/config only)"
fi

# ---------------------------------------------------------------- skip rule 3
# The repo path is part of the hash: one session can touch several repos, and two
# of them can legitimately hold an identical diff.
DIFF_HASH=$( { printf '%s\n' "$PROJECT_DIR"; git diff HEAD 2>/dev/null; printf '%s\n' "$CHANGED"; } \
             | git hash-object --stdin 2>/dev/null )
if [ -f "$MARKER" ] && [ "$(cat "$MARKER")" = "$DIFF_HASH" ] \
   && [ -z "${GAUNTLET_DRYRUN:-}" ]; then
  quit "skipped: this diff already passed"
fi

# ---------------------------------------------------------------- skip rule 4
# A monorepo can hold more than one stack, so detection collects every gate it
# finds rather than stopping at the first. Each gate carries the file pattern it
# applies to, and is skipped entirely when the diff touched none of those files —
# so a Python-only change never runs the JS suite, and vice versa.
TC_GATES=""
TEST_GATES=""
SKIP_NOTE=""

add_gate() {  # kind (typecheck|tests), file regex, command
  LINE=$(printf '%s\t%s\t%s' "$1" "$2" "$3")
  if [ "$1" = "typecheck" ]; then
    TC_GATES="$TC_GATES$LINE
"
  else
    TEST_GATES="$TEST_GATES$LINE
"
  fi
}

JS_EXT='(ts|tsx|js|jsx|mjs|cjs)'

# Builds the gates for one directory. "" is the repo root; anything else is a
# nested project, and its gates match only files under that path. Commands run
# from inside the directory, which is why the file list is passed as absolute
# paths — a relative path would not survive the cd.
add_dir_gates() {
  d="$1"
  if [ -n "$d" ]; then pre="^$d/.*\\." ; run="cd $d && " ; else pre='\.' ; run="" ; fi
  have_tc=""; have_test=""
  [ -n "$d" ] && [ -n "${ROOT_TC:-}" ] && have_tc="skip"
  [ -n "$d" ] && [ -n "${ROOT_TEST:-}" ] && have_test="skip"

  # A project whose tests need a database, a queue, or any other service cannot
  # run them on the host, and detection here finds the host runner every time.
  # An executable runner in the project directory says where they DO run —
  # usually `docker compose run` against the app container — and wins over
  # everything detected below.
  #
  # Per project, not per repo: GAUNTLET_TEST switches the WHOLE repo to explicit
  # mode, so a monorepo needing a container for one stack had to hand-write
  # commands for all of them. These let one half run on the host and the other
  # in a container. Same shape as ship-gate's .mutmut-run, deliberately.
  RUNNER_EXT="($JS_EXT|py)"
  if [ -z "$have_tc" ] && [ -x "$d${d:+/}.gauntlet-typecheck" ]; then
    add_gate typecheck "$pre$RUNNER_EXT\$" "${run}./.gauntlet-typecheck"
    have_tc="skip"
  fi
  if [ -z "$have_test" ] && [ -x "$d${d:+/}.gauntlet-test" ]; then
    add_gate tests "$pre$RUNNER_EXT\$" "${run}./.gauntlet-test \$FILES"
    have_test="skip"
  fi

  if [ -f "$d${d:+/}package.json" ]; then
    pkg="$d${d:+/}package.json"
    if [ -z "$have_tc" ]; then
      if grep -q '"typecheck"[[:space:]]*:' "$pkg"; then
        add_gate typecheck "$pre($JS_EXT)\$" "${run}npm run --silent typecheck"
      elif [ -f "$d${d:+/}tsconfig.json" ]; then
        add_gate typecheck "$pre(ts|tsx)\$" "${run}npx --no-install tsc --noEmit"
      fi
    fi
    if [ -z "$have_test" ]; then
      if grep -q '"vitest"' "$pkg"; then
        add_gate tests "$pre($JS_EXT)\$" "${run}npx --no-install vitest related --run \$FILES"
      elif grep -q '"jest"' "$pkg"; then
        add_gate tests "$pre($JS_EXT)\$" "${run}npx --no-install jest --findRelatedTests \$FILES --passWithNoTests"
      elif grep -q '"test"[[:space:]]*:' "$pkg"; then
        add_gate tests "$pre($JS_EXT)\$" "${run}CI=1 npm run --silent test"
      fi
    fi
  fi

  if [ -f "$d${d:+/}pyproject.toml" ] || [ -f "$d${d:+/}pytest.ini" ] || [ -f "$d${d:+/}setup.cfg" ]; then
    if [ -z "$have_tc" ]; then
      if [ -f "$d${d:+/}mypy.ini" ] || grep -qs 'tool.mypy' "$d${d:+/}pyproject.toml"; then
        add_gate typecheck "${pre}py\$" "${run}python -m mypy ."
      fi
    fi
    if [ -z "$have_test" ]; then
      add_gate tests "${pre}py\$" "${run}python -m pytest -q"
    fi
  fi
}

detect() {
  # Explicit config wins outright: auto-detection is off for the whole repo.
  if [ "$GAUNTLET_TEST" != "__auto__" ] || [ "$GAUNTLET_TYPECHECK" != "__auto__" ]; then
    if [ "$GAUNTLET_TYPECHECK" != "__auto__" ] && [ -n "$GAUNTLET_TYPECHECK" ]; then
      add_gate typecheck '.' "$GAUNTLET_TYPECHECK"
    fi
    if [ "$GAUNTLET_TEST" != "__auto__" ] && [ -n "$GAUNTLET_TEST" ]; then
      add_gate tests '.' "$GAUNTLET_TEST"
    fi
    return
  fi

  add_dir_gates ""

  # Many repos keep no manifest at the root — the code lives in web/, api/,
  # backend/, packages/*. Look two levels down, but only for the kind of gate the
  # root did not already provide, so a repo that works today keeps working.
  ROOT_TC="$TC_GATES"
  ROOT_TEST="$TEST_GATES"
  while IFS= read -r manifest; do
    [ -z "$manifest" ] && continue
    d=$(dirname "$manifest")
    d=${d#./}
    [ "$d" = "." ] && continue
    add_dir_gates "$d"
  done <<< "$(find . -mindepth 2 -maxdepth 3 \
               \( -name package.json -o -name pyproject.toml -o -name pytest.ini \) \
               -not -path '*/node_modules/*' -not -path '*/.git/*' \
               -not -path '*/dist/*' -not -path '*/build/*' \
               -not -path '*/.venv/*' -not -path '*/venv/*' 2>/dev/null | sort)"
}
detect

# Typechecks before tests — cheapest first, so the slow gate is usually unpaid.
GATES="$TC_GATES$TEST_GATES"
if [ -n "${GAUNTLET_DRYRUN:-}" ]; then
  if [ -z "$GATES" ]; then quit "would run: nothing — no gates detected"; fi
  quit "would run: $(printf '%s' "$GATES" | cut -f1,3 | tr '\t' ' ' | tr '\n' '; ')"
fi
if [ -z "$GATES" ]; then
  if [ -n "$SKIP_NOTE" ]; then quit "skipped: $SKIP_NOTE"; fi
  quit "skipped: no gates detected for this repo"
fi

# ------------------------------------------------------------------ the gates
FAILED=""
OUTPUT=""
NO_TEST_MATCH=""
RAN=""
# Kept in variables on purpose: a bare `}` inside a ${var//pat/repl} replacement
# closes the expansion early and silently mangles the command.
FILES_REPL='"${FILE_ARR[@]}"'
PAT_BRACE='${FILES}'
PAT_PLAIN='$FILES'

while IFS=$'\t' read -r GKIND GEXT GCMD; do
  [ -z "$GKIND" ] && continue
  GFILES=$(printf '%s\n' "$FILES_NL" | grep -E "$GEXT" || true)
  [ -z "$GFILES" ] && continue
  # $FILES is substituted as a real argument list, not a space-joined string —
  # word splitting would tear "src/my folder/a.ts" into two bogus paths.
  mapfile -t REL_ARR <<< "$GFILES"
  FILE_ARR=()
  for f in "${REL_ARR[@]}"; do FILE_ARR+=("$PROJECT_DIR/$f"); done
  export FILES=$(printf '%s' "$GFILES" | tr '\n' ' ')
  GCMD_RUN=${GCMD//"$PAT_BRACE"/$FILES_REPL}
  GCMD_RUN=${GCMD_RUN//"$PAT_PLAIN"/$FILES_REPL}
  RAN="$RAN$GKIND "
  GATE_OUT=$(eval "$GCMD_RUN" 2>&1)
  if [ $? -ne 0 ]; then
    # A gate whose tool is not installed is a missing gate, not a failing one.
    # Blocking on it would wall off every turn until the user installs something.
    if printf '%s' "$GATE_OUT" | grep -qiE 'command not found|no module named|cannot find module|could not determine executable|canceled due to missing packages|missing script|is not recognized'; then
      SKIP_NOTE="the $GKIND tool is not installed"
      RAN="${RAN%"$GKIND "}"
      continue
    fi
    FAILED="$GKIND"
    OUTPUT="$GATE_OUT"
    break
  fi
  # A runner handed files it has no tests for exits 0 and looks exactly like a
  # pass. It is the loudest false green: the changed code was never executed.
  if [ "$GKIND" = "tests" ] \
     && printf '%s' "$GATE_OUT" | grep -qiE 'no test files found|no tests found|no tests ran'; then
    NO_TEST_MATCH="$GCMD"
    OUTPUT="$GATE_OUT"
  fi
done <<< "$GATES"

if [ -z "$FAILED" ] && [ -n "$NO_TEST_MATCH" ] && [ -n "${GAUNTLET_REQUIRE_TESTS:-}" ]; then
  FAILED="tests"
  OUTPUT="$OUTPUT

The runner matched 0 test files for the changed code, so nothing was executed.
Write a test that covers the change, or unset GAUNTLET_REQUIRE_TESTS."
fi

if [ -z "$FAILED" ]; then
  printf '%s' "$DIFF_HASH" > "$MARKER"
  if [ -z "$RAN" ]; then
    if [ -n "$SKIP_NOTE" ]; then quit "skipped: $SKIP_NOTE"; fi
    quit "skipped: no gate applied to the changed files"
  elif [ -n "$SKIP_NOTE" ]; then
    quit "green: gates passed ($RAN) — but $SKIP_NOTE"
  elif [ -n "$NO_TEST_MATCH" ]; then
    quit "green: gates passed, but a runner matched 0 test files — that code was never executed"
  fi
  quit "green: gates passed ($RAN)"
fi

# ------------------------------------------------------------------ block red
# Last 60 lines only — the hook's reason is read by a model, not archived.
TAIL=$(printf '%s\n' "$OUTPUT" | tail -60)
MSG="GAUNTLET FAILED: the $FAILED gate is red on the changed files.

Fix it before ending the turn. Do not weaken or delete a test to make this pass.
If the failure is unrelated to your change, say so explicitly and stop.

Changed code files:
$FILES

--- $FAILED output (last 60 lines) ---
$TAIL"

printf '%s\n' "red: the $FAILED gate failed" > "$WHY" 2>/dev/null

# Exit 2 is the only path where a red is visible to the user: its stderr is shown
# to them as the reason the turn is continuing. Exit 0 with {"decision":"continue"}
# also keeps the turn going, but the reason reaches Claude alone — so a failing
# gate looked, from the outside, exactly like a gauntlet that does nothing.
printf '%s\n' "$MSG" >&2
exit 2
