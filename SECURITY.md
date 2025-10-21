# Security Policy

## Reporting a Vulnerability

We take the security of TrendSiam seriously. If you discover a security vulnerability, please follow these steps:

### 1. **Do Not** Open a Public Issue
Please do not report security vulnerabilities through public GitHub issues.

### 2. Report Privately
Send a detailed report to the project maintainers via:
- **Email:** [Add your security email here]
- **GitHub Security Advisory:** Use the "Security" tab → "Report a vulnerability" (if enabled)

### 3. Include in Your Report
- **Description:** Clear description of the vulnerability
- **Impact:** Potential security impact
- **Steps to Reproduce:** Detailed steps to reproduce the issue
- **Affected Components:** Which parts of the system are affected
- **Suggested Fix:** If you have ideas for remediation

### 4. Response Timeline
- **Acknowledgment:** Within 48 hours
- **Initial Assessment:** Within 7 days
- **Fix & Disclosure:** Coordinated disclosure after fix is released

---

## Security Best Practices

### For Contributors

#### 1. Never Commit Secrets
- **Never** commit API keys, passwords, or tokens
- Use environment variables (`.env.local`) for all secrets
- Verify `.gitignore` excludes `.env*` files
- Use `env.example` as template with placeholder values

#### 2. Keep Dependencies Updated
- Regularly run `npm audit` and fix CRITICAL/HIGH issues
- Review dependency licenses for compliance
- Pin dependencies to specific versions in production

#### 3. Follow Plan-B Security Model
- Frontend APIs use **anon key only** (read-only)
- Service-role key **backend-only** (never client-side)
- Read from `public_v_*` views only (never base tables)
- All base tables have Row Level Security (RLS) enabled

#### 4. Code Review Requirements
- All code changes require review before merge
- Security-sensitive changes require security team approval
- Use pre-commit hooks to catch secrets/lint issues

---

## Security Features

### 1. Database Security (Plan-B Model)

TrendSiam uses a defense-in-depth approach:

- **Row Level Security (RLS):** Enabled on all public tables
- **Views-Only Access:** Frontend reads from `public_v_*` views only
- **Zero Base Table Grants:** Anon/authenticated roles cannot read base tables directly
- **SECURITY DEFINER Views:** 6 justified views with owner privileges (read-only, column-filtered)
- **Function Security:** All functions have secure `search_path` to prevent injection

**Verification:**
- Run `frontend/db/sql/fixes/verify_permissions_model.sql` for comprehensive checks
- See `reports/repo/DB_SECURITY_COMPLIANCE.md` for latest audit

### 2. Environment Variable Security

- **Separation:** Public vars (`NEXT_PUBLIC_*`) vs server-only vars
- **Validation:** Environment check API (`/api/env-check`) returns boolean indicators only
- **Templates:** `frontend/env.example` provides safe placeholder values
- **Exclusions:** `.gitignore` excludes all `.env*` files

**Required Variables:**
```env
# Public (safe for client)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Server-only (NEVER expose to client)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_SECRET=your-admin-secret
```

### 3. API Security

- **Rate Limiting:** 100 requests/hour per IP on telemetry endpoints
- **Admin Endpoints:** Protected with `x-admin-secret` header
- **Cache Headers:** `no-store, no-cache` on sensitive endpoints
- **CORS:** No wildcard `*` origins (verified)

**Protected Routes:**
- `/api/diagnostics/*` - Admin diagnostics (header-protected)
- `/api/env-check` - Environment validator (boolean indicators only)
- `/api/telemetry/view` - View tracking (rate-limited)

### 4. Content Security

- **No eval/Function:** Zero dynamic code execution
- **No innerHTML:** Zero direct DOM manipulation (verified)
- **dangerouslySetInnerHTML:** 3 instances (all PDF template, static content only)
- **Input Sanitization:** All user inputs sanitized before storage/display

---

## Known Security Considerations

### 1. SECURITY DEFINER Views (Accepted by Design)

**What:** 6 database views use `SECURITY DEFINER` to allow anon role to read base tables via owner privileges

**Why:** Per Plan-B security model, views provide controlled read-only access without exposing base tables

**Mitigations:**
- Views are **read-only** (no INSERT/UPDATE/DELETE)
- Views expose **safe columns only** (no keys/secrets/internal logs)
- View owners have **minimal privileges**
- Regular audits of view definitions
- Documented in `memory-bank/01_security_plan_b.mb`

**Affected Views:**
- `public.home_feed_v1` (canonical home feed)
- `public.public_v_home_news` (compatibility alias)
- `public.public_v_system_meta` (config access, whitelisted keys only)
- `public.public_v_ai_images_latest` (AI images)
- `public.public_v_weekly_stats` (weekly statistics)
- `public.public_v_weekly_snapshots` (snapshot data)

### 2. Legacy PDF Routes (Temporary)

**What:** `/api/weekly/pdf-legacy/*` endpoints kept for rollback capability

**Why:** Stage 3 Chromium migration complete, but keeping legacy for 1 release cycle

