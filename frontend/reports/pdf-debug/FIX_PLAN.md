# PDF TEXT RENDERING: STEP-BY-STEP FIX PLAN

**Generated:** 2025-10-20 17:04 Bangkok Time  
**Status:** Ready for Review & Approval  
**Estimated Total Time:** 8-18 hours  
**Risk Level:** Medium (requires careful testing at each step)

---

## PREREQUISITES

Before implementing ANY fixes:

### ✅ Pre-Flight Checks

1. **Backup Current State**
   - Create git branch: `git checkout -b fix/pdf-rendering-oct20`
   - Tag current state: `git tag pdf-rendering-baseline-oct20`
   - Backup fonts directory: Copy `frontend/public/fonts/` to `frontend/public/fonts.backup/`

2. **Verify Environment**
   - Node.js version: >=18.0.0 (for Blob API support)
   - Disk space: >500MB free (for PDF artifacts)
   - @react-pdf/renderer version: Check `frontend/package.json`, should be ~4.3.0

3. **Capture Baseline**
   - Generate current PDF: `curl http://localhost:3000/api/weekly/pdf > reports/pdf-debug/pdf_raw/baseline_before_fix.pdf`
   - Save logs: Capture console output from API route
   - Screenshot problematic items: Items #4, #6, #14-#20 in PDF viewer

---

## PHASE 1: CRITICAL VALIDATION (0-2 hours)

**Goal:** Determine if @react-pdf/renderer supports Thai shaping (Q1 from RCA_MATRIX.md)

### Step 1.1: Verify Font File Integrity

**Why:** Corrupted fonts cause unpredictable rendering failures

**Location:** `frontend/src/lib/pdf/fontResolver.core.ts`

**Changes Required:**
- **File:** `fontResolver.core.ts`
- **Function:** `resolveThaiFonts()` at line 16
- **Insert at:** Line 54 (after size check, before return statement)

**What to Change:**
```
CURRENT (line 54):
  console.log(`[fontResolver] ✓ Using static Thai fonts...`);
  return { REG: regularPath, BOLD: boldPath, base: basePath };

NEW (insert between log and return):
  // Verify font integrity via SHA-256
  const crypto = require('crypto');
  const expectedSHA = {
    regular: '9ACB585D8662CA4ED1B1CF5889DFA1393F8555103B3986E1EA1E3AF4FAEF70BD',
    bold: '0BE544F347B3AB6382BDC2B555A783727A4858A3DC140670406924670967D916'
  };
  
  const regularContent = fs.readFileSync(regularPath);
  const boldContent = fs.readFileSync(boldPath);
  const regularHash = crypto.createHash('sha256').update(regularContent).digest('hex').toUpperCase();
  const boldHash = crypto.createHash('sha256').update(boldContent).digest('hex').toUpperCase();
  
  if (regularHash !== expectedSHA.regular) {
    throw new Error(`Font integrity check FAILED: Regular font corrupted (${regularHash} != ${expectedSHA.regular})`);
  }
  if (boldHash !== expectedSHA.bold) {
    throw new Error(`Font integrity check FAILED: Bold font corrupted (${boldHash} != ${expectedSHA.bold})`);
  }
  
  console.log('[fontResolver] ✅ Font integrity verified (SHA-256 match)');
```

**Testing:**
- Run: `npm run dev`
- Trigger PDF generation: `curl http://localhost:3000/api/weekly/pdf`
- Check logs for: "✅ Font integrity verified" OR error message with hash mismatch
- **If error:** Download fresh fonts from Google Fonts, replace corrupted files

**Rollback:** Remove added SHA-256 check code

---

### Step 1.2: Test Minimal Thai Shaping

**Why:** If @react-pdf/renderer doesn't support Thai shaping, all other fixes are irrelevant

**Location:** Create new test route (do NOT modify existing files yet)

**New File:** `frontend/src/app/api/test-thai-shaping/route.tsx`

**What to Create:**
```
File Contents (describe structure, not full code):
  - Import: @react-pdf/renderer (Document, Page, Text, pdf, Font)
  - Register: Only NotoSansThaiUniversal (Regular + Bold)
  - Create: Minimal PDF with single text: "กิ่ง" (base + vowel above + tone mark)
  - Return: PDF buffer with proper headers
```

