import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock the storage service at the boundary
const mockLoadAll = vi.fn().mockResolvedValue([]);
const mockSave = vi.fn().mockResolvedValue(undefined);
const mockDelete = vi.fn().mockResolvedValue(undefined);
const mockRename = vi.fn().mockResolvedValue(undefined);
let idCounter = 0;

vi.mock("@/services/storage", () => ({
  loadAllProjects: (...args: unknown[]) => mockLoadAll(...args),
  saveProject: (...args: unknown[]) => mockSave(...args),
  deleteProjectFile: (...args: unknown[]) => mockDelete(...args),
  renameProjectFile: (...args: unknown[]) => mockRename(...args),
  generateId: () => `mock-id-${++idCounter}`,
}));

// We need to import AFTER vi.mock
const {
  useProjects,
  useActiveProjectId,
  useActiveProject,
  useTodoFilter,
  useProjectActions,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
} = await import("../projectStore");

describe("projectStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    idCounter = 0;
    mockLoadAll.mockResolvedValue([]);
  });

  test("initialize loads projects and sets first as active", async () => {
    mockLoadAll.mockResolvedValue([
      { id: "p1", name: "Project 1", createdAt: "2026-01-01T00:00:00Z", todos: [] },
    ]);

    const { result } = renderHook(() => ({
      projects: useProjects(),
      activeId: useActiveProjectId(),
      actions: useProjectActions(),
    }));

    await act(async () => {
      await result.current.actions.initialize();
    });

    expect(result.current.projects).toHaveLength(1);
    expect(result.current.projects[0]!.name).toBe("Project 1");
    expect(result.current.activeId).toBe("p1");
  });

  test("createProject saves and sets active", async () => {
    mockLoadAll.mockResolvedValue([]);

    const { result } = renderHook(() => ({
      projects: useProjects(),
      activeId: useActiveProjectId(),
      actions: useProjectActions(),
    }));

    // Start fresh
    await act(async () => {
      await result.current.actions.initialize();
    });

    await act(async () => {
      await result.current.actions.createProject("New Project");
    });

    expect(mockSave).toHaveBeenCalledOnce();
    const created = result.current.projects.find((p) => p.name === "New Project");
    expect(created).toBeDefined();
    expect(result.current.activeId).toBe(created!.id);
  });

  test("addTodo appends to project", async () => {
    mockLoadAll.mockResolvedValue([
      { id: "p1", name: "Test", createdAt: "2026-01-01T00:00:00Z", todos: [] },
    ]);

    const { result } = renderHook(() => ({
      project: useActiveProject(),
      actions: useProjectActions(),
    }));

    await act(async () => {
      await result.current.actions.initialize();
    });

    await act(async () => {
      await result.current.actions.addTodo("p1", "First todo");
    });

    const todos = result.current.project!.todos;
    expect(todos).toHaveLength(1);
    expect(todos[0]!.text).toBe("First todo");
    expect(todos[0]!.done).toBe(false);
    expect(todos[0]!.order).toBe(0);
  });

  test("toggleTodo marks as done with timestamp", async () => {
    mockLoadAll.mockResolvedValue([
      {
        id: "p1",
        name: "Test",
        createdAt: "2026-01-01T00:00:00Z",
        todos: [
          { id: "t1", text: "Task", done: false, createdAt: "2026-01-01T00:00:00Z", doneAt: null, order: 0 },
        ],
      },
    ]);

    const { result } = renderHook(() => ({
      project: useActiveProject(),
      actions: useProjectActions(),
    }));

    await act(async () => {
      await result.current.actions.initialize();
    });

    await act(async () => {
      await result.current.actions.toggleTodo("p1", "t1");
    });

    const todo = result.current.project!.todos[0]!;
    expect(todo.done).toBe(true);
    expect(todo.doneAt).toBeTruthy();
  });

  test("bulkDeleteDone removes only completed", async () => {
    mockLoadAll.mockResolvedValue([
      {
        id: "p1",
        name: "Test",
        createdAt: "2026-01-01T00:00:00Z",
        todos: [
          { id: "t1", text: "Pending", done: false, createdAt: "2026-01-01T00:00:00Z", doneAt: null, order: 0 },
          { id: "t2", text: "Done", done: true, createdAt: "2026-01-01T00:00:00Z", doneAt: "2026-01-02T00:00:00Z", order: 1 },
        ],
      },
    ]);

    const { result } = renderHook(() => ({
      project: useActiveProject(),
      actions: useProjectActions(),
    }));

    await act(async () => {
      await result.current.actions.initialize();
    });

    await act(async () => {
      await result.current.actions.bulkDeleteDone("p1");
    });

    const todos = result.current.project!.todos;
    expect(todos).toHaveLength(1);
    expect(todos[0]!.text).toBe("Pending");
  });

  test("setFilter changes filter value", async () => {
    mockLoadAll.mockResolvedValue([]);

    const { result } = renderHook(() => ({
      filter: useTodoFilter(),
      actions: useProjectActions(),
    }));

    await act(async () => {
      await result.current.actions.initialize();
    });

    expect(result.current.filter).toBe("all");

    act(() => {
      result.current.actions.setFilter("done");
    });

    expect(result.current.filter).toBe("done");
  });
});
