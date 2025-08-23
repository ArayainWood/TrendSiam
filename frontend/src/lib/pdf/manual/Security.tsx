/**
 * Security Overview - Thai Manual
 */

import React from 'react';
import { Page, Text, View } from '@react-pdf/renderer';
import { createPDFStyles } from '../pdfStyles';

const styles = createPDFStyles();

export function Security() {
  return (
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <Text style={{
        ...styles.h1,
        marginBottom: 20
      }}>
        3. ความปลอดภัยของระบบ
      </Text>

      {/* Security Overview */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          3.1 ภาพรวมความปลอดภัย
        </Text>
        <Text style={{
          ...styles.text,
          marginBottom: 12
        }}>
          ระบบ TrendSiam ได้รับการออกแแบบด้วยหลักการความปลอดภัยแบบ Defense in Depth 
          โดยมีการป้องกันหลายชั้นตั้งแต่ระดับเครือข่าย แอปพลิเคชัน จนถึงฐานข้อมูล
        </Text>
      </View>

      {/* Web Security */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          3.2 ความปลอดภัยของเว็บแอปพลิเคชัน
        </Text>

        <View style={{ marginBottom: 12 }}>
          <Text style={{
            ...styles.h3,
            marginBottom: 6
          }}>
            Content Security Policy (CSP)
          </Text>
          <Text style={{
            ...styles.text,
            marginLeft: 16,
            marginBottom: 8,
            fontSize: 11
          }}>
            • ป้องกันการโจมตีแบบ XSS (Cross-Site Scripting){'\n'}
            • จำกัดแหล่งที่มาของ script, style, และ image{'\n'}
            • บล็อกการโหลด inline script ที่ไม่ปลอดภัย{'\n'}
            • รายงานการละเมิดนโยบายไปยัง monitoring system
          </Text>
        </View>

        <View style={{ marginBottom: 12 }}>
          <Text style={{
            ...styles.h3,
            marginBottom: 6
          }}>
            HTTP Security Headers
          </Text>
          <Text style={{
            ...styles.text,
            marginLeft: 16,
            marginBottom: 8,
            fontSize: 11
          }}>
            • X-Frame-Options: ป้องกัน clickjacking{'\n'}
            • X-Content-Type-Options: ป้องกัน MIME type sniffing{'\n'}
            • Referrer-Policy: ควบคุมการส่ง referrer information{'\n'}
            • Strict-Transport-Security: บังคับใช้ HTTPS
          </Text>
        </View>

        <View style={{ marginBottom: 12 }}>
          <Text style={{
            ...styles.h3,
            marginBottom: 6
          }}>
            Input Validation และ Sanitization
          </Text>
          <Text style={{
            ...styles.text,
            marginLeft: 16,
            marginBottom: 8,
            fontSize: 11
          }}>
            • ตรวจสอบและทำความสะอาดข้อมูลทุก API endpoint{'\n'}
            • ใช้ Zod schema สำหรับ type validation{'\n'}
            • Sanitize ข้อมูลก่อนแสดงผลใน PDF{'\n'}
            • ป้องกัน SQL injection ด้วย parameterized queries
          </Text>
        </View>
      </View>

      {/* API Security */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          3.3 ความปลอดภัยของ API
        </Text>

        <View style={{ marginBottom: 12 }}>
          <Text style={{
            ...styles.h3,
            marginBottom: 6
          }}>
            Rate Limiting
          </Text>
          <Text style={{
            ...styles.text,
            marginLeft: 16,
            marginBottom: 8,
            fontSize: 11
          }}>
            • จำกัดจำนวน request ต่อ IP address{'\n'}
            • ป้องกันการโจมตีแบบ DDoS{'\n'}
            • ใช้ sliding window algorithm{'\n'}
            • แจ้งเตือนเมื่อมีการใช้งานผิดปกติ
          </Text>
        </View>

        <View style={{ marginBottom: 12 }}>
          <Text style={{
            ...styles.h3,
            marginBottom: 6
          }}>
            Authentication และ Authorization
          </Text>
          <Text style={{
            ...styles.text,
            marginLeft: 16,
            marginBottom: 8,
            fontSize: 11
          }}>
            • ใช้ Supabase Auth สำหรับการจัดการผู้ใช้{'\n'}
            • JWT tokens สำหรับ session management{'\n'}
            • Role-based access control (RBAC){'\n'}
            • Multi-factor authentication (MFA) สำหรับ admin
          </Text>
        </View>
      </View>

      {/* Error Handling */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          3.4 การจัดการข้อผิดพลาด
        </Text>
        <Text style={{
          ...styles.text,
          marginBottom: 8
        }}>
          หลักการสำคัญในการจัดการข้อผิดพลาด:
        </Text>
        <Text style={{
          ...styles.text,
          marginLeft: 16,
          fontSize: 11
        }}>
          • ไม่เปิดเผยข้อมูลระบบภายในในข้อความ error{'\n'}
          • Log ข้อผิดพลาดแบบละเอียดใน server-side เท่านั้น{'\n'}
          • ส่งข้อความ error ที่เป็นมิตรกับผู้ใช้{'\n'}
          • ไม่ log ข้อมูลที่เป็นความลับ (API keys, passwords){'\n'}
          • ใช้ structured logging สำหรับการวิเคราะห์
        </Text>
      </View>

      {/* SSRF Protection */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          3.5 การป้องกัน SSRF และ Path Traversal
        </Text>
        <Text style={{
          ...styles.text,
          marginLeft: 16,
          fontSize: 11
        }}>
          • ตรวจสอบ URL ก่อนทำ HTTP requests{'\n'}
          • บล็อก private IP ranges และ localhost{'\n'}
          • Whitelist allowed domains สำหรับ external requests{'\n'}
          • Validate file paths และป้องกัน directory traversal{'\n'}
          • ใช้ sandbox environment สำหรับการประมวลผลไฟล์
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
        หน้า 5
      </Text>
    </Page>
  );
}