**Testing:**
1. Create route as described above
2. Run: `npm run dev`
3. Generate: `curl http://localhost:3000/api/test-thai-shaping > reports/pdf-debug/pdf_raw/thai_shaping_test.pdf`
4. Open PDF in viewer (Adobe Acrobat or PDF.js)
5. Inspect: "กิ่ง" should show three distinct visual elements:
   - Base consonant 'ก' (baseline)
   - Vowel above 'ิ' (above base, centered)
   - Tone mark '่' (above vowel, centered)
6. **If overlapping/misaligned:** Shaping NOT working → STOP, evaluate library alternatives
7. **If correct:** Shaping working → proceed to Phase 2

**Critical Decision Point:**
- If shaping fails → Document findings, recommend library change (puppeteer, wkhtmltopdf)
- If shaping works → Proceed with confidence that fixes will resolve issues

**Rollback:** Delete test route after validation

---

### Step 1.3: Reproduce & Capture Current State

**Why:** Need baseline logs and metrics to compare fixes against

**Location:** `frontend/src/app/api/weekly/pdf/route.tsx`

**Temporary Changes:** (DO NOT COMMIT)
- **Line 110-117:** Enhance logging to capture more details

**What to Change:**
```
CURRENT (line 110-117):
  console.log('[weekly-pdf] Font system registered:', {
    success, primaryFamily, loadedFamilies, detectedScripts, fallbackMode, message
  });

ENHANCED (temporary):
  console.log('[weekly-pdf] Font system registered:', {
    success, primaryFamily, loadedFamilies, detectedScripts, fallbackMode, message
  });
  console.log('[weekly-pdf] Font registration details:', {
    itemCount: data.items.length,
    loadedFamilyCount: fontReport.loadedFamilies.length,
    fallbackMode: fontReport.fallbackMode,
    detectedScriptsCount: fontReport.detectedScripts.length,
    timestamp: new Date().toISOString()
  });
  if (fontReport.fallbackMode) {
    console.warn('[weekly-pdf] ⚠️ FALLBACK MODE ACTIVE - Non-Thai scripts may not render correctly');
  }
```

**Testing:**
1. Run: `npm run dev`
2. Generate PDF: `curl http://localhost:3000/api/weekly/pdf > reports/pdf-debug/pdf_raw/baseline_with_logs.pdf`
3. Save console output to: `reports/pdf-debug/logs/baseline_generation.log`
4. Analyze logs:
   - Check `fallbackMode` value (should be false)
   - Check `loadedFamilies` array (should include Thai, Symbols at minimum)
   - Check `detectedScripts` (should match snapshot content)

**Evidence to Capture:**
- Screenshot of logs showing fallback mode status
- List of loaded font families
- PDF file size (baseline for comparison)
- Visual inspection notes (which items have issues)

**Rollback:** Remove enhanced logging after Phase 1

---

## PHASE 2: QUICK WINS (2-4 hours)

**Goal:** Fix most visible symptoms with minimal risk

### Step 2.1: Increase Line Height for Thai Diacritics

**Why:** Current lineHeight=1.4 causes clipping of tone marks/vowels above base

**Location:** `frontend/src/lib/pdf/pdfStyles.ts`

**Changes Required:**

**Change 1: itemTitle line height**
- **File:** `pdfStyles.ts`
- **Line:** 78
- **Current:** `lineHeight: 1.4,`
- **New:** `lineHeight: 1.65,`
- **Comment:** Update line 78 comment to: `// Thai-safe line height (1.65 prevents diacritic clipping)`

**Change 2: itemTitle padding**
- **File:** `pdfStyles.ts`
- **Lines:** 86-87
- **Current:** `paddingTop: 1, paddingBottom: 1,`
- **New:** `paddingTop: 3, paddingBottom: 3,`
- **Comment:** Update line 86 comment to: `// Extra clearance for combining marks`

**Rationale:**
- 1.65 is midpoint between current 1.4 (too low) and Oct 16 fix 2.5 (too high, excessive spacing)
- 3px padding provides clearance for marks extending beyond font metrics
- Based on Thai typography best practices (1.5-1.8 for body text, 1.6-2.0 for titles)

