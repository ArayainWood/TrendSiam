# SUPABASE SECURITY ADVISOR FINDINGS

**Date:** October 20, 2025  
**Environment:** Production Database  
**Auditor:** Cursor IDE Agent

---

## EXECUTIVE SUMMARY

Security Advisor has identified **10 Errors** and **4 Warnings** requiring review and remediation.

### Categories
- **Security Definer Views:** 9 items (design review needed)
- **RLS Disabled:** 1 error (requires fix)
- **Function Search Path Mutable:** 3 warnings (requires fix)
- **Postgres Version:** 1 info (upgrade recommended)

---

## DETAILED FINDINGS

### ERRORS (10)

#### E01: Security Definer View - public.public_v_home_news
**Entity:** `public.public_v_home_news`  
**Type:** Security Definer View  
**Message:** "Detects views defined with the SECURITY DEFINER property. These views enforce Postgres permissions and row level security policies (RLS) of the view creator, rather than that of the current user."

**Classification:** ACCEPT BY DESIGN  
**Rationale:** This view is intentionally SECURITY DEFINER to provide controlled read-only access to anon users without exposing base tables. It enforces our Plan-B security model.

---

#### E02: Security Definer View - public.public_v_system_meta
**Entity:** `public.public_v_system_meta`  
**Type:** Security Definer View  
**Message:** Same as E01

**Classification:** ACCEPT BY DESIGN  
**Rationale:** Provides safe, controlled access to system metadata without exposing the entire system_meta table to anon.

---

#### E03: Security Definer View - public.public_v_ai_images_latest_old_20250927
**Entity:** `public.public_v_ai_images_latest_old_20250927`  
**Type:** Security Definer View  
**Message:** Same as E01

**Classification:** FIX - DELETE  
**Rationale:** Legacy view from Sept 27. Should be dropped if no longer needed.

---

#### E04: Security Definer View - public.public_v_ai_images_latest
**Entity:** `public.public_v_ai_images_latest`  
**Type:** Security Definer View  
**Message:** Same as E01

**Classification:** ACCEPT BY DESIGN  
**Rationale:** Controlled access to AI-generated images for Top-3 stories.

---

#### E05: Security Definer View - public.public_v_home_news_old_20250927
**Entity:** `public.public_v_home_news_old_20250927`  
**Type:** Security Definer View  
**Message:** Same as E01

**Classification:** FIX - DELETE  
**Rationale:** Legacy view from Sept 27. Should be dropped if no longer needed.

---

#### E06: Security Definer View - public.public_v_weekly_stats
**Entity:** `public.public_v_weekly_stats`  
**Type:** Security Definer View  
**Message:** Same as E01

**Classification:** ACCEPT BY DESIGN  
**Rationale:** Provides controlled access to weekly report statistics.

---

#### E07: Security Definer View - public.public_v_weekly_snapshots
**Entity:** `public.public_v_weekly_snapshots`  
**Type:** Security Definer View  
**Message:** Same as E01

**Classification:** ACCEPT BY DESIGN  
**Rationale:** Provides controlled access to weekly snapshot data for PDF generation.

---

#### E08: Security Definer View - public.public_v_latest_snapshots
**Entity:** `public.public_v_latest_snapshots`  
**Type:** Security Definer View  
**Message:** Same as E01

**Classification:** ACCEPT BY DESIGN  
**Rationale:** Provides controlled access to latest snapshot metadata.

---

#### E09: Security Definer View - public.home_feed_v1
**Entity:** `public.home_feed_v1`  
**Type:** Security Definer View  
**Message:** Same as E01

**Classification:** ACCEPT BY DESIGN  
**Rationale:** Canonical home feed view. Core to Plan-B security model.

---

#### E10: RLS Disabled in Public - public.home_demo_seed
**Entity:** `public.home_demo_seed`  
**Type:** RLS Disabled  
**Message:** "Detects cases where row level security (RLS) has not been enabled on tables in schemas exposed to PostgREST"

**Classification:** FIX - ENABLE RLS  
**Rationale:** Demo/seed table should have RLS enabled or be dropped if unused.

---

### WARNINGS (4)

#### W01: Function Search Path Mutable - public.util_has_column
**Entity:** `public.util_has_column`  
**Type:** Function Search Path Mutable  
**Message:** "Detects functions where the search_path parameter is not set."

**Classification:** FIX - SET SEARCH_PATH  
**Rationale:** Functions should have explicit search_path to prevent injection attacks.

---

#### W02: Function Search Path Mutable - public1.get_public_system_meta
**Entity:** `public1.get_public_system_meta`  
**Type:** Function Search Path Mutable  
**Message:** Same as W01

**Classification:** FIX - SET SEARCH_PATH  
**Rationale:** RPC function needs secure search_path.

---

#### W03: Function Search Path Mutable - public1.get_public_home_news
**Entity:** `public1.get_public_home_news`  
**Type:** Function Search Path Mutable  
**Message:** Same as W01

**Classification:** FIX - SET SEARCH_PATH  
**Rationale:** RPC function needs secure search_path.

---

#### W04: Postgres version has security patches
**Entity:** Config  
**Type:** Information  
**Message:** "Upgrade your postgres database to apply important security patches"

**Classification:** RECOMMENDATION  
**Rationale:** Should be handled via Supabase dashboard upgrade. Not a code fix.

---

## SUMMARY BY CLASSIFICATION

### Immediate Fixes Required (4)
1. Drop legacy view: `public.public_v_ai_images_latest_old_20250927`
2. Drop legacy view: `public.public_v_home_news_old_20250927`
3. Enable RLS on: `public.home_demo_seed`
4. Fix search_path on 3 functions

### Accept by Design (6)
1. `public.home_feed_v1` - Canonical view
2. `public.public_v_home_news` - Compatibility alias
3. `public.public_v_system_meta` - Config access
4. `public.public_v_ai_images_latest` - AI images
5. `public.public_v_weekly_stats` - Weekly stats
6. `public.public_v_weekly_snapshots` - Weekly snapshots
7. `public.public_v_latest_snapshots` - Snapshot metadata

### Recommendations (1)
1. Postgres version upgrade (via Supabase dashboard)

---

## RISK ASSESSMENT

### Current Risk Level: MEDIUM
- Legacy views present (minor risk)
- RLS disabled on one table (low risk if unused)
- Mutable search_path (medium risk)

### Target Risk Level: LOW
- All legacy artifacts removed
- RLS enabled on all public tables
- All functions have secure search_path

---

## NEXT STEPS

1. Create SQL migrations to fix immediate issues
2. Document accepted-by-design items with mitigations
3. Execute migrations via psql-runner
4. Verify all changes
5. Update Memory Bank documentation

---

END OF FINDINGS
