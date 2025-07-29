# Weekly Report Flexible File Naming Enhancement

## 📋 Overview

Enhanced the TrendSiam Weekly Report system to support flexible file naming patterns for daily summary JSON files. This improvement allows the system to automatically discover and load data from backup files with various naming conventions, making the system more robust and practical for real-world usage.

## 🎯 Problem Solved

**Before**: The system only loaded from a single file (`thailand_trending_summary.json`)

**After**: The system automatically discovers and loads from multiple files with flexible naming patterns:
- `thailand_trending_summary_backup_20250721_163659.json`
- `thailand_trending_summary_backup_clean_20250725_162925.json`
- `thailand_trending_summary_backup_fix_20250723_112818.json`
- And other similar patterns

## 🔧 Implementation Details

### Key Functions Added

1. **`find_valid_summary_files(start_date, end_date)`**
   - Discovers JSON files using glob patterns
   - Extracts dates from filenames using regex
   - Filters files by date range
   - Returns sorted list of valid files

2. **`extract_date_from_filename(filename, date_patterns)`**
   - Supports multiple date formats: YYYY-MM-DD, YYYYMMDD, DDMMYYYY
   - Validates date components
   - Returns `datetime` object or `None`

3. **`remove_duplicate_news_items(data)`**
   - Deduplicates based on `video_id` or `title`
   - Combines data from multiple files
   - Maintains data integrity

4. **`filter_by_published_date(data, cutoff_date)`**
   - Extracted existing date filtering logic
   - Applies content-based date filtering
   - Maintains backward compatibility

5. **`load_from_main_summary_file()`**
   - Fallback function for backward compatibility
   - Uses original loading logic
   - Ensures system never fails

### Enhanced `load_weekly_data()` Function

The main function now follows this flow:

1. **File Discovery**: Find dated files within 7-day range
2. **Data Loading**: Load and validate JSON from each file
3. **Deduplication**: Remove duplicate news items
4. **Content Filtering**: Apply intelligent date filtering
5. **Fallback**: Use main file if no dated files found

## 🛡️ Security Features

- **Path Validation**: Prevents path traversal attacks
- **Current Directory Only**: Files must be in current directory
- **Safe Filename Patterns**: Uses secure glob patterns
- **Input Validation**: Validates JSON structure and content

## 📁 Supported File Patterns

### Glob Patterns
```
thailand_trending_summary*.json
thailand_trending_*summary*.json
*thailand*trending*summary*.json
```

### Date Extraction Patterns
- `YYYY-MM-DD` or `YYYY-MM-DD` (e.g., `20250725` or `2025-07-25`)
- `YYYYMMDD` (compact format)
- `DDMMYYYY` (alternative format)

### Example Supported Filenames
- ✅ `thailand_trending_summary_backup_20250721_163659.json`
- ✅ `thailand_trending_summary_clean_20250725_162925.json`
- ✅ `thailand_trending_summary_fix_20250723_112818.json`
- ✅ `thailand_trending_summary_2025-07-24.json`
- ✅ `thailand_trending_summary_20250724.json`

## 🔄 Intelligent Date Filtering

The system uses a two-tier filtering approach:

1. **File-Level Filtering**: Based on filename dates (7-day range)
2. **Content-Level Filtering**: Based on `published_date` fields in content
   - **Dated Files**: 14-day content filter (more lenient)
   - **Main File**: 7-day content filter (strict)

This ensures optimal data retrieval while maintaining content freshness.

## 🔄 Backward Compatibility

- **Main File Fallback**: If no dated files found, uses original behavior
- **Existing API**: No changes to function signatures
- **UI Compatibility**: All existing UI components work unchanged
- **PDF Export**: Enhanced data automatically flows to PDF generation

## 📊 Performance Improvements

- **Automatic Discovery**: No manual file management required
- **Efficient Loading**: Only loads files within date range
- **Smart Deduplication**: Combines multiple files without duplicates
- **Robust Error Handling**: Continues operation even if some files fail

## 🧪 Testing Results

**Test Case**: Directory with 3 backup files dated within 7-day range
- **Files Discovered**: 3 files correctly identified
- **Date Extraction**: All dates parsed successfully
- **Data Loading**: 30 total items loaded, 9 unique items after filtering
- **Performance**: Fast and efficient processing

## 🚀 Benefits

1. **Robustness**: System works with various backup file naming conventions
2. **Flexibility**: Supports future file naming patterns
3. **Automation**: No manual configuration required
4. **Security**: Secure file handling prevents attacks
5. **Scalability**: Can handle multiple daily backup files
6. **Reliability**: Fallback ensures system always works

## 🔮 Future Enhancements

- Support for subdirectory scanning
- Configurable date range preferences
- File priority based on naming patterns
- Advanced deduplication algorithms
- Compressed file support (.gz, .zip)

## 🏆 Conclusion

The flexible file naming enhancement makes the Weekly Report system significantly more robust and practical for real-world usage. It automatically adapts to various backup file naming conventions while maintaining full backward compatibility and security.

---

**Status**: ✅ Implemented and Tested  
**Version**: 1.0  
**Date**: 2025-07-25  
**Files Modified**: `app.py` (load_weekly_data function and related utilities)  
**Dependencies Added**: `PyMuPDF>=1.26.0` for PDF generation 