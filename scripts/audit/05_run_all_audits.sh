#!/bin/bash
#
# Run All Database Audits
# Part of TrendSiam Comprehensive Audit
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
AUDIT_OUTPUT_DIR="$PROJECT_ROOT/audit_results"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================================================================"
echo "TrendSiam Comprehensive Database Audit"
echo "================================================================================"
echo ""
echo "Project Root: $PROJECT_ROOT"
echo "Audit Scripts: $SCRIPT_DIR"
echo "Output Directory: $AUDIT_OUTPUT_DIR"
echo ""

# Create output directory
mkdir -p "$AUDIT_OUTPUT_DIR"
echo "✅ Created output directory"
echo ""

# Check environment
cd "$PROJECT_ROOT/frontend"

if [ ! -f ".env.local" ]; then
    echo -e "${RED}❌ ERROR: .env.local not found in frontend/${NC}"
    echo "   Please create .env.local with Supabase credentials"
    exit 1
fi

echo "✅ Environment file found"
echo ""

# ==============================================================================
# 1. Connectivity Check
# ==============================================================================
echo "================================================================================"
echo "1. CONNECTIVITY CHECK"
echo "================================================================================"
echo ""

node "$SCRIPT_DIR/01_database_connectivity_check.mjs" | tee "$AUDIT_OUTPUT_DIR/01_connectivity.log"

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo -e "${GREEN}✅ Connectivity check PASSED${NC}"
else
    echo -e "${RED}❌ Connectivity check FAILED${NC}"
    echo "   Cannot proceed with database audits"
    exit 1
fi
echo ""

# ==============================================================================
# 2. Schema Inventory
# ==============================================================================
echo "================================================================================"
echo "2. SCHEMA INVENTORY"
echo "================================================================================"
echo ""

# Check if we have psql and DB_URL
if [ -z "$SUPABASE_DB_URL" ]; then
    echo -e "${YELLOW}⚠️  SUPABASE_DB_URL not set - skipping SQL audits${NC}"
    echo "   Set SUPABASE_DB_URL in .env.local to run SQL-based audits"
    echo ""
    echo "Example:"
    echo "  SUPABASE_DB_URL=postgresql://postgres:[password]@[project].pooler.supabase.com:6543/postgres?sslmode=require"
    echo ""
    
    echo "================================================================================"
    echo "AUDIT SUMMARY"
    echo "================================================================================"
    echo ""
    echo "✅ Connectivity check: PASSED"
    echo "⏭️  SQL audits: SKIPPED (no DB_URL)"
    echo ""
    echo "To run full audit, add SUPABASE_DB_URL to .env.local"
    exit 0
fi

# Load .env.local
export $(cat .env.local | grep -v '^#' | xargs)

if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  psql not found - skipping SQL audits${NC}"
    echo "   Install PostgreSQL client to run SQL-based audits"
    exit 0
fi

echo "Running schema inventory..."
psql "$SUPABASE_DB_URL" -f "$SCRIPT_DIR/02_database_schema_inventory.sql" > "$AUDIT_OUTPUT_DIR/02_schema_inventory.log" 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Schema inventory completed${NC}"
else
    echo -e "${RED}❌ Schema inventory had errors (check logs)${NC}"
fi
echo ""

# ==============================================================================
# 3. Home View Validation
# ==============================================================================
echo "================================================================================"
echo "3. HOME VIEW VALIDATION"
echo "================================================================================"
echo ""

psql "$SUPABASE_DB_URL" -f "$SCRIPT_DIR/03_home_view_validation.sql" > "$AUDIT_OUTPUT_DIR/03_home_view_validation.log" 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Home view validation completed${NC}"
else
    echo -e "${RED}❌ Home view validation had errors (check logs)${NC}"
fi
echo ""

# ==============================================================================
# 4. Security Plan-B Check
# ==============================================================================
echo "================================================================================"
echo "4. SECURITY PLAN-B CHECK"
echo "================================================================================"
echo ""

psql "$SUPABASE_DB_URL" -f "$SCRIPT_DIR/04_security_plan_b_check.sql" > "$AUDIT_OUTPUT_DIR/04_security_plan_b.log" 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Security check completed${NC}"
else
    echo -e "${RED}❌ Security check had errors (check logs)${NC}"
fi
echo ""

# ==============================================================================
# Summary
# ==============================================================================
echo "================================================================================"
echo "AUDIT COMPLETE"
echo "================================================================================"
echo ""
echo "Audit results saved to: $AUDIT_OUTPUT_DIR/"
echo ""
echo "Files created:"
ls -lh "$AUDIT_OUTPUT_DIR/"
echo ""
echo "To view results:"
echo "  cat $AUDIT_OUTPUT_DIR/01_connectivity.log"
echo "  cat $AUDIT_OUTPUT_DIR/02_schema_inventory.log"
echo "  cat $AUDIT_OUTPUT_DIR/03_home_view_validation.log"
echo "  cat $AUDIT_OUTPUT_DIR/04_security_plan_b.log"
echo ""

