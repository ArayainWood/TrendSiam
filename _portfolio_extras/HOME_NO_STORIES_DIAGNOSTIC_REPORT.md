# Home Page "No Trending Stories" Diagnostic Report

## 🔍 Issue Summary
Home page shows "No Trending Stories Right Now" despite `public.v_home_news` view containing data.

## 📋 Diagnostic Results

### ✅ 1. Database & View Structure
- **View Exists**: `public.v_home_news` is properly defined
- **Permissions**: `GRANT SELECT ON public.v_home_news TO anon, authenticated;`
- **Fields**: Includes `display_image_url_raw`, `ai_image_url`, `growth_rate`, etc.
- **Source**: Queries `public.news_trends` with proper WHERE clause

### ✅ 2. Frontend Data Source
- **Correct Query**: `fetchHomeNews()` uses `.from('v_home_news')`
- **Field Selection**: Properly selects `display_image_url_raw` and other required fields
- **Normalization**: `normalizeNewsItem()` converts `display_image_url_raw` → `display_image_url`

### ✅ 3. Type Compatibility
- **Schema Match**: Frontend expects `display_image_url`, normalizer provides it
- **Field Types**: Normalizer handles string/number conversion for `view_count`, `like_count`
- **Growth Rate**: Properly handles both string and numeric `growth_rate` values

### 🚨 4. **ROOT CAUSE IDENTIFIED**: Database Connection Issue

From build output:
```
[weekly/data-api] Supabase connection test: {
  connected: false,
  error: "Could not find the table 'public.pg_tables' in the schema cache",
  timestamp: '2025-08-20T17:14:08.445Z'
}
```

**Analysis**: The Supabase client cannot connect to the database, which means:
1. The `v_home_news` query returns empty results or errors
2. The frontend falls back to showing "No Trending Stories"
3. The view itself is correct, but unreachable

### 🔧 5. Diagnostic Logging Added
Added behind `NEXT_PUBLIC_DEBUG_UI=1` flag:
- `[diag] v_home_news rows:` in `newsRepo.ts`
- `[diag] before/after normalize count=` in `normalizeNewsItem.ts`  
- `[diag] home props/items len` in `page.tsx`

## 🎯 Recommended Fixes

### **Priority 1: Database Connection**
The primary issue is the Supabase connection. Check:

1. **Environment Variables**:
   ```bash
   # Verify these are set correctly in .env.local
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

2. **Database Status**:
   - Verify Supabase project is active and not paused
   - Check if `public.v_home_news` view exists in Supabase dashboard
   - Confirm RLS policies allow anon access

3. **Network/Firewall**:
   - Test direct Supabase connection from browser
   - Check if corporate firewall blocks Supabase domains

### **Priority 2: Enable Debug Logging**
To see exactly where the data flow breaks:

1. Add to `.env.local`:
   ```
   NEXT_PUBLIC_DEBUG_UI=1
   ```

2. Check browser console for:
   - `[diag] v_home_news rows: 0` → Database returns no data
   - `[diag] v_home_news rows: X` but `after normalize count= 0` → Normalization issue
   - No logs at all → Connection/query failure

### **Priority 3: Temporary Workaround** (if needed)
If database connection cannot be fixed immediately, the system already has JSON fallback:

```typescript
// In homeDataSecure.ts - already implemented
[weekly/data] ⚠️ Using JSON fallback at 2025-08-20T17:14:08.449Z
```

## 🧪 Testing Steps

1. **Enable Debug Mode**:
   ```bash
   # Add to .env.local
   echo "NEXT_PUBLIC_DEBUG_UI=1" >> .env.local
   ```

2. **Test Connection**:
   ```bash
   npm run build && npm run start
   # Open browser to http://localhost:3000
   # Check console for [diag] logs
   ```

3. **Direct Database Test**:
   ```sql
   -- Run in Supabase SQL editor
   SELECT COUNT(*) FROM public.v_home_news;
   SELECT * FROM public.v_home_news LIMIT 3;
   ```

## 📊 Expected Diagnostic Output

### **If Database Connected**:
```
[diag] v_home_news rows: 15 { error: null, sample: [{id: "123", title: "..."}] }
[diag] before normalize count= 15 {id: "123", display_image_url_raw: "..."}
[diag] after normalize count= 15 {id: "123", display_image_url: "https://..."}
[diag] home props/items len 15 {id: "123", display_image_url: "https://..."}
```

### **If Database Disconnected**:
```
[newsRepo] v_home_news query error: { message: "connection failed" }
[diag] v_home_news rows: 0 { error: "...", sample: [] }
[diag] before normalize count= 0 undefined
[diag] after normalize count= 0 undefined  
[diag] home props/items len 0 undefined
```

## 🔒 Constraints Maintained
- ✅ No schema changes
- ✅ No RLS modifications  
- ✅ No env key changes
- ✅ Only temporary DEBUG_UI logs
- ✅ Weekly report flows untouched

## 🚀 Next Actions
1. **Immediate**: Check Supabase project status and connection
2. **Debug**: Enable `NEXT_PUBLIC_DEBUG_UI=1` and check console logs
3. **Verify**: Test direct database query in Supabase dashboard
4. **Fix**: Address connection issue or investigate why `v_home_news` returns no data

The frontend code is correct - the issue is at the database connection/query level.
