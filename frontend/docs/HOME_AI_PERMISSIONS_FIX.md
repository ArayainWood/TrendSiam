# Home AI Images Permissions Fix

Date: 2025-09-23

## Problem

Frontend was getting `500` errors with message:
```
permission denied for table ai_images
```

This occurred because the home view was directly joining the `ai_images` base table, but the `anon` role doesn't (and shouldn't) have SELECT permission on base tables.

## Root Cause

The `public_v_home_news` view contained:
```sql
LEFT JOIN ai_images ai ON ai.news_id = fs.id ...
```

Per Plan-B security model:
- Frontend uses `anon` key
- `anon` should only read from `public_v_*` views
- Base tables should NOT have grants to `anon/authenticated`

## Solution: Bridge View Pattern

### 1. Created Bridge View

`public_v_ai_images_latest` - A secure view that:
- Exposes only necessary columns (news_id, image_url, created_at)
- Returns only the latest image per news_id
- Uses definer security (runs as owner)
- Has SELECT grants for anon/authenticated

### 2. Updated Home View

Modified `public_v_home_news` to:
- Join `public_v_ai_images_latest` instead of `ai_images`
- Maintain exact 26-column contract
- Continue using SECURITY INVOKER
- Preserve all existing logic

### 3. Security Model

```
Frontend (anon key)
    ↓
public_v_home_news (SECURITY INVOKER)
    ↓
public_v_ai_images_latest (definer)
    ↓
ai_images (base table - no anon access)
```

## SQL Migration Order

1. `2025-09-23_public_v_ai_images_latest.sql` - Create bridge view
2. `2025-09-23_patch_public_v_home_news_ai_join.sql` - Update home view
3. `2025-09-23_upsert_home_policy.sql` - Metadata updates
4. `2025-09-17_grant_public_v_home_news.sql` - Re-apply grants

## Verification

Run `verify_permissions_home_ai.sql` to check:
- ✅ Views return data
- ✅ No duplicate stories
- ✅ Correct grants on views
- ✅ NO grants on base tables for anon/authenticated
- ✅ 26-column contract maintained
- ✅ Top-3 policy enforced

## API Testing

```bash
# Should return success with no permission errors
curl http://localhost:3000/api/home
curl http://localhost:3000/api/home/diagnostics
```

## Key Principles

1. **Never grant SELECT on base tables** to anon/authenticated
2. **Use bridge views** when frontend needs filtered base table data
3. **Maintain contracts** - Don't break existing column expectations
4. **Test permissions** - Always verify grants after migrations

## Rollback Plan

If needed to rollback:

```sql
-- Drop bridge view
DROP VIEW IF EXISTS public.public_v_ai_images_latest CASCADE;

-- Restore previous home view definition
-- (Would need to restore from baseline_home_view_ddl.sql)

-- Re-apply grants
GRANT SELECT ON public.public_v_home_news TO anon, authenticated;
```

## Prevention

To prevent this issue in future:
1. Always use `public_v_*` views in frontend queries
2. Never join base tables in views accessed by frontend
3. Run permission verification after any view changes
4. Document all view dependencies
