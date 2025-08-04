'use client'

import { Layout } from '../../components/layout/Layout'
import { useUIStore } from '../../stores/uiStore'
import { useEffect } from 'react'

export default function LegalPage() {
  const { language, setCurrentPage } = useUIStore()

  useEffect(() => {
    setCurrentPage('legal')
  }, [setCurrentPage])

  return (
    <Layout showFilters={false}>
      <div className="min-h-screen bg-white dark:bg-void-950 pt-16">
        <div className="container-medium section-spacing">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-heading font-bold text-concrete-900 dark:text-white mb-6">
              {language.code === 'th' ? 'ข้อมูลทางกฎหมาย' : 'Legal Information'}
            </h1>
            <p className="text-xl text-concrete-600 dark:text-concrete-400 max-w-2xl mx-auto">
              {language.code === 'th' 
                ? 'ข้อมูลสำคัญเกี่ยวกับการใช้งานแพลตฟอร์ม TrendSiam'
                : 'Important legal information regarding the use of TrendSiam platform'
              }
            </p>
          </div>

          {/* Content Grid */}
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Terms of Service */}
            <div className="space-y-6">
              <div className="p-8 bg-concrete-50 dark:bg-void-900 rounded-2xl border border-concrete-200 dark:border-void-800">
                <h2 className="text-2xl font-heading font-semibold text-concrete-900 dark:text-white mb-6">
                  {language.code === 'th' ? 'เงื่อนไขการใช้งาน' : 'Terms of Service'}
                </h2>
                <div className="space-y-4 text-concrete-700 dark:text-concrete-300 leading-relaxed">
                  <p>
                    {language.code === 'th' 
                      ? 'TrendSiam เป็นแพลตฟอร์มที่รวบรวมข้อมูลข่าวสารและเทรนด์จากแหล่งข้อมูลสาธารณะ โดยใช้เทคโนโลยี AI ในการวิเคราะห์และสรุปข้อมูล'
                      : 'TrendSiam is a platform that aggregates news and trending information from public sources, using AI technology for analysis and summarization.'
                    }
                  </p>
                  <p>
                    {language.code === 'th'
                      ? 'การใช้งานแพลตฟอร์มนี้หมายถึงการยอมรับเงื่อนไขการใช้งานทั้งหมด ผู้ใช้งานควรใช้ข้อมูลเพื่อการศึกษาและติดตามข่าวสารเท่านั้น'
                      : 'By using this platform, you agree to all terms of service. Users should utilize the information for educational and news tracking purposes only.'
                    }
                  </p>
                  <p>
                    {language.code === 'th'
                      ? 'ข้อมูลทั้งหมดมาจากแหล่งข่าวสาธารณะ และได้รับการประมวลผลด้วย AI เพื่อความสะดวกในการติดตาม'
                      : 'All information comes from public news sources and is processed by AI for convenient tracking.'
                    }
                  </p>
                </div>
                <a 
                  href="/terms" 
                  className="inline-flex items-center mt-6 text-accent-500 hover:text-accent-600 font-medium transition-colors"
                >
                  {language.code === 'th' ? 'อ่านเงื่อนไขทั้งหมด' : 'Read Full Terms'} →
                </a>
              </div>
            </div>

            {/* Privacy Policy */}
            <div className="space-y-6">
              <div className="p-8 bg-concrete-50 dark:bg-void-900 rounded-2xl border border-concrete-200 dark:border-void-800">
                <h2 className="text-2xl font-heading font-semibold text-concrete-900 dark:text-white mb-6">
                  {language.code === 'th' ? 'นโยบายความเป็นส่วนตัว' : 'Privacy Policy'}
                </h2>
                <div className="space-y-4 text-concrete-700 dark:text-concrete-300 leading-relaxed">
                  <p>
                    {language.code === 'th'
                      ? 'เราให้ความสำคัญกับความเป็นส่วนตัวของผู้ใช้งาน แพลตฟอร์มนี้ไม่เก็บข้อมูลส่วนบุคคลใดๆ ของผู้ใช้งาน'
                      : 'We prioritize user privacy. This platform does not collect any personal information from users.'
                    }
                  </p>
                  <p>
                    {language.code === 'th'
                      ? 'การใช้งานเป็นแบบไม่ระบุตัวตน และข้อมูลการใช้งานจะถูกใช้เพื่อปรับปรุงประสิทธิภาพของระบบเท่านั้น'
                      : 'Usage is anonymous, and usage data is only used to improve system performance.'
                    }
                  </p>
                  <p>
                    {language.code === 'th'
                      ? 'เราใช้คุกกี้เพื่อการทำงานพื้นฐานของเว็บไซต์ เช่น การจดจำธีมและภาษาที่เลือก'
                      : 'We use cookies for basic website functionality, such as remembering theme and language preferences.'
                    }
                  </p>
                </div>
                <a 
                  href="/privacy" 
                  className="inline-flex items-center mt-6 text-accent-500 hover:text-accent-600 font-medium transition-colors"
                >
                  {language.code === 'th' ? 'อ่านนโยบายทั้งหมด' : 'Read Full Policy'} →
                </a>
              </div>
            </div>
          </div>

          {/* Data Sources */}
          <div className="mt-16 p-8 bg-concrete-50 dark:bg-void-900 rounded-2xl border border-concrete-200 dark:border-void-800">
            <h2 className="text-2xl font-heading font-semibold text-concrete-900 dark:text-white mb-6">
              {language.code === 'th' ? 'แหล่งข้อมูล' : 'Data Sources'}
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                </div>
                <h3 className="font-heading font-semibold text-concrete-900 dark:text-white mb-2">YouTube</h3>
                <p className="text-sm text-concrete-600 dark:text-concrete-400">
                  {language.code === 'th' ? 'วิดีโอยอดนิยมและเทรนด์' : 'Trending videos and content'}
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="font-heading font-semibold text-concrete-900 dark:text-white mb-2">OpenAI</h3>
                <p className="text-sm text-concrete-600 dark:text-concrete-400">
                  {language.code === 'th' ? 'การสร้างภาพและวิเคราะห์ด้วย AI' : 'AI image generation and analysis'}
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="font-heading font-semibold text-concrete-900 dark:text-white mb-2">
                  {language.code === 'th' ? 'การวิเคราะห์' : 'Analytics'}
                </h3>
                <p className="text-sm text-concrete-600 dark:text-concrete-400">
                  {language.code === 'th' ? 'ระบบให้คะแนนความนิยม' : 'Popularity scoring system'}
                </p>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="mt-16 text-center">
            <h2 className="text-2xl font-heading font-semibold text-concrete-900 dark:text-white mb-4">
              {language.code === 'th' ? 'ติดต่อเรา' : 'Contact Us'}
            </h2>
            <p className="text-concrete-600 dark:text-concrete-400 mb-6">
              {language.code === 'th' 
                ? 'หากมีคำถามเกี่ยวกับการใช้งานหรือข้อมูลทางกฎหมาย'
                : 'If you have questions about usage or legal information'
              }
            </p>
            <a 
              href="mailto:legal@trendsiam.com" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-accent-500 hover:bg-accent-600 text-white font-heading font-medium rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {language.code === 'th' ? 'ส่งอีเมล' : 'Send Email'}
            </a>
          </div>
        </div>
      </div>
    </Layout>
  )
}