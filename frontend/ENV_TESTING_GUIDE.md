# Environment Variable Testing Guide

This guide explains how to verify that Supabase environment variables are properly configured and secure in your TrendSiam Next.js application.

## 🔒 Security Overview

- **`SUPABASE_SERVICE_ROLE_KEY`**: SERVER-ONLY, bypasses RLS, admin access
- **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**: Client-safe, respects RLS, user access
- **`SUPABASE_URL`**: Server-only URL (should match public URL)
- **`NEXT_PUBLIC_SUPABASE_URL`**: Client-safe URL

## 📋 Environment Setup

### Local Development (.env.local)
```bash
# Server-only variables (CRITICAL: Keep these secret)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key...

# Public variables (safe for client-side)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key...
```

### Production (Render/Vercel/etc.)
Set these in your hosting platform's environment variables dashboard, then redeploy.

## 🧪 Testing Commands

### 1. Node.js Environment Check
Tests raw environment variable loading:
```bash
npm run check:env:node
```
**Expected Output:**
```
✅ All required environment variables are present!
SUPABASE_URL: true (length: 52)
SUPABASE_SERVICE_ROLE_KEY: true (length: 152)
```

### 2. Next.js API Environment Check
Tests environment variables as seen by Next.js server:
```bash
# If running on port 3000
npm run check:env:api

# If running on port 3001
npm run check:env:api:3001
```
**Expected Output:**
```json
{
  "serverSeen": {
    "SUPABASE_URL": true,
    "SUPABASE_URL_LEN": 52,
    "SUPABASE_SERVICE_ROLE_KEY": true,
    "SUPABASE_SERVICE_ROLE_KEY_LEN": 152,
    "NEXT_PUBLIC_SUPABASE_URL": true,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": true
  },
  "validation": {
    "hasRequiredServerVars": true,
    "hasRequiredPublicVars": true,
    "urlsMatch": true
  }
}
```

### 3. Build Security Scan
Scans build output for leaked service role keys:
```bash
npm run build
npm run scan:build:secrets
```
**Expected Output:**
```
✅ Build scan passed: No service role key found in client bundle.
```

### 4. Complete Verification
Runs all checks in sequence:
```bash
npm run verify:env
```

## 🚨 Troubleshooting

### Missing Environment Variables
**Symptoms:**
- `env-missing: SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY` error
- API returns false for required variables

**Solutions:**
1. Check `.env.local` file exists and has correct variables
2. Restart Next.js dev server after adding variables
3. For production, check hosting platform environment variables

### Service Role Key in Build
**Symptoms:**
- `scan:build:secrets` fails with security warning
- Console error: "Service role key found in build file"

**Solutions:**
1. Check for `import` statements in client components
2. Ensure `'use client'` files don't import `supabaseAdmin.ts`
3. Move server-side operations to API routes

### URLs Don't Match
**Symptoms:**
- `urlsMatch: false` in validation

**Solutions:**
1. Ensure `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` are identical
2. Check for typos or extra characters

## 🔍 Manual Verification Steps

### Local Development
1. **Check .env.local:**
   ```bash
   cat .env.local
   ```

2. **Start dev server:**
   ```bash
   npm run dev
   ```

3. **Test environment endpoint:**
   ```bash
   curl http://localhost:3000/api/env-check
   ```

4. **Check browser console:**
   - Open browser dev tools
   - Search for "supabase" or "service"
   - Should NOT find service role key

### Production Deployment
1. **Set environment variables** in hosting dashboard
2. **Deploy application**
3. **Test live endpoint:**
   ```bash
   curl https://your-app.onrender.com/api/env-check
   ```
4. **Verify source headers:**
   ```bash
   curl -I https://your-app.onrender.com/api/weekly
   # Should show: X-TS-Source: supabase
   ```

## 🛡️ Security Best Practices

### DO ✅
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only
- Use `getSupabaseAdmin()` for server operations
- Use `getSupabaseBrowser()` for client operations
- Test with `scan:build:secrets` before deployment
- Set environment variables in hosting dashboard

### DON'T ❌
- Never import `supabaseAdmin.ts` in client components
- Never use `SUPABASE_SERVICE_ROLE_KEY` in browser code
- Never commit `.env.local` to git
- Never log actual secret values

## 📊 Understanding the Output

### Environment Check Response
```json
{
  "serverSeen": {
    "SUPABASE_URL": true,                    // ✅ Server can see URL
    "SUPABASE_SERVICE_ROLE_KEY": true,       // ✅ Server can see service key
    "SUPABASE_SERVICE_ROLE_KEY_LEN": 152     // ✅ Key has expected length
  },
  "validation": {
    "hasRequiredServerVars": true,          // ✅ All server vars present
    "hasRequiredPublicVars": true,          // ✅ All public vars present
    "urlsMatch": true                       // ✅ URLs are consistent
  },
  "nodePid": 12345,                         // Process ID
  "nodeEnv": "development"                  // Environment
}
```

### Security Scan Results
- **✅ Pass**: No service role key found in build
- **❌ Fail**: Service role key detected in client bundle

## 🆘 Common Issues

### Issue: `fetch failed` error
**Cause**: Next.js server not running
**Solution**: Start with `npm run dev`

### Issue: All variables show `false`
**Cause**: Wrong port or missing `.env.local`
**Solution**: Check file exists and restart server

### Issue: `urlsMatch: false`
**Cause**: Inconsistent URLs between server and public vars
**Solution**: Make sure both URL variables are identical

### Issue: Build scan fails
**Cause**: Service role key leaked to client bundle
**Solution**: Check imports in client components

## 🔄 Next.js Environment Loading

- **Development**: Loads `.env.local` automatically
- **Production**: Uses hosting platform environment variables
- **Build time**: Some variables baked into build, others runtime-only
- **Client vs Server**: Only `NEXT_PUBLIC_*` variables reach browser

## 📞 Support

If you encounter issues:
1. Run `npm run verify:env` and share output
2. Check for typos in variable names
3. Verify hosting platform environment variables
4. Restart server after environment changes
