# How to Update Database Schema

When making changes to the database schema, follow this strict 5-step process to ensure the changes are properly tracked and don't break the application.

## 5-Step Schema Update Process

### 1. Make Schema Changes in Supabase

- Apply your migration or schema changes in Supabase SQL Editor
- Test the changes to ensure they work as expected
- Document what changed and why

### 2. Update the Schema Inventory

```bash
npm run db:inventory
```

This command will:
- Query all tables and columns from the database
- Update `docs/dev/baseline_db_inventory.md` (human-readable)
- Update `docs/dev/schema_map.json` (machine-readable)
- Update `src/lib/db/schema-constants.ts` (TypeScript types)
- Update `memory-bank/db_schema_inventory.mb` (Cursor AI memory)

Review the diffs carefully to ensure:
- Your intended changes are reflected
- No unexpected changes occurred
- All tables are included

### 3. Update Affected Code

Update all affected SQL views, API routes, and frontend components to use **only** columns that exist in the new inventory:

- **SQL Views**: 
  - No `SELECT *` - explicitly list columns
  - Use only columns from the inventory
  - Update JOIN conditions if needed
  - Run SQL self-checks at the bottom of view files

- **API Routes**:
  - Update column mappings (snake_case → camelCase)
  - Update Zod schemas if fields changed
  - Ensure diagnostics reflect new columns

- **Frontend**:
  - Update TypeScript types
  - Update component field references
  - Ensure no snake_case leaks into frontend

### 4. Run All Checks

```bash
npm run check:all
```

This runs:
- `db:guard` - Ensures schema matches baseline
- `check:types` - TypeScript compilation
- `check:home` - API and view validation

All checks must pass before proceeding.

### 5. Commit and Open PR

```bash
git add -A
git commit -m "chore: update schema for [describe change]"
git push origin your-branch
```

The commit will trigger pre-commit hooks that verify:
- Schema inventory is up to date
- TypeScript has no errors
- No disallowed thumbnail fields exist

The PR will run CI checks that verify:
- All schema validations pass
- Views return expected columns
- API contracts are maintained
- Thumbnail policy is enforced

## Important Notes

### Schema Guard is a Hard Gate

- **Pre-commit**: Will fail if schema doesn't match baseline
- **Pre-push**: Will fail if any checks don't pass
- **CI/CD**: Will block merge if schema issues detected

### Common Issues and Solutions

**Issue**: Pre-commit fails with "Schema has changed"
**Solution**: Run `npm run db:inventory` and commit the changes

**Issue**: TypeScript errors after schema change
**Solution**: Update types to match new schema, ensure camelCase in API/frontend

**Issue**: View missing columns error
**Solution**: Update SQL view to include all required columns from contract

### What Gets Updated

When you run `npm run db:inventory`, these files are regenerated:

1. **docs/dev/baseline_db_inventory.md** - Human-readable table documentation
2. **docs/dev/schema_map.json** - Raw JSON for tooling
3. **src/lib/db/schema-constants.ts** - TypeScript constants and types
4. **memory-bank/db_schema_inventory.mb** - Cursor AI's memory of the schema

### Never Guess Column Names

- Always check the inventory before referencing a column
- Use `assertColumnsExist()` in code to validate
- Let TypeScript guide you with auto-complete from `SCHEMA`

### Example Column References

```typescript
import { SCHEMA, hasColumn } from '@/lib/db/schema-constants'

// Check if a column exists
if (hasColumn('news_trends', 'source_url')) {
  // Safe to use
}

// Get all columns for a table
const columns = SCHEMA.news_trends // TypeScript knows all columns

// Assert columns exist (throws if not)
import { assertColumnsExist } from '@/lib/db/schema'
assertColumnsExist('stories', ['story_id', 'source_id', 'title'])
```
