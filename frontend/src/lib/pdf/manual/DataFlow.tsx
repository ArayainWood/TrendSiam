/**
 * Data Flow - Thai Manual
 */

import React from 'react';
import { Page, Text, View } from '@react-pdf/renderer';
import { createPDFStyles } from '../pdfStyles';

const styles = createPDFStyles();

export function DataFlow() {
  return (
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <Text style={{
        ...styles.h1,
        marginBottom: 20
      }}>
        2. การไหลของข้อมูล
      </Text>

      {/* Data Collection */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          2.1 การรวบรวมข้อมูล
        </Text>
        
        <View style={{ marginBottom: 12 }}>
          <Text style={{
            ...styles.h3,
            marginBottom: 6
          }}>
            ขั้นตอนที่ 1: ดึงข้อมูลจาก YouTube
          </Text>
          <Text style={{
            ...styles.text,
            marginLeft: 16,
            marginBottom: 8
          }}>
            • ใช้ YouTube Data API v3 ดึงข้อมูลวิดีโอยอดนิยม{'\n'}
            • กรองข้อมูลตามภูมิภาค (ประเทศไทย){'\n'}
            • ดึงข้อมูล metadata: ชื่อ, คำอธิบาย, จำนวนวิว, ไลค์, คอมเมนต์{'\n'}
            • บันทึกข้อมูลดิบลงฐานข้อมูล
          </Text>
        </View>

        <View style={{ marginBottom: 12 }}>
          <Text style={{
            ...styles.h3,
            marginBottom: 6
          }}>
            ขั้นตอนที่ 2: การประมวลผลด้วย AI
          </Text>
          <Text style={{
            ...styles.text,
            marginLeft: 16,
            marginBottom: 8
          }}>
            • ส่งข้อมูลไปยัง OpenAI API สำหรับการวิเคราะห์{'\n'}
            • จัดหมวดหมู่เนื้อหา (บันเทิง, ข่าว, กีฬา, เทคโนโลยี, ฯลฯ){'\n'}
            • สร้างสรุปภาษาไทยและอังกฤษ{'\n'}
            • สกัดคำสำคัญและแท็ก{'\n'}
            • คำนวณคะแนนความเกี่ยวข้องและความนิยม
          </Text>
        </View>
      </View>

      {/* Data Processing Pipeline */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          2.2 Pipeline การประมวลผล
        </Text>

        <View style={{
          backgroundColor: '#F9FAFB',
          padding: 12,
          borderRadius: 4,
          marginBottom: 12
        }}>
          <Text style={{
            ...styles.text,
            fontSize: 10,
            fontFamily: 'Courier'
          }}>
            YouTube API → Raw Data → AI Processing → Categorization → 
            Summary Generation → Image Generation → Score Calculation → 
            Database Storage → Frontend Display
          </Text>
        </View>

        <Text style={{
          ...styles.text,
          marginBottom: 8
        }}>
          รายละเอียดแต่ละขั้นตอน:
        </Text>

        <View style={{ marginLeft: 16 }}>
          <Text style={{
            ...styles.text,
            fontSize: 11,
            marginBottom: 6
          }}>
            1. <Text style={{ fontWeight: 'bold' }}>Raw Data Collection</Text>: ดึงข้อมูลจาก API และบันทึกในรูปแบบดิบ
          </Text>
          <Text style={{
            ...styles.text,
            fontSize: 11,
            marginBottom: 6
          }}>
            2. <Text style={{ fontWeight: 'bold' }}>Content Analysis</Text>: วิเคราะห์เนื้อหาด้วย AI เพื่อเข้าใจบริบท
          </Text>
          <Text style={{
            ...styles.text,
            fontSize: 11,
            marginBottom: 6
          }}>
            3. <Text style={{ fontWeight: 'bold' }}>Categorization</Text>: จัดหมวดหมู่ตามประเภทเนื้อหา
          </Text>
          <Text style={{
            ...styles.text,
            fontSize: 11,
            marginBottom: 6
          }}>
            4. <Text style={{ fontWeight: 'bold' }}>Summary Generation</Text>: สร้างสรุปที่เข้าใจง่าย
          </Text>
          <Text style={{
            ...styles.text,
            fontSize: 11,
            marginBottom: 6
          }}>
            5. <Text style={{ fontWeight: 'bold' }}>Image Generation</Text>: สร้างภาพประกอบด้วย DALL-E
          </Text>
          <Text style={{
            ...styles.text,
            fontSize: 11,
            marginBottom: 6
          }}>
            6. <Text style={{ fontWeight: 'bold' }}>Quality Scoring</Text>: คำนวณคะแนนความนิยมและคุณภาพ
          </Text>
        </View>
      </View>

      {/* Database Tables */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          2.3 โครงสร้างฐานข้อมูล
        </Text>

        <Text style={{
          ...styles.text,
          marginBottom: 8
        }}>
          ตารางหลักในระบบ:
        </Text>

        <View style={{ marginLeft: 16 }}>
          <Text style={{
            ...styles.text,
            fontSize: 11,
            marginBottom: 4
          }}>
            • <Text style={{ fontWeight: 'bold' }}>news_trends</Text>: ข้อมูลข่าวและแนวโน้มหลัก
          </Text>
          <Text style={{
            ...styles.text,
            fontSize: 11,
            marginBottom: 4
          }}>
            • <Text style={{ fontWeight: 'bold' }}>weekly_report_snapshots</Text>: ข้อมูลรายงานรายสัปดาห์
          </Text>
          <Text style={{
            ...styles.text,
            fontSize: 11,
            marginBottom: 4
          }}>
            • <Text style={{ fontWeight: 'bold' }}>ai_generated_images</Text>: ภาพที่สร้างด้วย AI
          </Text>
        </View>
      </View>

      {/* Real-time Updates */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          2.4 การอัปเดตแบบ Real-time
        </Text>
        <Text style={{
          ...styles.text,
          marginBottom: 8
        }}>
          ระบบใช้ Supabase Real-time สำหรับการอัปเดตข้อมูลแบบทันที:
        </Text>
        <Text style={{
          ...styles.text,
          marginLeft: 16,
          fontSize: 11
        }}>
          • การแจ้งเตือนเมื่อมีข้อมูลใหม่{'\n'}
          • การอัปเดตสถิติแบบ live{'\n'}
          • การซิงค์ข้อมูลระหว่างหน้าต่างๆ{'\n'}
          • การแจ้งเตือนสถานะการประมวลผล
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
        หน้า 4
      </Text>
    </Page>
  );
}
