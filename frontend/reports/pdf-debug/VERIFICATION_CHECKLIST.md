# PDF RENDERING FIX: VERIFICATION CHECKLIST

**Generated:** 2025-10-20 17:04 Bangkok Time  
**Purpose:** Step-by-step commands and procedures to validate fixes  
**Usage:** Run after implementing fixes from FIX_PLAN.md

---

## PRE-VERIFICATION SETUP

### ✅ Environment Preparation

```bash
# 1. Ensure on fix branch
git branch --show-current
# Expected output: fix/pdf-rendering-oct20

# 2. Ensure dev server running
npm run dev
# Wait for: "Ready on http://localhost:3000"

# 3. Create verification output directory
mkdir -p reports/pdf-debug/verification
mkdir -p reports/pdf-debug/verification/screenshots
mkdir -p reports/pdf-debug/verification/logs

# 4. Set environment variables (if needed)
export PDF_DEBUG=true
export NODE_ENV=development
```

---

## PHASE 1: BASELINE COMPARISON

### Test 1.1: Capture Baseline PDF (Before Fixes)

**Purpose:** Establish reference point for comparison

```bash
# Generate baseline PDF (from main branch)
git stash  # Stash current changes
git checkout main
npm run dev &  # Start server in background
sleep 10  # Wait for server ready

# Generate PDF
curl -o reports/pdf-debug/verification/baseline_before.pdf \
  "http://localhost:3000/api/weekly/pdf?ts=$(date +%s)"

# Capture logs
curl "http://localhost:3000/api/weekly/pdf?ts=$(date +%s)" \
  2>&1 | tee reports/pdf-debug/verification/logs/baseline_generation.log

# Stop server
pkill -f "node.*next dev"

# Return to fix branch
git checkout fix/pdf-rendering-oct20
git stash pop
```

**Expected Output:**
- File: `baseline_before.pdf` (~250-350KB)
- Logs: Font registration details, generation time

**Manual Check:**
- [ ] PDF opens without errors
- [ ] All 20 items visible
- [ ] Document problematic items (screenshots recommended)

---

### Test 1.2: Capture Fixed PDF (After Fixes)

**Purpose:** Compare fixes against baseline

```bash
# Ensure on fix branch with changes applied
npm run dev &
sleep 10

# Generate fixed PDF
curl -o reports/pdf-debug/verification/after_fixes.pdf \
  "http://localhost:3000/api/weekly/pdf?ts=$(date +%s)"

# Capture logs
curl "http://localhost:3000/api/weekly/pdf?ts=$(date +%s)" \
  2>&1 | tee reports/pdf-debug/verification/logs/after_fixes_generation.log

# Stop server
pkill -f "node.*next dev"
```

**Expected Output:**
- File: `after_fixes.pdf` (~200-500KB, within 20% of baseline)
- Logs: No errors, "Font integrity verified", "Symbols font force-registered"

**Manual Check:**
- [ ] PDF opens without errors
- [ ] All 20 items visible
- [ ] Compare side-by-side with baseline_before.pdf

---

### Test 1.3: Visual Comparison

**Tools Needed:**
- PDF viewer (Adobe Acrobat, PDF.js, or browser built-in)
- Screenshot tool

**Procedure:**

```bash
# Open both PDFs side-by-side
# macOS: open -a Preview reports/pdf-debug/verification/baseline_before.pdf reports/pdf-debug/verification/after_fixes.pdf
# Windows: start reports/pdf-debug/verification/baseline_before.pdf && start reports/pdf-debug/verification/after_fixes.pdf
# Linux: xdg-open reports/pdf-debug/verification/baseline_before.pdf & xdg-open reports/pdf-debug/verification/after_fixes.pdf &
```

**Items to Compare:**

