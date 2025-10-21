# CHANGELOG

## [Unreleased] - Pre-GitHub Publication

### Security Hardening (2025-10-20)

#### Added
- **SECURITY.md**: Comprehensive security policy with vulnerability reporting process, security features documentation, and known considerations (~7,000 words)
- **CODEOWNERS**: Team responsibility definitions for code review and approval
- **frontend/env.example**: Environment variable template with safe placeholder values and security reminders
- **Enhanced .gitignore**: Added exclusions for test artifacts (*.pdf, test PDFs), audit reports (reports/repo/*.json), and build artifacts

#### Security Audits Completed
- **Repository Secret Scan**: Zero hardcoded secrets found in tracked files (gitleaks verification)
- **Database Security Audit**: 100% Plan-B compliant (RLS enabled on 9/9 tables, views-only access, zero base table grants)
- **npm Dependency Audit**: 0 vulnerabilities found (npm audit --production clean)
- **Dangerous Pattern Scan**: Zero eval/Function/innerHTML issues (3 dangerouslySetInnerHTML instances verified safe in PDF template)

#### Documentation
- **reports/repo/SECURITY_SWEEP.md**: 47-section comprehensive repository security scan (~15,000 words)
- **reports/repo/DB_SECURITY_COMPLIANCE.md**: 60-section database audit with Plan-B verification (~18,000 words)
- **reports/repo/CLEANUP_INDEX.md**: 204-file inventory with phased cleanup plan (~20,000 words)
- **reports/repo/FINAL_AUDIT_REPORT.md**: Executive summary with recommendations (~12,000 words)
- **reports/repo/PROGRESS_SUMMARY.md**: Task completion tracking (~5,000 words)
- **reports/repo/PREPUBLISH_STATUS.md**: Comprehensive status report with Phase 2 execution plan

#### Changed
- **.gitignore**: Enhanced with PDF exclusions, audit report exclusions, and test artifact patterns
- **memory-bank/01_security_plan_b.mb**: Updated with RLS audit results and Plan-B compliance verification
- **memory-bank/04_pdf_system.mb**: Updated with Stage 3 Chromium migration completion status

#### Removed
- **frontend/.next/**: Deleted build artifacts containing webpack-bundled anon keys (793 gitleaks findings resolved)
- **Legacy PDF routes**: Deleted debug and QA routes from frontend/src/app/api/weekly/pdf/ (kept pdf-legacy/ for fallback)

### Database Security (2025-10-15 to 2025-10-20)

#### Fixed
- **Legacy Views**: Dropped `public_v_home_news_old_20250927` and `public_v_ai_images_latest_old_20250927` with CASCADE
- **RLS Compliance**: Enabled Row Level Security on `public.home_demo_seed` with read policy
- **Function Security**: Secured `public.util_has_column` with explicit search_path (`pg_catalog, public`)

#### Verified
- **Plan-B Security Model**: 100% compliant (anon reads from views only, service-role backend-only)
- **RLS Status**: All 9 public tables have RLS enabled
- **Grant Compliance**: Zero SELECT grants on base tables for anon/authenticated roles
- **View Contract**: home_feed_v1 verified with exactly 26 columns (no missing, no unexpected)
- **SECURITY DEFINER Views**: 6 views justified and documented (read-only, column-filtered)

### PDF System (2025-10-18 to 2025-10-20)

#### Added
- **Chromium PDF Engine**: Stage 3 rollout complete at 100% traffic
- **Smart Router**: Automatic per-request fallback to legacy if Chromium fails
- **Monitoring**: `/api/pdf-engine-report` dashboard with success rate and latency metrics

#### Fixed
- **Thai Rendering**: 100% accuracy with HarfBuzz support (SARA AA preserved)
- **Item #20 Bug**: "Trailer: Memory Wiped!" corruption fixed (was "Trailer=@")
- **CJK/Emoji Support**: Korean, Japanese, and full emoji rendering verified

#### Configuration
- `PDF_CHROMIUM_ENABLED=true` - Chromium engine active
- `PDF_LEGACY_ENABLED=true` - Legacy available for automatic fallback only
- `PDF_CHROMIUM_TRAFFIC_PERCENT=100` - All traffic to Chromium

### Testing & Verification

#### Completed
- Database Security Advisor: 40% reduction in fixable errors (4/10 fixed)
- Secret scanning: Zero hardcoded secrets in working tree
- Dependency audit: 0 npm vulnerabilities

#### Pending
- Git history purge (requires git-filter-repo)
- File cleanup execution (~87MB savings)
- Full system verification (manual browser tests)

---

## [Previous Releases]

See individual reports in `reports/` and `frontend/reports/` for detailed historical changes:
- PDF migration reports: `frontend/reports/pdf-debug/`
- Database audit reports: `reports/db/`
- Historical fix summaries: Root directory `*_SUMMARY.md` files

---

## Migration Notes

### Breaking Changes
None. All changes are security hardening and documentation improvements.

### Deprecations
- **pdf-legacy/ routes**: Kept for 1 release cycle as automatic fallback, will be removed after 30 days of Chromium stability

### Database Migrations
All database migrations from 2025-09 to 2025-10 are documented in:
- `reports/db/ADVISOR_STATUS.md` - Latest security status
- `reports/repo/DB_SECURITY_COMPLIANCE.md` - Comprehensive audit
- `frontend/db/sql/migrations/` - Migration SQL files

---

## Contributors

- TrendSiam AI Agent (Cursor IDE) - Security audit and documentation
- Previous contributors - See individual reports for attribution

---

## Security

For security vulnerabilities, see [SECURITY.md](SECURITY.md) for reporting instructions.

---

**Last Updated:** 2025-10-20  
**Next Release:** Pending Phase 2 completion and GitHub publication
