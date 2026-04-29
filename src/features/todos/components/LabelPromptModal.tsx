import { useEffect, useRef, useState } from "react";

interface LabelPromptModalProps {
  open: boolean;
  initialLabel?: string;
  content: string;
  autoPrompted?: boolean;
  onSave: (label: string) => void;
  onSkip: () => void;
  onRemove?: () => void;
}

export function LabelPromptModal({
  open,
  initialLabel = "",
  content,
  autoPrompted = false,
  onSave,
  onSkip,
  onRemove,
}: LabelPromptModalProps) {
  const [label, setLabel] = useState(initialLabel);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setLabel(initialLabel);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, initialLabel]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onSkip]);

  if (!open) return null;

  const handleSave = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    onSave(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-background/60"
        onClick={onSkip}
        role="presentation"
      />
      <div className="relative z-10 w-full max-w-lg rounded-lg bg-surface-highest p-6 shadow-float border border-border/10">
        <h3 className="text-base font-bold text-foreground">
          {autoPrompted ? "This task is long — add a short label?" : "Edit label"}
        </h3>
        <p className="mt-2 text-sm text-on-surface-variant">
          A label replaces the content when the task is collapsed. The full
          content is kept intact, used for copy, and shown when expanded.
        </p>

        <label className="mt-6 block text-xs font-bold uppercase tracking-widest text-on-surface-variant/60">
          Label
        </label>
        <input
          ref={inputRef}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSave();
            }
          }}
          placeholder="e.g. Send message to Alex"
          className="mt-2 h-10 w-full rounded-lg bg-surface-high border border-border/10 px-3 text-sm text-foreground placeholder:text-on-surface-variant/50 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none"
        />

        <label className="mt-4 block text-xs font-bold uppercase tracking-widest text-on-surface-variant/60">
          Content
        </label>
        <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-surface-high border border-border/10 px-3 py-2 text-sm text-on-surface-variant font-sans">
          {content}
        </pre>

        <div className="mt-6 flex items-center justify-end gap-2">
          {onRemove && initialLabel ? (
            <button
              onClick={onRemove}
              className="mr-auto rounded-lg px-4 py-2 text-sm font-medium text-destructive hover:bg-surface-high transition-colors"
            >
              Remove label
            </button>
          ) : null}
          <button
            onClick={onSkip}
            className="rounded-lg border border-border/15 px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-high transition-colors"
          >
            {autoPrompted ? "Not now" : "Cancel"}
          </button>
          <button
            onClick={handleSave}
            disabled={!label.trim()}
            className="rounded-lg px-4 py-2 text-sm font-bold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            Save label
          </button>
        </div>
      </div>
    </div>
  );
}