| Item # | Description | Check | Pass/Fail |
|--------|-------------|-------|-----------|
| 4 | Thai title with complex clusters | Diacritics visible, no clipping | ☐ |
| 6 | Thai title with tone marks | Marks aligned correctly | ☐ |
| 11 | Korean Hangul (if present) | Korean readable, no tofu | ☐ |
| 16 | Special chars (~~, {}) | Characters preserved | ☐ |
| 18 | Thai final consonants | All marks visible | ☐ |
| 19 | Thai vowels above/below | No overlap | ☐ |
| 20 | CJK + symbols (她, @, ₽) | All characters render | ☐ |
| Header | "รายงานแนวโน้มสัปดาห์" | Correct spacing | ☐ |
| Footer | "รายงานนี้สร้าง...อัตโนมัติ" | No stray marks | ☐ |
| Metadata | "หมวดหมู่: บันเทิง" | Correct category labels | ☐ |

**Screenshot Locations:**
- Baseline problems: `reports/pdf-debug/verification/screenshots/before_item_{N}.png`
- After fixes: `reports/pdf-debug/verification/screenshots/after_item_{N}.png`

**Pass Criteria:** 8/10 or more items show improvement

---

## PHASE 2: AUTOMATED VERIFICATION

### Test 2.1: Font Integrity Check

**Purpose:** Verify fonts not corrupted during fixes

```bash
# Run font verification script
npm run dev &
sleep 10

# Check server logs for font integrity messages
curl "http://localhost:3000/api/weekly/pdf?ts=$(date +%s)" 2>&1 | \
  grep -E "(Font integrity|SHA-256|corrupted)" | \
  tee reports/pdf-debug/verification/logs/font_integrity.log

pkill -f "node.*next dev"
```

**Expected Output:**
```
[fontResolver] ✅ Font integrity verified (SHA-256 match)
```

**Check:**
- [ ] "Font integrity verified" appears in logs
- [ ] No "corrupted" warnings
- [ ] No "SHA-256 mismatch" errors

---

### Test 2.2: Font Registration Validation

**Purpose:** Confirm all expected fonts loaded

```bash
# Start server
npm run dev &
sleep 10

# Generate PDF and capture font registration logs
curl "http://localhost:3000/api/weekly/pdf?ts=$(date +%s)" 2>&1 | \
  grep -A 5 "Font system registered" | \
  tee reports/pdf-debug/verification/logs/font_registration.log

pkill -f "node.*next dev"
```

**Expected Output:**
```
[weekly-pdf] Font system registered: {
  success: true,
  primaryFamily: 'NotoSansThaiUniversal',
  loadedFamilies: [ 'NotoSansThaiUniversal', 'NotoSansSymbols' ],
  detectedScripts: [ 'Thai', 'Latin', 'Symbols' ],
  fallbackMode: false,
  message: 'Registered 2 font families based on snapshot content'
}
```

**Check:**
- [ ] `success: true`
- [ ] `fallbackMode: false` (NOT true)
- [ ] `loadedFamilies` includes at least 2 families
- [ ] `detectedScripts` matches snapshot content

**If fallbackMode: true:**
- ⚠️ CRITICAL: Fixes not working correctly, CJK/Korean/Emoji will fail
- Action: Review Phase 3.1 of FIX_PLAN.md

---

### Test 2.3: Text Sanitization Logs

**Purpose:** Verify sanitizer not over-removing characters

```bash
# Enable sanitizer logging (set NODE_ENV=development in .env.local)
npm run dev &
sleep 10

# Generate PDF and capture sanitizer logs
curl "http://localhost:3000/api/weekly/pdf?ts=$(date +%s)" 2>&1 | \
  grep -E "(pdfTextSanitizer|Control characters)" | \
  tee reports/pdf-debug/verification/logs/sanitizer.log

pkill -f "node.*next dev"
```

**Expected Output:**
```
[pdfTextSanitizer] Control characters removed {
  itemId: 'item-16-...',
  count: 0,  // ← Should be 0 (DB already clean)
  codepoints: ''
}
```

