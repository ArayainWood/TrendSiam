# 🚀 Quick Instructions - Get TrendSiam Working

## Step 1: Build & Start (2 minutes)
```bash
cd frontend
npm run build
npm run start
```

## Step 2: Open Website
Go to: http://localhost:3000

**You should now see trending stories!** 🎉

## If You Still See "No Trending Stories"

### Option A: Hard Refresh
- Press `Ctrl + Shift + R` (or `Cmd + Shift + R` on Mac)
- This clears the cache and reloads

### Option B: Check Server Logs
The terminal running `npm run start` should show:
```
✓ Ready in XXXms
○ Compiling /api/home ...
```

### Option C: Add More Data
```bash
cd ..
$env:ALLOW_JSON_FALLBACK="true"
python summarize_all_v2.py --limit 50
```

## What Was Fixed

1. ✅ **JSON Error** - Database views now handle invalid JSON gracefully
2. ✅ **Data Ingestion** - 5 items successfully added to database
3. ✅ **Date Filtering** - Homepage now shows all recent stories, not just today's

## Verify It's Working

```bash
# In a new terminal:
cd frontend
npm run db:check-view-data
# Should show "✓ Total rows in view: 150+"
```

---
**That's it!** Your TrendSiam app should now be fully functional. 🎊
