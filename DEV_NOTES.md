# Developer Notes - TrendSiam Fixes

## 🏠 Home Data Image URL Sanitization (2024-08-19)

### Problem
Home page was crashing with error: `Invalid news item data: [{ "expected": "string", "code": "invalid_type", "path": ["display_image_url"], "message": "Invalid input" }]`

Root cause: `resolveDisplayImage()` in `homeData.ts` returns `null` when no AI image exists, but Zod schema expects `string | undefined`.

### Solution
1. **Sanitizer Utility** (`frontend/src/lib/utils/sanitizeHomeItem.ts`)
   - Converts `null`, empty string, or invalid values to `undefined`
   - Handles non-string values gracefully
   - Applied before Zod validation in `normalizeNewsItem()`

2. **Safe Normalization**
   - newsStore now uses `safeNormalizeNewsItems()` instead of `normalizeNewsItems()`
   - Invalid items are logged but don't crash the page
   - Other valid items still render

3. **Diagnostics Endpoint** (`/api/home/diagnostics`)
   - Shows validation errors, image coverage stats
   - Samples of sanitized data
   - No secrets exposed

### Usage
```bash
# Check home data health
curl http://localhost:3000/api/home/diagnostics

# Response includes:
# - invalidItems: array of items that failed validation
# - imageCoverage: stats on null/empty/valid images  
# - sampleSanitization: before/after examples
```

### Notes
- No schema changes needed (kept backward compatible)
- Weekly Report unaffected (uses different data path)
- UI already handles missing images with placeholders

---

# Developer Notes - TrendSiam Fixes

## 🔧 What Changed

### 1. **TypeScript Strict Mode Fixes**
- **File**: `frontend/src/utils/array.ts`
  - Fixed `pairwise()` function to handle `noUncheckedIndexedAccess` safely
  - Added proper type guards before pushing array elements
  - Imports `isDefined` from `typeGuards.ts` to avoid duplication

### 2. **Home Page Data Pipeline**
- **File**: `frontend/src/lib/data/homeData.ts`
  - Enhanced fallback logic: Today (Bangkok) → Last 24h → Last 7 days
  - Never shows empty list if data exists in DB
  - Robust timezone handling with Asia/Bangkok

### 3. **Home Page UI**
- **File**: `frontend/src/app/page.tsx`
  - Added proper empty state UI when no data available
  - Shows refresh button and helpful message
  - Dev mode includes link to diagnostics

### 4. **Diagnostics Endpoint**
- **File**: `frontend/src/app/api/home/diagnostics/route.ts`
  - Shows time windows and query results
  - Helps debug why home page might be empty
  - Access at: `/api/home/diagnostics`

### 5. **Type Definitions**
- **File**: `frontend/src/types/index.ts`
  - Added missing properties to `NewsItem`: `id`, `date`
  - Made `ai_image_url` and `ai_image_prompt` accept `null`

## 📅 How Home Time Windows Work

1. **Primary**: Today's date in Asia/Bangkok timezone
   - Queries: `date = 'YYYY-MM-DD'` (Bangkok date)
   
2. **Fallback 1**: Last 24 hours
   - Queries: `created_at >= (now - 24h)`
   - Used when no data for "today"
   
3. **Fallback 2**: Last 7 days
   - Queries: `created_at >= (now - 7 days)`
   - Used when no data in last 24h

Time calculation example:
```javascript
// Bangkok "today"
const bangkokTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(now);
```

## 🔍 Running Diagnostics

### Home Page Diagnostics
```bash
# In browser (dev mode)
http://localhost:3000/api/home/diagnostics

# Shows:
# - Current Bangkok time and date
# - Query windows and results
# - Sample data from each window
# - Recommendations if data missing
```

### System Health Check
```bash
# Check overall system health
http://localhost:3000/api/health

# Check weekly snapshot status
http://localhost:3000/api/weekly/diagnostics
```

### Snapshot Testing
```bash
# Test environment loading
npm run snapshot:check

# Dry run snapshot build
npm run snapshot:build:dry

# Full integration test
npm run snapshot:test
```

## 🛡️ Type Safety Patterns

### Safe Array Access with `noUncheckedIndexedAccess`
```typescript
// Before (unsafe)
const prev = arr[i-1];  // Type: T | undefined

// After (safe)
const prev = arr[i-1];
const curr = arr[i];
if (isDefined(prev) && isDefined(curr)) {
  // Both are type T here
}
```

### Pairwise Iteration
```typescript
// Safe consecutive element access
import { pairwise } from '@/utils/array';

const pairs = pairwise(items); // ReadonlyArray<readonly [T, T]>
for (const [prev, curr] of pairs) {
  // Both prev and curr are guaranteed to exist
}
```

## 🚀 Common Issues & Solutions

### Issue: Home page shows 0 stories
**Solution**: Check `/api/home/diagnostics`
- Verify Bangkok date is correct
- Check if data exists in any time window
- Ensure data pipeline is running

### Issue: TypeScript errors with array indexing
**Solution**: Use type guards
```typescript
import { isDefined } from '@/utils/typeGuards';

if (isDefined(value)) {
  // value is not null/undefined here
}
```

### Issue: Environment variables not loading in CLI
**Solution**: Scripts use `loadEnv.cjs`
```bash
# All snapshot scripts now auto-load .env.local
npm run snapshot:build
```

## 📝 Testing Checklist

- [ ] `npm run dev` - Home page loads without errors
- [ ] `npm run build` - Build succeeds
- [ ] `npx tsc --noEmit` - No TypeScript errors (except test files)
- [ ] `npm run snapshot:test` - Integration tests pass
- [ ] Home page shows stories when DB has data
- [ ] Home page shows friendly empty state when no data
- [ ] Weekly report and PDF still work correctly

## 📄 PDF Typography & Font Setup

### Font Configuration
- **Primary Font**: NotoSansThai (supports Thai + Latin)
- **Location**: `public/fonts/NotoSansThai/` (Regular & Bold)
- **Registration**: Server-only in PDF generation pipeline
- **Fallback**: Automatic font resolution with error handling

### Text Sanitization Pipeline
```typescript
// Applied to all PDF text content
1. Unicode NFC normalization
2. Zero-width character removal (\u200B-\u200D\uFEFF)
3. Whitespace normalization
4. Control character removal
5. Typography enhancements (em dash, ellipsis)
```

### Typography Settings
- **Line Height**: 1.45-1.5 for mixed Thai/Latin text
- **Letter Spacing**: 0 (normal)
- **Text Wrapping**: `overflow-wrap: anywhere` for long titles
- **Font Weight**: Bold for titles, normal for metadata

### Debugging PDF Layout
```bash
# Check PDF diagnostics
GET /api/weekly/diagnostics

# Returns font info and text analysis
{
  "pdfDiagnostics": {
    "fontInfo": {
      "directory": "path/to/fonts",
      "files": ["NotoSansThai-Regular.ttf", "NotoSansThai-Bold.ttf"]
    },
    "textAnalysis": [
      {
        "rank": 1,
        "metrics": {
          "hasThaiChars": true,
          "hasLatinChars": true,
          "hasZeroWidth": false,
          "sanitized": true
        }
      }
    ]
  }
}
```

### Common Issues & Solutions
- **Overlapping Text**: Check line height and font loading
- **Missing Characters**: Verify NotoSansThai font availability
- **Layout Breaks**: Use text sanitization for problematic titles
- **Font Errors**: Check `/api/weekly/diagnostics` for font status

## 🔒 Security Notes

- Service role keys remain server-only
- No `.env` values exposed to client
- All server modules use `import 'server-only'` directive
- Client cannot import from `/server/` paths