**Check:**
- [ ] `count: 0` for all items (DB verified clean Oct 18)
- [ ] If count > 0: Investigate why control chars present (shouldn't be)
- [ ] No "orphan mark removed" messages (indicates over-sanitization)

---

### Test 2.4: Performance Metrics

**Purpose:** Ensure fixes didn't degrade performance

```bash
# Warm up (font caching)
npm run dev &
sleep 10
curl "http://localhost:3000/api/weekly/pdf" > /dev/null 2>&1

# Test 1
time curl -o reports/pdf-debug/verification/perf_run_1.pdf \
  "http://localhost:3000/api/weekly/pdf?ts=$(date +%s)" 2>&1

# Test 2
time curl -o reports/pdf-debug/verification/perf_run_2.pdf \
  "http://localhost:3000/api/weekly/pdf?ts=$(date +%s)" 2>&1

# Test 3
time curl -o reports/pdf-debug/verification/perf_run_3.pdf \
  "http://localhost:3000/api/weekly/pdf?ts=$(date +%s)" 2>&1

pkill -f "node.*next dev"

# Calculate average
ls -lh reports/pdf-debug/verification/perf_run_*.pdf
# Note file sizes

# Average time (from "time" output)
```

**Metrics to Record:**

| Metric | Run 1 | Run 2 | Run 3 | Average | Baseline | Acceptable |
|--------|-------|-------|-------|---------|----------|------------|
| Time (seconds) | | | | | ~2-3s | <5s |
| File size (KB) | | | | | ~300KB | 200-500KB |

**Pass Criteria:**
- [ ] Average time < 5 seconds
- [ ] File size within 200-500KB range
- [ ] No significant regression vs baseline (>50% increase)

---

## PHASE 3: FONT QA STRESS TEST

### Test 3.1: Run Font QA Test Route

**Purpose:** Test edge cases not in production snapshot

```bash
# Start server
npm run dev &
sleep 10

# Generate Font QA PDF
curl -o reports/pdf-debug/verification/font_qa_final.pdf \
  "http://localhost:3000/api/weekly/pdf/font-qa-final?ts=$(date +%s)"

pkill -f "node.*next dev"
```

**Expected Output:**
- File: `font_qa_final.pdf` (~50-100KB, test data smaller than real snapshot)
- Contains 60+ test samples across 7 categories

**Manual Inspection:**

| Category | Sample | Expected | Pass/Fail |
|----------|--------|----------|-----------|
| Thai Grapheme | "ผู้กี่สุด ในชีวิต" | All marks visible | ☐ |
| Thai Complex | "เขาญที่สุด" | Marks aligned | ☐ |
| Korean | "NMIXX(엔믹스)" | Korean readable | ☐ |
| CJK | "你好世界 Chinese" | CJK ideographs | ☐ |
| Emoji | "🤯 🔥 ✨" | Emoji visible | ☐ |
| Symbols | "@ # $ % ₽ € £" | All symbols | ☐ |
| Mixed | "Thai + Latin + 한글" | All scripts together | ☐ |

**Pass Criteria:** 6/7 or 7/7 categories render correctly

---

### Test 3.2: Specific Problem Items

**Purpose:** Verify reported issues fixed

**Test Samples:**

```bash
# These are the exact strings from user report
# Test them individually in Font QA PDF or custom test

# Item #4 pattern
"Official Trailer | Unlimited Love The Series บริษัทนี้ไม่มีจำกัด [ENG SUB]"

# Item #6 pattern
"หน้าเบลอหลังชัด (Foreground) - LYKN [ OFFICIAL MV ]"

# Item #16 pattern
"99 คืนไป (ภา Q&A) ~~Roblox 99 Nights in the Forest"

# Item #20 pattern
"Trailer 她@Memory Wiped! ₽hen Zheyuan Wakes Up Forgetting Wife~|Fated Hearts一笑倾歌|iQIYI"

# Footer pattern
"รายงานนี้สร้างโดยระบบ TrendSiam อัตโนมัติ"

# Metadata pattern
"หมวดหมู่: บันเทิง | ช่อง: LOUD Official | คะแนน: 95.9"
```

**Verification Method:**

1. Open `font_qa_final.pdf`
2. Search for each pattern (Ctrl+F / Cmd+F)
3. Visual inspection:
   - [ ] Thai diacritics complete (no missing/clipped marks)
   - [ ] Special characters preserved (~~, @, ₽, {}, ~, |)
   - [ ] CJK characters visible (她, 一笑倾歌)
   - [ ] No random extra symbols or artifacts

**Document Issues:**
- If any test fails, screenshot and add to: `reports/pdf-debug/verification/screenshots/failed_test_{N}.png`

---

## PHASE 4: REGRESSION TESTING

### Test 4.1: Weekly Report Web UI

**Purpose:** Ensure fixes didn't break web interface

```bash
# Start server
npm run dev &
sleep 10

# Open in browser (manual test)
# macOS: open http://localhost:3000/weekly-report
# Windows: start http://localhost:3000/weekly-report
# Linux: xdg-open http://localhost:3000/weekly-report
```

**Checklist:**
- [ ] Page loads without errors
- [ ] 20+ items displayed in list
- [ ] Thai titles readable (proper font, no garbling)
- [ ] Categories/channels shown correctly
- [ ] Popularity scores visible
- [ ] "Download PDF" button present and clickable
- [ ] Click PDF button → PDF downloads successfully
- [ ] No console errors (open DevTools → Console)

**If Failures:**
- Check console for errors
- Verify font files not corrupted
- Ensure only PDF-related changes made, not UI components

---

### Test 4.2: Story Details Modal

**Purpose:** Verify modal still works after PDF fixes

```bash
# Browser already open to /weekly-report from Test 4.1
```

**Procedure:**
1. Click any item card in weekly report
2. Modal opens with story details

**Checklist:**
- [ ] Modal opens without errors
- [ ] Thai title renders correctly
- [ ] English summary (if present) shows
- [ ] Metrics visible (views, likes, comments)
- [ ] AI Opinion section loads
- [ ] Score Details section loads
- [ ] "Close" button works
- [ ] No console errors

---

### Test 4.3: Home Page

**Purpose:** Ensure home page unaffected by PDF changes

```bash
# Open home page
# macOS: open http://localhost:3000
# Windows: start http://localhost:3000
# Linux: xdg-open http://localhost:3000
```

**Checklist:**
- [ ] Page loads without errors
- [ ] Top stories displayed
- [ ] Thai titles readable
- [ ] Images load (for Top-3)
- [ ] Popularity scores visible
- [ ] Language toggle works (TH/EN)
- [ ] No console errors

---

### Test 4.4: Alternative PDF Routes

**Purpose:** Check if other PDF endpoints affected

```bash
# Test pdf2 route (HTML-based PDF)
curl -o reports/pdf-debug/verification/pdf2_test.pdf \
  "http://localhost:3000/api/weekly/pdf2?format=pdf"

# Test debug route (if exists)
curl -o reports/pdf-debug/verification/pdf_debug.pdf \
  "http://localhost:3000/api/weekly/pdf/debug"

pkill -f "node.*next dev"
```

**Checklist:**
- [ ] pdf2 route: Generates successfully OR returns 404 (acceptable if unused)
- [ ] debug route: Generates successfully OR returns 404 (acceptable if unused)
- [ ] If errors: Check if routes share code with fixed route

---

## PHASE 5: CROSS-PLATFORM VERIFICATION

### Test 5.1: Different PDF Viewers

**Purpose:** Ensure PDF renders correctly across viewers

**Viewers to Test:**

1. **Adobe Acrobat Reader:**
   - Download from: https://get.adobe.com/reader/
   - Open: `after_fixes.pdf`
   - Check: Thai text, CJK, symbols

2. **Browser Built-in (Chrome/Firefox/Edge):**
   - Open: `after_fixes.pdf` in browser
   - Check: Same as above

3. **PDF.js (Web-based):**
   - Use: https://mozilla.github.io/pdf.js/web/viewer.html
   - Upload: `after_fixes.pdf`
   - Check: Same as above

4. **System Default (macOS Preview, Windows Edge, Linux Evince):**
   - Double-click: `after_fixes.pdf`
   - Check: Same as above

**Checklist:**

| Viewer | Thai OK | CJK OK | Symbols OK | Overall |
|--------|---------|--------|------------|---------|
| Adobe Acrobat | ☐ | ☐ | ☐ | ☐ |
| Chrome/Firefox | ☐ | ☐ | ☐ | ☐ |
| PDF.js | ☐ | ☐ | ☐ | ☐ |
| System Default | ☐ | ☐ | ☐ | ☐ |

**Pass Criteria:** 3/4 or 4/4 viewers render correctly

**Note:** Minor variations acceptable (font hinting, anti-aliasing) but text must be readable

---

### Test 5.2: Different Operating Systems

**Purpose:** Verify platform independence

**Platforms (if available):**

1. **Windows 10/11:**
   ```cmd
   npm run dev
   curl -o weekly.pdf http://localhost:3000/api/weekly/pdf
   start weekly.pdf
   ```

2. **macOS:**
   ```bash
   npm run dev
   curl -o weekly.pdf http://localhost:3000/api/weekly/pdf
   open weekly.pdf
   ```

3. **Linux (Ubuntu/Debian):**
   ```bash
   npm run dev
   curl -o weekly.pdf http://localhost:3000/api/weekly/pdf
   xdg-open weekly.pdf
   ```

**Checklist:**
- [ ] PDF generates on all available platforms
- [ ] File sizes consistent (±10%) across platforms
- [ ] Visual rendering consistent

**Note:** Only test platforms you have access to; cross-platform issues unlikely for PDF generation

---

## PHASE 6: DATABASE AUDIT VERIFICATION

### Test 6.1: Confirm Database Still Clean

**Purpose:** Ensure fixes didn't introduce data corruption

```bash
# Re-run Oct 18 database audit
cd frontend
npm run db:audit

# Check output
cat reports/db/phase1_$(date +%Y-%m-%d)_*.json | \
  grep -E "(control_chars|normalization_needed)" | \
  tee reports/pdf-debug/verification/logs/db_reaudit.log
```

**Expected Output:**
```json
{
  "items_with_control_chars": 0,
  "items_needing_nfc": 0,
  "percentage_control_chars": 0.00,
  "percentage_nfc_needed": 0.00
}
```

**Checklist:**
- [ ] `items_with_control_chars: 0`
- [ ] `items_needing_nfc: 0`
- [ ] Database integrity maintained

**If Non-Zero Values:**
- ⚠️ CRITICAL: PDF fixes may have accidentally modified database
- Action: Restore database from backup, review code changes

---

## PHASE 7: FINAL SIGN-OFF

### Completion Criteria

**All phases must pass:**

| Phase | Tests | Pass | Fail | Notes |
|-------|-------|------|------|-------|
| Phase 1: Baseline | 3 | ☐ | ☐ | Visual comparison critical |
| Phase 2: Automated | 4 | ☐ | ☐ | Logs must show success |
| Phase 3: Font QA | 2 | ☐ | ☐ | 55/60+ test cases |
| Phase 4: Regression | 4 | ☐ | ☐ | Zero UI breaks |
| Phase 5: Cross-Platform | 2 | ☐ | ☐ | 3/4+ viewers OK |
| Phase 6: Database | 1 | ☐ | ☐ | Must be clean |

**Overall Pass:** 18/20+ individual tests pass

---

### Generate Verification Report

```bash
# Create final report
cat > reports/pdf-debug/VERIFICATION_REPORT.md << EOF
# PDF Rendering Fix: Verification Report

**Date:** $(date +"%Y-%m-%d %H:%M:%S %Z")
**Branch:** $(git branch --show-current)
**Commit:** $(git rev-parse --short HEAD)

## Test Results

### Phase 1: Baseline Comparison
- Visual comparison: [PASS/FAIL]
- Items improved: [X/10]
- Screenshots: See verification/screenshots/

### Phase 2: Automated Verification
- Font integrity: [PASS/FAIL]
- Font registration: [PASS/FAIL]
- Text sanitization: [PASS/FAIL]
- Performance: [PASS/FAIL]

### Phase 3: Font QA
- Test cases passed: [X/60]
- Edge cases: [PASS/FAIL]

### Phase 4: Regression Testing
- Web UI: [PASS/FAIL]
- Modal: [PASS/FAIL]
- Home: [PASS/FAIL]

### Phase 5: Cross-Platform
- Viewers: [X/4]
- Platforms: [X/available]

### Phase 6: Database
- Integrity: [PASS/FAIL]

## Overall Status
[PASS/FAIL] - [X/20] tests passed

## Issues Found
1. [Issue description if any]
2. ...

## Recommendations
1. [Recommendation if any]
2. ...

## Sign-Off
Verified by: [Name]
Date: $(date +"%Y-%m-%d")
Approved for production: [YES/NO]
EOF

# Display report
cat reports/pdf-debug/VERIFICATION_REPORT.md
```

---

### Cleanup Verification Artifacts

```bash
# Keep only essential files
cd reports/pdf-debug/verification

# Compress screenshots
tar -czf screenshots.tar.gz screenshots/
rm -rf screenshots/

# Compress PDFs (keep originals for reference)
tar -czf pdfs.tar.gz *.pdf
# Do NOT delete PDFs yet (may need for review)

# Keep logs as-is (small files)
```

---

## TROUBLESHOOTING GUIDE

### Issue: "Font integrity check FAILED"

**Cause:** Font files corrupted or wrong version

**Fix:**
```bash
# Re-download fonts from Google Fonts
cd frontend/public/fonts/NotoSansThai
rm NotoSansThai-Regular.ttf NotoSansThai-Bold.ttf

# Download fresh copies
curl -o NotoSansThai-Regular.ttf \
  "https://fonts.gstatic.com/s/notosansthai/v18/iJWnBXeUZi_OHPqn4wq6hQ2_hbJ1xyN9wd43SofNWcd1MKVQt_So_9CdU5RspzF-QRvzzXg.ttf"

curl -o NotoSansThai-Bold.ttf \
  "https://fonts.gstatic.com/s/notosansthai/v18/iJWnBXeUZi_OHPqn4wq6hQ2_hbJ1xyN9wd43SofNWcd1MKVQt_So_9CdU5RspzHUQRvzzXg.ttf"

# Verify integrity
shasum -a 256 NotoSansThai-Regular.ttf
# Expected: 9acb585d8662ca4ed1b1cf5889dfa1393f8555103b3986e1ea1e3af4faef70bd

shasum -a 256 NotoSansThai-Bold.ttf
# Expected: 0be544f347b3ab6382bdc2b555a783727a4858a3dc140670406924670967d916
```

---

### Issue: "fallbackMode: true" in logs

**Cause:** Font registration failed, only Thai fonts loaded

**Fix:**
1. Check fonts_provenance.json exists: `ls frontend/public/fonts/fonts_provenance.json`
2. If missing: Re-generate with `npm run build:font-manifest`
3. Check font families present: `ls frontend/public/fonts/`
4. Ensure NotoSansSymbols, NotoSansKR, NotoSansJP directories exist
5. Re-run verification

---

### Issue: Korean/CJK still render as tofu

**Cause:** Font selector not finding registered fonts

**Fix:**
1. Check Phase 2.2 logs: Verify fonts actually registered
2. If registered: Check pdfFontSelector.ts availability validation
3. If not registered: Review Phase 3.1 of FIX_PLAN.md
4. Temporary workaround: Use NotoSansThaiUniversal for all (has basic Hangul)

---

### Issue: Performance degradation (>5s)

**Cause:** Font loading overhead or subsetting issues

**Fix:**
1. Check font file sizes: `du -sh frontend/public/fonts/*/`
2. If massive (>1GB): Remove unused font families
3. Optimize: Pre-subset fonts (see FIX_PLAN.md Phase 3.2)
4. Cache fonts: Consider CDN or local caching strategy

---

### Issue: Regression (web UI broken)

**Cause:** Shared code between PDF and UI accidentally modified

**Fix:**
1. Identify broken component: Check console errors
2. Review changes: `git diff main -- frontend/src/lib/pdf/`
3. Ensure only PDF-specific files modified
4. If UI files changed: Revert UI changes, keep PDF fixes separate

---

**END OF VERIFICATION CHECKLIST**

---

## QUICK REFERENCE: COMMAND SUMMARY

```bash
# Generate PDF
curl -o test.pdf "http://localhost:3000/api/weekly/pdf?ts=$(date +%s)"

# Check logs
curl "http://localhost:3000/api/weekly/pdf" 2>&1 | grep -E "(Font|Error|WARN)"

# Performance test
time curl -o perf.pdf "http://localhost:3000/api/weekly/pdf"

# Database audit
npm run db:audit

# TypeScript check
npm run type-check

# Build check
npm run build
```

---

**Use this checklist systematically. Do NOT skip steps.**

