/**
 * Table of Contents - Thai Manual
 */

import React from 'react';
import { Page, Text, View } from '@react-pdf/renderer';
import { createPDFStyles } from '../pdfStyles';

const styles = createPDFStyles();

export function TableOfContents() {
  const sections = [
    { title: '1. ภาพรวมสถาปัตยกรรมระบบ', page: '3' },
    { title: '2. การไหลของข้อมูล', page: '4' },
    { title: '3. ความปลอดภัยของระบบ', page: '5' },
    { title: '4. การใช้งาน Supabase', page: '6' },
    { title: '5. คู่มือการปฏิบัติการ', page: '7' },
    { title: '6. แนวทางการทดสอบ', page: '8' },
    { title: 'ภาคผนวก ก: บัญชีรายชื่อไฟล์', page: '9' },
    { title: 'ภาคผนวก ข: รายการ API และเส้นทาง', page: '10+' }
  ];

  return (
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <Text style={{
        ...styles.h1,
        marginBottom: 20,
        textAlign: 'center'
      }}>
        สารบัญ
      </Text>

      {/* Contents */}
      <View style={{ marginTop: 20 }}>
        {sections.map((section, index) => (
          <View key={index} style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
            paddingBottom: 8,
            borderBottomWidth: 0.5,
            borderBottomColor: '#E5E7EB'
          }}>
            <Text style={{
              ...styles.text,
              flex: 1,
              fontSize: 12
            }}>
              {section.title}
            </Text>
            <Text style={{
              ...styles.text,
              fontSize: 12,
              color: '#6B7280',
              marginLeft: 10
            }}>
              หน้า {section.page}
            </Text>
          </View>
        ))}
      </View>

      {/* Additional Info */}
      <View style={{
        marginTop: 40,
        padding: 16,
        backgroundColor: '#F3F4F6',
        borderRadius: 4
      }}>
        <Text style={{
          ...styles.h3,
          marginBottom: 8
        }}>
          หมายเหตุ
        </Text>
        <Text style={{
          ...styles.text,
          fontSize: 10,
          lineHeight: 1.6
        }}>
          • เอกสารนี้จัดทำขึ้นเพื่อใช้เป็นคู่มืออ้างอิงสำหรับนักพัฒนาและผู้ดูแลระบบ{'\n'}
          • ข้อมูลในเอกสารอาจมีการเปลี่ยนแปลงตามการพัฒนาระบบ{'\n'}
          • สำหรับข้อมูลล่าสุด กรุณาตรวจสอบจากเอกสารออนไลน์หรือติดต่อทีมพัฒนา
        </Text>
      </View>

      {/* Footer */}
      <Text style={{
        ...styles.footerText,
        position: 'absolute',
        bottom: 30,
        left: 24,
        right: 24,
        textAlign: 'center'
      }}>
        หน้า 2
      </Text>
    </Page>
  );
}
