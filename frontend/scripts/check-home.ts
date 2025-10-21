#!/usr/bin/env tsx
/**
 * PHASE 6: Home API Type Safety Checker
 * Validates that /api/home returns properly typed numeric data
 */

async function checkHomeAPI() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  
  try {
    console.log('🔍 PHASE 6: Checking /api/home for type safety...')
    
    const response = await fetch(`${baseUrl}/api/home`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('Response data is not an array')
    }
    
    const items = data.data
    console.log(`📊 Total items: ${items.length}`)
    
    // Check 1: Exactly 3 items have isTop3 === true
    const top3Items = items.filter((item: any) => item.isTop3 === true)
    console.log(`🏆 Top-3 items: ${top3Items.length}`)
    console.assert(top3Items.length <= 3, `Expected ≤3 top3 items, got ${top3Items.length}`)
    
    // Check 2: No non-Top3 has image_url or ai_prompt
    const nonTop3WithImages = items.filter((item: any) => !item.isTop3 && (item.image_url || item.display_image_url))
    const nonTop3WithPrompts = items.filter((item: any) => !item.isTop3 && (item.ai_prompt || item.ai_image_prompt))
    
    console.log(`🖼️ Non-Top3 with images: ${nonTop3WithImages.length}`)
    console.log(`📝 Non-Top3 with prompts: ${nonTop3WithPrompts.length}`)
    
    console.assert(nonTop3WithImages.length === 0, `Non-Top3 items should not have images`)
    console.assert(nonTop3WithPrompts.length === 0, `Non-Top3 items should not have prompts`)
    
    // Check 3: All numerics are number | null (not string)
    let typeErrors = 0
    for (const item of items) {
      if (typeof item.rank === 'string') {
        console.error(`❌ item.rank is string: ${item.rank} (item: ${item.id})`)
        typeErrors++
      }
      if (typeof item.popularity_score === 'string') {
        console.error(`❌ item.popularity_score is string: ${item.popularity_score} (item: ${item.id})`)
        typeErrors++
      }
      if (typeof item.growth_rate_value === 'string') {
        console.error(`❌ item.growth_rate_value is string: ${item.growth_rate_value} (item: ${item.id})`)
        typeErrors++
      }
      if (typeof item.views === 'string' && item.views !== '0') {
        console.error(`❌ item.views is non-zero string: ${item.views} (item: ${item.id})`)
        typeErrors++
      }
    }
    
    console.log(`🔢 Type errors found: ${typeErrors}`)
    console.assert(typeErrors === 0, `Expected 0 type errors, got ${typeErrors}`)
    
    // Check 4: Growth rate labels when data exists
    const withGrowthData = items.filter((item: any) => 
      item.growth_rate_label && item.growth_rate_label !== 'Not enough data'
    )
    console.log(`📈 Items with growth rate data: ${withGrowthData.length}`)
    
    // Summary
    console.log('\n✅ PHASE 6 Type Safety Check Results:')
    console.log(`   Total items: ${items.length}`)
    console.log(`   Top-3 items: ${top3Items.length}`)
    console.log(`   Images shown: ${items.filter((item: any) => item.showImage).length}`)
    console.log(`   Prompts shown: ${items.filter((item: any) => item.showAiPrompt).length}`)
    console.log(`   Growth rates computed: ${withGrowthData.length}`)
    console.log(`   Type errors: ${typeErrors}`)
    
    if (typeErrors === 0 && nonTop3WithImages.length === 0 && nonTop3WithPrompts.length === 0) {
      console.log('\n🎉 All type safety checks passed!')
      return true
    } else {
      console.log('\n❌ Some type safety checks failed!')
      return false
    }
    
  } catch (error) {
    console.error('❌ Error checking home API:', error)
    return false
  }
}

// Run if called directly
if (require.main === module) {
  checkHomeAPI().then(success => {
    process.exit(success ? 0 : 1)
  })
}

export { checkHomeAPI }
