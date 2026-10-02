import type { Project } from "@/types";
import { generateId, isProject, saveProject } from "./storage";

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
): Promise<Project[]> {
  const parsed: unknown = JSON.parse(json);
  if (!hasProjectsArray(parsed)) {
    throw new Error("Invalid workspace file");
  }

  const incoming = parsed.projects.filter(isProject);

  const imported: Project[] = [];
  for (const project of incoming) {
    const withNewId = { ...project, id: generateId() };
    await saveProject(withNewId);
    imported.push(withNewId);
  }

  return imported;
}

function hasProjectsArray(value: unknown): value is { projects: unknown[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    "projects" in value &&
    Array.isArray(value.projects)
  );
}
