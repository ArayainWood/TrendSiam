#!/usr/bin/env python3
"""
YouTube Video Summarizer

This script provides functionality to generate Thai-language summaries of YouTube videos
using OpenAI's GPT-3.5-turbo model. It processes video metadata and creates concise,
news-style summaries suitable for reporting.

Features:
- Thai-language summary generation
- News-style reporting format
- Error handling and graceful degradation
- Configurable OpenAI API settings
- Legal compliance (uses only public metadata)
- Robust retry logic with exponential backoff
- Rate limit handling for API stability
"""

import logging
import time
import random
from typing import Dict, Any, Optional
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    logger.error("OpenAI library not installed. Please install it using: pip install openai")
    openai = None
    OPENAI_AVAILABLE = False

# Import OpenAI exceptions dynamically to avoid type issues
if OPENAI_AVAILABLE and openai:
    try:
        # Try new SDK format (>=1.0)
        from openai._exceptions import APITimeoutError, RateLimitError, APIError
    except ImportError:
        try:
            # Fallback to older SDK format
            from openai import APITimeoutError, RateLimitError, APIError
        except ImportError:
            # If exceptions can't be imported, use generic Exception
            APITimeoutError = Exception
            RateLimitError = Exception
            APIError = Exception
else:
    # OpenAI not available, use generic Exception
    APITimeoutError = Exception
    RateLimitError = Exception
    APIError = Exception

try:
    from config_openai import (
        OPENAI_API_KEY,
        OPENAI_MODEL,
        OPENAI_MAX_TOKENS,
        OPENAI_TEMPERATURE,
        OPENAI_TIMEOUT,
        OPENAI_MAX_RETRIES
    )
except ImportError:
    logger.error("config_openai.py not found. Please ensure the configuration file exists.")
    OPENAI_API_KEY = None


