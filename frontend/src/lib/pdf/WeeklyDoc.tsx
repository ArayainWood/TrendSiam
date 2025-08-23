/**
 * Weekly PDF Document v6
 * 
 * Clean React-PDF component with proper Thai font support
 * Updated to support snapshot-based data
 */

import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { formatDisplayDate } from '@/utils/dateFormatting';
import { SnapshotItem, toScoreString } from '@/types/snapshots';
import { registerPDFFonts } from '@/lib/pdf/pdfFonts';
import { processTitleForPDF, processMetadataForPDF } from '@/lib/pdf/pdfTypoV2';
import { createPDFStyles } from '@/lib/pdf/pdfStyles';

interface WeeklyDocProps {
  items: SnapshotItem[];
  metrics: any;
  generatedAt: string;
  source: string;
  snapshotId?: string;
  rangeStart?: string;
  rangeEnd?: string;
}

// Register fonts and get centralized styles
registerPDFFonts();
const styles = createPDFStyles();

export default function WeeklyDoc(props: WeeklyDocProps) {
  const { items, source, generatedAt, snapshotId, rangeStart, rangeEnd } = props;
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>{processTitleForPDF('รายงานแนวโน้มสัปดาห์ TrendSiam')}</Text>
        
        {/* Thai glyph test to verify rendering */}
        <Text style={styles.thaiTest}>
          {processMetadataForPDF('ทดสอบภาษาไทย ✓ TrendSiam Weekly Report')}
        </Text>
        
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.text}>
            {processMetadataForPDF(`ช่วงเวลา: ${formatDisplayDate(rangeStart, null)} - ${formatDisplayDate(rangeEnd, null)}`)}
          </Text>
          <Text style={styles.text}>
            {processMetadataForPDF(`ณ วันที่: ${new Date(generatedAt).toLocaleString('th-TH')}`)}
          </Text>
          <Text style={styles.text}>
            {processMetadataForPDF(`จำนวนรายการ: ${items.length} รายการ | แหล่งข้อมูล: ${source}`)}
          </Text>
          {snapshotId && (
            <Text style={styles.itemMeta}>
              Snapshot ID: {snapshotId.slice(0, 8)}
            </Text>
          )}
        </View>

        <Text style={styles.h2}>{processTitleForPDF('เนื้อหายอดนิยม')}</Text>
        
        <View>
          {items.slice(0, 20).map((item, idx) => (
            <View key={idx} style={styles.item}>
              <Text style={styles.itemTitle}>
                {processTitleForPDF(`${item.rank || idx + 1}. ${item.title || 'ไม่มีหัวข้อ'}`)}
              </Text>
              <Text style={styles.itemMeta}>
                {processMetadataForPDF(`หมวดหมู่: ${item.category || 'ไม่ระบุ'} | ช่อง: ${item.channel || 'ไม่ระบุ'} | คะแนน: ${toScoreString(item.popularity_score_precise) || toScoreString(item.popularity_score)}`)}
              </Text>
              {item.published_at && (
                <Text style={styles.itemMeta}>
                  {processMetadataForPDF(`เผยแพร่: ${formatDisplayDate(item.published_at, item.created_at)}`)}
                </Text>
              )}
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.text}>
            {processMetadataForPDF('รายงานนี้สร้างโดยระบบ TrendSiam อัตโนมัติ')}
          </Text>
          <Text style={styles.itemMeta}>
            {processMetadataForPDF(`เวลาสร้าง: ${new Date().toLocaleString('th-TH')}`)}
          </Text>
        </View>
      </Page>
    </Document>
  );
}