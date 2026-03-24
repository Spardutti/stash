---
name: zustand
category: Frontend
description: "MUST USE when writing or editing Zustand stores, selectors, or middleware. Enforces store design, selector optimization, persist/immer middleware, slices pattern, and TypeScript integration."
---

# Zustand Best Practices

> For server state, use `react-query` skill. For component state, use `react-best-practices` skill.

## Store Creation

```tsx
// BAD: no type annotation, no curried call
const useStore = create((set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),
}));

// GOOD: typed with curried ()() for middleware inference
interface CountState {
  count: number;
  increment: () => void;
}

const useCountStore = create<CountState>()((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
```

## Selectors — Prevent Re-renders

```tsx
// BAD: selects entire store — re-renders on ANY change
const { bears, fish } = useBearStore();

// BAD: new object reference every call — always re-renders
const data = useBearStore((s) => ({ bears: s.bears, fish: s.fish }));

// GOOD: atomic selectors — re-renders only when that value changes
const bears = useBearStore((s) => s.bears);
const fish = useBearStore((s) => s.fish);

// GOOD: useShallow for multiple values
import { useShallow } from "zustand/react/shallow";
const { bears, fish } = useBearStore(
  useShallow((s) => ({ bears: s.bears, fish: s.fish }))
);
```

### Export Custom Hooks — Never Expose Raw Store

```tsx
// BAD: consumers can accidentally subscribe to everything
export const useBearStore = create<BearState>()(/* ... */);

// GOOD: encapsulated selectors
const useBearStore = create<BearState>()(/* ... */);
export const useBears = () => useBearStore((s) => s.bears);
export const useBearActions = () => useBearStore((s) => s.actions);
```

## Actions — Events Not Setters

```tsx
// BAD: setter leaks business logic to components
const useStore = create<State>()((set) => ({
  bears: 0,
  setBears: (value: number) => set({ bears: value }),
}));
// component: setBears(bears + 1) — logic lives in component

// GOOD: event-driven actions keep logic in the store
const useStore = create<State>()((set) => ({
  bears: 0,
  actions: {
    increasePopulation: (by: number) =>
      set((s) => ({ bears: s.bears + by })),
    removeAllBears: () => set({ bears: 0 }),
  },
}));
```

## Persist Middleware

```tsx
import { persist, createJSONStorage } from "zustand/middleware";

interface AppState {
  theme: "light" | "dark";
  token: string | null;
  setTheme: (t: "light" | "dark") => void;
}

const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: "light",
      token: null,
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "app-storage",
      storage: createJSONStorage(() => localStorage),
      // GOOD: exclude functions and ephemeral state
      partialize: (state) => ({ theme: state.theme, token: state.token }),
      version: 2,
      migrate: (persisted, version) => {
        if (version === 1) return { ...persisted, theme: "light" };
        return persisted;
      },
    }
  )
);
```

**Persist gotchas:**
- Default merge is shallow — nested objects need custom `merge` function
- SSR: use `skipHydration: true` then call `useStore.persist.rehydrate()` in `useEffect`
- Never persist functions — deployments break when signatures change

## Immer Middleware — For Deep Nesting

```tsx
// BAD: manual spread for deep updates
set((state) => ({
  user: {
    ...state.user,
    profile: {
      ...state.user.profile,
      settings: { ...state.user.profile.settings, theme: "dark" },
    },
  },
}));

// GOOD: immer for mutable-looking immutable updates
import { immer } from "zustand/middleware/immer";

const useStore = create<State>()(
  immer((set) => ({
    user: { profile: { settings: { theme: "light" } } },
    setTheme: (theme: string) =>
      set((state) => {
        state.user.profile.settings.theme = theme;
      }),
  }))
);
```

## Middleware Composition Order

```tsx
// Always: devtools → persist → immer (outside → inside)
const useStore = create<State>()(
  devtools(
    persist(
      immer((set) => ({ /* ... */ })),
      { name: "store" }
    ),
    { name: "AppStore" }
  )
);
```

## Devtools

```tsx
import { devtools } from "zustand/middleware";

const useStore = create<State>()(
  devtools(
    (set) => ({
      bears: 0,
      increase: (by: number) =>
        set(
          (s) => ({ bears: s.bears + by }),
          undefined,
          "bears/increase" // action name in Redux DevTools
        ),
    }),
    { name: "BearStore", enabled: process.env.NODE_ENV === "development" }
  )
);
```

## Slices Pattern — Large Stores

```tsx
import { create, type StateCreator } from "zustand";

interface BearSlice { bears: number; addBear: () => void }
interface FishSlice { fishes: number; addFish: () => void }
type Store = BearSlice & FishSlice;

// Each slice types against FULL store for cross-slice access
const createBearSlice: StateCreator<Store, [], [], BearSlice> = (set) => ({
  bears: 0,
  addBear: () => set((s) => ({ bears: s.bears + 1 })),
});

const createFishSlice: StateCreator<Store, [], [], FishSlice> = (set) => ({
  fishes: 0,
  addFish: () => set((s) => ({ fishes: s.fishes + 1 })),
});

const useStore = create<Store>()((...a) => ({
  ...createBearSlice(...a),
  ...createFishSlice(...a),
}));
```

## Transient Updates — High-Frequency State

```tsx
// BAD: React re-renders 60fps for cursor position
const position = useMouseStore((s) => s.position);

// GOOD: subscribe directly, bypass React
function Cursor() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    return useMouseStore.subscribe((state) => {
      if (ref.current) {
        ref.current.style.transform = `translate(${state.x}px, ${state.y}px)`;
      }
    });
  }, []);
  return <div ref={ref} className="cursor-dot" />;
}
```

## Async Actions

```tsx
const useDataStore = create<DataState>()((set) => ({
  data: null,
  isLoading: false,
  fetchData: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch("/api/data");
      set({ data: await res.json(), isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },
}));
```

## Rules

1. **Always** use atomic selectors or `useShallow` — never select the entire store
2. **Always** export custom hooks, not the raw store hook
3. **Always** use `partialize` in persist to exclude functions and ephemeral state
4. **Always** use the curried `create<T>()()` pattern with TypeScript
5. **Never** create new object references inside selectors without `useShallow`
6. **Never** store derived state — compute it in selectors or components
7. **Never** define stores inside components — stores are module-level singletons
8. **Prefer** event-driven actions (`increasePopulation`) over setters (`setBears`)
9. **Prefer** immer only for deeply nested state (3+ levels) — it adds ~16KB
10. **Prefer** multiple focused stores over one monolithic store
