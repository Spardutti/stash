---
name: ship
description: "Unified git delivery pipeline — gate → commit → PR → merge → release. A quality gate runs first and fixes what it finds; run with no argument to step through interactively; `ship pr` runs through PR creation; `ship release` runs the full pipeline through the GitHub release."
category: Workflow
allowed-tools: Bash, Read, Grep, Glob, Edit, Write, Task
requires-agents: [gauntlet-skills]
argument-hint: "[pr | release] [--force to skip the gate]"
---

# Ship — Commit → PR → Merge → Release

`/ship` is a four-stage git delivery pipeline. It detects where your work currently is, runs from there, and either stops at a target stage or asks you at each boundary.

Stages, in order: **commit → pr → merge → release**, with a **gate** in front of all of them.

## How /ship Decides What to Do

**Start** — auto-detected from git state (Step 0).
**Stop** — set by `$ARGUMENTS`:

| Invocation | Behavior |
|---|---|
| `/ship` | Interactive — run the start stage, then ask "continue to `<next>`?" at every boundary. Stop when you decline. |
| `/ship pr` | Run through the **pr** stage, then stop. |
| `/ship release` | Run the full pipeline through the **release** stage. |
| `/ship commit` / `/ship merge` | Run through that stage, then stop. |

Rules that always hold:
- **Never re-do a satisfied stage** — already committed? start at pr.
- **Never skip a required stage** — `/ship release` with uncommitted work runs commit → pr → merge → release first.
- A merge into the **main** branch always asks for confirmation, even when a target is set.
- The **gate** (Step 0.5) runs once per invocation, immediately before the **pr** stage — not before commit — unless `--force`. A run that only commits never pays for it. A release PR gets only the script, never the skills audit: every commit in it already passed the full gate in its own PR.

## Step 0 — Prechecks and Start Detection

### Prechecks (run first; abort cleanly on any)

```bash
git rev-parse --is-inside-work-tree   # not a git repo → STOP
git branch --show-current             # empty = detached HEAD → STOP, ask user to checkout a branch
git rev-parse HEAD                    # fails = repo has no commits
git remote                            # empty = no remote configured
```

- **Detached HEAD** (empty branch name) → STOP: "Detached HEAD — check out a branch first."
- **No commits yet** → if there are changes, the only possible stage is commit; otherwise STOP ("nothing to ship").
- **No remote** → the pr/merge/release stages cannot run; STOP before them with "No `origin` remote configured."
- **`gh` not installed or not authenticated** → required for the pr, merge, and release stages. Check `gh auth status` before any of them; if it fails, explain setup and STOP.

### Identify branches

```bash
git status --porcelain
git branch -r | grep -E 'origin/(main|master|develop|development|dev)$'
```

**main** branch: prefer `main` > `master`. **dev** branch: prefer `develop` > `development` > `dev`. The PR base is the dev branch if one exists, otherwise main.

### Detect the start — first match wins, in this order

1. **Uncommitted changes** (`git status --porcelain` non-empty) → start at **commit**.
2. Clean tree, **no PR** exists for the current branch, **commits ahead** of the base (`git log <base>..HEAD` non-empty) → start at **pr**.
3. An **open, unmerged PR** exists for the current branch → start at **merge**.
4. The current branch's PR is **already merged**, or you are on the **dev branch and it is ahead of main** → start at **release**.
5. Clean tree, no PR, nothing ahead of base → **done** — nothing to ship; say so and stop.

This order is exhaustive and the conditions do not overlap once evaluated top-down.

### Reconcile with the target

- If `$ARGUMENTS` names a target **earlier** than the detected start, the target is already satisfied. Do not say a bare "nothing to do" — show the existing artifact: e.g. `/ship pr` when a PR exists → "A PR already exists for this branch: `<URL>`." Then stop.
- If `$ARGUMENTS` names a target **later** than the start, state the plan and get **one** confirmation: *"You have uncommitted changes — `/ship release` will run commit → pr → merge → release. Proceed?"* Then run each stage to the target without further prompts — except a merge into main, which always confirms.
- If `$ARGUMENTS` is empty, run the start stage, then **ask before advancing** to each next stage.

