# ROOT CAUSE ANALYSIS MATRIX

**Generated:** 2025-10-20 17:04 Bangkok Time  
**Purpose:** Map each symptom to precise root causes with exact file locations

---

## SYMPTOM CATEGORIES

| ID | Symptom | Affected Items | Severity |
|----|---------|----------------|----------|
| S1 | Thai diacritics missing/overlapping/clipped | #4, #6, #18, #19, global headers/footers | HIGH |
| S2 | Special characters corrupted (~~, {}, @, ₽) | #16, #20 | HIGH |
| S3 | CJK ideographs render as tofu boxes (□) | #20 (她), #14-#17 (suspected) | HIGH |
| S4 | Korean Hangul render as tofu boxes | #11 (엔믹스), others suspected | HIGH |
| S5 | Emoji render as replacement glyphs | #14-#20 (🤯, 🔥, etc) | MEDIUM |
| S6 | Random extra symbols in text | Footer, metadata fields | MEDIUM |

---

## ROOT CAUSE MAPPING

### S1: Thai Diacritics Missing/Overlapping/Clipped

| Root Cause | Location | Line(s) | Mechanism | Confidence | Fix Complexity |
|------------|----------|---------|-----------|------------|----------------|
| **RC-1.1:** Line height too low (1.4 < 1.6 recommended) | `pdfStyles.ts` | 78 | Clipping box cuts off tone marks above base consonants | 85% | LOW (change 1 value) |
| **RC-1.2:** Padding insufficient (1px < 3px needed) | `pdfStyles.ts` | 86-87 | Combining marks extend beyond text box | 70% | LOW (change 2 values) |
| **RC-1.3:** Font subsetting removes GPOS tables | `pdfFonts.core.ts` | 50 | subset:false flag ignored by fontkit; mark-to-base positioning lost | 60% | HIGH (needs library verification) |
| **RC-1.4:** No HarfBuzz shaping | N/A (library limitation) | N/A | @react-pdf/renderer doesn't apply OpenType features | 40% | CRITICAL (may require library change) |
| **RC-1.5:** Thai grapheme reordering conflicts with NFC | `pdfTextSanitizer.v6.unified.ts` | 248-257 | fixThaiToneMarkOrder() reorders after NFC normalization, breaking clusters | 30% | MEDIUM (remove function if no-op) |

**Recommended Fix Order:** RC-1.1 → RC-1.2 → RC-1.3 → RC-1.5 → RC-1.4 (test after each)

---

### S2: Special Characters Corrupted

| Root Cause | Location | Line(s) | Mechanism | Confidence | Fix Complexity |
|------------|----------|---------|-----------|------------|----------------|
| **RC-2.1:** Font missing glyphs for symbols (~~, {}, ₽) | Font files | N/A | NotoSansThai lacks full symbol coverage; renderer falls back to system font mid-title | 80% | MEDIUM (register NotoSansSymbols) |
| **RC-2.2:** Font fallback during rendering causes metrics mismatch | @react-pdf/renderer | N/A | Switching fonts mid-text disrupts baseline alignment | 75% | MEDIUM (ensure single font per Text or load symbols font) |
| **RC-2.3:** C0/C1 sanitizer removes legitimate characters (edge case) | `pdfTextSanitizer.v6.unified.ts` | 86 | Regex /[\x00-\x09\x0B-\x1F\x7F-\x9F]/g may have off-by-one errors | 20% | LOW (test regex correctness) |

**Recommended Fix:** RC-2.1 (register NotoSansSymbols for all snapshots)

---

### S3: CJK Ideographs Render as Tofu Boxes

