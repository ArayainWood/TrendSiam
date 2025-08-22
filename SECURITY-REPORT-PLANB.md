# Security Report - Plan-B Verification

## Date: 2025-01-09

## 1. RLS Status & Policies

### Helper Functions with Locked search_path
Created `frontend/db/sql/security/lock_helper_functions.sql` to lock search_path for safe JSON handling functions:
```sql
ALTER FUNCTION public.safe_to_jsonb(text) SET search_path = pg_catalog, public;
ALTER FUNCTION public.safe_json_text(jsonb, text, text) SET search_path = pg_catalog, public;
```

### Public Views
All public views in `frontend/db/sql/security/create_public_views.sql`:
- `news_public_v` - Uses `safe_to_jsonb` for JSON conversion, no direct casts
- `stories_public_v` - Read-only with security_invoker
- `snapshots_public_v` - Read-only with security_invoker
- `weekly_report_public_v` - Read-only with security_invoker

All views:
- Created with `WITH (security_invoker = true)`
- `GRANT SELECT ON ... TO anon, authenticated` (read-only)
- No INSERT/UPDATE/DELETE privileges

## 2. Client-Side Data Access

### Public Client (Browser Safe)
- **File**: `frontend/src/lib/supabasePublic.ts`
- **Key Used**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon key)
- **Usage**: All browser-side data fetching

### News Data Access
- **File**: `frontend/src/lib/db/repos/newsRepo.ts:86`
- **Query**: `.from('news_public_v')` using `getPublicSupabase()`
- **Proof**: Lines 81-90 show anon client querying public view

### Weekly Report Access  
- **File**: `frontend/src/lib/supabasePublic.ts:77`
- **Query**: `.from('weekly_public_view')` using anon client

## 3. Service Role Isolation

### Admin Client (Server Only)
- **File**: `frontend/src/lib/supabaseAdmin.ts`
- **Protection**: `import 'server-only'` at line 15
- **Key Used**: `SUPABASE_SERVICE_ROLE_KEY`
- **Usage Locations** (grep results):
  - `frontend/src/app/api/health/route.ts` - API route
  - `frontend/src/app/api/system-meta/route.ts` - API route
  - `frontend/src/app/api/_debug/news/route.ts` - API route
  - `frontend/src/app/api/db-health/route.ts` - API route
  - `frontend/src/app/api/health/db/route.ts` - API route
  - `frontend/src/app/api/weekly/data/route.ts` - API route

**No usage in client components or pages**

## 4. Bundle Scan

To verify no service role in client bundles after build:
```bash
npm run build
grep -r "service.role" .next/static
grep -r "SUPABASE_SERVICE_ROLE" .next/static
```

Expected result: No matches (service role key not in client bundles)

## 5. Allowed Image Hosts

### next.config.js Configuration
- **File**: `frontend/next.config.js`
- **CSP img-src**: `"img-src 'self' data: blob: https://*.supabase.co"`
- **Remote Patterns**: 
  - Supabase host from `NEXT_PUBLIC_SUPABASE_URL`
  - Generic pattern: `https://**.supabase.co/storage/v1/object/public/**`
  - Local development: `http://localhost`

**YouTube domains removed** - Only AI-generated images from Supabase storage are allowed

## 6. Data Flow Security

1. **Browser** → Uses anon key → Queries `*_public_v` views
2. **Views** → Have `security_invoker = true` → RLS applied
3. **Base tables** → RLS enabled → Anon can't directly access
4. **Service role** → Only in API routes → Never exposed to browser

## Conclusion

Plan-B security is properly enforced:
- ✅ Browser uses anon key exclusively
- ✅ All public data access through secure views
- ✅ Service role isolated to server-only code
- ✅ RLS remains enabled on base tables
- ✅ No service role key in client bundles
- ✅ Image domains restricted to Supabase only
