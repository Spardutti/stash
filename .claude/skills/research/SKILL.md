---
name: research
category: Foundations
description: "MUST USE when asked to research, look up, investigate, or find out how something works — a library's API, a tool's config schema, a spec, a version's behaviour, 'what changed in X', 'does Y support Z' — and whenever you are about to state a fact about an external tool you have not opened this session. Enforces primary sources over recollection: route to the right lookup tool, follow every claim to the source that owns it, run the tool's own validator instead of guessing, and mark what stayed unverified."
---

# Research — Open the Source, Don't Recall It

**The law: no factual claim about an external thing without a source you opened
this session.** Your training data has a cutoff and the tool shipped a release
after it. A confident wrong answer costs more than the thirty seconds the lookup
would have taken, because the user acts on it.

**One investigation at a time.** Follow a single thread, let each answer pick the
next question. Do not fan out parallel agents across a question — five agents
returning five partial reads is harder to reconcile than one careful pass.

## Step 1 — Route to the tool that owns the answer

Reaching for a web search first is the common mistake. Most questions have a
tool that holds the authoritative answer directly.

| Question | Go here first |
|---|---|
| Library or framework API, config, migration | Context7 (`resolve-library-id`, then `query-docs`) |
| This repo's history, PRs, issues, releases | `git log`, `git show`, `gh pr view`, `gh release view` |
| A CLI's flags, subcommands, schema | the binary itself — `<cmd> --help`, `<cmd> validate` |
| An installed package's real behaviour | read it in `node_modules/` or `site-packages/` |
| A spec, RFC, or vendor doc | WebFetch the official URL |
| You don't know the URL yet | WebSearch to **find** it, then WebFetch the source |

WebSearch finds the door. It is not the room.

## Step 2 — Primary sources only

A primary source is the one that *owns* the fact: the vendor's docs, the
project's own source, the spec, the tool's own output.

```
BAD  — a 2024 blog post explaining a config format
BAD  — a Stack Overflow answer with 200 upvotes
BAD  — an LLM-written listicle summarising the docs
BAD  — your own memory of the docs
```

```
GOOD — https://code.claude.com/docs/en/plugins-reference
GOOD — the package's own README at the installed version
GOOD — `claude plugin validate .` printing the actual schema error
```

If a secondary source is all you can find, say so and mark the claim
**UNVERIFIED**. Do not launder it into a fact by restating it confidently.

## Step 3 — Read the scope of the rule, not just the rule

The most expensive research failure is not a missing source. It is reading a
true statement and applying it where it does not hold.

```
BAD — the doc says declaring `commands` replaces the default scan,
      so declaring it in the marketplace entry will replace the scan.
```

```
GOOD — the doc says that about `plugin.json`. It says nothing about a
       marketplace entry. That is untested — verify it or mark it UNVERIFIED.
```

Every rule has a subject. Before you apply one, ask what it was said *about*.
When the doc's context and yours differ, you have a hypothesis, not a finding.

## Step 4 — Prefer the check over the read

When the thing you are researching ships a validator, a dry-run, or a type
check, run it. Its output is a primary source and it cannot be misread.

```bash
claude plugin validate .        # the schema, from the thing that enforces it
tsc --noEmit                    # the compiler's opinion, not yours
alembic heads                   # the real migration state
<cmd> --help                    # the flags that exist at this version
```

Reading tells you what should be true. Running tells you what is.

## Step 5 — Pin the version you are actually on

Documentation sites serve `latest`. You are not on `latest`. A flag that exists
in the docs and not in your lockfile is a bug report waiting to happen.

```bash
# GOOD — find the version first, then research that version
node -p "require('./package.json').dependencies.react"
npm ls drizzle-orm
pip show fastapi
claude --version
```

Then read the installed copy, which cannot be the wrong version:

```bash
grep -rn 'export declare' node_modules/drizzle-orm/index.d.ts
python -c "import fastapi, inspect; print(inspect.getsourcefile(fastapi))"
```

When the answer is version-dependent, say which version it holds for. "Supported
since 2.1.239" is a finding. "Supported" is a trap.

## Step 6 — When sources disagree, behaviour wins

Docs go stale. The running tool does not.

```
BAD  — the docs say it replaces the default, so the observed behaviour
       must be a caching problem or a bad install.
```

```
GOOD — the docs say it replaces the default. Installing it shows all nine
       commands still loaded. The behaviour is the finding; the doc is
       either stale or scoped to a case that is not mine.
```

When you contradict a document, say so explicitly and show the evidence. A
finding that quietly disagrees with the official docs and does not mention it
will be overturned by the next person who reads them.

## Step 7 — Mark every claim

Carry the confidence with the claim, in the answer and in any file you write.

- **VERIFIED** — you opened the owning source, or ran the check. Cite it.
- **INFERRED** — it follows from something verified, but nothing states it.
- **UNVERIFIED** — you could not confirm it. Say what would confirm it.

```markdown
BAD  — Plugins can scope commands per-entry.
```

```markdown
GOOD — `plugin.json` `commands` replaces the default scan. **VERIFIED** —
       https://code.claude.com/docs/en/plugins-reference
       Whether a marketplace entry does the same is **UNVERIFIED** — the docs
       do not say. Confirm by installing one and listing loaded commands.
```

An answer with three verified claims and one honest gap is worth more than four
claims that all sound equally certain.

## Step 8 — Know when to stop

Stop when any of these is true:

- You reached the source that owns the fact. That is the end, not a checkpoint.
- Two independent primary sources agree.
- You have followed the thread out and the remaining questions do not change
  what the user will do.

Do not keep reading to feel thorough. Report what you have with its marks.

If you are blocked — the doc does not cover it, the source is paywalled, the
behaviour is undocumented — say that plainly and name the experiment that would
settle it. Do not fill the gap with a plausible guess.

## Step 9 — Write it down only if it will be re-read

```
Answer in chat  — a one-off lookup, a flag, a version number, a yes/no.
Write a file    — findings someone will act on later, or that cost real effort.
```

When you write one, put it where the repo already keeps notes — match the
existing convention, and if there is none, say where you put it. One Markdown
file, one citation per claim, marks included.

Record the **negative results** too. "We tried X, it does not work, here is the
error" is the finding that stops the next person repeating the work.

## Rules

- Never state a fact about an external tool from memory — open the source.
- Always route to the owning tool before reaching for a web search.
- Always use WebSearch to find the URL, then read the source itself.
- Never cite a blog, forum answer, or summary as a primary source.
- Always check what a rule was said *about* before applying it elsewhere.
- Always run the validator, dry-run, or type check when one exists.
- Always mark each claim VERIFIED, INFERRED, or UNVERIFIED.
- Never present an inference as a finding.
- Always name the experiment that would settle an unverified claim.
- Never fan out parallel agents across one question — follow one thread.
- Always stop once you reach the source that owns the fact.
- Always establish the version before researching version-dependent behaviour.
- Always trust observed behaviour over a document that contradicts it, and say which doc you contradict.
- Always record negative results, not just what worked.
