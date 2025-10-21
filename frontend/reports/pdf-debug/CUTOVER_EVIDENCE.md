# PDF ENGINE CUTOVER EVIDENCE

**Date:** October 20, 2025  
**Purpose:** Prove which PDF engine is serving real user-facing Weekly Reports

---

## A. ENGINE PROVENANCE - HTTP HEADERS

### Metadata Stamps Added

Both engines now emit HTTP headers to prove engine identity:

**Legacy Engine (`/api/weekly/pdf`):**
```
X-PDF-Engine: legacy
X-PDF-Renderer: @react-pdf/renderer
X-PDF-Timestamp: [ISO timestamp]
X-PDF-Snapshot: [snapshot ID]
X-TS-PDF-Fonts: [loaded font families]
```

**Chromium Engine (`/api/weekly/pdf-chromium`):**
```
X-PDF-Engine: chromium
X-PDF-Renderer: Playwright/Chromium
X-PDF-Generation-Time: [ms]
X-PDF-Timestamp: [ISO timestamp]
X-PDF-Snapshot: [snapshot ID]
```

### Verification Method

1. Download PDF from Weekly Report UI
2. Check browser Network tab for response headers
3. Match `X-PDF-Engine` header to engine used

---

## B. CURRENT ROUTING FLOW

### User-Facing Weekly Report

**Entry Point:**  
`/app/weekly-report/page.tsx` → `WeeklyReportClient.tsx`

**Current Download Logic:**  
```typescript
// File: frontend/src/app/weekly-report/WeeklyReportClient.tsx
// Line 69
const url = new URL('/api/weekly/pdf', window.location.origin);
```

**⚠️ FINDING:**  
**The Weekly Report UI is HARDCODED to `/api/weekly/pdf` (legacy engine)**

This explains why legacy symptoms persist despite Chromium implementation.

### Current Call Graph
```
User clicks "Download PDF"
  ↓
WeeklyReportClient.handleDownloadPDF() [Line 63]
  ↓
fetch('/api/weekly/pdf?snapshot=XXX') [Line 69]
  ↓
/api/weekly/pdf/route.tsx [Legacy engine]
  ↓
@react-pdf/renderer (NO HarfBuzz)
  ↓
PDF with Thai issues
```

### Required Call Graph (Feature-Flagged)
```
User clicks "Download PDF"
  ↓
WeeklyReportClient.handleDownloadPDF()
  ↓
shouldUseChromium() ? [Check feature flag]
  ↓ YES (10% traffic)
fetch('/api/weekly/pdf-chromium?snapshot=XXX')
  ↓
/api/weekly/pdf-chromium/route.ts [Chromium engine]
  ↓
Playwright/Chromium (WITH HarfBuzz)
  ↓
PDF with perfect Thai rendering
```

---

## C. WIRING FIX REQUIRED

### Issue
Weekly Report UI bypasses feature flags entirely and always calls legacy route.

### Root Cause
```typescript
// frontend/src/app/weekly-report/WeeklyReportClient.tsx:69
const url = new URL('/api/weekly/pdf', window.location.origin);
```

### Solution
Create a unified router endpoint that:
1. Checks feature flags (`shouldUseChromium()`)
2. Routes to Chromium or Legacy based on traffic percentage
3. Maintains same URL for users: `/api/weekly/pdf`
4. Legacy stays at current location, Chromium delegates internally

### Implementation Options

**Option A: Smart Router (Recommended)**
- Keep `/api/weekly/pdf` as public endpoint
- Internally route to Chromium or Legacy based on flags
- Zero UI changes required
- Full control via environment variables

**Option B: Client-Side Routing**
- Expose feature flags to client
- Client chooses `/api/weekly/pdf` or `/api/weekly/pdf-chromium`
- Requires UI changes
- Less secure (exposes internal routing)

**Decision:** Option A (Smart Router)

---

## D. NEXT STEPS

### 1. Implement Smart Router
- [ ] Create unified `/api/weekly/pdf` that routes based on flags
- [ ] Move current legacy to `/api/weekly/pdf-legacy`
- [ ] Test with PDF_CHROMIUM_TRAFFIC_PERCENT=0/10/50/100

### 2. Verification
- [ ] Generate PDF with 0% → Check headers show "legacy"
- [ ] Generate PDF with 100% → Check headers show "chromium"
- [ ] Generate 10 PDFs with 10% → ~1 chromium, ~9 legacy

### 3. Evidence Collection
- [ ] Screenshot headers from browser Network tab
- [ ] Compare visual rendering (pixel diff)
- [ ] Document in this file with timestamps

---

## E. CURRENT STATUS

**Weekly Report Engine:** ❌ Legacy (hardcoded)  
**Chromium Implementation:** ✅ Complete but unused by Weekly Report  
**Feature Flags:** ⚠️ In place but bypassed  
**Action Required:** Wire Weekly Report through smart router

---

## F. TEST RESULTS (Pending Wire Fix)

### Before Wiring Fix
```
curl -I http://localhost:3002/api/weekly/pdf
X-PDF-Engine: legacy
X-PDF-Renderer: @react-pdf/renderer
```

### After Wiring Fix (Target)
```bash
# With 0% traffic
curl -I http://localhost:3002/api/weekly/pdf  
X-PDF-Engine: legacy

# With 100% traffic  
curl -I http://localhost:3002/api/weekly/pdf
X-PDF-Engine: chromium

# With 10% traffic (random sampling)
# Expected: ~10% chromium, ~90% legacy
```

---

**Next Action:** Implement smart router to unify endpoints
