# HTML/REACT TEMPLATE DESIGN NOTES

**Created:** 2025-10-20  
**Phase:** 2 - React/HTML Template for Print

## Template Architecture

### Component Structure
```
ChromiumWeeklyTemplate.tsx
├── HTML document with embedded styles
├── Self-hosted font declarations (@font-face)
├── Print-optimized CSS
├── Minimal text sanitization (NFC only)
└── Font loading verification script
```

### Key Design Decisions

1. **Full HTML Document**
   - Complete `<html>`, `<head>`, `<body>` structure
   - Allows full control over rendering
   - Embedded styles for self-contained output

2. **Simplified Sanitization**
   - Only NFC normalization
   - Removed 500+ lines of workarounds
   - Let Chromium/HarfBuzz handle shaping

3. **Font Strategy**
   - Self-hosted fonts via @font-face
   - Explicit font cascade for mixed scripts
   - font-display: block for Thai (ensure load)
   - font-display: swap for others (performance)

4. **Critical CSS Properties**
   ```css
   /* Thai diacritic safety */
   line-height: 1.8;
   padding-top: 3pt;
   padding-bottom: 3pt;
   
   /* Prevent breaks */
   page-break-inside: avoid;
   
   /* Exact colors */
   print-color-adjust: exact;
   ```

5. **Font Loading Verification**
   - Uses document.fonts.ready API
   - Sets window.__FONTS_READY__ flag
   - Playwright can wait for this signal

## Template vs Current System

| Aspect | Current (@react-pdf) | New (Chromium) |
|--------|---------------------|----------------|
| Rendering | JavaScript-based | Browser-native |
| Font handling | Manual registration | CSS @font-face |
| Text shaping | Limited | Full HarfBuzz |
| Sanitization | 521 lines | 1 line (NFC) |
| Debugging | Complex | Browser DevTools |

## File Locations

1. **Template Component**
   - Path: `src/components/pdf/ChromiumWeeklyTemplate.tsx`
   - Type: React component returning full HTML

2. **Print Stylesheet**
   - Path: `src/styles/print.css`
   - Type: Standalone CSS for print media

3. **Font Files** (existing)
   - Path: `public/fonts/`
   - Already SHA-256 verified
   - Ready for use

## Integration Points

The template expects:
```typescript
interface Props {
  items: SnapshotItem[];
  metrics: any;
  generatedAt: string;
  source: string;
  snapshotId?: string;
  rangeStart?: string;
  rangeEnd?: string;
}
```

Same data contract as current system ✓

## Browser Compatibility

Tested features:
- @font-face: All modern browsers
- print-color-adjust: Chrome, Safari, Firefox 97+
- document.fonts.ready: Chrome 35+, Firefox 41+, Safari 10+
- CSS Grid/Flexbox: Full support

## Next Steps

1. Create Playwright integration
2. Test font loading
3. Verify print output
4. Compare with baseline PDF

---

Template Status: ✅ READY FOR INTEGRATION
