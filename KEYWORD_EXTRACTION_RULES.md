# Keyword Extraction Rules and Implementation

## Overview
Advanced multilingual keyword extraction system for TrendSiam that produces accurate, useful keywords from video metadata using scoring, TF-IDF, and language-aware tokenization.

## Data Sources (Priority Order)

1. **Title** (+3 score) - Highest weight
2. **Hashtags** (+2 score) - Strong signal from content creators
3. **Description** (+1 score) - Secondary terms
4. **Channel Name** (+1 score) - Artist/brand recognition
5. **Category** - Used for context only

## Extraction Process

### 1. Tokenization (Language-Aware)

#### Thai
- Pattern: `[\u0E00-\u0E7F]+`
- Example: `"รักเธอนะ"` → `["รักเธอนะ"]`

#### Japanese/Chinese
- Pattern: `[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+`
- Example: `"恋するフォーチュン"` → `["恋する", "フォーチュン"]`

#### English/Latin
- Pattern: `[a-zA-Z]+`
- Split on whitespace and punctuation
- Example: `"Love Song"` → `["Love", "Song"]`

### 2. Filtering

#### Stopwords by Language

**English**:
```
the, and, for, with, from, that, this, what, when, where,
who, why, how, but, not, all, can, will, just, only,
video, official, watch, subscribe, like, share, comment,
new, full, hd, 4k, 1080p, lyrics, audio, youtube, channel
```

**Thai**:
```
และ, หรือ, แต่, ที่, ใน, บน, กับ, ของ, เป็น, มี,
ได้, จะ, ให้, ไป, มา, เพลง, ทางการ, ดู, ชม, ฟัง,
ใหม่, ล่าสุด, วิดีโอ, คลิป, ช่อง
```

**Japanese**:
```
の, に, は, を, た, が, で, て, と, し, れ, さ,
公式, 動画, 配信, 最新, 新曲, ビデオ, チャンネル
```

#### Boilerplate Removal
- "Official MV", "Music Video" → Removed
- "feat.", "ft.", "featuring" → Normalized to "feat"
- "Full Version", "HD", "4K" → Removed

### 3. Scoring System

| Source | Points | Example |
|--------|--------|---------|
| Title appearance | +3 | `"BNK48"` in title |
| Hashtag | +2 | `#ThaiPop` |
| Description | +1 | Found in body text |
| Channel match | +1 | Channel: "BNK48 Official" |
| Generic term | -1 | "song", "music", "video" |

### 4. TF-IDF Batch Suppression

- Calculate document frequency across today's batch
- Suppress terms appearing in >30% of documents
- Formula: `score *= (1 - min(doc_freq/total_docs, 0.8))`

### 5. Final Selection

1. Sort by score (descending)
2. Take top 6 unique keywords
3. Preserve original capitalization/script

## Examples

### Example 1: Thai Pop Song
```
Input:
  Title: "รักเธอนะ - I Love You feat. Tilly Birds"
  Description: "เพลงใหม่ล่าสุด #ThaiPop #TillyBirds #NewSingle"
  Channel: "Thai Music Channel"

Process:
  1. Tokens: ["รักเธอนะ", "Love", "You", "feat", "Tilly", "Birds", "ThaiPop", "TillyBirds", "NewSingle"]
  2. Scores:
     - "รักเธอนะ": 3 (title)
     - "Tilly Birds": 3 (title) + 2 (hashtag) = 5
     - "ThaiPop": 2 (hashtag)
     - "Love": 3 (title) - 1 (generic) = 2
  3. Final: ["Tilly Birds", "รักเธอนะ", "ThaiPop", "Love You"]
```

### Example 2: Japanese Idol Group
```
Input:
  Title: "【MV】恋するフォーチュンクッキー / AKB48"
  Description: "AKB48 43rdシングル Music Video #AKB48 #恋チュン"

Process:
  1. Tokens: ["MV", "恋する", "フォーチュンクッキー", "AKB48", "恋チュン"]
  2. Filter: Remove "MV" (boilerplate)
  3. Scores:
     - "AKB48": 3 (title) + 2 (hashtag) = 5
     - "恋するフォーチュンクッキー": 3 (title)
     - "恋チュン": 2 (hashtag)
  4. Final: ["AKB48", "恋するフォーチュンクッキー", "恋チュン"]
```

### Example 3: English with Featured Artists
```
Input:
  Title: "Shape of You ft. Stormzy & Yxng Bane [Official Video]"
  Description: "New collaboration available on all platforms"

Process:
  1. Extract featured: ["Stormzy", "Yxng Bane"]
  2. Remove boilerplate: "Official Video"
  3. Scores:
     - "Shape": 3 (title)
     - "Stormzy": 3 (title) + 1 (featured) = 4
     - "Yxng Bane": 3 (title) + 1 (featured) = 4
  4. Final: ["Stormzy", "Yxng Bane", "Shape of You"]
```

## Storage Format

Keywords are stored as JSON array strings in the database:
```json
["BNK48", "รักเธอ", "Thai Pop", "Music Video"]
```

## UI Display

- Maximum 6 chips displayed
- Each chip styled with accent colors
- Hidden if no keywords available
- Backward compatible with comma-separated format

## CLI Usage

```bash
# Recompute keywords for today's batch
python summarize_all_v2.py --limit 20 --recompute-keywords --verbose

# Force recompute for all items
python summarize_all_v2.py --recompute-keywords --force-refresh-stats
```

## Verification

### SQL Check
```sql
-- Run scripts/sql/verify_keywords.sql
SELECT video_id, title, keywords FROM news_trends 
WHERE date = CURRENT_DATE LIMIT 10;
```

### Python Test
```bash
python tests/test_keyword_extraction.py
```

## Best Practices

1. **Preserve Original Script**: Don't transliterate Thai/Japanese
2. **Respect Creator Intent**: Prioritize hashtags and title keywords
3. **Avoid Over-Extraction**: Better to have 3 good keywords than 6 mediocre ones
4. **Context Matters**: Use channel/category to disambiguate
5. **Batch Uniqueness**: Suppress overly common daily terms

## Troubleshooting

### Issue: Too many generic keywords
**Solution**: Increase generic term penalties or expand stopword lists

### Issue: Missing important terms
**Solution**: Check if term is in stopwords or being filtered by length

### Issue: Duplicate keywords in different forms
**Solution**: Improve normalization rules in `_normalize()` method

### Issue: Keywords not showing in UI
**Solution**: Verify JSON format in database and check `parseKeywords()` function
