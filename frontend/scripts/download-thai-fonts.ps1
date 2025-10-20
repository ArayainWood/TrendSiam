# Download authentic NotoSansThai fonts from Google Fonts
# Windows PowerShell version
#
# This script downloads the actual Thai font files to replace placeholders
# Run once to fix PDF Thai text rendering issues

$ErrorActionPreference = "Stop"

$FontDir = "frontend\public\fonts\NotoSansThai"
$BackupDir = "frontend\public\fonts\NotoSansThai.backup"

Write-Host "======================================================================"
Write-Host "Thai Font Downloader for TrendSiam PDF System"
Write-Host "======================================================================"
Write-Host ""

# Create backup of existing files
if (Test-Path $FontDir)
{
    Write-Host "📦 Backing up existing font files..."
    if (!(Test-Path $BackupDir))
    {
        New-Item -ItemType Directory -Path $BackupDir | Out-Null
    }
    Copy-Item -Path "$FontDir\*" -Destination $BackupDir -Force -ErrorAction SilentlyContinue
    Write-Host "   Backup saved to: $BackupDir"
}

# Create font directory
if (!(Test-Path $FontDir))
{
    New-Item -ItemType Directory -Path $FontDir | Out-Null
}

Write-Host ""
Write-Host "📥 Downloading Noto Sans Thai fonts from Google Fonts..."
Write-Host ""

# Download Regular weight
Write-Host "1. Downloading Regular weight..."
$RegularUrl = "https://fonts.gstatic.com/s/notosansthai/v20/iJWDBXWARNNF4alAPL0DqcUK6-yJGTEV2P5_4wU.ttf"
$RegularPath = "$FontDir\NotoSansThai-Regular.ttf"

try
{
    Invoke-WebRequest -Uri $RegularUrl -OutFile $RegularPath -UseBasicParsing
    $Size = [math]::Round((Get-Item $RegularPath).Length / 1KB, 1)
    Write-Host "   ✅ Regular: $Size KB" -ForegroundColor Green
}
catch
{
    Write-Host "   ❌ Failed to download Regular weight: $_" -ForegroundColor Red
    exit 1
}

# Download Bold weight
Write-Host "2. Downloading Bold weight..."
$BoldUrl = "https://fonts.gstatic.com/s/notosansthai/v20/iJWFBXWARNNF4alAPL0DqcUK6-1aFQ.ttf"
$BoldPath = "$FontDir\NotoSansThai-Bold.ttf"

try
{
    Invoke-WebRequest -Uri $BoldUrl -OutFile $BoldPath -UseBasicParsing
    $Size = [math]::Round((Get-Item $BoldPath).Length / 1KB, 1)
    Write-Host "   ✅ Bold: $Size KB" -ForegroundColor Green
}
catch
{
    Write-Host "   ❌ Failed to download Bold weight: $_" -ForegroundColor Red
    exit 1
}

# Copy to root fonts directory for backward compatibility
Write-Host ""
Write-Host "📋 Copying fonts to root directory..."
Copy-Item -Path $RegularPath -Destination "frontend\public\fonts\" -Force
Copy-Item -Path $BoldPath -Destination "frontend\public\fonts\" -Force

Write-Host ""
Write-Host "🔍 Verifying font files..."
Write-Host ""

# Verify Regular font (check for TrueType signature)
$RegularBytes = [System.IO.File]::ReadAllBytes($RegularPath)[0..3]
$RegularHex = ($RegularBytes | ForEach-Object { $_.ToString("X2") }) -join ""

if ($RegularHex -like "00010000*")
{
    Write-Host "   ✅ Regular: Valid TrueType font signature" -ForegroundColor Green
}
else
{
    Write-Host "   ⚠️  Regular: Unexpected signature ($RegularHex) - might still work" -ForegroundColor Yellow
}

# Verify Bold font
$BoldBytes = [System.IO.File]::ReadAllBytes($BoldPath)[0..3]
$BoldHex = ($BoldBytes | ForEach-Object { $_.ToString("X2") }) -join ""

if ($BoldHex -like "00010000*")
{
    Write-Host "   ✅ Bold: Valid TrueType font signature" -ForegroundColor Green
}
else
{
    Write-Host "   ⚠️  Bold: Unexpected signature ($BoldHex) - might still work" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "======================================================================"
Write-Host "✅ Font download complete!" -ForegroundColor Green
Write-Host "======================================================================"
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Restart dev server: npm run dev"
Write-Host "2. Test PDF generation: Click 'Download PDF' on /weekly-report"
Write-Host "3. Verify Thai text renders correctly (no overlaps/garbled chars)"
Write-Host ""
Write-Host "If issues persist, check:"
Write-Host "- Browser console for font loading errors"
Write-Host "- PDF file opens in viewer (Adobe, Chrome PDF viewer)"
Write-Host "- Thai glyphs are visible (not boxes)"
Write-Host ""
Write-Host "To restore backup: Copy-Item -Path $BackupDir\* -Destination $FontDir\ -Force"
Write-Host ""