**Testing:**
1. Save changes to `pdfStyles.ts`
2. Generate PDF: `curl http://localhost:3000/api/weekly/pdf > reports/pdf-debug/pdf_raw/after_step_2.1.pdf`
3. Compare: Baseline vs after_step_2.1.pdf side-by-side
4. Focus on: Items #4, #6, #18, #19 (Thai diacritics)
5. Expected: Tone marks no longer clipped, vowels above/below visible
6. Measure: Line spacing increased slightly (acceptable trade-off)

**Rollback:** Revert lineHeight to 1.4, padding to 1

**Risk:** Low (values within safe range, tested in Memory Bank Oct 16)

---

### Step 2.2: Add Font Availability Validation

**Why:** Prevent selecting fonts that weren't registered (causes tofu boxes)

**Location:** `frontend/src/lib/pdf/pdfFontSelector.ts`

**Changes Required:**

**Change 1: Import font registration info**
- **File:** `pdfFontSelector.ts`
- **Line:** Insert at line 2 (after existing imports)
- **Add:** `import { areMultilingualFontsRegistered } from './pdfFontsMultilingual';`

**Change 2: Modify selectFontFamily function**
- **File:** `pdfFontSelector.ts`
- **Function:** `selectFontFamily()` at line 30
- **Current logic:** Returns font name based on script detection, no validation
- **New logic:** Add availability check before returning non-default fonts

**What to Change (function structure, not full code):**
```
At line 30-57, replace function body with:
  1. Detect scripts in text (keep existing line 33)
  2. Define available fonts list:
     - For now, hardcode: ['NotoSansThaiUniversal'] (guaranteed available)
     - TODO: Get actual list from font registration (requires refactor)
  3. Check Hangul:
     IF scripts has Hangul AND 'NotoSansKR' in available fonts:
       return 'NotoSansKR'
     ELSE IF scripts has Hangul:
       log warning: "Korean detected but NotoSansKR not available, using fallback"
  4. Check CJK: (similar pattern)
  5. Check Emoji: (similar pattern)
  6. Default: return 'NotoSansThaiUniversal'
```

**Detailed Changes:**
```
CURRENT (line 33-36):
  const scripts = detectScripts(text);
  if (scripts.has(Script.HANGUL)) {
    return 'NotoSansKR';
  }

NEW (with validation):
  const scripts = detectScripts(text);
  const availableFonts = new Set(['NotoSansThaiUniversal']); // TODO: Get from registry
  
  if (scripts.has(Script.HANGUL)) {
    if (availableFonts.has('NotoSansKR')) {
      return 'NotoSansKR';
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[pdfFontSelector] Korean detected but NotoSansKR not available, using fallback');
      }
      // Fallback: NotoSansThaiUniversal has basic Hangul support
      return DEFAULT_FONT;
    }
  }

Repeat similar pattern for lines 42 (CJK), 46 (Emoji), 52 (Symbols)
```

**Testing:**
1. Save changes to `pdfFontSelector.ts`
2. Generate PDF: `curl http://localhost:3000/api/weekly/pdf > reports/pdf-debug/pdf_raw/after_step_2.2.pdf`
3. Check logs for: Font selection warnings (if fallback mode was active)
4. Compare: after_step_2.1.pdf vs after_step_2.2.pdf
5. Expected: No visual change IF fonts were already registered correctly
6. Expected: Fewer tofu boxes IF fallback mode was active (uses Thai font as fallback)

**Rollback:** Revert to original selectFontFamily logic

**Risk:** Low (graceful degradation, no breaking changes)

---

### Step 2.3: Force NotoSansSymbols Registration

**Why:** Special characters (@, ~, {}, ₽) missing in Thai font → need symbols font

**Location:** `frontend/src/lib/pdf/pdfFontsMultilingual.ts`

**Changes Required:**

**Change 1: Modify font loading logic**
- **File:** `pdfFontsMultilingual.ts`
- **Function:** `registerMultilingualFontsForPDF()` at line 35
- **Line:** 81 (after registering fonts for detected scripts)

**What to Change:**
```
CURRENT (line 81):
  const registeredFamilies = registerFontsForScripts(analysis.scripts);

NEW (after line 81, add):
  // Always register symbols font for special characters (@, ₽, etc)
  const symbolsFamily = FontFamily.SYMBOLS;
  if (!registeredFamilies.includes(symbolsFamily)) {
    try {
      // Force register NotoSansSymbols even if not detected in scripts
      const symbolsFonts = registerFontsForScripts(new Set([Script.SYMBOLS]));
      registeredFamilies.push(...symbolsFonts);
      console.log('[pdfFontsMultilingual] ✅ Symbols font force-registered for special characters');
    } catch (error) {
      console.warn('[pdfFontsMultilingual] ⚠️ Failed to register symbols font:', error);
      // Not critical, continue
    }
  }
```

