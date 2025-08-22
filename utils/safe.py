"""
Safe utilities for protecting existing data during pipeline operations
"""
from typing import Any, Dict, Optional, Union


def truthy_url(url: Union[str, None]) -> bool:
    """Check if a URL is truthy (not None, not empty after stripping)"""
    return bool(url) and str(url).strip() != ""


def set_if_truthy(d: Dict[str, Any], key: str, value: Any) -> None:
    """Set d[key] only if value is meaningful (not None/empty).
    
    This prevents accidentally overwriting existing DB values with NULL/empty strings.
    
    Args:
        d: Dictionary to update
        key: Key to set
        value: Value to check and potentially set
    """
    if truthy_url(value):
        d[key] = value


def get_safe_url(url: Union[str, None]) -> Optional[str]:
    """Get a URL value that's safe to store (trimmed and validated).
    
    Returns:
        Trimmed URL string if valid, None otherwise
    """
    if truthy_url(url):
        return str(url).strip()
    return None
