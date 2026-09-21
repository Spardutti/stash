#!/usr/bin/env bash
# Sourced by ship-gate.sh: a new file must sit in the folder named for its kind.
# Only ADDED files are judged, so a repo laid out the old way cannot get worse and need not move.

STRUCTURE_JS_KINDS="components|hooks|api|queries|schemas|types|utils|stores|test"
STRUCTURE_KIND_FILE='(^|[._])(router|routes|controller|service|schema|model)s?\.[cm]?[jt]s$|(Router|Routes|Controller|Service|Schema|Model)s?\.[cm]?[jt]s$'

# --no-renames: a move must show up as an add, or renaming a misplaced file would slip through.
added_files() {
  { git diff --no-renames --diff-filter=A --name-only "$BASE"...HEAD 2>/dev/null
    git diff --no-renames --diff-filter=A --name-only HEAD 2>/dev/null
    git ls-files --others --exclude-standard 2>/dev/null; } | sort -u
}

has_subject() {  # has_subject <test path>: a file the test is named for, beside it or above its __tests__/
  d=$(dirname "$1")
  [ "${d##*/}" = __tests__ ] && d=$(dirname "$d")
  stem=$(basename "$1" | sed -E 's/\.(test|spec)\.[^.]+$//')
  while :; do
    for e in ts tsx js jsx mjs cjs astro; do [ -f "$d/$stem.$e" ] && return 0; done
    case "$stem" in *.*) stem=${stem%.*} ;; *) return 1 ;; esac
  done
}

feature_misplaced() {  # feature_misplaced <path below features/<name>/>
  case "$1" in
    index.*) ;;
    */*) printf '%s' "${1%%/*}" | grep -qxE "$STRUCTURE_JS_KINDS" \
           || echo "${1%%/*}/ is not a kind folder ($STRUCTURE_JS_KINDS)" ;;
    *) echo "loose at the feature root, where only index.* belongs" ;;
  esac
}

js_misplaced() {  # js_misplaced <path> <owner>
  f=$1; b=${f##*/}; parent=$(basename "$(dirname "$f")")
  if printf '%s' "$b" | grep -qE '\.(test|spec)\.[^.]+$'; then
    printf '%s' "/$f" | grep -qE '/(e2e|tests?)/' && return
    has_subject "$f" || echo "a test sits beside the file it tests, and nothing here is named ${b%%.*}"
    return
  fi
  rest=$(printf '%s' "/$f" | sed -nE 's#.*/features/[^/]+/##p')
  if [ -n "$rest" ]; then feature_misplaced "$rest"; return; fi
  kinds="components|hooks|queries|api|schemas|types|utils"
  grep -qs '"express"' "$2/package.json" && kinds="$kinds|routes|controllers|services|middleware|models"
  if printf '%s' "/$f" | grep -qE "/src/($kinds)/"; then
    echo "sorted by kind first; it belongs in <domain>/<kind>/ or shared/<kind>/"
  elif printf '%s' "$b" | grep -qE '^use[A-Z].*\.[jt]sx?$' && ! printf '%s' "/$f" | grep -qE '/(hooks|queries)/'; then
    echo "a hook belongs in hooks/ or queries/"
  elif printf '%s' "$b" | grep -qE "$STRUCTURE_KIND_FILE" \
       && ! printf '%s' "$parent" | grep -qxE 'routes|controllers|services|schemas|models|api|queries|types'; then
    echo "the kind is in the filename; it belongs in a kind folder"
  fi
}

py_misplaced() {  # py_misplaced <path>
  f=$1; b=${f##*/}; d=$(dirname "$f"); parent=${d##*/}
  case "$b" in
    test_*.py|*_test.py|conftest.py)
      printf '%s' "/$f" | grep -qE '/tests/' || echo "tests live under tests/, mirroring the app"
      return ;;
  esac
  k=$(printf '%s' "$b" | sed -nE 's/^(.*_)?(router|service|schema|model)s?\.py$/\2/p')
  if [ -n "$k" ] && [ "$parent" != "${k}s" ]; then
    echo "the kind is in the filename; it belongs in ${k}s/"
  elif printf '%s' "$parent" | grep -qxE 'routers|services|schemas|models' && [ -f "$(dirname "$d")/main.py" ]; then
    echo "sorted by kind first; it belongs in <domain>/$parent/"
  fi
}

structure_check() {
  bad=""; count=0
  while IFS= read -r f; do
    [ -f "$f" ] && ! is_ignored "$f" || continue
    printf '%s' "/$f" | grep -qE '/(node_modules|\.stryker-tmp|mutants)/' && continue
    o=$(owner_of "$f")
    case "$f" in
      *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.astro) why=$(js_misplaced "$f" "$o") ;;
      *.py) grep -qis fastapi "$o/pyproject.toml" || continue; why=$(py_misplaced "$f") ;;
      *) continue ;;
    esac
    count=$((count+1))
    [ -n "$why" ] && bad="$bad  $f — $why
"
  done <<< "$(added_files)"
  echo
  if [ -n "$bad" ]; then
    echo "STRUCTURE — new files outside their kind folder:"
    printf '%s' "$bad"
    echo "  Move them (Project Structure in the react, fastapi or express skill), or ship with --force."
    echo
    return 1
  fi
  echo "STRUCTURE — ok, $count new file(s) in their kind folder"
  echo
}

# Called when nothing else in the diff is gated, so the gate would otherwise pass it.
structure_fail() {
  echo "ship-gate: FAIL — deal with the findings above, then run this again."
  echo "           To ship anyway: bash .claude/hooks/ship-gate.sh --force"
  rm -f "$RECEIPT"
  exit 1
}
