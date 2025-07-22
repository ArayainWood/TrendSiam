#!/usr/bin/env python3
"""
API Security Module for TrendSiam

This module provides comprehensive API security including rate limiting,
request validation, secure communication, and API abuse prevention.
"""

import time
import hashlib
import json
import requests
from typing import Dict, Any, Optional, List, Callable
from functools import wraps
from datetime import datetime, timedelta
import threading
from collections import defaultdict, deque
import logging

from .validators import SecurityValidator
from .logging_config import create_module_logger

logger = create_module_logger(__name__)

class RateLimitExceeded(Exception):
    """Exception raised when rate limit is exceeded"""
    pass

class APISecurityError(Exception):
    """Exception raised for API security violations"""
    pass

class RateLimiter:
    """
    Thread-safe rate limiter with sliding window algorithm
    """
    
    def __init__(self):
        self.requests = defaultdict(deque)
        self.lock = threading.RLock()
    
    def is_allowed(self, identifier: str, limit: int, window_seconds: int) -> bool:
        """
        Check if request is allowed under rate limit
        
        Args:
            identifier: Unique identifier (IP, API key hash, etc.)
            limit: Maximum requests per window
            window_seconds: Time window in seconds
            
        Returns:
            True if request is allowed, False otherwise
        """
        with self.lock:
            now = time.time()
            cutoff = now - window_seconds
            
            # Remove old requests outside the window
            requests_queue = self.requests[identifier]
            while requests_queue and requests_queue[0] < cutoff:
                requests_queue.popleft()
            
            # Check if under limit
            if len(requests_queue) < limit:
                requests_queue.append(now)
                return True
            
            return False
    
    def get_reset_time(self, identifier: str, window_seconds: int) -> float:
        """Get time until rate limit resets"""
        with self.lock:
            requests_queue = self.requests.get(identifier, deque())
            if requests_queue:
                oldest_request = requests_queue[0]
                reset_time = oldest_request + window_seconds
                return max(0, reset_time - time.time())
            return 0

class APIKeyManager:
    """
    Secure API key management with validation and monitoring
    """
    
    def __init__(self):
        self.key_usage = defaultdict(int)
        self.key_last_used = {}
        self.suspicious_keys = set()
        
    def validate_key(self, api_key: str, service: str) -> bool:
        """
        Validate API key format and check for abuse
        
        Args:
            api_key: API key to validate
            service: Service name (openai, youtube)
            
        Returns:
            True if key is valid and not suspicious
        """
        if not SecurityValidator.validate_api_key(api_key, service):
            return False
            
        # Check if key is marked as suspicious
        key_hash = self._hash_key(api_key)
        if key_hash in self.suspicious_keys:
            logger.security(f"Blocked suspicious API key for {service}")
            return False
            
        # Update usage tracking
        self.key_usage[key_hash] += 1
        self.key_last_used[key_hash] = datetime.now()
        
        return True
    
    def mark_suspicious(self, api_key: str, reason: str) -> None:
        """Mark API key as suspicious"""
        key_hash = self._hash_key(api_key)
        self.suspicious_keys.add(key_hash)
        logger.security(f"API key marked suspicious: {reason}")
    
    def _hash_key(self, api_key: str) -> str:
        """Create hash of API key for tracking"""
        return hashlib.sha256(api_key.encode()).hexdigest()[:16]

