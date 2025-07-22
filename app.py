#!/usr/bin/env python3
"""
TrendSiam - Thai Daily News Summary Web App

A simple Streamlit application that displays summarized Thai trending news
from YouTube videos with AI-generated Thai summaries.
"""

import streamlit as st
import json
from pathlib import Path
from typing import List, Dict, Any, Set, Optional
from datetime import datetime
import re
import time
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Page configuration
st.set_page_config(
    page_title="TrendSiam - Thai Daily News Summary",
    page_icon="🇹🇭",
    layout="wide",
    initial_sidebar_state="collapsed"
)

def apply_dynamic_theme():
    """Apply dynamic theme CSS based on current session state"""
    # Initialize theme if not set
    if 'app_theme' not in st.session_state:
        st.session_state.app_theme = 'dark'
    
    # Dynamic theme variables
    is_dark = st.session_state.app_theme == 'dark'
    
    # Theme colors
    bg_primary = "#0f1419" if is_dark else "#ffffff"
    bg_secondary = "#1a1f2e" if is_dark else "#f8fafc"
    bg_card = "rgba(255,255,255,0.08)" if is_dark else "rgba(255,255,255,0.9)"
    bg_filter = "rgba(255,255,255,0.05)" if is_dark else "rgba(248,250,252,0.8)"
    text_primary = "#e1e8f0" if is_dark else "#1a202c"
    text_secondary = "#a0aec0" if is_dark else "#4a5568"
    border_color = "rgba(255,255,255,0.1)" if is_dark else "rgba(0,0,0,0.1)"
    accent_color = "#4299e1"
    
    # Filter-specific text colors (pure black/white as requested)
    filter_text_color = "#ffffff" if is_dark else "#000000"
    
    # Include illustration CSS
    illustration_css = get_illustration_style_css()
    
    st.markdown(f"""
    <style>
    {illustration_css}
    /* Import Google Fonts */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    
    /* Global Styles */
    .stApp {{
        font-family: 'Inter', sans-serif;
        background: linear-gradient(135deg, {bg_primary} 0%, {bg_secondary} 100%);
        color: {text_primary};
    }}
    
              /* Unified Header Layout */
     .unified-header {{
         background: {bg_card};
         backdrop-filter: blur(10px);
         border-bottom: 1px solid {border_color};
         margin-bottom: 0.25rem;
         box-shadow: 0 1px 4px rgba(0,0,0,{('0.08' if is_dark else '0.01')});
     }}
     
     .header-top {{
         display: flex;
         justify-content: flex-end;
         align-items: flex-start;
         padding: 0.3rem 1rem 0.1rem 1rem;
         min-height: auto;
     }}
     
     .header-controls {{
         display: flex;
         flex-direction: column;
         gap: 0.3rem;
         align-items: flex-end;
         min-width: 130px;
     }}
     
     .header-main {{
         text-align: center;
         padding: 0.2rem 1.5rem 0.6rem 1.5rem;
     }}
     
     .main-title {{
         font-size: 2rem;
         font-weight: 700;
         background: linear-gradient(45deg, {accent_color}, #805ad5);
         -webkit-background-clip: text;
         -webkit-text-fill-color: transparent;
         margin: 0 0 0.3rem 0;
         line-height: 1;
     }}
     
     .main-subtitle {{
         font-size: 0.9rem;
         color: {text_secondary};
         font-weight: 400;
         margin: 0;
         line-height: 1.2;
     }}
     
     .section-divider {{
         height: 1px;
         background: linear-gradient(90deg, transparent, {border_color}, transparent);
         margin: 1.5rem 0;
     }}
    
    /* Filter Section */
    .filter-container {{
        background: {bg_filter};
        backdrop-filter: blur(10px);
        border-radius: 12px;
        padding: 1.5rem;
        margin: 2rem 0;
        border: 1px solid {border_color};
        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    }}
    
    .filter-title {{
        font-size: 1.2rem;
        font-weight: 600;
        margin-bottom: 1rem;
        color: {text_primary};
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }}
    
    /* News Cards */
    .news-card {{
        background: {bg_card};
        backdrop-filter: blur(10px);
        border-radius: 16px;
        padding: 1.5rem;
        margin: 1.5rem 0;
        border: 1px solid {border_color};
        transition: all 0.3s ease;
        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }}
    
    .news-card:hover {{
        transform: translateY(-4px);
        box-shadow: 0 8px 30px rgba(0,0,0,0.15);
        border-color: {accent_color};
    }}
    
    .news-title {{
        font-size: 1.3rem;
        font-weight: 600;
        margin-bottom: 1rem;
        line-height: 1.4;
        color: {accent_color};
    }}
    
    .news-meta {{
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 1rem;
        padding: 1rem;
        background: rgba(255,255,255,0.03);
        border-radius: 8px;
    }}
    
    .news-meta-item {{
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.9rem;
        color: {text_secondary};
    }}
    
    .news-summary {{
        font-size: 1rem;
        line-height: 1.6;
        margin: 1rem 0;
        padding: 1rem;
        background: rgba(255,255,255,0.03);
        border-radius: 8px;
        border-left: 3px solid {accent_color};
        color: {text_primary};
    }}
    
    .category-badge {{
        background: rgba(66,153,225,0.2);
        color: {accent_color};
        padding: 0.3rem 0.8rem;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 500;
        border: 1px solid rgba(66,153,225,0.3);
        display: inline-block;
    }}
    
    .stats-badge {{
        background: linear-gradient(45deg, {accent_color}, #805ad5);
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 20px;
        font-weight: 500;
        display: inline-block;
        margin: 0.5rem 0;
    }}
    
         /* Mobile Responsiveness */
     @media (max-width: 768px) {{
         .unified-header {{
             margin-bottom: 0.2rem;
         }}
         
         .header-top {{
             flex-direction: column;
             gap: 0.25rem;
             padding: 0.2rem 0.75rem 0.1rem 0.75rem;
             align-items: center;
         }}
         
         .header-controls {{
             align-items: center;
             gap: 0.25rem;
             min-width: auto;
         }}
         
         .header-main {{
             padding: 0.2rem 1rem 0.4rem 1rem;
         }}
         
         .main-title {{
             font-size: 1.6rem;
             margin-bottom: 0.2rem;
             line-height: 1;
         }}
         
         .main-subtitle {{
             font-size: 0.85rem;
             line-height: 1.15;
         }}
         
         .stApp > div:first-child {{
             padding-top: 0.15rem;
         }}
         
         .block-container {{
             padding-top: 0.25rem;
         }}
         
         .news-card {{
             padding: 1rem;
             margin: 1rem 0;
         }}
         
         .news-meta {{
             grid-template-columns: 1fr;
             gap: 0.5rem;
         }}
         
         .filter-container {{
             padding: 1rem;
         }}
         
         .category-tooltip .tooltiptext {{
             width: 240px;
             margin-left: -120px;
         }}
         
         .section-divider {{
             margin: 1rem 0;
         }}
     }}
    
    /* Streamlit Component Styling */
    .stSelectbox > div > div {{
        background: {bg_card};
        border: 1px solid {border_color};
        border-radius: 8px;
    }}
    
    .stSelectbox > div > div > div {{
        color: {text_primary};
    }}
    
    /* Compact header controls */
    .header-controls .stSelectbox {{
        margin-bottom: 0.2rem;
    }}
    
    .header-controls .stRadio {{
        margin-top: 0;
        margin-bottom: 0;
    }}
    
    .header-controls .stSelectbox > div {{
        margin-bottom: 0;
    }}
    
    .header-controls .stRadio > div {{
        margin-top: 0;
        margin-bottom: 0;
    }}
    
    /* Global app spacing optimization */
    .stApp > div:first-child {{
        padding-top: 0.25rem;
    }}
    
    /* Reduce default Streamlit margins */
    .block-container {{
        padding-top: 0.5rem;
        padding-bottom: 0rem;
        max-width: 100%;
    }}
    
    /* Further reduce top spacing */
    .main .block-container {{
        padding-top: 0.25rem;
    }}
    
    /* Filter Labels and Dropdown Text Styling */
    .stSelectbox label {{
        color: {filter_text_color} !important;
    }}
    
    .stSelectbox div[data-testid="stMarkdownContainer"] p {{
        color: {filter_text_color} !important;
    }}
    
    .stSelectbox div[role="button"] {{
        color: {filter_text_color} !important;
    }}
    
    .stSelectbox div[role="button"] > div {{
        color: {filter_text_color} !important;
    }}
    
    /* Filter container title */
    .filter-title {{
        color: {filter_text_color} !important;
    }}
    
    /* Dropdown options styling */
    .stSelectbox div[data-baseweb="select"] {{
        color: {filter_text_color} !important;
    }}
    
    .stSelectbox div[data-baseweb="select"] > div {{
        color: {filter_text_color} !important;
    }}
    
    /* Success/Warning/Info Messages */
    .stSuccess {{
        background: rgba(72,187,120,0.1);
        border: 1px solid rgba(72,187,120,0.3);
        border-radius: 8px;
        color: {text_primary};
    }}
    
    .stWarning {{
        background: rgba(237,137,54,0.1);
        border: 1px solid rgba(237,137,54,0.3);
        border-radius: 8px;
        color: {text_primary};
    }}
    
    .stInfo {{
        background: rgba(66,153,225,0.1);
        border: 1px solid rgba(66,153,225,0.3);
        border-radius: 8px;
        color: {text_primary};
    }}
    
    /* Sidebar Styling */
    .css-1d391kg {{
        background: {bg_secondary};
    }}
    
         /* Prevent Google Translate interference */
     .notranslate {{
         translate: no;
     }}
     
     .language-controls .notranslate * {{
         translate: no !important;
     }}
     
     /* Improved Tooltip styling with better contrast */
     .category-tooltip {{
         position: relative;
         cursor: help;
         border-bottom: 1px dotted {text_secondary};
     }}
     
     .category-tooltip .tooltiptext {{
         visibility: hidden;
         width: 280px;
         background-color: {('#2d3748' if is_dark else '#f7fafc')};
         color: {('#ffffff' if is_dark else '#1a202c')};
         text-align: center;
         border-radius: 8px;
         padding: 10px;
         position: absolute;
         z-index: 1000;
         bottom: 125%;
         left: 50%;
         margin-left: -140px;
         opacity: 0;
         transition: opacity 0.3s;
         border: 1px solid {('#4a5568' if is_dark else '#cbd5e0')};
         font-size: 0.8rem;
         box-shadow: 0 8px 25px rgba(0,0,0,{('0.4' if is_dark else '0.15')});
         font-weight: 500;
     }}
     
     .category-tooltip:hover .tooltiptext {{
         visibility: visible;
         opacity: 1;
     }}
     
     /* Popularity Score Styling */
     .popularity-section {{
         margin-top: 1rem;
         padding: 0;
         background: none;
         border: none;
     }}
     
     .popularity-header {{
         display: flex;
         align-items: center;
         justify-content: space-between;
         margin-bottom: 0.75rem;
         flex-wrap: wrap;
         gap: 0.5rem;
         padding: 0;
     }}
     
     .popularity-score {{
         font-weight: 600;
         font-size: 1rem;
         color: #f39c12;
     }}
     
     .popularity-bar {{
         width: 100%;
         height: 8px;
         background: rgba(255,255,255,0.1);
         border-radius: 4px;
         overflow: hidden;
         margin-bottom: 0.75rem;
         margin-top: 0.25rem;
     }}
     
     .popularity-fill {{
         height: 100%;
         background: linear-gradient(90deg, #e74c3c 0%, #f39c12 50%, #27ae60 100%);
         border-radius: 4px;
         transition: width 0.3s ease;
     }}
     
     .popularity-reason {{
         font-size: 0.9rem;
         color: {text_secondary};
         font-style: italic;
         line-height: 1.3;
         margin-top: 0.5rem;
         padding: 0;
         background: none;
     }}
     
     /* Mobile responsive for popularity section */
     @media (max-width: 768px) {{
         .popularity-header {{
             flex-direction: column;
             align-items: flex-start;
             padding: 0;
             margin-bottom: 0.5rem;
         }}
         
         .popularity-score {{
             font-size: 0.9rem;
         }}
         
         .popularity-reason {{
             font-size: 0.8rem;
             margin-top: 0.25rem;
         }}
         
         .popularity-bar {{
             margin-bottom: 0.5rem;
         }}
     }}
     
     /* Hide Streamlit branding */
     .css-1kyxreq {{
         display: none;
     }}
     
     footer {{
         display: none;
     }}
     
     .stDeployButton {{
         display: none;
     }}
    </style>
    """, unsafe_allow_html=True)

