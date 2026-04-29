import { useState, useMemo, useCallback } from "react";
import { LazyMotion, domMax } from "motion/react";
import { ProjectSidebar } from "@/features/projects/components/ProjectSidebar";
import { ProjectSwitcher } from "@/features/projects/components/ProjectSwitcher";
import { TodoList } from "@/features/todos/components/TodoList";
import { SettingsPage } from "@/features/settings/components/SettingsPage";
import { StatusBar } from "@/features/layout/StatusBar";
import { UpdateBanner } from "@/features/layout/UpdateBanner";
import { WaylandWarningBanner } from "@/features/layout/WaylandWarningBanner";
import {
  useActiveProject,
  useActiveProjectId,
  useProjects,
  useProjectActions,
} from "@/stores/projectStore";
import { useKeyboardShortcut } from "@/shared/hooks/useKeyboardShortcut";

type View = "project" | "settings";

export function MainLayout() {
  const activeProject = useActiveProject();
  const activeProjectId = useActiveProjectId();
  const projects = useProjects();
  const projectActions = useProjectActions();
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [view, setView] = useState<View>("project");
  const [creatingProject, setCreatingProject] = useState(false);

  const navigateProject = useCallback(
    (direction: 1 | -1) => {
      if (projects.length === 0) return;
      const currentIdx = projects.findIndex((p) => p.id === activeProjectId);
      const nextIdx =
        (currentIdx + direction + projects.length) % projects.length;
      const next = projects[nextIdx];
      if (next) {
        projectActions.setActiveProject(next.id);
        setView("project");
      }
    },
    [projects, activeProjectId, projectActions],
  );

  const shortcuts = useMemo(
    () => [
      // Ctrl+P — project switcher
      {
        key: "p",
        ctrl: true,
        handler: () => setShowSwitcher(true),
      },
      // Ctrl+N — new project
      {
        key: "n",
        ctrl: true,
        handler: () => setCreatingProject(true),
      },
      // Ctrl+L — focus todo input
      {
        key: "l",
        ctrl: true,
        handler: () => {
          setView("project");
          // Dispatch custom event that TodoInput listens for
          window.dispatchEvent(new CustomEvent("stash:focus-todo-input"));
        },
      },
      // Ctrl+D — delete all done (from PRD)
      {
        key: "d",
        ctrl: true,
        handler: () => {
          window.dispatchEvent(new CustomEvent("stash:bulk-delete-done"));
        },
      },
      // Ctrl+[ — previous project
      {
        key: "[",
        ctrl: true,
        handler: () => navigateProject(-1),
      },
      // Ctrl+] — next project
      {
        key: "]",
        ctrl: true,
        handler: () => navigateProject(1),
      },
      // Ctrl+, — open settings
      {
        key: ",",
        ctrl: true,
        handler: () => setView("settings"),
      },
    ],
    [navigateProject],
  );

  useKeyboardShortcut(shortcuts);

  const totalTodos = projects.reduce((sum, p) => sum + p.todos.length, 0);
  const pendingTodos = projects.reduce(
    (sum, p) => sum + p.todos.filter((t) => !t.done).length,
    0,
  );

  return (
    <LazyMotion features={domMax}>
      <div className="flex h-full w-full bg-surface-lowest">
        <ProjectSidebar
          view={view}
          creatingProject={creatingProject}
          onCreatingProjectChange={setCreatingProject}
          onOpenSettings={() => setView("settings")}
          onSelectProject={() => setView("project")}
        />

        <main className="flex flex-1 flex-col overflow-hidden bg-surface">
          <UpdateBanner />
          <WaylandWarningBanner />
          {view === "settings" ? (
            <SettingsPage />
          ) : activeProject ? (
            <TodoList project={activeProject} />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="rounded-full bg-surface-high/40 p-6">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-on-surface-variant/20">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-foreground tracking-tighter">
                  Project Workspace
                </h2>
                <p className="max-w-xs text-center text-sm leading-relaxed text-on-surface-variant">
                  Create a project to begin managing your workflows.
                </p>
              </div>
            </div>
          )}

          <StatusBar
            pendingCount={pendingTodos}
            totalCount={totalTodos}
            projectName={view === "settings" ? undefined : activeProject?.name}
          />
        </main>
      </div>

      <ProjectSwitcher
        open={showSwitcher}
        onClose={() => setShowSwitcher(false)}
        onSelect={() => {
          setShowSwitcher(false);
          setView("project");
        }}
      />
    </LazyMotion>
  );
}
