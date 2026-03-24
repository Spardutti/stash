import { useState } from "react";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import {
  useProjects,
  useActiveProjectId,
  useProjectActions,
} from "@/stores/projectStore";
import { useSettingsActions } from "@/stores/settingsStore";
import {
  exportWorkspaceJson,
  importWorkspaceFromJson,
} from "@/services/storage";
import { ProjectItem } from "./ProjectItem";

interface ProjectSidebarProps {
  onOpenSettings: () => void;
}

export function ProjectSidebar({ onOpenSettings }: ProjectSidebarProps) {
  const projects = useProjects();
  const activeProjectId = useActiveProjectId();
  const projectActions = useProjectActions();
  const settingsActions = useSettingsActions();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await projectActions.createProject(trimmed);
    setNewName("");
    setIsCreating(false);
  };

  const handleSelect = (id: string) => {
    projectActions.setActiveProject(id);
    settingsActions.setLastProjectId(id);
  };

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
    <div className="flex h-full flex-col py-4 px-2 text-[0.75rem] leading-none">
      {/* Branding */}
      <div className="mb-6 px-2">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary-foreground"
            >
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
          </div>
          <span className="font-bold tracking-widest uppercase text-foreground">
            STASH
          </span>
        </div>
        <p className="mt-4 mb-2 text-micro uppercase tracking-widest text-on-surface-variant/50">
          Projects
        </p>
      </div>

      {/* Project list */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto">
        {projects.map((project) => (
          <ProjectItem
            key={project.id}
            project={project}
            isActive={project.id === activeProjectId}
            onSelect={() => handleSelect(project.id)}
          />
        ))}

        {isCreating && (
          <div className="px-2 py-1">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") {
                  setIsCreating(false);
                  setNewName("");
                }
              }}
              onBlur={() => {
                if (!newName.trim()) {
                  setIsCreating(false);
                  setNewName("");
                }
              }}
              placeholder="Project name..."
              className="w-full rounded bg-transparent border border-border/30 px-2 py-1.5 text-xs text-foreground placeholder:text-on-surface-variant/50 focus:border-tertiary focus:outline-none"
            />
          </div>
        )}
      </nav>

      {/* Bottom actions */}
      <div className="mt-auto space-y-1 pt-4 border-t border-border/15">
        <button
          onClick={() => setIsCreating(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2 mb-2 font-bold text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>New Project</span>
        </button>
        <button
          onClick={onOpenSettings}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-on-surface-variant hover:text-foreground hover:bg-surface transition-all"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>Settings</span>
        </button>
        <button
          onClick={handleExportWorkspace}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-on-surface-variant hover:text-foreground hover:bg-surface transition-all"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>Export</span>
        </button>
        <button
          onClick={handleImportWorkspace}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-on-surface-variant hover:text-foreground hover:bg-surface transition-all"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>Import</span>
        </button>
      </div>
    </div>
  );
}
