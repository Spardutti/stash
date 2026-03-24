import { describe, test, expect } from "vitest";
import { slugify, generateId, exportProjectJson, exportWorkspaceJson } from "../storage";
import type { Project } from "@/types";

describe("slugify", () => {
  test.each([
    { input: "My Game", expected: "my-game", desc: "spaces to hyphens" },
    { input: "Shallow Hope", expected: "shallow-hope", desc: "two words" },
    { input: "  trimmed  ", expected: "trimmed", desc: "trims whitespace" },
    { input: "Special!@#Chars", expected: "special-chars", desc: "removes special chars" },
    { input: "", expected: "", desc: "empty string" },
    { input: "already-slugged", expected: "already-slugged", desc: "already valid" },
    { input: "UPPERCASE", expected: "uppercase", desc: "lowercases" },
    { input: "---leading-trailing---", expected: "leading-trailing", desc: "strips leading/trailing hyphens" },
  ])("$desc: '$input' → '$expected'", ({ input, expected }) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe("generateId", () => {
  test("returns a valid UUID string", () => {
    const id = generateId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  test("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe("exportProjectJson", () => {
  test("serializes project to formatted JSON", () => {
    const project: Project = {
      id: "test-id",
      name: "Test Project",
      createdAt: "2026-01-01T00:00:00Z",
      todos: [],
    };

    const json = exportProjectJson(project);
    const parsed = JSON.parse(json);

    expect(parsed.id).toBe("test-id");
    expect(parsed.name).toBe("Test Project");
    expect(parsed.todos).toEqual([]);
  });
});

describe("exportWorkspaceJson", () => {
  test("wraps projects in workspace envelope with version", () => {
    const projects: Project[] = [
      { id: "1", name: "A", createdAt: "2026-01-01T00:00:00Z", todos: [] },
      { id: "2", name: "B", createdAt: "2026-01-02T00:00:00Z", todos: [] },
    ];

    const json = exportWorkspaceJson(projects);
    const parsed = JSON.parse(json);

    expect(parsed.version).toBe(1);
    expect(parsed.projects).toHaveLength(2);
    expect(parsed.projects[0].name).toBe("A");
  });
});
