# Types & Rank Normalization Guide

## Overview

This document explains TrendSiam's type-safe numeric field handling system, specifically designed to resolve the `rank` field type conflicts that were causing build failures.

## Problem Solved

**Build Error**: `Type 'string | number' is not assignable to type 'number | undefined'`
**Root Cause**: Mixed string/number types from database serialization crossing component boundaries
**Solution**: Centralized schema validation with automatic numeric coercion at data boundaries

## Architecture

### 1. Central Domain Schema (`src/lib/schema/news.ts`)

```typescript
// Zod schemas with automatic numeric coercion
export const NewsStorySchema = z.object({
  rank: optionalNumericField, // Always number | undefined after parsing
  popularity_score: numericField, // Always number after parsing
  popularity_score_precise: numericField, // Always number after parsing
  // ... other fields
})

// Type-safe parsing functions
export function parseNewsStory(data: unknown): NewsStory
export function newsItemToStory(item: NewsItem): NewsStory
```

**Key Features:**
- **Automatic Coercion**: String numbers → Real numbers at parse time
- **Type Safety**: Compile-time guarantees that `rank` is `number | undefined`
- **Validation**: Runtime validation with helpful error messages
- **Backward Compatibility**: Legacy `NewsItem` type preserved during migration

### 2. Data Repository Layer (`src/lib/data/newsRepo.ts`)

```typescript
// Critical boundary: Raw data → Normalized NewsStory
export function normalizeNewsItem(rawItem: any): NewsStory {
  return NewsStorySchema.parse({
    ...rawItem,
    rank: typeof rawItem.rank === 'string' ? parseFloat(rawItem.rank) || undefined : rawItem.rank
  })
}

// Repository ensures all data is normalized
export class APINewsRepository {
  async getHomeNews(): Promise<NewsStory[]> {
    const stories = await fetchNormalizedNews('/api/home')
    return ensureValidRanks(stories) // Guarantees numeric ranks
  }
}
```

**Boundary Rules:**
- **Input**: Accept any format (string, number, null, undefined)
- **Output**: Always return properly typed `NewsStory` objects
- **Validation**: Parse and validate at the boundary, not in components
- **Error Handling**: Log and skip invalid items rather than crashing

### 3. Safe Numeric Utilities (`src/lib/num.ts`)

```typescript
// Robust numeric conversion
export function toNumber(value: unknown, fallback: number = 0): number
export function parseRank(rank: unknown): number | undefined
export function compareNumbers(a: unknown, b: unknown): number

// Usage examples
const rank = parseRank(item.rank) // Always number | undefined
const score = toNumber(item.popularity_score, 0) // Always number
```

### 4. Ranking Utilities (`src/lib/ranking.ts`)

```typescript
// Type-safe ranking functions that handle mixed input
export function isTopN(itemOrRank: RankableItem | unknown, n: number = 3): boolean
export function isTop3(itemOrRank: RankableItem | unknown): boolean
export function sortByRank<T extends RankableItem>(items: T[]): T[]

// Flexible input handling
isTop3({ rank: "1" }) // ✅ Works with string
isTop3({ rank: 1 })   // ✅ Works with number  
isTop3(1)             // ✅ Works with direct value
```

## Usage Patterns

### Adding New Numeric Fields

1. **Update Schema**:
```typescript
// In src/lib/schema/news.ts
export const NewsStorySchema = z.object({
  // ... existing fields
  new_score: numericField, // For required numbers
  optional_count: optionalNumericField, // For optional numbers
})
```

2. **Update Repository**:
```typescript
// In src/lib/data/newsRepo.ts
export function normalizeNewsItem(rawItem: any): NewsStory {
  return NewsStorySchema.parse({
    ...rawItem,
    new_score: rawItem.new_score || 0,
    optional_count: rawItem.optional_count
  })
}
```

3. **Use Safely in Components**:
```typescript
// In components - types are guaranteed
function MyComponent({ story }: { story: NewsStory }) {
  const score: number = story.new_score // ✅ Always number
  const count: number | undefined = story.optional_count // ✅ Properly typed
}
```

### Migrating Existing Components

**Before** (Unsafe):
```typescript
import { NewsItem } from '../types'

function MyComponent({ news }: { news: NewsItem }) {
  const isTop = news.rank <= 3 // ❌ Error: string not comparable to number
}
```

