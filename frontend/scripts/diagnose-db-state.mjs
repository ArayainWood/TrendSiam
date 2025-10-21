/**
 * Comprehensive DB State Diagnostic
 * 
 * Checks:
 * 1. Which views exist (v_home_news, public_v_home_news, weekly views)
 * 2. Column counts and names for each view
 * 3. Row counts
 * 4. Sample data to verify column types
 * 5. Weekly snapshot data
 * 6. AI images data
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local from frontend directory
dotenv.config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔍 TrendSiam DB State Diagnostic');
console.log('=' .repeat(60));
console.log('');

// Check if a view exists and get column info
async function checkView(viewName) {
  console.log(`\n📋 Checking view: ${viewName}`);
  console.log('-'.repeat(60));
  
  try {
    // Try to count rows
    const { count, error: countError } = await supabase
      .from(viewName)
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.log(`❌ Cannot access: ${countError.message}`);
      return { exists: false, error: countError.message };
    }
    
    console.log(`✅ Accessible, row count: ${count || 0}`);
    
    // Get sample row to see columns
    if (count && count > 0) {
      const { data, error } = await supabase
        .from(viewName)
        .select('*')
        .limit(1)
        .single();
      
      if (!error && data) {
        const columns = Object.keys(data);
        console.log(`   Columns (${columns.length}): ${columns.slice(0, 10).join(', ')}${columns.length > 10 ? '...' : ''}`);
        
        // Check for critical columns
        const criticalCols = [
          'id', 
          'title', 
          'published_at', 
          'published_date',
          'popularity_score', 
          'popularity_score_precise',
          'summary',
          'category',
          'platform'
        ];
        
        const missing = criticalCols.filter(col => !columns.includes(col));
        if (missing.length > 0) {
          console.log(`   ⚠️  Missing critical columns: ${missing.join(', ')}`);
        } else {
          console.log(`   ✅ All critical columns present`);
        }
        
        // Check sample values
        console.log(`   Sample ID: ${data.id}`);
        console.log(`   Sample title: ${data.title?.substring(0, 50)}...`);
        if (data.popularity_score_precise !== undefined) {
          console.log(`   Sample popularity_score_precise: ${data.popularity_score_precise}`);
        }
        if (data.published_date !== undefined) {
          console.log(`   Sample published_date: ${data.published_date}`);
        }
        
        return { exists: true, count, columns, sample: data };
      }
    }
    
    return { exists: true, count: count || 0, columns: [] };
    
  } catch (error) {
    console.log(`❌ Exception: ${error.message}`);
    return { exists: false, error: error.message };
  }
}

// Check weekly snapshots
async function checkWeeklySnapshots() {
  console.log(`\n📊 Checking weekly_report_snapshots table`);
  console.log('-'.repeat(60));
  
  try {
    // Count total
    const { count: totalCount, error: totalError } = await supabase
      .from('weekly_report_snapshots')
      .select('*', { count: 'exact', head: true });
    
    if (totalError) {
      console.log(`❌ Cannot access table: ${totalError.message}`);
      return { exists: false };
    }
    
    console.log(`✅ Total snapshots: ${totalCount || 0}`);
    
    // Count by status
    const { count: publishedCount } = await supabase
      .from('weekly_report_snapshots')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published');
    
    console.log(`   Published snapshots: ${publishedCount || 0}`);
    
    // Get latest
    const { data: latest, error: latestError } = await supabase
      .from('weekly_report_snapshots')
      .select('snapshot_id, status, built_at, created_at, range_start, range_end')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (latest) {
      console.log(`   Latest snapshot:`);
      console.log(`     ID: ${latest.snapshot_id}`);
      console.log(`     Status: ${latest.status}`);
      console.log(`     Created: ${latest.created_at}`);
      console.log(`     Range: ${latest.range_start} to ${latest.range_end}`);
    } else {
      console.log(`   ⚠️  No snapshots found`);
    }
    
    return { 
      exists: true, 
      totalCount: totalCount || 0, 
      publishedCount: publishedCount || 0, 
      latest 
    };
    
  } catch (error) {
    console.log(`❌ Exception: ${error.message}`);
    return { exists: false, error: error.message };
  }
}

// Check AI images
async function checkAIImages() {
  console.log(`\n🖼️  Checking AI images`);
  console.log('-'.repeat(60));
  
  const results = {};
  
  // Check ai_images table
  try {
    const { count, error } = await supabase
      .from('ai_images')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`❌ ai_images table: ${error.message}`);
      results.ai_images = { exists: false, error: error.message };
    } else {
      console.log(`✅ ai_images table: ${count || 0} rows`);
      results.ai_images = { exists: true, count: count || 0 };
    }
  } catch (error) {
    console.log(`❌ ai_images exception: ${error.message}`);
    results.ai_images = { exists: false, error: error.message };
  }
  
  // Check public_v_ai_images_latest view
  try {
    const { count, error } = await supabase
      .from('public_v_ai_images_latest')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`❌ public_v_ai_images_latest view: ${error.message}`);
      results.view = { exists: false, error: error.message };
    } else {
      console.log(`✅ public_v_ai_images_latest view: ${count || 0} rows`);
      
      // Get sample
      if (count && count > 0) {
        const { data } = await supabase
          .from('public_v_ai_images_latest')
          .select('*')
          .limit(1)
          .single();
        
        if (data) {
          console.log(`   Sample columns: ${Object.keys(data).join(', ')}`);
        }
      }
      
      results.view = { exists: true, count: count || 0 };
    }
  } catch (error) {
    console.log(`❌ public_v_ai_images_latest exception: ${error.message}`);
    results.view = { exists: false, error: error.message };
  }
  
  return results;
}

// Main diagnostic
async function main() {
  const results = {
    views: {},
    weekly: null,
    aiImages: null
  };
  
  // Check main views
  results.views.v_home_news = await checkView('v_home_news');
  results.views.public_v_home_news = await checkView('public_v_home_news');
  
  // Check weekly data
  results.weekly = await checkWeeklySnapshots();
  
  // Check AI images
  results.aiImages = await checkAIImages();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📝 DIAGNOSTIC SUMMARY');
  console.log('='.repeat(60));
  
  // Home views status
  const homeViewOk = results.views.v_home_news.exists && 
                     results.views.v_home_news.count > 0 &&
                     results.views.public_v_home_news.exists &&
                     results.views.public_v_home_news.count > 0;
  
  if (homeViewOk) {
    console.log('✅ Home views: OK');
  } else {
    console.log('❌ Home views: ISSUES DETECTED');
    if (!results.views.v_home_news.exists) {
      console.log('   - v_home_news does not exist or not accessible');
    }
    if (results.views.v_home_news.count === 0) {
      console.log('   - v_home_news has 0 rows');
    }
    if (!results.views.public_v_home_news.exists) {
      console.log('   - public_v_home_news does not exist or not accessible');
    }
    if (results.views.public_v_home_news.count === 0) {
      console.log('   - public_v_home_news has 0 rows');
    }
  }
  
  // Weekly snapshots status
  const weeklyOk = results.weekly.exists && 
                   results.weekly.totalCount > 0 &&
                   results.weekly.publishedCount > 0;
  
  if (weeklyOk) {
    console.log('✅ Weekly snapshots: OK');
  } else {
    console.log('❌ Weekly snapshots: ISSUES DETECTED');
    if (!results.weekly.exists) {
      console.log('   - weekly_report_snapshots table not accessible');
    } else if (results.weekly.totalCount === 0) {
      console.log('   - No snapshots exist (need to create seed data)');
    } else if (results.weekly.publishedCount === 0) {
      console.log('   - No published snapshots (all are draft/building)');
    }
  }
  
  // AI images status
  const aiImagesOk = results.aiImages.ai_images?.exists && 
                     results.aiImages.view?.exists;
  
  if (aiImagesOk) {
    if (results.aiImages.ai_images.count > 0) {
      console.log('✅ AI images: OK');
    } else {
      console.log('⚠️  AI images: Tables exist but no images generated yet');
    }
  } else {
    console.log('❌ AI images: ISSUES DETECTED');
    if (!results.aiImages.ai_images?.exists) {
      console.log('   - ai_images table not accessible');
    }
    if (!results.aiImages.view?.exists) {
      console.log('   - public_v_ai_images_latest view not accessible');
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Next steps:');
  if (!homeViewOk) {
    console.log('1. Fix and execute migrations 005 and 006 to restore home views');
  }
  if (!weeklyOk && results.weekly.totalCount === 0) {
    console.log('2. Create seed snapshot data for weekly report');
  }
  if (!aiImagesOk) {
    console.log('3. Fix AI images view/table structure');
  } else if (results.aiImages.ai_images.count === 0) {
    console.log('3. Run AI image generator to populate images (optional)');
  }
  console.log('');
  
  // Exit code
  const hasIssues = !homeViewOk || !weeklyOk || !aiImagesOk;
  process.exit(hasIssues ? 1 : 0);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

