export type Page = "note" | "todo" | "calendar";

export interface Task {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
}

export type TasksByDate = Record<string, Task[]>;

export interface Note {
  id: string;
  text: string;
  createdAt: string;
}

export interface AppData {
  tasks: TasksByDate;
  notes: Note[];
}
