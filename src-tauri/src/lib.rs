use tauri::Emitter;
use tauri::tray::{TrayIconBuilder, TrayIconId};
use tauri::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem};
use tauri::Manager;

fn handle_tray_menu_event(app: &tauri::AppHandle, event: MenuEvent) {
    match event.id().as_ref() {
        "open" => {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }
        "quick-add" => {
            let _ = app.emit("tray-quick-add", ());
        }
        "quit" => {
            let _ = app.emit("tray-quit-requested", ());
        }
        _ => {}
    }
}

#[tauri::command]
async fn create_tray(app: tauri::AppHandle) -> Result<(), String> {
    // Don't recreate if it already exists
    if app.tray_by_id(&TrayIconId::new("main-tray")).is_some() {
        return Ok(());
    }

    let open_item = MenuItem::with_id(&app, "open", "Open Stash", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let quick_add_item = MenuItem::with_id(&app, "quick-add", "Quick Add", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let separator = PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?;
    let separator2 = PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?;
    let quit_item = MenuItem::with_id(&app, "quit", "Quit Stash", true, None::<&str>)
        .map_err(|e| e.to_string())?;

    let menu = Menu::with_items(
        &app,
        &[
            &open_item,
            &separator,
            &quick_add_item,
            &separator2,
            &quit_item,
        ],
    )
    .map_err(|e| e.to_string())?;

    let mut builder = TrayIconBuilder::with_id("main-tray")
        .menu(&menu)
        .tooltip("Stash — Task Management")
        .show_menu_on_left_click(true)
        .on_menu_event(handle_tray_menu_event);

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(&app).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn destroy_tray(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id(&TrayIconId::new("main-tray")) {
        tray.set_visible(false).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn is_wayland_session() -> bool {
    #[cfg(target_os = "linux")]
    {
        std::env::var("XDG_SESSION_TYPE")
            .map(|v| v.eq_ignore_ascii_case("wayland"))
            .unwrap_or(false)
    }
    #[cfg(not(target_os = "linux"))]
    {
        false
    }
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    // Only allow https URLs to prevent arbitrary command execution.
    if !url.starts_with("https://") {
        return Err("Only https URLs are allowed".to_string());
    }

    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("cmd")
        .args(["/C", "start", "", &url])
        .spawn();

    #[cfg(target_os = "macos")]
    let result = std::process::Command::new("open").arg(&url).spawn();

    #[cfg(target_os = "linux")]
    let result = std::process::Command::new("xdg-open").arg(&url).spawn();

    result.map(|_| ()).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .invoke_handler(tauri::generate_handler![
            create_tray,
            destroy_tray,
            open_external_url,
            is_wayland_session
        ])
        .setup(|app| {
            // If launched with --minimized (autostart), hide the main window
            let args: Vec<String> = std::env::args().collect();
            if args.iter().any(|a| a == "--minimized") {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.hide();
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.emit("window-close-requested", ());
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
