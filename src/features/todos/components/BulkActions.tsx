import { useState } from "react";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";

interface BulkActionsProps {
  projectId: string;
  doneCount: number;
  onDelete: () => void;
}

export function BulkActions({ doneCount, onDelete }: BulkActionsProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  if (doneCount === 0) return null;

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="text-[0.6875rem] text-on-surface-variant hover:text-error transition-colors"
      >
        Clear done ({doneCount})
      </button>

      <ConfirmDialog
        open={showConfirm}
        title="Delete Completed Todos"
        message={`Delete ${doneCount} completed todo${doneCount === 1 ? "" : "s"}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          onDelete();
          setShowConfirm(false);
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
