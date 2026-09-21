# Avoid Hasty Abstractions (AHA)

Duplication is cheap. The **wrong abstraction** is expensive — it infects every caller with parameters, flags, and conditionals that grow forever.

> "Prefer duplication over the wrong abstraction." — Sandi Metz

## Contents

- The core rule
- The failure pattern to recognize
- BAD/GOOD pairs (mode flags, boolean creep, inheritance, single-use helpers, over-generic utilities)
- When extraction IS correct
- Shape vs intent
- Undoing a wrong abstraction
- Smell tests
- Rules
- Anti-rationalizations

## The Core Rule

- **2 occurrences:** leave them duplicated.
- **3 occurrences:** *consider* extracting — only if the shape is obvious and the name is clean.
- **Can't name it cleanly?** It's not an abstraction yet. Leave it duplicated.
- **Extracting requires a flag/mode/boolean?** Wrong abstraction. Inline it back.

## The Failure Pattern to Recognize

```
1. Two similar blocks exist.
2. Someone extracts a shared helper. Feels clean.
3. New requirement arrives — almost fits the helper.
4. A boolean param is added: doThing(x, { skipValidation: true }).
5. Another requirement: another flag. Then a mode string.
6. Helper is now a maze of conditionals serving no caller well.
7. Every change to any caller risks breaking the others.
```

The fastest way out: **inline it back into each caller**, then see what the real pattern is.

## BAD / GOOD Pairs

### 1. Two duplicates → premature extract with a mode flag

```python
# BAD: extracted too early; now a flag leaks caller-specific behavior
def send_notification(user, message, kind):
    if kind == "welcome":
        subject, template, cc_support = f"Welcome, {user.name}", "welcome.html", False
    elif kind == "password_reset":
        subject, template, cc_support = "Reset your password", "reset.html", True
    else:
        raise ValueError(kind)
    recipients = [user.email] + (["support@co.com"] if cc_support else [])
    smtp.send(subject, render(template, user=user, message=message), recipients)

# GOOD: two purpose-named functions; small shared primitive only
def send_welcome(user):
    smtp.send(f"Welcome, {user.name}", render("welcome.html", user=user), [user.email])

def send_password_reset(user, message):
    body = render("reset.html", user=user, message=message)
    smtp.send("Reset your password", body, [user.email, "support@co.com"])
```

The duplicated `render` + `smtp.send` lines are *not* a problem — they're a vocabulary, not an abstraction.

### 2. Boolean-parameter creep

```typescript
// BAD: every caller passes a different flag combination
function fetchUser(id: string, opts: {
  includeDeleted?: boolean; withPosts?: boolean; skipCache?: boolean; raw?: boolean;
} = {}) {
  const cache = opts.skipCache ? null : userCache.get(id);
  if (cache && !opts.raw) return cache;
  const user = db.one(opts.includeDeleted ? qAll(id) : qActive(id));
  if (opts.withPosts) user.posts = db.many(qPosts(id));
  if (!opts.skipCache) userCache.set(id, user);
  return user;
}

// GOOD: one function per real use case; no flags
function getUser(id: string) {
  return userCache.get(id) ?? userCache.set(id, db.one(qActive(id)));
}
function getUserWithPosts(id: string, limit = 10) {
  const user = db.one(qActive(id));
  user.posts = db.many(qPosts(id, limit));
  return user;
}
function getUserIncludingDeleted(id: string) {
  return db.one(qAll(id));
}
```

Rule of thumb: **every boolean parameter hides two functions in a trench coat.**

### 3. Inheritance that should have stayed duplicated

```typescript
// BAD: "shared" base class where subclasses override half the methods
abstract class ReportBase {
  abstract fetchData(): Row[];
  abstract formatRow(r: Row): string;
  render() { return this.fetchData().map((r) => this.formatRow(r)).join("\n"); }
}
class AuditReport extends ReportBase {
  fetchData() { return auditRepo.all(); }
  formatRow(r: Row) { return `[${r.actor}] ${r.action}`; }
  render() { return "=== AUDIT ===\n" + super.render(); } // fighting the base
}

// GOOD: two small, independent functions. No inheritance, no coupling.
function renderSalesReport(): string {
  return salesRepo.all().map((r) => `${r.date} ${r.amount}`).join("\n");
}
function renderAuditReport(): string {
  const body = auditRepo.all().map((r) => `[${r.actor}] ${r.action}`).join("\n");
  return `=== AUDIT ===\n${body}`;
}
```

### 4. Extracting a helper that's only used once

