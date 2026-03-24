import type { TodoFilter } from "@/types";
import { useTodoFilter, useProjectActions } from "@/stores/projectStore";

const FILTERS: { value: TodoFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "done", label: "Done" },
];

export function TodoFilters() {
  const current = useTodoFilter();
  const actions = useProjectActions();

  return (
    <div className="flex gap-1 rounded-lg border border-border/10 bg-surface-lowest p-1">
      {FILTERS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => actions.setFilter(value)}
          className={`px-4 py-1.5 text-[0.6875rem] font-bold uppercase tracking-widest rounded transition-colors ${
            current === value
              ? "bg-primary text-primary-foreground"
              : "text-on-surface-variant hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
