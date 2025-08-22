# Thai Fonts for PDF Generation

## Required Files

Please place the following Thai font files in this directory:

- `NotoSansThai-Regular.ttf` ⚠️ PLACEHOLDER - Replace with actual font
- `NotoSansThai-Bold.ttf` (optional for bold text)

## Download Instructions

### 1. Noto Sans Thai (Recommended)
```bash
# Download Regular weight:
curl -L "https://fonts.gstatic.com/s/notosansthai/v20/iJWDBXWARNNF4alAPL0DqcUK6-yJGTEV2P5_4wU.ttf" -o NotoSansThai-Regular.ttf

# Optional - Download Bold weight:
curl -L "https://fonts.gstatic.com/s/notosansthai/v20/iJWCBXWARNNF4alAPL0DqcUK6-pREQ.ttf" -o NotoSansThai-Bold.ttf
```

### 2. Alternative: Manual Download
- Visit: https://fonts.google.com/noto/specimen/Noto+Sans+Thai
- Download Regular (required) and Bold (optional) weights
- Place files in this directory with exact names above

### 3. Alternative: Sarabun Font
- Download from: https://fonts.google.com/specimen/Sarabun
- Rename to match expected names: `NotoSansThai-Regular.ttf`

## Current Status

- ⚠️ `NotoSansThai-Regular.ttf` is currently a placeholder
- ✅ Font registration will fallback gracefully to Helvetica if missing
- 🎯 Replace placeholder with actual font for proper Thai text rendering

## Usage

These fonts are automatically registered by the PDF generation component (`WeeklyPDF.tsx`) to ensure proper Thai text rendering without overlap or garbled characters.

## License

Make sure to comply with font licensing terms (Noto fonts use Open Font License).