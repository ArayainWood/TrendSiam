# Views-Only Access Guard

Date: 2025-09-23

## Purpose

This document describes the guard mechanisms in place to ensure frontend code only accesses database views (`public_v_*`), never base tables directly.

## Guard Script

**Location:** `frontend/scripts/check-view-only-access.js`

### What it does:
- Scans frontend code for database queries
- Detects any `.from()` calls to base tables
- Allows admin endpoints to use base tables (with service role)
- Reports violations with file, line number, and context

### Run manually:
```bash
cd frontend
npm install --save-dev glob  # if not already installed
node scripts/check-view-only-access.js
```

### Add to package.json:
```json
{
  "scripts": {
    "check:db-access": "node scripts/check-view-only-access.js"
  }
}
```

## Forbidden Tables

Frontend code must NEVER query these directly:
- `news_trends`
- `stories`
- `snapshots`
- `ai_images`
- `system_meta`
- `stats`
- `image_files`
- `weekly_report_snapshots`

## Allowed Views

Frontend code should ONLY query these views:
- `public_v_home_news`
- `public_v_ai_images_latest`
- `public_v_system_meta`
- `public_v_weekly_stats`
- `public_v_weekly_snapshots`

## Exception: Admin Endpoints

These paths are allowed to use admin access (service role):
- `/api/test-plan-b/*` - Security testing
- `/api/diagnostics/*` - Admin diagnostics
- `/api/system-meta/*` - System configuration
- `/api/_health/*` - Internal health checks
- `/api/_debug/*` - Debug endpoints
- `/api/dev/*` - Development tools

## Integration with CI/CD

Add to your CI pipeline:
```yaml
- name: Check DB Access Pattern
  run: |
    cd frontend
    npm run check:db-access
```

## Pre-commit Hook

Add to `.husky/pre-commit`:
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

cd frontend && npm run check:db-access
```

## Manual Verification

After any database-related changes:
1. Run the guard script
2. Fix any violations found
3. Run SQL verification: `verify_permissions_model.sql`
4. Test the app with anon key only

## Common Violations and Fixes

### ❌ Bad: Direct base table access
```typescript
const { data } = await supabase
  .from('news_trends')  // ❌ Base table
  .select('*')
```

### ✅ Good: Use view instead
```typescript
const { data } = await supabase
  .from('public_v_home_news')  // ✅ Public view
  .select(HOME_COLUMNS.join(','))
```

### ❌ Bad: Admin query in frontend
```typescript
// In a client component
const { data } = await supabase
  .from('system_meta')  // ❌ Requires admin
  .select('*')
```

### ✅ Good: Use public view
```typescript
// In a client component
const { data } = await supabase
  .from('public_v_system_meta')  // ✅ Public view
  .select('key, value')
  .in('key', ['home_limit', 'top3_max'])
```