class VideoSummarizer:
    """
    A class to generate Thai-language summaries of YouTube videos using OpenAI API.
    
    This class handles API communication, error management, and summary generation
    with proper formatting for news-style reporting.
    """
    
    def __init__(self):
        """Initialize the summarizer with OpenAI configuration."""
        self.client = None
        self._initialize_openai()
    
    def _initialize_openai(self) -> bool:
        """
        Initialize OpenAI client with API key validation.
        
        Returns:
            bool: True if initialization successful, False otherwise
        """
        if not openai:
            logger.error("OpenAI library is not available")
            return False
        
        if not OPENAI_API_KEY or OPENAI_API_KEY == "your-openai-api-key-here":
            logger.error("OpenAI API key not configured. Please update config_openai.py with your API key")
            return False
        
        try:
            # Initialize OpenAI client
            self.client = openai.OpenAI(api_key=OPENAI_API_KEY)
            logger.info("OpenAI client initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI client: {str(e)}")
            return False
    
    def _format_video_data(self, video: Dict[str, Any]) -> Dict[str, str]:
        """
        Format video data for summary generation.
        
        Args:
            video: Dictionary containing video metadata
            
        Returns:
            Dict[str, str]: Formatted video data with safe defaults
        """
        # Format view count for better readability
        view_count = video.get('view_count', '0')
        if view_count and view_count.isdigit():
            view_count = f"{int(view_count):,}"
        
        # Format upload date from YYYYMMDD to readable format
        upload_date = video.get('publish_date', 'N/A')
        if upload_date and upload_date != 'N/A' and len(upload_date) == 8:
            try:
                formatted_date = f"{upload_date[6:8]}/{upload_date[4:6]}/{upload_date[:4]}"
            except (ValueError, IndexError):
                formatted_date = upload_date
        else:
            formatted_date = upload_date
        
        return {
            'title': video.get('title', 'ไม่มีชื่อ')[:200],  # Limit title length
            'description': video.get('description', 'ไม่มีคำอธิบาย')[:500],  # Limit description
            'views': view_count,
            'upload_date': formatted_date,
            'channel': video.get('channel', 'ไม่ทราบช่อง')
        }
    
    def _create_prompt(self, video_data: Dict[str, str]) -> str:
        """
        Create the Thai prompt for OpenAI API using simplified template.
        
        Args:
            video_data: Formatted video data dictionary
            
        Returns:
            str: Complete prompt for Thai summarization
        """
        prompt = (
            f"Summarize the following YouTube video title and description in **Thai** language.\n"
            f"Make it concise (1–2 lines), clear, and easy to understand for a Thai audience.\n\n"
            f"Title: {video_data['title']}\n"
            f"Description: {video_data['description']}\n\n"
            f"Summary in Thai:"
        )
        return prompt
    
    def _call_openai_api(self, prompt: str) -> Optional[str]:
        """
        Make API call to OpenAI with retry logic and error handling.
        
        Args:
            prompt: The prompt to send to OpenAI
            
        Returns:
            Optional[str]: Generated summary or None if failed
        """
        if not self.client:
            logger.error("OpenAI client not initialized")
            return None
        
        for attempt in range(OPENAI_MAX_RETRIES + 1):
            try:
                logger.debug(f"Making OpenAI API call (attempt {attempt + 1})")
                
                response = self.client.chat.completions.create(
                    model=OPENAI_MODEL,
                    messages=[
                        {
                            "role": "system",
                            "content": "คุณเป็นนักข่าวที่เชี่ยวชาญในการสรุปข่าวเป็นภาษาไทย กรุณาสรุปข้อมูลวิดีโอให้กระชับและเป็นทางการ"
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    max_tokens=OPENAI_MAX_TOKENS,
                    temperature=OPENAI_TEMPERATURE,
                    timeout=OPENAI_TIMEOUT
                )
                
                # Extract the response content
                if response.choices and len(response.choices) > 0:
                    content = response.choices[0].message.content
                    summary = content.strip() if content else None
                    if summary:
                        logger.info("Successfully generated summary using OpenAI API")
                        return summary
                    else:
                        logger.warning("OpenAI API returned empty content")
                        return None
                else:
                    logger.warning("Empty response from OpenAI API")
                    return None
                    
            except APITimeoutError:
                logger.warning(f"OpenAI API timeout (attempt {attempt + 1})")
                if attempt < OPENAI_MAX_RETRIES:
                    time.sleep(2 ** attempt)  # Exponential backoff
                    continue
                else:
                    logger.error("Max retries reached for OpenAI API timeout")
                    return None
                    
            except RateLimitError:
                logger.warning(f"OpenAI API rate limit exceeded (attempt {attempt + 1})")
                if attempt < OPENAI_MAX_RETRIES:
                    time.sleep(5 * (attempt + 1))  # Longer wait for rate limits
                    continue
                else:
                    logger.error("Max retries reached for OpenAI API rate limit")
                    return None
                    
            except APIError as e:
                logger.error(f"OpenAI API error: {str(e)}")
                return None
                
            except Exception as e:
                logger.error(f"Unexpected error calling OpenAI API: {str(e)}")
                return None
        
        return None
    
    def summarize_video_info(self, video: Dict[str, Any]) -> str:
        """
        Generate a Thai-language summary of YouTube video information.
        
        This function takes video metadata and generates a concise, news-style
        summary in Thai language using OpenAI's GPT-3.5-turbo model.
        
        Args:
            video: Dictionary containing video metadata with keys:
                  - title: Video title
                  - description: Video description
                  - view_count: Number of views
                  - publish_date: Upload date (YYYYMMDD format)
                  - channel: Channel name
                  - video_url: Video URL (optional)
                  
        Returns:
            str: Thai-language summary (max 3 lines) or error message
            
        Example:
            video_data = {
                'title': 'Amazing Thailand Travel Guide',
                'description': 'Discover the best places to visit in Thailand...',
                'view_count': '1500000',
                'publish_date': '20231201',
                'channel': 'TravelChannel'
            }
            summary = summarizer.summarize_video_info(video_data)
        """
        # Validate input
        if not isinstance(video, dict):
            logger.error("Input must be a dictionary")
            return "สรุปไม่สำเร็จ - ข้อมูลไม่ถูกต้อง"
        
        if not video.get('title'):
            logger.warning("Video title is missing")
            return "สรุปไม่สำเร็จ - ไม่มีหัวข้อวิดีโอ"
        
        try:
            # Format video data for processing
            formatted_data = self._format_video_data(video)
            logger.debug(f"Processing video: {formatted_data['title'][:50]}...")
            
            # Create Thai prompt
            prompt = self._create_prompt(formatted_data)
            
            # Generate summary using OpenAI API
            summary = self._call_openai_api(prompt)
            
            if summary:
                # Clean up the summary (remove extra whitespace, ensure proper formatting)
                lines = [line.strip() for line in summary.split('\n') if line.strip()]
                # Limit to 2 lines as requested
                if len(lines) > 2:
                    lines = lines[:2]
                
                final_summary = '\n'.join(lines)
                logger.info("Successfully generated video summary")
                return final_summary
            else:
                logger.error("Failed to generate summary from OpenAI API")
                return "สรุปไม่สำเร็จ - ระบบไม่สามารถสร้างสรุปได้"
                
        except Exception as e:
            logger.error(f"Error in summarize_video_info: {str(e)}")
            return "สรุปไม่สำเร็จ - เกิดข้อผิดพลาดในระบบ"


# Global instance for easy usage
_summarizer_instance = None

def get_summarizer() -> VideoSummarizer:
    """
    Get a singleton instance of VideoSummarizer.
    
    Returns:
        VideoSummarizer: Initialized summarizer instance
    """
    global _summarizer_instance
    if _summarizer_instance is None:
        _summarizer_instance = VideoSummarizer()
    return _summarizer_instance


def summarize_video_info(video: Dict[str, Any]) -> str:
    """
    Convenience function to summarize video information.
    
    This is a wrapper around VideoSummarizer.summarize_video_info() for easier usage.
    
    Args:
        video: Dictionary containing video metadata
        
    Returns:
        str: Thai-language summary or error message
    """
    summarizer = get_summarizer()
    return summarizer.summarize_video_info(video)


def summarize_thai_video(title: str, description: str) -> str:
    """
    Generate Thai summary from just title and description with robust retry logic.
    
    This function implements retry logic with exponential backoff to handle
    OpenAI API rate limits and temporary failures gracefully.
    
    Args:
        title: Video title
        description: Video description
        
    Returns:
        str: Thai-language summary or fallback error message
    """
    # Validate inputs
    if not title or not isinstance(title, str):
        logger.warning("Invalid or missing title")
        return "สรุปไม่สำเร็จ - ระบบไม่สามารถสร้างสรุปได้"
    
    if not description or not isinstance(description, str):
        logger.warning("Invalid or missing description, using title only")
        description = "ไม่มีคำอธิบาย"
    
    # Get summarizer instance
    summarizer = get_summarizer()
    
    if not summarizer.client:
        logger.error("OpenAI client not available")
        return "สรุปไม่สำเร็จ - ระบบไม่สามารถสร้างสรุปได้"
    
    # Retry configuration (3 attempts with 2s, 4s, 8s delays)
    max_retries = 3
    base_delay = 2.0
    
    for attempt in range(max_retries):
        try:
            # Create simplified prompt
            prompt = (
                f"Summarize the following YouTube video title and description in **Thai** language.\n"
                f"Make it concise (1–2 lines), clear, and easy to understand for a Thai audience.\n\n"
                f"Title: {title[:200]}\n"  # Limit title length
                f"Description: {description[:500]}\n\n"  # Limit description length
                f"Summary in Thai:"
            )
            
            logger.debug(f"Attempt {attempt + 1}/{max_retries} for video: {title[:50]}...")
            
            # Make API call
            response = summarizer.client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": "คุณเป็นนักข่าวที่เชี่ยวชาญในการสรุปข่าวเป็นภาษาไทย กรุณาสรุปข้อมูลวิดีโอให้กระชับและเป็นทางการ"
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=OPENAI_MAX_TOKENS,
                temperature=OPENAI_TEMPERATURE,
                timeout=OPENAI_TIMEOUT
            )
            
            # Extract and process response
            if response.choices and len(response.choices) > 0:
                content = response.choices[0].message.content
                summary = content.strip() if content else None
                
                if summary:
                    # Clean up the summary
                    lines = [line.strip() for line in summary.split('\n') if line.strip()]
                    # Limit to 2 lines as requested
                    if len(lines) > 2:
                        lines = lines[:2]
                    
                    final_summary = '\n'.join(lines)
                    logger.info(f"Successfully generated summary on attempt {attempt + 1}")
                    return final_summary
                else:
                    logger.warning(f"Empty content received on attempt {attempt + 1}")
                    # Don't retry for empty content, treat as API issue
                    if attempt == max_retries - 1:
                        return "สรุปไม่สำเร็จ - ระบบไม่สามารถสร้างสรุปได้"
            else:
                logger.warning(f"No choices in response on attempt {attempt + 1}")
                if attempt == max_retries - 1:
                    return "สรุปไม่สำเร็จ - ระบบไม่สามารถสร้างสรุปได้"
        
        except RateLimitError as e:
            logger.warning(f"Rate limit hit on attempt {attempt + 1}: {str(e)}")
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)  # Exponential backoff: 2s, 4s, 8s
                logger.info(f"Waiting {delay}s before retry...")
                time.sleep(delay)
                continue
            else:
                logger.error("Max retries exceeded for rate limit")
                return "สรุปไม่สำเร็จ - ระบบไม่สามารถสร้างสรุปได้"
        
        except APITimeoutError as e:
            logger.warning(f"API timeout on attempt {attempt + 1}: {str(e)}")
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)
                logger.info(f"Waiting {delay}s before retry...")
                time.sleep(delay)
                continue
            else:
                logger.error("Max retries exceeded for timeout")
                return "สรุปไม่สำเร็จ - ระบบไม่สามารถสร้างสรุปได้"
        
        except APIError as e:
            logger.error(f"OpenAI API error on attempt {attempt + 1}: {str(e)}")
            # For API errors, don't retry as they're likely permanent
            return "สรุปไม่สำเร็จ - ระบบไม่สามารถสร้างสรุปได้"
        
        except Exception as e:
            logger.error(f"Unexpected error on attempt {attempt + 1}: {str(e)}")
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)
                logger.info(f"Waiting {delay}s before retry...")
                time.sleep(delay)
                continue
            else:
                logger.error("Max retries exceeded for unexpected error")
                return "สรุปไม่สำเร็จ - ระบบไม่สามารถสร้างสรุปได้"
    
    # Should not reach here, but just in case
    return "สรุปไม่สำเร็จ - ระบบไม่สามารถสร้างสรุปได้"


