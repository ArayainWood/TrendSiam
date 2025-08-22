#!/usr/bin/env python3
"""
Find Unused Files in TrendSiam Repository

This script identifies potentially unused files that can be safely removed.
It generates a dry-run report before any deletion.
"""

import os
import re
import ast
import json
from pathlib import Path
from typing import Set, List, Dict, Any
import subprocess
from datetime import datetime

class UnusedFileFinder:
    def __init__(self, repo_root: Path = Path.cwd()):
        self.repo_root = repo_root
        self.used_files: Set[Path] = set()
        self.all_files: Set[Path] = set()
        self.imports: Dict[Path, Set[str]] = {}
        
        # Files to always keep
        self.keep_patterns = {
            '.gitignore', '.env.example', 'README.md', 'LICENSE',
            'package.json', 'package-lock.json', 'requirements.txt',
            'requirements.in', 'tsconfig.json', 'next.config.js',
            'tailwind.config.ts', 'postcss.config.mjs'
        }
        
        # Directories to skip
        self.skip_dirs = {
            '.git', '.venv', 'venv', 'node_modules', '__pycache__',
            '.next', 'build', 'dist', '.pytest_cache', 'archive'
        }
        
        # Active source directories
        self.source_dirs = {
            'frontend/src', 'frontend/scripts', 'frontend/public',
            'core', 'utils', 'scripts', 'tests'
        }

    def collect_all_files(self) -> None:
        """Collect all files in the repository"""
        for root, dirs, files in os.walk(self.repo_root):
            # Skip directories
            dirs[:] = [d for d in dirs if d not in self.skip_dirs]
            
            for file in files:
                filepath = Path(root) / file
                # Skip certain file types
                if filepath.suffix in ['.pyc', '.log', '.tmp']:
                    continue
                    
                self.all_files.add(filepath)

    def analyze_python_imports(self, filepath: Path) -> Set[str]:
        """Extract imports from Python file"""
        imports = set()
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                tree = ast.parse(f.read())
                
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        imports.add(alias.name)
                elif isinstance(node, ast.ImportFrom):
                    if node.module:
                        imports.add(node.module)
                        
            # Also check for dynamic imports and file references
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Find file references in strings
            for match in re.findall(r'["\']([^"\']+\.(?:py|json|csv|txt|md))["\']', content):
                if not match.startswith('http'):
                    imports.add(match)
                    
        except Exception as e:
            print(f"Error analyzing {filepath}: {e}")
            
        return imports

    def analyze_javascript_imports(self, filepath: Path) -> Set[str]:
        """Extract imports from JavaScript/TypeScript file"""
        imports = set()
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # ES6 imports
            for match in re.findall(r'import\s+.*?\s+from\s+["\']([^"\']+)["\']', content):
                imports.add(match)
                
            # CommonJS requires
            for match in re.findall(r'require\s*\(["\']([^"\']+)["\']\)', content):
                imports.add(match)
                
            # Dynamic imports
            for match in re.findall(r'import\s*\(["\']([^"\']+)["\']\)', content):
                imports.add(match)
                
        except Exception as e:
            print(f"Error analyzing {filepath}: {e}")
            
        return imports

    def analyze_entry_points(self) -> None:
        """Analyze main entry points to find used files"""
        # Python entry points
        python_entries = [
            'app.py', 'summarize_all.py', 'summarize_all_v2.py',
            'summarize_all_v3_supabase_only.py', 'youtube_fetcher.py',
            'ai_image_generator.py', 'ai_image_generator_v2.py'
        ]
        
        for entry in python_entries:
            entry_path = self.repo_root / entry
            if entry_path.exists():
                self.used_files.add(entry_path)
                self.trace_dependencies(entry_path)
                
        # Next.js entry points
        nextjs_entries = [
            'frontend/src/app/layout.tsx',
            'frontend/src/app/page.tsx',
            'frontend/src/pages/_app.tsx',
            'frontend/src/pages/index.tsx'
        ]
        
        for entry in nextjs_entries:
            entry_path = self.repo_root / entry
            if entry_path.exists():
                self.used_files.add(entry_path)
                self.trace_dependencies(entry_path)

    def trace_dependencies(self, filepath: Path) -> None:
        """Recursively trace dependencies from a file"""
        if filepath in self.imports:
            return  # Already processed
            
        imports = set()
        
        if filepath.suffix == '.py':
            imports = self.analyze_python_imports(filepath)
        elif filepath.suffix in ['.js', '.ts', '.tsx', '.jsx']:
            imports = self.analyze_javascript_imports(filepath)
            
        self.imports[filepath] = imports
        
        # Resolve imports to actual files
        for imp in imports:
            resolved = self.resolve_import(imp, filepath)
            if resolved and resolved not in self.used_files:
                self.used_files.add(resolved)
                self.trace_dependencies(resolved)

    def resolve_import(self, import_name: str, from_file: Path) -> Path:
        """Resolve an import to an actual file path"""
        # Handle relative imports
        if import_name.startswith('.'):
            base_dir = from_file.parent
            parts = import_name.split('/')
            
            for part in parts:
                if part == '.':
                    continue
                elif part == '..':
                    base_dir = base_dir.parent
                else:
                    base_dir = base_dir / part
                    
            # Try different extensions
            for ext in ['', '.py', '.js', '.ts', '.tsx', '.json']:
                candidate = Path(str(base_dir) + ext)
                if candidate.exists():
                    return candidate
                    
        # Handle absolute imports
        else:
            # Python module
            if from_file.suffix == '.py':
                module_path = import_name.replace('.', '/')
                for ext in ['.py', '/__init__.py']:
                    candidate = self.repo_root / (module_path + ext)
                    if candidate.exists():
                        return candidate
                        
            # Node module (simplified)
            elif from_file.suffix in ['.js', '.ts', '.tsx']:
                # Check if it's a local module
                if not import_name.startswith('@') and '/' in import_name:
                    candidate = self.repo_root / 'frontend' / 'src' / import_name
                    for ext in ['', '.ts', '.tsx', '.js', '.jsx']:
                        full_path = Path(str(candidate) + ext)
                        if full_path.exists():
                            return full_path
                            
        return None

    def check_git_references(self) -> None:
        """Check which files are referenced in git commits"""
        try:
            # Get files changed in last 100 commits
            result = subprocess.run(
                ['git', 'log', '--name-only', '--pretty=format:', '-100'],
                capture_output=True,
                text=True,
                cwd=self.repo_root
            )
            
            if result.returncode == 0:
                for line in result.stdout.split('\n'):
                    if line.strip():
                        filepath = self.repo_root / line.strip()
                        if filepath.exists():
                            self.used_files.add(filepath)
                            
        except Exception as e:
            print(f"Error checking git history: {e}")

    def check_package_json_scripts(self) -> None:
        """Check files referenced in package.json scripts"""
        pkg_path = self.repo_root / 'package.json'
        if pkg_path.exists():
            try:
                with open(pkg_path, 'r') as f:
                    pkg_data = json.load(f)
                    
                # Check scripts
                if 'scripts' in pkg_data:
                    for script in pkg_data['scripts'].values():
                        # Extract file references
                        for match in re.findall(r'[./\w]+\.(?:js|ts|py)', script):
                            filepath = self.repo_root / match
                            if filepath.exists():
                                self.used_files.add(filepath)
                                
            except Exception as e:
                print(f"Error parsing package.json: {e}")

    def analyze(self) -> Dict[str, Any]:
        """Run the complete analysis"""
        print("🔍 Collecting all files...")
        self.collect_all_files()
        
        print("🔍 Analyzing entry points...")
        self.analyze_entry_points()
        
        print("🔍 Checking package.json scripts...")
        self.check_package_json_scripts()
        
        print("🔍 Checking git history...")
        self.check_git_references()
        
        # Find unused files
        unused_files = []
        
        for filepath in self.all_files:
            # Skip if in keep patterns
            if filepath.name in self.keep_patterns:
                continue
                
            # Skip if in used files
            if filepath in self.used_files:
                continue
                
            # Skip if not in source directories
            in_source = False
            for source_dir in self.source_dirs:
                if str(source_dir) in str(filepath.relative_to(self.repo_root)):
                    in_source = True
                    break
                    
            if not in_source and filepath.suffix not in ['.py', '.js', '.ts', '.tsx']:
                continue
                
            # Categorize unused file
            category = self.categorize_file(filepath)
            if category:
                unused_files.append({
                    'path': str(filepath.relative_to(self.repo_root)),
                    'size': filepath.stat().st_size,
                    'category': category,
                    'extension': filepath.suffix
                })
                
        # Sort by category and size
        unused_files.sort(key=lambda x: (x['category'], -x['size']))
        
        # Generate summary
        summary = {
            'total_files': len(self.all_files),
            'used_files': len(self.used_files),
            'unused_files': len(unused_files),
            'by_category': {},
            'total_size': sum(f['size'] for f in unused_files)
        }
        
        for file in unused_files:
            cat = file['category']
            if cat not in summary['by_category']:
                summary['by_category'][cat] = {'count': 0, 'size': 0}
            summary['by_category'][cat]['count'] += 1
            summary['by_category'][cat]['size'] += file['size']
            
        return {
            'summary': summary,
            'unused_files': unused_files
        }

    def categorize_file(self, filepath: Path) -> str:
        """Categorize a file for removal priority"""
        name = filepath.name.lower()
        
        # Test/debug files
        if any(x in name for x in ['test_', '_test', 'debug_', '_debug', 'mock_']):
            return 'test_debug'
            
        # Backup files
        if any(name.endswith(x) for x in ['.bak', '.backup', '.old', '.orig']):
            return 'backup'
            
        # Temporary scripts
        if name.startswith('fix_') or name.startswith('check_'):
            return 'temporary_script'
            
        # Documentation
        if filepath.suffix in ['.md', '.txt'] and name not in ['README.md', 'LICENSE']:
            return 'documentation'
            
        # Data files
        if filepath.suffix in ['.json', '.csv', '.xlsx']:
            return 'data'
            
        # PDFs
        if filepath.suffix == '.pdf':
            return 'pdf'
            
        # Source files
        if filepath.suffix in ['.py', '.js', '.ts', '.tsx']:
            return 'source'
            
        return 'other'

    def generate_report(self, output_path: str = 'docs/unused-files-report.md') -> None:
        """Generate markdown report of unused files"""
        results = self.analyze()
        
        # Create report
        report = f"""# Unused Files Report

Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Summary

- Total files scanned: {results['summary']['total_files']}
- Used files identified: {results['summary']['used_files']}
- Unused files found: {results['summary']['unused_files']}
- Total size of unused files: {results['summary']['total_size'] / 1024 / 1024:.2f} MB

## By Category

| Category | Count | Size (MB) |
|----------|-------|-----------|
"""
        
        for cat, stats in results['summary']['by_category'].items():
            report += f"| {cat} | {stats['count']} | {stats['size'] / 1024 / 1024:.2f} |\n"
            
        report += "\n## Detailed List\n\n"
        
        current_category = None
        for file in results['unused_files']:
            if file['category'] != current_category:
                current_category = file['category']
                report += f"\n### {current_category.replace('_', ' ').title()}\n\n"
                
            size_kb = file['size'] / 1024
            report += f"- `{file['path']}` ({size_kb:.1f} KB)\n"
            
        report += """
## Recommendations

1. **Backup files** - Can be safely removed after verifying originals are intact
2. **Test/Debug files** - Review and remove if no longer needed
3. **Temporary scripts** - Check if functionality has been integrated elsewhere
4. **PDFs** - Move to cloud storage if needed for reference
5. **Data files** - Archive if historical data, remove if test data

## Next Steps

1. Review each file in the list
2. Create a backup of files to be removed
3. Move files to `archive/` directory
4. Run full test suite
5. If tests pass, permanently delete archived files

## Safe Removal Script

```bash
# Create archive directory
mkdir -p archive/cleanup_$(date +%Y%m%d)

# Move files (example for backup category)
# Add actual file paths from the report above
# mv "path/to/file.bak" archive/cleanup_$(date +%Y%m%d)/

# After verifying everything works
# rm -rf archive/cleanup_$(date +%Y%m%d)
```
"""
        
        # Save report
        output_path = Path(output_path)
        output_path.parent.mkdir(exist_ok=True)
        
        with open(output_path, 'w') as f:
            f.write(report)
            
        # Also save JSON for automation
        json_path = output_path.with_suffix('.json')
        with open(json_path, 'w') as f:
            json.dump(results, f, indent=2)
            
        print(f"\n📄 Report saved to: {output_path}")
        print(f"📊 JSON data saved to: {json_path}")
        
        # Print summary
        print(f"\n📊 Summary:")
        print(f"  - Unused files: {results['summary']['unused_files']}")
        print(f"  - Total size: {results['summary']['total_size'] / 1024 / 1024:.2f} MB")
        print(f"  - Largest category: {max(results['summary']['by_category'].items(), key=lambda x: x[1]['size'])[0]}")


def main():
    """Run unused file analysis"""
    finder = UnusedFileFinder()
    finder.generate_report()


if __name__ == "__main__":
    main()
