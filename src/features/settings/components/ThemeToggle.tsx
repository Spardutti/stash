interface ThemeToggleProps {
  theme: "light" | "dark";
  onChange: (theme: "light" | "dark") => void;
}

export function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  return (
    <div className="flex gap-1 rounded-lg border border-border/10 bg-surface-lowest p-1">
      <button
        onClick={() => onChange("light")}
        className={`rounded px-4 py-1.5 text-label font-bold uppercase tracking-widest transition-colors ${
          theme === "light"
            ? "bg-primary text-primary-foreground"
            : "text-on-surface-variant hover:text-foreground"
        }`}
      >
        Light
      </button>
      <button
        onClick={() => onChange("dark")}
        className={`rounded px-4 py-1.5 text-label font-bold uppercase tracking-widest transition-colors ${
          theme === "dark"
            ? "bg-primary text-primary-foreground"
            : "text-on-surface-variant hover:text-foreground"
        }`}
      >
        Dark
      </button>
    </div>
  );
}
