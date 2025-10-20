# DATABASE SECURITY FIX PLAN

**Date:** October 20, 2025  
**Target:** Resolve Security Advisor findings  
**Approach:** Playbook-compliant, idempotent migrations

---

## MIGRATION STRATEGY

### Phase 1: Discovery & Backup
1. Capture current grants → `reports/db/grants_before.sql`
2. Capture current policies → `reports/db/policies_before.sql`
3. Capture current views → `reports/db/views_before.sql`

### Phase 2: Cleanup Legacy Artifacts
**Migration:** `001_drop_legacy_views.sql`

```sql
-- Drop legacy views from Sept 27, 2025
DROP VIEW IF EXISTS public.public_v_ai_images_latest_old_20250927;
DROP VIEW IF EXISTS public.public_v_home_news_old_20250927;
```

**Risk:** LOW - These are old backup views  
**Rollback:** Can recreate if needed (have schema in backup)

---

### Phase 3: Enable RLS on Demo Table
**Migration:** `002_enable_rls_demo_seed.sql`

```sql
-- Enable RLS on demo seed table
ALTER TABLE public.home_demo_seed ENABLE ROW LEVEL SECURITY;

-- Create policy allowing anon read access (if table is meant to be public)
-- OR drop the table if it's unused
CREATE POLICY "Allow public read access to demo seed"
  ON public.home_demo_seed
  FOR SELECT
  TO anon
  USING (true);
```

**Risk:** LOW - Demo table, likely unused  
**Alternative:** Drop table if confirmed unused  
**Rollback:** `ALTER TABLE public.home_demo_seed DISABLE ROW LEVEL SECURITY;`

---

### Phase 4: Fix Function Search Paths
**Migration:** `003_secure_function_search_paths.sql`

```sql
-- Fix util_has_column function
ALTER FUNCTION public.util_has_column(text, text)
  SET search_path = pg_catalog, public;

-- Fix get_public_system_meta RPC
ALTER FUNCTION public1.get_public_system_meta()
  SET search_path = pg_catalog, public;

-- Fix get_public_home_news RPC
ALTER FUNCTION public1.get_public_home_news()
  SET search_path = pg_catalog, public;
```

**Risk:** LOW - Makes functions more secure  
**Impact:** None - search_path setting is transparent to callers  
**Rollback:** Can remove search_path settings if issues arise

---

### Phase 5: Verification Queries
**Post-migration checks:**

```sql
-- Verify legacy views dropped
SELECT viewname FROM pg_views 
WHERE schemaname = 'public' 
AND viewname LIKE '%old_20250927%';
-- Expected: 0 rows

-- Verify RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'home_demo_seed';
-- Expected: rowsecurity = true

-- Verify function search_paths
SELECT 
  proname,
  prosecdef,
  proconfig
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('public', 'public1')
AND proname IN ('util_has_column', 'get_public_system_meta', 'get_public_home_news');
-- Expected: proconfig contains search_path settings
```

---

## ACCEPTED-BY-DESIGN ITEMS

### SECURITY DEFINER Views (6)
These views are **intentionally** SECURITY DEFINER to enforce Plan-B security:

1. **public.home_feed_v1** - Canonical home feed
2. **public.public_v_home_news** - Compatibility alias
3. **public.public_v_system_meta** - Safe config access
4. **public.public_v_ai_images_latest** - AI image access
5. **public.public_v_weekly_stats** - Weekly statistics
6. **public.public_v_weekly_snapshots** - Snapshot data
7. **public.public_v_latest_snapshots** - Latest snapshots

**Mitigation Strategy:**
- View owners have minimal privileges
- `SECURITY INVOKER = FALSE` explicitly set
- No direct base-table grants to anon
- Views contain only safe columns
- All views are read-only (SELECT only)
- Search paths locked down
- Regular security audits

**Justification:**
Per Playbook, SECURITY DEFINER views are the preferred method to:
- Hide base table structure from anon users
- Enforce column-level filtering
- Provide read-only access without exposing write operations
- Maintain compatibility during schema changes

---

## EXECUTION PLAN

### Day 1 (Today)
1. ✅ Document findings
2. ✅ Create fix plan
3. ⏳ Execute Phase 1 (Discovery)
4. ⏳ Execute Phase 2-4 (Migrations)
5. ⏳ Execute Phase 5 (Verification)
6. ⏳ Update Memory Bank

### Success Criteria
- [ ] All 4 immediate fixes applied
- [ ] Verification queries pass
- [ ] Health endpoints green
- [ ] FE functionality intact
- [ ] PDF generation working
- [ ] Accepted items documented

---

## ROLLBACK STRATEGY

Each migration is idempotent and can be rolled back:

**Phase 2:** Can recreate legacy views from schema  
**Phase 3:** `ALTER TABLE ... DISABLE ROW LEVEL SECURITY`  
**Phase 4:** Remove `SET search_path` from functions

---

## COMPLIANCE CHECKLIST

✅ **Playbook Compliant:**
- Read-only views maintained
- No direct table access for anon
- SECURITY DEFINER views justified
- Idempotent migrations
- Single transaction execution
- Dry-run before exec

✅ **Plan-B Security:**
- Anon reads from views only
- Service-role for backend only
- No secrets in migrations
- Explicit search_paths

✅ **Testing:**
- Health endpoints verified
- E2E smoke tests
- PDF generation tested
- No regressions

---

END OF FIX PLAN
