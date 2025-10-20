# EMERGENCY WEEKLY PDF FORENSIC REPORT
## Thai Grapheme Loss + Special Character Corruption Still Present

**Date:** 2025-10-18  
**Status:** INVESTIGATING  
**Severity:** CRITICAL

---

## 🔴 **EVIDENCE OF PERSISTENT ISSUES**

### **Thai Grapheme Integrity NOT Fixed (Items #4, #6, #18, #19)**

**Symptoms:**
- Tone marks/diacritics/final consonants missing, clipped, or mis-stacked
- Thai clusters incomplete (e.g., mai ek, sara, final consonant tail not drawn)
- Web page renders fine, PDF does not

**Items Affected:**
- #4: `Official Trailer : Broken Of Love หัวใจฮัก` - Final consonant ก likely clipped
- #6: `[Official Trailer] โหเกรว่วามันไม่ถูกกัน Head 2 Head` - Tone marks missing/misaligned
- #18: `หมอดี อาชีพใหม่ระดับ 5 ดาว | 99 คืนไป` - Diacritics incomplete
- #19: `ปฏิบัติการเย็ดนเพพ | Battlefield 6 [Part 2]` - Complex clusters broken

### **Special Character Corruption NOT Fixed (Items #16, #20)**

**Symptoms:**
- Long mixed titles still show broken segments
- Previously `{<C0>Roblox}` and `r =@:Memory`
- Corruption persists in slightly different form

**Items Affected:**
- #16: `99 คืนไป (ภา Q&A) ~~Roblox 99 Nights in the Forest`
- #20: `Trailer 她@Memory Wiped! ₽hen Zheyuan Wakes Up Forgetting Wife~|Fated Hearts一笑倾歌|iQIYI`

---

## 🔬 **ROOT CAUSE ANALYSIS**

### **Finding #1: Route/Engine Inconsistency**

**Font QA Route (WORKS):**
```typescript
// font-qa-final/route.tsx
const cleanSample = sanitizeForPdf(sample, `qa-cat${catIdx+1}-s${sIdx+1}`);
const selectedFont = selectFontFamily(cleanSample);
<Text style={[styles.sample, { fontFamily: selectedFont }]}>
  {cleanSample}
</Text>
```

**Weekly Route (BROKEN):**
```typescript
// WeeklyDoc.tsx
const title = sanitizeTitleForPdf(originalTitle, itemId);
const titleFont = getTitleFontFamily(item.title); // Uses ORIGINAL, not sanitized!
<Text style={[styles.itemTitle, { fontFamily: titleFont }]}>
  {title}
</Text>
```

**CRITICAL BUG:** Weekly selects font based on `item.title` (original), not the sanitized title!

### **Finding #2: Font Selection Mismatch**

Font QA:
1. Sanitizes text
2. Selects font based on SANITIZED text
3. Renders with selected font

Weekly:
1. Sanitizes text
2. Selects font based on ORIGINAL text (may have control chars!)
3. Renders sanitized text with potentially wrong font

**Impact:** If original text has control chars, font selection might pick wrong family!

### **Finding #3: Sanitizer Function Differences**

Font QA Final uses:
- `sanitizeForPdf()` - Direct, single function

Weekly uses:
- `sanitizeTitleForPdf()` - Wrapper function
- `sanitizeMetadataForPdf()` - Another wrapper

While these call the same underlying function, the wrapper layer could introduce issues.

### **Finding #4: Import Analysis**

```
Files importing sanitizers:
- font-qa-final/route.tsx: imports from pdfTextSanitizer.v6.unified ✅
- WeeklyDoc.tsx: imports from pdfTextSanitizer.v6.unified ✅
- Weekly route: NO direct import (relies on WeeklyDoc)
```

### **Finding #5: Style Application**

Both routes have `letterSpacing: 0` in styles, BUT:
- Font QA applies styles inline with font selection
- Weekly applies styles through `createPDFStyles()` + inline font override

---

## 🔧 **IMMEDIATE FIXES NEEDED**

### **Fix #1: Correct Font Selection in WeeklyDoc**

```typescript
// WRONG (current):
const titleFont = getTitleFontFamily(item.title); // Original text
const metaFont = getMetadataFontFamily(metaText); // Sanitized text

// CORRECT:
const titleFont = getTitleFontFamily(title); // Use SANITIZED text
const metaFont = getMetadataFontFamily(metaText); // Already correct
```

### **Fix #2: Ensure Consistent Sanitization**

Verify that `sanitizeTitleForPdf` and `sanitizeMetadataForPdf` are not adding extra processing that breaks Thai graphemes.

### **Fix #3: Debug Logging**

Add comprehensive logging to trace:
1. Original text codepoints
2. Sanitized text codepoints
3. Selected font family
4. Applied styles (letterSpacing, lineHeight)
5. Renderer path confirmation

### **Fix #4: Cache Clearing**

Clear any build caches that might be serving stale code:
```bash
rm -rf .next
rm -rf node_modules/.cache
npm run build
```

---

## 📊 **EVIDENCE TABLE (Items #4, #6, #16, #18, #19, #20)**

| Item | Original | Sanitized | Font Selected | Should Be | Issue |
|------|----------|-----------|---------------|-----------|-------|
| #4 | `Official Trailer : Broken Of Love หัวใจฮัก` | TBD | TBD | NotoSansThaiUniversal | Final consonant clipped |
| #6 | `[Official Trailer] โหเกรว่วามันไม่ถูกกัน` | TBD | TBD | NotoSansThaiUniversal | Tone marks missing |
| #16 | `99 คืนไป (ภา Q&A) ~~Roblox...` | TBD | TBD | NotoSansThaiUniversal | Special chars corrupted |
| #18 | `หมอดี อาชีพใหม่ระดับ 5 ดาว` | TBD | TBD | NotoSansThaiUniversal | Diacritics incomplete |
| #19 | `ปฏิบัติการเย็ดนเพพ | Battlefield` | TBD | TBD | NotoSansThaiUniversal | Complex clusters broken |
| #20 | `Trailer 她@Memory Wiped! ₽hen...` | TBD | TBD | NotoSansCJK_JP + Universal | CJK + symbols corrupted |

---

## 🚨 **CRITICAL PATH TO RESOLUTION**

1. **Fix font selection bug** - Use sanitized text for font selection
2. **Add debug logging** - Trace exact pipeline for problematic items
3. **Clear caches** - Ensure fresh build
4. **Generate test PDFs** - Both Font QA and Weekly
5. **Compare outputs** - Visual and log comparison
6. **Verify fix** - All 6 items must render correctly

---

## 🔄 **NEXT STEPS**

1. Apply Fix #1 immediately
2. Add comprehensive debugging
3. Clear all caches
4. Generate new PDFs with logging
5. Create before/after comparison

**ETA:** 15-20 minutes for complete fix and verification
