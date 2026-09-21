#!/usr/bin/env bash
# ship-gate.sh — the deterministic half of /ship's quality gate.
#
# File length and mutation are not judgement calls, so they do not live in prose
# where a model can decide they are not worth it. They live here, behind an exit
# code. /ship runs this and obeys the result; the skills audit stays in the
# command, because that one genuinely needs a model.
#
#   bash .claude/hooks/ship-gate.sh [base-ref]
#   bash .claude/hooks/ship-gate.sh --key      print the receipt key and stop
#   bash .claude/hooks/ship-gate.sh --force    write a FORCED receipt, run nothing
#   bash .claude/hooks/ship-gate.sh --baseline accept the survivors as debt, reusing
#                                              this tree's last run, and write the receipt
#
# On completion it writes a RECEIPT at /tmp/claude-shipgate-<key>, and the
# PreToolUse hook refuses `git commit` / `git push` without a matching one. The
# point is that a gate has to be evidence rather than an instruction: a sentence
# saying "run this first" is a sentence an agent can decide is not worth it, and
# then report a pass it never earned. A receipt cannot be reported, only produced.
#
# The key is the content of everything about to ship, so it is the same before
# and after `git commit` — and it changes the moment anything is edited, which is
# what makes a fix re-gate itself instead of riding on the previous verdict.
#
# Exit codes:
#   0  clean — nothing over the line limit, nothing survived, nothing uncovered
#   1  findings that must be dealt with before shipping
#   2  ran, but could not prove the tests (a mutation tool is missing, or page tests
#      count as proof) — report, don't block; the output names the fix and where
#
# Config: the same .claude/gauntlet.conf as the Stop hook.
#   GAUNTLET_MAX_LINES=200   the per-file limit; 0 turns the check off
#   GAUNTLET_SOURCE_EXT=...  which extensions count as source. Deliberately NOT
#                            GAUNTLET_CODE_EXT: the Stop hook's key answers a
#                            different question, and a docs repo sets it to .md
#   GAUNTLET_IGNORE_EXT=...  extensions that need no gate at all. An extension in
#                            neither list is reported UNPROVEN rather than passed
#   GAUNTLET_IGNORE_FILES=.. space-separated globs, matched against /<path>, for
#                            files nobody wrote: generated code and vendored
#                            components. They are named in the output, never
#                            dropped silently. Set it to "" to gate everything
#   GAUNTLET_MUTATE="cmd"    one explicit mutation command for the whole repo,
#                            replacing per-project detection. $MUTATE_FLAGS holds
#                            the --mutate flags, $FILES the changed files.

set -uo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/ship-gate-projects.sh" && . "$HERE/ship-gate-structure.sh" || { echo "ship-gate: cannot read its helpers in $HERE"; exit 1; }

MODE=""
case "${1:-}" in
  --key)      MODE=key; shift ;;
  --force)    MODE=force; shift ;;
  --baseline) MODE=baseline; shift ;;
esac

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
cd "$PROJECT_DIR" 2>/dev/null || { echo "ship-gate: cannot read $PROJECT_DIR"; exit 1; }
git rev-parse --git-dir >/dev/null 2>&1 || { echo "ship-gate: not a git repo"; exit 1; }

# `git diff --name-only` prints paths from the repo ROOT, but CLAUDE_PROJECT_DIR
# can point at a subdirectory of it. Testing those paths from the subdirectory
# found no files at all, so the gate said "nothing to check" and wrote a PASS
# receipt over a diff it never looked at. Work from the root and the paths git
# prints are the paths this script tests. The receipt key moves with it, and the
# PreToolUse hook asks this script for the key rather than computing its own, so
# the two cannot disagree.
ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -n "$ROOT" ]; then
  cd "$ROOT" || { echo "ship-gate: cannot read $ROOT"; exit 1; }
  PROJECT_DIR="$ROOT"
fi

