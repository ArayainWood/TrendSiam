# Security Policy

## Supported Versions

We actively maintain security for the current version of TrendSiam:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Security Framework

TrendSiam implements enterprise-grade security measures:

- ✅ **Credential Protection**: All API keys secured via environment variables
- ✅ **Input Validation**: Comprehensive validation against XSS, injection attacks  
- ✅ **Command Injection Prevention**: Secure subprocess execution with allowlisting
- ✅ **Rate Limiting**: API abuse prevention with sliding window algorithms
- ✅ **Legal Compliance**: Automated ToS compliance for YouTube, OpenAI, DALL-E
- ✅ **Privacy Protection**: GDPR/CCPA compliant data handling
- ✅ **Secure Logging**: Automatic credential sanitization in all logs

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue:

### For Critical/High Severity Issues
- **DO NOT** create a public GitHub issue
- Email: `security-urgent@trendsiam.app`
- Include: Detailed description, steps to reproduce, potential impact
- Response time: Within 24 hours

### For Medium/Low Severity Issues  
- Email: `security@trendsiam.app`
- Include: Description, reproduction steps, suggested fixes
- Response time: Within 72 hours

### What to Include in Reports
1. **Description**: Clear description of the vulnerability
2. **Impact**: Potential security impact and affected components
3. **Reproduction**: Step-by-step instructions to reproduce
4. **Environment**: OS, Python version, dependency versions
5. **Proof of Concept**: Code or screenshots (if applicable)

## Security Best Practices for Users

### Environment Setup
1. **API Keys**: Store in `.env` file, never commit to git
2. **Permissions**: Run with minimal required permissions
3. **Updates**: Keep dependencies updated regularly
4. **Monitoring**: Check `logs/trendsiam_errors.log` for security events

### Production Deployment
1. **Environment Variables**: Use secure secret management
2. **HTTPS**: Always use HTTPS for web deployment
3. **Rate Limits**: Configure appropriate API rate limits
4. **Monitoring**: Implement log monitoring and alerting

## Security Audit History

- **2024-01**: Comprehensive enterprise security audit completed
  - All critical vulnerabilities resolved
  - Security framework implemented
  - Legal compliance automation added

## Automated Security Checks

Run security checks with:
```bash
python quick_security_check.py
```

Review security audit report:
```bash
cat SECURITY_AUDIT_REPORT.md
```

## Security Contact

- **General Security**: security@trendsiam.app
- **Critical Issues**: security-urgent@trendsiam.app  
- **Documentation**: This file and SECURITY_AUDIT_REPORT.md

## Acknowledgments

We appreciate responsible disclosure and will acknowledge security researchers who help improve TrendSiam's security. 