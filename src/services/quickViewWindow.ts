import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

export async function openQuickViewWindow(): Promise<void> {
  const existing = await WebviewWindow.getByLabel("quick-view");
  if (existing) {
    await existing.setFocus();
    return;
  }

  new WebviewWindow("quick-view", {
    url: "index.html?window=quick-view",
    title: "Quick View",
    width: 480,
    height: 500,
    center: true,
    resizable: true,
    decorations: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focus: true,
  });
}
