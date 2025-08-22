# Security Notes - TrendSiam Python Dependencies

## Overview

This document outlines the security measures implemented to address Dependabot alerts for the `cryptography` package and establish secure coding practices for the project.

## Addressed Vulnerabilities

### 1. CVE-2023-49083: Cryptography PKCS#12 Null Pointer Dereference
- **Severity**: High
- **Affected versions**: < 41.0.7
- **Fix**: Upgraded to cryptography >= 42.0.0
- **Mitigation**: Added certificate/key validation in `core/crypto_security.py`

### 2. CVE-2023-50782: Bleichenbacher Timing Oracle (RSA PKCS#1 v1.5 Decryption)
- **Severity**: High
- **Affected versions**: < 42.0.0
- **Fix**: Upgraded to cryptography >= 42.0.0
- **Mitigation**: Blocked PKCS1v15 padding for decryption; enforced OAEP only

### 3. CVE-2023-38325: Vulnerable Vendored OpenSSL
- **Severity**: High
- **Affected versions**: < 41.0.2
- **Fix**: Upgraded to cryptography >= 42.0.0

## Security Measures Implemented

### 1. Dependency Management

#### Lockfile with Hashes
- Created `requirements.in` as the source of truth
- Generate locked `requirements.txt` with: 
  ```bash
  pip-compile --generate-hashes --resolver=backtracking requirements.in
  ```
- Install with hash verification:
  ```bash
  pip install --require-hashes -r requirements.txt
  ```

#### Version Pinning
- `cryptography>=42.0.0,<43.0.0` - Latest secure version
- All dependencies pinned to specific major versions
- Critical transitive dependencies explicitly pinned

### 2. Secure Cryptography Wrapper

Created `core/crypto_security.py` that:
- **Blocks** RSA decryption with PKCS1v15 padding (vulnerable)
- **Enforces** OAEP padding for RSA decryption
- **Validates** certificate/key matching for PKCS#12
- **Requires** minimum 2048-bit RSA keys
- **Provides** secure defaults for all operations

### 3. Automated Security Scanning

#### GitHub Actions Workflow
`.github/workflows/python-security.yml` runs on:
- Every push/PR affecting Python code
- Weekly scheduled scans
- Manual trigger

Checks include:
1. **pip-audit**: Vulnerability scanning
2. **safety**: Additional vulnerability database
3. **bandit**: Static security analysis
4. **Custom checks**: Banned API detection

#### Banned APIs Test
Automatically fails CI if detected:
- `padding.PKCS1v15()` used with `decrypt`
- RSA key size < 2048 bits
- Hardcoded private keys

### 4. Code Review Protection

CODEOWNERS file ensures security team review for:
- `requirements*.txt` and `requirements*.in`
- Security modules (`core/crypto_security.py`, etc.)
- Security workflows

## Safe Usage Guidelines

### DO ✅

```python
from core.crypto_security import SecureCrypto

# Generate secure keys
private_key, public_key = SecureCrypto.generate_rsa_key_pair(4096)

# Encrypt with OAEP (secure)
ciphertext = SecureCrypto.rsa_encrypt(data, public_key)

# Decrypt with OAEP (secure)
plaintext = SecureCrypto.rsa_decrypt(ciphertext, private_key)

# Sign with PSS (secure)
signature = SecureCrypto.rsa_sign(data, private_key)
```

### DON'T ❌

```python
# NEVER use PKCS1v15 for decryption
plaintext = private_key.decrypt(
    ciphertext,
    padding.PKCS1v15()  # VULNERABLE!
)

# NEVER use weak key sizes
key = rsa.generate_private_key(key_size=1024)  # TOO WEAK!

# NEVER hardcode keys
private_key = "-----BEGIN RSA PRIVATE KEY-----..."  # INSECURE!
```

## Updating Dependencies

### Regular Updates
1. Check for updates: `pip list --outdated`
2. Update requirements.in with new versions
3. Regenerate lockfile:
   ```bash
   pip-compile --generate-hashes --resolver=backtracking requirements.in
   ```
4. Run security tests before committing
5. Create PR with security label

### Emergency Security Updates
1. For critical vulnerabilities:
   ```bash
   # Update specific package
   pip-compile --upgrade-package cryptography --generate-hashes requirements.in
   ```
2. Run full test suite
3. Deploy immediately after review

## Monitoring

### Dependabot
- Enabled for pip ecosystem
- Auto-creates PRs for security updates
- PRs labeled with `security`

### Manual Checks
Run monthly or when alerted:
```bash
# Local security audit
pip-audit -r requirements.txt --strict
safety check -r requirements.txt
bandit -r . -ll

# Check for banned APIs
python -m pytest tests/test_crypto_security.py
```

## Rollback Procedure

If an update causes issues:
1. Revert the commit: `git revert <commit-hash>`
2. Regenerate old lockfile from previous requirements.in
3. Redeploy
4. Investigate and fix issues before re-attempting update

## Compliance

This implementation ensures:
- ✅ All known `cryptography` vulnerabilities patched
- ✅ Secure coding practices enforced
- ✅ Automated vulnerability scanning
- ✅ Hash-verified installations
- ✅ No vulnerable APIs exposed
- ✅ Backward compatibility maintained

## Contact

For security concerns:
- Create a security advisory in GitHub
- Label issues with `security`
- Tag `@security-team` in PRs

Last updated: 2025-08-19
Next review: 2025-09-19