def apply_radio_theme_css():
    """Apply theme-aware CSS for radio button labels"""
    # Use session state theme which is more reliable than st.get_option
    is_dark = st.session_state.get('app_theme', 'dark') == 'dark'
    
    # Set text color based on theme
    text_color = "#FFFFFF" if is_dark else "#000000"
    
    st.markdown(f"""
    <style>
    /* Target radio button labels specifically */
    .stRadio > div > div > label > div > span {{
        color: {text_color} !important;
    }}
    
    /* Alternative selector for different Streamlit versions */
    .stRadio label span {{
        color: {text_color} !important;
    }}
    
    /* Ensure radio button text is visible */
    .stRadio div[data-testid="stMarkdownContainer"] p {{
        color: {text_color} !important;
    }}
    </style>
    """, unsafe_allow_html=True)

# Comprehensive bilingual text dictionary
TEXT_DICT = {
    "th": {
        # Main navigation and headers
        "app_title": "TrendSiam",
        "app_subtitle": "📊 สรุปข่าวยอดนิยมประจำวันจากยูทูป",
        "app_description": """🚀 **TrendSiam** แสดงสรุปข่าวยอดนิยมในประเทศไทยจากวิดีโอยูทูปที่กำลังมาแรง 
ด้วยการสรุปอัตโนมัติจากปัญญาประดิษฐ์ในสองภาษา (ไทย/อังกฤษ) พร้อมระบบจำแนกหมวดหมู่อัตโนมัติที่ครอบคลุม 8 หมวด

🌐 **เปลี่ยนภาษาได้ทันที** • **สรุปข่าวโดย AI** • **จำแนกหมวดหมู่อัตโนมัติ**

🏀 กีฬา • 🕹️ เกม/อนิเมะ • 🏛️ การเมือง/ข่าว • 🎓 การศึกษา • 🌿 ไลฟ์สไตล์ • 🎵 บันเทิง • 💰 ธุรกิจ/การเงิน • ❤️ สุขภาพ""",
        
        # Navigation menu
        "main_menu": "📋 เมนูหลัก",
        "main_page": "🏠 หน้าหลัก",
        "terms_of_use": "📄 ข้อกำหนดการใช้งาน",
        "privacy_policy": "🔒 นโยบายความเป็นส่วนตัว",
        "select_page": "เลือกหน้า:",
        
        # Language and theme selector
        "language_selector": "🌐 ภาษา",
        "theme_selector": "🎨 ธีม",
        "thai_option": "🇹🇭 ไทย",
        "english_option": "🇺🇸 English",
        "dark_theme": "🌙 โหมดมืด",
        "light_theme": "☀️ โหมดสว่าง",
        
        # Filters
        "news_filters": "🔍 ตัวกรองข่าว",
        "platform_filter": "📱 แพลตฟอร์ม",
        "category_filter": "📂 หมวดหมู่", 
        "date_filter": "📅 วันที่เผยแพร่",
        "all_option": "ทั้งหมด",
        
        # Categories
        "sports": "🏀 กีฬา",
        "entertainment": "🎵 บันเทิง",
        "games_anime": "🕹️ เกม/อนิเมะ",
        "politics_news": "🏛️ การเมือง/ข่าวทั่วไป",
        "education": "🎓 การศึกษา",
        "lifestyle": "🌿 ไลฟ์สไตล์",
        "business_finance": "💰 ธุรกิจ/การเงิน",
        "health": "❤️ สุขภาพ",
        "others": "📦 อื่นๆ",
        "unknown": "❓ ไม่ระบุ",
        
        # News display
        "channel_label": "📺 ช่อง",
        "category_label": "🏷️ หมวด",
        "views_label": "👀 ยอดชม",
        "date_label": "📅 วันที่",
        "no_title": "ไม่มีหัวข้อ",
        "no_summary": "ไม่มีสรุป",
        "summary_failed": "⚠️ ไม่สามารถสร้างสรุปข่าวได้",
        "category_score_tooltip": "พบข่าวที่เกี่ยวกับหัวข้อนี้ในช่วง 3 วันล่าสุด (จากการวิเคราะห์หัวข้อ, แฮชแท็ก, ช่อง, และสรุป)",
        
        # Status messages
        "loading_news": "🔄 กำลังโหลดข้อมูลข่าวและจำแนกหมวดหมู่...",
        "found_news": "✅ พบข่าวทั้งหมด {count} ข่าว",
        "filtered_news": "🔍 พบข่าวที่ตรงกับตัวกรอง {filtered} ข่าว จากทั้งหมด {total} ข่าว",
        "no_filtered_news": "🔍 ไม่พบข่าวที่ตรงกับตัวกรองที่เลือก",
        "try_different_filter": "💡 ลองเปลี่ยนตัวกรองหรือเลือก 'ทั้งหมด' เพื่อดูข่าวทั้งหมด",
        "no_news_data": "📭 ไม่มีข้อมูลข่าวให้แสดง",
        "data_not_found": "📄 ไม่พบไฟล์ข้อมูล: {file}",
        "run_summarizer": "💡 กรุณาเรียกใช้ `python summarize_all.py` เพื่อสร้างข้อมูลสรุปข่าวก่อน",
        "invalid_data_format": "❌ รูปแบบข้อมูลไม่ถูกต้อง: ต้องการ Array ของข้อมูลข่าว",
        "json_error": "❌ ไม่สามารถอ่านไฟล์ JSON ได้: {error}",
        "general_error": "❌ เกิดข้อผิดพลาด: {error}",
        
        # Footer
        "footer_stats": "📊 แสดงข่าว {count} ข่าว • อัปเดตล่าสุด: วันนี้ • ระบบจำแนกหมวดหมู่อัตโนมัติ 8 หมวด",
        
        # Data preparation
        "data_prep_title": "**📋 วิธีการเตรียมข้อมูล:**",
        "data_prep_step1": "1. เรียกใช้ `python youtube_api_fetcher.py` เพื่อดาวน์โหลดข้อมูลวิดีโอ",
        "data_prep_step2": "2. เรียกใช้ `python summarize_all.py` เพื่อสร้างสรุปข่าวภาษาไทย",
        "data_prep_step3": "3. รีเฟรชหน้าเว็บนี้",
        
        # About section
        "about_title": "ℹ️ เกี่ยวกับ",
        "about_description": """🤖 **TrendSiam** เป็นเครื่องมือสรุปข่าวอัตโนมัติ
ที่ใช้ AI ในการวิเคราะห์และจำแนกข่าวสาร
จากวิดีโอยูทูปยอดนิยมในประเทศไทย

⚡ **เทคโนโลยี:** OpenAI GPT-3.5 Turbo  
📊 **หมวดหมู่:** 8 หมวดหมู่อัตโนมัติ  
🔓 **ข้อมูล:** สาธารณะจาก YouTube""",
        
        # Terms of Use
        "terms_title": "📄 ข้อกำหนดการใช้งาน",
        "terms": """
## 🎯 การใช้งานบริการ

**TrendSiam** เป็นบริการสรุปข่าวอัตโนมัติที่จัดทำขึ้นเพื่อการศึกษาและให้ข้อมูลข่าวสารแก่ผู้ใช้ โดยมีข้อกำหนดการใช้งานดังนี้:

## 📊 ลักษณะของบริการ

- **ข้อมูลสาธารณะ**: เว็บไซต์นี้แสดงเฉพาะข้อมูลที่เปิดเผยต่อสาธารณะจากแพลตฟอร์ม YouTube เท่านั้น
- **การสรุปด้วย AI**: ใช้เทคโนโลยี OpenAI GPT-3.5 Turbo ในการสร้างสรุปข่าวเป็นภาษาไทย
- **ไม่มีบัญชีผู้ใช้**: บริการนี้ไม่ต้องการการสมัครสมาชิกหรือการเก็บข้อมูลส่วนบุคคลของผู้ใช้

## 🔗 เนื้อหาและลิขสิทธิ์

- **ไม่เก็บสื่อ**: เราไม่ได้โฮสต์วิดีโอ ภาพ หรือสื่ออื่นใดที่มีลิขสิทธิ์
- **เฉพาะลิงก์และสรุป**: แสดงเฉพาะข้อมูลเมตาดาต้า (ชื่อเรื่อง, ช่อง, วันที่) และสรุปที่สร้างโดย AI
- **การอ้างอิง**: ข้อมูลทั้งหมดอ้างอิงจากแหล่งเผยแพร่ต้นฉบับบน YouTube

## ⚖️ ความรับผิดชอบ

- **ข้อมูลตามสภาพจริง**: เนื้อหาแสดงตามสภาพที่เป็นจริง ณ เวลาที่เก็บข้อมูล
- **ความแม่นยำ**: ไม่รับประกันความถูกต้องแม่นยำ 100% ของการสรุปโดย AI
- **การใช้งาน**: ผู้ใช้ควรใช้วิจารณญาณในการพิจารณาข้อมูลและตรวจสอบจากแหล่งต้นฉบับ

## 🚫 ข้อจำกัดการใช้งาน

- ห้ามใช้บริการเพื่อวัตถุประสงค์ผิดกฎหมายหรือไม่เหมาะสม
- ห้ามทำลายหรือรบกวนการทำงานของระบบ
- ห้ามคัดลอกเนื้อหาทั้งหมดเพื่อการค้าโดยไม่ได้รับอนุญาต

## 📞 การติดต่อ

หากมีข้อสงสัยเกี่ยวกับข้อกำหนดการใช้งาน กรุณาติดต่อผ่าน GitHub Repository ของโครงการ

---

*ข้อกำหนดนี้อาจมีการปรับปรุงเป็นครั้งคราวเพื่อให้สอดคล้องกับกฎหมายและนโยบายที่เกี่ยวข้อง*
""",
        
        # Privacy Policy  
        "privacy_title": "🔒 นโยบายความเป็นส่วนตัว",
        "privacy": """
## 🛡️ การคุ้มครองข้อมูลส่วนบุคคล

**TrendSiam** ให้ความสำคัญกับความเป็นส่วนตัวและการคุ้มครองข้อมูลส่วนบุคคลของผู้ใช้ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA) และมาตรฐานสากล GDPR

## 📋 ข้อมูลที่เราเก็บรวบรวม

**เราไม่เก็บข้อมูลส่วนบุคคลใดๆ ของผู้ใช้** เนื่องจาก:

- **ไม่มีระบบบัญชีผู้ใช้**: ไม่ต้องการการสมัครสมาชิก ล็อกอิน หรือข้อมูลส่วนตัว
- **ไม่มี Cookies ติดตาม**: ไม่ใช้ระบบติดตามพฤติกรรมผู้ใช้
- **การเข้าถึงแบบอ่านอย่างเดียว**: ผู้ใช้เพียงดูข้อมูลที่แสดงบนหน้าเว็บ

## 🌐 ข้อมูลสาธารณะที่ประมวลผล

เราประมวลผลเฉพาะ**ข้อมูลสาธารณะ**จาก YouTube ที่เผยแพร่โดยเจ้าของเนื้อหา ได้แก่:

- **ข้อมูลเมตาดาต้า**: ชื่อวิดีโอ, ช่อง, วันที่เผยแพร่, จำนวนการดู
- **คำอธิบายสาธารณะ**: เนื้อหาที่เจ้าของช่องเผยแพร่สู่สาธารณะ
- **การสรุปโดย AI**: ใช้ OpenAI GPT-3.5 Turbo สร้างสรุปเนื้อหาเป็นภาษาไทย

## 🤖 การใช้งานปัญญาประดิษฐ์

- **วัตถุประสงค์**: ใช้ AI เพื่อสรุปเนื้อหาข่าวสาธารณะเป็นภาษาไทยเท่านั้น
- **ขอบเขต**: ไม่ส่งข้อมูลส่วนบุคคลของผู้ใช้ให้กับ AI
- **ความปลอดภัย**: ข้อมูลที่ส่งไปประมวลผลเป็นเนื้อหาสาธารณะเท่านั้น

## 💾 การจัดเก็บและความปลอดภัย

- **ข้อมูลท้องถิ่น**: ข้อมูลสรุปจัดเก็บในไฟล์ JSON บนเซิร์ฟเวอร์
- **ไม่มีฐานข้อมูลผู้ใช้**: ไม่มีการจัดเก็บข้อมูลส่วนบุคคลใดๆ
- **การเข้าถึง**: เฉพาะผู้ดูแลระบบที่มีสิทธิ์เข้าถึงไฟล์ข้อมูล

## 🔄 การแบ่งปันข้อมูล

- **ไม่มีการขาย**: เราไม่ขายหรือให้เช่าข้อมูลใดๆ กับบุคคลที่สาม
- **ไม่มีการติดตาม**: ไม่แบ่งปันข้อมูลการใช้งานกับบริษัทภายนอก
- **ข้อมูลสาธารณะ**: เนื้อหาที่แสดงเป็นข้อมูลสาธารณะที่ทุกคนเข้าถึงได้

## ⚡ การลบข้อมูล

หากเจ้าของเนื้อหาต้องการให้ลบข้อมูลสรุปของตน:

- ติดต่อผ่าน GitHub Repository ของโครงการ
- ระบุ URL วิดีโอที่ต้องการลบ
- เราจะดำเนินการลบภายใน 7 วันทำการ

## 🌍 การปฏิบัติตามกฎหมาย

นโยบายนี้สอดคล้องกับ:

- **พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)**
- **General Data Protection Regulation (GDPR)**
- **หลักการความโปร่งใสและพึงพาสิทธิ์ของผู้ใช้**

## 📝 การเปลี่ยนแปลงนโยบาย

- นโยบายอาจมีการปรับปรุงเพื่อให้สอดคล้องกับกฎหมายใหม่
- การเปลี่ยนแปลงจะแจ้งให้ทราบผ่านหน้าเว็บไซต์นี้
- ผู้ใช้สามารถตรวจสอบนโยบายล่าสุดได้ตลอดเวลา

## 📞 การติดต่อเกี่ยวกับความเป็นส่วนตัว

หากมีข้อสงสัยเกี่ยวกับนโยบายความเป็นส่วนตัว กรุณาติดต่อผ่าน GitHub Repository ของโครงการ

---

*นโยบายนี้มีผลบังคับใช้ตั้งแต่วันที่เริ่มให้บริการและปรับปรุงล่าสุดเมื่อ พ.ศ. 2568*
"""
    },
    "en": {
        # Main navigation and headers
        "app_title": "TrendSiam",
        "app_subtitle": "📊 AI-Powered Daily Trending News Summary from YouTube",
        "app_description": """🚀 **TrendSiam** displays trending news summaries from popular Thai YouTube videos 
with automatic AI summarization in both Thai and English languages, featuring comprehensive auto-classification across 8 categories

🌐 **Instant Language Switching** • **AI-Powered Summaries** • **Auto Classification**

🏀 Sports • 🕹️ Games/Anime • 🏛️ Politics/News • 🎓 Education • 🌿 Lifestyle • 🎵 Entertainment • 💰 Business/Finance • ❤️ Health""",
        
        # Navigation menu
        "main_menu": "📋 Main Menu",
        "main_page": "🏠 Main Page",
        "terms_of_use": "📄 Terms of Use",
        "privacy_policy": "🔒 Privacy Policy",
        "select_page": "Select page:",
        
        # Language and theme selector
        "language_selector": "🌐 Language",
        "theme_selector": "🎨 Theme",
        "thai_option": "🇹🇭 Thai",
        "english_option": "🇺🇸 English",
        "dark_theme": "🌙 Dark Mode",
        "light_theme": "☀️ Light Mode",
        
        # Filters
        "news_filters": "🔍 News Filters",
        "platform_filter": "📱 Platform",
        "category_filter": "📂 Category",
        "date_filter": "📅 Published Date",
        "all_option": "All",
        
        # Categories
        "sports": "🏀 Sports",
        "entertainment": "🎵 Entertainment",
        "games_anime": "🕹️ Games/Anime",
        "politics_news": "🏛️ Politics/General News",
        "education": "🎓 Education",
        "lifestyle": "🌿 Lifestyle",
        "business_finance": "💰 Business/Finance",
        "health": "❤️ Health",
        "others": "📦 Others",
        "unknown": "❓ Unknown",
        
        # News display
        "channel_label": "📺 Channel",
        "category_label": "🏷️ Category",
        "views_label": "👀 Views",
        "date_label": "📅 Date",
        "no_title": "No title",
        "no_summary": "No summary",
        "summary_failed": "⚠️ Failed to generate news summary",
        "category_score_tooltip": "News related to this topic found in the last 3 days (analyzed from title, hashtags, channel, and summary)",
        
        # Status messages
        "loading_news": "🔄 Loading news data and category classification...",
        "found_news": "✅ Found {count} news items total",
        "filtered_news": "🔍 Found {filtered} news items matching filters out of {total} total",
        "no_filtered_news": "🔍 No news found matching selected filters",
        "try_different_filter": "💡 Try changing filters or select 'All' to view all news",
        "no_news_data": "📭 No news data available",
        "data_not_found": "📄 Data file not found: {file}",
        "run_summarizer": "💡 Please run `python summarize_all.py` to generate news summary data first",
        "invalid_data_format": "❌ Invalid data format: requires Array of news data",
        "json_error": "❌ Cannot read JSON file: {error}",
        "general_error": "❌ An error occurred: {error}",
        
        # Footer
        "footer_stats": "📊 Showing {count} news items • Last updated: Today • 8 Auto-classification Categories",
        
        # Data preparation
        "data_prep_title": "**📋 Data Preparation Steps:**",
        "data_prep_step1": "1. Run `python youtube_api_fetcher.py` to download video data",
        "data_prep_step2": "2. Run `python summarize_all.py` to generate Thai news summaries",
        "data_prep_step3": "3. Refresh this web page",
        
        # About section
        "about_title": "ℹ️ About",
        "about_description": """🤖 **TrendSiam** is an automated news summarization tool
that uses AI to analyze and categorize news
from trending YouTube videos in Thailand

⚡ **Technology:** OpenAI GPT-3.5 Turbo  
📊 **Categories:** 8 Auto Categories  
🔓 **Data:** Public from YouTube""",
        
        # Terms of Use
        "terms_title": "📄 Terms of Use",
        "terms": """
## 🎯 Service Usage

**TrendSiam** is an automated news summarization service designed for educational purposes and to provide news information to users, with the following terms of use:

## 📊 Service Characteristics

- **Public Data**: This website displays only publicly available information from the YouTube platform
- **AI Summarization**: Uses OpenAI GPT-3.5 Turbo technology to generate Thai language news summaries
- **No User Accounts**: This service does not require registration or collection of personal user data

## 🔗 Content and Copyright

- **No Media Hosting**: We do not host videos, images, or any other copyrighted media
- **Links and Summaries Only**: We display only metadata (titles, channels, dates) and AI-generated summaries
- **Attribution**: All information references original sources published on YouTube

## ⚖️ Responsibilities

- **As-Is Information**: Content is displayed as it appears at the time of data collection
- **Accuracy**: We do not guarantee 100% accuracy of AI-generated summaries
- **Usage**: Users should exercise judgment when considering information and verify from original sources

## 🚫 Usage Restrictions

- Prohibited use of the service for illegal or inappropriate purposes
- Prohibited destruction or interference with system operations
- Prohibited copying of all content for commercial purposes without permission

## 📞 Contact Information

If you have any questions about these terms of use, please contact us through the project's GitHub Repository.

---

*These terms may be updated periodically to comply with relevant laws and policies.*
""",
        
        # Privacy Policy
        "privacy_title": "🔒 Privacy Policy",
        "privacy": """
## 🛡️ Personal Data Protection

**TrendSiam** prioritizes user privacy and personal data protection in accordance with the Personal Data Protection Act B.E. 2562 (PDPA) and international GDPR standards.

## 📋 Data We Collect

**We do not collect any personal data from users** because:

- **No User Account System**: No registration, login, or personal information required
- **No Tracking Cookies**: We do not use user behavior tracking systems
- **Read-Only Access**: Users simply view information displayed on the website

## 🌐 Public Data Processing

We process only **public data** from YouTube published by content owners, including:

- **Metadata**: Video titles, channels, publication dates, view counts
- **Public Descriptions**: Content published publicly by channel owners
- **AI Summarization**: Using OpenAI GPT-3.5 Turbo to generate Thai language content summaries

## 🤖 Artificial Intelligence Usage

- **Purpose**: AI is used only to summarize public news content in Thai language
- **Scope**: No user personal data is sent to AI systems
- **Security**: Only public content data is sent for processing

## 💾 Storage and Security

- **Local Data**: Summary data is stored in JSON files on the server
- **No User Database**: No personal data storage whatsoever
- **Access Control**: Only authorized system administrators can access data files

## 🔄 Data Sharing

- **No Sales**: We do not sell or rent any data to third parties
- **No Tracking**: We do not share usage data with external companies
- **Public Data**: Displayed content is public data accessible to everyone

## ⚡ Data Deletion

If content owners want their summary data removed:

- Contact us through the project's GitHub Repository
- Specify the video URL to be removed
- We will process deletion within 7 business days

## 🌍 Legal Compliance

This policy complies with:

- **Personal Data Protection Act B.E. 2562 (PDPA)**
- **General Data Protection Regulation (GDPR)**
- **Principles of transparency and user accountability**

## 📝 Policy Changes

- Policies may be updated to comply with new regulations
- Changes will be announced through this website
- Users can check the latest policy at any time

## 📞 Privacy Contact Information

If you have any questions about this privacy policy, please contact us through the project's GitHub Repository.

---

*This policy is effective from the service launch date and was last updated in 2025.*
"""
    }
}

