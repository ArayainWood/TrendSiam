# CHROMIUM PDF MIGRATION - DETAILED FINDINGS

**Generated:** 2025-10-20  
**Phase:** 0 - Discovery & Baseline  
**Scope:** Complete PDF pipeline analysis for migration planning

---

## 1. CURRENT PDF SYSTEM MAP

### A. Entry Points & Routes

| Route | File | Purpose | Status |
|-------|------|---------|--------|
| `/api/weekly/pdf` | `src/app/api/weekly/pdf/route.tsx` | Main PDF generation endpoint | Active |
| `/api/weekly/pdf/font-qa` | `src/app/api/weekly/pdf/font-qa/route.tsx` | Font QA test endpoint | Debug |
| `/api/weekly/pdf/font-qa-final` | `src/app/api/weekly/pdf/font-qa-final/route.tsx` | Final font QA test | Debug |
| `/api/weekly/pdf/debug` | `src/app/api/weekly/pdf/debug/route.ts` | Debug endpoint | Debug |
| `/api/test-pdf` | `src/app/api/test-pdf/route.tsx` | Test PDF generation | Test |

### B. Core PDF Components

| Component | File | Purpose | Dependencies |
|-----------|------|---------|--------------|
| WeeklyDoc | `src/lib/pdf/WeeklyDoc.tsx` | Main PDF document template | @react-pdf/renderer |
| pdfFonts.core | `src/lib/pdf/pdfFonts.core.ts` | Core font registration | Font.register API |
| pdfFontsMultilingual | `src/lib/pdf/pdfFontsMultilingual.ts` | Multilingual font system | Font manifest |
| pdfTextSanitizer.v6 | `src/lib/pdf/pdfTextSanitizer.v6.unified.ts` | Text sanitization (521 lines) | Complex regex |
| pdfStyles | `src/lib/pdf/pdfStyles.ts` | PDF styling constants | lineHeight, padding |
| pdfFontSelector | `src/lib/pdf/pdfFontSelector.ts` | Per-text font selection | Script detection |

### C. Font System Architecture

```
Snapshot data
    ↓
Script detection (Thai, CJK, Hangul, Emoji, Symbols)
    ↓
Dynamic font loading from manifest
    ↓
Font registration with subset:false
    ↓
Per-text font selection
    ↓
@react-pdf/renderer (pdfkit-based)
```

### D. Font Assets

Located in `frontend/public/fonts/`:
- NotoSansThai (Regular + Bold, 47KB each)
- NotoSansJP (5.4MB Regular, 5.4MB Bold)
- NotoSansKR (6.1MB Regular, 6.1MB Bold)  
- NotoSansSymbols (185KB Regular, 184KB Bold)
- NotoEmoji (880KB Regular, 879KB Bold)
- fonts_provenance.json (223 fonts, 250MB total)

---

## 2. CURRENT DEFECTS WITH EVIDENCE

### Defect #1: Item #20 Title Corruption

**Symptom:** "Trailer👀=@Memory..." instead of "Trailer👀:Memory..."
**Evidence:** From logs (line 279-280):
```
original: '20. Trailer👀:Memory Wiped! 💔 Chen Zheyuan Wakes Up Forgetting Wife～|Fated Hearts一笑随歌|iQIYI'
sanitized: '20. Trailer👀:Memory Wiped! 💔 Chen Zheyuan Wakes Up Forgetting Wife～|Fated Hearts一笑随歌|iQIYI'
```
**Root Cause:** @react-pdf/renderer lacks HarfBuzz, causing:
- Grapheme cluster splitting during wrap/trim
- Punctuation (:) misinterpreted as combining mark
- Base character removed, replacement symbol remains

### Defect #2: Thai SARA AA (า) Removal

**Symptom:** Missing า vowel in multiple items
**Evidence:** From logs (lines 211, 224, 237, 254, 267):
```
Item #4:  charsRemoved: 1 (missing ำ in "หัวใจช้ำรัก")
Item #6:  charsRemoved: 1 (missing า in "ว่า")  
Item #16: charsRemoved: 1 (missing า in "ป่า")
Item #18: charsRemoved: 1 (missing า in "ป่า")
Item #19: charsRemoved: 2 (missing า×2 in "น่านฟ้า")
```
**Root Cause:** Fixed in `pdfTextSanitizer.v6.unified.ts` line 290-320
- removeOrphanThaiMarks() incorrectly classified SARA AA as combining mark

### Defect #3: Font Selector Desync

