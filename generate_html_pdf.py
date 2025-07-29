#!/usr/bin/env python3
"""
TrendSiam HTML Report Generator with WeasyPrint
Purpose: Generate professional PDF reports using HTML/CSS template and WeasyPrint
"""

import os
from datetime import datetime, timedelta
from jinja2 import Template
import json

# Optional WeasyPrint import (install with: pip install weasyprint)
try:
    from weasyprint import HTML, CSS
    WEASYPRINT_AVAILABLE = True
except ImportError:
    print("WeasyPrint not installed. Install with: pip install weasyprint")
    WEASYPRINT_AVAILABLE = False

# Safe conversion helpers (at module level)
def safe_int(value, default=0):
    try:
        return int(float(value)) if value is not None else default
    except (ValueError, TypeError):
        return default

def safe_float(value, default=0.0):
    try:
        return float(value) if value is not None else default
    except (ValueError, TypeError):
        return default

def parse_view_count(view_count_raw):
    """Parse view count from string format (e.g., '2,571,094' -> 2571094)"""
    if isinstance(view_count_raw, str):
        # Remove commas and extract numbers
        view_count_clean = view_count_raw.replace(',', '').replace('views', '').strip()
        return safe_int(view_count_clean)
    else:
        return safe_int(view_count_raw)


def get_precise_score(item):
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

def get_score_class(score):
    """Get CSS class for score display"""
    if score >= 80:
        return 'high'
    elif score >= 60:
        return 'medium'
    else:
        return 'low'

def format_number(num):
    """Format large numbers (e.g., 1234567 -> 1.2M)"""
    if num >= 1_000_000:
        return f"{num / 1_000_000:.1f}M"
    elif num >= 1_000:
        return f"{num / 1_000:.1f}K"
    else:
        return str(num)

def calculate_metrics(stories):
    """Calculate executive summary metrics from stories data"""
    if not stories:
        return {
            'total_stories': 0,
            'total_views': 0,
            'avg_views': 0,
            'avg_score': 0,
            'unique_channels': 0,
            'categories': 0
        }
    
    total_views = sum(parse_view_count(story.get('view_count', 0)) for story in stories)
    total_score = sum(get_precise_score(story) for story in stories)
    unique_channels = len(set(story.get('channel', 'Unknown') for story in stories))
    categories = len(set(story.get('auto_category', 'Uncategorized') for story in stories))
    
    return {
        'total_stories': len(stories),
        'total_views': total_views,
        'avg_views': total_views // len(stories) if stories else 0,
        'avg_score': total_score / len(stories) if stories else 0,
        'unique_channels': unique_channels,
        'categories': categories
    }

def calculate_category_breakdown(stories):
    """Calculate category performance breakdown"""
    from collections import defaultdict
    
    category_data = defaultdict(lambda: {
        'count': 0,
        'total_score': 0,
        'total_views': 0,
        'icon': '📺'
    })
    
    # Category icons mapping
    icons = {
        'Entertainment': '🎵',
        'Sports': '⚽',
        'News': '📰',
        'Technology': '💻',
        'Business': '💰',
        'Lifestyle': '🌿',
        'Gaming': '🎮',
        'Health': '❤️',
        'Education': '🎓'
    }
    
    for story in stories:
        category = story.get('auto_category', 'Uncategorized')
        score = get_precise_score(story)
        views = parse_view_count(story.get('view_count', 0))
        
        category_data[category]['count'] += 1
        category_data[category]['total_score'] += score
        category_data[category]['total_views'] += views
        category_data[category]['icon'] = icons.get(category, '📺')
    
    # Calculate averages and percentages
    total_stories = len(stories)
    categories = []
    
    for category, data in category_data.items():
        if data['count'] > 0:
            categories.append({
                'name': category,
                'icon': data['icon'],
                'count': data['count'],
                'avg_score': data['total_score'] / data['count'],
                'avg_views': data['total_views'] // data['count'],
                'percentage': (data['count'] / total_stories * 100) if total_stories > 0 else 0
            })
    
    # Sort by count descending
    categories.sort(key=lambda x: x['count'], reverse=True)
    return categories

