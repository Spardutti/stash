import { useEffect, useRef, useState } from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

const LIST_PREFIX = /^(?:\[[ xX]?\]\s*|[-*]\s+)/;

function parseListLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => LIST_PREFIX.test(line))
    .map((line) => line.replace(LIST_PREFIX, "").trim())
    .filter((line) => line.length > 0);
}

const PLACEHOLDERS = [
  "Add a task...",
  "Paste a list (-, *, []) to bulk add...",
];

const ROTATION_INTERVAL = 5000;

interface TodoInputProps {
  onAdd: (text: string) => void;
  onAddMultiple?: (texts: string[]) => void;
}

export function TodoInput({ onAdd, onAddMultiple }: TodoInputProps) {
  const [text, setText] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Listen for Ctrl+L focus event from MainLayout
  useEffect(() => {
    const handleFocus = () => inputRef.current?.focus();
    window.addEventListener("stash:focus-todo-input", handleFocus);
    return () =>
      window.removeEventListener("stash:focus-todo-input", handleFocus);
  }, []);

  // Rotate placeholder text
  useEffect(() => {
    const id = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
    }, ROTATION_INTERVAL);
    return () => clearInterval(id);
  }, []);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setText("");
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (!onAddMultiple) return;

    const pasted = e.clipboardData.getData("text/plain");
    const lines = parseListLines(pasted);

    if (lines.length >= 2) {
      e.preventDefault();
      onAddMultiple(lines);
    }
  };

  return (
    <div className="relative flex items-center group mb-4">
      <Tooltip>
        <TooltipTrigger
          className="absolute left-4 text-on-surface-variant group-focus-within:text-foreground transition-colors"
          aria-label="Add task"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Paste lines starting with -, *, or [] to add multiple tasks
        </TooltipContent>
      </Tooltip>
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
        }}
        onPaste={handlePaste}
        placeholder={PLACEHOLDERS[placeholderIndex]}
        className="h-10 w-full rounded-lg bg-surface-high border border-border/10 pl-12 pr-4 text-sm text-foreground placeholder:text-on-surface-variant/50 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all"
      />
    </div>
  );
}