**Mitigations:**
- Isolated from main PDF route (`/api/weekly/pdf`)
- Feature-flagged (`PDF_LEGACY_ENABLED=true`)
- No direct access (automatic fallback only)
- Scheduled for removal after 30 days of Chromium stability

### 3. Debug Endpoints (Intentional)

**What:** `/api/_debug/*` and `/api/diagnostics/*` endpoints exist in production

**Why:** System diagnostics and health checks

**Mitigations:**
- Protected with admin headers (`x-admin-secret`)
- Never expose secrets (boolean/length indicators only)
- Return only safe system metadata
- Rate-limited where applicable

---

## Security Audits

### Latest Audit: 2025-10-20 (Pre-GitHub Release)

**Status:** ✅ **PASS** (LOW risk, production-ready)

**Findings:**
- Zero hardcoded secrets found
- Zero JWT tokens committed
- Service-role usage: Backend-only (verified)
- Database: Plan-B compliant (verified)
- RLS: Enabled on all 9 public tables
- Dangerous patterns: Zero (eval, Function, innerHTML)

**Reports:**
- `reports/repo/SECURITY_SWEEP.md` - Repository security scan
- `reports/repo/DB_SECURITY_COMPLIANCE.md` - Database audit
- `reports/db/ADVISOR_STATUS.md` - Supabase Security Advisor status

### Previous Audit: 2025-10-15 (Database Security Advisor)

**Status:** ✅ **COMPLETE** (40% reduction in fixable errors)

**Findings:**
- 4 issues fixed (legacy views, RLS, function security)
- 6 items accepted by design (SECURITY DEFINER views)
- Risk reduced from MEDIUM to LOW

**Reports:**
- `reports/db/ADVISOR_FINDINGS.md`
- `reports/db/VERIFICATION_CHECKLIST.md`

---

## Security Checklist for Developers

### Before Committing Code

- [ ] No hardcoded secrets (run `git diff` and review)
- [ ] No debug logs with sensitive data
- [ ] Environment variables used for all config
- [ ] `.env*` files excluded by `.gitignore`
- [ ] Frontend APIs use anon key only
- [ ] Service-role key used backend-only (API routes)
- [ ] No direct base table reads in frontend
- [ ] All queries use `public_v_*` views
- [ ] Rate limiting on high-cost endpoints
- [ ] Admin endpoints protected with headers
- [ ] No eval/Function/innerHTML usage
- [ ] Input sanitization where applicable

### Before Releasing

- [ ] Run `npm audit --production` and fix CRITICAL/HIGH
- [ ] Run secret scanner (e.g., `gitleaks detect`)
- [ ] Run full system tests
- [ ] Verify RLS enabled on new tables
- [ ] Verify views granted to anon/authenticated
- [ ] Update security documentation if behavior changes
- [ ] Review CHANGELOG for security-relevant changes

---

## Dependencies & Licenses

### npm Packages
- **Audit:** Run `npm audit --production` regularly
- **Licenses:** Run `npx license-checker --summary`
- **Policy:** Avoid GPL/AGPL (require source disclosure)

### Python Packages (if applicable)
- **Audit:** Run `pip-audit` or `safety check`
- **Licenses:** Run `pip-licenses`

---

## Incident Response

### If Secrets Leaked

1. **Immediate:**
   - Rotate all leaked keys/tokens immediately
   - Verify no unauthorized access occurred
   - Document the incident

2. **Remediation:**
   - Commit key rotation (use new secrets)
   - Update `.env*` files on all environments
   - Add leaked patterns to secret scanner rules

3. **Prevention:**
   - Add pre-commit hook with secret scanner
   - Review `.gitignore` exclusions
   - Train team on secret management

### If Vulnerability Discovered

1. **Assess:**
   - Severity (CRITICAL/HIGH/MEDIUM/LOW)
   - Scope (affected versions/users)
   - Exploitability (PoC exists?)

2. **Remediate:**
   - Develop fix (test thoroughly)
   - Coordinate disclosure if external reporter
   - Prepare security advisory

3. **Release:**
   - Release patch version
   - Publish security advisory
   - Notify affected users
   - Update CHANGELOG

---

## Security Resources

### Internal Documentation
- `memory-bank/01_security_plan_b.mb` - Plan-B Security Model
- `memory-bank/15_env_and_keys_policy.mb` - Environment variable policy
- `docs/playbook-2.0/playbook-2.0-summary.mb` - Playbook summary
- `reports/repo/SECURITY_SWEEP.md` - Latest security audit

### External Resources
- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/security)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/archive/2024/2024_cwe_top25.html)

---

## Contact

For security concerns:
- **Email:** [Add security contact email]
- **GitHub:** Use private vulnerability reporting (Security tab)
- **Response Time:** Acknowledgment within 48 hours

For general questions:
- **GitHub Issues:** Use public issues for non-security questions
- **Discussions:** GitHub Discussions for community support

---

**Last Updated:** 2025-10-20  
**Next Review:** 2026-01-20 (quarterly)

---

## Acknowledgments

We thank the security community for responsible disclosure and appreciate all contributions to making TrendSiam more secure.

---

**END OF SECURITY POLICY**

