#!/usr/bin/env python3
"""
Simple example of the Popularity Scoring AI
"""

from popularity_scorer import PopularityScorer
import json

def analyze_single_video():
    """Example of analyzing a single video"""
    
    # Initialize the scorer
    scorer = PopularityScorer()
    
    # Example video metadata (replace these with actual values)
    title = "🔴 LIVE: BLACKPINK ด่วน! Breaking exclusive footage"
    description = "Amazing behind the scenes content revealed for fans worldwide"
    views = "3,500,000"
    likes = "175,000" 
    comments = "28,000"
    
    print("📊 Video Metadata:")
    print(f"Title: {title}")
    print(f"Description: {description}")
    print(f"Views: {views}")
    print(f"Likes: {likes}")
    print(f"Comments: {comments}")
    print("\n" + "="*50)
    
    # Get popularity score
    result = scorer.score_video_simple(title, description, views, likes, comments)
    
    print("🎯 Popularity Analysis Result:")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    
    return result

if __name__ == "__main__":
    analyze_single_video() 