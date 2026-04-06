import type { Project } from "@/types";

// Use the browser's native fetch — Tauri's plugin fetch drops the body
const nativeFetch = window.fetch.bind(window);

const GITHUB_API = "https://api.github.com";
const GIST_FILENAME = "stash-data.json";

interface GistFile {
  filename: string;
  content: string;
}

interface GistResponse {
  id: string;
  files: Record<string, GistFile>;
}

interface StashSnapshot {
  version: 1;
  syncedAt: string;
  projects: Project[];
}

export interface SyncResult {
  projects: Project[];
  syncedAt: string;
}

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

export async function uploadToGist(
  token: string,
  gistId: string | null,
  projects: Project[],
): Promise<string> {
  const snapshot: StashSnapshot = {
    version: 1,
    syncedAt: new Date().toISOString(),
    projects,
  };

  const body = JSON.stringify({
    description: "Stash — todo sync",
    public: false,
    files: {
      [GIST_FILENAME]: {
        content: JSON.stringify(snapshot, null, 2),
      },
    },
  });

  if (gistId) {
    const res = await nativeFetch(`${GITHUB_API}/gists/${gistId}`, {
      method: "PATCH",
      headers: headers(token),
      body,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to update gist: ${res.status} ${err}`);
    }
    const data: GistResponse = await res.json();
    return data.id;
  }

  const res = await nativeFetch(`${GITHUB_API}/gists`, {
    method: "POST",
    headers: headers(token),
    body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create gist: ${res.status} ${err}`);
  }
  const data: GistResponse = await res.json();
  return data.id;
}

export async function downloadFromGist(
  token: string,
  gistId: string,
): Promise<SyncResult> {
  const res = await nativeFetch(`${GITHUB_API}/gists/${gistId}`, {
    method: "GET",
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to read gist: ${res.status} ${err}`);
  }

  const data: GistResponse = await res.json();
  const file = data.files[GIST_FILENAME];
  if (!file) {
    throw new Error(`Gist does not contain ${GIST_FILENAME}`);
  }

  const snapshot: StashSnapshot = JSON.parse(file.content);
  if (!snapshot.projects || !Array.isArray(snapshot.projects)) {
    throw new Error("Invalid stash data in gist");
  }

  return { projects: snapshot.projects, syncedAt: snapshot.syncedAt };
}
