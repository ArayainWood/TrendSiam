# ⚠️ MANUAL SQL EXECUTION REQUIRED

**Status**: Telemetry endpoint is **FIXED** and working (200 status).  
**Remaining Issue**: `home_feed_v1` view doesn't have `web_view_count` column yet.

---

## What's Working ✅

1. **Telemetry Endpoint** - `POST /api/telemetry/view` now returns 200
   - Fixed payload validation (accepts both `story_id` and `video_id`)
   - Increments `news_trends.view_count` atomically
   - Rate limiting active (100/hour)
   - Better logging with structured output

2. **Card Click Handler** - Sends correct payload
   - Fixed property names (`videoId` vs `video_id`)
   - Session dedupe working
   - Error handling improved

3. **TypeScript** - 0 errors ✅

---

## What Needs Manual Action ⚠️

The SQL migration to add `web_view_count` to `home_feed_v1` view was created but **never executed** in Supabase.

**File**: `frontend/db/sql/fixes/2025-10-06_unify_home_view_web_view_count.sql`

---

## Execute SQL Migration (Choose One Method)

### Method 1: Supabase SQL Editor (Recommended)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID
   - Click: SQL Editor (left sidebar)

2. **Copy SQL File**
   - Open: `D:\TrendSiam\frontend\db\sql\fixes\2025-10-06_unify_home_view_web_view_count.sql`
   - Copy entire contents (232 lines)

3. **Paste & Run**
   - Paste into SQL Editor
   - Click "Run" button
   - Wait for success message

4. **Verify**
   - Should see verification output at bottom
   - Look for: "SUCCESS: Both views have web_view_count column"

### Method 2: psql Command Line

```bash
# If you have psql installed and SUPABASE_DB_URL configured
cd D:\TrendSiam
psql "$env:SUPABASE_DB_URL" -f frontend/db/sql/fixes/2025-10-06_unify_home_view_web_view_count.sql
```

---

## After Migration: Verify

### 1. Test Schema Guard
```powershell
# Should return: hasWebViewCount=true
curl http://localhost:3000/api/health-schema?check=home_view -UseBasicParsing | ConvertFrom-Json | Select-Object -ExpandProperty columns | Select-Object hasWebViewCount
```

**Expected**: `hasWebViewCount: true`

### 2. Check Home API
```powershell
# Should show real view counts (not 0)
curl http://localhost:3000/api/home -UseBasicParsing | ConvertFrom-Json | Select-Object -ExpandProperty data | Select-Object -First 1 id,title,webViewCount
```

**Expected**: `webViewCount` > 0 for stories that have been clicked

### 3. Test in Browser
1. Open http://localhost:3000
2. Click any card
3. Console should show: `[card] ✅ View tracked on click`
4. Refresh page
5. That card should show updated count (e.g., "4934530 views")

---

## Current Status

**Before Migration**:
```
Schema Guard: hasWebViewCount=false, usingFallback=true
Home API: webViewCount=0 (fallback value)
```

**After Migration**:
```
Schema Guard: hasWebViewCount=true, usingFallback=false
Home API: webViewCount=4934529 (real value from DB)
```

---

## Why This Happened

The SQL migration file was created but never executed. Without it:
1. `home_feed_v1` doesn't have `web_view_count` column
2. RPC `util_has_column()` returns false
3. Schema guard uses fallback (adds `webViewCount=0` post-fetch)
4. UI shows 0 for all cards

---

## Files Changed Today

### Modified ✅
- `frontend/src/app/page.tsx` - Fixed property names (videoId/externalId)
- `frontend/src/app/api/telemetry/view/route.ts` - Better validation & logging

### Created ✅
- `frontend/scripts/quick-test-telemetry.mjs` - Quick verification script

### Ready to Execute ⏳
- `frontend/db/sql/fixes/2025-10-06_unify_home_view_web_view_count.sql` - Adds web_view_count column

---

## Summary

**✅ Code Fixed**: Telemetry endpoint works perfectly  
**⏳ SQL Pending**: Need to run migration in Supabase  
**✅ Tests**: Quick test passes (telemetry returns 200)  
**⏳ E2E**: Will pass after SQL migration  

**Next Step**: Execute the SQL migration above, then test in browser.

---

**Date**: 2025-10-06  
**Status**: Waiting for SQL execution
