#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir, release } from "node:os";
import { join } from "node:path";

const APP_ID = "com.stash.desktop";

function fail(message) {
  console.error(message);
  process.exit(1);
}

// Under WSL the app runs on Windows, so its data sits in a Windows user folder.
function findWslDir() {
  const users = "/mnt/c/Users";
  if (!existsSync(users)) return undefined;
  return readdirSync(users)
    .map((user) => join(users, user, "AppData/Roaming", APP_ID, "projects"))
    .find(existsSync);
}

function findDataDir() {
  if (process.env.STASH_DIR) return process.env.STASH_DIR;
  if (process.platform === "win32") return join(process.env.APPDATA ?? "", APP_ID, "projects");
  if (process.platform === "darwin") {
    return join(homedir(), "Library/Application Support", APP_ID, "projects");
  }
  const dataHome = process.env.XDG_DATA_HOME ?? join(homedir(), ".local/share");
  const linuxDir = join(dataHome, APP_ID, "projects");
  const isWsl = release().toLowerCase().includes("microsoft");
  return (isWsl && findWslDir()) || linuxDir;
}

const DIR = findDataDir();
if (!existsSync(DIR)) fail(`No Stash data at ${DIR}. Open the Stash app once, or set STASH_DIR.`);

function loadAll() {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ file: join(DIR, f), data: JSON.parse(readFileSync(join(DIR, f), "utf8")) }));
}

function findProject(query) {
  if (!query) fail("Missing <project>. Run `projects` to see names.");
  const q = query.toLowerCase();
  const match = loadAll().find(
    ({ file, data }) => data.name.toLowerCase() === q || file.toLowerCase().endsWith(`/${q}.json`),
  );
  if (!match) fail(`No project named "${query}". Run \`projects\` to see names.`);
  return match;
}

// Write to a temp file then rename, so the app never reads a half-written file.
function save({ file, data }) {
  writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2));
  renameSync(`${file}.tmp`, file);
}

function byOrder(a, b) {
  return a.order - b.order;
}

function display(todo) {
  return todo.label ?? todo.text;
}

function cmdProjects() {
  for (const { data } of loadAll()) {
    const pending = data.todos.filter((t) => !t.done).length;
    console.log(`${data.name}\t${pending} pending`);
  }
}

// Must match slugify in src/services/storage.ts, or the app saves to a second file.
function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cmdCreate(name) {
  const slug = slugify(name);
  if (!slug) fail('Missing "name". Use letters or numbers.');
  const file = join(DIR, `${slug}.json`);
  if (existsSync(file)) fail(`Project "${name}" already exists.`);
  const data = { id: randomUUID(), name: name.trim(), createdAt: new Date().toISOString(), todos: [] };
  save({ file, data });
  console.log(`Created ${data.name}`);
}

function cmdList(query) {
  const { data } = findProject(query);
  const pending = data.todos.filter((t) => !t.done).sort(byOrder);
  if (pending.length === 0) console.log("No pending todos.");
  for (const t of pending) {
    console.log(`${t.id.slice(0, 8)}  ${t.priority ? "! " : ""}${display(t)}`);
  }
}

function parseAddArgs(args) {
  const i = args.indexOf("--label");
  if (i === -1) return { text: args.join(" "), label: undefined };
  const label = args[i + 1]?.trim();
  if (!label) fail("--label needs a value.");
  const rest = args.filter((_, j) => j !== i && j !== i + 1);
  return { text: rest.join(" "), label };
}

function cmdAdd(query, args) {
  const project = findProject(query);
  const { text, label } = parseAddArgs(args);
  if (!text.trim()) fail('Missing "text".');
  const todo = {
    id: randomUUID(),
    text,
    done: false,
    createdAt: new Date().toISOString(),
    doneAt: null,
    order: 0,
    ...(label && { label }),
  };
  const shifted = project.data.todos.map((t) => (t.done ? t : { ...t, order: t.order + 1 }));
  project.data.todos = [todo, ...shifted];
  save(project);
  console.log(`Added ${todo.id.slice(0, 8)}  ${display(todo)}`);
}

function cmdDone(query, idPrefix) {
  if (!idPrefix) fail("Missing <id>. Run `list` to see ids.");
  const project = findProject(query);
  const hits = project.data.todos.filter((t) => t.id.startsWith(idPrefix));
  if (hits.length !== 1) fail(`Expected 1 todo matching "${idPrefix}", found ${hits.length}.`);
  const todo = hits[0];
  if (todo.done) fail("Already done.");
  todo.done = true;
  todo.doneAt = new Date().toISOString();
  save(project);
  console.log(`Done ${todo.id.slice(0, 8)}  ${display(todo)}`);
}

function cmdDelete(query, idPrefix) {
  if (!idPrefix) fail("Missing <id>. Run `list` to see ids.");
  const project = findProject(query);
  const hits = project.data.todos.filter((t) => t.id.startsWith(idPrefix));
  if (hits.length !== 1) fail(`Expected 1 todo matching "${idPrefix}", found ${hits.length}.`);
  project.data.todos = project.data.todos.filter((t) => t !== hits[0]);
  save(project);
  console.log(`Deleted ${hits[0].id.slice(0, 8)}  ${display(hits[0])}`);
}

const USAGE = `Usage:
  stash.mjs projects
  stash.mjs create "name"
  stash.mjs list <project>
  stash.mjs add <project> "text" [--label "short name"]
  stash.mjs done <project> <id>
  stash.mjs delete <project> <id>`;

const [cmd, project, ...rest] = process.argv.slice(2);
if (cmd === "projects") cmdProjects();
else if (cmd === "create") cmdCreate([project, ...rest].join(" "));
else if (cmd === "list") cmdList(project);
else if (cmd === "add") cmdAdd(project, rest);
else if (cmd === "done") cmdDone(project, rest[0]);
else if (cmd === "delete") cmdDelete(project, rest[0]);
else fail(USAGE);
