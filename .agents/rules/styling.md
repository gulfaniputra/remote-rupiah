---
trigger: "frontend/src/**/*.elm, frontend/style.css"
---

# UI & Styling Governance

**Context:** You are generating or modifying the presentation layer of Remote Rupiah. We strictly utilize a handcrafted, native layout system to keep edge delivery lightning-fast and context windows compact.

## 1. Zero-Dependency Constraint

- **No Framework Slop:** You are strictly forbidden from installing, importing, or referencing CSS frameworks (Tailwind, Bootstrap) or Elm layout abstraction packages (`elm-ui`).
- **Single Source of Style Truth:** All visual layout logic relies exclusively on custom CSS classes declared inside `frontend/style.css`.
- **Pre-Flight Class Scan:** Before adding or modifying a class attribute in an Elm view component, read the structural design selectors available inside `frontend/style.css` to prevent class name hallucination.

## 2. Elm View Structural Best Practices

- **Explicit Namespaces:** Always use fully qualified imports or clear local module mapping for HTML properties (e.g., `Html.div`, `Html.Attributes.class`, `Html.Events.onClick`) to maximize compilation clarity for `elm make`.
- **No Inline Styles:** Do not generate `Html.Attributes.style "key" "value"` strings inside view nodes. All styling modifications must occur by dynamically toggling type-safe CSS class strings based on your model status.
- **Layout Priming:** Use the verified semantic utility patterns declared in your design system for grids and alignments:
  - Flex containers: Use `flex` or `flex-col`
  - Structural spacing: Use layout utility alignment rules (`items-center`, `justify-between`, `gap-2`, `gap-4`, `gap-6`)
  - Panels: Use `card`, `card-teal`, `card-red`, or `table-card`

## 3. Financial UI & Truncation Safety

- **Handle Ultra-Long Numbers:** IDR currency strings fluctuate heavily in character width. When presenting dynamic values, ensure wrappers leverage layout cards designed to handle overflow gracefully via `white-space: nowrap` and `text-overflow: ellipsis`.
- **Table Constraints:** Tables use `table-layout: fixed`. Ensure you pass precise percentage widths or style tokens down to table headers (`th`) to ensure column widths don't jitter during data updates.

## 4. Inline SVG Asset Rule

- **No Font Kits or Raw Asset URLs:** Do not include external icon font packages or request external image files for system vectors.
- **Pure Vector Helpers:** All iconography must use inline type-safe vector definitions wrapped inside lightweight helper components or dedicated view functions.
- **XML Cleanliness:** If adding a new vector icon, optimize the SVG node path by removing bloated editor metadata, keeping the layout data clean, functional, and compact.

## 5. Constraint Enforcement

- If an explicit layout alignment parameter is missing from `frontend/style.css`, do not forge a quick inline workaround. Stop and append the structural, reusable rule inside `frontend/style.css` first.
