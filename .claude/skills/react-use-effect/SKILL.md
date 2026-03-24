---
name: react-use-effect
category: Frontend
description: "MUST USE when writing or editing any useEffect, useLayoutEffect, or side-effect logic in React components. Enforces React 19 best practices — most useEffects are unnecessary and should be replaced."
---

# React useEffect Best Practices (React 19)

useEffect is an **escape hatch** for synchronizing with external systems. Before writing a useEffect, verify it is actually needed.

## You Do NOT Need useEffect For

### 1. Deriving State from Props or State

```tsx
// BAD: redundant state + unnecessary Effect
const [fullName, setFullName] = useState('')
useEffect(() => {
  setFullName(firstName + ' ' + lastName)
}, [firstName, lastName])

// GOOD: calculate during rendering
const fullName = firstName + ' ' + lastName
```

### 2. Caching Expensive Calculations

```tsx
// BAD: useEffect for derived computation
const [visibleTodos, setVisibleTodos] = useState([])
useEffect(() => {
  setVisibleTodos(getFilteredTodos(todos, filter))
}, [todos, filter])

// GOOD: useMemo for expensive computations
const visibleTodos = useMemo(
  () => getFilteredTodos(todos, filter),
  [todos, filter]
)
```

Note: React Compiler (React 19) can auto-memoize, reducing manual useMemo needs.

### 3. Resetting State on Prop Change

```tsx
// BAD: resetting state in useEffect
useEffect(() => {
  setComment('')
}, [userId])

// GOOD: use key to reset component tree
<Profile userId={userId} key={userId} />
```

### 4. Adjusting State on Prop Change

```tsx
// BAD: adjusting selection via useEffect
useEffect(() => {
  setSelection(null)
}, [items])

// GOOD: derive from existing state
const selection = items.find(item => item.id === selectedId) ?? null
```

### 5. Event-Specific Logic

```tsx
// BAD: event logic in useEffect
useEffect(() => {
  if (product.isInCart) {
    showNotification(`Added ${product.name} to cart!`)
  }
}, [product])

// GOOD: logic in event handler
const handleBuyClick = () => {
  addToCart(product)
  showNotification(`Added ${product.name} to cart!`)
}
```

### 6. Sending POST Requests from User Actions

```tsx
// BAD: triggering POST via state + useEffect
const [jsonToSubmit, setJsonToSubmit] = useState(null)
useEffect(() => {
  if (jsonToSubmit !== null) post('/api/register', jsonToSubmit)
}, [jsonToSubmit])

// GOOD: POST directly in event handler
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault()
  post('/api/register', { firstName, lastName })
}
```

### 7. Chains of Effects That Trigger Each Other

```tsx
// BAD: cascading useEffects
useEffect(() => { setGoldCardCount(c => c + 1) }, [card])
useEffect(() => { setRound(r => r + 1) }, [goldCardCount])
useEffect(() => { setIsGameOver(true) }, [round])

// GOOD: calculate during render + update in event handler
const isGameOver = round > 5

const handlePlaceCard = (nextCard: Card) => {
  setCard(nextCard)
  if (nextCard.gold) {
    if (goldCardCount < 3) {
      setGoldCardCount(goldCardCount + 1)
    } else {
      setGoldCardCount(0)
      setRound(round + 1)
    }
  }
}
```

### 8. Notifying Parent Components

```tsx
// BAD: syncing parent via useEffect
useEffect(() => {
  onChange(isOn)
}, [isOn, onChange])

// GOOD: update both in same event
const updateToggle = (nextIsOn: boolean) => {
  setIsOn(nextIsOn)
  onChange(nextIsOn)
}
```

### 9. Data Fetching (in this codebase)

This project uses **TanStack Query**. Never use raw useEffect for data fetching.

```tsx
// BAD: manual fetch in useEffect
useEffect(() => {
  fetch(`/api/missions/${id}`).then(...)
}, [id])

// GOOD: use TanStack Query hooks
const { mission, isLoading } = useGetMission(missionId)
```

## When You DO Need useEffect

### Synchronizing with External Systems

- Browser APIs (intersection observer, resize observer, event listeners)
- Third-party libraries (map widgets, non-React UI components)
- WebSocket connections
- Analytics events on mount

### Correct Patterns

**Cleanup is mandatory for subscriptions:**

```tsx
useEffect(() => {
  const handler = () => setWidth(window.innerWidth)
  window.addEventListener('resize', handler)
  return () => window.removeEventListener('resize', handler)
}, [])
```

**Race condition prevention for async operations:**

```tsx
useEffect(() => {
  let ignore = false
  const fetchData = async () => {
    const result = await fetchSomething(id)
    if (!ignore) setData(result)
  }
  fetchData()
  return () => { ignore = true }
}, [id])
```

**External store subscription (prefer useSyncExternalStore):**

```tsx
// GOOD: purpose-built hook for external stores
const isOnline = useSyncExternalStore(
  subscribe,
  () => navigator.onLine,
  () => true
)
```

**One-time app initialization:**

```tsx
let didInit = false

const App = () => {
  useEffect(() => {
    if (!didInit) {
      didInit = true
      loadDataFromLocalStorage()
      checkAuthToken()
    }
  }, [])
}
```

## React 19: use() Hook

React 19 introduces `use()` for reading promises and context during render, replacing many useEffect patterns for data fetching:

```tsx
// React 19: declarative async with use()
const data = use(fetchPromise)
```

## Decision Checklist

Before writing useEffect, ask:

1. Can this be **calculated during render**? → Derive it, no state needed
2. Is this an **expensive calculation**? → useMemo
3. Should state **reset on prop change**? → Use `key`
4. Is this caused by a **user interaction**? → Event handler
5. Is this **subscribing to an external store**? → useSyncExternalStore
6. Is this **fetching data**? → TanStack Query hook
7. Is this **synchronizing with an external system**? → useEffect (with cleanup)

Only if answer 7 applies should you reach for useEffect.
