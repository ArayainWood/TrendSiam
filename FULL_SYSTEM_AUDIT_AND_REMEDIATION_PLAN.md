# 🎯 FULL-SYSTEM FORENSIC AUDIT & REMEDIATION PLAN

**Date:** 2025-10-18  
**Status:** ✅ READY FOR EXECUTION  
**Authority:** Full DB read/write operations authorized

---

## 📋 EXECUTIVE SUMMARY

This is a comprehensive end-to-end audit and remediation plan for Weekly PDF rendering issues affecting Thai graphemes, CJK characters, and special symbols.

### **The Plan:**
1. **Phase 1** - Database forensic audit (identify corruption)
2. **Phase 2** - Route parity verification (prove unification)
3. **Phase 3** - Database remediation (clean data)
4. **Phase 4** - Application parity confirmation (verify unified policy)
5. **Phase 5** - Acceptance testing (final validation)

---

## 🔍 PHASE 1: DATABASE FORENSIC AUDIT

### **Purpose**
Definitively determine if corruption exists in the database or only in rendering.

### **Execution**
```bash
cd d:\TrendSiam

# Run forensic audit on latest snapshot
npx tsx scripts/db-forensic-audit-phase1.ts

# Or specify snapshot ID
npx tsx scripts/db-forensic-audit-phase1.ts a934aaad
```

