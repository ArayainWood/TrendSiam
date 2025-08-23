// Internationalization system - replicating the get_text() function from Streamlit app

export type LanguageCode = 'th' | 'en'

export interface TranslationData {
  [key: string]: {
    th: string
    en: string
  }
}

export const translations: TranslationData = {
  // App branding
  app_title: {
    th: "🇹🇭 TrendSiam",
    en: "🇹🇭 TrendSiam"
  },
  app_subtitle: {
    th: "สรุปข่าวเทรนด์ไทยประจำวัน",
    en: "Thai Daily News Summary"
  },
  app_description: {
    th: "🚀 **TrendSiam** แสดงสรุปข่าวเทรนด์จากวิดีโอยูทูบไทยยอดนิยม ด้วยการสรุปอัตโนมัติด้วย AI ในภาษาไทยและอังกฤษ พร้อมระบบจัดหมวดหมู่อัตโนมัติครอบคลุม 8 หมวดหมู่",
    en: "🚀 **TrendSiam** displays trending news summaries from popular Thai YouTube videos with automatic AI summarization in both Thai and English languages, featuring comprehensive auto-classification across 8 categories"
  },

  // Navigation
  main_menu: {
    th: "📋 เมนูหลัก",
    en: "📋 Main Menu"
  },
  main_page: {
    th: "🏠 หน้าหลัก",
    en: "🏠 Main Page"
  },
  weekly_report: {
    th: "📊 รายงานสัปดาห์",
    en: "📊 Weekly Report"
  },
  terms_of_use: {
    th: "📋 ข้อกำหนดการใช้งาน",
    en: "📋 Terms of Use"
  },
  privacy_policy: {
    th: "🔒 นโยบายความเป็นส่วนตัว",
    en: "🔒 Privacy Policy"
  },
  select_page: {
    th: "เลือกหน้า:",
    en: "Select page:"
  },

  // Theme and language controls
  language_selector: {
    th: "🌐 ภาษา",
    en: "🌐 Language"
  },
  dark_theme: {
    th: "🌙 โหมดมืด",
    en: "🌙 Dark"
  },
  light_theme: {
    th: "☀️ โหมดสว่าง",
    en: "☀️ Light"
  },
  thai_option: {
    th: "🇹🇭 ไทย",
    en: "🇹🇭 Thai"
  },
  english_option: {
    th: "🇺🇸 English",
    en: "🇺🇸 English"
  },

  // Filters
  news_filters: {
    th: "🔍 ตัวกรองข่าว",
    en: "🔍 News Filters"
  },
  platform_filter: {
    th: "แพลตฟอร์ม",
    en: "Platform"
  },
  category_filter: {
    th: "หมวดหมู่",
    en: "Category"
  },
  category_filter_help: {
    th: "เลือกหมวดหมู่ข่าวที่ต้องการดู",
    en: "Select news category to view"
  },
  date_filter: {
    th: "วันที่",
    en: "Date"
  },
  search_placeholder: {
    th: "ค้นหาข่าว...",
    en: "Search news..."
  },
  all_option: {
    th: "ทั้งหมด",
    en: "All"
  },
  clear_filters: {
    th: "🔄 ล้างตัวกรอง",
    en: "🔄 Clear Filters"
  },

  // News content
  channel_label: {
    th: "ช่อง",
    en: "Channel"
  },
  category_label: {
    th: "หมวดหมู่",
    en: "Category"
  },
  views_label: {
    th: "การดู",
    en: "Views"
  },
  date_label: {
    th: "วันที่",
    en: "Date"
  },
  popularity_score: {
    th: "คะแนนความนิยม",
    en: "Popularity Score"
  },
  watch_on_youtube: {
    th: "ดูใน YouTube",
    en: "Watch on YouTube"
  },
  view_details_title: {
    th: "รายละเอียดการดู",
    en: "View Details"
  },
  no_title: {
    th: "ไม่มีชื่อ",
    en: "No Title"
  },
  no_summary: {
    th: "ไม่มีสรุป",
    en: "No Summary"
  },
  unknown: {
    th: "ไม่ทราบ",
    en: "Unknown"
  },

  // Stats and metrics
  found_news: {
    th: "พบข่าว {count} รายการ",
    en: "Found {count} news items"
  },
  footer_stats: {
    th: "แสดงข่าว {count} รายการ",
    en: "Showing {count} news items"
  },
  total_stories: {
    th: "ข่าวทั้งหมด",
    en: "Total Stories"
  },
  avg_views: {
    th: "การดูเฉลี่ย",
    en: "Avg Views"
  },
  categories_count: {
    th: "หมวดหมู่",
    en: "Categories"
  },
  top_score: {
    th: "คะแนนสูงสุด",
    en: "Top Score"
  },

  // Weekly report
  weekly_report_title: {
    th: "📊 รายงานสัปดาห์",
    en: "📊 Weekly Report"
  },
  weekly_report_subtitle: {
    th: "สรุปข่าวเทรนด์ไทยรายสัปดาห์",
    en: "Weekly Thai trending news summary"
  },
  weekly_report_period: {
    th: "ช่วงเวลา",
    en: "Period"
  },
  weekly_report_loading: {
    th: "กำลังโหลดข้อมูลรายงานสัปดาห์...",
    en: "Loading weekly report data..."
  },
  weekly_report_no_data: {
    th: "ไม่มีข้อมูลสำหรับรายงานสัปดาห์",
    en: "No data available for weekly report"
  },
  weekly_report_top_stories: {
    th: "ข่าวยอดนิยมของสัปดาห์",
    en: "Top Stories of the Week"
  },
  download_pdf: {
    th: "📄 ดาวน์โหลด PDF",
    en: "📄 Download PDF"
  },

  // Developer mode
  developer_mode: {
    th: "โหมดนักพัฒนา",
    en: "Developer Mode"
  },
  enable_dev_mode: {
    th: "🔓 เปิดโหมดนักพัฒนา",
    en: "🔓 Enable Developer Mode"
  },
  disable_dev_mode: {
    th: "🔒 ปิดโหมดนักพัฒนา",
    en: "🔒 Disable Developer Mode"
  },
  copy_ai_prompt: {
    th: "📋 คัดลอกคำสั่ง AI",
    en: "📋 Copy AI Prompt"
  },

  // Actions
  refresh: {
    th: "🔄 รีเฟรช",
    en: "🔄 Refresh"
  },
  loading: {
    th: "กำลังโหลด...",
    en: "Loading..."
  },
  error: {
    th: "เกิดข้อผิดพลาด",
    en: "Error"
  },
  try_again: {
    th: "ลองอีกครั้ง",
    en: "Try Again"
  },
  generate_images: {
    th: "🎨 สร้างภาพใหม่",
    en: "🎨 Generate Images"
  },
  refresh_data: {
    th: "🔄 อัปเดตข้อมูล",
    en: "🔄 Refresh Data"
  },

  // About section
  about_title: {
    th: "เกี่ยวกับ TrendSiam",
    en: "About TrendSiam"
  },
  about_description: {
    th: "แพลตฟอร์มรวบรวมและสรุปข่าวเทรนด์ไทยด้วยปัญญาประดิษฐ์",
    en: "AI-powered Thai trending news aggregation platform"
  },

  // Time periods
  today: {
    th: "วันนี้",
    en: "Today"
  },
  yesterday: {
    th: "เมื่อวาน",
    en: "Yesterday"
  },
  week: {
    th: "สัปดาห์ที่แล้ว",
    en: "Past Week"
  },
  month: {
    th: "เดือนที่แล้ว",
    en: "Past Month"
  },

  // Categories (matching auto_category values from backend)
  "บันเทิง (Entertainment)": {
    th: "บันเทิง",
    en: "Entertainment"
  },
  "ข่าว (News)": {
    th: "ข่าว",
    en: "News"
  },
  "กีฬา (Sports)": {
    th: "กีฬา",
    en: "Sports"
  },
  "เทคโนโลยี (Technology)": {
    th: "เทคโนโลยี",
    en: "Technology"
  },
  "การศึกษา (Education)": {
    th: "การศึกษา",
    en: "Education"
  },
  "ไลฟ์สไตล์ (Lifestyle)": {
    th: "ไลฟ์สไตล์",
    en: "Lifestyle"
  },
  "เกม (Gaming)": {
    th: "เกม",
    en: "Gaming"
  },
  "อื่นๆ (Others)": {
    th: "อื่นๆ",
    en: "Others"
  },

  // Tooltips
  category_count_tooltip: {
    th: "จำนวนข่าวในหมวดหมู่นี้",
    en: "Number of news items in this category"
  },
  category_score_tooltip: {
    th: "คะแนนความนิยมเฉลี่ยของหมวดหมู่",
    en: "Average popularity score for category"
  },
}

