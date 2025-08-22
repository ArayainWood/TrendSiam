# Weekly Report Setup Guide

## Environment Variables

Create a `.env.local` file in the `frontend` directory with the following variables:

```env
# Supabase Configuration
SUPABASE_ENABLED=true
SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key...
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key...
```

## Required Dependencies

Ensure `@react-pdf/renderer` is installed:

```bash
cd frontend
npm install @react-pdf/renderer
```

## Thai Font Setup

1. Download Thai fonts:
   - **Noto Sans Thai**: https://fonts.google.com/noto/specimen/Noto+Sans+Thai
   - Save as: `public/fonts/NotoSansThai-Regular.ttf` and `public/fonts/NotoSansThai-Bold.ttf`

2. Alternative fonts:
   - **Sarabun**: https://fonts.google.com/specimen/Sarabun
   - **IBM Plex Sans Thai**: https://fonts.google.com/specimen/IBM+Plex+Sans+Thai

## Database Schema Requirements

The Weekly Report queries these Supabase tables:

- `stories` - Main story data with `story_id`, `title`, `summary`, etc.
- `snapshots` - Time-series data with `snapshot_date`, `story_id`, rankings

Required columns:
- `stories.story_id` (text, primary key)
- `stories.title`, `stories.summary`, `stories.channel`
- `snapshots.snapshot_date` (date)
- `snapshots.story_id` (foreign key)
- `snapshots.popularity_score_precise` (numeric)

## How to Run

```bash
# Development
cd frontend
npm run dev

# Clean build (if needed)
rm -rf .next
npm run build

# Test Weekly Report
open http://localhost:3000/weekly-report

# Test PDF API
curl -I http://localhost:3000/api/weekly/pdf
curl -sS -o weekly.pdf http://localhost:3000/api/weekly/pdf

# Run tests
npm test -- -t weekly
```

## Data Source Behavior

- **Primary**: Fetches last 7 days from Supabase using service role key
- **Fallback**: Uses `public/data/thailand_trending_summary.json` when DB unreachable
- **Banner**: Yellow "DB unavailable" banner shows only when `source === 'json'`
- **Cache**: 60-second in-memory cache to prevent spam during development

## PDF Generation

- Uses `@react-pdf/renderer` with Thai font support
- Buffer validation ensures >2KB file size
- Verifies PDF magic bytes (`%PDF-`) before serving
- Includes proper headers: `Content-Type`, `Content-Length`, `Content-Disposition`

## Troubleshooting

### PDF Download Issues
- Check browser console for errors
- Verify font files exist in `public/fonts/`
- Check server logs for buffer size and generation errors

### Supabase Connection Issues
- Verify environment variables are set correctly
- Check service role key has proper permissions
- Monitor console logs for connection errors

### UI Issues
- Banner should only appear when DB is unreachable
- Layout should remain identical to original design
- Thai text should render without overlap in PDFs
