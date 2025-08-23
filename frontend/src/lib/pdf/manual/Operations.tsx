/**
 * Operations Manual - Thai Manual
 */

import React from 'react';
import { Page, Text, View } from '@react-pdf/renderer';
import { createPDFStyles } from '../pdfStyles';

const styles = createPDFStyles();

export function Operations() {
  return (
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <Text style={{
        ...styles.h1,
        marginBottom: 20
      }}>
        5. คู่มือการปฏิบัติการ
      </Text>

      {/* Deployment */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          5.1 การติดตั้งและใช้งาน
        </Text>

        <View style={{ marginBottom: 12 }}>
          <Text style={{
            ...styles.h3,
            marginBottom: 6
          }}>
            การติดตั้งเบื้องต้น
          </Text>
          <View style={{
            backgroundColor: '#F9FAFB',
            padding: 10,
            borderRadius: 4,
            marginBottom: 8
          }}>
            <Text style={{
              ...styles.text,
              fontSize: 10,
              fontFamily: 'Courier'
            }}>
              # Clone repository{'\n'}
              git clone https://github.com/your-org/trendsiam.git{'\n'}
              cd trendsiam{'\n'}
              {'\n'}
              # Install dependencies{'\n'}
              cd frontend{'\n'}
              npm install{'\n'}
              {'\n'}
              # Setup environment{'\n'}
              cp .env.example .env.local{'\n'}
              # Edit .env.local with your Supabase credentials
            </Text>
          </View>
        </View>

        <View style={{ marginBottom: 12 }}>
          <Text style={{
            ...styles.h3,
            marginBottom: 6
          }}>
            การรันระบบ
          </Text>
          <View style={{
            backgroundColor: '#F9FAFB',
            padding: 10,
            borderRadius: 4,
            marginBottom: 8
          }}>
            <Text style={{
              ...styles.text,
              fontSize: 10,
              fontFamily: 'Courier'
            }}>
              # Development server{'\n'}
              npm run dev{'\n'}
              {'\n'}
              # Production build{'\n'}
              npm run build{'\n'}
              npm run start{'\n'}
              {'\n'}
              # Test weekly PDF generation{'\n'}
              curl -o weekly.pdf "http://localhost:3000/api/weekly/pdf"
            </Text>
          </View>
        </View>
      </View>

      {/* Data Processing */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          5.2 การประมวลผลข้อมูล
        </Text>

        <View style={{ marginBottom: 12 }}>
          <Text style={{
            ...styles.h3,
            marginBottom: 6
          }}>
            การดึงข้อมูลข่าวใหม่
          </Text>
          <View style={{
            backgroundColor: '#F9FAFB',
            padding: 10,
            borderRadius: 4,
            marginBottom: 8
          }}>
            <Text style={{
              ...styles.text,
              fontSize: 10,
              fontFamily: 'Courier'
            }}>
              # ดึงข้อมูล 20 รายการล่าสุด{'\n'}
              python summarize_all_v2.py --20{'\n'}
              {'\n'}
              # ดึงข้อมูลแบบเต็ม{'\n'}
              python summarize_all_v2.py{'\n'}
              {'\n'}
              # ตรวจสอบสถานะ pipeline{'\n'}
              python scripts/check_pipeline_health.py
            </Text>
          </View>
        </View>

        <View style={{ marginBottom: 12 }}>
          <Text style={{
            ...styles.h3,
            marginBottom: 6
          }}>
            การสร้างรายงานรายสัปดาห์
          </Text>
          <View style={{
            backgroundColor: '#F9FAFB',
            padding: 10,
            borderRadius: 4,
            marginBottom: 8
          }}>
            <Text style={{
              ...styles.text,
              fontSize: 10,
              fontFamily: 'Courier'
            }}>
              # สร้าง snapshot ใหม่{'\n'}
              cd frontend{'\n'}
              npm run snapshot:build:publish{'\n'}
              {'\n'}
              # ตรวจสอบ snapshot{'\n'}
              npm run snapshot:test:selection{'\n'}
              {'\n'}
              # ดู diagnostics{'\n'}
              curl http://localhost:3000/api/weekly/diagnostics
            </Text>
          </View>
        </View>
      </View>

      {/* Monitoring */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          5.3 การตรวจสอบสุขภาพระบบ
        </Text>

        <View style={{ marginBottom: 12 }}>
          <Text style={{
            ...styles.h3,
            marginBottom: 6
          }}>
            Health Check Endpoints
          </Text>
          <Text style={{
            ...styles.text,
            marginLeft: 16,
            fontSize: 11,
            marginBottom: 8
          }}>
            • /api/health - สถานะระบบโดยรวม{'\n'}
            • /api/health/db - การเชื่อมต่อฐานข้อมูล{'\n'}
            • /api/weekly/diagnostics - สถานะรายงานรายสัปดาห์{'\n'}
            • /api/env-check - ตรวจสอบ environment variables
          </Text>
        </View>

        <View style={{ marginBottom: 12 }}>
          <Text style={{
            ...styles.h3,
            marginBottom: 6
          }}>
            การตรวจสอบข้อมูล
          </Text>
          <View style={{
            backgroundColor: '#F9FAFB',
            padding: 10,
            borderRadius: 4,
            marginBottom: 8
          }}>
            <Text style={{
              ...styles.text,
              fontSize: 10,
              fontFamily: 'Courier'
            }}>
              # ตรวจสอบข้อมูลล่าสุด{'\n'}
              python test_pipeline_diagnostics.py{'\n'}
              {'\n'}
              # ตรวจสอบ AI images{'\n'}
              python scripts/verify_images.py{'\n'}
              {'\n'}
              # ตรวจสอบ score details{'\n'}
              python scripts/check_score_details.py
            </Text>
          </View>
        </View>
      </View>

      {/* Troubleshooting */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          5.4 การแก้ไขปัญหาเบื้องต้น
        </Text>

        <View style={{ marginLeft: 16 }}>
          <Text style={{
            ...styles.text,
            fontSize: 11,
            marginBottom: 6
          }}>
            <Text style={{ fontWeight: 'bold' }}>ปัญหา: Weekly report แสดง "No snapshots available"</Text>
          </Text>
          <Text style={{
            ...styles.text,
            fontSize: 10,
            marginLeft: 16,
            marginBottom: 8
          }}>
            • ตรวจสอบ /api/weekly/diagnostics{'\n'}
            • รัน npm run snapshot:build:publish{'\n'}
            • ตรวจสอบ environment variables
          </Text>

          <Text style={{
            ...styles.text,
            fontSize: 11,
            marginBottom: 6
          }}>
            <Text style={{ fontWeight: 'bold' }}>ปัญหา: AI image generation ล้มเหลว</Text>
          </Text>
          <Text style={{
            ...styles.text,
            fontSize: 10,
            marginLeft: 16,
            marginBottom: 8
          }}>
            • ตรวจสอบ OpenAI API key{'\n'}
            • ตรวจสอบ quota และ rate limits{'\n'}
            • รัน python scripts/verify_images.py
          </Text>

          <Text style={{
            ...styles.text,
            fontSize: 11,
            marginBottom: 6
          }}>
            <Text style={{ fontWeight: 'bold' }}>ปัญหา: Database connection error</Text>
          </Text>
          <Text style={{
            ...styles.text,
            fontSize: 10,
            marginLeft: 16
          }}>
            • ตรวจสอบ Supabase credentials{'\n'}
            • ตรวจสอบ network connectivity{'\n'}
            • ตรวจสอบ RLS policies
          </Text>
        </View>
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
        หน้า 7
      </Text>
    </Page>
  );
}
