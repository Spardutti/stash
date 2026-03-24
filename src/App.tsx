import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  register,
  unregister,
} from "@tauri-apps/plugin-global-shortcut";
import { useProjectActions } from "@/stores/projectStore";
import {
  useHotkey,
  useSettingsActions,
  useSettingsInitialized,
} from "@/stores/settingsStore";
import { openQuickAddWindow } from "@/services/quickAddWindow";
import { MainLayout } from "@/features/layout/MainLayout";
import { QuickAddPopup } from "@/features/quick-add/components/QuickAddPopup";

const isQuickAdd = window.location.search.includes("window=quick-add");

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

let didInit = false;

function MainApp() {
  const projectActions = useProjectActions();
  const settingsActions = useSettingsActions();
  const initialized = useSettingsInitialized();
  const hotkey = useHotkey();
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

  // Listen for todos added from the quick-add window
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
        console.error("Failed to register global shortcut:", err);
        registered = false;
      });

    return () => {
      if (registered) {
        unregister(shortcut).catch(() => {});
      }
    };
  }, [initialized, hotkey]);

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
  if (isQuickAdd) {
    return <QuickAddPopup />;
  }
  return <MainApp />;
}

export default App;
