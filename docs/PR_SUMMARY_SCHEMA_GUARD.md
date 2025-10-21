# PR: Schema Guard Implementation

## Overview

This PR implements comprehensive schema guardrails to prevent database view issues, fix GitHub Actions warnings, and ensure the Home API returns proper status codes with clear diagnostics.

## Key Changes

### 1. Schema Constants & Inventory

**New Files:**
- `frontend/src/lib/db/schema-constants.ts` - Central constants for view name and columns
- `docs/dev/baseline_db_inventory.md` - Human-readable schema documentation
- `docs/dev/schema_map.json` - Machine-readable schema for tooling

**Updated:**
- `memory-bank/db_schema_inventory.mb` - Added critical view section with exact 21 columns

### 2. API Hardening

**Updated:** `frontend/src/app/api/home/route.ts`
- Now uses schema constants instead of hardcoded values
- Checks if view exists before querying
- Returns 503 only for structural issues (missing view/columns)
- Returns 200 with empty array for normal "no data" cases
- Provides clear diagnostics with reason codes

### 3. Health Check Script

**Updated:** `frontend/scripts/check-home-api.mjs`
- Checks for `view_schema_error` instead of generic 503
- Provides specific guidance based on error type

### 4. GitHub Actions

**Updated:** 
- `frontend/.github/workflows/schema-guard.yml`
- `frontend/.github/workflows/schema-drift-check.yml`

Both now have environment variables at job level using `vars.*` context to eliminate warnings.

### 5. SQL View

**Updated:** `frontend/db/sql/fixes/2025-08-31_emergency_view_fix_v4.sql`
- Added CHECK 8 query to verify exact column order
- Ensures exactly 21 columns in correct order

## API Response Behavior

| Condition | Status | Response |
|-----------|--------|----------|
| View doesn't exist | 503 | `{ meta: { reason: 'missing_view' } }` |
| Columns missing | 503 | `{ meta: { reason: 'missing_columns', missingColumns: [...] } }` |
| No data for day | 200 | `{ data: [] }` |
| Normal operation | 200 | `{ data: [...items] }` |

## Setup Required

1. **Apply SQL Migration**:
   ```sql
   -- Run frontend/db/sql/fixes/2025-08-31_emergency_view_fix_v4.sql
   -- Verify with CHECK 8 query
   ```

2. **GitHub Repository Settings**:
   - Add Variables (not Secrets):
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Testing

```bash
# Type checking
npm run check:types  # ✅ Passes

# Health check (requires dev server)
npm run check:health

# Full validation
npm run check:all
```

## Benefits

1. **No More Guessing**: Schema is defined in one place
2. **Clear Diagnostics**: Know exactly what's wrong
3. **Proper Status Codes**: 503 only for infrastructure issues
4. **CI Protection**: Can't merge with schema issues
5. **Memory Bank**: Cursor AI knows exact schema

## Related Documentation

- [Schema Guard Complete](./SCHEMA_GUARD_COMPLETE.md)
- [Home Contract](./dev/home_contract.md)
- [How to Update Schema](./dev/how_to_update_schema.md)