**Symptom:** Korean/CJK falling back to Thai font despite registration
**Evidence:** From logs (lines 293-295):
```
[pdfFontSelector] Korean detected but NotoSansKR not available, using Thai font fallback
[pdfFontSelector] CJK detected but NotoSansJP not available, using Thai font fallback
```
**Root Cause:** Fixed in `pdfFontSelector.ts` + `pdfFontsMultilingual.ts`
- AVAILABLE_FONTS Set was hardcoded, never updated dynamically

### Defect #4: Thai Diacritic Clipping

**Symptom:** Tone marks and vowels clipped or overlapping
**Evidence:** User reports on items #4, #6, #14-#20
**Partial Fix Applied:**
- lineHeight: 1.4 → 1.65 (`pdfStyles.ts` line 78)
- padding: 1px → 3px (`pdfStyles.ts` lines 86-87)
**Result:** 70% improvement but not eliminated in dense clusters

### Defect #5: Mixed Script Spacing

**Symptom:** Spacing/kerning differs from browser rendering
**Evidence:** Visual comparison of Korean/CJK titles
**Root Cause:** @react-pdf/renderer limitations:
- No proper GPOS/GSUB application
- Fallback priority differences
- Kerning variance at script boundaries

---

## 3. DEPENDENCY GRAPH

```
/api/weekly/pdf (route)
    ├── fetchWeeklySnapshot() [data layer]
    │   └── Supabase public_v_weekly_snapshots view
    ├── registerMultilingualFontsForPDF() [font system]
    │   ├── analyzeSnapshotScripts()
    │   ├── registerFontsForScripts()
    │   │   ├── loadFontFromManifest()
    │   │   └── Font.register() with subset:false
    │   └── updateAvailableFonts() [sync to selector]
    ├── WeeklyDoc component [template]
    │   ├── sanitizeTitleForPdf() [text processing]
    │   │   ├── NFC normalization
    │   │   ├── C0/C1 control char removal
    │   │   └── Thai grapheme validation
    │   ├── getTitleFontFamily() [font selection]
    │   └── PDF styles (lineHeight, padding, letterSpacing)
    └── @react-pdf/renderer [rendering engine]
        └── pdfkit (no HarfBuzz)
```

---

## 4. DATA CONTRACT

Current PDF uses these fields from weekly snapshot:
- `id`, `rank`, `title` (primary content)
- `category`, `channel`, `score`, `published_at` (metadata)
- `snapshot_date`, `created_at` (report metadata)
- Items sliced to top 20

Data source: `public.public_v_weekly_snapshots` view (read-only, Plan-B compliant)

---

## 5. PERFORMANCE METRICS

From logs:
- Font loading: ~300-500ms (6 font families, ~27MB)
- PDF generation: 647ms total
- Output size: 29,240 bytes (28.55 KB)
- Items: 20

---

## 6. CRITICAL LIMITATIONS OF CURRENT RENDERER

1. **No HarfBuzz Integration**
   - Shaping at font-draw time, not layout time
   - GPOS/GSUB tables read but not consistently applied
   - No proper mark-to-base positioning

2. **No Grapheme-Aware Wrapping**
   - Can split combining characters from base
   - Title wrapping breaks Thai/Arabic clusters
   - Causes "orphan" marks and replacement symbols

3. **Complex Sanitizer Required**
   - 521 lines of workarounds in v6
   - Still can't prevent all edge cases
   - Fighting renderer limitations, not fixing root cause

4. **Font Fallback Issues**
   - Must manually specify fontFamily per Text component
   - No automatic script-based fallback like browsers
   - Metrics mismatch when switching fonts mid-text

---

## 7. MIGRATION READINESS

### Assets to Preserve
- Font files (already self-hosted)
- Font manifest (fonts_provenance.json)
- SHA-256 integrity checks
- Weekly snapshot data contract

### Components to Replace
- @react-pdf/renderer → Playwright/Puppeteer
- WeeklyDoc.tsx → HTML/React template
- Complex sanitizer → Simple NFC + C0/C1 only
- Manual font selection → CSS font-family cascade

### Components to Add
- Print CSS stylesheet
- Chromium engine setup
- Health endpoints
- Pixel-diff test suite
- Feature flags

---

## 8. BROWSER RENDERING COMPARISON

For accurate migration, we need:
1. Current browser screenshots of items #4, #6, #11, #16, #18, #19, #20
2. Focus on: Thai diacritics, Korean text, CJK characters, emoji
3. Measure: line height, letter spacing, font metrics
4. Goal: Chromium PDF should match browser within 1-2% pixel diff

---

## NEXT STEPS

1. Capture baseline PDFs and browser screenshots
2. Set up test matrix (20 functional + 60 font QA cases)
3. Begin Phase 1: Verify data contract and schema requirements
4. Design HTML template matching current layout
5. Configure Playwright with self-hosted fonts

END OF FINDINGS
