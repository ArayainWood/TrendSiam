# Latest Stories Feed - Comprehensive Test Commands

## Quick Test Commands for Complete Modal Data & YouTube Links

### 1. Non-Zero Results with Config Limits
```bash
curl -s "http://localhost:3000/api/home" | jq '.data | length'
```
**Expected**: > 0 and ≤ 20 (config-driven home_limit)

### 2. Top-3 Policy Enforcement
```bash
curl -s "http://localhost:3000/api/home" | jq '[.data[] | select(.isTop3==true)] | length'
```
**Expected**: ≤ 3 (config-driven top3_max)

### 3. AI-Only Images for Top-3
```bash
curl -s "http://localhost:3000/api/home" | jq '[.data[] | select(.showImage==true)] | length'
```
**Expected**: ≤ 3 (only Top-3 with AI images)

### 4. AI Prompts for Top-3 Only
```bash
curl -s "http://localhost:3000/api/home" | jq '[.data[] | select(.showAiPrompt==true)] | length'
```
**Expected**: ≤ 3 (only Top-3 with AI prompts)

### 5. Real YouTube Links (No Undefined)
```bash
curl -s "http://localhost:3000/api/home" | jq '[.data[] | select(.sourceUrl != null)] | .[0].sourceUrl'
```
**Expected**: Valid YouTube URL or constructed from videoId

### 6. Complete Modal Field Presence
```bash
curl -s "http://localhost:3000/api/home" | jq '.data[0] | {title, category, summary, channel, views, likes, comments, publishedAt, keywords, aiOpinion, scoreDetails}'
```
**Expected**: All fields populated with real data (not null/undefined)

### 7. Day-Scoped Ranking Integrity
```bash
curl -s "http://localhost:3000/api/home" | jq '[.data[] | .rank] | sort | .[0:5]'
```
**Expected**: [1,2,3,4,5] (sequential ranks from latest day)

### 8. Category Display on Cards
```bash
curl -s "http://localhost:3000/api/home" | jq '[.data[] | select(.category != null)] | length'
```
**Expected**: > 0 (categories present for display)

### 9. Summary Teaser Content
```bash
curl -s "http://localhost:3000/api/home" | jq '.data[0] | {title, summary, summaryEn}'
```
**Expected**: Rich summary content (not just "High engagement...")

### 10. Diagnostics Health Check
```bash
curl -s "http://localhost:3000/api/home/diagnostics" | jq '{snapshotDay, fetchedCount, columnHealth}'
```
**Expected**: All columnHealth booleans true, fetchedCount > 0

## Development Script

Run the automated comprehensive test:
```bash
node test-api-fix.js
```

This validates:
- Day-scoped ranking (no old Top-3 echo)
- Complete modal data (LISA-level richness)
- AI-only image policy (no YouTube thumbnails)
- Real YouTube links (no undefined URLs)
- Config-driven limits (no hardcode)
- Category and summary display
- Policy compliance (Top-3 gating)

## Expected Results Summary

- **Feed**: ≤20 items from latest snapshot day
- **Top-3**: Exactly 3 items with `isTop3=true`
- **Images**: AI-generated only, Top-3 only
- **Links**: Real YouTube URLs or hidden if unavailable
- **Modal**: Complete data parity with LISA baseline
- **Cards**: Category, channel, rich summary teaser
- **Ranking**: Sequential 1,2,3... within latest day