Each stage below re-verifies its own precondition and aborts if Step 0 routed it wrong.

---

## Step 0.5 — The Gate

Runs **once**, immediately before the **pr** stage. `--force` in `$ARGUMENTS` skips it
entirely — no argument, no questions. Skip it too when there is nothing to check.

**Not before commit.** The gate's mutation scope is `merge-base..HEAD` — the whole branch,
because the whole branch is what a PR ships. Running it before every commit re-mutated
every file the branch had ever touched: a 46-file branch paid fifteen minutes on each of
twenty commits. A commit publishes nothing, so it is not gated. If a run stops at commit,
the gate never runs; the moment a run continues to pr or merge, it runs first.
Ask for it earlier with a bare `bash .claude/hooks/ship-gate.sh` when you want the
findings before the PR.

**Not in full before a release.** A release PR (dev → main) ships only commits that
already passed this gate in their own PRs, and auditing them again started a skills agent
over every file in the release. Before the release PR, run only the script. It compares
against the dev branch, so it finds nothing to check and finishes in seconds, and it
writes the receipt the PR needs. Skip the skills audit.

This is the one enforcement moment. It does not re-run the test suite: the `gauntlet.sh`
Stop hook already ran types and tests on every turn. It checks the three things nothing
else does, and **it fixes what it finds** rather than handing you a list.

Two of the three live in `ship-gate.sh` behind an exit code, and one — the skills audit —
lives here, because it is the only one that genuinely needs a model.

**Scope** — everything about to ship, and nothing else: `git diff <base>...HEAD` plus
`git diff HEAD` and untracked files. Collect the changed source files and their changed
line ranges (`git diff -U0`, reading `@@ -a,b +c,d @@` as lines `c` to `c+d-1`). Every
check below is scoped to those files and ranges. Never scan the whole repo.

Print the scope, then run the checks cheapest first, stopping at the first that stops you.

### 1 and 3 — file length, folder structure and mutation: run the script, obey the exit code

```bash
bash .claude/hooks/ship-gate.sh
```

These two are arithmetic and a tool invocation. They are deliberately **not** described
here as things to carry out, because a check written in prose is a check a model can
decide is not worth it — and that is exactly what happened the first time this gate ran.

So: run that command. Show its output verbatim. Obey its exit code.

- **0** — clean, continue.
- **1** — findings. A file over the limit stops you: splitting a file is a design
  decision, not something to do silently mid-ship. A new file outside its kind folder
  (`components/`, `hooks/`, `routers/` …) stops you too: move it. Surviving mutants are a gap in the
  tests, not in the code — write the test that closes each one (see below), then re-run
  the script.
- **2** — it ran but could not prove the tests, almost always because no mutation tool
  is installed. Report that plainly and continue. Do not describe this as passing.

A project that passed is not re-run until the gate or a changed file of its own kind
changes: fixing API tests does not re-run Stryker on the JS apps.

Python cannot be scoped to lines: mutmut has no per-line scoping, so the gate mutates
every function in each changed module, and a changed module's old survivors come back
with it. A `.mutmut-baseline` file holds the ones already accepted, and only a name
outside it fails. The first run covers the whole repo, writes that file and exits 2 —
commit it and run the gate again. After that, `--baseline` rewrites only the changed
modules' entries, reuses the last run's results when nothing changed since, and writes
the receipt itself — do not run the gate again after it. **Never run `--baseline` to
make a finding go away.** It accepts a survivor as permanent debt, so it is for a mutant
that genuinely cannot be killed — an equivalent mutant, where the change alters nothing
observable. Say which mutant and why, in the commit, or write the test instead.
A survivor in code that only runs at import — app setup, router registration — is
neither: mutmut forks after import, so that mutant never runs. Call the function from a
test, or mark it `# pragma: no mutate block, <reason>`; never baseline it as harmless.

