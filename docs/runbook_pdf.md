# PDF Generation Runbook

## Overview

This runbook covers the PDF generation system for TrendSiam weekly reports, including troubleshooting and monitoring.

## System Architecture

### Components
- **API Route**: `/api/weekly/pdf` - Main PDF generation endpoint
- **Data Source**: Weekly report snapshots system
- **Renderer**: React-PDF with custom fonts
- **Output**: PDF files with proper headers and filenames

### Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `WEEKLY_PDF_ITEM_LIMIT` | Max items per PDF | No (default: 50) |
| `WEEKLY_PDF_RENDER_TIMEOUT_MS` | Render timeout | No (default: 20000) |
| `SUPABASE_URL` | Database connection | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Database access | Yes |

## PDF Generation Process

### 1. Request Flow
```
User Request → /api/weekly/pdf → fetchWeeklySnapshot() → PDF Render → Response
```

### 2. Data Pipeline
1. Fetch latest ready snapshot from `weekly_report_snapshots`
2. Extract top 20 items from snapshot data
3. Register PDF fonts (NotoSansThai for Thai support)
4. Generate PDF using React-PDF
5. Return with proper headers and filename

### 3. Expected Response Headers
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="trendsiam_weekly_YYYY-MM-DD.pdf"
Content-Length: [file size]
Cache-Control: no-store, no-cache, must-revalidate
X-TS-API: weekly-pdf-v3
X-TS-Processing-Time: [milliseconds]
X-TS-Data-Source: snapshot
X-TS-Items-Count: [number of items]
```

## Usage

### Basic PDF Generation
```bash
# Generate PDF from latest snapshot
curl -o "weekly-report.pdf" "http://localhost:3000/api/weekly/pdf"

# Generate with fresh data flag
curl -o "weekly-report.pdf" "http://localhost:3000/api/weekly/pdf?ts=$(date +%s)"

# Generate from specific snapshot
curl -o "weekly-report.pdf" "http://localhost:3000/api/weekly/pdf?snapshot=abc123"
```

### Frontend Integration
```javascript
// Download PDF with proper error handling
const downloadPDF = async () => {
  try {
    const response = await fetch(`/api/weekly/pdf?ts=${Date.now()}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`PDF generation failed: ${error.code} - ${error.details}`);
    }
    
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = response.headers.get('Content-Disposition')?.split('filename=')[1] || 'report.pdf';
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('PDF download failed:', error);
  }
};
```

## Monitoring

### Success Indicators
- HTTP 200 status code
- `Content-Length` > 50KB (typical PDF size)
- `X-TS-Processing-Time` < 15000ms
- Valid PDF signature in response

### Performance Metrics
- **Generation Time**: Should be < 15 seconds
- **File Size**: Typically 50-200KB for 20 items
- **Success Rate**: > 95% for valid requests

### Log Patterns

#### Successful Generation
```
[weekly-pdf] Generating PDF for snapshot: latest
[weekly-pdf] Font system registered: {universalFamily: "NotoSansThai", registered: true}
[weekly-pdf] ✅ PDF generated successfully: 87432 bytes
```

#### Error Patterns
```
[weekly-pdf] E_DATA: Failed to load snapshot data
[weekly-pdf] E_FONT: Font registration failed
[weekly-pdf] E_PDF: PDF generation timeout after 30 seconds
[weekly-pdf] E_BUFFER: Generated PDF buffer is empty
```

## Troubleshooting

### Common Issues

#### 1. "PDF generation timeout after 30 seconds"
**Error Code**: `E_PDF`
**Causes**:
- Large dataset causing slow rendering
- Font loading issues
- Memory constraints

**Solutions**:
```bash
# Check memory usage
free -h

# Verify font files exist
ls -la /app/fonts/ || ls -la ./public/fonts/

# Test with smaller dataset
curl "/api/weekly/pdf?limit=5"
```

#### 2. "Generated content is not a valid PDF"
**Error Code**: `E_BUFFER`
**Causes**:
- React-PDF rendering failure
- Font encoding issues
- Memory corruption

**Solutions**:
- Check font registration logs
- Verify React-PDF version compatibility
- Test with minimal data set

#### 3. "Failed to load snapshot data"
**Error Code**: `E_DATA`
**Causes**:
- No ready snapshots available
- Database connectivity issues
- Snapshot corruption

**Solutions**:
```sql
-- Check available snapshots
SELECT snapshot_id, status, built_at, items_count 
FROM weekly_report_snapshots 
WHERE status = 'ready' 
ORDER BY built_at DESC LIMIT 5;

-- Create new snapshot if needed
-- (Use snapshot creation endpoint)
```

#### 4. Font rendering issues
**Error Code**: `E_FONT`
**Causes**:
- Missing font files
- Incorrect font paths
- Font registration failure

**Solutions**:
```bash
# Verify font files
find . -name "*.ttf" -o -name "*.otf"

# Check font registration in logs
grep "Font system registered" logs/

# Test font loading
node -e "console.log(require('./src/lib/pdf/pdfFonts').getFontRegistrationInfo())"
```

### Performance Issues

#### Slow Generation (> 15s)
1. **Check Data Size**: Large snapshots slow rendering
2. **Memory Usage**: Monitor RAM during generation
3. **Font Loading**: Ensure fonts are cached
4. **Network**: Database query performance

#### Large File Sizes (> 500KB)
1. **Item Count**: Reduce items per PDF
2. **Image Embedding**: Check if images are embedded
3. **Font Subsetting**: Ensure fonts are properly subset

## Configuration

### PDF Rendering Options
```typescript
// Current settings in renderWeeklyPdf.tsx
const PDF_CONFIG = {
  format: 'A4',
  margin: { top: 24, bottom: 24, left: 24, right: 24 },
  fontSize: 11,
  fontFamily: 'NotoSansThai',
  timeout: 30000, // 30 seconds
  itemLimit: 50
};
```

### Font Configuration
```typescript
// Font registration
registerPDFFonts(); // Idempotent registration
const fontInfo = getFontRegistrationInfo();
// Should return: { universalFamily: "NotoSansThai", registered: true }
```

## Deployment Considerations

### Render.com Specific
- Font files must be in build output
- Memory limits may affect large PDFs
- Cold starts can cause initial delays

### Environment Setup
```bash
# Ensure font files are available
COPY public/fonts/ /app/public/fonts/

# Set appropriate memory limits
NODE_OPTIONS="--max-old-space-size=1024"
```

## Emergency Procedures

### PDF Service Down
1. **Check Health**: `curl /api/health` - verify system status
2. **Check Logs**: Look for error patterns
3. **Restart Service**: If memory issues detected
4. **Fallback**: Direct snapshot data download if PDF fails

### Data Issues
1. **Verify Snapshots**: Check `weekly_report_snapshots` table
2. **Create New Snapshot**: Use snapshot creation endpoint
3. **Test with Known Good Data**: Use specific snapshot ID

### Performance Degradation
1. **Monitor Resources**: CPU, memory, disk usage
2. **Check Database**: Query performance for snapshots
3. **Font Cache**: Verify font loading performance
4. **Reduce Load**: Temporarily limit concurrent requests

## Integration Points

- **Snapshot System**: Depends on `weekly_report_snapshots` table
- **Font System**: Requires NotoSansThai fonts for Thai text
- **Health Check**: `/api/health` monitors PDF capability
- **Frontend**: Weekly report page download functionality