**Testing:**
1. Save changes to `pdfFontsMultilingual.ts`
2. Generate PDF: `curl http://localhost:3000/api/weekly/pdf > reports/pdf-debug/pdf_raw/after_step_2.3.pdf`
3. Check logs for: "Symbols font force-registered"
4. Inspect PDF: Items #16 ("~~Roblox"), #20 ("她@Memory ₽hen")
5. Expected: Special characters (@, ~, ₽) render correctly, no corruption

**Rollback:** Remove symbols font force-registration

**Risk:** Low (symbols font is small ~186KB, no breaking changes)

---

## PHASE 3: DEEP FIXES (4-8 hours)

**Goal:** Address root causes in font registration and sanitization

### Step 3.1: Fix Fallback Mode Logic

**Why:** Fallback mode skips non-Thai fonts even when snapshot contains CJK/Korean/emoji

**Location:** `frontend/src/lib/pdf/pdfFontsMultilingual.ts`

**Changes Required:**

**Change 1: Make script analysis more robust**
- **File:** `pdfFontsMultilingual.ts`
- **Line:** 75 (script analysis call)

**What to Change:**
```
CURRENT (line 75):
  const analysis = analyzeSnapshotScripts(items);

NEW (wrap in try-catch):
  let analysis;
  try {
    analysis = analyzeSnapshotScripts(items);
  } catch (error) {
    console.warn('[pdfFontsMultilingual] Script analysis failed, using safe defaults:', error);
    // Fallback: Assume Thai + Latin at minimum
    analysis = {
      scripts: new Set([Script.THAI, Script.LATIN]),
      families: new Set([FontFamily.UNIVERSAL]),
      stats: { Thai: items.length, Latin: items.length }
    };
  }
```

**Change 2: Improve font registration error handling**
- **File:** `pdfFontsMultilingual.ts`
- **Line:** 81 (after script analysis)

**What to Change:**
```
CURRENT (line 81):
  const registeredFamilies = registerFontsForScripts(analysis.scripts);
  if (registeredFamilies.length === 0) {
    // Fall back to Thai-only
  }

NEW (better fallback):
  let registeredFamilies = [];
  try {
    registeredFamilies = registerFontsForScripts(analysis.scripts);
  } catch (error) {
    console.error('[pdfFontsMultilingual] Font registration failed:', error);
  }
  
  // If registration failed completely, fall back to Thai-only
  if (registeredFamilies.length === 0) {
    console.warn('[pdfFontsMultilingual] No fonts registered via manifest, using Thai-only fallback');
    registerPdfFonts(); // Thai-only
    registeredFamilies = [FontFamily.UNIVERSAL];
  } else {
    console.log(`[pdfFontsMultilingual] ✅ ${registeredFamilies.length} font families registered`);
  }
```

**Testing:**
1. Save changes
2. Generate PDF: `curl http://localhost:3000/api/weekly/pdf > reports/pdf-debug/pdf_raw/after_step_3.1.pdf`
3. Check logs: Should show successful multi-font registration, not fallback
4. Expected: CJK/Korean fonts loaded if snapshot contains those scripts

**Rollback:** Revert error handling changes

**Risk:** Medium (changes error handling flow, test thoroughly)

---

### Step 3.2: Verify subset:false Flag Working

**Why:** If fontkit ignores subset:false, GPOS tables stripped → Thai diacritics broken

**Location:** This is VERIFICATION only, no code changes yet

**Steps:**

1. **Generate test PDF:**
   - Use current code (subset:false already in pdfFonts.core.ts line 50)
   - Generate: `curl http://localhost:3000/api/weekly/pdf > reports/pdf-debug/pdf_raw/subset_test.pdf`

2. **Extract embedded font:**
   ```
   Install: npm install -g @pdf-lib/fontkit
   Extract font from PDF: 
     Use pdf-lib or similar tool to extract first embedded font
     Save as: reports/pdf-debug/fonts/embedded_notosans.ttf
   ```

