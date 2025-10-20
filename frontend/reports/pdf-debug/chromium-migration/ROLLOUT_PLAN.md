# PHASE 5: CHROMIUM PDF ROLLOUT PLAN

**Created:** 2025-10-20  
**Status:** Ready to Execute

---

## 🚀 ROLLOUT STRATEGY

### Stage 1: Canary (10% Traffic) - Day 1-2
**Duration:** 48 hours  
**Traffic:** 10% to Chromium, 90% to Legacy

**Actions:**
1. Set environment variable: `PDF_CHROMIUM_TRAFFIC_PERCENT=10`
2. Deploy to production
3. Monitor metrics:
   - Generation success rate
   - Response times (target <5s)
   - Memory usage
   - Error logs
4. Collect user feedback

**Success Criteria:**
- [ ] >99% success rate
- [ ] P95 latency <5s
- [ ] No critical errors
- [ ] No user complaints

**Rollback Trigger:**
- Success rate <95%
- P95 latency >10s
- Critical rendering issues reported

### Stage 2: Beta (50% Traffic) - Day 3-7
**Duration:** 5 days  
**Traffic:** 50% to Chromium, 50% to Legacy

**Actions:**
1. Update: `PDF_CHROMIUM_TRAFFIC_PERCENT=50`
2. Continue monitoring
3. A/B comparison of outputs
4. Performance optimization if needed

**Success Criteria:**
- [ ] Maintain >99% success rate
- [ ] Similar performance to Stage 1
- [ ] Positive user feedback
- [ ] No memory leaks

### Stage 3: Full Rollout (100% Traffic) - Day 8+
**Duration:** Permanent  
**Traffic:** 100% to Chromium, Legacy as fallback

**Actions:**
1. Update: `PDF_CHROMIUM_TRAFFIC_PERCENT=100`
2. Keep legacy endpoint active
3. Add fallback logic for failures
4. Plan legacy deprecation

---

## 🛠️ IMPLEMENTATION STEPS

### Pre-Rollout Checklist
- [ ] Production Playwright dependencies installed
- [ ] Font files verified in production
- [ ] Health check endpoint tested
- [ ] Monitoring dashboards ready
- [ ] Rollback procedure documented
- [ ] Team notified of rollout

### Environment Configuration
```bash
# Stage 1 - Canary (10%)
PDF_CHROMIUM_ENABLED=true
PDF_LEGACY_ENABLED=true
PDF_CHROMIUM_TRAFFIC_PERCENT=10

# Stage 2 - Beta (50%)
PDF_CHROMIUM_ENABLED=true
PDF_LEGACY_ENABLED=true
PDF_CHROMIUM_TRAFFIC_PERCENT=50

# Stage 3 - Full (100%)
PDF_CHROMIUM_ENABLED=true
PDF_LEGACY_ENABLED=true
PDF_CHROMIUM_TRAFFIC_PERCENT=100
```

### Monitoring Setup
1. **Metrics to Track**
   - PDF generation count by engine
   - Success/failure rates
   - Response time percentiles
   - Memory/CPU usage
   - File sizes generated

2. **Alerts**
   - Success rate drops below 95%
   - P95 latency exceeds 5s
   - Memory usage exceeds 500MB
   - Repeated Thai rendering errors

3. **Dashboards**
   - Real-time engine distribution
   - Performance comparison
   - Error log aggregation

---

## 🧹 CLEANUP PLAN (Post-Rollout)

### Week 1-2: Stabilization
- Monitor production metrics
- Fix any edge cases discovered
- Optimize performance

### Week 3-4: Legacy Deprecation Prep
- [ ] Identify legacy dependencies
- [ ] Update documentation
- [ ] Notify API consumers
- [ ] Set deprecation timeline

### Month 2: Code Cleanup
**Remove Legacy Components:**
1. `@react-pdf/renderer` dependencies
2. Complex text sanitizer (keep minimal NFC)
3. Manual font registration system
4. Legacy PDF route (after grace period)

**Simplify:**
```
Before: 521 lines of sanitizer workarounds
After: ~50 lines (NFC normalization only)
```

### Month 3: Full Deprecation
- [ ] Remove legacy endpoint
- [ ] Remove legacy dependencies
- [ ] Update all references
- [ ] Archive legacy code

---

## 📝 ROLLBACK PROCEDURE

If issues arise at any stage:

1. **Immediate Rollback**
   ```bash
   # Set traffic to 0%
   PDF_CHROMIUM_TRAFFIC_PERCENT=0
   ```

2. **Investigate**
   - Check error logs
   - Review failed PDFs
   - Identify root cause

3. **Fix & Retry**
   - Patch issues
   - Test thoroughly
   - Resume rollout

---

## 🎯 SUCCESS METRICS

### Technical
- ✅ 100% Thai text accuracy
- ✅ Zero "Trailer=@" errors
- ✅ <2% pixel difference
- ✅ <5s generation time
- ✅ <500MB memory usage

### Business
- ✅ User satisfaction maintained
- ✅ No increase in support tickets
- ✅ Reduced maintenance burden
- ✅ Future-proof architecture

---

## 📋 COMMUNICATION PLAN

### Internal
- [ ] Engineering team briefing
- [ ] QA test plan shared
- [ ] Support team training

### External (if needed)
- [ ] API changelog update
- [ ] Customer notification (if any breaking changes)

---

**Next Action:** Begin Stage 1 deployment with 10% traffic
