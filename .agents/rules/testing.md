---
trigger: "**/tests/**, **/*_test.ts, **/*Test.elm"
---

# Testing Standards & Invariant Proofs

**Context:** You are generating, updating, or debugging software test suites for
Remote Rupiah. Tests are the absolute gatekeeper for budget security and
compliance safety. Follow these rules to verify logic stability without wasting
tokens.

## 1. Directory Structure & Co-location

- **Frontend Tests:** Place all Elm test files within the `frontend/tests/`
  directory. Match the structural module namespace of the source file (e.g.,
  tests for `frontend/src/TaxLogic.elm` must live in
  `frontend/tests/TaxLogicTest.elm`).
- **Backend Tests:** Co-locate Deno TypeScript tests directly alongside the
  source code using the format `name_test.ts` (e.g.,
  `backend/src/routes/tax_test.ts`).

## 2. Frontend Execution Standards (Elm)

- **Test Suite Framework:** Utilize `elm-test` exclusively for testing the
  presentation and internal calculation layers.
- **Mandatory Property-Based Fuzzing:** Every calculation exposing tax
  obligations or currency manipulations in `TaxLogic.elm` or `Money.elm`
  **must** include a minimum of one `Fuzz` test to validate boundary conditions.
- **Mathematical Invariants to Prove via Fuzzing:**
  - _Non-Negativity:_ Positive inputs must never generate negative tax
    liabilities or credits.
  - _PTKP Boundaries:_ Ensure income below the specified PTKP configuration
    evaluates cleanly to zero tax owed.
  - _Integer Safety:_ Verify that calculations remain stable at maximum
    financial bounds (`2,147,483,647` cents) without overflowing.

### Elm Fuzz Test Blueprint:

```elm
describe "TaxLogic.calculateNppn"
    [ fuzz Fuzz.int "ensures net income is always exactly 50% of bruto using integer math" <|
        \bruto ->
            if bruto > 0 then
                TaxLogic.calculateNppn bruto
                    |> Expect.equal ((bruto * 50) // 100)
            else
                TaxLogic.calculateNppn bruto |> Expect.equal 0
    ]
```

## 3. Backend Execution Standards (Deno 2.2)

- **Test Runner Core:** Use the native `Deno.test()` runner. Do not introduce
  third-party test runners or BDD style assertion wrappers.
- **Modern JSR Assertions:** Use explicitly mapped assertions from
  `jsr:@std/assert@1` (e.g., `assertEquals`, `assertRejects`, `assertThrows`)
  via your `deno.json` import map.
- **Deterministic Mocking Layer:** You are strictly forbidden from initiating
  live network requests during test runs.
- **External API Simulation:** Mock third-party endpoints (such as the Kemenkeu
  or Wise API webhooks) by intercepting global `fetch` calls or utilizing
  standard structural dependency injection interfaces.
- **Hono Router Testing:** Test Hono route handlers directly by passing virtual
  `Request` objects into `app.request()` to inspect response codes and JSON
  bodies without spinning up an active HTTP socket port.

## 4. Constraint Enforcement

- Never mock out the PostgreSQL Row-Level Security (RLS) layer by simply
  changing transaction states inside unit tests. If testing queries, verify
  database response boundaries against active structural policies.
