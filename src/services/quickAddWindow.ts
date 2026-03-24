import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

export async function openQuickAddWindow(): Promise<void> {
  const existing = await WebviewWindow.getByLabel("quick-add");
  if (existing) {
    await existing.setFocus();
    return;
  }

  new WebviewWindow("quick-add", {
    url: "index.html?window=quick-add",
    title: "Quick Add",
    width: 480,
    height: 180,
    center: true,
    resizable: false,
    decorations: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focus: true,
  });
}
