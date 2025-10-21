# System Meta Permission Fix Summary

Date: 2025-09-23

## Problem

Frontend was getting "permission denied for table system_meta" errors when trying to read configuration values, even though the code was already trying to use `public_v_system_meta`.

## Root Cause

The `public_v_system_meta` view either:
1. Didn't exist in the current deployment
2. Existed but didn't include all necessary keys
3. Existed but didn't have proper grants

## Solution

### 1. Created Comprehensive System Meta View

**File:** `2025-09-23_public_v_system_meta.sql`
- Exposes only safe keys needed by frontend:
  - `home_freshness_policy`
  - `home_limit`
  - `top3_max`
  - `home_columns_hash`
  - `news_last_updated`
- Grants SELECT to anon/authenticated

### 2. Revoked Base Table Access

**File:** `2025-09-23_revoke_system_meta_base_table_select_from_anon.sql`
- Ensures anon/authenticated have NO access to base `system_meta` table
- Forces all access through the public view

### 3. Created Verification Scripts

1. **`verify_home_contract_26.sql`**
   - Verifies public_v_home_news has exactly 26 columns
   - Lists any missing or unexpected columns

2. **`verify_view_only_permissions.sql`**
   - Comprehensive security check
   - Ensures NO base table grants exist for anon/authenticated
   - Verifies all views have proper grants

## SQL Execution Order

1. `2025-09-23_public_v_system_meta.sql`
2. `2025-09-23_revoke_system_meta_base_table_select_from_anon.sql`
3. Continue with other migrations...

## Key Principles

1. **Views-Only Access**: Frontend with anon key MUST only use public_v_* views
2. **No Base Table Access**: anon/authenticated roles should have ZERO grants on base tables
3. **Bridge Pattern**: Use views to expose only necessary data with proper security

## Testing

After applying migrations:

```bash
# Test home API (should work without permission errors)
curl http://localhost:3000/api/home

# Test diagnostics (should show metadata)
curl http://localhost:3000/api/home/diagnostics
```

## Prevention

- Always check if a public view exists before using it in frontend code
- Use the guard script `check-view-only-access.js` in CI/CD
- Run verification scripts after any database changes
