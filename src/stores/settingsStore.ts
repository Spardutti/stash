import { create } from "zustand";
import type { Settings } from "@/types";
import { loadSettings, saveSettings, ensureDataDir } from "@/services/storage";

interface SettingsActions {
  initialize: () => Promise<void>;
  setTheme: (theme: "light" | "dark") => Promise<void>;
  setHotkey: (hotkey: string) => Promise<void>;
  setLastProjectId: (id: string | null) => Promise<void>;
  setMinimizeToTray: (enabled: boolean) => Promise<void>;
}

interface SettingsState extends Settings {
  initialized: boolean;
  actions: SettingsActions;
}

const useSettingsStore = create<SettingsState>()((set, get) => ({
  theme: "dark",
  hotkey: "Ctrl+Space",
  lastProjectId: null,
  minimizeToTray: true,
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

    setLastProjectId: async (id) => {
      set({ lastProjectId: id });
      await persistSettings(get());
    },

    setMinimizeToTray: async (enabled) => {
      set({ minimizeToTray: enabled });
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
    lastProjectId: state.lastProjectId,
    minimizeToTray: state.minimizeToTray,
  });
}

// Exported custom hooks — never expose raw store
export const useTheme = () => useSettingsStore((s) => s.theme);
export const useHotkey = () => useSettingsStore((s) => s.hotkey);
export const useLastProjectId = () =>
  useSettingsStore((s) => s.lastProjectId);
export const useMinimizeToTray = () =>
  useSettingsStore((s) => s.minimizeToTray);
export const useSettingsInitialized = () =>
  useSettingsStore((s) => s.initialized);
export const useSettingsActions = () => useSettingsStore((s) => s.actions);
