# Additional Analysis Feature Test Plan

## Overview
Test plan for the restored "Additional Analysis" section in News Detail modal.
Ensures the feature works end-to-end from DB → API → UI with proper security and fallbacks.

## Test Environment Setup
- Development server running on `http://localhost:3001` (or 3000)
- Supabase environment variables configured (optional for JSON fallback testing)
- Sample data available in `frontend/public/data/thailand_trending_summary.json`

## Phase A: Database & API Tests

### A1. Health Check
**Test**: Database connectivity
```bash
curl http://localhost:3001/api/_health/db
```
**Expected**: `{ "ok": true }` when DB is available, error details when not

### A2. Weekly API Analysis Field
**Test**: Analysis field in API response
```bash
curl http://localhost:3001/api/weekly?limit=3
```
**Expected**: 
- Items contain `analysis` field when DB has analysis data
- `X-TS-Source: supabase` when DB available
- `X-TS-Source: json-fallback` when DB unavailable
- Analysis field populated from `ai_opinion` data

### A3. Home API Consistency
**Test**: Same data structure in Home API
```bash
curl http://localhost:3001/api/home?limit=3
```
**Expected**:
- Same dataset as Weekly API
- Analysis field present in response
- Consistent source headers

### A4. Data Source Priority
**Test**: Analysis field mapping priority
**Expected**:
1. Database `analysis` field (if exists)
2. Falls back to `ai_opinion` field  
3. Falls back to `undefined` if neither exists

## Phase B: UI Rendering Tests

### B1. Modal with Analysis
**Test**: News item that has analysis data
**Steps**:
1. Open homepage
2. Click on a news item to open modal
3. Verify "Additional Analysis" section appears

**Expected**:
- Section title: "วิเคราะห์เพิ่มเติม" (Thai) / "Additional Analysis" (English)
- Brain icon visible next to title
- Analysis content in styled container
- Content properly sanitized and formatted

### B2. Modal without Analysis  
**Test**: News item without analysis data
**Steps**:
1. Open homepage
2. Click on news item without analysis
3. Verify modal layout

**Expected**:
- "Additional Analysis" section NOT shown
- No empty boxes or placeholders
- Other sections (Summary, View Details) still work normally

### B3. Content Sanitization
**Test**: Analysis content safety
**Expected**:
- HTML tags stripped from analysis content
- Content length limited (max 2000 chars)
- Whitespace normalized
- No XSS vulnerabilities

### B4. Responsive Layout
**Test**: Modal responsiveness  
**Expected**:
- Analysis section fits mobile screens
- Typography consistent with app design
- No layout shifts when section appears/disappears

## Phase C: Data Flow Tests

### C1. Supabase Mode
**Test**: With Supabase environment variables set
**Steps**:
1. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
2. Restart dev server
3. Test API endpoints

**Expected**:
- APIs return `X-TS-Source: supabase`
- Analysis data from database `analysis` or `ai_opinion` fields
- No JSON fallback unless DB truly empty

### C2. Fallback Mode  
**Test**: Without Supabase credentials
**Steps**:
1. Remove/comment out Supabase env vars
2. Restart dev server
3. Test API endpoints

**Expected**:
- APIs return `X-TS-Source: json-fallback`
- Analysis data from JSON file `ai_opinion` field
- No crashes or errors

### C3. Mixed Content
**Test**: Items with and without analysis
**Expected**:
- Some items show analysis section
- Some items don't show analysis section
- No console errors or warnings

## Phase D: Security Tests

### D1. Environment Variables
**Test**: Secret exposure
**Expected**:
- SUPABASE_SERVICE_ROLE_KEY not in client bundle
- No credentials in browser DevTools
- Server-only secrets remain server-only

### D2. Content Safety
**Test**: Malicious content handling
**Expected**:
- HTML injection prevented
- Script tags stripped
- Content length limits enforced

### D3. API Security
**Test**: Endpoint security
**Expected**:
- RLS policies still active
- Service role used only server-side
- No unauthorized data access

## Phase E: Build & Performance Tests

### E1. TypeScript Compilation
**Test**: Build process
```bash
npm run build
```
**Expected**:
- Zero TypeScript errors
- No type warnings related to analysis field
- Build completes successfully

### E2. Runtime Performance
**Test**: Modal performance
**Expected**:
- Modal opens quickly (<200ms)
- No hydration errors
- No console warnings

### E3. Bundle Size
**Test**: Impact on bundle
**Expected**:
- Minimal increase in bundle size
- Analysis renderer tree-shakes properly
- No unnecessary dependencies

## Success Criteria

### ✅ Must Pass
- [ ] APIs include analysis field consistently
- [ ] Modal shows analysis when data exists
- [ ] Modal hides analysis when data missing
- [ ] No TypeScript errors
- [ ] No runtime console errors
- [ ] No secrets leaked to client
- [ ] Responsive layout maintained

### ✅ Should Pass  
- [ ] Analysis content properly sanitized
- [ ] Graceful fallback from DB to JSON
- [ ] Performance impact minimal
- [ ] Build process unchanged

### ✅ Nice to Have
- [ ] Analysis content formatted beautifully
- [ ] Smooth animations for section appearance
- [ ] Additional analysis features (bullets, etc.)

## Known Issues / Limitations

1. **HTML Content**: Currently strips HTML tags for safety. Future enhancement could add proper HTML sanitization.

2. **Markdown Support**: Analysis renderer ready for markdown but not implemented. Can be added later with remark/rehype.

3. **Bullet Points**: Analysis structure supports bullets but UI implementation is basic text only.

4. **Real Analysis Data**: Currently maps from existing `ai_opinion` field. Future pipeline improvements could write dedicated analysis content.

## Post-Test Cleanup

After testing:
1. Ensure Supabase credentials are properly configured for production
2. Verify analysis sections appear for items with analysis data
3. Confirm no UI/UX regressions in other modal sections
4. Check that new features are properly logged/instrumented
