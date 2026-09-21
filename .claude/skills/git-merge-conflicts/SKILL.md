---
name: git-merge-conflicts
category: Foundations
description: "MUST USE when a git merge, rebase, cherry-pick, stash pop, or revert stops with conflicts — 'CONFLICT (content)', 'Automatic merge failed', 'could not apply', unmerged paths, or leftover <<<<<<< markers in a file. Enforces resolve-by-intent: read both sides against the merge base, keep both behaviours where they are compatible, and never pick a side wholesale. Also covers the inverted meaning of ours/theirs during a rebase, conflicts git does not mark (semantic and tree), lockfiles and migrations that are regenerated rather than merged, and finishing the merge."
---

# Git Merge Conflicts — Resolve by Intent, Never by Side

**The law: a conflict is two intents, not two texts.** Until you can say what
each side was trying to do, you cannot decide what the merged code should do.
Picking a side to make the markers disappear silently deletes someone's work,
and the tests usually still pass — because the deleted behaviour had no test on
this branch.

**Never `--abort` to escape.** Aborting throws away the analysis you already
did and hands the same conflict to the next person. Resolve it.

## Step 1 — Orient before editing anything

Know which operation you are in. The commands to finish it differ, and so does
the meaning of "ours".

```bash
git status                                   # names the operation and the unmerged paths
git diff --name-only --diff-filter=U         # just the conflicted files
git log --oneline --graph -15 --all          # what is being combined
```

### `ours` and `theirs` invert during a rebase

This is the single most common way an agent deletes the right code.

| Operation | `--ours` / `HEAD` | `--theirs` |
|---|---|---|
| `git merge feature` | the branch you are on | `feature`, the incoming branch |
| `git rebase main` | `main`, the branch you are replaying **onto** | **your own commit** being replayed |

During a rebase your work is `theirs`. An agent that reaches for `--ours`
"to keep my changes" throws its own commit away.

```bash
# BAD — during a rebase this discards the commit you are replaying
git checkout --ours src/auth.ts
```

```bash
# GOOD — name the sides explicitly instead of trusting the labels
git show :2:src/auth.ts   # stage 2 = ours
git show :3:src/auth.ts   # stage 3 = theirs
git show :1:src/auth.ts   # stage 1 = the merge base
```

## Step 2 — Make the merge base visible

The default conflict style shows two sides and hides the ancestor, so you
cannot tell which side *changed* a line and which side merely *has* it.

```bash
# GOOD — show the base inside every conflict from now on
git config --global merge.conflictStyle zdiff3

# GOOD — re-render a file already in conflict, without redoing the merge
git checkout --conflict=zdiff3 -- src/auth.ts
```

Read it as three sides:

```
<<<<<<< HEAD
timeout: 30_000
||||||| base
timeout: 5_000
=======
timeout: 5_000, retries: 3
>>>>>>> feature/retries
```

Base says `5_000`. So HEAD raised the timeout, and `feature/retries` left the
timeout alone and added retries. The two intents do not collide at all — the
merged line is `timeout: 30_000, retries: 3`. Without the base you would have
guessed, and one of those changes would be gone.

## Step 3 — Recover each side's intent

Answer "why was this written" before you write anything.

```bash
git log --merge -p -- src/auth.ts     # only the commits either side made to this file
git log --oneline HEAD..MERGE_HEAD    # what the incoming branch did overall
gh pr list --search "auth timeout"    # the discussion behind the change
```

Commit messages, PR descriptions and linked issues are the primary sources.
A diff tells you what changed; only those tell you why.

## Step 4 — Resolve the hunk

```javascript
// BAD — keeps HEAD, and the rate-limit check the other side added is gone
async function login(email, password) {
  const user = await findUser(email)
  return issueToken(user)
}
```

```javascript
// GOOD — both intents survive: HEAD's lookup change and their rate limiting
async function login(email, password) {
  await assertNotRateLimited(email)
  const user = await findUser(email)
  return issueToken(user)
}
```

```javascript
// BAD — "merging" by inventing a third behaviour nobody wrote or reviewed
async function login(email, password) {
  const user = await findUser(email) ?? await createGuestUser(email)  // new!
  return issueToken(user)
}
```

Rules for a hunk:

- **Compatible intents → keep both.** Most conflicts are two edits near each
  other, not two edits against each other.
- **Genuinely incompatible → pick the one matching the merge's stated goal**,
  and say out loud which behaviour you dropped and why.