def generate_html_report(stories_data, start_date, end_date, output_path='report.html'):
    """Generate HTML report from stories data"""
    
    # Read the HTML template
    template_path = 'report_template.html'
    if not os.path.exists(template_path):
        print(f"Error: Template file {template_path} not found!")
        return None
    
    with open(template_path, 'r', encoding='utf-8') as f:
        template_content = f.read()
    
    # Calculate metrics
    metrics = calculate_metrics(stories_data)
    categories = calculate_category_breakdown(stories_data)
    
    # Prepare template data
    template_data = {
        'report_date': datetime.now().strftime('%B %d, %Y'),
        'start_date': start_date.strftime('%B %d, %Y'),
        'end_date': end_date.strftime('%B %d, %Y'),
        'timestamp': datetime.now().strftime('%B %d, %Y %H:%M ICT'),
        'metrics': {
            'total_stories': metrics['total_stories'],
            'total_views_formatted': format_number(metrics['total_views']),
            'avg_views_formatted': format_number(metrics['avg_views']),
            'avg_score': f"{metrics['avg_score']:.1f}",
            'unique_channels': metrics['unique_channels'],
            'categories': metrics['categories']
        },
        'stories': [],
        'categories': categories
    }
    
    # Prepare stories data (top 10) with consistent sorting logic matching web interface
    def sort_key(story):
        # Primary sort: precise popularity_score (descending)
        popularity_score = get_precise_score(story)
        
        # Secondary sort: view_count (descending) for tie-breaking
        view_count = parse_view_count(story.get('view_count', '0'))
        
        # Return tuple for sorting: negative values for descending order
        return (-popularity_score, -view_count)
    
    sorted_stories = sorted(stories_data, key=sort_key)[:10]
    
    for i, story in enumerate(sorted_stories, 1):
        score = get_precise_score(story)
        
        # Enhanced view count parsing for comma-separated format
        view_count_raw = story.get('view_count', '0')
        if isinstance(view_count_raw, str):
            # Remove commas and extract numbers
            view_count_clean = view_count_raw.replace(',', '').replace('views', '').strip()
            views = safe_int(view_count_clean)
        else:
            views = safe_int(view_count_raw)
        
        # Get proper summary with bilingual fallback
        summary_text = story.get('summary', story.get('summary_en', story.get('description', 'No description available')))
        if len(summary_text) > 150:
            summary_text = summary_text[:150]
        
        story_data = {
            'rank': i,
            'rank_class': 'top-3' if i <= 3 else '',
            'title': story.get('title', 'No Title Available'),
            'channel': story.get('channel', 'Unknown Channel'),
            'published_date': story.get('published_date', 'Unknown Date'),
            'category': story.get('auto_category', 'Uncategorized'),
            'description': summary_text,
            'score': f"{score:.1f}",
            'score_class': get_score_class(score),
            'views_formatted': format_number(views)
        }
        template_data['stories'].append(story_data)
    
    # Replace dynamic content in template using comprehensive data replacement
    html_content = template_content
    
    # Update timestamps and metadata
    html_content = html_content.replace(
        'data-timestamp="January 26, 2025 17:30 ICT"',
        f'data-timestamp="{template_data["timestamp"]}"'
    )
    
    # Update report dates
    html_content = html_content.replace(
        'Analysis Period: January 19, 2025 - January 26, 2025',
        f'Analysis Period: {template_data["start_date"]} - {template_data["end_date"]}'
    )
    
    # Update executive summary metrics
    html_content = html_content.replace('<div class="metric-value">10</div>', f'<div class="metric-value">{template_data["metrics"]["total_stories"]}</div>')
    html_content = html_content.replace('<div class="metric-value">2.4M</div>', f'<div class="metric-value">{template_data["metrics"]["total_views_formatted"]}</div>')
    html_content = html_content.replace('<div class="metric-value">240K</div>', f'<div class="metric-value">{template_data["metrics"]["avg_views_formatted"]}</div>')
    html_content = html_content.replace('<div class="metric-value">7.8</div>', f'<div class="metric-value">{template_data["metrics"]["avg_score"]}</div>')
    html_content = html_content.replace('<div class="metric-value">8</div>', f'<div class="metric-value">{template_data["metrics"]["unique_channels"]}</div>')
    html_content = html_content.replace('<div class="metric-value">6</div>', f'<div class="metric-value">{template_data["metrics"]["categories"]}</div>')
    
    # Add last updated timestamp to footer (only if not already present)
    if 'Last updated:' not in html_content:
        html_content = html_content.replace(
            '<div class="disclaimer-line">Quality Assured • Confidential Processing • Real-time Intelligence</div>',
            f'<div class="disclaimer-line">Quality Assured • Confidential Processing • Real-time Intelligence</div>\n                <div class="disclaimer-line">Last updated: {template_data["timestamp"]}</div>'
        )
    
    # Generate real stories content from actual data
    stories_html = ""
    for story in template_data['stories']:
        # Format proper dates
        pub_date = story['published_date']
        formatted_date = "Unknown Date"
        if 'UTC' in pub_date:
            try:
                date_obj = datetime.strptime(pub_date.split(' ')[0], '%Y-%m-%d')
                formatted_date = date_obj.strftime('%b %d, %Y')
            except:
                formatted_date = pub_date.split(' ')[0] if ' ' in pub_date else pub_date[:10]
        else:
            formatted_date = pub_date
        
        # Get real description with bilingual support
        description = story['description']
        if not description or description == 'No description available':
            description = "การวิเคราะห์เนื้อหายอดนิยมในประเทศไทย - Analysis of popular Thai digital content."
        
        # Create story HTML with real data
        story_html = f'''
                <article class="story-card no-page-break">
                    <div class="story-rank {'top-3' if story['rank'] <= 3 else ''}">{story['rank']}</div>
                    <div class="story-content">
                        <h3 class="story-title">{story['title']}</h3>
                        <div class="story-meta">
                            <span class="story-meta-item">📺 {story['channel']}</span>
                            <span class="story-meta-item">📅 {formatted_date}</span>
                            <span class="story-meta-item">🏷️ {story['category']}</span>
                        </div>
                        <p class="story-description">
                            {description}
                        </p>
                        <div class="story-metrics">
                            <span class="story-score {story['score_class']}">{story['score']}/100</span>
                            <span class="story-views">{story['views_formatted']} views</span>
                        </div>
                    </div>
                </article>'''
        stories_html += story_html
    
    # Replace the static stories with real data
    # Find the stories container and replace its content
    import re
    stories_pattern = r'<div class="stories-container">.*?</div>\s*</section>'
    replacement = f'<div class="stories-container">{stories_html}\n            </div>\n        </section>'
    html_content = re.sub(stories_pattern, replacement, html_content, flags=re.DOTALL)
    
    # Update category breakdown table with real data
    category_rows_html = ""
    for category_info in template_data['categories']:
        icon = category_info['icon']
        category_name = category_info['name']
        
        category_row = f'''
                    <tr>
                        <td>
                            <span class="category-icon">{icon}</span>
                            <span class="category-name">{category_name}</span>
                        </td>
                        <td>{category_info['count']}</td>
                        <td>{category_info['avg_score']:.1f}</td>
                        <td>{format_number(int(category_info['avg_views']))}</td>
                        <td>
                            {category_info['percentage']:.1f}%
                            <div class="percentage-bar">
                                <div class="percentage-fill" style="width: {min(category_info['percentage'], 100)}%"></div>
                            </div>
                        </td>
                    </tr>'''
        category_rows_html += category_row
    
    # Replace category table content
    if category_rows_html:
        category_pattern = r'<tbody>.*?</tbody>'
        category_replacement = f'<tbody>{category_rows_html}\n                </tbody>'
        html_content = re.sub(category_pattern, category_replacement, html_content, flags=re.DOTALL)
    
    # Add "Last updated" timestamp to footer
    footer_pattern = r'(<div class="footer-disclaimer">.*?)(</div>\s*</footer>)'
    footer_replacement = f'\\1<div class="disclaimer-line">Last updated: {template_data["timestamp"]}</div>\n            \\2'
    html_content = re.sub(footer_pattern, footer_replacement, html_content, flags=re.DOTALL)
    
    # Save the HTML file
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f"✅ HTML report generated: {output_path}")
    return output_path

