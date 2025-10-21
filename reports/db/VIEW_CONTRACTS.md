# Database View Contracts - TrendSiam

**Purpose:** Define and enforce column contracts for frontend-facing views  
**Last Updated:** 2025-10-21  
**Enforced By:** `scripts/validate-db-objects.js` (runs in CI)

---

## Overview

This document defines the **mandatory columns and types** for all views consumed by the frontend. Any changes to these contracts MUST be backward-compatible or coordinated with frontend code updates.

---

## View: `public.v_home_news` (and alias `public_v_home_news`)

**Purpose:** Home feed news items for main page display  
**Contract Version:** 2 (added popularity_score_precise 2025-10-21)  
**Rows:** ~20 items (today's data + fallback last 60 days if needed)  
**Security:** Definer (postgres) semantics, read-only for anon/authenticated

### Required Columns

| Column | Type | Nullable | Description | Frontend Usage |
|--------|------|----------|-------------|----------------|
| `id` | text | NO | Unique story identifier | Key, routing |
| `title` | text | NO | Story title (Thai) | Display |
| `summary` | text | YES | Story summary (Thai) | Display, modal |
| `summary_en` | text | YES | Story summary (English) | Display, i18n |
| `category` | text | YES | Story category | Filtering, badges |
| `platform` | text | YES | Platform name (YouTube) | Icons, links |
| `channel` | text | YES | Channel name | Display, attribution |
| `published_at` | timestamp with time zone | YES | Original publish time | Display, sorting |
| `snapshot_date` | date | YES | Date added to DB | Filtering |
| `source_url` | text | YES | Link to original content | External links |
| `ai_generated_image` | text | YES | AI image URL (Top-3 only) | Top-3 cards |
| `platform_thumbnail` | text | YES | Platform thumbnail URL | Fallback images |
| `ai_prompt` | text | YES | AI image prompt | Display, diagnostics |
| `popularity_score` | numeric(6,3) | YES | Display score 0-100 | Badges, display |
| **`popularity_score_precise`** | **numeric** | **YES** | **Full precision score** | **Sorting, calculations** |
| `rank` | bigint | YES | Row number (for display order) | Sorting |
| `video_views` | bigint | YES | View count | Stats |
| `likes` | bigint | YES | Like count | Stats |
| `comments` | bigint | YES | Comment count | Stats |
| `growth_rate_value` | numeric | YES | Growth rate (numeric) | Trending indicators |
| `growth_rate_label` | text | YES | Growth rate (label) | Display |
| `ai_opinion` | text | YES | AI analysis | Modal, detail view |
| `score_details` | text | YES | Score breakdown | Diagnostics |
| `video_id` | text | YES | YouTube video ID | Links |
| `external_id` | text | YES | Platform external ID | Links |
| `platform_mentions` | text | YES | Mentions | Display |
| `keywords` | text | YES | Keywords | Search, filtering |
| `updated_at` | timestamp with time zone | YES | Last updated timestamp | Freshness |

**Total Columns:** 28

### Critical Columns (Must Never Be Missing)

- `id` - Primary key
- `title` - Required for display
- `popularity_score` - Display score
- **`popularity_score_precise`** - **CRITICAL** for sorting (added 2025-10-21)
- `published_at` - Required for time display
- `summary` - Required for content
- `category` - Required for filtering
- `platform` - Required for icons/links

### Validation Rule

```javascript
const requiredFields = [
  'id', 
  'title', 
  'popularity_score',
  'popularity_score_precise',  // Added 2025-10-21
  'published_at',
  'summary',
  'category',
  'platform'
]

// Type validation
assert(typeof item.popularity_score_precise === 'number' || item.popularity_score_precise === null)
```

### Breaking Changes History

| Date | Change | Migration | Frontend Impact |
|------|--------|-----------|-----------------|
| 2025-10-21 | Added `popularity_score_precise` | 005 | **High** - Frontend expects this column for sorting |
| 2025-10-20 | Created alias `v_home_news` → `public_v_home_news` | 004 | Low - Backward compat maintained |

---

## View: `public.public_v_system_meta`

**Purpose:** Safe system configuration keys (no secrets)  
**Contract Version:** 1  
**Security:** Definer semantics, read-only for anon/authenticated

### Required Columns

| Column | Type | Nullable | Description | Frontend Usage |
|--------|------|----------|-------------|----------------|
| `key` | text | NO | Config key name | Lookup |
| `value` | text | YES | Config value | Display, config |
| `updated_at` | timestamp with time zone | YES | Last updated | Freshness |

**Expected Keys:**
- `home_limit` - Number of items to show on home (default: 20)
- `news_last_updated` - Last time news was refreshed
- `home_columns_hash` - Hash of home feed columns
- `home_freshness_policy` - Freshness policy description

---

## Enforcement

### CI Validation (GitHub Actions)

File: `.github/workflows/security-audit.yml`  
Job: `db-smoke-test`

```yaml
- name: Run DB validation script
  run: node ../scripts/validate-db-objects.js
```

### Local Validation

```bash
cd D:\TrendSiam
node scripts/validate-db-objects.js
```

**Expected Output:**
```
✅ v_home_news columns: Has required fields including popularity_score_precise (numeric)
```

---

## Adding New Columns

**Process:**

1. **Design:** Decide nullable vs. NOT NULL, default values
2. **Migration:** Write idempotent SQL migration with DROP CASCADE if needed
3. **Update Contract:** Add column to this document
4. **Update Validation:** Add to `scripts/validate-db-objects.js`
5. **Test:** Run validation script, verify build passes
6. **Document:** Update `DB_SCHEMA_FIX_CLOSEOUT.md` with change reason

**Rules:**
- ✅ **DO** add nullable columns (backward compatible)
- ✅ **DO** add columns at the end (if using CREATE OR REPLACE)
- ❌ **DON'T** remove columns without frontend coordination
- ❌ **DON'T** change column types without migration + frontend update
- ❌ **DON'T** rename columns without alias or frontend coordination

---

## Troubleshooting

### "Column does not exist" error

**Symptom:** Frontend queries fail with `column X does not exist`

**Solution:**
1. Check view definition: `\d+ public.v_home_news` in psql
2. Compare to this contract document
3. Run validation: `node scripts/validate-db-objects.js`
4. If column missing: apply migration to add it
5. If column exists but wrong type: create new migration to fix type

### "Permission denied" error

**Symptom:** `permission denied for table news_trends`

**Root Cause:** View using `security_invoker = true` but anon cannot read base tables

**Solution:**
```sql
ALTER VIEW public.public_v_home_news SET (security_invoker = false);
```

This uses **definer (postgres)** privileges, allowing anon to read through the view without accessing base tables directly.

---

**Document Owner:** TrendSiam Dev Team  
**Review Schedule:** Monthly or after any view schema change  
**Next Review:** 2025-11-21

---

**END OF DOCUMENT**

