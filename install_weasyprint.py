#!/usr/bin/env python3
"""
WeasyPrint Installation Script for TrendSiam HTML Reports
Purpose: Install WeasyPrint and dependencies for PDF generation
"""

import subprocess
import sys
import platform

def run_command(command):
    """Run a command and return success status"""
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {command}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {command}")
        print(f"Error: {e.stderr}")
        return False

def install_weasyprint():
    """Install WeasyPrint and dependencies"""
    print("🔧 TrendSiam WeasyPrint Installation")
    print("=" * 50)
    
    # Check Python version
    python_version = sys.version_info
    print(f"🐍 Python version: {python_version.major}.{python_version.minor}.{python_version.micro}")
    
    if python_version < (3, 7):
        print("❌ Python 3.7+ required for WeasyPrint")
        return False
    
    # Detect OS
    os_type = platform.system()
    print(f"💻 Operating System: {os_type}")
    
    success = True
    
    # Install Python dependencies
    print("\n📦 Installing Python packages...")
    
    packages = [
        "weasyprint>=60.0",
        "jinja2>=3.0.0",
        "pillow>=8.0.0"
    ]
    
    for package in packages:
        if not run_command(f"pip install {package}"):
            success = False
    
    # OS-specific dependencies
    if os_type == "Windows":
        print("\n🪟 Windows detected - WeasyPrint should work with pip install")
        print("If you encounter issues, install Microsoft Visual C++ Build Tools")
        
    elif os_type == "Darwin":  # macOS
        print("\n🍎 macOS detected - Installing system dependencies...")
        run_command("brew install pango libffi")
        
    elif os_type == "Linux":
        print("\n🐧 Linux detected - Installing system dependencies...")
        # Ubuntu/Debian
        run_command("sudo apt-get update")
        run_command("sudo apt-get install -y python3-dev python3-pip python3-cffi python3-brotli libpango-1.0-0 libharfbuzz0b libpangoft2-1.0-0")
        
        # Alternative for CentOS/RHEL
        run_command("sudo yum install -y python3-devel python3-pip python3-cffi pango libffi-devel")
    
    # Test installation
    print("\n🧪 Testing WeasyPrint installation...")
    try:
        import weasyprint
        print(f"✅ WeasyPrint {weasyprint.__version__} installed successfully!")
        
        # Test basic functionality
        from weasyprint import HTML, CSS
        html_content = "<html><body><h1>Test</h1></body></html>"
        test_pdf = HTML(string=html_content).write_pdf()
        
        if test_pdf:
            print("✅ PDF generation test successful!")
        else:
            print("❌ PDF generation test failed")
            success = False
            
    except ImportError as e:
        print(f"❌ WeasyPrint import failed: {e}")
        success = False
    except Exception as e:
        print(f"❌ WeasyPrint test failed: {e}")
        success = False
    
    print("\n" + "=" * 50)
    if success:
        print("🎉 Installation complete! You can now generate PDF reports.")
        print("📄 Run: python generate_html_pdf.py")
    else:
        print("❌ Installation had issues. Please check error messages above.")
        print("📖 Visit: https://doc.courtbouillon.org/weasyprint/stable/first_steps.html")
    
    return success

if __name__ == "__main__":
    install_weasyprint() 