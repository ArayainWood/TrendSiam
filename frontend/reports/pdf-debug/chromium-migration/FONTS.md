# FONT SYSTEM DOCUMENTATION

**Generated:** 2025-10-20  
**Purpose:** Document font setup for Chromium PDF migration

## Font Inventory

### Currently Used Fonts

| Font Family | Files | Size | Purpose | SHA-256 Verified |
|-------------|-------|------|---------|------------------|
| Noto Sans Thai | Regular + Bold | 47KB each | Thai + Latin base | ✓ |
| Noto Sans KR | Regular + Bold | 6.1MB each | Korean (Hangul) | ✓ |
| Noto Sans JP | Regular + Bold | 5.4MB each | Japanese/CJK | ✓ |
| Noto Sans Symbols | Regular + Bold | 185KB each | Special symbols | ✓ |
| Noto Emoji | Regular + Bold | 880KB each | Emoji support | ✓ |

**Total:** ~27MB (10 files)

### Font Load Order

1. **Primary (Always loaded)**
   - Noto Sans Thai - Base font for all text
   
2. **On-demand (Loaded if content detected)**
   - Noto Sans KR - Korean text
   - Noto Sans JP - CJK ideographs
   - Noto Sans Symbols - Special characters
   - Noto Emoji - Emoji characters

### CSS Font Stack

```css
font-family: 'Noto Sans Thai', 'Noto Sans KR', 'Noto Sans JP', 
             'Noto Sans Symbols', 'Noto Emoji', sans-serif;
```

## Font Loading Strategy

### Current System (@react-pdf)
```javascript
// Manual registration per font
Font.register({
  family: 'NotoSansThaiUniversal',
  fonts: [
    { src: '/fonts/NotoSansThai-Regular.ttf', fontWeight: 'normal' },
    { src: '/fonts/NotoSansThai-Bold.ttf', fontWeight: 'bold' }
  ]
});
```

### New System (Chromium)
```css
/* CSS @font-face declarations */
@font-face {
  font-family: 'Noto Sans Thai';
  src: url('/fonts/NotoSansThai/NotoSansThai-Regular.ttf');
  font-weight: 400;
  font-display: block; /* Critical for Thai */
}
```

## Font Verification

### SHA-256 Hashes (from fonts_provenance.json)
```json
{
  "NotoSansThai-Regular.ttf": "9ACB585D8662CA4ED1B1CF5889DFA1393F8555103B3986E1EA1E3AF4FAEF70BD",
  "NotoSansThai-Bold.ttf": "0BE544F347B3AB6382BDC2B555A783727A4858A3DC140670406924670967D916",
  // ... more fonts
}
```

### Verification Script
```javascript
// Wait for all fonts to load
document.fonts.ready.then(() => {
  // Check loaded fonts
  const loaded = [];
  document.fonts.forEach(font => {
    loaded.push(`${font.family} ${font.weight}`);
  });
  console.log('Loaded fonts:', loaded);
});
```

## Font Features

### Thai Requirements
- **GPOS tables**: Mark-to-base positioning
- **GSUB tables**: Glyph substitution
- **GDEF tables**: Glyph definitions
- **subset: false**: Preserve all tables

### Chromium Advantages
- Native HarfBuzz shaping
- Automatic OpenType feature application
- Proper grapheme cluster handling
- No manual subsetting needed

## Troubleshooting

### Common Issues

1. **Fonts not loading**
   - Check: Network tab for 404s
   - Check: CORS headers on font files
   - Check: File paths match exactly

2. **Wrong font applied**
   - Check: CSS specificity
   - Check: Font-family declaration order
   - Check: Font weight matching

3. **Diacritics still clipping**
   - Check: line-height >= 1.8
   - Check: padding-top/bottom >= 3pt
   - Check: font-display: block

### Debug Tools

1. **Browser DevTools**
   ```javascript
   // Check loaded fonts
   console.log([...document.fonts].map(f => f.family));
   
   // Force reload
   document.fonts.clear();
   document.fonts.load('16px Noto Sans Thai');
   ```

2. **Playwright verification**
   ```javascript
   // Wait for fonts
   await page.waitForFunction(() => window.__FONTS_READY__);
   
   // Get font metrics
   const metrics = await page.evaluate(() => {
     const range = document.createRange();
     range.selectNode(document.querySelector('.item-title'));
     return range.getBoundingClientRect();
   });
   ```

## Migration Checklist

- [x] Identify all required fonts
- [x] Verify font files exist in public/fonts/
- [x] Create @font-face declarations
- [x] Set appropriate font-display values
- [x] Add font loading verification
- [x] Document font cascade order
- [ ] Test with all script types
- [ ] Verify in Chromium headless
- [ ] Compare metrics with baseline

---

Font Setup Status: ✅ READY
