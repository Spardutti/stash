import { useEffect } from "react";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useHotkey, useQuickViewHotkey } from "@/stores/settingsStore";
import { toggleQuickAddWindow } from "@/services/quickAddWindow";

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

async function toggleMainWindow(): Promise<void> {
  const win = getCurrentWindow();
  const [visible, focused, minimized] = await Promise.all([
    win.isVisible(),
    win.isFocused(),
    win.isMinimized(),
  ]);
  if (visible && focused && !minimized) {
    await win.hide();
  } else {
    await win.show();
    await win.unminimize();
    await win.setFocus();
  }
}

export function useQuickAddShortcut(initialized: boolean): void {
  const hotkey = useHotkey();

  useEffect(() => {
    if (!initialized) return;

    const shortcut = toTauriShortcut(hotkey);
    let registered = true;

    unregister(shortcut)
      .catch(() => {})
      .then(() =>
        register(shortcut, (event) => {
          if (event.state === "Pressed") toggleQuickAddWindow();
        }),
      )
      .catch((err) => {
        console.error("Failed to register quick-add shortcut:", err);
        registered = false;
      });

    return () => {
      if (registered) unregister(shortcut).catch(() => {});
    };
  }, [initialized, hotkey]);
}

export function useShowWindowShortcut(initialized: boolean): void {
  const quickViewHotkey = useQuickViewHotkey();

  useEffect(() => {
    if (!initialized) return;

    const shortcut = toTauriShortcut(quickViewHotkey);
    let registered = true;

    unregister(shortcut)
      .catch(() => {})
      .then(() =>
        register(shortcut, async (event) => {
          if (event.state === "Pressed") await toggleMainWindow();
        }),
      )
      .catch((err) => {
        console.error("Failed to register show-window shortcut:", err);
        registered = false;
      });

    return () => {
      if (registered) unregister(shortcut).catch(() => {});
    };
  }, [initialized, quickViewHotkey]);
}
