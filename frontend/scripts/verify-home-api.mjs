/**
 * Verification script for Home API
 * Tests data structure and field presence
 */

const API_URL = 'http://localhost:3000/api/home';

async function verifyHomeAPI() {
  console.log('🔍 Verifying Home API...\n');
  
  try {
    const response = await fetch(API_URL);
    
    if (!response.ok) {
      console.error('❌ API returned error:', response.status, response.statusText);
      return false;
    }
    
    const data = await response.json();
    
    if (!data.success && !Array.isArray(data.data)) {
      console.error('❌ Invalid API response structure');
      return false;
    }
    
    const items = data.data || [];
    console.log(`✅ API returned ${items.length} items\n`);
    
    if (items.length === 0) {
      console.warn('⚠️  No items returned - pipeline may need to run');
      return true;
    }
    
    // Verify first item structure
    const firstItem = items[0];
    const requiredFields = [
      'id', 'title', 'summary', 'summaryEn',
      'popularityScore', 'rank', 'isTop3',
      'showImage', 'showAiPrompt',
      'growthRateLabel', 'sourceUrl'
    ];
    
    console.log('📋 Checking required fields on first item:');
    let allFieldsPresent = true;
    
    for (const field of requiredFields) {
      const present = field in firstItem;
      const icon = present ? '✅' : '❌';
      console.log(`  ${icon} ${field}: ${present ? typeof firstItem[field] : 'MISSING'}`);
      if (!present) allFieldsPresent = false;
    }
    
    console.log('\n🔢 Score and bar verification:');
    console.log(`  popularityScore: ${firstItem.popularityScore} (type: ${typeof firstItem.popularityScore})`);
    console.log(`  Expected: number between 0-100`);
    console.log(`  Valid: ${typeof firstItem.popularityScore === 'number' && firstItem.popularityScore >= 0 && firstItem.popularityScore <= 100 ? '✅' : '❌'}`);
    
    console.log('\n📝 Summary fields verification:');
    console.log(`  summary (TH): ${firstItem.summary ? firstItem.summary.substring(0, 50) + '...' : 'MISSING'}`);
    console.log(`  summaryEn (EN): ${firstItem.summaryEn ? firstItem.summaryEn.substring(0, 50) + '...' : 'MISSING'}`);
    console.log(`  At least one present: ${(firstItem.summary || firstItem.summaryEn) ? '✅' : '❌'}`);
    
    console.log('\n🎯 Top-3 verification:');
    const top3Items = items.filter(item => item.isTop3);
    console.log(`  Top-3 items: ${top3Items.length}`);
    console.log(`  Items with images: ${items.filter(item => item.showImage).length}`);
    console.log(`  Items with prompts: ${items.filter(item => item.showAiPrompt).length}`);
    
    console.log('\n📊 Metrics presence (for narrative):');
    const sampleItem = items[0];
    console.log(`  views: ${sampleItem.views !== null && sampleItem.views !== undefined ? '✅' : '❌'} (${sampleItem.views})`);
    console.log(`  likes: ${sampleItem.likes !== null && sampleItem.likes !== undefined ? '✅' : '❌'} (${sampleItem.likes})`);
    console.log(`  comments: ${sampleItem.comments !== null && sampleItem.comments !== undefined ? '✅' : '❌'} (${sampleItem.comments})`);
    console.log(`  growthRateLabel: ${sampleItem.growthRateLabel || 'N/A'}`);
    
    return allFieldsPresent;
  } catch (error) {
    console.error('❌ Error fetching API:', error.message);
    return false;
  }
}

// Run verification
const result = await verifyHomeAPI();
process.exit(result ? 0 : 1);
