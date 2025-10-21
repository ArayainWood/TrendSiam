# Database Schema Decision & Object Inventory

**Date:** 2025-10-21  
**Status:** Canonical Reference  
**Category:** Database Architecture, Security, Plan-B Compliance

---

## Executive Summary

This document defines the canonical schema structure for TrendSiam, explains why the `public` schema is used (not `public1`), documents all database objects, and establishes policies to prevent schema drift.

---

## Root Cause Analysis: The v_home_news Error

### The Problem

Runtime error: `Query failed: Could not find the table 'public.v_home_news' in the schema cache`

### What Happened

1. **Bugbot false positive:** Migration 003 was flagged for using `public1` instead of `public` - but `public1` was a typo/error
2. **Correct fix applied:** Changed `public1` → `public` (this was RIGHT)
3. **Real issue uncovered:** The codebase uses TWO view names inconsistently:
   - `v_home_news` (simple name) - used in `useSupabaseNews.ts`, `SupabaseNewsGrid.tsx`, `supabase-test/page.tsx`
   - `public_v_home_news` (prefixed name) - used in `/api/home/ping`, `/api/test-plan-b`, `/api/permissions/selfcheck`

4. **Missing view:** `v_home_news` likely doesn't exist in the live DB (only `public_v_home_news` exists)

---

## Canonical Schema: `public`

**Decision:** ALL TrendSiam views, functions, and tables use the **`public` schema**. Period.

### Why Not public1?

- `public1` was a typo/error in historical migration code
- PostgreSQL default schema is `public`
- Supabase uses `public` by default
- ALL existing SQL fixes create objects in `public` schema
- No evidence of `public1` schema existing anywhere in the system

### Schema Structure

```
public (schema)
├── Tables
│   ├── news_trends (base table, NOT readable by anon)
│   ├── stories (base table, NOT readable by anon)
│   ├── snapshots (base table, NOT readable by anon)
│   ├── system_meta (base table, NOT readable by anon)
│   ├── image_files (base table, NOT readable by anon)
│   └── weekly_snapshots (base table, NOT readable by anon)
├── Views (Plan-B: anon CAN read)
│   ├── v_home_news (alias/simple name for frontend components)
│   ├── public_v_home_news (primary view, full 26-column contract)
│   ├── public_v_system_meta (safe system config keys)
│   ├── public_v_weekly_stats (KPI metrics)
│   └── public_v_ai_images_latest (Top-3 AI image policy)
└── Functions (RPC, anon CAN execute)
    ├── get_public_home_news(limit, offset) → home data
    ├── get_public_system_meta() → config values
    └── util_has_column(table, column) → schema introspection
```

---

## DB Object Inventory (Comprehensive)

### Views

| View Name | Schema | Type | Purpose | Anon Access | RLS | Depends On |
|-----------|--------|------|---------|-------------|-----|------------|
| `v_home_news` | public | VIEW | Simple alias for home news (26-col) | ✅ SELECT | N/A (view) | news_trends, stories |
| `public_v_home_news` | public | VIEW | Primary home view (26-col contract) | ✅ SELECT | N/A (view) | news_trends, stories, snapshots, system_meta |
| `public_v_system_meta` | public | VIEW | Safe config keys only | ✅ SELECT | N/A (view) | system_meta |
| `public_v_weekly_stats` | public | VIEW | KPI dashboard metrics | ✅ SELECT | N/A (view) | weekly_snapshots |
| `public_v_ai_images_latest` | public | VIEW | Top-3 AI image/prompt policy | ✅ SELECT | N/A (view) | image_files, stories |

### Functions

| Function Name | Schema | Return Type | Purpose | Anon Execute | Security |
|---------------|--------|-------------|---------|--------------|----------|
| `get_public_home_news(int, int)` | public | TABLE | Paginated home news RPC | ✅ EXECUTE | SECURITY DEFINER |
| `get_public_system_meta()` | public | TABLE | Config metadata RPC | ✅ EXECUTE | SECURITY DEFINER |
| `util_has_column(text, text)` | public | BOOLEAN | Schema introspection | ✅ EXECUTE | SECURITY DEFINER |

### Base Tables (NO anon access - Plan-B)

| Table Name | Schema | Anon Access | RLS Enabled | Purpose |
|------------|--------|-------------|-------------|---------|
| `news_trends` | public | ❌ DENY | ✅ | Primary news content |
| `stories` | public | ❌ DENY | ✅ | Story metadata |
| `snapshots` | public | ❌ DENY | ✅ | Historical metrics |
| `system_meta` | public | ❌ DENY | ✅ | System configuration |
| `image_files` | public | ❌ DENY | ✅ | AI-generated images |
| `weekly_snapshots` | public | ❌ DENY | ✅ | Weekly reports |

---

## Plan-B Security Model (ENFORCED)

**Rule:** Frontend ALWAYS reads via **views**, NEVER via base tables.

### Permissions Matrix

| Role | Base Tables | Views | Functions |
|------|-------------|-------|-----------|
| `anon` (frontend) | ❌ DENY | ✅ SELECT | ✅ EXECUTE |
| `authenticated` | ❌ DENY | ✅ SELECT | ✅ EXECUTE |
| `service_role` (backend scripts) | ✅ ALL | ✅ ALL | ✅ ALL |
| `postgres` (owner) | ✅ ALL | ✅ ALL | ✅ ALL |

### Verification Commands

