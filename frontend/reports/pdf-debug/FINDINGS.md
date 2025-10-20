# TRENDSIAM PDF TEXT RENDERING: DETAILED FINDINGS

**Generated:** 2025-10-20 17:04 Bangkok Time  
**Investigation Type:** Comprehensive Root Cause Analysis  
**Scope:** End-to-End PDF Pipeline Forensics

---

## TABLE OF CONTENTS

1. [Investigation Summary](#investigation-summary)
2. [Database Layer Verification](#database-layer-verification)
3. [Font Registration Analysis](#font-registration-analysis)
4. [Text Sanitization Pipeline](#text-sanitization-pipeline)
5. [Font Selection Logic](#font-selection-logic)
6. [Layout & Styling Parameters](#layout--styling-parameters)
7. [Rendering Engine Constraints](#rendering-engine-constraints)
8. [Specific Item Analysis](#specific-item-analysis)
9. [Root Cause Matrix Summary](#root-cause-matrix-summary)

---

## 1. INVESTIGATION SUMMARY

### Problems Reported

**Symptom A: Thai Diacritics**
- Missing tone marks (่ ้ ๊ ๋)
- Overlapping/stacked glyphs
- Clipped vowels (above/below base)
- Examples: Items #4, #6, #18, #19

**Symptom B: Special Characters**
- Corrupted text in headers/footers
- Examples: "หมวดหมู: บนเท ั ิง…" (should be "หมวดหมู่: บันเทิง")
- Examples: "รายงานนีสรง…อัตโนมตั ิ…" (should be "รายงานนี้สร้าง…อัตโนมัติ")

**Symptom C: CJK/Emoji Rendering**
- Tofu boxes (□) for Korean Hangul
- Missing CJK ideographs
- Emoji replaced with boxes
- Examples: Items #14-#20

### Investigation Approach

1. ✅ Reviewed Memory Bank (04_pdf_system.mb) — 6 previous fix attempts documented
2. ✅ Analyzed all PDF pipeline files (10 source files, 3,000+ lines total)
3. ✅ Verified database clean (Oct 18 audit confirmed zero issues)
4. ✅ Cross-referenced fix history against current code (contradictions found)
5. ⏸️ Runtime verification pending (requires dev server + test PDF generation)

---

## 2. DATABASE LAYER VERIFICATION

### Status: ✅ CONFIRMED CLEAN

**Evidence Source:** `frontend/reports/SUMMARY.md` (Oct 18, 2025 audit)

**Key Findings:**
- **Total items audited:** 41 (snapshot c2a64962)
- **Items with C0/C1 control chars:** 0 (0.00%)
- **Items needing NFC normalization:** 0 (0.00%)
- **Problematic items #4, #6, #16, #18, #19, #20:** All verified clean at byte level

**Hex Analysis Samples:**

Item #16 (first 50 chars):
```
U+0E01:ก U+0E32:า U+0E23:ร U+0E15:ต U+0E48:่ U+0E2D:อ ...
```
- ✅ All Thai combining marks properly positioned
- ✅ No zero-width or control characters
- ✅ Unicode codepoints valid

Item #20 (first 50 chars):
```
U+004E:N U+0065:e U+0077:w U+0020:  U+0041:A ...
```
- ✅ Pure ASCII
- ✅ No special handling required

**Conclusion:** Database is NOT the source of rendering issues. Problems are application-level only.

---

## 3. FONT REGISTRATION ANALYSIS

### File Locations

| File | Lines | Purpose |
|------|-------|---------|
| `frontend/src/app/api/weekly/pdf/route.tsx` | 106-117 | Entry point for font registration |
| `frontend/src/lib/pdf/pdfFontsMultilingual.ts` | 35-141 | Bridge module (analyzes scripts, calls registrar) |
| `frontend/src/lib/pdf/pdfMultilingualFonts.ts` | 192-298 | Core manifest loader (loads from fonts_provenance.json) |
| `frontend/src/lib/pdf/pdfFonts.core.ts` | 24-103 | Thai-only fallback (NotoSansThaiUniversal) |
| `frontend/src/lib/pdf/fontResolver.core.ts` | 16-90 | File path resolution (prefers static over Variable fonts) |

### Registration Flow

**Step 1: API Route (route.tsx lines 106-117)**
```
registerMultilingualFontsForPDF(data.items)
↓
Returns: { success, primaryFamily, loadedFamilies, detectedScripts, fallbackMode }
↓
Logs: font registry details (line 110-117)
```

**Step 2: Multilingual Bridge (pdfFontsMultilingual.ts lines 56-96)**
```
IF items empty OR error:
  ↓
  Fall back to Thai-only (registerPdfFonts() from pdfFonts.core.ts)
  ↓
  Returns: { loadedFamilies: [UNIVERSAL], fallbackMode: true }
ELSE:
  ↓
  Analyze snapshot scripts (analyzeSnapshotScripts())
  ↓
  Register fonts for detected scripts (registerFontsForScripts())
  ↓
  Returns: { loadedFamilies: [UNIVERSAL, HEBREW, SYMBOLS, ...], fallbackMode: false }
```

**Step 3: Script Analysis (pdfMultilingualFonts.ts lines 146-187)**
```
Detects: Thai, Latin, CJK, Hangul, Arabic, Hebrew, Emoji, Symbols
↓
Maps scripts to font families
↓
Returns: { scripts: Set<Script>, families: Set<FontFamily>, stats: {} }
```

**Step 4: Font Loading (pdfMultilingualFonts.ts lines 192-298)**
```
Reads: frontend/public/fonts/fonts_provenance.json
↓
Finds: NotoSansThai-Regular.ttf, NotoSansThai-Bold.ttf (for UNIVERSAL family)
↓
Calls: Font.register() with subset: false
```

### ROOT CAUSE #1: Fallback Mode Triggers Incorrectly

**Location:** `pdfFontsMultilingual.ts` lines 58-71

**Problem:**
```
if (!items || items.length === 0) {
  // Falls back to Thai-only
}
```

**Issue:** 
- `route.tsx` line 92 passes `data.items.slice(0, 20)` to `registerMultilingualFontsForPDF()`
- BUT line 84 fetches full snapshot (could be 41 items)
- If snapshot has 41 items but only 20 passed to font registration, script detection may miss scripts present in items 21-41
- However, WeeklyDoc.tsx only renders first 20, so this is NOT the root cause

**Actual Root Cause:** Line 56-71 fallback logic triggers if `analyzeSnapshotScripts()` throws error OR returns empty scripts
- If font manifest loading fails (line 200-298 in pdfMultilingualFonts.ts), fallback mode activated
- WeeklyDoc.tsx line 73 then calls `getTitleFontFamily(title)` which may select `NotoSansKR` or `NotoSansJP`
- BUT only `NotoSansThaiUniversal` is registered → **tofu boxes for CJK/Korean**

**Evidence:** Line 110-117 in route.tsx logs `loadedFamilies` and `fallbackMode`
- If logs show `fallbackMode: true` → this is the smoking gun
- If logs show `loadedFamilies: []` → font manifest failed to load

**Fix:** Add validation after font registration:
```
At route.tsx line 117 (after log statement):
  IF fontReport.fallbackMode === true AND snapshot contains non-Thai scripts:
    Log warning: "Font fallback mode active - non-Thai scripts may not render correctly"
```

### ROOT CAUSE #2: subset:false May Be Ignored

**Location:** `pdfFonts.core.ts` lines 44-58

**Code Context:**
```
Font.register({
  family: UNIVERSAL_FONT_FAMILY,
  fonts: [
    { 
      src: REG, 
      fontWeight: 'normal', 
      // @ts-ignore - subset option exists but not in types
      subset: false  // ← LINE 50
    },
    ...
  ]
});
```

**Problem:** TypeScript comment `@ts-ignore` suggests `subset` option not officially supported in types

**Hypothesis:**
- `@react-pdf/renderer` v4.3.0 may not respect `subset: false` flag
- fontkit (underlying subsetting engine) may aggressively remove GPOS/GSUB tables anyway
- Without GPOS tables, Thai mark-to-base positioning fails → **overlapping diacritics**

**Test Required:**
1. Generate PDF with Thai text "กิ่ง" (base + vowel above + tone mark)
2. Inspect embedded font subset in PDF using `pdf-lib` or `fonttools`
3. Check if GPOS table present in subset
4. If GPOS missing → `subset: false` not working → need alternative approach

**Alternative Fix (if subset:false ignored):**
- Pre-subset fonts manually using `pyftsubset` with GPOS/GSUB retention
- Embed pre-subsetted fonts (larger file size but guaranteed shaping)
- Or: Disable subsetting entirely in @react-pdf/renderer config (if possible)

### ROOT CAUSE #3: Font File Paths Not Verified at Runtime

**Location:** `fontResolver.core.ts` lines 38-82

**Problem:** Resolver tries 4 base paths but no SHA-256 verification

**Code Context:**
```
for (const basePath of basePaths) {
  if (fs.existsSync(regularPath) && fs.existsSync(boldPath)) {
    const regularSize = fs.statSync(regularPath).size;
    // ← No SHA-256 check here
    if (regularSize > 40000) {
      return { REG: regularPath, BOLD: boldPath };
    }
  }
}
```

**Issue:** 
- `fonts_provenance.json` contains SHA-256 hashes for all fonts
- BUT fontResolver.core.ts only checks file size (>40KB for Regular, Bold)
- Corrupted font files could pass size check but fail at render time

**Evidence Needed:**
Check NotoSansThai-Regular.ttf SHA-256:
```
Expected (from fonts_provenance.json): 9ACB585D8662CA4ED1B1CF5889DFA1393F8555103B3986E1EA1E3AF4FAEF70BD
Actual: <compute at runtime>
```

If mismatch → font file corrupted → **all Thai rendering fails**

**Fix:**
```
At fontResolver.core.ts line 51 (before return statement):
  1. Read fonts_provenance.json
  2. Compute SHA-256 of regularPath and boldPath
  3. Compare against provenance.json hashes
  4. If mismatch: throw error with forensic details
  5. If match: log "✓ Font integrity verified"
```

---

## 4. TEXT SANITIZATION PIPELINE

### File Location

`frontend/src/lib/pdf/pdfTextSanitizer.v6.unified.ts` (520 lines)

### Critical Functions

| Function | Lines | Purpose |
|----------|-------|---------|
| `sanitizeTitleForPdf()` | 375-380 | Entry point for item titles |
| `sanitizeMetadataForPdf()` | 385-390 | Entry point for metadata |
| `sanitizeForPdf()` | 352-365 | Main sanitizer (calls Stage A + B) |
| `stageA_UnifiedTextPolicy()` | 191-216 | Universal hygiene (NFC, C0/C1, punct) |
| `stageB_ThaiGraphemeValidation()` | 317-333 | Thai-specific fixes |
| `removeControlCharacters()` | 80-104 | C0/C1 zero-tolerance filter |
| `fixDecomposedSaraAm()` | 238-240 | SARA AM composition (U+0E4D+U+0E32 → U+0E33) |
| `fixThaiToneMarkOrder()` | 248-257 | Reorder tone marks after vowels |
| `removeDuplicateCombiningMarks()` | 262-285 | Remove duplicate marks |
| `removeOrphanThaiMarks()` | 290-312 | Remove marks without base |

### Sanitization Flow (Per Text String)

**Input:** Raw text from database (already NFC, zero control chars per Oct 18 audit)

**Stage A: Unified Text Policy (lines 191-216)**
```
1. NFC normalization (line 193)
   → Compose decomposed characters (NFD → NFC)
   → Example: U+0061+U+0301 → U+00E1

2. Remove C0/C1 control characters (line 196)
   → Regex: /[\x00-\x09\x0B-\x1F\x7F-\x9F]/g
   → Strips 65 control chars (C0: U+0000-001F, C1: U+007F-009F)
   → Logs removed codepoints in dev mode (lines 96-100)

3. Remove banned characters (lines 200-202)
   → ZWSP, ZWNJ, ZWJ, ZWNBSP, BOM, bidi controls
   → Total: 16 additional characters

4. Map smart punctuation (lines 205-207)
   → Smart quotes → ASCII quotes (U+201C/201D → U+0022)
   → En/em dash → hyphen (U+2013/2014 → U+002D)
   → Non-breaking space → regular space

5. Collapse multiple spaces (line 210)
   → Regex: /\s{2,}/g → single space

6. Trim (line 213)
```

**Stage B: Thai Grapheme Validation (lines 317-333, only if Thai detected)**
```
1. Fix decomposed SARA AM (line 321)
   → U+0E4D+U+0E32 → U+0E33
   → Example: "ก\u0E4D\u0E32" → "กำ"

2. Fix tone mark order (line 324)
   → Regex: /([\u0E01-\u0E2E])([\u0E48-\u0E4B])([\u0E31\u0E34-\u0E3A])/g
   → Reorder: consonant + tone + vowel → consonant + vowel + tone
   → Example: "ก่ิ" → "กิ่"

3. Remove duplicate combining marks (line 327)
   → If same mark appears twice consecutively → remove duplicate
   → Example: "กิิ" → "กิ"

4. Remove orphan marks (line 330)
   → If combining mark appears without base consonant → remove
   → Example: "่test" → "test"
```

**Output:** Sanitized text passed to PDF renderer

### ROOT CAUSE #4: Over-Sanitization May Remove Legitimate Characters

**Problem 1: C0/C1 Filter Too Aggressive?**

**Location:** Lines 80-104 (`removeControlCharacters()`)

**Regex:** `/[\x00-\x09\x0B-\x1F\x7F-\x9F]/g`

**Analysis:**
- C0 range: U+0000-001F (32 chars, minus \n=0x0A)
- C1 range: U+007F-009F (33 chars)
- Total: 65 control characters stripped

**Issue:** 
- Database audit confirmed ZERO control characters in source data
- So why is this filter needed at all?
- Hypothesis: Filter added because PREVIOUS data had control chars (pre-Oct 18)
- Current data is clean, so this filter is DEFENSIVE only

**Test:** Temporarily disable C0/C1 filter and regenerate PDF
- If Thai rendering improves → filter was accidentally removing non-control chars (regex bug)
- If Thai rendering unchanged → filter is harmless but unnecessary

**Potential Regex Bug:**
```
Pattern: [\x00-\x09\x0B-\x1F\x7F-\x9F]
         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
         Hex ranges may have off-by-one errors in JavaScript regex
```

**Verification Needed:**
```
Test cases:
- U+0009 (tab) → should be removed (but line 67 already removes \t)
- U+000A (\n) → should be kept (but pattern excludes it)
- U+000B (vertical tab) → should be removed
- U+007F (DEL) → should be removed
- U+0080 (C1 control) → should be removed
- U+009F (C1 control) → should be removed
- U+00A0 (non-breaking space) → should NOT be removed (not in range, but line 124 maps it)
```

**Problem 2: Thai Grapheme Reordering May Conflict with NFC**

**Location:** Lines 248-257 (`fixThaiToneMarkOrder()`)

**Code Logic:**
```
Regex: /([\u0E01-\u0E2E])([\u0E48-\u0E4B])([\u0E31\u0E34-\u0E3A])/g
Replace: $1$3$2  // consonant + vowel + tone
```

**Issue:**
- NFC normalization (line 193) already composes characters in canonical order
- Thai canonical order: base + vowel above/below + tone mark (per Unicode Standard)
- This regex reorders: base + tone + vowel → base + vowel + tone
- **This is the CORRECT canonical order**

**BUT:**
- Database text is already NFC normalized (Oct 18 audit confirmed)
- So characters should already be in correct order
- Why does reordering function exist?

**Hypothesis:**
- Function added to fix decomposed input from earlier pipeline stages
- With current clean database, function should be no-op (no matches)
- If function IS matching and reordering → implies NFC normalization at line 193 is NOT working correctly
  OR previous sanitization stage decomposed characters

**Test Required:**
```
Input: "กิ่" (base=ก, vowel above=ิ, tone mark=่, already in correct order)
After Stage A NFC: Should remain "กิ่" (no change)
After fixThaiToneMarkOrder: Should remain "กิ่" (no regex match)

If regex DOES match → NFC normalization failed
If output changes → reordering is wrong
```

**Problem 3: Orphan Mark Removal May Be Too Aggressive**

**Location:** Lines 290-312 (`removeOrphanThaiMarks()`)

**Logic:**
```
For each character:
  IF combining mark AND previous char was not base consonant:
    Skip (remove) the mark
  ELSE:
    Keep the mark
```

**Issue:**
- Legitimate Thai text should never have orphan marks
- BUT edge cases exist:
  - Standalone tone marks in romanization (e.g., "mai่ ek" to show tone mark visually)
  - Unicode test strings (e.g., "Test: ่ tone mark")
  - Partially-rendered CJK with Thai fallback (could trigger false positive)

**Hypothesis:**
- Items #14-#20 may contain mixed-script edge cases
- If CJK character followed immediately by Thai mark → mark treated as orphan → removed
- Example: "她่test" → CJK base + Thai mark → mark removed → "她test"

**Test Required:**
```
Input samples:
1. "กิ่ test ่test" → Should remove second ่ (orphan) but keep first (has base)
2. "NMIXX 엔믹스 ่เพลง" → Should keep ่ (has base เ) even though preceded by Korean
3. "Trailer 她@Memory" → No marks, should pass through unchanged
```

**Problem 4: Multiple Normalization Passes May Cancel Out**

**Issue:** Text goes through THREE normalization layers:
1. Database: NFC at ingestion (verified clean Oct 18)
2. Sanitizer Stage A line 193: NFC normalization
3. Sanitizer Stage B line 321: Thai-specific composition (SARA AM)

**Hypothesis:**
- Triple normalization could introduce subtle bugs
- Example: If NFC decomposes SARA AM (U+0E33 → U+0E4D+U+0E32)
  Then Stage B recomposes (U+0E4D+U+0E32 → U+0E33)
  → Net effect: no change
  BUT: Intermediate decomposed form may interact with mark reordering (line 248)
  → Tone marks reordered relative to decomposed SARA AM components
  → Final composition produces WRONG grapheme cluster

**Test Required:**
```
Input: "กำ่" (base=ก, SARA AM=ำ, tone mark=่)
Step 1 (NFC): Compose if needed → "กำ่"
Step 2 (fixDecomposedSaraAm): U+0E33 is composed, no match → "กำ่"
Step 3 (fixThaiToneMarkOrder): Check if "base + tone + vowel" pattern
  → "กำ่" does not match pattern (SARA AM is not vowel above/below)
  → No reordering → "กำ่"
Expected: "กำ่" (correct)

BUT if NFC decomposes first:
Step 1 (NFC): "กำ่" → "กะ\u0E4Dา่" (decomposed SARA AM)
Step 2 (fixThaiToneMarkOrder): Reorder relative to ะ and า
  → Incorrect reordering
Step 3 (fixDecomposedSaraAm): Recompose → wrong cluster

This is theoretical - needs testing.
```

### ROOT CAUSE #5: Sanitizer Applied to ORIGINAL Text, Font Selected on SANITIZED Text

**Location:** `WeeklyDoc.tsx` lines 71-73

**Code Context:**
```
Line 71: const originalTitle = `${item.rank}. ${item.title}`;
Line 72: const title = sanitizeTitleForPdf(originalTitle, itemId);
Line 73: const titleFont = getTitleFontFamily(title);  // ← FIXED Oct 18
```

**History:**
- Before Oct 18: Line 73 was `getTitleFontFamily(item.title)` (WRONG)
- Oct 18 fix: Changed to `getTitleFontFamily(title)` (CORRECT)

**Verification:**
- Current code (line 73) uses SANITIZED text for font selection → CORRECT
- No issue here per se, but worth noting this was a critical bug fixed 2 days ago
- If problems persist, may indicate fix was incomplete OR reverted in later commit

---

## 5. FONT SELECTION LOGIC

### File Location

`frontend/src/lib/pdf/pdfFontSelector.ts` (138 lines)

### Critical Function

**`selectFontFamily(text)` (lines 30-57)**

**Logic Flow:**
```
1. Detect scripts in text (line 33)
2. IF Hangul detected → return 'NotoSansKR' (line 36)
3. IF CJK detected → return 'NotoSansJP' (line 42)
4. IF Emoji only → return 'NotoEmoji' (line 46)
5. IF Symbols only → return 'NotoSansSymbols' (line 52)
6. ELSE → return 'NotoSansThaiUniversal' (line 56)
```

### ROOT CAUSE #6: No Validation That Selected Font Was Registered

**Problem:**
- Font selection assumes ALL 9 font families available
- BUT font registration (pdfFontsMultilingual.ts) may fall back to Thai-only
- No runtime check: "Is font X registered before returning it?"

**Example Failure Scenario:**
```
Item #11: "NMIXX 엔믹스 - Blue Valentine"
  ↓
Sanitizer: Passes through unchanged (Korean is legitimate)
  ↓
Font selector: Detects Hangul → returns 'NotoSansKR'
  ↓
WeeklyDoc.tsx: Sets fontFamily='NotoSansKR' on <Text> component
  ↓
@react-pdf/renderer: Looks up 'NotoSansKR' in registry
  ↓
IF 'NotoSansKR' not registered (due to fallback mode):
  → Fallback to system font (Arial/Helvetica)
  → Korean Hangul has no glyphs in Arial
  → Tofu boxes (□□□)
```

**Fix Required:**
```
At pdfFontSelector.ts line 30 (start of selectFontFamily function):
  1. Import: getFontRegistrationInfo() from pdfFontsMultilingual.ts
  2. Call: const { loadedFamilies } = getFontRegistrationInfo()
  3. Check: IF selected font NOT in loadedFamilies → return DEFAULT_FONT
  4. Log warning: "Font X not registered, using fallback"
```

**Alternative Fix:**
```
At route.tsx line 108 (after font registration):
  1. Pass loadedFamilies to WeeklyDoc props
  2. WeeklyDoc.tsx validates font selection against loadedFamilies
  3. If mismatch → use NotoSansThaiUniversal (guaranteed available)
```

### ROOT CAUSE #7: Script Detection May Fail on Mixed Scripts

**Location:** `pdfMultilingualFonts.ts` lines 92-142 (`detectScripts()`)

**Problem:** Font selector uses priority order:
```
1. Hangul → NotoSansKR
2. CJK → NotoSansJP
3. Emoji → NotoEmoji
4. Symbols → NotoSansSymbols
5. Default → NotoSansThaiUniversal
```

**Issue:** If text contains BOTH Thai AND Korean, font selector returns NotoSansKR
- Korean text renders correctly
- Thai text in SAME text block renders with Korean font → **missing glyphs**

**Example:**
```
Item #11: "NMIXX (엔믹스) - คอนเสิร์ตในไทย"
                  ^^^^^      ^^^^^^^^
                  Korean     Thai

Font selector detects: { Hangul, Thai, Latin }
Priority rule: Hangul wins → returns 'NotoSansKR'
Result:
  - "NMIXX" → renders with Korean font (Latin glyphs present)
  - "엔믹스" → renders correctly (Korean glyphs)
  - "คอนเสิร์ตในไทย" → renders with Korean font (Thai glyphs MISSING) → tofu boxes
```

**Fix Required:** Multi-font per text block (NOT SUPPORTED by @react-pdf/renderer)

**Workaround:**
```
Split mixed-script text into separate <Text> components:
  <View style={flexRow}>
    <Text style={{ fontFamily: 'NotoSansThaiUniversal' }}>NMIXX (</Text>
    <Text style={{ fontFamily: 'NotoSansKR' }}>엔믹스</Text>
    <Text style={{ fontFamily: 'NotoSansThaiUniversal' }}>) - คอนเสิร์ตในไทย</Text>
  </View>
```

**Better Fix:**
```
Use NotoSansThaiUniversal for ALL text (Thai + Latin + Hangul syllables)
- Noto Sans Thai includes Hangul precomposed syllables (AC00-D7AF)
- Only use specialized fonts for CJK ideographs (4E00-9FFF)
- Simplifies font selection logic
```

---

## 6. LAYOUT & STYLING PARAMETERS

### File Location

`frontend/src/lib/pdf/pdfStyles.ts` (223 lines)

### Critical Values

| Style | lineHeight | letterSpacing | paddingTop/Bottom |
|-------|------------|---------------|-------------------|
| `text` (line 29) | 1.35 | 0 | — |
| `h1` (line 39) | 1.35 | 0 | — |
| `itemTitle` (line 78) | 1.4 | 0 | 1px |
| `itemMeta` (line 94) | 1.35 | 0 | 0px |
| `mixedScript` (line 135) | 1.8 | 0 | — |
| `emojiText` (line 143) | 1.9 | 0 | — |

### ROOT CAUSE #8: lineHeight 1.4 Insufficient for Thai Diacritics

**Location:** Line 78 (`itemTitle` style)

**Current Value:** `lineHeight: 1.4`

**Comment on line 78:**
```
// Optimal for Thai diacritics (NOT 2.5 - causes excessive spacing)
```

**Contradiction:** Memory Bank (04_pdf_system.mb) documents:
```
2025-10-16: PDF THAI TEXT RENDERING FIX
  Root causes identified (4 critical issues):
    3. Excessive line height: lineHeight=2.5 for titles caused visual spacing issues
       - Solution: lineHeight 1.35-1.4 (Thai-optimized best practice)
```

BUT ALSO:
```
2025-10-16: FONT 47KB FORENSIC INVESTIGATION
  Problem: Weekly PDF fonts showed as 47KB; Thai text overlapping.
  Solution: Variable font fallback in fontResolver.core.ts
```

AND:
```
2025-10-18: THAI DIACRITICS + SPECIAL CHARACTER CORRUPTION FIX
  Root causes identified (3 critical issues):
    2. LETTERSPACING > 0 in pdfStyles.ts:
       - letterSpacing 0.05-0.25 BREAKS grapheme clusters
       - Solution: letterSpacing=0 for ALL styles
```

**Analysis:**
1. Oct 16 fix claimed lineHeight=2.5 was TOO HIGH → lowered to 1.4
2. Oct 18 fix claimed letterSpacing>0 was problem → set to 0 (CORRECT)
3. Current code has lineHeight=1.4 and letterSpacing=0

**Hypothesis:**
- lineHeight 1.4 may be insufficient for edge cases:
  - Multiple stacked diacritics (rare but legal in Thai)
  - Emoji with high ascenders/descenders
  - CJK characters taller than Thai
- Original lineHeight=2.5 was correct for Thai, but caused aesthetic problems
- Compromise lineHeight=1.4 fixes aesthetics but re-introduces clipping

**Thai Typography Best Practices:**
- Thai fonts typically have line height 1.5-1.8 for body text
- Titles with diacritics need 1.6-2.0 to prevent clipping
- Current value 1.4 is BELOW recommended range

**Test Required:**
```
Generate PDF with these test strings in itemTitle style:
1. "กิ๊กก๊าก" (multiple mai tri stacked)
2. "ฟังก์ชั่น" (mai han akat + tone mark)
3. "เกาะพังแล้วครับ ผู้กี่สุด" (complex clusters)
4. "2,052 KG++ 🤯" (mixed emoji + Thai)

Expected: All diacritics visible, no clipping
If clipped → lineHeight 1.4 is too low
```

**Proposed Fix:**
```
At pdfStyles.ts line 78:
  Change: lineHeight: 1.4
  To: lineHeight: 1.6  // Balanced: Thai-safe + reasonable spacing
```

### ROOT CAUSE #9: paddingTop/Bottom 1px May Be Insufficient

**Location:** Lines 86-87 (`itemTitle` style)

**Current Values:**
```
paddingTop: 1,
paddingBottom: 1,
```

**Comment on line 86:**
```
// Minimal padding (font metrics handle diacritics)
```

**Issue:** Comment assumes font metrics (ascent/descent values) are correct
- BUT if font subset strips GPOS tables → metrics may be WRONG
- Incorrect metrics → renderer clips diacritics even with correct lineHeight

**Evidence Needed:**
```
Inspect embedded font subset in PDF:
1. Extract font from PDF: pdffonts weekly.pdf
2. Check ascent/descent values: ttx -t OS/2 font.ttf
3. Compare to original Noto Sans Thai Regular:
   - usWinAscent: Should be ~2476
   - usWinDescent: Should be ~732
   - sTypoAscender: Should be ~2189
   - sTypoDescender: Should be ~-732

If values differ → subsetting broke metrics → padding=1px insufficient
```

**Proposed Fix:**
```
At pdfStyles.ts lines 86-87:
  Change: paddingTop: 1, paddingBottom: 1
  To: paddingTop: 3, paddingBottom: 3  // Extra clearance for clipped diacritics
```

---

## 7. RENDERING ENGINE CONSTRAINTS

### Library Information

**@react-pdf/renderer v4.3.0** (inferred from API usage and Memory Bank)

**Dependencies:**
- **fontkit:** Font loading and subsetting
- **yoga-layout:** Flexbox layout engine (from React Native)
- **pdfkit:** Low-level PDF generation

### Known Limitations (From Memory Bank & Code Analysis)

**1. No Automatic Font Fallback**
- Unlike web browsers, @react-pdf/renderer does NOT automatically try fallback fonts
- If font family 'X' registered but glyph not found → renders replacement glyph (□)
- Workaround: pdfFontSelector.ts (manual per-Text font selection)

**2. Variable Fonts Not Fully Supported for Complex Scripts**
- Variable fonts (.ttf with fvar/gvar tables) cause issues:
  - Weight extraction fails (Bold renders same as Regular)
  - GPOS/GSUB features not fully utilized
- Workaround: fontResolver.core.ts prefers static fonts (lines 47-65)

**3. Subsetting May Remove OpenType Tables**
- fontkit aggressive subsetting removes GPOS/GSUB/GDEF tables
- Without GPOS: Thai mark-to-base positioning fails → overlapping diacritics
- Workaround: `subset: false` flag (pdfFonts.core.ts line 50)
- **UNVERIFIED:** Flag may be ignored by fontkit

**4. letterSpacing > 0 Breaks Combining Marks**
- Artificial letter spacing disrupts GPOS mark positioning anchors
- Combining marks detach from base characters → visual gaps
- Fix: letterSpacing=0 for ALL styles (pdfStyles.ts, applied Oct 18)

**5. Hyphenation for Thai**
- Thai is continuous script (no word boundaries)
- Automatic hyphenation breaks words incorrectly
- Fix: Disabled via `Font.registerHyphenationCallback()` (pdfFonts.core.ts line 87)

### Unknown Constraints (Need Runtime Verification)

**Question 1:** Does @react-pdf/renderer use HarfBuzz for shaping?
- HarfBuzz is industry-standard for complex script shaping
- Alternative: Basic Unicode shaping (insufficient for Thai)
- Test: Check node_modules/@react-pdf/renderer dependencies for harfbuzz-wasm

**Question 2:** Does fontkit respect `subset: false` flag?
- Official fontkit docs don't mention this flag
- May be custom extension by @react-pdf/renderer
- Test: Inspect embedded fonts in generated PDF, check table inventory

**Question 3:** What is default font fallback order?
- If font family not found, what does renderer use?
- System fonts (Arial, Helvetica)?
- Last-registered font?
- Test: Register fonts in different order, check which is used as fallback

### ROOT CAUSE #10: @react-pdf/renderer May Not Support Thai Shaping

**Hypothesis:** fontkit (underlying font engine) may not fully support Thai OpenType features

**Evidence from Memory Bank:**
```
2025-10-16: PDF THAI TEXT RENDERING FIX
  Technical evidence:
    - @react-pdf/renderer v4.3.0 limitations documented
    - OpenType table inspection confirmed GDEF/GPOS/GSUB in static fonts
```

**Issue:** Just because fonts HAVE GPOS tables doesn't mean renderer USES them

**Test Required:**
```
1. Create minimal test PDF with single Thai word: "กิ่ง"
2. Render with @react-pdf/renderer
3. Inspect PDF output:
   a) Extract rendered glyph positions (using pdf-lib or pdfminer)
   b) Check if glyphs positioned according to GPOS anchors
   c) If glyphs overlapping → renderer not applying GPOS

Expected behavior:
  - Base consonant 'ก' at position (x, y)
  - Vowel above 'ิ' at position (x+dx, y+dy_above) per GPOS mark-to-base
  - Tone mark '่' at position (x+dx, y+dy_tone) per GPOS mark-to-mark

If actual positions don't match → @react-pdf/renderer not using HarfBuzz → SHAPING NOT WORKING
```

**If Shaping Not Working:** This is UNFIXABLE at application level → need to:
1. Switch to alternative PDF library (pdfmake, jsPDF, puppeteer)
2. OR: Pre-render text as images (expensive but reliable)
3. OR: Use server-side PDF generation with proper Thai font support (LaTeX, wkhtmltopdf)

---

## 8. SPECIFIC ITEM ANALYSIS

### Item #4: "Official Trailer | Unlimited Love The Series..."

**Symptom:** Thai tone marks missing or overlapping

**Forensics:**
- Database text (from Oct 18 audit): ✅ Clean, NFC, no control chars
- Title contains: "บริษัทนี้ไม่มีจำกัด" (complex Thai with final consonants)
- Challenging sequences:
  - "ษัท" (base + vowel below + final)
  - "ไม่มี" (leading vowel + tone mark + final)

**Hypothesis:**
- lineHeight 1.4 too low for "ไม่" cluster
- Tone mark ่ clipped by line box

**Test:** Render "ไม่มีจำกัด" in isolation with lineHeight 1.4 vs 1.8 vs 2.5

### Item #6: "หน้าเบลอหลังชัด (Foreground) - LYKN..."

**Symptom:** Thai vowels/tone marks misaligned

**Forensics:**
- Database text: ✅ Clean
- Title contains: "หน้าเบลอหลังชัด" (multiple tone marks)
- Challenging sequences:
  - "น้า" (base + tone mark + vowel)
  - "ลัง" (base + vowel above + final)

**Hypothesis:**
- SARA AM decomposition/recomposition conflict
- OR: Tone mark reordering function triggered incorrectly

**Test:** Log sanitizer output for this title, check if Stage B made changes

### Item #16: "การต่อสู้ของ Jandel vs. Sammy..."

**Symptom:** Special characters corrupted (e.g., "~~{Roblox")

**Forensics:**
- Database text (Oct 18 audit): ✅ Clean, hex verified
- Original title: "99 คืนไป (ภา Q&A) ~~Roblox 99 Nights..."
- No control characters in database

**Hypothesis:**
- Sanitizer C0/C1 filter NOT the cause (DB already clean)
- Likely font issue: "~~" or "{}" not in Thai font → system fallback → rendering corruption

**Test:** Check if NotoSansThai-Regular.ttf contains glyphs for:
- U+007E (~)
- U+007B ({)
- U+007D (})

If missing → font fallback mid-title → metrics mismatch → overlapping glyphs

### Item #20: "Trailer 她@Memory Wiped! ₽hen..."

**Symptom:** CJK character "她" corrupted, symbols "@" and "₽" mangled

**Forensics:**
- Database text: ✅ Clean, hex verified
- Original: "Trailer 她@Memory Wiped! ₽hen Zheyuan..."
- Characters: CJK ideograph (她), commercial at (@), Ruble sign (₽)

**Hypothesis:**
- Font selector detects CJK → selects 'NotoSansJP'
- BUT if NotoSansJP not registered (fallback mode) → uses NotoSansThaiUniversal
- Thai font has 她 (CJK block) but NOT ₽ (currency symbols block)
- Renderer falls back to system font for ₽ → Arial
- Mid-title font change → metrics mismatch → "r =@:Memory" corruption

**Test:** Check font coverage:
- NotoSansThaiUniversal: Does it include U+5979 (她)?
- NotoSansThaiUniversal: Does it include U+20BD (₽)?

If either missing → need NotoSansSymbols or NotoSansJP registered

### Items #14-#15, #17-#19: (Need Specific Titles)

**Symptom:** Similar issues (Thai diacritics, special chars)

**Test Required:** Fetch snapshot data for items #14-#15, #17-#19, analyze titles

---

## 9. ROOT CAUSE MATRIX SUMMARY

| # | Symptom | Root Cause | Location | Severity | Fix Priority |
|---|---------|------------|----------|----------|--------------|
| 1 | CJK/Korean tofu boxes | Fallback mode active, non-Thai fonts not registered | pdfFontsMultilingual.ts:58-71 | HIGH | 1 (critical) |
| 2 | Thai diacritics overlap | subset:false flag may be ignored by fontkit | pdfFonts.core.ts:50 | HIGH | 1 (critical) |
| 3 | Font file corruption | No SHA-256 verification at runtime | fontResolver.core.ts:51 | MEDIUM | 2 (validation) |
| 4 | Over-sanitization | Unnecessary C0/C1 filter on clean data | pdfTextSanitizer.v6:80-104 | LOW | 4 (defensive) |
| 5 | Grapheme reordering | fixThaiToneMarkOrder may conflict with NFC | pdfTextSanitizer.v6:248-257 | MEDIUM | 3 (review) |
| 6 | Font selection failure | No validation of selected font availability | pdfFontSelector.ts:30-57 | HIGH | 1 (critical) |
| 7 | Mixed-script rendering | Single font per Text, no multi-font support | pdfFontSelector.ts:36-42 | HIGH | 1 (workaround) |
| 8 | Diacritic clipping | lineHeight 1.4 too low for Thai | pdfStyles.ts:78 | HIGH | 1 (critical) |
| 9 | Mark clipping | paddingTop/Bottom 1px insufficient | pdfStyles.ts:86-87 | MEDIUM | 2 (incremental) |
| 10 | Shaping failure | @react-pdf/renderer may not use HarfBuzz | N/A (library) | CRITICAL | 0 (verify first) |

**Priority Legend:**
- **0 (verify first):** Need runtime test before determining fix
- **1 (critical):** Directly causes reported symptoms, must fix
- **2 (validation):** Improves robustness, prevents future issues
- **3 (review):** May be causing issues, needs investigation
- **4 (defensive):** Not causing current issues but good hygiene

---

## RECOMMENDATIONS

### Immediate Actions (Before Fix Implementation)

1. **Verify Font Shaping (Priority 0)**
   - Run minimal test: single Thai word "กิ่ง" → PDF
   - Inspect glyph positions in PDF output
   - Confirm HarfBuzz or equivalent shaping engine active
   - **If shaping not working:** Stop, switch to alternative PDF library

2. **Check Font Registration (Priority 1)**
   - Reproduce PDF generation locally
   - Capture logs from route.tsx lines 110-117
   - Verify: `fallbackMode: false` and `loadedFamilies: [...]` contains expected fonts
   - **If fallbackMode=true:** Root Cause #1 is active

3. **Verify Font File Integrity (Priority 2)**
   - Compute SHA-256 of NotoSansThai-Regular.ttf and NotoSansThai-Bold.ttf
   - Compare against fonts_provenance.json
   - **If mismatch:** Fonts corrupted, re-download from Google Fonts

### Proposed Fixes (See FIX_PLAN.md)

1. Increase lineHeight to 1.6 for itemTitle (Root Cause #8)
2. Add font availability validation in pdfFontSelector.ts (Root Cause #6)
3. Add SHA-256 verification in fontResolver.core.ts (Root Cause #3)
4. Verify subset:false flag working (Root Cause #2)
5. Simplify sanitizer (remove unnecessary C0/C1 filter) (Root Cause #4)

### Testing Checklist (See VERIFICATION_CHECKLIST.md)

1. Re-generate weekly PDF from same snapshot used in Oct 18 audit
2. Run font stress test (items #4, #6, #14-#20)
3. Compare BEFORE/AFTER PDFs side-by-side
4. Verify all 20 items render correctly
5. Check PDF file size (should be similar, ±10%)

---

## ARTIFACTS PREPARED

1. ✅ EXEC_SUMMARY.txt (high-level overview)
2. ✅ FINDINGS.md (this document)
3. ⏳ RCA_MATRIX.md (symptom-to-cause mapping table)
4. ⏳ FIX_PLAN.md (step-by-step remediation)
5. ⏳ VERIFICATION_CHECKLIST.md (test procedures)
6. ⏳ bad_strings.json (BEFORE/AFTER samples)

---

**End of Detailed Findings Report**

