import { create } from "zustand";
import { enable, disable } from "@tauri-apps/plugin-autostart";
import type { Settings } from "@/types";
import { loadSettings, saveSettings, ensureDataDir } from "@/services/storage";

interface SettingsActions {
  initialize: () => Promise<void>;
  setTheme: (theme: "light" | "dark") => Promise<void>;
  setHotkey: (hotkey: string) => Promise<void>;
  setQuickViewHotkey: (hotkey: string) => Promise<void>;
  setLastProjectId: (id: string | null) => Promise<void>;
  setMinimizeToTray: (enabled: boolean) => Promise<void>;
  setStartWithSystem: (enabled: boolean) => Promise<void>;
}

interface SettingsState extends Settings {
  initialized: boolean;
  actions: SettingsActions;
}

const useSettingsStore = create<SettingsState>()((set, get) => ({
  theme: "dark",
  hotkey: "Ctrl+Space",
  quickViewHotkey: "Ctrl+Shift+Space",
  lastProjectId: null,
  minimizeToTray: true,
  startWithSystem: false,
  initialized: false,
  actions: {
    initialize: async () => {
      await ensureDataDir();
      const settings = await loadSettings();
      set({ ...settings, initialized: true });
      applyTheme(settings.theme);
    },

    setTheme: async (theme) => {
      set({ theme });
      applyTheme(theme);
      await persistSettings(get());
    },

    setHotkey: async (hotkey) => {
      set({ hotkey });
      await persistSettings(get());
    },

    setQuickViewHotkey: async (hotkey) => {
      set({ quickViewHotkey: hotkey });
      await persistSettings(get());
    },

    setLastProjectId: async (id) => {
      set({ lastProjectId: id });
      await persistSettings(get());
    },

    setMinimizeToTray: async (enabled) => {
      set({ minimizeToTray: enabled });
      await persistSettings(get());
    },

    setStartWithSystem: async (enabled) => {
      try {
        if (enabled) {
          await enable();
        } else {
          await disable();
        }
      } catch (err) {
        console.error("Failed to toggle autostart:", err);
      }
      set({ startWithSystem: enabled });
      await persistSettings(get());
    },
  },
}));

function applyTheme(theme: "light" | "dark"): void {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

function persistSettings(state: SettingsState): Promise<void> {
  return saveSettings({
    theme: state.theme,
    hotkey: state.hotkey,
    quickViewHotkey: state.quickViewHotkey,
    lastProjectId: state.lastProjectId,
    minimizeToTray: state.minimizeToTray,
    startWithSystem: state.startWithSystem,
  });
}

// Exported custom hooks — never expose raw store
export const useTheme = () => useSettingsStore((s) => s.theme);
export const useHotkey = () => useSettingsStore((s) => s.hotkey);
export const useQuickViewHotkey = () =>
  useSettingsStore((s) => s.quickViewHotkey);
export const useLastProjectId = () =>
  useSettingsStore((s) => s.lastProjectId);
export const useMinimizeToTray = () =>
  useSettingsStore((s) => s.minimizeToTray);
export const useStartWithSystem = () =>
  useSettingsStore((s) => s.startWithSystem);
export const useSettingsInitialized = () =>
  useSettingsStore((s) => s.initialized);
export const useSettingsActions = () => useSettingsStore((s) => s.actions);