def summarize_english_video(title: str, description: str) -> str:
    """
    Generate English summary from title and description with robust retry logic.
    
    This function generates concise English summaries using OpenAI API with
    optimized settings for token efficiency and neutral tone.
    
    Args:
        title: Video title
        description: Video description
        
    Returns:
        str: English-language summary (1-2 sentences) or fallback error message
    """
    # Validate inputs
    if not title or not isinstance(title, str):
        logger.warning("Invalid or missing title")
        return "Summary failed - Unable to generate summary"
    
    if not description or not isinstance(description, str):
        logger.warning("Invalid or missing description, using title only")
        description = "No description available"
    
    # Get summarizer instance
    summarizer = get_summarizer()
    
    if not summarizer.client:
        logger.error("OpenAI client not available")
        return "Summary failed - Unable to generate summary"
    
    # Retry configuration (3 attempts with 2s, 4s, 8s delays)
    max_retries = 3
    base_delay = 2.0
    
    for attempt in range(max_retries):
        try:
            # Create English prompt optimized for conciseness
            prompt = (
                f"Summarize the following YouTube video title and description in **English**.\n"
                f"Write 1-2 concise sentences in neutral tone, focusing on the main topic or event.\n\n"
                f"Title: {title[:200]}\n"  # Limit title length
                f"Description: {description[:400]}\n\n"  # Shorter description limit for English
                f"English summary:"
            )
            
            logger.debug(f"Generating English summary attempt {attempt + 1}/{max_retries} for: {title[:50]}...")
            
            # Make API call with optimized settings for English
            response = summarizer.client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a professional news summarizer. Create concise, neutral English summaries in 1-2 sentences."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=120,  # Reduced tokens for conciseness
                temperature=0.3,  # Lower temperature for consistency
                timeout=OPENAI_TIMEOUT
            )
            
            # Extract and process response
            if response.choices and len(response.choices) > 0:
                content = response.choices[0].message.content
                summary = content.strip() if content else None
                
                if summary:
                    # Clean up the summary - keep it to 1-2 sentences
                    sentences = summary.replace('\n', ' ').split('.')
                    # Take first 2 sentences if available
                    if len(sentences) > 2:
                        summary = '. '.join(sentences[:2]) + '.'
                    
                    # Remove extra whitespace
                    final_summary = ' '.join(summary.split())
                    logger.info(f"Successfully generated English summary on attempt {attempt + 1}")
                    return final_summary
                else:
                    logger.warning(f"Empty content received on attempt {attempt + 1}")
                    if attempt == max_retries - 1:
                        return "Summary failed - Unable to generate summary"
            else:
                logger.warning(f"No choices in response on attempt {attempt + 1}")
                if attempt == max_retries - 1:
                    return "Summary failed - Unable to generate summary"
        
        except RateLimitError as e:
            logger.warning(f"Rate limit hit on attempt {attempt + 1}: {str(e)}")
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)  # Exponential backoff: 2s, 4s, 8s
                logger.info(f"Waiting {delay}s before retry...")
                time.sleep(delay)
                continue
            else:
                logger.error("Max retries exceeded for rate limit")
                return "Summary failed - Unable to generate summary"
        
        except APITimeoutError as e:
            logger.warning(f"API timeout on attempt {attempt + 1}: {str(e)}")
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)
                logger.info(f"Waiting {delay}s before retry...")
                time.sleep(delay)
                continue
            else:
                logger.error("Max retries exceeded for timeout")
                return "Summary failed - Unable to generate summary"
        
        except APIError as e:
            logger.error(f"OpenAI API error on attempt {attempt + 1}: {str(e)}")
            # For API errors, don't retry as they're likely permanent
            return "Summary failed - Unable to generate summary"
        
        except Exception as e:
            logger.error(f"Unexpected error on attempt {attempt + 1}: {str(e)}")
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)
                logger.info(f"Waiting {delay}s before retry...")
                time.sleep(delay)
                continue
            else:
                logger.error("Max retries exceeded for unexpected error")
                return "Summary failed - Unable to generate summary"
    
    # Should not reach here, but just in case
    return "Summary failed - Unable to generate summary"


