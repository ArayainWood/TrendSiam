# UNIFIED TEXT POLICY V1
## TrendSiam PDF Text Handling Standard

**Version:** 1.0  
**Date:** 2025-10-18  
**Scope:** ALL PDF text (headers, body, meta, footer)  
**Status:** ACTIVE

---

## 🎯 **POLICY OBJECTIVES**

1. **Correctness:** Thai graphemes, CJK characters, and special symbols render perfectly
2. **Safety:** Zero-tolerance for control characters that cause corruption
3. **Consistency:** Single sanitizer for all PDF text paths
4. **Observability:** Dev-only logging for debugging
5. **Performance:** Minimal overhead (<1ms per text block)

---

## 📋 **POLICY REQUIREMENTS**

### **1. UTF-8 NFC Normalization**

**Requirement:** All text MUST be normalized to NFC (Normalization Form Canonical Composition) before rendering.

**Implementation:**
```typescript
text.normalize('NFC')
```

**Rationale:**
- Ensures Thai SARA AM (อำ) is composed (U+0E33), not decomposed (U+0E4D + U+0E32)
- Combines precomposed characters where possible
- Prevents duplicate combining marks

**Verification:**
```typescript
analyzeString(text).normalizationForm === 'NFC'
```

---

### **2. C0/C1 Control Character Filtering (ZERO-TOLERANCE)**

**Requirement:** Strip ALL C0 and C1 control characters.

**Ranges:**
- **C0:** U+0000–0008, U+000B–001F (skip U+000A=\n)
- **C1:** U+007F–009F (includes U+000F, U+0080–009F)
- **Total:** 65 control characters

**Implementation:**
```typescript
const controlPattern = /[\x00-\x09\x0B-\x1F\x7F-\x9F]/g;
sanitized = text.replace(controlPattern, '');
```

**Logging (dev-only):**
```typescript
if (removed.length > 0) {
  console.log('[pdfTextSanitizer] Control characters removed', {
    itemId: itemId || 'unknown',
    count: removed.length,
    codepoints: removed.join(', ')
  });
}
```

**Rationale:**
- C0/C1 chars are invisible but break PDF rendering
- U+000F (Shift In) caused `{<C0>Roblox}` corruption
- U+0080+ caused `r =@:Memory` corruption

---

### **3. Character Preservation (Allow-List)**

**Requirement:** Preserve ALL legitimate Unicode characters.

**Preserved character classes:**

**Thai (U+0E00–0E7F):**
- Consonants: ก ข ค ง จ ฉ ช ซ ฌ ญ ฎ ฏ ฐ ฑ ฒ ณ ด ต ถ ท ธ น บ ป ผ ฝ พ ฟ ภ ม ย ร ล ว ศ ษ ส ห ฬ อ ฮ
- Vowels: ะ ั า ำ ิ ี ึ ื ุ ู เ แ โ ใ ไ
- Tone marks: ่ ้ ๊ ๋
- Final consonants: ก ง ด ต บ ป ม ย ว น ล ะ ๆ
- Symbols: ฿ ฯ ๏ ๚ ๛

**CJK:**
- CJK Unified Ideographs: U+4E00–9FFF
- CJK Extensions: U+3400–4DBF, U+20000–2EBEF
- CJK Compatibility: U+F900–FAFF
- CJK Symbols: U+3000–303F

**Korean (U+AC00–D7AF):**
- Hangul Syllables: 가 나 다 라 마 바 사 아 자 차 카 타 파 하 etc.

**Symbols:**
- Punctuation: @ # $ % ^ & * ( ) _ + = { } [ ] | \ : ; " ' < > , . ? / ~ ` !
- Currency: ₽ € £ ¥ ₹ ₩ ฿ $
- Math: ± × ÷ ≈ ≠ ≤ ≥ ∞ √ ∑ ∏ ∫
- Arrows: → ← ↑ ↓ ⇒ ⇐ ⇑ ⇓
- Bullets: • ◦ ▪ ▫ ■ □ ▲ △ ▼ ▽
- Technical: © ® ™ § ¶ † ‡ ° ′ ″

