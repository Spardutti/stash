import { useEffect, useRef, useState } from "react";

interface HotkeyRecorderProps {
  hotkey: string;
  onChange: (hotkey: string) => void;
}

export function HotkeyRecorder({ hotkey, onChange }: HotkeyRecorderProps) {
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (recording) {
      recorderRef.current?.focus();
    }
  }, [recording]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!recording) return;
    e.preventDefault();

    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
    if (e.shiftKey) parts.push("Shift");
    if (e.altKey) parts.push("Alt");

    const key = e.key;
    if (!["Control", "Shift", "Alt", "Meta"].includes(key)) {
      parts.push(key.length === 1 ? key.toUpperCase() : key);
      const combo = parts.join("+");
      onChange(combo);
      setRecording(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div
        ref={recorderRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onBlur={() => setRecording(false)}
        className={`rounded-lg border px-4 py-2 text-label font-mono transition-colors ${
          recording
            ? "border-tertiary text-foreground"
            : "border-border/15 text-on-surface-variant"
        }`}
      >
        {recording ? "Press a key combo..." : hotkey}
      </div>
      <button
        onClick={() => setRecording(true)}
        className="rounded-lg bg-surface-high px-4 py-2 text-label font-medium text-secondary hover:opacity-80 transition-opacity"
      >
        {recording ? "Recording..." : "Record"}
      </button>
    </div>
  );
}
