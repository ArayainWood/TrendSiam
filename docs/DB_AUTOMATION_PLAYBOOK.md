# DB Automation Playbook (TrendSiam)

**Version**: 1.0  
**Date**: 2025-10-06  
**Status**: Active Standard  

---

## Overview

This playbook defines TrendSiam's standard for database operations: automated, idempotent, secure, and production-ready. All database changes follow this pattern unless service-role access is unavailable.

**Core Principle**: Automate everything. Manual SQL execution is the fallback, not the default.

---

## DB Connectivity

### Session Pooler (Required)

**Standard**: Use Supabase Session Pooler URL for all database connections.

```bash
# .env.local
SUPABASE_DB_URL=postgres://postgres.xxx:password@aws-0-region.pooler.supabase.com:5432/postgres?sslmode=require
```

**Why**:
- ✅ Connection pooling (prevents exhaustion)
- ✅ SSL/TLS enforced
- ✅ Optimized for serverless functions
- ✅ Lower latency vs. direct connection

**Don't**: Use direct database host URL except for specialized admin tasks.

---

## Tooling

### PostgresTools LSP (VS Code Extension)

**Purpose**: Live schema validation, IntelliSense, lint/type-check for SQL.

**Setup**:
1. Install extension: `ckolkman.vscode-postgres`
2. Configure in `.vscode/settings.json`:
   ```json
   {
     "vscode-postgres.databases": [{
       "name": "TrendSiam",
       "connectionString": "${env:SUPABASE_DB_URL}"
     }]
   }
   ```
3. Enable SQL IntelliSense for `.sql` files

**Benefits**:
- Real-time syntax validation
- Schema-aware autocomplete
- Type checking for queries
- Immediate error detection

---

### psql-runner (Automation Script)

**Location**: `scripts/db/psql-runner.mjs`

**Workflow**:
```bash
# 1. Preflight checks (connectivity, env vars)
node scripts/db/psql-runner.mjs --preflight

# 2. Dry run (validate SQL without executing)
node scripts/db/psql-runner.mjs --dry migration.sql

# 3. Execute (single transaction with rollback on error)
node scripts/db/psql-runner.mjs --exec migration.sql

# 4. Verify (run post-execution checks)
node scripts/db/psql-runner.mjs --verify migration.sql
```

**Features**:
- Single-transaction execution (atomicity)
- Automatic rollback on errors
- Structured logging to `scripts/db/logs/*.log`
- Secret redaction (no credentials in logs)
- Exit codes (0=success, 1=failure)

**Log Files**:
```
scripts/db/logs/
  20251006_143022_migration_name.log
  20251006_143022_migration_name_dry.log
```

---

## Authority & Secrets

### Service Role Key

**Storage**: Environment variables only (`.env.local`, never committed)

```bash
# Required for DDL operations
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

**Security Rules**:
- ❌ NEVER commit to git
- ❌ NEVER echo in terminal commands
- ❌ NEVER include in client-side code
- ✅ Redact in all logs
- ✅ Use SECURITY DEFINER RPC for operations needing elevated privileges

**Fallback**: If service key is unavailable, document SQL for manual execution in Supabase SQL Editor with audit trail.

---

## Change Pattern

### Idempotent Migrations

**Standard**: All SQL migrations must be runnable multiple times without errors.

```sql
-- ✅ GOOD: Idempotent
CREATE OR REPLACE FUNCTION public.my_func() ...
ALTER TABLE IF EXISTS ...
INSERT INTO ... ON CONFLICT DO UPDATE ...

-- ❌ BAD: Not idempotent
CREATE FUNCTION public.my_func() ... -- Fails on re-run
ALTER TABLE ... -- May fail if column exists
```

---

### Plan-B Security

**Standard**: Views + SECURITY DEFINER RPC; no base-table grants to anon/authenticated.

**Pattern**:
```sql
-- 1. Base table (no grants to anon/authenticated)
CREATE TABLE data (id UUID PRIMARY KEY, ...);

-- 2. Public view with SECURITY DEFINER
CREATE VIEW public_v_data
WITH (security_barrier=true, security_invoker=false)
AS SELECT id, safe_column FROM data WHERE is_public = true;

GRANT SELECT ON public_v_data TO anon, authenticated;

-- 3. RPC for operations needing elevation
CREATE FUNCTION public.safe_operation(...)
RETURNS ...
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$ ... $$;

GRANT EXECUTE ON FUNCTION public.safe_operation TO anon, authenticated;
```

**Why**:
- ✅ Principle of least privilege
- ✅ Fine-grained access control
- ✅ Audit trail via function definitions
- ✅ No risk of data leakage

---

### Canonical Views

**Standard**: `public.home_feed_v1` is canonical; `public.public_v_home_news` is alias.

```sql
-- Canonical view (27 columns including web_view_count)
CREATE OR REPLACE VIEW public.home_feed_v1 AS ...;

