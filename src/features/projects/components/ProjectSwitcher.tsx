import { useState, useRef, useEffect } from "react";
import { m, AnimatePresence } from "motion/react";
import type { Project } from "@/types";
import { useProjects, useProjectActions } from "@/stores/projectStore";
import { useSettingsActions } from "@/stores/settingsStore";

interface ProjectSwitcherProps {
  open: boolean;
  onClose: () => void;
  onSelect?: () => void;
}

export function ProjectSwitcher({ open, onClose, onSelect }: ProjectSwitcherProps) {
  const projects = useProjects();
  const projectActions = useProjectActions();
  const settingsActions = useSettingsActions();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = (project: Project) => {
    projectActions.setActiveProject(project.id);
    settingsActions.setLastProjectId(project.id);
    onSelect ? onSelect() : onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter": {
        e.preventDefault();
        const project = filtered[selectedIndex];
        if (project) handleSelect(project);
        break;
      }
      case "Escape":
        onClose();
        break;
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24">
          <m.div
            className="absolute inset-0 bg-background/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <m.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.12 }}
            className="glass relative z-10 w-full max-w-md overflow-hidden rounded-lg border border-border/10 shadow-float"
            onKeyDown={handleKeyDown}
          >
            <div className="flex items-center border-b border-border/10">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-3 text-on-surface-variant">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects..."
                className="w-full bg-transparent px-3 py-2.5 text-label text-foreground placeholder:text-on-surface-variant/50 focus:outline-none"
              />
            </div>
            <ul className="max-h-64 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-4 py-2 text-label text-on-surface-variant">
                  No projects found
                </li>
              ) : (
                filtered.map((project, i) => (
                  <li
                    key={project.id}
                    onClick={() => handleSelect(project)}
                    className={`cursor-pointer px-4 py-2 text-xs transition-colors ${
                      i === selectedIndex
                        ? "bg-surface-high text-foreground"
                        : "text-on-surface-variant hover:text-foreground"
                    }`}
                  >
                    {project.name}
                  </li>
                ))
              )}
            </ul>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
