# What You Should See - Visual Verification Guide

## 🖥️ Browser Display (After Server Restart)

### Hero Section
```
┌─────────────────────────────────────────────────────┐
│  THAILAND • TRENDING • LIVE                         │
│                                                     │
│  Trend                                              │
│  Siam                                               │
│  [Thai/English description]                        │
│                                                     │
│  20              3 ← FIXED (was showing 0)         │
│  STORIES TODAY   AI IMAGES                          │
│                                                     │
│  [Top Story Card with AI Image]                     │
│  Stray Kids "CEREMONY" M/V                         │
│  Score: 95.9/100                                    │
│  🎨 AI-Generated                                    │
└─────────────────────────────────────────────────────┘
```

### Latest Stories Grid
```
┌──────────┐ ┌──────────┐ ┌──────────┐
│ ✅ #1    │ │ ✅ #2    │ │ ✅ #3    │
│ AI Image │ │ AI Image │ │ AI Image │
│ Score    │ │ Score    │ │ Score    │
│ Metrics  │ │ Metrics  │ │ Metrics  │
└──────────┘ └──────────┘ └──────────┘

┌──────────┐ ┌──────────┐ ┌──────────┐
│ ❌ #4    │ │ ❌ #5    │ │ ❌ #6    │
│ No Image │ │ No Image │ │ No Image │
│ Score    │ │ Score    │ │ Score    │
│ Metrics  │ │ Metrics  │ │ Metrics  │
└──────────┘ └──────────┘ └──────────┘

... (continues for all 20 items)
```

### Card Content (Each Card Shows)
✅ Title (full text)
✅ Summary (Thai, first ~200 chars)
✅ Category badge (บันเทิง, เทคโนโลยี, etc.)
✅ Score (e.g., "95.9/100")
✅ Engagement text (e.g., "High engagement • 4.9M+ views")
✅ Views/Likes/Comments counts
✅ Growth indicator ("Rising fast", "Viral growth")
✅ Platform badge ("YouTube")
✅ AI-Generated badge (Top-3 only)

### Detail Modal (Click Any Card)
```
┌─────────────────────────────────────────────────────┐
│  ✕ CLOSE                                 #8 บันเทิง │
│                                                     │
│  LISA - DREAM feat. Kentaro Sakaguchi...           │
│                                                     │
│  [AI Image if Top-3, or placeholder]                │
│  📷 ดูภาพสร้างด้วย AI [Top-3 only]                 │
│                                                     │
│  📊 คะแนนความนิยม                                   │
│  89.6/100                                           │
│  High engagement • 16.8M+ views...                  │
│                                                     │
│  ข้อมูลพื้นฐาน                                       │
│  ช่อง: LLOUD Official                               │
│  เผยแพร่: 14 สิงหาคม 2568 เวลา 19:00                │
│                                                     │
│  👁 16.8M views   👍 1.3M likes   💬 60.0K comments │
│                                                     │
│  สรุป                                               │
│  [Thai summary - full text]                         │
│                                                     │
│  Summary (EN)                                       │
│  LISA releases official short film...               │
│                                                     │
│  การวิเคราะห์และลำดับความสำคัญ                       │
│  Viral (>100K/day)                                  │
│                                                     │
│  ผลการวิเคราะห์จาก AI                                │
│  Music video release tracking audience...           │
│                                                     │
│  ป้ายกำกับ                                          │
│  Lisa  Dream  Feat  Kentaro  Sakaguchi             │
│                                                     │
│  📲 ดูต้นฉบับใน YouTube                             │
└─────────────────────────────────────────────────────┘
```

## ✅ Verification Checklist

### Hero Section
- [ ] Shows "20 STORIES TODAY"
- [ ] Shows "3 AI IMAGES" (not 0)
- [ ] Top story has AI-generated image
- [ ] Score displayed (e.g., 95.9/100)

### Card Grid
- [ ] Exactly 20 cards displayed
- [ ] Top 3 have AI images with "AI-Generated" badge
- [ ] Ranks 4-20 don't show images
- [ ] All cards show scores
- [ ] All cards show engagement metrics
- [ ] All cards show summaries

### Top-3 Items (Ranks 1-3)
- [ ] Card #1: Has AI image
- [ ] Card #2: Has AI image
- [ ] Card #3: Has AI image
- [ ] All show "🎨 AI-Generated" badge
- [ ] Modal shows "View AI Prompt" button