# Enhanced multi-signal categorization keywords for improved accuracy
CATEGORY_KEYWORDS = {
    "กีฬา (Sports)": {
        "title": ["ไทย พบ", "vs", "ปะทะ", "แมตช์", "ทีมชาติ", "ลิเวอร์พูล", "เชลซี", "แมนยู", "บาร์ซา", "ชิงแชมป์", "วอลเลย์บอล", "ฟุตบอล", "มวย", "วิ่ง", "ว่ายน้ำ", "live", "fifa", "vnl", "ucl", "premier league", "บอล", "โอลิมปิก", "olympic", "บาสเก็ตบอล", "basketball", "เทนนิส", "tennis", "แบดมินตัน", "badminton"],
        "channel": ["volleyball world", "dazn", "fifa", "espn", "fox sports", "true sport", "วาทะลูกหนัง", "เชฟ ปรุงบอล", "monomax sports", "football", "volleyball", "sport", "match", "tournament", "บอล", "กีฬา", "sports", "olympics", "โอลิมปิก"],
        "hashtags": ["#ฟุตบอล", "#volleyball", "#football", "#fifa", "#ucl", "#premierleague", "#laliga", "#วอลเลย์บอล", "#ทีมชาติไทย", "#มวยไทย", "#muaythai", "#boxing", "#basketball", "#tennis", "#vnl", "#บอล", "#โอลิมปิก", "#olympics", "#บาสเก็ตบอล", "#เทนนิส", "#แบดมินตัน", "#badminton"],
        "summary": ["กีฬา", "วอลเลย์บอล", "ฟุตบอล", "แข่ง", "นักกีฬา", "ชิงแชมป์", "volleyball", "football", "match", "live match", "tournament", "sports", "แชมป์", "ทีม", "นัด", "สนาม", "ลูกหนัง", "แมตช์", "ประตู", "สโมสร", "โค้ช", "ผู้จัดการทีม", "ยิงประตู", "ลีก", "บอล", "vnl", "โอลิมปิก", "olympics", "มวย", "boxing", "บาสเก็ตบอล", "basketball"]
    },
    "เกม/อนิเมะ (Games/Anime)": {
        "title": ["minecraft", "roblox", "pubg", "rov", "free fire", "gta", "fortnite", "among us", "mobile legends", "steam", "playstation", "xbox", "เกม", "ไลฟ์สด", "stream", "anime", "อนิเมะ", "มังงะ", "manga", "gachiakuta", "พากย์ไทย", "ตอนที่"],
        "channel": ["kyoro danger", "zbing z.", "patiphan", "pruksa", "gaming", "esport", "e-sport", "playstation", "เกม", "เกมมิ่ง", "streamer", "gamer", "xbox", "nintendo", "steam", "วาไรตี้เกมมิ่ง", "เกมไทย", "ani-one thailand", "ani-one", "crunchyroll", "อนิเมะ"],
        "hashtags": ["#minecraft", "#roblox", "#pubg", "#rov", "#freefire", "#gaming", "#gamer", "#stream", "#esports", "#เกม", "#เกมไทย", "#เกมมือถือ", "#pc", "#playstation", "#xbox", "#nintendo", "#steam", "#twitch", "#anime", "#อนิเมะ", "#manga", "#มังงะ"],
        "summary": ["เกม", "เกมใหม่", "อีสปอร์ต", "แข่งเกม", "เกมมือถือ", "e-sport", "playstation", "pubg", "rov", "minecraft", "streamer", "gamer", "รีวิวเกม", "เล่นเกม", "ไลฟ์สด", "tutorial", "วิธีเล่น", "เทคนิค", "อนิเมะ", "anime", "มังงะ", "manga", "ตอนใหม่", "พากย์ไทย", "ซับไทย"]
    },
    "การเมือง/ข่าวทั่วไป (Politics/General News)": {
        "title": ["นายกรัฐมนตรี", "รัฐบาล", "พรรค", "เลือกตั้ง", "รัฐสภา", "รัฐมนตรี", "ประยุทธ์", "เพื่อไทย", "ก้าวไกล", "ประชาธิปัตย์", "ม็อบ", "ผู้ว่า", "การเมือง", "ข่าว", "breaking", "headline", "ด่วน", "thainews", "ผู้ว่าฯ", "ประกาศ", "แถลง", "รายงาน", "เหตุการณ์", "วิกฤต", "ฉุกเฉิน"],
        "channel": ["politics", "government", "การเมือง", "รัฐบาล", "parliament", "ข่าวการเมือง", "สำนักข่าว", "news", "ประชาไท", "มติชน", "ไทยรัฐ", "กรุงเทพธุรกิจ", "ไทยรัฐทีวี", "ช่อง3", "ช่อง7", "workpoint news", "tnn24", "nation tv", "spring news", "thairath", "matichon", "khaosod"],
        "hashtags": ["#การเมือง", "#รัฐบาล", "#เลือกตั้ง", "#พรรคการเมือง", "#รัฐสภา", "#politics", "#government", "#election", "#protest", "#ม็อบ", "#ประชาธิปไตย", "#democracy", "#ข่าว", "#ด่วน", "#breaking", "#news", "#เหตุการณ์", "#รายงาน", "#ไทยรัฐ", "#แถลงข่าว", "#ประกาศ", "#เตือนภัย"],
        "summary": ["การเมือง", "นายก", "รัฐมนตรี", "พรรค", "รัฐสภา", "เลือกตั้ง", "ม็อบ", "ข่าวรัฐบาล", "election", "prime minister", "protest", "government", "parliament", "politics", "นโยบาย", "กฎหมาย", "รัฐธรรมนูญ", "ข่าว", "ด่วน", "เหตุการณ์", "แถลง", "รายงาน", "breaking news", "headline", "urgent", "news update"]
    },
    "การศึกษา (Education)": {
        "title": ["เรียน", "สอบ", "ติว", "โรงเรียน", "มหาวิทยาลัย", "ปริญญา", "การศึกษา", "นักเรียน", "ครู", "เทอม", "คะแนน", "วิชา", "บทเรียน", "tutorial"],
        "channel": ["education", "school", "university", "การศึกษา", "โรงเรียน", "student", "teacher", "ติวเตอร์", "สอนพิเศษ", "online learning", "khan academy", "ted-ed", "coursera"],
        "hashtags": ["#การศึกษา", "#เรียน", "#สอบ", "#ติว", "#โรงเรียน", "#มหาวิทยาลัย", "#education", "#study", "#exam", "#student", "#teacher", "#learning", "#university", "#school"],
        "summary": ["เรียน", "การศึกษา", "โรงเรียน", "สอบ", "ติว", "ครู", "เกรด", "นักเรียน", "มหาวิทยาลัย", "exam", "education", "study", "university", "school", "student", "teacher", "gpa", "ปริญญา", "วิชา", "คณะ", "แผนการเรียน"]
    },
    "ไลฟ์สไตล์ (Lifestyle)": {
        "title": ["vlog", "ท่องเที่ยว", "เที่ยว", "กิน", "อาหาร", "ร้านอาหาร", "cafe", "แฟชั่น", "แต่งตัว", "ทริป", "รีวิว", "shopping", "beauty", "makeup", "skincare", "ของกิน", "ร้าน", "เมนู", "คาเฟ่", "ลิปสติก", "ผิวพรรณ", "แต่งบ้าน"],
        "channel": ["vlog", "lifestyle", "travel", "fashion", "ไลฟ์สไตล์", "ท่องเที่ยว", "foodie", "food", "beauty", "makeup", "skincare", "blogger", "influencer", "reviewer", "แม่ปูเป้", "เจนนี่", "พีชญา", "food review", "cafe review", "restaurant"],
        "hashtags": ["#vlog", "#lifestyle", "#ไลฟ์สไตล์", "#ท่องเที่ยว", "#travel", "#food", "#อาหาร", "#fashion", "#แฟชั่น", "#beauty", "#makeup", "#skincare", "#cafe", "#restaurant", "#shopping", "#ootd", "#กิน", "#ของกิน", "#ร้าน", "#เมนู", "#คาเฟ่", "#รีวิว", "#foodie"],
        "summary": ["ท่องเที่ยว", "ไลฟ์สไตล์", "แฟชั่น", "กิน", "เที่ยว", "แต่งตัว", "ทริป", "travel", "lifestyle", "fashion", "trip", "vlog", "foodie", "cafe", "outfit", "รีวิว", "ของใช้", "ความงาม", "แต่งหน้า", "ของกิน", "อาหาร", "ร้าน", "เมนู", "คาเฟ่", "ร้านอาหาร", "อร่อย", "ทิปแต่งหน้า"]
    },
    "บันเทิง (Entertainment)": {
        "title": ["mv", "music video", "official", "teaser", "trailer", "ละคร", "ซีรีส์", "concert", "blackpink", "bts", "nct", "twice", "เพลงใหม่", "ดารา", "ศิลปิน", "คอนเสิร์ต", "brainrot", "meme", "funny", "comedy", "beatbox", "tiktok", "viral", "shorts", "ไวรัล", "dance", "ชาเลนจ์", "challenge", "trend", "เทรนด์"],
        "channel": ["blackpink", "yg entertainment", "sm entertainment", "jyp entertainment", "gmmtv", "ch3thailand", "workpoint", "thairath tv", "music", "entertainment", "เพลง", "บันเทิง", "concert", "idol", "ช่อง3", "ช่อง7", "gmm25", "lucr4zy", "beatboxjcop", "tiktoker", "influencer", "youtuber"],
        "hashtags": ["#mv", "#musicvideo", "#เพลงใหม่", "#ดารา", "#ละคร", "#ซีรีส์", "#concert", "#คอนเสิร์ต", "#blackpink", "#bts", "#kpop", "#tpop", "#entertainment", "#บันเทิง", "#official", "#trailer", "#shorts", "#beatbox", "#tiktok", "#funny", "#meme", "#viral", "#ไวรัล", "#dance", "#ชาเลนจ์", "#challenge", "#trend", "#เทรนด์"],
        "summary": ["ดารา", "ละคร", "เพลง", "ตลก", "รายการ", "ซีรีส์", "โชว์", "music video", "mv", "entertainment", "comedy", "series", "concert", "official trailer", "idol", "ศิลปิน", "คอนเสิร์ต", "ภาพยนตร์", "หนัง", "นักแสดง", "ผู้กำกับ", "beatbox", "สมบูรณ์แบบ", "ในรูปแบบสั้น", "ไวรัล", "viral", "dance", "เต้น", "ชาเลนจ์", "challenge", "เทรนด์", "trend"]
    },

    "ธุรกิจ / การเงิน (Business / Finance)": {
        "title": ["หุ้น", "ลงทุน", "เศรษฐกิจ", "ธุรกิจ", "การเงิน", "แบงก์", "ธนาคาร", "bitcoin", "crypto", "ตลาดหุ้น", "forex", "trading", "investment", "startup", "ipo"],
        "channel": ["business", "finance", "bank", "ธุรกิจ", "การเงิน", "investment", "market", "bloomberg", "cnbc", "reuters", "กรุงเทพธุรกิจ", "เนชั่น", "ข่าวเศรษฐกิจ", "money channel"],
        "hashtags": ["#หุ้น", "#ลงทุน", "#เศรษฐกิจ", "#ธุรกิจ", "#การเงิน", "#bitcoin", "#crypto", "#trading", "#investment", "#finance", "#business", "#economy", "#stock", "#market", "#startup"],
        "summary": ["หุ้น", "ลงทุน", "เศรษฐกิจ", "ตลาด", "การเงิน", "แบงก์", "ธนาคาร", "ธุรกิจ", "investment", "finance", "stock", "economy", "bank", "market", "crypto", "ตลาดหลักทรัพย์", "เงินเฟ้อ", "หนี้", "ภาษี", "กำไร", "ขาดทุน"]
    },
    "สุขภาพ (Health)": {
        "title": ["สุขภาพ", "ออกกำลังกาย", "โยคะ", "วิ่ง", "gym", "fitness", "diet", "ลดน้ำหนัก", "อาหารเสริม", "วิตามิน", "โควิด", "วัคซีน", "โรค", "รักษา", "แพทย์", "คลินิก", "โรงพยาบาล", "หมอ", "การออกกำลังกาย", "สุขภาพดี"],
        "channel": ["health", "medical", "hospital", "สุขภาพ", "แพทย์", "doctor", "gym", "fitness", "yoga", "wellness", "โรงพยาบาล", "คลินิก", "หมอ", "พยาบาล", "เวชกรรม", "clinic", "hospital", "medical center"],
        "hashtags": ["#สุขภาพ", "#health", "#fitness", "#gym", "#diet", "#workout", "#yoga", "#wellness", "#medical", "#โควิด", "#covid", "#vaccine", "#วัคซีน", "#โรค", "#แพทย์", "#doctor", "#คลินิก", "#โรงพยาบาล", "#ออกกำลังกาย", "#วิตามิน"],
        "summary": ["สุขภาพ", "ออกกำลังกาย", "โรค", "โควิด", "รักษา", "แพทย์", "ยา", "health", "covid", "doctor", "vaccine", "disease", "gym", "workout", "medicine", "โรงพยาบาล", "วัคซีน", "อาหารเสริม", "ลดน้ำหนัก", "ฟิตเนส", "คลินิก", "วิตามิน", "การรักษา", "สุขภาพดี", "โภชนาการ"]
    }
}


