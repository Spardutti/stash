import { useState, useMemo } from "react";
import { LazyMotion, domMax } from "motion/react";
import { ProjectSidebar } from "@/features/projects/components/ProjectSidebar";
import { ProjectSwitcher } from "@/features/projects/components/ProjectSwitcher";
import { TodoList } from "@/features/todos/components/TodoList";
import { SettingsPage } from "@/features/settings/components/SettingsPage";
import { StatusBar } from "@/features/layout/StatusBar";
import { useActiveProject, useProjects } from "@/stores/projectStore";
import { useKeyboardShortcut } from "@/shared/hooks/useKeyboardShortcut";

export function MainLayout() {
  const activeProject = useActiveProject();
  const projects = useProjects();
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const shortcuts = useMemo(
    () => [
      {
        key: "p",
        ctrl: true,
        handler: () => setShowSwitcher(true),
      },
    ],
    [],
  );

  useKeyboardShortcut(shortcuts);

  const totalTodos = projects.reduce((sum, p) => sum + p.todos.length, 0);
  const pendingTodos = projects.reduce(
    (sum, p) => sum + p.todos.filter((t) => !t.done).length,
    0,
  );

  return (
    <LazyMotion features={domMax}>
      <div className="flex h-full flex-col">
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar: surface_container_lowest */}
          <aside className="flex w-48 shrink-0 flex-col bg-surface-lowest border-r border-border/15">
            <ProjectSidebar onOpenSettings={() => setShowSettings(true)} />
          </aside>
          {/* Main canvas: background */}
          <main className="flex flex-1 flex-col overflow-hidden bg-background">
            {showSettings ? (
              <SettingsPage onClose={() => setShowSettings(false)} />
            ) : activeProject ? (
              <TodoList project={activeProject} />
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-on-surface-variant">
                  Create a project to get started
                </p>
              </div>
            )}
          </main>
        </div>

        {/* Status Line — Vim/VS Code inspired */}
        <StatusBar
          pendingCount={pendingTodos}
          totalCount={totalTodos}
          projectName={activeProject?.name}
        />
      </div>

      <ProjectSwitcher
        open={showSwitcher}
        onClose={() => setShowSwitcher(false)}
      />
    </LazyMotion>
  );
}
