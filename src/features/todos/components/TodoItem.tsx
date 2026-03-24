import { memo, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Todo } from "@/types";
import { useProjectActions } from "@/stores/projectStore";
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

export const TodoItem = memo(function TodoItem({
  todo,
  projectId,
  sortable = false,
}: TodoItemProps) {
  const actions = useProjectActions();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(todo.text);
  const [copied, setCopied] = useState(false);

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

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
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

  if (isEditing) {
    return (
      <li ref={setNodeRef} style={style} className="flex items-center gap-3 px-2 py-2.5">
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
      </li>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <li
          ref={setNodeRef}
          style={style}
          className="task-row group flex items-center gap-3 px-2 py-2.5 cursor-pointer border-b border-border/5 transition-colors"
        >
          {sortable && (
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab touch-none text-on-surface-variant/30 hover:text-on-surface-variant"
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
          )}

          <input
            type="checkbox"
            checked={todo.done}
            onChange={() => actions.toggleTodo(projectId, todo.id)}
            className="h-4 w-4 shrink-0 appearance-none rounded-sm border border-border bg-transparent checked:bg-primary checked:border-primary cursor-pointer transition-all"
            aria-label={todo.done ? "Mark as pending" : "Mark as done"}
          />

          <span
            onClick={() => {
              setEditText(todo.text);
              setIsEditing(true);
            }}
            className={`flex-1 text-sm font-medium truncate cursor-pointer ${
              todo.done ? "text-outline line-through" : "text-foreground"
            }`}
          >
            {todo.text}
          </span>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
        </li>
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
        <ContextMenuItem
          onClick={() => actions.toggleTodo(projectId, todo.id)}
        >
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
