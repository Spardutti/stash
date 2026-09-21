#!/usr/bin/env bash
# Sourced by ship-gate.sh: which project owns a file, how it runs mutmut, and
# whether a project's last clean verdict still stands.

# mutmut is installed into the project's environment, not onto PATH. Ask the
# project how to run its own tools before falling back to a bare binary.
py_mutmut() {
  d="$1"
  # Returned relative to the PROJECT, because the command runs from inside it.
  # Tests that need a database, a queue, or any other service cannot run on the
  # host: mutmut still generates every mutant and reports them all "not
  # checked", which prints exactly like a clean run. An executable .mutmut-run
  # in the project runs mutmut wherever those services are — typically
  # `docker compose run` against the app container — and takes precedence over
  # every host-local option below.
  if [ -x "$d.mutmut-run" ]; then printf './.mutmut-run\n'; return; fi
  if [ -x "$d.venv/bin/mutmut" ]; then printf './.venv/bin/mutmut\n'; return; fi
  if [ -f "$d""uv.lock" ] && command -v uv >/dev/null 2>&1; then printf 'uv run mutmut\n'; return; fi
  if [ -f "$d""poetry.lock" ] && command -v poetry >/dev/null 2>&1; then printf 'poetry run mutmut\n'; return; fi
  command -v mutmut >/dev/null 2>&1 && printf 'mutmut\n'
}

owner_of() {
  d=$(dirname "$1")
  while :; do
    if [ -f "$d/package.json" ] || [ -f "$d/pyproject.toml" ] \
       || [ -f "$d/pytest.ini" ] || [ -f "$d/setup.cfg" ]; then
      printf '%s\n' "${d#./}"; return
    fi
    [ "$d" = "." ] || [ "$d" = "/" ] && { printf '.\n'; return; }
    d=$(dirname "$d")
  done
}

# mutmut records every mutant "not checked" when it stops before testing one.
# Blaming an unreachable database for that sent one agent chasing Docker for 20 minutes.
mutmut_unchecked() {  # mutmut_unchecked <label> <base> <count> <run log>
  echo "  $1 mutmut — UNPROVEN: $3 mutant(s) were never run."
  # "Failed to run pytest with args" is one line carrying every selected test id — 20KB of
  # them on one repo — so the line is cut. Unlisted, the gate blamed a database instead.
  stop='Failed to run clean test|failed to collect stats|Failed to collect list of tests|Stopping early|Failed to run pytest with args|BadTestExecutionCommandsException'
  if grep -aqsE "$stop" "$4"; then
    echo "      mutmut stopped before testing a single mutant:"
    grep -aE "^(FAILED|ERROR) |^[A-Za-z]*Error: |$stop" "$4" | tail -8 | cut -c1-200 | sed 's/^/        /'
    echo "      It runs the whole suite, then these tests again in one process, so a"
    echo "      test that passes alone can fail here on state an earlier test left."
    echo "      mutmut hides pytest's own error: set debug = true under [tool.mutmut]"
    echo "      and run it again to read it."
    return
  fi
  echo "      They are recorded \"not checked\", so the suite proved nothing"
  echo "      about them. Usually the tests need a service this run cannot"
  echo "      reach — a database, a queue. Put an executable .mutmut-run in"
  echo "      ${2}that runs mutmut where those services are, typically"
  echo "      docker compose run against the app container; the gate uses"
  echo "      it ahead of every host-local option."
}

# mutmut forks after importing the app, so code that only runs at import survives
# every mutant. One agent baselined 39 of those as harmless.
survivor_list() {  # survivor_list <survivors> <tool>
  printf '%s\n' "$1" | sed 's/^/      /'
  [ "$2" = mutmut ] || return 0
  echo "      Only runs at import (app setup, router registration)? Then it is unreachable,"
  echo "      not equivalent — see testing-best-practices/MUTATION-TESTING.md."
}

changed_files() {
  { git diff "$BASE"...HEAD --name-only 2>/dev/null
    git diff HEAD --name-only 2>/dev/null
    git ls-files --others --exclude-standard 2>/dev/null; } | sort -u
}

# Ignored extensions are left out; see the comment where ship-gate.sh first calls this.
receipt_key() {
  { printf '%s\n' "$PROJECT_DIR"
    changed_files | grep -viE "\.($GAUNTLET_IGNORE_EXT)$" | while IFS= read -r f; do
      [ -n "$f" ] || continue
      printf '%s\n' "$f"
      [ -f "$f" ] && cat "$f"
    done; } | git hash-object --stdin
}

# A scoped --baseline replaces only the changed modules' names. Rebuilding the whole
# file re-mutated an entire API to accept eleven of them.
baseline_write() {  # baseline_write <baseline file> <survivors file> <scope regex, or empty>
  if [ -z "$3" ]; then cp "$2" "$1"; return; fi
  grep -vE "^($3)\.x" "$1" | cat - "$2" | sort -u > "$1.new"
  mv "$1.new" "$1"
}

family_of() {  # js, py, or any when no manifest says
  o=$(owner_of "$1")
  if [ -f "$o/package.json" ]; then echo js
  elif [ -f "$o/pyproject.toml" ] || [ -f "$o/pytest.ini" ] || [ -f "$o/setup.cfg" ]; then echo py
  else echo any
  fi
}

# A project's verdict can only move when the gate or a changed file of its own
# kind moves, so fixing the API's tests no longer re-runs Stryker on two JS apps.
project_key() {  # project_key <owner> <tool>
  fam=$(family_of "$1/.")
  { printf '%s\n' "$PROJECT_DIR" "$1" "$2" "$(git rev-parse "$BASE" 2>/dev/null)" \
      "$GAUNTLET_NO_MUTATE" "$GAUNTLET_IGNORE_FILES"
    cat "$HERE/ship-gate.sh" "$HERE/ship-gate-projects.sh"
    printf '%s\n' "$CHANGED" | grep -vE '\.(md|mdx|txt|rst|adoc)$' | while IFS= read -r f; do
      [ -n "$f" ] || continue
      case "$(family_of "$f")" in "$fam"|any) printf '%s\n' "$f"; [ -f "$f" ] && cat "$f" ;; esac
    done; } | git hash-object --stdin
}

# A page test renders a whole screen, so it "kills" mutants in every util that screen calls.
# Backoffice ran 23 minutes that way, and hid 104 mutants no logic test checked.
stryker_page_tests() {  # stryker_page_tests <base> <label>
  grep -qs configFile "$1"stryker.conf* && return 0
  pages=$(git ls-files -co --exclude-standard -- "${1:-.}" | grep -E '\.test\.[jt]sx$' \
          | grep -vE '/(hooks|queries)/|(^|/)\.stryker-tmp/' | head -3)
  [ -n "$pages" ] || return 0
  echo "  $2 stryker — UNPROVEN: page tests count as proof for logic, e.g."
  printf '%s\n' "$pages" | sed 's/^/        /'
  echo "      Give Stryker a Vitest config that runs logic tests only — see"
  echo "      testing-best-practices/MUTATION-TESTING.md, \"Keep Page Tests Out Of The Run\"."
  [ "$STATUS" = 0 ] && STATUS=2
}