GAUNTLET_MAX_LINES=200
GAUNTLET_MUTATE=""
GAUNTLET_SOURCE_EXT="ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|rb|php|c|h|cpp|hpp|cs|swift|gd"
GAUNTLET_IGNORE_EXT="md|mdx|txt|rst|adoc|jsonc?|ya?ml|toml|lock|cfg|ini|env|csv|tsv|sql|html|css|scss|svg|png|jpg|jpeg|gif|webp|ico|pdf|woff2?|ttf|otf|mp3|mp4|wav|zip|gz|tres|tscn|import|godot"
GAUNTLET_IGNORE_FILES="*.gen.ts *.gen.tsx *.generated.* */migrations/*.py */alembic/versions/*.py */components/ui/*.tsx */hooks/use-mobile.ts */*.config.*"
# Length-checked and skill-audited like everything else, but not mutated.
# Mutation pays on logic and burns time on presentation: a component's mutants
# are class names, copy and JSX shape, none of which is behaviour, and one
# session spent an evening killing them. Logic that lives inside a component is
# logic that wants extracting — which the 200-line rule already pushes toward.
# Override in .claude/gauntlet.conf to mutate components too.
GAUNTLET_NO_MUTATE='\.(tsx|jsx)$'
[ -n "${HOME:-}" ] && [ -f "$HOME/.claude/gauntlet.conf" ] && . "$HOME/.claude/gauntlet.conf"
[ -f ".claude/gauntlet.conf" ] && . ".claude/gauntlet.conf"

# ------------------------------------------------------------------- the scope
BASE="${1:-}"
if [ -z "$BASE" ]; then
  BASE=$(git merge-base HEAD develop 2>/dev/null \
         || git merge-base HEAD main 2>/dev/null \
         || git rev-list --max-parents=0 HEAD | head -1)
fi

CHANGED=$(changed_files)

# Only the files this gate can actually read go into the key. It used to be every
# changed file, so a version bump in package.json or a line in a changelog threw
# away a receipt the gate would have re-earned unchanged — fifteen minutes of
# mutation testing to prove nothing about the file that moved, at the one moment
# a release is trying to ship. An ignored extension is one no check here opens,
# so it cannot change a verdict. Unknown extensions stay in, because UNPROVEN is
# a verdict about exactly those.
#
# The repo path plus the names and contents of the changed files, in a fixed
# order. The path is in there because the key is otherwise pure content: two
# repos holding the same file would share a receipt, and one would be waved
# through on the other's verdict. Deliberately not a diff: a file moves from "untracked" to "in the diff" at commit time, so a
# diff-based key changes when the content did not, and the receipt would go stale
# the moment it was committed. This is identical either side of a commit, and
# changes the instant any of those files is edited.
RECEIPT_KEY=$(receipt_key)
RECEIPT="/tmp/claude-shipgate-$RECEIPT_KEY"

if [ "$MODE" = key ]; then printf '%s\n' "$RECEIPT_KEY"; exit 0; fi
if [ "$MODE" = force ]; then
  printf 'FORCED %s\n' "$(date -u +%FT%TZ)" > "$RECEIPT"
  echo "ship-gate: FORCED — receipt written without running any check."
  exit 0
fi
SOURCED=$(printf '%s\n' "$CHANGED" | grep -E "\.($GAUNTLET_SOURCE_EXT)$" \
        | grep -vE '(\.|_)(test|spec)\.[^.]+$|(^|/)tests?/|(^|/)\.stryker-tmp/' | while read -r f; do
          [ -f "$f" ] && printf '%s\n' "$f"
        done)

