# Language, Top Story, Modal & Score Narrative Fix - Testing Guide

## Date: 2025-10-06

## Overview

This testing guide covers verification of three critical UI fixes:
1. **Top Story Hero section** - Score and score bar display
2. **Story Details modal** - Language-reactive Summary
3. **Story Details modal** - Rich popularity score narrative

## Prerequisites

```bash
# Ensure dev server is running
cd frontend
npm run dev

# Wait for server to start (usually ~5-10 seconds)
# Open browser to http://localhost:3000
```

## Test 1: Top Story Hero Score & Bar

### What to verify:
- Top Story (hero section on home page) shows a decimal score like "95.9" or "89.2"
- Score bar fills proportionally (0-100 scale)
- Bar is visible and not hidden for valid scores

### Steps:
1. Go to http://localhost:3000
2. Locate the "Top Story" card in the hero section (right side, large card with pulsing dot)
3. Scroll to the bottom of the card

**Expected Results:**
- ✅ Score displays as decimal: "XX.X" (e.g., "95.9", "89.2")
- ✅ Score bar is visible below the summary text
- ✅ Bar fills according to score (95.9 = ~96% filled)
- ✅ Bar uses gradient colors (accent-500 to thai-400)
- ✅ No errors in browser console

**Screenshot locations to check:**
- Score value at bottom right of top story card
- Horizontal bar at bottom of top story card

---

## Test 2: Story Details Modal - Language-Reactive Summary

### What to verify:
- Summary paragraph switches language immediately when toggling EN/TH
- No stale Thai text when English is selected
- No flash or delay in switching

