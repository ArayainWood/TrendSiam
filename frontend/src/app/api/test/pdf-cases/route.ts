/**
 * PDF Test Cases API
 * 
 * Generates test data with problematic text cases for verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { SnapshotItem } from '@/types/snapshots';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Critical test cases from audit findings
const criticalTestCases: Partial<SnapshotItem>[] = [
  {
    id: 'test-04',
    rank: 4,
    title: 'MV หัวใจช้ำรัก | เพลงรักที่ทำให้หัวใจเต้นแรง',
    platform: 'YouTube',
    category: 'เพลง',
    channel: 'Test Music',
    popularity_score: 98.45,
    published_at: new Date().toISOString(),
  },
  {
    id: 'test-06',
    rank: 6,
    title: 'ไหนใครว่าพวกมันจะอยู่ | สารคดีธรรมชาติ',
    platform: 'YouTube',
    category: 'สารคดี',
    channel: 'Nature Thailand',
    popularity_score: 95.23,
    published_at: new Date().toISOString(),
  },
  {
    id: 'test-11',
    rank: 11,
    title: '엔믹스 NMIXX "DICE" M/V | K-Pop New Release',
    platform: 'YouTube',
    category: 'K-Pop',
    channel: 'NMIXX Official',
    popularity_score: 89.67,
    published_at: new Date().toISOString(),
  },
  {
    id: 'test-16',
    rank: 16,
    title: '99คืนในป่า 💖💌♻️ | การผจญภัยครั้งใหม่',
    platform: 'YouTube',
    category: 'ท่องเที่ยว',
    channel: 'Adventure TH',
    popularity_score: 78.34,
    published_at: new Date().toISOString(),
  },
  {
    id: 'test-18',
    rank: 18,
    title: '99 คืนในป่า - ฉบับเต็ม | Full Episode',
    platform: 'YouTube',
    category: 'รายการทีวี',
    channel: 'Thai TV',
    popularity_score: 76.12,
    published_at: new Date().toISOString(),
  },
  {
    id: 'test-19',
    rank: 19,
    title: 'ปฏิบัติการเบิกน่านฟ้า | Mission Sky Opening',
    platform: 'YouTube',
    category: 'ภาพยนตร์',
    channel: 'Movie Thailand',
    popularity_score: 74.89,
    published_at: new Date().toISOString(),
  },
  {
    id: 'test-20',
    rank: 20,
    title: 'Trailer:Memory Wiped! Chen Zheyuan一笑随歌 | Chinese Drama 2025',
    platform: 'YouTube',
    category: 'ซีรีส์',
    channel: 'C-Drama Hub',
    popularity_score: 72.45,
    published_at: new Date().toISOString(),
  },
];

// Additional Thai edge cases
const thaiEdgeCases: Partial<SnapshotItem>[] = [
  {
    id: 'thai-01',
    rank: 21,
    title: 'กิ่งก้อน กิ่ง ก่ิง | ทดสอบการวางตำแหน่งวรรณยุกต์',
    platform: 'Test',
    category: 'ทดสอบ',
    channel: 'Font Test',
    popularity_score: 50,
    published_at: new Date().toISOString(),
  },
  {
    id: 'thai-02',
    rank: 22,
    title: 'กำ กํา | ทดสอบ SARA AM composed vs decomposed',
    platform: 'Test',
    category: 'ทดสอบ',
    channel: 'Font Test',
    popularity_score: 50,
    published_at: new Date().toISOString(),
  },
  {
    id: 'thai-03',
    rank: 23,
    title: 'ญั่น ฏ๊ะ อั้ง เก้า | Complex Thai clusters',
    platform: 'Test',
    category: 'ทดสอบ',
    channel: 'Font Test',
    popularity_score: 50,
    published_at: new Date().toISOString(),
  },
  {
    id: 'thai-04',
    rank: 24,
    title: 'แม่น้ำ ที่ดิน ผู้ใช้ รู้สึก | Common Thai words with marks',
    platform: 'Test',
    category: 'ทดสอบ',
    channel: 'Font Test',
    popularity_score: 50,
    published_at: new Date().toISOString(),
  },
];

// Mixed script stress tests
const mixedScriptCases: Partial<SnapshotItem>[] = [
  {
    id: 'mixed-01',
    rank: 25,
    title: 'Hello สวัสดี 你好 こんにちは 안녕하세요 | All scripts',
    platform: 'Test',
    category: 'ทดสอบ',
    channel: 'Font Test',
    popularity_score: 50,
    published_at: new Date().toISOString(),
  },
  {
    id: 'mixed-02',
    rank: 26,
    title: 'Test=@123 [TH]ไทย{EN}English | Punctuation test',
    platform: 'Test',
    category: 'ทดสอบ',
    channel: 'Font Test',
    popularity_score: 50,
    published_at: new Date().toISOString(),
  },
  {
    id: 'mixed-03',
    rank: 27,
    title: '🇹🇭 Thailand ประเทศไทย 🎉 ฿1,234.56 ($38) | Emoji & symbols',
    platform: 'Test',
    category: 'ทดสอบ',
    channel: 'Font Test',
    popularity_score: 50,
    published_at: new Date().toISOString(),
  },
];

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const set = url.searchParams.get('set') || 'all';
  
  let items: Partial<SnapshotItem>[] = [];
  
  switch (set) {
    case 'critical':
      items = criticalTestCases;
      break;
    case 'thai':
      items = thaiEdgeCases;
      break;
    case 'mixed':
      items = mixedScriptCases;
      break;
    case 'all':
    default:
      items = [...criticalTestCases, ...thaiEdgeCases, ...mixedScriptCases];
      break;
  }
  
  // Return test data in snapshot format
  const testData = {
    success: true,
    items: items as SnapshotItem[],
    metrics: {
      total: items.length,
      platforms: { youtube: items.length },
      categories: { test: items.length },
    },
    builtAt: new Date().toISOString(),
    snapshotId: `test-${set}-${Date.now()}`,
    rangeStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    rangeEnd: new Date().toISOString(),
    source: 'test' as const,
  };
  
  return NextResponse.json(testData, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
