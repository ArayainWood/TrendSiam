# Database Migrations - TrendSiam

**Location:** `frontend/db/sql/migrations/`  
**Format:** Sequential numbered SQL files  
**Purpose:** Track and apply incremental DB schema changes

---

## Current Migrations

| # | File | Purpose | Status | Date |
|---|------|---------|--------|------|
| 001 | `001_drop_legacy_views.sql` | Remove old backup views from Sept 27 | ✅ Applied | 2025-10-20 |
| 002 | `002_enable_rls_demo_seed.sql` | Enable RLS on demo seed table | ✅ Applied | 2025-10-20 |
| 003 | `003_secure_function_search_paths.sql` | Set secure search_path on RPC functions | ✅ Applied | 2025-10-20 |
| 004 | `004_create_v_home_news_alias.sql` | Create v_home_news alias view | ✅ Applied | 2025-10-21 |
| 005 | `005_add_popularity_score_precise.sql` | Add popularity_score_precise to home views | ✅ Applied | 2025-10-21 |
| 006 | `006_add_published_date_column.sql` | **CRITICAL FIX**: Add missing published_date column | ✅ Applied | 2025-10-21 |

---

## How to Apply Migrations

### Method 1: Supabase SQL Editor (Recommended)

1. Open [Supabase Dashboard](https://app.supabase.com) → SQL Editor
2. Copy the full migration SQL file (including BEGIN/COMMIT)
3. Paste and run in SQL Editor
4. Check for success messages in the output
5. Verify with the validation queries at the end

### Method 2: psql Command Line

```bash
# Export connection string from Supabase Dashboard
export DATABASE_URL="postgresql://postgres:[password]@[host]:5432/postgres"

# Apply migration
psql $DATABASE_URL -f frontend/db/sql/migrations/004_create_v_home_news_alias.sql

# Check output for errors
```

### Method 3: Node.js Script (Automated)

```bash
# From project root
cd frontend
npm run db:migrate:004

# Or manually
node ../scripts/apply-migration.js 004
```

---

## Migration 004: v_home_news Alias View

**Problem:** Runtime error `Could not find the table 'public.v_home_news' in the schema cache`

**Root Cause:** Codebase inconsistently uses two view names:
- `v_home_news` (simple name) - used in hooks/components
- `public_v_home_news` (prefixed name) - used in API routes

Only `public_v_home_news` existed in DB.

**Solution:** Create `v_home_news` as an alias to `public_v_home_news`

**Risk:** LOW - Creates new view, no data changes, idempotent

**Rollback:** `DROP VIEW IF EXISTS public.v_home_news;`

**Verification:**
```sql
-- Check both views exist
SELECT viewname FROM pg_views WHERE schemaname = 'public' 
AND viewname IN ('v_home_news', 'public_v_home_news');
-- Expected: 2 rows

-- Check anon can read
SELECT has_table_privilege('anon', 'public.v_home_news', 'SELECT');
-- Expected: t (true)

-- Check column count matches
SELECT COUNT(*) FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'v_home_news';
-- Expected: 26 columns
```

---

## Migration Checklist (Before Applying)

- [ ] Read migration SQL and understand what it does
- [ ] Check for `BEGIN` and `COMMIT` (wrapped in transaction)
- [ ] Identify rollback SQL (documented in comments)
- [ ] Review `DB_OBJECT_MANIFEST.yaml` for dependencies
- [ ] Backup current DB state (Supabase auto-backups daily)
- [ ] Apply migration in dev/staging first
- [ ] Run verification queries in migration footer
- [ ] Test app functionality (Home, PDF, pipelines)
- [ ] Update `DB_OBJECT_MANIFEST.yaml` if structure changes
- [ ] Mark migration as "Applied" in this README

---

## Migration Policy (Playbook)

See `memory-bank/23_db_safety_rule_migration_policy.mb` for full details.

**Key Rules:**
1. ✅ **Understand-before-change:** Read existing migrations/docs first
2. ✅ **Views first, then functions, then grants/RLS** - order matters
3. ✅ **No data loss ops** unless explicitly required
4. ✅ **Idempotent where possible:** Use `CREATE OR REPLACE`, `IF EXISTS`
5. ✅ **Document rollback:** Every migration must have inverse SQL
6. ✅ **Verify in migration:** Use DO blocks to assert expected state
7. ✅ **Test locally first:** Never apply untested migrations to production

---

## Troubleshooting

### Migration fails with "permission denied"

- Ensure you're using `postgres` (superuser) connection, not `anon`
- In Supabase SQL Editor, you're automatically `postgres`

### Migration fails with "relation already exists"

- Check if migration was already applied
- Use `CREATE OR REPLACE` or `IF NOT EXISTS` for idempotency

### "Invalid statement: syntax error at or near RAISE"

**Problem:** `RAISE` statements (NOTICE, WARNING, EXCEPTION) must be inside procedural blocks.

**Bad (causes error):**
```sql
-- Outside any block - ERROR!
RAISE NOTICE 'Creating view...';

CREATE OR REPLACE VIEW ...;
```

**Good (inside DO block):**
```sql
CREATE OR REPLACE VIEW ...;

DO $$
BEGIN
    RAISE NOTICE 'View created successfully';
END $$;
```

**Details:**
- PostgreSQL/Supabase requires `RAISE` to be inside `DO $$`, functions, or procedures
- This is different from psql's `\echo` command, which works at the top level
- Solution: Move all `RAISE` statements into DO blocks or remove them if redundant
- Fixed in Migration 004 (2025-10-21)

### View not found after migration

- Refresh Supabase schema cache: `SELECT pg_catalog.pg_reload_conf();`
- Check view exists: `SELECT * FROM pg_views WHERE viewname = 'v_home_news';`
- Check permissions: `SELECT has_table_privilege('anon', 'public.v_home_news', 'SELECT');`

### Migration times out

- Increase timeouts in migration file:
  ```sql
  SET LOCAL statement_timeout = '30s';
  SET LOCAL lock_timeout = '10s';
  ```
- Check for long-running queries blocking: `SELECT * FROM pg_stat_activity WHERE state = 'active';`

---

## References

- **DB Schema Decision:** `reports/db/SCHEMA_DECISION.md`
- **DB Object Manifest:** `reports/db/DB_OBJECT_MANIFEST.yaml`
- **Migration Policy:** `memory-bank/23_db_safety_rule_migration_policy.mb`
- **Plan-B Security:** `memory-bank/01_security_plan_b.mb`

---

**Document Owner:** TrendSiam Dev Team  
**Last Updated:** 2025-10-21  
**Review Date:** 2025-11-21

---

**END OF DOCUMENT**