3. **Inspect font tables:**
   ```
   Install: pip install fonttools (if not already installed)
   List tables: ttx -l reports/pdf-debug/fonts/embedded_notosans.ttf
   Expected tables:
     - GDEF (glyph definition)
     - GPOS (positioning, CRITICAL for Thai)
     - GSUB (substitution)
     - cmap (character map)
     - name (font names)
     - ... (standard TrueType tables)
   ```

4. **Analyze results:**
   - **If GPOS table present:** subset:false IS working → Thai shaping should work
   - **If GPOS table missing:** subset:false NOT working → need workaround

**Workaround if subset:false not working:**

**Option A: Pre-subset fonts manually**
- Use fonttools to create subset with GPOS preserved:
  ```
  pyftsubset NotoSansThai-Regular.ttf \
    --output-file=NotoSansThai-Regular-subset.ttf \
    --unicodes=U+0E00-0E7F,U+0020-007E \
    --layout-features=* \
    --glyph-names \
    --no-subset-tables+=GDEF,GPOS,GSUB
  ```
- Replace font files in `frontend/public/fonts/NotoSansThai/`
- Update fontResolver.core.ts to use *-subset.ttf files

**Option B: Embed full fonts (no subsetting)**
- Investigate @react-pdf/renderer config for global subset disable
- If possible, disable subsetting entirely (larger PDF but guaranteed correct)

**Testing:** Repeat Phase 2 tests with fixed fonts

**Risk:** Medium (pre-subsetting adds build step; full embed increases PDF size ~200KB)

---

### Step 3.3: Simplify Text Sanitizer

**Why:** v6 sanitizer (520 lines) may be over-engineered, removing legitimate characters

**Location:** `frontend/src/lib/pdf/pdfTextSanitizer.v6.unified.ts`

**Changes Required:** Create new simplified version

**New File:** `frontend/src/lib/pdf/pdfTextSanitizer.v7.minimal.ts`

**What to Include (structure, not full code):**
```
Export functions:
  - sanitizeTitleForPdf(text, itemId)
  - sanitizeMetadataForPdf(text, itemId)
  - sanitizeForPdf(text, itemId) // Main function

Logic:
  1. NFC normalization (Unicode canonical composition)
  2. Remove ONLY truly problematic chars:
     - Zero-width joiners: ZWSP (U+200B), ZWNJ (U+200C), ZWJ (U+200D)
     - Soft hyphen (U+00AD)
     - Bidi controls: LRE, RLE, PDF, LRO, RLO, isolates
  3. Map smart punctuation (conservative):
     - Smart quotes → ASCII quotes
     - En/em dash → hyphen
  4. Collapse multiple spaces
  5. Trim

  SKIP entirely:
    - C0/C1 filtering (DB already clean per Oct 18 audit)
    - Thai grapheme reordering (DB already correct)
    - Orphan mark removal (too aggressive, causes edge case issues)
    - SARA AM fixing (not needed if DB correct)
```

**Change File Usage:**
- **File:** `frontend/src/lib/pdf/WeeklyDoc.tsx`
- **Line:** 12 (import statement)
- **Current:** `import { sanitizeTitleForPdf, sanitizeMetadataForPdf } from '@/lib/pdf/pdfTextSanitizer.v6.unified';`
- **New:** `import { sanitizeTitleForPdf, sanitizeMetadataForPdf } from '@/lib/pdf/pdfTextSanitizer.v7.minimal';`

**Testing:**
1. Create v7.minimal.ts as described
2. Update WeeklyDoc.tsx import
3. Generate PDF: `curl http://localhost:3000/api/weekly/pdf > reports/pdf-debug/pdf_raw/after_step_3.3.pdf`
4. Compare: after_step_3.2.pdf vs after_step_3.3.pdf
5. Expected: Minimal visual changes (possibly improvements if v6 was over-sanitizing)
6. Check: Items #16, #20 for special character preservation

**Rollback:** Revert import to v6.unified

**Risk:** Medium (fundamental change in sanitization logic, requires thorough testing)

---

## PHASE 4: VERIFICATION (2-4 hours)

**Goal:** Confirm all fixes work together, no regressions

### Step 4.1: Comprehensive PDF Generation Test

**Test Matrix:**

