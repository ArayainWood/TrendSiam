/**
 * API Reference Appendix - Thai Manual
 */

import React from 'react';
import { Page, Text, View } from '@react-pdf/renderer';
import { createPDFStyles } from '../pdfStyles';

const styles = createPDFStyles();

export function AppendixAPIs() {
  const apiEndpoints = [
    {
      method: 'GET',
      path: '/api/health',
      description: 'ตรวจสอบสถานะระบบโดยรวม',
      auth: 'ไม่ต้อง',
      response: 'JSON status object'
    },
    {
      method: 'GET',
      path: '/api/health/db',
      description: 'ตรวจสอบการเชื่อมต่อฐานข้อมูล',
      auth: 'ไม่ต้อง',
      response: 'Database connection status'
    },
    {
      method: 'GET',
      path: '/api/weekly/diagnostics',
      description: 'ข้อมูลการวินิจฉัยระบบรายงานรายสัปดาห์',
      auth: 'ไม่ต้อง',
      response: 'Diagnostic information'
    },
    {
      method: 'GET',
      path: '/api/weekly/pdf',
      description: 'สร้างและดาวน์โหลดรายงาน PDF รายสัปดาห์',
      auth: 'ไม่ต้อง',
      response: 'PDF file'
    },
    {
      method: 'GET',
      path: '/api/weekly/data',
      description: 'ข้อมูลรายงานรายสัปดาห์ในรูปแบบ JSON',
      auth: 'ไม่ต้อง',
      response: 'Weekly snapshot data'
    },
    {
      method: 'POST',
      path: '/api/admin/revalidate',
      description: 'บังคับให้ระบบโหลดข้อมูลใหม่',
      auth: 'x-revalidate-secret header',
      response: 'Revalidation result'
    },
    {
      method: 'GET',
      path: '/api/env-check',
      description: 'ตรวจสอบการตั้งค่า environment variables',
      auth: 'ไม่ต้อง',
      response: 'Environment status'
    }
  ];

  const pages = [
    {
      path: '/',
      description: 'หน้าแรก - แสดงข้อมูลข่าวแนวโน้มล่าสุด',
      type: 'Public'
    },
    {
      path: '/weekly-report',
      description: 'รายงานรายสัปดาห์ - สรุปข้อมูลและสถิติ',
      type: 'Public'
    },
    {
      path: '/dev-dashboard',
      description: 'แดชบอร์ดสำหรับนักพัฒนา',
      type: 'Development'
    },
    {
      path: '/legal',
      description: 'ข้อมูลทางกฎหมาย',
      type: 'Public'
    },
    {
      path: '/privacy',
      description: 'นโยบายความเป็นส่วนตัว',
      type: 'Public'
    },
    {
      path: '/terms',
      description: 'ข้อกำหนดการใช้งาน',
      type: 'Public'
    }
  ];

  return (
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <Text style={{
        ...styles.h1,
        marginBottom: 20
      }}>
        ภาคผนวก ข: รายการ API และเส้นทาง
      </Text>

      {/* API Endpoints */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          ข.1 API Endpoints
        </Text>

        {apiEndpoints.map((endpoint, index) => (
          <View key={index} style={{
            marginBottom: 12,
            paddingBottom: 8,
            borderBottomWidth: 0.5,
            borderBottomColor: '#E5E7EB'
          }}>
            {/* Method and Path */}
            <View style={{
              flexDirection: 'row',
              marginBottom: 4
            }}>
              <View style={{
                backgroundColor: endpoint.method === 'GET' ? '#10B981' : '#3B82F6',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 2,
                marginRight: 8
              }}>
                <Text style={{
                  ...styles.text,
                  fontSize: 9,
                  color: 'white',
                  fontWeight: 'bold'
                }}>
                  {endpoint.method}
                </Text>
              </View>
              <Text style={{
                ...styles.text,
                fontSize: 11,
                fontWeight: 'bold',
                fontFamily: 'Courier'
              }}>
                {endpoint.path}
              </Text>
            </View>

            {/* Description */}
            <Text style={{
              ...styles.text,
              fontSize: 10,
              marginBottom: 4,
              marginLeft: 16
            }}>
              {endpoint.description}
            </Text>

            {/* Auth and Response */}
            <View style={{
              flexDirection: 'row',
              marginLeft: 16
            }}>
              <Text style={{
                ...styles.text,
                fontSize: 9,
                color: '#6B7280',
                marginRight: 16
              }}>
                การยืนยันตัวตน: {endpoint.auth}
              </Text>
              <Text style={{
                ...styles.text,
                fontSize: 9,
                color: '#6B7280'
              }}>
                ผลลัพธ์: {endpoint.response}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Web Pages */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          ข.2 หน้าเว็บไซต์
        </Text>

        {pages.map((page, index) => (
          <View key={index} style={{
            marginBottom: 8,
            paddingBottom: 6,
            borderBottomWidth: 0.5,
            borderBottomColor: '#F3F4F6'
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 2
            }}>
              <Text style={{
                ...styles.text,
                fontSize: 11,
                fontWeight: 'bold',
                fontFamily: 'Courier',
                marginRight: 12
              }}>
                {page.path}
              </Text>
              <View style={{
                backgroundColor: page.type === 'Public' ? '#10B981' : '#F59E0B',
                paddingHorizontal: 4,
                paddingVertical: 1,
                borderRadius: 2
              }}>
                <Text style={{
                  ...styles.text,
                  fontSize: 8,
                  color: 'white'
                }}>
                  {page.type}
                </Text>
              </View>
            </View>
            <Text style={{
              ...styles.text,
              fontSize: 10,
              marginLeft: 16,
              color: '#6B7280'
            }}>
              {page.description}
            </Text>
          </View>
        ))}
      </View>

      {/* CLI Commands */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          ข.3 คำสั่ง CLI สำคัญ
        </Text>

        <View style={{
          backgroundColor: '#F9FAFB',
          padding: 12,
          borderRadius: 4
        }}>
          <Text style={{
            ...styles.text,
            fontSize: 10,
            fontFamily: 'Courier'
          }}>
            # Frontend Commands{'\n'}
            npm run dev                    # รัน development server{'\n'}
            npm run build                  # สร้าง production build{'\n'}
            npm run snapshot:build:publish # สร้างและเผยแพร่ snapshot{'\n'}
            npm run snapshot:test:selection # ทดสอบการเลือกข้อมูล{'\n'}
            {'\n'}
            # Backend Commands{'\n'}
            python summarize_all_v2.py --20  # ดึงข้อมูล 20 รายการ{'\n'}
            python test_pipeline_diagnostics.py # ทดสอบ pipeline{'\n'}
            python security_audit.py        # ตรวจสอบความปลอดภัย{'\n'}
            {'\n'}
            # Health Checks{'\n'}
            curl http://localhost:3000/api/health{'\n'}
            curl http://localhost:3000/api/weekly/diagnostics
          </Text>
        </View>
      </View>

      {/* Environment Variables */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          ข.4 Environment Variables สำคัญ
        </Text>

        <Text style={{
          ...styles.text,
          fontSize: 10,
          marginBottom: 8
        }}>
          ตัวแปรสภาพแวดล้อมที่จำเป็นสำหรับการทำงานของระบบ:
        </Text>

        <View style={{ marginLeft: 16 }}>
          <Text style={{
            ...styles.text,
            fontSize: 10,
            fontFamily: 'Courier',
            marginBottom: 4
          }}>
            NEXT_PUBLIC_SUPABASE_URL      # URL ของ Supabase project
          </Text>
          <Text style={{
            ...styles.text,
            fontSize: 10,
            fontFamily: 'Courier',
            marginBottom: 4
          }}>
            NEXT_PUBLIC_SUPABASE_ANON_KEY # Anon key สำหรับ client
          </Text>
          <Text style={{
            ...styles.text,
            fontSize: 10,
            fontFamily: 'Courier',
            marginBottom: 4
          }}>
            SUPABASE_SERVICE_ROLE_KEY     # Service role สำหรับ server
          </Text>
          <Text style={{
            ...styles.text,
            fontSize: 10,
            fontFamily: 'Courier',
            marginBottom: 4
          }}>
            OPENAI_API_KEY               # API key สำหรับ OpenAI
          </Text>
          <Text style={{
            ...styles.text,
            fontSize: 10,
            fontFamily: 'Courier',
            marginBottom: 4
          }}>
            YOUTUBE_API_KEY              # API key สำหรับ YouTube
          </Text>
          <Text style={{
            ...styles.text,
            fontSize: 10,
            fontFamily: 'Courier'
          }}>
            REVALIDATE_SECRET            # Secret สำหรับ revalidation
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
        หน้า 10
      </Text>
    </Page>
  );
}
