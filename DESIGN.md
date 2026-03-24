# Design System Strategy: The Kinetic Architecture

## 1. Overview & Creative North Star
**The Creative North Star: "The Precision Console"**

This design system rejects the "bubbly" friendliness of modern SaaS in favor of the cold, intentional efficiency of a high-end developer IDE. It is designed for users who treat their software as an instrument, not a toy. The aesthetic is built on **Extreme High Density** and **Monochromatic Precision**.

To break the "template" look, we move away from traditional card-based layouts. Instead, we embrace **Functional Brutalism**: a UI that feels like it was machined from a single block of dark glass. We achieve sophisticated visual interest through intentional asymmetry—pairing ultra-compact data columns with expansive, airy typographic displays.

---

## 2. Colors & Surface Logic
The palette is a study in "Near-Blacks." We do not use color to decorate; we use it to signify state and hierarchy.

*   **The Background (#0a0a0a):** Our canvas is an absolute, deep void. All elements emerge from this darkness.
*   **The "No-Line" Rule:** While the prompt allows for thin borders, use them sparingly. Sectioning should primarily be achieved through **Surface Stacking**. A sidebar (`surface_container_low`) sitting against a main editor (`surface`) creates a natural boundary without the visual noise of a stroke.
*   **Surface Hierarchy & Nesting:**
    *   **Level 0 (Deepest):** `surface_container_lowest` (#0e0e0e) for background utility areas.
    *   **Level 1 (Base):** `surface` (#131313) for the primary working canvas.
    *   **Level 2 (Elevated):** `surface_container_high` (#2a2a2a) for active panels or focused tools.
*   **The "Glass & Gradient" Rule:** For floating command palettes or "Omnibar" components, use `surface_container_highest` at 80% opacity with a `20px` backdrop blur. This ensures the "Obsidian" depth remains tactile.
*   **Signature Textures:** Use a subtle linear gradient on primary action buttons—transitioning from `primary` (#ffffff) to `secondary` (#c8c6c5) at a 45-degree angle—to give "physicality" to the click.

---

## 3. Typography: The Editorial Engineer
We utilize **Inter** (or Geist) as a monospace-adjacent sans-serif. The goal is to make every string of text look like a line of perfectly linted code.

*   **Display & Headlines:** Use `display-sm` (2.25rem) with `tracking-tighter` (-0.05em) for dashboard headers. This creates an "Editorial" impact against the dense UI.
*   **The Pro-Tool Body:** The workhorse is `body-sm` (0.75rem). In this system, small text is not a secondary thought—it is the primary interface.
*   **Labels as Data:** `label-sm` (0.6875rem) should be used for metadata. Always set labels in `on_surface_variant` (#c6c6c6) to ensure they recede behind the actual user data.
*   **Typographic Hierarchy:** Contrast is achieved through weight and color shift, never through large size jumps. A `title-sm` in bold `primary` white carries more weight than a large heading in grey.

---

## 4. Elevation & Depth
In a high-density IDE aesthetic, "Elevation" is a lie. We use **Tonal Layering**.

*   **The Layering Principle:** To "lift" a component, move one step up the surface-container scale. A modal should be `surface_container_highest` (#353534).
*   **Ambient Shadows:** Use shadows only for floating overlays. Specify a `0px 4px 20px` blur using a 10% opacity of `surface_container_lowest`. It should feel like a soft "glow of darkness" rather than a drop shadow.
*   **The "Ghost Border" Fallback:** Where borders are required for technical density (like table cells), use `outline_variant` (#474747) at **15% opacity**. This creates a "hairline" feel that is visible but not structural.
*   **Glassmorphism:** Use for "HUD" (Heads-Up Display) elements. Apply `surface_variant` with 60% alpha and a heavy blur to maintain the near-black aesthetic while allowing the content behind to remain "sensed."

---

## 5. Components
All components follow the **0.25rem (4px)** corner radius rule.

*   **Primary Buttons:** High contrast. Background: `primary` (#ffffff), Text: `on_primary` (#1a1c1c). Padding: `2` (top/bottom) x `4` (left/right).
*   **Input Fields:** Ghost style. No background fill. A 1px border of `outline_variant` (#474747). On focus, the border shifts to the muted accent `tertiary`.
*   **Cards & Lists:** **Strictly forbid dividers.** Use `spacing-2` (0.3rem) of vertical white space to separate items. If separation is unclear, shift the background of alternating rows to `surface_container_low`.
*   **Chips:** Rectangular with `sm` (2px) radius. Use `surface_container_high` backgrounds with `label-sm` text.
*   **The "Status Line":** A custom component for the bottom of the viewport (inspired by Vim/VS Code). Height: `spacing-6` (1.1rem). Background: `surface_container_lowest`. Displays environment metadata in `label-sm`.

---

## 6. Do's and Don'ts

### Do:
*   **Do** maximize information density. If there is empty space, consider if metadata could fill it.
*   **Do** use `0.5` to `1.5` spacing units for internal component padding to maintain the "compact" feel.
*   **Do** use the muted accent `tertiary` (#cde5ff) only for active states, notifications, or "New" indicators.
*   **Do** treat the "Near-Black" background as sacred. Avoid large blocks of grey.

### Don't:
*   **Don't** use "Soft" UI elements (large shadows, round buttons, or pastel colors).
*   **Don't** use 100% opaque borders for layout sectioning; they clutter the "Developer" vibe.
*   **Don't** use `display-lg` for anything other than empty states or splash screens; it breaks the pro-tool density.
*   **Don't** use standard blue for links. Use `primary` (white) with a `px` (1px) underline.

---

## 7. Spacing Utility Reference
*   **Micro-padding:** `1` (0.15rem) for tight icon-to-text relationships.
*   **Standard Gutters:** `4` (0.75rem) for panel margins.
*   **Section Breaks:** `8` (1.5rem) for separating major functional groups.