class SecureAPIClient:
    """
    Secure API client with comprehensive security features
    """
    
    def __init__(self, service_name: str):
        self.service_name = service_name
        self.rate_limiter = RateLimiter()
        self.key_manager = APIKeyManager()
        self.session = self._create_secure_session()
        
        # Rate limits per service
        self.rate_limits = {
            'openai': {'requests': 60, 'window': 60},  # 60 req/min
            'youtube': {'requests': 100, 'window': 60},  # 100 req/min
            'dalle': {'requests': 10, 'window': 60}   # 10 req/min
        }
    
    def _create_secure_session(self) -> requests.Session:
        """Create secure requests session with proper configuration"""
        session = requests.Session()
        
        # Security headers
        session.headers.update({
            'User-Agent': f'TrendSiam/1.0 ({self.service_name})',
            'Accept': 'application/json',
            'Connection': 'keep-alive',
            'DNT': '1',  # Do Not Track
        })
        
        # SSL/TLS configuration
        session.verify = True  # Always verify SSL certificates
        
        # Timeout configuration
        session.timeout = (10, 30)  # (connect, read) timeouts
        
        return session
    
    def make_request(self, 
                    method: str,
                    url: str,
                    api_key: str,
                    data: Optional[Dict[str, Any]] = None,
                    headers: Optional[Dict[str, str]] = None,
                    timeout: Optional[int] = None) -> requests.Response:
        """
        Make secure API request with validation and rate limiting
        
        Args:
            method: HTTP method
            url: Request URL
            api_key: API key for authentication
            data: Request data
            headers: Additional headers
            timeout: Request timeout
            
        Returns:
            Response object
            
        Raises:
            RateLimitExceeded: If rate limit is exceeded
            APISecurityError: If security validation fails
        """
        # Validate API key
        if not self.key_manager.validate_key(api_key, self.service_name):
            raise APISecurityError(f"Invalid API key for {self.service_name}")
        
        # Validate URL
        allowed_domains = self._get_allowed_domains()
        if not SecurityValidator.validate_url(url, allowed_domains):
            raise APISecurityError(f"URL not allowed: {url}")
        
        # Check rate limits
        key_hash = self.key_manager._hash_key(api_key)
        rate_config = self.rate_limits.get(self.service_name, {'requests': 60, 'window': 60})
        
        if not self.rate_limiter.is_allowed(
            key_hash, 
            rate_config['requests'], 
            rate_config['window']
        ):
            reset_time = self.rate_limiter.get_reset_time(key_hash, rate_config['window'])
            raise RateLimitExceeded(f"Rate limit exceeded. Reset in {reset_time:.1f}s")
        
        # Prepare secure headers
        secure_headers = self.session.headers.copy()
        if headers:
            # Validate headers
            for key, value in headers.items():
                if self._is_safe_header(key, value):
                    secure_headers[key] = value
                else:
                    logger.warning(f"Filtered unsafe header: {key}")
        
        # Add authentication
        secure_headers['Authorization'] = f'Bearer {api_key}'
        
        # Validate and sanitize data
        if data:
            data = self._sanitize_request_data(data)
        
        # Apply timeout
        if timeout is None:
            timeout = 30
        timeout = min(timeout, 120)  # Maximum 2 minutes
        
        try:
            # Make request with security measures
            response = self.session.request(
                method=method,
                url=url,
                json=data,
                headers=secure_headers,
                timeout=timeout,
                allow_redirects=False  # Prevent redirect attacks
            )
            
            # Log successful request
            logger.info(f"API request successful: {method} {url} -> {response.status_code}")
            
            # Check for suspicious responses
            self._check_response_security(response, api_key)
            
            return response
            
        except requests.exceptions.Timeout:
            logger.warning(f"API request timeout: {method} {url}")
            raise APISecurityError("Request timeout")
            
        except requests.exceptions.SSLError as e:
            logger.error(f"SSL verification failed: {e}")
            raise APISecurityError("SSL verification failed")
            
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed: {e}")
            raise APISecurityError(f"Request failed: {str(e)}")
    
    def _get_allowed_domains(self) -> List[str]:
        """Get allowed domains for the service"""
        domain_map = {
            'openai': ['api.openai.com'],
            'youtube': ['www.googleapis.com', 'youtube.googleapis.com'],
            'dalle': ['api.openai.com']
        }
        return domain_map.get(self.service_name, [])
    
    def _is_safe_header(self, key: str, value: str) -> bool:
        """Check if header is safe to include"""
        # Block dangerous headers
        dangerous_headers = {
            'host', 'origin', 'referer', 'cookie',
            'x-forwarded-for', 'x-real-ip'
        }
        
        if key.lower() in dangerous_headers:
            return False
            
        # Validate header value
        if len(value) > 1000:  # Prevent header injection
            return False
            
        return True
    
    def _sanitize_request_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize request data for security"""
        sanitized = {}
        
        for key, value in data.items():
            # Validate key
            if not isinstance(key, str) or len(key) > 100:
                logger.warning(f"Skipping invalid data key: {key}")
                continue
                
            # Sanitize value based on type
            if isinstance(value, str):
                sanitized[key] = SecurityValidator.sanitize_text(value, max_length=10000)
            elif isinstance(value, (int, float, bool)):
                sanitized[key] = value
            elif isinstance(value, (list, dict)):
                # Recursively sanitize nested structures (with depth limit)
                sanitized[key] = self._sanitize_nested_data(value, depth=0, max_depth=5)
            else:
                logger.warning(f"Skipping unsupported data type for key {key}: {type(value)}")
        
        return sanitized
    
    def _sanitize_nested_data(self, data: Any, depth: int, max_depth: int) -> Any:
        """Recursively sanitize nested data structures"""
        if depth > max_depth:
            logger.warning("Maximum nesting depth exceeded, truncating data")
            return None
            
        if isinstance(data, dict):
            return {
                str(k)[:100]: self._sanitize_nested_data(v, depth + 1, max_depth)
                for k, v in data.items()
                if isinstance(k, str)
            }
        elif isinstance(data, list):
            return [
                self._sanitize_nested_data(item, depth + 1, max_depth)
                for item in data[:100]  # Limit list size
            ]
        elif isinstance(data, str):
            return SecurityValidator.sanitize_text(data, max_length=1000)
        elif isinstance(data, (int, float, bool)):
            return data
        else:
            return None
    
    def _check_response_security(self, response: requests.Response, api_key: str) -> None:
        """Check response for security issues"""
        # Check for rate limit headers
        if 'x-ratelimit-remaining' in response.headers:
            remaining = response.headers.get('x-ratelimit-remaining')
            if remaining and int(remaining) < 5:
                logger.warning(f"API rate limit nearly exceeded: {remaining} remaining")
        
        # Check for suspicious status codes
        if response.status_code == 429:
            logger.warning("API rate limit hit by service")
        elif response.status_code in [401, 403]:
            logger.security("API authentication issue detected")
            self.key_manager.mark_suspicious(api_key, f"Auth error: {response.status_code}")
        elif response.status_code >= 500:
            logger.warning(f"API service error: {response.status_code}")

def rate_limit(service: str, requests_per_minute: int = 60):
    """
    Decorator for rate limiting API functions
    
    Args:
        service: Service name for rate limiting
        requests_per_minute: Maximum requests per minute
    """
    rate_limiter = RateLimiter()
    
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Use function name as identifier
            identifier = f"{service}:{func.__name__}"
            
            if not rate_limiter.is_allowed(identifier, requests_per_minute, 60):
                reset_time = rate_limiter.get_reset_time(identifier, 60)
                raise RateLimitExceeded(f"Rate limit exceeded for {func.__name__}. Reset in {reset_time:.1f}s")
            
            return func(*args, **kwargs)
        
        return wrapper
    return decorator

def secure_api_call(service: str):
    """
    Decorator for secure API calls with comprehensive protection
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                # Log API call attempt
                logger.info(f"Secure API call: {service}.{func.__name__}")
                
                # Execute function with security context
                result = func(*args, **kwargs)
                
                # Log successful completion
                logger.info(f"API call completed: {service}.{func.__name__}")
                
                return result
                
            except (RateLimitExceeded, APISecurityError) as e:
                logger.warning(f"API security violation in {func.__name__}: {str(e)}")
                raise
            except Exception as e:
                logger.error(f"API call failed: {service}.{func.__name__}: {str(e)}")
                raise APISecurityError(f"API call failed: {str(e)}")
        
        return wrapper
    return decorator 