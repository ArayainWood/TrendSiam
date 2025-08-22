# PDF Text Stability Fix - Mixed Script Rendering

## Overview

This document describes the comprehensive fix for text overlapping/colliding issues in TrendSiam's PDF generation, specifically targeting Thai + Latin + emoji mixed-script content.

## Problem Description

### Root Causes Identified

1. **Mid-line Font Fallback**: React-PDF was falling back from NotoSansThai to Arial/Helvetica for Latin text, causing metric mismatches
2. **Missing Script Boundary Spacing**: No spacing between different script types (Thai ↔ Latin ↔ Numbers ↔ Emoji)
3. **Inadequate Line Height**: Insufficient vertical spacing for Thai characters with descenders/ascenders
4. **Thai Hyphenation**: Unwanted word breaking in Thai text
5. **Emoji Adjacency**: Emoji characters colliding with adjacent text

### Problematic Examples

- `แมพกระโดดแกล้งแปลกๆ (รู้ว่าเราคิดอะไร) Roblox UNEXPECTED Tower`
- `2,052 KG++ เกาะพังแล้วครับ !!!!🤯ผู้กี่สุด ในชีวิต !!!! | Roblox Grow a Garden`
- `LISA — DREAM feat. Kentaro Sakaguchi (Official Short Film MV)`

## Solution Architecture

### 1. Universal Font System (`pdfFonts.ts`)

**Purpose**: Eliminate font fallback by registering a single universal font family.

**Key Features**:
- Registers `NotoSansThaiUniversal` as the primary family
- Overrides system fonts (Helvetica, Arial, sans-serif) to use Thai fonts
- Disables Thai hyphenation via `Font.registerHyphenationCallback()`
- Prevents mid-line font switching that causes metric mismatches

**Usage**:
```typescript
import { registerPDFFonts, getUniversalFontFamily } from '@/lib/pdf/pdfFonts';

// Call once before PDF generation
registerPDFFonts();

// Use in StyleSheet
fontFamily: getUniversalFontFamily()
```

### 2. Script Boundary Spacing (`pdfTypo.ts`)

**Purpose**: Add strategic spacing at script transitions to prevent overlapping.

**Spacing Strategy**:
- **Hair Space (U+200A)**: For Thai ↔ Latin, Thai ↔ Numbers, Latin ↔ Numbers
- **Thin Space (U+2009)**: For Emoji boundaries (more visible separation needed)

**Processing Functions**:
- `addScriptBoundarySpacing()`: Core spacing logic using Unicode property classes
- `processTitleForPDF()`: Enhanced processing for titles with additional patterns
- `processMetadataForPDF()`: Lighter processing for metadata text

**Unicode Patterns Used**:
```typescript
// Thai ↔ Latin transitions
/([\p{Script=Thai}])([\p{Script=Latin}])/gu
/([\p{Script=Latin}])([\p{Script=Thai}])/gu

// Emoji boundaries  
/([\p{Extended_Pictographic}])([\p{Script=Thai}\p{Script=Latin}\p{Number}])/gu
```

### 3. Centralized Styles (`pdfStyles.ts`)

**Purpose**: Consistent typography optimized for mixed-script rendering.

**Key Style Properties**:
- `lineHeight: 1.65-1.75`: Generous vertical spacing for Thai characters
- `letterSpacing: 0.1-0.25`: Horizontal spacing to prevent glyph overlap
- `wordSpacing: 1-2.5`: Word-level spacing for script boundaries
- `fontKerning: 'normal'`: Enable proper glyph positioning

**Style Variants**:
- `text`: Base text style
- `itemTitle`: Enhanced spacing for mixed-script titles
- `mixedScript`: Maximum spacing for problematic content
- `emojiText`: Extra spacing for emoji-heavy content

### 4. Updated Components

**WeeklyDoc.tsx Changes**:
- Imports new font, typography, and style systems
- Calls `registerPDFFonts()` at component level
- Wraps all text content with appropriate processors
- Uses centralized styles from `createPDFStyles()`

**PDF Route Changes**:
- Simplified font registration (delegates to `pdfFonts.ts`)
- Added font system logging for diagnostics
- Removed manual font registration code

## Implementation Details

### Font Registration Flow

1. `registerPDFFonts()` called in PDF route or component
2. Resolves Thai font paths using existing `fontResolver.ts`
3. Registers universal family with Thai fonts as base
4. Overrides system font families to prevent fallback
5. Disables Thai hyphenation globally

### Text Processing Pipeline

1. Raw text input (titles, metadata, etc.)
2. Apply appropriate processor:
   - `processTitleForPDF()` for titles
   - `processMetadataForPDF()` for metadata
3. Script boundary spacing added automatically
4. Render with centralized styles

### Style Selection Logic

