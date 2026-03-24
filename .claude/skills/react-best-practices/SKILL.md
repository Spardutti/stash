---
name: react-best-practices
category: Frontend
description: "MUST USE when writing or editing React components, hooks, state management, or component architecture. Enforces React 19 best practices — component design, state patterns, performance, and TypeScript integration."
---

# React Best Practices (React 19)

> useEffect patterns → `react-use-effect` skill. TanStack Query → `react-query` skill.

## Component Design

```tsx
// BAD: prop drilling through intermediaries
function App() {
  const [user, setUser] = useState<User>(initialUser);
  return <Layout user={user} setUser={setUser} />;
}

// GOOD: compose via children/slots
function App() {
  const [user, setUser] = useState<User>(initialUser);
  return (
    <Layout sidebar={<Sidebar userMenu={<UserMenu user={user} onUpdate={setUser} />} />} />
  );
}
```

Split a component when it exceeds ~100-150 lines, manages unrelated state, or has sections with their own logical identity.

## State Management

### useState vs useReducer

- `useState`: single values, booleans, toggles, form fields
- `useReducer`: multiple related values updated together, complex transitions

```tsx
// BAD: multiple related useState calls
const [items, setItems] = useState<Item[]>([]);
const [total, setTotal] = useState(0);

// GOOD: useReducer for related state
type CartAction =
  | { type: "ADD_ITEM"; item: Item }
  | { type: "REMOVE_ITEM"; itemId: string };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM":
      return { ...state, items: [...state.items, action.item], total: state.total + action.item.price };
    case "REMOVE_ITEM": {
      const item = state.items.find(i => i.id === action.itemId);
      return { ...state, items: state.items.filter(i => i.id !== action.itemId), total: state.total - (item?.price ?? 0) };
    }
  }
}
```

### Derive State — Never Store What You Can Compute

```tsx
// BAD
const [query, setQuery] = useState("");
const [filteredItems, setFilteredItems] = useState(items);

// GOOD
const [query, setQuery] = useState("");
const filteredItems = items.filter(item => item.name.toLowerCase().includes(query.toLowerCase()));
```

### Context: for global-ish values that rarely change (theme, auth, locale)

```tsx
const AuthContext = createContext<AuthState | null>(null);

function useAuth() {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

## Performance

### React Compiler — Stop Manual Memoization

```tsx
// BAD: unnecessary in React 19
const UserCard = React.memo(({ user }: { user: User }) => {
  const formattedName = useMemo(() => formatName(user.name), [user.name]);
  const handleClick = useCallback(() => selectUser(user.id), [user.id]);
  return <div onClick={handleClick}>{formattedName}</div>;
});

// GOOD: let the compiler handle it
function UserCard({ user }: { user: User }) {
  return <div onClick={() => selectUser(user.id)}>{formatName(user.name)}</div>;
}
```

Still need manual memo for: third-party libs comparing by reference, genuinely expensive computations, values passed to external systems.

### Keys and Transitions

```tsx
// BAD: index as key
{todos.map((todo, index) => <TodoItem key={index} todo={todo} />)}
// GOOD: stable identifier
{todos.map(todo => <TodoItem key={todo.id} todo={todo} />)}
// GOOD: key to reset component state
<ProfileForm key={userId} userId={userId} />

// startTransition for non-urgent updates
function handleChange(value: string) {
  setQuery(value);
  startTransition(() => setResults(filterLargeDataset(value)));
}
```

## Error Boundaries

```tsx
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

// Granular boundaries — wrap sections, not just the whole app
function Dashboard() {
  return (
    <div>
      <ErrorBoundary FallbackComponent={ErrorFallback}><AnalyticsChart /></ErrorBoundary>
      <ErrorBoundary FallbackComponent={ErrorFallback}><RecentOrders /></ErrorBoundary>
    </div>
  );
}
```

## React 19 Features

### use() — works inside conditionals and loops

```tsx
import { use } from "react";

function HorizontalRule({ show }: { show: boolean }) {
  if (show) {
    const theme = use(ThemeContext);
    return <hr className={theme} />;
  }
  return null;
}
```

### useActionState for Forms

```tsx
const [error, submitAction, isPending] = useActionState(
  async (_prev: string | null, formData: FormData) => {
    const result = await createPost({ title: formData.get("title") as string });
    if (result.error) return result.error;
    redirect("/posts");
    return null;
  },
  null
);

return (
  <form action={submitAction}>
    <input name="title" required />
    <button type="submit" disabled={isPending}>{isPending ? "Posting..." : "Create"}</button>
    {error && <p className="error">{error}</p>}
  </form>
);
```

### useOptimistic

```tsx
const [optimisticMessages, addOptimisticMessage] = useOptimistic(
  messages,
  (state: Message[], newMessage: string) => [
    ...state,
    { id: crypto.randomUUID(), text: newMessage, sending: true },
  ]
);
```

### ref as Prop (no more forwardRef)

```tsx
// BAD
const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => <input ref={ref} {...props} />);
// GOOD
function Input({ ref, ...props }: InputProps & { ref?: React.Ref<HTMLInputElement> }) {
  return <input ref={ref} {...props} />;
}
```

## TypeScript Integration

```tsx
// Extend HTML element props
interface ButtonProps extends React.ComponentPropsWithoutRef<"button"> {
  variant?: "primary" | "secondary" | "danger";
  isLoading?: boolean;
}

// Generic components
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  getKey: (item: T) => string;
}
function List<T>({ items, renderItem, getKey }: ListProps<T>) {
  return <ul>{items.map(item => <li key={getKey(item)}>{renderItem(item)}</li>)}</ul>;
}

// Event types
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {};
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {};

// Children: always use React.ReactNode
interface CardProps { title: string; children: React.ReactNode; }
```

## Project Structure

```
src/
  features/
    auth/
      components/
      hooks/
      types.ts
      index.ts          # Public API only
  shared/
    components/
    hooks/
  app/
    routes.tsx
    providers.tsx
```

Barrel exports at feature boundaries only. Colocate first, extract to `shared/` when 2+ features need it.

## Rules

1. **Always** use function components — no class components
2. **Always** compose via children/slots — avoid prop drilling
3. **Always** derive state during render when possible
4. **Never** manually memo in React 19 unless third-party interop or truly expensive computation
5. **Never** use array index as key for dynamic lists
6. **Always** use granular error boundaries per section
7. **Always** use `use()` instead of `useContext` in React 19
8. **Always** use `useActionState` for form submissions
9. **Prefer** `startTransition` for non-urgent state updates
10. **Prefer** feature-based folder structure with colocation
