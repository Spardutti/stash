import { invoke } from "@tauri-apps/api/core";

const RELEASES_API =
  "https://api.github.com/repos/Spardutti/stash/releases/latest";

export interface UpdateInfo {
  latestVersion: string;
  htmlUrl: string;
}

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  draft?: boolean;
  prerelease?: boolean;
}

/** Strips a leading "v" from a tag name. */
function normalize(version: string): string {
  return version.replace(/^v/i, "").trim();
}

/**
 * Compare two semver-like version strings. Returns:
 *   positive if `a` > `b`, negative if `a` < `b`, 0 if equal.
 * Non-numeric segments are treated as 0.
 */
export function compareVersions(a: string, b: string): number {
  const aParts = normalize(a).split(".").map((n) => Number(n) || 0);
  const bParts = normalize(b).split(".").map((n) => Number(n) || 0);
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const res = await fetch(RELEASES_API, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`Update check failed: ${res.status}`);
  const release = (await res.json()) as GitHubRelease;
  if (release.draft || release.prerelease) return null;

  const latest = normalize(release.tag_name);
  const current = __APP_VERSION__;
  if (compareVersions(latest, current) <= 0) return null;

  return { latestVersion: latest, htmlUrl: release.html_url };
}

export async function openExternalUrl(url: string): Promise<void> {
  await invoke("open_external_url", { url });
}