- **Never invent behaviour.** A resolution introduces no line that neither side
  wrote. If the correct merge needs new code, that is a follow-up commit, not a
  conflict resolution.
- **Never leave a marker.** Delete `<<<<<<<`, `|||||||`, `=======`, `>>>>>>>`.

## Step 5 — The conflicts git did not mark

Both sides can apply cleanly and still produce broken code. Git compares text;
it does not know your call graph.

```javascript
// HEAD renamed the function — no conflict, different file
export function findUserByEmail(email) { /* ... */ }
```

```javascript
// theirs added a call to the old name — no conflict, different file
const user = await findUser(email)   // now undefined at runtime
```

After every resolution, sweep for these:

```bash
git grep -n "findUser\b"                     # old name still called anywhere?
git diff --check                             # leftover conflict markers
git grep -n "^<<<<<<< \|^>>>>>>> "           # markers in files git no longer tracks as unmerged
```

The tree-level ones have no markers at all and are easy to skip past. Read the
two-letter codes in `git status --short`:

- `DU` / `UD` — one side deleted the file, the other edited it. Deleting wins
  only if you can show the edit is obsolete; otherwise restore and re-apply.
- `AA` — both sides added a file at the same path. Merge the contents; do not
  keep one and drop the other.
- `AU` / `UA` — added by one side while the other moved or renamed it.

```bash
# GOOD — decide a DU/UD explicitly instead of letting `git add .` pick
git checkout --theirs -- src/legacy-auth.ts   # keep the edited version
git rm src/legacy-auth.ts                     # or confirm the deletion
```

## Step 6 — Files you regenerate, never hand-merge

Hand-merging a generated file produces a file that matches neither side and
that no tool will ever reproduce.

```bash
# BAD — resolving package-lock.json hunk by hunk
```

```bash
# GOOD — take either side whole, then let the tool rewrite it
git checkout --theirs -- package-lock.json
npm install                                   # pnpm install / yarn / uv lock / poetry lock
git add package-lock.json
```

Same for build output, coverage reports, and committed snapshots — regenerate
and re-record rather than editing.

**Migrations conflict on order, not content.** Two branches each added a
migration whose parent is the same revision. Merging the text leaves two heads
and a database that cannot migrate. Fix the chain instead:

- **Alembic** — repoint the later migration's `down_revision` at the other one,
  or `alembic merge heads`. Verify with `alembic heads` (one head, not two).
- **Django** — `python manage.py makemigrations --merge`.
- **Drizzle / Prisma** — keep both SQL files, then regenerate the journal or
  the migration lock so ordering is single-valued.

Never renumber a migration that has already run in any shared environment.

## Step 7 — Prove it, then finish

Resolution is not done because the markers are gone. It is done when the
project's own checks pass.

```bash
# GOOD — discover what this repo actually runs, then run it
npm run typecheck && npm test          # or: pytest, cargo test, go test ./...
```

Fix what the merge broke before continuing. A merge commit that fails CI is a
conflict you resolved incorrectly.

```bash
git add -A
git merge --continue     # merge
git rebase --continue    # rebase — repeat until every commit is replayed
git cherry-pick --continue
```

**`git rebase --skip` drops your commit entirely.** Use it only when the change
is already present upstream and you have confirmed that by reading the diff.

### Let git remember repeated resolutions

A long rebase makes you resolve the same conflict on commit after commit.

```bash
git config --global rerere.enabled true
```

Git records each resolution and replays it when the identical conflict appears
again. Still read what it filled in — a recorded resolution is a past decision,
not a verified one.

## Rules

- Always name each side's intent before editing a hunk.
- Always turn on `zdiff3` so the merge base is visible in the conflict.
- Never trust `ours`/`theirs` during a rebase — your work is `theirs`.
- Never resolve by taking one side wholesale to make markers disappear.
- Always keep both behaviours when the two intents are compatible.
- Never introduce a line that neither side wrote.
- Always state which behaviour you dropped when the intents truly collide.
- Always sweep for semantic breakage: renamed symbols, moved files, changed signatures.
- Always read `git status --short` for `DU`, `UD`, `AA`, `AU`, `UA` — those have no markers.
- Never hand-merge a lockfile or generated file; take one side and regenerate.
- Always fix migration conflicts by repointing the chain, never by merging the SQL.
- Always run the project's typecheck and tests before continuing the merge.
- Never `git rebase --skip` unless you have read the diff and confirmed it is already upstream.
- Never `--abort` to escape a conflict you were asked to resolve.
