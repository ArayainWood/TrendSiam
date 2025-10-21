# PDF Font Runtime Audit

**Date:** 2025-10-16  
**Focus:** Font family registration, renderer compatibility, final font stack  
**Status:** ✅ SOLUTION IMPLEMENTED

---

## Font Family Registration

### Current Configuration

**Primary Font Family:** `NotoSansThaiUniversal`  
**Registration Location:** `frontend/src/lib/pdf/pdfFonts.core.ts`

**Font Stack (After Fix):**
```
NotoSansThaiUniversal
  ├─ Regular → NotoSansThai-Variable.ttf (217,004 bytes)
  └─ Bold    → NotoSansThai-Variable.ttf (217,004 bytes)
            └─ Same file, weight extracted via font's internal axis
```

**Fallback Registration:**
```
System font overrides:
- Helvetica   → NotoSansThaiUniversal
- Arial       → NotoSansThaiUniversal
- sans-serif  → NotoSansThaiUniversal
- Times       → NotoSansThaiUniversal
- serif       → NotoSansThaiUniversal
```

**Purpose:** Prevent mid-line font fallbacks that cause metrics mismatches

---

## Variable Font Compatibility

### @react-pdf/renderer v4.3.0 Support

**Variable Font Features:**
- Weight axis: 100-900 (Thin to Black)
- Width axis: 62.5-100 (ExtraCondensed to Normal)

**Compatibility Status:** ⚠️ TO BE VERIFIED

**Known Issues:**
- Some renderers treat Variable fonts as single weight
- May require explicit `fontWeight` property mapping
- Axis extraction may not work automatically

**Test Plan:**
1. Generate PDF with Variable font
2. Check if Bold text renders differently from Regular
3. If weights identical: may need to fall back to static fonts
4. Document findings for future reference

---

## Font Rendering Pipeline

### Step-by-Step Flow

**1. Font Resolution (Build Time)**
```
fontResolver.core.ts
  ↓
Check: NotoSansThai-Variable.ttf exists?
  ├─ YES (217KB) → Use Variable for both weights
  └─ NO → Use static Regular (47KB) + Bold (47KB)
```

**2. Font Registration (Runtime)**
```
pdfFonts.core.ts
  ↓
Font.register({
  family: 'NotoSansThaiUniversal',
  fonts: [
    { src: Variable.ttf, fontWeight: 'normal' },
    { src: Variable.ttf, fontWeight: 'bold' }
  ]
})
```

**3. Style Application (Component)**
```
pdfStyles.ts
  ↓
itemTitle: {
  fontFamily: 'NotoSansThaiUniversal',
  fontWeight: 'bold',
  fontSize: 11,
  lineHeight: 2.5
}
```

**4. Text Processing (Pre-Render)**
```
pdfTypoV2.ts
  ↓
sanitizeUnicode(text)
  → NFC normalization
  → Strip zero-width chars
  → Script boundary spacing
```

**5. PDF Generation (@react-pdf/renderer)**
```
WeeklyDoc.tsx
  ↓
<Text style={styles.itemTitle}>
  {processTitleForPDF(item.title)}
</Text>
```

**6. Buffer Output**
```
route.tsx
  ↓
toBlob() → ArrayBuffer → Buffer → Uint8Array → HTTP Response
```

---

## Font Stack Verification

### Expected Runtime Logs (After Restart)

**Success Case (Variable Font):**
```
[fontResolver] ✓ Found Variable Thai font at: D:\TrendSiam\frontend\public\fonts\NotoSansThai
  Variable: 217,004 bytes
  [fontResolver] Using Variable font for both Regular and Bold variants

[pdfFonts] 🔧 Registering universal PDF font family...
[pdfFonts] ✅ Universal font system registered successfully
[pdfFonts] Primary family: NotoSansThaiUniversal
[pdfFonts] System overrides: Helvetica, Arial, sans-serif, Times, serif
[pdfFonts] Thai hyphenation: disabled

[weekly-pdf/renderPdfBuffer] PDF buffer created: 30837 bytes
[weekly-pdf] ✅ PDF generated successfully: 30837 bytes
```

**Fallback Case (Static Fonts if Variable Removed):**
```
[fontResolver] ✓ Found static Thai fonts at: D:\TrendSiam\frontend\public\fonts\NotoSansThai
  Regular: 47,484 bytes
  Bold: 47,480 bytes

[pdfFonts] ✅ Universal font system registered successfully
```

---

## Renderer Compatibility Notes

### @react-pdf/renderer v4.3.0 Capabilities

**Supported:**
- ✅ TrueType fonts (.ttf)
- ✅ OpenType fonts (.otf)
- ✅ Font subsetting (automatic)
- ✅ Unicode support
- ✅ Custom font families
- ✅ System font overrides

