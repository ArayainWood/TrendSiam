/**
 * Home Fields Check API
 * 
 * Returns detailed information about field presence and data quality
 */

import { fetchHomeData } from '@/lib/data/homeDataSecure';
import { normalizeNewsItems } from '@/lib/normalizeNewsItem';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const data = await fetchHomeData();
    
    if (!data.success || !data.items) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to fetch home data',
        details: data.error
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const rawItems = data.items;
    const normalizedItems = normalizeNewsItems(rawItems);

    // Field presence analysis
    const fieldPresence = {
      // Core fields (should be 100%)
      id: normalizedItems.filter(item => item.id).length,
      title: normalizedItems.filter(item => item.title).length,
      summary: normalizedItems.filter(item => item.summary).length,
      summary_en: normalizedItems.filter(item => item.summary_en).length,
      category: normalizedItems.filter(item => item.category).length,
      platform: normalizedItems.filter(item => item.platform).length,
      
      // Date fields
      publishedAt: normalizedItems.filter(item => item.publishedAt).length,
      summaryDate: normalizedItems.filter(item => item.summaryDate).length,
      updatedAt: normalizedItems.filter(item => item.updatedAt).length,
      
      // Media fields
      displayImageUrl: normalizedItems.filter(item => item.displayImageUrl).length,
      isAIImage: normalizedItems.filter(item => item.isAIImage).length,
      aiImagePrompt: normalizedItems.filter(item => item.aiImagePrompt).length,
      
      // Metrics
      popularityScore: normalizedItems.filter(item => item.popularityScore > 0).length,
      popularitySubtext: normalizedItems.filter(item => item.popularitySubtext).length,
      views: normalizedItems.filter(item => item.views && item.views > 0).length,
      likes: normalizedItems.filter(item => item.likes && item.likes > 0).length,
      comments: normalizedItems.filter(item => item.comments && item.comments > 0).length,
      growthRate: normalizedItems.filter(item => item.growthRate !== null).length,
      
      // Content fields
      reason: normalizedItems.filter(item => item.reason).length,
      keywords: normalizedItems.filter(item => item.keywords && item.keywords.length > 0).length,
      aiOpinion: normalizedItems.filter(item => item.aiOpinion).length,
      scoreDetails: normalizedItems.filter(item => item.scoreDetails).length,
      
      // Identifiers
      videoId: normalizedItems.filter(item => item.video_id).length,
      externalId: normalizedItems.filter(item => item.externalId).length,
      channelTitle: normalizedItems.filter(item => item.channelTitle).length,
      
      // Computed fields
      hasRealImage: normalizedItems.filter(item => 
        item.displayImageUrl && item.displayImageUrl !== '/placeholder-image.svg'
      ).length,
      rank: normalizedItems.filter(item => item.rank && item.rank > 0).length
    };

    // Calculate percentages
    const total = normalizedItems.length;
    const fieldPercentages = Object.entries(fieldPresence).reduce((acc, [field, count]) => {
      acc[field] = {
        count,
        percentage: total > 0 ? ((count / total) * 100).toFixed(1) + '%' : '0%'
      };
      return acc;
    }, {} as Record<string, { count: number; percentage: string }>);

    // Data quality insights
    const qualityInsights = {
      englishSummaryCoverage: fieldPercentages.summary_en?.percentage || '0%',
      aiImagePromptCoverage: fieldPercentages.aiImagePrompt?.percentage || '0%',
      growthRateCoverage: fieldPercentages.growthRate?.percentage || '0%',
      popularitySubtextCoverage: fieldPercentages.popularitySubtext?.percentage || '0%',
      realImageCoverage: fieldPercentages.hasRealImage?.percentage || '0%',
      completenessScore: total > 0 ? (
        (fieldPresence.title + fieldPresence.summary + fieldPresence.category + 
         fieldPresence.popularityScore + fieldPresence.displayImageUrl) / (total * 5) * 100
      ).toFixed(1) + '%' : '0%'
    };

    // Sample field values
    const sampleValues = normalizedItems.slice(0, 3).map(item => ({
      title: item.title ? item.title.substring(0, 30) + '...' : null,
      summary_en: item.summary_en ? item.summary_en.substring(0, 40) + '...' : null,
      publishedAt: item.publishedAt,
      aiImagePrompt: item.aiImagePrompt ? item.aiImagePrompt.substring(0, 40) + '...' : null,
      popularitySubtext: item.popularitySubtext,
      growthRate: item.growthRate,
      keywords: item.keywords
    }));

    return new Response(JSON.stringify({
      success: true,
      totalItems: total,
      fieldPresence: fieldPercentages,
      qualityInsights,
      sampleValues,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
    
  } catch (error) {
    console.error('[/api/home/fields] Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}