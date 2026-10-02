import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { useTheme, useMinimizeToTray, useStartWithSystem, useFontSize, useSettingsActions } from "@/stores/settingsStore";
import { useProjects, useProjectActions } from "@/stores/projectStore";
import {
  exportWorkspaceJson,
  importWorkspaceFromJson,
} from "@/services/storage";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { ShortcutList } from "./ShortcutList";
import { ClaudeSkillSection } from "./ClaudeSkillSection";

const FONT_SIZES = [
  { value: "small" as const, label: "S" },
  { value: "medium" as const, label: "M" },
  { value: "large" as const, label: "L" },
];

export function SettingsPage() {
  const theme = useTheme();
  const minimizeToTray = useMinimizeToTray();
  const startWithSystem = useStartWithSystem();
  const fontSize = useFontSize();
  const actions = useSettingsActions();
  const projects = useProjects();
  const projectActions = useProjectActions();

  const handleExportWorkspace = async () => {
    const path = await save({
      defaultPath: "stash-workspace.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;
    const json = exportWorkspaceJson(projects);
    await writeTextFile(path, json);
  };

  const handleImportWorkspace = async () => {
    const path = await open({
      multiple: false,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;
    const json = await readTextFile(path);
    await importWorkspaceFromJson(json);
    await projectActions.initialize();
  };

  return (
    <>
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          {/* Page header */}
          <div className="flex items-end justify-between mb-8 border-b border-border/10 pb-4">
            <div>
              <h1 className="text-[2.25rem] font-bold tracking-tighter leading-none mb-2 text-foreground">
                Settings
              </h1>
            </div>
          </div>

          <div className="space-y-10">
            {/* ── GENERAL ── */}
            <div>
              <h2 className="mb-6 text-xs font-bold uppercase tracking-widest text-on-surface-variant/40">
                General
              </h2>
              <div className="space-y-6">
                {/* Theme */}
                <div>
                  <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
                    Theme
                  </h3>
                  <ThemeToggle theme={theme} onChange={actions.setTheme} />
                </div>

                {/* Font size */}
                <div>
                  <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
                    Font Size
                  </h3>
                  <div className="flex gap-1">
                    {FONT_SIZES.map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => actions.setFontSize(value)}
                        className={`h-8 w-10 rounded-lg text-xs font-bold transition-colors ${
                          fontSize === value
                            ? "bg-tertiary text-on-tertiary"
                            : "bg-surface-high text-on-surface-variant hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Behavior toggles */}
                <div>
                  <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
                    Behavior
                  </h3>
                  <div className="space-y-4">
                    <label className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-foreground">Minimize to tray</p>
                        <p className="text-xs text-on-surface-variant/60">
                          Close button hides the window to system tray instead of quitting
                        </p>
                      </div>
                      <button
                        onClick={() => actions.setMinimizeToTray(!minimizeToTray)}
                        className={`relative h-5 w-9 rounded-full transition-colors ${
                          minimizeToTray ? "bg-tertiary" : "bg-surface-high"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-foreground transition-transform ${
                            minimizeToTray ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </label>
                    <label className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-foreground">Start with system</p>
                        <p className="text-xs text-on-surface-variant/60">
                          Launch Stash in the tray when your system starts
                        </p>
                      </div>
                      <button
                        onClick={() => actions.setStartWithSystem(!startWithSystem)}
                        className={`relative h-5 w-9 rounded-full transition-colors ${
                          startWithSystem ? "bg-tertiary" : "bg-surface-high"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-foreground transition-transform ${
                            startWithSystem ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* ── SHORTCUTS ── */}
            <div>
              <h2 className="mb-6 text-xs font-bold uppercase tracking-widest text-on-surface-variant/40">
                Shortcuts
              </h2>
              <ShortcutList />
            </div>

            <ClaudeSkillSection />

            {/* ── DATA ── */}
            <div>
              <h2 className="mb-6 text-xs font-bold uppercase tracking-widest text-on-surface-variant/40">
                Data
              </h2>
              <div className="space-y-6">
                {/* Workspace import/export */}
                <div>
                  <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
                    Workspace Data
                  </h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportWorkspace}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      Export All Projects
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleImportWorkspace}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Import Workspace
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
