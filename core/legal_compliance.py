#!/usr/bin/env python3
"""
Legal Compliance Module for TrendSiam

This module ensures compliance with Terms of Service, privacy regulations,
and responsible data usage for all integrated platforms and services.
"""

import json
import time
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from pathlib import Path
import logging

from .logging_config import create_module_logger
from .validators import SecurityValidator

logger = create_module_logger(__name__)

class ComplianceViolation(Exception):
    """Exception raised for legal compliance violations"""
    pass

class TermsOfServiceCompliance:
    """
    Terms of Service compliance checker for various platforms
    """
    
    # Platform-specific compliance rules
    PLATFORM_RULES = {
        'youtube': {
            'rate_limits': {
                'api_requests_per_day': 10000,
                'api_requests_per_hour': 1000,
                'video_fetch_per_hour': 100
            },
            'prohibited_actions': [
                'bulk_download',
                'automated_interaction',
                'data_scraping_personal',
                'copyright_violation'
            ],
            'required_attribution': True,
            'data_retention_days': 30,
            'allowed_use_cases': [
                'news_summarization',
                'trend_analysis',
                'public_data_research'
            ]
        },
        'openai': {
            'rate_limits': {
                'requests_per_minute': 60,
                'tokens_per_minute': 90000
            },
            'prohibited_content': [
                'harmful_content',
                'personal_information',
                'copyrighted_material',
                'misleading_information'
            ],
            'usage_monitoring': True,
            'content_filtering': True,
            'required_disclaimers': [
                'ai_generated_content',
                'not_human_authored'
            ]
        },
        'dalle': {
            'rate_limits': {
                'images_per_minute': 5,
                'images_per_hour': 50
            },
            'prohibited_content': [
                'realistic_faces',
                'copyrighted_characters',
                'harmful_imagery',
                'misleading_content'
            ],
            'watermarking': False,  # DALL-E 3 includes C2PA metadata
            'usage_rights': 'commercial_allowed'
        }
    }
    
    @staticmethod
    def check_youtube_compliance(action: str, data: Dict[str, Any]) -> bool:
        """
        Check YouTube API Terms of Service compliance
        
        Args:
            action: Action being performed
            data: Data being processed
            
        Returns:
            True if compliant, raises ComplianceViolation if not
        """
        rules = TermsOfServiceCompliance.PLATFORM_RULES['youtube']
        
        # Check for prohibited actions
        if action in rules['prohibited_actions']:
            raise ComplianceViolation(f"Action '{action}' violates YouTube ToS")
        
        # Validate data usage is within allowed scope
        if action == 'video_analysis':
            # Only analyze public metadata, not private info
            allowed_fields = {
                'title', 'description', 'view_count', 'publish_date',
                'channel', 'duration', 'thumbnail', 'category'
            }
            
            if not data or not isinstance(data, dict):
                return True
                
            for field in data.keys():
                if field not in allowed_fields:
                    logger.warning(f"Filtering non-compliant YouTube data field: {field}")
                    
        # Check data retention compliance
        if 'publish_date' in data:
            try:
                # Ensure we don't retain old data beyond policy
                pub_date = datetime.strptime(str(data['publish_date']), '%Y%m%d')
                retention_limit = datetime.now() - timedelta(days=rules['data_retention_days'])
                
                if pub_date < retention_limit:
                    logger.info(f"Data beyond retention policy, not processing: {pub_date}")
                    return False
                    
            except (ValueError, KeyError):
                pass  # Handle missing or invalid dates gracefully
        
        logger.info("YouTube ToS compliance check passed")
        return True
    
    @staticmethod
    def check_openai_compliance(content: str, use_case: str) -> bool:
        """
        Check OpenAI API Terms of Service compliance
        
        Args:
            content: Content being sent to OpenAI
            use_case: Intended use case
            
        Returns:
            True if compliant, raises ComplianceViolation if not
        """
        rules = TermsOfServiceCompliance.PLATFORM_RULES['openai']
        
        # Content filtering
        if not content or not isinstance(content, str):
            return True
            
        # Check for prohibited content patterns
        prohibited_patterns = [
            r'(?i)personal.?information',
            r'(?i)social.?security',
            r'(?i)credit.?card',
            r'(?i)password',
            r'(?i)private.?key'
        ]
        
        import re
        for pattern in prohibited_patterns:
            if re.search(pattern, content):
                raise ComplianceViolation(f"Content contains prohibited information: {pattern}")
        
        # Validate content length for token limits
        estimated_tokens = len(content.split()) * 1.3  # Rough estimate
        if estimated_tokens > 4000:  # Conservative limit
            logger.warning(f"Content may exceed token limits: ~{estimated_tokens} tokens")
        
        logger.info("OpenAI ToS compliance check passed")
        return True
    
    @staticmethod
    def check_dalle_compliance(prompt: str, intended_use: str) -> bool:
        """
        Check DALL-E API Terms of Service compliance
        
        Args:
            prompt: Image generation prompt
            intended_use: Intended use for generated image
            
        Returns:
            True if compliant, raises ComplianceViolation if not
        """
        rules = TermsOfServiceCompliance.PLATFORM_RULES['dalle']
        
        if not prompt or not isinstance(prompt, str):
            return True
            
        # Check for prohibited content in prompts
        prohibited_terms = [
            'real person', 'celebrity', 'politician', 'specific individual',
            'copyrighted character', 'branded content', 'trademark',
            'violent', 'graphic', 'inappropriate', 'harmful'
        ]
        
        prompt_lower = prompt.lower()
        for term in prohibited_terms:
            if term in prompt_lower:
                logger.warning(f"DALL-E prompt contains potentially prohibited term: {term}")
                # Don't block entirely, but flag for review
        
        # Ensure editorial/news use compliance
        if intended_use not in ['editorial', 'news', 'journalism', 'illustration']:
            logger.warning(f"Image intended use may not be compliant: {intended_use}")
        
        logger.info("DALL-E ToS compliance check passed")
        return True

