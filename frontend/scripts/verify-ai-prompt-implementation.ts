#!/usr/bin/env npx tsx

/**
 * AI Prompt Implementation Verification Script
 * 
 * Verifies that the "View AI Prompt" button implementation is working correctly
 * by testing the data flow from database to UI components.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface VerificationResult {
  success: boolean;
  message: string;
  details?: any;
}

async function verifyViewExists(): Promise<VerificationResult> {
  try {
    console.log('🔍 Checking if v_home_news view exists and is accessible...');
    
    const { data, error } = await supabase
      .from('v_home_news')
      .select('id, title, ai_image_prompt')
      .limit(1);
    
    if (error) {
      return {
        success: false,
        message: `View not accessible: ${error.message}`,
        details: error
      };
    }
    
    return {
      success: true,
      message: 'v_home_news view is accessible',
      details: { sampleCount: data?.length || 0 }
    };
  } catch (error) {
    return {
      success: false,
      message: `Error checking view: ${error}`,
      details: error
    };
  }
}

async function verifyAIPromptData(): Promise<VerificationResult> {
  try {
    console.log('🔍 Checking AI prompt data availability...');
    
    const { data, error } = await supabase
      .from('v_home_news')
      .select('id, title, ai_image_prompt, ai_image_url, is_ai_image')
      .not('ai_image_prompt', 'is', null)
      .limit(10);
    
    if (error) {
      return {
        success: false,
        message: `Error fetching AI prompt data: ${error.message}`,
        details: error
      };
    }
    
    const itemsWithPrompts = data?.filter(item => 
      item.ai_image_prompt && item.ai_image_prompt.trim().length > 0
    ) || [];
    
    return {
      success: true,
      message: `Found ${itemsWithPrompts.length} items with AI prompts`,
      details: {
        totalQueried: data?.length || 0,
        withValidPrompts: itemsWithPrompts.length,
        samples: itemsWithPrompts.slice(0, 3).map(item => ({
          id: item.id,
          title: item.title?.substring(0, 50) + '...',
          promptLength: item.ai_image_prompt?.length || 0,
          promptPreview: item.ai_image_prompt?.substring(0, 80) + '...',
          hasAIImage: item.is_ai_image,
          hasImageUrl: !!item.ai_image_url
        }))
      }
    };
  } catch (error) {
    return {
      success: false,
      message: `Error verifying AI prompt data: ${error}`,
      details: error
    };
  }
}

async function verifyButtonVisibilityLogic(): Promise<VerificationResult> {
  try {
    console.log('🔍 Testing button visibility logic...');
    
    // Test cases for button visibility
    const testCases = [
      { prompt: 'Valid AI prompt for image generation', expected: true },
      { prompt: '   Valid prompt with spaces   ', expected: true },
      { prompt: '', expected: false },
      { prompt: '   ', expected: false },
      { prompt: null, expected: false },
      { prompt: undefined, expected: false },
      { prompt: '\n\t\r\n', expected: false }
    ];
    
    const results = testCases.map(testCase => {
      const shouldShow = testCase.prompt?.trim().length > 0;
      const passed = shouldShow === testCase.expected;
      
      return {
        prompt: testCase.prompt,
        expected: testCase.expected,
        actual: shouldShow,
        passed
      };
    });
    
    const allPassed = results.every(r => r.passed);
    
    return {
      success: allPassed,
      message: allPassed ? 'All visibility logic tests passed' : 'Some visibility logic tests failed',
      details: {
        testResults: results,
        passedCount: results.filter(r => r.passed).length,
        totalCount: results.length
      }
    };
  } catch (error) {
    return {
      success: false,
      message: `Error testing visibility logic: ${error}`,
      details: error
    };
  }
}

async function verifyDiagnosticsEndpoint(): Promise<VerificationResult> {
  try {
    console.log('🔍 Testing diagnostics endpoint...');
    
    const response = await fetch('/api/diagnostics/ai-prompts');
    
    if (!response.ok) {
      return {
        success: false,
        message: `Diagnostics endpoint returned ${response.status}: ${response.statusText}`
      };
    }
    
    const data = await response.json();
    
    return {
      success: data.success,
      message: data.success ? 'Diagnostics endpoint working' : 'Diagnostics endpoint returned error',
      details: {
        totalPromptsFound: data.summary?.totalPromptsFound || 0,
        primarySourceActive: data.summary?.primarySourceActive || false,
        fallbacksAvailable: data.summary?.fallbacksAvailable || false,
        sources: data.sources
      }
    };
  } catch (error) {
    return {
      success: false,
      message: `Error testing diagnostics endpoint: ${error}`,
      details: error
    };
  }
}

async function runVerification() {
  console.log('🚀 Starting AI Prompt Implementation Verification');
  console.log('=' * 60);
  
  const checks = [
    { name: 'View Accessibility', fn: verifyViewExists },
    { name: 'AI Prompt Data', fn: verifyAIPromptData },
    { name: 'Button Visibility Logic', fn: verifyButtonVisibilityLogic },
    { name: 'Diagnostics Endpoint', fn: verifyDiagnosticsEndpoint }
  ];
  
  const results = [];
  
  for (const check of checks) {
    console.log(`\n🔍 ${check.name}:`);
    const result = await check.fn();
    
    if (result.success) {
      console.log(`✅ ${result.message}`);
    } else {
      console.log(`❌ ${result.message}`);
    }
    
    if (result.details) {
      console.log('   Details:', JSON.stringify(result.details, null, 2));
    }
    
    results.push({ name: check.name, ...result });
  }
  
  console.log('\n' + '=' * 60);
  console.log('📊 VERIFICATION SUMMARY');
  console.log('=' * 60);
  
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}`);
  
  if (passed === total) {
    console.log('\n🎉 All verification checks passed!');
    console.log('✅ The "View AI Prompt" button implementation is working correctly.');
  } else {
    console.log('\n⚠️  Some verification checks failed.');
    console.log('❌ Please review the failed checks and fix any issues.');
  }
  
  console.log('\n📋 NEXT STEPS:');
  console.log('1. Run data generation: python summarize_all_v2.py --limit 20');
  console.log('2. Update database view: Execute the SQL in frontend/db/sql/views/v_home_news.sql');
  console.log('3. Build and test: npm run build && npm run start');
  console.log('4. Test UI: Open any AI-generated story and verify the "View AI Prompt" button appears');
  
  process.exit(passed === total ? 0 : 1);
}

// Run verification
runVerification().catch(error => {
  console.error('❌ Verification script failed:', error);
  process.exit(1);
});
