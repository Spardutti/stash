import { TrayIcon } from "@tauri-apps/api/tray";
import { Menu, MenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { exit } from "@tauri-apps/plugin-process";
import { openQuickAddWindow } from "./quickAddWindow";
import { openQuickViewWindow } from "./quickViewWindow";

let tray: TrayIcon | null = null;

export async function initTray(): Promise<void> {
  if (tray) return;

  const openItem = await MenuItem.new({
    id: "open",
    text: "Open Stash",
    action: async () => {
      const win = getCurrentWindow();
      await win.show();
      await win.setFocus();
    },
  });

  const quickAddItem = await MenuItem.new({
    id: "quick-add",
    text: "Quick Add",
    action: () => openQuickAddWindow(),
  });

  const quickViewItem = await MenuItem.new({
    id: "quick-view",
    text: "Quick View",
    action: () => openQuickViewWindow(),
  });

  const separator = await PredefinedMenuItem.new({ item: "Separator" });

  const quitItem = await MenuItem.new({
    id: "quit",
    text: "Quit Stash",
    action: () => exit(0),
  });

  const menu = await Menu.new({
    items: [openItem, separator, quickAddItem, quickViewItem, separator, quitItem],
  });

  tray = await TrayIcon.new({
    id: "main-tray",
    menu,
    tooltip: "Stash — Task Management",
    menuOnLeftClick: true,
  });
}
