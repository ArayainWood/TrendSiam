#!/usr/bin/env python3
"""
SECTION H - JSON Legacy Marking Script

This script marks JSON data files as legacy by adding .legacy suffix
while preserving functionality for emergency use.
"""

import os
import shutil
from pathlib import Path

def mark_json_files_as_legacy():
    """Mark JSON data files as legacy."""
    
    # Files to mark as legacy
    legacy_files = [
        'thailand_trending_api.json',
        'thailand_trending_summary.json', 
        'thailand_trending_summary_with_view_details.json',
        'frontend/public/data/thailand_trending_summary.json'
    ]
    
    for file_path in legacy_files:
        if os.path.exists(file_path):
            legacy_path = f"{file_path}.legacy"
            
            # Copy to .legacy version
            shutil.copy2(file_path, legacy_path)
            print(f"✅ Created legacy backup: {legacy_path}")
            
            # Add warning header to original file
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Add JSON comment warning
            warning = '''// WARNING: This JSON file is deprecated as of SECTION H migration.
// The system now uses Supabase-only data flow via summarize_all_v2.py
// This file should only be used for emergency data recovery.
// Use ALLOW_JSON_FALLBACK=true environment variable to enable fallback mode.

'''
            
            with open(file_path, 'w', encoding='utf-8') as f:
                if content.strip().startswith('{') or content.strip().startswith('['):
                    # Valid JSON - prepend warning as comment
                    f.write(warning + content)
                else:
                    f.write(content)
            
            print(f"⚠️  Added deprecation warning to: {file_path}")
        else:
            print(f"⏭️  File not found (skipping): {file_path}")

if __name__ == "__main__":
    print("📋 SECTION H: Marking JSON files as legacy...")
    mark_json_files_as_legacy()
    print("\n✅ JSON legacy marking complete!")
    print("\nNOTE: Files are preserved for emergency use with ALLOW_JSON_FALLBACK=true")