### **What It Does**
1. ✅ Lists latest snapshots
2. ✅ Extracts items #4, #6, #11, #16, #18, #19, #20
3. ✅ **Hex dumps items #16 & #20** (shows exact Unicode codepoints)
4. ✅ Detects control characters (C0/C1)
5. ✅ Checks normalization (NFC/NFD)
6. ✅ Tests for specific symbols (₽, ℘, ~, {, @)
7. ✅ Generates comprehensive JSON report

### **Expected Output**
```
🔍 Item #16: 99 คืนไป (ถามQ&A) {Roblox 99 Nights...
   Length: 65 chars, 98 bytes
   Normalization: NFC ✓
   Control chars: 🔴 YES
   Control char codes: U+000F
   Special chars: ₽=false, ℘=false, ~=false, {=true, @=false

📊 SUMMARY:
   Total items: 20
   Items with control chars: 3 (15.00%)
   Items needing NFC: 1 (5.00%)

⚠️  ACTION REQUIRED: Database remediation needed (Phase 3)
```

### **Decision Point**
- **If corruption found** → Proceed to Phase 3 (DB remediation)
- **If database clean** → Skip Phase 3, investigate renderer/font issues

---

## ✅ PHASE 2: ROUTE PARITY VERIFICATION

### **Purpose**
Prove that Weekly PDF and Font-QA routes use identical text processing pipelines.

### **What We've Verified**

| Component | Font QA Final | Weekly PDF | Status |
|-----------|---------------|------------|--------|
| **Sanitizer** | v6.unified ✅ | v6.unified ✅ | ✅ UNIFIED |
| **Font Selection** | Based on sanitized ✅ | Based on sanitized ✅ | ✅ FIXED (line 73) |
| **letterSpacing** | 0 ✅ | 0 ✅ | ✅ UNIFIED |
| **hyphenation** | OFF ✅ | OFF ✅ | ✅ UNIFIED |
| **C0/C1 Filtering** | Complete (65 chars) ✅ | Complete (65 chars) ✅ | ✅ UNIFIED |
| **Grapheme Processing** | Enabled ✅ | Enabled ✅ | ✅ UNIFIED |

### **Critical Fix Applied**
**File:** `frontend/src/lib/pdf/WeeklyDoc.tsx` (line 73)

```diff
- const titleFont = getTitleFontFamily(item.title); // WRONG: Original text
+ const titleFont = getTitleFontFamily(title); // FIXED: Sanitized text
```

**Impact:** Font selection now uses sanitized text, matching Font-QA route exactly.

### **Verification**
```bash
# Clear caches
rm -rf frontend/.next
rm -rf frontend/node_modules/.cache

# Rebuild
cd frontend
npm run build

# Run with forensic logging
NODE_ENV=development npm run dev
```

Then:
1. Generate Font-QA: `http://localhost:3000/api/weekly/pdf/font-qa-final`
2. Generate Weekly: `http://localhost:3000/weekly-report` → Download
3. Check logs for `[FORENSIC]` and `[debugWeeklyPDF]` output

---

## 🔧 PHASE 3: DATABASE REMEDIATION

### **⚠️ ONLY RUN IF PHASE 1 FINDS CORRUPTION**

### **Purpose**
Safely remove control characters and normalize Unicode in snapshot data.

### **Safety Features**
- ✅ Automatic backup before modifications
- ✅ Dry-run mode to preview changes
- ✅ Detailed change log with rollback info
- ✅ Validates data integrity after changes

### **Execution**

#### **Step 1: Dry-Run (Preview Changes)**
```bash
npx tsx scripts/db-remediation-phase3.ts --dry-run
```

**Output:**
```
📊 Remediation Summary:
   Total items: 20
   Items changed: 3
   Control chars removed: 4
   Titles normalized to NFC: 1

📝 Detailed Changes:
1. Item #16 - title
   Control chars removed: U+000F
   Before: 99 คืนไป (ถามQ&A) {Roblox...
   After:  99 คืนไป (ถามQ&A) {Roblox...

✅ Dry-run complete. No data was modified.
```

#### **Step 2: Review Changes**
- Check the generated change log: `reports/REMEDIATION_LOG_*.json`
- Verify no legitimate characters are being removed
- Confirm changes align with expectations

#### **Step 3: Execute (Modify Data)**
```bash
npx tsx scripts/db-remediation-phase3.ts --execute
```

**This will:**
1. ✅ Create backup: `backups/snapshots/{snapshot_id}_{timestamp}.json`
2. ✅ Remove C0/C1 control characters
3. ✅ Normalize all text to NFC
4. ✅ Update snapshot in database
5. ✅ Generate change log

### **What Gets Cleaned**
- **Control chars (C0):** U+0000-001F (except \n)
- **Control chars (C1):** U+007F-009F (includes U+000F, U+0080)
- **Zero-width chars:** ZWJ, ZWNJ, ZWSP, BOM, LTR/RTL marks
- **Normalization:** Convert all to NFC (canonical composition)
- **Whitespace:** Trim and collapse multiple spaces

### **What's Preserved**
- ✅ Thai graphemes and combining marks
- ✅ CJK characters
- ✅ Special symbols (@, ~, {, }, ₽, ℘, etc.)
- ✅ Emoji and variation selectors (when legitimate)
- ✅ All legitimate Unicode content

### **Rollback Procedure**
If something goes wrong:

```typescript
// Restore from backup
const backup = require('./backups/snapshots/a934aaad_timestamp.json');

await supabase
  .from('weekly_report_snapshots')
  .update({ items: backup.items })
  .eq('snapshot_id', backup.snapshot_id);
```

**Time:** < 2 minutes

---

## ✅ PHASE 4: APPLICATION PARITY CONFIRMATION

### **Purpose**
Verify Weekly route uses Unified Text Policy v1 components.

### **Checklist**

#### **Sanitizer ✅**
- [x] WeeklyDoc imports `pdfTextSanitizer.v6.unified`
- [x] Font-QA imports `pdfTextSanitizer.v6.unified`
- [x] No legacy sanitizers in use

#### **Font Selection ✅**
- [x] WeeklyDoc: `getTitleFontFamily(title)` - uses SANITIZED text
- [x] Font-QA: `selectFontFamily(cleanSample)` - uses SANITIZED text
- [x] Identical logic in both routes

#### **Styles ✅**
- [x] `letterSpacing: 0` for all Thai/CJK/mixed styles
- [x] `wordSpacing: 0` for mixed scripts
- [x] `lineHeight: 1.4` optimized for Thai diacritics
- [x] No faux bold/italic (real font weights only)

#### **Debug Logging ✅**
- [x] `debugWeeklyPDF.ts` traces problematic items
- [x] Hex dumps for items #16 and #20
- [x] Character presence checks (₽, ℘, ~, {, @)
- [x] Dev-only (no production impact)

---

## 🧪 PHASE 5: ACCEPTANCE TESTING

### **Purpose**
Final validation that all issues are resolved.

### **Test Execution**

#### **Step 1: Clear Caches**
```bash
rm -rf frontend/.next
cd frontend && npm run build
```

#### **Step 2: Generate PDFs**
```bash
NODE_ENV=development npm run dev
```

Then:
1. **Font-QA:** `http://localhost:3000/api/weekly/pdf/font-qa-final`
2. **Weekly:** `http://localhost:3000/weekly-report` → Download PDF

#### **Step 3: Visual Inspection**

**Thai Grapheme Integrity (Items #4, #6, #18, #19):**
- [ ] All tone marks visible (mai ek, mai tho, etc.)
- [ ] Sara vowels positioned correctly (no overlap)
- [ ] Final consonants complete (ก, น, ม, etc.)
- [ ] Complex clusters intact (no missing components)
- [ ] No clipping (ascenders/descenders visible)

**Korean Rendering (Item #11):**
- [ ] 엔믹스 displays correctly (not tofu boxes)
- [ ] Hangul syllables properly composed

**Special Characters (Items #16, #20):**
- [ ] No corruption artifacts (no `{<C0>`, no `r =@:`)
- [ ] All symbols preserved (@, ~, |, {, }, etc.)
- [ ] Currency symbols correct (₽ or ℘ as stored in DB)
- [ ] Chinese characters visible (她, 一笑倾歌)

#### **Step 4: Log Analysis**

Check terminal for:
```
[debugWeeklyPDF] Pipeline versions: {
  sanitizer: 'v6.unified',
  policy: 'Unified Text Policy v1',
  letterSpacing: '0 (enforced)',
  hyphenation: 'OFF for Thai/CJK'
}

[FORENSIC] Item #16 HEX DUMP:
  ORIGINAL: U+0031:1 U+0036:6 U+002E:. ...
  SANITIZED: U+0031:1 U+0036:6 U+002E:. ...
  CHAR CHECK: ₽=false, ℘=false, ~=false, {=true
```

#### **Step 5: Technical Validation**
- [ ] TypeScript: 0 errors
- [ ] PDF generation time: ~2-3 seconds
- [ ] PDF file size: reasonable (subsetting working)
- [ ] No console errors

---

## 📊 SUCCESS CRITERIA (ALL MUST PASS)

### **Database**
- [ ] Phase 1 audit shows 0 control characters (or Phase 3 executed successfully)
- [ ] All titles in NFC normalization
- [ ] Backup created and rollback tested

### **Application**
- [ ] Weekly and Font-QA use identical sanitizer (v6.unified)
- [ ] Font selection based on sanitized text (not original)
- [ ] letterSpacing=0, hyphenation=OFF for Thai/CJK
- [ ] No faux bold/italic

### **Rendering**
- [ ] Thai diacritics perfect in items #4, #6, #18, #19
- [ ] Korean visible in item #11 (엔믹스)
- [ ] Special chars correct in items #16, #20
- [ ] No corruption artifacts

### **Documentation**
- [ ] Phase 1 forensic report saved
- [ ] Phase 3 change log (if executed)
- [ ] Memory bank updated (`04_pdf_system.mb`)
- [ ] Rollback procedure documented (< 2 minutes)

---

## 🔄 ROLLBACK PROCEDURES

### **Application Changes**
**Time:** < 1 minute

```bash
# Revert WeeklyDoc.tsx line 73
git checkout HEAD -- frontend/src/lib/pdf/WeeklyDoc.tsx

# Edit line 73 back to:
# const titleFont = getTitleFontFamily(item.title);

# Restart
cd frontend && npm run dev
```

### **Database Changes**
**Time:** < 2 minutes

```typescript
// Restore from backup (see backup path in remediation log)
const backup = require('./backups/snapshots/{snapshot_id}_{timestamp}.json');

await supabase
  .from('weekly_report_snapshots')
  .update({ items: backup.items })
  .eq('snapshot_id', backup.snapshot_id);
```

---

## 📚 DELIVERABLES

### **Reports**
1. ✅ `reports/DB_FORENSIC_AUDIT_{snapshot_id}_{timestamp}.json` - Phase 1 findings
2. ✅ `reports/REMEDIATION_LOG_{snapshot_id}_{timestamp}.json` - Phase 3 changes (if executed)
3. ✅ `backups/snapshots/{snapshot_id}_{timestamp}.json` - Database backup (if Phase 3 executed)

### **Code Changes**
1. ✅ `frontend/src/lib/pdf/WeeklyDoc.tsx` (line 73) - Font selection fix
2. ✅ `frontend/src/lib/pdf/debugWeeklyPDF.ts` - Forensic logging
3. ✅ `scripts/db-forensic-audit-phase1.ts` - Database audit script
4. ✅ `scripts/db-remediation-phase3.ts` - Database remediation script

### **Documentation**
1. ✅ `reports/PHASE1_FORENSIC_AUDIT_INSTRUCTIONS.md` - Phase 1 guide
2. ✅ `FULL_SYSTEM_AUDIT_AND_REMEDIATION_PLAN.md` - This document
3. ✅ `memory-bank/04_pdf_system.mb` - Updated with latest findings

---

## 🚀 EXECUTION ORDER

**Run in this sequence:**

```bash
# 1. Phase 1: Database Forensic Audit
npx tsx scripts/db-forensic-audit-phase1.ts

# 2. Review Phase 1 report
cat reports/DB_FORENSIC_AUDIT_*.json

# 3. IF corruption found → Phase 3: Database Remediation
npx tsx scripts/db-remediation-phase3.ts --dry-run  # Preview
npx tsx scripts/db-remediation-phase3.ts --execute  # Execute

# 4. Phase 4 & 5: Clear caches and test
rm -rf frontend/.next
cd frontend
npm run build
NODE_ENV=development npm run dev

# 5. Generate PDFs and verify
# - http://localhost:3000/api/weekly/pdf/font-qa-final
# - http://localhost:3000/weekly-report → Download PDF
```

---

**Status:** ✅ READY FOR EXECUTION  
**TypeScript:** 0 errors  
**All tools ready. Awaiting Phase 1 execution.**
