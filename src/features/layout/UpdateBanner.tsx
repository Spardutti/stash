import { useEffect, useState } from "react";
import {
  checkForUpdate,
  openExternalUrl,
  type UpdateInfo,
} from "@/services/updateCheck";

const DISMISSED_KEY = "stash_update_dismissed_version";

export function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const info = await checkForUpdate();
        if (cancelled || !info) return;
        const dismissed = localStorage.getItem(DISMISSED_KEY);
        if (dismissed === info.latestVersion) return;
        setUpdate(info);
      } catch (err) {
        console.error("[update] Check failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!update) return null;

  const handleDownload = async () => {
    try {
      await openExternalUrl(update.htmlUrl);
    } catch (err) {
      console.error("[update] Failed to open release URL:", err);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, update.latestVersion);
    setUpdate(null);
  };

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/10 bg-surface-high/60 px-4 py-2 text-sm">
      <div className="flex items-center gap-2 text-foreground">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-tertiary">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span>
          Stash v{update.latestVersion} is available.
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleDownload}
          className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Download
        </button>
        <button
          onClick={handleDismiss}
          className="rounded-lg px-3 py-1 text-xs font-medium text-on-surface-variant hover:text-foreground transition-colors"
          aria-label="Dismiss update notification"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
