export interface Todo {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
  doneAt: string | null;
  order: number;
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
}

export type TodoFilter = "all" | "pending" | "done";