import re

# Category hierarchy mapping
CATEGORY_HIERARCHY = {
    "กีฬา (Sports)": {
        "parent": None,
        "display_name": "กีฬา (Sports)"
    },
    "เกม/อนิเมะ (Games/Anime)": {
        "parent": "บันเทิง (Entertainment)",
        "display_name": "เกม/อนิเมะ (Games/Anime)"
    },
    "การเมือง/ข่าวทั่วไป (Politics/General News)": {
        "parent": None,
        "display_name": "การเมือง/ข่าวทั่วไป (Politics/General News)"
    },
    "การศึกษา (Education)": {
        "parent": None,
        "display_name": "การศึกษา (Education)"
    },
    "ไลฟ์สไตล์ (Lifestyle)": {
        "parent": None,
        "display_name": "ไลฟ์สไตล์ (Lifestyle)"
    },
    "บันเทิง (Entertainment)": {
        "parent": None,
        "display_name": "บันเทิง (Entertainment)"
    },
    "ธุรกิจ / การเงิน (Business / Finance)": {
        "parent": None,
        "display_name": "ธุรกิจ / การเงิน (Business / Finance)"
    },
    "สุขภาพ (Health)": {
        "parent": None,
        "display_name": "สุขภาพ (Health)"
    },
    "อื่นๆ (Others)": {
        "parent": None,
        "display_name": "อื่นๆ (Others)"
    },
    "ไม่ระบุ (Unknown)": {
        "parent": None,
        "display_name": "ไม่ระบุ (Unknown)"
    }
}


