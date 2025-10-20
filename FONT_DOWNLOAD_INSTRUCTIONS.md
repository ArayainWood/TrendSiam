# Thai Font Download Instructions

**CRITICAL:** The PDF text rendering issues are caused by **placeholder/invalid Thai font files**. You must download authentic fonts.

## Current Status

- ❌ `NotoSansThai-Regular.ttf` is a 47KB placeholder (invalid TTF header)
- ❌ `NotoSansThai-Bold.ttf` is a 47KB placeholder (invalid TTF header)  
- ✅ Unicode normalization added to text processing (fixes some issues)
- ⚠️ **Fonts are the PRIMARY fix required**

---

## Method 1: Download from Google Fonts (Recommended)

### Step 1: Visit Google Fonts
Open in browser: https://fonts.google.com/noto/specimen/Noto+Sans+Thai

### Step 2: Download Font Family
1. Click **"Get font"** or **"Download family"** button
2. Extract the ZIP file
3. Locate these files:
   - `NotoSansThai-Regular.ttf`
   - `NotoSansThai-Bold.ttf`

### Step 3: Replace Placeholder Files
Copy the downloaded fonts to **both** locations:

```
frontend/public/fonts/NotoSansThai/NotoSansThai-Regular.ttf
frontend/public/fonts/NotoSansThai/NotoSansThai-Bold.ttf
frontend/public/fonts/NotoSansThai-Regular.ttf
frontend/public/fonts/NotoSansThai-Bold.ttf
```

### Step 4: Verify Installation
```powershell
# Check file size (should be ~160-180 KB each, NOT 47 KB)
Get-Item frontend/public/fonts/NotoSansThai/*.ttf | Select-Object Name, Length

# Expected output:
# Name                      Length
# ----                      ------
# NotoSansThai-Bold.ttf     ~160000-180000
# NotoSansThai-Regular.ttf  ~160000-180000
```

---

## Method 2: Use Alternative Thai Font

If Noto Sans Thai is unavailable, use **Sarabun** (also excellent for Thai):

1. Visit: https://fonts.google.com/specimen/Sarabun
2. Download **Regular** and **Bold** weights
3. Rename files to:
   - `Sarabun-Regular.ttf` → `NotoSansThai-Regular.ttf`
   - `Sarabun-Bold.ttf` → `NotoSansThai-Bold.ttf`
4. Copy to the locations above

---

## Method 3: Download via curl (if available)

**Note:** Google Fonts URLs change frequently. If these don't work, use Method 1.

```bash
# Navigate to project root
cd frontend/public/fonts/NotoSansThai

# Download Regular weight
curl -L "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansThai/NotoSansThai-Regular.ttf" \
  -o NotoSansThai-Regular.ttf

# Download Bold weight
curl -L "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansThai/NotoSansThai-Bold.ttf" \
  -o NotoSansThai-Bold.ttf

# Copy to root directory
cp NotoSansThai-*.ttf ../
```

---

## Verification Steps

### 1. Check File Signature
```powershell
# PowerShell
$bytes = [System.IO.File]::ReadAllBytes("frontend/public/fonts/NotoSansThai/NotoSansThai-Regular.ttf")[0..3]
$hex = ($bytes | ForEach-Object { $_.ToString("X2") }) -join ""
Write-Host "Font signature: $hex"

# Expected: "00010000" (TrueType signature)
# Current (broken): blank or invalid
```

### 2. Check File Size
```powershell
Get-Item frontend/public/fonts/NotoSansThai/*.ttf | ForEach-Object {
    $sizeKB = [math]::Round($_.Length / 1KB, 1)
    Write-Host "$($_.Name): $sizeKB KB"
}

# Expected: 160-180 KB each
# Current (broken): 47.4 KB each (placeholders)
```

### 3. Test in PDF
After replacing fonts:
1. Restart dev server: `npm run dev`
2. Navigate to: http://localhost:3000/weekly-report
3. Click "Download PDF"
4. Open PDF and check:
   - ✅ Thai text renders correctly (not boxes/garbled)
   - ✅ No overlapping characters
   - ✅ Diacritics (tone marks, vowels) positioned correctly
   - ✅ Mixed Thai/English text has proper spacing

