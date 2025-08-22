#!/usr/bin/env python3
"""
Comprehensive Security Audit for TrendSiam Repository

This script performs a thorough security audit including:
1. Secret detection
2. Dependency vulnerabilities
3. Code security patterns
4. Configuration issues
"""

import os
import re
import json
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Set
from datetime import datetime

class SecurityAuditor:
    def __init__(self, repo_root: Path = Path.cwd()):
        self.repo_root = repo_root
        self.issues = []
        self.recommendations = []
        
        # Patterns for secret detection
        self.secret_patterns = {
            'openai_api_key': re.compile(r'sk-proj-[A-Za-z0-9]{48,}'),
            'youtube_api_key': re.compile(r'AIzaSy[A-Za-z0-9_-]{33}'),
            'supabase_jwt': re.compile(r'eyJ[A-Za-z0-9_-]{50,}\.[A-Za-z0-9_-]{50,}\.[A-Za-z0-9_-]{40,}'),
            'supabase_url': re.compile(r'https://[a-z]+\.supabase\.co'),
            'generic_api_key': re.compile(r'["\']?api[_-]?key["\']?\s*[:=]\s*["\'][^"\']{20,}["\']', re.IGNORECASE),
            'generic_secret': re.compile(r'["\']?secret[_-]?key["\']?\s*[:=]\s*["\'][^"\']{20,}["\']', re.IGNORECASE),
            'generic_password': re.compile(r'["\']?password["\']?\s*[:=]\s*["\'][^"\']+["\']', re.IGNORECASE),
            'generic_token': re.compile(r'["\']?token["\']?\s*[:=]\s*["\'][^"\']{20,}["\']', re.IGNORECASE),
        }
        
        # Files to skip
        self.skip_patterns = {
            '.git', '.venv', 'node_modules', '__pycache__', '.next', 
            'build', 'dist', '*.pyc', '*.log', '*.pdf', '*.webp', '*.png'
        }
        
        # Known safe patterns
        self.safe_patterns = {
            'os.getenv', 'process.env', 'import.meta.env',
            'NEXT_PUBLIC_', 'your_', 'example_', 'placeholder_',
            'test_', 'mock_', 'dummy_'
        }

    def should_skip_file(self, filepath: Path) -> bool:
        """Check if file should be skipped"""
        for pattern in self.skip_patterns:
            if pattern.startswith('*'):
                if filepath.suffix == pattern[1:]:
                    return True
            elif pattern in str(filepath):
                return True
        return False

    def is_safe_match(self, content: str, match_start: int) -> bool:
        """Check if a match is actually safe"""
        # Check if it's accessing environment variable
        context = content[max(0, match_start - 50):match_start + 50]
        for safe in self.safe_patterns:
            if safe in context:
                return True
        return False

    def scan_file_for_secrets(self, filepath: Path) -> List[Dict[str, Any]]:
        """Scan a single file for potential secrets"""
        issues = []
        
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                
            for secret_type, pattern in self.secret_patterns.items():
                for match in pattern.finditer(content):
                    if not self.is_safe_match(content, match.start()):
                        # Get line number
                        line_num = content[:match.start()].count('\n') + 1
                        
                        issues.append({
                            'type': 'hardcoded_secret',
                            'severity': 'critical',
                            'file': str(filepath.relative_to(self.repo_root)),
                            'line': line_num,
                            'secret_type': secret_type,
                            'preview': match.group()[:50] + '...' if len(match.group()) > 50 else match.group()
                        })
        except Exception as e:
            print(f"Error scanning {filepath}: {e}")
            
        return issues

    def scan_for_secrets(self) -> List[Dict[str, Any]]:
        """Scan entire repository for secrets"""
        print("🔍 Scanning for hardcoded secrets...")
        all_issues = []
        
        for root, dirs, files in os.walk(self.repo_root):
            # Skip directories
            dirs[:] = [d for d in dirs if d not in self.skip_patterns]
            
            for file in files:
                filepath = Path(root) / file
                if not self.should_skip_file(filepath):
                    issues = self.scan_file_for_secrets(filepath)
                    all_issues.extend(issues)
                    
        return all_issues

    def check_env_files(self) -> List[Dict[str, Any]]:
        """Check .env file security"""
        print("🔍 Checking .env file security...")
        issues = []
        
        env_files = ['.env', '.env.local', '.env.production']
        for env_file in env_files:
            filepath = self.repo_root / env_file
            if filepath.exists():
                # Check if it's in .gitignore
                gitignore_path = self.repo_root / '.gitignore'
                if gitignore_path.exists():
                    with open(gitignore_path, 'r') as f:
                        gitignore_content = f.read()
                        if env_file not in gitignore_content:
                            issues.append({
                                'type': 'env_not_ignored',
                                'severity': 'critical',
                                'file': env_file,
                                'message': f'{env_file} is not in .gitignore'
                            })
                
                # Check permissions (Unix-like systems)
                if os.name != 'nt':
                    stat_info = filepath.stat()
                    if stat_info.st_mode & 0o077:
                        issues.append({
                            'type': 'env_permissions',
                            'severity': 'high',
                            'file': env_file,
                            'message': f'{env_file} has overly permissive permissions'
                        })
                        
        return issues

    def scan_dependencies(self) -> List[Dict[str, Any]]:
        """Scan for dependency vulnerabilities"""
        print("🔍 Scanning dependencies...")
        issues = []
        
        # Check Python dependencies
        if (self.repo_root / 'requirements.txt').exists():
            try:
                # Run pip-audit if available
                result = subprocess.run(
                    ['pip-audit', '-r', 'requirements.txt', '--format', 'json'],
                    capture_output=True,
                    text=True,
                    cwd=self.repo_root
                )
                if result.returncode == 0:
                    vulns = json.loads(result.stdout)
                    for vuln in vulns:
                        issues.append({
                            'type': 'python_vulnerability',
                            'severity': vuln.get('severity', 'unknown').lower(),
                            'package': vuln.get('name'),
                            'current_version': vuln.get('version'),
                            'vulnerability': vuln.get('description', 'Unknown vulnerability')
                        })
            except (subprocess.CalledProcessError, FileNotFoundError):
                print("⚠️  pip-audit not available, skipping Python vulnerability scan")
        
        # Check Node dependencies
        if (self.repo_root / 'package.json').exists():
            try:
                # Run npm audit
                result = subprocess.run(
                    ['npm', 'audit', '--json'],
                    capture_output=True,
                    text=True,
                    cwd=self.repo_root
                )
                if result.stdout:
                    audit_data = json.loads(result.stdout)
                    if 'vulnerabilities' in audit_data:
                        for severity in ['critical', 'high', 'moderate']:
                            count = audit_data['metadata'][severity]
                            if count > 0:
                                issues.append({
                                    'type': 'npm_vulnerabilities',
                                    'severity': severity,
                                    'count': count,
                                    'message': f'{count} {severity} severity npm vulnerabilities found'
                                })
            except (subprocess.CalledProcessError, FileNotFoundError, json.JSONDecodeError):
                print("⚠️  npm audit failed or not available")
                
        return issues

    def scan_code_patterns(self) -> List[Dict[str, Any]]:
        """Scan for insecure code patterns"""
        print("🔍 Scanning for insecure code patterns...")
        issues = []
        
        insecure_patterns = {
            'eval_usage': (re.compile(r'\beval\s*\('), 'Use of eval() is dangerous'),
            'exec_usage': (re.compile(r'\bexec\s*\('), 'Use of exec() is dangerous'),
            'pickle_load': (re.compile(r'pickle\.load'), 'Unpickling untrusted data is dangerous'),
            'yaml_load': (re.compile(r'yaml\.load\s*\('), 'Use yaml.safe_load() instead'),
            'sql_injection': (re.compile(r'(SELECT|INSERT|UPDATE|DELETE).*%s|\.format\(|f["\'].*\{'), 'Potential SQL injection'),
            'command_injection': (re.compile(r'os\.system|subprocess.*shell=True'), 'Potential command injection'),
            'path_traversal': (re.compile(r'\.\.\/|\.\.\\\\'), 'Potential path traversal'),
            'hardcoded_temp': (re.compile(r'\/tmp\/|\\\\temp\\\\'), 'Hardcoded temp directory'),
        }
        
        for root, dirs, files in os.walk(self.repo_root):
            dirs[:] = [d for d in dirs if d not in self.skip_patterns]
            
            for file in files:
                if file.endswith(('.py', '.js', '.ts', '.tsx')):
                    filepath = Path(root) / file
                    try:
                        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()
                            
                        for pattern_name, (pattern, message) in insecure_patterns.items():
                            for match in pattern.finditer(content):
                                line_num = content[:match.start()].count('\n') + 1
                                issues.append({
                                    'type': 'insecure_pattern',
                                    'severity': 'high',
                                    'file': str(filepath.relative_to(self.repo_root)),
                                    'line': line_num,
                                    'pattern': pattern_name,
                                    'message': message
                                })
                    except Exception as e:
                        print(f"Error scanning {filepath}: {e}")
                        
        return issues

    def check_supabase_security(self) -> List[Dict[str, Any]]:
        """Check Supabase-specific security issues"""
        print("🔍 Checking Supabase security...")
        issues = []
        
        # Look for service role key usage in client code
        client_dirs = ['frontend/src', 'frontend/pages', 'frontend/components']
        for client_dir in client_dirs:
            dir_path = self.repo_root / client_dir
            if dir_path.exists():
                for root, _, files in os.walk(dir_path):
                    for file in files:
                        if file.endswith(('.js', '.ts', '.tsx')):
                            filepath = Path(root) / file
                            try:
                                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                                    content = f.read()
                                    
                                if 'SERVICE_ROLE_KEY' in content or 'service_role' in content:
                                    line_num = content.index('SERVICE_ROLE_KEY' if 'SERVICE_ROLE_KEY' in content else 'service_role')
                                    line_num = content[:line_num].count('\n') + 1
                                    issues.append({
                                        'type': 'service_role_in_client',
                                        'severity': 'critical',
                                        'file': str(filepath.relative_to(self.repo_root)),
                                        'line': line_num,
                                        'message': 'Service role key should never be used in client code'
                                    })
                            except Exception as e:
                                print(f"Error checking {filepath}: {e}")
                                
        return issues

    def generate_report(self) -> Dict[str, Any]:
        """Generate comprehensive security report"""
        print("\n" + "="*60)
        print("🔒 SECURITY AUDIT REPORT")
        print("="*60)
        
        # Run all scans
        secret_issues = self.scan_for_secrets()
        env_issues = self.check_env_files()
        dep_issues = self.scan_dependencies()
        code_issues = self.scan_code_patterns()
        supabase_issues = self.check_supabase_security()
        
        all_issues = secret_issues + env_issues + dep_issues + code_issues + supabase_issues
        
        # Group by severity
        critical = [i for i in all_issues if i.get('severity') == 'critical']
        high = [i for i in all_issues if i.get('severity') == 'high']
        medium = [i for i in all_issues if i.get('severity') in ['moderate', 'medium']]
        low = [i for i in all_issues if i.get('severity') == 'low']
        
        # Print summary
        print(f"\n📊 Summary:")
        print(f"  🔴 Critical: {len(critical)}")
        print(f"  🟠 High: {len(high)}")
        print(f"  🟡 Medium: {len(medium)}")
        print(f"  🟢 Low: {len(low)}")
        print(f"  📋 Total: {len(all_issues)}")
        
        # Print critical issues
        if critical:
            print(f"\n🔴 CRITICAL ISSUES ({len(critical)}):")
            for issue in critical[:10]:  # Show first 10
                print(f"\n  - Type: {issue['type']}")
                if 'file' in issue:
                    print(f"    File: {issue['file']}")
                if 'line' in issue:
                    print(f"    Line: {issue['line']}")
                if 'message' in issue:
                    print(f"    Message: {issue['message']}")
                if 'secret_type' in issue:
                    print(f"    Secret Type: {issue['secret_type']}")
                if 'preview' in issue:
                    print(f"    Preview: {issue['preview']}")
                    
        # Generate report file
        report = {
            'scan_date': datetime.now().isoformat(),
            'repository': str(self.repo_root),
            'summary': {
                'total_issues': len(all_issues),
                'critical': len(critical),
                'high': len(high),
                'medium': len(medium),
                'low': len(low)
            },
            'issues': all_issues,
            'recommendations': self.generate_recommendations(all_issues)
        }
        
        # Save report
        report_path = self.repo_root / 'security_audit_report.json'
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
            
        print(f"\n📄 Full report saved to: {report_path}")
        
        return report

    def generate_recommendations(self, issues: List[Dict[str, Any]]) -> List[str]:
        """Generate security recommendations based on findings"""
        recommendations = []
        
        # Check for hardcoded secrets
        if any(i['type'] == 'hardcoded_secret' for i in issues):
            recommendations.append(
                "🔐 URGENT: Remove all hardcoded secrets immediately. "
                "Move them to environment variables and rotate all exposed credentials."
            )
            
        # Check for env file issues
        if any(i['type'] == 'env_not_ignored' for i in issues):
            recommendations.append(
                "📝 Add all .env files to .gitignore to prevent accidental commits."
            )
            
        # Check for vulnerabilities
        if any('vulnerability' in i['type'] for i in issues):
            recommendations.append(
                "📦 Update vulnerable dependencies. Run 'npm audit fix' and update Python packages."
            )
            
        # Check for insecure patterns
        if any(i['type'] == 'insecure_pattern' for i in issues):
            recommendations.append(
                "🛡️ Review and fix insecure code patterns. Use parameterized queries, "
                "avoid eval/exec, and validate all inputs."
            )
            
        # Check for Supabase issues
        if any(i['type'] == 'service_role_in_client' for i in issues):
            recommendations.append(
                "🔒 Never use service_role keys in client code. Use anon key for client-side operations."
            )
            
        # General recommendations
        recommendations.extend([
            "🔄 Implement regular security scanning in CI/CD pipeline",
            "📊 Enable Dependabot for automated dependency updates",
            "🎯 Add security headers to all HTTP responses",
            "✅ Implement input validation on all API endpoints",
            "🚦 Add rate limiting to prevent abuse",
            "📋 Document security practices and incident response procedures"
        ])
        
        return recommendations


def main():
    """Run the security audit"""
    auditor = SecurityAuditor()
    report = auditor.generate_report()
    
    # Return non-zero exit code if critical issues found
    if report['summary']['critical'] > 0:
        print("\n❌ Critical security issues found. Please address immediately!")
        return 1
    elif report['summary']['high'] > 0:
        print("\n⚠️  High severity issues found. Please address soon.")
        return 0
    else:
        print("\n✅ No critical or high severity issues found.")
        return 0


if __name__ == "__main__":
    exit(main())
