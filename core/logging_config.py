#!/usr/bin/env python3
"""
Comprehensive Logging and Error Handling for TrendSiam

This module provides centralized logging configuration with security-aware
formatting, error tracking, and performance monitoring.
"""

import logging
import logging.handlers
import sys
import traceback
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional
import functools

class SecurityAwareFormatter(logging.Formatter):
    """Custom formatter that sanitizes sensitive information from logs"""
    
    SENSITIVE_PATTERNS = [
        'api_key',
        'password',
        'token',
        'secret',
        'credential'
    ]
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record while sanitizing sensitive information"""
        # Sanitize the message
        if hasattr(record, 'msg') and isinstance(record.msg, str):
            record.msg = self._sanitize_message(record.msg)
            
        # Sanitize arguments
        if hasattr(record, 'args') and record.args:
            record.args = tuple(
                self._sanitize_value(arg) if isinstance(arg, str) else arg 
                for arg in record.args
            )
            
        return super().format(record)
    
    def _sanitize_message(self, message: str) -> str:
        """Sanitize sensitive information from log messages"""
        for pattern in self.SENSITIVE_PATTERNS:
            if pattern in message.lower():
                # Replace potential API keys or sensitive data
                import re
                # Pattern to match API key-like strings
                api_key_pattern = r'sk-[a-zA-Z0-9]+'
                message = re.sub(api_key_pattern, 'sk-***REDACTED***', message)
                
                # Pattern to match other sensitive values after keywords
                sensitive_pattern = rf'{pattern}[:\s=]+["\']?([^"\s\n]+)["\']?'
                message = re.sub(sensitive_pattern, f'{pattern}: ***REDACTED***', message, flags=re.IGNORECASE)
                
        return message
    
    def _sanitize_value(self, value: str) -> str:
        """Sanitize individual values"""
        # Check if value looks like an API key
        if value.startswith('sk-') and len(value) > 20:
            return 'sk-***REDACTED***'
        return value

class TrendSiamLogger:
    """Centralized logging manager for TrendSiam application"""
    
    def __init__(self, 
                 app_name: str = "TrendSiam",
                 log_level: str = "INFO",
                 log_dir: str = "logs",
                 max_file_size: int = 10 * 1024 * 1024,  # 10MB
                 backup_count: int = 5):
        """
        Initialize TrendSiam logger
        
        Args:
            app_name: Application name for logging
            log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
            log_dir: Directory for log files
            max_file_size: Maximum size per log file in bytes
            backup_count: Number of backup log files to keep
        """
        self.app_name = app_name
        self.log_level = getattr(logging, log_level.upper(), logging.INFO)
        self.log_dir = Path(log_dir)
        self.max_file_size = max_file_size
        self.backup_count = backup_count
        
        # Create logs directory
        self.log_dir.mkdir(exist_ok=True)
        
        # Configure logging
        self._setup_logging()
        
        # Track errors and warnings for monitoring
        self.error_count = 0
        self.warning_count = 0
    
    def _setup_logging(self) -> None:
        """Setup comprehensive logging configuration"""
        # Create custom formatter
        formatter = SecurityAwareFormatter(
            fmt='%(asctime)s | %(name)s | %(levelname)s | %(filename)s:%(lineno)d | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        # Root logger configuration
        root_logger = logging.getLogger()
        root_logger.setLevel(self.log_level)
        
        # Clear existing handlers
        for handler in root_logger.handlers[:]:
            root_logger.removeHandler(handler)
        
        # Console handler with colors for development
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(self.log_level)
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)
        
        # File handler with rotation
        file_handler = logging.handlers.RotatingFileHandler(
            filename=self.log_dir / f"{self.app_name.lower()}.log",
            maxBytes=self.max_file_size,
            backupCount=self.backup_count,
            encoding='utf-8'
        )
        file_handler.setLevel(self.log_level)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)
        
        # Error-only file handler for critical issues
        error_handler = logging.handlers.RotatingFileHandler(
            filename=self.log_dir / f"{self.app_name.lower()}_errors.log",
            maxBytes=self.max_file_size,
            backupCount=self.backup_count,
            encoding='utf-8'
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(formatter)
        root_logger.addHandler(error_handler)
        
        # Add custom logging methods to track metrics
        self._add_custom_log_levels()
        
        # Log initialization
        logger = logging.getLogger(__name__)
        logger.info(f"Logging initialized for {self.app_name}")
        logger.info(f"Log level: {logging.getLevelName(self.log_level)}")
        logger.info(f"Log directory: {self.log_dir.absolute()}")
    
    def _add_custom_log_levels(self) -> None:
        """Add custom log levels for specific use cases"""
        # Add SECURITY level for security-related events
        SECURITY_LEVEL = 25
        logging.addLevelName(SECURITY_LEVEL, "SECURITY")
        
        # Add PERFORMANCE level for performance monitoring
        PERFORMANCE_LEVEL = 15
        logging.addLevelName(PERFORMANCE_LEVEL, "PERFORMANCE")
    
    def log_security(self, logger: logging.Logger, message: str, *args, **kwargs) -> None:
        """Log security events with custom level"""
        logger.log(25, message, *args, **kwargs)  # SECURITY level
    
    def log_performance(self, logger: logging.Logger, message: str, *args, **kwargs) -> None:
        """Log performance events with custom level"""
        logger.log(15, message, *args, **kwargs)  # PERFORMANCE level
    
    def get_logger(self, name: str) -> logging.Logger:
        """Get a logger instance for a specific module"""
        return logging.getLogger(name)
    
    def log_api_call(self, api_name: str, endpoint: str, duration: float, 
                     status: str = "success", error: Optional[str] = None) -> None:
        """Log API call with performance metrics"""
        logger = logging.getLogger("api_calls")
        
        if status == "success":
            logger.info(f"API Call: {api_name} | {endpoint} | Duration: {duration:.2f}s | Status: {status}")
        else:
            logger.error(f"API Call Failed: {api_name} | {endpoint} | Duration: {duration:.2f}s | Error: {error}")
            self.error_count += 1
    
    def log_security_event(self, event_type: str, details: str, severity: str = "warning") -> None:
        """Log security-related events"""
        logger = logging.getLogger("security")
        
        message = f"Security Event: {event_type} | {details}"
        
        if severity.lower() == "critical":
            logger.critical(message)
            self.error_count += 1
        elif severity.lower() == "error":
            logger.error(message)
            self.error_count += 1
        else:
            self.log_security(logger, message)
            self.warning_count += 1
    
    def log_data_operation(self, operation: str, file_path: str, 
                          record_count: Optional[int] = None, 
                          duration: Optional[float] = None) -> None:
        """Log data operations for auditing"""
        logger = logging.getLogger("data_operations")
        
        message = f"Data Operation: {operation} | File: {file_path}"
        if record_count is not None:
            message += f" | Records: {record_count}"
        if duration is not None:
            message += f" | Duration: {duration:.2f}s"
            
        logger.info(message)
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get logging metrics for monitoring"""
        return {
            'error_count': self.error_count,
            'warning_count': self.warning_count,
            'log_level': logging.getLevelName(self.log_level),
            'log_dir': str(self.log_dir.absolute()),
            'timestamp': datetime.now().isoformat()
        }

