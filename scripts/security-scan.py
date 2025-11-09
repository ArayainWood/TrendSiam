#!/usr/bin/env python3
"""
Quick secret scan for TrendSiam repository.
Checks for common patterns that might indicate secrets in tracked files.
"""

import os
import re
import sys
from pathlib import Path

# Patterns that might indicate secrets
SECRET_PATTERNS = [
    # API Keys
    (r'["\']?api[_-]?key["\']?\s*[:=]\s*["\']?[a-zA-Z0-9-_.]{20,}', 'API Key'),
    (r'sk-[a-zA-Z0-9]{20,}', 'OpenAI API Key'),
    (r'AIza[a-zA-Z0-9-_]{35}', 'YouTube/Google API Key'),
    (r'eyJ[a-zA-Z0-9-_]+\.eyJ[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+', 'JWT Token'),
    (r'ghp_[a-zA-Z0-9]{36,}', 'GitHub Personal Access Token'),
    (r'ghs_[a-zA-Z0-9]{36,}', 'GitHub App Token'),
    
    # AWS
    (r'AKIA[0-9A-Z]{16}', 'AWS Access Key ID'),
    (r'["\']?aws_secret["\']?\s*[:=]\s*["\']?[a-zA-Z0-9+/]{40}', 'AWS Secret'),
    
    # Generic patterns
    (r'["\']?password["\']?\s*[:=]\s*["\']?[^\s"\']{8,}', 'Password'),
    (r'["\']?secret["\']?\s*[:=]\s*["\']?[^\s"\']{8,}', 'Secret'),
    (r'["\']?token["\']?\s*[:=]\s*["\']?[a-zA-Z0-9-_.]{20,}', 'Token'),
    
    # Database URLs
    (r'postgres://[^:]+:[^@]+@[^/]+/[^\s"\']+', 'PostgreSQL URL'),
    (r'mysql://[^:]+:[^@]+@[^/]+/[^\s"\']+', 'MySQL URL'),
    
    # Private keys
    (r'-----BEGIN (RSA |EC |)PRIVATE KEY-----', 'Private Key'),
    (r'-----BEGIN OPENSSH PRIVATE KEY-----', 'SSH Private Key'),
]

# Files and directories to skip
SKIP_PATTERNS = [
    '.git/', '__pycache__/', 'node_modules/', '.next/', 'dist/', 'build/',
    '.venv/', 'venv/', '.env', '.env.local', '*.pyc', '*.log',
    'security-scan.py',  # Skip self
    'package-lock.json', 'yarn.lock', 'poetry.lock',
    '*.min.js', '*.min.css',
]

def should_skip(file_path):
    """Check if file should be skipped."""
    path_str = str(file_path)
    for pattern in SKIP_PATTERNS:
        if pattern.endswith('/'):
            if pattern[:-1] in path_str.split(os.sep):
                return True
        elif pattern.startswith('*'):
            if path_str.endswith(pattern[1:]):
                return True
        elif pattern in path_str:
            return True
    return False

def scan_file(file_path):
    """Scan a single file for secrets."""
    findings = []
    
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            
        for line_num, line in enumerate(content.splitlines(), 1):
            for pattern, secret_type in SECRET_PATTERNS:
                matches = re.finditer(pattern, line, re.IGNORECASE)
                for match in matches:
                    # Skip if it's a variable reference or placeholder
                    matched_text = match.group(0)
                    if any(placeholder in matched_text.lower() for placeholder in 
                           ['your-', 'example', 'placeholder', 'test', 'dummy', 
                            '<your', '${', '{{', 'process.env', 'os.getenv']):
                        continue
                        
                    findings.append({
                        'file': str(file_path),
                        'line': line_num,
                        'type': secret_type,
                        'match': matched_text[:50] + '...' if len(matched_text) > 50 else matched_text
                    })
    except Exception as e:
        # Skip files that can't be read
        pass
    
    return findings

def main():
    """Main scanning function."""
    print("Scanning for potential secrets in tracked files...")
    
    # Get git tracked files only
    import subprocess
    try:
        result = subprocess.run(['git', 'ls-files'], 
                              capture_output=True, text=True, check=True)
        tracked_files = result.stdout.strip().split('\n')
    except Exception as e:
        print(f"Error getting tracked files: {e}")
        tracked_files = []
        # Fallback to walking directory
        for root, dirs, files in os.walk('.'):
            dirs[:] = [d for d in dirs if not should_skip(d + '/')]
            for file in files:
                file_path = os.path.join(root, file)
                if not should_skip(file_path):
                    tracked_files.append(file_path)
    
    all_findings = []
    files_scanned = 0
    
    for file_path in tracked_files:
        if should_skip(file_path):
            continue
            
        path = Path(file_path)
        if path.is_file():
            files_scanned += 1
            findings = scan_file(path)
            all_findings.extend(findings)
    
    print(f"\nScanned {files_scanned} files")
    
    if all_findings:
        print(f"\nWARNING: Found {len(all_findings)} potential secrets:\n")
        for finding in all_findings[:10]:  # Show first 10
            print(f"  {finding['file']}:{finding['line']} - {finding['type']}")
            print(f"    {finding['match']}")
        
        if len(all_findings) > 10:
            print(f"\n  ... and {len(all_findings) - 10} more findings")
        
        return 1
    else:
        print("\nNo secrets found in tracked files!")
        return 0

if __name__ == "__main__":
    sys.exit(main())
