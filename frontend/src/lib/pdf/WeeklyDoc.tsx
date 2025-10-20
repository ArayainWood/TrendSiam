/**
 * Weekly PDF Document v7
 * 
 * Clean React-PDF component with multilingual font support
 * Updated to support snapshot-based data with script-aware font loading
 */

import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { formatDisplayDate } from '@/utils/dateFormatting';
import { SnapshotItem, toScoreString } from '@/types/snapshots';
import { sanitizeTitleForPdf, sanitizeMetadataForPdf } from '@/lib/pdf/pdfTextSanitizer.v6.unified';
import { createPDFStyles } from '@/lib/pdf/pdfStyles';
import { getTitleFontFamily, getMetadataFontFamily } from '@/lib/pdf/pdfFontSelector';
import { debugText, logPipelineVersions } from '@/lib/pdf/debugWeeklyPDF';

interface WeeklyDocProps {
  items: SnapshotItem[];
  metrics: any;
  generatedAt: string;
  source: string;
  snapshotId?: string;
  rangeStart?: string;
  rangeEnd?: string;
}

// Get centralized styles (fonts registered separately at route level)
const styles = createPDFStyles();

export default function WeeklyDoc(props: WeeklyDocProps) {
  const { items, source, generatedAt, snapshotId, rangeStart, rangeEnd } = props;
  
  // Log pipeline versions for debugging
  if (typeof window === 'undefined') { // Server-side only
    logPipelineVersions();
  }
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>{sanitizeTitleForPdf('รายงานแนวโน้มสัปดาห์ TrendSiam')}</Text>
        
        {/* Thai glyph test to verify rendering */}
        <Text style={styles.thaiTest}>
          {sanitizeMetadataForPdf('ทดสอบภาษาไทย ✓ TrendSiam Weekly Report')}
        </Text>
        
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.text}>
            {sanitizeMetadataForPdf(`ช่วงเวลา: ${formatDisplayDate(rangeStart, null)} - ${formatDisplayDate(rangeEnd, null)}`)}
          </Text>
          <Text style={styles.text}>
            {sanitizeMetadataForPdf(`ณ วันที่: ${new Date(generatedAt).toLocaleString('th-TH')}`)}
          </Text>
          <Text style={styles.text}>
            {sanitizeMetadataForPdf(`จำนวนรายการ: ${items.length} รายการ | แหล่งข้อมูล: ${source}`)}
          </Text>
          {snapshotId && (
            <Text style={styles.itemMeta}>
              Snapshot ID: {snapshotId.slice(0, 8)}
            </Text>
          )}
        </View>

        <Text style={styles.h2}>{sanitizeTitleForPdf('เนื้อหายอดนิยม')}</Text>
        
        <View>
          {items.slice(0, 20).map((item, idx) => {
            // Dynamic font selection per item with forensic tracking
            const itemId = `item-${idx+1}-${item.video_id || 'unknown'}`;
            const originalTitle = `${item.rank || idx + 1}. ${item.title || 'ไม่มีหัวข้อ'}`;
            const title = sanitizeTitleForPdf(originalTitle, itemId);
            const titleFont = getTitleFontFamily(title); // CRITICAL FIX: Use SANITIZED text for font selection
            const metaText = sanitizeMetadataForPdf(`หมวดหมู่: ${item.category || 'ไม่ระบุ'} | ช่อง: ${item.channel || 'ไม่ระบุ'} | คะแนน: ${toScoreString(item.popularity_score_precise) || toScoreString(item.popularity_score)}`, itemId);
            const metaFont = getMetadataFontFamily(metaText);
            
            // Debug problematic items
            if (typeof window === 'undefined') {
              debugText(itemId, originalTitle, title, titleFont);
            }
            
            return (
              <View key={idx} style={styles.item}>
                {/* Title with dynamic font */}
                <Text style={[styles.itemTitle, { fontFamily: titleFont }]}>
                  {title}
                </Text>
                {/* Metadata with dynamic font */}
                <Text style={[styles.itemMeta, { fontFamily: metaFont }]}>
                  {metaText}
                </Text>
                {item.published_at && (
                  <Text style={styles.itemMeta}>
                    {sanitizeMetadataForPdf(`เผยแพร่: ${formatDisplayDate(item.published_at, item.created_at)}`, itemId)}
                  </Text>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.footer}>
          <Text style={styles.text}>
            {sanitizeMetadataForPdf('รายงานนี้สร้างโดยระบบ TrendSiam อัตโนมัติ')}
          </Text>
          <Text style={styles.itemMeta}>
            {sanitizeMetadataForPdf(`เวลาสร้าง: ${new Date().toLocaleString('th-TH')}`)}
          </Text>
        </View>
      </Page>
    </Document>
  );
}