export function getText(key: string, lang: LanguageCode = 'th', params?: Record<string, string | number>): string {
  const translation = translations[key]
  if (!translation) {
    console.warn(`Translation missing for key: ${key}`)
    return key
  }

  let text = translation[lang] || translation.th || key

  // Replace parameters if provided
  if (params) {
    Object.entries(params).forEach(([param, value]) => {
      text = text.replace(`{${param}}`, String(value))
    })
  }

  return text
}

// Helper function to get all available categories
export function getCategories(lang: LanguageCode = 'th'): Array<{ value: string; label: string }> {
  const categories = [
    "บันเทิง (Entertainment)",
    "ข่าว (News)", 
    "กีฬา (Sports)",
    "เทคโนโลยี (Technology)",
    "การศึกษา (Education)",
    "ไลฟ์สไตล์ (Lifestyle)",
    "เกม (Gaming)",
    "อื่นๆ (Others)"
  ]

  return categories.map(category => ({
    value: category,
    label: getText(category, lang)
  }))
}

// Helper function to get date filter options
export function getDateFilters(lang: LanguageCode = 'th'): Array<{ value: string; label: string }> {
  const filters = ['all', 'today', 'yesterday', 'week', 'month']
  
  return filters.map(filter => ({
    value: filter,
    label: getText(filter === 'all' ? 'all_option' : filter, lang)
  }))
}