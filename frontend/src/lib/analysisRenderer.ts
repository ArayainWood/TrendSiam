/**
 * Safe Analysis Content Renderer
 * 
 * Handles safe rendering of analysis content with sanitization
 */

import { ReactNode } from 'react';

export type AnalysisBlock = {
  text?: string;          // plain text or markdown
  html?: string;          // optional pre-rendered safe HTML
  bullets?: string[];     // optional bullet points
};

/**
 * Sanitize and render analysis text safely
 */
export function renderSafeAnalysis(analysis: AnalysisBlock | string | null | undefined): {
  content: string;
  type: 'text' | 'bullets' | 'empty';
} {
  if (!analysis) {
    return { content: '', type: 'empty' };
  }

  // Handle string input
  if (typeof analysis === 'string') {
    const sanitized = sanitizeText(analysis);
    return { content: sanitized, type: 'text' };
  }

  // Handle object input
  if (analysis.bullets && analysis.bullets.length > 0) {
    const sanitizedBullets = analysis.bullets
      .map(bullet => sanitizeText(bullet))
      .filter(bullet => bullet.length > 0);
    
    if (sanitizedBullets.length > 0) {
      return { content: sanitizedBullets.join('\n'), type: 'bullets' };
    }
  }

  if (analysis.text) {
    const sanitized = sanitizeText(analysis.text);
    return { content: sanitized, type: 'text' };
  }

  if (analysis.html) {
    // For now, treat HTML as text and strip tags for safety
    // In a full implementation, you'd use a proper HTML sanitizer
    const sanitized = sanitizeText(analysis.html.replace(/<[^>]*>/g, ''));
    return { content: sanitized, type: 'text' };
  }

  return { content: '', type: 'empty' };
}

/**
 * Basic text sanitization
 */
function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .slice(0, 2000); // Limit length for safety
}

/**
 * Check if analysis content exists and is meaningful
 */
export function hasAnalysisContent(analysis: AnalysisBlock | string | null | undefined): boolean {
  const rendered = renderSafeAnalysis(analysis);
  return rendered.type !== 'empty' && rendered.content.length > 10; // Minimum meaningful content
}

/**
 * Get analysis content for display with fallback
 */
export function getAnalysisDisplayContent(analysis: AnalysisBlock | string | null | undefined): string {
  const rendered = renderSafeAnalysis(analysis);
  
  if (rendered.type === 'empty' || rendered.content.length < 10) {
    return '';
  }
  
  return rendered.content;
}