def get_text(key: str, lang_code: Optional[str] = None) -> str:
    """
    Get localized text based on current language setting.
    
    Args:
        key: Text key to retrieve
        lang_code: Language code ('th' or 'en'). If None, uses session state.
        
    Returns:
        Localized text string
    """
    # Ensure lang_code is always a string
    effective_lang_code: str = lang_code if lang_code is not None else st.session_state.get('app_language', 'th') or 'th'
    
    # Ensure we always return a string
    lang_dict = TEXT_DICT.get(effective_lang_code, {})
    if lang_dict and key in lang_dict:
        return str(lang_dict[key])
    return str(key)


def create_unified_header():
    """Create unified header with branding, navigation, and controls"""
    # Initialize session state
    if 'app_language' not in st.session_state:
        st.session_state.app_language = 'th'
    if 'app_theme' not in st.session_state:
        st.session_state.app_theme = 'dark'
    
    # Apply dynamic theme CSS
    apply_dynamic_theme()
    
    # Unified header container
    st.markdown('<div class="unified-header">', unsafe_allow_html=True)
    
    # Header top section with compact controls
    st.markdown('<div class="header-top">', unsafe_allow_html=True)
    
    # Compact layout: spacer and right-aligned stacked controls  
    col1, col2 = st.columns([5, 1])
    
    with col2:
        # Controls container for proper stacking
        st.markdown('<div class="header-controls">', unsafe_allow_html=True)
        
        # Theme selector at top-right
        theme_options = [get_text('dark_theme'), get_text('light_theme')]
        current_theme_index = 0 if st.session_state.app_theme == 'dark' else 1
        
        selected_theme = st.selectbox(
            "",  # No label for compact design
            theme_options,
            index=current_theme_index,
            label_visibility="collapsed",
            key="theme_selector",
            help="🎨 Choose display theme"
        )
        
        # Update theme immediately
        new_theme = 'dark' if selected_theme == get_text('dark_theme') else 'light'
        if new_theme != st.session_state.app_theme:
            st.session_state.app_theme = new_theme
            st.rerun()
        
        # Language toggle directly below (stacked)
        lang_options = ["🇹🇭 ไทย", "🇺🇸 English"] 
        current_lang_index = 0 if st.session_state.app_language == 'th' else 1
        
        # Apply theme-aware CSS for radio button labels
        apply_radio_theme_css()
        
        selected_lang = st.radio(
            "",  # No label for compact design
            lang_options,
            index=current_lang_index,
            horizontal=True,
            label_visibility="collapsed",
            key="language_selector",
            help="🌐 Switch language"
        )
        
        # Update language and trigger rerun if changed
        new_lang = 'th' if selected_lang.startswith('🇹🇭') else 'en'
        if new_lang != st.session_state.app_language:
            st.session_state.app_language = new_lang
            st.rerun()
            
        st.markdown('</div>', unsafe_allow_html=True)  # Close header-controls
    
    st.markdown('</div>', unsafe_allow_html=True)  # Close header-top
    
    # Header main section with title and subtitle
    st.markdown('<div class="header-main">', unsafe_allow_html=True)
    st.markdown(f'<div class="main-title">{get_text("app_title")}</div>', unsafe_allow_html=True)
    st.markdown(f'<div class="main-subtitle">{get_text("app_subtitle")}</div>', unsafe_allow_html=True)
    st.markdown('</div>', unsafe_allow_html=True)
    
    st.markdown('</div>', unsafe_allow_html=True)  # Close unified-header


def create_compact_filters(news_data: List[Dict[str, Any]]) -> tuple[str, str, str, bool]:
    """Create compact and responsive filter controls"""
    if not news_data:
        all_option = get_text("all_option")
        return all_option, all_option, all_option, False
    
    # Extract filter values from data
    filter_values = extract_filter_values(news_data)
    
    # Filter container
    st.markdown('<div class="filter-container">', unsafe_allow_html=True)
    st.markdown(f'<div class="filter-title">{get_text("news_filters")}</div>', unsafe_allow_html=True)
    
    # Responsive filter columns with additional illustration toggle
    col1, col2, col3, col4 = st.columns([2, 2, 2, 1.5])
    
    with col1:
        platform_options = [get_text("all_option")] + sorted(list(filter_values['platforms']))
        selected_platform = st.selectbox(
            get_text("platform_filter"),
            platform_options,
            index=0,
            key="platform_filter"
        )
    
    with col2:
        # Category filter with consolidated Entertainment display
        category_priority = [
            "กีฬา (Sports)", 
            "บันเทิง (Entertainment)",  # Consolidated Entertainment + Games/Anime
            "การเมือง/ข่าวทั่วไป (Politics/General News)",
            "การศึกษา (Education)",
            "ไลฟ์สไตล์ (Lifestyle)",
            "ธุรกิจ / การเงิน (Business / Finance)",
            "สุขภาพ (Health)",
            "อื่นๆ (Others)", 
            "ไม่ระบุ (Unknown)"
        ]
        available_categories = list(filter_values['categories'])
        
        # Build consolidated category list for UI display
        sorted_categories = []
        has_entertainment = "บันเทิง (Entertainment)" in available_categories
        has_games_anime = "เกม/อนิเมะ (Games/Anime)" in available_categories
        
        for cat in category_priority:
            if cat == "บันเทิง (Entertainment)":
                if has_entertainment or has_games_anime:
                    sorted_categories.append(cat)
            elif cat in available_categories and cat not in ["บันเทิง (Entertainment)", "เกม/อนิเมะ (Games/Anime)"]:
                sorted_categories.append(cat)
        
        # Add any remaining categories
        for cat in available_categories:
            if cat not in sorted_categories and cat not in ["บันเทิง (Entertainment)", "เกม/อนิเมะ (Games/Anime)"]:
                sorted_categories.append(cat)
        
        category_options = [get_text("all_option")] + sorted_categories
        selected_category = st.selectbox(
            get_text("category_filter"),
            category_options,
            index=0,
            key="category_filter"
        )
    
    with col3:
        date_options = [get_text("all_option")] + sorted(list(filter_values['dates']), reverse=True)
        selected_date = st.selectbox(
            get_text("date_filter"),
            date_options,
            index=0,
            key="date_filter"
        )
    
    with col4:
        show_illustrations = st.checkbox(
            "🖼️ Show AI Images & Prompts",
            value=False,
            help="Display AI-generated images and editorial illustration prompts for each news item",
            key="illustration_toggle"
        )
    
    st.markdown('</div>', unsafe_allow_html=True)
    
    return selected_platform, selected_category, selected_date, show_illustrations


