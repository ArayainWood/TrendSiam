'use client'

import { Layout } from '../../components/layout/Layout'
import { useUIStore } from '../../stores/uiStore'
import { useEffect } from 'react'
import { FileText, AlertTriangle, CheckCircle, Globe, Scale, Users } from 'lucide-react'

export default function TermsPage() {
  const { language, setCurrentPage } = useUIStore()

  useEffect(() => {
    setCurrentPage('terms')
  }, [setCurrentPage])

  return (
    <Layout showFilters={false}>
      <div className="min-h-screen bg-white dark:bg-void-950 pt-16">
        <div className="container-medium section-spacing">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-heading font-bold text-concrete-900 dark:text-white mb-6">
              {language.code === 'th' ? 'เงื่อนไขการใช้งาน' : 'Terms of Service'}
            </h1>
            <p className="text-xl text-concrete-600 dark:text-concrete-400 max-w-2xl mx-auto">
              {language.code === 'th' 
                ? 'เงื่อนไขและข้อกำหนดในการใช้งานแพลตฟอร์ม TrendSiam'
                : 'Terms and conditions for using the TrendSiam platform'
              }
            </p>
            <div className="mt-6 text-sm text-concrete-500 dark:text-concrete-500">
              {language.code === 'th' ? 'มีผลตั้งแต่: มกราคม 2025' : 'Effective from: January 2025'}
            </div>
          </div>

          {/* Quick Overview */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="text-center p-6 bg-concrete-50 dark:bg-void-900 rounded-2xl border border-concrete-200 dark:border-void-800">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-heading font-semibold text-concrete-900 dark:text-white mb-2">
                {language.code === 'th' ? 'ใช้งานฟรี' : 'Free to Use'}
              </h3>
              <p className="text-sm text-concrete-600 dark:text-concrete-400">
                {language.code === 'th' 
                  ? 'บริการทั้งหมดเป็นแบบไม่เสียค่าใช้จ่าย'
                  : 'All services are provided free of charge'
                }
              </p>
            </div>

            <div className="text-center p-6 bg-concrete-50 dark:bg-void-900 rounded-2xl border border-concrete-200 dark:border-void-800">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Globe className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-heading font-semibold text-concrete-900 dark:text-white mb-2">
                {language.code === 'th' ? 'ข้อมูลสาธารณะ' : 'Public Data'}
              </h3>
              <p className="text-sm text-concrete-600 dark:text-concrete-400">
                {language.code === 'th' 
                  ? 'ข้อมูลทั้งหมดมาจากแหล่งสาธารณะ'
                  : 'All data sourced from public platforms'
                }
              </p>
            </div>

            <div className="text-center p-6 bg-concrete-50 dark:bg-void-900 rounded-2xl border border-concrete-200 dark:border-void-800">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-heading font-semibold text-concrete-900 dark:text-white mb-2">
                {language.code === 'th' ? 'สำหรับการศึกษา' : 'Educational Use'}
              </h3>
              <p className="text-sm text-concrete-600 dark:text-concrete-400">
                {language.code === 'th' 
                  ? 'เหมาะสำหรับการติดตามข่าวและการศึกษา'
                  : 'Designed for news tracking and educational purposes'
                }
              </p>
            </div>
          </div>

          {/* Acceptance of Terms */}
          <div className="mb-16">
            <h2 className="text-3xl font-heading font-bold text-concrete-900 dark:text-white mb-8">
              {language.code === 'th' ? 'การยอมรับเงื่อนไข' : 'Acceptance of Terms'}
            </h2>
            <div className="p-8 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-200 dark:border-amber-800">
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-amber-900 dark:text-amber-100 mb-3">
                    {language.code === 'th' ? 'สำคัญ: โปรดอ่านก่อนใช้งาน' : 'Important: Please Read Before Using'}
                  </h3>
                  <p className="text-amber-800 dark:text-amber-200 leading-relaxed">
                    {language.code === 'th' 
                      ? 'การใช้งานแพลตฟอร์ม TrendSiam หมายถึงการยอมรับเงื่อนไขการใช้งานทั้งหมดนี้ หากคุณไม่ยอมรับเงื่อนไขใดๆ โปรดหยุดการใช้งานทันที'
                      : 'By using the TrendSiam platform, you agree to be bound by these Terms of Service. If you do not agree to any of these terms, please discontinue use immediately.'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Service Description */}
          <div className="mb-16">
            <h2 className="text-3xl font-heading font-bold text-concrete-900 dark:text-white mb-8">
              {language.code === 'th' ? 'คำอธิบายบริการ' : 'Service Description'}
            </h2>
            <div className="space-y-6 text-concrete-700 dark:text-concrete-300 leading-relaxed">
              <p>
                {language.code === 'th' 
                  ? 'TrendSiam เป็นแพลตฟอร์มที่รวบรวมและวิเคราะห์ข้อมูลข่าวสารและเทรนด์จากแหล่งข้อมูลสาธารณะ โดยเฉพาะจาก YouTube และแพลตฟอร์มโซเชียลมีเดียอื่นๆ'
                  : 'TrendSiam is a platform that aggregates and analyzes news and trending information from public data sources, particularly YouTube and other social media platforms.'
                }
              </p>
              <p>
                {language.code === 'th' 
                  ? 'เราใช้เทคโนโลยี AI และการเรียนรู้ของเครื่อง (Machine Learning) เพื่อ:'
                  : 'We use AI and Machine Learning technology to:'
                }
              </p>
              <ul className="space-y-3 pl-6 list-disc">
                <li>{language.code === 'th' ? 'สรุปเนื้อหาข่าวสารเป็นภาษาไทยและอังกฤษ' : 'Summarize news content in Thai and English'}</li>
                <li>{language.code === 'th' ? 'คำนวณคะแนนความนิยมและเทรนด์' : 'Calculate popularity scores and trends'}</li>
                <li>{language.code === 'th' ? 'จัดหมวดหมู่ข่าวสารอัตโนมัติ' : 'Automatically categorize news content'}</li>
                <li>{language.code === 'th' ? 'สร้างภาพประกอบด้วย AI' : 'Generate AI-powered illustrations'}</li>
                <li>{language.code === 'th' ? 'วิเคราะห์และประมวลผลข้อมูลเพื่อให้ข้อมูลเชิงลึก' : 'Analyze and process data to provide insights'}</li>
              </ul>
            </div>
          </div>

          {/* User Responsibilities */}
          <div className="mb-16">
            <h2 className="text-3xl font-heading font-bold text-concrete-900 dark:text-white mb-8">
              {language.code === 'th' ? 'ความรับผิดชอบของผู้ใช้' : 'User Responsibilities'}
            </h2>
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <h3 className="text-xl font-heading font-semibold text-green-600 dark:text-green-400 mb-4">
                  {language.code === 'th' ? '✅ สิ่งที่อนุญาต' : '✅ Permitted Use'}
                </h3>
                <ul className="space-y-3 text-concrete-700 dark:text-concrete-300">
                  <li>• {language.code === 'th' ? 'ใช้เพื่อการศึกษาและติดตามข่าวสาร' : 'Educational and news tracking purposes'}</li>
                  <li>• {language.code === 'th' ? 'แบ่งปันข้อมูลเพื่อการอภิปรายสาธารณะ' : 'Sharing information for public discussion'}</li>
                  <li>• {language.code === 'th' ? 'อ้างอิงแหล่งที่มาเมื่อใช้ข้อมูล' : 'Citing sources when using data'}</li>
                  <li>• {language.code === 'th' ? 'ให้ข้อเสนอแนะเพื่อปรับปรุงบริการ' : 'Providing feedback for service improvement'}</li>
                </ul>
              </div>

              <div className="space-y-6">
                <h3 className="text-xl font-heading font-semibold text-red-600 dark:text-red-400 mb-4">
                  {language.code === 'th' ? '❌ สิ่งที่ห้าม' : '❌ Prohibited Use'}
                </h3>
                <ul className="space-y-3 text-concrete-700 dark:text-concrete-300">
                  <li>• {language.code === 'th' ? 'ใช้เพื่อการค้าหรือหาผลกำไรโดยไม่ได้รับอนุญาต' : 'Commercial use without authorization'}</li>
                  <li>• {language.code === 'th' ? 'ทำการ scraping หรือดาวน์โหลดข้อมูลจำนวนมาก' : 'Automated scraping or bulk downloading'}</li>
                  <li>• {language.code === 'th' ? 'เผยแพร่ข้อมูลเท็จหรือบิดเบือน' : 'Spreading false or misleading information'}</li>
                  <li>• {language.code === 'th' ? 'รบกวนการทำงานของระบบ' : 'Interfering with system operations'}</li>
                  <li>• {language.code === 'th' ? 'ละเมิดกฎหมายหรือสิทธิ์ของผู้อื่น' : 'Violating laws or others\' rights'}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Disclaimers */}
          <div className="mb-16">
            <h2 className="text-3xl font-heading font-bold text-concrete-900 dark:text-white mb-8">
              {language.code === 'th' ? 'ข้อปฏิเสธความรับผิดชอบ' : 'Disclaimers'}
            </h2>
            <div className="space-y-6">
              <div className="p-6 bg-concrete-50 dark:bg-void-900 rounded-xl border border-concrete-200 dark:border-void-800">
                <h3 className="font-heading font-semibold text-concrete-900 dark:text-white mb-3">
                  {language.code === 'th' ? 'ความถูกต้องของข้อมูล' : 'Data Accuracy'}
                </h3>
                <p className="text-concrete-700 dark:text-concrete-300 leading-relaxed">
                  {language.code === 'th' 
                    ? 'ข้อมูลทั้งหมดมาจากแหล่งสาธารณะและประมวลผลด้วย AI เราไม่รับประกันความถูกต้อง ครบถ้วน หรือความเป็นปัจจุบันของข้อมูล ผู้ใช้ควรตรวจสอบข้อมูลจากแหล่งต้นตอเสมอ'
                    : 'All data comes from public sources and is processed by AI. We do not guarantee the accuracy, completeness, or timeliness of information. Users should always verify information from original sources.'
                  }
                </p>
              </div>

              <div className="p-6 bg-concrete-50 dark:bg-void-900 rounded-xl border border-concrete-200 dark:border-void-800">
                <h3 className="font-heading font-semibold text-concrete-900 dark:text-white mb-3">
                  {language.code === 'th' ? 'การใช้งาน AI' : 'AI Usage'}
                </h3>
                <p className="text-concrete-700 dark:text-concrete-300 leading-relaxed">
                  {language.code === 'th' 
                    ? 'การสรุป การจัดหมวดหมู่ และการสร้างภาพด้วย AI อาจมีข้อผิดพลาดหรือไม่สะท้อนความเป็นจริงได้อย่างสมบูรณ์ ผู้ใช้ควรใช้วิจารณญาณในการตีความข้อมูล'
                    : 'AI-generated summaries, categorizations, and images may contain errors or may not fully reflect reality. Users should exercise judgment when interpreting AI-processed information.'
                  }
                </p>
              </div>

              <div className="p-6 bg-concrete-50 dark:bg-void-900 rounded-xl border border-concrete-200 dark:border-void-800">
                <h3 className="font-heading font-semibold text-concrete-900 dark:text-white mb-3">
                  {language.code === 'th' ? 'ความพร้อมใช้งาน' : 'Service Availability'}
                </h3>
                <p className="text-concrete-700 dark:text-concrete-300 leading-relaxed">
                  {language.code === 'th' 
                    ? 'เราไม่รับประกันการทำงานของบริการแบบไม่มีข้อผิดพลาดหรือไม่หยุดชะงัก บริการอาจหยุดชะงักเป็นครั้งคราวเพื่อการบำรุงรักษาหรือปรับปรุง'
                    : 'We do not guarantee uninterrupted or error-free service operation. The service may be temporarily unavailable for maintenance or improvements.'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Contact and Changes */}
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="p-8 bg-concrete-50 dark:bg-void-900 rounded-2xl border border-concrete-200 dark:border-void-800">
              <div className="flex gap-4 mb-6">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-heading font-semibold text-concrete-900 dark:text-white mb-3">
                    {language.code === 'th' ? 'การเปลี่ยนแปลงเงื่อนไข' : 'Changes to Terms'}
                  </h3>
                  <p className="text-concrete-700 dark:text-concrete-300 leading-relaxed">
                    {language.code === 'th' 
                      ? 'เราขอสงวนสิทธิ์ในการแก้ไขเงื่อนไขการใช้งานเมื่อจำเป็น การเปลี่ยนแปลงจะมีผลทันทีเมื่อเผยแพร่บนเว็บไซต์'
                      : 'We reserve the right to modify these terms when necessary. Changes will take effect immediately upon posting on the website.'
                    }
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8 bg-concrete-50 dark:bg-void-900 rounded-2xl border border-concrete-200 dark:border-void-800">
              <div className="flex gap-4 mb-6">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                  <Scale className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="text-xl font-heading font-semibold text-concrete-900 dark:text-white mb-3">
                    {language.code === 'th' ? 'ติดต่อเรา' : 'Contact Us'}
                  </h3>
                  <p className="text-concrete-700 dark:text-concrete-300 leading-relaxed mb-4">
                    {language.code === 'th' 
                      ? 'หากมีคำถามเกี่ยวกับเงื่อนไขการใช้งาน'
                      : 'For questions about these terms of service'
                    }
                  </p>
                  <a 
                    href="mailto:legal@trendsiam.com" 
                    className="inline-flex items-center gap-2 text-accent-500 hover:text-accent-600 font-medium transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    legal@trendsiam.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}