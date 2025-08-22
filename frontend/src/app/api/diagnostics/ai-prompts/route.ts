import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // A. Check primary field: stories.ai_image_prompt
    const { data: storiesData, error: storiesError } = await supabase
      .from('stories')
      .select('story_id, ai_image_prompt')
      .not('ai_image_prompt', 'is', null)
      .limit(10);
    
    // B. Check legacy field: news_trends.ai_image_prompt  
    const { data: newsData, error: newsError } = await supabase
      .from('news_trends')
      .select('id, video_id, ai_image_prompt')
      .not('ai_image_prompt', 'is', null)
      .limit(10);
    
    // C. Check image_files.reason for AI images
    const { data: imageFilesData, error: imageFilesError } = await supabase
      .from('image_files')
      .select('story_id, reason, is_valid, generated_at')
      .eq('is_valid', true)
      .not('reason', 'is', null)
      .order('generated_at', { ascending: false })
      .limit(10);
    
    // D. Check snapshots.reason
    const { data: snapshotsData, error: snapshotsError } = await supabase
      .from('snapshots')
      .select('story_id, reason, snapshot_date')
      .not('reason', 'is', null)
      .order('snapshot_date', { ascending: false })
      .limit(10);
    
    // Count totals for each source
    const { count: storiesCount } = await supabase
      .from('stories')
      .select('*', { count: 'exact', head: true })
      .not('ai_image_prompt', 'is', null);
    
    const { count: newsCount } = await supabase
      .from('news_trends')
      .select('*', { count: 'exact', head: true })
      .not('ai_image_prompt', 'is', null);
    
    const { count: imageFilesCount } = await supabase
      .from('image_files')
      .select('*', { count: 'exact', head: true })
      .eq('is_valid', true)
      .not('reason', 'is', null);
    
    const { count: snapshotsCount } = await supabase
      .from('snapshots')
      .select('*', { count: 'exact', head: true })
      .not('reason', 'is', null);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      sources: {
        stories: {
          count: storiesCount || 0,
          samples: storiesData || [],
          error: storiesError?.message
        },
        news_trends: {
          count: newsCount || 0,
          samples: newsData || [],
          error: newsError?.message
        },
        image_files: {
          count: imageFilesCount || 0,
          samples: imageFilesData || [],
          error: imageFilesError?.message
        },
        snapshots: {
          count: snapshotsCount || 0,
          samples: snapshotsData || [],
          error: snapshotsError?.message
        }
      },
      summary: {
        totalPromptsFound: (storiesCount || 0) + (newsCount || 0) + (imageFilesCount || 0) + (snapshotsCount || 0),
        primarySourceActive: (storiesCount || 0) > 0,
        fallbacksAvailable: (newsCount || 0) + (imageFilesCount || 0) + (snapshotsCount || 0) > 0
      }
    });
    
  } catch (error) {
    console.error('AI prompts diagnostics error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
