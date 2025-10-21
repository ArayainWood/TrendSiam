# DB Schema Fix Closeout Report

**Date:** 2025-10-21  
**Issue:** Runtime error `Could not find the table 'public.v_home_news' in the schema cache`  
**Status:** ✅ RESOLVED (migration ready, testing required)  
**Severity:** HIGH (blocks Home page load)

---

## Executive Summary

**Problem:** App crashed with `v_home_news` not found error after resolving merge conflicts.

**Root Cause:** Codebase inconsistently references TWO view names (`v_home_news` and `public_v_home_news`), but only `public_v_home_news` existed in DB.

**Solution:** Created migration 004 to add `v_home_news` as an alias view + comprehensive DB documentation + CI smoke tests.

**Outcome:** Schema decision documented, DB object inventory created, safety policies established to prevent future incidents.

---

## Root Cause Analysis

### The Incident Chain

1. **Merge conflict resolution** (2025-10-21)
   - Merged `main` into `chore/python-hash-and-ci-fix`
   - Resolved conflicts in `frontend/next.config.js`, package files, etc.

2. **Bugbot flagged migration 003**
   - Reported `public1` should be `public` in DB function references
   - Migration 003 was corrected: `public1` → `public` ✅ **This was RIGHT!**

3. **Runtime error on Home page**
   - Error: `Could not find the table 'public.v_home_news' in the schema cache`
   - User believed `public1` was the correct schema (it was NOT)

4. **Investigation revealed inconsistency**
   - Some code uses `v_home_news` (simple name)
   - Other code uses `public_v_home_news` (prefixed name)
   - Only `public_v_home_news` existed in DB → **missing alias view**

### Schema Confusion: public vs. public1

**Fact:** The correct schema is `public`, NOT `public1`.

**Evidence:**
- ALL SQL fixes in `frontend/db/sql/fixes/**` use `public.public_v_home_news`
- PostgreSQL default schema is `public`
- Supabase uses `public` by default
- No code or docs reference a `public1` schema intentionally
- Migration 003's change from `public1` → `public` was **correct**

**Conclusion:** `public1` was a typo/error in the original migration. The Bugbot fix was right.

### The REAL Issue: Missing Alias View

**Code references to `v_home_news`** (simple name):
```typescript
// frontend/src/hooks/useSupabaseNews.ts:61
.from('v_home_news')

// frontend/src/components/news/SupabaseNewsGrid.tsx:29
.from('v_home_news')

// frontend/src/app/supabase-test/page.tsx:63,93,122
.from('v_home_news')
```

**Code references to `public_v_home_news`** (prefixed name):
```typescript
// frontend/src/app/api/home/ping/route.ts:25
.from('public_v_home_news')

// frontend/src/app/api/permissions/selfcheck/route.ts:66
.from('public_v_home_news')

// frontend/src/app/api/test-plan-b/route.ts:47
.from('public_v_home_news')

// frontend/src/app/api/home-rest/route.ts:12 (REST endpoint)
/rest/v1/public_v_home_news
```

**DB state:** Only `public.public_v_home_news` exists (no `public.v_home_news` alias)

**Impact:** Any code calling `.from('v_home_news')` fails with "not found" error.

---

## Solution Implemented

### 1. Migration 004: Create Alias View

**File:** `frontend/db/sql/migrations/004_create_v_home_news_alias.sql`

**Purpose:** Create `public.v_home_news` as an alias to `public.public_v_home_news`

**SQL:**
```sql
CREATE OR REPLACE VIEW public.v_home_news AS
SELECT * FROM public.public_v_home_news;

ALTER VIEW public.v_home_news OWNER TO postgres;
GRANT SELECT ON public.v_home_news TO anon, authenticated, service_role;

COMMENT ON VIEW public.v_home_news IS
'Alias to public_v_home_news for backward compatibility.';
```

**Risk:** LOW - Creates new view, no data changes, idempotent  
**Rollback:** `DROP VIEW IF EXISTS public.v_home_news;`

### 2. Comprehensive DB Documentation

**Created Files:**

