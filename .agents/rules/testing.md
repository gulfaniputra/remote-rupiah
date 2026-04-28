---
trigger: always_on
---

---

## trigger: "_test_"

# Rule: Testing Standards

## Frontend (Elm)

- Use `elm-test`.
- For any function in `TaxLogic.elm` or `Money.elm`, you MUST include at least one `Fuzz` test to prove mathematical bounds (e.g., verifying no negative tax can be generated from positive input).
- Group tests logically using `describe`.

## Backend (Deno 2.2)

- Use `jsr:@std/assert@1` for assertions (e.g., `assertEquals`).
- Mock external services (like the Kemenkeu API) using standard Deno mock patterns; do not hit live APIs in tests.
