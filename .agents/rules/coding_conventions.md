---
trigger: always_on
---

---

## trigger: "\*"

# Coding Conventions: Minimalist Functionalism

**Objective:** Maximize maintainability and reduce cognitive load by adhering to a "Minimum Viable Code" philosophy.

## 1. Dependency Minimalism

- **Native-First:** Exhaust the capabilities of the Elm and Deno Standard Libraries before adding external packages.
- **Audit Requirement:** Any new dependency must be justified by a significant reduction in custom complexity that cannot be achieved with <50 lines of native code.
- **Security Exception:** Never roll your own security or cryptographic primitives (e.g., password hashing, JWT verification, encryption). For these, always use proven, peer-reviewed libraries (e.g., `noble-hashes` or Deno’s `WebCrypto` API) regardless of the 50-line rule.

## 2. Structural Minimalism (LOC & Declarations)

- **Point-Free Style:** In Elm and TypeScript, prefer function composition and pipelining over intermediate variable declarations.
- **Function Density:** Avoid creating "wrapper" functions that merely pass arguments. If a task can be performed by a higher-order function (e.g., `List.map`, `Array.reduce`), do not declare a separate helper function.
- **Variable Elimination:** Favor nested expressions or pipelining over temporary variable assignments unless the variable is strictly required for clarity in complex logic.

## 3. Implementation Examples

### Elm: Composition vs. Declaration

**Avoid (High Declaration):**

```elm
renderItem : Item -> Html Msg
renderItem item =
    let
        name = item.name
        label = String.toUpper name
    in
    div [] [ text label ]
```

**Prefer (Minimalist):**

```elm
renderItem : Item -> Html Msg
renderItem =
    .name >> String.toUpper >> text >> List.singleton >> div []
```

### TypeScript: Pipelining vs. Intermediate Variables

**Avoid (Variable Slop):**

```typescript
const processData = (data: Raw[]) => {
  const filtered = data.filter((d) => d.active);
  const mapped = filtered.map((d) => d.value);
  return mapped;
};
```

**Prefer (Minimalist):**

```typescript
const processData = (data: Raw[]) =>
  data.filter((d) => d.active).map((d) => d.value);
```

## 4. Enforcement

- Code reviews will flag unnecessary helper functions or intermediate variables that do not contribute to logic clarity.
- Maintain high-density code to optimize for repository-wide analysis and maximize AI context window efficiency.
