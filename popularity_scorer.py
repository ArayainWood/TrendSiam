#!/usr/bin/env python3
"""
Popularity Scoring AI for YouTube Videos

This module analyzes video metadata and assigns popularity scores
from 0-100 based on engagement metrics and viral indicators.
"""

import json
import re
from typing import Dict, Any, Union

class PopularityScorer:
    """
    AI system to analyze video metadata and assign popularity scores.
    """
    
    def __init__(self):
        """Initialize the scorer with viral keywords and thresholds."""
        
        # Viral keywords that boost popularity scores
        self.viral_keywords = {
            'live_urgent': ['🔴', 'live', 'ด่วน', 'breaking', 'urgent', 'ปฏิบัติการ'],
            'celebrities': ['blackpink', 'bts', 'twice', 'taylor swift', 'นิโคล', 'ณเดชน์', 'ญาญ่า'],
            'social_platforms': ['tiktok', 'viral', 'trend', 'challenge', 'shorts'],
            'emotional_hooks': ['ตลก', 'funny', 'น่ารัก', 'cute', 'สะเทือนใจ', 'amazing'],
            'exclusive': ['เผย', 'exclusive', 'reveal', 'secret', 'behind the scenes']
        }
        
        # Engagement thresholds for scoring
        self.engagement_thresholds = {
            'high_views': 1_000_000,
            'medium_views': 100_000,
            'high_likes_ratio': 0.05,  # 5% like rate
            'medium_likes_ratio': 0.02,  # 2% like rate
            'high_comments_ratio': 0.01,  # 1% comment rate
            'medium_comments_ratio': 0.005  # 0.5% comment rate
        }
    
    def parse_count(self, count_str: Union[str, int]) -> int:
        """
        Parse view/like/comment count from string format.
        
        Args:
            count_str: Count as string (e.g., "1,234,567") or integer
            
        Returns:
            int: Parsed count value
        """
        if isinstance(count_str, int):
            return count_str
        
        if not count_str or count_str == 'Unknown':
            return 0
        
        # Remove commas and convert to int
        try:
            return int(str(count_str).replace(',', '').replace(' ', ''))
        except (ValueError, AttributeError):
            return 0
    
    def calculate_engagement_score(self, views: int, likes: int, comments: int) -> Dict[str, float]:
        """
        Calculate engagement metrics and scores.
        
        Args:
            views: Number of views
            likes: Number of likes
            comments: Number of comments
            
        Returns:
            Dict with engagement metrics and scores
        """
        if views == 0:
            return {
                'likes_ratio': 0,
                'comments_ratio': 0,
                'engagement_score': 0
            }
        
        likes_ratio = likes / views
        comments_ratio = comments / views
        
        # Score engagement ratios with enhanced precision
        likes_score = 0.0
        if likes_ratio >= self.engagement_thresholds['high_likes_ratio']:
            # Add precision bonus for exceptionally high like ratios
            extra_ratio = likes_ratio - self.engagement_thresholds['high_likes_ratio']
            precision_bonus = min(extra_ratio * 10000, 5.0)  # Up to 5 extra points
            likes_score = min(30.0 + precision_bonus, 35.0)
        elif likes_ratio >= self.engagement_thresholds['medium_likes_ratio']:
            # Interpolate between medium (20) and high (30) thresholds
            medium_threshold = self.engagement_thresholds['medium_likes_ratio']
            high_threshold = self.engagement_thresholds['high_likes_ratio']
            progress = (likes_ratio - medium_threshold) / (high_threshold - medium_threshold)
            likes_score = 20.0 + (progress * 10.0)
        elif likes_ratio > 0:
            # Interpolate between 10 and 20 based on ratio relative to medium threshold
            progress = min(likes_ratio / self.engagement_thresholds['medium_likes_ratio'], 1.0)
            likes_score = 10.0 + (progress * 10.0)
        
        comments_score = 0.0
        if comments_ratio >= self.engagement_thresholds['high_comments_ratio']:
            # Add precision bonus for exceptionally high comment ratios
            extra_ratio = comments_ratio - self.engagement_thresholds['high_comments_ratio']
            precision_bonus = min(extra_ratio * 50000, 3.0)  # Up to 3 extra points
            comments_score = min(20.0 + precision_bonus, 23.0)
        elif comments_ratio >= self.engagement_thresholds['medium_comments_ratio']:
            # Interpolate between medium (15) and high (20) thresholds
            medium_threshold = self.engagement_thresholds['medium_comments_ratio']
            high_threshold = self.engagement_thresholds['high_comments_ratio']
            progress = (comments_ratio - medium_threshold) / (high_threshold - medium_threshold)
            comments_score = 15.0 + (progress * 5.0)
        elif comments_ratio > 0:
            # Interpolate between 10 and 15 based on ratio relative to medium threshold
            progress = min(comments_ratio / self.engagement_thresholds['medium_comments_ratio'], 1.0)
            comments_score = 10.0 + (progress * 5.0)
        
        return {
            'likes_ratio': likes_ratio,
            'comments_ratio': comments_ratio,
            'engagement_score': likes_score + comments_score
        }
    
    def calculate_views_score(self, views: int) -> float:
        """
        Calculate score based on view count with enhanced precision.
        
        Args:
            views: Number of views
            
        Returns:
            float: Views score (0-30) with decimal precision for better ranking
        """
        if views >= self.engagement_thresholds['high_views']:
            # Add precision based on how much above the high threshold
            extra_views = views - self.engagement_thresholds['high_views']
            precision_bonus = min(extra_views / 1_000_000, 5.0)  # Up to 5 extra points for very high views
            return min(30.0 + precision_bonus, 35.0)
        elif views >= self.engagement_thresholds['medium_views']:
            # Interpolate between medium (20) and high (30) thresholds
            medium_threshold = self.engagement_thresholds['medium_views']
            high_threshold = self.engagement_thresholds['high_views']
            progress = (views - medium_threshold) / (high_threshold - medium_threshold)
            return 20.0 + (progress * 10.0)
        elif views >= 10_000:
            # Interpolate between 15 and 20
            progress = (views - 10_000) / (self.engagement_thresholds['medium_views'] - 10_000)
            return 15.0 + (progress * 5.0)
        elif views >= 1_000:
            # Interpolate between 10 and 15
            progress = (views - 1_000) / (10_000 - 1_000)
            return 10.0 + (progress * 5.0)
        elif views > 0:
            # Interpolate between 5 and 10
            progress = min(views / 1_000, 1.0)
            return 5.0 + (progress * 5.0)
        else:
            return 0.0
    
    def calculate_viral_keywords_score(self, title: str, description: str) -> Dict[str, Any]:
        """
        Calculate score based on viral keywords in title and description.
        
        Args:
            title: Video title
            description: Video description
            
        Returns:
            Dict with keyword analysis and score
        """
        text = f"{title} {description}".lower()
        
        keyword_score = 0.0
        found_keywords = []
        keyword_count_by_category = {}
        
        for category, keywords in self.viral_keywords.items():
            category_matches = 0
            for keyword in keywords:
                if keyword.lower() in text:
                    found_keywords.append(keyword)
                    category_matches += 1
                    
                    # Base weight for different categories
                    base_weight = 0
                    if category == 'live_urgent':
                        base_weight = 8.0
                    elif category == 'celebrities':
                        base_weight = 6.0
                    elif category == 'social_platforms':
                        base_weight = 4.0
                    elif category == 'emotional_hooks':
                        base_weight = 3.0
                    elif category == 'exclusive':
                        base_weight = 5.0
                    
                    # Add precision: slight boost for keyword position in title vs description
                    position_bonus = 0.0
                    if keyword.lower() in title.lower():
                        position_bonus = base_weight * 0.1  # 10% bonus for title keywords
                    
                    keyword_score += base_weight + position_bonus
            
            keyword_count_by_category[category] = category_matches
        
        # Add diversity bonus: slight bonus for having keywords from multiple categories
        active_categories = sum(1 for count in keyword_count_by_category.values() if count > 0)
        if active_categories > 1:
            diversity_bonus = min(active_categories * 0.5, 2.0)  # Up to 2 extra points
            keyword_score += diversity_bonus
        
        # Cap keyword score at 22 (allowing for bonuses)
        keyword_score = min(keyword_score, 22.0)
        
        return {
            'keyword_score': keyword_score,
            'found_keywords': found_keywords
        }
    
    def analyze_video(self, video_data: Dict[str, Any], title: str, description: str = "", views: Union[str, int] = 0,
                     likes: Union[str, int] = 0, comments: Union[str, int] = 0) -> Dict[str, Any]:
        """
        Analyze video metadata and assign popularity score.
        
        Args:
            title: Video title
            description: Video description
            views: View count (string or int)
            likes: Like count (string or int)
            comments: Comment count (string or int)
            
        Returns:
            Dict with popularity score and analysis
        """
        # Parse counts
        views_count = self.parse_count(views)
        likes_count = self.parse_count(likes)
        comments_count = self.parse_count(comments)
        
        # Calculate component scores
        views_score = self.calculate_views_score(views_count)
        engagement_metrics = self.calculate_engagement_score(views_count, likes_count, comments_count)
        keyword_analysis = self.calculate_viral_keywords_score(title, description or "")
        
        # Calculate total score with enhanced precision (max ~110 with bonuses)
        total_score_precise = (
            views_score +  # Max ~35 (with bonuses)
            engagement_metrics['engagement_score'] +  # Max ~58 (with bonuses)
            keyword_analysis['keyword_score']  # Max ~22 (with bonuses)
        )
        
        # Cap at 100 for display but keep internal precision for ranking
        total_score_display = min(total_score_precise, 100.0)
        
        # Keep internal precision for better ranking (capped at 110)
        total_score_internal = min(total_score_precise, 110.0)
        
        # Generate enhanced reason using detailed analysis
        reason = self._generate_detailed_reason(
            video_data, views_count, likes_count, comments_count,
            engagement_metrics, keyword_analysis, total_score_display
        )
        
        # Generate structured view details for UI (use precise score for better accuracy)
        view_details = self._generate_view_details(
            video_data, views_count, likes_count, comments_count,
            engagement_metrics, keyword_analysis, total_score_internal
        )
        
        return {
            'popularity_score': int(total_score_display),  # Integer for display compatibility
            'popularity_score_precise': total_score_internal,  # Float for precise ranking
            'reason': reason,
            'view_details': view_details,
            'analysis': {
                'views': views_count,
                'likes': likes_count,
                'comments': comments_count,
                'views_score': views_score,
                'engagement_score': engagement_metrics['engagement_score'],
                'keyword_score': keyword_analysis['keyword_score'],
                'likes_ratio': round(engagement_metrics['likes_ratio'] * 100, 3),
                'comments_ratio': round(engagement_metrics['comments_ratio'] * 100, 3),
                'found_keywords': keyword_analysis['found_keywords']
            }
        }
    
    def _generate_detailed_reason(
        self, 
        video_data: Dict[str, Any], 
        views_count: int, 
        likes_count: int, 
        comments_count: int,
        engagement_metrics: Dict[str, Any], 
        keyword_analysis: Dict[str, Any], 
        total_score: int
    ) -> str:
        """
        Generate detailed, rule-based explanation for popularity score.
        
        Args:
            video_data: Original video metadata
            views_count: Parsed view count
            likes_count: Parsed like count  
            comments_count: Parsed comment count
            engagement_metrics: Calculated engagement data
            keyword_analysis: Viral keyword analysis
            total_score: Final popularity score
            
        Returns:
            str: Detailed explanation (1-3 sentences)
        """
        
        # Extract additional metadata
        title = video_data.get('title', '')
        category = video_data.get('category', 'Unknown')
        channel = video_data.get('channel', '')
        
        # Calculate engagement rates for more specific analysis
        likes_ratio = engagement_metrics.get('likes_ratio', 0)
        comments_ratio = engagement_metrics.get('comments_ratio', 0)
        
        reason_parts = []
        
        # 1. Analyze view performance with context
        if views_count >= 10_000_000:
            reason_parts.append(f"exceptional viral reach ({self._format_count(views_count)} views)")
        elif views_count >= 5_000_000:
            reason_parts.append(f"massive audience engagement ({self._format_count(views_count)} views)")
        elif views_count >= 1_000_000:
            reason_parts.append(f"strong viewership ({self._format_count(views_count)} views)")
        elif views_count >= 500_000:
            reason_parts.append(f"solid view performance ({self._format_count(views_count)} views)")
        elif views_count >= 100_000:
            reason_parts.append(f"moderate reach ({self._format_count(views_count)} views)")
        elif views_count >= 10_000:
            reason_parts.append(f"growing audience ({self._format_count(views_count)} views)")
        
        # 2. Analyze engagement quality with specific metrics
        if likes_ratio >= 0.05:  # 5%+
            reason_parts.append(f"outstanding engagement ({likes_ratio*100:.1f}% like rate)")
        elif likes_ratio >= 0.03:  # 3%+
            reason_parts.append(f"strong audience approval ({likes_ratio*100:.1f}% like rate)")
        elif likes_ratio >= 0.015:  # 1.5%+
            reason_parts.append(f"positive engagement ({likes_ratio*100:.1f}% like rate)")
        elif likes_ratio > 0:
            reason_parts.append(f"basic engagement ({likes_ratio*100:.2f}% like rate)")
        
        # 3. Comment engagement analysis
        if comments_ratio >= 0.01:  # 1%+
            reason_parts.append(f"high discussion activity ({comments_ratio*100:.2f}% comment rate)")
        elif comments_ratio >= 0.005:  # 0.5%+
            reason_parts.append("active community discussion")
        
        # 4. Content-specific viral factors
        viral_factors = []
        if keyword_analysis.get('found_keywords'):
            keywords = keyword_analysis['found_keywords'][:3]  # Top 3 keywords
            
            # Categorize viral factors
            live_keywords = [k for k in keywords if k.lower() in ['🔴', 'live', 'ด่วน', 'breaking']]
            celebrity_keywords = [k for k in keywords if k.lower() in ['blackpink', 'bts', 'twice', 'taylor swift']]
            platform_keywords = [k for k in keywords if k.lower() in ['tiktok', 'viral', 'trend', 'shorts']]
            
            if live_keywords:
                viral_factors.append(f"live/urgent content ({', '.join(live_keywords[:2])})")
            if celebrity_keywords:
                viral_factors.append(f"celebrity appeal ({', '.join(celebrity_keywords[:2])})")  
            if platform_keywords:
                viral_factors.append(f"platform trends ({', '.join(platform_keywords[:2])})")
            
            # Add other viral keywords if space allows
            other_keywords = [k for k in keywords if k not in live_keywords + celebrity_keywords + platform_keywords]
            if other_keywords and len(viral_factors) < 2:
                viral_factors.append(f"viral keywords ({', '.join(other_keywords[:2])})")
        
        # 5. Category-specific analysis
        category_context = ""
        if category.lower() in ['entertainment', 'music']:
            category_context = "entertainment content"
        elif category.lower() in ['sports', 'gaming']:
            category_context = f"{category.lower()} content"
        elif category.lower() in ['news', 'politics']:
            category_context = "news/current events"
        
        # 6. Build final explanation based on score level
        if total_score >= 80:
            prefix = "Viral performance driven by"
        elif total_score >= 60:
            prefix = "High popularity achieved through"
        elif total_score >= 40:
            prefix = "Moderate popularity from"
        elif total_score >= 20:
            prefix = "Limited popularity due to"
        else:
            prefix = "Low engagement with"
        
        # Combine all analysis parts
        all_factors = reason_parts + viral_factors
        
        # Create 1-3 sentence explanation
        if len(all_factors) == 0:
            return f"{prefix} minimal metrics and basic {category_context or 'content'}."
        elif len(all_factors) <= 2:
            main_reason = f"{prefix} {' and '.join(all_factors)}"
            if category_context:
                return f"{main_reason} in {category_context}."
            return f"{main_reason}."
        else:
            # Split into 2 sentences for longer explanations
            primary_factors = all_factors[:2]
            secondary_factors = all_factors[2:]
            
            sentence1 = f"{prefix} {' and '.join(primary_factors)}."
            
            if secondary_factors:
                sentence2 = f"Additional boost from {', '.join(secondary_factors)}."
                if category_context:
                    sentence2 = f"Additional boost from {', '.join(secondary_factors)} in {category_context}."
                return f"{sentence1} {sentence2}"
            
            return sentence1
    
    def _format_count(self, count: int) -> str:
        """
        Format large numbers in human-readable format.
        
        Args:
            count: Number to format
            
        Returns:
            str: Formatted number (e.g., "1.2M", "500K")
        """
        
        if count >= 1_000_000:
            return f"{count/1_000_000:.1f}M"
        elif count >= 1_000:
            return f"{count/1_000:.0f}K"
        else:
            return str(count)

    def _generate_view_details(
        self, 
        video_data: Dict[str, Any], 
        views_count: int, 
        likes_count: int, 
        comments_count: int,
        engagement_metrics: Dict[str, Any], 
        keyword_analysis: Dict[str, Any], 
        total_score: int
    ) -> Dict[str, Any]:
        """
        Generate structured view details for UI display.
        
        Args:
            video_data: Original video metadata
            views_count: Parsed view count
            likes_count: Parsed like count  
            comments_count: Parsed comment count
            engagement_metrics: Calculated engagement data
            keyword_analysis: Viral keyword analysis
            total_score: Final popularity score (precise, with decimal places)
            
        Returns:
            Dict: Structured view details for UI
        """
        
        # Extract metadata
        title = video_data.get('title', '')
        description = video_data.get('description', '')
        channel = video_data.get('channel', '')
        published_date = video_data.get('published_date', '')
        category = video_data.get('category', 'Unknown')
        
        # 1. Format view count
        views_formatted = f"{self._format_count(views_count)} views"
        
        # 2. Estimate growth rate based on publish date and current views
        growth_rate = self._estimate_growth_rate(views_count, published_date)
        
        # 3. Analyze platform mentions
        platform_mentions = self._analyze_platform_mentions(title, description, channel)
        
        # 4. Format matched keywords
        matched_keywords = self._format_matched_keywords(keyword_analysis)
        
        # 5. Generate audience appeal analysis
        ai_opinion = self._generate_audience_appeal_analysis(
            video_data, keyword_analysis, engagement_metrics, category
        )
        
        # 6. Format score with model info (show precise score with 1 decimal place)
        score_formatted = f"{total_score:.1f}/100 (rule-based model)"
        
        return {
            "views": views_formatted,
            "growth_rate": growth_rate,
            "platform_mentions": platform_mentions,
            "matched_keywords": matched_keywords,
            "ai_opinion": ai_opinion,
            "score": score_formatted
        }

    def _estimate_growth_rate(self, views_count: int, published_date: str) -> str:
        """
        Estimate view growth rate based on publish date and current views.
        
        Args:
            views_count: Current view count
            published_date: Video publish date string
            
        Returns:
            str: Growth rate estimate
        """
        try:
            from datetime import datetime, timezone
            import re
            
            # Parse published date (format: "2025-07-13 22:52:52 UTC")
            if published_date and "UTC" in published_date:
                date_str = published_date.replace(" UTC", "")
                pub_date = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
                pub_date = pub_date.replace(tzinfo=timezone.utc)
                now = datetime.now(timezone.utc)
                
                # Calculate hours since publication
                hours_since_pub = (now - pub_date).total_seconds() / 3600
                
                if hours_since_pub <= 0:
                    return "Just published"
                elif hours_since_pub <= 24:
                    # Views per hour for recent content
                    views_per_hour = views_count / hours_since_pub
                    daily_estimate = views_per_hour * 24
                    return f"+{self._format_count(int(daily_estimate))} estimated in 24hr"
                elif hours_since_pub <= 168:  # Within a week
                    # Average daily views
                    days_since_pub = hours_since_pub / 24
                    daily_avg = views_count / days_since_pub
                    return f"~{self._format_count(int(daily_avg))} avg/day"
                else:
                    # Older content - weekly average
                    weeks_since_pub = hours_since_pub / (24 * 7)
                    weekly_avg = views_count / weeks_since_pub
                    return f"~{self._format_count(int(weekly_avg))} avg/week"
            else:
                # Fallback for unknown dates
                if views_count >= 10_000_000:
                    return "Viral growth pattern"
                elif views_count >= 1_000_000:
                    return "Strong growth trend"
                elif views_count >= 100_000:
                    return "Steady growth pattern"
                else:
                    return "Moderate growth rate"
                    
        except Exception:
            # Fallback on error
            return "Growth rate unknown"

    def _analyze_platform_mentions(self, title: str, description: str, channel: str) -> str:
        """
        Analyze platform mentions in content.
        
        Args:
            title: Video title
            description: Video description  
            channel: Channel name
            
        Returns:
            str: Platform mentions summary
        """
        text = f"{title} {description} {channel}".lower()
        
        platforms = {
            'youtube': ['youtube', 'yt'],
            'tiktok': ['tiktok', 'tik tok'],
            'facebook': ['facebook', 'fb'],
            'instagram': ['instagram', 'ig', 'insta'],
            'twitter': ['twitter', 'x.com'],
            'line': ['line today', 'line tv'],
            'thai_news': ['thairath', 'kapook', 'sanook', 'mthai', 'manager'],
            'tv_channels': ['ch3', 'ch7', 'workpoint', 'one31', 'gmm']
        }
        
        found_platforms = []
        platform_count = 0
        
        for platform_type, keywords in platforms.items():
            for keyword in keywords:
                if keyword in text:
                    if platform_type == 'youtube':
                        found_platforms.append('YouTube')
                    elif platform_type == 'tiktok':
                        found_platforms.append('TikTok')
                    elif platform_type == 'facebook':
                        found_platforms.append('Facebook')
                    elif platform_type == 'instagram':
                        found_platforms.append('Instagram')
                    elif platform_type == 'thai_news':
                        platform_count += 1
                    elif platform_type == 'tv_channels':
                        platform_count += 1
                    break
        
        # Build platform mention string
        result_parts = []
        if found_platforms:
            result_parts.extend(found_platforms)
        
        if platform_count > 0:
            if 'thairath' in text or 'sanook' in text or 'kapook' in text:
                result_parts.append(f"{platform_count} Thai news outlets")
            elif 'ch3' in text or 'ch7' in text or 'workpoint' in text:
                result_parts.append(f"{platform_count} TV channels")
            else:
                result_parts.append(f"{platform_count} media outlets")
        
        if result_parts:
            return " + ".join(result_parts)
        else:
            return "Primary platform only"

    def _format_matched_keywords(self, keyword_analysis: Dict[str, Any]) -> str:
        """
        Format matched keywords for display.
        
        Args:
            keyword_analysis: Keyword analysis results
            
        Returns:
            str: Formatted keyword summary
        """
        found_keywords = keyword_analysis.get('found_keywords', [])
        
        if not found_keywords:
            return "No viral keywords detected"
        
        keyword_count = len(found_keywords)
        
        # Show first 3 keywords as examples
        examples = found_keywords[:3]
        
        if keyword_count <= 3:
            return f"{keyword_count} keywords ({', '.join(examples)})"
        else:
            return f"{keyword_count} keywords (e.g., {', '.join(examples)})"

    def _generate_audience_appeal_analysis(
        self, 
        video_data: Dict[str, Any], 
        keyword_analysis: Dict[str, Any], 
        engagement_metrics: Dict[str, Any],
        category: str
    ) -> str:
        """
        Generate rule-based audience appeal analysis.
        
        Args:
            video_data: Original video metadata
            keyword_analysis: Viral keyword analysis
            engagement_metrics: Engagement metrics
            category: Content category
            
        Returns:
            str: Audience appeal analysis
        """
        title = video_data.get('title', '').lower()
        description = video_data.get('description', '').lower()
        found_keywords = keyword_analysis.get('found_keywords', [])
        likes_ratio = engagement_metrics.get('likes_ratio', 0)
        
        # Analyze content characteristics
        appeal_factors = []
        
        # Age group analysis
        teen_indicators = ['tiktok', 'viral', 'challenge', 'trend', 'cute', 'funny']
        adult_indicators = ['news', 'politics', 'business', 'analysis', 'documentary']
        
        if any(indicator in title + description for indicator in teen_indicators):
            appeal_factors.append("teens and young adults")
        elif any(indicator in title + description for indicator in adult_indicators):
            appeal_factors.append("adult audiences")
        
        # Gender appeal analysis
        female_indicators = ['blackpink', 'twice', 'bts', 'beauty', 'fashion', 'cute', 'romance']
        male_indicators = ['football', 'gaming', 'sports', 'esport', 'tech', 'car']
        
        if any(indicator in title + description for indicator in female_indicators):
            appeal_factors.append("female audiences")
        elif any(indicator in title + description for indicator in male_indicators):
            appeal_factors.append("male audiences")
        
        # Content type analysis
        if category.lower() == 'sports':
            appeal_factors.append("sports fans")
        elif category.lower() == 'music':
            appeal_factors.append("music enthusiasts")
        elif category.lower() == 'gaming':
            appeal_factors.append("gaming community")
        elif category.lower() == 'news':
            appeal_factors.append("news followers")
        
        # Celebrity/viral appeal
        celebrity_keywords = ['blackpink', 'bts', 'twice', 'taylor swift']
        if any(keyword.lower() in found_keywords for keyword in celebrity_keywords):
            appeal_factors.append("celebrity fans")
        
        # Live/urgent appeal
        if '🔴' in title or 'live' in title.lower() or 'ด่วน' in title:
            appeal_factors.append("real-time event followers")
        
        # Engagement quality analysis
        engagement_appeal = ""
        if likes_ratio >= 0.03:
            engagement_appeal = "due to highly engaging content"
        elif likes_ratio >= 0.015:
            engagement_appeal = "due to engaging storytelling"
        elif likes_ratio > 0:
            engagement_appeal = "due to relatable content"
        
        # Build final analysis
        if appeal_factors:
            audience_text = ", ".join(appeal_factors[:3])  # Limit to 3 factors
            if engagement_appeal:
                return f"Likely appeals to {audience_text} {engagement_appeal}."
            else:
                return f"Likely appeals to {audience_text} based on content themes."
        else:
            if engagement_appeal:
                return f"Broad audience appeal {engagement_appeal}."
            else:
                return "General audience appeal with moderate engagement potential."
    
    def score_video_simple(self, video_data: Dict[str, Any] = None, title: str = "", 
                          description: str = "", views: Union[str, int] = 0, 
                          likes: Union[str, int] = 0, comments: Union[str, int] = 0) -> Dict[str, Any]:
        """
        Simple scoring function that returns only score and reason.
        
        Args:
            video_data: Full video metadata dict (preferred for enhanced reasons)
            title: Video title (fallback if video_data not provided)
            description: Video description (fallback)
            views: View count (fallback)
            likes: Like count (fallback)
            comments: Comment count (fallback)
            
        Returns:
            Dict with popularity_score and reason only
        """
        # Use video_data if provided, otherwise use individual parameters
        if video_data:
            title = video_data.get('title', title)
            description = video_data.get('description', description)
            views = video_data.get('view_count', views)
            likes = video_data.get('like_count', likes)
            comments = video_data.get('comment_count', comments)
        
        analysis = self.analyze_video(video_data or {'title': title, 'description': description}, title, description, views, likes, comments)
        
        return {
            'popularity_score': analysis['popularity_score'],
            'popularity_score_precise': analysis['popularity_score_precise'],
            'reason': analysis['reason'],
            'view_details': analysis['view_details']
        }