**Never substitute your own implementation of these checks.** Not a hand-rolled mutation
script, not a `wc -l` you ran yourself, not a judgement that the changed files look too
simple to be worth mutating. If the script cannot run, say so and stop — a gate you
route around is not a gate.

You cannot report your way past this one, and you do not have to be trusted not to try:
the script writes a **receipt** keyed to the exact content about to ship, and a PreToolUse
hook refuses `git commit` and `git push` without a matching one. A check you designed
yourself writes no receipt. Editing a file after the gate ran invalidates it, so a fix is
re-gated rather than riding on the previous verdict. To publish without the gate, say so
plainly and run `bash .claude/hooks/ship-gate.sh --force`.

When a mutant survives, write the test that kills it, then verify the new test **fails
when the implementation is removed**. A test that passes without the code asserts
nothing and is worse than the gap it filled: throw it out and report the gap instead.
Re-run the script rather than declaring it fixed. Stop after **two** attempts at a gap.

### 2 — skills audit: one `gauntlet-skills` agent per applicable skill

This step was described in this file for months and never written, so it never ran. Four
forms shipped on `useActionState` in a repo whose React skill routes to a `FORMS.md`
saying React Hook Form is the default. Nothing opened it, because nothing was asked to.

**This is the only check that covers code the session did not write.** The `skill-gate.sh`
hook fires on Write/Edit/Bash, so a file that arrived in the tree some other way — written
before the gate existed, by another session, or by hand — reaches the commit having never
met a skill. The ship scope is where that is caught, or nowhere.

1. List the installed skills: `ls .claude/skills/*/SKILL.md`. If there are none, say so
   and skip to Result.
2. For each skill, decide whether the ship scope contains a file it applies to. A skill's
   `metadata.gate-paths` names its globs when it has them; otherwise use its
   `description`. A skill with no file in scope is not run — say which you skipped and
   why, in one line.
3. Launch every remaining skill's audit **in a single message** so they run at once, one
   `gauntlet-skills` agent per skill. Pass each exactly what its Input section asks for:
   the `SKILL.md` path, the changed files that skill applies to with their line ranges,
   and the unified diff for those files. One skill per agent — an agent given two skills
   half-reads both.
4. Wait for all of them. Each returns JSON with `violations`.

Then **fix what they found**, in the code, the same way stage 1 and 3 fixes what the
script found. Do not hand the user a list and continue.

- Apply each violation's `fix` where you agree with it. Editing a file invalidates the
  ship-gate receipt, so re-run `ship-gate.sh` afterwards — that is the design, not a
  problem.
- Where you disagree, say which violation and why, and leave the code alone. The agent
  audits a diff without knowing the conversation; it can be wrong.
- A violation you cannot fix without a design decision — a form that should be rebuilt on
  a different library, a file that needs splitting — **stops the ship**. That is the
  user's call, not a silent one.

Never audit a skill yourself instead of launching its agent. The point of the subagent is
that it reads the skill fresh, with no memory of having decided earlier that the skill did
not apply — which is exactly the failure this step exists to catch.

### Result

- **Everything fixed** → say what was fixed in one or two lines, then continue to the first stage. The fixes are part of the commit.
- **Stopped** → show what stopped you and why, and do not proceed. Offer `--force`.

---

## Stage: commit

Precondition: uncommitted changes exist; the current branch is **not** protected. If on a protected branch (`main`/`master`/`dev`/`develop`/`development`), STOP — ask whether this is a hotfix (create `hotfix/<desc>`) or which branch to create.

