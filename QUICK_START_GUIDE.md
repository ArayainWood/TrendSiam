# TrendSiam Quick Start Guide

## 🚀 **5-Minute Setup**

### 1. Environment Configuration
```bash
# Copy template
cp .env.example .env
cd frontend && cp ../.env.example .env.local

# Add your credentials to both files:
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
YOUTUBE_API_KEY=your_key
OPENAI_API_KEY=sk-proj-your_key
```

### 2. Database Setup
```sql
-- Run in Supabase SQL Editor:
\i migration_001_schema_contract.sql
```

### 3. Install Dependencies
```bash
# Python
pip install -r requirements.txt

# Frontend
cd frontend && npm install
```

### 4. Run Pipeline
```bash
# Test run (no DB changes)
python summarize_all_v2.py --limit 5 --verbose --dry-run

# Full run
python summarize_all_v2.py --limit 20 --verbose --force-refresh-stats
```

### 5. Start Frontend
```bash
cd frontend && npm run dev
# Visit: http://localhost:3000
```

## 🔍 **Verification**

### Check Data Flow
```bash
# 1. Run pipeline
python summarize_all_v2.py --limit 10 --verbose --force-refresh-stats

# 2. Check system meta
curl "http://localhost:3000/api/system-meta?key=news_last_updated"

# 3. Verify UI shows fresh data
curl "http://localhost:3000/api/weekly?diag=1&limit=3"
```

### Security Check
```bash
python security_audit.py
# Expected: "SECURITY AUDIT PASSED"
```

## 🛠️ **Debug Tools**

- **Developer Dashboard**: http://localhost:3000/dev-dashboard
- **Debug API**: http://localhost:3000/api/_debug/news  
- **Environment Check**: http://localhost:3000/api/env-check

## ✅ **Success Indicators**

- [ ] Pipeline runs without errors
- [ ] UI loads with data from Supabase
- [ ] Auto-refresh works (check console logs)
- [ ] No TypeScript compilation errors
- [ ] Security audit passes
- [ ] Network tab shows only Supabase calls (no JSON)

## 🆘 **Troubleshooting**

**"Missing Supabase credentials"**
→ Check .env files have correct keys

**"No data in UI"** 
→ Run pipeline first to populate database

**"TypeScript errors"**
→ Run `cd frontend && npm run build`

**"Security audit failed"**
→ Verify no service role keys in client code
