import { m, useMotionValue, useTransform } from "motion/react";

interface AnimatedCheckboxProps {
  checked: boolean;
  onChange: () => void;
}

export function AnimatedCheckbox({ checked, onChange }: AnimatedCheckboxProps) {
  const pathLength = useMotionValue(0);
  const checkOpacity = useTransform(pathLength, [0.05, 0.15], [0, 1]);

  return (
    <button
      onClick={onChange}
      className="relative flex h-5 w-5 shrink-0 items-center justify-center"
      aria-label={checked ? "Mark as pending" : "Mark as done"}
    >
      {/* Box background — pops on check */}
      <m.div
        animate={{
          scale: checked ? [1, 1.2, 1] : 1,
          backgroundColor: checked ? "var(--tertiary)" : "transparent",
          borderColor: checked ? "var(--tertiary)" : "var(--outline-variant)",
        }}
        transition={{
          scale: { type: "spring", stiffness: 500, damping: 15 },
          backgroundColor: { duration: 0.15 },
          borderColor: { duration: 0.15 },
        }}
        className="absolute inset-0 rounded-sm border-2"
      />

      {/* Checkmark SVG — draws itself */}
      <svg viewBox="0 0 24 24" className="relative h-3 w-3" fill="none">
        <m.path
          d="M5 12l5 5L19 7"
          stroke="var(--on-tertiary)"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 0.9 : 0 }}
          style={{ opacity: checkOpacity, pathLength }}
          transition={{
            pathLength: {
              type: "tween",
              duration: 0.25,
              ease: "easeInOut",
              delay: checked ? 0.05 : 0,
            },
          }}
        />
      </svg>
    </button>
  );
}
