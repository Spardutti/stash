import { useCallback, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit } from "@tauri-apps/api/event";
import type { Project } from "@/types";
import {
  loadAllProjects,
  loadSettings,
  saveProject,
  generateId,
} from "@/services/storage";

export function QuickAddPopup() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const inputRef = useCallback((node: HTMLInputElement | null) => {
    if (node) {
      setTimeout(() => node.focus(), 50);
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    async function init() {
      const [allProjects, settings] = await Promise.all([
        loadAllProjects(),
        loadSettings(),
      ]);
      if (ignore) return;

      setProjects(allProjects);
      setLoaded(true);

      if (settings.lastProjectId) {
        const idx = allProjects.findIndex(
          (p) => p.id === settings.lastProjectId,
        );
        if (idx !== -1) setSelectedIndex(idx);
      }
    }

    init();
    return () => {
      ignore = true;
    };
  }, []);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    const project = projects[selectedIndex];
    if (!trimmed || !project) return;

    const maxOrder = project.todos.reduce(
      (max, t) => (t.done ? max : Math.max(max, t.order)),
      -1,
    );

    const todo = {
      id: generateId(),
      text: trimmed,
      done: false,
      createdAt: new Date().toISOString(),
      doneAt: null,
      order: maxOrder + 1,
    };

    const updated = { ...project, todos: [todo, ...project.todos] };
    await saveProject(updated);
    await emit("todo-added", { projectId: project.id });
    await getCurrentWindow().close();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      getCurrentWindow().close();
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (projects.length > 0) {
        setSelectedIndex((prev) =>
          e.shiftKey
            ? (prev - 1 + projects.length) % projects.length
            : (prev + 1) % projects.length,
        );
      }
    }
  };

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center bg-surface">
        <p className="text-label text-on-surface-variant">Loading...</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-surface">
        <p className="text-label text-on-surface-variant">
          No projects yet. Create one first.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-surface p-3" onKeyDown={handleKeyDown}>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-micro uppercase tracking-widest text-on-surface-variant/50">
          Project:
        </span>
        <button
          onClick={() =>
            setSelectedIndex((prev) => (prev + 1) % projects.length)
          }
          className="rounded bg-surface-high px-2 py-0.5 text-label font-medium text-secondary hover:opacity-80 transition-opacity"
          tabIndex={-1}
        >
          {projects[selectedIndex]?.name}
        </button>
        <span className="text-micro text-on-surface-variant/30">
          Tab to switch
        </span>
      </div>

      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What needs to be done?"
        className="flex-1 rounded-lg bg-surface-high border-none px-4 py-2 text-xs text-foreground placeholder:text-on-surface-variant/50 focus:ring-1 focus:ring-primary focus:outline-none"
      />

      <div className="mt-2 flex justify-between text-micro text-on-surface-variant/30">
        <span>Enter to save</span>
        <span>Esc to cancel</span>
      </div>
    </div>
  );
}
