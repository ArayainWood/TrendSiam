# CHROMIUM PDF VERIFICATION CHECKLIST

**Date:** 2025-10-20  
**Engine:** Chromium (Playwright v141.0.7390.37)  
**Test PDF:** test_critical_chromium.pdf (232.15 KB)

---

## 🎯 CRITICAL ACCEPTANCE CRITERIA

### P0 - Must Pass (CRITICAL)

#### 1. Thai Text Rendering
- [ ] **SARA AA (า) Preservation** - Items #4, #6, #16, #18, #19
  - Item #4: "หัวใจช้ำรัก" - Check ำ is present
  - Item #6: "ไหนใครว่าพวกมัน" - Check า after ว่
  - Item #16: "99คืนในป่า" - Check า at end
  - Item #18: "99 คืนในป่า" - Check า at end  
  - Item #19: "ปฏิบัติการเบิกน่านฟ้า" - Check both า characters

- [ ] **Thai Diacritic Positioning**
  - No overlapping tone marks
  - No clipping at top/bottom
  - Adequate line height (visual check)

- [ ] **Thai Word Integrity**
  - No grapheme cluster splitting
  - Correct composition of complex vowels

#### 2. Mixed Script Support
- [ ] **Korean (Hangul)** - Item #11
  - "엔믹스 NMIXX" uses NotoSansKR (not Thai font)
  - Clean rendering without tofu boxes

- [ ] **CJK (Chinese)** - Item #20  
  - "一笑随歌" uses NotoSansJP
  - Proper ideograph rendering

- [ ] **Emoji** - Item #16
  - 💖💌♻️ render correctly
  - No missing glyphs or boxes

#### 3. Critical Bug Fixes
- [ ] **Item #20 Title** 
  - Shows "Trailer:" (NOT "Trailer=@")
  - "Memory Wiped!" text present
  - No missing/corrupted characters

- [ ] **Footer Text**
  - "รายงานนี้สร้างโดยระบบ TrendSiam อัตโนมัติ"
  - Clean Thai rendering (no garbled text)

### P1 - Should Pass (HIGH)

#### 4. Layout & Formatting
- [ ] **Consistent Spacing**
  - Equal spacing between items
  - Proper margins (20mm)
  - No text overflow

- [ ] **Font Consistency**
  - All text uses specified fonts
  - No unexpected font fallbacks
  - Consistent weight/size

- [ ] **Metadata Alignment**
  - Category, channel, score aligned
  - Published date formatting correct

### P2 - Nice to Have (MEDIUM)

#### 5. Performance
- [ ] **Generation Speed**
  - Target: <2s (Actual: ~3s)
  - Acceptable: <5s ✓

- [ ] **File Size**
  - Target: <50KB (Actual: 232KB)
  - Acceptable: <500KB ✓

- [ ] **Memory Usage**
  - Target: <200MB
  - Measured: TBD

---

## 📊 PIXEL DIFF ANALYSIS

### Methodology
1. Generate browser screenshot of same content
2. Convert PDF to image (300 DPI)
3. Run pixel comparison tool
4. Target: <2% difference

### Results
- [ ] Homepage comparison
- [ ] Item detail comparison
- [ ] Footer comparison
- [ ] Overall diff percentage: ____%

---

## 🔍 MANUAL INSPECTION RESULTS

### Visual Inspection Log

#### Thai Rendering (อ้างอิงจาก test_critical_chromium.pdf)
```
Item #4:  หัวใจช้ำรัก         [  ] ำ present  [  ] No clipping
Item #6:  ไหนใครว่าพวกมัน      [  ] า present  [  ] Proper spacing  
Item #16: 99คืนในป่า          [  ] า present  [  ] Clean rendering
Item #18: 99 คืนในป่า         [  ] า present  [  ] Space handled
Item #19: ปฏิบัติการเบิกน่านฟ้า  [  ] Both า    [  ] No overlap
```

#### Mixed Scripts
```
Item #11: 엔믹스 NMIXX        [  ] Korean OK  [  ] Font: _______
Item #20: 一笑随歌            [  ] CJK OK     [  ] Font: _______
Item #16: 💖💌♻️             [  ] Emoji OK   [  ] Color/BW: ____
```

#### Critical Bug Check
```
Item #20 Title:              [  ] Shows "Trailer:" (not "=@")
Footer Thai:                 [  ] Clean rendering
```

---

## 📈 COMPARISON WITH LEGACY

| Aspect | Legacy (@react-pdf) | Chromium (Playwright) | Winner |
|--------|--------------------|-----------------------|--------|
| Thai SARA AA | ❌ Removed | ⏳ TBD | TBD |
| Item #20 | ❌ "Trailer=@" | ⏳ TBD | TBD |
| Korean font | ⚠️ Thai fallback | ⏳ TBD | TBD |
| Emoji | ⚠️ Limited | ⏳ TBD | TBD |
| Line height | ⚠️ 1.65 tight | ✅ 1.8 spacious | Chromium |
| Debug ability | ❌ Difficult | ✅ DevTools | Chromium |
| Speed | ✅ ~650ms | ⚠️ ~3s | Legacy |
| Complexity | ❌ 500+ lines sanitizer | ✅ Simple HTML | Chromium |

---

## 🚦 VERIFICATION STATUS

### Phase 4 Progress
- [x] Test framework created
- [x] Critical test cases PDF generated  
- [x] Health checks passing
- [ ] Manual inspection complete
- [ ] Pixel diff analysis
- [ ] All P0 criteria verified
- [ ] Comparison report finalized

### Go/No-Go Decision
**Status:** ⏳ PENDING MANUAL VERIFICATION

**Next Steps:**
1. Open test_critical_chromium.pdf
2. Complete manual inspection checklist
3. Take browser screenshots for comparison
4. Run pixel diff analysis
5. Update this checklist with results
6. Make final go/no-go recommendation

---

## 📝 NOTES

### Known Issues
1. Thai/mixed test sets failed to generate (500 error)
   - Critical set contains all important test cases
   - Additional sets can be debugged separately

2. File size larger than target (232KB vs 50KB)
   - Due to embedded fonts
   - Still within acceptable range

### Observations
- Chromium engine starts successfully
- Fonts load correctly (Noto Sans Thai, KR, JP)
- PDF generation works for standard data
- Feature flags functioning as designed

---

**Inspector:** _________________  
**Date:** ____________________  
**Decision:** [ ] GO  [ ] NO-GO  [ ] CONDITIONAL
