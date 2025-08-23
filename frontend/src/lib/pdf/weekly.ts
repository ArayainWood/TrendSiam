/**
 * Centralized PDF Generation for Weekly Reports
 * 
 * Uses portable Thai font paths and shared data logic.
 * Works in any environment (Linux containers, Windows, etc.)
 */

import 'server-only';
import path from 'path';
import React from 'react';
import { WeeklyData } from '@/lib/weeklyDataShared';
import { resolveThaiFonts, areThaiFontsAvailable } from './fonts.thai';

/**
 * Fetch weekly data for PDF generation
 * Reuses the same logic as the API route to ensure consistency
 */
async function getWeeklyDataForPDF(): Promise<WeeklyData> {
  // Call our own API to ensure consistent data
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000';
    
  console.log('[pdf/weekly] Fetching data from internal API:', `${baseUrl}/api/weekly`);
  
  const response = await fetch(`${baseUrl}/api/weekly`, {
    method: 'GET',
    headers: {
      'Cache-Control': 'no-store',
      'User-Agent': 'TrendSiam-PDF-Generator/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`Weekly data API returned ${response.status}: ${response.statusText}`);
  }

  const apiData = await response.json();
  
  if (!apiData.success || !apiData.items) {
    throw new Error(apiData.error || 'Invalid API response for PDF');
  }

  console.log(`[pdf/weekly] ✅ Data received: ${apiData.items.length} items from ${apiData.source}`);

  return {
    items: apiData.items,
    metrics: apiData.metrics,
    generatedAt: apiData.generatedAt,
    dataVersion: apiData.dataVersion,
    source: apiData.source === 'supabase' ? 'db' : 'json'
  };
}

/**
 * Generate PDF buffer with Thai font support
 * 
 * For React-PDF (current implementation)
 */
export async function generateWeeklyPDFBuffer(): Promise<Buffer> {
  console.log('[pdf/weekly] Starting PDF generation...');
  
  // Check font availability
  const fontsAvailable = areThaiFontsAvailable();
  console.log('[pdf/weekly] Thai fonts available:', fontsAvailable);
  
  if (fontsAvailable) {
    const fonts = resolveThaiFonts();
    console.log('[pdf/weekly] Using Thai fonts:', {
      regular: fonts.REG.split(path.sep).pop(),
      bold: fonts.BOLD.split(path.sep).pop()
    });
  }
  
  // Get data
  const data = await getWeeklyDataForPDF();
  
  // Generate PDF using React-PDF (existing implementation)
  // Note: This function is currently not used as PDF generation is handled directly in the API route
  // to avoid JSX compilation issues in .ts files
  throw new Error('generateWeeklyPDFBuffer: PDF generation is handled directly in /api/weekly/pdf route');
}

/**
 * Alternative: PDFKit implementation (if needed)
 */
export async function generateWeeklyPDFWithPDFKit(): Promise<Buffer> {
  // Implementation for PDFKit if React-PDF doesn't work
  throw new Error('PDFKit implementation not yet available - use React-PDF version');
}
