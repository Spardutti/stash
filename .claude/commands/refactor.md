---
name: refactor
description: "Find code files with size, complexity, duplication, or coupling issues and refactor them"
category: Workflow
allowed-tools: Task, Glob, Bash(wc *), Read, Edit, Write, Grep
requires-agents: [refactor-size, refactor-complexity, refactor-duplication, refactor-coupling]
argument-hint: "[file-path] or leave empty to scan entire project"
---

# Refactor Code Issues

You are a code refactoring assistant. Find files with **size**, **complexity**, **duplication**, or **coupling** problems and refactor them into clean, focused modules.

## Refactoring Triggers

| Trigger        | Threshold                                                    |
|----------------|--------------------------------------------------------------|
| **Size**       | File exceeds 200 lines                                       |
| **Complexity** | Function has 3+ nesting levels, 5+ params, or 4+ branches   |
| **Duplication** | Near-identical code blocks (10+ lines) across 2+ files      |
| **Coupling**   | File imports from 8+ modules, or circular dependency exists  |

## Step 1 — Detect Issues (parallel subagents)

If the user passed a file path in `$ARGUMENTS`, skip the scan and go directly to Step 3 for that file.

Otherwise, spawn **all four detection subagents in parallel** using the Task tool in a single message:

- `refactor-size` — flags files over 200 lines
- `refactor-complexity` — flags deep nesting, 5+ params, 4+ branches
- `refactor-duplication` — flags 10+ line copy-paste across files
- `refactor-coupling` — flags 8+ imports and circular deps

Each returns a JSON array. Parallel fan-out keeps detection cheap (agents run on Haiku) and keeps file-read output out of the main context.

## Step 2 — Synthesize Findings

Merge the four JSON arrays into one sorted table (worst issues first):

```
Code issues found:

  File                              Issue         Detail
  src/services/api.ts               Size          342 lines (142 over)
  src/utils/helpers.py              Duplication   3 copies of parseDate() across files
  src/components/Dashboard.tsx      Complexity    renderStats() has 5 nesting levels
  src/controllers/order.ts          Coupling      imports from 12 modules

  Total: 4 files need refactoring
```

If every agent returned `[]`:

```
All files look clean. No refactoring needed.
```

Stop here if nothing found.

## Step 3 — Plan the Refactor

**1–3 files**: propose fixing **all** in one pass.
**4+ files**: propose fixing **one at a time**, starting with the worst.

Read each file fully, then show a plan based on the issue type:

### Size → Split by responsibility

**BAD** — one file doing too much (342 lines):
```ts
// src/services/api.ts — auth, users, orders, payments all in one file
export function login() { /* ... */ }
export function signup() { /* ... */ }
export function getUser() { /* ... */ }
export function updateUser() { /* ... */ }
export function createOrder() { /* ... */ }
// ...hundreds more lines
```

**GOOD** — split by responsibility, each file under 200 lines:
```ts
// src/services/api.ts (~45 lines) — shared client setup only
export { client } from "./client";

// src/services/auth-api.ts (80 lines)
export function login() { /* ... */ }
export function signup() { /* ... */ }

// src/services/user-api.ts (90 lines)
export function getUser() { /* ... */ }
export function updateUser() { /* ... */ }
```

### Complexity → Extract and simplify

**BAD** — deeply nested, hard to follow:
```ts
function process(items) {
  for (const item of items) {
    if (item.active) {
      if (item.type === "order") {
        for (const line of item.lines) {
          if (line.qty > 0) {
            // actual logic buried 4 levels deep
          }
        }
      }
    }
  }
}
```

**GOOD** — early returns + extracted helpers:
```ts
function process(items) {
  const active = items.filter(i => i.active && i.type === "order");
  for (const item of active) {
    processOrderLines(item.lines);
  }
}

function processOrderLines(lines) {
  for (const line of lines.filter(l => l.qty > 0)) {
    // logic at 1 nesting level
  }
}
```

### Duplication → Extract shared module