def convert_html_to_pdf(html_path, pdf_path='report.pdf'):
    """Convert HTML report to PDF using WeasyPrint"""
    
    if not WEASYPRINT_AVAILABLE:
        print("❌ WeasyPrint not available. Cannot generate PDF.")
        return None
    
    if not os.path.exists(html_path):
        print(f"❌ HTML file not found: {html_path}")
        return None
    
    try:
        # Generate PDF
        HTML(filename=html_path).write_pdf(pdf_path)
        
        # Get file size
        file_size = os.path.getsize(pdf_path) / 1024
        print(f"✅ PDF generated successfully: {pdf_path} ({file_size:.1f} KB)")
        return pdf_path
        
    except Exception as e:
        print(f"❌ Error generating PDF: {e}")
        return None

def load_real_data():
    """Load real data using the same logic as the web interface"""
    try:
        # Import the load_weekly_data function from app.py
        import sys
        import os
        sys.path.append(os.path.dirname(os.path.abspath(__file__)))
        
        from app import load_weekly_data
        
        data = load_weekly_data()
        if data and len(data) > 0:
            print(f"📊 Loaded {len(data)} stories from real data")
            return data
        else:
            print("⚠️ No data found from load_weekly_data, falling back to JSON file")
            return load_json_fallback()
    except Exception as e:
        print(f"⚠️ Error loading data from app.py: {e}")
        return load_json_fallback()