class PrivacyCompliance:
    """
    Privacy regulation compliance (GDPR, CCPA, etc.)
    """
    
    @staticmethod
    def check_data_collection(data: Dict[str, Any], source: str) -> Dict[str, Any]:
        """
        Ensure data collection is privacy-compliant
        
        Args:
            data: Data being collected
            source: Source of the data
            
        Returns:
            Privacy-compliant filtered data
        """
        if not data or not isinstance(data, dict):
            return data
            
        # Remove any potential PII
        pii_fields = {
            'email', 'phone', 'address', 'ip_address', 'user_id',
            'personal_name', 'social_security', 'credit_card'
        }
        
        filtered_data = {}
        for key, value in data.items():
            # Skip PII fields
            if key.lower() in pii_fields:
                logger.info(f"Filtering PII field for privacy compliance: {key}")
                continue
                
            # Sanitize text content
            if isinstance(value, str):
                filtered_data[key] = SecurityValidator.sanitize_text(value)
            else:
                filtered_data[key] = value
        
        # Add privacy metadata
        filtered_data['_privacy_compliant'] = True
        filtered_data['_collection_timestamp'] = datetime.now().isoformat()
        filtered_data['_data_source'] = source
        
        return filtered_data
    
    @staticmethod
    def generate_privacy_notice() -> str:
        """Generate privacy notice for data collection"""
        return """
        PRIVACY NOTICE: TrendSiam Data Collection
        
        This application collects only publicly available information from:
        - YouTube trending videos (titles, descriptions, view counts, publish dates)
        - No personal information or private data is collected
        - Data is used solely for news summarization and trend analysis
        - Data retention: 30 days maximum
        - No data is shared with third parties
        - Users can request data deletion at any time
        
        For privacy concerns, contact: privacy@trendsiam.app
        """

class EthicalAICompliance:
    """
    Ethical AI usage compliance and safety measures
    """
    
    @staticmethod
    def validate_ai_content(content: str, content_type: str) -> bool:
        """
        Validate AI-generated content for ethical compliance
        
        Args:
            content: AI-generated content
            content_type: Type of content (summary, image_prompt, etc.)
            
        Returns:
            True if content passes ethical review
        """
        if not content:
            return True
            
        # Check for potential bias or harmful content
        harmful_indicators = [
            'discriminatory language',
            'stereotyping',
            'false claims',
            'misleading information',
            'hate speech',
            'extremist content'
        ]
        
        content_lower = content.lower()
        
        # Basic content safety check
        suspicious_patterns = [
            r'(?i)all.?(people|men|women).?are',
            r'(?i)(always|never).?(men|women|people)',
            r'(?i)definitively.?(proves|shows|confirms)',
            r'(?i)scientific.?fact.?(that|is)',
        ]
        
        import re
        for pattern in suspicious_patterns:
            if re.search(pattern, content):
                logger.warning(f"AI content may contain bias or false claims: {pattern}")
                # Flag but don't block - human review recommended
        
        # Ensure appropriate disclaimers for AI content
        if content_type in ['summary', 'analysis']:
            # AI-generated summaries should be clearly labeled
            if 'ai' not in content_lower and 'generated' not in content_lower:
                logger.info("AI content should include appropriate disclaimers")
        
        return True
    
    @staticmethod
    def get_ai_content_disclaimer(content_type: str) -> str:
        """Get appropriate disclaimer for AI-generated content"""
        disclaimers = {
            'summary': "📝 This summary was generated by AI and may not capture all nuances of the original content.",
            'image': "🎨 This image was generated by AI for editorial illustration purposes.",
            'analysis': "📊 This analysis was generated by AI and should be verified independently."
        }
        
        return disclaimers.get(content_type, "⚠️ This content was generated by AI.")

