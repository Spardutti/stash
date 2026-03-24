import { useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import type { Project } from "@/types";
import { useProjectActions } from "@/stores/projectStore";
import { exportProjectJson, slugify } from "@/services/storage";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";

interface ProjectItemProps {
  project: Project;
  isActive: boolean;
  onSelect: () => void;
}

export function ProjectItem({ project, isActive, onSelect }: ProjectItemProps) {
  const actions = useProjectActions();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const startRename = () => {
    setEditName(project.name);
    setTimeout(() => setIsEditing(true), 100);
  };

  const handleRename = async () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== project.name) {
      await actions.renameProject(project.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    await actions.deleteProject(project.id);
    setShowDeleteConfirm(false);
  };

  const handleExport = async () => {
    const path = await save({
      defaultPath: `${slugify(project.name)}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;
    await writeTextFile(path, exportProjectJson(project));
  };

  const handleCopyPending = () => {
    const pending = project.todos
      .filter((t) => !t.done)
      .sort((a, b) => a.order - b.order)
      .map((t) => `- ${t.text}`)
      .join("\n");
    if (pending) navigator.clipboard.writeText(pending);
  };

  if (isEditing) {
    return (
      <div className="px-1">
        <Input
          autoFocus
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRename();
            if (e.key === "Escape") {
              setIsEditing(false);
              setEditName(project.name);
            }
          }}
          onBlur={handleRename}
          className="h-8 text-xs"
        />
      </div>
    );
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            role="button"
            tabIndex={0}
            onClick={onSelect}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSelect();
            }}
            className={`group flex items-center justify-between px-3 py-2 text-[0.75rem] cursor-pointer transition-colors ${
              isActive
                ? "bg-surface-high text-foreground font-semibold border-l-2 border-primary rounded-r-lg"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-surface-high/50 rounded-lg"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={isActive ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span className="truncate">{project.name}</span>
            </div>

            {/* Three-dot dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                className="opacity-0 group-hover:opacity-100 rounded p-1 text-zinc-600 hover:text-zinc-300 transition-opacity"
                aria-label={`Actions for ${project.name}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="12" cy="19" r="1" />
                </svg>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4}>
                <DropdownMenuItem onClick={startRename}>Rename</DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyPending}>Copy pending todos</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExport}>Export</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowDeleteConfirm(true)} className="text-destructive focus:text-destructive">Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={startRename}>Rename</ContextMenuItem>
          <ContextMenuItem onClick={handleCopyPending}>Copy pending todos</ContextMenuItem>
          <ContextMenuItem onClick={handleExport}>Export</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => setShowDeleteConfirm(true)} className="text-destructive focus:text-destructive">Delete</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Project"
        message={`Delete "${project.name}" and all its todos? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}
