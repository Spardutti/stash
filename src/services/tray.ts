import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { toggleQuickAddWindow } from "./quickAddWindow";

let initialized = false;
let unlisteners: UnlistenFn[] = [];

export async function initTray(): Promise<void> {
  if (initialized) return;

  await invoke("create_tray");

  const unlistenAdd = await listen("tray-quick-add", () => {
    toggleQuickAddWindow();
  });

  unlisteners = [unlistenAdd];
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
