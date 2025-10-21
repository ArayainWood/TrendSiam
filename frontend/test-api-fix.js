#!/usr/bin/env node

// Quick API test script for the schema validation fix
const API_BASE = process.env.API_BASE || 'http://localhost:3000';

async function testAPI() {
  console.log('🧪 Testing Latest Stories Feed - Complete Modal Data & YouTube Links...\n');
  
  try {
    // Test 1: Basic API health
    console.log('📡 Test 1: API Response');
    const response = await fetch(`${API_BASE}/api/home`);
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`✅ API responded successfully`);
    console.log(`📊 Data length: ${data.data?.length || 0}`);
    
    // Test 2: Top-3 validation
    const top3Items = data.data?.filter(item => item.isTop3 === true) || [];
    console.log(`🏆 Top-3 count: ${top3Items.length} (should be ≤ 3)`);
    
    // Test 3: Boolean validation
    if (data.data?.length > 0) {
      const firstItem = data.data[0];
      console.log(`🔍 First item validation:`);
      console.log(`  - showImage type: ${typeof firstItem.showImage} (should be boolean)`);
      console.log(`  - showAiPrompt type: ${typeof firstItem.showAiPrompt} (should be boolean)`);
      console.log(`  - isTop3: ${firstItem.isTop3}`);
      console.log(`  - rank: ${firstItem.rank}`);
    }
    
    // Test 4: Image/Prompt policy
    const withImages = data.data?.filter(item => item.showImage === true) || [];
    const withPrompts = data.data?.filter(item => item.showAiPrompt === true) || [];
    console.log(`🖼️ Images shown: ${withImages.length} (should be ≤ 3)`);
    console.log(`📝 Prompts shown: ${withPrompts.length} (should be ≤ 3)`);
    
    // Test 5: Policy compliance
    const nonTop3WithImages = data.data?.filter(item => !item.isTop3 && item.showImage) || [];
    const nonTop3WithPrompts = data.data?.filter(item => !item.isTop3 && item.showAiPrompt) || [];
    
    console.log(`\n🔍 Policy Compliance:`);
    console.log(`  - Non-Top3 with images: ${nonTop3WithImages.length} (should be 0)`);
    console.log(`  - Non-Top3 with prompts: ${nonTop3WithPrompts.length} (should be 0)`);
    
    // Test 6: Ranking integrity
    const ranks = data.data?.map(item => item.rank).filter(r => r !== null) || [];
    const uniqueRanks = [...new Set(ranks)];
    const top3Ranks = data.data?.filter(item => item.isTop3).map(item => item.rank) || [];
    
    console.log(`\n🏆 Ranking Integrity:`);
    console.log(`  - Total ranks: ${ranks.length}`);
    console.log(`  - Unique ranks: ${uniqueRanks.length}`);
    console.log(`  - Top-3 ranks: [${top3Ranks.sort().join(', ')}]`);
    console.log(`  - Ranks unique: ${ranks.length === uniqueRanks.length ? '✅' : '❌'}`);
    
    // Test 7: Modal fields presence
    if (data.data?.length > 0) {
      const firstItem = data.data[0];
      const hasModalFields = !!(firstItem.channel || firstItem.publishedAt || firstItem.platformMentions);
      console.log(`\n📋 Modal Fields:`);
      console.log(`  - Channel: ${firstItem.channel ? '✅' : '❌'}`);
      console.log(`  - Published: ${firstItem.publishedAt ? '✅' : '❌'}`);
      console.log(`  - Platform mentions: ${firstItem.platformMentions !== null ? '✅' : '❌'}`);
      console.log(`  - Video ID: ${firstItem.videoId ? '✅' : '❌'}`);
    }
    
    // Summary (config-driven)
    const homeLimit = 20; // Expected config default
    const top3Max = 3;    // Expected config default
    
    console.log(`\n📋 Config-Driven Summary:`);
    console.log(`  ${(data.data?.length || 0) <= homeLimit ? '✅' : '❌'} Total items: ${data.data?.length || 0}/${homeLimit}`);
    console.log(`  ${top3Items.length <= top3Max ? '✅' : '❌'} Top-3 count: ${top3Items.length}/${top3Max}`);
    console.log(`  ${withImages.length <= top3Max ? '✅' : '❌'} Images: ${withImages.length}/${top3Max}`);
    console.log(`  ${withPrompts.length <= top3Max ? '✅' : '❌'} Prompts: ${withPrompts.length}/${top3Max}`);
    console.log(`  ${ranks.length === uniqueRanks.length ? '✅' : '❌'} Unique ranks`);
    console.log(`  ${nonTop3WithImages.length === 0 && nonTop3WithPrompts.length === 0 ? '✅' : '❌'} Policy compliance`);
    
    // Check complete modal field presence (LISA-level richness)
    const firstItem = data.data?.[0];
    if (firstItem) {
      console.log(`\n🔍 Modal Field Completeness:`);
      console.log(`  ${firstItem.category ? '✅' : '❌'} Category: ${firstItem.category || 'missing'}`);
      console.log(`  ${firstItem.summary ? '✅' : '❌'} Summary: ${firstItem.summary ? 'present' : 'missing'}`);
      console.log(`  ${firstItem.channel ? '✅' : '❌'} Channel: ${firstItem.channel || 'missing'}`);
      console.log(`  ${firstItem.publishedAt ? '✅' : '❌'} PublishedAt: ${firstItem.publishedAt || 'missing'}`);
      console.log(`  ${firstItem.views !== null ? '✅' : '❌'} Views: ${firstItem.views ?? 'missing'}`);
      console.log(`  ${firstItem.likes !== null ? '✅' : '❌'} Likes: ${firstItem.likes ?? 'missing'}`);
      console.log(`  ${firstItem.comments !== null ? '✅' : '❌'} Comments: ${firstItem.comments ?? 'missing'}`);
      console.log(`  ${firstItem.keywords ? '✅' : '❌'} Keywords: ${firstItem.keywords || 'missing'}`);
      console.log(`  ${firstItem.aiOpinion ? '✅' : '❌'} AI Opinion: ${firstItem.aiOpinion || 'missing'}`);
      console.log(`  ${firstItem.scoreDetails ? '✅' : '❌'} Score Details: ${firstItem.scoreDetails || 'missing'}`);
      
      // YouTube link validation (no undefined URLs)
      const hasValidUrl = firstItem.sourceUrl && firstItem.sourceUrl !== 'undefined' && firstItem.sourceUrl.includes('youtube.com');
      console.log(`  ${hasValidUrl ? '✅' : '❌'} Valid YouTube URL: ${firstItem.sourceUrl || 'missing'}`);
    }
    
    const hasResults = data.data?.length > 0;
    
    if (!hasResults) {
      console.error('❌ CRITICAL: API returned 0 items! Check SQL column ambiguity and key matching.');
      console.log('💡 Run these SQL queries to debug:');
      console.log('   SELECT COUNT(*) FROM news_trends WHERE title IS NOT NULL;');
      console.log('   SELECT COUNT(*) FROM public.public_v_home_news;');
      console.log('   -- Check for column ambiguity errors in the view');
      console.log('   -- Ensure all CTEs use explicit column lists (no SELECT *)');
    }
    
    return hasResults;
    
  } catch (error) {
    console.error('❌ API test failed:', error.message);
    return false;
  }
}

// Run the test
testAPI().then(success => {
  process.exit(success ? 0 : 1);
});
