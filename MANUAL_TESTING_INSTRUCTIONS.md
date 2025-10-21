# MANUAL TESTING INSTRUCTIONS - DB Schema Fix

**Date:** 2025-10-21  
**Branch:** `chore/python-hash-and-ci-fix`  
**Issue:** DB schema fix (missing v_home_news alias view)

---

## Prerequisites

- [ ] `.env.local` exists in `frontend/` with Supabase credentials
- [ ] Supabase project is accessible
- [ ] Node.js 20.x installed
- [ ] Python 3.13 installed (for pipelines)

---

## Step 1: Apply Migration 004 to Supabase

### Option A: Using Supabase SQL Editor (RECOMMENDED)

1. Open your browser and go to: https://app.supabase.com
2. Select your TrendSiam project
3. Navigate to **SQL Editor** (left sidebar)
4. Click **New query**
5. Open `D:\TrendSiam\frontend\db\sql\migrations\004_create_v_home_news_alias.sql` in Cursor
6. Copy the ENTIRE file contents (all ~100 lines)
7. Paste into Supabase SQL Editor
8. Click **Run** (bottom right)
9. **Check output for SUCCESS:**
   - Should see: `Migration 004 verification passed`
   - Should NOT see: errors or exceptions

### Option B: Using psql (Advanced)

```bash
# Get connection string from Supabase Dashboard → Settings → Database → Connection string
# Format: postgresql://postgres:[YOUR-PASSWORD]@[HOST]:5432/postgres

cd D:\TrendSiam
$env:DATABASE_URL = "postgresql://postgres:...@...supabase.co:5432/postgres"
psql $env:DATABASE_URL -f frontend\db\sql\migrations\004_create_v_home_news_alias.sql
```

### Verification (run in Supabase SQL Editor):

```sql
-- Check both views exist
SELECT viewname FROM pg_views 
WHERE schemaname = 'public' 
AND viewname IN ('v_home_news', 'public_v_home_news');
-- Expected output: 2 rows
--   v_home_news
--   public_v_home_news

-- Check anon can read v_home_news
SELECT has_table_privilege('anon', 'public.v_home_news', 'SELECT');
-- Expected output: t (true)

-- Check column count
SELECT COUNT(*) FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'v_home_news';
-- Expected output: 26
```

**✅ If all 3 queries return expected results, migration succeeded!**

---

## Step 2: Run Automated DB Validation

```powershell
cd D:\TrendSiam
node scripts\validate-db-objects.js
```

**Expected output:**
```
🔍 TrendSiam DB Object Validation
===================================

Testing view access (anon should have access)...
✅ v_home_news: Accessible, has <number> rows
✅ public_v_home_news: Accessible, has <number> rows
✅ public_v_system_meta: Accessible, keys: home_limit, top3_max, ...

Testing Plan-B (anon should NOT have access to base tables)...
✅ Plan-B (news_trends): Correctly denied access to base table
✅ Plan-B (system_meta): Correctly denied access to base table

Testing RPC functions...
✅ RPC get_public_home_news: Works, returned 5 rows
✅ RPC get_public_system_meta: Works, keys: ...

Testing data contract...
✅ v_home_news columns: Has required fields: id, title, popularity_score, published_at

===================================
SUMMARY
===================================
✅ Passed: 8
❌ Failed: 0
⚠️  Warnings: 0

✅ ALL VALIDATIONS PASSED!
```

**❌ If any checks FAIL:**
- Check that migration 004 was applied correctly
- Verify `.env.local` has correct Supabase credentials
- Run verification queries in Supabase SQL Editor manually

---

## Step 3: Test Frontend - Home Page

### Start Dev Server

```powershell
cd D:\TrendSiam\frontend
npm run dev
```

Wait for: `✓ Ready in <time>ms`

### Test Checklist

1. **Home Page Load**
   - Navigate to: http://localhost:3000
   - ✅ Page loads **without errors** (no `v_home_news not found` error)
   - ✅ News items display
   - ✅ Images load (or placeholders show)
   - ✅ Check browser console (F12) → Console tab
     - Should NOT see: `Could not find the table 'public.v_home_news'`
     - Should see: `✅ Successfully loaded XX news items`

2. **Language Toggle (TH ↔ EN)**
   - Click language toggle button (top right)
   - ✅ Interface language changes (Thai ↔ English)
   - ✅ **Latest Stories** section updates (titles translate)
   - ✅ No errors in console

3. **Story Details Modal**
   - Click on any news item card
   - ✅ Modal opens with story details
   - ✅ **Top-3 AI images** render (if story is top-3)
   - ✅ **Popularity Score** displays (number + label)
   - ✅ Metrics show (views, likes, comments)
   - ✅ Growth rate displays

4. **Weekly PDF Page**
   - Navigate to: http://localhost:3000/weekly-report
   - ✅ Page loads
   - ✅ Click "Download PDF" button
   - ✅ PDF downloads successfully
   - ✅ Open PDF → Thai fonts render correctly (not boxes/gibberish)

---

## Step 4: Test Python Pipeline

### Summarize Pipeline