### Non-Top-3 Items (Ranks 4-20)
- [ ] No AI images displayed
- [ ] No "AI-Generated" badge
- [ ] Still show scores and metrics
- [ ] Modal doesn't show "View AI Prompt" button

### LISA - DREAM Specific (Rank 8)
- [ ] Found in grid (should be visible)
- [ ] Score: ~88-89/100
- [ ] Views: ~16M
- [ ] Likes: ~1.3M
- [ ] Has Thai summary
- [ ] Has English summary
- [ ] Has AI opinion
- [ ] Has score details
- [ ] Has YouTube link button
- [ ] NO AI image (rank > 3)

### Modal Content (Any Item)
- [ ] Title displays fully
- [ ] Score shown with /100
- [ ] Engagement text present
- [ ] Basic info (channel, date)
- [ ] Metrics with icons (views/likes/comments)
- [ ] Thai summary section
- [ ] English summary section
- [ ] Growth rate indicator
- [ ] AI analysis section
- [ ] Keywords/tags displayed
- [ ] "View on YouTube" button works

## 🔍 Console Checks (Browser DevTools)

### Should See (Good)
```
[home] ✅ Successfully mapped 20 items; Top-3: 3
[home] Primary query result: { dataLength: 20, error: null }
```

### Should NOT See (Errors)
```
❌ invalid input syntax for type json
❌ missing source_url
❌ Validation failed for row
❌ JSON parse error
```

## 📊 API Response (Check Network Tab)

### GET /api/home
```json
{
  "success": true,
  "fetchedCount": 20,
  "data": [
    {
      "id": "...",
      "title": "Stray Kids...",
      "popularityScore": 95.935,
      "rank": 1,
      "isTop3": true,
      "imageUrl": "https://...",
      "aiPrompt": "...",
      "showImage": true,
      "showAiPrompt": true,
      "summary": "...",
      "summaryEn": "...",
      "aiOpinion": "...",
      "scoreDetails": "...",
      "views": 4934528,
      "likes": 714957,
      "comments": 83247
    }
  ],
  "top3Ids": ["id1", "id2", "id3"]
}
```

### GET /api/health/home
```json
{
  "healthy": true,
  "status": "healthy",
  "checks": {
    "view_accessible": { "success": true },
    "row_count": { "count": 257 },
    "top3_policy": { "success": true, "violations": 0 },
    "source_urls": { "success": true, "empty_urls": 0 }
  }
}
```

## 🚀 Quick Test Commands

### 1. Restart Server (Required for Counter Fix)
```bash
cd frontend
npm run dev
```

### 2. Open Browser
```
http://localhost:3000
```

### 3. Check Counter
Look at hero section - should say "3 AI IMAGES"

### 4. Click Cards
- Click card #1 (Top-3) → Should have AI image & prompt button
- Click card #8 (LISA) → Should have all fields, no AI image
- Click card #15 (Non-Top-3) → Should have all fields, no AI image

### 5. Run Tests (Optional)
```bash
node scripts/verify_all_fields_e2e.js
```

## 🎯 Expected Results

### Visual
- ✅ Hero shows "3 AI IMAGES"
- ✅ 20 cards in grid
- ✅ Top-3 with AI images
- ✅ All cards with scores
- ✅ All modals with complete data

### Functional
- ✅ All links work
- ✅ All modals open/close
- ✅ All images load
- ✅ All data displays

### Data Quality
- ✅ 100% field completeness
- ✅ Top-3 policy enforced
- ✅ Ordering correct (by score)
- ✅ No console errors

## 📸 Screenshot Comparison

### Before (Your Screenshot)
- ❌ "0 AI IMAGES" counter

### After (Expected)
- ✅ "3 AI IMAGES" counter
- ✅ Everything else same (already working)

## ✨ Summary

**Only change visible**: AI Images counter now shows "3" instead of "0"

**Everything else**: Already working perfectly as shown in your screenshots!

- ✅ All 20 items display
- ✅ All fields present
- ✅ Top-3 policy enforced
- ✅ LISA-DREAM complete
- ✅ Modals show all data
- ✅ Scores, summaries, metrics all visible

**Action Required**: Just restart the dev server to see the counter fix!
