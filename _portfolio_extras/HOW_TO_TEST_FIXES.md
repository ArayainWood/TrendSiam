# How to Test TrendSiam Fixes

## Quick Test Guide

### Prerequisites
1. Frontend dev server running: `cd frontend && npm run dev`
2. Browser open to: http://localhost:3000

### Test 1: Top-3 AI Images on Homepage

**Steps:**
1. Open homepage (http://localhost:3000)
2. Look at the first 3 news cards in the grid
3. Each should display an AI-generated image (not "Loading Image...")

**Expected Result:**
- Card #1: Shows AI image with "🤖 AI-Generated" badge
- Card #2: Shows AI image with "🤖 AI-Generated" badge  
- Card #3: Shows AI image with "🤖 AI-Generated" badge
- Cards #4+: Show placeholder image (no AI images)

**DevTools Check:**
1. Open Network tab
2. Filter by "Img" 
3. Look for requests to: `<your-project-id>.supabase.co/storage/v1/object/public/ai-images/`
4. All should return 200 OK

### Test 2: Modal AI Images

**Steps:**
1. Click on any Top-3 story card
2. Modal opens with story details

**Expected Result:**
- Same AI image appears in modal
- "🤖 AI-Generated" badge visible
- Image is clickable (opens in new tab)

### Test 3: Analysis Fields

**Steps:**
1. In modal, expand "View Details" section
2. Check the analysis panels

**Expected Result:**
- Popularity Score Details: Shows actual reason (not "N/A")
- View Details breakdown shows:
  - Views: Actual number
  - Growth: Percentage or rate
  - Platform: "Primary platform only" or actual mentions
  - Score: Numeric score/100

### Test 4: API Response Verification

**Steps:**
1. Open: http://localhost:3000/api/home
2. Check the JSON response

**Expected Result:**
```json
{
  "data": [
    {
      "ai_image_url": "https://...",
      "display_image_url": "https://...", // Should match ai_image_url for Top-3
      "ai_opinion": "Actual analysis text...",
      "score_details": "89/100",
      "keywords": "actual, keywords, here",
      // ... other fields populated
    }
  ]
}
```

### Test 5: Non-Top-3 Behavior

**Steps:**
1. Scroll down to stories ranked #4 and below
2. Check their display

**Expected Result:**
- NO AI images (placeholder only)
- This maintains the "AI images only for Top-3" policy

## Troubleshooting

### Images Still Not Loading?

1. **Clear browser cache**: Ctrl+Shift+R (hard refresh)
2. **Check console**: Look for image loading errors
3. **Verify API**: Check /api/home returns `display_image_url` for Top-3
4. **Check Supabase**: Ensure Storage bucket 'ai-images' is public

### Analysis Fields Still Missing?

1. **Regenerate data**: 
   ```bash
   python summarize_all_v2.py --limit 20 --force-refresh-stats
   ```
2. **Check DB directly**: Query `news_trends` table for analysis fields
3. **Verify API**: Ensure /api/home includes all analysis fields

### Wrong Ordering?

1. **Check sort field**: Must use `popularity_score_precise` (numeric)
2. **Verify across layers**: DB query, API, and frontend must all use same ORDER BY

## Performance Check

After fixes are verified:
1. Open Lighthouse (F12 → Lighthouse tab)
2. Run performance audit
3. Ensure no major regressions from image loading
