---
name: debugging
category: Foundations
description: "MUST USE when fixing a bug, diagnosing an error, stack trace, exception, crash, failing or flaky test, or any 'why is X not working / returning the wrong value' investigation in any language. Enforces root-cause-before-patching: reproduce, trace the failure backward to its origin, test one hypothesis, then fix once — instead of guarding the symptom. Also covers the 3-attempts-then-question-the-design rule."
---

# Debugging — Root Cause Before Patching

**The law: no fix without a root cause first.** A change that makes the symptom
disappear without explaining *why* it appeared is not a fix — it's a second bug
hiding the first. If you can't say what was wrong, you haven't fixed it.

The drain most people feel with debugging is thrashing: change something, re-run,
hope, repeat. The method below is *faster*, not more ceremonial — it replaces
guessing with tracing.

## The Method

1. **Reproduce** — get a reliable, minimal way to trigger the bug. No repro = no
   evidence your fix worked; you're just guessing in the dark.
2. **Trace backward** — read the *actual* error and stack trace. Start at the
   failure point and follow the data backward to where the bad value was born.
   Add logging at component boundaries (function entry, API edge, IPC seam) to
   see where good input becomes bad.
3. **Hypothesize** — state it out loud: *"I think X is the cause because Y."*
   Then test that one hypothesis with one minimal change.
4. **Fix once, then verify** — fix the origin, re-run the repro, confirm it passes
   *and* that you understand why.

## Symptom vs Cause

```js
// BAD: guard the symptom — the null is still arriving, now silently
function render(user) {
  if (!user) return null;        // error gone, root cause untouched
  return <Profile name={user.name} />;
}

// GOOD: trace backward — why is user null HERE?
// → useUser() returns null on a 401, and the caller mounts before auth resolves.
// The fix lives at the origin: gate the route on auth, or show a pending state.
```

The guard isn't wrong forever — but adding it *without knowing why user was null*
means you never learn it was an auth race, and the next screen hits it too.

## One Change at a Time

```
BAD:  bug is elusive → change the query, add a lock, bump the timeout, reorder
      the calls → it works now → ship it
      (You fixed nothing you can name. It'll come back and you won't know which
       change mattered — or which one added a new bug.)

GOOD: one hypothesis → one change → re-run the repro → didn't help? revert it
      before trying the next. Keep the diff minimal and explainable.
```

Reverting failed attempts matters: five stacked "maybe this" changes become their
own debugging problem.

## Reproduce Before You Touch Code

```
BAD:  "I can't reproduce it, but I think this is the fix" → push → "should be fixed"
GOOD: invest in a repro first — a failing test, a script, exact steps. A bug you
      can't trigger is a bug you can't confirm you fixed.
```

Turn the repro into a **failing test** when you can. It proves the bug exists, then
proves the fix works, then guards against regression — three jobs, one artifact.

## The 3-Attempt Rule

After **three** failed fix attempts on the same bug, **stop patching and question
the design.** Persisting past three usually means the bug isn't where you're
looking — the architecture is forcing it. Widen the frame: is the data model
wrong? Is a boundary in the wrong place? Is an assumption you never checked false?

## Red Flags — you've left the method

Language that signals you're guessing, not tracing. Stop when you catch yourself:

- "Let me just try…" / "Maybe if I…" — no hypothesis, just a slot-machine pull.
- "Quick fix for now" — a symptom guard you'll never come back to remove.
- "It works now" (but you can't say why) — the bug is dormant, not gone.
- "One more attempt" past the third — see the 3-attempt rule.
- Blaming the framework/compiler/"flaky" before reading your own stack trace.

## When a Mitigation IS Legitimate

Root-cause-first is not "never ship a stopgap." A deliberate mitigation is fine
when it's **honest and tracked**: you *know* the root cause, the real fix is large,
and you ship a guard **with a comment and a follow-up** naming what's deferred. The
anti-pattern is the *accidental* patch that hides a cause you never diagnosed.

## Rules

1. **Never change code to make an error disappear until you can name why it
   occurred.** Symptom-silencing is not fixing.
2. **Always reproduce first** — no repro, no proof the fix worked.
3. **Read the actual stack trace** before theorizing. Start at the failure, trace
   the data backward to its origin.
4. **Instrument at boundaries** (function entry, API edge, IPC/runtime seam) to
   locate where good input becomes bad.
5. **State one hypothesis, make one change, verify, revert if it didn't help.**
   Never stack speculative changes.
6. **Fix the origin, not the nearest catch site.**
7. **After 3 failed attempts, stop and question the design** — don't attempt a
   fourth patch in the same spot.
8. **Turn the repro into a failing test** whenever practical.
9. **A stopgap is only allowed when the root cause is known** and shipped with a
   comment + tracked follow-up. Never patch a cause you haven't diagnosed.
