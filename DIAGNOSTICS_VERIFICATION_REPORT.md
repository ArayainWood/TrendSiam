# Diagnostics Verification Report

## Expected Diagnostics Output

After the fixes, the `/api/home/diagnostics` endpoint should return:

### Key Metrics (Expected)
```json
{
  "success": true,
  "aiImagesCountComputed": 3,
  "topNUsed": 3,
  "aiImagesAnalysis": {
    "calculatedTop3Count": 3,
    "actualTop3WithAI": 3,
    "totalWithAI": 12,
    "top3Details": [
      {
        "rank": 1,
        "hasAIImage": true,
        "title": "Story 1 title..."
      },
      {
        "rank": 2,
        "hasAIImage": true,
        "title": "Story 2 title..."
      },
      {
        "rank": 3,
        "hasAIImage": true,
        "title": "Story 3 title..."
      }
    ]
  },
  "growthComputationStatus": {
    "source": "Python script (views/day calculation)",
    "hasGrowthData": 20,
    "sampleGrowthRates": [
      {
        "title": "Sample story...",
        "growthRate": 125000,
        "label": "Viral (>100K/day)"
      }
    ]
  },
  "columnHealth": {
    "hasSummaryEnPercentage": "100.0%",
    "hasAIImagePrompt": 15,
    "hasPopularitySubtext": 20
  },
  "sample": [
    {
      "popularitySubtext": "High engagement • 11.8M+ views (like rate 10.2%) • Viral growth",
      "popularitySubtextPreview": "High engagement • 11.8M+ views (like rate 10.2%)...",
      "growthRateLabel": "Viral (>100K/day)",
      "hasAIImagePrompt": true
    }
  ]
}
```

## Verification Commands

### 1. Generate Fresh Data
```bash
cd ..
python summarize_all_v2.py --limit 20
```
**Expected**: Generates 20 stories with `summary_en`, `ai_image_prompt`, and numeric `growth_rate`

### 2. Build Snapshots
```bash
cd frontend
npm run snapshot:build:publish
```
**Expected**: Creates snapshots for frontend consumption

### 3. Type Check
```bash
npx tsc --noEmit --skipLibCheck
```
**Expected**: 0 errors in main code (test file errors are acceptable)

### 4. Build Application
```bash
npm run build
```
**Expected**: Successful build with no compilation errors

### 5. Start Application
```bash
npm run start
```
**Expected**: Application starts successfully

### 6. Check Diagnostics
```bash
curl http://localhost:3000/api/home/diagnostics
```
**Expected**: Returns JSON with `aiImagesCountComputed: 3` and proper subtext samples

### 7. Check Field Analysis
```bash
curl http://localhost:3000/api/home/fields
```
**Expected**: Shows field presence percentages and quality metrics

## Manual UI Verification

### Homepage
- [ ] **AI Images Counter**: Shows exactly **3** (not 12)
- [ ] **News Cards**: Show popularity score with **1 decimal** (e.g., 85.6/100)
- [ ] **Popularity Subtext**: Shows meaningful text like "High engagement • 11.8M+ views (like rate 10.2%) • Viral growth"

### Story Details Modal
- [ ] **Popularity Score**: Shows **85.6/100** format
- [ ] **Popularity Subtext**: Shows detailed engagement metrics
- [ ] **"View AI Prompt" Button**: Visible when story has AI image
- [ ] **AI Prompt Panel**: Opens and shows generation prompt
- [ ] **Growth Rate**: Shows as "Viral (>100K/day)" or similar format

### Enhanced Home Page
- [ ] **All above features**: Work consistently
- [ ] **No Regressions**: All existing functionality preserved

## Data Flow Verification

### 1. Python Script Output
```bash
# Check that summarize_all_v2.py generates proper fields
python -c "
import json
with open('thailand_trending_summary.json', 'r') as f:
    data = json.load(f)
    items = data.get('trending_stories', [])
    print(f'Total items: {len(items)}')
    print(f'Items with summary_en: {sum(1 for item in items if item.get(\"summary_en\"))}')
    print(f'Items with ai_image_prompt: {sum(1 for item in items if item.get(\"ai_image_prompt\"))}')
    print(f'Items with numeric growth_rate: {sum(1 for item in items if isinstance(item.get(\"growth_rate\"), (int, float)))}')
"
```

### 2. Database Content
```sql
-- Check v_home_news view has required fields
SELECT 
  COUNT(*) as total_items,
  COUNT(summary_en) as has_summary_en,
  COUNT(ai_image_prompt) as has_ai_prompt,
  COUNT(CASE WHEN ai_image_url IS NOT NULL THEN 1 END) as has_ai_image
FROM v_home_news 
LIMIT 20;
```

### 3. API Response
```bash
# Check home API returns properly mapped data
curl -s http://localhost:3000/api/home | jq '.data[0] | {
  aiImagePrompt: .aiImagePrompt,
  ai_image_prompt: .ai_image_prompt,
  popularitySubtext: .popularitySubtext,
  summaryEn: .summary_en,
  isAIImage: .isAIImage
}'
```

## Success Criteria

### ✅ All Issues Fixed
1. **AI Images Count**: Homepage shows exactly 3
2. **Popularity Display**: 1 decimal + meaningful subtext
3. **AI Prompt Panel**: Visible and functional

### ✅ No Regressions
1. **Weekly Report**: Still works
2. **PDF Generation**: Still works
3. **Other Pages**: Unaffected
4. **API Contracts**: Maintained

### ✅ Quality Standards
1. **Type Safety**: 0 TypeScript errors
2. **Build Success**: Clean compilation
3. **No Hardcoding**: All values in constants
4. **Backward Compatible**: Legacy fields preserved

## Troubleshooting

### If AI Images Count Still Shows 12
- Check that `calculateAIImagesCount` is imported and used in `page.tsx` line 77
- Verify `AI_IMAGE_RULES.TOP_STORIES_COUNT = 3` in `businessRules.ts`
- Check browser console for any JavaScript errors

### If Popularity Subtext Missing
- Verify `getPopularitySubtext` is imported in components
- Check that `popularitySubtext` field is populated in diagnostics
- Ensure `mapDbToUi` is generating the subtext correctly

### If AI Prompt Panel Missing
- Check that stories have `aiImagePrompt` or `ai_image_prompt` field
- Verify the modal is using the correct field name
- Check browser console for any rendering errors

### If Build Fails
- Run `npm install` to ensure dependencies are up to date
- Check for any TypeScript errors in main code (ignore test files)
- Verify all imports are correct and files exist
