/**
 * Home Diagnostics API
 * 
 * Returns diagnostic information about data normalization and field availability
 */

import { fetchHomeData } from '@/lib/data/homeDataSecure';
import { normalizeNewsItems } from '@/lib/normalizeNewsItem';
import { calculateAIImagesCount, getGrowthRateLabel } from '@/lib/constants/businessRules';
import { formatGrowthRate } from '@/lib/helpers/growthHelpers';
import { collectDisplayKeywords } from '@/lib/helpers/keywords';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const data = await fetchHomeData(50, true); // Get more items for better diagnostics
    
    if (!data.success) {
      return new Response(JSON.stringify({
        success: false,
        fetchedCount: 0,
        afterNormalizeCount: 0,
        error: data.error || 'Failed to fetch data'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const rawItems = data.items || [];
    const normalizedItems = normalizeNewsItems(rawItems);

    // Get top 3 for special analysis
    const top3 = normalizedItems.slice(0, 3);

    // Count various data quality metrics
    const columnHealth = {
      // Core fields (should be 100%)
      hasTitle: normalizedItems.filter(item => item.title).length,
      hasSummary: normalizedItems.filter(item => item.summary).length,
      hasSummaryEn: normalizedItems.filter(item => item.summary_en).length,
      hasSummaryEnPercentage: normalizedItems.length > 0 
        ? ((normalizedItems.filter(item => item.summary_en).length / normalizedItems.length) * 100).toFixed(1) + '%'
        : '0%',
      hasCategory: normalizedItems.filter(item => item.category).length,
      
      // Images
      hasRealImage: normalizedItems.filter(item => item.displayImageUrl && item.displayImageUrl !== '/placeholder-image.svg').length,
      hasAIImage: normalizedItems.filter(item => item.isAIImage).length,
      hasAIImagePrompt: normalizedItems.filter(item => item.aiImagePrompt).length,
      hasPlaceholder: normalizedItems.filter(item => !item.displayImageUrl || item.displayImageUrl === '/placeholder-image.svg').length,
      
      // Metrics
      hasViews: normalizedItems.filter(item => item.views && item.views > 0).length,
      hasLikes: normalizedItems.filter(item => item.likes && item.likes > 0).length,
      hasComments: normalizedItems.filter(item => item.comments && item.comments > 0).length,
      hasGrowthRate: normalizedItems.filter(item => item.growthRate !== null && item.growthRate !== undefined).length,
      
      // Analysis fields
      hasKeywords: normalizedItems.filter(item => item.keywords && item.keywords.length > 0).length,
      hasReason: normalizedItems.filter(item => item.reason && item.reason !== 'N/A').length,
      hasAiOpinion: normalizedItems.filter(item => item.aiOpinion && item.aiOpinion !== 'N/A').length,
      hasScoreDetails: normalizedItems.filter(item => item.scoreDetails).length,
      
      // UI fields
      hasPopularitySubtext: normalizedItems.filter(item => item.popularitySubtext).length,
      hasRank: normalizedItems.filter(item => item.rank && item.rank > 0).length
    };

    // AI Images analysis (Top 3 rule)
    const aiImagesCount = calculateAIImagesCount(normalizedItems);
    const top3WithAI = top3.filter(item => item.isAIImage).length;
    const totalWithAI = normalizedItems.filter(item => item.isAIImage).length;

    // Sample items for inspection
    const sample = normalizedItems.slice(0, 5).map(item => {
      const growthData = formatGrowthRate(item.growthRate);
      const keywordsData = collectDisplayKeywords(item);
      
      return {
        id: item.id,
        rank: item.rank,
        title: item.title.substring(0, 50) + '...',
        popularityScore: item.popularityScore || 0,
        popularitySubtext: item.popularitySubtext || 'No subtext',
        popularitySubtextPreview: item.popularitySubtext ? item.popularitySubtext.substring(0, 50) + '...' : null,
        growthRate: item.growthRate,
        growthRaw: item.growthRate,
        growthText: growthData.text,
        growthTier: growthData.tier,
        growthDebug: growthData.debug,
        growthRateLabel: getGrowthRateLabel(item.growthRate),
        hasImage: item.displayImageUrl && item.displayImageUrl !== '/placeholder-image.svg',
        isAIImage: item.isAIImage,
        hasAIImagePrompt: !!item.aiImagePrompt?.trim(),
        aiImagePromptLength: item.aiImagePrompt?.trim() ? item.aiImagePrompt.trim().length : 0,
        aiImagePromptSource: item.aiImagePrompt?.trim() ? 'aiImagePrompt field (fallback chain)' : 'none',
        aiImagePromptPreview: item.aiImagePrompt?.trim() ? item.aiImagePrompt.trim().substring(0, 80) + '...' : null,
        summaryEn: item.summary_en ? item.summary_en.substring(0, 50) + '...' : null,
        keywords: item.keywords,
        keywordsCount: item.keywords.length,
        keywordsSource: keywordsData.source,
        keywordsFinal: keywordsData.keywords,
        keywordsFinalCount: keywordsData.keywords.length,
        platforms: item.platforms,
        platformsCount: item.platforms.length,
        platformsSource: item.platforms.length > 0 ? 'platforms field (fallback chain)' : 'none',
        platformsFinal: item.platforms,
        platformsFinalCount: item.platforms.length
      };
    });

    return new Response(JSON.stringify({
      success: true,
      fetchedCount: rawItems.length,
      afterNormalizeCount: normalizedItems.length,
      aiImagesCountComputed: aiImagesCount,
      topNUsed: 3,
      aiImagesAnalysis: {
        calculatedTop3Count: aiImagesCount,
        actualTop3WithAI: top3WithAI,
        totalWithAI,
        top3Details: top3.map(item => ({
          rank: item.rank,
          hasAIImage: item.isAIImage,
          title: item.title.substring(0, 30) + '...'
        }))
      },
      aiPromptAnalysis: {
        totalItemsWithPrompts: normalizedItems.filter(item => !!item.aiImagePrompt?.trim()).length,
        totalItems: normalizedItems.length,
        promptCoverage: `${((normalizedItems.filter(item => !!item.aiImagePrompt?.trim()).length / normalizedItems.length) * 100).toFixed(1)}%`,
        top3WithPrompts: top3.filter(item => !!item.aiImagePrompt?.trim()).length,
        promptSources: [
          'Primary: stories.ai_image_prompt',
          'Fallback 1: news_trends.ai_image_prompt', 
          'Fallback 2: image_files.reason (latest valid)',
          'Fallback 3: snapshots.reason (latest)'
        ],
        fallbackChainImplemented: true,
        viewUsed: 'v_home_news with COALESCE fallback chain'
      },
      growthComputationStatus: {
        source: 'Python script (views/day calculation)',
        hasGrowthData: columnHealth.hasGrowthRate,
        sampleGrowthRates: normalizedItems.slice(0, 3).map(item => ({
          title: item.title.substring(0, 30) + '...',
          growthRate: item.growthRate,
          label: getGrowthRateLabel(item.growthRate)
        }))
      },
      columnHealth,
      sample,
      diagnostics: data.diagnostics
    }, null, 2), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });

  } catch (error) {
    console.error('[Home Diagnostics API] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      fetchedCount: 0,
      afterNormalizeCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}