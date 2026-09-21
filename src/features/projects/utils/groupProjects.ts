import type { Project } from "@/types";

export interface ProjectGroups {
  active: Project[];
  upToDate: Project[];
}

export function groupProjects(projects: Project[]): ProjectGroups {
  const hasPending = (p: Project) => p.todos.some((t) => !t.done);
  return {
    active: projects.filter(hasPending),
    upToDate: projects.filter((p) => !hasPending(p)),
  };
}

/** Projects in the order the sidebar shows them. */
export function sidebarOrder(projects: Project[]): Project[] {
  const { active, upToDate } = groupProjects(projects);
  return [...active, ...upToDate];
}
