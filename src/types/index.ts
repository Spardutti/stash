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
  lastProjectId: string | null;
}

export type TodoFilter = "all" | "pending" | "done";
