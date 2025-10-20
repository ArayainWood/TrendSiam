/**
 * Keywords helpers for UI components
 * 
 * Provides canonical functions for extracting and formatting keywords
 */

import type { UINewsItem } from '@/lib/normalizeNewsItem';
import type { UiNewsItem } from '@/lib/db/types/canonical';

/**
 * Centralized stop words list for keyword extraction
 * This is the canonical list for NLP cleanup
 */
export const STOP_WORDS = [
  // English common words
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'what', 'when', 'where', 'why', 'how', 'who', 'which', 'all', 'any', 'some', 'no', 'not', 'only', 'just', 'very', 'so', 'too', 'now', 'then', 'here', 'there', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'once', 'more', 'most', 'other', 'such', 'own', 'same', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now',
  // Thai common words
  'ที่', 'และ', 'ใน', 'ของ', 'เป็น', 'มี', 'ได้', 'จะ', 'ไม่', 'ให้', 'กับ', 'ก็', 'ยง', 'มา', 'ไป', 'ดู', 'ทำ', 'เอา', 'นี้', 'นั้น', 'แล้ว', 'ถ้า', 'เพื่อ', 'หรือ', 'แต่', 'ว่า', 'ซึ่ง', 'อย่าง', 'ตัว', 'คน', 'เรา', 'เขา', 'เธอ', 'มัน', 'พวก', 'ผม', 'ฉัน', 'กัน', 'ด้วย', 'จาก', 'ถึง', 'ตาม', 'เมื่อ', 'ขณะ', 'ระหว่าง', 'ก่อน', 'หลัง', 'แรก', 'สุดท้าย', 'อีก', 'เท่านั้น', 'เพียง', 'แค่', 'ทั้ง', 'ทุก', 'บาง', 'หลาย', 'น้อย', 'มาก', 'เก่า', 'ใหม่', 'ดี', 'เลว', 'ใหญ่', 'เล็ก', 'สูง', 'ต่ำ', 'ยาว', 'สั้น', 'กว้าง', 'แคบ', 'หนา', 'บาง', 'เร็ว', 'ช้า', 'ร้อน', 'เย็น', 'อุ่น', 'หนาว'
] as const;

/**
 * Normalize a keyword to Title Case
 */
function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Clean and normalize a keyword
 */
function cleanKeyword(keyword: string): string | null {
  // Remove punctuation and extra spaces
  const cleaned = keyword.replace(/[^\w\s\u0E00-\u0E7F]/g, '').trim();
  
  // Filter out single letters and stop words
  if (cleaned.length < 2) return null;
  if (STOP_WORDS.includes(cleaned.toLowerCase() as any)) return null;
  
  return toTitleCase(cleaned);
}

/**
 * Extract keywords from text using simple tokenization
 */
function extractFromText(text: string): string[] {
  if (!text) return [];
  
  // Simple tokenization - split on spaces and common delimiters
  const tokens = text.split(/[\s,;.!?()[\]{}"|]+/);
  
  const keywords: string[] = [];
  for (const token of tokens) {
    const cleaned = cleanKeyword(token);
    if (cleaned && !keywords.includes(cleaned)) {
      keywords.push(cleaned);
    }
  }
  
  return keywords;
}

/**
 * Collect display keywords from various sources
 */
export function collectDisplayKeywords(item: UINewsItem | UiNewsItem): { keywords: string[]; source: 'db' | 'platform' | 'derived' | 'fallback' } {
  const maxKeywords = 6;
  
  // 1. Try DB keywords first - handle both keywordsList array and keywords string
  if ('keywordsList' in item && item.keywordsList && item.keywordsList.length > 0) {
    const dbKeywords = item.keywordsList
      .map((k: string) => cleanKeyword(k))
      .filter((k): k is string => k !== null)
      .slice(0, maxKeywords);
    
    if (dbKeywords.length > 0) {
      return { keywords: dbKeywords, source: 'db' };
    }
  } else if (typeof item.keywords === 'string' && item.keywords.length > 0) {
    // Parse keywords string
    const keywordsList = item.keywords.split(',').map(k => k.trim()).filter(k => k);
    const dbKeywords = keywordsList
      .map(k => cleanKeyword(k))
      .filter((k): k is string => k !== null)
      .slice(0, maxKeywords);
    
    if (dbKeywords.length > 0) {
      return { keywords: dbKeywords, source: 'db' };
    }
  }
  
  // 2. Try platform mentions
  const platformMentions = (item as any).platformMentions;
  if (platformMentions && typeof platformMentions === 'string' && platformMentions !== 'Primary platform only') {
    const platformKeywords = platformMentions
      .split(/[,;]+/)
      .map(k => cleanKeyword(k.trim()))
      .filter((k): k is string => k !== null)
      .slice(0, maxKeywords);
    
    if (platformKeywords.length > 0) {
      return { keywords: platformKeywords, source: 'platform' };
    }
  }
  
  // 3. Derive from title + summary
  const titleKeywords = extractFromText(item.title || '');
  const summaryKeywords = extractFromText(item.summary || (item as any).summary_en || (item as any).summaryEn || '');
  
  const derivedKeywords = [...new Set([...titleKeywords, ...summaryKeywords])]
    .slice(0, maxKeywords);
  
  if (derivedKeywords.length > 0) {
    return { keywords: derivedKeywords, source: 'derived' };
  }
  
  // 4. Fallback to category and channel
  const fallbackKeywords = [
    item.category,
    (item as any).channelTitle || (item as any).channel,
    item.platform
  ]
    .filter(Boolean)
    .map(k => cleanKeyword(k!))
    .filter((k): k is string => k !== null)
    .slice(0, maxKeywords);
  
  return { keywords: fallbackKeywords, source: 'fallback' };
}
