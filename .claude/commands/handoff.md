---
name: handoff
description: "Write a handoff document so a fresh session can pick the work up — captures what auto-compaction loses: the decisions made and rejected, the dead ends already ruled out, why the tree is dirty, and the one next step. Links to specs, commits, and PRs instead of restating them"
category: Workflow
allowed-tools: Bash(git *), Read, Grep, Glob, Write
argument-hint: "[what the next session will focus on]"
---

# Handoff — Hand the Work to a Fresh Session

You are writing for **an agent with no memory of this conversation**, working in
this same repo, starting from zero.

Auto-compaction already summarizes the transcript, and it decides what survives.
This does the opposite: you decide, deliberately, and it lands in a file that
outlives the session.

## What this is not

- **Not a transcript summary.** Nobody needs the story of how you got here.
- **Not a restatement of the diff.** The next agent runs `git diff` itself.
- **Not a plan.** That's `/plan-feature`. If a plan already exists, link it.

## Step 1 — Read the real state, don't recall it

Your memory of the tree is stale. Check it.

```bash
git status --short                 # what is uncommitted, and why it matters
git log --oneline -10              # what already landed
git diff --stat                    # size and shape of the work in flight
git branch --show-current
```

## Step 2 — Decide what only exists in this conversation

That is the whole content of the document. Everything else is already on disk.

Ask of each candidate line: **could a fresh agent get this from the repo?**

- Yes → cut it. Link the path, the commit, or the PR instead.
- No → keep it. Decisions, rejected alternatives, dead ends, open questions.

```markdown
<!-- BAD — the next agent can read all of this itself -->
## What we did
We added a `git-merge-conflicts` skill at `skills/git-merge-conflicts/SKILL.md`.
It is 253 lines and covers `zdiff3`, rebase `ours`/`theirs`, tree conflicts,
and lockfiles. We also added a README row and bumped the version to 2.22.0.
```

```markdown
<!-- GOOD — none of this survives anywhere but the chat -->
## Decided
- Skill, not command: it should auto-activate when the gate fires on a
  conflicted file, and a command would need to be remembered.
- Category `Foundations`, matching `debugging` — language-agnostic craft.

## Ruled out
- Porting Matt Pocock's 14-line version verbatim — under the repo's 150-line
  floor, and it omits the rebase `ours`/`theirs` inversion, which is the
  failure that actually costs work.
```

## Step 3 — Write the document

Path: `.claude/handoffs/<YYYY-MM-DD>-<short-slug>.md`. Create the directory if
it does not exist. Use these sections, and **drop any section that would be
empty** — an empty heading costs the next agent a read for nothing.

```markdown
# Handoff — <one-line subject>

## Mission
One sentence. What we are trying to achieve, not what we did.

## State
Landed: <commit subjects or "see git log -N">
In flight: <what is half-done, and where it stops>
Uncommitted: <every dirty path in git status, and why it is dirty>

## Decided
- <decision> — <why>

## Ruled out
- <approach> — <why it failed or was rejected>

## Open questions
- <question> — <who or what answers it>

## Next step
The single concrete action to take first.

## Load first
Skills: <names to call the Skill tool for>
Commands: <slash commands this work uses>
Files: <paths worth reading before touching anything>

## Pointers
<spec / plan / PR / issue links and paths — never their contents>
```

**Uncommitted work is the highest-value section.** A fresh agent opening a dirty
tree has no idea whether it is half-finished work, an abandoned experiment, or
someone else's. Name every dirty path and say which it is.

**Redact secrets.** No API keys, tokens, passwords, connection strings, or
personal data. If a value matters, name the variable, not the value.

## Step 4 — Tell the user how to resume

Print exactly this, with the real path:

```
Handoff written: .claude/handoffs/<file>.md

Next session, paste:
  Read .claude/handoffs/<file>.md and continue.
```

If `$ARGUMENTS` is set, treat it as the focus of the next session and bias every
section toward it — cut decisions that no longer bear on that focus.

## Rules

- Always read `git status` and `git log` before writing; never write state from memory.
- Never restate what a fresh agent can get from the repo — link the path instead.
- Always record rejected alternatives, not just the chosen one.
- Always explain every uncommitted path in the tree.
- Never write a chronological summary of the conversation.
- Always end with exactly one concrete next step.
- Always drop sections that would be empty.
- Never include secrets, tokens, or personal data.
