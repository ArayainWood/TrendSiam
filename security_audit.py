#!/usr/bin/env python3
"""
SECTION K - Security and Environment Hygiene Audit

This script verifies that:
1. No service role keys are exposed in frontend code
2. Environment variables are used correctly
3. No credentials are accidentally committed
"""

import os
import re
from pathlib import Path

def audit_frontend_security():
    """Audit frontend code for security issues."""
    print("🔒 SECTION K: Security Audit Starting...")
    
    issues = []
    warnings = []
    
    # Check frontend source code for service role key usage
    frontend_src = Path("frontend/src")
    
    if frontend_src.exists():
        for file_path in frontend_src.rglob("*.ts"):
            if file_path.is_file():
                try:
                    content = file_path.read_text(encoding='utf-8')
                    
                    # Check for service role key in client-side files
                    if "SUPABASE_SERVICE_ROLE_KEY" in content:
                        path_str = str(file_path).replace("\\", "/")
                        # Flag usage in components and stores (definitely client-side)
                        if "/components/" in path_str or "/stores/" in path_str:
                            issues.append(f"🚨 Service role key found in client-side file: {file_path}")
                        # Allow in API routes and lib files (server-side)
                        elif "/api/" not in path_str and "/lib/" not in path_str:
                            issues.append(f"🚨 Service role key found in unexpected location: {file_path}")
                    
                    # Check for hardcoded keys
                    if re.search(r'eyJ[A-Za-z0-9_-]{50,}', content):
                        issues.append(f"🚨 Potential hardcoded JWT token in: {file_path}")
                    
                    # Check for process.env usage in components
                    if "/components/" in str(file_path) and "process.env.SUPABASE_SERVICE_ROLE_KEY" in content:
                        issues.append(f"🚨 Service role key accessed in component: {file_path}")
                        
                except Exception as e:
                    warnings.append(f"⚠️ Could not read {file_path}: {e}")
        
        for file_path in frontend_src.rglob("*.tsx"):
            if file_path.is_file():
                try:
                    content = file_path.read_text(encoding='utf-8')
                    
                    # Same checks for TSX files
                    if "SUPABASE_SERVICE_ROLE_KEY" in content:
                        path_str = str(file_path).replace("\\", "/")
                        # TSX files should never use service role key
                        issues.append(f"🚨 Service role key found in TSX component: {file_path}")
                            
                except Exception as e:
                    warnings.append(f"⚠️ Could not read {file_path}: {e}")
    
    # Check Python files for NEXT_PUBLIC usage (should not be used)
    for py_file in Path(".").glob("*.py"):
        if py_file.is_file() and py_file.name not in ['security_audit.py', 'diagnose_supabase.py']:
            try:
                content = py_file.read_text(encoding='utf-8')
                if "NEXT_PUBLIC_" in content and py_file.name not in ['summarize_all.py']:  # Legacy file exception
                    warnings.append(f"⚠️ NEXT_PUBLIC_ variable used in Python file: {py_file}")
                    
                # Check for anon key usage in Python
                if "SUPABASE_ANON_KEY" in content and py_file.name not in ['summarize_all.py']:  # Legacy file exception
                    warnings.append(f"⚠️ Anon key used in Python file (should use service role): {py_file}")
                    
            except Exception as e:
                warnings.append(f"⚠️ Could not read {py_file}: {e}")
    
    # Check for .env files that might be committed
    env_files = ['.env', '.env.local', '.env.production', 'frontend/.env.local']
    for env_file in env_files:
        if Path(env_file).exists():
            warnings.append(f"⚠️ Environment file found (ensure it's git-ignored): {env_file}")
    
    return issues, warnings

def audit_environment_usage():
    """Audit environment variable usage patterns."""
    print("🔧 Auditing environment variable usage...")
    
    # Expected patterns
    patterns = {
        'frontend_client': ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
        'frontend_server': ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'REVALIDATE_SECRET'],
        'python_backend': ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'YOUTUBE_API_KEY', 'OPENAI_API_KEY']
    }
    
    usage_summary = {}
    
    # Check frontend usage
    frontend_api = Path("frontend/src/app/api")
    if frontend_api.exists():
        for api_file in frontend_api.rglob("*.ts"):
            if api_file.is_file():
                try:
                    content = api_file.read_text(encoding='utf-8')
                    for var in patterns['frontend_server']:
                        if f"process.env.{var}" in content:
                            usage_summary.setdefault(var, []).append(f"frontend/api/{api_file.name}")
                except Exception:
                    pass
    
    # Check Python usage
    for py_file in Path(".").glob("*.py"):
        if py_file.is_file():
            try:
                content = py_file.read_text(encoding='utf-8')
                for var in patterns['python_backend']:
                    if f"os.getenv('{var}')" in content or f'os.getenv("{var}")' in content:
                        usage_summary.setdefault(var, []).append(f"python/{py_file.name}")
            except Exception:
                pass
    
    return usage_summary

def print_audit_results():
    """Print comprehensive audit results."""
    print("\n" + "="*60)
    print("🔒 SECTION K: SECURITY AUDIT RESULTS")
    print("="*60)
    
    issues, warnings = audit_frontend_security()
    usage = audit_environment_usage()
    
    # Print security issues
    if issues:
        print("\n🚨 CRITICAL SECURITY ISSUES:")
        for issue in issues:
            print(f"   {issue}")
    else:
        print("\n✅ No critical security issues found")
    
    # Print warnings
    if warnings:
        print("\n⚠️  WARNINGS:")
        for warning in warnings:
            print(f"   {warning}")
    else:
        print("\n✅ No security warnings")
    
    # Print environment usage
    print("\n📋 ENVIRONMENT VARIABLE USAGE:")
    for var, files in usage.items():
        print(f"   {var}: {', '.join(files)}")
    
    # Security checklist
    print("\n✅ SECURITY CHECKLIST:")
    checks = [
        ("Service role key not in frontend components", len([i for i in issues if "component" in i]) == 0),
        ("No hardcoded JWT tokens found", len([i for i in issues if "JWT token" in i]) == 0),
        ("Python uses correct environment variables", 'SUPABASE_SERVICE_ROLE_KEY' in usage),
        ("Frontend APIs use service role correctly", any('frontend/api' in f for f in usage.get('SUPABASE_SERVICE_ROLE_KEY', []))),
    ]
    
    for check_name, passed in checks:
        status = "✅" if passed else "❌"
        print(f"   {status} {check_name}")
    
    # Final status
    critical_issues = len(issues)
    if critical_issues == 0:
        print(f"\n🎉 SECURITY AUDIT PASSED: {len(checks)} checks completed, 0 critical issues")
        return True
    else:
        print(f"\n🚨 SECURITY AUDIT FAILED: {critical_issues} critical issues found")
        return False

if __name__ == "__main__":
    success = print_audit_results()
    exit(0 if success else 1)