def score_video_popularity(title: str, description: str = "", views: Union[str, int] = 0,
                          likes: Union[str, int] = 0, comments: Union[str, int] = 0) -> str:
    """
    Convenience function to score video popularity and return JSON.
    
    Args:
        title: Video title
        description: Video description  
        views: View count
        likes: Like count
        comments: Comment count
        
    Returns:
        str: JSON string with popularity_score and reason
    """
    scorer = PopularityScorer()
    result = scorer.score_video_simple(title, description, views, likes, comments)
    return json.dumps(result, ensure_ascii=False)


def add_popularity_scores(video_list: list) -> list:
    """
    Add popularity scores to a list of video data dictionaries.
    
    Args:
        video_list: List of video dictionaries with metadata
        
    Returns:
        list: Updated video list with popularity_score and reason added
    """
    if not video_list:
        return video_list
    
    scorer = PopularityScorer()
    updated_videos = []
    
    print(f"🔥 Adding popularity scores to {len(video_list)} videos...")
    
    for i, video in enumerate(video_list, 1):
        try:
            # Score the video using enhanced method with full video data
            score_result = scorer.score_video_simple(video_data=video)
            
            # Add scores and view details to video data
            updated_video = video.copy()
            updated_video['popularity_score'] = score_result['popularity_score']
            updated_video['popularity_score_precise'] = score_result.get('popularity_score_precise', score_result['popularity_score'])
            updated_video['reason'] = score_result['reason']
            updated_video['view_details'] = score_result['view_details']
            
            updated_videos.append(updated_video)
            
            # Progress indicator
            if i % 5 == 0 or i == len(video_list):
                print(f"   Processed {i}/{len(video_list)} videos...")
                
        except Exception as e:
            print(f"   ⚠️ Error scoring video {i}: {str(e)}")
            # Keep original video without changes
            updated_videos.append(video)
    
    print("✅ Popularity scoring complete!")
    return updated_videos


