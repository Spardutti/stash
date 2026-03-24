import { useTheme, useHotkey, useSettingsActions } from "@/stores/settingsStore";
import { HotkeyRecorder } from "./HotkeyRecorder";
import { ThemeToggle } from "./ThemeToggle";

interface SettingsPageProps {
  onClose: () => void;
}

export function SettingsPage({ onClose }: SettingsPageProps) {
  const theme = useTheme();
  const hotkey = useHotkey();
  const actions = useSettingsActions();

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between h-10 px-4 bg-surface border-b border-border/15 shrink-0">
        <span className="text-micro font-bold uppercase tracking-widest text-foreground">
          Settings
        </span>
        <button
          onClick={onClose}
          className="rounded-lg border border-border/15 px-3 py-1 text-label text-on-surface-variant hover:text-foreground hover:bg-surface-high transition-colors"
        >
          Back
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-lg space-y-8">
          <section>
            <h2 className="mb-4 text-micro font-bold uppercase tracking-widest text-on-surface-variant/50">
              Appearance
            </h2>
            <ThemeToggle theme={theme} onChange={actions.setTheme} />
          </section>

          <section>
            <h2 className="mb-4 text-micro font-bold uppercase tracking-widest text-on-surface-variant/50">
              Global Hotkey
            </h2>
            <HotkeyRecorder hotkey={hotkey} onChange={actions.setHotkey} />
          </section>
        </div>
      </div>
    </div>
  );
}
