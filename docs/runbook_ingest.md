# Data Ingestion Runbook

## Overview

This runbook covers the safe operation of the TrendSiam data ingestion pipeline using `summarize_all_v2.py`.

## Prerequisites

- Python environment with required dependencies
- Supabase credentials configured
- Asia/Bangkok timezone awareness

## Running the Pipeline

### Basic Usage

```bash
# Standard run with 20 items
python summarize_all_v2.py --limit 20 --verbose

# Force refresh with fresh statistics
python summarize_all_v2.py --limit 20 --force-refresh-stats --verbose

# Dry run for testing (no database writes)
python summarize_all_v2.py --limit 10 --dry-run --verbose
```

### Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--limit` | Maximum items to process | 50 |
| `--verbose` | Enable detailed logging | False |
| `--dry-run` | Test mode, no database writes | False |
| `--force-refresh-stats` | Recalculate all popularity scores | False |

## Expected Logs

### Successful Run
```
✅ Configuration loaded successfully
🔍 Fetching via canonical repository, limit=20
✅ Fetched 20 items via canonical repo
📤 [UPSERT] target_table=news_trends rows=20 conflict_resolution=platform,external_id
✅ [UPSERT] upserted_rows=20 target_table=news_trends
LOG:UPDATED_AT=2025-08-29T15:30:45+07:00 (Asia/Bangkok)
```

### Key Metrics to Monitor
- `upserted_rows`: Number of records written to database
- `rows_touched`: Number of records updated
- `latest_summary_date`: Most recent date processed (should be today in Asia/Bangkok)
- `LOG:UPDATED_AT`: Cache invalidation timestamp

## Verification Steps

### 1. Check Database Write Success
```sql
-- Verify recent data exists
SELECT COUNT(*) FROM public.news_trends 
WHERE updated_at >= NOW() - INTERVAL '1 hour';

-- Check latest summary date
SELECT MAX(date) as latest_date, COUNT(*) as count
FROM public.news_trends 
WHERE date = CURRENT_DATE AT TIME ZONE 'Asia/Bangkok';
```

### 2. Verify Cache Invalidation
```sql
-- Check system metadata was updated
SELECT key, value, updated_at 
FROM public.system_meta 
WHERE key = 'news_last_updated'
ORDER BY updated_at DESC LIMIT 1;
```

### 3. Test Frontend Update
```bash
# Check home page shows fresh data
curl -s "http://localhost:3000/api/home?ts=$(date +%s)" | jq '.data | length'

# Verify health check passes
curl -s "http://localhost:3000/api/health" | jq '.ok'
```

## Troubleshooting

### Common Issues

#### 1. "Supabase not available for upserts"
**Cause**: Missing environment variables
**Solution**: 
```bash
# Check required variables
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY

# Load from .env if missing
source .env
```

#### 2. "Failed to upsert chunk"
**Cause**: Database constraint violation or connection issue
**Solution**:
- Check unique constraint conflicts
- Verify database connectivity
- Review error details in logs

#### 3. "No summaries generated"
**Cause**: API failures or data source issues
**Solution**:
- Check API rate limits
- Verify external data sources
- Run with `--dry-run` first

### Exit Codes

| Code | Meaning | Action |
|------|---------|--------|
| 0 | Success | Normal completion |
| 2 | Failure | Check logs, fix issues |
| 5 | Partial success | Some operations failed, investigate |

## Monitoring

### Health Indicators
1. **Data Freshness**: Latest `summary_date` should be today (Asia/Bangkok)
2. **Update Frequency**: `updated_at` timestamps should be recent
3. **Record Count**: Consistent number of daily records
4. **Error Rate**: Exit code 0 for successful runs

### Alerting Thresholds
- No data updates for > 4 hours
- Exit code != 0 for > 2 consecutive runs
- Home page returns < 5 items
- Health check fails

## Best Practices

1. **Scheduling**: Run every 2-4 hours during active hours
2. **Monitoring**: Check logs and exit codes
3. **Backup**: Ensure database backups before major changes
4. **Testing**: Use `--dry-run` for configuration changes
5. **Timezone**: Always consider Asia/Bangkok timezone for date operations

## Emergency Procedures

### Pipeline Stuck/Failed
1. Check process status: `ps aux | grep summarize_all_v2`
2. Kill if hung: `pkill -f summarize_all_v2`
3. Check logs for errors
4. Run with `--dry-run` to test
5. Resume with normal parameters

### Data Corruption
1. Stop pipeline immediately
2. Check database integrity
3. Restore from backup if needed
4. Investigate root cause
5. Resume with careful monitoring

## Integration Points

- **Frontend**: Home page data via `/api/home`
- **PDF Generation**: Weekly reports via snapshot system
- **Cache System**: `system_meta` table for invalidation
- **Monitoring**: Health check at `/api/health`