| Test | Description | Expected Result |
|------|-------------|-----------------|
| T1 | Generate PDF from Oct 18 snapshot | 20 items, all readable |
| T2 | Check items #4, #6, #18, #19 | Thai diacritics visible, no clipping |
| T3 | Check item #16 | Special chars (~~, {}) preserved |
| T4 | Check item #20 | CJK (她), symbols (@, ₽) correct |
| T5 | Check item #11 (if present) | Korean Hangul readable |
| T6 | Check footer | "รายงานนี้สร้าง...อัตโนมัติ" correct |
| T7 | Check headers | "หมวดหมู่: บันเทิง" correct |
| T8 | File size | Within ±20% of baseline (~200-400KB) |
| T9 | Generation time | <5 seconds |
| T10 | Console errors | Zero errors, only info/warn logs |

**Execution:**
```bash
# Step 1: Clean restart
npm run dev

# Step 2: Generate PDF with full logging
curl http://localhost:3000/api/weekly/pdf?snapshot=<oct18_snapshot_id> > reports/pdf-debug/pdf_raw/final_test.pdf 2> reports/pdf-debug/logs/final_test.log

# Step 3: Visual inspection
Open final_test.pdf in Adobe Acrobat or PDF.js viewer
Take screenshots of problematic items
Save to reports/pdf-debug/screenshots/

# Step 4: Automated checks
Run: node scripts/verify-pdf-quality.mjs reports/pdf-debug/pdf_raw/final_test.pdf
(script checks file size, page count, text extraction quality)
```

**Pass Criteria:** 9/10 tests pass (T9 generation time may vary by hardware)

---

### Step 4.2: Font QA Stress Test

**Why:** Test edge cases not present in production snapshot

**Location:** Existing test route `/api/weekly/pdf/font-qa-final`

**Steps:**
1. Review test route: `frontend/src/app/api/weekly/pdf/font-qa-final/route.tsx`
2. Verify test cases include:
   - Thai tone marks: "ผู้กี่สุด ในชีวิต" (ี่ and ุ)
   - Complex marks: "เขาญที่สุด" (multiple diacritics)
   - Mixed scripts: "NMIXX(엔믹스) Blue Valentine"
   - Special chars: "@ # $ % ^ & * ~ | { } [ ] ₽ € £ ¥"
   - Emoji: "🤯 🔥 ✨"
3. Generate: `curl http://localhost:3000/api/weekly/pdf/font-qa-final > reports/pdf-debug/pdf_raw/font_qa_after_fixes.pdf`
4. Compare: Baseline font_qa vs font_qa_after_fixes
5. Expected: All 60+ test cases render correctly

**Pass Criteria:** 55/60+ test cases render correctly (some edge cases may still fail)

---

### Step 4.3: Regression Check

**Why:** Ensure fixes didn't break other features

**Checks:**

1. **Weekly Report Page (Web UI):**
   - Navigate to: http://localhost:3000/weekly-report
   - Expected: Page loads, 20+ items displayed, no console errors

2. **Story Details Modal:**
   - Click any item in weekly report
   - Expected: Modal opens, Thai text readable, metrics visible

3. **Home Page:**
   - Navigate to: http://localhost:3000
   - Expected: Top stories load, Thai titles readable

