---
name: stash
description: Read and write the user's Stash todos for the current project. Use when the user mentions a todo, their stash, "add this to my list", "what's left", or asks what to work on next.
---

# Stash todos

Stash keeps one JSON file per project. Always go through the script. Never edit the JSON by hand.

```
node ~/.claude/skills/stash/stash.mjs <command>
```

## Commands

| Command | Does |
|---|---|
| `projects` | Lists every project name with its pending count. |
| `list <project>` | Lists pending todos, top first: short id, then the label if it has one, else the text. `!` marks priority. |
| `add <project> "text" [--label "short name"]` | Adds a todo at the top. Fills id, dates and order. |
| `done <project> <id>` | Marks a todo done. The id can be the 8-char short id from `list`. |
| `delete <project> <id>` | Removes a todo for good. Only when the user asks to delete. |

`<project>` is the project's `name` or its file name, any case.

## Pick the project

1. Run `projects`.
2. Match the current folder name against the project names, any case.
3. One clear match: use it.
4. No match, or more than one: ask the user which project.

## Labels

Give a todo a `--label` when its text runs over 3 lines or 160 characters. The app shows the label in place of the long text.

- Keep the label to a few words that name the task.
- Put the full detail in the text.

## After writing

The Stash app shows changes the next time its window gets focus.
