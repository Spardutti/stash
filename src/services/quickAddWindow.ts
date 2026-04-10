import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

const LABEL = "quick-add";

function createHidden(): WebviewWindow {
  return new WebviewWindow(LABEL, {
    url: "index.html?window=quick-add",
    title: "Quick Add",
    width: 520,
    height: 220,
    center: true,
    resizable: false,
    decorations: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    visible: false,
    focus: false,
  });
}

/**
 * Create the quick-add window once (hidden) so it's ready for fast show/hide.
 * Reusing the window avoids the Tauri v2 "new window fails to take OS focus" bug
 * on Linux and Windows (see tauri#5620, tauri#10746, tauri#7519).
 */
export async function ensureQuickAddWindow(): Promise<void> {
  const existing = await WebviewWindow.getByLabel(LABEL);
  if (existing) return;
  createHidden();
}

export async function toggleQuickAddWindow(): Promise<void> {
  let w = await WebviewWindow.getByLabel(LABEL);
  if (!w) {
    w = createHidden();
  }

  const visible = await w.isVisible().catch(() => false);
  if (visible) {
    await w.hide();
    return;
  }

  // hide→show dance + explicit focus. Works around WM focus races where a
  // plain show() leaves DOM focus in the webview while OS focus stays with
  // the previously-active window.
  try {
    await w.hide();
  } catch {
    /* ignore — window may not have been shown yet */
  }
  await w.show();
  await w.setAlwaysOnTop(true);
  await w.setFocus();
  // Tell the embedded popup to reset state + refocus its input.
  await w.emit("quick-add:shown");
}
