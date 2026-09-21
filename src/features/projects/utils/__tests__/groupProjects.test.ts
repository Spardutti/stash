import { describe, test, expect } from "vitest";
import type { Project, Todo } from "@/types";
import { groupProjects, sidebarOrder } from "../groupProjects";

function makeTodo(done: boolean): Todo {
  return { id: crypto.randomUUID(), text: "t", done, createdAt: "", doneAt: null, order: 0 };
}

function makeProject(name: string, todos: Todo[] = []): Project {
  return { id: name, name, createdAt: "", todos };
}

describe("groupProjects", () => {
  test("project with a pending todo is active", () => {
    const project = makeProject("a", [makeTodo(false)]);

    const { active, upToDate } = groupProjects([project]);

    expect(active).toEqual([project]);
    expect(upToDate).toEqual([]);
  });

  test("project with only done todos is up to date", () => {
    const project = makeProject("a", [makeTodo(true)]);

    const { upToDate } = groupProjects([project]);

    expect(upToDate).toEqual([project]);
  });

  test("project with no todos is up to date", () => {
    const project = makeProject("a");

    const { upToDate } = groupProjects([project]);

    expect(upToDate).toEqual([project]);
  });
});

describe("sidebarOrder", () => {
  test("puts up-to-date projects after active ones, keeping their order", () => {
    const empty1 = makeProject("e1");
    const busy1 = makeProject("b1", [makeTodo(false)]);
    const empty2 = makeProject("e2");
    const busy2 = makeProject("b2", [makeTodo(false)]);

    const ordered = sidebarOrder([empty1, busy1, empty2, busy2]);

    expect(ordered.map((p) => p.name)).toEqual(["b1", "b2", "e1", "e2"]);
  });
});
