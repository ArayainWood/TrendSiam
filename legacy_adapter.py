#!/usr/bin/env python3
"""
Legacy Adapter for TrendSiam V2 Compatibility

This module provides adapters to reuse legacy popularity scoring and category
classification logic in the V2 ingestion system, ensuring 100% compatibility.
"""

import sys
import logging
from typing import Dict, Any, List
from pathlib import Path

logger = logging.getLogger(__name__)

class LegacyAdapter:
    """Adapter to interface with legacy TrendSiam functions."""
    
    def __init__(self):
        """Initialize the adapter and import legacy functions."""
        self._popularity_scorer = None
        self._category_classifier = None
        self._setup_legacy_imports()
    
    def _setup_legacy_imports(self):
        """Import legacy functions with error handling."""
        try:
            # Import legacy popularity scorer
            from popularity_scorer import add_popularity_scores
            self._popularity_scorer = add_popularity_scores
            logger.debug("✅ Legacy popularity scorer imported successfully")
        except ImportError as e:
            logger.warning(f"⚠️ Failed to import legacy popularity scorer: {e}")
            self._popularity_scorer = None
        
        try:
            # Import legacy category classifier from app.py
            from app import assign_smart_category, classify_news_item_with_metadata
            self._category_classifier = assign_smart_category
            self._detailed_classifier = classify_news_item_with_metadata
            logger.debug("✅ Legacy category classifier imported successfully")
        except ImportError as e:
            logger.warning(f"⚠️ Failed to import legacy category classifier: {e}")
            self._category_classifier = None
            self._detailed_classifier = None
    
    def compute_popularity_scores(self, videos: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Compute popularity scores using legacy scorer.
        
        Args:
            videos: List of video dictionaries
            
        Returns:
            Videos with popularity scores added using legacy logic
        """
        if not self._popularity_scorer:
            logger.error("❌ Legacy popularity scorer not available")
            return videos
        
        logger.info(f"🔥 Computing popularity scores for {len(videos)} videos using legacy scorer...")
        
        try:
            # Use legacy scorer directly - it modifies videos in place
            scored_videos = self._popularity_scorer(videos)
            logger.info("✅ Legacy popularity scoring completed")
            return scored_videos
        except Exception as e:
            logger.error(f"❌ Error in legacy popularity scoring: {e}")
            return videos
    
    def classify_categories(self, videos: List[Dict[str, Any]], 
                          reclassify: bool = False) -> List[Dict[str, Any]]:
        """
        Classify categories using legacy classifier.
        
        Args:
            videos: List of video dictionaries
            reclassify: If True, reclassify all items. If False, only classify missing/Unknown
            
        Returns:
            Videos with categories classified using legacy logic
        """
        if not self._category_classifier:
            logger.error("❌ Legacy category classifier not available")
            return videos
        
        logger.info(f"🏷️ Classifying categories for {len(videos)} videos using legacy classifier...")
        
        classified_videos = []
        unknown_count = 0
        reclassified_count = 0
        
        for i, video in enumerate(videos, 1):
            try:
                current_category = video.get('auto_category')
                needs_classification = (
                    reclassify or 
                    not current_category or 
                    current_category in ['Unknown', 'อื่นๆ (Others)', '']
                )
                
                if needs_classification:
                    # Ensure video has required text fields for classification
                    self._ensure_text_fields(video)
                    
                    # Use legacy classifier
                    category = self._category_classifier(video)
                    video['auto_category'] = category
                    reclassified_count += 1
                    
                    # Also add detailed metadata if available
                    if self._detailed_classifier:
                        try:
                            detailed_result = self._detailed_classifier(video)
                            video['category_metadata'] = {
                                'category': detailed_result['category'],
                                'parent_category': detailed_result.get('parent_category'),
                                'score': detailed_result.get('score')
                            }
                        except Exception as e:
                            logger.debug(f"Could not add detailed metadata for video {i}: {e}")
                
                # Count unknowns
                final_category = video.get('auto_category', 'Unknown')
                if final_category in ['Unknown', 'อื่นๆ (Others)', '']:
                    unknown_count += 1
                
                classified_videos.append(video)
                
                # Progress indicator
                if i % 10 == 0 or i == len(videos):
                    logger.debug(f"   Classified {i}/{len(videos)} videos...")
                    
            except Exception as e:
                logger.warning(f"⚠️ Error classifying video {i}: {e}")
                # Keep original video with fallback category
                if not video.get('auto_category'):
                    video['auto_category'] = 'อื่นๆ (Others)'
                classified_videos.append(video)
                unknown_count += 1
        
        unknown_rate = (unknown_count / len(videos)) * 100 if videos else 0
        logger.info(f"✅ Legacy category classification completed:")
        logger.info(f"   Reclassified: {reclassified_count} videos")
        logger.info(f"   Unknown/Others: {unknown_count} videos ({unknown_rate:.1f}%)")
        
        return classified_videos
    
    def get_legacy_score_function(self):
        """Get the legacy get_precise_score function."""
        try:
            from summarize_all import get_precise_score
            return get_precise_score
        except ImportError:
            logger.warning("⚠️ Could not import legacy get_precise_score function")
            return None
    
    def validate_compatibility(self, legacy_videos: List[Dict], v2_videos: List[Dict], 
                             tolerance: float = 1e-6) -> Dict[str, Any]:
        """
        Validate that V2 produces compatible results with legacy.
        
        Args:
            legacy_videos: Videos processed by legacy system
            v2_videos: Videos processed by V2 system
            tolerance: Acceptable difference in scores
            
        Returns:
            Validation results dictionary
        """
        results = {
            'score_drift': [],
            'category_mismatches': [],
            'max_score_difference': 0,
            'compatible': True
        }
        
        # Create lookup by story_id or video_id
        legacy_lookup = {v.get('story_id', v.get('video_id')): v for v in legacy_videos}
        
        for v2_video in v2_videos:
            video_id = v2_video.get('story_id', v2_video.get('video_id'))
            legacy_video = legacy_lookup.get(video_id)
            
            if not legacy_video:
                continue
            
            # Compare scores
            legacy_score = self._get_score(legacy_video)
            v2_score = self._get_score(v2_video)
            
            if legacy_score is not None and v2_score is not None:
                diff = abs(legacy_score - v2_score)
                results['max_score_difference'] = max(results['max_score_difference'], diff)
                
                if diff > tolerance:
                    results['score_drift'].append({
                        'video_id': video_id,
                        'legacy_score': legacy_score,
                        'v2_score': v2_score,
                        'difference': diff
                    })
                    results['compatible'] = False
            
            # Compare categories
            legacy_cat = legacy_video.get('auto_category', '').strip()
            v2_cat = v2_video.get('auto_category', '').strip()
            
            if legacy_cat and v2_cat and legacy_cat != v2_cat:
                results['category_mismatches'].append({
                    'video_id': video_id,
                    'legacy_category': legacy_cat,
                    'v2_category': v2_cat
                })
        
        return results
    
    def _ensure_text_fields(self, video: Dict[str, Any]) -> None:
        """Ensure video has non-None text fields required for classification."""
        # Fill in missing or None text fields with empty strings
        text_fields = ['title', 'description', 'summary', 'summary_en', 'channel']
        
        for field in text_fields:
            if video.get(field) is None:
                video[field] = ''
        
        # Ensure we have a title for classification
        if not video.get('title'):
            video['title'] = f"Video {video.get('video_id', 'Unknown')}"
        
        # Ensure we have description from title if missing
        if not video.get('description') and video.get('title'):
            video['description'] = video['title']
    
    def _get_score(self, video: Dict[str, Any]) -> float:
        """Extract the precise score from a video dict."""
        score = video.get('popularity_score_precise')
        if score is not None:
            try:
                return float(score)
            except (ValueError, TypeError):
                pass
        
        score = video.get('popularity_score')
        if score is not None:
            try:
                return float(score)
            except (ValueError, TypeError):
                pass
        
        return None
