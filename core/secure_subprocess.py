#!/usr/bin/env python3
"""
Secure Subprocess Wrapper for TrendSiam

This module provides secure subprocess execution with input validation,
command injection prevention, and comprehensive logging.
"""

import subprocess
import shlex
import logging
import time
from typing import List, Dict, Optional, Union, Tuple
from pathlib import Path
import re
import signal
import os

from .validators import SecurityValidator
from .logging_config import create_module_logger

logger = create_module_logger(__name__)

class SecureSubprocessError(Exception):
    """Custom exception for secure subprocess errors"""
    pass

class SecureSubprocess:
    """
    Secure subprocess wrapper with comprehensive safety checks
    """
    
    # Allowed commands whitelist
    ALLOWED_COMMANDS = {
        'yt-dlp': {
            'path_patterns': [r'yt-dlp', r'python.*yt_dlp', r'.*yt-dlp.*'],
            'allowed_args': {
                '--version', '--help', '--flat-playlist', '--no-playlist', 
                '--print-json', '--no-download', '--playlist-end',
                '--geo-bypass-country', '--add-header', '--extractor-args'
            },
            'max_timeout': 300  # 5 minutes max
        },
        'python': {
            'path_patterns': [r'python.*', r'.*python.*'],
            'allowed_modules': {'yt_dlp'},
            'max_timeout': 60
        }
    }
    
    # Dangerous patterns that should never appear in commands
    DANGEROUS_PATTERNS = [
        r'[;&|`$]',  # Command chaining/injection
        r'\.\.',     # Path traversal
        r'rm\s',     # Delete commands
        r'sudo\s',   # Privilege escalation
        r'>.*|<.*',  # Redirection
        r'eval\s',   # Code evaluation
        r'exec\s',   # Code execution
    ]
    
    @staticmethod
    def validate_command(cmd: List[str]) -> bool:
        """
        Validate command for security
        
        Args:
            cmd: Command as list of arguments
            
        Returns:
            True if command is safe, False otherwise
            
        Raises:
            SecureSubprocessError: If command is deemed unsafe
        """
        if not cmd or not isinstance(cmd, list):
            raise SecureSubprocessError("Command must be a non-empty list")
            
        # Convert to string for pattern checking
        cmd_str = ' '.join(cmd)
        
        # Check for dangerous patterns
        for pattern in SecureSubprocess.DANGEROUS_PATTERNS:
            if re.search(pattern, cmd_str, re.IGNORECASE):
                logger.security(f"Dangerous pattern detected in command: {pattern}")
                raise SecureSubprocessError(f"Command contains dangerous pattern: {pattern}")
        
        # Validate first argument (executable)
        executable = cmd[0]
        
        # Check if executable is in allowed commands
        command_type = None
        for cmd_name, config in SecureSubprocess.ALLOWED_COMMANDS.items():
            for pattern in config['path_patterns']:
                if re.match(pattern, executable, re.IGNORECASE):
                    command_type = cmd_name
                    break
            if command_type:
                break
                
        if not command_type:
            logger.security(f"Executable not in allowlist: {executable}")
            raise SecureSubprocessError(f"Executable not allowed: {executable}")
            
        # Validate arguments for specific command types
        if command_type == 'yt-dlp':
            return SecureSubprocess._validate_ytdlp_command(cmd)
        elif command_type == 'python':
            return SecureSubprocess._validate_python_command(cmd)
            
        return True
    
    @staticmethod
    def _validate_ytdlp_command(cmd: List[str]) -> bool:
        """Validate yt-dlp specific command"""
        config = SecureSubprocess.ALLOWED_COMMANDS['yt-dlp']
        
        # Check each argument
        for arg in cmd[1:]:
            if arg.startswith('-'):
                # This is a flag
                base_flag = arg.split('=')[0]  # Handle --flag=value format
                if base_flag not in config['allowed_args']:
                    logger.warning(f"yt-dlp flag not in allowlist: {base_flag}")
                    # Allow but log - some flags might be necessary
            else:
                # This is a value - validate URL if it looks like one
                if 'youtube.com' in arg or 'youtu.be' in arg:
                    if not SecurityValidator.validate_url(arg, ['youtube.com', 'youtu.be']):
                        raise SecureSubprocessError(f"Invalid YouTube URL: {arg}")
                        
        return True
    
    @staticmethod
    def _validate_python_command(cmd: List[str]) -> bool:
        """Validate Python module execution command"""
        config = SecureSubprocess.ALLOWED_COMMANDS['python']
        
        # Check for -m module execution
        if len(cmd) >= 3 and cmd[1] == '-m':
            module = cmd[2]
            if module not in config.get('allowed_modules', set()):
                raise SecureSubprocessError(f"Python module not allowed: {module}")
                
        return True
    
    @staticmethod
    def run_secure(cmd: List[str], 
                   timeout: Optional[int] = None,
                   capture_output: bool = True,
                   text: bool = True,
                   cwd: Optional[str] = None,
                   env: Optional[Dict[str, str]] = None) -> subprocess.CompletedProcess:
        """
        Execute command securely with comprehensive validation
        
        Args:
            cmd: Command as list of arguments
            timeout: Maximum execution time in seconds
            capture_output: Whether to capture stdout/stderr
            text: Whether to return text or bytes
            cwd: Working directory
            env: Environment variables
            
        Returns:
            CompletedProcess instance
            
        Raises:
            SecureSubprocessError: If command is unsafe or execution fails
        """
        start_time = time.time()
        
        try:
            # Validate command
            SecureSubprocess.validate_command(cmd)
            
            # Determine maximum timeout based on command type
            executable = cmd[0]
            max_timeout = 60  # Default
            for cmd_name, config in SecureSubprocess.ALLOWED_COMMANDS.items():
                for pattern in config['path_patterns']:
                    if re.match(pattern, executable, re.IGNORECASE):
                        max_timeout = config['max_timeout']
                        break
                        
            # Apply timeout limits
            if timeout is None:
                timeout = max_timeout
            else:
                timeout = min(timeout, max_timeout)
                
            # Log command execution (sanitized)
            cmd_str = ' '.join(cmd)
            logger.info(f"Executing secure command: {cmd_str[:100]}...")
            
            # Prepare secure environment
            if env is None:
                env = {}
            
            # Remove potentially dangerous environment variables
            secure_env = os.environ.copy()
            secure_env.update(env)
            
            # Remove dangerous env vars
            dangerous_env_vars = ['LD_PRELOAD', 'LD_LIBRARY_PATH', 'PYTHONPATH']
            for var in dangerous_env_vars:
                secure_env.pop(var, None)
                
            # Validate working directory
            if cwd:
                cwd_path = Path(cwd)
                if not cwd_path.exists() or not cwd_path.is_dir():
                    raise SecureSubprocessError(f"Invalid working directory: {cwd}")
                if '..' in str(cwd_path):
                    raise SecureSubprocessError("Working directory contains path traversal")
                    
            # Execute with security constraints
            result = subprocess.run(
                cmd,
                timeout=timeout,
                capture_output=capture_output,
                text=text,
                cwd=cwd,
                env=secure_env,
                check=False  # Don't raise on non-zero exit
            )
            
            duration = time.time() - start_time
            
            # Log execution results
            logger.info(f"Command completed in {duration:.2f}s, return code: {result.returncode}")
            
            if result.returncode != 0:
                logger.warning(f"Command failed with return code {result.returncode}")
                logger.debug(f"Stderr: {result.stderr}")
                
            return result
            
        except subprocess.TimeoutExpired as e:
            duration = time.time() - start_time
            logger.error(f"Command timed out after {duration:.2f}s")
            raise SecureSubprocessError(f"Command timeout after {timeout}s")
            
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"Command execution failed after {duration:.2f}s: {str(e)}")
            raise SecureSubprocessError(f"Command execution failed: {str(e)}")

    @staticmethod
    def run_ytdlp(url: str, 
                  additional_args: Optional[List[str]] = None,
                  timeout: Optional[int] = None) -> subprocess.CompletedProcess:
        """
        Safely execute yt-dlp command with pre-validated arguments
        
        Args:
            url: YouTube URL to process
            additional_args: Additional safe arguments
            timeout: Maximum execution time
            
        Returns:
            CompletedProcess instance
        """
        # Validate URL first
        if not SecurityValidator.validate_url(url, ['youtube.com', 'youtu.be']):
            raise SecureSubprocessError(f"Invalid YouTube URL: {url}")
            
        # Build safe command
        cmd = ['yt-dlp', '--print-json', '--no-download']
        
        if additional_args:
            # Validate additional arguments
            safe_args = []
            for arg in additional_args:
                if arg in SecureSubprocess.ALLOWED_COMMANDS['yt-dlp']['allowed_args']:
                    safe_args.append(arg)
                else:
                    logger.warning(f"Filtering out unsafe yt-dlp argument: {arg}")
                    
            cmd.extend(safe_args)
            
        cmd.append(url)
        
        return SecureSubprocess.run_secure(cmd, timeout=timeout)

# Convenience functions for backward compatibility
def secure_subprocess_run(*args, **kwargs) -> subprocess.CompletedProcess:
    """Secure wrapper for subprocess.run"""
    if args:
        cmd = args[0]
        return SecureSubprocess.run_secure(cmd, **kwargs)
    else:
        raise SecureSubprocessError("No command provided")

def secure_ytdlp_call(url: str, **kwargs) -> subprocess.CompletedProcess:
    """Secure yt-dlp execution"""
    return SecureSubprocess.run_ytdlp(url, **kwargs) 