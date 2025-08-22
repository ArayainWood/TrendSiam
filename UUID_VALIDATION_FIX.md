# UUID Validation Fix - Why "No Trending Stories" Persisted

## The Real Problem

When you ran the Python ingestion script (`summarize_all_v2.py`), it created IDs like this:
```
dedda78b6f79c49075b64e8d2f8fa05c62407264a23ed754e8a38ee553f465f6
```

But the TypeScript validation was expecting UUIDs like this:
```
dedda78b-6f79-4907-5b64-e8d2f8fa05c6
```

The Zod schema was rejecting all the data because the IDs weren't in UUID format!

## The Fix Applied

I changed the validation schemas in `frontend/src/lib/db/types/views.ts`:

```typescript
// Before:
id: z.string().uuid(),

// After:
id: z.string(), // Changed from .uuid() to allow hash IDs
```

This was done for all the views:
- NewsPublicViewSchema
- SnapshotsPublicViewSchema  
- WeeklyPublicViewSchema

## Current Status

1. ✅ The server is now running
2. ✅ The validation error is fixed
3. ✅ The API should now accept the hash IDs from Python

## Check If It's Working

Open http://localhost:3000

You should now see the trending stories!

If you still see "No Trending Stories", try:
1. Hard refresh (Ctrl+Shift+R)
2. Clear browser cache
3. Wait 10 seconds for server to fully start

## Why This Happened

The Python script (`summarize_all_v2.py`) generates SHA256 hash IDs, while the TypeScript frontend expected PostgreSQL UUIDs. This is a mismatch between the data ingestion format and the frontend expectations.
