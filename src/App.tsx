import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  register,
  unregister,
} from "@tauri-apps/plugin-global-shortcut";
import { useProjectActions } from "@/stores/projectStore";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { exit } from "@tauri-apps/plugin-process";
import {
  useHotkey,
  useMinimizeToTray,
  useSettingsActions,
  useSettingsInitialized,
} from "@/stores/settingsStore";
import { openQuickAddWindow } from "@/services/quickAddWindow";
import { openQuickViewWindow } from "@/services/quickViewWindow";
import { initTray } from "@/services/tray";
import { MainLayout } from "@/features/layout/MainLayout";
import { QuickAddPopup } from "@/features/quick-add/components/QuickAddPopup";
import { QuickViewPopup } from "@/features/quick-view/components/QuickViewPopup";

const params = new URLSearchParams(window.location.search);
const windowType = params.get("window");

/** Convert stored hotkey format ("Ctrl+Shift+Space") to Tauri format ("Control+Shift+Space") */
function toTauriShortcut(hotkey: string): string {
  return hotkey
    .split("+")
    .map((part) => {
      const p = part.trim();
      if (p === "Ctrl") return "Control";
      if (p === " " || p === "") return "Space";
      return p;
    })
    .join("+");
}

const QUICK_VIEW_SHORTCUT = "Control+Shift+Space";

let didInit = false;

function MainApp() {
  const projectActions = useProjectActions();
  const settingsActions = useSettingsActions();
  const initialized = useSettingsInitialized();
  const hotkey = useHotkey();
  const minimizeToTray = useMinimizeToTray();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (didInit) return;
    didInit = true;

    async function init() {
      try {
        await settingsActions.initialize();
        await projectActions.initialize();
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.message
            : typeof e === "string"
              ? e
              : JSON.stringify(e);
        setError(msg);
        console.error("Init failed:", e);
      }
    }

    init();
  }, [projectActions, settingsActions]);

  // Init system tray when enabled
  useEffect(() => {
    if (!initialized || !minimizeToTray) return;
    initTray().catch((err) =>
      console.error("Failed to init tray:", err),
    );
  }, [initialized, minimizeToTray]);

  // Handle window close — hide to tray or quit based on setting
  useEffect(() => {
    const unlisten = listen("window-close-requested", async () => {
      if (minimizeToTray) {
        await getCurrentWindow().hide();
      } else {
        await exit(0);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [minimizeToTray]);

  // Listen for todos added from quick-add or quick-view windows
  useEffect(() => {
    const unlisten = listen<{ projectId: string }>("todo-added", (event) => {
      projectActions.reloadProject(event.payload.projectId);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [projectActions]);

  // Register global shortcut for quick-add popup
  useEffect(() => {
    if (!initialized) return;

    const shortcut = toTauriShortcut(hotkey);
    let registered = true;

    unregister(shortcut)
      .catch(() => {})
      .then(() =>
        register(shortcut, (event) => {
          if (event.state === "Pressed") {
            openQuickAddWindow();
          }
        }),
      )
      .catch((err) => {
        console.error("Failed to register quick-add shortcut:", err);
        registered = false;
      });

    return () => {
      if (registered) {
        unregister(shortcut).catch(() => {});
      }
    };
  }, [initialized, hotkey]);

  // Register global shortcut for quick-view popup (only when tray enabled)
  useEffect(() => {
    if (!initialized || !minimizeToTray) return;

    let registered = true;

    unregister(QUICK_VIEW_SHORTCUT)
      .catch(() => {})
      .then(() =>
        register(QUICK_VIEW_SHORTCUT, (event) => {
          if (event.state === "Pressed") {
            openQuickViewWindow();
          }
        }),
      )
      .catch((err) => {
        console.error("Failed to register quick-view shortcut:", err);
        registered = false;
      });

    return () => {
      if (registered) {
        unregister(QUICK_VIEW_SHORTCUT).catch(() => {});
      }
    };
  }, [initialized]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!initialized) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return <MainLayout />;
}

function App() {
  if (windowType === "quick-add") {
    return <QuickAddPopup />;
  }
  if (windowType === "quick-view") {
    return <QuickViewPopup />;
  }
  return <MainApp />;
}

export default App;