| File | Purpose |
|------|---------|
| `reports/db/SCHEMA_DECISION.md` | Canonical schema documentation (public not public1) |
| `reports/db/DB_OBJECT_MANIFEST.yaml` | Complete inventory of all DB objects |
| `memory-bank/23_db_safety_rule_migration_policy.mb` | DB Safety Rule & migration checklist |
| `frontend/db/sql/migrations/README.md` | Migration instructions & troubleshooting |
| `scripts/validate-db-objects.js` | Automated DB validation script |

**Key Policies Established:**
- ✅ **Understand-before-change:** Never modify DB without checking current state first
- ✅ **Plan-B enforcement:** Frontend reads views only, NOT base tables
- ✅ **Search path security:** Functions use `pg_catalog, public` explicitly
- ✅ **Migration checklist:** 6-step process before any DB change
- ✅ **Rollback requirement:** Every migration must document inverse SQL

### 3. CI/CD Smoke Test

**Added to `.github/workflows/security-audit.yml`:**

New job `db-smoke-test` validates:
- ✅ Required views exist (`v_home_news`, `public_v_home_news`, `public_v_system_meta`, etc.)
- ✅ Anon CAN read views (Plan-B)
- ✅ Anon CANNOT read base tables (Plan-B enforcement)
- ✅ RPC functions are executable
- ✅ Column contracts match expected schema

**Script:** `scripts/validate-db-objects.js` (runs in CI + locally)

---

## Files Changed

| File | Change | Reason |
|------|--------|--------|
| `frontend/db/sql/migrations/004_create_v_home_news_alias.sql` | ✨ Created | Add missing alias view |
| `frontend/db/sql/migrations/README.md` | ✨ Created | Migration instructions |
| `reports/db/SCHEMA_DECISION.md` | ✨ Created | Document canonical schema |
| `reports/db/DB_OBJECT_MANIFEST.yaml` | ✨ Created | Complete DB inventory |
| `memory-bank/23_db_safety_rule_migration_policy.mb` | ✨ Created | DB Safety Rule |
| `scripts/validate-db-objects.js` | ✨ Created | Automated validation |
| `.github/workflows/security-audit.yml` | 🔧 Modified | Added DB smoke test job |

---

## Verification Steps (REQUIRED Before Close)

### Step 1: Apply Migration 004

