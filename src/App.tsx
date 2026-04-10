import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  register,
  unregister,
} from "@tauri-apps/plugin-global-shortcut";
import { useProjectActions, getProjects } from "@/stores/projectStore";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { exit } from "@tauri-apps/plugin-process";
import {
  useHotkey,
  useQuickViewHotkey,
  useMinimizeToTray,
  useGithubToken,
  useGistId,
  useSettingsActions,
  useSettingsInitialized,
} from "@/stores/settingsStore";
import { downloadFromGist, uploadToGist } from "@/services/gistSync";
import { importWorkspaceFromJson } from "@/services/storage";
import {
  ensureQuickAddWindow,
  toggleQuickAddWindow,
} from "@/services/quickAddWindow";
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

let didInit = false;

function MainApp() {
  const projectActions = useProjectActions();
  const settingsActions = useSettingsActions();
  const initialized = useSettingsInitialized();
  const hotkey = useHotkey();
  const quickViewHotkey = useQuickViewHotkey();
  const minimizeToTray = useMinimizeToTray();
  const githubToken = useGithubToken();
  const gistId = useGistId();
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

  // Auto-download from Gist on launch (if configured and Gist is newer)
  useEffect(() => {
    if (!initialized || !githubToken || !gistId) return;

    (async () => {
      try {
        const { projects, syncedAt } = await downloadFromGist(githubToken, gistId);
        const lastSynced = localStorage.getItem("stash_lastSyncedAt");
        if (!lastSynced || syncedAt > lastSynced) {
          const json = JSON.stringify({ version: 1, projects });
          await importWorkspaceFromJson(json, "replace");
          await projectActions.initialize();
          localStorage.setItem("stash_lastSyncedAt", syncedAt);
          console.log("[sync] Auto-downloaded from Gist");
        } else {
          console.log("[sync] Local is up to date");
        }
      } catch (e) {
        console.error("[sync] Auto-download failed:", e);
      }
    })();
  }, [initialized, githubToken, gistId, projectActions]);

  // Init system tray when enabled
  useEffect(() => {
    if (!initialized || !minimizeToTray) return;
    initTray().catch((err) =>
      console.error("Failed to init tray:", err),
    );
  }, [initialized, minimizeToTray]);

  // Auto-upload helper
  async function autoUpload() {
    if (!githubToken || !gistId) return;
    try {
      await uploadToGist(githubToken, gistId, getProjects());
      localStorage.setItem("stash_lastSyncedAt", new Date().toISOString());
      console.log("[sync] Auto-uploaded");
    } catch (e) {
      console.error("[sync] Auto-upload failed:", e);
    }
  }

  // Handle window close — auto-upload, then hide to tray or quit
  useEffect(() => {
    const unlisten = listen("window-close-requested", async () => {
      await autoUpload();
      if (minimizeToTray) {
        await getCurrentWindow().hide();
      } else {
        await exit(0);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [minimizeToTray, githubToken, gistId]);

  // Handle tray "Quit" — auto-upload, then exit
  useEffect(() => {
    const unlisten = listen("tray-quit-requested", async () => {
      await autoUpload();
      await exit(0);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [githubToken, gistId]);

  // Listen for todos added from quick-add or quick-view windows
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
            toggleQuickAddWindow();
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

    const shortcut = toTauriShortcut(quickViewHotkey);
    let registered = true;

    unregister(shortcut)
      .catch(() => {})
      .then(() =>
        register(shortcut, (event) => {
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
        unregister(shortcut).catch(() => {});
      }
    };
  }, [initialized, quickViewHotkey]);

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
