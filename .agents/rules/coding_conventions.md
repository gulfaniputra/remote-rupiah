---
trigger: "*"
---

# Coding Conventions: Pragmatic Functionalism

**Objective:** Maximize maintainability, reduce cognitive load, and optimize for
AI generation accuracy by adhering to explicit, pipeline-driven functional
patterns.

## 1. Dependency Minimalism

- **Native-First:** Exhaust the capabilities of the Elm and Deno Standard
  Libraries before adding external packages.
- **Audit Requirement:** Any new dependency must be justified by a significant
  reduction in custom complexity that cannot be achieved with <50 lines of
  native code.
- **Security Exception:** Never roll your own security or cryptographic
  primitives (e.g., password hashing, JWT verification, encryption). For these,
  always use proven, peer-reviewed libraries (e.g., `noble-hashes` or Deno’s
  WebCrypto API) regardless of the 50-line rule.

## 2. Structural Patterns for AI Efficiency

- **Pipeline over Composition:** In Elm, prefer the forward pipe operator (`|>`)
  over the function composition operator (`>>`). Pipelines preserve
  left-to-right readability for the LLM and make debugging type mismatches
  vastly cheaper.
- **Explicit Type Anchors:** Every top-level function in Elm **must** have a
  type annotation. Every exported TypeScript function **must** have explicit
  parameter and return types. Never rely entirely on implicit inference;
  explicit types prevent agent reasoning loops.
- **Single-Pass Array Operations:** While chaining functions is acceptable for
  small datasets, prefer single-pass transformations (like `Array.reduce` or
  explicit functional loops) for complex arrays on the backend to avoid
  multi-allocation memory overhead on Deno edge instances.

## 3. Implementation Examples

### Elm: Readable Pipelines vs. Blind Composition

**Avoid (Opaque Point-Free Composition — High Agent Error Rate):**

```elm
renderItem : Item -> Html Msg
renderItem =
    .name >> String.toUpper >> text >> List.singleton >> div []
```

**Prefer (Explicit Pipeline — Highly Deterministic for Agents):**

```elm
renderItem : Item -> Html Msg
renderItem item =
    item.name
        |> String.toUpper
        |> text
        |> List.singleton
        |> div []
```

### TypeScript: Explicit Return Types & Clean Chaining

**Avoid (Implicit Variable Slop or Typeless Inferences):**

```typescript
const processData = (data: Raw[]) => {
  const filtered = data.filter((d) => d.active);
  const mapped = filtered.map((d) => d.value);
  return mapped;
};
```

**Prefer (Typed, Clean Chain):**

```typescript
const processData = (data: Raw[]): string[] =>
  data.filter((d) => d.active).map((d) => d.value);
```

## 4. Enforcement & Context Hygiene

- Avoid creating shallow "wrapper" functions that merely pass arguments forward
  without changing data structure or context.
- Keep file lengths compact (<250 lines where possible). High-density, modular
  files allow the agent to read and modify whole blocks without overflowing the
  context window or dropping prompt-cache hits.
