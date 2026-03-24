---
name: dnd-kit
category: Frontend
description: "MUST USE when implementing drag and drop with @dnd-kit — sortable lists, sensors, collision detection, drag overlays, multi-container (kanban), accessibility, and performance."
---

# @dnd-kit Best Practices

## Basic Sortable List

```tsx
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";

function SortableList() {
  const [items, setItems] = useState(["a", "b", "c"]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((items) => {
      const oldIndex = items.indexOf(active.id as string);
      const newIndex = items.indexOf(over.id as string);
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  return (
    <DndContext collisionDetection={closestCenter} sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {items.map((id) => <SortableItem key={id} id={id} />)}
      </SortableContext>
    </DndContext>
  );
}
```

## Sensors — Always Set Activation Constraints

```tsx
// BAD: no activation constraint — clicks trigger accidental drags
const sensors = useSensors(useSensor(PointerSensor));

// GOOD: require 8px movement before drag starts
import { useSensors, useSensor, PointerSensor, KeyboardSensor } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
);
```

**Activation options** (mutually exclusive — pick one):
- `{ distance: 8 }` — must move 8px before drag activates (allows clicks)
- `{ delay: 250, tolerance: 5 }` — hold 250ms, up to 5px movement allowed during delay

## Sortable Item

```tsx
// BAD: CSS.Transform causes unwanted scaling with variable-size items
import { CSS } from "@dnd-kit/utilities";
const style = { transform: CSS.Transform.toString(transform) };

// GOOD: CSS.Translate avoids scale distortion
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableItem({ id }: { id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {id}
    </div>
  );
}
```

## Drag Overlay

```tsx
// BAD: conditionally rendering DragOverlay — breaks drop animation
{activeId && <DragOverlay><Item id={activeId} /></DragOverlay>}

// GOOD: always mount DragOverlay, conditionally render children
function App() {
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <DndContext
      onDragStart={({ active }) => setActiveId(active.id as string)}
      onDragEnd={() => setActiveId(null)}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={items}>
        {items.map((id) => <SortableItem key={id} id={id} />)}
      </SortableContext>
      <DragOverlay>
        {activeId ? <ItemPreview id={activeId} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
```

**DragOverlay is required for:** cross-container moves, scrollable containers, virtualized lists.

## Collision Detection

| Algorithm | Best For | Note |
|-----------|----------|------|
| `closestCenter` | Sortable lists | Forgiving, always finds a target |
| `closestCorners` | Kanban / stacked containers | Uses all 4 corners |
| `rectIntersection` | General drop zones | Requires physical overlap |
| `pointerWithin` | Precise placement | **No keyboard support** |

### Custom collision — combine algorithms:

```tsx
function customCollision(args: Parameters<typeof closestCenter>[0]) {
  // Try trash zone first via rect intersection
  const trashCollisions = rectIntersection({
    ...args,
    droppableContainers: args.droppableContainers.filter(({ id }) => id === "trash"),
  });
  if (trashCollisions.length > 0) return trashCollisions;
  // Fall back to closest center for sortable items
  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter(({ id }) => id !== "trash"),
  });
}
```

## Multi-Container (Kanban)

```tsx
function KanbanBoard() {
  const [columns, setColumns] = useState<Record<string, string[]>>({
    todo: ["task-1", "task-2"],
    done: ["task-3"],
  });
  const [activeId, setActiveId] = useState<string | null>(null);

  function findContainer(id: string) {
    if (id in columns) return id;
    return Object.keys(columns).find((key) => columns[key].includes(id));
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const from = findContainer(active.id as string);
    const to = findContainer(over.id as string);
    if (!from || !to || from === to) return;

    setColumns((prev) => ({
      ...prev,
      [from]: prev[from].filter((id) => id !== active.id),
      [to]: [...prev[to], active.id as string],
    }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const container = findContainer(active.id as string);
    if (!container) return;
    const oldIndex = columns[container].indexOf(active.id as string);
    const newIndex = columns[container].indexOf(over.id as string);
    if (oldIndex !== newIndex) {
      setColumns((prev) => ({
        ...prev,
        [container]: arrayMove(prev[container], oldIndex, newIndex),
      }));
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={({ active }) => setActiveId(active.id as string)}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {Object.entries(columns).map(([colId, items]) => (
        <DroppableColumn key={colId} id={colId}>
          <SortableContext items={items}>{/* items */}</SortableContext>
        </DroppableColumn>
      ))}
      <DragOverlay>{activeId ? <TaskCard id={activeId} /> : null}</DragOverlay>
    </DndContext>
  );
}
```

**IDs must be globally unique** across all containers, not just within one.

## Accessibility

```tsx
const announcements = {
  onDragStart: ({ active }: DragStartEvent) =>
    `Picked up item ${active.id}`,
  onDragOver: ({ active, over }: DragOverEvent) =>
    over ? `Item ${active.id} moved over ${over.id}` : `Item ${active.id} is not over a drop zone`,
  onDragEnd: ({ active, over }: DragEndEvent) =>
    over ? `Item ${active.id} dropped on ${over.id}` : `Item ${active.id} dropped`,
  onDragCancel: ({ active }: DragCancelEvent) =>
    `Dragging cancelled. Item ${active.id} returned`,
};

<DndContext accessibility={{ announcements }} />
```

Use position-based messages ("moved to position 3 of 5") instead of raw IDs.

## Performance

```tsx
// BAD: all items re-render on every drag event
function SortableItem({ id, content }: Props) { /* ... */ }

// GOOD: memo prevents re-renders from DndContext state changes
const SortableItem = memo(function SortableItem({ id, content }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Translate.toString(transform), transition };
  return <div ref={setNodeRef} style={style} {...attributes} {...listeners}>{content}</div>;
});
```

## Rules

1. **Always** set `activationConstraint` on PointerSensor — prevents click-triggers
2. **Always** include KeyboardSensor with `sortableKeyboardCoordinates` — accessibility requirement
3. **Always** keep `<DragOverlay>` mounted — conditionally render its children, not the component
4. **Always** use `arrayMove` from `@dnd-kit/sortable` — manual splice is error-prone
5. **Always** use `CSS.Translate.toString()` not `CSS.Transform.toString()` — avoids scale distortion
6. **Always** wrap sortable items in `React.memo()` — DndContext updates cause full re-renders
7. **Never** use `pointerWithin` without a keyboard fallback — breaks keyboard accessibility
8. **Never** reuse IDs across containers — all IDs must be globally unique
9. **Prefer** `closestCenter` for lists, `closestCorners` for kanban
10. **Prefer** DragOverlay over state mutation for visual feedback during drag
