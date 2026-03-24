import { useState } from "react";
import {
  useProjects,
  useActiveProjectId,
  useProjectActions,
} from "@/stores/projectStore";
import { useSettingsActions } from "@/stores/settingsStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectItem } from "./ProjectItem";

interface ProjectSidebarProps {
  view: "project" | "settings";
  creatingProject: boolean;
  onCreatingProjectChange: (creating: boolean) => void;
  onOpenSettings: () => void;
  onSelectProject: () => void;
}

export function ProjectSidebar({ view, creatingProject, onCreatingProjectChange, onOpenSettings, onSelectProject }: ProjectSidebarProps) {
  const projects = useProjects();
  const activeProjectId = useActiveProjectId();
  const projectActions = useProjectActions();
  const settingsActions = useSettingsActions();
  const [newName, setNewName] = useState("");

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await projectActions.createProject(trimmed);
    setNewName("");
    onCreatingProjectChange(false);
  };

  const handleSelect = (id: string) => {
    projectActions.setActiveProject(id);
    settingsActions.setLastProjectId(id);
    onSelectProject();
  };

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-white/5 bg-surface px-4 py-4 text-[0.75rem] leading-tight tracking-tight">
      {/* Brand Header */}
      <div className="flex items-center gap-3 mb-6">
        <img src="/logo.png" alt="Stash" className="h-8 w-8 rounded" />
        <div className="flex flex-col">
          <div className="text-sm font-extrabold tracking-tighter text-foreground uppercase">
            Stash
          </div>
          <div className="text-[0.6rem] uppercase tracking-[0.2em] text-on-surface-variant font-bold opacity-60">
            Task Management
          </div>
        </div>
      </div>

      {/* Project List */}
      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto">
        <div className="mb-2 text-[0.65rem] font-bold text-on-surface-variant/40 uppercase tracking-[0.15em]">
          Projects
        </div>
        {projects.map((project) => (
          <ProjectItem
            key={project.id}
            project={project}
            isActive={project.id === activeProjectId}
            onSelect={() => handleSelect(project.id)}
          />
        ))}

        {/* Project Creation Input */}
        {creatingProject && (
          <div className="mt-1">
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") {
                  onCreatingProjectChange(false);
                  setNewName("");
                }
              }}
              onBlur={() => {
                if (!newName.trim()) {
                  onCreatingProjectChange(false);
                  setNewName("");
                }
              }}
              placeholder="Project name..."
              className="h-8 text-xs"
            />
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="mt-auto flex flex-col gap-2 border-t border-white/5 pt-4">
        <Button
          onClick={() => onCreatingProjectChange(true)}
          className="w-full gap-2 py-2.5 font-bold uppercase tracking-widest text-[0.6875rem] shadow-[0_2px_10px_rgba(255,255,255,0.1)]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Project
        </Button>
        <button
          onClick={onOpenSettings}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[0.75rem] transition-colors  ${
            view === "settings"
              ? "bg-surface-high text-foreground font-semibold"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-surface-high/50"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Settings
        </button>
      </div>
    </aside>
  );
}
