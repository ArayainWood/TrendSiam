# Phase 1: Database Forensic Audit Report

**Purpose:** Comprehensive analysis of database content to identify root causes of PDF rendering issues

**Status:** Ready to execute

**Safety:** Read-only operations, no data modifications

---

## How to Run

### Prerequisites
```bash
# Ensure you have service role key in .env
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Service role, not anon key!
```

### Execute Forensic Audit
```bash
# Auto-detect latest snapshot
npx tsx scripts/db-forensic-audit-phase1.ts

# Or specify snapshot ID
npx tsx scripts/db-forensic-audit-phase1.ts a934aaad
```

---

## What This Script Does

### Section 1: Latest Snapshots
- Lists the 5 most recent ready snapshots
- Shows metadata (ID, date range, build time, version)
- Auto-selects latest for analysis

### Section 2: Problematic Items
- Extracts items #4, #6, #11, #16, #18, #19, #20
- Shows title, length, video_id, channel, category
- Baseline data for comparison

### Section 3: Forensic Hex Analysis (Items #16 & #20)
**Critical diagnostic section:**
- Full Unicode codepoint analysis
- Control character detection (C0/C1)
- Special character presence (₽, ℘, ~, {, @)
- First 50 characters as hex dump
- Normalization state (NFC/NFD/other)

**Example output:**
```
🔍 Item #16: 99 คืนไป (ถามQ&A) {Roblox 99 Nights...
   Length: 65 chars, 98 bytes
   Normalization: NFC ✓
   Control chars: 🔴 YES
   Control char codes: U+000F
   Special chars: ₽=false, ℘=false, ~=false, {=true, @=false
   First 50 chars (hex):
   U+0031:1 U+0036:6 U+002E:. U+0020:  U+0039:9 U+0039:9 ...
```

### Section 4: Unicode Normalization Check
- Checks if all 7 items are in NFC form
- Identifies items needing normalization
- No data loss risk assessment

### Section 5: Corruption Statistics
- Scans ALL items in snapshot (not just 7)
- Counts items with control characters
- Counts items needing NFC normalization
- Calculates percentages
- Determines scope of remediation needed

---

## Output

### Terminal Output
- Colored, formatted tables
- Real-time analysis progress
- Summary with actionable recommendations

### JSON Report
- Saved to `reports/DB_FORENSIC_AUDIT_{snapshot_id}_{timestamp}.json`
- Complete forensic data for documentation
- Includes all hex dumps, analysis results

---

## Interpretation Guide

### If Control Characters Found:
- **Likely source:** Data ingestion from YouTube/X APIs
- **Impact:** PDF renderer sees `\x0F{Roblox}` → removes `\x0F` → `{Roblox` remains
- **Fix:** Phase 3 remediation (safe removal with backup)

### If Normalization Issues Found:
- **Likely cause:** Mixed UTF-8 encodings during ETL
- **Impact:** Thai combining marks may be in wrong order
- **Fix:** Normalize all to NFC (lossless for Thai/CJK)

### If ₽ vs ℘ Discrepancy:
- **Test:** Check `has_ruble` and `has_weierstrass` flags
- **If DB has ℘:** Font glyph coverage not the issue
- **If DB has ₽:** Font substitution in renderer (need NotoSansSymbols)

---

## Expected Results

### Scenario A: Database is Corrupted
```
📊 SUMMARY:
   Total items: 20
   Items with control chars: 3 (15.00%)
   Items needing NFC: 1 (5.00%)

⚠️  ACTION REQUIRED: Database remediation needed (Phase 3)
```
→ Proceed to Phase 3: DB Remediation

### Scenario B: Database is Clean
```
📊 SUMMARY:
   Total items: 20
   Items with control chars: 0 (0.00%)
   Items needing NFC: 0 (0.00%)

✅ Database appears clean. Focus on application-level fixes.
```
→ Skip Phase 3, focus on renderer/font issues

---

## Next Steps

**After running this script:**

1. **Review the JSON report** - Check hex dumps for items #16 and #20
2. **Compare with PDF screenshots** - Do DB strings match rendered PDF?
3. **If corruption found** → Run Phase 3 (DB remediation script)
4. **If clean** → Investigate font glyph coverage and renderer settings

---

## Safety Notes

- ✅ **Read-only** - No data modifications
- ✅ **Service role required** - Can access weekly_report_snapshots table
- ✅ **No secrets in output** - JSON report is safe to commit
- ✅ **Repeatable** - Run multiple times without side effects

---

**Status:** Ready for execution  
**Time:** ~5-10 seconds per snapshot  
**Risk:** None (read-only)
