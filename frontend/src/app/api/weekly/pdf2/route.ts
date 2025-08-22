/**
 * Alternative PDF Generation API v4 (HTML-to-PDF)
 * 
 * Fallback solution using HTML template + Puppeteer-like approach
 * More reliable than React-PDF for production environments
 */

import 'server-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
// import { API_VERSIONS } from '@/lib/buildInfo'; // Not available
import type { WeeklyApiResponse } from '@/types/weekly';

/**
 * Fetch weekly data from our canonical API
 */
async function fetchWeekly(limit: number = 20): Promise<WeeklyApiResponse> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const url = `${base}/api/weekly?limit=${limit}`;
  
  console.log(`[weekly/pdf2] 🔍 Fetching data from: ${url}`);
  
  const response = await fetch(url, { 
    cache: 'no-store',
    headers: {
      'User-Agent': 'TrendSiam-PDF2-Generator/4.0'
    }
  });

  if (!response.ok) {
    throw new Error(`Weekly API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json() as WeeklyApiResponse;
  
  if (!data.success || !data.items) {
    throw new Error(data.error || 'Invalid API response');
  }

  console.log(`[weekly/pdf2] ✅ Data received: ${data.items.length} items from ${data.source}`);
  return data;
}

/**
 * Generate HTML template for PDF conversion
 */
function generateHTMLTemplate(data: WeeklyApiResponse): string {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  const storiesHTML = data.items.slice(0, 15).map((story, index) => `
    <div class="story-container">
      <div class="story-header">
        <span class="story-rank">#${story.rank || index + 1}</span>
        <h3 class="story-title">${story.title || 'Untitled Story'}</h3>
        <span class="story-score">${(story.popularity_score_precise || story.popularity_score || 0).toFixed(1)}</span>
      </div>
      <div class="story-meta">
        <span class="story-category">${story.category || 'Unknown'}</span>
        <span class="story-date">${formatDate(story.published_at)}</span>
      </div>
      ${story.summary ? `
        <p class="story-summary">
          ${story.summary.length > 200 ? `${story.summary.substring(0, 200)}...` : story.summary}
        </p>
      ` : ''}
    </div>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TrendSiam Weekly Report</title>
    <style>
        @page {
            size: A4;
            margin: 20mm;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #2563eb;
        }
        .title {
            font-size: 28px;
            font-weight: bold;
            color: #1e40af;
            margin-bottom: 10px;
        }
        .subtitle {
            font-size: 14px;
            color: #6b7280;
        }
        .metrics {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            padding: 15px;
            background-color: #f8fafc;
            border-radius: 8px;
            flex-wrap: wrap;
        }
        .metric-box {
            text-align: center;
            flex: 1;
            min-width: 100px;
        }
        .metric-value {
            font-size: 18px;
            font-weight: bold;
            color: #1e40af;
            display: block;
        }
        .metric-label {
            font-size: 10px;
            color: #6b7280;
            margin-top: 2px;
        }
        .story-container {
            margin-bottom: 15px;
            padding: 12px;
            background-color: #fefefe;
            border-left: 3px solid #3b82f6;
            border-radius: 4px;
            page-break-inside: avoid;
        }
        .story-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            flex-wrap: wrap;
        }
        .story-rank {
            font-size: 14px;
            font-weight: bold;
            color: #3b82f6;
            min-width: 30px;
        }
        .story-title {
            font-size: 14px;
            font-weight: bold;
            color: #1f2937;
            flex: 1;
            margin: 0 8px;
            min-width: 200px;
        }
        .story-score {
            font-size: 10px;
            color: #059669;
            background-color: #d1fae5;
            padding: 4px 8px;
            border-radius: 3px;
        }
        .story-meta {
            display: flex;
            justify-content: space-between;
            margin-top: 5px;
            flex-wrap: wrap;
        }
        .story-category {
            font-size: 10px;
            color: #7c3aed;
            background-color: #f3e8ff;
            padding: 2px 6px;
            border-radius: 2px;
        }
        .story-date {
            font-size: 10px;
            color: #6b7280;
        }
        .story-summary {
            font-size: 11px;
            color: #374151;
            margin-top: 8px;
            line-height: 1.4;
        }
        .footer {
            margin-top: 30px;
            padding-top: 10px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 10px;
            color: #9ca3af;
        }
        @media print {
            body { font-size: 12px; }
            .story-container { break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="title">TrendSiam Weekly Report</h1>
        <p class="subtitle">Thailand's Most Popular Content • ${currentDate}</p>
    </div>

    <div class="metrics">
        <div class="metric-box">
            <span class="metric-value">${data.metrics.totalStories}</span>
            <div class="metric-label">Total Stories</div>
        </div>
        <div class="metric-box">
            <span class="metric-value">${data.metrics.avgScore.toFixed(1)}</span>
            <div class="metric-label">Avg Score</div>
        </div>
        <div class="metric-box">
            <span class="metric-value">${data.metrics.imagesCoverage.toFixed(0)}%</span>
            <div class="metric-label">Images</div>
        </div>
        <div class="metric-box">
            <span class="metric-value">${data.metrics.summariesCoverage.toFixed(0)}%</span>
            <div class="metric-label">Summaries</div>
        </div>
    </div>

    ${storiesHTML}

    <div class="footer">
        Generated on ${new Date(data.generatedAt).toLocaleString()} • 
        Source: ${data.source} • 
        pdf-v2 Alternative • 
        TrendSiam Analytics
    </div>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  const t0 = Date.now();
  console.log(`[weekly/pdf2] 📄 pdf-v2 alternative generation request received`);
  
  try {
    // Parse query parameters
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);
    const format = url.searchParams.get('format') || 'pdf'; // 'pdf' or 'html'
    
    console.log(`[weekly/pdf2] 📊 Parameters: limit=${limit}, format=${format}`);
    
    // Fetch data from canonical source
    const data = await fetchWeekly(limit);
    
    console.log(`[weekly/pdf2] 📊 Source: ${data.source}, Origin: ${data.origin || 'unknown'}`);
    
    // Generate HTML template
    console.log('[weekly/pdf2] 🎨 Generating HTML template...');
    const htmlContent = generateHTMLTemplate(data);
    
    const totalTime = Date.now() - t0;
    
    // Return based on format
    if (format === 'html') {
      // Return HTML for debugging/preview
      console.log(`[weekly/pdf2] ✅ HTML generated: ${htmlContent.length} chars in ${totalTime}ms`);
      
      return new Response(htmlContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-store',
          'X-TS-API': 'pdf-v2',
          'X-TS-Source': data.source,
          'X-TS-Processing-Time': String(totalTime),
        }
      });
    } else {
      // For PDF: return instruction for browser printing or external PDF conversion
      const instructionHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>PDF Generation Instructions</title>
    <style>
        body { font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 20px; }
        .instruction { background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .code { background: #f3f4f6; padding: 10px; border-radius: 4px; font-family: monospace; }
        .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; }
    </style>
</head>
<body>
    <h1>🔧 PDF Generation Alternative</h1>
    
    <div class="warning">
        <strong>⚠️ React-PDF Compatibility Issue Detected</strong><br>
        The React-PDF library is not compatible with the current environment. Using HTML-based alternative.
    </div>

    <div class="instruction">
        <h3>📄 Get PDF Report</h3>
        <p>To generate the PDF, visit the HTML version and print to PDF:</p>
        <div class="code">
            <a href="/api/weekly/pdf2?format=html&limit=${limit}" target="_blank">
                /api/weekly/pdf2?format=html&limit=${limit}
            </a>
        </div>
        <p>Then use <strong>Print → Save as PDF</strong> in your browser.</p>
    </div>

    <div class="instruction">
        <h3>🔧 Production Solution</h3>
        <p>For automated PDF generation, install Puppeteer:</p>
        <div class="code">npm install puppeteer</div>
        <p>Then this route can programmatically convert HTML to PDF.</p>
    </div>

    <h3>📊 Report Data</h3>
    <p><strong>Source:</strong> ${data.source} (${data.origin})</p>
    <p><strong>Items:</strong> ${data.items.length}</p>
    <p><strong>Generated:</strong> ${new Date(data.generatedAt).toLocaleString()}</p>
    <p><strong>Processing Time:</strong> ${totalTime}ms</p>
</body>
</html>`;

      console.log(`[weekly/pdf2] ✅ PDF instructions generated in ${totalTime}ms`);

      return new Response(instructionHTML, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-store',
          'X-TS-API': 'pdf-v2',
          'X-TS-Source': data.source,
          'X-TS-Processing-Time': String(totalTime),
        }
      });
    }

  } catch (error: any) {
    const totalTime = Date.now() - t0;
    const errorMessage = error?.message || 'Unknown error';
    
    console.error(`[weekly/pdf2] ❌ Alternative PDF generation failed after ${totalTime}ms:`, errorMessage);

    const errorResponse = {
      error: 'Alternative PDF generation failed',
      details: errorMessage,
      timeElapsed: totalTime,
      suggestion: 'Try /api/weekly/pdf2?format=html for HTML version',
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(errorResponse, { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-TS-API': 'weekly-pdf2-v3',
        'X-TS-Source': 'error'
      }
    });
  }
}