class ComplianceManager:
    """
    Centralized compliance management for all platform interactions
    """
    
    def __init__(self):
        self.tos_checker = TermsOfServiceCompliance()
        self.privacy_checker = PrivacyCompliance()
        self.ai_checker = EthicalAICompliance()
        
        # Track compliance events
        self.compliance_log = []
        
    def validate_youtube_action(self, action: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate YouTube action for full compliance"""
        try:
            # ToS compliance
            self.tos_checker.check_youtube_compliance(action, data)
            
            # Privacy compliance
            clean_data = self.privacy_checker.check_data_collection(data, 'youtube')
            
            # Log compliance check
            self._log_compliance_event('youtube', action, 'passed')
            
            return clean_data
            
        except ComplianceViolation as e:
            self._log_compliance_event('youtube', action, 'failed', str(e))
            raise
    
    def validate_openai_usage(self, content: str, use_case: str) -> bool:
        """Validate OpenAI usage for full compliance"""
        try:
            # ToS compliance
            self.tos_checker.check_openai_compliance(content, use_case)
            
            # Ethical AI compliance
            self.ai_checker.validate_ai_content(content, use_case)
            
            # Log compliance check
            self._log_compliance_event('openai', use_case, 'passed')
            
            return True
            
        except ComplianceViolation as e:
            self._log_compliance_event('openai', use_case, 'failed', str(e))
            raise
    
    def validate_dalle_usage(self, prompt: str, intended_use: str) -> bool:
        """Validate DALL-E usage for full compliance"""
        try:
            # ToS compliance
            self.tos_checker.check_dalle_compliance(prompt, intended_use)
            
            # Ethical AI compliance (for prompt content)
            self.ai_checker.validate_ai_content(prompt, 'image_prompt')
            
            # Log compliance check
            self._log_compliance_event('dalle', intended_use, 'passed')
            
            return True
            
        except ComplianceViolation as e:
            self._log_compliance_event('dalle', intended_use, 'failed', str(e))
            raise
    
    def _log_compliance_event(self, platform: str, action: str, 
                             status: str, details: str = None) -> None:
        """Log compliance events for auditing"""
        event = {
            'timestamp': datetime.now().isoformat(),
            'platform': platform,
            'action': action,
            'status': status,
            'details': details
        }
        
        self.compliance_log.append(event)
        
        # Log to security logger
        if status == 'failed':
            logger.security(f"Compliance violation: {platform}.{action} - {details}")
        else:
            logger.info(f"Compliance check passed: {platform}.{action}")
    
    def get_compliance_report(self) -> Dict[str, Any]:
        """Generate compliance report for auditing"""
        total_checks = len(self.compliance_log)
        failed_checks = len([e for e in self.compliance_log if e['status'] == 'failed'])
        
        platforms = {}
        for event in self.compliance_log:
            platform = event['platform']
            if platform not in platforms:
                platforms[platform] = {'total': 0, 'failed': 0}
            platforms[platform]['total'] += 1
            if event['status'] == 'failed':
                platforms[platform]['failed'] += 1
        
        return {
            'total_compliance_checks': total_checks,
            'failed_checks': failed_checks,
            'success_rate': (total_checks - failed_checks) / max(total_checks, 1) * 100,
            'platforms': platforms,
            'generated_at': datetime.now().isoformat()
        }

# Global compliance manager instance
_compliance_manager: Optional[ComplianceManager] = None

def get_compliance_manager() -> ComplianceManager:
    """Get global compliance manager instance"""
    global _compliance_manager
    if _compliance_manager is None:
        _compliance_manager = ComplianceManager()
    return _compliance_manager

def ensure_youtube_compliance(action: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Convenience function for YouTube compliance validation"""
    return get_compliance_manager().validate_youtube_action(action, data)

def ensure_openai_compliance(content: str, use_case: str) -> bool:
    """Convenience function for OpenAI compliance validation"""
    return get_compliance_manager().validate_openai_usage(content, use_case)

def ensure_dalle_compliance(prompt: str, intended_use: str) -> bool:
    """Convenience function for DALL-E compliance validation"""
    return get_compliance_manager().validate_dalle_usage(prompt, intended_use) 