| Root Cause | Location | Line(s) | Mechanism | Confidence | Fix Complexity |
|------------|----------|---------|-----------|------------|----------------|
| **RC-3.1:** Fallback mode active, NotoSansJP not registered | `pdfFontsMultilingual.ts` | 58-71 | analyzeSnapshotScripts() triggers fallback; only Thai fonts loaded | 90% | HIGH (fix fallback logic) |
| **RC-3.2:** Font selector chooses NotoSansJP but it's not registered | `pdfFontSelector.ts` | 30-57 | No validation that selected font exists in registry | 85% | MEDIUM (add availability check) |
| **RC-3.3:** Mixed-script titles use single font | `WeeklyDoc.tsx` | 73 | One fontFamily per <Text>; CJK in Thai font → missing glyphs | 75% | HIGH (split text into multiple <Text> components) |

**Recommended Fix:** RC-3.2 (add fallback chain in selector) + RC-3.1 (ensure all fonts loaded)

---

### S4: Korean Hangul Render as Tofu Boxes

| Root Cause | Location | Line(s) | Mechanism | Confidence | Fix Complexity |
|------------|----------|---------|-----------|------------|----------------|
| **RC-4.1:** Same as RC-3.1 (NotoSansKR not registered) | `pdfFontsMultilingual.ts` | 58-71 | Fallback mode skips Korean font loading | 90% | HIGH (fix fallback logic) |
| **RC-4.2:** Same as RC-3.2 (selector assumes font available) | `pdfFontSelector.ts` | 30-57 | selectFontFamily() returns 'NotoSansKR' without checking registry | 85% | MEDIUM (add availability check) |
| **RC-4.3:** Hangul precomposed syllables missing in Thai font | Font files | N/A | NotoSansThai may not include full Hangul range (AC00-D7AF) | 50% | MEDIUM (verify font coverage, use KR font) |

**Recommended Fix:** RC-4.2 (fallback to Thai font if KR not available; Thai font has basic Hangul support per Memory Bank Oct 18)

---

### S5: Emoji Render as Replacement Glyphs

| Root Cause | Location | Line(s) | Mechanism | Confidence | Fix Complexity |
|------------|----------|---------|-----------|------------|----------------|
| **RC-5.1:** NotoEmoji not registered (fallback mode) | `pdfFontsMultilingual.ts` | 58-71 | Emoji detection works but font not loaded | 80% | MEDIUM (force emoji font registration) |
| **RC-5.2:** Font selector requires "pure emoji" (scripts.size === 1) | `pdfFontSelector.ts` | 46 | Emoji mixed with text uses Thai font → missing emoji glyphs | 70% | LOW (change condition to prioritize emoji) |
| **RC-5.3:** Emoji multi-byte codepoints not handled correctly | `pdfTextSanitizer.v6.unified.ts` | 193 | NFC normalization may decompose emoji sequences (ZWJ sequences) | 40% | MEDIUM (preserve emoji sequences) |

**Recommended Fix:** RC-5.2 (change font selection priority for emoji-containing text)

---

### S6: Random Extra Symbols in Text

| Root Cause | Location | Line(s) | Mechanism | Confidence | Fix Complexity |
|------------|----------|---------|-----------|------------|----------------|
| **RC-6.1:** Orphan mark removal too aggressive | `pdfTextSanitizer.v6.unified.ts` | 290-312 | removeOrphanThaiMarks() removes legitimate marks in edge cases | 50% | MEDIUM (refine detection logic) |
| **RC-6.2:** Font rendering artifacts from subsetting | `pdfFonts.core.ts` | 50 | Corrupted font subsets produce visual artifacts | 40% | HIGH (verify subset:false working) |
| **RC-6.3:** PDF renderer glyph fallback issues | @react-pdf/renderer | N/A | Missing glyphs replaced with visible replacement character (U+FFFD) | 60% | LOW (ensure fonts cover all used codepoints) |

**Recommended Fix:** RC-6.3 (register NotoSansSymbols to cover all special chars)

---

## CONSOLIDATED ROOT CAUSES (Cross-Symptom)

