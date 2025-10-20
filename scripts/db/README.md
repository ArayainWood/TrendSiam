# TrendSiam Database Migration System

This directory contains the safe database migration system for TrendSiam, implementing preflight checks, dry-runs, transactional execution, and post-verification.

## Prerequisites

1. **PostgreSQL Client (psql)** must be installed:
   - Windows: Download from https://www.postgresql.org/download/windows/ (client tools only)
   - Verify: `psql --version`

2. **Environment Setup** (.env.local in project root):
   ```
   SUPABASE_DB_URL=postgresql://postgres.rerlurdiamxuziiqdmoi:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require
   ```
   - Replace `[YOUR-PASSWORD]` with your actual Supabase password
   - **CRITICAL**: Must include `?sslmode=require`

## Quick Start

```bash
# Test connectivity
npm run db:selftest

# Run a migration (full workflow)
npm run db:run frontend/db/sql/fixes/2025-10-01_example.sql

# Dry run only
npm run db:run frontend/db/sql/fixes/2025-10-01_example.sql -- --dry-only
```

## Available Commands

### Full Workflow (Recommended)
```bash
npm run db:run <sql-file>
```
Runs complete workflow: preflight → dry-run → execute → verify

### Individual Commands
```bash
# Analyze SQL for safety issues
npm run db:preflight <sql-file>

# Dry run (no changes)
npm run db:dry -- --file <sql-file>

# Execute (use with caution)
npm run db:exec -- --file <sql-file>

# Verify after execution
npm run db:verify <sql-file>
```

## SQL Requirements

1. **Schema-qualified names**: Always use `public.table_name`
2. **Idempotent patterns**:
   - `CREATE TABLE IF NOT EXISTS`
   - `CREATE OR REPLACE VIEW`
   - `DROP IF EXISTS`
3. **Transaction safety**: All changes run in a single transaction

## Safety Features

- **Environment gating**: Defaults to staging; production requires explicit confirmation
- **Credential masking**: Passwords never appear in logs or console output
- **Automatic rollback**: Any error rolls back entire transaction
- **Timeout protection**: 5s lock timeout, 30s statement timeout
- **Audit trail**: All executions logged to `logs/` with timestamps

## Production Execution

Production changes require explicit confirmation:
```bash
npm run db:exec -- --file migration.sql --env prod --yes "I know what I'm doing"
```

## Logs

Execution logs are stored in `scripts/db/logs/` with masked credentials:
- Format: `YYYYMMDD_HHMMSS.log`
- Git-ignored for security
- Contains full execution details for debugging

## Rollback

- **Automatic**: Transaction rollback on any error
- **Manual**: Restore from latest Supabase backup if needed
- **Verification**: Check `schema_migrations` table for applied migrations

## Examples

See `sql/selftest/select_1.sql` for a simple connectivity test.

Place your migration files in `frontend/db/sql/fixes/` with naming convention:
`YYYY-MM-DD_descriptive_name.sql`

## Home Feed View Contract

The `public.home_feed_v1` view provides exactly 26 columns for the home API:

```
id, title, summary, summary_en, category, platform, channel, published_at,
source_url, image_url, ai_prompt, popularity_score, rank, is_top3, views,
likes, comments, growth_rate_value, growth_rate_label, ai_opinion,
score_details, video_id, external_id, platform_mentions, keywords, updated_at
```

**Key Features:**
- Primary source: `news_trends` table
- Top-3 image policy: `image_url` and `ai_prompt` only for rank <= 3
- Demo seed: Falls back to `home_demo_seed` when real data is empty
- Read-only access: SELECT granted to anon/authenticated roles

**Demo Seed Guard:**
The view uses a guarded UNION ALL that only includes demo data when:
```sql
NOT EXISTS (SELECT 1 FROM public.news_trends WHERE title IS NOT NULL LIMIT 1)
```
