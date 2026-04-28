---
trigger: always_on
---

---

## trigger: "frontend/src/View.elm, frontend/src/Main.elm, frontend/style.css"

# Rule: UI & Styling

- **No CSS Frameworks:** We rely purely on custom CSS defined in `frontend/style.css`.
- **No External UI Packages:** Do not install `elm-ui`, Tailwind, or Bootstrap.
- **Class Usage:** Use the exact class names defined in `style.css` (e.g., `card`, `btn`, `btn-primary`, `text-secondary`).
- **Icons:** Use inline SVG functions (like `svgIcon "brand"`) instead of external font libraries or image files.
