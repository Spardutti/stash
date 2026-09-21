import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** Re-read from disk on focus so edits made outside the app (e.g. the CLI) show up. */
export function useReloadOnFocus(enabled: boolean, reload: () => Promise<void>): void {
  useEffect(() => {
    if (!enabled) return;
    const unlisten = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (focused) reload().catch((e) => console.error("Reload failed:", e));
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [enabled, reload]);
}
