import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useProjectActions } from "@/stores/projectStore";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { exit } from "@tauri-apps/plugin-process";
import {
  useMinimizeToTray,
  useSettingsActions,
  useSettingsInitialized,
} from "@/stores/settingsStore";
import { ensureQuickAddWindow } from "@/services/quickAddWindow";
import { initTray } from "@/services/tray";
import { useReloadOnFocus } from "@/shared/hooks/useReloadOnFocus";
import {
  useQuickAddShortcut,
  useShowWindowShortcut,
} from "@/shared/hooks/useGlobalShortcuts";
import { MainLayout } from "@/features/layout/MainLayout";
import { QuickAddPopup } from "@/features/quick-add/components/QuickAddPopup";

const params = new URLSearchParams(window.location.search);
const windowType = params.get("window");

let didInit = false;

function MainApp() {
  const projectActions = useProjectActions();
  const settingsActions = useSettingsActions();
  const initialized = useSettingsInitialized();
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

  useEffect(() => {
    const unlisten = listen("tray-quit-requested", () => exit(0));
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useReloadOnFocus(initialized, projectActions.initialize);

  // Listen for todos added from quick-add window
  useEffect(() => {
    const unlisten = listen<{ projectId: string }>("todo-added", (event) => {
      projectActions.reloadProject(event.payload.projectId);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [projectActions]);

  // Precreate the quick-add window (hidden) so the first shortcut press is
  // just a show() — avoids the new-window focus race on Linux/Windows.
  useEffect(() => {
    if (!initialized) return;
    ensureQuickAddWindow().catch((err) =>
      console.error("Failed to precreate quick-add window:", err),
    );
  }, [initialized]);

  useQuickAddShortcut(initialized);
  useShowWindowShortcut(initialized);

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
  return <MainApp />;
}

export default App;
