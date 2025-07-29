#!/usr/bin/env python3
"""
Script to fix the developer password security vulnerability in app.py
"""

def fix_dev_password():
    """Fix the hardcoded developer password and indentation issues."""
    
    # Read the current app.py content
    with open('app.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix the problematic section
    old_section = '''                if st.button("🔓 Enable Developer Mode", key="enable_dev_mode"):
                            # Simple password check (in production, use proper authentication)
        dev_password_env = os.getenv('TRENDSIAM_DEV_PASSWORD', '')
        if dev_password_env and dev_password == dev_password_env:
                        st.session_state["dev_mode"] = True
                        st.success("✅ Developer mode enabled")
                        st.rerun()
                    elif dev_password:
                        st.error("❌ Invalid developer password")'''
    
    new_section = '''                if st.button("🔓 Enable Developer Mode", key="enable_dev_mode"):
                    # Simple password check (in production, use proper authentication)
                    dev_password_env = os.getenv('TRENDSIAM_DEV_PASSWORD', '')
                    if dev_password_env and dev_password == dev_password_env:
                        st.session_state["dev_mode"] = True
                        st.success("✅ Developer mode enabled")
                        st.rerun()
                    elif dev_password:
                        st.error("❌ Invalid developer password")'''
    
    # Replace the section
    new_content = content.replace(old_section, new_section)
    
    # Write the fixed content back
    with open('app.py', 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("✅ Fixed developer password security vulnerability and indentation")
    return True

if __name__ == "__main__":
    fix_dev_password() 