**Emoji:**
- Extended_Pictographic: U+1F300–1F9FF
- Emoji sequences (ZWJ families preserved)

**Rationale:**
- Previous sanitizer stripped legitimate chars (@, ₽, 她, etc.)
- Allow-list approach ensures preservation
- No false positives

---

### **4. Script Boundary Handling**

**Requirement:** NO artificial spacing injection at script boundaries.

**Forbidden:**
```typescript
// BAD - breaks grapheme clusters
text.replace(/([\p{Script=Thai}])([\p{Script=Latin}])/gu, '$1 $2');
```

**Correct:**
- Let dynamic font selector handle transitions naturally
- Grapheme clusters remain intact
- Font changes happen per text run, not per character

**Rationale:**
- Artificial spacing detaches combining marks from bases
- Interferes with dynamic font selection
- Breaks Thai diacritics

---

### **5. Hyphenation Policy**

**Requirement:** Hyphenation MUST be OFF for Thai/CJK text.

**Implementation:**
```typescript
// In @react-pdf/renderer styles:
{
  hyphenationCallback: (word) => {
    // No hyphenation for Thai/CJK
    if (/[\u0E00-\u0E7F\u4E00-\u9FFF\uAC00-\uD7AF]/.test(word)) {
      return [word]; // Return whole word
    }
    // Allow for Latin if needed
    return word.split('-'); // Simple split on hyphens
  }
}
```

**Rationale:**
- Thai has no word boundaries (no spaces)
- Hyphenation breaks grapheme clusters
- CJK characters should not be hyphenated

---

### **6. Letter Spacing Policy**

**Requirement:** `letterSpacing` MUST be 0 for Thai/CJK/mixed text.

**Implementation:**
```typescript
// ALL PDF styles:
{
  letterSpacing: 0,  // CRITICAL: Must be 0 for Thai/CJK
}
```

**Rationale:**
- `letterSpacing > 0` separates combining marks from bases in @react-pdf/renderer
- Causes Thai diacritics (่ ้ ๊ ๋ ั ิ ี ึ ื ุ ู) to appear misaligned
- CJK characters also affected

**Verification:**
```typescript
// All styles must have:
assert(style.letterSpacing === 0 || style.letterSpacing === undefined);
```

---

### **7. Font Selection Policy**

**Requirement:** Font selection MUST be grapheme-aware and per text run.

**Implementation:**
```typescript
// Per text block (not per character):
const selectedFont = selectFontFamily(text);
<Text style={{ fontFamily: selectedFont }}>{text}</Text>
```

**Script Priority:**
1. Korean (Hangul) → `NotoSansKR`
2. CJK → `NotoSansJP` (prioritize Japanese)
3. Arabic → `NotoSansArabic`
4. Hebrew → `NotoSansHebrew`
5. Emoji → `NotoEmoji`
6. Symbols → `NotoSansSymbols`
7. Default → `NotoSansThaiUniversal` (Thai + Latin)

**Rationale:**
- @react-pdf/renderer does NOT have automatic font fallback
- Must explicitly specify font per text block
- Grapheme-aware prevents splitting clusters

---

### **8. Layout Metrics Policy**

**Requirement:** Thai text MUST use Thai font metrics.

**Implementation:**
```typescript
// For Thai text runs:
{
  fontFamily: 'NotoSansThaiUniversal',
  lineHeight: 1.4,  // Based on Thai font metrics
  fontSize: 11,
  letterSpacing: 0,
}
```

**Rationale:**
- Using Latin font metrics causes clipping of Thai diacritics
- Thai tone marks extend above/below baseline
- Font metrics include ascender/descender/leading

---

### **9. PDF Embedding Policy**