---

## Troubleshooting

### Issue: "Font files are still 47 KB"
- **Cause:** Didn't overwrite placeholder files
- **Fix:** Ensure you're copying to the correct paths (see Step 3)

### Issue: "Thai text still shows as boxes"
- **Cause:** Font doesn't contain Thai glyphs
- **Fix:** Use Method 1 (Google Fonts) or Method 2 (Sarabun)

### Issue: "PDF still has overlapping text"
- **Possible causes:**
  1. Fonts not actually replaced (check file size)
  2. Dev server not restarted
  3. Browser cached old PDF
- **Fixes:**
  1. Verify font files are >100 KB
  2. Restart: `npm run dev`
  3. Clear browser cache or use incognito

### Issue: "Characters still overlap slightly"
- **Cause:** Some titles may have zero-width characters
- **Status:** Unicode normalization (added in this fix) should handle most cases
- **Additional fix:** Run diagnostic script to identify problematic titles:
  ```
  cd frontend
  npx tsx scripts/diagnose-pdf-text.ts
  ```

---

## What This Fix Includes

### ✅ Completed
1. **Unicode Normalization** - Added to `pdfTypoV2.ts`:
   - NFC normalization (prevents stacked diacritics)
   - Strips zero-width characters (ZWJ, ZWNJ, etc.)
   - Removes bidirectional controls
   - Sanitizes control characters

2. **Font Download Scripts** - Created:
   - `frontend/scripts/download-thai-fonts.sh` (Linux/Mac)
   - `frontend/scripts/download-thai-fonts.ps1` (Windows)
   - Manual instructions (this file)

3. **Diagnostic Tool** - Created:
   - `frontend/scripts/diagnose-pdf-text.ts`
   - Analyzes titles for problematic characters

### ⏸️ Pending (Your Action)
1. **Download Authentic Fonts** - Use Method 1 above (5 minutes)
2. **Replace Placeholder Files** - Overwrite existing files
3. **Restart Dev Server** - Load new fonts
4. **Test PDF Generation** - Verify fix works

---

## Expected Results After Fix

### Before (Current Issues)
- ❌ "NMlXX(ᄋॆ) Blue Valentine" - garbled characters
- ❌ Overlapping glyphs
- ❌ Misplaced diacritics
- ❌ Thai tone marks stacked incorrectly

### After (With Authentic Fonts)
- ✅ "NMIXX(엔믹스) Blue Valentine" - correct Korean characters
- ✅ Clean text with proper spacing
- ✅ Diacritics positioned correctly
- ✅ Thai tone marks render above correct consonants

---

## Why This Happened

1. **Root Cause:** Placeholder font files (47 KB) have no Thai glyph coverage
2. **Consequence:** @react-pdf/renderer falls back to system fonts mid-line
3. **Result:** Font metrics mismatch causes overlapping/garbled text

**The fix:** Replace placeholders with authentic 160+ KB Noto Sans Thai fonts containing full Thai Unicode coverage.

---

## License Note

**Noto Sans Thai** is licensed under **Open Font License (OFL)**:
- ✅ Free to use commercially
- ✅ Can embed in PDFs
- ✅ No attribution required (but appreciated)
- ⚠️ Cannot sell the font files themselves

---

## Support

If issues persist after downloading fonts:
1. Check file sizes (should be ~160-180 KB each)
2. Verify font signature (see Verification Steps above)
3. Run diagnostic script: `npx tsx scripts/diagnose-pdf-text.ts`
4. Check EXEC_SUMMARY_PDF_TEXT_FIX.md for detailed troubleshooting

---

**Status:** ⏸️ **Awaiting font download** (5-minute task)  
**Priority:** 🔴 **CRITICAL** (blocks PDF functionality)  
**Effort:** ⏱️ **5 minutes** (download + replace files)

---

**Last Updated:** 2025-10-16

