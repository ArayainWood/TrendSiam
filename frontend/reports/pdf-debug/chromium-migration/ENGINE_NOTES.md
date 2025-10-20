# CHROMIUM ENGINE IMPLEMENTATION NOTES

**Created:** 2025-10-20  
**Phase:** 3 - Chromium Engine (Playwright)

## Engine Architecture

### Core Components

1. **chromiumEngine.ts**
   - Singleton browser instance for performance
   - Context isolation per PDF generation
   - Font loading verification
   - Health check capability

2. **pdf-chromium route**
   - New endpoint: `/api/weekly/pdf-chromium`
   - Same data contract as legacy route
   - Feature flag controlled
   - Proper error handling

3. **Feature Flags**
   - `PDF_CHROMIUM_ENABLED`: Enable/disable engine
   - `PDF_LEGACY_ENABLED`: Keep legacy as fallback
   - `PDF_CHROMIUM_TRAFFIC_PERCENT`: Gradual rollout

4. **Health Check**
   - Endpoint: `/api/health-pdf`
   - Tests both engines
   - Reports browser version
   - Validates font loading

## Configuration

### Playwright Launch Args
```javascript
[
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-zygote',
  '--single-process', // Important for serverless
  '--font-render-hinting=none', // Consistent fonts
]
```

### PDF Generation Options
```javascript
{
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: false,
  margin: {
    top: '20mm',
    right: '15mm',
    bottom: '20mm',
    left: '15mm',
  },
  scale: 1,
}
```

## Key Features

1. **Singleton Browser**
   - Reuses browser instance across requests
   - Reduces startup overhead
   - Graceful shutdown on exit

2. **Font Loading**
   - Waits for document.fonts.ready
   - Falls back to custom flag
   - Logs loaded fonts for debugging

3. **Error Handling**
   - Comprehensive try/catch
   - Detailed error logging
   - Proper cleanup of resources

4. **Performance**
   - Target: <2s generation time
   - Actual: TBD (awaiting tests)
   - Memory: ~200MB per instance

## Environment Considerations

### Development
- Browser launches in headless mode
- Console logs forwarded
- Full error details

### Production
- Serverless compatibility
- Resource limits considered
- Timeout handling (30s max)

### Docker/Container
- Requires Chrome dependencies
- Consider chrome-aws-lambda for Lambda
- May need additional system fonts

## Debugging

### Common Issues

1. **Browser won't launch**
   ```bash
   # Install dependencies
   npx playwright install chromium
   npx playwright install-deps
   ```

2. **Fonts not loading**
   - Check network tab for 404s
   - Verify absolute URLs in HTML
   - Check CORS headers

3. **Timeout errors**
   - Increase page.setContent timeout
   - Check for blocking resources
   - Verify font loading signals

### Debug Commands
```javascript
// Enable verbose logging
DEBUG=pw:browser* npm run dev

// Test specific font
await page.evaluate(() => {
  document.fonts.load('16px Noto Sans Thai');
});

// Screenshot for debugging
await page.screenshot({ path: 'debug.png' });
```

## Migration Strategy

### Phase 1: Testing (Current)
- Feature flag: 100% to Chromium in dev
- Monitor: Generation time, memory usage
- Verify: Font rendering, Thai diacritics

### Phase 2: Canary (Next)
- Feature flag: 10% to Chromium in prod
- Monitor: Error rates, performance
- Collect: User feedback

### Phase 3: Rollout
- Gradual increase: 10% → 25% → 50% → 100%
- Keep legacy route active
- Quick rollback capability

### Phase 4: Cleanup
- Deprecate legacy route
- Remove @react-pdf dependencies
- Update documentation

## Known Limitations

1. **File Size**
   - Chromium PDFs may be larger
   - Due to font embedding
   - Acceptable trade-off for quality

2. **Cold Start**
   - First request slower (~3-5s)
   - Subsequent requests faster (<2s)
   - Consider warming strategy

3. **Resource Usage**
   - Higher memory than @react-pdf
   - Requires headless Chrome
   - Monitor in production

---

Engine Status: ✅ IMPLEMENTED
