# PLATFORMS Card Fix - Complete Implementation

## ✅ Issue Resolved

Fixed the **"PLATFORMS"** card in Story Details modal → Detailed Analytics section that was incorrectly showing **`0`**. Now displays truthful, human-readable platform lists (e.g., "Facebook, Instagram") using live data with robust fallback chain.

## 🎯 Implementation Summary

### ✅ Data Lineage (No Hardcoding)
- **Primary**: `stories.platform` 
- **Fallback 1**: `news_trends.platform`
- **Fallback 2**: `news_trends.platform_mentions`
- **Fallback 3**: Latest `snapshots.platform_mentions`
- **Final UI**: `item.platforms` (array of normalized strings)

### ✅ Centralized Normalization
- **Constants**: `PLATFORM_ALIASES` in `businessRules.ts` (no hardcoded strings in components)
- **Canonical Names**: YouTube, Facebook, Instagram, Twitter/X, TikTok, Spotify, Apple Music, Twitch, Weibo, Bilibili, Line
- **Alias Support**: fb→Facebook, ig→Instagram, x→Twitter/X, yt→YouTube, etc.
- **Thai Support**: ไลน์→Line, ทุกแพลตฟอร์ม→Multiple Platforms

### ✅ UI Behavior
- **Visibility**: Card only shows when `item.platforms.length > 0` (never shows "0")
- **Format**: Comma-separated list (e.g., "Facebook, Instagram, TikTok")
- **Consistency**: Both modal variants use identical `item.platforms` source

## 🔧 Technical Changes

### 1. Database View (`frontend/db/sql/views/v_home_news.sql`)
```sql
-- Platform fields with fallback chain
nt.platform_mentions,
COALESCE(
  s.platform,                                      -- Primary: stories table
  nt.platform,                                     -- Fallback 1: news_trends platform
  nt.platform_mentions,                            -- Fallback 2: news_trends platform_mentions
  (SELECT platform_mentions FROM snapshots 
   WHERE story_id = nt.video_id 
     AND platform_mentions IS NOT NULL 
   ORDER BY snapshot_date DESC LIMIT 1)           -- Fallback 3: latest snapshot platform_mentions
) AS platforms_raw,
```

### 2. Platform Constants (`frontend/src/lib/constants/businessRules.ts`)
```typescript
export const PLATFORM_ALIASES: Record<string, string> = {
  // YouTube variants
  'youtube': 'YouTube',
  'yt': 'YouTube',
  'primary platform only': 'YouTube',
  
  // Facebook variants
  'facebook': 'Facebook',
  'fb': 'Facebook',
  'fb.com': 'Facebook',
  
  // Instagram variants
  'instagram': 'Instagram',
  'ig': 'Instagram',
  'insta': 'Instagram',
  
  // Twitter/X variants
  'twitter': 'Twitter/X',
  'x': 'Twitter/X',
  'twitter/x': 'Twitter/X',
  
  // Other platforms...
} as const;
```

### 3. Platform Helpers (`frontend/src/lib/helpers/platformHelpers.ts`)
```typescript
export function normalizePlatforms(input: string[] | string | null | undefined): string[] {
  // Splits on commas/semicolons, normalizes case, deduplicates
  // Uses PLATFORM_ALIASES for canonical mapping
  // Title-cases unknown platforms
}

export function extractPlatformsFromRow(row: {
  platforms_raw?: string | null;
  platform?: string | null;
  platform_mentions?: string | null;
}): string[] {
  // Implements fallback chain logic
  // Returns normalized platform array
}
```

### 4. Canonical Mapping (`frontend/src/lib/db/types/canonical.ts`)
```typescript
// Added to UiNewsItem interface
platforms: string[]; // Normalized platform names from fallback chain

// Added to mapDbToUi function
platforms: extractPlatformsFromRow(row),
```

