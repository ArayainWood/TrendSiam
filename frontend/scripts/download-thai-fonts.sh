#!/bin/bash
##
# Download authentic NotoSansThai fonts from Google Fonts
# 
# This script downloads the actual Thai font files to replace placeholders
# Run once to fix PDF Thai text rendering issues
##

set -e

FONT_DIR="frontend/public/fonts/NotoSansThai"
BACKUP_DIR="frontend/public/fonts/NotoSansThai.backup"

echo "======================================================================"
echo "Thai Font Downloader for TrendSiam PDF System"
echo "======================================================================"
echo ""

# Create backup of existing files
if [ -d "$FONT_DIR" ]; then
  echo "📦 Backing up existing font files..."
  mkdir -p "$BACKUP_DIR"
  cp -r "$FONT_DIR"/* "$BACKUP_DIR/" 2>/dev/null || true
  echo "   Backup saved to: $BACKUP_DIR"
fi

# Create font directory
mkdir -p "$FONT_DIR"

echo ""
echo "📥 Downloading Noto Sans Thai fonts from Google Fonts..."
echo ""

# Download Regular weight
echo "1. Downloading Regular weight..."
curl -L --progress-bar \
  "https://fonts.gstatic.com/s/notosansthai/v20/iJWDBXWARNNF4alAPL0DqcUK6-yJGTEV2P5_4wU.ttf" \
  -o "$FONT_DIR/NotoSansThai-Regular.ttf"

if [ $? -eq 0 ]; then
  SIZE=$(du -h "$FONT_DIR/NotoSansThai-Regular.ttf" | cut -f1)
  echo "   ✅ Regular: $SIZE"
else
  echo "   ❌ Failed to download Regular weight"
  exit 1
fi

# Download Bold weight
echo "2. Downloading Bold weight..."
curl -L --progress-bar \
  "https://fonts.gstatic.com/s/notosansthai/v20/iJWFBXWARNNF4alAPL0DqcUK6-1aFQ.ttf" \
  -o "$FONT_DIR/NotoSansThai-Bold.ttf"

if [ $? -eq 0 ]; then
  SIZE=$(du -h "$FONT_DIR/NotoSansThai-Bold.ttf" | cut -f1)
  echo "   ✅ Bold: $SIZE"
else
  echo "   ❌ Failed to download Bold weight"
  exit 1
fi

# Copy to root fonts directory for backward compatibility
echo ""
echo "📋 Copying fonts to root directory..."
cp "$FONT_DIR/NotoSansThai-Regular.ttf" "frontend/public/fonts/"
cp "$FONT_DIR/NotoSansThai-Bold.ttf" "frontend/public/fonts/"

echo ""
echo "🔍 Verifying font files..."
echo ""

# Verify Regular font
if head -c 4 "$FONT_DIR/NotoSansThai-Regular.ttf" | xxd -p | grep -q "00010000"; then
  echo "   ✅ Regular: Valid TrueType font signature"
else
  echo "   ⚠️  Regular: Unexpected signature (might still work)"
fi

# Verify Bold font
if head -c 4 "$FONT_DIR/NotoSansThai-Bold.ttf" | xxd -p | grep -q "00010000"; then
  echo "   ✅ Bold: Valid TrueType font signature"
else
  echo "   ⚠️  Bold: Unexpected signature (might still work)"
fi

echo ""
echo "======================================================================"
echo "✅ Font download complete!"
echo "======================================================================"
echo ""
echo "Next steps:"
echo "1. Restart dev server: npm run dev"
echo "2. Test PDF generation: Click 'Download PDF' on /weekly-report"
echo "3. Verify Thai text renders correctly (no overlaps/garbled chars)"
echo ""
echo "If issues persist, check:"
echo "- Browser console for font loading errors"
echo "- PDF file opens in viewer (Adobe, Chrome PDF viewer)"
echo "- Thai glyphs are visible (not boxes)"
echo ""
echo "To restore backup: mv $BACKUP_DIR/* $FONT_DIR/"
echo ""

