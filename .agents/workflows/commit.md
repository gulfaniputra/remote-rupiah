---
trigger: "on_git_commit"
description: "Enforces project-specific Conventional Commits and pre-commit safety checks."
---

# Workflow: Remote-Rupiah Commit Protocol

**Context:** Every commit must maintain the integrity of our financial
compliance engine. You act as the strict gatekeeper for these rules.

## 1. Pre-Commit Validation

Before generating a message, you MUST execute and verify the following pipeline:

1. **Code Format Check:** Run `deno fmt`.
2. **Integrity Check:** Run `deno lint` and `elm make`.
3. **Logic Check:** If files in `frontend/src/TaxLogic.elm` or `services/` were
   modified, run `deno test` and `elm-test`. They MUST pass.

## 2. The Zero-Float Protocol (CRITICAL)

Financial precision is absolute. We do not use floats.

- **The Diff Audit:** Semantically scan the _staged diff_ for any introduction
  of the `Float` type, float literals (e.g., `0.11`), or floating-point math
  operators in files touching `TaxLogic`, `Transactions`, or `Money`.
- **The Rejection:** If a float is introduced, **REJECT** the commit
  immediately.
- **Safety Prompt:** Present this prompt to the developer: _"This change
  introduces floating-point logic in a financial context, violating the
  Zero-Float protocol. Should I refactor this to use the `Money` opaque type /
  integers?"_

## 3. Conventional Commit Schema

Generate the message using this strict format: `<type>(<scope>): <description>`

**Allowed Types:**

- `feat`, `fix`, `refactor`, `chore`, `test`, `docs`.

**Allowed Scopes:**

- `frontend`: Changes to Elm files or `index.html`.
- `backend`: Changes to Deno/Hono routes or services.
- `tax`: Changes to `TaxLogic.elm` or DJP compliance formulas.
- `db`: Changes to PostgreSQL 17 schemas or RLS policies.
- `infra`: Changes to `deno.json` or `.agents/` rules.

**Example:** `feat(tax): implement PPh 24 credit cap formula`

## 4. The "No-Slop" Description Rule

- Use the imperative mood ("add", not "added").
- Keep it under 50 characters.
- Do not repeat file names in the description.
- **Compliance Link:** If the change involves a tax law update in the `tax`
  scope, you MUST cite the specific UU (e.g., UU HPP) in the commit body.

## 5. Execution Steps

1. **Analyze:** Examine the staged changes.
2. **Audit:** Run the Pre-Commit Validation and Zero-Float checks. Stop and
   alert the user if any fail.
3. **Draft:** Generate a compliant `<type>(<scope>): <description>` message.
4. **Present:** Show the audit status and the proposed message to the developer
   for final approval.
