import { useCallback, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit } from "@tauri-apps/api/event";
import type { Project, Todo } from "@/types";
import {
  loadAllProjects,
  loadSettings,
  saveProject,
} from "@/services/storage";

export function QuickViewPopup() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const inputRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      setTimeout(() => node.focus(), 150);
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

      if (settings.theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }

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

  const currentProject = projects[selectedIndex];

  const pendingTodos = currentProject
    ? currentProject.todos
        .filter((t) => !t.done)
        .sort((a, b) => a.order - b.order)
    : [];

  const handleToggle = async (todo: Todo) => {
    if (!currentProject) return;

    const updated = {
      ...currentProject,
      todos: currentProject.todos.map((t) => {
        if (t.id !== todo.id) return t;
        const done = !t.done;
        return {
          ...t,
          done,
          doneAt: done ? new Date().toISOString() : null,
        };
      }),
    };

    setProjects((prev) =>
      prev.map((p) => (p.id === currentProject.id ? updated : p)),
    );
    await saveProject(updated);
    await emit("todo-added", { projectId: currentProject.id });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
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
      <div className="flex h-full items-center justify-center bg-surface-lowest">
        <p className="text-sm text-on-surface-variant">Loading...</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-lowest p-6">
        <p className="text-sm text-on-surface-variant">
          No projects yet. Create one in the main window.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={inputRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="flex h-full flex-col bg-surface-lowest border border-white/10 rounded-lg overflow-hidden outline-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
            Quick View
          </span>
          <button
            onClick={() =>
              setSelectedIndex((prev) => (prev + 1) % projects.length)
            }
            className="rounded bg-surface-high px-2 py-0.5 text-xs font-medium text-secondary hover:opacity-80 transition-opacity"
          >
            {currentProject?.name}
          </button>
          <span className="text-[10px] text-on-surface-variant/30">
            Tab to switch
          </span>
        </div>
        <button
          onClick={() => getCurrentWindow().close()}
          className="rounded p-1 text-on-surface-variant/40 hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Todo list */}
      <div className="flex-1 overflow-y-auto">
        {pendingTodos.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-on-surface-variant/50">
              No pending todos
            </p>
          </div>
        ) : (
          <ul>
            {pendingTodos.map((todo) => (
              <li
                key={todo.id}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 hover:bg-white/[0.02] transition-colors"
              >
                <button
                  onClick={() => handleToggle(todo)}
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-border hover:border-tertiary transition-colors"
                  aria-label="Mark as done"
                >
                  {/* Empty — unchecked */}
                </button>
                <span className="text-sm font-medium text-foreground truncate">
                  {todo.text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-white/5 text-[10px] text-on-surface-variant/40">
        <span>{pendingTodos.length} pending</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-surface-high px-1 py-0.5 font-mono text-on-surface-variant/60">Esc</kbd>
            close
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-surface-high px-1 py-0.5 font-mono text-on-surface-variant/60">Tab</kbd>
            switch
          </span>
        </div>
      </div>
    </div>
  );
}
