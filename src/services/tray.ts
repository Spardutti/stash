import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { toggleQuickAddWindow } from "./quickAddWindow";
import { openQuickViewWindow } from "./quickViewWindow";

let initialized = false;
let unlisteners: UnlistenFn[] = [];

export async function initTray(): Promise<void> {
  if (initialized) return;

  await invoke("create_tray");

  const unlistenAdd = await listen("tray-quick-add", () => {
    toggleQuickAddWindow();
  });

  const unlistenView = await listen("tray-quick-view", () => {
    openQuickViewWindow();
  });

  unlisteners = [unlistenAdd, unlistenView];
  initialized = true;
}

export async function destroyTray(): Promise<void> {
  if (!initialized) return;

  for (const unlisten of unlisteners) {
    unlisten();
  }
  unlisteners = [];

  await invoke("destroy_tray");
  initialized = false;
}
