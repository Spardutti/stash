import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

export async function openQuickAddWindow(): Promise<void> {
  const existing = await WebviewWindow.getByLabel("quick-add");
  if (existing) {
    await existing.close();
    return;
  }

  new WebviewWindow("quick-add", {
    url: "index.html?window=quick-add",
    title: "Quick Add",
    width: 520,
    height: 220,
    center: true,
    resizable: false,
    decorations: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focus: true,
  });
}
