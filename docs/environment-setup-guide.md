# 🔧 TrendSiam Environment Configuration Guide

This guide will help you set up the environment configuration files for both the Python backend and Next.js frontend to securely connect to Supabase.

## 📋 Quick Setup Instructions

### 1️⃣ Python Backend Environment (.env)

Create a `.env` file in the **root directory** of the project:

```bash
# Navigate to the root directory
cd /path/to/TrendSiam

# Create the .env file
touch .env
```

Add the following content to the `.env` file:

```env
# TrendSiam Backend Environment Configuration
# ================================================================
# 🔐 SUPABASE CONFIGURATION
# ================================================================

# Supabase Project URL
SUPABASE_URL=https://your-project.supabase.co

# Supabase Anonymous Key (safe for backend use)
SUPABASE_ANON_KEY=your_anon_key

# ================================================================
# 🔧 ADDITIONAL BACKEND CONFIGURATION
# ================================================================

# Environment mode
ENVIRONMENT=development

# Backend API Configuration
API_HOST=localhost
API_PORT=5000
```

### 2️⃣ Next.js Frontend Environment (.env.local)

Create a `.env.local` file in the **frontend directory**:

```bash
# Navigate to the frontend directory
cd /path/to/TrendSiam/frontend

# Create the .env.local file
touch .env.local
```

Add the following content to the `.env.local` file:

```env
# TrendSiam Frontend Environment Configuration
# ================================================================
# 🔐 SUPABASE CONFIGURATION
# ================================================================

# Supabase Project URL (NEXT_PUBLIC_ prefix makes it available in browser)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co

# Supabase Anonymous Key (NEXT_PUBLIC_ prefix makes it available in browser)
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# ================================================================
# 🔧 ADDITIONAL FRONTEND CONFIGURATION
# ================================================================

# Environment mode
NEXT_PUBLIC_ENVIRONMENT=development

# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000

# App Configuration
NEXT_PUBLIC_APP_NAME=TrendSiam
NEXT_PUBLIC_APP_VERSION=1.0.0
```

## 🔐 Getting Your Supabase Credentials

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to **Settings → API**
4. Copy the following values:
   - **Project URL**: Replace `https://your-project.supabase.co`
   - **anon public key**: Replace `your_anon_key`

## 🛡️ Security Best Practices

### ✅ What's Already Protected

- **✅ .gitignore Protection**: Both `.env` and `.env.local` files are already included in the project's `.gitignore`
- **✅ Environment Variables**: Sensitive data is properly separated from code
- **✅ Frontend Prefixing**: Next.js variables use `NEXT_PUBLIC_` prefix for browser exposure

### ⚠️ Important Security Notes

1. **Never commit environment files**: The `.env` and `.env.local` files should NEVER be committed to Git
2. **Anon key safety**: The anon key is safe for frontend use ONLY when Row Level Security (RLS) is enabled and properly configured in Supabase
3. **Service role keys**: Never expose service_role keys to the frontend - they should only be used in server-side code
4. **Local development**: Keep your environment files secure and never share them publicly

## 🧪 Testing Your Setup

After creating the environment files, you can test the configuration:

### Backend Test
```python
import os
from dotenv import load_dotenv

load_dotenv()

supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_ANON_KEY')

print(f"Supabase URL: {supabase_url}")
print(f"Key configured: {'✅' if supabase_key else '❌'}")
```

### Frontend Test
```javascript
// In your Next.js component or page
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('Key configured:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅' : '❌')
```

## 📁 File Structure

After setup, your project structure should include:

```
TrendSiam/
├── .env                 # ← Backend environment (CREATE THIS)
├── .gitignore          # ← Already includes .env protection
├── frontend/
│   ├── .env.local      # ← Frontend environment (CREATE THIS)
│   └── ...
└── ...
```

## 🚀 Next Steps

Once your environment files are configured:

1. **Install Supabase SDK** for Python backend:
   ```bash
   pip install supabase
   ```

2. **Install Supabase SDK** for Next.js frontend:
   ```bash
   cd frontend
   npm install @supabase/supabase-js
   ```

3. **Configure Supabase clients** in your application code using the environment variables

## 🆘 Troubleshooting

- **Environment variables not loading**: Ensure you're using the correct file names (`.env` and `.env.local`)
- **Variables not available in frontend**: Check that frontend variables have the `NEXT_PUBLIC_` prefix
- **Connection issues**: Verify your Supabase credentials are correct and your project is active

---

✅ **You're now ready to securely connect to Supabase!**
