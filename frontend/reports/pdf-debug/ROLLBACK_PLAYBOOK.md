# PDF CHROMIUM ROLLBACK PLAYBOOK

**Version:** 1.0  
**Date:** October 20, 2025  
**Purpose:** Emergency rollback procedures for Chromium PDF engine

---

## QUICK REFERENCE

### Emergency Rollback (30 seconds)
```bash
# Option 1: Disable Chromium completely
PDF_CHROMIUM_ENABLED=false

# Option 2: Route all traffic to legacy
PDF_CHROMIUM_TRAFFIC_PERCENT=0
```

**Restart required:** Yes (restart Next.js server)

---

## ROLLBACK SCENARIOS

### Scenario 1: Complete Rollback to Legacy
**When:** Chromium has critical issues, need immediate revert

**Steps:**
1. Update environment:
   ```bash
   PDF_CHROMIUM_ENABLED=false
   PDF_LEGACY_ENABLED=true
   ```

2. Restart application:
   ```bash
   npm run build
   npm run start
   ```

3. Verify:
   ```bash
   curl -I http://localhost:3000/api/weekly/pdf
   # Should show: X-PDF-Engine: legacy
   ```

**Expected Behavior:**
- 100% traffic to legacy
- Chromium completely disabled
- No Chromium code executed

---

### Scenario 2: Reduce to 10% (Stage 1)
**When:** Chromium works but needs more testing

**Steps:**
1. Update environment:
   ```bash
   PDF_CHROMIUM_ENABLED=true
   PDF_LEGACY_ENABLED=true
   PDF_CHROMIUM_TRAFFIC_PERCENT=10
   ```

2. Restart application

3. Verify with 10 requests:
   ```bash
   for i in {1..10}; do
     curl -I http://localhost:3000/api/weekly/pdf
   done
   # ~1 should show chromium, ~9 should show legacy
   ```

**Expected Behavior:**
- ~10% traffic to Chromium
- ~90% traffic to legacy
- Gradual rollout mode

---

### Scenario 3: Reduce to 50% (Stage 2)
**When:** Chromium stable but want more data

**Steps:**
1. Update environment:
   ```bash
   PDF_CHROMIUM_TRAFFIC_PERCENT=50
   ```

2. Restart application

3. Verify:
   ```bash
   curl http://localhost:3000/api/pdf-engine-report
   # Check chromiumPercent should be ~50%
   ```

**Expected Behavior:**
- ~50% traffic to Chromium
- ~50% traffic to legacy
- Equal distribution for testing

---

### Scenario 4: Keep 100% with Monitoring
**When:** Chromium stable, just need close watch

**Steps:**
1. No changes needed (current state)

2. Monitor intensively:
   ```bash
   # Watch monitoring endpoint
   watch -n 10 'curl -s http://localhost:3000/api/pdf-engine-report'
   ```

3. Check error logs:
   ```bash
   tail -f logs/pdf-generation.log
   ```

**Expected Behavior:**
- 100% traffic to Chromium
- Auto-fallback on failures
- Continuous monitoring

---

## VERIFICATION PROCEDURES

### After Any Rollback

#### 1. Check Headers
```bash
curl -I http://localhost:3000/api/weekly/pdf
```

**Verify:**
- `X-PDF-Engine` matches expected (legacy or chromium)
- `X-PDF-Router: smart-router-v1` present
- `X-PDF-Traffic-Percent` matches configuration

#### 2. Generate Test PDF
```bash
curl -o test.pdf http://localhost:3000/api/weekly/pdf
```

**Verify:**
- File size reasonable (20-50KB)
- Opens in PDF viewer
- Content renders correctly
- Thai text (if applicable) displays properly

#### 3. Check Monitoring
```bash
curl http://localhost:3000/api/pdf-engine-report
```

**Verify:**
- `chromiumPercent` matches expected
- `successRate` > 99%
- `avgDuration` < 5000ms
- No recent errors

#### 4. Check Health
```bash
# If keeping Chromium enabled
curl http://localhost:3000/api/health-pdf?engine=chromium

# Response should show:
# "healthy": true
```

---

## TROUBLESHOOTING

### Issue: PDFs Still Using Wrong Engine
**Symptom:** Headers show unexpected engine after rollback

**Solution:**
1. Verify environment variables loaded:
   ```bash
   echo $PDF_CHROMIUM_ENABLED
   echo $PDF_CHROMIUM_TRAFFIC_PERCENT
   ```

2. Hard restart:
   ```bash
   pkill -f "next dev"
   npm run dev
   ```

3. Clear Next.js cache:
   ```bash
   rm -rf .next
   npm run dev
   ```

---

### Issue: Both Engines Failing
**Symptom:** All PDF requests return errors

**Solution:**
1. Check font files exist:
   ```bash
   ls -la frontend/public/fonts/
   ```

2. Verify database connection:
   ```bash
   curl http://localhost:3000/api/health-schema
   ```

3. Check snapshot data:
   ```bash
   curl http://localhost:3000/api/weekly/data
   ```

---

### Issue: Monitoring Not Showing Data
**Symptom:** `/api/pdf-engine-report` returns empty stats

**Solution:**
1. Generate a few PDFs to populate log:
   ```bash
   for i in {1..5}; do
     curl -o test$i.pdf http://localhost:3000/api/weekly/pdf
     sleep 2
   done
   ```

2. Check monitoring endpoint again:
   ```bash
   curl http://localhost:3000/api/pdf-engine-report
   ```

---

## ROLLBACK DECISION TREE

```
Is success rate < 95%?
  ├─ YES → Scenario 1 (Complete Rollback)
  └─ NO  → Continue

Are Chromium PDFs corrupted?
  ├─ YES → Scenario 1 (Complete Rollback)
  └─ NO  → Continue

Is average latency > 10s?
  ├─ YES → Scenario 2 (Reduce to 10%)
  └─ NO  → Continue

Are there user complaints?
  ├─ YES → Scenario 2 (Reduce to 10%)
  └─ NO  → Scenario 4 (Monitor at 100%)
```

---

## COMMUNICATION TEMPLATE

### For Team Notification

**Subject:** PDF Engine Rollback Initiated

**Body:**
```
The Chromium PDF engine has been rolled back to [SCENARIO].

Reason: [BRIEF DESCRIPTION]

Current Configuration:
- PDF_CHROMIUM_ENABLED: [true/false]
- PDF_CHROMIUM_TRAFFIC_PERCENT: [0/10/50/100]
- Effective Engine: [legacy/chromium/mixed]

Impact:
- User-facing PDFs: [description]
- Expected behavior: [description]

Next Steps:
1. [Action item 1]
2. [Action item 2]

Monitoring:
- Dashboard: http://localhost:3000/api/pdf-engine-report
- Logs: [location]

Contact: [Your name/team]
```

---

## CONTACT INFORMATION

**Deployment Owner:** TrendSiam Team  
**Implementation:** Cursor IDE Agent  
**Documentation:** `/reports/pdf-debug/`  
**Support:** Check monitoring dashboard and logs

---

## VERSION HISTORY

| Version | Date | Change | Author |
|---------|------|--------|--------|
| 1.0 | 2025-10-20 | Initial playbook | Cursor IDE Agent |

---

**Remember:** Always verify rollback with test PDF and header inspection before declaring complete.

END OF ROLLBACK PLAYBOOK