**After** (Safe):
```typescript
import { NewsStory } from '../lib/schema/news'
import { isTop3 } from '../lib/ranking'

function MyComponent({ news }: { news: NewsStory }) {
  const isTop = isTop3(news) // ✅ Handles any rank type safely
}
```

### Data Flow

```
Raw API Data → Repository Layer → Components
     ↓              ↓              ↓
string|number → NewsStory → number|undefined
   (mixed)      (validated)    (type-safe)
```

## Type Safety Guarantees

### Compile-Time Checks (`src/typesafety/news.d.ts`)

```typescript
// These assertions will cause compile errors if types are wrong
type _TestNewsStoryRank = Expect<Equal<NewsStory['rank'], number | undefined>>
type _TestNewsStoryScore = Expect<Equal<NewsStory['popularity_score'], number>>
```

### Runtime Validation

```typescript
// Zod provides runtime validation with helpful errors
try {
  const story = parseNewsStory(rawData)
  // story.rank is guaranteed to be number | undefined
} catch (error) {
  console.error('Invalid news data:', error.message)
  // Handle gracefully - don't crash the app
}
```

## Database Considerations

### Supabase Column Types

```sql
-- Recommended: Use numeric types in database
ALTER TABLE news_trends 
ALTER COLUMN rank TYPE INTEGER,
ALTER COLUMN popularity_score TYPE DECIMAL(10,2);

-- Alternative: Cast in queries
SELECT 
  rank::INTEGER as rank,
  popularity_score::DECIMAL as popularity_score
FROM news_trends;
```

### JSON Serialization

```typescript
// API responses should use consistent types
app.get('/api/news', (req, res) => {
  const news = await db.query('SELECT * FROM news_trends')
  
  // Ensure numeric fields are numbers, not strings
  const normalized = news.map(item => ({
    ...item,
    rank: parseInt(item.rank) || undefined,
    popularity_score: parseFloat(item.popularity_score) || 0
  }))
  
  res.json(normalized)
})
```

## Testing

### Type Safety Tests

```bash
# Compile-time type checking
npm run typecheck

# Build verification
npm run build
```

### Runtime Tests

```typescript
// Test numeric coercion
describe('News Schema', () => {
  it('should coerce string ranks to numbers', () => {
    const result = parseNewsStory({ rank: "1", title: "Test" })
    expect(typeof result.rank).toBe('number')
    expect(result.rank).toBe(1)
  })
  
  it('should handle invalid ranks gracefully', () => {
    const result = parseNewsStory({ rank: "invalid", title: "Test" })
    expect(result.rank).toBeUndefined()
  })
})
```

## Migration Checklist

When adding new numeric fields:

- [ ] Add field to `NewsStorySchema` with appropriate coercion
- [ ] Update `normalizeNewsItem` function to handle the field
- [ ] Add type safety test in `src/typesafety/news.d.ts`
- [ ] Update components to use the new typed field
- [ ] Test with both string and number inputs
- [ ] Verify build passes without type errors

## Troubleshooting

### Common Issues

**1. "Type 'string' is not assignable to type 'number'"**
```typescript
// ❌ Wrong: Using raw data directly
const rank = rawItem.rank // Could be string

// ✅ Correct: Use normalized data
const story = normalizeNewsItem(rawItem)
const rank = story.rank // Always number | undefined
```

**2. "Property 'rank' is possibly 'undefined'"**
```typescript
// ❌ Wrong: Assuming rank exists
if (story.rank <= 3) { ... }

// ✅ Correct: Handle undefined case
if (story.rank && story.rank <= 3) { ... }
// or use utility
if (isTop3(story)) { ... }
```

**3. Build passes but runtime errors**
```typescript
// Check data at boundaries
console.log('Raw data:', rawItem)
const normalized = normalizeNewsItem(rawItem)
console.log('Normalized:', normalized)
```

## Performance Notes

- **Schema Validation**: ~1ms per item (negligible for typical loads)
- **Numeric Coercion**: ~0.1ms per field (very fast)
- **Memory**: Minimal overhead, types are compile-time only
- **Bundle Size**: Zod adds ~10KB gzipped

## Future Enhancements

1. **Strict Mode**: Option to reject invalid data instead of coercing
2. **Custom Validators**: Domain-specific validation rules (e.g., rank 1-100)
3. **Performance Optimization**: Batch validation for large datasets
4. **Schema Versioning**: Handle API changes gracefully
5. **Auto-generation**: Generate schemas from database schema

---

**Last Updated**: August 2025  
**Version**: 1.0  
**Maintainer**: TrendSiam Engineering Team
