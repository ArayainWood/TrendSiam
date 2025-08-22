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
import requests
import logging

# WeasyPrint for HTML to PDF conversion - Import with fallback
try:
    from weasyprint import HTML
    WEASYPRINT_AVAILABLE = True
except ImportError:
    print("Warning: WeasyPrint not found. PDF generation will not work.")
    WEASYPRINT_AVAILABLE = False

# Import shared HTML report generation functions
try:
    from generate_html_pdf import generate_html_report, calculate_metrics, calculate_category_breakdown
    HTML_FUNCTIONS_AVAILABLE = True
except ImportError:
    print("Warning: HTML report functions not found.")
    HTML_FUNCTIONS_AVAILABLE = False

from datetime import timedelta
import glob
from collections import defaultdict
import tempfile
import base64

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
    
    .source-link-container {{
        margin-top: 0.5rem;
    }}
    
    .source-link {{
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.6rem 1rem;
        background: linear-gradient(135deg, #FF6B6B, #FF5252);
        color: white !important;
        text-decoration: none !important;
        border-radius: 8px;
        font-weight: 500;
        font-size: 0.9rem;
        transition: all 0.3s ease;
        border: none;
        box-shadow: 0 2px 4px rgba(255, 107, 107, 0.3);
    }}
    
    .source-link:hover {{
        background: linear-gradient(135deg, #FF5252, #F44336);
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(255, 107, 107, 0.4);
        color: white !important;
        text-decoration: none !important;
    }}
    
    .source-icon {{
        font-size: 1.1rem;
    }}
    
    .source-text {{
        font-weight: 500;
    }}
    
    .external-indicator {{
        font-size: 0.8rem;
        opacity: 0.8;
    }}
    
    .source-link-item {{
        grid-column: 1 / -1;
        justify-content: flex-start;
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
     
     /* Category count tooltip styling */
     .category-count-tooltip {{
         cursor: help;
         color: {text_secondary};
         text-decoration: none;
         border-bottom: 1px dotted {text_secondary};
         transition: color 0.2s ease;
     }}
     
     .category-count-tooltip:hover {{
         color: {accent_color};
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
        "weekly_report": "📊 รายงานสัปดาห์",
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
        "category_count_tooltip": "จำนวนข่าวทั้งหมดในหมวดนี้ในวันนี้",
        "category_filter_help": "เลือกหมวดหมู่เพื่อกรองข่าว หมวดหมู่หลักจะรวมหมวดย่อยด้วย ตัวเลขแสดงจำนวนข่าวในแต่ละหมวด",
        
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
        "no_news_found": "😔 ไม่พบข่าวที่ตรงกับเงื่อนไขการกรอง",
        "error_occurred": "⚠️ เกิดข้อผิดพลาดในการโหลดข้อมูลข่าว",
        "data_updated": "✅ ข้อมูลถูกอัปเดตเรียบร้อยแล้ว",
        
        # Weekly Report
        "weekly_report_title": "📊 รายงานสัปดาห์ - ข่าวยอดนิยม",
        "weekly_report_subtitle": "สรุปข่าวยอดนิยมในรอบ 7 วันที่ผ่านมา",
        "weekly_report_period": "📅 ช่วงเวลา",
        "weekly_report_loading": "🔄 กำลังรวบรวมข้อมูลรายงานสัปดาห์...",
        "weekly_report_no_data": "😔 ไม่พบข้อมูลสำหรับสัปดาห์นี้",
        "weekly_report_top_stories": "🔥 ข่าวยอดนิยมอันดับต้น ๆ",
        "weekly_report_by_category": "📂 ข่าวจำแนกตามหมวดหมู่",
        "weekly_summary": "📝 สรุปรายงาน",
        "download_pdf": "📄 ดาวน์โหลด PDF",
        "generating_pdf": "🔄 กำลังสร้างไฟล์ PDF...",
        "pdf_generated": "✅ สร้างไฟล์ PDF เรียบร้อยแล้ว",
        "pdf_error": "⚠️ เกิดข้อผิดพลาดในการสร้างไฟล์ PDF",
        
        # Footer
        "footer_stats": "📊 แสดงข่าว {count} ข่าว • อัปเดตล่าสุด: วันนี้ • ระบบจำแนกหมวดหมู่อัตโนมัติ 8 หมวด",
        
        # Source links
        "watch_on_youtube": "ดูต้นฉบับบน YouTube",
        "source_link_label": "แหล่งข้อมูลต้นฉบับ",
        
        # View Details section
        "view_details_title": "🧠 ดูเกณฑ์การวิเคราะห์",
        "latest_views": "ยอดดูล่าสุด",
        "growth_rate": "อัตราการเติบโต",
        "mentioned_platforms": "แพลตฟอร์มที่กล่าวถึง",
        "keyword_match": "คำสำคัญที่พบ",
        "ai_insight": "การวิเคราะห์ AI",
        "score_info": "คะแนนรวม",
        
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
        "weekly_report": "📊 Weekly Report",
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
        "category_count_tooltip": "Total stories in this category today",
        "category_filter_help": "Choose a category to filter news stories. Parent categories include their subcategories. Numbers show story count in each category.",
        
        # Status messages
        "loading_news": "🔄 Loading news data and category classification...",
        "found_news": "✅ Found {count} news items",
        "filtered_news": "🔍 Filtered {filtered} news items from total {total}",
        "no_filtered_news": "🔍 No news found matching selected filters",
        "try_different_filter": "💡 Try different filters or select 'All' to see all news",
        "no_news_data": "📭 No news data available",
        "data_not_found": "📄 No data found: {file}",
        "run_summarizer": "💡 Please run `python summarize_all.py` to generate news summaries before viewing",
        "invalid_data_format": "❌ Invalid data format: expected an array of news items",
        "json_error": "❌ Failed to read JSON: {error}",
        "general_error": "❌ An error occurred: {error}",
        "no_news_found": "😔 No news found matching selected filters",
        "error_occurred": "⚠️ An error occurred while loading news data",
        "data_updated": "✅ Data updated successfully",
        
        # Weekly Report
        "weekly_report_title": "📊 Weekly Report - Trending News",
        "weekly_report_subtitle": "Summary of trending news over the past 7 days",
        "weekly_report_period": "📅 Time Period",
        "weekly_report_loading": "🔄 Loading weekly report data...",
        "weekly_report_no_data": "😔 No data available for this week",
        "weekly_report_top_stories": "🔥 Top Stories",
        "weekly_report_by_category": "📂 News by Category",
        "weekly_summary": "📝 Weekly Summary",
        "download_pdf": "📄 Download PDF",
        "generating_pdf": "🔄 Generating PDF...",
        "pdf_generated": "✅ PDF generated successfully",
        "pdf_error": "⚠️ Error generating PDF",
        
        # Footer
        "footer_stats": "📊 Showing {count} news items • Last updated: Today • 8 Auto-classification Categories",
        
        # Source links
        "watch_on_youtube": "Watch on YouTube",
        "source_link_label": "Original Source",
        
        # View Details section
        "view_details_title": "🧠 View Details",
        "latest_views": "Latest Views",
        "growth_rate": "Growth Rate",
        "mentioned_platforms": "Mentioned Platforms",
        "keyword_match": "Keyword Match",
        "ai_insight": "AI Insight",
        "score_info": "Score",
        
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


def is_dev_mode() -> bool:
    """
    Check if developer mode is enabled.
    
    Returns:
        bool: True if developer mode is active, False otherwise
    """
    return st.session_state.get("dev_mode", False)





def validate_youtube_video_id(video_id: str) -> bool:
    """
    Validate YouTube video ID format for security.
    
    Args:
        video_id: The video ID to validate
        
    Returns:
        bool: True if valid YouTube video ID format, False otherwise
    """
    import re
    
    if not video_id or not isinstance(video_id, str):
        return False
    
    # YouTube video IDs are 11 characters, alphanumeric with hyphens and underscores
    pattern = r'^[a-zA-Z0-9_-]{11}$'
    return bool(re.match(pattern, video_id))


def create_secure_youtube_url(video_id: str) -> Optional[str]:
    """
    Create a secure YouTube URL from a validated video ID.
    
    Args:
        video_id: The YouTube video ID
        
    Returns:
        str: Secure YouTube URL or None if invalid
    """
    if not validate_youtube_video_id(video_id):
        return None
    
    # Use HTTPS and the standard YouTube domain
    return f"https://www.youtube.com/watch?v={video_id}"


def create_source_link_html(url: str, label: str, icon: str = "🔗") -> str:
    """
    Create secure HTML for external source links.
    
    Args:
        url: The URL to link to
        label: Display label for the link
        icon: Icon to display with the link
        
    Returns:
        str: Safe HTML for the external link
    """
    import html
    
    # Escape URL and label to prevent XSS
    safe_url = html.escape(url, quote=True)
    safe_label = html.escape(label)
    safe_icon = html.escape(icon)
    
    return f'''
    <div class="source-link-container">
        <a href="{safe_url}" 
           target="_blank" 
           rel="noopener noreferrer nofollow" 
           class="source-link">
            <span class="source-icon">{safe_icon}</span>
            <span class="source-text">{safe_label}</span>
            <span class="external-indicator">↗</span>
        </a>
    </div>
    '''


def audit_source_links_security() -> Dict[str, Any]:
    """
    Audit the security of source link implementation.
    
    Returns:
        Dict: Security audit results
    """
    audit_results = {
        "status": "✅ SECURE",
        "checks_passed": [],
        "warnings": [],
        "security_features": []
    }
    
    # Test video ID validation
    test_cases = [
        ("10eYg4r3RQo", True),  # Valid YouTube ID
        ("invalid_id", False),  # Invalid format
        ("", False),  # Empty string
        ("12345678901", True),  # Valid 11-char alphanumeric
        ("script>alert()", False),  # XSS attempt
        ("../../../etc/passwd", False),  # Path traversal
    ]
    
    validation_passed = True
    for test_id, expected in test_cases:
        result = validate_youtube_video_id(test_id)
        if result != expected:
            validation_passed = False
            audit_results["warnings"].append(f"Video ID validation failed for: {test_id}")
    
    if validation_passed:
        audit_results["checks_passed"].append("Video ID validation working correctly")
    
    # Security features documented
    audit_results["security_features"] = [
        "🔒 Input validation (YouTube video ID format)",
        "🛡️ HTML escaping to prevent XSS",
        "🌐 HTTPS-only URLs",
        "🔗 External link security attributes (noopener, noreferrer, nofollow)",
        "📋 Whitelist approach (only YouTube domain allowed)",
        "⚡ Safe fallback (no link shown if validation fails)"
    ]
    
    return audit_results


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


def create_compact_filters(news_data: List[Dict[str, Any]]) -> tuple[str, str, str, bool, Dict[str, int]]:
    """Create compact and responsive filter controls"""
    if not news_data:
        all_option = get_text("all_option")
        return all_option, all_option, all_option, False, {}
    
    # Extract filter values from data
    filter_values = extract_filter_values(news_data)
    
    # Filter container with enhanced UX
    st.markdown('<div class="filter-container">', unsafe_allow_html=True)
    
    # Filter header with clear option
    filter_col1, filter_col2 = st.columns([3, 1])
    with filter_col1:
        st.markdown(f'<div class="filter-title">{get_text("news_filters")}</div>', unsafe_allow_html=True)
    with filter_col2:
        if st.button("🔄 Clear All Filters", help="Reset all filters to show all news", key="clear_all_filters"):
            # Clear all filter states by resetting session state keys
            for key in ["platform_filter", "category_filter", "date_filter", "sort_categories_by_popularity"]:
                if key in st.session_state:
                    del st.session_state[key]
            st.rerun()
    
    # Responsive filter columns with additional illustration toggle
    col1, col2, col3, col4 = st.columns([2, 2, 2, 1.5])
    
    with col1:
        # Enhanced Platform filter with counts (for consistency)
        platforms_list = sorted(list(filter_values['platforms']))
        platform_counts = {}
        
        # Calculate total stories count
        total_stories = len(news_data)
        
        # Count stories per platform
        for item in news_data:
            platform = "YouTube"  # Currently all YouTube, but keeping extensible
            platform_counts[platform] = platform_counts.get(platform, 0) + 1
        
        # Create platform options with counts
        platform_display_options = [f"{get_text('all_option')} ({total_stories})"]
        platform_value_mapping = {platform_display_options[0]: get_text("all_option")}
        
        for platform in platforms_list:
            count = platform_counts.get(platform, 0)
            display_name = f"{platform} ({count})"
            platform_display_options.append(display_name)
            platform_value_mapping[display_name] = platform
        
        selected_platform_display = st.selectbox(
            get_text("platform_filter"),
            platform_display_options,
            index=0,
            key="platform_filter",
            help="Filter by platform source. Numbers show story count per platform."
        )
        
        # Get the actual platform value for filtering
        selected_platform = platform_value_mapping.get(selected_platform_display, get_text("all_option"))
    
    with col2:
        # Enhanced Category filter with hierarchical nested structure
        # Define hierarchical category structure
        category_hierarchy = {
            # Parent categories with their children
            "บันเทิง (Entertainment)": [
                "เกม/อนิเมะ (Games/Anime)",
                # Add more subcategories here as needed
            ],
            # Standalone categories (no children)
            "กีฬา (Sports)": [],
            "การเมือง/ข่าวทั่วไป (Politics/General News)": [],
            "การศึกษา (Education)": [],
            "ไลฟ์สไตล์ (Lifestyle)": [],
            "ธุรกิจ / การเงิน (Business / Finance)": [],
            "สุขภาพ (Health)": [],
            "อื่นๆ (Others)": [],
            "ไม่ระบุ (Unknown)": []
        }
        
        available_categories = list(filter_values['categories'])
        category_counts = filter_values.get('category_counts', {})
        
        # Build enhanced category list for UI display (without counts in dropdown)
        def create_category_display_name(category_name, count):
            """Create category display name without count for dropdown"""
            return f"{category_name}"
        
        # Handle consolidated entertainment category count
        def get_consolidated_count(categories_to_check):
            """Get combined count for consolidated categories"""
            total_count = 0
            for cat in categories_to_check:
                if cat in category_counts:
                    total_count += category_counts[cat]
            return total_count
        
        # Build hierarchical category display list
        def build_nested_category_options():
            """Build nested category options with hierarchy and counts"""
            nested_options = []
            category_value_mapping = {}
            
            # Add "All" option
            total_stories = len(news_data)
            all_option_display = f"{get_text('all_option')} ({total_stories})"
            nested_options.append(all_option_display)
            category_value_mapping[all_option_display] = get_text("all_option")
            
            # Process hierarchy
            for parent_category, child_categories in category_hierarchy.items():
                # Check if parent category or any child exists in data
                parent_exists = parent_category in available_categories
                children_exist = any(child in available_categories for child in child_categories)
                
                if parent_exists or children_exist:
                    # Calculate parent category count (including children if no direct parent stories)
                    parent_direct_count = category_counts.get(parent_category, 0)
                    children_total_count = sum(category_counts.get(child, 0) for child in child_categories if child in available_categories)
                    
                    # For parent display: show total if has children, otherwise show direct count
                    if child_categories and children_exist:
                        parent_display_count = parent_direct_count + children_total_count
                    else:
                        parent_display_count = parent_direct_count
                    
                    # Add parent category if it has any stories (direct or through children)
                    if parent_display_count > 0:
                        parent_display = f"{parent_category} ({parent_display_count})"
                        nested_options.append(parent_display)
                        category_value_mapping[parent_display] = parent_category
                        
                        # Add child categories with indentation
                        for child in child_categories:
                            if child in available_categories:
                                child_count = category_counts.get(child, 0)
                                if child_count > 0:
                                    child_display = f"⤷ {child} ({child_count})"
                                    nested_options.append(child_display)
                                    category_value_mapping[child_display] = child
            
            return nested_options, category_value_mapping
        
        # Build nested category options
        category_display_options, category_value_mapping = build_nested_category_options()
        
        selected_category_display = st.selectbox(
            get_text("category_filter"),
            category_display_options,
            index=0,
            key="category_filter",
            help=get_text("category_filter_help")
        )
        
        # Get the actual category value for filtering
        selected_category = category_value_mapping.get(selected_category_display, get_text("all_option"))
    
    with col3:
        # Enhanced Date filter with counts
        dates_list = sorted(list(filter_values['dates']), reverse=True)
        date_counts = {}
        
        # Count stories per date
        for item in news_data:
            published_date = item.get('published_date', '').strip()
            if published_date and published_date != 'Unknown':
                try:
                    date_part = published_date.split(' ')[0]
                    date_counts[date_part] = date_counts.get(date_part, 0) + 1
                except:
                    unknown_key = get_text("unknown")
                    date_counts[unknown_key] = date_counts.get(unknown_key, 0) + 1
            else:
                unknown_key = get_text("unknown")
                date_counts[unknown_key] = date_counts.get(unknown_key, 0) + 1
        
        # Create date options with counts
        date_display_options = [f"{get_text('all_option')} ({total_stories})"]
        date_value_mapping = {date_display_options[0]: get_text("all_option")}
        
        for date in dates_list:
            count = date_counts.get(date, 0)
            display_name = f"{date} ({count})"
            date_display_options.append(display_name)
            date_value_mapping[display_name] = date
        
        selected_date_display = st.selectbox(
            get_text("date_filter"),
            date_display_options,
            index=0,
            key="date_filter",
            help="Filter news by publication date. Numbers show story count per date."
        )
        
        # Get the actual date value for filtering
        selected_date = date_value_mapping.get(selected_date_display, get_text("all_option"))
    
    with col4:
        show_prompts = st.checkbox(
            "📜 Show AI Image Prompts",
            value=False,
            help="Display AI image generation prompts for top 3 trending news items",
            key="prompts_toggle"
        )
        
        # Developer Access Panel (Hidden from Regular Users)
        if show_prompts:
            with st.expander("🔧 Developer Tools", expanded=False):
                dev_password = st.text_input(
                    "Developer Access",
                    type="password",
                    help="Enter developer password to access debug information",
                    key="dev_password"
                )
                
                if st.button("🔓 Enable Developer Mode", key="enable_dev_mode"):
                    # Secure password check using environment variable
                    required_password = os.getenv('TRENDSIAM_DEV_PASSWORD')
                    if not required_password:
                        st.warning("⚠️ Developer mode not configured. Set TRENDSIAM_DEV_PASSWORD environment variable.")
                    elif dev_password == required_password:
                        st.session_state["dev_mode"] = True
                        st.success("✅ Developer mode enabled")
                        st.rerun()
                    elif dev_password:
                        st.error("❌ Invalid developer password")
                
                if st.session_state.get("dev_mode", False):
                    st.success("🔧 Developer Mode: ACTIVE")
                    if st.button("🔒 Disable Developer Mode", key="disable_dev_mode"):
                        st.session_state["dev_mode"] = False
                        st.info("Developer mode disabled")
                        st.rerun()
    
    st.markdown('</div>', unsafe_allow_html=True)
    
    return selected_platform, selected_category, selected_date, show_prompts, filter_values.get('category_counts', {})


def create_news_card(news_item: Dict[str, Any], index: int, show_prompts: bool = False, category_counts: Dict[str, int] = None):
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
        
        # Enhanced AI Image Display - Always show for top 3 trending news items
        display_result = display_ai_generated_image(
            news_item=news_item,
            item_index=index,
            show_debug=show_prompts
        )
        
        # Log any critical errors for debugging
        if display_result.get('critical_error'):
            logger.error(f"Critical image display error for item {index}: {display_result['critical_error']}")
        
        # Show illustration prompt (unified section - only for Top 3 displayed items)
        # Use the same display position logic as image display
        display_position_for_prompt = index + 1  # Convert 0-based index to 1-based position
            
        if show_prompts and display_position_for_prompt <= 3:
            # Priority 1: Use stored AI prompt if available
            ai_prompt = news_item.get('ai_image_prompt', '').strip()
            
            if ai_prompt:
                # Show the stored prompt from AI generation
                with st.expander("🎨 AI Image Generation Prompt", expanded=False):
                    st.markdown(f'<div class="illustration-prompt">{ai_prompt}</div>', unsafe_allow_html=True)
                    
                    # Copy button for stored prompt
                    if st.button(f"📋 Copy AI Prompt", key=f"copy_ai_prompt_{index}", help="Copy AI generation prompt to clipboard"):
                        st.code(ai_prompt, language="text")
                        st.success("✅ AI Prompt ready to copy!")
            else:
                # Priority 2: Generate fallback prompt for manual creation
                illustration_prompt = generate_editorial_illustration_prompt(news_item)
                
                with st.expander("🎨 Editorial Illustration Prompt", expanded=False):
                    st.markdown(f'<div class="illustration-prompt">{illustration_prompt}</div>', unsafe_allow_html=True)
                    st.caption("ℹ️ Generated prompt for manual image creation")
                    
                    # Copy button for generated prompt
                    if st.button(f"📋 Copy Generated Prompt", key=f"copy_generated_prompt_{index}", help="Copy generated prompt to clipboard"):
                        st.code(illustration_prompt, language="text")
                        st.success("✅ Generated Prompt ready to copy!")
        
        # Metadata grid
        st.markdown('<div class="news-meta">', unsafe_allow_html=True)
        
        # Channel
        if channel:
            st.markdown(f'<div class="news-meta-item">{get_text("channel_label")}: <strong>{channel}</strong></div>', unsafe_allow_html=True)
        
        # Category with hierarchy and count
        if category:
            if parent_category:
                category_display = f"{get_text('category_label')}: {parent_category} › {category}"
            else:
                category_display = f"{get_text('category_label')}: {category}"
            
            # Add category count with tooltip if available
            if category_counts and category in category_counts:
                count = category_counts[category]
                tooltip_text = get_text("category_count_tooltip")
                category_display += f' <span class="category-count-tooltip" title="{tooltip_text}">({count})</span>'
            
            # Add score tooltip if relevant (keeping existing functionality)
            if score >= 3:
                score_tooltip_text = get_text("category_score_tooltip")
                category_display += f' <span class="category-tooltip">({score})<span class="tooltiptext">{score_tooltip_text}</span></span>'
            
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
        
        # Original Source Link
        video_id = news_item.get('video_id', '').strip()
        if video_id:
            youtube_url = create_secure_youtube_url(video_id)
            if youtube_url:
                # Get localized labels using the text dictionary
                link_label = get_text("watch_on_youtube", current_lang)
                link_icon = "📺"
                
                # Create secure source link HTML
                source_link_html = create_source_link_html(youtube_url, link_label, link_icon)
                
                # Display the source link with enhanced styling
                st.markdown(f'<div class="news-meta-item source-link-item">{source_link_html}</div>', unsafe_allow_html=True)
        
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
        # Display popularity score if available (using precise score with fallback)
        score_precise = get_precise_score(news_item)
        popularity_reason = news_item.get('reason', '')
        
        if score_precise > 0:
            try:
                # Always show decimal score with 1 decimal place
                score_display = f"{score_precise:.1f}"
                # Use precise score for progress bar width (capped at 100)
                progress_width = min(score_precise, 100)
                
                # Create popularity section
                st.markdown('<div class="popularity-section">', unsafe_allow_html=True)
                
                # Score header and progress bar
                st.markdown(f'''
                <div class="popularity-header">
                    <div class="popularity-score">🔥 Popularity Score: {score_display}/100</div>
                </div>
                <div class="popularity-bar">
                    <div class="popularity-fill" style="width: {progress_width}%;"></div>
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
        
        # *** ADDED: View Details Expandable Section ***
        # Display view details if available
        view_details = news_item.get('view_details')
        
        if view_details and isinstance(view_details, dict):
            # Get the appropriate title based on current language
            view_details_title = get_text("view_details_title", current_lang)
            
            with st.expander(view_details_title, expanded=False):
                # Latest Views
                if 'views' in view_details and view_details['views']:
                    views_label = get_text("latest_views", current_lang)
                    st.markdown(f"• **{views_label}:** {view_details['views']}")
                
                # Growth Rate
                if 'growth_rate' in view_details and view_details['growth_rate']:
                    growth_label = get_text("growth_rate", current_lang)
                    st.markdown(f"• **{growth_label}:** {view_details['growth_rate']}")
                
                # Mentioned Platforms
                if 'platform_mentions' in view_details and view_details['platform_mentions']:
                    platforms_label = get_text("mentioned_platforms", current_lang)
                    st.markdown(f"• **{platforms_label}:** {view_details['platform_mentions']}")
                
                # Keyword Match
                if 'matched_keywords' in view_details and view_details['matched_keywords']:
                    keywords_label = get_text("keyword_match", current_lang)
                    st.markdown(f"• **{keywords_label}:** {view_details['matched_keywords']}")
                
                # AI Insight
                if 'ai_opinion' in view_details and view_details['ai_opinion']:
                    insight_label = get_text("ai_insight", current_lang)
                    st.markdown(f"• **{insight_label}:** {view_details['ai_opinion']}")
                
                # Score
                if 'score' in view_details and view_details['score']:
                    score_label = get_text("score_info", current_lang)
                    st.markdown(f"• **{score_label}:** {view_details['score']}")
        
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
    category_counts = {}  # Track category counts for enhanced UX
    
    for item in news_data:
        # Platform - assume all are YouTube for now, but could be extended
        platforms.add("YouTube")
        
        # Category - use enhanced classification
        category = item.get('auto_category', classify_news_item(item))
        categories.add(category)
        
        # Count categories for enhanced display
        category_counts[category] = category_counts.get(category, 0) + 1
        
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
        'dates': dates,
        'category_counts': category_counts  # Add category counts for enhanced UX
    }


# Safe conversion helpers (consistent with PDF generation system)
def safe_int(value, default=0):
    """Convert value to int safely"""
    try:
        return int(float(value)) if value is not None else default
    except (ValueError, TypeError):
        return default

def safe_float(value, default=0.0):
    """Convert value to float safely"""
    try:
        return float(value) if value is not None else default
    except (ValueError, TypeError):
        return default


def get_precise_score(item: Dict[str, Any]) -> float:
    """
    Get the most precise popularity score available for an item.
    
    Prioritizes popularity_score_precise but falls back to popularity_score
    for backward compatibility.
    
    Args:
        item: News item dictionary
        
    Returns:
        Float score (precise if available, otherwise fallback)
    """
    precise_score = item.get('popularity_score_precise')
    if precise_score is not None:
        try:
            return float(precise_score)
        except (ValueError, TypeError):
            pass
    
    # Fallback to regular score
    fallback_score = item.get('popularity_score')
    try:
        return float(fallback_score) if fallback_score is not None else 0.0
    except (ValueError, TypeError):
        return 0.0


def generate_view_details_analysis(news_item: Dict[str, Any]) -> Dict[str, str]:
    """
    Generate detailed view analysis from available news item data
    
    Args:
        news_item: Dictionary containing news data
        
    Returns:
        Dictionary with detailed analysis matching view_details structure
    """
    try:
        # Extract basic data
        view_count_str = news_item.get('view_count', '0')
        popularity_score = get_precise_score(news_item)
        reason = news_item.get('reason', '')
        title = news_item.get('title', '').lower()
        description = news_item.get('description', '').lower()
        like_count = safe_int(news_item.get('like_count', 0))
        comment_count = safe_int(news_item.get('comment_count', 0))
        
        # Parse view count
        views_numeric = parse_view_count(view_count_str)
        
        # Format views with appropriate suffix
        if views_numeric >= 1_000_000:
            views_formatted = f"{views_numeric / 1_000_000:.1f}M views"
        elif views_numeric >= 1_000:
            views_formatted = f"{views_numeric / 1_000:.1f}K views"
        else:
            views_formatted = f"{views_numeric:,} views"
        
        # Calculate estimated growth rate (assuming 1 week for trending videos)
        days_trending = 7  # Assume 1 week trending window
        avg_daily_views = views_numeric / days_trending if days_trending > 0 else views_numeric
        if avg_daily_views >= 1_000_000:
            growth_rate = f"~{avg_daily_views / 1_000_000:.1f}M avg/day"
        elif avg_daily_views >= 1_000:
            growth_rate = f"~{avg_daily_views / 1_000:.1f}K avg/day"
        else:
            growth_rate = f"~{avg_daily_views:,.0f} avg/day"
        
        # Detect platform mentions
        platform_mentions = []
        platforms_to_check = {
            'instagram': 'Instagram',
            'tiktok': 'TikTok', 
            'twitter': 'Twitter',
            'facebook': 'Facebook',
            'youtube': 'YouTube'
        }
        
        combined_text = f"{title} {description}".lower()
        for platform_key, platform_name in platforms_to_check.items():
            if platform_key in combined_text:
                platform_mentions.append(platform_name)
        
        platform_mentions_str = ', '.join(platform_mentions) if platform_mentions else "Primary platform only"
        
        # Extract viral keywords from title/description
        viral_keywords = []
        viral_patterns = [
            'blackpink', 'bts', 'lisa', 'jennie', 'rosé', 'jisoo',  # K-pop
            'live', 'stream', '🔴', 'ไลฟ์',  # Live content
            'vs', 'พบ', 'แข่ง', 'ปะทะ',  # Competition
            'minecraft', 'gaming', 'เกม',  # Gaming
            'ข่าว', 'news', 'breaking',  # News
            'official', 'mv', 'music video'  # Official content
        ]
        
        for keyword in viral_patterns:
            if keyword in combined_text:
                viral_keywords.append(keyword)
        
        if viral_keywords:
            matched_keywords = f"{len(viral_keywords)} keywords ({', '.join(viral_keywords[:3])}{'...' if len(viral_keywords) > 3 else ''})"
        else:
            matched_keywords = "No viral keywords detected"
        
        # Generate AI opinion based on content analysis
        ai_opinions = []
        
        # Engagement analysis
        if like_count > 0 and views_numeric > 0:
            like_ratio = (like_count / views_numeric) * 100
            if like_ratio > 3:
                ai_opinions.append("strong audience approval")
            elif like_ratio > 1:
                ai_opinions.append("positive audience reception")
        
        # Content type analysis
        if any(kw in combined_text for kw in ['blackpink', 'k-pop', 'music', 'mv']):
            ai_opinions.append("appeals to music and celebrity fans")
        elif any(kw in combined_text for kw in ['gaming', 'minecraft', 'เกม']):
            ai_opinions.append("targets gaming communities")
        elif any(kw in combined_text for kw in ['live', 'stream', 'ไลฟ์']):
            ai_opinions.append("benefits from real-time engagement")
        elif any(kw in combined_text for kw in ['sports', 'กีฬา', 'วอลเลย์บอล']):
            ai_opinions.append("attracts sports enthusiasts")
        
        # View range analysis
        if views_numeric > 50_000_000:
            ai_opinions.append("viral reach potential")
        elif views_numeric > 10_000_000:
            ai_opinions.append("mainstream appeal")
        elif views_numeric > 1_000_000:
            ai_opinions.append("broad audience engagement")
        
        ai_opinion = f"Likely appeals to {', '.join(ai_opinions[:2])} due to {'highly engaging' if popularity_score > 70 else 'appealing'} content."
        
        # Score information (always show decimal precision)
        score_info = f"{popularity_score:.1f}/100 (rule-based model)"
        
        return {
            'views': views_formatted,
            'growth_rate': growth_rate,
            'platform_mentions': platform_mentions_str,
            'matched_keywords': matched_keywords,
            'ai_opinion': ai_opinion,
            'score': score_info
        }
        
    except Exception as e:
        logger.warning(f"Error generating view details analysis: {e}")
        # Return basic fallback analysis
        return {
            'views': news_item.get('view_count', 'Unknown'),
            'growth_rate': 'Unable to calculate',
            'platform_mentions': 'Primary platform only',
            'matched_keywords': 'Analysis unavailable',
            'ai_opinion': 'Content analysis in progress.',
            'score': f"{get_precise_score(news_item):.1f}/100 (rule-based model)"
        }

def parse_view_count(view_count_str: str) -> int:
    """
    Parse view count string to integer for sorting (consistent with PDF system).
    
    Args:
        view_count_str: View count as string (e.g., "2,190,133" or "16,819,511")
        
    Returns:
        Integer value of view count, 0 if parsing fails
    """
    if not view_count_str or view_count_str == 'Unknown':
        return 0
    
    try:
        if isinstance(view_count_str, str):
            # Remove commas and 'views' text, then convert to int
            view_count_clean = view_count_str.replace(',', '').replace('views', '').strip()
            return safe_int(view_count_clean)
        else:
            return safe_int(view_count_str)
    except (ValueError, AttributeError):
        return 0


@st.cache_data(ttl=300)  # Cache image URL validation for 5 minutes
def validate_image_url(url: str) -> bool:
    """
    Validate if an image URL is accessible and returns a valid image.
    Cached to avoid repeated network calls for the same URL.
    
    Args:
        url: Image URL to validate
        
    Returns:
        bool: True if URL is valid and accessible, False otherwise
    """
    try:
        if not url or url.startswith('https://placeholder'):
            return False
            
        response = requests.head(url, timeout=5, allow_redirects=True)
        
        # Check if response is successful and content type is image
        if response.status_code == 200:
            content_type = response.headers.get('content-type', '').lower()
            return content_type.startswith('image/')
        
        return False
        
    except Exception:
        return False


def get_fallback_image_path() -> Optional[str]:
    """
    Get path to a fallback/placeholder image for when AI images are not available.
    
    Returns:
        str: Path to fallback image, or None if not available
    """
    # Check for a default fallback image
    fallback_candidates = [
        'ai_generated_images/fallback.png',
        'ai_generated_images/placeholder.png',
        'static/default_image.png'
    ]
    
    for candidate in fallback_candidates:
        fallback_path = Path(candidate)
        if fallback_path.exists() and fallback_path.stat().st_size > 0:
            return str(fallback_path)
    
    return None


def display_ai_generated_image(
    news_item: Dict[str, Any], 
    item_index: int, 
    show_debug: bool = False
) -> Dict[str, Any]:
    """
    Robust AI image display with clear fallback logic for top 3 news items.
    
    Args:
        news_item: The news item data
        item_index: Index of the item in the filtered/sorted display list (0-based)
        show_debug: Whether to show debug information
        
    Returns:
        Dict containing display status and any errors
    """
    result = {
        'displayed': False,
        'image_source': None,
        'error': None,
        'critical_error': None
    }
    
    try:
        # Extract basic data
        title = news_item.get('title', 'Unknown Title')
        video_id = news_item.get('video_id', '')
        display_position = item_index + 1  # Convert 0-based index to 1-based position
        
        # RULE: Only display images for Top 3 DISPLAYED items (positions 1, 2, 3)
        if display_position > 3:
            return result
        
        # Get image data from news item
        ai_image_local = news_item.get('ai_image_local', '').strip()
        ai_image_url = news_item.get('ai_image_url', '').strip()
        ai_prompt = news_item.get('ai_image_prompt', '').strip()
        
        # Position-based image path (primary strategy)
        position_based_image = f"ai_generated_images/image_{display_position}.png"
        
        # ROBUST FALLBACK LOGIC
        image_source = None
        image_source_type = None
        
        # Step 1: Try position-based local image (most reliable for sorted order)
        if os.path.exists(position_based_image):
            try:
                # Validate file size
                file_size = os.path.getsize(position_based_image)
                if file_size > 1024:  # At least 1KB
                    image_source = position_based_image
                    image_source_type = "position-based"
            except Exception as e:
                pass  # Silently continue to next fallback option
        
        # Step 2: Try original local image path (fallback)
        if not image_source and ai_image_local:
            # Handle Windows/Unix path separators
            normalized_path = ai_image_local.replace('\\', '/')
            
            if os.path.exists(normalized_path):
                try:
                    file_size = os.path.getsize(normalized_path)
                    if file_size > 1024:  # At least 1KB
                        image_source = normalized_path
                        image_source_type = "original-local"
                except Exception as e:
                    pass  # Silently continue to next fallback option
        
        # Step 3: Try remote URL (second fallback)
        if not image_source and ai_image_url:
            try:
                # Simple URL validation
                if ai_image_url.startswith('http') and validate_image_url(ai_image_url):
                    image_source = ai_image_url
                    image_source_type = "remote-url"
            except Exception as e:
                pass  # Silently continue to next step
        
        # Step 4: Display result
        if image_source:
            try:
                # Generate caption
                caption_parts = ["🤖 AI-Generated Editorial Illustration"]
                if ai_prompt:
                    # Extract category hint from prompt
                    category_hint = extract_category_from_prompt(ai_prompt) if ai_prompt else None
                    if category_hint:
                        caption_parts.append(f"📂 {category_hint}")
                
                full_caption = " • ".join(caption_parts)
                
                # Display the image
                st.image(
                    image_source,
                    caption=full_caption,
                    width=600,
                    use_container_width=False,
                    clamp=True
                )
                
                result['displayed'] = True
                result['image_source'] = image_source
                
                return result
                
            except Exception as e:
                error_msg = f"Failed to display image: {str(e)}"
                result['error'] = error_msg
                # Continue to next step silently
        
        return result
        
    except Exception as e:
        # Critical error handling
        critical_error = f"Critical error in image display: {str(e)}"
        result['critical_error'] = critical_error
        
        # Log error silently
        logger.error(f"Critical image display error: {critical_error}")
        
        return result


def enhanced_position_verification(news_item: Dict[str, Any], image_path: str, display_position: int) -> bool:
    """
    Enhanced verification that an image is appropriate for a specific display position.
    Uses display position as primary factor, with content as secondary verification.
    
    Args:
        news_item: The news item to verify against
        image_path: Path or URL of the image to verify
        display_position: Position in the display list (1-based)
        
    Returns:
        bool: True if image is appropriate for this display position
    """
    try:
        # Strategy 1: Position-based filename matching (most reliable)
        if isinstance(image_path, str):
            # Check if image filename matches expected pattern for this position
            if f"image_{display_position}" in str(image_path):
                return True
            
            # Check for position pattern in filename
            from pathlib import Path
            filename = Path(image_path).stem
            if f"_{display_position}" in filename or f"pos{display_position}" in filename.lower():
                return True
        
        # Strategy 2: Content-based verification as secondary check
        return enhanced_content_verification(news_item, image_path)
        
    except Exception:
        # If verification fails, be conservative but allow display
        # (Better to show potentially mismatched image than no image for top positions)
        return display_position <= 3


def find_position_fallback_image(display_position: int) -> Optional[str]:
    """
    Find a fallback image for a specific display position.
    
    Args:
        display_position: Position in the display list (1-based)
        
    Returns:
        str: Path to fallback image, or None if not found
    """
    try:
        # Strategy 1: Look for position-specific images
        ai_images_dir = Path('ai_generated_images')
        if ai_images_dir.exists():
            # Try exact position match first
            position_candidates = [
                f'image_{display_position}.png',
                f'pos_{display_position}.png',
                f'display_{display_position}.png'
            ]
            
            for candidate in position_candidates:
                candidate_path = ai_images_dir / candidate
                if candidate_path.exists() and candidate_path.stat().st_size > 1024:
                    return str(candidate_path)
            
            # Strategy 2: Use any available image as fallback (but prefer not to reuse)
            # Better to show no image than wrong image
            return None
        
        return None
        
    except Exception:
        return None


def enhanced_content_verification(news_item: Dict[str, Any], image_path: str) -> bool:
    """
    Enhanced content verification with multiple validation strategies.
    
    Args:
        news_item: The news item to verify against
        image_path: Path or URL of the image to verify
        
    Returns:
        bool: True if image matches the content with high confidence
    """
    try:
        # For now, use simplified verification based on current data structure
        # In a production system, you might add image content analysis here
        
        video_id = news_item.get('video_id', '')
        rank = news_item.get('rank', '')
        
        # Strategy 1: Direct video ID match in path
        if video_id and video_id in str(image_path):
            return True
        
        # Strategy 2: Rank-based matching for current simplified setup
        if rank and isinstance(image_path, str):
            try:
                rank_num = int(rank)
                # Check if image file name suggests it's for this rank
                if f"image_{rank_num}" in image_path or f"_{rank}" in image_path:
                    return True
            except (ValueError, TypeError):
                pass
        
        # Strategy 3: Use existing verification as fallback
        return verify_image_matches_content(news_item, image_path)
        
    except Exception:
        # If verification fails, be conservative but allow display
        # (Better to show potentially mismatched image than no image)
        return True


def generate_enhanced_caption(news_item: Dict[str, Any], image_type: str) -> str:
    """
    Generate an enhanced caption with content hints and metadata.
    
    Args:
        news_item: The news item data
        image_type: Type of image source (local, remote, fallback, default)
        
    Returns:
        str: Enhanced caption text
    """
    ai_prompt = news_item.get('ai_image_prompt', '')
    title = news_item.get('title', '')
    
    # Get content hint from prompt or title
    if ai_prompt:
        content_hint = extract_content_hint(ai_prompt)
    else:
        # Extract hint from title as fallback
        content_hint = extract_content_hint_from_title(title)
    
    # Add source indicator for transparency
    if image_type == "fallback":
        return f"{content_hint} (Auto-matched)"
    elif image_type == "default":
        return f"{content_hint} (Placeholder)"
    else:
        return content_hint


def extract_content_hint_from_title(title: str) -> str:
    """
    Extract content hint from news title when AI prompt is not available.
    
    Args:
        title: News title
        
    Returns:
        str: Content hint
    """
    if not title:
        return "News illustration"
    
    title_lower = title.lower()
    
    # Sports keywords
    if any(word in title_lower for word in ['volleyball', 'vnl', 'sports', 'match', 'game']):
        return "Sports illustration"
    if any(word in title_lower for word in ['football', 'soccer', 'fifa', 'chelsea', 'psg']):
        return "Football illustration"
    
    # Entertainment keywords
    if any(word in title_lower for word in ['blackpink', 'music', 'concert', 'performance']):
        return "Entertainment illustration"
    
    # News/Commentary keywords
    if any(word in title_lower for word in ['news', 'breaking', 'live', 'commentary']):
        return "News illustration"
    
    return "Editorial illustration"


def extract_category_from_prompt(ai_prompt: str) -> str:
    """
    Extract category information from AI prompt for enhanced metadata display.
    
    Args:
        ai_prompt: The AI generation prompt
        
    Returns:
        str: Category hint or empty string
    """
    if not ai_prompt:
        return ""
    
    prompt_lower = ai_prompt.lower()
    
    if any(word in prompt_lower for word in ['volleyball', 'sports', 'match', 'game', 'arena']):
        return "Sports"
    elif any(word in prompt_lower for word in ['football', 'soccer', 'stadium']):
        return "Football"
    elif any(word in prompt_lower for word in ['concert', 'performance', 'music', 'stage']):
        return "Entertainment"
    elif any(word in prompt_lower for word in ['news', 'editorial', 'journalism']):
        return "News"
    
    return ""


def verify_image_matches_content(news_item: Dict[str, Any], image_path: str) -> bool:
    """
    Verify that an image actually belongs to a specific news item by checking content consistency.
    Uses video_id, title keywords, and AI prompt correlation.
    
    Args:
        news_item: The news item to verify against
        image_path: Path or URL of the image to verify
        
    Returns:
        bool: True if image matches the content, False otherwise
    """
    try:
        video_id = news_item.get('video_id', '')
        title = news_item.get('title', '').lower()
        ai_prompt = news_item.get('ai_image_prompt', '').lower()
        
        # Check 1: Video ID should be reflected in the AI prompt or filename
        if video_id and video_id in ai_prompt:
            return True
            
        # Check 2: Key content words from title should appear in AI prompt
        title_keywords = extract_key_words(title)
        prompt_keywords = extract_key_words(ai_prompt)
        
        if title_keywords and prompt_keywords:
            # Calculate keyword overlap
            overlap = len(set(title_keywords) & set(prompt_keywords))
            overlap_ratio = overlap / len(title_keywords) if title_keywords else 0
            
            # If significant overlap, consider it a match
            if overlap_ratio >= 0.3:  # 30% keyword overlap threshold
                return True
        
        # Check 3: Check if image filename contains video_id pattern
        if video_id and isinstance(image_path, str):
            # Extract potential video ID from filename
            filename = Path(image_path).stem
            if video_id[:8] in filename or video_id[-8:] in filename:
                return True
        
        # If no strong correlation found, it might be a mismatch
        return False
        
    except Exception as e:
        # If verification fails, be conservative and assume no match
        logger.warning(f"Image verification failed: {e}")
        return False


def find_image_by_video_id(video_id: str) -> Optional[str]:
    """
    Find the correct image file for a specific video ID using multiple lookup strategies.
    
    Args:
        video_id: The YouTube video ID to find an image for
        
    Returns:
        str: Path to the correct image file, or None if not found
    """
    try:
        # Strategy 1: Look for images with video_id in filename
        ai_images_dir = Path('ai_generated_images')
        if ai_images_dir.exists():
            for image_file in ai_images_dir.glob('*.png'):
                if video_id in image_file.stem:
                    return str(image_file)
        
        # Strategy 2: Use a mapping file if it exists
        mapping_file = Path('image_video_mapping.json')
        if mapping_file.exists():
            try:
                with open(mapping_file, 'r', encoding='utf-8') as f:
                    mapping = json.load(f)
                return mapping.get(video_id)
            except Exception:
                pass
        
        # Strategy 3: Check if there's a single image that should match this video
        # (Fallback for current broken state)
        if ai_images_dir.exists():
            image_files = list(ai_images_dir.glob('*.png'))
            if len(image_files) == 1:
                # If only one image exists, it might be the right one
                return str(image_files[0])
        
        return None
        
    except Exception as e:
        logger.warning(f"Image lookup by video ID failed: {e}")
        return None


def extract_key_words(text: str) -> List[str]:
    """
    Extract key words from text for content matching.
    
    Args:
        text: Text to extract keywords from
        
    Returns:
        List of meaningful keywords
    """
    if not text:
        return []
    
    # Remove common words and extract meaningful terms
    common_words = {'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an',
                   'thai', 'thailand', 'video', 'youtube', 'news', 'live', 'vs', 'fifa', 'world', 'cup'}
    
    # Simple word extraction (you could use more sophisticated NLP here)
    words = []
    for word in text.split():
        # Clean word
        clean_word = ''.join(c for c in word.lower() if c.isalpha())
        # Keep meaningful words
        if len(clean_word) >= 3 and clean_word not in common_words:
            words.append(clean_word)
    
    return words[:10]  # Return top 10 keywords


def extract_content_hint(ai_prompt: str) -> str:
    """
    Extract a short content hint from AI prompt for display.
    
    Args:
        ai_prompt: The AI generation prompt
        
    Returns:
        Short descriptive hint
    """
    if not ai_prompt:
        return "Content-specific illustration"
    
    # Extract key phrases from prompt
    prompt_lower = ai_prompt.lower()
    
    # Look for sport/activity keywords
    sport_keywords = ['volleyball', 'football', 'soccer', 'basketball', 'tennis', 'sports', 'match', 'game']
    for keyword in sport_keywords:
        if keyword in prompt_lower:
            return f"{keyword.title()} illustration"
    
    # Look for music/entertainment keywords
    music_keywords = ['concert', 'performance', 'music', 'singing', 'band', 'artist', 'stage']
    for keyword in music_keywords:
        if keyword in prompt_lower:
            return f"{keyword.title()} illustration"
    
    # Look for specific entities
    if 'blackpink' in prompt_lower:
        return "K-pop performance"
    if 'chelsea' in prompt_lower or 'psg' in prompt_lower:
        return "Football match"
    if 'thailand' in prompt_lower and 'canada' in prompt_lower:
        return "International sports"
    
    # Default fallback
    return "Editorial illustration"


def sort_news_by_popularity(news_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Enhanced sort for news data with improved tie-breaking logic.
    
    Sorting priority:
    1. Popularity score (precise internal score for better tie-breaking)
    2. View count (higher views rank higher)
    3. Publish date (newer items rank higher)
    4. Original index (for consistency)
    
    Args:
        news_data: List of news items to sort
        
    Returns:
        Sorted list of news items (most popular first)
    """
    def sort_key(index_and_item):
        index, item = index_and_item
        
        # Primary sort: Enhanced popularity score with precision
        popularity_score_precise = get_precise_score(item)
        
        # Secondary sort: view_count (descending)
        view_count_str = item.get('view_count', '0')
        view_count = parse_view_count(view_count_str)
        
        # Tertiary sort: publish_date (newer first)
        published_date = item.get('published_date', '')
        date_score = 0
        if published_date and published_date != 'Unknown':
            try:
                from datetime import datetime
                # Extract date part and parse
                date_part = published_date.split(' ')[0]
                date_obj = datetime.strptime(date_part, '%Y-%m-%d')
                # Convert to timestamp for sorting (higher = newer)
                date_score = date_obj.timestamp()
            except (ValueError, IndexError):
                date_score = 0
        
        # Quaternary sort: original index (for consistent ordering when all else equal)
        original_index = index
        
        # Return tuple for sorting: negative values for descending order
        return (-popularity_score_precise, -view_count, -date_score, original_index)
    
    # Add indices to preserve original order information
    indexed_data = list(enumerate(news_data))
    sorted_indexed = sorted(indexed_data, key=sort_key)
    
    # Return just the items without indices
    return [item for index, item in sorted_indexed]


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
        
        # Enhanced category filter with hierarchical parent-child support
        if selected_category != all_option:
            item_category = item.get('auto_category', classify_news_item(item))
            item_metadata = item.get('category_metadata', {})
            item_parent_category = item_metadata.get('parent_category')
            
            # Define parent-child relationships for filtering
            category_hierarchy_filter = {
                "บันเทิง (Entertainment)": ["เกม/อนิเมะ (Games/Anime)"],
                "กีฬา (Sports)": [],
                "การเมือง/ข่าวทั่วไป (Politics/General News)": [],
                "การศึกษา (Education)": [],
                "ไลฟ์สไตล์ (Lifestyle)": [],
                "ธุรกิจ / การเงิน (Business / Finance)": [],
                "สุขภาพ (Health)": [],
                "อื่นๆ (Others)": [],
                "ไม่ระบุ (Unknown)": []
            }
            
            category_matches = False
            
            # Direct category match
            if item_category == selected_category:
                category_matches = True
            # If selected is a parent category, include all its children
            elif selected_category in category_hierarchy_filter:
                child_categories = category_hierarchy_filter[selected_category]
                if item_category in child_categories:
                    category_matches = True
            # Legacy parent category support
            elif item_parent_category == selected_category:
                category_matches = True
            
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
                    st.warning("🔐 OPENAI_API_KEY not found. Please set it in your .env file.")
            
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
            
            # Enhanced Generation logic
            if generate_button:
                final_api_key = env_api_key if use_env_key else api_key_input
                
                if final_api_key:
                    with st.spinner("🎨 Generating NEW AI images... This may take 2-3 minutes."):
                        st.info("⚡ Using enhanced generation system - always creates fresh images!")
                        st.warning("🔄 This will OVERWRITE any existing images to ensure fresh content!")
                        
                        try:
                            # Import the enhanced AI image generator
                            from ai_image_generator import generate_ai_images_for_top3_news
                            
                            # Enhanced progress indicator
                            progress_bar = st.progress(0)
                            status_text = st.empty()
                            
                            status_text.text("📊 Analyzing top news by popularity...")
                            progress_bar.progress(10)
                            
                            status_text.text("🗑️ Force deleting old images...")
                            progress_bar.progress(30)
                            
                            status_text.text("🎨 Generating NEW images with DALL-E 3...")
                            progress_bar.progress(50)
                            
                            # Generate images with enhanced system
                            result = generate_ai_images_for_top3_news(final_api_key)
                            progress_bar.progress(100)
                            
                            if result['success']:
                                successful = result.get('successful', 0)
                                processed = result.get('processed', 0)
                                
                                st.success(f"✅ {result['message']}")
                                st.info(f"🎉 Generated {successful} fresh AI images successfully!")
                                st.balloons()
                                
                                # Show enhanced generation details
                                with st.expander("📊 Enhanced Generation Details", expanded=True):
                                    st.write(f"**Successfully generated:** {successful}/{processed} images")
                                    st.write(f"**Files created:** image_1.png, image_2.png, image_3.png")
                                    st.write(f"**Location:** ai_generated_images/ directory")
                                    st.write(f"**Cost estimate:** ~${successful * 0.04:.2f}")
                                    st.write("**Features:** Enhanced prompts, force overwrite, sanitized content")
                                    
                                    if result.get('errors'):
                                        st.write("**Errors encountered:**")
                                        for error in result['errors']:
                                            st.write(f"• {error}")
                                
                                st.info("🔄 AI images are always displayed for top 3 news. Use '📜 Show AI Image Prompts' to see generation prompts!")
                                
                                # Enhanced auto-refresh with data reload
                                if st.button("🔄 Refresh Page to See NEW Images", type="primary"):
                                    # Clear any cached data and force reload
                                    for key in list(st.session_state.keys()):
                                        if 'cache' in key.lower():
                                            del st.session_state[key]
                                    st.rerun()
                            else:
                                st.error(f"❌ {result['message']}")
                                
                                # Show enhanced error details
                                processed = result.get('processed', 0)
                                errors = result.get('errors', [])
                                
                                if processed > 0:
                                    st.warning(f"📊 Processed {processed} items")
                                
                                if errors:
                                    with st.expander("📋 Detailed Error Information"):
                                        for i, error in enumerate(errors, 1):
                                            st.write(f"{i}. {error}")
                                
                                # Enhanced troubleshooting tips
                                with st.expander("🔧 Enhanced Troubleshooting", expanded=True):
                                    st.write("""
                                    **Common Issues & Solutions:**
                                    
                                    🔑 **API Key Issues:**
                                    - Ensure your OpenAI API key is valid and active
                                    - Check that your key has DALL-E 3 access
                                    - Verify sufficient credits in your OpenAI account
                                    
                                    ⏱️ **Rate Limiting:**
                                    - Wait 1-2 minutes between generation attempts
                                    - DALL-E has strict rate limits for safety
                                    
                                    📁 **File System Issues:**
                                    - Ensure ai_generated_images/ directory exists
                                    - Check file write permissions
                                    - Verify sufficient disk space
                                    
                                    🌐 **Network Issues:**
                                    - Check internet connection stability
                                    - Verify firewall doesn't block OpenAI API
                                    - Try again if connection was interrupted
                                    
                                    📝 **Content Issues:**
                                    - News content might violate OpenAI policies
                                    - Enhanced sanitization should handle most cases
                                    - Check if news data is properly loaded
                                    """)
                            
                            # Clean up progress indicators
                            progress_bar.empty()
                            status_text.empty()
                                    
                        except ImportError:
                            st.error("❌ Enhanced AI image generator module not found. Please ensure ai_image_generator.py is available.")
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
    
    # Load news data using unified system (same as Weekly Report and PDF)
    with st.spinner(get_text("loading_news")):
        news_data = load_news_data()  # Fixed: Use load_news_data() for main page instead of load_weekly_data()

        
        # Add category classification and view_details analysis for each news item (if not already present)
        for item in news_data:
            if 'auto_category' not in item:
                classification_result = classify_news_item_with_metadata(item)
                item['auto_category'] = classification_result['category']
                item['category_metadata'] = {
                    'category': classification_result['category'],
                    'parent_category': classification_result['parent_category'],
                    'score': classification_result['score']
                }
            
            # Generate view_details analysis if missing
            if 'view_details' not in item or not item['view_details']:
                item['view_details'] = generate_view_details_analysis(item)
    
    # Display filters and news items
    if news_data:
        # Success message
        st.markdown(f'<div class="stats-badge">{get_text("found_news").format(count=len(news_data))}</div>', unsafe_allow_html=True)
        st.markdown("<br>", unsafe_allow_html=True)
        
        # Display compact filter controls
        selected_platform, selected_category, selected_date, show_prompts, category_counts = create_compact_filters(news_data)
        
        # Apply filters to data
        filtered_data = filter_news_data(news_data, selected_platform, selected_category, selected_date)
        print(f"🔍 DEBUG: After filtering - {len(filtered_data)} items from {len(news_data)} total")
        
        # Sort by popularity score (descending), then by view count (descending)
        filtered_data = sort_news_by_popularity(filtered_data)
        print(f"🔍 DEBUG: After sorting - {len(filtered_data)} items ready for display")
        
        # Show filter results
        if len(filtered_data) != len(news_data):
            st.info(get_text("filtered_news").format(filtered=len(filtered_data), total=len(news_data)))
        
        st.markdown("<br>", unsafe_allow_html=True)
        
        # Display filtered news items as modern cards
        if filtered_data:

            for index, news_item in enumerate(filtered_data):
                create_news_card(news_item, index, show_prompts, category_counts)
            
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
        get_text("weekly_report"),
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
    elif selected_page == get_text("weekly_report"):
        show_weekly_report()
    elif selected_page == get_text("terms_of_use"):
        show_terms_of_use()
    elif selected_page == get_text("privacy_policy"):
        show_privacy_policy()


def generate_editorial_illustration_prompt(news_item: Dict[str, Any]) -> str:
    """
    Generate intelligent, context-aware editorial illustration prompts.
    Uses auto_category and content analysis to create category-specific prompts
    that accurately reflect the type of content (games, sports, music, etc.).
    This function provides fallback prompts for manual image creation in the UI.
    
    Args:
        news_item: Dictionary containing news data with title, summary, auto_category, etc.
        
    Returns:
        Context-specific prompt for creating editorial-style illustration
    """
    # Get news details
    title = news_item.get('title', '').lower()
    summary = news_item.get('summary', '').lower()
    summary_en = news_item.get('summary_en', '').lower()
    channel = news_item.get('channel', '').lower()
    category = news_item.get('auto_category', 'Uncategorized')
    
    # Combine content for analysis
    combined_content = f"{title} {summary} {summary_en} {channel}"
    
    # Base prompt template
    base_prompt = "Editorial-style illustration for trending Thai news: "
    
    # Use category-based intelligent prompts
    if "เกม/อนิเมะ (Games/Anime)" in category:
        # Specific game detection
        if any(game in combined_content for game in ['honkai star rail', 'honkai: star rail', 'hsr']):
            return f"{base_prompt}Futuristic space adventure scene with starships and cosmic landscapes. Sci-fi aesthetic with star trains and galaxy backgrounds. Anime-style character silhouettes in space exploration setting. Clean editorial illustration style."
        
        elif any(game in combined_content for game in ['genshin impact', 'genshin', 'teyvat']):
            return f"{base_prompt}Fantasy adventure landscape with magical elements and floating islands. Mystical world with elemental symbols and ancient architecture. Anime-style fantasy aesthetic with magical crystals and enchanted environments."
        
        elif any(game in combined_content for game in ['rov', 'realm of valor', 'mobile legends']):
            return f"{base_prompt}MOBA battle arena with strategic game elements. Fantasy heroes and competitive gaming symbols. Esports tournament atmosphere with game interface elements and tactical visualization."
        
        elif any(term in combined_content for term in ['minecraft', 'roblox']):
            return f"{base_prompt}Block-building creative world with pixelated geometric structures. Family-friendly gaming environment with construction elements and colorful landscapes. Creative sandbox aesthetic."
        
        elif any(term in combined_content for term in ['trailer', 'character trailer', 'gameplay']):
            return f"{base_prompt}Game promotional scene with dynamic character action. Cinematic gaming aesthetic with special effects and polished visual presentation. Professional game marketing style."
        
        else:
            return f"{base_prompt}Modern gaming culture with controllers and digital entertainment elements. Contemporary gaming lifestyle with monitors and interactive technology. Clean gaming aesthetic."
    
    elif "กีฬา (Sports)" in category:
        if any(sport in combined_content for sport in ['volleyball', 'วอลเลย์บอล', 'vnl']):
            return f"{base_prompt}Volleyball competition scene with players in action poses. Professional court with net and team coordination. International tournament atmosphere with sporting excellence."
        
        elif any(sport in combined_content for sport in ['football', 'ฟุตบอล', 'soccer']):
            return f"{base_prompt}Football/soccer match with players in competitive action. Stadium environment with goals and strategic team play. Athletic performance and sportsmanship focus."
        
        elif any(sport in combined_content for sport in ['basketball', 'บาสเกตบอล']):
            return f"{base_prompt}Basketball game with dynamic shooting and defensive action. Indoor court with hoops and fast-paced athletic movement. Team strategy and individual excellence."
        
        else:
            return f"{base_prompt}Athletic competition with sporting excellence and teamwork. Professional sports venue with athletes demonstrating skill. Competitive spirit and achievement focus."
    
    elif "บันเทิง (Entertainment)" in category:
        # Music content
        if any(term in combined_content for term in ['official mv', 'music video', 'mv', 'เพลง', 'song', 'artist', 'singer']):
            return f"{base_prompt}Music performance with stage lighting and concert atmosphere. Artists performing with instruments and sound equipment. Live music energy and audience engagement."
        
        # Movie/Film content
        elif any(term in combined_content for term in ['movie', 'film', 'cinema', 'trailer', 'premiere']):
            return f"{base_prompt}Film industry scene with movie production elements. Professional film set with cameras and lighting equipment. Cinematic atmosphere with artistic direction."
        
        # TV/Series content
        elif any(term in combined_content for term in ['series', 'ซีรีส์', 'drama', 'ละคร', 'episode']):
            return f"{base_prompt}Television production with dramatic storytelling elements. Professional TV studio with filming equipment. Actors in character with compelling performances."
        
        else:
            return f"{base_prompt}Entertainment industry with creative performance and artistic expression. Professional venue with stage elements and audience engagement."
    
    elif "การเมือง/ข่าวทั่วไป (Politics/General News)" in category:
        return f"{base_prompt}News reporting scene with journalists and press conference setting. Professional media environment with microphones and cameras. Democratic discourse and information sharing."
    
    elif "การศึกษา (Education)" in category:
        return f"{base_prompt}Educational environment with learning and knowledge sharing. Modern classroom with students and teaching materials. Academic excellence and educational achievement."
    
    elif "ไลฟ์สไตล์ (Lifestyle)" in category:
        return f"{base_prompt}Lifestyle and daily living with modern life activities. Contemporary choices and personal wellness themes. Quality of life and lifestyle trends."
    
    elif "ธุรกิจ/การเงิน (Business/Finance)" in category:
        return f"{base_prompt}Business and finance with professional corporate environment. Modern office with meetings and financial planning. Economic growth and business success."
    
    elif "สุขภาพ (Health)" in category:
        return f"{base_prompt}Healthcare with medical professionals and modern facilities. Clean medical environment with healthcare workers. Health and wellness focus with professional care."
    
    else:
        # Generic news illustration
        return f"{base_prompt}General news scene depicting the described activity. Professional journalism with information sharing and media coverage. Editorial newspaper illustration style."

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


def show_weekly_report():
    """Display the weekly report page with PDF download functionality"""
    # Check if PDF generation dependencies are available
    if not WEASYPRINT_AVAILABLE or not HTML_FUNCTIONS_AVAILABLE:
        st.error("⚠️ PDF generation unavailable: WeasyPrint or HTML functions not installed")
        return
    
    from datetime import datetime, timedelta
    import glob
    from collections import defaultdict
    import tempfile
    import base64
    
    # Create unified header
    create_unified_header()
    
    # Main content
    st.markdown(f"# {get_text('weekly_report_title')}")
    st.markdown(f"*{get_text('weekly_report_subtitle')}*")
    
    # Calculate date range (past 7 days)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=7)
    
    st.markdown(f"**{get_text('weekly_report_period')}:** {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")
    st.markdown("---")
    
    # Load and aggregate weekly data
    with st.spinner(get_text("weekly_report_loading")):
        weekly_data = load_weekly_data()
    
    if not weekly_data:
        st.warning(get_text("weekly_report_no_data"))
        return
    
    # Display summary statistics
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("📊 Total Stories", len(weekly_data))
    
    with col2:
        avg_views = sum(int(item.get('view_count', '0').replace(',', '')) for item in weekly_data) / len(weekly_data) if weekly_data else 0
        st.metric("👀 Avg Views", f"{avg_views:,.0f}")
    
    with col3:
        categories = set(item.get('auto_category', 'Unknown') for item in weekly_data)
        st.metric("📂 Categories", len(categories))
    
    with col4:
        # Always use precise scores with decimal display
        top_score = max((get_precise_score(item) for item in weekly_data), default=0)
        st.metric("⭐ Top Score", f"{top_score:.1f}/100")
    
    st.markdown("---")
    
    # Top Stories Section
    st.markdown(f"## {get_text('weekly_report_top_stories')}")
    
    # 🎯 AUDIT: Debug logging for story count verification
    logger.info(f"🔍 UI AUDIT: Processing {len(weekly_data)} total stories for display")
    
    # Sort by popularity score and prepare top stories (using precise scores)
    sorted_stories = sorted(weekly_data, key=lambda x: get_precise_score(x), reverse=True)
    
    # 🎯 TARGET: Always try to show exactly 10 stories
    target_story_count = 10
    top_stories = sorted_stories[:target_story_count]
    
    # 📊 Debug logging
    logger.info(f"📊 UI DISPLAY: Showing {len(top_stories)}/{len(sorted_stories)} stories (target: {target_story_count})")
    
    if len(top_stories) < target_story_count:
        st.warning(f"⚠️ Notice: Only {len(top_stories)} stories available (target: {target_story_count})")
        logger.warning(f"⚠️ UI WARNING: Only {len(top_stories)} stories available, expected {target_story_count}")
    
    # Display stories with enhanced logging
    for i, story in enumerate(top_stories, 1):
        story_title = story.get('title', 'No Title')
        story_score = get_precise_score(story)
        
        # 📝 Debug log each story being displayed
        logger.debug(f"📰 UI Story #{i}: Score={story_score:.1f} | Title='{story_title[:50]}...'")
        
        with st.expander(f"#{i} - {story_title[:80]}..."):
            col1, col2 = st.columns([2, 1])
            
            with col1:
                st.markdown(f"**📺 Channel:** {story.get('channel', 'Unknown')}")
                st.markdown(f"**🏷️ Category:** {story.get('auto_category', 'Unknown')}")
                st.markdown(f"**📝 Summary (TH):** {story.get('summary', 'No summary')}")
                st.markdown(f"**📝 Summary (EN):** {story.get('summary_en', 'No summary')}")
            
            with col2:
                st.metric("👀 Views", story.get('view_count', '0'))
                # Always show precise scores with decimal display
                st.metric("⭐ Score", f"{story_score:.1f}/100")
                st.markdown(f"📅 {story.get('published_date', 'Unknown')}")
    
    # 📊 Final verification logging
    logger.info(f"✅ UI COMPLETE: Successfully displayed {len(top_stories)} stories in weekly report")
    
    # News by Category Section  
    st.markdown("---")
    st.markdown(f"## {get_text('weekly_report_by_category')}")
    
    # Group by category
    category_data = defaultdict(list)
    for story in weekly_data:
        category = story.get('auto_category', 'Unknown')
        category_data[category].append(story)
    
    # Display category breakdown
    for category, stories in category_data.items():
        if stories:  # Only show categories with data
            avg_score = sum(get_precise_score(story) for story in stories) / len(stories)
            st.markdown(f"### {category} ({len(stories)} stories)")
            st.markdown(f"Average popularity score: **{avg_score:.1f}/100**")
            
            # Show top 3 stories in this category
            top_category_stories = sorted(stories, key=lambda x: get_precise_score(x), reverse=True)[:3]
            for story in top_category_stories:
                story_score = get_precise_score(story)
                st.markdown(f"- **{story.get('title', 'No Title')[:60]}...** (Score: {story_score:.1f})")
    
    # Professional PDF Download Section
    st.markdown("---")
    
    # Create a centered, prominent download section
    download_container = st.container()
    with download_container:
        # Professional title and description
        st.markdown(f"""
        <div style="text-align: center; margin: 2rem 0;">
            <h2 style="color: #1f77b4; margin-bottom: 0.5rem;">
                📄 Professional Intelligence Report (PDF)
            </h2>
            <p style="color: #666; font-size: 1.1rem; margin-bottom: 1rem;">
                Executive-ready analysis in English format for international stakeholders
            </p>
            <div style="background: #f0f8ff; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; border-left: 4px solid #1f77b4;">
                <p style="margin: 0; color: #333; font-size: 0.95rem;">
                    📊 <strong>This report includes {len(weekly_data)} trending stories</strong> from YouTube Thailand<br>
                    🌐 <strong>English-only format</strong> optimized for analysts, investors, and corporate clients<br>
                    📈 <strong>Professional layout</strong> with performance metrics, trend analysis, and executive summary
                </p>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        # Features highlight
        col1, col2, col3 = st.columns(3)
        
        with col1:
            st.markdown("""
            <div style="text-align: center; padding: 1rem; background: #f8f9fa; border-radius: 10px; margin-bottom: 1rem;">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">📊</div>
                <div style="font-weight: bold; color: #333;">Professional Layout</div>
                <div style="font-size: 0.9rem; color: #666;">Modern design with charts & metrics</div>
            </div>
            """, unsafe_allow_html=True)
        
        with col2:
            st.markdown("""
            <div style="text-align: center; padding: 1rem; background: #f8f9fa; border-radius: 10px; margin-bottom: 1rem;">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">🇺🇸</div>
                <div style="font-weight: bold; color: #333;">English-Only Format</div>
                <div style="font-size: 0.9rem; color: #666;">Professional international format</div>
            </div>
            """, unsafe_allow_html=True)
        
        with col3:
            st.markdown("""
            <div style="text-align: center; padding: 1rem; background: #f8f9fa; border-radius: 10px; margin-bottom: 1rem;">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">📱</div>
                <div style="font-weight: bold; color: #333;">Ready to Share</div>
                <div style="font-size: 0.9rem; color: #666;">Print or digital sharing</div>
            </div>
            """, unsafe_allow_html=True)
        
        # Centered download button
        col1, col2, col3 = st.columns([1, 2, 1])
        with col2:
            st.markdown("<div style='text-align: center; margin: 2rem 0;'>", unsafe_allow_html=True)
            
            if st.button(
                f"📄 {get_text('download_pdf')} (PDF)", 
                type="primary",
                help="Generate and download a professional PDF report",
                use_container_width=True
            ):
                with st.spinner(get_text("generating_pdf")):
                    try:
                        pdf_bytes = generate_weekly_pdf(weekly_data, start_date, end_date)
                        if pdf_bytes:
                            # Create download link with better styling
                            b64_pdf = base64.b64encode(pdf_bytes).decode()
                            filename = f"TrendSiam_Weekly_Report_{start_date.strftime('%Y%m%d')}.pdf"
                            
                            # Success message with download link
                            st.success(f"✅ {get_text('pdf_generated')}")
                            
                            # Prominent download link
                            download_link = f"""
                            <div style="text-align: center; margin: 1rem 0;">
                                <a href="data:application/pdf;base64,{b64_pdf}" 
                                   download="{filename}"
                                   style="display: inline-block; 
                                          padding: 12px 24px; 
                                          background: #28a745; 
                                          color: white; 
                                          text-decoration: none; 
                                          border-radius: 8px; 
                                          font-weight: bold;
                                          box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                    📄 Download PDF Report
                                </a>
                            </div>
                            <div style="text-align: center; margin-top: 0.5rem;">
                                <small style="color: #666;">File: {filename} • Size: {len(pdf_bytes):,} bytes</small>
                            </div>
                            """
                            st.markdown(download_link, unsafe_allow_html=True)
                            
                            # Additional info
                            st.info("💡 **Tip**: Right-click the download link and choose 'Save As' if the PDF opens in your browser")
                            
                        else:
                            st.error(f"❌ {get_text('pdf_error')}")
                    except Exception as e:
                        st.error(f"❌ {get_text('pdf_error')}: {str(e)}")
                        logger.error(f"PDF generation error: {e}")
            
            st.markdown("</div>", unsafe_allow_html=True)
        
        # Additional information
        with st.expander("📋 What's included in the PDF report?", expanded=False):
            st.markdown("""
            **🧩 Executive Summary**
            • Total stories analyzed
            • Total views and average views  
            • Content sources and story count
            
            **📈 Top Stories Analysis**
            • 10 trending stories with key metrics
            • Channel and category breakdown
            • Performance scores and view share
            
            **🗂 Category Performance**
            • Stories grouped by category
            • Avg. scores and view distribution
            • Clean tabular format with visual clarity
            
            **🎯 Professional Formatting**
            • English-only layout
            • Print-ready design
            • Page numbers and footers
            """)
        
        # Sample preview note
        st.markdown("""
        <div style="text-align: center; margin-top: 2rem; padding: 1rem; background: #e3f2fd; border-radius: 8px;">
            <small style="color: #1565c0;">
                📋 <strong>Note:</strong> The PDF report contains {total_stories} stories from {num_files} data sources, 
                covering {num_categories} categories with intelligent categorization.
            </small>
        </div>
        """.format(
            total_stories=len(weekly_data),
            num_files=len([f for f in Path('.').glob('thailand_trending_*summary*.json')]),
            num_categories=len(set(item.get('auto_category', 'อื่นๆ (Others)') for item in weekly_data))
        ), unsafe_allow_html=True)


def load_weekly_data():
    """Load and aggregate news data from the past 7 days with enhanced strategy to ensure 10 stories and complete analysis"""
    import re
    import glob
    from pathlib import Path
    
    try:
        current_time = datetime.now()
        seven_days_ago = current_time - timedelta(days=7)
        
        # 🎯 PRIORITY 1: Check main summary file first (has complete view_details analysis)
        main_file = Path("thailand_trending_summary.json")
        if main_file.exists():
            try:
                with open(main_file, 'r', encoding='utf-8') as f:
                    main_data = json.load(f)
                
                # Check if this file has complete analysis data
                has_analysis = any(
                    item.get('view_details') and isinstance(item.get('view_details'), dict)
                    for item in main_data[:3]  # Check first 3 items
                )
                
                if has_analysis and len(main_data) >= 5:
                    logger.info("✅ Using main summary file with complete analysis data")
                    filtered_data = filter_by_published_date(main_data, seven_days_ago)
                    if len(filtered_data) >= 5:
                        logger.info(f"📊 Main file strategy: {len(filtered_data)} stories with complete analysis")
                        return filtered_data
                    else:
                        logger.info(f"⚠️ Main file has only {len(filtered_data)} recent stories, trying backup files...")
            except Exception as e:
                logger.warning(f"Error reading main summary file: {e}")
        
        # Step 2: Find all potential JSON files with flexible naming patterns
        json_files = find_valid_summary_files(seven_days_ago, current_time)
        
        if not json_files:
            # Fallback to the main summary file (backward compatibility)
            logger.info("No dated files found, falling back to main summary file")
            return load_from_main_summary_file()
        
        # 🎯 STRATEGY 2: Try most recent backup file to get 10 stories
        logger.info(f"Found {len(json_files)} potential backup files, trying smart loading strategy...")
        
        # Sort files by date (most recent first)
        json_files.sort(key=lambda x: x[1], reverse=True)
        
        # Step 2A: Try loading from the most recent file first
        most_recent_file, most_recent_date = json_files[0]
        logger.info(f"🎯 STRATEGY 1: Loading from most recent file: {most_recent_file}")
        
        try:
            with open(most_recent_file, 'r', encoding='utf-8') as f:
                recent_data = json.load(f)
            
            # Validate and clean the data
            if isinstance(recent_data, list):
                valid_items = []
                for item in recent_data:
                    if isinstance(item, dict) and 'title' in item:
                        # Add intelligent category assignment if missing
                        if not item.get('auto_category') or item.get('auto_category') == 'Unknown':
                            item['auto_category'] = assign_smart_category(item)
                        valid_items.append(item)
                
                if len(valid_items) >= 8:  # If we have at least 8 stories, use this file
                    logger.info(f"✅ SUCCESS: Found {len(valid_items)} stories in most recent file - using single file strategy")
                    
                    # 🎯 WEEKLY REPORT STRATEGY: Very lenient date filtering (30 days) for single file
                    # This ensures we don't lose high-value stories like BLACKPINK due to strict date filtering
                    weekly_cutoff = current_time - timedelta(days=30)
                    filtered_data = filter_by_published_date(valid_items, weekly_cutoff)
                    
                    logger.info(f"📊 WEEKLY STRATEGY: Applied 30-day filter: {len(filtered_data)}/{len(valid_items)} stories")
                    
                    # If we still don't have enough stories after lenient filtering, skip filtering entirely
                    if len(filtered_data) < 8:
                        logger.warning(f"⚠️ Even with 30-day filter, only {len(filtered_data)} stories. Using all stories without date filter.")
                        filtered_data = valid_items
                    
                    logger.info(f"📊 FINAL COUNT: {len(filtered_data)} stories ready for display")
                    return filtered_data
                else:
                    logger.info(f"⚠️ Most recent file only has {len(valid_items)} stories, trying multi-file strategy...")
                    
        except Exception as e:
            logger.warning(f"Failed to load most recent file {most_recent_file}: {e}")
        
        # Step 2B: Multi-file strategy with smart deduplication
        logger.info("🔄 STRATEGY 2: Multi-file loading with enhanced deduplication...")
        combined_data = []
        
        for file_path, file_date in json_files:
            try:
                logger.info(f"Loading additional data from: {file_path}")
                with open(file_path, 'r', encoding='utf-8') as f:
                    file_data = json.load(f)
                
                # Validate that the file contains a list of news items
                if not isinstance(file_data, list):
                    logger.warning(f"Skipping {file_path}: Expected list format")
                    continue
                
                # Validate that each item has required fields
                valid_items = []
                for item in file_data:
                    if isinstance(item, dict) and 'title' in item:
                        # Add source file info for deduplication priority
                        item['_source_file'] = str(file_path)
                        item['_source_date'] = file_date
                        valid_items.append(item)
                
                if valid_items:
                    logger.info(f"Loaded {len(valid_items)} valid items from {file_path}")
                    combined_data.extend(valid_items)
                else:
                    logger.warning(f"No valid items found in {file_path}")
                    
            except (json.JSONDecodeError, IOError) as e:
                logger.warning(f"Failed to load {file_path}: {e}")
                continue
        
        logger.info(f"📊 BEFORE DEDUPLICATION: {len(combined_data)} total stories from {len(json_files)} files")
        
        # Step 3: Enhanced deduplication that preserves best stories
        unique_data = remove_duplicate_news_items_enhanced(combined_data)
        logger.info(f"📊 AFTER DEDUPLICATION: {len(unique_data)} unique stories")
        
        # Step 4: Apply very lenient date filtering for multi-file strategy  
        # Use 30-day cutoff to ensure we don't lose valuable stories
        weekly_cutoff = current_time - timedelta(days=30)
        recent_data = filter_by_published_date(unique_data, weekly_cutoff)
        
        # If still not enough stories, skip date filtering entirely
        if len(recent_data) < 8:
            logger.warning(f"⚠️ Multi-file strategy: Even with 30-day filter, only {len(recent_data)} stories. Using all stories without date filter.")
            recent_data = unique_data
        
        logger.info(f"📊 FINAL RESULT: {len(recent_data)} stories ready for weekly report")
        
        # If still less than 8 stories, try main file as last resort
        if len(recent_data) < 8:
            logger.warning(f"Only {len(recent_data)} stories found, trying main summary file as fallback...")
            fallback_data = load_from_main_summary_file()
            if len(fallback_data) > len(recent_data):
                logger.info(f"Main file has {len(fallback_data)} stories, using that instead")
                return fallback_data
        
        return recent_data
        
    except Exception as e:
        logger.error(f"Error loading weekly data: {e}")
        # Fallback to main file if anything goes wrong
        return load_from_main_summary_file()


def find_valid_summary_files(start_date, end_date):
    """Find valid summary JSON files within the date range using flexible naming patterns"""
    import re
    from pathlib import Path
    
    valid_files = []
    
    # Define safe filename patterns (prevent path traversal)
    patterns = [
        "thailand_trending_summary*.json",
        "thailand_trending_*summary*.json",
        "*thailand*trending*summary*.json"
    ]
    
    # Date extraction regex patterns for different filename formats
    date_patterns = [
        r'(\d{4})-?(\d{2})-?(\d{2})',  # YYYY-MM-DD or YYYYMMDD
        r'(\d{4})(\d{2})(\d{2})',      # YYYYMMDD (compact)
        r'(\d{2})(\d{2})(\d{4})',      # DDMMYYYY  
    ]
    
    try:
        current_dir = Path('.')
        
        for pattern in patterns:
            # Use glob to find matching files (safe - only in current directory)
            for file_path in current_dir.glob(pattern):
                # Security check: ensure file is in current directory only
                if not is_safe_file_path(file_path):
                    continue
                
                # Extract date from filename
                file_date = extract_date_from_filename(file_path.name, date_patterns)
                
                if file_date and start_date <= file_date <= end_date:
                    valid_files.append((file_path, file_date))
        
        # Sort by date (most recent first) and remove duplicates
        valid_files = list(set(valid_files))  # Remove duplicates
        valid_files.sort(key=lambda x: x[1], reverse=True)
        
        return valid_files
        
    except Exception as e:
        logger.error(f"Error finding summary files: {e}")
        return []


def extract_date_from_filename(filename, date_patterns):
    """Safely extract date from filename using regex patterns"""
    import re
    
    try:
        for pattern in date_patterns:
            match = re.search(pattern, filename)
            if match:
                groups = match.groups()
                
                if len(groups) == 3:
                    # Try different date formats
                    try:
                        # Format 1: YYYY-MM-DD
                        if len(groups[0]) == 4:  # Year first
                            year, month, day = int(groups[0]), int(groups[1]), int(groups[2])
                        else:  # DD-MM-YYYY
                            day, month, year = int(groups[0]), int(groups[1]), int(groups[2])
                        
                        # Validate date components
                        if 1 <= month <= 12 and 1 <= day <= 31 and 2020 <= year <= 2030:
                            return datetime(year, month, day)
                    except ValueError:
                        continue
        
        return None
        
    except Exception as e:
        logger.warning(f"Error extracting date from filename {filename}: {e}")
        return None


def is_safe_file_path(file_path):
    """Security check to ensure file path is safe and within current directory"""
    try:
        file_path = Path(file_path).resolve()
        current_dir = Path('.').resolve()
        
        # Check if file is within current directory
        return str(file_path).startswith(str(current_dir))
    except Exception:
        return False


def remove_duplicate_news_items(data):
    """Remove duplicate news items based on video_id or title (legacy function)"""
    seen_ids = set()
    seen_titles = set()
    unique_data = []
    
    for item in data:
        # Use video_id as primary key for deduplication
        video_id = item.get('video_id', '')
        title = item.get('title', '').strip().lower()
        
        # Create a unique identifier
        identifier = video_id if video_id else title
        
        if identifier and identifier not in seen_ids:
            seen_ids.add(identifier)
            if title:
                seen_titles.add(title)
            
            # Add intelligent category assignment if missing
            if not item.get('auto_category') or item.get('auto_category') == 'Unknown':
                item['auto_category'] = assign_smart_category(item)
            
            unique_data.append(item)
    
    return unique_data


def remove_duplicate_news_items_enhanced(data):
    """Enhanced deduplication that preserves the best version of each story"""
    logger.info(f"🔄 Starting enhanced deduplication for {len(data)} stories...")
    
    # Group stories by identifier (video_id or title)
    story_groups = {}
    
    for item in data:
        # Use video_id as primary key for deduplication
        video_id = item.get('video_id', '')
        title = item.get('title', '').strip().lower()
        
        # Create a unique identifier
        identifier = video_id if video_id else title
        
        if identifier:
            if identifier not in story_groups:
                story_groups[identifier] = []
            story_groups[identifier].append(item)
    
    # Select the best version of each story
    unique_data = []
    duplicates_removed = 0
    
    for identifier, versions in story_groups.items():
        if len(versions) == 1:
            # No duplicates, just add the story
            best_story = versions[0]
        else:
            # Multiple versions found, select the best one
            duplicates_removed += len(versions) - 1
            logger.debug(f"📝 Found {len(versions)} versions of story: {versions[0].get('title', 'Unknown')[:40]}...")
            
            # Scoring criteria for selecting best version (in order of priority):
            # 1. Highest popularity score
            # 2. Most recent source file
            # 3. More complete data (more fields)
            def score_story(story):
                score = 0
                
                # Primary: Popularity score (most important)
                popularity = get_precise_score(story)
                if popularity > 0:
                    score += popularity * 1000  # Scale up for priority
                
                # Secondary: Source file recency
                source_date = story.get('_source_date')
                if source_date:
                    try:
                        # More recent files get higher scores
                        days_old = (datetime.now() - source_date).days
                        score += max(0, 100 - days_old)  # Newer = higher score
                    except:
                        pass
                
                # Tertiary: Data completeness
                required_fields = ['title', 'channel', 'view_count', 'published_date', 'summary']
                completeness = sum(1 for field in required_fields if story.get(field))
                score += completeness * 10
                
                return score
            
            # Select the best version
            best_story = max(versions, key=score_story)
            
            # Log the selection for transparency
            best_score = get_precise_score(best_story)
            logger.debug(f"  ✅ Selected version with score {best_score:.1f} from {best_story.get('_source_file', 'unknown')}")
        
        # Add intelligent category assignment if missing
        if not best_story.get('auto_category') or best_story.get('auto_category') == 'Unknown':
            best_story['auto_category'] = assign_smart_category(best_story)
        
        # Clean up temporary metadata
        for temp_field in ['_source_file', '_source_date']:
            best_story.pop(temp_field, None)
        
        unique_data.append(best_story)
    
    logger.info(f"✅ Enhanced deduplication complete: {len(unique_data)} unique stories (removed {duplicates_removed} duplicates)")
    return unique_data


def assign_smart_category(item):
    """
    Intelligently assign category based on title, channel, description, and summaries.
    Uses weighted scoring and enhanced keyword matching to reduce misclassification.
    Enhanced version with comprehensive keyword lists and better fallback rules.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Extract and clean content
    title = item.get('title', '').lower()
    channel = item.get('channel', '').lower()
    description = item.get('description', '').lower()
    summary = item.get('summary', '').lower()
    summary_en = item.get('summary_en', '').lower()
    
    # Remove common failure phrases from summaries for cleaner analysis
    if summary_en.startswith('summary failed'):
        summary_en = ''
    if summary.startswith('สรุปไม่สำเร็จ'):
        summary = ''
    
    # Enhanced music detection function - runs before main categorization
    def is_music_content():
        """
        Detect if content is clearly music-related to prevent misclassification.
        Returns True if content is definitively music-related.
        """
        # High-confidence music indicators
        strong_music_keywords = [
            'lyrics', 'เนื้อเพลง', 'lyric', 'official mv', 'music video', 
            'มิวสิควีดีโอ', 'audio', 'cover', 'คัฟเวอร์', 'acoustic',
            'song', 'เพลง', 'single', 'ซิงเกิล', 'album', 'อัลบั้ม',
            'feat', 'featuring', 'ft', 'remix', 'รีมิกซ์'
        ]
        
        # Music-specific patterns in title (most reliable)
        music_title_patterns = [
            'official mv', 'music video', 'lyrics', 'lyric', 'audio',
            'cover', 'acoustic', 'live version', 'remix', 'feat',
            'ft ', ' x ', 'official audio', 'official music video'
        ]
        
        # Check title for strong music indicators
        for pattern in music_title_patterns:
            if pattern in title:
                logger.info(f"🎵 Music Detection: Title contains '{pattern}' - classifying as Entertainment")
                return True
        
        # Check for music streaming/record labels in channel
        music_channels = [
            'records', 'music', 'official', 'entertainment', 'gmmtv',
            'rs music', 'kamikaze', 'spicy disc', 'what the duck',
            'sony music', 'universal music', 'warner music', 'emi music'
        ]
        
        for music_ch in music_channels:
            if music_ch in channel and any(kw in title for kw in strong_music_keywords):
                logger.info(f"🎵 Music Detection: Music channel '{music_ch}' + music keywords - classifying as Entertainment")
                return True
        
        # Check for artist names + music keywords combination
        artist_indicators = ['official', 'ศิลปิน', 'artist', 'singer', 'นักร้อง']
        music_indicators = ['mv', 'music', 'เพลง', 'song', 'audio', 'live']
        
        has_artist = any(ind in title or ind in channel for ind in artist_indicators)
        has_music = any(ind in title for ind in music_indicators)
        
        if has_artist and has_music:
            logger.info(f"🎵 Music Detection: Artist + music keywords combination - classifying as Entertainment")
            return True
        
        return False
    
    # Early music detection to prevent misclassification
    if is_music_content():
        return 'บันเทิง (Entertainment)'
    
    # Enhanced Sports keywords with more comprehensive coverage
    sports_keywords = [
        'football', 'soccer', 'ฟุตบอล', 'บอล', 'วอลเลย์บอล', 'volleyball', 'vnl',
        'basketball', 'บาสเกตบอล', 'tennis', 'เทนนิส', 'badminton', 'แบดมินตัน',
        'swimming', 'ว่ายน้ำ', 'olympic', 'โอลิมปิก', 'championship', 'แชมป์',
        'match', 'แมตช์', 'sport', 'กีฬา', 'team', 'ทีม', 'vs', 'พบ',
        'player', 'นักเตะ', 'goal', 'ประตู', 'score', 'คะแนน', 'league', 'ลีก',
        'fifa', 'uefa', 'premier league', 'champions league', 'world cup',
        # Additional sports
        'boxing', 'มวย', 'wrestling', 'มวยปล้ำ', 'mma', 'cycling', 'จักรยาน',
        'athletics', 'กรีฑา', 'marathon', 'มาราธอน', 'tournament', 'ทัวร์นาเมนต์'
    ]
    
    # Enhanced Entertainment keywords with comprehensive streaming and music coverage
    entertainment_keywords = [
        # Core music keywords - high priority for music detection
        'music', 'เพลง', 'mv', 'official mv', 'music video', 'มิวสิควีดีโอ',
        'lyrics', 'เนื้อเพลง', 'lyric', 'audio', 'เสียง', 'sound', 'เพลงใหม่',
        'cover', 'คัฟเวอร์', 'acoustic', 'live', 'สด', 'concert', 'คอนเสิร์ต',
        'singer', 'นักร้อง', 'vocalist', 'นักร้องนำ', 'band', 'วง', 'group',
        'album', 'อัลบั้ม', 'ep', 'single', 'ซิงเกิล', 'track', 'เพลง',
        'song', 'บทเพลง', 'melody', 'ทำนอง', 'rhythm', 'จังหวะ',
        
        # Artist and music industry terms
        'artist', 'ศิลปิน', 'musician', 'นักดนตรี', 'composer', 'นักแต่งเพลง',
        'songwriter', 'ผู้แต่งเพลง', 'producer', 'โปรดิวเซอร์', 'record label',
        'collaboration', 'คอลแลบ', 'featuring', 'feat', 'ft', 'duet', 'ดูเอต',
        'remix', 'รีมิกซ์', 'mashup', 'แมชอัพ', 'recording', 'การบันทึก',
        
        # Music genres and styles
        'pop', 'rock', 'jazz', 'blues', 'country', 'hip hop', 'rap', 'แร็พ',
        'electronic', 'dance', 'ballad', 'บัลลาด', 'folk', 'classical',
        'kpop', 'เคป็อป', 'jpop', 'thai pop', 'เพลงไทย', 'indie', 'อินดี้',
        
        # Popular artists and groups (for better detection)
        'blackpink', 'bts', 'twice', 'itzy', 'aespa', 'newjeans', 'ive',
        'taylor swift', 'ariana grande', 'billie eilish', 'ed sheeran',
        'the weeknd', 'dua lipa', 'coldplay', 'maroon 5', 'imagine dragons',
        
        # Thai artists and music
        'ไทย', 'thai', 'ลูกทุ่ง', 'ลูกกรุง', 'พลอยเชิญ', 'ปาล์มมี่', 'fourth nattawat',
        'gmmtv', 'rs', 'kamikaze', 'spicy disc', 'what the duck',
        
        # Entertainment industry
        'movie', 'หนัง', 'film', 'ภาพยนตร์', 'series', 'ซีรีส์', 'drama', 'ละคร',
        'actor', 'นักแสดง', 'actress', 'นักแสดงหญิง', 'celebrity', 'เซเลบ',
        'entertainment', 'บันเทิง', 'show', 'รายการ', 'performance', 'การแสดง',
        
        # Streaming and media keywords
        'netflix', 'disney', 'disney+', 'hbo', 'hbo max', 'amazon prime', 'paramount+',
        'apple tv', 'youtube premium', 'viu', 'iqiyi', 'wetv', 'line tv',
        'spotify', 'apple music', 'youtube music', 'soundcloud', 'deezer',
        'trailer', 'ตัวอย่าง', 'teaser', 'preview', 'premiere', 'รอบปฐมทัศน์',
        'documentary', 'สารคดี', 'streaming', 'สตรีมมิ่ง', 'episode', 'ตอน',
        'season', 'ซีซั่น', 'finale', 'จบซีซั่น', 'pilot', 'ตอนนำร่อง',
        
        # Performance and live events
        'live performance', 'การแสดงสด', 'stage', 'เวที', 'festival', 'เทศกาล',
        'tour', 'ทัวร์', 'world tour', 'fanmeeting', 'แฟนมีตติ้ง'
    ]
    
    # Enhanced Gaming/Anime keywords with music exclusion logic
    def is_gaming_but_not_music(content_title, content_channel):
        """
        Check if content is gaming-related but not music.
        Prevents music content from being classified as gaming.
        """
        # Music exclusion keywords - if these are present, likely NOT gaming
        music_exclusions = [
            'lyrics', 'lyric', 'official mv', 'music video', 'audio', 'cover',
            'acoustic', 'song', 'single', 'album', 'feat', 'featuring', 'remix'
        ]
        
        # If it contains strong music indicators, don't classify as gaming
        for exclusion in music_exclusions:
            if exclusion in content_title:
                return False
        
        return True
    
    gaming_keywords = [
        # Core gaming terms
        'minecraft', 'gaming', 'เกม', 'game', 'gameplay', 'stream', 'streamer',
        'anime', 'อนิเมะ', 'manga', 'มังงะ', 'cosplay', 'คอสเพลย์',
        'esports', 'อีสปอร์ต', 'tournament', 'ทัวร์นาเมนต์',
        # Enhanced gaming keywords for better PUBG/esports detection
        'พับจี', 'ศึกพับจี', 'nations cup', 'เนชั่นส์คัพ',
        'battlegrounds', 'แบทเทิลกราวน์ด', 'garena', 'กรีนา',
        'แข่งขัน', 'competition', 'championship', 'แชมเปียนชิพ',
        'ศึก', 'การแข่งขัน', 'final stage', 'รอบชิงชนะเลิศ',
        'team thailand', 'ทีมไทย', 'ทีมชาติ', 'pro player', 'โปรเพลเยอร์',
        'gaming team', 'ทีมเกม', 'squad', 'สควด', 'live gaming', 'เกมสด',
        'gaming stream', 'สตรีมเกม', 'game broadcast', 'ถ่ายทอดเกม',
        'rov', 'realm of valor', 'เรียลโอฟวาเลอร์', 'ฟรีไฟร์',
        'โมบายเลเจนด์', 'วาโลแรนต์', 'ลีกออฟเลเจนด์', 'แอลโอแอล',
        
        # HIGH PRIORITY: Popular games that are often misclassified
        'honkai star rail', 'honkai: star rail', 'honkai', 'star rail', 'hsr',
        'genshin impact', 'genshin', 'mihoyo', 'hoyoverse', 'teyvat',
        'trailblazer', 'stellaron', 'jarilo', 'belobog', 'luofu',
        'wuthering waves', 'wuwa', 'kuro games', 'punishing gray raven',
        'azure lane', 'arknights', 'girls frontline', 'epic seven',
        'fate grand order', 'fgo', 'granblue fantasy', 'gbf',
        'final fantasy', 'ff', 'ff14', 'ffxiv', 'final fantasy xiv',
        
        # Game-specific terms that should override entertainment
        'character trailer', 'game trailer', 'gameplay trailer', 'combat showcase',
        'skill showcase', 'ultimate showcase', 'character guide', 'build guide',
        'gacha', 'pull', 'summon', 'banner', 'limited banner', 'rate up',
        'tier list', 'meta', 'artifact', 'weapon', 'constellation', 'eidolon',
        'relic', 'lightcone', 'team comp', 'rotation', 'dps', 'support',
        
        # Popular AAA games and franchises
        'marvel rivals', 'rivals', 'superhero', 'ซูเปอร์ฮีโร่', 'marvel', 'dc comics',
        'fortnite', 'pubg', 'valorant', 'lol', 'league of legends', 'dota',
        'call of duty', 'cod', 'warzone', 'apex legends', 'overwatch',
        'fifa', 'pes', 'efootball', 'gta', 'grand theft auto', 'red dead',
        'assassins creed', 'far cry', 'cyberpunk', 'witcher', 'elder scrolls',
        'fallout', 'halo', 'destiny', 'battlefield', 'tekken', 'street fighter',
        
        # Mobile and casual games
        'roblox', 'minecraft', 'among us', 'fall guys', 'pokemon', 'โปเกมอน',
        'mobile legends', 'free fire', 'clash of clans',
        'clash royale', 'brawl stars', 'candy crush', 'subway surfers',
        
        # Nintendo games
        'mario', 'zelda', 'nintendo', 'switch', 'animal crossing', 'splatoon',
        'super smash bros', 'kirby', 'metroid', 'donkey kong',
        
        # Console and platform terms
        'playstation', 'xbox', 'nintendo switch', 'steam', 'epic games',
        'pc gaming', 'mobile gaming', 'ios gaming', 'android gaming',
        'console gaming', 'handheld', 'portable gaming',
        
        # Gaming content types
        'walkthrough', 'guide', 'tips', 'tricks', 'tutorial', 'speedrun',
        'mod', 'mods', 'modding', 'update', 'patch', 'dlc', 'expansion',
        'beta', 'alpha', 'early access', 'review', 'รีวิวเกม',
        "let's play", 'gameplay', 'การเล่น', 'live stream gaming',
        
        # Gaming community terms
        'gamer', 'เกมเมอร์', 'pro player', 'rank', 'ranking', 'competitive',
        'casual gaming', 'hardcore gaming', 'indie game', 'retro gaming',
        'gaming chair', 'gaming setup', 'rgb', 'mechanical keyboard',
        
        # Anime and related content
        'otaku', 'โอตากุ', 'weeb', 'จีบุ', 'vtuber', 'virtual youtuber',
        'light novel', 'visual novel', 'dating sim', 'jrpg', 'anime game'
    ]
    
    # Politics/News keywords with better coverage
    politics_keywords = [
        'news', 'ข่าว', 'breaking', 'live', 'สด', 'urgent', 'ด่วน',
        'government', 'รัฐบาล', 'politics', 'การเมือง', 'election', 'เลือกตั้ง',
        'prime minister', 'นายกรัฐมนตรี', 'minister', 'รัฐมนตรี', 'parliament', 'รัฐสภา',
        'policy', 'นโยบาย', 'economy', 'เศรษฐกิจ', 'crisis', 'วิกฤต',
        'current affairs', 'กิจการปัจจุบัน', 'political', 'ทางการเมือง',
        'debate', 'การอภิปราย', 'vote', 'โหวต', 'campaign', 'หาเสียง'
    ]
    
    # Education keywords
    education_keywords = [
        'education', 'การศึกษา', 'school', 'โรงเรียน', 'university', 'มหาวิทยาลัย',
        'student', 'นักเรียน', 'teacher', 'ครู', 'exam', 'สอบ',
        'course', 'หลักสูตร', 'tutorial', 'สอน', 'learn', 'เรียน',
        'knowledge', 'ความรู้', 'skill', 'ทักษะ', 'scholarship', 'ทุนการศึกษา',
        'degree', 'ปริญญา', 'graduation', 'จบการศึกษา', 'academic', 'วิชาการ'
    ]
    
    # Lifestyle keywords
    lifestyle_keywords = [
        'lifestyle', 'ไลฟ์สไตล์', 'fashion', 'แฟชั่น', 'food', 'อาหาร',
        'travel', 'ท่องเที่ยว', 'beauty', 'ความงาม', 'health', 'สุขภาพ',
        'fitness', 'ฟิตเนส', 'cooking', 'ทำอาหาร', 'recipe', 'สูตร',
        'vlog', 'daily', 'routine', 'กิจวัตร', 'wellness', 'สุขภาวะ',
        'makeup', 'แต่งหน้า', 'skincare', 'ดูแลผิว', 'hairstyle', 'ทรงผม'
    ]
    
    # Business/Finance keywords
    business_keywords = [
        'business', 'ธุรกิจ', 'finance', 'การเงิน', 'investment', 'การลงทุน',
        'stock', 'หุ้น', 'market', 'ตลาด', 'economy', 'เศรษฐกิจ',
        'money', 'เงิน', 'bank', 'ธนาคาร', 'cryptocurrency', 'คริปโต',
        'bitcoin', 'trading', 'เทรด', 'startup', 'สตาร์ทอัพ',
        'entrepreneur', 'ผู้ประกอบการ', 'profit', 'กำไร', 'revenue', 'รายได้'
    ]
    
    # Health keywords
    health_keywords = [
        'health', 'สุขภาพ', 'medical', 'การแพทย์', 'doctor', 'หมอ',
        'hospital', 'โรงพยาบาล', 'covid', 'โควิด', 'vaccine', 'วัคซีน',
        'medicine', 'ยา', 'treatment', 'การรักษา', 'wellness', 'สุขภาวะ',
        'mental health', 'สุขภาพจิต', 'nutrition', 'โภชนาการ', 'exercise', 'ออกกำลังกาย'
    ]
    
    # Category mapping with keywords
    categories = {
        'กีฬา (Sports)': sports_keywords,
        'บันเทิง (Entertainment)': entertainment_keywords,
        'เกม/อนิเมะ (Games/Anime)': gaming_keywords,
        'การเมือง/ข่าวทั่วไป (Politics/General News)': politics_keywords,
        'การศึกษา (Education)': education_keywords,
        'ไลฟ์สไตล์ (Lifestyle)': lifestyle_keywords,
        'ธุรกิจ/การเงิน (Business/Finance)': business_keywords,
        'สุขภาพ (Health)': health_keywords
    }
    
    # Enhanced weighted scoring system with source tracking
    def calculate_weighted_score(keywords, field_weights):
        """Calculate weighted score for a category based on field importance"""
        total_score = 0
        matched_keywords = []
        source_fields = []
        field_scores = {}
        
        for field_name, (content, weight) in field_weights.items():
            if not content:
                continue
                
            field_matches = [kw for kw in keywords if kw in content]
            if field_matches:
                field_score = len(field_matches) * weight
                total_score += field_score
                matched_keywords.extend(field_matches)
                source_fields.append(f"{field_name}({len(field_matches)})")
                field_scores[field_name] = field_score
        
        return total_score, matched_keywords, source_fields, field_scores
    
    # Enhanced field weights with priority boost for gaming content
    def get_field_weights_for_category(category):
        """Get field weights that can be adjusted based on category type"""
        base_weights = {
            'title': (title, 3),          # Title gets 3x weight
            'channel': (channel, 2.5),    # Channel gets 2.5x weight (increased)
            'summary_en': (summary_en, 2), # English summary gets 2x weight
            'summary': (summary, 1.5),    # Thai summary gets 1.5x weight
            'description': (description, 1) # Description gets 1x weight
        }
        
        # Boost gaming keyword detection with higher weights
        if category == 'เกม/อนิเมะ (Games/Anime)':
            return {
                'title': (title, 4),          # Higher title weight for gaming
                'channel': (channel, 3.5),    # Much higher channel weight for gaming  
                'summary_en': (summary_en, 2.5), # Higher summary weight for gaming
                'summary': (summary, 2),      # Higher Thai summary weight
                'description': (description, 1.5) # Higher description weight
            }
        
        return base_weights
    
    # Score each category with enhanced weighted scoring
    category_scores = {}
    classification_debug = {}
    
    for category, keywords in categories.items():
        # Special handling for Games/Anime category to prevent music misclassification
        if category == 'เกม/อนิเมะ (Games/Anime)':
            # Only score gaming if it's not obviously music content
            if not is_gaming_but_not_music(title, channel):
                logger.info(f"🎵 Gaming Exclusion: Skipping Games/Anime classification due to music indicators")
                continue
        
        # Get appropriate field weights for this category
        field_weights = get_field_weights_for_category(category)
        
        score, matched_keywords, source_fields, field_scores = calculate_weighted_score(keywords, field_weights)
        if score > 0:
            category_scores[category] = score
            classification_debug[category] = {
                'score': score,
                'keywords': matched_keywords[:8],  # Top 8 matched keywords
                'sources': source_fields,
                'field_scores': field_scores
            }
    
    # Get the best category if any scored above 0
    if category_scores:
        best_category = max(category_scores, key=category_scores.get)
        best_score = category_scores[best_category]
        debug_info = classification_debug[best_category]
        
        # Enhanced logging with source field information
        logger.info(f"📋 Classification: '{item.get('title', 'Unknown')[:50]}...' → {best_category}")
        logger.info(f"   Score: {best_score:.1f}, Keywords: {debug_info['keywords']}")
        logger.info(f"   Sources: {debug_info['sources']}")
        logger.info(f"   Field Scores: {debug_info['field_scores']}")
        
        return best_category
    
    # Enhanced fallback rules with comprehensive channel patterns and GAME PRIORITY
    enhanced_fallback_rules = [
        # HIGH PRIORITY: Game company/publisher channels (check first)
        (['honkai star rail', 'honkai: star rail', 'genshin impact', 'mihoyo', 'hoyoverse',
          'riot games', 'valve', 'blizzard', 'activision', 'ubisoft', 'ea games',
          'nintendo', 'playstation', 'xbox', 'steam', 'epic games', 'garena'],
         'เกม/อนิเมะ (Games/Anime)'),
        
        # Gaming channels and patterns
        (['gaming', 'games', 'gamer', 'twitch', 'youtube gaming', 'gamespot', 'ign', 
          'pc gaming', 'mobile gaming', 'esports', 'speedrun', 'walkthrough',
          'pro player', 'competitive gaming', 'game review', 'game guide'], 
         'เกม/อนิเมะ (Games/Anime)'),
        
        # Entertainment, music, and streaming channels (but LOWER priority than gaming)
        (['music', 'records', 'entertainment', 'tv', 'media', 'netflix', 'disney', 'hbo',
          'paramount', 'warner', 'universal', 'sony pictures', 'mgm', 'streaming',
          'movie', 'film', 'series', 'drama', 'gmmtv',
          'rs music', 'kamikaze', 'spicy disc', 'what the duck', 'sony music',
          'universal music', 'warner music', 'emi music', 'capitol records'], 
         'บันเทิง (Entertainment)'),
        
        # Sports channels  
        (['sport', 'football', 'fifa', 'nba', 'espn', 'fox sports', 'goal', 'olympics',
          'premier league', 'champions league', 'world cup', 'volleyball', 'basketball'], 
         'กีฬา (Sports)'),
        
        # News and politics channels
        (['news', 'cnn', 'bbc', 'reuters', 'associated press', 'breaking', 'politics',
          'government', 'current affairs', 'journalism', 'reporter'], 
         'การเมือง/ข่าวทั่วไป (Politics/General News)'),
        
        # Educational channels
        (['education', 'tutorial', 'learn', 'course', 'university', 'academy',
          'knowledge', 'skill', 'how to', 'guide'], 
         'การศึกษา (Education)'),
        
        # Lifestyle channels
        (['lifestyle', 'vlog', 'daily', 'beauty', 'fashion', 'travel', 'food',
          'cooking', 'recipe', 'fitness', 'health'], 
         'ไลฟ์สไตล์ (Lifestyle)'),
    ]
    
    # Apply enhanced fallback rules with detailed logging
    for patterns, category in enhanced_fallback_rules:
        matched_patterns = [pattern for pattern in patterns if pattern in channel]
        if matched_patterns:
            logger.info(f"📋 Fallback Classification: '{item.get('title', 'Unknown')[:50]}...' → {category}")
            logger.info(f"   Triggered by channel patterns: {matched_patterns}")
            logger.info(f"   Channel: '{channel}'")
            return category
    
    # Additional fallback - check for strong title indicators with GAME PRIORITY
    title_fallback_rules = [
        # HIGH PRIORITY: Known game names in titles (check first)
        (['honkai star rail', 'honkai: star rail', 'genshin impact', 'rov', 'realm of valor',
          'mobile legends', 'pubg', 'valorant', 'league of legends', 'dota', 'call of duty',
          'fortnite', 'apex legends', 'overwatch', 'fifa', 'pokemon', 'minecraft',
          'final fantasy', 'character trailer', 'game trailer', 'gameplay trailer'],
         'เกม/อนิเมะ (Games/Anime)'),
        
        # Gaming titles with specific patterns  
        (['gameplay', 'walkthrough', 'speedrun', 'gaming', "let's play", 'mod', 'beta',
          'game review', 'เกม', 'guide', 'tips', 'tricks', 'build guide', 'tier list',
          'gacha', 'pull', 'summon', 'banner', 'meta', 'dps', 'support', 'rank', 'pro player'], 
         'เกม/อนิเมะ (Games/Anime)'),
        
        # Entertainment and music titles (BUT check for game exclusions first)
        (['official mv', 'music video', 'concert', 'live performance', 'behind the scenes',
          'lyrics', 'lyric', 'audio', 'cover', 'acoustic', 'remix', 'feat', 'featuring',
          'single', 'album', 'song', 'live version', 'official audio'], 
         'บันเทิง (Entertainment)'),
        
        # Sports titles
        (['vs', 'match', 'championship', 'tournament', 'league', 'world cup'], 
         'กีฬา (Sports)'),
    ]
    
    # CRITICAL: Add special logic for game trailers that might be marked as entertainment
    def is_game_trailer(title_text, channel_text):
        """Special detection for game trailers that might be confused with entertainment"""
        game_trailer_indicators = [
            'character trailer', 'game trailer', 'gameplay trailer', 'honkai', 'genshin',
            'rov', 'mobile legends', 'valorant', 'league of legends', 'final fantasy',
            'trailblazer', 'star rail', 'mihoyo', 'hoyoverse', 'riot games'
        ]
        
        combined_text = f"{title_text} {channel_text}".lower()
        
        for indicator in game_trailer_indicators:
            if indicator in combined_text:
                return True
        return False
    
    # Check for game trailers BEFORE applying other fallback rules
    if is_game_trailer(title, channel):
        logger.info(f"🎮 Game Trailer Detection: '{item.get('title', 'Unknown')[:50]}...' → เกม/อนิเมะ (Games/Anime)")
        logger.info(f"   Detected as game trailer based on title/channel content")
        return 'เกม/อนิเมะ (Games/Anime)'
    
    for patterns, category in title_fallback_rules:
        matched_patterns = [pattern for pattern in patterns if pattern in title]
        if matched_patterns:
            logger.info(f"📋 Title Fallback Classification: '{item.get('title', 'Unknown')[:50]}...' → {category}")
            logger.info(f"   Triggered by title patterns: {matched_patterns}")
            return category
    
    # Final fallback - log detailed information for debugging
    logger.info(f"📋 Default Classification: '{item.get('title', 'Unknown')[:50]}...' → อื่นๆ (Others)")
    logger.info(f"   No keywords matched.")
    logger.info(f"   Title: '{title[:50]}...'")
    logger.info(f"   Channel: '{channel[:30]}...'")
    logger.info(f"   Summary (EN): '{summary_en[:30]}...' (available: {bool(summary_en)})")
    logger.info(f"   Summary (TH): '{summary[:30]}...' (available: {bool(summary)})")
    
    return 'อื่นๆ (Others)'


def filter_by_published_date(data, cutoff_date):
    """Filter news items by published date (existing logic extracted)"""
    filtered_data = []
    current_time = datetime.now()
    
    for item in data:
        try:
            # Parse the published date 
            pub_date_str = item.get('published_date', '')
            if pub_date_str and 'UTC' in pub_date_str:
                # Parse format like "2025-07-13 22:52:52 UTC"
                date_part = pub_date_str.split(' ')[0]
                pub_date = datetime.strptime(date_part, '%Y-%m-%d')
                
                # Check if within the date range
                if pub_date >= cutoff_date:
                    filtered_data.append(item)
            else:
                # If no valid date, include anyway (existing behavior)
                filtered_data.append(item)
        except (ValueError, IndexError):
            # If date parsing fails, include the item anyway (existing behavior)
            filtered_data.append(item)
    
    return filtered_data


def load_from_main_summary_file():
    """Fallback function to load from the main summary file (backward compatibility)"""
    try:
        summary_file = Path("thailand_trending_summary.json")
        
        if not summary_file.exists():
            return []
        
        with open(summary_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Apply the same date filtering as before
        current_time = datetime.now()
        seven_days_ago = current_time - timedelta(days=7)
        
        return filter_by_published_date(data, seven_days_ago)
        
    except Exception as e:
        logger.error(f"Error loading main summary file: {e}")
        return []


def generate_weekly_pdf(weekly_data, start_date, end_date):
    """
    TrendSiam Daily Intelligence Report Generator - Professional Edition (HTML+WeasyPrint)
    
    ✅ PROFESSIONAL FEATURES (Production Ready):
    - Uses shared HTML template for consistent design
    - Thai + English font support with THSarabunNew
    - Clean layout without header/footer overlap
    - Professional typography and spacing
    - WeasyPrint for high-quality PDF output
    - Responsive design optimized for print
    - Automated generation for daily reporting
    - Optimized file size for web and email distribution
    
    🔒 PREMIUM FEATURES (Available in Enterprise Edition):
    - AI-powered market insights and predictions
    - Advanced analytics dashboard with visualizations
    - Custom branding and white-label options
    - Enhanced data export capabilities
    - Priority support and custom integrations
    
    Returns: PDF bytes for professional distribution to stakeholders
    """
    try:
        logger.info(f"🚀 Starting HTML-based PDF generation for {len(weekly_data)} stories")
        
        # Check dependencies
        if not WEASYPRINT_AVAILABLE or not HTML_FUNCTIONS_AVAILABLE:
            logger.error("❌ PDF generation failed: Required dependencies not available")
            return None
        
        # Validate input data
        if not weekly_data:
            logger.warning("No weekly data provided for PDF generation")
            return None
            
        if not isinstance(weekly_data, list):
            logger.error(f"Invalid weekly_data type: {type(weekly_data)}")
            return None
        
        logger.info(f"📊 Processing {len(weekly_data)} stories for PDF generation")
        
        # Generate HTML report using shared template
        import tempfile
        import os
        
        # Create temporary HTML file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False, encoding='utf-8') as temp_html:
            temp_html_path = temp_html.name
        
        try:
            # Generate HTML using shared function
            html_path = generate_html_report(
                stories_data=weekly_data,
                start_date=start_date,
                end_date=end_date,
                output_path=temp_html_path
            )
            
            if not html_path or not os.path.exists(html_path):
                logger.error("❌ Failed to generate HTML report")
                return None
            
            logger.info(f"✅ HTML report generated: {html_path}")
            
            # Convert HTML to PDF using WeasyPrint
            logger.info("🔄 Converting HTML to PDF using WeasyPrint...")
            
            # Create temporary PDF file
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_pdf:
                temp_pdf_path = temp_pdf.name
            
            try:
                # Generate PDF with Thai font support
                HTML(filename=html_path).write_pdf(temp_pdf_path)
                
                # Read PDF bytes
                with open(temp_pdf_path, 'rb') as pdf_file:
                    pdf_bytes = pdf_file.read()
                
                logger.info(f"✅ PDF generation successful - {len(pdf_bytes)} bytes")
                logger.info(f"📊 Professional report includes:")
                logger.info(f"   • {len(weekly_data)} trending stories with rankings")
                logger.info(f"   • Executive summary with key metrics")
                logger.info(f"   • Category breakdown analysis")
                logger.info(f"   • Thai + English font support")
                logger.info(f"   • Clean layout without overlaps")
                
                return pdf_bytes
                
            except Exception as pdf_error:
                logger.error(f"❌ WeasyPrint PDF conversion failed: {pdf_error}")
                return None
            
            finally:
                # Clean up temporary PDF file
                try:
                    if os.path.exists(temp_pdf_path):
                        os.unlink(temp_pdf_path)
                except Exception as cleanup_error:
                    logger.warning(f"Failed to clean up temporary PDF file: {cleanup_error}")
        
        finally:
            # Clean up temporary HTML file
            try:
                if os.path.exists(temp_html_path):
                    os.unlink(temp_html_path)
            except Exception as cleanup_error:
                logger.warning(f"Failed to clean up temporary HTML file: {cleanup_error}")
    
    except Exception as e:
        logger.error(f"Critical error in PDF generation: {e}")
        import traceback
        logger.error("Full traceback:")
        logger.error(traceback.format_exc())
        return None


if __name__ == "__main__":
    main()