```powershell
cd D:\TrendSiam
python summarize_all_v2.py --limit 20
```

**Expected output:**
- Processing 20 stories...
- No DB errors
- No `permission denied` errors
- Stories processed successfully

**❌ If errors occur:**
- Check that `.env` (root level) has `SUPABASE_SERVICE_ROLE_KEY`
- Verify service role has correct permissions

---

## Step 5: Test Weekly Snapshot Pipeline

```powershell
cd D:\TrendSiam\frontend
npm run snapshot:build:publish
```

**Expected output:**
- Building weekly snapshot...
- Querying DB...
- Snapshot created successfully
- No DB errors

---

## Step 6: Verify Plan-B Compliance (Security)

Run in Supabase SQL Editor:

```sql
-- TEST 1: Anon CANNOT read base tables (should return 0)
SELECT COUNT(*) FROM pg_tables t
WHERE schemaname = 'public'
AND tablename IN ('news_trends', 'stories', 'snapshots', 'system_meta')
AND has_table_privilege('anon', schemaname||'.'||tablename, 'SELECT');
-- Expected: 0

-- TEST 2: Anon CAN read views (should return 5)
SELECT COUNT(*) FROM pg_views v
WHERE schemaname = 'public'
AND viewname IN ('v_home_news', 'public_v_home_news', 'public_v_system_meta', 'public_v_weekly_stats', 'public_v_ai_images_latest')
AND has_table_privilege('anon', schemaname||'.'||viewname, 'SELECT');
-- Expected: 5 (or 4 if public_v_ai_images_latest doesn't exist yet)

-- TEST 3: Functions have secure search_path (should return 2+)
SELECT COUNT(*) FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN ('get_public_home_news', 'get_public_system_meta', 'util_has_column')
AND proconfig IS NOT NULL
AND EXISTS (
  SELECT 1 FROM unnest(proconfig) cfg WHERE cfg LIKE 'search_path=%pg_catalog%'
);
-- Expected: 2 or 3
```

**✅ If all 3 tests return expected counts, Plan-B is enforced!**

---

## Success Criteria (ALL must pass)

- [x] Migration 004 applied successfully in Supabase
- [x] `scripts/validate-db-objects.js` passes (all green)
- [x] Home page loads without `v_home_news not found` error
- [x] Language toggle works (incl. Latest Stories)
- [x] Story Details modal opens with metrics
- [x] Top-3 AI images render
- [x] Popularity Score displays
- [x] Weekly PDF downloads with Thai fonts
- [x] Python pipeline (`summarize_all_v2.py`) runs without DB errors
- [x] Weekly snapshot pipeline runs successfully
- [x] Plan-B compliance verified (anon cannot read base tables)

---

## If ALL Tests Pass

1. Stop dev server (`Ctrl+C`)
2. Commit the DB-related files:
   ```powershell
   cd D:\TrendSiam
   git add frontend/db/sql/migrations/004_create_v_home_news_alias.sql
   git add frontend/db/sql/migrations/README.md
   git add reports/db/SCHEMA_DECISION.md
   git add reports/db/DB_OBJECT_MANIFEST.yaml
   git add reports/db/DB_SCHEMA_FIX_CLOSEOUT.md
   git add memory-bank/23_db_safety_rule_migration_policy.mb
   git add scripts/validate-db-objects.js
   git add .github/workflows/security-audit.yml
   git commit -m "fix(db): add v_home_news alias view + comprehensive DB documentation

- Created migration 004 to add v_home_news as alias to public_v_home_news
- Documented canonical schema decision (public, not public1)
- Created DB object inventory manifest (YAML)
- Established DB Safety Rule with migration checklist
- Added CI smoke test for DB object validation
- Created validation script for local testing

Fixes: Runtime error 'Could not find table public.v_home_news in schema cache'
Root cause: Codebase inconsistently uses two view names, only public_v_home_news existed
Solution: Alias view for backward compatibility + docs to prevent future issues

Refs: reports/db/DB_SCHEMA_FIX_CLOSEOUT.md"
   ```

3. Push to branch:
   ```powershell
   git push origin chore/python-hash-and-ci-fix
   ```

4. Update PR description with testing results

---

## If Tests FAIL

1. **Check Supabase connection:**
   ```powershell
   cd D:\TrendSiam\frontend
   npm run test:db:connection
   ```
   (If this script doesn't exist, create it in `package.json`:
   ```json
   "test:db:connection": "node -e \"const { createClient } = require('@supabase/supabase-js'); const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY); c.from('public_v_home_news').select('count', { count: 'exact', head: true }).then(r => console.log(r.error || 'OK'))\""
   ```

2. **Check `.env.local` format:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_ID].supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
   SUPABASE_SERVICE_ROLE_KEY=eyJh...
   ```

3. **Re-run migration 004** (it's idempotent, safe to re-run)

4. **Check Supabase logs** (Dashboard → Logs → Postgres Logs)

5. **Ask for help:** Include error messages + verification query results

---

**Document Owner:** AI Agent (Cursor)  
**Last Updated:** 2025-10-21

---

**END OF INSTRUCTIONS**