1. Review everything: `git status`, `git diff`, `git diff --staged`.
2. **Scan for secrets** before staging. Skip files by name (`.env`, `*.pem`, `*credentials*`, `*.key`) **and** scan the diff content for in-file secrets — high-entropy strings and key signatures (`AKIA…`, `-----BEGIN … KEY-----`, `xoxb-…`, bearer tokens). If anything matches, STOP and tell the user; recommend `gitleaks` / `git-secrets` as a pre-commit guard.
3. Group changes into **logical units of work**. Stage each group's files **explicitly** — never `git add .` / `git add -A`.
4. Commit each group: `type(scope): imperative description`. Types: `feat` `fix` `refactor` `docs` `style` `test` `chore` `perf` `ci` `build` `revert`. Breaking change → `type!:` + a `BREAKING CHANGE:` footer.
5. Show a summary — branch name and the commits created.

## Stage: pr

Precondition: changes committed, on a feature branch (not protected), commits ahead of the base, a remote exists, `gh` is authenticated.

1. Determine the base branch — the dev branch if one exists, otherwise main.
2. Review the whole branch: `git log <base>..HEAD --oneline`, `git diff <base>...HEAD --stat`.
3. Push: `git push -u origin HEAD`.
4. Create the PR. Pass the body via `--body-file` (or a stdin heredoc); pass the title as a single-quoted literal:

```bash
gh pr create --base <base> --title '<conventional title, ≤70 chars>' --body-file <file>
```

**The PR body is read by a reviewer who did not write the code.** They need the problem, what changed, and how to see it working. They do not need the reasoning behind every decision — that is a comment on the PR, not the body. Four sections, nothing else, under 250 words before the test plan:

- **Summary** — 1-3 bullets. What a person hit, and what they see now. Name the screen, the button, the report. Not the mechanism.
- **Changes** — one line per change, at most 8. A reason only where a reviewer would push back, and then one sentence. No paragraphs, no file tables.
- **Test plan** — numbered manual steps first: the page, the action, what you see. Then the commands that ran, with their counts. Every line a checkbox.
- **Ship gate** — one line. `clean`, or `forced — <what remains, in plain words>`. The finding list goes in a PR comment.

No other sections — no Review notes, Related, Decisions, Verification, Background. No tooling words a teammate would not know: say "a test gap the mutation tool found", not "a surviving mutant". A body that needs a sentence over 25 words is explaining, not describing — cut it.

5. Show the PR URL.

## Stage: merge

Precondition: an open PR exists for the current branch; `gh` is authenticated.

1. Check it is safe to merge:

```bash
gh pr view --json number,title,isDraft,mergeable,reviewDecision,statusCheckRollup
```

2. STOP and report — do not merge — if: `isDraft` is true, `mergeable` is `CONFLICTING`, CI is failing, or required reviews are missing.
3. Confirm the merge method (squash is the default for feature → dev — one clean commit per PR).
4. Merge and clean up: `gh pr merge <number> --squash --delete-branch`.
5. Sync local: `git checkout <dev>` (or main if no dev), `git pull`.

## Stage: release

Precondition: a dev branch exists and is ahead of main; `gh` is authenticated. If there is no dev branch, the project merges features straight to main — skip the release PR and tag main directly after the feature merge (steps 1-3, then 6-7).

1. **Version** — `git fetch --tags`; `git tag --sort=-v:refname | head -5`; `git log <latest-tag>..HEAD --oneline`. If there are **no commits since the last tag**, STOP — nothing to release. Suggest the next semver:
   - **1.x and above:** MAJOR for any `!` / `BREAKING CHANGE`, MINOR for any `feat`, else PATCH.
   - **0.x (pre-1.0):** a breaking change bumps MINOR (`0.3.x → 0.4.0`); `feat` and `fix` bump PATCH. Reserve `v1.0.0` for the first stable release.
   - No tags yet → suggest `v0.1.0`.
   - **Always confirm the version with the user.**
