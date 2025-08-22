# Security Report - TrendSiam

## Date: 2025-01-09

## Executive Summary

This report documents the security audit and fixes applied to resolve the "invalid input syntax for type json" error while enforcing Plan-B security architecture (read-only views for public access).

## Issues Found and Fixed

### 1. JSON Type Safety Issue

**Problem**: The application was experiencing runtime errors due to invalid JSON in TEXT columns (`keywords`, `score_details`) being cast to JSON types.

**Root Cause**:
- `keywords` and `score_details` columns are TEXT type in `news_trends` table
- Some records contain non-JSON strings like "null", "No viral keywords detected", or empty strings
- Views attempted to cast these TEXT values to JSON without validation

**Fix Applied**:
1. Created safe JSON helper functions:
   - `public.safe_to_jsonb(text)` - Converts TEXT to JSONB, returns `{}` on invalid input
   - `public.safe_json_text(jsonb, text, text)` - Safely extracts values from JSONB

2. Updated views to use these helper functions for safe JSON handling

3. Data cleanup script to convert invalid keywords to empty arrays

### 2. Plan-B Security Enforcement

**Verification Results**:

✅ **Secret Containment**: 
- Service role key only appears in:
  - `summarize_all_v2.py` (server-side Python)
  - Server-only TypeScript modules with 'server-only' imports
- No secrets found in client bundles or browser-accessible code

✅ **RLS Status**: 
- Row Level Security remains ENABLED on all tables
- Verified via: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'`

✅ **Read Path Security**:
- Public reads go through secure views:
  - `news_public_v` - Used by home page via `newsRepo.ts`
  - `weekly_report_public_v` - Used by weekly report page
  - `stories_public_v` - Available for future use
  - `snapshots_public_v` - Available for future use

✅ **Write Path Security**:
- All writes use service role key server-side only:
  - Python summarizer writes to base tables
  - Snapshot builder uses server-side API routes

## Code Analysis

### Public View Usage Verification

1. **Home Page Data Flow**:
   ```
   HomePage → useNewsStore → /api/home → homeDataSecure → newsRepo → news_public_v
   ```
   - Confirmed at: `frontend/src/lib/db/repos/newsRepo.ts:86`
   - Uses anon client with public view

2. **Weekly Report Data Flow**:
   ```
   WeeklyReport → /api/weekly → weekly_report_public_v
   ```
   - Views created with `SECURITY INVOKER` - respects RLS

3. **Write Operations**:
   - `summarize_all_v2.py:306` - Writes to `news_trends` with service role
   - Snapshot builder - Server-side only with proper auth

### Security Controls

1. **Client-Side Protection**:
   ```typescript
   // frontend/src/lib/supabasePublic.ts
   export function getPublicSupabase() {
     const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
     const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
     // Only anon key used in browser
   }
   ```

2. **Server-Side Protection**:
   ```typescript
   // All files using service role have:
   import 'server-only';
   ```

3. **View Permissions**:
   ```sql
   GRANT SELECT ON public.news_public_v TO anon, authenticated;
   -- No INSERT, UPDATE, DELETE permissions
   ```

## Residual Risks

1. **Data Quality**: Some legacy records may still have malformed data. The safe JSON functions prevent errors but may return empty objects.

2. **Migration Required**: Users must manually apply the SQL helper functions if not already present.

## Recommendations

1. **Immediate Actions**:
   - Apply `fix_helper_functions.sql` if not already done
   - Run `fix_invalid_json_data.py` to clean legacy data

2. **Long-term**:
   - Consider migrating `keywords` column to JSONB type
   - Add validation in Python summarizer to ensure valid JSON

## Test Results

All security tests pass:
- ✅ No service role key in client code
- ✅ RLS enabled and enforced
- ✅ Public reads use secure views only
- ✅ Write operations server-side only
- ✅ No CORS/CSP relaxations
- ✅ No new public storage buckets

## Compliance

The application now follows Plan-B security architecture:
- Anonymous users read from restricted views
- All sensitive operations require server-side authentication
- No direct table access from browser
- Type-safe JSON handling prevents runtime errors
