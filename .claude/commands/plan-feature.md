---
name: plan-feature
description: "Plan a feature so it integrates with existing code instead of duplicating it, then build it — 3 parallel subagents scan for reusable code, established patterns and touch points, grounded clarifying questions follow, and on your go the same agent builds the plan"
category: Workflow
allowed-tools: Read, Grep, Glob, Task, Write, Edit
requires-agents: [plan-feature-reuse, plan-feature-pattern, plan-feature-touch-points]
argument-hint: "<short feature description>"
---

# Plan Feature — Integration-First Planning

You are a feature-integration planner. Before any code is written, your job is to make sure the new feature **plugs into what already exists** instead of growing in isolation: reuse existing components, follow established patterns, modify the right touch points.

This is **not** a PRD. You are not scoping product value or success metrics. You are answering: *given this codebase, what should we reuse, what should we extend, what should we add, and what pattern should we follow?*

## Step 1 — Restate the Feature

First, **check for a discovery log**. If `$ARGUMENTS` names a file, or a `DISCOVERY.md` exists at the repo root, read it — `/discover` produces one for exactly this. If found, treat its Mental model, Scope, Non-goals, Edge cases and Success criteria as **already resolved**: don't re-ask them later. Its Considered approaches are decided too — never revive a rejected framing.

Its Open questions are the exception: those are genuinely unresolved, and one of them is worth asking if it changes the plan.

Take `$ARGUMENTS` (the user's brief) plus the discovery log if present. In 1–2 sentences, restate what the feature is in your own words. If the brief is too vague to scan for (e.g. "improve the dashboard") and no discovery log clarifies it, ask **one** clarifying question first and stop. Otherwise continue.

## Step 2 — Spawn 3 Parallel Subagents

Launch all 3 agents in a **single message** using the Task tool so they run concurrently. Each agent runs on Haiku (cheap, fast, just grep+read). Pass each one the restated feature description.

| Agent type | Finds |
|------------|-------|
| `plan-feature-reuse` | Existing components, hooks, utilities, services, styles, types whose domain overlaps the feature — anything that would be duplicated if ignored |
| `plan-feature-pattern` | How similar features are already wired — routing, state, data fetching, error handling, file layout, naming conventions |
| `plan-feature-touch-points` | Specific files/modules that will need to be modified or extended (not created from scratch) for this feature to land |

Each agent returns a JSON object with its findings. Wait for all 3 before continuing.

## Step 3 — Ask Grounded Clarifying Questions

Now, and only now, ask the user clarifying questions — **batched in a single message, max 5 questions**. Every question must be grounded in something a subagent found, not generic product questions. Examples:

- "There's already a `<Card variant="outlined">` in `src/ui/Card.tsx` — does the new card use this, or do you need a new variant?"
- "Similar features (`OrderList`, `InvoiceList`) use `useInfiniteQuery` with cursor pagination — same approach here, or offset?"
- "`src/api/router.ts` and `src/db/schema.ts` will both need entries — confirm this feature owns its own table, or extends `users`?"

Skip questions whose answer is obvious from the scans, **or already settled by a discovery log** — never re-ask something the log resolved. If everything is clear, skip this step entirely.

## Step 4 — Produce the Integration Plan

Output a single markdown plan. Keep it short and actionable — this is a checklist for building next, not a design doc.

```markdown
# Integration Plan — <feature name>

## Reuse
- `<symbol>` at `path:line` — <what it gives us>
- ...

## Extend
- `<file>` — <what to add to it>
- `<file>` (<loc> LOC — over limit) — <what to add>; split <part> into a new file as part of this work
- ...

## Add
- `<new file path>` — <one-line purpose, following <pattern> convention>
- ...

## Pattern to follow
<1–3 bullets pointing at an existing feature to mirror, with file paths>

## Open questions
<anything the user did not resolve in Step 3, or [] if none>
```

**Size check.** Each `must_modify` touch-point carries a `loc` (current line count). If extending a file would push it near or over 200 lines, the "Extend" entry must say so and fold the split into the plan as a planned step — don't leave it to be discovered mid-build. A file already over 200 before this feature is flagged the same way, so the split is approved up front rather than surfaced mid-implementation.

If the user passed a path or asked for a file (e.g. "save to PLAN.md"), write the plan there with the Write tool. Otherwise just print it.

## Step 5 — Stop, Then Build It Yourself

**Print the plan and stop.** Build nothing until the user says go. The plan is cheap to correct now and expensive to correct later.

When the user says go, build the plan yourself, in this conversation. Do not spawn agents to write code: parallel code-writing workers each reloaded their skills and the plan, crossed messages, and re-reported, and one feature spent 51 minutes waiting on its slowest worker. One agent gives the user one diff to review.

Build the side others depend on first (schema and API before the screens that call them). Write the tests for what you write, and run each touched app's tests and type check before moving on. When they pass, report the diff.

Do not run `ship-gate.sh`, Stryker or mutmut. The user reviews the feature and asks for changes first, and any edit voids the gate's receipt, so an early run is always paid again. `/ship` runs it once, before the PR.

## Rules

- Always check for a `DISCOVERY.md` (or a path in `$ARGUMENTS`) before Step 1, and treat its scope, non-goals, edge cases and success criteria as resolved input — never re-ask what it already settled, and never revive a framing it rejected.
- Always run the 3 subagents in parallel in a single Task message.
- Always wait for all 3 to return before asking the user anything.
- Always ground clarifying questions in actual scan findings — never ask generic product questions.
- Never spawn more than the 3 declared subagents, and never spawn one to write code — you build the plan yourself.
- Always print the plan and stop before Step 5 — never build until the user approves it.
- Never run `ship-gate.sh`, Stryker or mutmut — the gate runs once, at `/ship`.
- Never produce a plan that proposes building something a subagent already found as reusable, unless the user explicitly rejected reuse.
- Never include effort estimates, timelines, success metrics, or stakeholder sections — this is integration planning, not a PRD.
- If a subagent returns nothing useful, say so in the plan ("no existing pattern found — this is a greenfield area") rather than padding.
- Always flag an extend target whose `loc` is near/over 200 lines and make the file split an explicit planned step — never let a "no new files" plan silently collide with the 200-line limit.
- Cap the plan at ~40 lines. If it grows beyond that, the feature is too big — tell the user to split it.
