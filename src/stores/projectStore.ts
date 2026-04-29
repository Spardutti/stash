import { create } from "zustand";
import type { Project, Todo, TodoFilter } from "@/types";
import {
  loadAllProjects,
  saveProject,
  deleteProjectFile,
  renameProjectFile,
  generateId,
} from "@/services/storage";

interface ProjectActions {
  initialize: () => Promise<void>;
  setActiveProject: (id: string) => void;
  setFilter: (filter: TodoFilter) => void;
  createProject: (name: string) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  addTodo: (projectId: string, text: string) => Promise<Todo | null>;
  addTodos: (projectId: string, texts: string[]) => Promise<Todo[]>;
  editTodo: (projectId: string, todoId: string, text: string) => Promise<void>;
  setTodoLabel: (
    projectId: string,
    todoId: string,
    label: string | null,
  ) => Promise<void>;
  dismissLabelPrompt: (projectId: string, todoId: string) => Promise<void>;
  deleteTodo: (projectId: string, todoId: string) => Promise<void>;
  toggleTodo: (projectId: string, todoId: string) => Promise<void>;
  togglePriority: (projectId: string, todoId: string) => Promise<void>;
  reorderTodos: (
    projectId: string,
    orderedIds: string[],
    priorityIds?: Set<string>,
  ) => Promise<void>;
  bulkDeleteDone: (projectId: string) => Promise<void>;
  reloadProject: (projectId: string) => Promise<void>;
}

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  filter: TodoFilter;
  actions: ProjectActions;
}

