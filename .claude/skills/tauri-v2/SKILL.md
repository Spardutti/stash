---
name: tauri-v2
category: Desktop
description: "MUST USE when writing or editing Tauri v2 apps — IPC commands, plugins, window management, system tray, global shortcuts, capabilities/permissions, events, and state management."
---

# Tauri v2 Best Practices

## IPC Commands

```rust
// BAD: sync command — blocks UI thread
#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

// GOOD: async command — runs on separate thread
#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(path).await.map_err(|e| e.to_string())
}
```

Register commands:
```rust
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![read_file, save_data])
    .run(tauri::generate_context!())
    .expect("error running tauri app");
```

Call from frontend — import from `@tauri-apps/api/core` (not `api/tauri`):
```typescript
import { invoke } from "@tauri-apps/api/core";
const content = await invoke<string>("read_file", { path: "/tmp/data.txt" });
```

**Naming:** Rust `snake_case` args map to JS `camelCase` automatically.

## Error Handling

```rust
// BAD: returning String errors — frontend can't distinguish error types
#[tauri::command]
async fn login(user: String) -> Result<String, String> {
    Err("failed".into())
}

// GOOD: tagged errors — frontend can match on kind
#[derive(Debug, thiserror::Error)]
enum AppError {
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error("not found: {0}")]
    NotFound(String),
}

impl serde::Serialize for AppError {
    fn serialize<S: serde::ser::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(self.to_string().as_ref())
    }
}

#[tauri::command]
async fn load_config(app: tauri::AppHandle) -> Result<Config, AppError> {
    let path = app.path().app_config_dir()?;
    Ok(serde_json::from_str(&tokio::fs::read_to_string(path).await?)?)
}
```

## App State

```rust
// BAD: wrapping in Arc — Tauri already does this
let state = Arc::new(Mutex::new(AppState::default()));
app.manage(state);

// GOOD: just wrap in Mutex for interior mutability
#[derive(Default)]
struct AppStateInner { counter: u32, last_file: Option<String> }
type AppState = Mutex<AppStateInner>;

tauri::Builder::default()
    .manage(AppState::default())

// Access in commands
#[tauri::command]
async fn increment(state: tauri::State<'_, AppState>) -> Result<u32, String> {
    let mut s = state.lock().map_err(|e| e.to_string())?;
    s.counter += 1;
    Ok(s.counter)
}
```

**State rules:** Each managed type must be unique. Two `.manage(String)` calls — only first is used. Wrong type in `State<'_, T>` causes runtime panic.

## Accessing Context in Commands

```rust
#[tauri::command]
async fn do_work(
    window: tauri::WebviewWindow,  // calling window
    app: tauri::AppHandle,          // app handle
    state: tauri::State<'_, AppState>, // managed state
) -> Result<(), AppError> {
    println!("Called from window: {}", window.label());
    Ok(())
}
```

## Plugins — Core Features Moved to Plugins in v2

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_global_shortcut::init())
    .plugin(tauri_plugin_shell::init())
```

### File System

```typescript
import { readTextFile, writeTextFile, exists, mkdir, BaseDirectory } from "@tauri-apps/plugin-fs";

const config = await readTextFile("config.json", { baseDir: BaseDirectory.AppConfig });
await writeTextFile("data.json", JSON.stringify(data), { baseDir: BaseDirectory.AppData });
```

### Dialog

```typescript
import { open, save, ask } from "@tauri-apps/plugin-dialog";
const file = await open({
  multiple: false,
  filters: [{ name: "JSON", extensions: ["json"] }],
});
const confirmed = await ask("Delete this item?", { title: "Confirm", kind: "warning" });
```

## Event System

```rust
// Rust → Frontend
use tauri::Emitter;
app.emit("download-progress", ProgressPayload { pct: 50 })?;
app.emit_to("main", "file-opened", path)?;  // target specific window
```

```typescript
// Frontend listener — MUST unlisten on cleanup
import { listen } from "@tauri-apps/api/event";

useEffect(() => {
  const unlisten = listen<ProgressPayload>("download-progress", (event) => {
    setProgress(event.payload.pct);
  });
  return () => { unlisten.then((fn) => fn()); };
}, []);
```

**Channels for streaming** (preferred over events for command-scoped data):
```rust
#[tauri::command]
async fn download(url: String, on_progress: tauri::ipc::Channel<ProgressEvent>) {
    on_progress.send(ProgressEvent::Started).unwrap();
    on_progress.send(ProgressEvent::Done).unwrap();
}
```
```typescript
import { invoke, Channel } from "@tauri-apps/api/core";
const onProgress = new Channel<ProgressEvent>();
onProgress.onmessage = (msg) => console.log(msg);
await invoke("download", { url: "...", onProgress });
```

## Window Management

```rust
// BAD: sync window creation — deadlocks on Windows
#[tauri::command]
fn open_settings(app: tauri::AppHandle) {
    tauri::WebviewWindowBuilder::new(&app, "settings", tauri::WebviewUrl::App("settings.html".into()))
        .build().unwrap();
}

// GOOD: async window creation
#[tauri::command]
async fn open_settings(app: tauri::AppHandle) -> Result<(), AppError> {
    tauri::WebviewWindowBuilder::new(
        &app, "settings", tauri::WebviewUrl::App("settings.html".into())
    )
    .title("Settings")
    .inner_size(600.0, 400.0)
    .build()?;
    Ok(())
}
```

## System Tray

```rust
// Cargo.toml: tauri = { features = ["tray-icon"] }
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState};

tauri::Builder::default()
    .setup(|app| {
        let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
        let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
        let menu = Menu::with_items(app, &[&show, &quit])?;

        TrayIconBuilder::new()
            .icon(app.default_window_icon().unwrap().clone())
            .menu(&menu)
            .menu_on_left_click(false)
            .on_menu_event(|app, event| match event.id.as_ref() {
                "quit" => app.exit(0),
                "show" => {
                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                }
                _ => {}
            })
            .build(app)?;
        Ok(())
    })
```

## Global Shortcuts

```rust
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState, GlobalShortcutExt};

#[cfg(desktop)]
app.handle().plugin(
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|_app, shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                println!("Shortcut: {:?}", shortcut);
            }
        })
        .build(),
)?;
app.global_shortcut().register(Shortcut::new(Some(Modifiers::CONTROL), Code::KeyN))?;
```

## Capabilities & Permissions

Create `src-tauri/capabilities/default.json`:
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-set-title",
    { "identifier": "fs:allow-read", "allow": [{ "path": "$APPDATA/**" }] },
    { "identifier": "fs:deny-read", "deny": [{ "path": "$APPDATA/secrets/**" }] },
    "dialog:default",
    "global-shortcut:allow-register"
  ]
}
```

## Rules

1. **Always** make commands `async` — sync commands block the UI and deadlock window creation on Windows
2. **Always** register plugins with `.plugin()` — v2 moved fs/dialog/shell/shortcuts out of core
3. **Always** define capabilities for every plugin permission — no implicit allowlist
4. **Always** call `unlisten()` in frontend cleanup — event listeners leak memory
5. **Always** guard desktop-only plugins with `#[cfg(desktop)]`
6. **Never** wrap managed state in `Arc` — Tauri handles this internally
7. **Never** manage two values of the same type — only the first is used
8. **Prefer** `std::sync::Mutex` over `tokio::Mutex` unless holding across `.await`
9. **Prefer** Channels over events for command-scoped streaming data
10. **Prefer** scoped permissions (`$APPDATA/**`) over broad access (`$HOME/**`)