# A generated file cannot be split and a vendored one is not ours to split, so
# the length check fires on every route regeneration and teaches people to
# --force. A gate that is always forced is not a gate. These are held out of
# both checks — and printed, because a silent skip is the same lie as a fake
# PASS. The leading / is what lets one pattern match components/ui at the repo
# root and apps/web/src/components/ui alike.
#
# */*.config.* is here for the same reason, and became urgent the moment an
# uncovered line started failing the gate: vitest.config.ts has no tests, will
# never have tests, and is not a thing anyone writes a test for. Left in, every
# diff that touches a config reports findings nobody can close.
# set -f matters: an unquoted list is glob-expanded before it is split, so
# */components/ui/*.tsx turned itself into the very path it was meant to match
# and then matched nothing.
is_ignored() {
  set -f
  for pat in $GAUNTLET_IGNORE_FILES; do
    case "/$1" in $pat) set +f; return 0 ;; esac
  done
  set +f
  return 1
}
FILES=$(printf '%s\n' "$SOURCED" | while IFS= read -r f; do
          [ -n "$f" ] && ! is_ignored "$f" && printf '%s\n' "$f"
        done)
IGNORED=$(printf '%s\n' "$SOURCED" | while IFS= read -r f; do
            [ -n "$f" ] && is_ignored "$f" && printf '%s\n' "$f"
          done)
if [ -n "$IGNORED" ]; then
  echo "ship-gate: not gated, matched GAUNTLET_IGNORE_FILES:"
  printf '%s\n' "$IGNORED" | sed 's/^/  /'
fi

[ -n "$FILES" ] && echo "ship-gate: $(printf '%s\n' "$FILES" | wc -l) changed code file(s), base $(git rev-parse --short "$BASE")"
STATUS=0; structure_check || { STATUS=1; [ -z "$FILES" ] && structure_fail; }
if [ -z "$FILES" ]; then
  # "I recognised nothing" is not "there is nothing", and the gate used to report
  # both as a PASS. A Godot repo changed only .gd files, which no extension in
  # the list named, so zero source files were found and a PASS receipt was
  # written over work nothing had checked. An extension this gate cannot place is
  # UNPROVEN: it does not block, but it never claims a pass either.
  UNKNOWN=$(printf '%s\n' "$CHANGED" | grep -E '\.[A-Za-z0-9]+$' \
            | grep -viE "\.($GAUNTLET_SOURCE_EXT)$" \
            | grep -viE "\.($GAUNTLET_IGNORE_EXT)$" \
            | sed 's/.*\.//' | sort -u | tr '\n' ' ')
  if [ -n "$UNKNOWN" ]; then
    echo "ship-gate: UNPROVEN — nothing here was checked. These changed files are"
    echo "  in a language this gate does not know: $UNKNOWN"
    echo "  If they are source, add the extension in .claude/gauntlet.conf:"
    echo "    GAUNTLET_SOURCE_EXT=\"\$GAUNTLET_SOURCE_EXT|${UNKNOWN%% *}\""
    echo "  If they are not, add it to GAUNTLET_IGNORE_EXT the same way."
    printf 'UNPROVEN %s unknown-extensions\n' "$(date -u +%FT%TZ)" > "$RECEIPT"
    exit 2
  fi
  echo "ship-gate: no changed code files — nothing to check"
  printf 'PASS %s no-code-changes\n' "$(date -u +%FT%TZ)" > "$RECEIPT"
  exit 0
fi

# ------------------------------------------------- check 1: file length (hard)
OVER=""
LARGEST=0
if [ "$GAUNTLET_MAX_LINES" -gt 0 ]; then
  while IFS= read -r f; do
    n=$(wc -l < "$f")
    [ "$n" -gt "$LARGEST" ] && LARGEST=$n
    [ "$n" -gt "$GAUNTLET_MAX_LINES" ] && OVER="$OVER  $f — $n lines (limit $GAUNTLET_MAX_LINES)
"
  done <<< "$FILES"
fi

if [ "$GAUNTLET_MAX_LINES" -le 0 ]; then
  echo "FILE LENGTH — off (GAUNTLET_MAX_LINES=0)"
elif [ -n "$OVER" ]; then
  echo "FILE LENGTH — over the limit:"
  printf '%s' "$OVER"
  echo "  Splitting a file is a design decision. Do it deliberately, or ship with --force."
  STATUS=1
else
  echo "FILE LENGTH — ok, largest is $LARGEST lines"
fi

