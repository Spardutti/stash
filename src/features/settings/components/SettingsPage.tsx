import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { useTheme, useHotkey, useSettingsActions } from "@/stores/settingsStore";
import { useProjects, useProjectActions } from "@/stores/projectStore";
import {
  exportWorkspaceJson,
  importWorkspaceFromJson,
} from "@/services/storage";
import { Button } from "@/components/ui/button";
import { HotkeyRecorder } from "./HotkeyRecorder";
import { ThemeToggle } from "./ThemeToggle";
import { ShortcutList } from "./ShortcutList";

export function SettingsPage() {
  const theme = useTheme();
  const hotkey = useHotkey();
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
    await importWorkspaceFromJson(json, "merge");
    await projectActions.initialize();
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center h-10 px-4 bg-surface border-b border-border/15 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">
          Settings
        </span>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-lg space-y-8">
          <section>
            <h2 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
              Appearance
            </h2>
            <ThemeToggle theme={theme} onChange={actions.setTheme} />
          </section>

          <section>
            <h2 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
              Global Hotkey
            </h2>
            <HotkeyRecorder hotkey={hotkey} onChange={actions.setHotkey} />
          </section>

          <section>
            <h2 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
              Keyboard Shortcuts
            </h2>
            <ShortcutList />
          </section>

          <section>
            <h2 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
              Workspace Data
            </h2>
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
          </section>
        </div>
      </div>
    </div>
  );
}
