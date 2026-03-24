import { useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  useSensors,
  useSensor,
  PointerSensor,
  KeyboardSensor,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import type { Project, Todo } from "@/types";
import { useTodoFilter, useProjectActions } from "@/stores/projectStore";
import { TodoInput } from "./TodoInput";
import { TodoFilters } from "./TodoFilters";
import { TodoItem } from "./TodoItem";
import { BulkActions } from "./BulkActions";
import { DragOverlayItem } from "./DragOverlayItem";

interface TodoListProps {
  project: Project;
}

export function TodoList({ project }: TodoListProps) {
  const filter = useTodoFilter();
  const actions = useProjectActions();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const { pendingTodos, doneTodos, doneCount } = useMemo(() => {
    const pending = project.todos
      .filter((t) => !t.done)
      .sort((a, b) => a.order - b.order);

    const done = project.todos
      .filter((t) => t.done)
      .sort((a, b) => {
        const aTime = a.doneAt ? new Date(a.doneAt).getTime() : 0;
        const bTime = b.doneAt ? new Date(b.doneAt).getTime() : 0;
        return bTime - aTime;
      });

    return { pendingTodos: pending, doneTodos: done, doneCount: done.length };
  }, [project.todos]);

  const visibleTodos = useMemo(() => {
    switch (filter) {
      case "pending":
        return pendingTodos;
      case "done":
        return doneTodos;
      default:
        return [...pendingTodos, ...doneTodos];
    }
  }, [filter, pendingTodos, doneTodos]);

  const pendingIds = useMemo(
    () => pendingTodos.map((t) => t.id),
    [pendingTodos],
  );

  const activeTodo: Todo | undefined = activeId
    ? project.todos.find((t) => t.id === activeId)
    : undefined;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = pendingIds.indexOf(active.id as string);
    const newIndex = pendingIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(pendingIds, oldIndex, newIndex);
    actions.reorderTodos(project.id, reordered);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const pendingCount = pendingTodos.length;

  return (
    <div className="flex h-full flex-col">
      {/* Top header bar — matches mockup exactly */}
      <header className="flex items-center justify-between h-10 px-4 bg-surface border-b border-border/15 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">
          Active Workspaces / {project.name}
        </span>
        <TodoInput onAdd={(text) => actions.addTodo(project.id, text)} />
      </header>

      {/* Dashboard canvas */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          {/* Page header — large editorial heading + filters */}
          <div className="flex items-end justify-between mb-8 border-b border-border/10 pb-4">
            <div>
              <h1 className="text-[2.25rem] font-bold tracking-tighter leading-none mb-2 text-foreground">
                {project.name}
              </h1>
              <p className="text-sm text-on-surface-variant flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-tertiary" />
                {pendingCount} Pending task{pendingCount !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <BulkActions projectId={project.id} doneCount={doneCount} />
              <TodoFilters />
            </div>
          </div>

          {/* Task list */}
          {visibleTodos.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-sm text-on-surface-variant">
                {filter === "done"
                  ? "No completed todos"
                  : filter === "pending"
                    ? "No pending todos"
                    : "No todos yet"}
              </p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext
                items={pendingIds}
                strategy={verticalListSortingStrategy}
              >
                <ul className="space-y-px">
                  {visibleTodos.map((todo) => (
                    <TodoItem
                      key={todo.id}
                      todo={todo}
                      projectId={project.id}
                      sortable={!todo.done}
                    />
                  ))}
                </ul>
              </SortableContext>
              <DragOverlay>
                {activeTodo ? <DragOverlayItem todo={activeTodo} /> : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  );
}