# ---------------------------------------------------------- which project owns
# A monorepo holds several projects, each with its own runner and its own
# mutation tool. Walk up from each changed file to the nearest manifest.
OWNERS=$(while IFS= read -r f; do owner_of "$f"; done <<< "$FILES" | sort -u)

# --------------------------------------------- check 2: mutation, per project
echo
echo "MUTATION — $(printf '%s\n' "$OWNERS" | wc -l) project(s) in this diff"
MISSING=""

for owner in $OWNERS; do
  [ "$owner" = "." ] && label="<repo root>" || label="$owner/"
  OWNED=$(while IFS= read -r f; do
            [ "$(owner_of "$f")" = "$owner" ] && printf '%s\n' "$f"
          done <<< "$FILES" | grep -vE "$GAUNTLET_NO_MUTATE" || true)
  [ -z "$OWNED" ] && continue

  # ONE comma-joined --mutate value, never a flag per range. Stryker's CLI
  # parses --mutate with `(val) => val.split(",")`, a coercion that ignores the
  # previous value, so a repeated flag OVERRIDES instead of appending and only
  # the last one survives. Measured on two files: the repeated form found 1 of
  # 1808 files and 28 mutants, the joined form 2 files and 51. Every run since
  # this gate shipped mutated exactly one file and called the rest proven — and
  # when that one file had no tests, Stryker exited on "No tests were executed"
  # and the gate reported UNPROVEN, which writes a receipt and blocks nothing.
  FLAGS=""
  GLOBBED=","
  while IFS= read -r f; do
    hunks=$(git diff -U0 "$BASE" -- "$f" 2>/dev/null \
            | grep -oE '^@@ -[0-9,]+ \+[0-9]+(,[0-9]+)?' | sed 's/.*+//' \
            | while IFS=, read -r s l; do l=${l:-1}; [ "$l" -gt 0 ] && echo "$s-$((s+l-1))"; done)
    [ -z "$hunks" ] && hunks="1-$(wc -l < "$f")"
    rel=${f#$owner/}
    # A Next.js route folder — [id], [[...slug]] — is a glob expression to
    # Stryker, which refuses "Cannot combine a glob expression with a mutation
    # range" and fails the entire run, not just that file. Escaping the brackets
    # stops the path resolving at all. Replacing each with ? keeps it matching
    # that one file and drops the range, so the file is mutated whole: a
    # superset of the diff, slower than a range but never less than what changed.
    case "$rel" in
      *[][*?{}]*) FLAGS="$FLAGS,$(printf '%s' "$rel" | sed 's/[][*?{}]/?/g')"
                  GLOBBED="$GLOBBED$rel," ;;
      *) for r in $hunks; do FLAGS="$FLAGS,$rel:$r"; done ;;
    esac
  done <<< "$OWNED"

  base=""; RUN=""; SCOPE_RE=""; GLOBS=""; MODS=""; MLOG="${TMPDIR:-/tmp}/ship-gate-mutmut.$$"
  if [ "$owner" != "." ]; then base="$owner/"; RUN="cd '$owner' && "; fi
  if [ -n "$GAUNTLET_MUTATE" ]; then
    CMD="$GAUNTLET_MUTATE"; TOOL="config"
  elif [ -f "$base"package.json ] && grep -qs '@stryker-mutator/core' "$base"package.json; then
    TOOL="stryker"
    # From inside the owning package: npx resolves against ITS node_modules, and
    # stryker.config.json lives there too. A monorepo root usually has neither.
    #
    # Deliberately NOT --incremental. --force does rerun every mutant in scope,
    # so the diff itself was always judged fresh — but incremental mode still
    # merges reports/stryker-incremental.json into the REPORT for everything
    # out of scope, and this gate greps the whole report. Survivors recorded
    # months ago came back as findings against a diff that never touched them:
    # 8 of them on one commit, all long since killed. --mutate already scopes
    # the run to the changed hunks, so incremental buys nothing here and costs
    # a cache that goes stale exactly the way mutmut's did.
    CMD="${RUN}npx --no-install stryker run --mutate '${FLAGS#,}'"; stryker_page_tests "$base" "$label"
  elif [ -f "$base"package.json ]; then
    MISSING="$MISSING  $label needs Stryker:
      npm --prefix ${owner} i -D @stryker-mutator/core @stryker-mutator/vitest-runner
      then ${base}stryker.config.json:
        {\"testRunner\":\"vitest\",\"plugins\":[\"@stryker-mutator/vitest-runner\"],\"coverageAnalysis\":\"perTest\"}
"
    continue
  elif [ -n "$(py_mutmut "$base")" ]; then
    TOOL="mutmut"
    # 3.x has no per-line scoping, only fnmatch globs over mutant NAMES, so once a
    # baseline exists every run, --baseline included, is scoped to the changed modules.
    #
    # `mutmut run` prints 🙁 for a survivor and exits 0 either way — parsing it
    # reports clean with survivors sitting there, which is a false green and
    # worse than reporting nothing. `mutmut results` is the readable source:
    # it prints "<mutant name>: survived" per survivor.
    M="$(py_mutmut "$base")"
    [ -f "$base.mutmut-baseline" ] && MODS=$(printf '%s\n' "$OWNED" \
      | sed -n "s#^$base\(.*\)\.py\$#\1#p" | tr / . | sed 's#^src\.##' | sort -u)
    [ -n "$MODS" ] && GLOBS=$(printf " '%s.x*'" $MODS) \
      && SCOPE_RE=$(printf '%s\n' "$MODS" | sed 's/\./\\./g' | paste -sd'|' -)
    # mutmut caches verdicts in ./mutants and only invalidates one when the
    # SOURCE of that function changes. Adding a test does not, so it replays the
    # old "survived" and calls mutants the new tests kill still alive — measured
    # at 20 of them on one commit. `results` then prints that whole cache, so
    # survivors turn up for files nowhere near the diff. Deleting the dir first
    # makes both describe the tree being shipped; `mutmut run` rewrites it
    # anyway, and a cold run is ~35s for ~1000 mutants.
    # One cd for all three: they run in the same shell, already there.
    CMD="${RUN}rm -rf mutants; $M run$GLOBS >'$MLOG' 2>&1; $M results"
  else
    MISSING="$MISSING  $label needs mutmut:
      uv add --dev mutmut     # or: poetry add --group dev mutmut, pip install mutmut
      then ${base}pyproject.toml:
        [tool.mutmut]
        source_paths = [\"src/\"]
        pytest_add_cli_args_test_selection = [\"tests/\"]
      (mutmut 3 renamed these — paths_to_mutate/tests_dir are 2.x and are ignored)
"
    continue
  fi

  # Only a clean run is recorded. A baseline replays this tree's last mutmut run, log
  # included, rather than repeating it: accepting survivors used to cost two more runs.
  PKEY=""; [ "$TOOL" != config ] && PKEY="/tmp/claude-shipgate-project-$(project_key "$owner" "$TOOL")"
  if [ -n "$PKEY" ] && [ -f "$PKEY" ] && { [ "$TOOL" != mutmut ] || [ "$MODE" != baseline ]; }; then
    echo "  $label $TOOL — ok, not re-run: nothing of its kind changed since it passed"
    continue
  fi
  [ "$TOOL" = mutmut ] && [ "$MODE" = baseline ] && [ -f "$PKEY.out" ] && CMD="cp '$PKEY.log' '$MLOG' 2>/dev/null; cat '$PKEY.out'"
  OUT=$(eval "$CMD" 2>&1); RC=$?
  [ "$TOOL" = mutmut ] && [ $RC -eq 0 ] && { printf '%s\n' "$OUT" > "$PKEY.out"; cp "$MLOG" "$PKEY.log" 2>/dev/null; }
  [ -n "$SCOPE_RE" ] && [ $RC -eq 0 ] && OUT=$(printf '%s\n' "$OUT" | grep -E "^[[:space:]]*($SCOPE_RE)\.x")
  # Match a finding, never a summary row. Stryker prints a `# survived` COLUMN
  # HEADER every run and repeats the word in its table, so a bare grep reports
  # survivors on a clean run — worse than not running at all. Stryker marks each
  # real finding `[Survived]`; table and border lines are excluded outright.
  # NoCoverage is printed exactly like Survived and means something worse: not
  # "a test missed this mutation" but "no test executes this line at all". The
  # gate matched only [Survived], so a diff whose files have no tests came back
  # PASS — 306 uncovered mutants reported as proven on one commit. It is judged
  # only for files that went in WITH a range: a glob-shaped path is mutated
  # whole, so its untouched lines would report uncovered forever, and a finding
  # nobody can close is what teaches people to --force.
  #
  # The status line carries no file name; the line under it does, as
  # file:line:column. They are paired here rather than grepped separately.
  if [ "$TOOL" = stryker ]; then
    ALL=$(printf '%s\n' "$OUT" | awk -v globbed="$GLOBBED" '
      /^\[Survived\]/   { pend = $0; kind = "s"; next }
      /^\[NoCoverage\]/ { pend = $0; kind = "n"; next }
      pend != "" {
        file = $0; sub(/:[0-9]+:[0-9]+$/, "", file)
        if (kind == "s" || index(globbed, "," file ",") == 0) print pend "  " $0
        pend = ""
      }
      # A survivor with no location under it is still a survivor, never dropped.
      END { if (pend != "" && kind == "s") print pend }
    ')
  else
    ALL=$(printf '%s\n' "$OUT" | grep -E '[Ss]urvived' \
          | grep -vE '^[[:space:]]*[#│|+-]|# *surviv')
  fi
  # The detail list is capped so one bad file cannot bury the output. The cap
  # used to be the whole story, and it hid the WORST file: 20 findings from one
  # file filled it, and a second file with 54 uncovered mutants never appeared
  # at all. A gate whose biggest finding is invisible gets under-fixed. Every
  # file with findings is now named below the cut, worst first.
  FOUND=$(printf '%s\n' "$ALL" | grep -c .)
  SURVIVED=$(printf '%s\n' "$ALL" | head -20)
  FIXED=0
  NOTE=""

  # Module scope still returns a changed file's old survivors; the baseline accepts
  # them. Names index within a function, so only editing that function re-charges them.
  if [ "$TOOL" = mutmut ]; then
    BL="$base.mutmut-baseline"
    # A glob that matches no mutant aborts the run, so nothing in scope was tested.
    if [ -n "$SCOPE_RE" ] && grep -qs "nothing matches" "$MLOG"; then
      echo "  $label mutmut — UNPROVEN: no mutant in the changed module(s): $(printf '%s ' $MODS)"
      [ "$STATUS" = 0 ] && STATUS=2; rm -f "$MLOG"; continue
    fi
    NOWF=$(mktemp)
    printf '%s\n' "$OUT" \
      | sed -n 's/^[[:space:]]*\([^[:space:]]*\): survived$/\1/p' | sort -u > "$NOWF"

    # When the tests need a service the run cannot reach — a database, a queue
    # — mutmut still generates every mutant and records it "not checked". No
    # survivors come out, so the gate printed "nothing survived" and, with no
    # baseline yet, wrote an EMPTY one and told the user to commit it. That
    # repo's Python gate could never fail again.
    #
    # Counting kills cannot catch it: `mutmut results` SKIPS killed mutants
    # unless --all (mutmut/__main__.py results()), so a perfect suite and a
    # suite that ran nothing both print nothing. The status string is what
    # separates them — "not checked" is exit code None in status_by_exit_code,
    # meaning the mutant was never executed at all.
    NOTCHECKED=$(printf '%s\n' "$OUT" | grep -c ': not checked$')
    if [ "$NOTCHECKED" -gt 0 ]; then
      mutmut_unchecked "$label" "$base" "$NOTCHECKED" "$MLOG"
      [ "$STATUS" = 0 ] && STATUS=2
      rm -f "$NOWF" "$MLOG"
      continue
    fi

    if [ "$MODE" = baseline ]; then
      baseline_write "$BL" "$NOWF" "$SCOPE_RE"
      NOTE="  $label mutmut — baseline set: $(wc -l < "$BL") survivor(s) accepted. Commit $BL."
      SURVIVED=""
    elif [ -f "$BL" ]; then
      # -Fxv against an empty baseline reports every survivor, which is right:
      # an empty baseline means nothing has been accepted.
      SURVIVED=$(grep -Fxv -f "$BL" "$NOWF" | head -20)
      FIXED=$(grep -E "^(${SCOPE_RE:-.*})\.x" "$BL" | grep -Fxvc -f "$NOWF")
    else
      cp "$NOWF" "$BL"
      NOTE="  $label mutmut — no baseline, so nothing could be compared. Recorded
      $(wc -l < "$BL") existing survivor(s) in $BL — commit it, then run the
      gate again. From here only NEW survivors fail; --baseline accepts more."
      SURVIVED=""
      [ "$STATUS" = 0 ] && STATUS=2
    fi
    rm -f "$NOWF" "$MLOG"
  fi

  if [ -n "$SURVIVED" ]; then
    echo "  $label $TOOL — these lines can break and no test notices:"
    survivor_list "$SURVIVED" "$TOOL"
    if [ "$FOUND" -gt 20 ]; then
      echo "      ... $((FOUND - 20)) more not shown. Every file with findings:"
      if [ "$TOOL" = stryker ]; then
        printf '%s\n' "$ALL" \
          | awk '{ f = $NF; sub(/:[0-9]+:[0-9]+$/, "", f); n[f]++ }
                 END { for (k in n) printf "%8d  %s\n", n[k], k }' \
          | sort -rn | sed 's/^/      /'
      fi
    fi
    [ "$FIXED" -gt 0 ] && echo "      ($FIXED baselined survivor(s) now killed — --baseline banks them)"
    STATUS=1
  elif [ $RC -ne 0 ]; then
    echo "  $label $TOOL — the run failed:"
    printf '%s\n' "$OUT" | tail -12 | sed 's/^/      /'
    [ "$STATUS" = 0 ] && STATUS=2
  elif [ -n "$NOTE" ]; then
    printf '%s\n' "$NOTE"
  else
    echo "  $label $TOOL — ok, nothing survived and nothing was uncovered"
    [ -n "$PKEY" ] && touch "$PKEY"
    [ "$FIXED" -gt 0 ] && echo "      ($FIXED baselined survivor(s) now killed — --baseline banks them)"
  fi
done

if [ -n "$MISSING" ]; then
  echo "  UNPROVEN — no mutation tool for these, so their tests were never shown"
  echo "  to catch a break. Install per project:"
  printf '%s' "$MISSING"
  [ "$STATUS" = 0 ] && STATUS=2
fi

# .mutmut-baseline is part of the key, so a baseline's receipt is keyed after it is written.
[ "$MODE" = baseline ] && RECEIPT="/tmp/claude-shipgate-$(receipt_key)"

# The receipt is written by this script and nothing else. A hand-rolled check
# produces no receipt, which is the whole point: substituting a weaker check is
# a choice that can be argued for, but it cannot be passed off as this one.
echo
case $STATUS in
  0) echo "ship-gate: PASS"
     printf 'PASS %s\n' "$(date -u +%FT%TZ)" > "$RECEIPT" ;;
  1) echo "ship-gate: FAIL — deal with the findings above, then run this again."
     echo "           To ship anyway: bash .claude/hooks/ship-gate.sh --force"
     rm -f "$RECEIPT" ;;
  2) echo "ship-gate: UNPROVEN — nothing is wrong, but nothing was proven either"
     printf 'UNPROVEN %s\n' "$(date -u +%FT%TZ)" > "$RECEIPT" ;;
esac
exit $STATUS
