import { useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import type { Project } from "@/types";
import { useProjectActions } from "@/stores/projectStore";
import { exportProjectJson, slugify } from "@/services/storage";
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

  if (isEditing) {
    return (
      <div className="px-2 py-1">
        <input
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
          className="w-full rounded bg-transparent border border-border/30 px-2 py-1.5 text-[0.75rem] text-foreground focus:border-tertiary focus:outline-none"
        />
      </div>
    );
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onDoubleClick={() => {
          setEditName(project.name);
          setIsEditing(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSelect();
        }}
        className={`group flex items-center justify-between rounded-lg px-2 py-2 text-[0.75rem] cursor-pointer transition-all ${
          isActive
            ? "bg-surface-high text-foreground font-medium border-l-2 border-primary"
            : "text-on-surface-variant hover:text-foreground hover:bg-surface"
        }`}
      >
        <span className="truncate">{project.name}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleExport();
            }}
            className="hidden rounded p-0.5 text-on-surface-variant hover:text-foreground group-hover:block"
            aria-label={`Export ${project.name}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteConfirm(true);
            }}
            className="hidden rounded p-0.5 text-on-surface-variant hover:text-error group-hover:block"
            aria-label={`Delete ${project.name}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

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
