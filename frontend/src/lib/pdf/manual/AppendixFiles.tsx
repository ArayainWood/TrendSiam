/**
 * File Inventory Appendix - Thai Manual
 */

import React from 'react';
import { Page, Text, View } from '@react-pdf/renderer';
import { createPDFStyles } from '../pdfStyles';
import { sanitizeForPDF } from '../textSanitizer';
import type { FileInfo } from './fileInventory';

const styles = createPDFStyles();

interface AppendixFilesProps {
  fileInventory: FileInfo[];
}

export function AppendixFiles({ fileInventory }: AppendixFilesProps) {
  // Group files by directory
  const groupedFiles = groupFilesByDirectory(fileInventory);
  
  return (
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <Text style={{
        ...styles.h1,
        marginBottom: 20
      }}>
        ภาคผนวก ก: บัญชีรายชื่อไฟล์
      </Text>

      {/* Introduction */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.text,
          marginBottom: 12
        }}>
          บัญชีรายชื่อไฟล์ทั้งหมดในระบบ TrendSiam โดยเฉพาะไฟล์ Python ที่เป็นส่วนสำคัญ
          ของการประมวลผลข้อมูลและ AI processing
        </Text>
      </View>

      {/* Python Files Section */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          ก.1 ไฟล์ Python หลัก
        </Text>

        {Object.entries(groupedFiles).map(([directory, files]) => (
          <View key={directory} style={{ marginBottom: 16 }}>
            <Text style={{
              ...styles.h3,
              marginBottom: 8,
              color: '#3B82F6'
            }}>
              📁 {directory || 'Root Directory'}
            </Text>

            {files.filter(f => f.type === 'python').map((file, index) => (
              <View key={index} style={{
                marginBottom: 12,
                marginLeft: 16,
                paddingBottom: 8,
                borderBottomWidth: 0.5,
                borderBottomColor: '#E5E7EB'
              }}>
                {/* File Name */}
                <Text style={{
                  ...styles.text,
                  fontSize: 11,
                  fontWeight: 'bold',
                  marginBottom: 4
                }}>
                  🐍 {sanitizeForPDF(file.name)}
                </Text>

                {/* Description */}
                <Text style={{
                  ...styles.text,
                  fontSize: 10,
                  marginBottom: 6,
                  marginLeft: 16
                }}>
                  {sanitizeForPDF(file.description)}
                </Text>

                {/* Functions */}
                {file.functions.length > 0 && (
                  <View style={{ marginLeft: 16, marginBottom: 4 }}>
                    <Text style={{
                      ...styles.text,
                      fontSize: 9,
                      color: '#6B7280'
                    }}>
                      ฟังก์ชันหลัก: {file.functions.slice(0, 5).join(', ')}
                      {file.functions.length > 5 && '...'}
                    </Text>
                  </View>
                )}

                {/* Usage */}
                {file.usage.length > 0 && (
                  <View style={{ marginLeft: 16, marginBottom: 4 }}>
                    <Text style={{
                      ...styles.text,
                      fontSize: 9,
                      color: '#059669'
                    }}>
                      การใช้งาน: {file.usage.join(', ')}
                    </Text>
                  </View>
                )}

                {/* File Size */}
                <View style={{ marginLeft: 16 }}>
                  <Text style={{
                    ...styles.text,
                    fontSize: 8,
                    color: '#9CA3AF'
                  }}>
                    ขนาดไฟล์: {formatFileSize(file.size)} | เส้นทาง: {sanitizeForPDF(file.relativePath)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>

      {/* Key Scripts Summary */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          ...styles.h2,
          marginBottom: 10
        }}>
          ก.2 สคริปต์สำคัญ
        </Text>

        <View style={{
          backgroundColor: '#F0F9FF',
          padding: 12,
          borderRadius: 4,
          marginBottom: 12
        }}>
          <Text style={{
            ...styles.text,
            fontSize: 11,
            marginBottom: 8
          }}>
            <Text style={{ fontWeight: 'bold' }}>สคริปต์หลักสำหรับการดึงข้อมูล:</Text>
          </Text>
          <Text style={{
            ...styles.text,
            fontSize: 10,
            marginLeft: 16
          }}>
            • summarize_all_v2.py - สคริปต์หลักสำหรับดึงข้อมูลจาก YouTube{'\n'}
            • youtube_api_fetcher.py - ตัวดึงข้อมูล API เฉพาะ{'\n'}
            • ai_image_generator_v2.py - สร้างภาพประกอบด้วย AI
          </Text>
        </View>

        <View style={{
          backgroundColor: '#F0FDF4',
          padding: 12,
          borderRadius: 4,
          marginBottom: 12
        }}>
          <Text style={{
            ...styles.text,
            fontSize: 11,
            marginBottom: 8
          }}>
            <Text style={{ fontWeight: 'bold' }}>สคริปต์ทดสอบและตรวจสอบ:</Text>
          </Text>
          <Text style={{
            ...styles.text,
            fontSize: 10,
            marginLeft: 16
          }}>
            • test_pipeline_diagnostics.py - ตรวจสอบสุขภาพ pipeline{'\n'}
            • acceptance_tests.py - ทดสอบการยอมรับ{'\n'}
            • security_audit.py - ตรวจสอบความปลอดภัย
          </Text>
        </View>

        <View style={{
          backgroundColor: '#FEF3C7',
          padding: 12,
          borderRadius: 4
        }}>
          <Text style={{
            ...styles.text,
            fontSize: 11,
            marginBottom: 8
          }}>
            <Text style={{ fontWeight: 'bold' }}>สคริปต์ตั้งค่าและบำรุงรักษา:</Text>
          </Text>
          <Text style={{
            ...styles.text,
            fontSize: 10,
            marginLeft: 16
          }}>
            • setup_environment.py - ตั้งค่าสภาพแวดล้อม{'\n'}
            • clean_trending_data.py - ทำความสะอาดข้อมูล{'\n'}
            • popularity_scorer.py - คำนวณคะแนนความนิยม
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
        หน้า 9
      </Text>
    </Page>
  );
}

/**
 * Group files by directory
 */
function groupFilesByDirectory(files: FileInfo[]): Record<string, FileInfo[]> {
  const grouped: Record<string, FileInfo[]> = {};
  
  for (const file of files) {
    const parts = file.relativePath.split('/');
    const directory = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
    
    if (!grouped[directory]) {
      grouped[directory] = [];
    }
    grouped[directory].push(file);
  }
  
  return grouped;
}

/**
 * Format file size in human readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