def create_news_card(news_item: Dict[str, Any], index: int, show_illustration_prompt: bool = False):
    """Create modern card-style display for news items using st.container with bilingual support"""
    # Get current language
    current_lang = st.session_state.get('app_language', 'th')
    
    # Extract data
    title = news_item.get('title', get_text("no_title")).strip()
    channel = news_item.get('channel', '').strip()
    category = news_item.get('auto_category', '')
    category_metadata = news_item.get('category_metadata', {})
    parent_category = category_metadata.get('parent_category')
    score = category_metadata.get('score', 0)
    view_count = news_item.get('view_count', '')
    published_date = news_item.get('published_date', '')
    
    # Handle bilingual summaries with new structure
    summary = ""
    if current_lang == 'th':
        # Thai summary
        summary = news_item.get('summary', get_text("no_summary")).strip()
    else:
        # English summary
        summary_en = news_item.get('summary_en', '').strip()
        if summary_en and not summary_en.startswith('Summary failed'):
            summary = summary_en
        else:
            # Fallback when English summary is missing or failed
            summary = "English summary is auto-generated. Professional translation coming soon."
    
    # Create card using st.container with custom CSS
    with st.container():
        st.markdown('<div class="news-card">', unsafe_allow_html=True)
        
        # News title
        st.markdown(f'<div class="news-title">#{index + 1} {title}</div>', unsafe_allow_html=True)
        
        # AI-Generated Image or Illustration Prompt
        ai_image_local = news_item.get('ai_image_local')
        ai_image_url = news_item.get('ai_image_url')
        
        # Prefer local images over OpenAI URLs (local images don't expire)
        image_source = None
        if ai_image_local and Path(ai_image_local).exists():
            image_source = ai_image_local
        elif ai_image_url:
            image_source = ai_image_url
        
        if image_source:
            # Display AI-generated image with width limitation
            st.image(
                image_source,
                caption="🤖 AI-Generated Editorial Illustration",
                width=600  # Limit width to 600px to prevent oversized displays
            )
            
            # Show the prompt used to generate the image (if available)
            ai_prompt = news_item.get('ai_image_prompt', '')
            if ai_prompt and show_illustration_prompt:
                with st.expander("🎨 Image Generation Prompt", expanded=False):
                    st.markdown(f'<div class="illustration-prompt">{ai_prompt}</div>', unsafe_allow_html=True)
        
        elif show_illustration_prompt:
            # Show illustration prompt if no AI image exists
            illustration_prompt = generate_editorial_illustration_prompt(news_item)
            
            # Illustration placeholder
            st.markdown('<div class="news-illustration"></div>', unsafe_allow_html=True)
            
            # Expandable illustration prompt
            with st.expander("🎨 Editorial Illustration Prompt", expanded=False):
                st.markdown(f'<div class="illustration-prompt">{illustration_prompt}</div>', unsafe_allow_html=True)
                
                # Copy button for the prompt
                if st.button(f"📋 Copy Prompt", key=f"copy_prompt_{index}", help="Copy illustration prompt to clipboard"):
                    st.code(illustration_prompt, language="text")
                    st.success("Prompt ready to copy!")
        
        # Metadata grid
        st.markdown('<div class="news-meta">', unsafe_allow_html=True)
        
        # Channel
        if channel:
            st.markdown(f'<div class="news-meta-item">{get_text("channel_label")}: <strong>{channel}</strong></div>', unsafe_allow_html=True)
        
        # Category with hierarchy
        if category:
            if parent_category:
                category_display = f"{get_text('category_label')}: {parent_category} › {category}"
                if score >= 3:
                    tooltip_text = get_text("category_score_tooltip")
                    category_display += f' <span class="category-tooltip">({score})<span class="tooltiptext">{tooltip_text}</span></span>'
            else:
                category_display = f"{get_text('category_label')}: {category}"
                if score >= 3:
                    tooltip_text = get_text("category_score_tooltip")
                    category_display += f' <span class="category-tooltip">({score})<span class="tooltiptext">{tooltip_text}</span></span>'
            st.markdown(f'<div class="news-meta-item"><span class="category-badge">{category_display}</span></div>', unsafe_allow_html=True)
        
        # Views
        if view_count:
            st.markdown(f'<div class="news-meta-item">{get_text("views_label")}: <strong>{view_count}</strong></div>', unsafe_allow_html=True)
        
        # Date
        if published_date:
            try:
                date_part = published_date.split(' ')[0]
                st.markdown(f'<div class="news-meta-item">{get_text("date_label")}: <strong>{date_part}</strong></div>', unsafe_allow_html=True)
            except:
                st.markdown(f'<div class="news-meta-item">{get_text("date_label")}: <strong>{published_date}</strong></div>', unsafe_allow_html=True)
        
        st.markdown('</div>', unsafe_allow_html=True)
        
        # Summary section with bilingual support
        if summary and summary.strip():
            if summary == "English summary is auto-generated. Professional translation coming soon.":
                # Show info message for missing English summary
                st.info("📝 English summary is auto-generated. Professional translation coming soon.")
            elif current_lang == 'th' and summary.startswith('สรุปไม่สำเร็จ'):
                # Thai summary failed
                st.warning("⚠️ ไม่สามารถสร้างสรุปข่าวภาษาไทยได้")
            elif current_lang == 'en' and summary.startswith('Summary failed'):
                # English summary failed
                st.warning("⚠️ Failed to generate English news summary")
            else:
                # Valid summary
                st.markdown(f'<div class="news-summary">{summary}</div>', unsafe_allow_html=True)
        else:
            # No summary available
            if current_lang == 'th':
                st.warning("⚠️ ไม่สามารถสร้างสรุปข่าวภาษาไทยได้")
            else:
                st.warning("⚠️ Failed to generate English news summary")
        
        # *** ADDED: Popularity Score Display ***
        # Display popularity score if available
        popularity_score = news_item.get('popularity_score')
        popularity_reason = news_item.get('reason', '')
        
        if popularity_score is not None:
            try:
                # Convert to integer and ensure score is within valid range (0-100)
                score_value = min(max(int(popularity_score), 0), 100)
                
                # Create popularity section
                st.markdown('<div class="popularity-section">', unsafe_allow_html=True)
                
                # Score header and progress bar
                st.markdown(f'''
                <div class="popularity-header">
                    <div class="popularity-score">🔥 Popularity Score: {score_value}/100</div>
                </div>
                <div class="popularity-bar">
                    <div class="popularity-fill" style="width: {score_value}%;"></div>
                </div>
                ''', unsafe_allow_html=True)
                
                # Reason explanation (if available)
                if popularity_reason and popularity_reason.strip():
                    clean_reason = popularity_reason.strip()
                    st.markdown(f'<div class="popularity-reason"><em>Reason:</em> {clean_reason}</div>', unsafe_allow_html=True)
                
                st.markdown('</div>', unsafe_allow_html=True)
                
            except (ValueError, TypeError):
                # Skip display if score cannot be converted to integer
                pass
        
        st.markdown('</div>', unsafe_allow_html=True)


# ... existing code continues with all the classification functions unchanged ...


def extract_hashtags(text: str) -> List[str]:
    """
    Extract hashtags from text (title or description).
    
    Args:
        text: Text to extract hashtags from
        
    Returns:
        List of hashtags found in the text
    """
    if not text:
        return []
    
    # Find hashtags using regex pattern that supports Thai and other Unicode characters
    hashtag_pattern = r'#[\w\u0E00-\u0E7F]+'
    hashtags = re.findall(hashtag_pattern, text, re.IGNORECASE)
    return [tag.lower() for tag in hashtags]


def score_title_keywords(title: str, keywords: List[str]) -> int:
    """
    Score news item based on title keywords.
    
    Args:
        title: Video title
        keywords: List of keywords to check for
        
    Returns:
        Score based on title keyword matches
    """
    if not title:
        return 0
    
    title_lower = title.lower()
    score = 0
    
    for keyword in keywords:
        if keyword.lower() in title_lower:
            score += 3  # Higher weight for title matches
    
    return score


def score_hashtags(hashtags: List[str], keywords: List[str]) -> int:
    """
    Score news item based on hashtag matches.
    
    Args:
        hashtags: List of hashtags found in title/description
        keywords: List of hashtag keywords to check for
        
    Returns:
        Score based on hashtag matches
    """
    if not hashtags or not keywords:
        return 0
    
    score = 0
    hashtags_lower = [tag.lower() for tag in hashtags]
    
    for keyword in keywords:
        if keyword.lower() in hashtags_lower:
            score += 4  # Very high weight for hashtag matches
    
    return score


def score_channel_keywords(channel: str, keywords: List[str]) -> int:
    """
    Score news item based on channel name keywords.
    
    Args:
        channel: Channel name
        keywords: List of channel keywords to check for
        
    Returns:
        Score based on channel keyword matches
    """
    if not channel:
        return 0
    
    channel_lower = channel.lower()
    score = 0
    
    for keyword in keywords:
        if keyword.lower() in channel_lower:
            score += 2  # Medium weight for channel matches
    
    return score


def score_summary_keywords(summary: str, keywords: List[str]) -> int:
    """
    Score news item based on summary keywords.
    
    Args:
        summary: AI-generated summary
        keywords: List of summary keywords to check for
        
    Returns:
        Score based on summary keyword matches
    """
    if not summary or summary.startswith('สรุปไม่สำเร็จ'):
        return 0
    
    summary_lower = summary.lower()
    score = 0
    
    for keyword in keywords:
        if keyword.lower() in summary_lower:
            score += 1  # Lower weight for summary matches
    
    return score


