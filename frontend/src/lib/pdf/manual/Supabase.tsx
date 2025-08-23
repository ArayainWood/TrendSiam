/**
 * Supabase Configuration - Thai Manual
 */

import React from 'react';
import { Page, Text, View } from '@react-pdf/renderer';
import { createPDFStyles } from '../pdfStyles';

const styles = createPDFStyles();

export function Supabase() {
  return (
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <Text style={{
        ...styles.h1,
        marginBottom: 20
      }}>
        4. การใช้งาน Supabase
      </Text>

      {/* Overview */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          4.1 ภาพรวม Supabase
        </Text>
        <Text style={{
          ...styles.text,
          marginBottom: 12
        }}>
          Supabase เป็น Backend-as-a-Service ที่ให้บริการ PostgreSQL database, 
          Authentication, Storage, และ Real-time subscriptions ระบบ TrendSiam 
          ใช้ Supabase เป็นแกนหลักสำหรับการจัดเก็บและจัดการข้อมูล
        </Text>
      </View>

      {/* Database Schema */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          4.2 โครงสร้างฐานข้อมูล
        </Text>

        <View style={{ marginBottom: 12 }}>
          <Text style={{
            ...styles.h3,
            marginBottom: 6
          }}>
            ตารางหลัก
          </Text>
          
          <View style={{ marginLeft: 16, marginBottom: 8 }}>
            <Text style={{
              ...styles.text,
              fontSize: 11,
              fontWeight: 'bold',
              marginBottom: 4
            }}>
              news_trends
            </Text>
            <Text style={{
              ...styles.text,
              fontSize: 10,
              marginLeft: 16,
              marginBottom: 6
            }}>
              เก็บข้อมูลข่าวและแนวโน้มหลัก รวมถึง metadata, คะแนน, และ AI analysis
            </Text>

            <Text style={{
              ...styles.text,
              fontSize: 11,
              fontWeight: 'bold',
              marginBottom: 4
            }}>
              weekly_report_snapshots
            </Text>
            <Text style={{
              ...styles.text,
              fontSize: 10,
              marginLeft: 16,
              marginBottom: 6
            }}>
              เก็บข้อมูล snapshot สำหรับรายงานรายสัปดาห์ ใช้สำหรับสร้าง PDF
            </Text>

            <Text style={{
              ...styles.text,
              fontSize: 11,
              fontWeight: 'bold',
              marginBottom: 4
            }}>
              ai_generated_images
            </Text>
            <Text style={{
              ...styles.text,
              fontSize: 10,
              marginLeft: 16
            }}>
              เก็บข้อมูลภาพที่สร้างด้วย AI รวมถึง prompts และ metadata
            </Text>
          </View>
        </View>

        <View style={{ marginBottom: 12 }}>
          <Text style={{
            ...styles.h3,
            marginBottom: 6
          }}>
            Views และ Functions
          </Text>
          <Text style={{
            ...styles.text,
            marginLeft: 16,
            fontSize: 11
          }}>
            • weekly_report_public_v: View สำหรับข้อมูลรายงานสาธารณะ{'\n'}
            • Various helper functions สำหรับการคำนวณและการจัดการข้อมูล
          </Text>
        </View>
      </View>

      {/* RLS Policies */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          4.3 Row Level Security (RLS)
        </Text>
        
        <Text style={{
          ...styles.text,
          marginBottom: 8
        }}>
          การตั้งค่า RLS policies สำหรับความปลอดภัย:
        </Text>

        <View style={{ marginLeft: 16 }}>
          <Text style={{
            ...styles.text,
            fontSize: 11,
            marginBottom: 6
          }}>
            • <Text style={{ fontWeight: 'bold' }}>Public Read Access</Text>: อนุญาตให้ anon role อ่านข้อมูลที่เผยแพร่แล้ว
          </Text>
          <Text style={{
            ...styles.text,
            fontSize: 11,
            marginBottom: 6
          }}>
            • <Text style={{ fontWeight: 'bold' }}>Admin Write Access</Text>: เฉพาะ service role เท่านั้นที่เขียนข้อมูลได้
          </Text>
          <Text style={{
            ...styles.text,
            fontSize: 11,
            marginBottom: 6
          }}>
            • <Text style={{ fontWeight: 'bold' }}>Status-based Filtering</Text>: กรองข้อมูลตาม status (published, draft, etc.)
          </Text>
        </View>
      </View>

      {/* Authentication */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          4.4 Authentication และ Authorization
        </Text>

        <View style={{ marginBottom: 12 }}>
          <Text style={{
            ...styles.h3,
            marginBottom: 6
          }}>
            Client-side Authentication
          </Text>
          <Text style={{
            ...styles.text,
            marginLeft: 16,
            fontSize: 11,
            marginBottom: 8
          }}>
            • ใช้ anon key สำหรับการเข้าถึงข้อมูลสาธารณะ{'\n'}
            • JWT tokens สำหรับ authenticated users{'\n'}
            • Session management ผ่าน Supabase Auth
          </Text>
        </View>

        <View style={{ marginBottom: 12 }}>
          <Text style={{
            ...styles.h3,
            marginBottom: 6
          }}>
            Server-side Operations
          </Text>
          <Text style={{
            ...styles.text,
            marginLeft: 16,
            fontSize: 11,
            marginBottom: 8
          }}>
            • ใช้ service role key สำหรับ backend operations{'\n'}
            • CLI scripts และ cron jobs{'\n'}
            • Admin operations และ data processing
          </Text>
        </View>
      </View>

      {/* Storage */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          4.5 Storage Configuration
        </Text>

        <Text style={{
          ...styles.text,
          marginBottom: 8
        }}>
          การจัดการไฟล์และภาพ:
        </Text>

        <View style={{ marginLeft: 16 }}>
          <Text style={{
            ...styles.text,
            fontSize: 11,
            marginBottom: 4
          }}>
            • <Text style={{ fontWeight: 'bold' }}>ai-generated-images</Text>: Bucket สำหรับภาพที่สร้างด้วย AI
          </Text>
          <Text style={{
            ...styles.text,
            fontSize: 11,
            marginBottom: 4
          }}>
            • <Text style={{ fontWeight: 'bold' }}>Public Access</Text>: ภาพสามารถเข้าถึงได้โดยไม่ต้อง authentication
          </Text>
          <Text style={{
            ...styles.text,
            fontSize: 11,
            marginBottom: 4
          }}>
            • <Text style={{ fontWeight: 'bold' }}>CDN Integration</Text>: ใช้ Supabase CDN สำหรับการแจกจ่ายไฟล์
          </Text>
        </View>
      </View>

      {/* Best Practices */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          4.6 แนวทางปฏิบัติที่ดี
        </Text>

        <Text style={{
          ...styles.text,
          marginLeft: 16,
          fontSize: 11
        }}>
          • แยก environment variables ระหว่าง development และ production{'\n'}
          • ใช้ connection pooling สำหรับ high-traffic applications{'\n'}
          • Monitor database performance และ query optimization{'\n'}
          • Backup ข้อมูลสำคัญเป็นประจำ{'\n'}
          • ตรวจสอบ RLS policies เป็นระยะ{'\n'}
          • ใช้ prepared statements เพื่อป้องกัน SQL injection
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
        หน้า 6
      </Text>
    </Page>
  );
}