**Requirement:** PDF subsets MUST include combining marks and complex shaping tables.

**Implementation:**
```typescript
Font.register({
  family: 'NotoSansThaiUniversal',
  fonts: [
    {
      src: '/fonts/NotoSansThai-Regular.ttf',
      fontWeight: 'normal',
      subset: false,  // CRITICAL: Preserve GPOS/GSUB/GDEF tables
    },
    {
      src: '/fonts/NotoSansThai-Bold.ttf',
      fontWeight: 'bold',
      subset: false,
    }
  ]
});
```

**Rationale:**
- `subset: true` drops OpenType shaping tables (GPOS/GSUB/GDEF)
- Thai mark-to-base positioning requires GPOS
- File size increase (~30KB) acceptable for correctness

---

### **10. Logging Policy**

**Requirement:** Dev-only logging for control char removal and diagnostics.

**Implementation:**
```typescript
const ENABLE_SANITIZER_LOGGING = process.env.NODE_ENV === 'development';

function logSanitizer(message: string, data?: any): void {
  if (ENABLE_SANITIZER_LOGGING) {
    console.log(`[pdfTextSanitizer] ${message}`, data || '');
  }
}
```

**Logged events:**
- Control character removal (itemId, count, codepoints)
- Script detection (Thai, Korean, CJK, etc.)
- Font selection per text run

**Production:**
- No verbose logging
- Clean logs for monitoring

---

## ✅ **COMPLIANCE CHECKLIST**

Use this checklist when adding/modifying PDF text handling:

- [ ] Text is NFC normalized before processing
- [ ] C0/C1 control characters are stripped (65 total chars)
- [ ] Legitimate Unicode is preserved (Thai, CJK, Emoji, Symbols)
- [ ] No artificial spacing at script boundaries
- [ ] Hyphenation is OFF for Thai/CJK
- [ ] `letterSpacing = 0` for all Thai/CJK text
- [ ] Font selection is grapheme-aware and per run
- [ ] Thai text uses Thai font metrics
- [ ] PDF fonts registered with `subset: false`
- [ ] Dev-only logging enabled for diagnostics

---

## 🔄 **POLICY ENFORCEMENT**

### **At Code Review:**
- Verify new PDF text paths use `sanitizeForPdf()` from v6 unified sanitizer
- Check that `letterSpacing = 0` in all styles
- Confirm font selection uses `selectFontFamily()`

### **At Testing:**
- Generate Font QA PDF: `/api/weekly/pdf/font-qa-final`
- Verify all 60+ test cases pass
- Check Thai diacritics, Korean, CJK, symbols

### **At Deployment:**
- Run TypeScript type check: `npx tsc --noEmit --skipLibCheck`
- Verify 0 errors
- Test Weekly PDF generation end-to-end

---

## 📊 **POLICY METRICS**

Track these metrics to ensure policy effectiveness:

1. **Control char removal rate:** How many items have C0/C1 chars?
2. **Font selection coverage:** % of text using correct font
3. **Thai grapheme correctness:** % of Thai items rendering correctly
4. **Performance:** Time to sanitize + select font (target: <1ms per block)
5. **TypeScript errors:** 0 errors (always)

---

## 🔗 **REFERENCES**

- **Implementation:** `frontend/src/lib/pdf/pdfTextSanitizer.v6.unified.ts`
- **Font Selector:** `frontend/src/lib/pdf/pdfFontSelector.ts`
- **Styles:** `frontend/src/lib/pdf/pdfStyles.ts`
- **Test Suite:** `frontend/src/app/api/weekly/pdf/font-qa-final/route.tsx`
- **Forensic Report:** `PDF_FINAL_REMEDIATION_FORENSIC_REPORT.md`

---

**Policy Owner:** TrendSiam Engineering  
**Last Updated:** 2025-10-18  
**Next Review:** 2025-11-18 (1 month)

