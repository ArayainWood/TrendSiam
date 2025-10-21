# STAGE 1 ROLLOUT STATUS

**Updated:** October 20, 2025  
**Status:** Smart Router Implemented, Testing In Progress

---

## IMPLEMENTATION COMPLETE

### A. Engine Metadata Stamps ✅
Both engines now emit HTTP headers proving engine identity:

**Headers Added:**
- `X-PDF-Engine`: "legacy" or "chromium"
- `X-PDF-Renderer`: "@react-pdf/renderer" or "Playwright/Chromium"
- `X-PDF-Timestamp`: ISO timestamp
- `X-PDF-Snapshot`: Snapshot ID

**Files Modified:**
- `frontend/src/app/api/weekly/pdf-legacy/route.tsx` (moved from pdf/)
- `frontend/src/app/api/weekly/pdf-chromium/route.ts`

### B. Smart Router Implemented ✅
Created unified `/api/weekly/pdf` endpoint that routes based on feature flags:

**Key Features:**
- Traffic splitting via `PDF_CHROMIUM_TRAFFIC_PERCENT`
- Automatic fallback to legacy if Chromium fails
- Request logging (last 100 requests)
- Zero UI changes required

**Files Created:**
- `frontend/src/app/api/weekly/pdf/route.ts` (Smart Router)
- `frontend/src/app/api/pdf-engine-report/route.ts` (Monitoring)

**Routing Logic:**
```typescript
if (shouldUseChromium()) {
  route to /api/weekly/pdf-chromium
} else {
  route to /api/weekly/pdf-legacy
}

// With fallback:
if (chromium fails && legacyEnabled) {
  automatic fallback to legacy
}
```

### C. Admin Monitoring Endpoint ✅
Created `/api/pdf-engine-report` for real-time monitoring:

**Provides:**
- Total requests by engine
- Success/failure rates
- Average generation time
- Recent 20 requests with details
- Current configuration

---

## TESTING PLAN

### Test 1: 0% Traffic (Baseline)
```bash
PDF_CHROMIUM_ENABLED=true
PDF_CHROMIUM_TRAFFIC_PERCENT=0
```

**Expected:**
- All requests → legacy
- Headers show `X-PDF-Engine: legacy`
- Thai issues still present (baseline)

### Test 2: 100% Traffic (Chromium Validation)
```bash
PDF_CHROMIUM_ENABLED=true
PDF_CHROMIUM_TRAFFIC_PERCENT=100
```

**Expected:**
- All requests → chromium
- Headers show `X-PDF-Engine: chromium`
- Thai rendering perfect
- "Trailer=@" bug fixed

### Test 3: 10% Traffic (Stage 1 Canary)
```bash
PDF_CHROMIUM_ENABLED=true
PDF_CHROMIUM_TRAFFIC_PERCENT=10
```

**Expected:**
- ~10% requests → chromium
- ~90% requests → legacy
- Monitoring shows split
- No user-visible errors

---

## VERIFICATION CHECKLIST

### Engine Provenance
- [ ] Test 1 (0%): Download PDF, check headers = "legacy"
- [ ] Test 2 (100%): Download PDF, check headers = "chromium"
- [ ] Test 3 (10%): Download 20 PDFs, verify ~2 chromium
- [ ] Monitoring endpoint shows accurate stats

### Rendering Quality (100% Test)
- [ ] Thai SARA AA preserved (items #4, #6, #16, #18, #19)
- [ ] Item #20: Shows "Trailer:" not "Trailer=@"
- [ ] Korean uses NotoSansKR
- [ ] Footer Thai text clean
- [ ] Pixel diff < 2% vs browser

### Fallback Behavior
- [ ] Kill Chromium process → request succeeds via legacy
- [ ] Check headers show `X-PDF-Fallback: true`
- [ ] User sees PDF despite Chromium failure

---

## STAGE 1 EXECUTION PLAN

### Day 0: Final Testing (Today)
1. Start server with 0% traffic
2. Generate baseline PDF, document headers
3. Set 100% traffic
4. Generate Chromium PDF, verify rendering
5. Document before/after comparison
6. Set 10% traffic for staging test

### Day 1: Deploy 10% Canary
1. Deploy with `PDF_CHROMIUM_TRAFFIC_PERCENT=10`
2. Monitor `/api/pdf-engine-report` every hour
3. Collect 48 hours of data
4. Target metrics:
   - Success rate > 99%
   - P95 latency < 5s
   - Chromium ~10% of traffic

### Day 3: Evaluation
1. Review 48h logs
2. Check for errors/complaints
3. Compare Chromium vs Legacy success rates
4. Make go/no-go decision for 50%

---

## MONITORING METRICS

### Success Criteria (48h)
- Overall success rate: >99%
- Chromium success rate: >99%
- Legacy success rate: >99%
- Average latency: <3s
- No critical errors

### Alert Triggers
- Success rate drops below 95%
- Chromium failures > 5%
- Average latency > 10s
- Memory usage > 500MB

---

## ROLLBACK PROCEDURE

If issues arise:

1. **Immediate**: Set `PDF_CHROMIUM_TRAFFIC_PERCENT=0`
2. **Investigate**: Check logs, error patterns
3. **Fix**: Patch issues, re-test
4. **Resume**: Restart at 10% after fixes verified

---

## NEXT ACTIONS

1. ✅ Smart router implemented
2. ✅ Monitoring endpoint created
3. ⏳ Server stability verification needed
4. ⏳ Run Test 1 (0% baseline)
5. ⏳ Run Test 2 (100% verification)
6. ⏳ Run Test 3 (10% canary)
7. ⏳ Collect 48h data
8. ⏳ Make final go/no-go

---

## TECHNICAL NOTES

### Architecture
```
User → /api/weekly/pdf (Smart Router)
  ↓
  shouldUseChromium()
  ↓
  YES (10%) → /api/weekly/pdf-chromium → Playwright/Chromium
  NO  (90%) → /api/weekly/pdf-legacy   → @react-pdf/renderer
  
  If Chromium fails → Automatic fallback to legacy
```

### Configuration
All controlled via environment variables:
- `PDF_CHROMIUM_ENABLED` - Enable/disable Chromium
- `PDF_LEGACY_ENABLED` - Enable/disable Legacy  
- `PDF_CHROMIUM_TRAFFIC_PERCENT` - 0-100

### Monitoring
Real-time stats at `/api/pdf-engine-report`:
- Engine distribution
- Success rates
- Performance metrics
- Recent requests

---

**Status:** Ready for testing once server stability confirmed
