#!/usr/bin/env npx tsx
/**
 * Test NewsRepo Queries
 * 
 * Debug why the homepage isn't showing all available data
 */

import { fetchNewsByDateRange, fetchRecentNews } from '../src/lib/db/repos/newsRepo';

const colors = {
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
};

// Get today's date in Asia/Bangkok timezone
function getTodayBangkok(): string {
  const now = new Date();
  // Create date in Bangkok timezone
  const bangkokTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
  
  // Convert MM/DD/YYYY to YYYY-MM-DD format
  const [month, day, year] = bangkokTime.split('/');
  return `${year}-${month?.padStart(2, '0')}-${day?.padStart(2, '0')}`;
}

async function main() {
  console.log(colors.cyan('\n=== Testing NewsRepo Queries ===\n'));

  const todayBangkok = getTodayBangkok();
  console.log(colors.cyan(`Today's date (Bangkok): ${todayBangkok}`));

  // Test 1: Today's data
  console.log(colors.cyan('\n1. Fetching today\'s data...'));
  const todayStart = new Date(`${todayBangkok}T00:00:00Z`);
  const todayEnd = new Date(`${todayBangkok}T23:59:59Z`);
  
  const todayResult = await fetchNewsByDateRange(todayStart, todayEnd, 20);
  if (todayResult.error) {
    console.log(colors.red(`  ✗ Error: ${todayResult.error}`));
  } else {
    console.log(colors.green(`  ✓ Found ${todayResult.items.length} items for today`));
    console.log(`  Total in date range: ${todayResult.totalCount}`);
  }

  // Test 2: Last 24 hours
  console.log(colors.cyan('\n2. Fetching last 24 hours...'));
  const now = new Date();
  const hours24Ago = new Date(now.getTime() - (24 * 60 * 60 * 1000));
  
  const last24Result = await fetchNewsByDateRange(hours24Ago, now, 20);
  if (last24Result.error) {
    console.log(colors.red(`  ✗ Error: ${last24Result.error}`));
  } else {
    console.log(colors.green(`  ✓ Found ${last24Result.items.length} items in last 24h`));
    console.log(`  Total in date range: ${last24Result.totalCount}`);
  }

  // Test 3: Last 7 days
  console.log(colors.cyan('\n3. Fetching last 7 days...'));
  const days7Ago = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
  
  const last7Result = await fetchNewsByDateRange(days7Ago, now, 20);
  if (last7Result.error) {
    console.log(colors.red(`  ✗ Error: ${last7Result.error}`));
  } else {
    console.log(colors.green(`  ✓ Found ${last7Result.items.length} items in last 7 days`));
    console.log(`  Total in date range: ${last7Result.totalCount}`);
  }

  // Test 4: fetchRecentNews (should get all recent)
  console.log(colors.cyan('\n4. Fetching recent news (no date filter)...'));
  const recentResult = await fetchRecentNews(20);
  if (recentResult.error) {
    console.log(colors.red(`  ✗ Error: ${recentResult.error}`));
  } else {
    console.log(colors.green(`  ✓ Found ${recentResult.items.length} recent items`));
    console.log(`  Total available: ${recentResult.totalCount}`);
    
    // Show some sample dates
    if (recentResult.items.length > 0) {
      console.log(colors.cyan('\n  Sample published dates:'));
      recentResult.items.slice(0, 5).forEach((item, i) => {
        const pubDate = item.published_date || item.published_at || 'No date';
        console.log(`    ${i + 1}. ${pubDate} - ${item.title?.substring(0, 40)}...`);
      });
    }
  }

  // Analysis
  console.log(colors.cyan('\n=== Analysis ==='));
  console.log(colors.yellow('The homepage uses date range queries:'));
  console.log('1. First tries today\'s data only');
  console.log('2. Falls back to last 24 hours');
  console.log('3. Falls back to last 7 days');
  console.log(colors.cyan('\nThis might miss older data that\'s still relevant!'));
}

if (require.main === module) {
  main().catch(console.error);
}