const useProjectStore = create<ProjectState>()((set, get) => ({
  projects: [],
  activeProjectId: null,
  filter: "all",
  actions: {
    initialize: async () => {
      const projects = await loadAllProjects();
      const currentId = get().activeProjectId;
      const currentExists = projects.some((p) => p.id === currentId);
      const activeProjectId = currentExists
        ? currentId
        : (projects[0]?.id ?? null);
      set({ projects, activeProjectId });
    },

    setActiveProject: (id) => {
      set({ activeProjectId: id, filter: "all" });
    },

    setFilter: (filter) => {
      set({ filter });
    },

    createProject: async (name) => {
      const project: Project = {
        id: generateId(),
        name,
        createdAt: new Date().toISOString(),
        todos: [],
      };
      await saveProject(project);
      set((state) => ({
        projects: [...state.projects, project],
        activeProjectId: project.id,
      }));
    },

    renameProject: async (id, name) => {
      const project = get().projects.find((p) => p.id === id);
      if (!project) return;

      const oldName = project.name;
      const updated = { ...project, name };
      await renameProjectFile(oldName, name);
      await saveProject(updated);
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? updated : p)),
      }));
    },

    deleteProject: async (id) => {
      const project = get().projects.find((p) => p.id === id);
      if (!project) return;

      await deleteProjectFile(project);
      set((state) => {
        const remaining = state.projects.filter((p) => p.id !== id);
        const newActiveId =
          state.activeProjectId === id
            ? (remaining[0]?.id ?? null)
            : state.activeProjectId;
        return { projects: remaining, activeProjectId: newActiveId };
      });
    },

    addTodo: async (projectId, text) => {
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return null;

      // Shift existing pending todos down by 1 to make room at the top
      const shiftedTodos = project.todos.map((t) =>
        t.done ? t : { ...t, order: t.order + 1 },
      );

      const todo: Todo = {
        id: generateId(),
        text,
        done: false,
        createdAt: new Date().toISOString(),
        doneAt: null,
        order: 0,
      };

      const updated = { ...project, todos: [todo, ...shiftedTodos] };
      await saveProject(updated);
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId ? updated : p,
        ),
      }));
      return todo;
    },

    addTodos: async (projectId, texts) => {
      if (texts.length === 0) return [];
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return [];

      // Shift existing pending todos down to make room at the top
      const shiftedTodos = project.todos.map((t) =>
        t.done ? t : { ...t, order: t.order + texts.length },
      );

      const now = new Date().toISOString();
      const newTodos: Todo[] = texts.map((text, i) => ({
        id: generateId(),
        text,
        done: false,
        createdAt: now,
        doneAt: null,
        order: i,
      }));

      const updated = {
        ...project,
        todos: [...newTodos, ...shiftedTodos],
      };
      await saveProject(updated);
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId ? updated : p,
        ),
      }));
      return newTodos;
    },

    editTodo: async (projectId, todoId, text) => {
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return;

      const updated = {
        ...project,
        todos: project.todos.map((t) =>
          t.id === todoId ? { ...t, text } : t,
        ),
      };
      await saveProject(updated);
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId ? updated : p,
        ),
      }));
    },

    setTodoLabel: async (projectId, todoId, label) => {
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return;

      const trimmed = label?.trim();
      const updated = {
        ...project,
        todos: project.todos.map((t) => {
          if (t.id !== todoId) return t;
          const next: Todo = { ...t };
          if (trimmed) {
            next.label = trimmed;
            delete next.labelPromptDismissed;
          } else {
            delete next.label;
          }
          return next;
        }),
      };
      await saveProject(updated);
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId ? updated : p,
        ),
      }));
    },

    dismissLabelPrompt: async (projectId, todoId) => {
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return;

      const updated = {
        ...project,
        todos: project.todos.map((t) =>
          t.id === todoId ? { ...t, labelPromptDismissed: true } : t,
        ),
      };
      await saveProject(updated);
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId ? updated : p,
        ),
      }));
    },

    deleteTodo: async (projectId, todoId) => {
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return;

      const updated = {
        ...project,
        todos: project.todos.filter((t) => t.id !== todoId),
      };
      await saveProject(updated);
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId ? updated : p,
        ),
      }));
    },

    toggleTodo: async (projectId, todoId) => {
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return;

      const updated = {
        ...project,
        todos: project.todos.map((t) => {
          if (t.id !== todoId) return t;
          const done = !t.done;
          return {
            ...t,
            done,
            doneAt: done ? new Date().toISOString() : null,
          };
        }),
      };
      await saveProject(updated);
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId ? updated : p,
        ),
      }));
    },

    togglePriority: async (projectId, todoId) => {
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return;

      const target = project.todos.find((t) => t.id === todoId);
      if (!target) return;
      const nextPriority = !target.priority;

      // New top-of-zone order = min(zone orders) - 1, or 0 if zone is empty.
      const zonePeers = project.todos.filter(
        (t) => !t.done && t.id !== todoId && Boolean(t.priority) === nextPriority,
      );
      const minOrder = zonePeers.length
        ? Math.min(...zonePeers.map((t) => t.order))
        : 0;
      const newOrder = zonePeers.length ? minOrder - 1 : 0;

      const updated = {
        ...project,
        todos: project.todos.map((t) => {
          if (t.id !== todoId) return t;
          const next: Todo = { ...t, order: newOrder };
          if (nextPriority) next.priority = true;
          else delete next.priority;
          return next;
        }),
      };
      await saveProject(updated);
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId ? updated : p,
        ),
      }));
    },

    reorderTodos: async (projectId, orderedIds, priorityIds) => {
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return;

      const updated = {
        ...project,
        todos: project.todos.map((t) => {
          const idx = orderedIds.indexOf(t.id);
          if (idx === -1) return t;
          const next: Todo = { ...t, order: idx };
          if (priorityIds) {
            if (priorityIds.has(t.id)) next.priority = true;
            else delete next.priority;
          }
          return next;
        }),
      };
      await saveProject(updated);
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId ? updated : p,
        ),
      }));
    },

    bulkDeleteDone: async (projectId) => {
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return;

      const updated = {
        ...project,
        todos: project.todos.filter((t) => !t.done),
      };
      await saveProject(updated);
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId ? updated : p,
        ),
      }));
    },

    reloadProject: async (projectId) => {
      const projects = await loadAllProjects();
      const current = get();
      set({
        projects,
        activeProjectId: current.activeProjectId ?? projectId,
      });
    },
  },
}));

// Non-hook accessor for use outside React (e.g. window close handler)
export const getProjects = () => useProjectStore.getState().projects;

// Exported custom hooks — never expose raw store
export const useProjects = () => useProjectStore((s) => s.projects);
export const useActiveProjectId = () =>
  useProjectStore((s) => s.activeProjectId);
export const useActiveProject = () =>
  useProjectStore((s) => s.projects.find((p) => p.id === s.activeProjectId));
export const useTodoFilter = () => useProjectStore((s) => s.filter);
export const useProjectActions = () => useProjectStore((s) => s.actions);
