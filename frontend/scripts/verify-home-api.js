#!/usr/bin/env node
/**
 * Home API Verification Script
 * Tests the /api/home endpoint for all required fields and data integrity
 */

const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function checkHomeAPI() {
  console.log('🔍 Checking Home API...\n');
  
  try {
    // Test regular endpoint
    const response = await fetch(`${API_URL}/api/home`);
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ API returned error:', response.status);
      console.error(data);
      process.exit(1);
    }
    
    // Basic checks
    console.log(`✅ API returned ${data.data?.length || 0} items`);
    
    if (!data.data || data.data.length === 0) {
      console.warn('⚠️  No data returned - check if DB has items for today');
      
      // Run diagnostics
      const diagResponse = await fetch(`${API_URL}/api/home/diagnostics`);
      const diag = await diagResponse.json();
      console.log('\n📊 Diagnostics:', JSON.stringify(diag, null, 2));
      return;
    }
    
    // Check first item structure
    const firstItem = data.data[0];
    console.log('\n📝 First item structure:');
    
    // Required camelCase fields
    const requiredFields = [
      'id', 'title', 'summary', 'summaryEn', 'category', 'platform',
      'channel', 'popularityScore', 'rank', 'isTop3', 'imageUrl',
      'aiPrompt', 'showImage', 'showAiPrompt', 'growthRateValue',
      'growthRateLabel', 'views', 'likes', 'comments', 'publishedAt',
      'sourceUrl', 'videoId', 'externalId', 'platformMentions',
      'keywords', 'aiOpinion', 'scoreDetails', 'updatedAt'
    ];
    
    const missingFields = [];
    const nullSourceUrls = [];
    
    requiredFields.forEach(field => {
      if (!(field in firstItem)) {
        missingFields.push(field);
        console.log(`  ❌ ${field}: MISSING`);
      } else {
        const value = firstItem[field];
        const preview = value === null ? 'null' : 
                       typeof value === 'string' ? `"${value.substring(0, 50)}..."` :
                       typeof value === 'object' ? JSON.stringify(value).substring(0, 50) + '...' :
                       value;
        console.log(`  ✅ ${field}: ${preview}`);
      }
    });
    
    // Check all items for sourceUrl
    data.data.forEach((item, index) => {
      if (!item.sourceUrl || item.sourceUrl.trim() === '') {
        nullSourceUrls.push({ index, id: item.id, title: item.title });
      }
    });
    
    // Top-3 validation
    const top3Items = data.data.filter(item => item.isTop3);
    const top3WithImages = top3Items.filter(item => item.showImage && item.imageUrl);
    const top3WithPrompts = top3Items.filter(item => item.showAiPrompt && item.aiPrompt);
    
    console.log('\n🏆 Top-3 Analysis:');
    console.log(`  - Total Top-3: ${top3Items.length}`);
    console.log(`  - With images: ${top3WithImages.length}`);
    console.log(`  - With prompts: ${top3WithPrompts.length}`);
    
    // Non-Top3 policy check
    const nonTop3WithImages = data.data.filter(item => !item.isTop3 && item.showImage);
    const nonTop3WithPrompts = data.data.filter(item => !item.isTop3 && item.showAiPrompt);
    
    if (nonTop3WithImages.length > 0 || nonTop3WithPrompts.length > 0) {
      console.error('\n❌ POLICY VIOLATION:');
      if (nonTop3WithImages.length > 0) {
        console.error(`  - ${nonTop3WithImages.length} non-Top3 items have showImage=true`);
      }
      if (nonTop3WithPrompts.length > 0) {
        console.error(`  - ${nonTop3WithPrompts.length} non-Top3 items have showAiPrompt=true`);
      }
    } else {
      console.log('\n✅ Policy compliance: Images/prompts only for Top-3');
    }
    
    // Summary
    console.log('\n📊 Summary:');
    if (missingFields.length > 0) {
      console.error(`❌ Missing fields: ${missingFields.join(', ')}`);
    } else {
      console.log('✅ All required fields present');
    }
    
    if (nullSourceUrls.length > 0) {
      console.error(`❌ ${nullSourceUrls.length} items missing sourceUrl`);
      console.error('   First 3:', nullSourceUrls.slice(0, 3));
    } else {
      console.log('✅ All items have sourceUrl');
    }
    
    // Run debug endpoint
    console.log('\n🔍 Running debug diagnostics...');
    const debugResponse = await fetch(`${API_URL}/api/home?debug=1`);
    const debugData = await debugResponse.json();
    
    if (debugData.debug) {
      console.log('Debug info:', debugData.debug);
    }
    
    // Check diagnostics endpoint
    console.log('\n📊 Checking diagnostics endpoint...');
    const diagResponse = await fetch(`${API_URL}/api/home/diagnostics`);
    const diag = await diagResponse.json();
    
    if (diag.missingColumns && diag.missingColumns.length > 0) {
      console.error('❌ View missing columns:', diag.missingColumns);
    } else {
      console.log('✅ View has all required columns');
    }
    
    console.log('\n✅ Home API verification complete!');
    
  } catch (error) {
    console.error('❌ Error checking API:', error.message);
    process.exit(1);
  }
}

// Run the check
checkHomeAPI();
