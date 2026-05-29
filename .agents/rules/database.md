---
trigger: always_on
---

---

## trigger: "db/_, _.sql"

# Rule: PostgreSQL 17 Governance

- **Append-Only Migrations:** Never modify existing, executed schema migrations.
  Create a new `.sql` file for any database changes.
- **RLS is Immutable:** Do not remove `ENABLE ROW LEVEL SECURITY` or drop the
  `user_isolation_policy` under any circumstances.
- **Data Types:** Always use `BIGINT` for cents. Never use `NUMERIC` or
  `DECIMAL` for currency values, except for FX rates (e.g., `kmk_rate`).