**Uncertain (Requires Testing):**
- ⚠️ Variable fonts (may treat as single weight)
- ⚠️ OpenType features (GPOS/GSUB for Thai)
- ⚠️ Font axis extraction (wght, wdth)

**Known Limitations:**
- ❌ WOFF/WOFF2 fonts (requires TTF/OTF)
- ❌ Color fonts (emoji)
- ❌ Dynamic font loading (must register at startup)

---

## Thai Script Rendering Requirements

### OpenType Features Needed

**GPOS (Glyph Positioning):**
- `mark` - Mark positioning (tone marks above/below)
- `mkmk` - Mark-to-mark positioning (stacked marks)
- `kern` - Kerning (spacing between glyphs)

**GSUB (Glyph Substitution):**
- `liga` - Ligatures (combined characters)
- `ccmp` - Glyph composition/decomposition

**Status:**
- 47KB static fonts: Minimal GPOS/GSUB (may cause overlaps)
- 217KB Variable font: Fuller GPOS/GSUB (should render correctly)

---

## Visual Verification

### Test Cases for PDF Output

**Case 1: Basic Thai Text**
```
Expected: "รายงานแนวโน้มสัปดาห์ TrendSiam"
Result: [TO BE TESTED]
Issues: [TO BE DOCUMENTED]
```

**Case 2: Thai with Tone Marks**
```
Expected: "ก่อน ก้าม กิ่ง กี้ กุ๊ก"
Result: [TO BE TESTED]
Issues: [TO BE DOCUMENTED]
```

**Case 3: Mixed Thai/English**
```
Expected: "NMIXX(엔믹스) Blue Valentine"
Result: [TO BE TESTED]
Issues: [TO BE DOCUMENTED]
```

**Case 4: Thai with Emoji**
```
Expected: "🤯 ผู้กี่สุด ในชีวิต !!!!"
Result: [TO BE TESTED]
Issues: [TO BE DOCUMENTED]
```

---

## HTTP Content-Length Verification

### Font File Endpoints

**Variable Font:**
```bash
curl -I http://localhost:3000/fonts/NotoSansThai/NotoSansThai-Variable.ttf
```

**Expected Response:**
```
HTTP/1.1 200 OK
Content-Type: font/ttf
Content-Length: 217004
Cache-Control: public, max-age=31536000, immutable
ETag: "..."
```

**Static Fonts (Fallback):**
```bash
curl -I http://localhost:3000/fonts/NotoSansThai/NotoSansThai-Regular.ttf
```

**Expected Response:**
```
HTTP/1.1 200 OK
Content-Type: font/ttf
Content-Length: 47484
Cache-Control: public, max-age=31536000, immutable
```

---

## Fallback Strategy

### If Variable Font Doesn't Work

**Symptoms:**
- Bold and Regular render identically
- Weights not extracted from Variable font
- @react-pdf/renderer doesn't support Variable fonts

**Fallback Plan:**
1. Remove Variable font from project
2. Keep 47KB static fonts
3. Accept that some complex Thai may overlap
4. Document as known limitation
5. Consider alternative fonts (Sarabun, older Noto Sans Thai releases)

**Alternative Sources:**
- GitHub: `googlefonts/noto-fonts` (older releases may have fuller static fonts)
- Font Squirrel: May have fuller versions
- Adobe Fonts: Requires license check

---

## Performance Impact

### Font Loading

**Before (Static):**
- Regular: 47,484 bytes
- Bold: 47,480 bytes
- **Total: 94,964 bytes**

**After (Variable):**
- Variable: 217,004 bytes (used for both weights)
- **Total: 217,004 bytes**

**Difference:** +122,040 bytes (~120 KB increase)

**Impact:**
- One-time load at PDF generation
- No network transfer (local file)
- Negligible for server-side rendering

### PDF File Size

**Expected Change:**
- Font embedding in PDF: @react-pdf/renderer subsets fonts
- Embedded subset: likely 20-40 KB (only used glyphs)
- PDF size: 30-50 KB (similar to before)

**Benefit:**
- Fuller glyph coverage
- Better rendering quality
- No file size penalty (subsetting handles it)

---

## Recommendations

### Immediate
1. ⏸️ Restart dev server
2. ⏸️ Generate PDF and verify Thai text
3. ⏸️ Check runtime logs for 217KB confirmation

### If Successful
1. Document Variable font as preferred solution
2. Update font download instructions
3. Add SHA-256 verification to CI/CD

### If Unsuccessful (Variable Font Issues)
1. Document renderer limitation
2. Revert to static fonts
3. Accept rendering limitations
4. Explore alternative fonts

---

**Status:** ✅ IMPLEMENTED (awaiting runtime test)  
**Confidence:** MEDIUM (Variable font support uncertain)  
**Fallback:** Available (revert to static 47KB fonts)

---

**Related Documents:**
- FONT_47KB_FORENSICS.md
- CHANGE_LOG_FONTS.txt

