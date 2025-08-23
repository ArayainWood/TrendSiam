/**
 * Architecture Overview - Thai Manual
 */

import React from 'react';
import { Page, Text, View, Image } from '@react-pdf/renderer';
import { createPDFStyles } from '../pdfStyles';
import { sanitizeForPDF } from '../textSanitizer';

const styles = createPDFStyles();

export function Architecture() {
  return (
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <Text style={{
        ...styles.h1,
        marginBottom: 20
      }}>
        1. ภาพรวมสถาปัตยกรรมระบบ
      </Text>

      {/* System Overview */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          1.1 ภาพรวมระบบ TrendSiam
        </Text>
        <Text style={{
          ...styles.text,
          marginBottom: 12
        }}>
          ระบบ TrendSiam เป็นแพลตฟอร์มรวบรวมและวิเคราะห์ข่าวแนวโน้มจากแหล่งข้อมูลต่างๆ 
          โดยเฉพาะจาก YouTube และสื่อออนไลน์ในประเทศไทย ระบบใช้เทคโนโลยี AI 
          ในการจัดหมวดหมู่ สร้างสรุป และสร้างภาพประกอบอัตโนมัติ
        </Text>
      </View>

      {/* Architecture Components */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          1.2 องค์ประกอบหลักของระบบ
        </Text>

        {/* Frontend */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{
            ...styles.h3,
            marginBottom: 6
          }}>
            Frontend (Next.js)
          </Text>
          <Text style={{
            ...styles.text,
            marginLeft: 16,
            marginBottom: 8
          }}>
            • เว็บแอปพลิเคชันสำหรับแสดงผลข้อมูลแนวโน้ม{'\n'}
            • รายงาน PDF รายสัปดาห์{'\n'}
            • หน้าจอสำหรับผู้ดูแลระบบ{'\n'}
            • API endpoints สำหรับการเชื่อมต่อข้อมูล
          </Text>
        </View>

        {/* Backend Processing */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{
            ...styles.h3,
            marginBottom: 6
          }}>
            Backend Processing (Python)
          </Text>
          <Text style={{
            ...styles.text,
            marginLeft: 16,
            marginBottom: 8
          }}>
            • ระบบดึงข้อมูลจาก YouTube API{'\n'}
            • การประมวลผลและจัดหมวดหมู่ด้วย AI{'\n'}
            • การสร้างสรุปภาษาไทยและอังกฤษ{'\n'}
            • การสร้างภาพประกอบด้วย AI{'\n'}
            • การคำนวณคะแนนความนิยม
          </Text>
        </View>

        {/* Database */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{
            ...styles.h3,
            marginBottom: 6
          }}>
            ฐานข้อมูล (Supabase)
          </Text>
          <Text style={{
            ...styles.text,
            marginLeft: 16,
            marginBottom: 8
          }}>
            • PostgreSQL database สำหรับเก็บข้อมูลข่าว{'\n'}
            • Authentication และ authorization{'\n'}
            • Storage สำหรับไฟล์ภาพ{'\n'}
            • Real-time subscriptions{'\n'}
            • Row Level Security (RLS) policies
          </Text>
        </View>
      </View>

      {/* Technology Stack */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          1.3 เทคโนโลยีที่ใช้
        </Text>

        <View style={{
          flexDirection: 'row',
          marginBottom: 12
        }}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={{
              ...styles.h3,
              marginBottom: 6
            }}>
              Frontend
            </Text>
            <Text style={{
              ...styles.text,
              fontSize: 10
            }}>
              • Next.js 14{'\n'}
              • React 18{'\n'}
              • TypeScript{'\n'}
              • Tailwind CSS{'\n'}
              • React-PDF{'\n'}
              • Zustand (State Management)
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{
              ...styles.h3,
              marginBottom: 6
            }}>
              Backend
            </Text>
            <Text style={{
              ...styles.text,
              fontSize: 10
            }}>
              • Python 3.11+{'\n'}
              • OpenAI API{'\n'}
              • YouTube Data API{'\n'}
              • Supabase Python Client{'\n'}
              • Pillow (Image Processing){'\n'}
              • BeautifulSoup4
            </Text>
          </View>
        </View>
      </View>

      {/* Deployment */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          1.4 การติดตั้งและใช้งาน
        </Text>
        <Text style={{
          ...styles.text,
          marginBottom: 8
        }}>
          ระบบสามารถติดตั้งและใช้งานได้หลายรูปแบบ:
        </Text>
        <Text style={{
          ...styles.text,
          marginLeft: 16,
          fontSize: 10
        }}>
          • Development: Local development server{'\n'}
          • Staging: Vercel หรือ cloud platform อื่นๆ{'\n'}
          • Production: Vercel + Supabase Cloud{'\n'}
          • Self-hosted: Docker containers
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
        หน้า 3
      </Text>
    </Page>
  );
}
