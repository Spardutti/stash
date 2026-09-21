#!/usr/bin/env bash
# version-check.sh — SessionStart. Says once a day when a newer catalog exists.
#
# SessionStart stdout is added to the model's context, so this does not draw a
# banner: it tells the assistant, and the assistant mentions it. That is the
# whole reach of this hook — it never installs anything and never asks a
# question the user has to answer before working.
#
# The rule that keeps it invisible: NEVER touch the network in the foreground.
# A session start that waits on npm is a session start that hangs on a bad
# connection, and a version nudge is not worth one second of that. So it reads
# a cache written by the PREVIOUS session's background refresh, and kicks off
# the next refresh detached. The first session after an install therefore says
# nothing, and after that the answer is at worst a day old — which is the right
# resolution for "there is a new version" anyway.
#
# Silent when: no manifest, no cache yet, offline, already current, or the user
# has already been told today.
#
#   CLAUDE_SKILLS_NO_VERSION_CHECK=1   turns it off entirely

set -uo pipefail

[ -n "${CLAUDE_SKILLS_NO_VERSION_CHECK:-}" ] && exit 0

PKG="@spardutti/claude-skills"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
MANIFEST="$PROJECT_DIR/.claude/.claude-skills.json"

# No manifest means the CLI never installed here, so there is nothing to update.
[ -f "$MANIFEST" ] || exit 0

INSTALLED=$(sed -n 's/.*"catalogVersion"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$MANIFEST" | head -1)
[ -n "$INSTALLED" ] || exit 0

# One cache for the whole machine, not one per project: the answer is the same
# everywhere, and a developer with ten repos should still cost one request.
CACHE_DIR="${HOME:-/tmp}/.claude"
CACHE="$CACHE_DIR/.claude-skills-version"
STAMP="$CACHE_DIR/.claude-skills-version-told"
mkdir -p "$CACHE_DIR" 2>/dev/null

NOW=$(date +%s 2>/dev/null || echo 0)
DAY=86400

# Refresh in the background, fully detached. Nothing downstream waits on it: all
# three streams are closed, or the session start blocks until curl gives up.
refresh() {
  AGE=$DAY
  if [ -f "$CACHE" ]; then
    MTIME=$(date -r "$CACHE" +%s 2>/dev/null || echo 0)
    AGE=$((NOW - MTIME))
  fi
  [ "$AGE" -lt "$DAY" ] && return
  command -v curl >/dev/null 2>&1 || return
  ( curl -fsS --max-time 5 "https://registry.npmjs.org/$PKG/latest" \
      | sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
      | head -1 > "$CACHE.tmp" 2>/dev/null
    # Only replace the cache with something that parsed. A truncated reply that
    # overwrote it would nudge toward a version that does not exist.
    if [ -s "$CACHE.tmp" ]; then mv "$CACHE.tmp" "$CACHE"; else rm -f "$CACHE.tmp"; fi
  ) </dev/null >/dev/null 2>&1 &
}
refresh

[ -f "$CACHE" ] || exit 0
LATEST=$(head -1 "$CACHE" | tr -d '[:space:]')
[ -n "$LATEST" ] || exit 0
[ "$LATEST" = "$INSTALLED" ] && exit 0

# sort -V puts the newer one last. Equal versions were already handled, so the
# only case left to reject is a cache that is BEHIND the install — which happens
# normally right after publishing from the machine that publishes.
NEWER=$(printf '%s\n%s\n' "$INSTALLED" "$LATEST" | sort -V | tail -1)
[ "$NEWER" = "$LATEST" ] || exit 0

# Once a day, however many sessions that day holds.
if [ -f "$STAMP" ]; then
  TOLD=$(date -r "$STAMP" +%s 2>/dev/null || echo 0)
  [ $((NOW - TOLD)) -lt "$DAY" ] && exit 0
fi
: > "$STAMP"

echo "A newer version of the $PKG catalog is available: $INSTALLED installed, $LATEST published."
echo "Mention this to the user ONCE, in a single line, and only when the current task is done."
echo "Do not interrupt what they are doing, and do not run the installer unless they ask."
echo "To update, they run: npx $PKG"
exit 0