-- Alias for backward compatibility
CREATE OR REPLACE VIEW public.public_v_home_news AS
SELECT * FROM public.home_feed_v1;

-- Grants
GRANT SELECT ON public.home_feed_v1 TO anon, authenticated;
GRANT SELECT ON public.public_v_home_news TO anon, authenticated;
```

**Rationale**: Single source of truth; alias prevents drift.

---

### web_view_count Column

**Standard**: Always include `web_view_count` in home views; treat as optional in frontend.

**Backend**:
```sql
-- In view definition
COALESCE(
  CAST(NULLIF(REGEXP_REPLACE(nt.view_count, '[^0-9]', '', 'g'), '') AS INTEGER),
  0
) AS web_view_count
```

**Frontend**:
```typescript
// Zod schema
web_view_count: z.union([z.number(), z.string()])
  .nullable()
  .optional()
  .transform(val => val ?? null)

// UI rendering
const webViews = story.webViewCount ?? 0
```

---

## Schema Guard

### RPC Function

**Standard**: Use `public.util_has_column(view_name, col_name)` for runtime column detection.

```sql
CREATE OR REPLACE FUNCTION public.util_has_column(
  view_name text,
  col_name text
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = view_name
      AND column_name = col_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.util_has_column(text, text) TO anon, authenticated;
```

**Why RPC**: PostgREST doesn't expose information_schema directly.

---

### API Integration

**Home API Pattern** (`src/app/api/home/route.ts`):

```typescript
// 1. Check column existence (cached 5 minutes)
const { data: hasColumn } = await supabase.rpc('util_has_column', {
  view_name: 'home_feed_v1',
  col_name: 'web_view_count'
})

// 2. Build safe SELECT
const columns = hasColumn 
  ? HOME_COLUMNS.join(',') 
  : HOME_COLUMNS.filter(c => c !== 'web_view_count').join(',')

// 3. Fetch data
const { data } = await supabase.from('home_feed_v1').select(columns)

// 4. Post-fetch fallback (if column missing)
const rows = hasColumn 
  ? data 
  : data.map(row => ({ ...row, web_view_count: 0 }))

// 5. Return with metadata
return { 
  data: rows, 
  meta: { 
    schemaGuard: { 
      hasWebViewCount: hasColumn, 
      usingFallback: !hasColumn 
    } 
  } 
}
```

**Key Rules**:
- ✅ Never inject `0 as web_view_count` in SELECT (causes SQL aliasing errors)
- ✅ Add missing columns post-fetch in Node.js
- ✅ Always return HTTP 200 (graceful degradation)
- ✅ Cache RPC results for 5 minutes

---

### Health Endpoint

**Route**: `GET /api/health-schema?check=home_view`

**Response**:
```json
{
  "ok": true,
  "viewName": "home_feed_v1",
  "canonicalView": "home_feed_v1",
  "schema": "public",
  "columns": {
    "total": 27,
    "expected": 27,
    "hasWebViewCount": true
  },
  "version": "2025-10-06_unified_web_view_count",
  "message": "Schema healthy: all required columns present"
}
```

**Status Codes**:
- `200`: Healthy
- `503`: Degraded (missing columns)
- `500`: Error (RPC failure)

---

## Execution Rules

### Default: Auto-Execution

**Standard**: Use `psql-runner.mjs` for all migrations (DDL and DML).

**Workflow**:
```bash
# 1. Write idempotent SQL
# 2. Validate with LSP (live in editor)
# 3. Dry run
node scripts/db/psql-runner.mjs --dry frontend/db/sql/fixes/2025-10-06_my_migration.sql

# 4. Execute
node scripts/db/psql-runner.mjs --exec frontend/db/sql/fixes/2025-10-06_my_migration.sql

# 5. Verify
node scripts/db/psql-runner.mjs --verify frontend/db/sql/fixes/2025-10-06_my_migration.sql
```

**Logs**: Check `scripts/db/logs/` for execution details.

---

### Fallback: Manual Execution

**When**: Service role key is unavailable (new developer, CI/CD, security policy).

**Process**:
1. Document SQL file location in migration notes
2. Provide execution instructions:
   ```
   Manual Action Required:
   1. Open Supabase Dashboard → SQL Editor
   2. Copy/paste: frontend/db/sql/fixes/2025-10-06_migration.sql
   3. Click "Run"
   4. Verify output shows success
   ```
3. Include verification steps
4. Update docs once executed

**Rationale**: Security best practice (service keys never committed).

---

## Quality Gates

### Pre-Execution Checklist

- [ ] LSP shows no errors (red squiggles)
- [ ] SQL is idempotent (safe to run multiple times)
- [ ] Follows Plan-B security (views + RPC)
- [ ] Includes grants to anon/authenticated
- [ ] Includes verification queries
- [ ] Dry run passes without errors

---

### Post-Execution Checklist

- [ ] Execution log shows success
- [ ] Verification queries return expected results
- [ ] Health endpoint returns `ok: true`
- [ ] Home API returns HTTP 200
- [ ] `schemaGuard.usingFallback` is `false`
- [ ] TypeScript build clean (`npx tsc --noEmit`)
- [ ] No regressions to existing features

---

### Frontend Integration

**Zod Schemas**: All DB columns optional with transforms

```typescript
export const RawNewsItemSchema = z.object({
  web_view_count: z.union([z.number(), z.string()])
    .nullable()
    .optional()
    .transform(val => val ?? null)
})
```

**UI Rendering**: Nullish coalescing everywhere

```typescript
const webViews = story.webViewCount ?? 0
const score = story.popularityScore ?? 0
```

**Result**: No crashes if columns missing from API.

---

## Rollbacks

### Standard Rollback Pattern

```sql
-- 1. Drop new objects
DROP FUNCTION IF EXISTS public.new_function CASCADE;
DROP VIEW IF EXISTS public.new_view CASCADE;

-- 2. Restore from backup (if applicable)
-- ... run backup SQL ...

-- 3. Update metadata
UPDATE public.system_meta
SET value = 'pre-migration-version', updated_at = NOW()
WHERE key = 'migration_version';
```

### Documentation

Every migration file should include:

```sql
/*
 * Rollback Steps:
 * 1. DROP FUNCTION public.util_has_column(text, text);
 * 2. Restore previous schema (if needed)
 * 3. Update system_meta version
 */
```

---

## Do/Don't Quick Reference

### ✅ DO

- Use Session Pooler URL for all connections
- Write idempotent migrations (CREATE OR REPLACE, IF EXISTS, ON CONFLICT)
- Use SECURITY DEFINER RPC for elevated operations
- Cache RPC results (5-minute TTL)
- Post-fetch fallback in Node.js (never SQL injection)
- Return HTTP 200 even on degradation
- Redact secrets in all logs
- Run dry-run before execution
- Save execution logs
- Update Memory Bank after migrations

### ❌ DON'T

- Use direct database host (use pooler)
- Grant base-table access to anon/authenticated
- Query information_schema via PostgREST
- Inject computed columns in SELECT (`0 as column`)
- Return 500 for missing optional columns
- Commit service role keys to git
- Skip dry-run validation
- Delete execution logs
- Leave migrations undocumented

---

## Quick Checklist (Copy-Paste for Reviews)

```markdown
## DB Migration Checklist

### Pre-Execution
- [ ] Env: `SUPABASE_DB_URL` present (pooler)
- [ ] Env: Secrets redacted in logs
- [ ] LSP: No syntax/type errors
- [ ] SQL: Idempotent (safe to re-run)
- [ ] Security: Plan-B compliant (views + RPC)
- [ ] Grants: SELECT to anon/authenticated
- [ ] Dry run: `node scripts/db/psql-runner.mjs --dry <file>`
- [ ] Dry run: Passes without errors

### Execution
- [ ] Execute: `node scripts/db/psql-runner.mjs --exec <file>`
- [ ] Logs: Saved to `scripts/db/logs/`
- [ ] Logs: Show success (exit code 0)

### Post-Execution
- [ ] RPC: `util_has_column` callable
- [ ] Health: `/api/health-schema` returns `ok: true`
- [ ] Home: `/api/home` returns HTTP 200
- [ ] Schema Guard: `usingFallback` is `false`
- [ ] TypeScript: `npx tsc --noEmit` clean
- [ ] Tests: No regressions

### Documentation
- [ ] Migration file documented
- [ ] Rollback steps included
- [ ] Memory Bank updated
- [ ] Cross-links added
```

---

## Further Reading

- **Memory Bank**: `memory-bank/03_frontend_homepage_freshness.mb` (DB automation summary)
- **Core Playbook**: `memory-bank/00_project_overview.mb` (project standards)
- **Security**: `memory-bank/01_security_plan_b.mb` (Plan-B details)
- **Testing**: `memory-bank/13_testing_acceptance_criteria.mb` (verification standards)

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-10-06 | 1.0 | Initial playbook: Session Pooler, psql-runner, RPC schema guard, canonical views |

---

**Status**: ✅ Active Standard  
**Compliance**: Mandatory for all database changes  
**Exceptions**: Require lead approval
