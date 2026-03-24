---
name: framer-motion
category: Frontend
description: "MUST USE when writing animations with motion (framer-motion) — motion components, AnimatePresence, layout animations, variants, gestures, useAnimate, performance, and transitions."
---

# Motion (Framer Motion) Best Practices

> Package renamed: import from `motion/react` (not `framer-motion`). API is identical.

## Basic Animations

```tsx
import { motion } from "motion/react";

// GPU-accelerated properties: x, y, scale, rotate, opacity
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
/>

// Keyframes — animate through multiple values
<motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.4 }} />
```

## AnimatePresence — Mount/Unmount Animations

```tsx
// BAD: missing key — AnimatePresence can't track exits
<AnimatePresence>
  {isOpen && <motion.div exit={{ opacity: 0 }} />}
</AnimatePresence>

// BAD: wrapping each item in its own AnimatePresence
{items.map((item) => (
  <AnimatePresence key={item.id}>
    <motion.li exit={{ opacity: 0 }}>{item.name}</motion.li>
  </AnimatePresence>
))}

// GOOD: one AnimatePresence, unique keys on direct children
<AnimatePresence mode="wait">
  {isOpen && (
    <motion.div
      key="modal"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
    />
  )}
</AnimatePresence>

// GOOD: list with exit animations
<AnimatePresence>
  {items.map((item) => (
    <motion.li
      key={item.id}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
    >
      {item.name}
    </motion.li>
  ))}
</AnimatePresence>
```

**Modes:** `"sync"` (default, simultaneous), `"wait"` (exit completes before enter — good for page transitions), `"popLayout"` (exit pops out of flow).

**Gotchas:** React Fragments (`<>`) break exit tracking. `AnimatePresence` must stay mounted. `initial={false}` skips entry animation on first render.

## Layout Animations

```tsx
// BAD: animating width/height — triggers layout reflow
<motion.div animate={{ width: isExpanded ? 300 : 100 }} />

// GOOD: layout prop — Motion uses FLIP technique with transforms
<motion.div layout style={{ width: isExpanded ? 300 : 100 }} />
```

**Layout values:** `true` (position + size), `"position"` (position only), `"size"` (size only).

### Shared Layout with layoutId

```tsx
// Same layoutId on two elements = seamless transition between them
function Grid({ items, onSelect }: Props) {
  return items.map((item) => (
    <motion.div key={item.id} layoutId={item.id} onClick={() => onSelect(item)}>
      <motion.img layoutId={`img-${item.id}`} src={item.src} />
    </motion.div>
  ));
}

function Overlay({ item, onClose }: Props) {
  return (
    <motion.div layoutId={item.id} onClick={onClose}>
      <motion.img layoutId={`img-${item.id}`} src={item.src} />
    </motion.div>
  );
}
```

Use `<LayoutGroup id="sidebar">` to namespace `layoutId` when rendering multiple instances.

## Variants — Orchestrated Animations

```tsx
const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.2 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// Children inherit variant names from parent — no need to set initial/animate on each
<motion.ul variants={container} initial="hidden" animate="visible">
  {items.map((i) => (
    <motion.li key={i.id} variants={item}>{i.name}</motion.li>
  ))}
</motion.ul>
```

**Orchestration props:** `staggerChildren`, `delayChildren`, `staggerDirection` (1 forward, -1 reverse), `when` ("beforeChildren" | "afterChildren").

## Gestures

```tsx
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  transition={{ type: "spring", stiffness: 400, damping: 17 }}
/>

// Drag constrained to parent
const constraintsRef = useRef(null);
<motion.div ref={constraintsRef}>
  <motion.div
    drag
    dragConstraints={constraintsRef}
    dragElastic={0.2}
    whileDrag={{ scale: 1.1 }}
  />
</motion.div>
```

## useAnimate — Imperative Control

```tsx
import { useAnimate, stagger } from "motion/react";

function Notification() {
  const [scope, animate] = useAnimate();

  const show = async () => {
    await animate(scope.current, { y: 0, opacity: 1 }, { duration: 0.3 });
    await animate(scope.current, { y: -20, opacity: 0 }, { delay: 2 });
  };

  return <div ref={scope} style={{ opacity: 0 }}>Alert!</div>;
}

// Staggered children with CSS selectors
const [scope, animate] = useAnimate();
await animate("li", { opacity: 1, x: 0 }, { delay: stagger(0.1) });
```

## Spring vs Tween Transitions

```tsx
// Spring: default for x, y, scale, rotate — physics-based, feels natural
transition={{ type: "spring", stiffness: 300, damping: 30 }}
// Or duration-based spring:
transition={{ type: "spring", duration: 0.5, bounce: 0.25 }}

// Tween: default for opacity, colors — precise duration control
transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
// Custom cubic bezier:
transition={{ ease: [0.25, 0.1, 0.25, 1], duration: 0.3 }}
```

**Use spring** for movement/gestures (incorporates velocity for natural handoff). **Use tween** for fades and color changes.

## Performance

```tsx
// BAD: animating layout-triggering properties
<motion.div animate={{ width: 300, height: 200, top: 50 }} />

// GOOD: use transform properties (GPU-accelerated)
<motion.div animate={{ x: 100, scale: 1.2, opacity: 1 }} />
// Or use layout prop for size/position changes
<motion.div layout />
```

### useMotionValue — Bypass React Renders

```tsx
// BAD: motion value in React state — causes re-renders
const [x, setX] = useState(0);

// GOOD: useMotionValue updates outside React's render cycle
import { useMotionValue, useTransform } from "motion/react";

const x = useMotionValue(0);
const opacity = useTransform(x, [-100, 0, 100], [0, 1, 0]);
const bg = useTransform(x, [-100, 100], ["#ff0000", "#00ff00"]);

<motion.div style={{ x, opacity, backgroundColor: bg }} drag="x" />
```

### Bundle Optimization with LazyMotion

```tsx
// BAD: importing full motion — ~30KB
import { motion } from "motion/react";

// GOOD: lazy load features — ~17KB for animations only
import { LazyMotion, domAnimation, m } from "motion/react";

function App() {
  return (
    <LazyMotion features={domAnimation}>
      <m.div animate={{ opacity: 1 }} />
    </LazyMotion>
  );
}
// Use domMax (~29KB) if you need gestures, drag, or layout animations
```

### Scroll Animations

```tsx
import { motion, useScroll, useTransform } from "motion/react";

// Scroll-triggered — animate when element enters viewport
<motion.div
  initial={{ opacity: 0, y: 50 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.3 }}
/>

// Scroll-linked — animation progress tied to scroll position
const { scrollYProgress } = useScroll();
const scale = useTransform(scrollYProgress, [0, 1], [1, 1.5]);
<motion.div style={{ scale }} />
```

## Rules

1. **Always** use `key` on direct children of AnimatePresence — exits fail silently without it
2. **Always** use transform properties (x, y, scale, rotate, opacity) — not width/height/top/left
3. **Always** use `useMotionValue` for values that change frequently — never put them in React state
4. **Always** use `mode="wait"` on AnimatePresence for page transitions — prevents overlap flicker
5. **Never** wrap each list item in its own AnimatePresence — one wrapper for all animated children
6. **Never** use React Fragments as direct AnimatePresence children — breaks exit tracking
7. **Never** animate box-shadow or filter directly — use opacity on a separate layer instead
8. **Prefer** spring transitions for movement, tween for opacity/color changes
9. **Prefer** `layout` prop over animating size/position properties — uses GPU-accelerated FLIP
10. **Prefer** `LazyMotion` + `m` components to reduce bundle size