def classify_news_item_with_metadata(news_item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Classify news item with detailed metadata including parent category and score.
    
    Args:
        news_item: Dictionary containing news data
        
    Returns:
        Dictionary containing category, parent_category, score, and metadata
    """
    # Extract data fields with proper None handling
    title = (news_item.get('title') or '').strip()
    channel = (news_item.get('channel') or '').strip()
    summary = (news_item.get('summary') or '').strip()
    description = (news_item.get('description') or '').strip()
    
    # Handle missing or malformed entries
    if not any([title, channel, summary]):
        return {
            "category": "ไม่ระบุ (Unknown)",
            "parent_category": None,
            "score": 0,
            "scores_breakdown": {}
        }
    
    # Extract hashtags from title and description
    all_hashtags = []
    all_hashtags.extend(extract_hashtags(title))
    all_hashtags.extend(extract_hashtags(description))
    
    # Calculate multi-signal scores for each category
    category_scores = {}
    scores_breakdown = {}
    
    for category, keywords in CATEGORY_KEYWORDS.items():
        # Signal 1: Title keywords (weight: 3x)
        title_score = score_title_keywords(title, keywords.get("title", []))
        
        # Signal 2: Hashtags (weight: 4x)
        hashtag_score = score_hashtags(all_hashtags, keywords.get("hashtags", []))
        
        # Signal 3: Channel keywords (weight: 2x)
        channel_score = score_channel_keywords(channel, keywords.get("channel", []))
        
        # Signal 4: Summary keywords (weight: 1x)
        summary_score = score_summary_keywords(summary, keywords.get("summary", []))
        
        # Total score for this category
        total_score = title_score + hashtag_score + channel_score + summary_score
        category_scores[category] = total_score
        
        # Store breakdown for debugging
        scores_breakdown[category] = {
            "title": title_score,
            "hashtags": hashtag_score,
            "channel": channel_score,
            "summary": summary_score,
            "total": total_score
        }
    
    # Find category with highest score
    max_score = max(category_scores.values()) if category_scores.values() else 0
    
    # Minimum score threshold to prevent weak classifications
    MINIMUM_SCORE_THRESHOLD = 3
    
    if max_score >= MINIMUM_SCORE_THRESHOLD:
        # Return the category with the highest score
        # If there's a tie, return the first one found (deterministic)
        for category, score in category_scores.items():
            if score == max_score:
                category_info = CATEGORY_HIERARCHY.get(category, {})
                return {
                    "category": category,
                    "parent_category": category_info.get("parent"),
                    "score": max_score,
                    "scores_breakdown": scores_breakdown
                }
    
    # Fallback to Others if no keywords matched or score too low
    return {
        "category": "อื่นๆ (Others)",
        "parent_category": None,
        "score": max_score,
        "scores_breakdown": scores_breakdown
    }


def classify_news_item(news_item: Dict[str, Any]) -> str:
    """
    Classify news item using multi-signal detection: title keywords, hashtags, and channel names.
    
    Args:
        news_item: Dictionary containing news data
        
    Returns:
        Category string with highest match count
    """
    # Use the detailed metadata function and return just the category
    result = classify_news_item_with_metadata(news_item)
    return result["category"]



def load_news_data(file_path: str = "thailand_trending_summary.json") -> List[Dict[str, Any]]:
    """
    Load news data from JSON file.
    
    Args:
        file_path: Path to the JSON file containing news summaries
        
    Returns:
        List of news items or empty list if file not found/invalid
    """
    try:
        json_path = Path(file_path)
        
        if not json_path.exists():
            st.error(get_text("data_not_found").format(file=file_path))
            st.info(get_text("run_summarizer"))
            return []
        
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if not isinstance(data, list):
            st.error(get_text("invalid_data_format"))
            return []
        
        # Add category classification for each news item
        for item in data:
            classification_result = classify_news_item_with_metadata(item)
            item['auto_category'] = classification_result['category']
            item['category_metadata'] = {
                'category': classification_result['category'],
                'parent_category': classification_result['parent_category'],
                'score': classification_result['score']
            }
        
        return data
        
    except json.JSONDecodeError as e:
        st.error(get_text("json_error").format(error=str(e)))
        return []
    except Exception as e:
        st.error(get_text("general_error").format(error=str(e)))
        return []


def extract_filter_values(news_data: List[Dict[str, Any]]) -> Dict[str, Set[str]]:
    """
    Extract unique values for filters from news data.
    
    Args:
        news_data: List of news items
        
    Returns:
        Dictionary containing sets of unique values for each filter
    """
    platforms = set()
    categories = set()
    dates = set()
    
    for item in news_data:
        # Platform - assume all are YouTube for now, but could be extended
        platforms.add("YouTube")
        
        # Category - use enhanced classification
        category = item.get('auto_category', classify_news_item(item))
        categories.add(category)
        
        # Date - extract date part from published_date
        published_date = item.get('published_date', '').strip()
        if published_date and published_date != 'Unknown':
            try:
                # Extract date part (YYYY-MM-DD) from datetime string
                date_part = published_date.split(' ')[0]  # Get date part before time
                dates.add(date_part)
            except:
                dates.add(get_text("unknown"))
        else:
            dates.add(get_text("unknown"))
    
    return {
        'platforms': platforms,
        'categories': categories,
        'dates': dates
    }


def parse_view_count(view_count_str: str) -> int:
    """
    Parse view count string to integer for sorting.
    
    Args:
        view_count_str: View count as string (e.g., "2,190,133" or "16,819,511")
        
    Returns:
        Integer value of view count, 0 if parsing fails
    """
    if not view_count_str or view_count_str == 'Unknown':
        return 0
    
    try:
        # Remove commas and convert to int
        return int(view_count_str.replace(',', ''))
    except (ValueError, AttributeError):
        return 0


def sort_news_by_popularity(news_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Sort news data by popularity score (descending), then by view count (descending).
    
    Args:
        news_data: List of news items to sort
        
    Returns:
        Sorted list of news items (most popular first)
    """
    def sort_key(item):
        # Primary sort: popularity_score (descending)
        popularity_score = item.get('popularity_score', 0)
        try:
            popularity_score = int(popularity_score) if popularity_score is not None else 0
        except (ValueError, TypeError):
            popularity_score = 0
        
        # Secondary sort: view_count (descending)
        view_count_str = item.get('view_count', '0')
        view_count = parse_view_count(view_count_str)
        
        # Return tuple for sorting: negative values for descending order
        return (-popularity_score, -view_count)
    
    return sorted(news_data, key=sort_key)


def filter_news_data(news_data: List[Dict[str, Any]], 
                    selected_platform: str, 
                    selected_category: str, 
                    selected_date: str) -> List[Dict[str, Any]]:
    """
    Filter news data based on selected criteria.
    
    Args:
        news_data: List of news items
        selected_platform: Selected platform filter
        selected_category: Selected category filter
        selected_date: Selected date filter
        
    Returns:
        Filtered list of news items
    """
    filtered_data = []
    
    all_option = get_text("all_option")
    unknown_option = get_text("unknown")
    
    for item in news_data:
        # Platform filter (currently all YouTube)
        if selected_platform != all_option and selected_platform != "YouTube":
            continue
        
        # Category filter with parent category support and consolidated entertainment handling
        if selected_category != all_option:
            item_category = item.get('auto_category', classify_news_item(item))
            item_metadata = item.get('category_metadata', {})
            item_parent_category = item_metadata.get('parent_category')
            
            # Handle consolidated entertainment category
            if selected_category == get_text("entertainment"):
                category_matches = (
                    item_category == "บันเทิง (Entertainment)" or
                    item_category == "เกม/อนิเมะ (Games/Anime)" or
                    item_parent_category == "บันเทิง (Entertainment)"
                )
            else:
                # Check if item matches selected category directly or if its parent matches
                category_matches = (
                    item_category == selected_category or  # Direct match
                    item_parent_category == selected_category  # Parent category match
                )
            
            if not category_matches:
                continue
        
        # Date filter
        if selected_date != all_option:
            published_date = item.get('published_date', '').strip()
            
            if selected_date == unknown_option:
                if published_date and published_date != 'Unknown':
                    continue
            else:
                try:
                    date_part = published_date.split(' ')[0]
                    if date_part != selected_date:
                        continue
                except:
                    if selected_date != unknown_option:
                        continue
        
        filtered_data.append(item)
    
    return filtered_data


def show_terms_of_use():
    """Display Terms of Use page with modern styling"""
    create_unified_header()
    
    # Ultra-compact content area
    st.markdown('<div style="margin-top: -0.4rem;">', unsafe_allow_html=True)
    
    # Page content - maximum compactness
    st.markdown(f'### {get_text("terms_title")}')
    
    # Content
    st.markdown(get_text("terms"))
    
    st.markdown('</div>', unsafe_allow_html=True)


def show_privacy_policy():
    """Display Privacy Policy page with modern styling"""
    create_unified_header()
    
    # Ultra-compact content area
    st.markdown('<div style="margin-top: -0.4rem;">', unsafe_allow_html=True)
    
    # Page content - maximum compactness
    st.markdown(f'### {get_text("privacy_title")}')
    
    # Content
    st.markdown(get_text("privacy"))
    
    st.markdown('</div>', unsafe_allow_html=True)


def show_main_page():
    """Display main news page with modern styling"""
    create_unified_header()
    
    # Main content area with maximum compactness
    st.markdown('<div style="margin-top: -0.4rem;">', unsafe_allow_html=True)
    
    # Description - ultra-compact spacing  
    st.markdown(get_text("app_description"))
    
    # AI Image Generation Section (Admin)
    if st.session_state.get('show_admin_controls', False):
        with st.expander("🤖 AI Image Generation (Admin)", expanded=False):
            st.markdown("**Generate AI illustrations for top 3 trending news**")
            
            # Check for .env file and environment variable
            
            env_api_key = os.getenv('OPENAI_API_KEY')
            env_file_exists = os.path.exists('.env')
            
            # Display environment status
            col_status1, col_status2 = st.columns(2)
            with col_status1:
                if env_api_key:
                    st.success("🔐 API Key found in environment variables")
                else:
                    st.info("🔐 No API key found in environment variables")
            
            with col_status2:
                if env_file_exists:
                    st.success("📄 .env file detected")
                else:
                    st.info("📄 No .env file found")
            
            # API Key input section
            st.markdown("---")
            col1, col2 = st.columns([2, 1])
            
            with col1:
                if env_api_key:
                    st.markdown("**Using API key from environment/env file**")
                    api_key_input = ""
                    use_env_key = True
                else:
                    api_key_input = st.text_input(
                        "🔐 Enter OpenAI API Key", 
                        type="password", 
                        help="Enter your OpenAI API key (starts with 'sk-')",
                        placeholder="sk-..."
                    )
                    use_env_key = False
                    
                    # Validate API key format
                    if api_key_input and not api_key_input.startswith('sk-'):
                        st.warning("⚠️ API key should start with 'sk-'")
            
            with col2:
                st.markdown("**Actions**")
                generate_button = st.button(
                    "🎨 Generate AI Images", 
                    help="Generate AI images for top 3 news items using DALL-E 3",
                    disabled=not (env_api_key or api_key_input)
                )
                
                if st.button("📖 Show Setup Guide"):
                    st.info("""
                    **Setup Options:**
                    
                    **Option 1: .env File (Recommended)**
                    1. Create a `.env` file in your project root
                    2. Add: `OPENAI_API_KEY=your-key-here`
                    3. Restart the app
                    
                    **Option 2: Environment Variable**
                    ```bash
                    export OPENAI_API_KEY="your-key-here"
                    streamlit run app.py
                    ```
                    
                    **Option 3: Manual Entry**
                    Enter your API key in the field above
                    """)
            
            # Generation logic
            if generate_button:
                final_api_key = env_api_key if use_env_key else api_key_input
                
                if final_api_key:
                    with st.spinner("🎨 Generating AI images... This may take 2-3 minutes."):
                        try:
                            # Import the AI image generator
                            from ai_image_generator import generate_ai_images_for_top3_news
                            
                            # Progress indicator
                            progress_bar = st.progress(0)
                            status_text = st.empty()
                            
                            status_text.text("🔍 Loading news data...")
                            progress_bar.progress(20)
                            
                            # Generate images
                            result = generate_ai_images_for_top3_news(final_api_key)
                            progress_bar.progress(100)
                            
                            if result['success']:
                                st.success(f"✅ {result['message']}")
                                st.balloons()
                                
                                # Show generation details
                                with st.expander("📊 Generation Details", expanded=True):
                                    st.write(f"**Processed:** {result.get('processed', 0)} items")
                                    st.write(f"**Successful:** {result.get('successful', 0)} generations")
                                    st.write(f"**Cost Estimate:** ~${result.get('successful', 0) * 0.04:.2f}")
                                
                                st.info("🔄 Enable '🖼️ Show AI Images & Prompts' in the filters to see the new images!")
                                
                                # Auto-refresh option
                                if st.button("🔄 Refresh Page to See Images"):
                                    st.rerun()
                            else:
                                st.error(f"❌ {result['message']}")
                                
                                # Show troubleshooting tips
                                with st.expander("🔧 Troubleshooting", expanded=True):
                                    st.write("""
                                    **Common Issues:**
                                    - ❌ Invalid API key → Check your OpenAI account
                                    - ❌ Insufficient credits → Add credits to your OpenAI account
                                    - ❌ Rate limit → Wait a few minutes and try again
                                    - ❌ Network error → Check your internet connection
                                    """)
                            
                            # Clean up progress indicators
                            progress_bar.empty()
                            status_text.empty()
                                    
                        except ImportError:
                            st.error("❌ AI image generator module not found. Please ensure ai_image_generator.py is available.")
                        except Exception as e:
                            st.error(f"❌ Error generating images: {str(e)}")
                            
                            # Detailed error for debugging
                            with st.expander("🐛 Debug Information", expanded=False):
                                st.code(str(e))
                else:
                    st.warning("⚠️ Please provide a valid OpenAI API key")
    
    # Toggle admin controls
    if st.button("🔧 Toggle Admin Controls", help="Show/hide admin controls"):
        st.session_state.show_admin_controls = not st.session_state.get('show_admin_controls', False)
        st.rerun()
    
    # Ultra-minimal content divider
    st.markdown('<div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent); margin: 0.6rem 0 0.4rem 0;"></div>', unsafe_allow_html=True)
    
    st.markdown('</div>', unsafe_allow_html=True)  # Close main content wrapper
    
    # Load news data
    with st.spinner(get_text("loading_news")):
        news_data = load_news_data()
    
    # Display filters and news items
    if news_data:
        # Success message
        st.markdown(f'<div class="stats-badge">{get_text("found_news").format(count=len(news_data))}</div>', unsafe_allow_html=True)
        st.markdown("<br>", unsafe_allow_html=True)
        
        # Display compact filter controls
        selected_platform, selected_category, selected_date, show_illustrations = create_compact_filters(news_data)
        
        # Apply filters to data
        filtered_data = filter_news_data(news_data, selected_platform, selected_category, selected_date)
        
        # Sort by popularity score (descending), then by view count (descending)
        filtered_data = sort_news_by_popularity(filtered_data)
        
        # Show filter results
        if len(filtered_data) != len(news_data):
            st.info(get_text("filtered_news").format(filtered=len(filtered_data), total=len(news_data)))
        
        st.markdown("<br>", unsafe_allow_html=True)
        
        # Display filtered news items as modern cards
        if filtered_data:
            for index, news_item in enumerate(filtered_data):
                create_news_card(news_item, index, show_illustrations)
            
            # Footer
            st.markdown("<br>", unsafe_allow_html=True)
            st.markdown(f'<div class="stats-badge">{get_text("footer_stats").format(count=len(filtered_data))}</div>', unsafe_allow_html=True)
        else:
            st.warning(get_text("no_filtered_news"))
            st.info(get_text("try_different_filter"))
        
    else:
        # No data available
        st.warning(get_text("no_news_data"))
        st.info(f"""
        {get_text("data_prep_title")}
        {get_text("data_prep_step1")}
        {get_text("data_prep_step2")}
        {get_text("data_prep_step3")}
        """)


def main():
    """
    Main application function with modern UI and bilingual support.
    """
    # Initialize session state for mobile detection
    if 'mobile_view' not in st.session_state:
        st.session_state.mobile_view = False
    
    # Modern sidebar navigation
    st.sidebar.title("🚀 TrendSiam")
    st.sidebar.markdown("---")
    
    # Navigation
    st.sidebar.markdown(f"### {get_text('main_menu')}")
    
    page_options = [
        get_text("main_page"),
        get_text("terms_of_use"), 
        get_text("privacy_policy")
    ]
    
    selected_page = st.sidebar.radio(
        get_text("select_page"),
        page_options,
        index=0,
        label_visibility="collapsed"
    )
    
    # About section
    st.sidebar.markdown("---")
    st.sidebar.markdown(f"### {get_text('about_title')}")
    st.sidebar.markdown(get_text("about_description"))
    
    # Display selected page
    if selected_page == get_text("main_page"):
        show_main_page()
    elif selected_page == get_text("terms_of_use"):
        show_terms_of_use()
    elif selected_page == get_text("privacy_policy"):
        show_privacy_policy()


def generate_editorial_illustration_prompt(news_item: Dict[str, Any]) -> str:
    """
    Generate an editorial-style illustration prompt based on news content.
    
    Args:
        news_item: Dictionary containing news data
        
    Returns:
        Detailed prompt for creating editorial-style illustration
    """
    # Get news details
    title = news_item.get('title', '').lower()
    summary = news_item.get('summary', '').lower()
    category = news_item.get('auto_category', 'อื่นๆ (Others)')
    
    # Base prompt template
    base_prompt = "An editorial-style illustration representing trending Thai news. "
    
    # Category-specific illustration prompts
    if "กีฬา (Sports)" in category:
        if any(keyword in title + summary for keyword in ['วอลเลย์บอล', 'volleyball', 'ไทย พบ', 'vs']):
            return f"{base_prompt}Symbolic volleyball court with Thai flag elements, players silhouettes in action, sports arena atmosphere. Clean geometric design with dynamic movement lines. White background, newspaper graphic style, respectful representation of Thai sports achievement."
        
        elif any(keyword in title + summary for keyword in ['ฟุตบอล', 'football', 'เชลซี', 'ลิเวอร์พูล', 'premier league']):
            return f"{base_prompt}Abstract football/soccer field with geometric ball and goal posts, dynamic action lines suggesting movement and competition. Minimalist sports symbols, clean newspaper illustration style. White background, no logos or faces."
        
        else:
            return f"{base_prompt}Generic sports symbols - trophy, medal, or athletic equipment in minimalist design. Dynamic geometric shapes suggesting competition and achievement. Clean editorial style, white background."
    
    elif "บันเทิง (Entertainment)" in category or "เกม/อนิเมะ (Games/Anime)" in category:
        if any(keyword in title + summary for keyword in ['blackpink', 'music', 'mv', 'เพลง']):
            return f"{base_prompt}Abstract music-themed illustration with stylized musical notes, sound waves, and stage lighting effects. Geometric microphone or concert stage silhouette. Vibrant but clean design, newspaper graphic style, white background."
        
        elif any(keyword in title + summary for keyword in ['minecraft', 'gaming', 'เกม', 'beatbox']):
            return f"{base_prompt}Abstract gaming-themed illustration with geometric pixel art elements, controller silhouettes, or digital interface symbols. Clean, modern design representing digital entertainment. White background, newspaper style."
        
        elif any(keyword in title + summary for keyword in ['anime', 'อนิเมะ', 'gachiakuta']):
            return f"{base_prompt}Stylized anime-inspired geometric shapes, comic book style speech bubbles or panels, Japanese cultural elements in abstract form. Clean illustration style, respectful cultural representation, white background."
        
        else:
            return f"{base_prompt}Abstract entertainment symbols - stage lights, curtains, or performance elements in geometric design. Clean editorial illustration, white background."
    
    elif "การเมือง/ข่าวทั่วไป (Politics/General News)" in category:
        return f"{base_prompt}Abstract governmental or civic symbols - capitol building silhouette, scales of justice, or democratic icons in clean geometric form. Respectful representation of political discourse, newspaper editorial style, white background."
    
    elif "การศึกษา (Education)" in category:
        return f"{base_prompt}Educational symbols in abstract form - books, graduation cap, blackboard, or learning icons. Clean academic illustration style, geometric design, white background, newspaper graphic aesthetic."
    
    elif "ไลฟ์สไตล์ (Lifestyle)" in category:
        return f"{base_prompt}Lifestyle-themed abstract illustration - coffee cup, travel icons, fashion elements, or daily life symbols in geometric form. Clean, modern design representing contemporary living, white background."
    
    elif "ธุรกิจ / การเงิน (Business / Finance)" in category:
        return f"{base_prompt}Business and finance symbols in abstract form - graph arrows, currency symbols, calculator, or market indicators. Clean geometric design, professional editorial style, white background."
    
    elif "สุขภาพ (Health)" in category:
        return f"{base_prompt}Health and wellness symbols - medical cross, heart symbol, fitness icons, or wellness elements in clean geometric design. Respectful health-themed illustration, newspaper style, white background."
    
    else:
        # Generic news illustration
        return f"{base_prompt}General news symbols in abstract form - newspaper icons, information symbols, or communication elements. Clean geometric design representing information sharing and media, white background, editorial newspaper style."

def get_illustration_style_css() -> str:
    """Get CSS for illustration placeholder styling"""
    return """
    .news-illustration {
        width: 100%;
        height: 120px;
        background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 1rem;
        border: 1px solid rgba(0,0,0,0.1);
        position: relative;
        overflow: hidden;
    }
    
    .news-illustration::before {
        content: '🎨';
        font-size: 2rem;
        opacity: 0.6;
    }
    
    /* AI Generated Image Styling */
    .ai-generated-image {
        width: 100%;
        border-radius: 8px;
        margin-bottom: 1rem;
        border: 1px solid rgba(0,0,0,0.1);
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .ai-image-caption {
        text-align: center;
        font-size: 0.8rem;
        color: #64748b;
        font-style: italic;
        margin-top: 0.5rem;
        padding: 0.3rem;
        background: rgba(248,250,252,0.8);
        border-radius: 4px;
    }
    
    .illustration-prompt {
        font-size: 0.8rem;
        color: #64748b;
        font-style: italic;
        margin-top: 0.5rem;
        padding: 0.5rem;
        background: rgba(248,250,252,0.8);
        border-radius: 6px;
        border-left: 3px solid #3b82f6;
    }
    
    @media (max-width: 768px) {
        .news-illustration {
            height: 100px;
        }
        
        .news-illustration::before {
            font-size: 1.5rem;
        }
        
        .illustration-prompt {
            font-size: 0.75rem;
            padding: 0.4rem;
        }
    }
    """


if __name__ == "__main__":
    main() 