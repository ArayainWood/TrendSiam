/**
 * Check v_home_news view columns
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔍 v_home_news Column Analysis');
console.log('=' .repeat(60));

async function main() {
  const { data, error } = await supabase
    .from('v_home_news')
    .select('*')
    .limit(1)
    .single();
  
  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }
  
  if (!data) {
    console.error('❌ No data returned');
    return;
  }
  
  console.log('\n📋 All 29 Columns:\n');
  const columns = Object.keys(data);
  columns.forEach((col, index) => {
    const value = data[col];
    const type = typeof value;
    const displayValue = type === 'string' && value?.length > 50 
      ? value.substring(0, 50) + '...' 
      : value;
    console.log(`${(index + 1).toString().padStart(2, ' ')}. ${col.padEnd(30, ' ')} ${type.padEnd(10, ' ')} ${displayValue}`);
  });
  
  console.log('\n📊 Critical Field Check:\n');
  
  const criticalFields = [
    'id',
    'title',
    'channel',
    'published_at',
    'published_date',
    'snapshot_date',
    'popularity_score',
    'popularity_score_precise',
    'ai_generated_image',
    'platform_thumbnail',
    'ai_prompt',
    'video_views',
    'likes',
    'comments',
    'growth_rate_value',
    'growth_rate_label',
    'ai_opinion',
    'score_details',
    'keywords',
    'platform_mentions'
  ];
  
  criticalFields.forEach(field => {
    const exists = field in data;
    const value = data[field];
    const status = exists ? (value ? '✅' : '⚠️ ') : '❌';
    console.log(`${status} ${field.padEnd(30, ' ')} ${exists ? (value || 'NULL') : 'MISSING'}`);
  });
}

main();