def main():
    """
    Demo function showing how to use the popularity scorer.
    """
    print("🔥 Popularity Scoring AI Demo")
    print("=" * 50)
    
    # Sample videos to test
    test_videos = [
        {
            'title': '🔴 LIVE: 🇹🇭 ไทย พบ 🇨🇦 แคนาดา | VNL 2025 | แมตช์ประวัติศาสตร์',
            'description': 'Volleyball World มอบสิทธิ์ให้แฟนๆ ชาวไทยรับชมแมตช์ประวัติศาสตร์ได้ฟรี!',
            'views': '2,190,133',
            'likes': '36354',
            'comments': '2368'
        },
        {
            'title': 'BLACKPINK - \'뛰어(JUMP)\' M/V',
            'description': 'BLACKPINK - 뛰어(JUMP) official music video',
            'views': '57,380,667',
            'likes': '4291017',
            'comments': '360816'
        },
        {
            'title': 'วิธีทำต้มยำกุ้ง สูตรต้นตำรับ',
            'description': 'สอนทำต้มยำกุ้งแบบดั้งเดิม วัตถุดิบง่าย ๆ',
            'views': '125,000',
            'likes': '3,200',
            'comments': '450'
        }
    ]
    
    scorer = PopularityScorer()
    
    for i, video in enumerate(test_videos, 1):
        print(f"\n🎬 Video #{i}: {video['title'][:50]}...")
        print("-" * 40)
        
        # Simple scoring
        simple_result = scorer.score_video_simple(
            video['title'], 
            video['description'], 
            video['views'], 
            video['likes'], 
            video['comments']
        )
        
        print("📊 Simple Result:")
        print(json.dumps(simple_result, ensure_ascii=False, indent=2))
        
        # Detailed analysis
        detailed_result = scorer.analyze_video(
            video['title'], 
            video['description'], 
            video['views'], 
            video['likes'], 
            video['comments']
        )
        
        print(f"\n📈 Detailed Analysis:")
        print(f"Views Score: {detailed_result['analysis']['views_score']}/30")
        print(f"Engagement Score: {detailed_result['analysis']['engagement_score']}/50")
        print(f"Keyword Score: {detailed_result['analysis']['keyword_score']}/20")
        print(f"Like Rate: {detailed_result['analysis']['likes_ratio']}%")
        print(f"Comment Rate: {detailed_result['analysis']['comments_ratio']}%")
        print(f"Viral Keywords: {detailed_result['analysis']['found_keywords']}")
        
        print("\n" + "=" * 50)


if __name__ == "__main__":
    main() 