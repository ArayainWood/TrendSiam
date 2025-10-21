# Postgrestools LSP Setup Guide for TrendSiam

## Overview

This guide explains how to set up the Postgrestools Language Server Protocol (LSP) extension for VS Code to work with the TrendSiam database. This provides SQL autocomplete, syntax highlighting, and database introspection features while maintaining Plan-B security (read-only access).

## Prerequisites

1. VS Code installed
2. Postgrestools extension installed from VS Code marketplace
3. Access to Supabase project dashboard
4. Admin access to run SQL for role creation

## Setup Steps

### 1. Install Postgrestools Extension

1. Open VS Code
2. Go to Extensions (Ctrl/Cmd + Shift + X)
3. Search for "Postgrestools"
4. Install the extension by "Cockroach Labs"

### 2. Obtain Database Connection Details

1. Log into your Supabase dashboard
2. Navigate to **Settings** > **Database**
3. Find the **Connection string** section
4. Use the **Connection pooling** string (not direct connection)
5. Note down:
   - Host: `db.YOUR_PROJECT_REF.supabase.co`
   - Database: `postgres` (default)
   - Port: `5432` (default)

### 3. Create Read-Only Database User

1. Open Supabase SQL Editor
2. Run the SQL script: `frontend/db/sql/admin/2025-09-27_lsp_ro_hardening.sql`
3. **IMPORTANT**: Change `CHANGE_THIS_PASSWORD` to a secure password before running
4. This creates an `lsp_ro` user with read-only permissions

### 4. Configure Postgrestools

1. Copy the example config:
   ```bash
   cp frontend/.vscode/postgrestools.local.jsonc.example frontend/.vscode/postgrestools.local.jsonc
   ```

2. Edit `frontend/.vscode/postgrestools.local.jsonc` and replace:
   - `REPLACE_PASSWORD` with the password you set for `lsp_ro`
   - `REPLACE_HOST` with your Supabase host
   - `REPLACE_DB` with `postgres`

Example:
```jsonc
{
  "db": {
    "connectionString": "postgresql://lsp_ro:mySecurePassword123@db.abc123.supabase.co:5432/postgres?sslmode=require"
  },
  "schemas": ["public"],
  "searchPath": ["public"]
}
```

### 5. Test the Connection

1. Open VS Code Command Palette (Ctrl/Cmd + Shift + P)
2. Run: **"Postgrestools: Get Current Version"**
   - You should see your PostgreSQL version (e.g., "PostgreSQL 15.1")
3. Run: **"Postgrestools: Refresh DB Introspection"**
   - This loads table/column information for autocomplete

### 6. Verify Setup

1. Open the SQL file: `frontend/db/sql/admin/2025-09-27_lsp_sanity_check.sql`
2. Run the queries to verify:
   - Connection works
   - Current user is `lsp_ro`
   - Read-only mode is active
   - Public schema is accessible

## Using Postgrestools

### Features Available

- **SQL Autocomplete**: Type table names, column names, SQL keywords
- **Hover Information**: Hover over tables/columns for details
- **Syntax Highlighting**: SQL syntax is properly highlighted
- **Error Detection**: Basic SQL syntax errors are caught
- **Go to Definition**: Navigate to table definitions

### Command Palette Commands

- **Postgrestools: Get Current Version** - Test connection
- **Postgrestools: Refresh DB Introspection** - Update autocomplete data
- **Postgrestools: Show Output** - View extension logs

### Writing SQL

1. Create `.sql` files in your project
2. Autocomplete will suggest:
   - Table names after `FROM`, `JOIN`
   - Column names after `SELECT`, `WHERE`
   - SQL keywords and functions

## Security Notes

### Plan-B Compliance

- The `lsp_ro` user has **read-only** access
- Cannot modify any data or schema
- Connection timeouts prevent long queries
- Follows TrendSiam security model

### Best Practices

1. **Never commit** `postgrestools.local.jsonc` (it's in .gitignore)
2. Use only the `lsp_ro` user for LSP
3. Don't share database credentials
4. Rotate passwords periodically
5. Use connection pooling string for better performance

### What NOT to Do

- Don't use admin/service_role credentials for LSP
- Don't remove timeout settings
- Don't grant write permissions to `lsp_ro`
- Don't commit any file with credentials

## Troubleshooting

### Connection Failed

1. Check connection string format
2. Verify SSL mode is set to `require`
3. Ensure password has no special characters that need escaping
4. Check if Supabase allows your IP

### No Autocomplete

1. Run "Refresh DB Introspection" again
2. Check if user has SELECT permissions
3. Verify schema is set to `public`
4. Restart VS Code

### Timeout Errors

- This is by design - queries timeout after 5 seconds
- Break complex queries into smaller parts
- Use the Supabase dashboard for long-running queries

## Additional Resources

- [Postgrestools Documentation](https://github.com/cockroachdb/postgrestools)
- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooling)
- TrendSiam Security Model: `memory-bank/01_security_plan_b.mb`
