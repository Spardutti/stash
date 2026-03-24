---
name: tailwind-tokens
category: Frontend
description: "MUST USE when writing or editing any JSX/TSX with Tailwind CSS classes, className attributes, or styling. Enforces design tokens — every visual property (color, spacing, radius, etc.) must come from the project theme. No raw Tailwind palette colors, no arbitrary values."
---

# Design Tokens Only

**Core principle:** Every visual value in a className must resolve to a project design token defined in `app.css`. If a token doesn't exist for what you need, add one to the theme — never use a raw value.

This ensures one CSS change updates the entire app.

## Colors — Semantic Tokens Only

**Never** use Tailwind's built-in color palette (`red-500`, `gray-700`, `blue-100`, etc.). **Always** use the project's semantic color tokens.

### Available Color Tokens

Defined in `apps/web/src/app.css` under `@theme inline` and `:root`:

| Token | Tailwind class examples | Purpose |
|-------|------------------------|---------|
| `background` / `foreground` | `bg-background`, `text-foreground` | Page background, default text |
| `card` / `card-foreground` | `bg-card`, `text-card-foreground` | Card surfaces |
| `primary` / `primary-foreground` | `bg-primary`, `text-primary` | Primary actions, links, focus rings |
| `secondary` / `secondary-foreground` | `bg-secondary`, `text-secondary` | Secondary actions, tags |
| `muted` / `muted-foreground` | `bg-muted`, `text-muted-foreground` | Subtle backgrounds, helper text |
| `accent` / `accent-foreground` | `bg-accent`, `text-accent-foreground` | Highlights, hover states |
| `destructive` | `bg-destructive`, `text-destructive` | Errors, delete actions |
| `border` | `border-border` | All borders |
| `input` | `bg-input`, `border-input` | Form input borders |
| `ring` | `ring-ring` | Focus rings |
| `success` | `text-success` | Success states |
| `cream` | `bg-cream` | Warm background variant |
| `gold-hover` | `text-gold-hover` | Gold accent hover |
| `sage` | `bg-sage` | Nature accent |
| `blush` | `bg-blush` | Soft accent |
| `chart-1` through `chart-5` | `bg-chart-1` | Data visualization |
| `sidebar-*` | `bg-sidebar`, `text-sidebar-foreground` | Sidebar-specific tokens |

```html
<!-- GOOD: semantic tokens — changing the theme updates everything -->
<p class="text-muted-foreground">Helper text</p>
<div class="bg-destructive text-white">Error banner</div>
<span class="text-success">Operational</span>

<!-- BAD: raw palette colors — hardcoded, won't follow theme changes -->
<p class="text-gray-500">Helper text</p>
<div class="bg-red-500 text-white">Error banner</div>
<span class="text-green-600">Operational</span>
```

### Adding New Color Tokens

If you need a color that has no semantic token, **add one to the theme** in `app.css`:

```css
@theme inline {
  --color-warning: var(--warning);
}

:root {
  --warning: #D97706;
}
```

Then use `text-warning`, `bg-warning`, etc. Never reach for a raw palette color.

## Spacing — Semantic Scale

Use these consistent spacing values for layout rhythm. Pick the semantic size, not an arbitrary number.

| Size | Tailwind value | Use for |
|------|---------------|---------|
| **xs** | `1` (0.25rem) | Tight nav items, icon gaps |
| **sm** | `2` (0.5rem) | Form label↔input, inline groups, tight lists |
| **md** | `4` (1rem) | Form sections, grid gaps, card grids, component internal padding |
| **lg** | `6` (1.5rem) | Page sub-sections, content block separation |
| **xl** | `8` (2rem) | Top-level page sections, header↔content |
| **2xl** | `12` (3rem) | Hero/landing page section separation |

Apply these to `space-y`, `gap`, `p`, `m`, and all spacing utilities:

```html
<!-- GOOD: semantic spacing — consistent across the app -->
<div class="space-y-8">          <!-- xl: page sections -->
  <header class="space-y-2">     <!-- sm: heading + subtitle -->
    <h1>Title</h1>
    <p>Subtitle</p>
  </header>
  <div class="grid gap-4">       <!-- md: card grid -->
    <Card />
  </div>
</div>

<!-- BAD: arbitrary choices — leads to inconsistency -->
<div class="space-y-7">
  <header class="space-y-3">
    <h1>Title</h1>
    <p>Subtitle</p>
  </header>
  <div class="grid gap-5">
    <Card />
  </div>
</div>
```

**Rules:**
- **Always** pick from the semantic scale (`1`, `2`, `4`, `6`, `8`, `12`) for layout spacing
- **Never** use odd values like `3`, `5`, `7` for layout spacing — they fall between semantic sizes and create inconsistency
- `3` is acceptable only for component-internal padding (`px-3`, `py-3`) where it matches an existing pattern (e.g., table cells, nav links)

## Typography

Use the predefined font-size scale (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`, `text-4xl`).

Use predefined font-weight tokens (`font-normal`, `font-medium`, `font-semibold`, `font-bold`).

Use predefined line-height tokens (`leading-none`, `leading-tight`, `leading-snug`, `leading-normal`, `leading-relaxed`, `leading-loose`).

```html
<!-- GOOD -->
<h1 class="text-3xl font-bold leading-tight">Title</h1>

<!-- BAD -->
<h1 class="text-[28px] font-[700] leading-[1.15]">Title</h1>
```

## Border Radius

Use the predefined radius tokens (`rounded-none`, `rounded-sm`, `rounded`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-full`).

## Shadows

Use the predefined shadow tokens (`shadow-sm`, `shadow`, `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-2xl`, `shadow-none`).

## When Arbitrary Values Are Acceptable

Arbitrary values are **only** acceptable when:

1. **CSS functions** — `calc()`, `clamp()`, `min()`, `max()` that combine tokens (e.g., `h-[calc(100vh-4rem)]`)
2. **Dynamic runtime data** — values from an API or user input (e.g., `bg-[var(--user-color)]`)

Even then, prefer extracting into a theme token if reused more than once.

## Rules Summary

1. **Never** use Tailwind's built-in color palette (`red-500`, `gray-200`, `blue-600`, etc.) — always use semantic tokens
2. **Never** use arbitrary bracket values (`[#hex]`, `[15px]`, etc.) when a token exists
3. **Never** use spacing values outside the semantic scale (`1, 2, 4, 6, 8, 12`) for layout
4. **Always** use project semantic color tokens (`primary`, `destructive`, `muted-foreground`, etc.)
5. **Always** add new tokens to `app.css` `@theme` when a semantic token is missing — never work around it with raw values
6. **Always** think: "if we rebrand tomorrow, will changing `app.css` be enough?" — if not, you're using raw values somewhere
