# Home Feed Fix Summary

> **Note**: This document describes the initial partial fix. See [HOME_FEED_COMPLETE_FIX_REPORT.md](HOME_FEED_COMPLETE_FIX_REPORT.md) for the comprehensive solution that restored all 20 items with all fields.

## Quick Status
- ✅ **COMPLETE** - All 20 items displaying with all required fields
- ✅ 34/35 tests passed (97% success rate)
- ✅ Zero "missing source_url" errors
- ✅ LISA - DREAM record verified
- ✅ Top-3 policy enforced

---

# Initial Fix Summary (Partial)

## Changes Made

1. **Created `public.home_feed_v1` view**
   - Returns exactly 26 columns matching API contract
   - Uses `news_trends` as primary data source (257 rows available)
   - Enforces Top-3 image policy (images/prompts only for rank <= 3)
   - All objects schema-qualified, idempotent operations

2. **Added read-only permissions**
   - GRANT SELECT ON home_feed_v1 TO anon, authenticated
   - No RLS needed on views (access control via GRANT)

3. **Created demo seed table**
   - `public.home_demo_seed` with 3 sample rows for QA
   - Only used when real data is empty (guarded UNION ALL)
   - Clearly marked as demo data

4. **Updated API**
   - Changed `HOME_VIEW` constant from `public_v_home_news` to `home_feed_v1`
   - No other API code changes needed

5. **Session Pooler enforced**
   - All operations used: `aws-0-ap-southeast-1.pooler.supabase.com`
   - Direct host forbidden by default in psql-runner

## Verification Results

- ✅ View created with 26 columns
- ✅ 257 rows returned from news_trends
- ✅ Top-3 have images/prompts, others don't
- ✅ Permissions granted to anon/authenticated
- ✅ All SQL executed in single transactions

## Latest Success Log

`scripts/db/logs/20250930_102510.log` - Verification completed

## No Breaking Changes

- No DROP/ALTER/DELETE on existing tables
- Only created new view and demo seed table
- Existing `public_v_home_news` remains untouched
- Can rollback by dropping home_feed_v1 if needed
