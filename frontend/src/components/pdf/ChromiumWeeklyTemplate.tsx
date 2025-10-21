/**
 * Chromium PDF Template for Weekly Report
 * 
 * HTML/React template designed for Chromium print-to-PDF
 * Replaces @react-pdf/renderer with browser-native rendering
 */

import React from 'react';
import { SnapshotItem, toScoreString } from '@/types/snapshots';
import { formatDisplayDate } from '@/utils/dateFormatting';

interface ChromiumWeeklyTemplateProps {
  items: SnapshotItem[];
  metrics: any;
  generatedAt: string;
  source: string;
  snapshotId?: string;
  rangeStart?: string;
  rangeEnd?: string;
}

export default function ChromiumWeeklyTemplate({
  items,
  source,
  generatedAt,
  snapshotId,
  rangeStart,
  rangeEnd,
  metrics
}: ChromiumWeeklyTemplateProps) {
  
  // Simple NFC normalization only - let browser handle the rest
  const sanitize = (text: string): string => {
    return text.normalize('NFC');
  };

  return (
    <html lang="th">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>รายงานแนวโน้มสัปดาห์ TrendSiam</title>
        
        {/* Self-hosted fonts */}
        <style dangerouslySetInnerHTML={{ __html: `
          /* Thai + Latin base font */
          @font-face {
            font-family: 'Noto Sans Thai';
            src: url('/fonts/NotoSansThai/NotoSansThai-Regular.ttf') format('truetype');
            font-weight: 400;
            font-style: normal;
            font-display: block;
          }
          
          @font-face {
            font-family: 'Noto Sans Thai';
            src: url('/fonts/NotoSansThai/NotoSansThai-Bold.ttf') format('truetype');
            font-weight: 700;
            font-style: normal;
            font-display: block;
          }
          
          /* Korean font */
          @font-face {
            font-family: 'Noto Sans KR';
            src: url('/fonts/NotoSansKR/NotoSansKR-Regular.ttf') format('truetype');
            font-weight: 400;
            font-style: normal;
            font-display: swap;
          }
          
          /* CJK font */
          @font-face {
            font-family: 'Noto Sans JP';
            src: url('/fonts/NotoSansJP/NotoSansJP-Regular.ttf') format('truetype');
            font-weight: 400;
            font-style: normal;
            font-display: swap;
          }
          
          /* Symbols font */
          @font-face {
            font-family: 'Noto Sans Symbols';
            src: url('/fonts/NotoSansSymbols/NotoSansSymbols-Regular.ttf') format('truetype');
            font-weight: 400;
            font-style: normal;
            font-display: swap;
          }
          
          /* Emoji font */
          @font-face {
            font-family: 'Noto Emoji';
            src: url('/fonts/NotoEmoji/NotoEmoji-Regular.ttf') format('truetype');
            font-weight: 400;
            font-style: normal;
            font-display: swap;
          }
        ` }} />
        
        {/* Print styles */}
        <style dangerouslySetInnerHTML={{ __html: `
          /* Reset and base styles */
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Noto Sans Thai', 'Noto Sans KR', 'Noto Sans JP', 
                         'Noto Sans Symbols', 'Noto Emoji', sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #000;
            background: #fff;
          }
          
          /* Page setup for A4 */
          @page {
            size: A4;
            margin: 20mm;
          }
          
          /* Container */
          .container {
            max-width: 100%;
            margin: 0 auto;
          }
          
          /* Header styles */
          h1 {
            font-size: 18pt;
            font-weight: 700;
            margin-bottom: 8pt;
            text-align: center;
            line-height: 1.8; /* Extra space for Thai marks */
          }
          
          .subtitle {
            font-size: 10pt;
            color: #666;
            text-align: center;
            margin-bottom: 4pt;
          }
          
          .report-meta {
            font-size: 9pt;
            color: #666;
            margin-bottom: 16pt;
            text-align: center;
          }
          
          /* Item styles */
          .item {
            margin-bottom: 12pt;
            padding: 8pt;
            border-bottom: 1pt solid #eee;
            page-break-inside: avoid;
          }
          
          .item-title {
            font-size: 11pt;
            font-weight: 700;
            line-height: 1.8; /* Critical for Thai diacritics */
            margin-bottom: 4pt;
            padding-top: 3pt; /* Extra clearance */
            padding-bottom: 3pt;
          }
          
          .item-meta {
            font-size: 9pt;
            color: #666;
            line-height: 1.6;
          }
          
          .item-meta span {
            margin-right: 8pt;
          }
          
          /* Footer */
          .footer {
            margin-top: 24pt;
            padding-top: 12pt;
            border-top: 1pt solid #ddd;
            font-size: 9pt;
            color: #666;
            text-align: center;
            line-height: 1.8;
          }
          
          /* Print-specific */
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            
            .page-break {
              page-break-after: always;
            }
          }
          
          /* Font cascade for mixed scripts */
          .mixed-script {
            font-family: 'Noto Sans Thai', 'Noto Sans KR', 'Noto Sans JP',
                         'Noto Sans Symbols', 'Noto Emoji', sans-serif;
          }
        ` }} />
      </head>
      
      <body>
        <div className="container">
          {/* Header */}
          <h1>{sanitize('รายงานแนวโน้มสัปดาห์ TrendSiam')}</h1>
          <p className="subtitle">{sanitize('ทดสอบภาษาไทย TrendSiam Weekly Report')}</p>
          
          {/* Report metadata */}
          <div className="report-meta">
            <div>{sanitize(`ช่วงเวลา: ${formatDisplayDate(rangeStart)} - ${formatDisplayDate(rangeEnd)}`)}</div>
            <div>{sanitize(`ณ วันที่: ${formatDisplayDate(generatedAt)}`)}</div>
            <div>{sanitize(`จำนวนรายการ: ${items.length} รายการ | แหล่งข้อมูล: ${source}`)}</div>
            {snapshotId && <div>{sanitize(`Snapshot ID: ${snapshotId}`)}</div>}
          </div>
          
          {/* Items */}
          <div className="items">
            {items.slice(0, 20).map((item, idx) => {
              const score = toScoreString(item.popularity_score_precise) || toScoreString(item.popularity_score);
              
              return (
                <div key={idx} className="item">
                  <div className="item-title mixed-script">
                    {sanitize(`${item.rank}. ${item.title}`)}
                  </div>
                  <div className="item-meta">
                    <span>{sanitize(`หมวดหมู่: ${item.category || 'ไม่ระบุ'}`)}</span>
                    <span>{sanitize(`ช่อง: ${item.channel || 'ไม่ระบุ'}`)}</span>
                    <span>{sanitize(`คะแนน: ${score}`)}</span>
                    <span>{sanitize(`เผยแพร่: ${formatDisplayDate(item.published_at)}`)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Footer */}
          <div className="footer">
            <p>{sanitize('รายงานนี้สร้างโดยระบบ TrendSiam อัตโนมัติ')}</p>
            <p>{sanitize(`เวลาสร้าง: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`)}</p>
          </div>
        </div>
        
        {/* Font loading verification script */}
        <script dangerouslySetInnerHTML={{ __html: `
          // Wait for fonts to load before allowing print
          if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => {
              console.log('[ChromiumPDF] All fonts loaded');
              // Signal to Playwright that fonts are ready
              window.__FONTS_READY__ = true;
            });
          } else {
            // Fallback for older browsers
            window.__FONTS_READY__ = true;
          }
        ` }} />
      </body>
    </html>
  );
}
