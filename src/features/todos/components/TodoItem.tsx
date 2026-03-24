import { memo, useCallback, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { m } from "motion/react";
import type { Todo } from "@/types";
import { useProjectActions } from "@/stores/projectStore";
import { AnimatedCheckbox } from "./AnimatedCheckbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface TodoItemProps {
  todo: Todo;
  projectId: string;
  sortable?: boolean;
}

// Animation constants — defined outside to not break memo
const enterAnimation = { opacity: 1, x: 0, height: "auto" };
const exitAnimation = {
  opacity: 0,
  x: -20,
  transition: {
    opacity: { duration: 0.15 },
    x: { duration: 0.2 },
  },
};
const layoutTransition = { type: "spring" as const, stiffness: 400, damping: 30 };

export const TodoItem = memo(function TodoItem({
  todo,
  projectId,
  sortable = false,
}: TodoItemProps) {
  const actions = useProjectActions();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(todo.text);
  const [copied, setCopied] = useState(false);
  // Local "completing" state — plays animation before toggling
  const [completing, setCompleting] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: todo.id,
    disabled: !sortable,
  });

  // Outer wrapper style — dnd-kit controls this
  const dndStyle = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  const handleSave = async () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== todo.text) {
      await actions.editTodo(projectId, todo.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(todo.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleToggle = useCallback(() => {
    if (todo.done) {
      // Unchecking — toggle immediately
      actions.toggleTodo(projectId, todo.id);
    } else {
      // Checking — play animation first, then toggle after delay
      setCompleting(true);
      setTimeout(() => {
        actions.toggleTodo(projectId, todo.id);
        setCompleting(false);
      }, 400);
    }
  }, [todo.done, todo.id, projectId, actions]);

  const isChecked = todo.done || completing;

  if (isEditing) {
    return (
      <div ref={setNodeRef} style={dndStyle}>
        <div className="flex items-center gap-3 px-2 py-2.5">
          <input
            autoFocus
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") {
                setIsEditing(false);
                setEditText(todo.text);
              }
            }}
            onBlur={handleSave}
            className="flex-1 rounded bg-transparent border border-border/30 px-2 py-1 text-sm text-foreground focus:border-tertiary focus:outline-none"
          />
        </div>
      </div>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        {/* Outer: dnd-kit controls transform */}
        <div ref={setNodeRef} style={dndStyle}>
          {/* Inner: Framer Motion controls layout + exit */}
          <m.div
            layout={!isDragging}
            initial={{ opacity: 0, x: -20, height: "auto" }}
            animate={{
              ...enterAnimation,
              opacity: isDragging ? 0.5 : 1,
            }}
            exit={exitAnimation}
            transition={{ layout: layoutTransition }}
            style={{ overflow: "hidden" }}
            className="task-row group flex items-start gap-3 px-2 py-2.5 cursor-pointer border-b border-border/5 transition-colors"
          >
            {sortable ? (
              <button
                {...attributes}
                {...listeners}
                className="mt-0.5 shrink-0 cursor-grab touch-none text-on-surface-variant/30 hover:text-on-surface-variant"
                data-drag-handle
                aria-label="Drag to reorder"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="5" r="1" />
                  <circle cx="9" cy="12" r="1" />
                  <circle cx="9" cy="19" r="1" />
                  <circle cx="15" cy="5" r="1" />
                  <circle cx="15" cy="12" r="1" />
                  <circle cx="15" cy="19" r="1" />
                </svg>
              </button>
            ) : (
              <span className="w-[14px] shrink-0" aria-hidden />
            )}

            {/* Animated checkbox */}
            <div className="mt-0.5 shrink-0">
              <AnimatedCheckbox checked={isChecked} onChange={handleToggle} />
            </div>

            {/* Text with animated strikethrough */}
            <span
              onClick={() => {
                setEditText(todo.text);
                setIsEditing(true);
              }}
              className="relative flex-1 text-sm font-medium break-words min-w-0 cursor-pointer"
            >
              <m.span
                animate={{
                  color: isChecked
                    ? "var(--outline)"
                    : "var(--foreground)",
                }}
                transition={{ duration: 0.25 }}
              >
                {todo.text}
              </m.span>
              {/* Strikethrough line that draws left-to-right */}
              <m.span
                initial={false}
                animate={{ scaleX: isChecked ? 1 : 0 }}
                transition={{ duration: 0.25, ease: [0.55, 0, 0.1, 1] }}
                className="absolute left-0 top-1/2 h-[1.5px] w-full bg-outline"
                style={{ transformOrigin: "left center" }}
              />
            </span>

            <div className="mt-0.5 flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleCopy}
                className={`rounded p-1 transition-colors ${
                  copied
                    ? "text-tertiary"
                    : "text-on-surface-variant/50 hover:text-foreground"
                }`}
                aria-label="Copy todo text"
              >
                {copied ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                )}
              </button>

              <button
                onClick={() => actions.deleteTodo(projectId, todo.id)}
                className="rounded p-1 text-on-surface-variant/50 hover:text-error transition-colors"
                aria-label="Delete todo"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </button>
            </div>
          </m.div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() => {
            setEditText(todo.text);
            setTimeout(() => setIsEditing(true), 100);
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
          Edit
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopy}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </svg>
          Copy text
        </ContextMenuItem>
        <ContextMenuItem onClick={handleToggle}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {todo.done ? (
              <>
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </>
            ) : (
              <polyline points="20 6 9 17 4 12" />
            )}
          </svg>
          {todo.done ? "Mark pending" : "Mark done"}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => actions.deleteTodo(projectId, todo.id)}
          className="text-destructive focus:text-destructive"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});