### RC-A: Font Registration Fallback Mode
**Affects:** S3, S4, S5  
**Files:**
- `pdfFontsMultilingual.ts` lines 58-71
- `pdfMultilingualFonts.ts` lines 146-187

**Problem:** Fallback mode loads only Thai fonts, ignoring CJK/Korean/Emoji/Symbols

**Trigger Conditions:**
1. `items` array empty (unlikely, but possible if API error)
2. `analyzeSnapshotScripts()` throws exception
3. `registerFontsForScripts()` returns empty array (manifest load failure)

**Fix Strategy:**
1. Add error handling in `analyzeSnapshotScripts()` → never throw, always return at least {Thai, Latin}
2. Make `registerFontsForScripts()` more robust → if manifest missing, use hardcoded paths for critical fonts
3. Add validation after registration: if `loadedFamilies.length < 2` → log ERROR and force load symbols font

---

### RC-B: Font Selector Assumes All Fonts Available
**Affects:** S3, S4, S5  
**File:** `pdfFontSelector.ts` lines 30-57

**Problem:** No runtime check that selected font was actually registered

**Fix Strategy:**
```
At pdfFontSelector.ts line 30, add:
  import { getFontRegistrationInfo } from './pdfFontsMultilingual';
  
  function selectFontFamily(text) {
    const { loadedFamilies } = getFontRegistrationInfo();
    const scripts = detectScripts(text);
    
    // Try priority order
    if (scripts.has(Script.HANGUL) && loadedFamilies.includes('NotoSansKR')) {
      return 'NotoSansKR';
    }
    if (scripts.has(Script.CJK) && loadedFamilies.includes('NotoSansJP')) {
      return 'NotoSansJP';
    }
    // ... similar checks for other fonts
    
    // Fallback: Always return NotoSansThaiUniversal (guaranteed available)
    return 'NotoSansThaiUniversal';
  }
```

---

### RC-C: Line Height & Padding Insufficient for Thai
**Affects:** S1  
**File:** `pdfStyles.ts` lines 78, 86-87

**Problem:** Values optimized for aesthetics, not Thai correctness

**Evidence:**
- Current: lineHeight=1.4, padding=1px
- Recommended (Thai typography): lineHeight=1.6-1.8, padding=3-4px
- Memory Bank Oct 16: lineHeight=2.5 WAS the fix, but was later reduced

**Fix Strategy:**
```
At pdfStyles.ts line 78:
  Change lineHeight: 1.4 → lineHeight: 1.65  // Thai-safe + reasonable

At pdfStyles.ts lines 86-87:
  Change paddingTop: 1, paddingBottom: 1
  To: paddingTop: 3, paddingBottom: 3  // Diacritic clearance
```

**Rationale:** 1.65 is midpoint between current 1.4 (too low) and Oct 16 fix 2.5 (too high)

---

### RC-D: Font Subsetting May Remove GPOS Tables
**Affects:** S1  
**File:** `pdfFonts.core.ts` line 50

**Problem:** `subset: false` flag may not work in fontkit

**Test Required:**
1. Generate PDF with Thai text
2. Extract embedded font: `pdffonts weekly.pdf`
3. Dump font tables: `ttx -l embedded_font.ttf`
4. Check if GPOS, GSUB, GDEF tables present
5. If missing → subset:false NOT working

**If Tables Missing:**
```
Option A: Pre-subset fonts manually
  1. Use pyftsubset (fonttools) to create subsets with --layout-features=*
  2. Embed pre-subsetted fonts (keeps GPOS/GSUB)
  3. Update fontResolver.core.ts to use pre-subsetted versions

Option B: Disable subsetting entirely (if library supports)
  Research @react-pdf/renderer v4.3.0 config for global subset disable

Option C: Switch to pdfkit directly (skip @react-pdf/renderer)
  More control over font embedding, but lose React-based templating
```

---

### RC-E: Over-Complex Sanitization Pipeline
**Affects:** S1 (edge cases), S6  
**File:** `pdfTextSanitizer.v6.unified.ts` (520 lines)

