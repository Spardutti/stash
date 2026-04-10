import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit, listen } from "@tauri-apps/api/event";
import type { Project } from "@/types";
import { needsLabelPrompt } from "@/types";
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

interface PendingLabel {
  projectId: string;
  todoId: string;
  text: string;
}

export function QuickAddPopup() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [pendingLabel, setPendingLabel] = useState<PendingLabel | null>(null);
  const [labelInput, setLabelInput] = useState("");
  const settingsRef = useRef<Settings | null>(null);

  const persistActiveProject = useCallback((projectId: string) => {
    if (!settingsRef.current) return;
    settingsRef.current = { ...settingsRef.current, lastProjectId: projectId };
    saveSettings(settingsRef.current);
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);

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

  // The quick-add window is kept alive and toggled via show/hide. Re-focus
  // the input (and reset state) both on first mount and every time the
  // parent window emits "quick-add:shown".
  useEffect(() => {
    if (!loaded) return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const focusInput = () => {
      if (cancelled) return;
      inputRef.current?.focus();
    };

    const refocusWithRetries = () => {
      focusInput();
      // Compositor may still be handing over OS focus — retry a few times.
      [30, 100, 250, 500].forEach((ms) => {
        timers.push(setTimeout(focusInput, ms));
      });
    };

    const resetAndFocus = () => {
      setText("");
      setPendingLabel(null);
      setLabelInput("");
      refocusWithRetries();
    };

    // Initial mount — the window is being shown for the first time.
    refocusWithRetries();

    // Tauri fires this whenever the OS hands focus to this window.
    const unlistenFocusP = getCurrentWindow().onFocusChanged(({ payload }) => {
      if (payload) refocusWithRetries();
    });

    // Custom event from quickAddWindow.toggleQuickAddWindow() — resets state
    // and reloads projects so they stay in sync with the main window.
    const unlistenShownP = listen("quick-add:shown", async () => {
      resetAndFocus();
      try {
        const fresh = await loadAllProjects();
        if (cancelled) return;
        setProjects(fresh);
        const lastId = settingsRef.current?.lastProjectId;
        if (lastId) {
          const idx = fresh.findIndex((p) => p.id === lastId);
          if (idx !== -1) setSelectedIndex(idx);
        }
      } catch {
        /* keep existing projects if reload fails */
      }
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      unlistenFocusP.then((fn) => fn()).catch(() => {});
      unlistenShownP.then((fn) => fn()).catch(() => {});
    };
  }, [loaded]);

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

    if (needsLabelPrompt(trimmed)) {
      setPendingLabel({ projectId: project.id, todoId: todo.id, text: trimmed });
      setLabelInput("");
    }
  };

  const patchPendingTodo = async (
    patch: { label?: string; labelPromptDismissed?: boolean },
  ) => {
    if (!pendingLabel) return;
    const target = projects.find((p) => p.id === pendingLabel.projectId);
    if (!target) {
      setPendingLabel(null);
      return;
    }
    const updated: Project = {
      ...target,
      todos: target.todos.map((t) =>
        t.id === pendingLabel.todoId ? { ...t, ...patch } : t,
      ),
    };
    setProjects((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p)),
    );
    await saveProject(updated);
    await emit("todo-added", { projectId: updated.id });
    setPendingLabel(null);
    setLabelInput("");
  };

  const handleSaveLabel = async () => {
    const trimmed = labelInput.trim();
    if (!trimmed) return;
    await patchPendingTodo({ label: trimmed });
  };

  const handleSkipLabel = async () => {
    await patchPendingTodo({ labelPromptDismissed: true });
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
      if (pendingLabel) {
        handleSkipLabel();
      } else {
        getCurrentWindow().hide();
      }
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

      {/* Inline label prompt for long tasks */}
      {pendingLabel ? (
        <div className="mt-3 rounded-lg border border-border/15 bg-surface-high p-3">
          <p className="text-xs text-on-surface-variant">
            Saved long task — add a short label?
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Input
              autoFocus
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSaveLabel();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSkipLabel();
                }
              }}
              placeholder="e.g. Send message to Alex"
              className="h-8 flex-1 text-sm"
            />
            <Button
              size="sm"
              onClick={handleSaveLabel}
              disabled={!labelInput.trim()}
            >
              Save
            </Button>
            <Button size="sm" variant="secondary" onClick={handleSkipLabel}>
              Skip
            </Button>
          </div>
        </div>
      ) : null}

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
