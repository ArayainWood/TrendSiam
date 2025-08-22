# Weekly Report - Developer Notes

## Overview

The Weekly Report displays trending news data from snapshots built by the backend pipeline. This document explains the data selection logic, common issues, and troubleshooting steps.

## Selection Logic

The weekly report uses a **two-tier fallback system** to fetch snapshots:

1. **Primary**: Try to fetch from `weekly_report_public_v` view (if it exists)
2. **Fallback**: Query `weekly_report_snapshots` table with `status='published'`

This approach ensures compatibility with different Supabase configurations while maintaining security through RLS policies.

### Key Components

- **`weeklyRepo.ts`**: Core data access using public Supabase client (anon key)
- **`weeklySnapshot.ts`**: UI-focused data transformation
- **`/api/weekly/diagnostics`**: Debugging endpoint

## Common Issues & Solutions

### "No snapshots available" Error

This is the most common issue and usually indicates one of:

1. **No published snapshots exist**
   ```bash
   # Build and publish a snapshot
   npm run snapshot:build:publish
   ```

2. **Environment mismatch**
   - The web app points to a different Supabase project than the builder
   - Check `.env.local` has correct `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   
3. **RLS policy blocking access**
   - The anon key might not have permission to read snapshots
   - Check Supabase dashboard RLS policies for `weekly_report_snapshots`

### Debugging Steps

1. **Check diagnostics endpoint**
   ```bash
   curl http://localhost:3000/api/weekly/diagnostics | jq .
   ```
   
   Look for:
   - `env.projectRef` - which Supabase project the web app uses
   - `counts.tablePublishedCount` - how many published snapshots exist
   - `notes` array - specific issues detected

2. **Run selection test**
   ```bash
   npm run snapshot:test:selection
   ```
   
   This will:
   - Show environment configuration
   - Test view and table access
   - Identify permission issues

3. **Compare project refs**
   ```bash
   # In the builder environment
   echo $SUPABASE_URL
   # Should contain same project ref as shown in diagnostics
   ```

## Environment Configuration

### Required Variables

```env
# Public client (used by web app)
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Service role (used by builder only)
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Project Ref Extraction

The system extracts the project reference from URLs:
- `https://abc123.supabase.co` → `abc123`
- Used to detect environment mismatches

## Data Flow

```
1. User visits /weekly-report
2. Page calls fetchWeeklySnapshot()
3. weeklyRepo tries:
   a. SELECT from weekly_report_public_v (if exists)
   b. SELECT from weekly_report_snapshots WHERE status='published'
4. Data validated with Zod schema
5. Rendered in UI
```

## Caching

The weekly report page uses:
- `export const dynamic = 'force-dynamic'`
- `export const revalidate = 0`

This ensures fresh data on every request. No stale cache issues.

## Security

- **Public client only** - Never use service role key in frontend
- **RLS policies** - Ensure anon role can read published snapshots
- **No secrets in logs** - Diagnostics endpoint redacts sensitive data

## Testing

### Unit Tests
```bash
# Test selection logic
npm run snapshot:test:selection

# Test counting logic
npm run snapshot:test:count
```

### Manual Testing
1. Build snapshot: `npm run snapshot:build:publish`
2. Check diagnostics: `/api/weekly/diagnostics`
3. Visit page: `/weekly-report`
4. Verify Total Stories matches snapshot

## Rollback

To revert to previous behavior:
1. Restore old `weeklyRepo.ts` from git
2. Remove public client usage
3. Revert to admin client

The changes are isolated to the weekly report data path.

## SQL Views (Optional)

If using a view for additional security:

```sql
CREATE VIEW weekly_report_public_v AS
SELECT 
  snapshot_id,
  status,
  built_at,
  created_at,
  range_start,
  range_end,
  items,
  meta
FROM weekly_report_snapshots
WHERE status = 'published';

-- Grant access
GRANT SELECT ON weekly_report_public_v TO anon;
```

## Troubleshooting Checklist

- [ ] Snapshots published? Check with diagnostics
- [ ] Same Supabase project? Compare project refs
- [ ] RLS allows anon access? Check Supabase dashboard
- [ ] Environment variables set? Both PUBLIC ones needed
- [ ] View exists? Check Supabase SQL editor
- [ ] Recent changes to RLS? Review Supabase logs

## Contact

For persistent issues:
1. Check `/api/weekly/diagnostics` output
2. Run `npm run snapshot:test:selection`
3. Share results with team
