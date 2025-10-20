# Font Audit — Thai PDF Rendering

**Date:** 2025-10-16  
**Status:** ❌ CRITICAL ISSUE IDENTIFIED

---

## Findings Summary

| Metric | Current | Expected | Status |
|--------|---------|----------|--------|
| **File Size** | 47,484 bytes (both files) | 160,000-180,000 bytes | ❌ FAIL |
| **TTF Header** | Blank/Invalid | `00 01 00 00` | ❌ FAIL |
| **Thai Glyphs** | None (placeholder) | Full Unicode Thai block | ❌ FAIL |
| **Font Family** | Not set | Noto Sans Thai | ❌ FAIL |
| **Embedding** | N/A (invalid font) | Enabled | ❌ FAIL |

---

## Root Cause

**Placeholder fonts installed instead of authentic Noto Sans Thai fonts.**

Evidence:
1. `README.md` states: "⚠️ PLACEHOLDER - Replace with actual font"
2. Identical file sizes (47,484 bytes) = duplicates or empty placeholders
3. Blank TTF header (should start with `00 01 00 00` for TrueType)
4. @react-pdf/renderer falls back to system fonts → overlapping text

---

## Font Coverage Analysis

### Required Character Sets
- **Thai:** U+0E00–U+0E7F (128 characters)
- **Latin:** U+0000–U+007F (Basic Latin)
- **Latin Extended:** U+0100–U+017F (for European names)
- **Punctuation:** U+2000–U+206F
- **Emoji:** U+1F300–U+1F9FF (optional, fallback acceptable)

### Current Coverage
- ❌ Thai: **0 glyphs** (placeholder has no coverage)
- ❌ Latin: **0 glyphs** (placeholder has no coverage)
- ❌ All others: **0 glyphs**

### Required Coverage (After Fix)
- ✅ Thai: **128 glyphs** (full Thai Unicode block)
- ✅ Latin: **256+ glyphs** (Basic + Extended)
- ✅ Punctuation: **Full coverage**
- ⚠️ Emoji: **System fallback** (acceptable)

---

## Fallback Chain Analysis

### Current Configuration
**Location:** `frontend/src/lib/pdf/pdfFonts.core.ts`

```
Primary: NotoSansThaiUniversal (BROKEN - placeholder fonts)
  ↓ (fails for Thai)
Fallback 1: Helvetica (no Thai glyphs)
  ↓ (fails for Thai)
Fallback 2: Arial (no Thai glyphs)
  ↓ (fails for Thai)
Result: Garbled text, overlapping glyphs
```

### After Fix (With Authentic Fonts)
```
Primary: NotoSansThaiUniversal (✅ full Thai + Latin coverage)
  → All text renders correctly
  → No fallback needed
Result: Clean, professional PDF
```

---

## Font Registration Code

**Status:** ✅ CORRECT (no changes needed)

The font registration logic in `pdfFonts.core.ts` is properly implemented:
- Registers universal font family
- Overrides system fonts to prevent fallback
- Disables Thai hyphenation (correct for Thai script)
- Uses SECURITY DEFINER where needed

**The only issue:** Invalid font files being registered.

---

## Embedding Status

**Current:** N/A (fonts invalid)
**After Fix:** ✅ Fonts will be embedded automatically by @react-pdf/renderer

**Verification Steps:**
1. Generate PDF with authentic fonts
2. Open in Adobe Acrobat
3. File → Properties → Fonts tab
4. Should show: "NotoSansThaiUniversal (Embedded Subset)"

---

## Recommendations

### Immediate (Critical)
1. ✅ **Download authentic fonts** — See FONT_DOWNLOAD_INSTRUCTIONS.md
2. ✅ **Verify file sizes** — Should be 160-180 KB (not 47 KB)
3. ✅ **Check TTF header** — Should be `00 01 00 00`

### Short-Term (Prevent Recurrence)
1. Add font validation to build process
2. Create automated test for font integrity
3. Add CI/CD check for placeholder detection

### Long-Term (Optional)
1. Consider font subsetting to reduce file size
2. Evaluate alternative Thai fonts (Sarabun, Prompt)
3. Add font fallback metrics/logging

---

## Test Plan

### Pre-Fix Tests
- [x] Verify current fonts are placeholders
- [x] Confirm file sizes (47 KB)
- [x] Check TTF header (blank)

### Post-Fix Tests
- [ ] Download authentic fonts
- [ ] Verify file sizes (160-180 KB)
- [ ] Check TTF header (`00 01 00 00`)
- [ ] Generate PDF
- [ ] Verify Thai text renders correctly
- [ ] Verify no overlapping characters
- [ ] Check font embedding in PDF properties

---

**Status:** ❌ **CRITICAL** (placeholder fonts)  
**Fix Required:** 🔴 **Download authentic fonts** (5 minutes)  
**Confidence:** HIGH (root cause identified)

**Related:** FONT_DOWNLOAD_INSTRUCTIONS.md

