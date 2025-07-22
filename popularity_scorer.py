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
        
        # Score engagement ratios
        likes_score = 0
        if likes_ratio >= self.engagement_thresholds['high_likes_ratio']:
            likes_score = 30
        elif likes_ratio >= self.engagement_thresholds['medium_likes_ratio']:
            likes_score = 20
        elif likes_ratio > 0:
            likes_score = 10
        
        comments_score = 0
        if comments_ratio >= self.engagement_thresholds['high_comments_ratio']:
            comments_score = 20
        elif comments_ratio >= self.engagement_thresholds['medium_comments_ratio']:
            comments_score = 15
        elif comments_ratio > 0:
            comments_score = 10
        
        return {
            'likes_ratio': likes_ratio,
            'comments_ratio': comments_ratio,
            'engagement_score': likes_score + comments_score
        }
    
    def calculate_views_score(self, views: int) -> int:
        """
        Calculate score based on view count.
        
        Args:
            views: Number of views
            
        Returns:
            int: Views score (0-30)
        """
        if views >= self.engagement_thresholds['high_views']:
            return 30
        elif views >= self.engagement_thresholds['medium_views']:
            return 20
        elif views >= 10_000:
            return 15
        elif views >= 1_000:
            return 10
        elif views > 0:
            return 5
        else:
            return 0
    
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
        
        keyword_score = 0
        found_keywords = []
        
        for category, keywords in self.viral_keywords.items():
            for keyword in keywords:
                if keyword.lower() in text:
                    found_keywords.append(keyword)
                    
                    # Different categories have different weight
                    if category == 'live_urgent':
                        keyword_score += 8
                    elif category == 'celebrities':
                        keyword_score += 6
                    elif category == 'social_platforms':
                        keyword_score += 4
                    elif category == 'emotional_hooks':
                        keyword_score += 3
                    elif category == 'exclusive':
                        keyword_score += 5
        
        # Cap keyword score at 20
        keyword_score = min(keyword_score, 20)
        
        return {
            'keyword_score': keyword_score,
            'found_keywords': found_keywords
        }
    
    def analyze_video(self, title: str, description: str = "", views: Union[str, int] = 0, 
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
        
        # Calculate total score (max 100)
        total_score = (
            views_score +  # Max 30
            engagement_metrics['engagement_score'] +  # Max 50
            keyword_analysis['keyword_score']  # Max 20
        )
        
        # Generate reason
        reason_parts = []
        
        if views_count >= 1_000_000:
            reason_parts.append("high views")
        elif views_count >= 100_000:
            reason_parts.append("good views")
        
        if engagement_metrics['likes_ratio'] >= 0.02:
            reason_parts.append("strong engagement")
        elif engagement_metrics['likes_ratio'] > 0:
            reason_parts.append("moderate engagement")
        
        if keyword_analysis['found_keywords']:
            reason_parts.append(f"viral keywords ({', '.join(keyword_analysis['found_keywords'][:2])})")
        
        if not reason_parts:
            reason = "Low engagement and limited viral indicators"
        else:
            reason = f"High popularity due to {', '.join(reason_parts)}"
        
        return {
            'popularity_score': min(total_score, 100),
            'reason': reason,
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
    
    def score_video_simple(self, title: str, description: str = "", views: Union[str, int] = 0, 
                          likes: Union[str, int] = 0, comments: Union[str, int] = 0) -> Dict[str, Any]:
        """
        Simple scoring function that returns only score and reason.
        
        Args:
            title: Video title
            description: Video description
            views: View count
            likes: Like count
            comments: Comment count
            
        Returns:
            Dict with popularity_score and reason only
        """
        analysis = self.analyze_video(title, description, views, likes, comments)
        
        return {
            'popularity_score': analysis['popularity_score'],
            'reason': analysis['reason']
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
            # Extract video data - handle different field name variations
            title = video.get('title', '')
            description = video.get('description', '')
            views = video.get('view_count', video.get('views', 0))
            likes = video.get('like_count', video.get('likes', 0))
            comments = video.get('comment_count', video.get('comments', 0))
            
            # Score the video
            score_result = scorer.score_video_simple(title, description, views, likes, comments)
            
            # Add scores to video data
            updated_video = video.copy()
            updated_video['popularity_score'] = score_result['popularity_score']
            updated_video['reason'] = score_result['reason']
            
            updated_videos.append(updated_video)
            
            # Progress indicator
            if i % 5 == 0 or i == len(video_list):
                print(f"   Processed {i}/{len(video_list)} videos...")
            
        except Exception as e:
            print(f"   ⚠️ Error scoring video {i}: {str(e)}")
            # Keep video without score if error occurs
            updated_videos.append(video)
    
    print(f"✅ Popularity scoring complete!")
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