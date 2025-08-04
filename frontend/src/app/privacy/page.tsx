'use client'

import { Layout } from '../../components/layout/Layout'
import { useUIStore } from '../../stores/uiStore'
import { useEffect } from 'react'
import { Shield, Eye, Cookie, Database, Lock, UserCheck } from 'lucide-react'

export default function PrivacyPage() {
  const { language, setCurrentPage } = useUIStore()

  useEffect(() => {
    setCurrentPage('privacy')
  }, [setCurrentPage])

  return (
    <Layout showFilters={false}>
      <div className="min-h-screen bg-white dark:bg-void-950 pt-16">
        <div className="container-medium section-spacing">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-heading font-bold text-concrete-900 dark:text-white mb-6">
              {language.code === 'th' ? 'นโยบายความเป็นส่วนตัว' : 'Privacy Policy'}
            </h1>
            <p className="text-xl text-concrete-600 dark:text-concrete-400 max-w-2xl mx-auto">
              {language.code === 'th' 
                ? 'ข้อมูลโดยละเอียดเกี่ยวกับการปกป้องข้อมูลส่วนบุคคลของผู้ใช้งาน'
                : 'Detailed information about how we protect and handle user data'
              }
            </p>
            <div className="mt-6 text-sm text-concrete-500 dark:text-concrete-500">
              {language.code === 'th' ? 'อัปเดตล่าสุด: มกราคม 2025' : 'Last updated: January 2025'}
            </div>
          </div>

          {/* Privacy Principles */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="text-center p-6 bg-concrete-50 dark:bg-void-900 rounded-2xl border border-concrete-200 dark:border-void-800">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-heading font-semibold text-concrete-900 dark:text-white mb-2">
                {language.code === 'th' ? 'ไม่เก็บข้อมูลส่วนตัว' : 'No Personal Data'}
              </h3>
              <p className="text-sm text-concrete-600 dark:text-concrete-400">
                {language.code === 'th' 
                  ? 'เราไม่เก็บข้อมูลส่วนบุคคลใดๆ ของผู้ใช้งาน'
                  : 'We do not collect any personal information from users'
                }
              </p>
            </div>

            <div className="text-center p-6 bg-concrete-50 dark:bg-void-900 rounded-2xl border border-concrete-200 dark:border-void-800">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Eye className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-heading font-semibold text-concrete-900 dark:text-white mb-2">
                {language.code === 'th' ? 'โปร่งใสและเปิดเผย' : 'Transparent & Open'}
              </h3>
              <p className="text-sm text-concrete-600 dark:text-concrete-400">
                {language.code === 'th' 
                  ? 'ข้อมูลทั้งหมดมาจากแหล่งสาธารณะ'
                  : 'All data comes from public sources'
                }
              </p>
            </div>

            <div className="text-center p-6 bg-concrete-50 dark:bg-void-900 rounded-2xl border border-concrete-200 dark:border-void-800">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-heading font-semibold text-concrete-900 dark:text-white mb-2">
                {language.code === 'th' ? 'ปลอดภัยโดยการออกแบบ' : 'Secure by Design'}
              </h3>
              <p className="text-sm text-concrete-600 dark:text-concrete-400">
                {language.code === 'th' 
                  ? 'ระบบออกแบบมาเพื่อความปลอดภัย'
                  : 'Built with security as a priority'
                }
              </p>
            </div>
          </div>

          {/* Data Collection Section */}
          <div className="mb-16">
            <h2 className="text-3xl font-heading font-bold text-concrete-900 dark:text-white mb-8">
              {language.code === 'th' ? 'การเก็บรวบรวมข้อมูล' : 'Data Collection'}
            </h2>
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <UserCheck className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-concrete-900 dark:text-white mb-2">
                      {language.code === 'th' ? 'ข้อมูลที่เราไม่เก็บ' : 'Data We Do NOT Collect'}
                    </h3>
                    <ul className="space-y-2 text-concrete-700 dark:text-concrete-300">
                      <li>• {language.code === 'th' ? 'ชื่อ นามสกุล' : 'Names or personal identifiers'}</li>
                      <li>• {language.code === 'th' ? 'อีเมล หมายเลขโทรศัพท์' : 'Email addresses or phone numbers'}</li>
                      <li>• {language.code === 'th' ? 'ที่อยู่ IP' : 'IP addresses'}</li>
                      <li>• {language.code === 'th' ? 'การติดตามข้ามเว็บไซต์' : 'Cross-site tracking'}</li>
                      <li>• {language.code === 'th' ? 'ข้อมูลการเงิน' : 'Financial information'}</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-concrete-900 dark:text-white mb-2">
                      {language.code === 'th' ? 'ข้อมูลที่เราเก็บ' : 'Data We Collect'}
                    </h3>
                    <ul className="space-y-2 text-concrete-700 dark:text-concrete-300">
                      <li>• {language.code === 'th' ? 'การตั้งค่าธีม (สว่าง/มืด)' : 'Theme preferences (light/dark)'}</li>
                      <li>• {language.code === 'th' ? 'การตั้งค่าภาษา (ไทย/อังกฤษ)' : 'Language preferences (Thai/English)'}</li>
                      <li>• {language.code === 'th' ? 'สถิติการใช้งานแบบไม่ระบุตัวตน' : 'Anonymous usage statistics'}</li>
                      <li>• {language.code === 'th' ? 'ข้อมูลเทคนิคพื้นฐาน' : 'Basic technical information'}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cookies Section */}
          <div className="mb-16">
            <h2 className="text-3xl font-heading font-bold text-concrete-900 dark:text-white mb-8">
              {language.code === 'th' ? 'การใช้คุกกี้' : 'Cookie Usage'}
            </h2>
            <div className="p-8 bg-concrete-50 dark:bg-void-900 rounded-2xl border border-concrete-200 dark:border-void-800">
              <div className="flex gap-4 mb-6">
                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                  <Cookie className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-xl font-heading font-semibold text-concrete-900 dark:text-white mb-3">
                    {language.code === 'th' ? 'คุกกี้ที่จำเป็น' : 'Essential Cookies'}
                  </h3>
                  <p className="text-concrete-700 dark:text-concrete-300 leading-relaxed mb-4">
                    {language.code === 'th' 
                      ? 'เราใช้คุกกี้เพื่อการทำงานพื้นฐานของเว็บไซต์เท่านั้น เช่น การจดจำการตั้งค่าธีมและภาษาที่คุณเลือก คุกกี้เหล่านี้จำเป็นสำหรับการทำงานของเว็บไซต์และไม่สามารถปิดได้'
                      : 'We only use essential cookies for basic website functionality, such as remembering your theme and language preferences. These cookies are necessary for the website to function and cannot be disabled.'
                    }
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <div className="font-medium text-concrete-900 dark:text-white mb-1">theme_preference</div>
                      <div className="text-sm text-concrete-600 dark:text-concrete-400">
                        {language.code === 'th' ? 'จดจำธีมที่เลือก (สว่าง/มืด)' : 'Remembers chosen theme (light/dark)'}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-concrete-900 dark:text-white mb-1">language_preference</div>
                      <div className="text-sm text-concrete-600 dark:text-concrete-400">
                        {language.code === 'th' ? 'จดจำภาษาที่เลือก (ไทย/อังกฤษ)' : 'Remembers chosen language (Thai/English)'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Data Security */}
          <div className="mb-16">
            <h2 className="text-3xl font-heading font-bold text-concrete-900 dark:text-white mb-8">
              {language.code === 'th' ? 'ความปลอดภัยของข้อมูล' : 'Data Security'}
            </h2>
            <div className="space-y-6 text-concrete-700 dark:text-concrete-300 leading-relaxed">
              <p>
                {language.code === 'th' 
                  ? 'แม้ว่าเราจะไม่เก็บข้อมูลส่วนบุคคล แต่เรายังคงให้ความสำคัญกับความปลอดภัยของข้อมูลที่มีอยู่ เราใช้มาตรการรักษาความปลอดภัยมาตรฐานอุตสาหกรรม'
                  : 'Although we do not collect personal data, we still prioritize the security of any data we do handle. We implement industry-standard security measures.'
                }
              </p>
              <ul className="space-y-2 pl-6">
                <li>• {language.code === 'th' ? 'การเข้ารหัส HTTPS สำหรับการสื่อสารทั้งหมด' : 'HTTPS encryption for all communications'}</li>
                <li>• {language.code === 'th' ? 'การอัปเดตระบบรักษาความปลอดภัยอย่างสม่ำเสมอ' : 'Regular security updates and monitoring'}</li>
                <li>• {language.code === 'th' ? 'การจัดเก็บข้อมูลอย่างปลอดภัย' : 'Secure data storage practices'}</li>
                <li>• {language.code === 'th' ? 'การเข้าถึงข้อมูลที่จำกัด' : 'Limited data access controls'}</li>
              </ul>
            </div>
          </div>

          {/* Contact Section */}
          <div className="text-center p-8 bg-concrete-50 dark:bg-void-900 rounded-2xl border border-concrete-200 dark:border-void-800">
            <h2 className="text-2xl font-heading font-semibold text-concrete-900 dark:text-white mb-4">
              {language.code === 'th' ? 'คำถามเกี่ยวกับความเป็นส่วนตัว?' : 'Privacy Questions?'}
            </h2>
            <p className="text-concrete-600 dark:text-concrete-400 mb-6">
              {language.code === 'th' 
                ? 'หากคุณมีคำถามเกี่ยวกับนโยบายความเป็นส่วนตัวของเรา'
                : 'If you have questions about our privacy policy'
              }
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="mailto:privacy@trendsiam.com" 
                className="inline-flex items-center gap-2 px-6 py-3 bg-accent-500 hover:bg-accent-600 text-white font-heading font-medium rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {language.code === 'th' ? 'ติดต่อเรา' : 'Contact Us'}
              </a>
              <a 
                href="/legal" 
                className="inline-flex items-center gap-2 px-6 py-3 bg-concrete-200 dark:bg-void-800 hover:bg-concrete-300 dark:hover:bg-void-700 text-concrete-900 dark:text-white font-heading font-medium rounded-lg transition-colors"
              >
                {language.code === 'th' ? 'ข้อมูลทางกฎหมายอื่นๆ' : 'Other Legal Info'}
              </a>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}