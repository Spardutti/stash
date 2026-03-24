# TaskFlow — Product Requirements Document
### Version 1.0 | Status: Ready to Build

---

## Problem

Switching apps to log a thought kills flow. You're deep in work, something comes up, and by the time you've opened your todo app, navigated to the right project, and typed it out — you've lost your train of thought. TaskFlow fixes this.

**Core loop:** Hotkey → popup → project selected → type → Enter → back to work. Under 5 seconds.

---

## Users

Solo developer / creator managing multiple active projects simultaneously, context-switching frequently, working on Windows 11.

---

## Features

### Projects

| Feature | Detail |
|---|---|
| Create project | Name input, created instantly |
| Rename project | Inline edit on double-click or edit button |
| Delete project | Confirmation prompt, deletes JSON file |
| Export project | Save single project as `projectname.json` |
| Import project | Load a `projectname.json` into workspace |
| Export workspace | Save all projects as `taskflow-workspace.json` |
| Import workspace | Load full workspace, merge or replace option |
| Project switcher | `Ctrl+P` opens fuzzy-search palette over all projects |

---

### Todos

| Feature | Detail |
|---|---|
| Add todo | Always-visible input pinned at top of list |
| Edit todo | Click to edit inline, `Enter` or blur to save |
| Delete todo | Delete button on hover |
| Copy todo | Copy button on hover — copies text to clipboard |
| Mark done | Checkbox or click — done items sink to bottom of list |
| Mark pending | Click done item — returns to top of pending list |
| Drag & drop | Reorder within pending section and within done section |
| Filter | Tab bar: **All** / **Pending** / **Done** |
| Delete all done | Bulk action button, confirmation prompt |

**Sorting rules:**
- Pending todos: user-defined order (drag & drop), newest at top by default
- Done todos: always below pending, sorted by completion time (most recent first)

---

### Quick-Add Popup (Global Hotkey)

The killer feature. Triggered from anywhere on the OS.

| Behaviour | Detail |
|---|---|
| Trigger | User-defined hotkey set in Settings (e.g. `Ctrl+Shift+Space`) |
| Pre-selection | Last active project is pre-selected |
| Project switch | Dropdown in popup — click or press `Tab` to cycle, type to fuzzy filter |
| Add & dismiss | Press `Enter` to save, `Esc` to cancel — focus returns to previous app |
| Position | Centered on screen, floating above all windows |
| After save | Popup disappears, todo added to selected project silently |

---

### Settings

| Setting | Detail |
|---|---|
| Global hotkey | Click to record — press any key combo, saved immediately |
| Theme | Light / Dark toggle |

---

## Storage

```
%APPDATA%/
  taskflow/
    settings.json
    projects/
      my-game.json
      shallow-hope.json
      personal.json
```

### Project JSON schema

```json
{
  "id": "abc123",
  "name": "Shallow Hope",
  "createdAt": "2026-03-23T10:00:00Z",
  "todos": [
    {
      "id": "xyz789",
      "text": "Fix collision detection on level 3",
      "done": false,
      "createdAt": "2026-03-23T10:05:00Z",
      "doneAt": null,
      "order": 0
    }
  ]
}
```

### Settings JSON schema

```json
{
  "theme": "dark",
  "hotkey": "Ctrl+Shift+Space",
  "lastProjectId": "abc123"
}
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+P` | Open project switcher |
| `[Global hotkey]` | Open quick-add popup (OS-wide) |
| `Tab` | Cycle project in quick-add popup |
| `Enter` | Save todo (input or popup) |
| `Esc` | Close popup / cancel edit |
| `Ctrl+D` | Delete all done todos (with confirmation) |

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Runtime | Tauri v2 | ~10MB binary, uses system WebView2, no bundled browser |
| Frontend | React + Vite | Fast dev, huge ecosystem |
| Drag & drop | @dnd-kit | Best-in-class, smooth, accessible |
| Animation | Framer Motion | Interactions that feel good |
| State | Zustand | Simple, no boilerplate |
| Storage | JSON files via Tauri fs plugin | Git-friendly, human-readable, ready for GH sync in V2 |
| Fonts | Geist | Clean, modern, not generic |

---

## Out of Scope for V1

- GitHub sync (V2 — storage format already compatible)
- Due dates
- Priority levels
- Tags / labels
- Sub-tasks
- Mobile
- Multi-user / sharing

---

## V2 Preview: GitHub Sync

Since projects are stored as plain JSON files, the V2 GitHub sync is straightforward:

1. User points TaskFlow at a GitHub repo in Settings
2. On save → auto-commit + push changed project JSON
3. On open → pull latest from remote
4. Conflict resolution: last-write-wins or manual merge prompt

No database migration needed. V1 storage is V2 storage.

---

*TaskFlow — capture fast, stay in flow.*
