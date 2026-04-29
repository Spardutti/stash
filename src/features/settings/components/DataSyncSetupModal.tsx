import { useEffect } from "react";
import { openExternalUrl } from "@/services/updateCheck";

interface DataSyncSetupModalProps {
  open: boolean;
  onClose: () => void;
}

export function DataSyncSetupModal({ open, onClose }: DataSyncSetupModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-background/60"
        onClick={onClose}
        role="presentation"
      />
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-xl flex-col rounded-lg border border-border/10 bg-surface-highest shadow-float">
        <div className="flex items-start justify-between border-b border-border/10 px-6 py-4">
          <div>
            <h3 className="text-base font-bold text-foreground">
              Set up Cloud Sync
            </h3>
            <p className="mt-1 text-xs text-on-surface-variant/70">
              Sync your tasks across devices through a private GitHub Gist.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-on-surface-variant/60 transition-colors hover:bg-surface-high hover:text-foreground"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-6">
          <ol className="space-y-6">
            <Step number={1} title="Create a GitHub access token">
              <p>
                Stash needs a personal access token with permission to read and write a single Gist.
                Use a <span className="font-medium text-foreground">fine-grained</span> token for the
                tightest scope.
              </p>
              <ul className="ml-4 mt-2 list-disc space-y-1 text-on-surface-variant/80">
                <li>Token name: anything you'll recognize (e.g. "Stash sync")</li>
                <li>Expiration: pick what you're comfortable with</li>
                <li>Repository access: <span className="font-mono text-foreground">Public Repositories (read-only)</span> is fine — Gists are separate</li>
                <li>Account permissions: enable <span className="font-mono text-foreground">Gists → Read and write</span></li>
              </ul>
              <ExternalButton
                url="https://github.com/settings/personal-access-tokens/new"
                label="Open GitHub token page"
              />
            </Step>

            <Step number={2} title="Create a private Gist">
              <p>
                Create a new Gist on GitHub. The contents don't matter — Stash will overwrite it on
                first upload. Make sure to choose <span className="font-medium text-foreground">Create secret gist</span>{" "}
                so it stays private.
              </p>
              <ul className="ml-4 mt-2 list-disc space-y-1 text-on-surface-variant/80">
                <li>Filename: anything (e.g. <span className="font-mono text-foreground">stash.json</span>)</li>
                <li>Content: a single space, or <span className="font-mono text-foreground">{`{}`}</span></li>
                <li>Click <span className="font-medium text-foreground">Create secret gist</span></li>
              </ul>
              <ExternalButton url="https://gist.github.com/" label="Open new Gist page" />
            </Step>

            <Step number={3} title="Copy the Gist ID">
              <p>
                After creating the Gist, look at the URL in your browser. It looks like:
              </p>
              <pre className="mt-2 overflow-x-auto rounded-lg border border-border/10 bg-surface-high px-3 py-2 font-mono text-xs text-on-surface-variant">
                https://gist.github.com/your-name/<span className="text-foreground">a1b2c3d4e5f6...</span>
              </pre>
              <p className="mt-2">
                The long string at the end is the <span className="font-medium text-foreground">Gist ID</span>. Copy it.
              </p>
            </Step>

            <Step number={4} title="Paste both into Stash">
              <p>
                Back in this Settings panel: paste the token into the GitHub PAT field and hit{" "}
                <span className="font-medium text-foreground">Save</span>. Stash will create or
                connect to a Gist automatically. To use a specific existing Gist, paste its ID into
                the Gist ID field.
              </p>
              <p className="mt-2 text-on-surface-variant/70">
                Once saved, the desktop app auto-uploads on close and auto-downloads on launch.
              </p>
            </Step>
          </ol>
        </div>

        <div className="flex justify-end border-t border-border/10 px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-high text-xs font-bold text-foreground">
        {number}
      </div>
      <div className="flex-1 text-sm text-on-surface-variant">
        <h4 className="mb-2 text-sm font-bold text-foreground">{title}</h4>
        {children}
      </div>
    </li>
  );
}

function ExternalButton({ url, label }: { url: string; label: string }) {
  const handleClick = async () => {
    try {
      await openExternalUrl(url);
    } catch (err) {
      console.error("[setup] Failed to open external URL:", err);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border/15 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-high"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
      {label}
    </button>
  );
}
