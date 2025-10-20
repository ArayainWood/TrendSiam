# Database Execution Approval

## Summary of Changes

This execution will create a new view `public.home_feed_v1` to fix the empty Home feed issue without touching existing tables.

### SQL Files to Execute (in order):

1. **03_create_home_feed_view.sql**
   - Creates `public.home_feed_v1` view with exactly 26 columns expected by API
   - Uses `news_trends` as primary data source (257 rows available)
   - Enforces Top-3 image policy (images/prompts only for rank <= 3)
   - All operations are CREATE OR REPLACE (idempotent)

2. **04_add_rls_policy.sql**
   - Grants SELECT permission to `anon` and `authenticated` roles
   - Read-only access to the view

3. **05_create_demo_seed.sql**
   - Creates `public.home_demo_seed` table with 3 demo rows
   - Only used for QA testing when real data is empty
   - Grants SELECT permissions to `anon` and `authenticated`

4. **06_update_view_with_seed.sql**
   - Updates the view to include demo data ONLY when `news_trends` is empty
   - Uses guarded UNION ALL with NOT EXISTS check
   - Maintains the same 26-column contract

### Safety Checks Passed:

- ✅ All objects are schema-qualified (public.*)
- ✅ No DROP, ALTER, or DELETE operations on existing tables
- ✅ All operations are idempotent (CREATE OR REPLACE, IF NOT EXISTS)
- ✅ Dry-run completed successfully for individual files
- ✅ Using Session Pooler connection

### Risk Assessment:

- **Risk Level**: LOW
- **Rollback**: Views can be dropped without data loss
- **Impact**: Read-only view creation, no existing data modified

## Approval Status

approved: yes

## Execute Commands

To execute these changes, run:

```bash
npm run db:exec -- --file scripts/db/sql/home_feed/03_create_home_feed_view.sql
npm run db:exec -- --file scripts/db/sql/home_feed/04_add_rls_policy.sql
npm run db:exec -- --file scripts/db/sql/home_feed/05_create_demo_seed.sql
npm run db:exec -- --file scripts/db/sql/home_feed/06_update_view_with_seed.sql
npm run db:exec -- --file scripts/db/sql/home_feed/07_verify_view.sql
```
