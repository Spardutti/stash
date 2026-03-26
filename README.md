<p align="center">
  <img src="public/logo.png" alt="Stash" width="80" />
</p>

<h1 align="center">Stash</h1>

<p align="center">
  <strong>Lightning-fast task management for people who hate leaving their flow.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.15.0-blue" alt="Version" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="Platform" />
  <img src="https://img.shields.io/badge/built%20with-Tauri%20v2-orange" alt="Tauri" />
</p>

---

Stash is a desktop app that lets you capture and organize tasks **without breaking focus**. Press a global hotkey, type your task, hit Enter -- done in under 5 seconds. No browser tabs, no context switching, no friction.

## Features

- **Instant Capture** -- `Ctrl+Space` opens a floating popup to add a task from anywhere on your desktop
- **Project-Based Organization** -- Group tasks by project, switch between them with `Ctrl+P`
- **Drag & Drop Reordering** -- Prioritize tasks by dragging them into place
- **Quick View** -- Glance at your tasks from the system tray without opening the full app
- **Keyboard-First** -- Every action has a shortcut; your hands never leave the keyboard
- **Dark & Light Themes** -- A clean, dense UI inspired by developer tools
- **Lightweight** -- ~10MB binary, instant startup, zero cloud dependencies
- **Local Storage** -- Your data stays on your machine as plain JSON files

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Space` | Quick-add a task (global, works from any app) |
| `Ctrl+Shift+Space` | Quick-view tasks from tray |
| `Ctrl+P` | Project switcher |
| `Ctrl+N` | New project |
| `Ctrl+L` | Focus task input |
| `Ctrl+D` | Delete all completed tasks |

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | [Tauri v2](https://v2.tauri.app/) (Rust) |
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS 4, Geist font |
| State | Zustand |
| Animations | Motion (Framer Motion) |
| Drag & Drop | dnd-kit |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

### Development

```bash
# Install dependencies
npm install

# Start the dev server + Tauri window
npm run tauri dev
```

### Build

```bash
# Create a production binary
npm run tauri build
```

The compiled app will be in `src-tauri/target/release/bundle/`.

### Tests

```bash
npm test
```

## Data Storage

Stash stores everything locally as JSON files:

| OS | Location |
|---|---|
| Windows | `%APPDATA%/stash/` |
| macOS | `~/Library/Application Support/stash/` |
| Linux | `~/.local/share/stash/` |

No accounts, no servers, no telemetry. Your tasks are yours.

## License

MIT
