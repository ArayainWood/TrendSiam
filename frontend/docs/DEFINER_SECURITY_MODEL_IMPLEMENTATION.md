# Definer Security Model Implementation

Date: 2025-09-23

## Overview

This document describes the implementation of a definer security model for TrendSiam's database views, eliminating "permission denied" errors forever by ensuring the frontend (using anon key) never needs direct access to base tables.

## Problem Statement

Previously, `public_v_home_news` used `SECURITY INVOKER`, which meant:
- The view ran with the permissions of the caller (anon)
- If anon didn't have SELECT on base tables, queries failed
- This led to "permission denied for table ai_images" and similar errors

## Solution: Definer Security Model

### Key Changes

1. **Views use definer security** (security_invoker = false)
   - Views run with the permissions of their owner (typically postgres/superuser)
   - Views can read base tables even if anon cannot
   - Added security_barrier = true for extra protection

2. **Revoked all base table permissions** from anon/authenticated
   - Frontend can ONLY read from public_v_* views
   - No direct base table access possible
   - Enforces principle of least privilege

3. **Bridge view pattern** for filtered data
   - `public_v_ai_images_latest` exposes only necessary AI image data
   - Home view joins this bridge instead of base ai_images table

## Security Architecture

```
Frontend (anon key)
    ↓ SELECT (allowed)
public_v_home_news (DEFINER)
    ↓ SELECT (via owner permissions)
Base tables: news_trends, stories, snapshots
    ↓ JOIN
public_v_ai_images_latest (DEFINER)
    ↓ SELECT (via owner permissions)
Base table: ai_images

❌ Frontend → Base tables (BLOCKED - no grants)
```

## Implementation Details

### 1. AI Images Bridge View
```sql
CREATE VIEW public.public_v_ai_images_latest AS
SELECT DISTINCT ON (ai.news_id)
  ai.news_id,
  ai.image_url,
  ai.created_at
FROM ai_images ai
WHERE ai.image_url IS NOT NULL
ORDER BY ai.news_id, ai.created_at DESC;

-- Grants only on view, not base table
GRANT SELECT ON public.public_v_ai_images_latest TO anon, authenticated;
```

### 2. Home View (Definer)
```sql
CREATE VIEW public.public_v_home_news 
WITH (security_invoker = false, security_barrier = true) AS
-- ... view definition ...
-- Joins public_v_ai_images_latest, not ai_images directly

GRANT SELECT ON public.public_v_home_news TO anon, authenticated;
```

### 3. Revoke Base Table Access
```sql
REVOKE SELECT ON TABLE news_trends FROM anon, authenticated;
REVOKE SELECT ON TABLE stories FROM anon, authenticated;
REVOKE SELECT ON TABLE snapshots FROM anon, authenticated;
REVOKE SELECT ON TABLE ai_images FROM anon, authenticated;
-- ... etc for all base tables
```

## Benefits

1. **No permission errors**: Frontend never needs base table permissions
2. **Better security**: Base tables protected from direct access
3. **Easier maintenance**: Permissions managed at view level only
4. **Performance**: Views can be optimized independently
5. **Auditability**: All access goes through controlled views

## Migration Path

1. Create bridge views for any filtered data needs
2. Update main views to use definer security
3. Update views to join bridge views instead of base tables
4. Revoke all base table permissions from anon/authenticated
5. Verify with comprehensive permission checks

## Verification

Run `verify_permissions_model.sql` to ensure:
- ✅ Views have SELECT grants for anon/authenticated
- ✅ Base tables have NO grants for anon/authenticated
- ✅ Views return data without permission errors
- ✅ 26-column contract maintained
- ✅ Definer security properly configured

## Rollback Plan

If needed to rollback to invoker security:
1. Recreate views with `security_invoker = true`
2. Grant SELECT on necessary base tables to anon/authenticated
3. Test thoroughly before deploying

## Best Practices

1. **Always use views** for frontend access
2. **Never grant base table access** to anon/authenticated
3. **Create bridge views** for filtered/transformed data
4. **Document view dependencies** clearly
5. **Test permissions** after any schema changes

## Security Considerations

- Definer views run with elevated permissions
- Use `security_barrier = true` to prevent optimization attacks
- Limit view logic to simple projections and joins
- Avoid complex business logic in views
- Monitor view performance and access patterns
