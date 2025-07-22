"""
DEPRECATED: OpenAI API Configuration (Legacy)

⚠️  WARNING: This configuration method is DEPRECATED and INSECURE!
⚠️  Use the new secure configuration system instead.

MIGRATION INSTRUCTIONS:
1. Create a .env file: cp environment_template.txt .env
2. Add your API key to .env: OPENAI_API_KEY=your-key-here
3. Use the new secure config system: from core.config import get_config

SECURITY NOTE: 
- This file previously contained hardcoded API keys (SECURITY RISK!)
- The new system uses environment variables for secure credential storage
- All sensitive data is now properly protected and sanitized in logs

For more information, see:
- SECURITY_AUDIT_REPORT.md
- core/config.py (new secure configuration system)
"""

import os
import warnings
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Show deprecation warning
warnings.warn(
    "config_openai.py is deprecated. Use 'from core.config import get_config' instead.",
    DeprecationWarning,
    stacklevel=2
)

# Secure environment-based configuration (backward compatibility)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Model Settings (backward compatibility)
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
OPENAI_MAX_TOKENS = int(os.getenv("OPENAI_MAX_TOKENS", "150"))
OPENAI_TEMPERATURE = float(os.getenv("OPENAI_TEMPERATURE", "0.3"))
OPENAI_TIMEOUT = int(os.getenv("OPENAI_TIMEOUT", "30"))
OPENAI_MAX_RETRIES = int(os.getenv("OPENAI_MAX_RETRIES", "2"))

# Display migration notice
if __name__ == "__main__":
    print("🔒 MIGRATION NOTICE: config_openai.py")
    print("=" * 50)
    print("This configuration file has been DEPRECATED for security reasons.")
    print()
    print("PLEASE MIGRATE TO THE NEW SECURE SYSTEM:")
    print("1. Copy environment template: cp environment_template.txt .env")
    print("2. Edit .env with your API keys")
    print("3. Use new config: from core.config import get_config")
    print()
    print("Benefits of the new system:")
    print("✅ Secure environment variable storage")
    print("✅ API key validation and monitoring")
    print("✅ Automatic credential sanitization in logs")
    print("✅ Comprehensive security framework")
    print()
    if OPENAI_API_KEY:
        print("✅ Your API key was loaded from environment variables")
    else:
        print("❌ No API key found - please create .env file")
    print()
    print("For detailed migration guide, see SECURITY_AUDIT_REPORT.md")
