# Security Policy

## Supported Versions

This project is currently maintained as a portfolio demonstration. Security updates are provided on a best-effort basis.

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly:

1. **Do NOT** create a public GitHub issue
2. Instead, please send details to the repository owner via GitHub private message
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Fix Timeline**: Depends on severity
  - Critical: Within 1-2 days
  - High: Within 1 week
  - Medium: Within 2 weeks
  - Low: Next regular update

## Security Measures

This project implements several security best practices:

### Secret Management
- All sensitive configuration stored in environment variables
- No hardcoded secrets in source code
- `.env` files excluded from version control
- Regular secret scanning via GitHub Actions

### Dependency Security
- Automated vulnerability scanning with:
  - Dependabot alerts
  - npm audit (Node.js)
  - pip-audit (Python)
  - Safety checks
- Security updates applied promptly
- Hash verification for Python dependencies

### Code Security
- Static analysis with:
  - Bandit (Python security)
  - ESLint security rules
  - CodeQL analysis
- Pre-commit hooks for secret detection
- Type safety checks with TypeScript

### CI/CD Security
- All commits scanned for secrets
- Security checks must pass before merge
- Automated security reports on all PRs
- Weekly security scans scheduled

## Security Configuration

### Environment Variables
All sensitive configuration should use environment variables:

```bash
# Copy .env.example to .env and update with actual values
cp .env.example .env
```

Never commit `.env` files or real secrets.

### Pre-commit Hooks
Install pre-commit hooks to prevent accidental secret commits:

```bash
pip install pre-commit
pre-commit install
```

### Running Security Scans Locally

#### Python
```bash
pip install bandit safety pip-audit
bandit -r . -ll
safety check -r requirements.txt
pip-audit -r requirements.txt
```

#### Node.js
```bash
cd frontend
npm audit
npm audit fix  # Auto-fix where possible
```

#### Secret Detection
```bash
# Using gitleaks
gitleaks detect --source . --verbose

# Using detect-secrets
detect-secrets scan --all-files
```

## Compliance

This project follows security best practices and aims for compliance with:

- OWASP Top 10 vulnerability prevention
- GDPR/PDPA privacy requirements (no PII collection)
- Security-by-design principles
- Principle of least privilege

## Security Checklist for Contributors

Before submitting code:

- [ ] No hardcoded secrets or API keys
- [ ] Dependencies are from trusted sources
- [ ] New dependencies have been audited
- [ ] Input validation is implemented
- [ ] Error messages don't leak sensitive info
- [ ] Logging doesn't include sensitive data
- [ ] Security tests pass locally
- [ ] Pre-commit hooks pass

## Contact

For security concerns, please contact the repository maintainer through GitHub.

---

**Last Updated**: November 2025  
**Security Audit**: See `SECURITY_AUDIT_COMPREHENSIVE_REPORT.md` for latest audit results
