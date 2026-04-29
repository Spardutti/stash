import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

const DISMISSED_KEY = "stash_wayland_warning_dismissed";

export function WaylandWarningBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (localStorage.getItem(DISMISSED_KEY) === "1") return;
        const isWayland = await invoke<boolean>("is_wayland_session");
        if (cancelled || !isWayland) return;
        setShow(true);
      } catch (err) {
        console.error("[wayland] Detection failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setShow(false);
  };

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/10 bg-surface-high/60 px-4 py-2 text-sm">
      <div className="flex items-center gap-2 text-foreground">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-tertiary">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span>
          Global shortcuts don't work on Wayland. To enable them, log out and pick "Ubuntu on Xorg" at the login screen.
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleDismiss}
          className="rounded-lg px-3 py-1 text-xs font-medium text-on-surface-variant hover:text-foreground transition-colors"
          aria-label="Dismiss Wayland warning"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
