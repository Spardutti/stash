import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";

interface StatusBarProps {
  pendingCount: number;
  totalCount: number;
  projectName?: string;
}

export function StatusBar({ pendingCount, totalCount, projectName }: StatusBarProps) {
  const [version, setVersion] = useState("");

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion("dev"));
  }, []);

  return (
    <footer className="flex h-6 shrink-0 items-center justify-between border-t border-border/10 bg-surface-lowest px-3 font-mono text-micro text-on-surface-variant/60">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-tertiary shadow-[0_0_8px_rgba(205,229,255,0.4)]" />
          <span>READY</span>
        </div>
        {projectName && (
          <span className="uppercase">PROJECT: {projectName}</span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span>TASKS: {pendingCount}/{totalCount}</span>
        <span className="bg-surface-high px-2 font-bold text-foreground">
          STASH v{version}
        </span>
      </div>
    </footer>
  );
}
