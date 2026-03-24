import type { Todo } from "@/types";

interface DragOverlayItemProps {
  todo: Todo;
}

export function DragOverlayItem({ todo }: DragOverlayItemProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-surface-high px-3 py-2.5 shadow-float">
      <div className="h-4 w-4 shrink-0 rounded-sm border border-border" />
      <span className="text-sm font-medium text-foreground">{todo.text}</span>
    </div>
  );
}
