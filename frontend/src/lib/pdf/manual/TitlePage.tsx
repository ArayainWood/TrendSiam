/**
 * Title Page Component - Thai Manual
 */

import React from 'react';
import { Page, Text, View } from '@react-pdf/renderer';
import { createPDFStyles } from '../pdfStyles';
import { sanitizeForPDF } from '../textSanitizer';

const styles = createPDFStyles();

interface TitlePageProps {
  title: string;
  date: string;
  version: string;
}

export function TitlePage({ title, date, version }: TitlePageProps) {
  return (
    <Page size="A4" style={styles.page}>
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center'
      }}>
        {/* Main Title */}
        <Text style={{
          ...styles.h1,
          fontSize: 24,
          marginBottom: 20,
          textAlign: 'center'
        }}>
          {sanitizeForPDF(title)}
        </Text>

        {/* Subtitle */}
        <Text style={{
          ...styles.h2,
          fontSize: 16,
          marginBottom: 30,
          color: '#6B7280',
          textAlign: 'center'
        }}>
          คู่มือฉบับสมบูรณ์สำหรับนักพัฒนาและผู้ดูแลระบบ
        </Text>

        {/* System Logo/Icon (text-based) */}
        <View style={{
          marginBottom: 40,
          padding: 20,
          borderWidth: 2,
          borderColor: '#3B82F6',
          borderRadius: 8
        }}>
          <Text style={{
            ...styles.h1,
            fontSize: 32,
            color: '#3B82F6',
            textAlign: 'center'
          }}>
            📊 TrendSiam
          </Text>
        </View>

        {/* Version and Date */}
        <View style={{ marginBottom: 40 }}>
          <Text style={{
            ...styles.text,
            fontSize: 14,
            marginBottom: 8,
            textAlign: 'center'
          }}>
            เวอร์ชัน {sanitizeForPDF(version)}
          </Text>
          <Text style={{
            ...styles.text,
            fontSize: 12,
            color: '#6B7280',
            textAlign: 'center'
          }}>
            วันที่จัดทำ: {sanitizeForPDF(date)}
          </Text>
        </View>

        {/* Footer */}
        <View style={{
          position: 'absolute',
          bottom: 40,
          left: 0,
          right: 0
        }}>
          <Text style={{
            ...styles.footerText,
            textAlign: 'center',
            fontSize: 10
          }}>
            ระบบรวบรวมและวิเคราะห์ข่าวแนวโน้มประเทศไทย
          </Text>
          <Text style={{
            ...styles.footerText,
            textAlign: 'center',
            fontSize: 9,
            marginTop: 4
          }}>
            Thai News Trend Aggregation & Analysis System
          </Text>
        </View>
      </View>
    </Page>
  );
}