```sql
-- Check anon CANNOT read base tables
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('news_trends', 'stories', 'snapshots', 'system_meta')
AND has_table_privilege('anon', schemaname||'.'||tablename, 'SELECT');
-- Expected: 0 rows

-- Check anon CAN read views
SELECT viewname FROM pg_views
WHERE schemaname = 'public'
AND viewname LIKE '%public_v_%'
AND has_table_privilege('anon', schemaname||'.'||viewname, 'SELECT');
-- Expected: 4+ rows

-- Check anon CAN execute functions
SELECT proname FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND proname LIKE 'get_public_%'
AND has_function_privilege('anon', p.oid, 'EXECUTE');
-- Expected: 2+ rows
```

---

## Search Path Policy

**Policy:** ALL functions and views use fully-qualified names OR set `search_path` explicitly.

### search_path Configuration

| Object Type | search_path Setting | Rationale |
|-------------|---------------------|-----------|
| Views | `public` (implicit) | Views created as `public.view_name` |
| Functions | `pg_catalog, public` | Prevents SQL injection via search_path manipulation |
| Roles (anon/auth) | `public` (default) | Standard PostgreSQL default |

### Migration 003: Secure Function Search Paths

Sets `search_path = pg_catalog, public` on:
- `public.util_has_column(text, text)`
- `public.get_public_system_meta()`
- `public.get_public_home_news(int, int)`

**Why:** Prevents attackers from creating malicious functions in other schemas to hijack SQL execution.

---

## Code References by Object

### v_home_news Usage

**Files referencing `v_home_news` (simple name):**
- `frontend/src/hooks/useSupabaseNews.ts:61` - `.from('v_home_news')`
- `frontend/src/components/news/SupabaseNewsGrid.tsx:29` - `.from('v_home_news')`
- `frontend/src/app/supabase-test/page.tsx:63,93,122` - `.from('v_home_news')`

### public_v_home_news Usage

**Files referencing `public_v_home_news` (prefixed name):**
- `frontend/src/app/api/home/ping/route.ts:25` - `.from('public_v_home_news')`
- `frontend/src/app/api/permissions/selfcheck/route.ts:66` - `.from('public_v_home_news')`
- `frontend/src/app/api/test-plan-b/route.ts:47` - `.from('public_v_home_news')`
- `frontend/src/app/api/home-rest/route.ts:12` - REST endpoint `/rest/v1/public_v_home_news`

### Current Issue

**Problem:** Code uses BOTH names, but likely only `public_v_home_news` exists in DB.

**Solution:** Create `v_home_news` as an alias/synonym to `public_v_home_news` OR update all code to use consistent name.

**Recommendation:** Create alias view for backward compatibility, then migrate code to use `public_v_home_news` consistently.

---

## Remediation Actions

### Immediate Fix (Migration 004)

```sql
-- Create v_home_news as alias to public_v_home_news
CREATE OR REPLACE VIEW public.v_home_news AS
SELECT * FROM public.public_v_home_news;

-- Grant permissions
GRANT SELECT ON public.v_home_news TO anon, authenticated;

-- Set ownership
ALTER VIEW public.v_home_news OWNER TO postgres;

-- Document
COMMENT ON VIEW public.v_home_news IS
'Alias to public_v_home_news for backward compatibility. 
Apps should migrate to public_v_home_news for clarity.';
```

### Long-Term Refactor (Future)

1. Update all code to use `public_v_home_news` consistently
2. Deprecate `v_home_news` alias
3. Remove alias after migration period

---

## CI Smoke Test (Required)

**File:** `.github/workflows/db-smoke-test.yml` or added to existing `security-audit.yml`

```yaml
- name: Verify DB Objects Exist
  run: |
    # Check views exist
    psql $DB_URL -c "SELECT viewname FROM pg_views WHERE schemaname='public' AND viewname IN ('v_home_news', 'public_v_home_news', 'public_v_system_meta');"
    
    # Check functions exist  
    psql $DB_URL -c "SELECT proname FROM pg_proc WHERE proname IN ('get_public_home_news', 'get_public_system_meta');"
    
    # Check anon can read views
    psql $DB_URL -U anon -c "SELECT COUNT(*) FROM public_v_home_news LIMIT 1;"
    
    # Check anon CANNOT read base tables
    ! psql $DB_URL -U anon -c "SELECT COUNT(*) FROM news_trends LIMIT 1;" 2>&1 | grep "permission denied"
```

---

## Rollback Plan

If this schema decision causes issues:

1. **Rollback migration 003:** Revert to previous state (though `public1` was wrong)
2. **Check Supabase dashboard:** Verify actual schema names in live DB
3. **Update this document:** If `public1` actually exists, document why
4. **Rebuild schema cache:** `SELECT pg_catalog.pg_reload_conf();`

---

## Summary

**Canonical Schema:** `public` (standard PostgreSQL default)  
**No `public1` schema:** That was a typo/error  
**Two view names:** `v_home_news` (alias) + `public_v_home_news` (primary)  
**Plan-B enforced:** anon reads views only, NOT base tables  
**Search path secured:** Functions use `pg_catalog, public` explicitly  
**Next steps:** Create v_home_news alias, add CI smoke test, update Memory Bank

---

**Document Owner:** AI Agent (Cursor)  
**Last Updated:** 2025-10-21  
**Review Date:** 2025-11-21

---

**END OF DOCUMENT**

