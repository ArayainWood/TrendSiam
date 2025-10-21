// End-to-End Field Verification Script
// Verifies all required fields from database through API to frontend expectations

async function verifyEndToEnd() {
  console.log('🔍 END-TO-END FIELD VERIFICATION\n');
  console.log('='.repeat(70));
  
  const results = {
    database: { passed: 0, failed: 0, details: [] },
    api: { passed: 0, failed: 0, details: [] },
    policy: { passed: 0, failed: 0, details: [] },
    lisaRecord: { passed: 0, failed: 0, details: [] }
  };
  
  function test(section, name, condition, details = '') {
    if (condition) {
      results[section].passed++;
      console.log(`✅ ${name}`);
      if (details) console.log(`   ${details}`);
    } else {
      results[section].failed++;
      console.log(`❌ ${name}`);
      if (details) console.log(`   ${details}`);
    }
    results[section].details.push({ name, passed: condition, details });
  }
  
  try {
    // ============================================
    // SECTION 1: API RESPONSE STRUCTURE
    // ============================================
    console.log('\n📡 SECTION 1: API Response Structure\n');
    
    const response = await fetch('http://localhost:3000/api/home');
    const data = await response.json();
    
    test('api', 'API returns 200', response.status === 200);
    test('api', 'API success flag true', data.success === true);
    test('api', 'Exactly 20 items returned', data.fetchedCount === 20, `Got ${data.fetchedCount}`);
    test('api', 'Top-3 IDs present', data.top3Ids?.length === 3, `Got ${data.top3Ids?.length}`);
    test('api', 'No error message', !data.error);
    test('api', 'Data is array', Array.isArray(data.data));
    
    if (!data.data || data.data.length === 0) {
      throw new Error('No data returned from API');
    }
    
    // ============================================
    // SECTION 2: FIELD COMPLETENESS (ALL 20 ITEMS)
    // ============================================
    console.log('\n📋 SECTION 2: Field Completeness (All 20 Items)\n');
    
    const requiredFields = [
      'id', 'title', 'summary', 'summaryEn', 'category', 'platform', 
      'channel', 'sourceUrl', 'popularityScore', 'rank', 'isTop3',
      'views', 'likes', 'comments', 'growthRateValue', 'growthRateLabel',
      'aiOpinion', 'scoreDetails', 'videoId', 'externalId', 'keywords',
      'publishedAt', 'updatedAt'
    ];
    
    let allItemsComplete = true;
    let fieldsPresent = {};
    requiredFields.forEach(f => fieldsPresent[f] = 0);
    
    data.data.forEach((item, idx) => {
      requiredFields.forEach(field => {
        const value = item[field];
        const isPresent = value !== null && value !== undefined && value !== '';
        if (isPresent) fieldsPresent[field]++;
      });
    });
    
    requiredFields.forEach(field => {
      const count = fieldsPresent[field];
      const percentage = Math.round((count / 20) * 100);
      test('api', `${field} present`, count === 20, `${count}/20 (${percentage}%)`);
    });
    
    // ============================================
    // SECTION 3: TOP-3 POLICY ENFORCEMENT
    // ============================================
    console.log('\n🏆 SECTION 3: Top-3 Policy Enforcement\n');
    
    const top3Items = data.data.filter(item => item.isTop3);
    const nonTop3Items = data.data.filter(item => !item.isTop3);
    
    test('policy', 'Exactly 3 Top-3 items', top3Items.length === 3, `Got ${top3Items.length}`);
    test('policy', 'Top-3 all have images', 
      top3Items.every(item => item.showImage && item.imageUrl),
      `${top3Items.filter(i => i.showImage).length}/3`
    );
    test('policy', 'Top-3 all have AI prompts',
      top3Items.every(item => item.showAiPrompt && item.aiPrompt),
      `${top3Items.filter(i => i.showAiPrompt).length}/3`
    );
    test('policy', 'Non-Top-3 have NO images',
      nonTop3Items.every(item => !item.showImage && !item.imageUrl),
      `${nonTop3Items.filter(i => !i.showImage).length}/${nonTop3Items.length}`
    );
    test('policy', 'Non-Top-3 have NO prompts',
      nonTop3Items.every(item => !item.showAiPrompt),
      `${nonTop3Items.filter(i => !i.showAiPrompt).length}/${nonTop3Items.length}`
    );
    
    // ============================================
    // SECTION 4: LISA - DREAM RECORD VERIFICATION
    // ============================================
    console.log('\n🎵 SECTION 4: LISA - DREAM Record Verification\n');
    
    const lisaRecord = data.data.find(item => 
      item.title && item.title.includes('LISA') && item.title.includes('DREAM')
    );
    
    if (lisaRecord) {
      test('lisaRecord', 'LISA - DREAM found', true, `Rank: ${lisaRecord.rank}`);
      test('lisaRecord', 'Has ID', Boolean(lisaRecord.id));
      test('lisaRecord', 'Has title', Boolean(lisaRecord.title));
      test('lisaRecord', 'Has popularity score', typeof lisaRecord.popularityScore === 'number' && lisaRecord.popularityScore > 0);
      test('lisaRecord', 'Has summary (TH)', Boolean(lisaRecord.summary));
      test('lisaRecord', 'Has summary (EN)', Boolean(lisaRecord.summaryEn));
      test('lisaRecord', 'Has AI opinion', Boolean(lisaRecord.aiOpinion));
      test('lisaRecord', 'Has score details', Boolean(lisaRecord.scoreDetails));
      test('lisaRecord', 'Has views', typeof lisaRecord.views === 'number' && lisaRecord.views > 0);
      test('lisaRecord', 'Has likes', typeof lisaRecord.likes === 'number' && lisaRecord.likes > 0);
      test('lisaRecord', 'Has comments', typeof lisaRecord.comments === 'number');
      test('lisaRecord', 'Has category', Boolean(lisaRecord.category));
      test('lisaRecord', 'Has keywords', Boolean(lisaRecord.keywords));
      test('lisaRecord', 'Has source URL', Boolean(lisaRecord.sourceUrl));
      test('lisaRecord', 'Source URL is YouTube', lisaRecord.sourceUrl?.includes('youtube.com'));
      
      console.log('\n   LISA - DREAM Details:');
      console.log(`   Score: ${lisaRecord.popularityScore}`);
      console.log(`   Rank: ${lisaRecord.rank}`);
      console.log(`   Views: ${lisaRecord.views?.toLocaleString()}`);
      console.log(`   Likes: ${lisaRecord.likes?.toLocaleString()}`);
      console.log(`   Summary (EN): ${lisaRecord.summaryEn?.substring(0, 60)}...`);
      console.log(`   AI Opinion: ${lisaRecord.aiOpinion?.substring(0, 50)}...`);
      console.log(`   Score Details: ${lisaRecord.scoreDetails?.substring(0, 50)}...`);
    } else {
      test('lisaRecord', 'LISA - DREAM found', false, 'Not in top 20');
    }
    
    // ============================================
    // SECTION 5: DATA QUALITY CHECKS
    // ============================================
    console.log('\n🔬 SECTION 5: Data Quality Checks\n');
    
    const sortedByRank = [...data.data].sort((a, b) => a.rank - b.rank);
    const ranksCorrect = sortedByRank.every((item, idx) => item.rank === idx + 1);
    test('policy', 'Ranks are sequential 1-20', ranksCorrect);
    
    const scoresDescending = data.data.every((item, idx, arr) => {
      if (idx === 0) return true;
      return arr[idx - 1].popularityScore >= item.popularityScore;
    });
    test('database', 'Scores in descending order', scoresDescending);
    
    const allHaveSourceUrl = data.data.every(item => 
      item.sourceUrl && item.sourceUrl.length > 0
    );
    test('api', 'All items have source URL', allHaveSourceUrl, 
      `${data.data.filter(i => i.sourceUrl).length}/20`
    );
    
    const allYouTubeUrls = data.data.every(item => 
      item.sourceUrl?.includes('youtube.com/watch?v=')
    );
    test('api', 'All source URLs are YouTube format', allYouTubeUrls);
    
    // ============================================
    // SECTION 6: TYPE VALIDATION
    // ============================================
    console.log('\n🔢 SECTION 6: Type Validation\n');
    
    const firstItem = data.data[0];
    test('api', 'popularityScore is number', typeof firstItem.popularityScore === 'number');
    test('api', 'rank is number', typeof firstItem.rank === 'number');
    test('api', 'isTop3 is boolean', typeof firstItem.isTop3 === 'boolean');
    test('api', 'views is number', typeof firstItem.views === 'number');
    test('api', 'likes is number', typeof firstItem.likes === 'number');
    test('api', 'comments is number', typeof firstItem.comments === 'number');
    test('api', 'growthRateValue is number', typeof firstItem.growthRateValue === 'number');
    test('api', 'scoreDetails is string', typeof firstItem.scoreDetails === 'string');
    test('api', 'aiOpinion is string', typeof firstItem.aiOpinion === 'string');
    test('api', 'summary is string', typeof firstItem.summary === 'string');
    test('api', 'summaryEn is string', typeof firstItem.summaryEn === 'string');
    
    // ============================================
    // SECTION 7: HEALTH ENDPOINT
    // ============================================
    console.log('\n🏥 SECTION 7: Health Endpoint\n');
    
    try {
      const healthResponse = await fetch('http://localhost:3000/api/health/home');
      const healthData = await healthResponse.json();
      
      test('api', 'Health endpoint accessible', healthResponse.status === 200);
      test('api', 'Health status is healthy', healthData.healthy === true);
      test('database', 'View has sufficient rows', healthData.checks?.row_count?.count >= 20);
      test('policy', 'Top-3 policy check passes', healthData.checks?.top3_policy?.success === true);
      test('api', 'Source URLs check passes', healthData.checks?.source_urls?.success === true);
    } catch (error) {
      test('api', 'Health endpoint accessible', false, error.message);
    }
    
    // ============================================
    // FINAL SUMMARY
    // ============================================
    console.log('\n' + '='.repeat(70));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('='.repeat(70));
    
    const sections = ['database', 'api', 'policy', 'lisaRecord'];
    let totalPassed = 0;
    let totalFailed = 0;
    
    sections.forEach(section => {
      const {passed, failed} = results[section];
      totalPassed += passed;
      totalFailed += failed;
      const total = passed + failed;
      const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;
      
      const icon = percentage === 100 ? '✅' : percentage >= 90 ? '⚠️' : '❌';
      console.log(`${icon} ${section.toUpperCase()}: ${passed}/${total} passed (${percentage}%)`);
    });
    
    console.log('='.repeat(70));
    const overallTotal = totalPassed + totalFailed;
    const overallPercentage = Math.round((totalPassed / overallTotal) * 100);
    console.log(`🎯 OVERALL: ${totalPassed}/${overallTotal} tests passed (${overallPercentage}%)`);
    
    if (overallPercentage === 100) {
      console.log('\n🎉 ALL TESTS PASSED! System is fully operational.');
    } else if (overallPercentage >= 95) {
      console.log('\n✅ EXCELLENT! Minor issues detected but core functionality intact.');
    } else if (overallPercentage >= 90) {
      console.log('\n⚠️  GOOD: Some issues need attention.');
    } else {
      console.log('\n❌ ATTENTION REQUIRED: Multiple issues detected.');
    }
    
    return overallPercentage === 100;
    
  } catch (error) {
    console.error('\n💥 VERIFICATION FAILED:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Run verification
verifyEndToEnd()
  .then(success => {
    console.log('\n✨ Verification complete.');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
