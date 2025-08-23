/**
 * Testing Guidelines - Thai Manual
 */

import React from 'react';
import { Page, Text, View } from '@react-pdf/renderer';
import { createPDFStyles } from '../pdfStyles';

const styles = createPDFStyles();

export function Testing() {
  return (
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <Text style={{
        ...styles.h1,
        marginBottom: 20
      }}>
        6. แนวทางการทดสอบ
      </Text>

      {/* Testing Overview */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          6.1 ภาพรวมการทดสอบ
        </Text>
        <Text style={{
          ...styles.text,
          marginBottom: 12
        }}>
          ระบบ TrendSiam มีการทดสอบหลายระดับเพื่อให้มั่นใจในคุณภาพและความเสถียร 
          ตั้งแต่ unit tests, integration tests, จนถึง end-to-end tests
        </Text>
      </View>

      {/* Frontend Testing */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          6.2 การทดสอบ Frontend
        </Text>

        <View style={{ marginBottom: 12 }}>
          <Text style={{
            ...styles.h3,
            marginBottom: 6
          }}>
            การทดสอบพื้นฐาน
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
              # Type checking{'\n'}
              npm run type-check{'\n'}
              {'\n'}
              # Linting{'\n'}
              npm run lint{'\n'}
              {'\n'}
              # Build test{'\n'}
              npm run build{'\n'}
              {'\n'}
              # Security scan{'\n'}
              npm run scan:build:secrets
            </Text>
          </View>
        </View>

        <View style={{ marginBottom: 12 }}>
          <Text style={{
            ...styles.h3,
            marginBottom: 6
          }}>
            การทดสอบ Weekly Report System
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
              # ทดสอบการนับข้อมูล{'\n'}
              npm run snapshot:test:count{'\n'}
              {'\n'}
              # ทดสอบการเลือกข้อมูล{'\n'}
              npm run snapshot:test:selection{'\n'}
              {'\n'}
              # ทดสอบระบบ snapshot{'\n'}
              npm run snapshot:test
            </Text>
          </View>
        </View>

        <View style={{ marginBottom: 12 }}>
          <Text style={{
            ...styles.h3,
            marginBottom: 6
          }}>
            การทดสอบ PDF Generation
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
              # ทดสอบ PDF overlap fix{'\n'}
              npm run test:pdf-overlap{'\n'}
              {'\n'}
              # สร้าง weekly PDF{'\n'}
              curl -o test-weekly.pdf "http://localhost:3000/api/weekly/pdf"{'\n'}
              {'\n'}
              # ตรวจสอบ PDF ที่สร้าง{'\n'}
              # เปิดไฟล์และตรวจสอบว่าไม่มีข้อความทับซ้อน
            </Text>
          </View>
        </View>
      </View>

      {/* Backend Testing */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          6.3 การทดสอบ Backend
        </Text>

        <View style={{ marginBottom: 12 }}>
          <Text style={{
            ...styles.h3,
            marginBottom: 6
          }}>
            การทดสอบ Data Pipeline
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
              # ทดสอบการดึงข้อมูล{'\n'}
              python test_pipeline_diagnostics.py{'\n'}
              {'\n'}
              # ทดสอบ AI processing{'\n'}
              python test_ai_image_generation.py{'\n'}
              {'\n'}
              # ทดสอบ categorization{'\n'}
              python test_categories_pipeline.py{'\n'}
              {'\n'}
              # ทดสอบ keyword extraction{'\n'}
              python -m pytest tests/test_keyword_extraction.py
            </Text>
          </View>
        </View>

        <View style={{ marginBottom: 12 }}>
          <Text style={{
            ...styles.h3,
            marginBottom: 6
          }}>
            การทดสอบ Security
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
              # ทดสอบ crypto security{'\n'}
              python -m pytest tests/test_crypto_security.py{'\n'}
              {'\n'}
              # ทดสอบ image URL protection{'\n'}
              python -m pytest tests/test_image_url_protection.py{'\n'}
              {'\n'}
              # Security audit{'\n'}
              python security_audit.py
            </Text>
          </View>
        </View>
      </View>

      {/* Integration Testing */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          6.4 การทดสอบแบบ Integration
        </Text>

        <View style={{ marginBottom: 12 }}>
          <Text style={{
            ...styles.h3,
            marginBottom: 6
          }}>
            End-to-End Testing
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
              # ทดสอบ E2E fixes{'\n'}
              python validate_e2e_fixes.py{'\n'}
              {'\n'}
              # ทดสอบ acceptance{'\n'}
              python acceptance_tests.py{'\n'}
              {'\n'}
              # ทดสอบ compatibility{'\n'}
              python test_compat_scores.py
            </Text>
          </View>
        </View>

        <View style={{ marginBottom: 12 }}>
          <Text style={{
            ...styles.h3,
            marginBottom: 6
          }}>
            การทดสอบ API Endpoints
          </Text>
          <Text style={{
            ...styles.text,
            marginLeft: 16,
            fontSize: 11,
            marginBottom: 8
          }}>
            • GET /api/health - ควรได้ status 200{'\n'}
            • GET /api/weekly/diagnostics - ตรวจสอบข้อมูล snapshot{'\n'}
            • GET /api/weekly/pdf - ควรได้ไฟล์ PDF{'\n'}
            • POST /api/admin/revalidate - ต้องมี secret header
          </Text>
        </View>
      </View>

      {/* Performance Testing */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          6.5 การทดสอบประสิทธิภาพ
        </Text>

        <Text style={{
          ...styles.text,
          marginBottom: 8
        }}>
          แนวทางการทดสอบประสิทธิภาพ:
        </Text>

        <Text style={{
          ...styles.text,
          marginLeft: 16,
          fontSize: 11
        }}>
          • Load testing สำหรับ API endpoints{'\n'}
          • Database query performance monitoring{'\n'}
          • PDF generation time measurement{'\n'}
          • Memory usage profiling{'\n'}
          • Rate limiting effectiveness{'\n'}
          • CDN cache hit rates
        </Text>
      </View>

      {/* Test Checklist */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          6.6 Checklist การทดสอบก่อน Deploy
        </Text>

        <View style={{
          backgroundColor: '#FEF3C7',
          padding: 12,
          borderRadius: 4
        }}>
          <Text style={{
            ...styles.text,
            fontSize: 11
          }}>
            ☐ Type checking ผ่าน (npm run type-check){'\n'}
            ☐ Build สำเร็จ (npm run build){'\n'}
            ☐ Security scan ผ่าน (npm run scan:build:secrets){'\n'}
            ☐ Weekly report ทำงานได้ (npm run snapshot:test:selection){'\n'}
            ☐ PDF generation ทำงานได้{'\n'}
            ☐ Backend tests ผ่าน{'\n'}
            ☐ API endpoints ตอบสนองปกติ{'\n'}
            ☐ Database connection ใช้งานได้{'\n'}
            ☐ Environment variables ครบถ้วน
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
        หน้า 8
      </Text>
    </Page>
  );
}