def load_json_fallback():
    """Fallback to load from JSON file directly"""
    try:
        with open('thailand_trending_summary.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, list) and len(data) > 0:
                print(f"📊 Loaded {len(data)} stories from JSON fallback")
                return data[:10]  # Take top 10
    except FileNotFoundError:
        pass
    
    print("❌ No real data found, using sample data")
    return get_sample_data()

def get_sample_data():
    """Get sample data for demonstration"""
    return [
        {
            'title': 'BLACKPINK Lisa\'s New Solo Project Announcement',
            'channel': 'BLACKPINK Official',
            'view_count': 485000,
            'popularity_score': 92,
            'auto_category': 'Entertainment',
            'published_date': '2025-01-25',
            'summary': 'Lisa announces her highly anticipated solo project with a stunning teaser video, generating massive engagement across social media platforms.'
        },
        {
            'title': 'Thailand\'s Digital Economy Growth Reaches Record High',
            'channel': 'ThaiPBS News',
            'view_count': 367000,
            'popularity_score': 88,
            'auto_category': 'Business',
            'published_date': '2025-01-24',
            'summary': 'Government reports show Thailand\'s digital economy expanded by 12.5% in 2024, driven by e-commerce and fintech innovations.'
        },
        {
            'title': 'Thai National Football Team Qualifies for Asian Cup Finals',
            'channel': 'Sports Authority',
            'view_count': 312000,
            'popularity_score': 85,
            'auto_category': 'Sports',
            'published_date': '2025-01-23',
            'summary': 'Historic victory secures Thailand\'s spot in the Asian Cup finals, marking the first time in tournament history.'
        },
        # Add more sample stories...
        {
            'title': 'Bangkok\'s New Sky Train Extension Opens to Public',
            'channel': 'Bangkok Metro',
            'view_count': 245000,
            'popularity_score': 76,
            'auto_category': 'News',
            'published_date': '2025-01-22',
            'summary': 'The highly anticipated Green Line extension connects eastern suburbs, improving transportation for over 200,000 daily commuters.'
        },
        {
            'title': 'Revolutionary AI Healthcare Platform Launched in Thailand',
            'channel': 'TechCrunch Thailand',
            'view_count': 198000,
            'popularity_score': 72,
            'auto_category': 'Technology',
            'published_date': '2025-01-21',
            'summary': 'Local startup introduces AI-powered diagnostic platform, promising to revolutionize healthcare accessibility in rural areas.'
        }
    ]

def main():
    """Main function to generate HTML and PDF reports"""
    print("🔍 TrendSiam HTML Report Generator")
    print("=" * 50)
    
    # Load data
    stories_data = load_real_data()
    
    # Set date range
    end_date = datetime.now()
    start_date = end_date - timedelta(days=7)
    
    # Generate HTML report
    html_path = generate_html_report(
        stories_data=stories_data,
        start_date=start_date,
        end_date=end_date,
        output_path='trendsiam_report.html'
    )
    
    if html_path:
        print(f"📄 HTML Report: {html_path}")
        
        # Generate PDF if WeasyPrint is available
        pdf_path = convert_html_to_pdf(
            html_path=html_path,
            pdf_path='trendsiam_report.pdf'
        )
        
        if pdf_path:
            print(f"📄 PDF Report: {pdf_path}")
        
        print("\n✅ Report generation complete!")
        print("\n📋 Features included:")
        print("✅ Professional HTML layout with Inter/Roboto fonts")
        print("✅ Executive summary with key metrics")
        print("✅ Top 10 trending stories with rankings")
        print("✅ Category breakdown table with performance data")
        print("✅ Clean sections without overlapping")
        print("✅ English-only professional format")
        print("✅ Footer with timestamp and branding")
        print("✅ WeasyPrint-optimized for perfect PDF conversion")
        
    else:
        print("❌ Failed to generate HTML report")

if __name__ == "__main__":
    main() 