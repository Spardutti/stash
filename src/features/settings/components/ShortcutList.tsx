import { useHotkey, useMinimizeToTray, useSettingsActions } from "@/stores/settingsStore";
import { HotkeyRecorder } from "./HotkeyRecorder";

interface Shortcut {
  keys: string[];
  description: string;
}

const SHORTCUT_GROUPS: { label: string; shortcuts: Shortcut[] }[] = [
  {
    label: "Navigation",
    shortcuts: [
      { keys: ["Ctrl", "P"], description: "Open project switcher" },
      { keys: ["Ctrl", "["], description: "Previous project" },
      { keys: ["Ctrl", "]"], description: "Next project" },
      { keys: ["Ctrl", ","], description: "Open settings" },
    ],
  },
  {
    label: "Tasks",
    shortcuts: [
      { keys: ["Ctrl", "L"], description: "Focus task input" },
      { keys: ["Ctrl", "D"], description: "Delete all completed" },
      { keys: ["Enter"], description: "Save task / confirm" },
      { keys: ["Esc"], description: "Cancel edit / close" },
    ],
  },
  {
    label: "Projects",
    shortcuts: [
      { keys: ["Ctrl", "N"], description: "New project" },
    ],
  },
];

function Kbd({ children, dimmed }: { children: string; dimmed?: boolean }) {
  return (
    <kbd
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded bg-surface-high px-1.5 font-mono text-[10px] ${
        dimmed ? "text-on-surface-variant/30" : "text-on-surface-variant"
      }`}
    >
      {children}
    </kbd>
  );
}

export function ShortcutList() {
  const hotkey = useHotkey();
  const minimizeToTray = useMinimizeToTray();
  const actions = useSettingsActions();

  return (
    <div className="space-y-6">
      {/* Global shortcuts (OS-wide) */}
      <div>
        <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/30">
          Global (OS-wide)
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-sm text-foreground">Quick-add popup</span>
            <HotkeyRecorder hotkey={hotkey} onChange={actions.setHotkey} />
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className={`text-sm ${minimizeToTray ? "text-foreground" : "text-on-surface-variant/30"}`}>
              Quick view popup
              {!minimizeToTray && (
                <span className="ml-2 text-[10px] text-on-surface-variant/30">(enable tray)</span>
              )}
            </span>
            <div className="flex items-center gap-1">
              {["Ctrl", "Shift", "V"].map((key) => (
                <Kbd key={key} dimmed={!minimizeToTray}>{key}</Kbd>
              ))}
            </div>
          </div>
        </div>
      </div>

      {SHORTCUT_GROUPS.map((group) => (
        <div key={group.label}>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/30">
            {group.label}
          </div>
          <div className="space-y-0.5">
            {group.shortcuts.map((shortcut) => (
              <div
                key={shortcut.description}
                className="flex items-center justify-between py-1.5"
              >
                <span className="text-sm text-foreground">
                  {shortcut.description}
                </span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key) => (
                    <Kbd key={key}>{key}</Kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