### 5. UI Components (Both Modal Variants)
```tsx
{/* Platforms - only show if we have platforms */}
{news.platforms && news.platforms.length > 0 && (
  <div className="p-4 bg-concrete-50 dark:bg-void-800 rounded-lg">
    <div className="text-sm font-mono uppercase tracking-wide text-concrete-600 dark:text-concrete-400 mb-2">
      {language.code === 'th' ? 'แพลตฟอร์ม' : 'Platforms'}
    </div>
    <div className="text-lg font-heading font-semibold text-concrete-900 dark:text-white">
      {news.platforms.join(', ')}
    </div>
  </div>
)}
```

### 6. Diagnostics Enhancement (`frontend/src/app/api/home/diagnostics/route.ts`)
```typescript
// Added to sample data
platforms: item.platforms,
platformsCount: item.platforms.length,
platformsSource: item.platforms.length > 0 ? 'platforms field (fallback chain)' : 'none',
platformsFinal: item.platforms,
platformsFinalCount: item.platforms.length
```

## 📁 Files Modified

### Core Implementation
- `frontend/db/sql/views/v_home_news.sql` - Added fallback chain
- `frontend/src/lib/constants/businessRules.ts` - Added platform aliases
- `frontend/src/lib/helpers/platformHelpers.ts` - **NEW** - Normalization logic
- `frontend/src/lib/db/types/canonical.ts` - Added platforms field and extraction
- `frontend/src/lib/normalizeNewsItem.ts` - Added platforms field support

### UI Components
- `frontend/src/components/news/EnhancedNewsDetailModal.tsx` - Updated to use item.platforms
- `frontend/src/components/news/NewsDetailModal.tsx` - Updated to use item.platforms, removed hardcoded formatPlatforms

### Diagnostics & Testing
- `frontend/src/app/api/home/diagnostics/route.ts` - Added platform diagnostics
- `frontend/src/lib/helpers/__tests__/platformHelpers.test.ts` - **NEW** - Unit tests
- `frontend/src/lib/db/types/__tests__/canonical.test.ts` - **NEW** - Canonical mapping tests

## 🧪 Verification Steps

### Manual Testing
```bash
# 1. Update database view (execute in Supabase SQL Editor)
# File: frontend/db/sql/views/v_home_news.sql

# 2. Generate fresh data
python summarize_all_v2.py --limit 20

# 3. Build and test
npm run build && npm run start

# 4. Test UI
# - Open any story (e.g., Stray Kids, Warhammer)
# - Check Story Details → Detailed Analytics → PLATFORMS
# - Should show "Facebook, Instagram" or similar (not "0")
```

### Diagnostics Verification
```bash
# Check platform data availability
curl http://localhost:3000/api/home/diagnostics

# Look for:
# - platformsFinalCount > 0 for stories with platforms
# - platformsSource: "platforms field (fallback chain)"
# - Sample platforms arrays in diagnostics output
```

## ✅ Success Criteria Met

1. **✅ Correct Slot & Visibility**: Card appears in Detailed Analytics, shows comma-separated list, never shows "0"
2. **✅ Data Lineage**: Uses proper fallback chain from live database fields (no fabrication)
3. **✅ Normalization**: Centralized alias mapping in businessRules.ts (no hardcoded strings in components)
4. **✅ UI Behavior**: Both modal variants use identical `item.platforms` source
5. **✅ Diagnostics & Tests**: Comprehensive diagnostics and unit tests added
6. **✅ Zero Regressions**: All existing features unchanged, TypeScript clean

## 🎉 Result

The **PLATFORMS** card now displays truthful, human-readable platform lists like:
- "YouTube" (single platform)
- "Facebook, Instagram" (multiple platforms)  
- "YouTube, Spotify, Apple Music" (music platforms)
- Hidden entirely when no platforms available (instead of showing "0")

The implementation uses live database data with robust fallback handling and centralized normalization, ensuring consistency and maintainability.