**Using Supabase SQL Editor:**
1. Open [Supabase Dashboard](https://app.supabase.com) → SQL Editor
2. Copy contents of `frontend/db/sql/migrations/004_create_v_home_news_alias.sql`
3. Paste and run
4. Check output for: `Migration 004 verification passed`

**Verification Queries:**
```sql
-- Check both views exist
SELECT viewname FROM pg_views WHERE schemaname = 'public' 
AND viewname IN ('v_home_news', 'public_v_home_news');
-- Expected: 2 rows

-- Check anon can read
SELECT has_table_privilege('anon', 'public.v_home_news', 'SELECT');
-- Expected: t

-- Check columns match (should be identical)
SELECT COUNT(*) FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'v_home_news';
-- Expected: 26
```

### Step 2: Run DB Validation Script

```bash
cd D:\TrendSiam
node scripts/validate-db-objects.js
```

**Expected output:**
```
✅ v_home_news: Accessible
✅ public_v_home_news: Accessible
✅ public_v_system_meta: Accessible
✅ Plan-B (news_trends): Correctly denied
✅ Plan-B (system_meta): Correctly denied
✅ RPC get_public_home_news: Works
✅ ALL VALIDATIONS PASSED!
```

### Step 3: Runtime Smoke Test

**Home Page:**
```bash
cd frontend
npm run dev
```

1. Navigate to `http://localhost:3000`
2. ✅ Home page loads without errors
3. ✅ News items display
4. ✅ TH↔EN language toggle works (including Latest Stories)
5. ✅ Click story → Story Details modal opens
6. ✅ Top-3 AI images render
7. ✅ Popularity Score displays

**Weekly PDF:**
1. Navigate to `http://localhost:3000/weekly-report`
2. ✅ Click "Download PDF" button
3. ✅ PDF downloads successfully
4. ✅ Thai fonts render correctly

**Pipelines:**
```bash
# Python pipeline
python summarize_all_v2.py --limit 20
# Expected: Processes 20 stories, no DB errors

# Weekly snapshot
cd frontend
npm run snapshot:build:publish
# Expected: Generates snapshot, publishes to DB
```

### Step 4: Plan-B Compliance Check

```sql
-- Anon CANNOT read base tables (should return 0)
SELECT COUNT(*) FROM pg_tables t
WHERE schemaname = 'public'
AND tablename IN ('news_trends', 'stories', 'snapshots', 'system_meta')
AND has_table_privilege('anon', schemaname||'.'||tablename, 'SELECT');
-- Expected: 0

-- Anon CAN read views (should return 5)
SELECT COUNT(*) FROM pg_views v
WHERE schemaname = 'public'
AND viewname IN ('v_home_news', 'public_v_home_news', 'public_v_system_meta', 'public_v_weekly_stats', 'public_v_ai_images_latest')
AND has_table_privilege('anon', schemaname||'.'||viewname, 'SELECT');
-- Expected: 5
```

---

## Residual Risks & Tech Debt

### 1. Inconsistent View Naming (MEDIUM)

**Issue:** Codebase uses TWO view names (`v_home_news` and `public_v_home_news`)

**Mitigation:** Created alias view so both work

**Long-term fix:** Migrate all code to use `public_v_home_news` consistently

**Target date:** 2025-11-21

**Action items:**
- [ ] Update `useSupabaseNews.ts` to use `public_v_home_news`
- [ ] Update `SupabaseNewsGrid.tsx` to use `public_v_home_news`
- [ ] Update `supabase-test/page.tsx` to use `public_v_home_news`
- [ ] Deprecate `v_home_news` alias after migration period (2025-12-01)
- [ ] Remove alias view (2026-01-01)

### 2. No Automated Migration Runner (LOW)

**Issue:** Migrations must be applied manually via Supabase SQL Editor

**Mitigation:** Clear instructions in `migrations/README.md`

**Long-term fix:** Create Node.js migration runner script

**Target date:** 2025-12-01

### 3. Supabase Schema Cache Lag (LOW)

**Issue:** Supabase schema cache may not immediately reflect new views

**Mitigation:** Run `SELECT pg_catalog.pg_reload_conf();` after migrations

**Long-term fix:** Add cache refresh to migration scripts

**Target date:** N/A (known Supabase behavior)

---

## Prevention Measures

### 1. DB Safety Checklist (ENFORCED)

See `memory-bank/23_db_safety_rule_migration_policy.mb`

**Before ANY DB change:**
- [ ] Read existing migrations & docs
- [ ] Check live DB state (Supabase SQL Editor)
- [ ] Grep codebase for object references
- [ ] Verify dependencies (`pg_depend`)
- [ ] Design change safely (idempotent, rollback, verification)
- [ ] Test locally first
- [ ] Update documentation

### 2. CI Smoke Test (AUTOMATED)

Added `db-smoke-test` job to `.github/workflows/security-audit.yml`

Runs on:
- Every PR to `main`
- Weekly schedule (Monday 08:00 UTC)
- Manual trigger

Validates:
- ✅ Required views exist
- ✅ Plan-B compliance (anon cannot read base tables)
- ✅ RPC functions executable
- ✅ Column contracts match

### 3. DB Object Manifest (DOCUMENTED)

`reports/db/DB_OBJECT_MANIFEST.yaml` serves as single source of truth

Updated whenever:
- New views/functions/tables added
- Permissions changed
- Schema structure modified

Validated by:
- CI smoke test
- Manual review in code review

---

## Summary

**Root Cause:** Missing alias view + inconsistent naming in codebase

**Fix:** Migration 004 creates `v_home_news` alias to `public_v_home_news`

**Prevention:** DB Safety Rule checklist + CI smoke tests + comprehensive docs

**Status:** ✅ READY FOR TESTING (migration 004 needs to be applied to live DB)

**Next Steps:**
1. Apply migration 004 in Supabase SQL Editor
2. Run `scripts/validate-db-objects.js`
3. Test Home page, PDF, pipelines
4. Verify Plan-B compliance
5. Mark as COMPLETE after all tests pass

---

**Document Owner:** AI Agent (Cursor)  
**Last Updated:** 2025-10-21  
**Review Date:** 2025-11-21

---

**END OF REPORT**