**Problem:** Three rewrite attempts in 2 days (v4 → v5 → v6), increasing complexity

**Evidence:**
- v4 (200 lines): Aggressive stripping (broke CJK/symbols) → Oct 16
- v5 (300 lines): "Safe" version (kept old issues) → Oct 18
- v6 (520 lines): Unified Policy with Stage A+B (current) → Oct 18

**Hypothesis:** Over-sanitization removes chars that PDF engine needs, OR grapheme reordering breaks shaping

**Fix Strategy:**
```
Create v7 (minimal):
  1. NFC normalization ONLY (line 193)
  2. Remove BANNED_CHARS list (lines 48-68) - keep only ZWSP, ZWNJ, ZWJ
  3. SKIP Stage B entirely (lines 317-333) - database text already correct
  4. Test: If Thai rendering improves → Stage B was the culprit
```

---

## CRITICALITY ASSESSMENT

### CRITICAL (Must Verify Before Any Fix)

**Q1: Does @react-pdf/renderer support Thai shaping?**
- Impact: If NO → all other fixes irrelevant, need library change
- Test: Minimal PDF with "กิ่ง", inspect glyph positions
- If shaping broken → STOP, evaluate alternatives (puppeteer, wkhtml to pdf, LaTeX)

### HIGH PRIORITY (Directly Cause Symptoms)

**RC-A:** Font registration fallback mode (S3, S4, S5)  
**RC-B:** Font selector assumes availability (S3, S4, S5)  
**RC-C:** Line height too low (S1)  

### MEDIUM PRIORITY (Contributing Factors)

**RC-2.1:** Symbols font not registered (S2)  
**RC-5.2:** Emoji font selection logic (S5)  
**RC-D:** Font subsetting (S1)  

### LOW PRIORITY (Defensive Improvements)

**RC-3:** SHA-256 verification (all symptoms, preventive)  
**RC-E:** Sanitizer simplification (S1 edge cases, S6)  

---

## FIX SEQUENCE (Recommended Order)

### Phase 1: Validation (0-2 hours)
1. ✅ Verify font file integrity (SHA-256)
2. ✅ Test minimal Thai shaping (Q1 above)
3. ✅ Reproduce PDF generation, capture logs

### Phase 2: Quick Wins (2-4 hours)
1. Fix RC-C: Increase lineHeight to 1.65, padding to 3px (`pdfStyles.ts`)
2. Fix RC-B: Add font availability check in selector (`pdfFontSelector.ts`)
3. Fix RC-2.1: Force NotoSansSymbols registration (`pdfFontsMultilingual.ts`)

### Phase 3: Deep Fixes (4-8 hours)
1. Fix RC-A: Improve fallback mode logic (`pdfFontsMultilingual.ts`)
2. Fix RC-D: Verify subset:false working, implement workaround if not
3. Fix RC-E: Simplify sanitizer to v7 (minimal)

### Phase 4: Verification (2-4 hours)
1. Re-generate PDF from Oct 18 snapshot
2. Compare BEFORE/AFTER for all 20 items
3. Run font stress test (/api/weekly/pdf/font-qa-final)
4. Document results in VERIFICATION_REPORT.md

**Total Estimated Time:** 8-18 hours

---

## ROLLBACK PLAN

**If Fixes Cause Regressions:**

1. **Revert pdfStyles.ts:** Change lineHeight back to 1.4, padding to 1px
2. **Revert pdfFontSelector.ts:** Remove availability check (accept tofu boxes for missing fonts)
3. **Revert pdfFontsMultilingual.ts:** Accept fallback mode (Thai-only)
4. **Revert sanitizer:** Use v6 (current) or v5 (previous stable)

**Rollback Complexity:** LOW (all changes in 3-4 files, git revert easy)

---

**End of Root Cause Analysis Matrix**

