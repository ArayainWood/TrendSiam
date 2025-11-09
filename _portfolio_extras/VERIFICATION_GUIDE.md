# Trending Stories Pipeline - Verification Guide

## ✅ All Issues Fixed

1. **Popularity Score & Growth Rate** ✓
   - Shows with 1 decimal (e.g., 85.6/100)
   - Meaningful subtext: "High engagement • 11.8M+ views (like rate 10.2%) • Viral growth"
   - Growth shows as "Viral (>100K/day)" format

2. **"View AI Prompt" Panel** ✓
   - Restored and fully functional
   - Shows AI image generation prompt when available

3. **AI Images Count** ✓
   - Fixed to show exactly 3 (Top 3 stories only)
   - Was showing 12, now correctly shows 3

## How to Verify

### 1. Generate Fresh Data
```bash
cd ..
python summarize_all_v2.py --limit 20
```

### 2. Build Snapshots
```bash
cd frontend
npm run snapshot:build:publish
```

### 3. Start Application
```bash
npm run start
```

### 4. Check Diagnostics
Open in browser or use curl:
```bash
# Main diagnostics
http://localhost:3000/api/home/diagnostics

# Field analysis
http://localhost:3000/api/home/fields
```

Expected diagnostics output:
```json
{
  "aiImagesCountComputed": 3,
  "topNUsed": 3,
  "columnHealth": {
    "hasSummaryEnPercentage": "100.0%"
  },
  "growthComputationStatus": {
    "source": "Python script (views/day calculation)"
  }
}
```

### 5. Manual UI Verification

**Home Page:**
- [ ] AI Images counter shows **3** (not 12)
- [ ] News cards show popularity with 1 decimal (e.g., 85.6/100)

**Story Details Modal:**
- [ ] Popularity score: **85.6/100**
- [ ] Subtext shows: "High engagement • X.XM+ views (like rate X.X%) • Growth label"
- [ ] "View AI Prompt" button is visible
- [ ] Clicking button shows AI image generation prompt
- [ ] Growth Rate shows as: "Viral (>100K/day)" or similar format
- [ ] English summaries display (with Thai fallback if EN missing)

## Type Safety Verified
```bash
npx tsc --noEmit --skipLibCheck
# ✅ 0 errors in main code
```

## Build Status
```bash
npm run build
# ✅ Builds successfully
```

## No Regressions
- Weekly Report: ✓ Unchanged
- PDFs: ✓ Unchanged  
- Other pages: ✓ Unchanged
- APIs: ✓ Backward compatible

## All Changes Are:
- ✅ Surgical and minimal
- ✅ Backward compatible
- ✅ Type safe
- ✅ Well tested
- ✅ Documented
