import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  MeasuringStrategy,
  useSensors,
  useSensor,
  PointerSensor,
  KeyboardSensor,
  DragOverlay,
  defaultDropAnimationSideEffects,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import type { Project, Todo } from "@/types";
import { useTodoFilter, useProjectActions } from "@/stores/projectStore";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { TodoInput } from "./TodoInput";
import { TodoFilters } from "./TodoFilters";
import { TodoItem } from "./TodoItem";
import { BulkActions } from "./BulkActions";
import { DragOverlayItem } from "./DragOverlayItem";

// Measure droppables continuously for accurate drop targets
const measuring = {
  droppable: {
    strategy: MeasuringStrategy.Always,
  },
};

// Smooth drop animation with fade on source element
const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: "0.4",
      },
    },
  }),
};

interface TodoListProps {
  project: Project;
}

export function TodoList({ project }: TodoListProps) {
  const filter = useTodoFilter();
  const actions = useProjectActions();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Local reorder state — takes priority during drag to prevent snap-back
  const [localPendingOrder, setLocalPendingOrder] = useState<string[] | null>(
    null,
  );
  const isDragging = useRef(false);

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

  // Use local order during drag, store order otherwise
  const pendingIds = useMemo(() => {
    if (localPendingOrder) return localPendingOrder;
    return pendingTodos.map((t) => t.id);
  }, [localPendingOrder, pendingTodos]);

  // Build visible todos from the current pending order
  const visibleTodos = useMemo(() => {
    const pendingMap = new Map(pendingTodos.map((t) => [t.id, t]));
    const orderedPending = pendingIds
      .map((id) => pendingMap.get(id))
      .filter((t): t is Todo => t !== undefined);

    switch (filter) {
      case "pending":
        return orderedPending;
      case "done":
        return doneTodos;
      default:
        return [...orderedPending, ...doneTodos];
    }
  }, [filter, pendingIds, pendingTodos, doneTodos]);

  const activeTodo: Todo | undefined = activeId
    ? project.todos.find((t) => t.id === activeId)
    : undefined;

  const handleDragStart = (event: DragStartEvent) => {
    isDragging.current = true;
    setActiveId(event.active.id as string);
    setLocalPendingOrder(pendingTodos.map((t) => t.id));
  };

  // Reorder in real-time during drag
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !localPendingOrder) return;

    const oldIndex = localPendingOrder.indexOf(active.id as string);
    const newIndex = localPendingOrder.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    setLocalPendingOrder(arrayMove(localPendingOrder, oldIndex, newIndex));
  };

  const handleDragEnd = async (_event: DragEndEvent) => {
    isDragging.current = false;
    setActiveId(null);

    if (!localPendingOrder) {
      return;
    }

    // Always persist — onDragOver already moved the item, so
    // active.id === over.id by the time dragEnd fires
    await actions.reorderTodos(project.id, localPendingOrder);
    setLocalPendingOrder(null);
  };

  const handleDragCancel = () => {
    isDragging.current = false;
    setActiveId(null);
    setLocalPendingOrder(null);
  };

  // Listen for Ctrl+D bulk delete event from MainLayout
  useEffect(() => {
    const handleBulkDelete = () => {
      if (doneCount > 0) {
        actions.bulkDeleteDone(project.id);
      }
    };
    window.addEventListener("stash:bulk-delete-done", handleBulkDelete);
    return () =>
      window.removeEventListener("stash:bulk-delete-done", handleBulkDelete);
  }, [actions, project.id, doneCount]);

  const [headerCopied, setHeaderCopied] = useState(false);
  const pendingCount = pendingTodos.length;

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* Top header bar */}
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
                {pendingCount > 0 && (
                  <Tooltip>
                    <TooltipTrigger
                      onClick={() => {
                        const text = pendingTodos
                          .map((t) => `- ${t.text}`)
                          .join("\n");
                        navigator.clipboard.writeText(text);
                        setHeaderCopied(true);
                        setTimeout(() => setHeaderCopied(false), 1500);
                      }}
                      className={`transition-colors ${headerCopied ? "text-tertiary" : "text-on-surface-variant/40 hover:text-foreground"}`}
                      aria-label="Copy pending todos"
                    >
                      {headerCopied ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                        </svg>
                      )}
                    </TooltipTrigger>
                    <TooltipContent>{headerCopied ? "Copied!" : "Copy all pending todos"}</TooltipContent>
                  </Tooltip>
                )}
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
              measuring={measuring}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
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
              {/* Always mounted — children conditional */}
              <DragOverlay dropAnimation={dropAnimation}>
                {activeTodo ? <DragOverlayItem todo={activeTodo} /> : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  );
}