### Steps:
1. Open home page (http://localhost:3000)
2. Click any story card to open the modal
3. Observe the "Summary" / "สรุป" section (below the title and image)
4. Note the current language and summary text
5. Click the language toggle in the navigation (top right)
6. Observe the Summary section again

**Expected Results:**
- ✅ **When TH selected**: Label shows "สรุป", paragraph shows Thai summary
- ✅ **When EN selected**: Label shows "Summary", paragraph shows English summary
- ✅ Summary text changes **immediately** (no delay, no stale content)
- ✅ If one summary is missing, falls back gracefully (TH→EN or EN→TH)
- ✅ Toggle back and forth multiple times - always shows correct language

**Edge case to test:**
- Find a story with only Thai summary → switch to EN → should show Thai as fallback
- Find a story with only English summary → switch to TH → should show English as fallback

---

## Test 3: Story Details Modal - Rich Popularity Score Narrative

### What to verify:
- Green "Popularity Score" card shows a detailed narrative sentence
- Narrative is data-driven (real views, like rate, comment rate)
- Narrative switches language with toggle
- No "Not enough data" placeholders

### Steps:
1. Open home page (http://localhost:3000)
2. Click the Top Story or any Top-3 card (rank #1-3 with images)
3. Modal opens - scroll to "Popularity Score" section (green background card)
4. Read the paragraph under the big score number (e.g., "95.8/100")

**Expected Results (English):**
- ✅ Narrative follows template: "[Growth label] performance driven by strong viewership (X views) and outstanding engagement (Y% like rate). Additional boost from high discussion activity (Z% comment rate)."
- ✅ Real data is shown (not "2.0M views" hardcoded - actual values from API)
- ✅ Numbers formatted with abbreviations:
  - Views: "1.2K", "45.6K", "2.0M" (one decimal, no trailing .0)
  - Like rate: "10.0%" (one decimal)
  - Comment rate: "1.59%" (two decimals)
- ✅ Growth label reflects actual data: "Viral", "Rising fast", "Rising", "Stable"

**Expected Results (Thai):**
- ✅ Switch to Thai language
- ✅ Narrative translates: "ผลงานระดับ[growth_label_th] ขับเคลื่อนโดยยอดรับชมสูง (X views) และอัตราการมีส่วนร่วมโดดเด่น (Y%) เพิ่มแรงหนุนจากการสนทนาสูง (Z%)"
- ✅ Same real data, Thai labels
- ✅ Numbers remain in standard format (not translated)

**Edge cases to test:**
- Story with missing comment rate → narrative omits the second sentence
- Story with missing views → narrative adapts (shows available metrics only)
- Story with only growth label → shows minimal but meaningful message

---

## Test 4: Grid Cards - Language Consistency

### What to verify:
- All story cards in the grid show summaries that match language setting
- Score and bar display correctly on all cards

### Steps:
1. Scroll down to "Latest Stories" section
2. Toggle language EN/TH
3. Observe all visible story cards

**Expected Results:**
- ✅ All cards update summaries according to language
- ✅ Scores show decimal format: "XX.X"
- ✅ Score bars fill proportionally
- ✅ No "undefined" or "N/A" unless data truly missing

---

## Test 5: Console Verification

### What to check:
1. Open browser DevTools → Console tab
2. Refresh home page
3. Look for logs and warnings

**Expected Results:**
- ✅ No errors about "popularity_score" undefined
- ✅ No warnings about missing summaryEn/summary
- ✅ Logs show mapped data with camelCase fields
- ✅ No "POLICY VIOLATION" warnings
- ✅ TypeScript/React hydration errors: zero

**Known acceptable logs:**
- `[newsStore] ✅ Home API response: ...`
- `[home] Mapping X database rows...`
- `HOME VERIFY: ...`

---

## Test 6: Regression Checks

### What NOT to break:
- ✅ Top-3 images still show for ranks #1-3
- ✅ AI-Generated badge visible on images
- ✅ AI Prompt button visible for Top-3 items
- ✅ Non-Top-3 items DO NOT show images or prompts
- ✅ Growth Rate, Platforms, Keywords, AI Opinion blocks work
- ✅ Source URL links to YouTube correctly
- ✅ Weekly Report page unaffected

### Steps:
1. Navigate to /weekly-report
2. Download PDF
3. Verify PDF generates without errors

**Expected Results:**
- ✅ Weekly report still works
- ✅ No regressions to PDF generation
- ✅ All other pages load without errors

---

## Automated Verification (Optional)

If the dev server is running on port 3000:

```bash
# From project root
node frontend/scripts/verify-home-api.mjs

# Expected output:
# ✅ API returned N items
# ✅ popularityScore: number
# ✅ summary/summaryEn present
# ✅ Top-3 verification passed
# ✅ Metrics present for narrative
```

---

## TypeScript & Build Checks

```bash
# From frontend directory
npx tsc --noEmit   # Should exit 0 with no errors
npm run build      # Should complete successfully
```

**Expected Results:**
- ✅ TypeScript: 0 errors
- ✅ Build: Success, no warnings about missing fields
- ✅ No deprecation warnings for new helpers

---

## Acceptance Criteria Summary

### Must Pass (Critical):
1. ✅ Top Story shows decimal score (e.g., "95.9") and proportional bar
2. ✅ Modal Summary switches language immediately with toggle
3. ✅ Popularity Score card shows rich narrative with real data (EN & TH)
4. ✅ Narrative uses actual metrics: views (2.0M), like rate (10.0%), comment rate (1.59%)
5. ✅ No "Not enough data" in narrative (graceful omission if metric missing)
6. ✅ Zero TypeScript errors, zero build errors

### Should Pass (Important):
7. ✅ Keywords never show "No Viral Keywords Detected" (localized fallback instead)
8. ✅ Growth labels show meaningful values (Viral/Rising fast/Rising/Stable)
9. ✅ Grid cards update summaries reactively with language
10. ✅ No hydration mismatches or console errors

### Nice to Have (Polish):
11. ✅ Smooth transitions when toggling language
12. ✅ Consistent typography across components
13. ✅ No flash/flicker on language switch

---

## Known Limitations

- API must return `popularityScore` (camelCase) for score display to work
- Summaries require at least one of `summary` or `summaryEn` to be present
- Narrative requires at least `growthRateLabel` to show meaningful content
- If all metrics are null, narrative shows "Gathering metrics" / "กำลังรวบรวมข้อมูล"

---

## Rollback Instructions

If issues occur:

1. Revert these files:
   - `frontend/src/app/page.tsx` (Hero score bar fix)
   - `frontend/src/components/news/NewsDetailModal.tsx` (Summary & narrative)
   - `frontend/src/lib/helpers/summaryHelpers.ts` (new file)
   - `frontend/src/lib/helpers/scoreNarrative.ts` (new file)

2. Restore previous implementations:
   - Hero: use `topStory.popularity_score` instead of `popularityScore`
   - Modal: use old `getSummaryWithFallback()` function
   - Popularity card: use `getPopularitySubtext()` instead of `generateScoreNarrative()`

3. Run: `git diff frontend/src` to see changes
4. Run: `npm run build` to verify rollback works

---

## Contact & Documentation

- **Changelog**: See `LANGUAGE_TOPSTORY_MODAL_SCORE_NARRATIVE_FIX.md`
- **Memory Bank**: Updated in `memory-bank/03_frontend_homepage_freshness.mb`
- **Architecture**: View-model adapter pattern documented in `mapNews.ts`

---

## Sign-off

After completing all tests above, verify:
- [ ] All "Must Pass" criteria met
- [ ] No regressions to existing features
- [ ] TypeScript and build checks passed
- [ ] Console clean (no new errors)
- [ ] Manual testing in both EN and TH completed

**Tester Signature**: _________________  
**Date**: _________________  
**Status**: [ ] PASS  [ ] FAIL (see notes)  
**Notes**: 
