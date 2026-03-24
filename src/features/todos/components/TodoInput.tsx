import { useEffect, useRef, useState } from "react";

interface TodoInputProps {
  onAdd: (text: string) => void;
}

export function TodoInput({ onAdd }: TodoInputProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Listen for Ctrl+L focus event from MainLayout
  useEffect(() => {
    const handleFocus = () => inputRef.current?.focus();
    window.addEventListener("stash:focus-todo-input", handleFocus);
    return () =>
      window.removeEventListener("stash:focus-todo-input", handleFocus);
  }, []);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setText("");
  };

  return (
    <div className="relative flex items-center group">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="absolute left-2 text-on-surface-variant group-focus-within:text-foreground transition-colors"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
        }}
        placeholder="Add a task..."
        className="h-7 w-48 rounded bg-surface-high border-none pl-8 pr-3 text-[11px] text-foreground placeholder:text-on-surface-variant/50 focus:ring-1 focus:ring-primary focus:outline-none transition-all"
      />
    </div>
  );
}
