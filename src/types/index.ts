export interface Todo {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
  doneAt: string | null;
  order: number;
  label?: string;
  labelPromptDismissed?: boolean;
}

export const LABEL_LINE_THRESHOLD = 3;
export const LABEL_CHAR_THRESHOLD = 160;

export function needsLabelPrompt(text: string): boolean {
  return (
    text.split("\n").length > LABEL_LINE_THRESHOLD ||
    text.length > LABEL_CHAR_THRESHOLD
  );
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  todos: Todo[];
}

export interface Settings {
  theme: "light" | "dark";
  hotkey: string;
  quickViewHotkey: string;
  lastProjectId: string | null;
  minimizeToTray: boolean;
  startWithSystem: boolean;
  githubToken: string | null;
  gistId: string | null;
  lastSyncedAt: string | null;
  fontSize: "small" | "medium" | "large";
}

export type TodoFilter = "all" | "pending" | "done";