4. **Other PDF Routes (if any):**
   - Check: /api/weekly/pdf2, /api/weekly/pdf/debug
   - Expected: Still functional (may not have fixes, but shouldn't error)

**Pass Criteria:** All checks pass, zero regressions

---

### Step 4.4: Performance Verification

**Why:** Ensure fixes didn't degrade performance

**Metrics to Measure:**

| Metric | Baseline | After Fixes | Acceptable Range |
|--------|----------|-------------|-------------------|
| PDF generation time | ~2-3s | ? | <5s |
| PDF file size | ~250-350KB | ? | 200-500KB |
| Memory usage | ~100-200MB | ? | <500MB |
| Font loading time | ~50-100ms | ? | <200ms |

**Testing:**
```bash
# Step 1: Warm up (fonts cached)
curl http://localhost:3000/api/weekly/pdf > /dev/null

# Step 2: Measure (3 runs)
time curl http://localhost:3000/api/weekly/pdf > reports/pdf-debug/pdf_raw/perf_test_1.pdf
time curl http://localhost:3000/api/weekly/pdf > reports/pdf-debug/pdf_raw/perf_test_2.pdf
time curl http://localhost:3000/api/weekly/pdf > reports/pdf-debug/pdf_raw/perf_test_3.pdf

# Step 3: Analyze
Average generation time: (run1 + run2 + run3) / 3
File size: ls -lh reports/pdf-debug/pdf_raw/perf_test_*.pdf
```

**Pass Criteria:** All metrics within acceptable range

---

### Step 4.5: Documentation & Handoff

**Deliverables:**

1. **VERIFICATION_REPORT.md**
   - Test matrix results (10/10 or 9/10 pass)
   - Screenshots showing fixes (BEFORE/AFTER)
   - Performance metrics table
   - Regression check results

2. **CHANGE_LOG.txt**
   - List of all modified files
   - Line-by-line changes summary
   - Rationale for each change
   - Rollback instructions

3. **Update Memory Bank**
   - File: `memory-bank/04_pdf_system.mb`
   - Add entry: "2025-10-20: Comprehensive PDF Rendering Fix"
   - Document: Root causes, fixes applied, verification results
   - Include: Lessons learned, recommendations for future

4. **Prepare Rollback Package**
   - Create: `rollback_oct20_pdf_fixes.sh`
   - Content: Git commands to revert all changes
   - Test: Run rollback script, verify PDF reverts to baseline

---

## ROLLBACK PROCEDURES

### Quick Rollback (If Critical Issues Found)

**Emergency Stop:**
```bash
# Revert all changes
git checkout main
git branch -D fix/pdf-rendering-oct20

# Restore baseline
npm run dev
```

**Selective Rollback (Per Phase):**

**Phase 2 Rollback:**
```bash
# File: pdfStyles.ts
git checkout HEAD -- frontend/src/lib/pdf/pdfStyles.ts

# File: pdfFontSelector.ts
git checkout HEAD -- frontend/src/lib/pdf/pdfFontSelector.ts

# File: pdfFontsMultilingual.ts
git checkout HEAD -- frontend/src/lib/pdf/pdfFontsMultilingual.ts
```

**Phase 3 Rollback:**
```bash
# Revert sanitizer change
git checkout HEAD -- frontend/src/lib/pdf/WeeklyDoc.tsx

# Keep v6 sanitizer
git checkout HEAD -- frontend/src/lib/pdf/pdfTextSanitizer.v6.unified.ts
```

**Font Rollback (If Pre-Subsetting Applied):**
```bash
# Restore original fonts
rm -rf frontend/public/fonts/NotoSansThai/
cp -r frontend/public/fonts.backup/NotoSansThai/ frontend/public/fonts/
```

---

## RISK ASSESSMENT

### Low Risk Changes
- ✅ Line height adjustment (1.4 → 1.65)
- ✅ Padding increase (1px → 3px)
- ✅ Font availability validation
- ✅ Symbols font force-registration

### Medium Risk Changes
- ⚠️ Fallback mode error handling
- ⚠️ Sanitizer simplification (v6 → v7)
- ⚠️ Font integrity checks (may slow startup)

### High Risk Changes
- ⚠️⚠️ Font pre-subsetting (if subset:false not working)
- ⚠️⚠️ Library change (if shaping fails)

---

## SUCCESS CRITERIA

**All fixes successful if:**

1. ✅ Test matrix: 9/10 or 10/10 tests pass
2. ✅ Font QA: 55/60+ edge cases render correctly
3. ✅ Regression check: Zero failures
4. ✅ Performance: Within acceptable ranges
5. ✅ User-reported issues: All items #4, #6, #14-#20 render correctly
6. ✅ Memory Bank: Updated with findings and fixes

**Partial success (needs iteration):**
- 7-8/10 tests pass → Iterate on failing cases
- Font QA <55/60 → Review edge cases, may need library change
- Performance degraded → Optimize font loading, consider caching

**Failure (requires alternative approach):**
- <7/10 tests pass → Fundamental issue (shaping not working)
- Library change required → Evaluate puppeteer, wkhtmltopdf, LaTeX

---

**END OF FIX PLAN**

---

## NOTES FOR REVIEWER

1. This plan assumes @react-pdf/renderer supports Thai shaping (verified in Phase 1)
2. Each phase builds on previous phases - DO NOT skip phases
3. Test after EACH step, not just at end
4. If any step fails, STOP and analyze before proceeding
5. Capture artifacts (PDFs, logs, screenshots) at each step for comparison
6. Update this plan if new issues discovered during implementation

---

**Awaiting Approval to Proceed**

