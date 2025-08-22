# Home Page Fix - Deployment Runbook

## 🚀 Quick Deployment (5 minutes)

### Step 1: Update Database View
```sql
-- Run in Supabase SQL Editor
-- Copy and execute: frontend/db/sql/views/v_home_news.sql
```

### Step 2: Deploy Frontend
```bash
# No env changes needed
npm run build && npm run start
```

### Step 3: Verify Fix
```bash
# Check diagnostics
curl http://localhost:3000/api/home/diagnostics

# Expected: fetchedCount > 0, nullImageCount = 0
# Then visit: http://localhost:3000 (should show stories)
```

## 🔧 Troubleshooting

### If Home still shows "No Stories"
1. **Check database connection**:
   ```bash
   curl http://localhost:3000/api/home/diagnostics
   # Look for fetchedCount = 0 or error messages
   ```

2. **Enable debug logging**:
   ```bash
   # Add to .env.local
   NEXT_PUBLIC_DEBUG_UI=1
   # Check browser console for [diag] logs
   ```

3. **Verify view exists**:
   ```sql
   SELECT COUNT(*) FROM public.v_home_news;
   -- Should return > 0
   ```

### If images not showing
1. **Check image analysis**:
   ```bash
   curl http://localhost:3000/api/home/diagnostics
   # Look at imageAnalysis.imagesPlaceholder count
   ```

2. **Verify Supabase storage access**:
   - Check NEXT_PUBLIC_SUPABASE_URL in .env.local
   - Test image URLs directly in browser

## 🔄 Rollback (if needed)

### Disable new features
```bash
# Add to .env.local  
NEXT_PUBLIC_USE_SAFE_IMAGE_FALLBACK=false
```

### Revert database view
```sql
-- Change this line in v_home_news:
ai_image_url AS display_image_url_raw,
-- Remove: COALESCE(...) AS display_image_url_raw,
-- Remove: (ai_image_url IS NOT NULL) AS is_ai_image,
```

## 📊 Success Metrics

- **fetchedCount > 0**: Database returns data
- **afterNormalizeCount = fetchedCount**: No items filtered out  
- **nullImageCount = 0**: All items have images (real or placeholder)
- **Home page shows stories**: Visual confirmation

## 🎯 Files Changed

- `frontend/db/sql/views/v_home_news.sql` - Database fallback
- `frontend/src/lib/normalizeNewsItem.ts` - Enhanced normalization
- `frontend/src/lib/db/repos/newsRepo.ts` - Added is_ai_image field
- `frontend/src/lib/featureFlags.ts` - Feature flag system
- `frontend/src/app/api/home/diagnostics/route.ts` - Enhanced diagnostics