def performance_monitor(func):
    """Decorator to monitor function performance"""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = datetime.now()
        logger = logging.getLogger(f"performance.{func.__module__}.{func.__name__}")
        
        try:
            logger.debug(f"Starting function: {func.__name__}")
            result = func(*args, **kwargs)
            
            duration = (datetime.now() - start_time).total_seconds()
            logger.log(15, f"Function completed: {func.__name__} | Duration: {duration:.3f}s")  # PERFORMANCE level
            
            return result
            
        except Exception as e:
            duration = (datetime.now() - start_time).total_seconds()
            logger.error(f"Function failed: {func.__name__} | Duration: {duration:.3f}s | Error: {str(e)}")
            logger.debug(f"Stack trace: {traceback.format_exc()}")
            raise
            
    return wrapper

def error_handler(func):
    """Decorator for comprehensive error handling"""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        logger = logging.getLogger(f"error_handler.{func.__module__}.{func.__name__}")
        
        try:
            return func(*args, **kwargs)
        except Exception as e:
            logger.error(f"Unhandled exception in {func.__name__}: {str(e)}")
            logger.debug(f"Stack trace: {traceback.format_exc()}")
            
            # Log function arguments (sanitized)
            try:
                args_str = str(args)[:500]  # Limit length
                kwargs_str = str(kwargs)[:500]
                logger.debug(f"Function arguments: args={args_str}, kwargs={kwargs_str}")
            except:
                logger.debug("Could not log function arguments")
            
            raise
            
    return wrapper

def create_module_logger(module_name: str) -> logging.Logger:
    """Create a logger for a specific module with consistent configuration"""
    return logging.getLogger(module_name)

# Global logger instance
_trend_siam_logger: Optional[TrendSiamLogger] = None

def setup_logging(log_level: str = "INFO", log_dir: str = "logs") -> TrendSiamLogger:
    """Setup global logging for the application"""
    global _trend_siam_logger
    _trend_siam_logger = TrendSiamLogger(log_level=log_level, log_dir=log_dir)
    return _trend_siam_logger

def get_app_logger() -> TrendSiamLogger:
    """Get the global application logger"""
    global _trend_siam_logger
    if _trend_siam_logger is None:
        _trend_siam_logger = TrendSiamLogger()
    return _trend_siam_logger 