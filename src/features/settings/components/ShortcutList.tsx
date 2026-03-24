import { useHotkey } from "@/stores/settingsStore";

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

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-surface-high px-1.5 font-mono text-[10px] text-on-surface-variant">
      {children}
    </kbd>
  );
}

export function ShortcutList() {
  const hotkey = useHotkey();

  return (
    <div className="space-y-6">
      {/* Global hotkey — separate since it's user-configurable */}
      <div>
        <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/30">
          Global (OS-wide)
        </div>
        <div className="flex items-center justify-between py-1.5">
          <span className="text-sm text-foreground">Quick-add popup</span>
          <div className="flex items-center gap-1">
            {hotkey.split("+").map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
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
