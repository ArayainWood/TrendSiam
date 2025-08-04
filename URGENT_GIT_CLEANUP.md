# 🚨 URGENT: Git Cleanup Commands

## CRITICAL ISSUE: 135MB binary file in Git repository

**File**: `frontend/node_modules/@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node`

## ⚡ IMMEDIATE ACTION REQUIRED:

### Step 1: Remove the large file from Git tracking
```bash
# Remove the specific large file from Git tracking
git rm --cached "frontend/node_modules/@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node"

# Remove entire node_modules from tracking (safer)
git rm -r --cached frontend/node_modules/
```

### Step 2: Update .gitignore (ALREADY DONE)
The improved .gitignore has been created with comprehensive coverage.

### Step 3: Commit the cleanup
```bash
git add .gitignore
git commit -m "🔧 Fix: Remove large binary files and improve .gitignore

- Remove 135MB next-swc binary from Git tracking
- Add comprehensive .gitignore for Next.js/Node.js project
- Prevent future accidental commits of node_modules"
```

### Step 4: Clean Git history (OPTIONAL - for smaller repo)
⚠️ WARNING: This rewrites Git history. Only run if you're sure.

```bash
# Remove the file from entire Git history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch "frontend/node_modules/@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node"' \
  --prune-empty --tag-name-filter cat -- --all

# Clean up
git reflog expire --expire=now --all && git gc --prune=now --aggressive
```

### Step 5: Force push (if you cleaned history)
```bash
git push origin --force --all
```

## ✅ VERIFICATION:
After cleanup, verify:
```bash
# Check repository size
git count-objects -vH

# Verify no large files
git ls-files | xargs -I {} du -h {} | sort -hr | head -20
```