import {
  readTextFile,
  writeTextFile,
  exists,
  mkdir,
  remove,
  readDir,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";
import type { Project, Settings } from "@/types";

const BASE_DIR = BaseDirectory.AppData;
const PROJECTS_DIR = "projects";
const SETTINGS_FILE = "settings.json";

const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  hotkey: "Ctrl+Shift+Space",
  lastProjectId: null,
  minimizeToTray: true,
};

export async function ensureDataDir(): Promise<void> {
  const projectsExists = await exists(PROJECTS_DIR, { baseDir: BASE_DIR });
  if (!projectsExists) {
    await mkdir(PROJECTS_DIR, { baseDir: BASE_DIR, recursive: true });
  }
}

export async function loadSettings(): Promise<Settings> {
  const fileExists = await exists(SETTINGS_FILE, { baseDir: BASE_DIR });
  if (!fileExists) {
    return { ...DEFAULT_SETTINGS };
  }

  const content = await readTextFile(SETTINGS_FILE, { baseDir: BASE_DIR });
  const parsed: unknown = JSON.parse(content);
  if (!isSettings(parsed)) {
    return { ...DEFAULT_SETTINGS };
  }
  // Merge with defaults so new fields get their default values
  return { ...DEFAULT_SETTINGS, ...parsed };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await writeTextFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), {
    baseDir: BASE_DIR,
  });
}

export async function loadAllProjects(): Promise<Project[]> {
  const dirExists = await exists(PROJECTS_DIR, { baseDir: BASE_DIR });
  if (!dirExists) {
    return [];
  }

  const entries = await readDir(PROJECTS_DIR, { baseDir: BASE_DIR });
  const projects: Project[] = [];

  for (const entry of entries) {
    if (!entry.name?.endsWith(".json")) continue;

    const content = await readTextFile(`${PROJECTS_DIR}/${entry.name}`, {
      baseDir: BASE_DIR,
    });

    const parsed: unknown = JSON.parse(content);
    if (isProject(parsed)) {
      projects.push(parsed);
    }
  }

  return projects;
}

export async function loadProject(filename: string): Promise<Project | null> {
  const path = `${PROJECTS_DIR}/${filename}.json`;
  const fileExists = await exists(path, { baseDir: BASE_DIR });
  if (!fileExists) return null;

  const content = await readTextFile(path, { baseDir: BASE_DIR });
  const parsed: unknown = JSON.parse(content);
  return isProject(parsed) ? parsed : null;
}

export async function saveProject(project: Project): Promise<void> {
  const filename = slugify(project.name);
  await writeTextFile(
    `${PROJECTS_DIR}/${filename}.json`,
    JSON.stringify(project, null, 2),
    { baseDir: BASE_DIR },
  );
}

export async function deleteProjectFile(project: Project): Promise<void> {
  const filename = slugify(project.name);
  const path = `${PROJECTS_DIR}/${filename}.json`;
  const fileExists = await exists(path, { baseDir: BASE_DIR });
  if (fileExists) {
    await remove(path, { baseDir: BASE_DIR });
  }
}

export async function renameProjectFile(
  oldName: string,
  newName: string,
): Promise<void> {
  const oldPath = `${PROJECTS_DIR}/${slugify(oldName)}.json`;
  const oldExists = await exists(oldPath, { baseDir: BASE_DIR });
  if (oldExists && slugify(oldName) !== slugify(newName)) {
    await remove(oldPath, { baseDir: BASE_DIR });
  }
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateId(): string {
  return crypto.randomUUID();
}

// --- Import/Export ---

interface Workspace {
  version: number;
  projects: Project[];
}

export function exportProjectJson(project: Project): string {
  return JSON.stringify(project, null, 2);
}

export function exportWorkspaceJson(projects: Project[]): string {
  const workspace: Workspace = { version: 1, projects };
  return JSON.stringify(workspace, null, 2);
}

export async function importProjectFromJson(
  json: string,
): Promise<Project> {
  const parsed: unknown = JSON.parse(json);
  if (!isProject(parsed)) {
    throw new Error("Invalid project file");
  }
  // Assign a new ID to avoid conflicts
  const imported = { ...parsed, id: generateId() };
  await saveProject(imported);
  return imported;
}

export async function importWorkspaceFromJson(
  json: string,
  mode: "merge" | "replace",
): Promise<Project[]> {
  const parsed: unknown = JSON.parse(json);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as Record<string, unknown>).projects)
  ) {
    throw new Error("Invalid workspace file");
  }

  const workspace = parsed as Workspace;
  const incoming = workspace.projects.filter(isProject);

  if (mode === "replace") {
    // Delete existing projects
    const existing = await loadAllProjects();
    for (const p of existing) {
      await deleteProjectFile(p);
    }
  }

  const imported: Project[] = [];
  for (const project of incoming) {
    const withNewId = { ...project, id: generateId() };
    await saveProject(withNewId);
    imported.push(withNewId);
  }

  return imported;
}

// --- Validators ---

function isSettings(value: unknown): value is Settings {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    (obj.theme === "light" || obj.theme === "dark") &&
    typeof obj.hotkey === "string" &&
    (obj.lastProjectId === null || typeof obj.lastProjectId === "string")
  );
}

function isProject(value: unknown): value is Project {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.createdAt === "string" &&
    Array.isArray(obj.todos)
  );
}
