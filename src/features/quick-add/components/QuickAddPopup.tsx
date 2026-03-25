import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit } from "@tauri-apps/api/event";
import type { Project } from "@/types";
import {
  loadAllProjects,
  loadSettings,
  saveSettings,
  saveProject,
  generateId,
} from "@/services/storage";
import type { Settings } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function QuickAddPopup() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const settingsRef = useRef<Settings | null>(null);

  const persistActiveProject = useCallback((projectId: string) => {
    if (!settingsRef.current) return;
    settingsRef.current = { ...settingsRef.current, lastProjectId: projectId };
    saveSettings(settingsRef.current);
  }, []);

  const inputRef = useCallback((node: HTMLInputElement | null) => {
    if (node) {
      // Tauri windows need time to gain OS focus before input focus works
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

      // Apply theme — quick-add window doesn't go through MainApp init
      if (settings.theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }

      settingsRef.current = settings;
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

    // Shift existing pending todos down to make room at the top
    const shiftedTodos = project.todos.map((t) =>
      t.done ? t : { ...t, order: t.order + 1 },
    );

    const todo = {
      id: generateId(),
      text: trimmed,
      done: false,
      createdAt: new Date().toISOString(),
      doneAt: null,
      order: 0,
    };

    const updated = { ...project, todos: [todo, ...shiftedTodos] };
    // Update local project list so next add uses correct order
    setProjects((prev) =>
      prev.map((p) => (p.id === project.id ? updated : p)),
    );
    await saveProject(updated);
    await emit("todo-added", { projectId: project.id });
    persistActiveProject(project.id);
    setText("");
  };

  const switchProject = useCallback(
    (nextIndex: number) => {
      setSelectedIndex(nextIndex);
      const project = projects[nextIndex];
      if (project) persistActiveProject(project.id);
    },
    [projects, persistActiveProject],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      getCurrentWindow().close();
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (projects.length > 0) {
        const next = e.shiftKey
          ? (selectedIndex - 1 + projects.length) % projects.length
          : (selectedIndex + 1) % projects.length;
        switchProject(next);
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
          No projects yet. Create one in the main window first.
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex h-full flex-col bg-surface-lowest p-5 border border-white/10 rounded-lg"
      onKeyDown={handleKeyDown}
    >
      {/* Header: project selector */}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/50">
          Project
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            switchProject((selectedIndex + 1) % projects.length)
          }
          tabIndex={-1}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mr-1.5">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          {projects[selectedIndex]?.name}
        </Button>
        <span className="ml-auto text-xs text-on-surface-variant/30">
          Tab to switch
        </span>
      </div>

      {/* Task input */}
      <Input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What needs to be done?"
        className="h-10 text-sm"
      />

      {/* Footer hints */}
      <div className="mt-4 flex items-center justify-between text-xs text-on-surface-variant/40">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded bg-surface-high px-1.5 py-0.5 text-[10px] font-mono text-on-surface-variant/60">Enter</kbd>
            save
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded bg-surface-high px-1.5 py-0.5 text-[10px] font-mono text-on-surface-variant/60">Esc</kbd>
            cancel
          </span>
        </div>
        <span className="flex items-center gap-1.5">
          <kbd className="rounded bg-surface-high px-1.5 py-0.5 text-[10px] font-mono text-on-surface-variant/60">Tab</kbd>
          switch project
        </span>
      </div>
    </div>
  );
}