```go
// BAD: 4-line "helper" used in exactly one place
func formatUserLabel(u User) string {
    if u.DisplayName != "" { return u.DisplayName }
    return u.Email
}
func RenderHeader(u User) string { return "Hello, " + formatUserLabel(u) }

// GOOD: inline it; the indirection wasn't buying anything
func RenderHeader(u User) string {
    name := u.DisplayName
    if name == "" { name = u.Email }
    return "Hello, " + name
}
```

Extract when the helper earns its name by being *called from multiple places* or by *hiding real complexity*. Not before.

### 5. "Generic" utility that needs the caller to configure it

```python
# BAD: a "flexible" helper whose config is longer than inlining it
def process_items(items, *, filter_fn=None, map_fn=None, group_by=None,
                  sort_key=None, reverse=False):
    out = items
    if filter_fn: out = [x for x in out if filter_fn(x)]
    if map_fn:    out = [map_fn(x) for x in out]
    if sort_key:  out = sorted(out, key=sort_key, reverse=reverse)
    if group_by:
        g = {}
        for x in out: g.setdefault(group_by(x), []).append(x)
        return g
    return out

# GOOD: just write the pipeline; it's clearer and shorter
def report_by_customer(orders):
    paid = (o for o in orders if o.status == "paid")
    groups = {}
    for o in paid:
        groups.setdefault(o.customer, []).append(o.total)
    return groups
```

## When Extraction IS Correct

Extract when **all** of these hold:

1. The pattern appears 3+ times with *identical intent*, not just identical shape.
2. You can name it for **what** it does, not **how** (`calculateTax`, not `processWithFlags`).
3. No caller needs a boolean/mode parameter to bend it to their case.
4. Callers would break together for the same reason if the logic is wrong.

If any of these fail, keep duplicating.

## Shape vs Intent

Two blocks can look identical and still mean different things. Ask: *if the business rule changed for one, would I want the other to change too?*

- **Same intent** → one abstraction (e.g. "format currency for display").
- **Coincidentally same shape** → leave duplicated (e.g. two validators that both happen to loop with an `if`).

Coincidental duplication is the most common source of wrong abstractions.

## Undoing a Wrong Abstraction

1. Inline the abstraction back into every caller.
2. Delete the shared helper.
3. Look at the now-duplicated callers side-by-side.
4. The **real** abstraction (if any) will be obvious — or you'll see there isn't one.

Do not try to fix a wrong abstraction by adding another parameter. That's how it got wrong in the first place.

## Smell Tests

You have a wrong abstraction if:

1. The helper takes a boolean or `mode` string.
2. Most callers pass different option combinations.
3. You can't explain what it does without saying "and" or "or".
4. Changing it for one caller requires testing every other caller.
5. Its name is generic: `process`, `handle`, `manage`, `doStuff`, `utility`.
6. A base class has abstract methods that subclasses override inconsistently.
7. You reach for it once and then write the logic inline anyway because it didn't fit.

## Rules

- Never extract on the second duplication — wait for the third, and only if the shape is clear.
- Never add a boolean parameter to make a shared helper fit a new caller — split it instead.
- Never extract a helper that's used in exactly one place.
- Always prefer two purpose-named functions over one generic function with a `mode` argument.
- Always inline a wrong abstraction before trying to "fix" it with more parameters.
- Always ask "would both callers change for the same business reason?" before extracting.
- Never name an abstraction `process`, `handle`, `manage`, or `doStuff` — if that's the best name, it's not an abstraction.
- Never build a base class whose subclasses need to override its orchestration methods.
- Always prefer coincidental duplication to coincidental coupling.

## Anti-Rationalizations

| Excuse | Rebuttal |
|--------|----------|
| "I see this pattern twice, let me extract it now" | Two is coincidence. Wait for three and check the shape actually matches. |
| "I'll just add a boolean flag to handle the new case" | Boolean flags are how a wrong abstraction grows. Split into two purpose-named functions instead. |
| "The duplication is ugly, I should DRY it up" | Wrong abstraction costs more than duplication. Verify both callers change for the same reason first. |
| "I can fix the abstraction by adding another parameter" | That's how it got wrong. Inline back to duplication, then re-abstract from scratch if a real shape emerges. |
| "I'll generalize now to save time later" | You'll pay now AND later — once for building it, again for unwinding it when the needs diverge. |
| "The base class with template methods is cleaner" | Until subclasses need to override orchestration. Prefer composition; inheritance locks in the wrong assumptions. |
