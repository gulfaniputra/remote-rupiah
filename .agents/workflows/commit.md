---
trigger: "manual"
description: "High-integrity, token-disciplined Git commit builder and compliance auditor."
---

# Workflow: Remote-Rupiah Commit Protocol

**Context:** Every commit must preserve the integrity of our edge financial
engine without consuming excess API tokens. You act as a text-only compliance
auditor and formatter.

## 1. Human Pre-Flight Guardrail (Token-Saver)

Before initiating this workflow, the **Human** must run these checks locally in
their own VS Code terminal:

1. Code Quality: `deno fmt` and `deno lint`
2. Compilation: `elm make`
3. Core Validation: `deno test` and `elm-test` if tax/service components changed

_Do not initiate this agent workflow if local terminal verification fails._

## 2. The Zero-Float Diff Audit (CRITICAL)

When the developer requests a commit message, scan the provided staged git diff
text meticulously.

- **The Invariant:** We do not use floating-point types for currency
  calculation.
- **Scan Targets:** Look closely at lines added (`+`) in files belonging to or
  importing from `TaxLogic.elm`, `Transactions.ts`, or `Money.elm`.
- **Rejection Conditions:** If you detect the introduction of the literal string
  `Float`, explicit float decimals (e.g., `0.11`), or fractional numeric
  divisions where an integer was expected, **ABORT** immediately.
- **Safety Prompt:** If rejected, output exactly this message and stop:
  _"CRITICAL BLOCK: This change introduces floating-point properties in a
  financial context, violating the Zero-Float protocol. Please refactor to use
  the opaque `Money` integer cents pattern."_

## 3. Conventional Commit Formatting

If the diff passes audit, draft a highly dense single-line commit message
following this precise schema: `<type>(<scope>): <description>`

**Allowed Types:**

- `feat`, `fix`, `refactor`, `chore`, `test`, `docs`

**Allowed Scopes:**

- `frontend`: Modifications to Elm files or asset templates.
- `backend`: Modifications to Deno/Hono source infrastructure.
- `tax`: Changes targeting `TaxLogic.elm` or specific DJP rules.
- `db`: Structural adjustments to PostgreSQL 17 schemas or RLS rules.
- `infra`: Alterations to configuration charts, maps, or `.agents/` rules.

## 4. Operational "No-Slop" Constraints

- Use strict lowercase, imperative mood ("add", not "added" or "adds").
- Keep the title segment strictly under 50 characters.
- Do not reference or repeat literal file names or code extensions in the title.
- **DJP Statutory Link:** If the scope is `tax`, you must include a concise,
  single-sentence reference citing the specific legal authority (e.g.,
  `Compliance Reference: UU HPP Pasal 24`) in the body block below the title
  header.

## 5. Execution Routine

1. Prompt the human to provide the staged diff text if not already loaded into
   context.
2. Complete the token-free Zero-Float text audit.
3. Generate the compliant commit string within a copy-pasteable markdown code
   block.
4. Output a brief checklist confirmation summary (e.g., _Audit: Pass | Scope:
   tax_). Stop there.