**BAD** — same logic in two files with different variable names:
```ts
// src/routes/users.ts
function formatUser(u) {
  const name = `${u.first} ${u.last}`.trim();
  const date = new Date(u.createdAt).toISOString().split("T")[0];
  return { name, date, active: u.status === "active" };
}

// src/routes/admins.ts
function formatAdmin(a) {
  const name = `${a.first} ${a.last}`.trim();
  const date = new Date(a.createdAt).toISOString().split("T")[0];
  return { name, date, active: a.status === "active" };
}
```

**GOOD** — shared module, single source of truth:
```ts
// src/utils/format-person.ts
export function formatPerson(p) {
  const name = `${p.first} ${p.last}`.trim();
  const date = new Date(p.createdAt).toISOString().split("T")[0];
  return { name, date, active: p.status === "active" };
}

// Both routes import from the shared module
import { formatPerson } from "../utils/format-person";
```

### Coupling → Break the cycle

**BAD** — circular dependency:
```ts
// src/services/order.ts
import { getUser } from "./user";      // order → user
export function createOrder(userId) { /* ... */ }

// src/services/user.ts
import { createOrder } from "./order";  // user → order  ← circular!
export function getUser(id) { /* ... */ }
```

**GOOD** — break the cycle with a third module:
```ts
// src/services/order.ts
import { getUser } from "./user";
export function createOrder(userId) { /* ... */ }

// src/services/user.ts              ← no longer imports order
export function getUser(id) { /* ... */ }

// src/services/user-orders.ts       ← new file owns the cross-cutting logic
import { getUser } from "./user";
import { createOrder } from "./order";
export function createUserOrder(userId) { /* ... */ }
```

**Ask the user to confirm before proceeding.**

## Step 4 — Refactor

For each approved file:

1. **Read the full file** — understand every export, import, and dependency
2. **Apply the fix** based on issue type:
   - **Size**: group by responsibility, create new files, each under 200 lines
   - **Complexity**: extract helper functions, flatten nesting with early returns, split large params into option objects
   - **Duplication**: create shared module, replace all copies with imports
   - **Coupling**: introduce facade/service layer, move logic to reduce import count
3. **Update all imports** — use Grep to find every file importing from changed modules, fix paths
4. **Re-export only if needed** — if the original file was a public barrel, keep re-exports

## Step 5 — Verify

After each refactor:

1. **Size**: count lines in all new/modified files — confirm all under 200
2. **Complexity**: confirm no function exceeds nesting/branching thresholds
3. **Duplication**: grep for the old duplicated code — confirm only one copy remains
4. **Coupling**: count imports in modified files — confirm under threshold
5. **Imports**: grep for old import paths — verify none are broken

Report:
```
Refactored src/services/api.ts (Size: 342 → 45 lines):
  ✔ Created src/services/auth-api.ts (80 lines)
  ✔ Created src/services/user-api.ts (90 lines)
  ✔ Updated 12 imports across 8 files
```

## Step 6 — Summary

```
Refactoring complete:
  Files refactored: 4
  New files created: 6
  Imports updated: 28
  Issues resolved:
    Size:        1 file  ✔
    Complexity:  1 file  ✔
    Duplication: 1 group ✔
    Coupling:    1 file  ✔
```

## Rules

- ALWAYS spawn the four detection agents in parallel (single message, four Task calls)
- ALWAYS read the full file before proposing any refactor
- ALWAYS update every import referencing moved exports — use Grep to find them all
- ALWAYS keep resulting files under 200 lines
- ALWAYS ask the user before starting each refactor
- NEVER delete or rename exports — everything must remain importable
- NEVER change function signatures or behavior — structural refactor only
- NEVER refactor test files unless they also have detected issues
- NEVER create barrel files unless the original was already one
- If a file is only slightly over on size (201–220), extract one small piece instead of a full split
- For complexity, prefer early returns and extraction over rewriting logic
- For duplication, the shared module owns the code — all consumers import from it
- For coupling, aim to cut import count by at least 40%
