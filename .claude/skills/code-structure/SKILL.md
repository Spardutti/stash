---
name: code-structure
metadata:
  gate-paths: "**/*"
category: Foundations
description: "MUST USE when creating or editing any code file in any language — deciding how to split files, functions, classes, and modules, or whether to extract a shared helper, base class, or utility from duplicated code. Enforces the Single Responsibility Principle (one reason to change, file/function size limits, separation of concerns) and Avoid-Hasty-Abstractions (AHA / Rule of Three — prefer duplication over the wrong abstraction)."
---

# Code Structure — Responsibility & Abstraction

Two complementary disciplines decide how code is shaped. They pull in opposite directions, and good structure is the balance between them:

- **Single Responsibility (SRP)** — *when to split*. One unit, one job, one reason to change.
- **Avoid Hasty Abstractions (AHA)** — *when not to extract*. Duplication is cheap; the wrong abstraction is expensive.

The synthesis: **split on responsibility, never on shape or line count alone.** SRP tells you to separate two jobs that happen to sit in one file; AHA tells you not to merge two blocks that merely look alike.

## Quick Reference — When to Load What

| Working on… | Read |
|---|---|
| Splitting a file/function/class, separating concerns, file size | SINGLE-RESPONSIBILITY.md |
| Tempted to extract a helper/base class/utility from duplicated code | AVOID-ABSTRACTIONS.md |

## Hard Limits

Concrete, enforceable thresholds. Crossing one is a signal to split — not an automatic split, but a prompt to check for a second responsibility.

| Metric | Max | Action |
|--------|-----|--------|
| File length | 200 lines | Split into smaller modules |
| Function/method body | 30 lines | Extract helpers |
| Function parameters | 3 | Use an options/config object |
| Nesting depth | 3 levels | Early returns or extracted helpers |
| Cyclomatic complexity | 5 branches | Simplify or split |
| Class dependencies | 5 imports | The class knows too much — split |

## The Split Test (SRP)

Describe the unit in one sentence. If you need **"and"**, it has more than one responsibility.

```
"fetches the orders"                              → one job
"fetches the orders AND formats them for export"  → two jobs — split
```

A unit has **one reason to change** when it serves one actor. If the business team and the ops team would both edit the same file for unrelated reasons, that file has two responsibilities. See SINGLE-RESPONSIBILITY.md for separation of concerns (computation vs side effects, query vs command, policy vs mechanism).

## The Extraction Test (AHA)

Similar-looking code is **not** a reason to extract. Before pulling out a shared helper, all of these must hold:

1. The pattern appears **3+ times** with *identical intent* — not just identical shape.
2. You can name it for **what** it does, not **how** (`calculateTax`, not `processWithFlags`).
3. **No caller needs a boolean or mode parameter** to bend it to their case.
4. All callers would break together, for the same reason, if the logic were wrong.

```python
# BAD: extracted on shape — a flag now leaks caller-specific behavior
def send(user, kind):
    if kind == "welcome": ...
    elif kind == "reset": ...

# GOOD: two purpose-named functions; duplication is a vocabulary, not debt
def send_welcome(user): ...
def send_password_reset(user): ...
```

**Every boolean parameter hides two functions in a trench coat.** If extraction needs a flag, you found two functions, not one abstraction. See AVOID-ABSTRACTIONS.md for the failure pattern and how to undo a wrong abstraction.

## When NOT to Split

The two forces meet here. Keep code together when:

- Two things **always change together** and serve the same actor (verify with `git log`, not vibes).
- Splitting would add indirection with no testability gain.
- The unit is under ~30 lines and reads clearly as-is.
- Code is merely *coincidentally* similar — same shape, different intent. Leave it duplicated.

## Rules

1. **Describe a unit in one sentence without "and"** — if you can't, it has two jobs; split it.
2. **Separate computation from side effects**, and queries from commands (CQS).
3. **Never exceed 200 lines/file or 30 lines/function** — split before crossing, not after.
4. **Never nest deeper than 3 levels** — use early returns.
5. **Never mix levels of abstraction** in one function.
6. **Never extract on the second duplication** — wait for the third, and only if intent (not just shape) matches.
7. **Never add a boolean/mode parameter** to make a shared helper fit a new caller — split into purpose-named functions.
8. **Never extract a helper used in exactly one place.**
9. **Split on responsibility, never on line count or visual similarity alone.**
10. **Inline a wrong abstraction** before trying to "fix" it with more parameters.
11. **Don't over-split** — only split when there is a real second responsibility.

## Reference Files

- **SINGLE-RESPONSIBILITY.md** — read before writing a new file, function, class, or module, and when deciding how to split an existing one. The question is "how big may this get?", not "is this already too big?". Covers the hard-limit thresholds, separation of concerns (computation vs side effects, query vs command, policy vs mechanism), one-resource-per-class, levels of abstraction, early returns, pipeline-over-monolith, file organization, the SRP smell tests, and when *not* to split.
- **AVOID-ABSTRACTIONS.md** — read when tempted to extract a helper, base class, or shared utility from duplicated code. Covers the Rule of Three, the boolean-flag failure pattern, BAD/GOOD pairs (mode flags, inheritance misuse, single-use helpers, over-generic utilities), shape vs intent, when extraction *is* correct, and how to undo a wrong abstraction.
