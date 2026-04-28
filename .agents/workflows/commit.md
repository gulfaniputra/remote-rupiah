---
description: Conventional Commit
---

---

trigger: "on_git_commit"
description: "Enforces project-specific Conventional Commits and pre-commit safety checks."

---

# Workflow: Remote-Rupiah Commit Protocol

**Context:** Every commit must maintain the integrity of our financial compliance engine.

## 1. Pre-Commit Validation

Before generating a message, you MUST verify:

- **The Float-Filter:** Scan the diff for the keyword `Float`. If `Float` is found in a file touching `TaxLogic`, `Transactions`, or `Money`, **REJECT** the commit.
- **Safety Prompt:** If rejected, prompt the user: "This change introduces a Float in a financial context, violating the Zero-Float protocol. Should I refactor this to use the Money opaque type?"
- **Integrity Check:** Run `deno lint` and `elm make`.
- **Logic Check:** If files in `frontend/src/TaxLogic.elm` or `services/` were modified, you MUST run `deno test` and `elm-test` and ensure they pass.

## 2. Conventional Commit Schema

Generate the message using this strict format: `<type>(<scope>): <description>`

**Allowed Scopes:**

- `frontend`: Changes to Elm files or `index.html`.
- `backend`: Changes to Deno/Hono routes or services.
- `tax`: Changes to `TaxLogic.elm` or DJP compliance formulas.
- `db`: Changes to PostgreSQL 17 schemas or RLS policies.
- `infra`: Changes to `deno.json` or `.agents/` rules.

**Example:** `feat(tax): implement PPh 24 credit cap formula`

## 3. The "No-Slop" Description Rule

- Use the imperative mood ("add", not "added").
- Do not repeat file names in the description.
- If the change involves a tax law update, cite the specific UU (e.g., UU HPP).

## 4. Execution

1. **Analyze:** Examine the staged changes and identified affected scopes.
2. **Audit:** Run all Pre-Commit Validation checks. Do not proceed if they fail.
3. **Draft:** Generate a compliant message based on the audit results.
4. **Final Approval:** Present the audit status and the proposed message to the developer.