```typescript
// Automatic style recommendation
function getRecommendedStyle(text: string) {
  const hasEmoji = /[\p{Extended_Pictographic}]/u.test(text);
  const hasMixedScript = /[\p{Script=Thai}].*[\p{Script=Latin}]/u.test(text);
  
  if (hasEmoji) return 'emojiText';
  if (hasMixedScript) return 'mixedScript';
  return 'text';
}
```

## Testing

### CLI Test Script (`testMixedScriptPDF_CLI.ts`)

**Purpose**: Automated testing of the fix with known problematic strings.

**Features**:
- Tests all problematic examples from the original issue
- Generates `test-mixed-script.pdf` for visual inspection
- Includes pattern-specific tests (numbers + letters, emoji sequences, etc.)
- Provides font system diagnostics

**Usage**:
```bash
cd frontend
npx tsx scripts/testMixedScriptPDF_CLI.ts
```

**Expected Output**:
- `test-mixed-script.pdf` (~22-23KB)
- No overlapping/colliding glyphs
- Proper spacing between script boundaries
- Consistent font rendering throughout

### Manual Testing

1. **Generate Test PDF**:
   ```bash
   npx tsx scripts/testMixedScriptPDF_CLI.ts
   ```

2. **Generate Live PDF**:
   ```bash
   npm run build && npm run start
   curl -o fixed.pdf "http://localhost:3000/api/weekly/pdf"
   ```

3. **Visual Inspection**:
   - Open PDFs in viewer
   - Check for overlapping text in mixed-script lines
   - Verify proper spacing around emoji
   - Confirm consistent font usage

4. **Font Verification**:
   - Open PDF Properties → Fonts
   - Should show only `NotoSansThaiUniversal` (and optionally `NotoEmoji`)
   - No Arial/Helvetica/Tahoma fallbacks

## Performance Impact

- **File Size**: Minimal increase (~1-2KB due to spacing characters)
- **Generation Time**: Negligible impact from text processing
- **Font Embedding**: No change (same fonts, different registration)
- **Memory Usage**: Slight increase from preprocessing

## Maintenance

### Adding New Fonts

1. Add font files to `public/fonts/`
2. Update `fontResolver.ts` to include new paths
3. Register in `pdfFonts.ts` under universal family
4. Test with CLI script

### Adjusting Spacing

1. Modify spacing constants in `pdfTypo.ts`:
   ```typescript
   const HAIR_SPACE = '\u200A';  // Thinner spacing
   const THIN_SPACE = '\u2009';  // Wider spacing
   ```

2. Update style properties in `pdfStyles.ts`:
   ```typescript
   lineHeight: 1.75,      // Vertical spacing
   letterSpacing: 0.15,   // Horizontal spacing
   wordSpacing: 1.5       // Word spacing
   ```

3. Test changes with CLI script

### Debugging Issues

1. **Check Font Registration**:
   ```typescript
   const fontInfo = getFontRegistrationInfo();
   console.log(fontInfo);
   ```

2. **Test Spacing Logic**:
   ```typescript
   import { testScriptBoundarySpacing } from '@/lib/pdf/pdfTypo';
   testScriptBoundarySpacing();
   ```

3. **Analyze Problematic Text**:
   ```typescript
   import { getSpacingStats } from '@/lib/pdf/pdfTypo';
   const stats = getSpacingStats('problematic text');
   console.log(stats);
   ```

## Files Modified

### New Files
- `frontend/src/lib/pdf/pdfFonts.ts` - Universal font system
- `frontend/src/lib/pdf/pdfTypo.ts` - Script boundary spacing
- `frontend/src/lib/pdf/pdfStyles.ts` - Centralized styles
- `frontend/scripts/testMixedScriptPDF_CLI.ts` - Test script
- `docs/pdf-text-stability.md` - This documentation

### Modified Files
- `frontend/src/lib/pdf/WeeklyDoc.tsx` - Updated to use new systems
- `frontend/src/app/api/weekly/pdf/route.tsx` - Simplified font registration

### Unchanged Files
- `frontend/src/lib/pdf/fontResolver.ts` - Font path resolution (reused)
- `frontend/src/lib/pdf/textSanitizer.ts` - Basic text cleaning (complementary)
- Font files in `public/fonts/` - No changes needed

## Acceptance Criteria ✅

- ✅ No overlapping/stacking characters in any PDF
- ✅ All PDF text uses unified font family with Thai hyphenation disabled
- ✅ Boundary spacing applied to all text inputs in PDF components
- ✅ No changes to `.env` or web UI code; server keys remain server-only
- ✅ Strict typing preserved; no unsafe casts
- ✅ PDF-only scope maintained; no DOM/web component changes

## Future Enhancements

1. **Emoji Font Support**: Add dedicated emoji font for color emoji rendering
2. **Dynamic Spacing**: Adjust spacing based on font size and content density
3. **Language Detection**: Automatic script detection for optimal spacing
4. **Performance Optimization**: Cache processed text for repeated content
