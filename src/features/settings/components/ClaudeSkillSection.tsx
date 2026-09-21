import { useState } from "react";

const RAW = "https://raw.githubusercontent.com/Spardutti/stash/master/claude";

const COMMANDS = [
  {
    label: "macOS / Linux / WSL",
    command: `curl -fsSL --create-dirs -o ~/.claude/skills/stash/SKILL.md ${RAW}/SKILL.md -o ~/.claude/skills/stash/stash.mjs ${RAW}/stash.mjs`,
  },
  {
    label: "Windows (PowerShell)",
    command: `curl.exe -fsSL --create-dirs -o "$HOME/.claude/skills/stash/SKILL.md" ${RAW}/SKILL.md -o "$HOME/.claude/skills/stash/stash.mjs" ${RAW}/stash.mjs`,
  },
];

const isWindows = navigator.userAgent.includes("Windows");
const shown = isWindows ? COMMANDS : COMMANDS.slice(0, 1);

function CommandBox({ label, command }: { label: string; command: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/30">
          {label}
        </span>
        <button
          onClick={handleCopy}
          className="text-xs font-medium text-tertiary hover:opacity-80 transition-opacity"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="whitespace-pre-wrap break-all rounded-lg bg-surface-low border border-border px-3 py-2 font-mono text-[11px] text-on-surface-variant">
        {command}
      </pre>
    </div>
  );
}

export function ClaudeSkillSection(): React.JSX.Element {
  return (
    <div>
      <h2 className="mb-6 text-xs font-bold uppercase tracking-widest text-on-surface-variant/40">
        Claude Code
      </h2>
      <p className="mb-4 text-xs text-on-surface-variant/60">
        Let Claude Code read and add your todos. Run this where you use Claude, then ask it
        "what's on my stash?". Needs Node.js.
      </p>
      <div className="space-y-4">
        {shown.map((c) => (
          <CommandBox key={c.label} label={c.label} command={c.command} />
        ))}
      </div>
    </div>
  );
}