def main():
    """
    Demonstration function showing how to use the video summarizer.
    """
    print("YouTube Video Summarizer - Thai & English Language")
    print("=" * 50)
    
    # Example video data (using sample data for demonstration)
    sample_video = {
        'title': 'วิธีทำต้มยำกุ้ง สูตรต้นตำรับ',
        'description': 'สอนทำต้มยำกุ้งแบบดั้งเดิม วัตถุดิบง่าย ๆ รสชาติจัดจ้าน เปรี้ยว เผ็ด เค็ม หวาน ครบรส',
        'view_count': '2500000',
        'publish_date': '20231201',
        'channel': 'ครัวไทยโฮมเมด',
        'video_url': 'https://www.youtube.com/watch?v=example'
    }
    
    print("Sample video data:")
    print(f"Title: {sample_video['title']}")
    print(f"Channel: {sample_video['channel']}")
    print(f"Views: {sample_video['view_count']}")
    print("\nGenerating summaries...")
    print("-" * 30)
    
    # Generate Thai summary
    thai_summary = summarize_video_info(sample_video)
    print("Thai Summary:")
    print(thai_summary)
    
    print("\n" + "-" * 30)
    
    # Generate English summary
    english_summary = summarize_english_video(sample_video['title'], sample_video['description'])
    print("English Summary:")
    print(english_summary)


if __name__ == "__main__":
    main() 