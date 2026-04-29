import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
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
import { needsLabelPrompt } from "@/types";
import { useTodoFilter, useProjectActions } from "@/stores/projectStore";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { TodoInput } from "./TodoInput";
import { TodoFilters } from "./TodoFilters";
import { TodoItem } from "./TodoItem";
import { BulkActions } from "./BulkActions";
import { DragOverlayItem } from "./DragOverlayItem";
import { LabelPromptModal } from "./LabelPromptModal";

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
  const [autoPromptTodoId, setAutoPromptTodoId] = useState<string | null>(null);

  const autoPromptTodo = autoPromptTodoId
    ? project.todos.find((t) => t.id === autoPromptTodoId)
    : undefined;

  // Local reorder state — takes priority during drag to prevent snap-back.
  // Two zones: priority (top) and normal (bottom).
  const [localPriorityOrder, setLocalPriorityOrder] = useState<string[] | null>(
    null,
  );
  const [localNormalOrder, setLocalNormalOrder] = useState<string[] | null>(
    null,
  );
  const isDragging = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const { priorityTodos, normalTodos, pendingTodos, doneTodos, doneCount } =
    useMemo(() => {
      const pending = project.todos
        .filter((t) => !t.done)
        .sort((a, b) => a.order - b.order);

      const priority = pending.filter((t) => t.priority);
      const normal = pending.filter((t) => !t.priority);

      const done = project.todos
        .filter((t) => t.done)
        .sort((a, b) => {
          const aTime = a.doneAt ? new Date(a.doneAt).getTime() : 0;
          const bTime = b.doneAt ? new Date(b.doneAt).getTime() : 0;
          return bTime - aTime;
        });

      return {
        priorityTodos: priority,
        normalTodos: normal,
        pendingTodos: pending,
        doneTodos: done,
        doneCount: done.length,
      };
    }, [project.todos]);

  // Staggered bulk delete — IDs being dismissed one by one
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());

  const staggerDeleteDone = useCallback(() => {
    if (doneTodos.length === 0) return;

    const ids = doneTodos.map((t) => t.id);
    // Stagger: add each ID 50ms apart
    ids.forEach((id, i) => {
      setTimeout(() => {
        setDismissingIds((prev) => new Set(prev).add(id));
      }, i * 50);
    });
    // After all animations, persist the delete — don't clear dismissingIds
    // until the store update removes the items (avoids flash-back)
    setTimeout(async () => {
      await actions.bulkDeleteDone(project.id);
      setDismissingIds(new Set());
    }, ids.length * 50 + 300);
  }, [doneTodos, actions, project.id]);

  // Use local zone orders during drag, store order otherwise
  const priorityIds = useMemo(() => {
    if (localPriorityOrder) return localPriorityOrder;
    return priorityTodos.map((t) => t.id);
  }, [localPriorityOrder, priorityTodos]);

  const normalIds = useMemo(() => {
    if (localNormalOrder) return localNormalOrder;
    return normalTodos.map((t) => t.id);
  }, [localNormalOrder, normalTodos]);

  // Build the visible task lists for each zone, filtering out dismissing items
  const { visiblePriorityTodos, visibleNormalTodos, visibleDoneTodos } = useMemo(() => {
    const pendingMap = new Map(pendingTodos.map((t) => [t.id, t]));
    const ordered = (ids: string[]) =>
      ids.map((id) => pendingMap.get(id)).filter((t): t is Todo => t !== undefined);

    const filteredDone = doneTodos.filter((t) => !dismissingIds.has(t.id));

    return {
      visiblePriorityTodos: ordered(priorityIds),
      visibleNormalTodos: ordered(normalIds),
      visibleDoneTodos: filteredDone,
    };
  }, [pendingTodos, priorityIds, normalIds, doneTodos, dismissingIds]);

  const showPriority = filter !== "done" && visiblePriorityTodos.length > 0;
  const showNormal = filter !== "done" && visibleNormalTodos.length > 0;
  const showDone = filter !== "pending" && visibleDoneTodos.length > 0;
  const isEmpty = !showPriority && !showNormal && !showDone;

  const activeTodo: Todo | undefined = activeId
    ? project.todos.find((t) => t.id === activeId)
    : undefined;

  const handleDragStart = (event: DragStartEvent) => {
    isDragging.current = true;
    setActiveId(event.active.id as string);
    setLocalPriorityOrder(priorityTodos.map((t) => t.id));
    setLocalNormalOrder(normalTodos.map((t) => t.id));
  };

  // Reorder in real-time during drag — supports cross-zone moves
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !localPriorityOrder || !localNormalOrder) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const fromZone: "priority" | "normal" | null = localPriorityOrder.includes(
      activeId,
    )
      ? "priority"
      : localNormalOrder.includes(activeId)
        ? "normal"
        : null;
    const toZone: "priority" | "normal" | null = localPriorityOrder.includes(
      overId,
    )
      ? "priority"
      : localNormalOrder.includes(overId)
        ? "normal"
        : null;
    if (!fromZone || !toZone) return;

    if (fromZone === toZone) {
      const list = fromZone === "priority" ? localPriorityOrder : localNormalOrder;
      const setList =
        fromZone === "priority" ? setLocalPriorityOrder : setLocalNormalOrder;
      const oldIdx = list.indexOf(activeId);
      const newIdx = list.indexOf(overId);
      if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;
      setList(arrayMove(list, oldIdx, newIdx));
    } else {
      const fromList =
        fromZone === "priority" ? localPriorityOrder : localNormalOrder;
      const toList =
        fromZone === "priority" ? localNormalOrder : localPriorityOrder;
      const setFrom =
        fromZone === "priority" ? setLocalPriorityOrder : setLocalNormalOrder;
      const setTo =
        fromZone === "priority" ? setLocalNormalOrder : setLocalPriorityOrder;

      setFrom(fromList.filter((id) => id !== activeId));
      const insertIdx = toList.indexOf(overId);
      if (insertIdx === -1) {
        setTo([...toList, activeId]);
      } else {
        setTo([
          ...toList.slice(0, insertIdx),
          activeId,
          ...toList.slice(insertIdx),
        ]);
      }
    }
  };

  const handleDragEnd = async (_event: DragEndEvent) => {
    isDragging.current = false;
    setActiveId(null);

    if (!localPriorityOrder || !localNormalOrder) return;

    const orderedIds = [...localPriorityOrder, ...localNormalOrder];
    const priorityIdSet = new Set(localPriorityOrder);
    await actions.reorderTodos(project.id, orderedIds, priorityIdSet);
    setLocalPriorityOrder(null);
    setLocalNormalOrder(null);
  };

  const handleDragCancel = () => {
    isDragging.current = false;
    setActiveId(null);
    setLocalPriorityOrder(null);
    setLocalNormalOrder(null);
  };

  // Listen for Ctrl+D bulk delete event from MainLayout
  useEffect(() => {
    const handleBulkDelete = () => {
      if (doneCount > 0) {
        staggerDeleteDone();
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
      {/* Dashboard canvas */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          {/* Page header — large editorial heading + filters */}
          <div className="flex items-start justify-between mb-4 border-b border-border/10 pb-3">
            <div>
              <h1 className="text-[2.25rem] font-bold tracking-tighter leading-none mb-2 text-foreground">
                {project.name}
              </h1>
              <div className="text-sm text-on-surface-variant flex items-center gap-2">
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
                <BulkActions projectId={project.id} doneCount={doneCount} onDelete={staggerDeleteDone} />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <TodoFilters />
            </div>
          </div>

          {/* Task input */}
          <TodoInput
            onAdd={async (text) => {
              const todo = await actions.addTodo(project.id, text);
              if (todo && needsLabelPrompt(text)) {
                setAutoPromptTodoId(todo.id);
              }
            }}
            onAddMultiple={(texts) => actions.addTodos(project.id, texts)}
          />

          {/* Task list */}
          {isEmpty ? (
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
              {showPriority && (
                <SortableContext
                  items={priorityIds}
                  strategy={verticalListSortingStrategy}
                >
                  <AnimatePresence initial={false}>
                    {visiblePriorityTodos.map((todo) => (
                      <TodoItem
                        key={todo.id}
                        todo={todo}
                        projectId={project.id}
                        sortable
                      />
                    ))}
                  </AnimatePresence>
                </SortableContext>
              )}
              {showNormal && (
                <SortableContext
                  items={normalIds}
                  strategy={verticalListSortingStrategy}
                >
                  <AnimatePresence initial={false}>
                    {visibleNormalTodos.map((todo) => (
                      <TodoItem
                        key={todo.id}
                        todo={todo}
                        projectId={project.id}
                        sortable
                      />
                    ))}
                  </AnimatePresence>
                </SortableContext>
              )}
              {showDone && (
                <AnimatePresence initial={false}>
                  {visibleDoneTodos.map((todo) => (
                    <TodoItem
                      key={todo.id}
                      todo={todo}
                      projectId={project.id}
                      sortable={false}
                    />
                  ))}
                </AnimatePresence>
              )}
              {/* Always mounted — children conditional */}
              <DragOverlay dropAnimation={dropAnimation}>
                {activeTodo ? <DragOverlayItem todo={activeTodo} /> : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </div>
      <LabelPromptModal
        open={autoPromptTodo !== undefined}
        autoPrompted
        content={autoPromptTodo?.text ?? ""}
        onSave={async (label) => {
          if (!autoPromptTodo) return;
          await actions.setTodoLabel(project.id, autoPromptTodo.id, label);
          setAutoPromptTodoId(null);
        }}
        onSkip={async () => {
          if (autoPromptTodo) {
            await actions.dismissLabelPrompt(project.id, autoPromptTodo.id);
          }
          setAutoPromptTodoId(null);
        }}
      />
    </div>
  );
}
