#!/bin/bash
# =========================================================
# REGRESSION GUARD: Forbid Base Table Reads
# Date: 2025-09-26
#
# This script checks for forbidden base table access patterns
# in TypeScript/TSX files to enforce the Plan-B security model.
# Only public_v_* views should be accessed by frontend code.
# =========================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track violations
VIOLATIONS=0
VIOLATION_FILES=()

echo "🔍 Checking for forbidden base table access patterns..."
echo "=================================================="

# Base tables that should never be accessed directly
BASE_TABLES=(
  "system_meta"
  "news_trends"
  "stories"
  "snapshots"
  "ai_images"
  "stats"
  "image_files"
  "weekly_report_snapshots"
)

# Directories to check (exclude migration/SQL files)
CHECK_DIRS=(
  "frontend/src"
  "frontend/app"
  "frontend/pages"
  "frontend/components"
  "frontend/lib"
)

# Function to check for violations
check_violations() {
  local pattern="$1"
  local description="$2"
  
  # Build the grep command with proper paths
  local grep_paths=""
  for dir in "${CHECK_DIRS[@]}"; do
    if [ -d "$dir" ]; then
      grep_paths="$grep_paths $dir"
    fi
  done
  
  if [ -z "$grep_paths" ]; then
    echo "⚠️  No directories to check found"
    return
  fi
  
  # Search for the pattern
  if grep -r -i -n --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
    "$pattern" $grep_paths 2>/dev/null | grep -v "test-plan-b" | grep -v "_debug" > /tmp/violations.txt; then
    
    echo -e "${RED}❌ Found violations: $description${NC}"
    while IFS= read -r line; do
      echo "   $line"
      # Extract filename
      filename=$(echo "$line" | cut -d: -f1)
      if [[ ! " ${VIOLATION_FILES[@]} " =~ " ${filename} " ]]; then
        VIOLATION_FILES+=("$filename")
      fi
      ((VIOLATIONS++))
    done < /tmp/violations.txt
    echo ""
  fi
}

# Check for direct table references in from() calls
for table in "${BASE_TABLES[@]}"; do
  # Check for .from('table_name') or .from("table_name")
  check_violations "\.from\(['\"]${table}['\"]" "Direct access to ${table} table"
  
  # Check for JOIN patterns
  check_violations "JOIN ${table}" "JOIN with ${table} table"
  check_violations "join\(['\"]${table}['\"]" "Join with ${table} table"
  
  # Check for FROM patterns in template strings
  check_violations "FROM ${table}" "FROM ${table} in SQL"
  check_violations "from ${table}" "from ${table} in SQL"
done

# Check for patterns that might indicate base table access
check_violations "FROM\s+public\.[a-z_]+\s*WHERE" "Possible base table query"
check_violations "from\s+public\.[a-z_]+\s*where" "Possible base table query"

# Special check: Views should not reference system_meta directly
echo "🔍 Checking SQL view definitions for direct system_meta access..."
if [ -d "frontend/db/sql" ]; then
  if grep -r -n --include="*.sql" "FROM system_meta" frontend/db/sql 2>/dev/null | \
     grep -v "public_v_system_meta" | \
     grep -v "-- " | \
     grep -v "COMMENT" > /tmp/view_violations.txt; then
    
    echo -e "${RED}❌ Found SQL views accessing system_meta directly:${NC}"
    while IFS= read -r line; do
      echo "   $line"
      ((VIOLATIONS++))
    done < /tmp/view_violations.txt
    echo ""
  else
    echo -e "${GREEN}✅ No SQL views access system_meta directly${NC}"
  fi
fi

# Summary
echo "=================================================="
if [ $VIOLATIONS -eq 0 ]; then
  echo -e "${GREEN}✅ No base table access violations found!${NC}"
  echo "All code properly uses public_v_* views."
  exit 0
else
  echo -e "${RED}❌ Found $VIOLATIONS base table access violations!${NC}"
  echo ""
  echo "Files with violations:"
  printf '%s\n' "${VIOLATION_FILES[@]}" | sort -u
  echo ""
  echo "To fix these violations:"
  echo "1. Replace direct table access with public_v_* views"
  echo "2. For system_meta, use 'public_v_system_meta'"
  echo "3. For news data, use 'public_v_home_news'"
  echo "4. For AI images, use 'public_v_ai_images_latest'"
  echo ""
  echo "Exceptions:"
  echo "- Test files checking security (like test-plan-b)"
  echo "- Debug routes protected by NODE_ENV checks"
  echo "- Migration/SQL files in db/sql directories"
  exit 1
fi
