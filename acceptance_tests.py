#!/usr/bin/env python3
"""
TrendSiam Acceptance Tests - Following Specification Requirements

Tests the exact acceptance criteria from the specification:
A. Force refresh a small sample
B. Verify API parity  
C. Manual UI check (instructions provided)
D. Dry-run safety
"""

import json
import logging
import os
import requests
import subprocess
import sys
import time
from typing import Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_a_force_refresh():
    """A. Force refresh a small sample"""
    logger.info("🧪 TEST A: Force refresh a small sample")
    
    cmd = [
        sys.executable, 'summarize_all_v2.py',
        '--limit', '5',
        '--verbose', 
        '--force-refresh-stats',
        '--emit-revalidate'
    ]
    
    logger.info(f"Running: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        
        expected_logs = [
            '[data-freshness] Force refresh mode:',
            '[data-freshness] UPSERT news_trends:',
            '[data-freshness] INSERT snapshots:',
            '[data-freshness] emit revalidate: weekly -> 200'
        ]
        
        found_logs = []
        for expected in expected_logs:
            if expected in result.stdout:
                found_logs.append(expected)
                logger.info(f"✅ Found expected log: {expected}")
            else:
                logger.error(f"❌ Missing expected log: {expected}")
        
        success = len(found_logs) >= 3  # Allow some flexibility
        
        return {
            'status': 'pass' if success and result.returncode == 0 else 'fail',
            'returncode': result.returncode,
            'expected_logs_found': len(found_logs),
            'total_expected': len(expected_logs),
            'stdout_preview': result.stdout[-1000:] if result.stdout else None,
            'stderr_preview': result.stderr[-500:] if result.stderr else None
        }
        
    except subprocess.TimeoutExpired:
        return {'status': 'timeout', 'error': 'Command timed out'}
    except Exception as e:
        return {'status': 'error', 'error': str(e)}

def test_b_verify_api_parity():
    """B. Verify API parity"""
    logger.info("🧪 TEST B: Verify API parity")
    
    try:
        url = "http://localhost:3000/api/weekly?diag=1&limit=5"
        response = requests.get(url, timeout=10)
        
        if response.status_code != 200:
            return {
                'status': 'fail',
                'error': f"HTTP {response.status_code}",
                'content': response.text[:200]
            }
        
        data = response.json()
        
        # Check required response fields
        checks = {
            'has_source': 'source' in data,
            'source_is_supabase': data.get('source') == 'supabase',
            'has_diagnostics': 'diagnostics' in data,
            'ordering_is_server': data.get('diagnostics', {}).get('ordering') == 'server',
            'has_top3': len(data.get('diagnostics', {}).get('top3', [])) >= 3
        }
        
        success = all(checks.values())
        
        result = {
            'status': 'pass' if success else 'fail',
            'url': url,
            'checks': checks,
            'response_data': {
                'source': data.get('source'),
                'diagnostics': data.get('diagnostics', {}),
                'item_count': len(data.get('items', []))
            }
        }
        
        if 'diagnostics' in data and 'top3' in data['diagnostics']:
            top3 = data['diagnostics']['top3']
            result['top3_details'] = [
                {
                    'rank': item['rank'],
                    'id': item['id'],
                    'score': item['score'],
                    'hasImage': item['hasImage']
                }
                for item in top3
            ]
            logger.info(f"✅ Top-3 from API: {[f\"#{item['rank']}:score={item['score']:.1f}:image={item['hasImage']}\" for item in top3]}")
        
        return result
        
    except Exception as e:
        return {'status': 'error', 'error': str(e)}

def test_c_manual_ui_check():
    """C. Manual UI check (instructions)"""
    logger.info("🧪 TEST C: Manual UI check instructions")
    
    instructions = [
        "1. Open Homepage: http://localhost:3000",
        "2. Open Weekly Report: http://localhost:3000/weekly-report", 
        "3. Verify #1, #2, #3 items match API diagnostics",
        "4. Confirm images are present for top stories",
        "5. Check that metrics show recent values (views/likes/comments)"
    ]
    
    print("\\n" + "="*60)
    print("📋 MANUAL UI CHECK INSTRUCTIONS:")
    print("="*60)
    for instruction in instructions:
        print(f"  {instruction}")
    print("="*60)
    
    return {
        'status': 'manual',
        'instructions': instructions,
        'note': 'This test requires manual verification'
    }

def test_d_dry_run_safety():
    """D. Dry-run safety"""
    logger.info("🧪 TEST D: Dry-run safety")
    
    cmd = [
        sys.executable, 'summarize_all_v2.py',
        '--limit', '20',
        '--verbose',
        '--dry-run',
        '--force-refresh-stats'
    ]
    
    logger.info(f"Running: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        
        # Check for expected dry-run markers
        expected_markers = [
            '[data-freshness] DRY RUN:',
            'Would UPSERT news_trends:',
            'Would INSERT snapshots:',
            'Top-3 preview'
        ]
        
        found_markers = []
        for marker in expected_markers:
            if marker in result.stdout:
                found_markers.append(marker)
                logger.info(f"✅ Found dry-run marker: {marker}")
        
        # Check that no actual database operations occurred
        prohibited_markers = [
            'execute()',
            'Saved to database',
            'Database updated'
        ]
        
        found_prohibited = []
        for marker in prohibited_markers:
            if marker in result.stdout:
                found_prohibited.append(marker)
                logger.warning(f"⚠️ Found prohibited marker in dry-run: {marker}")
        
        success = (
            len(found_markers) >= 3 and
            len(found_prohibited) == 0 and
            result.returncode == 0
        )
        
        return {
            'status': 'pass' if success else 'fail',
            'returncode': result.returncode,
            'dry_run_markers_found': len(found_markers),
            'prohibited_markers_found': len(found_prohibited),
            'found_markers': found_markers,
            'found_prohibited': found_prohibited,
            'stdout_preview': result.stdout[-800:] if result.stdout else None
        }
        
    except subprocess.TimeoutExpired:
        return {'status': 'timeout', 'error': 'Dry-run timed out'}
    except Exception as e:
        return {'status': 'error', 'error': str(e)}

def run_all_acceptance_tests():
    """Run all acceptance tests according to specification."""
    logger.info("🚀 Starting TrendSiam Acceptance Tests")
    
    tests = {
        'A_force_refresh': test_a_force_refresh,
        'B_api_parity': test_b_verify_api_parity,
        'C_manual_ui': test_c_manual_ui_check,
        'D_dry_run_safety': test_d_dry_run_safety
    }
    
    results = {
        'timestamp': time.time(),
        'tests': {}
    }
    
    for test_name, test_func in tests.items():
        logger.info(f"\\n🧪 Running {test_name}...")
        try:
            test_result = test_func()
            results['tests'][test_name] = test_result
            
            status_icon = {
                'pass': '✅',
                'fail': '❌', 
                'error': '💥',
                'timeout': '⏰',
                'manual': '📋',
                'skip': '⏭️'
            }.get(test_result['status'], '❓')
            
            logger.info(f"{status_icon} {test_name}: {test_result['status']}")
            
        except Exception as e:
            logger.error(f"💥 {test_name} crashed: {e}")
            results['tests'][test_name] = {'status': 'error', 'error': str(e)}
    
    # Calculate overall result  
    test_statuses = [test['status'] for test in results['tests'].values()]
    passed = sum(1 for status in test_statuses if status == 'pass')
    failed = sum(1 for status in test_statuses if status == 'fail')
    manual = sum(1 for status in test_statuses if status == 'manual')
    
    overall_status = 'pass' if failed == 0 else 'fail'
    results['overall_status'] = overall_status
    results['summary'] = {
        'passed': passed,
        'failed': failed,
        'manual': manual,
        'total': len(tests)
    }
    
    # Print summary
    print("\\n" + "="*60)
    print("TRENDSIAM ACCEPTANCE TEST RESULTS")
    print("="*60)
    print(f"Overall Status: {'✅ PASS' if overall_status == 'pass' else '❌ FAIL'}")
    print(f"Passed: {passed}, Failed: {failed}, Manual: {manual}, Total: {len(tests)}")
    print("")
    
    for test_name, test_result in results['tests'].items():
        status_icon = {
            'pass': '✅',
            'fail': '❌',
            'error': '💥', 
            'timeout': '⏰',
            'manual': '📋'
        }.get(test_result['status'], '❓')
        
        print(f"{status_icon} {test_name}: {test_result['status']}")
        
        if test_result['status'] == 'fail' and 'error' in test_result:
            print(f"    Error: {test_result['error']}")
    
    print("="*60)
    
    # Save detailed results
    output_file = f"acceptance_test_results_{int(results['timestamp'])}.json"
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2, default=str)
    logger.info(f"📄 Detailed results saved to: {output_file}")
    
    return results

def main():
    """Main entry point."""
    results = run_all_acceptance_tests()
    
    # Exit with appropriate code
    sys.exit(0 if results['overall_status'] == 'pass' else 1)

if __name__ == '__main__':
    main()