2. If the project has a version file (`package.json`, `pyproject.toml`, `Cargo.toml`, …), update it — and its lockfile (`package-lock.json`, `uv.lock`, …) — to the new version.
3. **Changelog** — for humans, not a commit log. Group commits since the last tag under Breaking Changes, Added, Changed, Fixed, Removed — only the groups that apply. One line per change, written as what a person can now do or what works now, with the PR number. No field names, file names, or commands in a bullet. Skip merge, version-bump, and internal-only noise. Steps someone must run after deploy go in an **After deploy** checklist at the end. No theme paragraph, no essay.
4. **Release PR** — `git checkout -b release/<version>`, push, run `bash .claude/hooks/ship-gate.sh` (the script only — no skills audit, see Step 0.5), then `gh pr create --base <main> --title 'release: <version>' --body-file <file>` (changelog + a checklist).
5. **Merge to main** — confirm with the user first (always). When CI is green, merge with **`gh pr merge --merge`** — a real merge commit, **not** `--squash`: squashing dev→main would collapse the feature commits and destroy the conventional-commit history that future version and changelog detection depends on.
6. **Tag + GitHub release**:

```bash
git checkout <main> && git pull
git tag -s -a <version> -m 'Release <version>'   # signed + annotated; -a alone if no signing key
git push --follow-tags
gh release create <version> --title '<version>' --notes-file <file>
```

7. Show the release URL.

---

## Flow Examples

- **`/ship` on a dirty feature branch** → commits, asks "create a PR?" → "merge it?" → "cut a release?". Decline at any point to stop.
- **`/ship pr`** → commits if needed, pushes, creates the PR, stops. If a PR already exists, reports its URL and stops.
- **`/ship release` with everything already merged** → starts at the release stage and runs version → changelog → release PR → merge → tag.
- **`/ship release` on a dirty branch** → one upfront confirmation, then commit → pr → merge → release straight through.

## Rules

- NEVER commit to `main`/`master`/`dev`/`develop`/`development` directly — feature branch, or `hotfix/<desc>`.
- NEVER `git add .` / `git add -A` — stage explicit files. Scan staged content for secrets, not just filenames.
- NEVER target `main` for a feature PR when a dev branch exists.
- NEVER tag or create a GitHub release before the release PR is merged into main.
- NEVER merge a PR that is a draft, has conflicts, has failing CI, or is missing required reviews — stop and report.
- NEVER squash the release PR into main — use a merge commit so the feature history survives for future changelog/version detection.
- NEVER run the skills audit before a release PR — its commits already passed it; run only `ship-gate.sh`.
- NEVER interpolate a branch name, tag, version, or title containing shell metacharacters (`` ` ``, `$(`, `;`, `&&`, `|`) into a command — pass interpolated values as single-quoted literals, pass PR/release bodies via `--body-file`/stdin, and abort if such a value contains metacharacters.
- ALWAYS run the skills audit — one `gauntlet-skills` agent per applicable skill, all launched in one message. NEVER audit a skill yourself instead: the agent reads it fresh, with no memory of having decided it did not apply.
- NEVER skip a skill because the diff "looks fine" — skip it only when no file in the ship scope matches it, and say which you skipped.
- ALWAYS fix what the audit finds, re-running `ship-gate.sh` afterwards because the edits invalidate its receipt; a violation needing a design decision stops the ship rather than being noted and passed.
- ALWAYS use conventional commits, imperative mood, atomic per logical unit.
- ALWAYS detect main/dev branches and the PR base automatically; apply 0.x semver rules for pre-1.0 projects.
- ALWAYS confirm the release version, and confirm before any merge into `main`.
- ALWAYS run stages in order — skip satisfied stages, never skip required ones; each stage re-verifies its precondition.
- With no `$ARGUMENTS`, ask before advancing to each next stage; with a target set, confirm once upfront then run through (a merge into `main` still asks).
- If a target is already satisfied, report the existing artifact (branch, PR URL, tag) — never a bare "nothing to do".
- Verify `gh auth status` before the pr, merge, and release stages; if it fails, explain setup and stop.
