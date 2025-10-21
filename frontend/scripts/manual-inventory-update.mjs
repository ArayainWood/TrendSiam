#!/usr/bin/env node
/**
 * Manual inventory update based on known schema
 * Used when db:inventory can't access information_schema
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const CYAN = '\x1b[36m'
const GREEN = '\x1b[32m'
const RESET = '\x1b[0m'

// Known schema from SQL file and documentation
const SCHEMA = {
  public_v_home_news: [
    'id',
    'title',
    'summary',
    'summary_en',
    'category',
    'platform',
    'channel',
    'published_at',
    'source_url',
    'image_url',
    'ai_prompt',
    'popularity_score',
    'rank',
    'is_top3',
    'views',
    'likes',
    'comments',
    'growth_rate_value',
    'growth_rate_label',
    'ai_opinion',
    'score_details'
  ],
  news_trends: [
    'id',
    'title',
    'summary',
    'summary_en',
    'description',
    'category',
    'platform',
    'channel',
    'video_id',
    'external_id',
    'popularity_score',
    'published_at',
    'published_date',
    'source_url',
    'view_count',
    'like_count',
    'comment_count',
    'growth_rate',
    'ai_image_url',
    'ai_image_prompt',
    'platform_mentions',
    'keywords',
    'ai_opinion',
    'score_details',
    'reason',
    'summary_date',
    'created_at',
    'updated_at'
  ],
  stories: [
    'story_id',
    'source_id',
    'title',
    'description',
    'summary',
    'summary_en',
    'platform',
    'channel',
    'category',
    'duration',
    'publish_time',
    'ai_image_prompt',
    'created_at',
    'updated_at'
  ],
  snapshots: [
    'id',
    'story_id',
    'snapshot_date',
    'view_count',
    'like_count',
    'comment_count',
    'share_count',
    'popularity_score',
    'rank',
    'growth_rate',
    'raw_view',
    'raw_like',
    'raw_comment',
    'created_at'
  ],
  image_files: [
    'id',
    'story_id',
    'storage_path',
    'file_path',
    'file_size',
    'mime_type',
    'width',
    'height',
    'format',
    'metadata',
    'is_valid',
    'is_deleted',
    'created_at',
    'last_verified_at',
    'expires_at'
  ],
  ai_images: [
    'id',
    'news_id',
    'image_url',
    'prompt',
    'model_used',
    'generation_params',
    'cost',
    'is_active',
    'created_at',
    'updated_at'
  ],
  system_meta: [
    'key',
    'value',
    'description',
    'created_at',
    'updated_at'
  ],
  stats: [
    'id',
    'metric_name',
    'metric_value',
    'metric_date',
    'metadata',
    'created_at',
    'updated_at'
  ],
  weekly_report_snapshots: [
    'snapshot_id',
    'status',
    'range_start',
    'range_end',
    'built_at',
    'algo_version',
    'data_version',
    'items',
    'meta',
    'created_at'
  ]
}

async function updateInventory() {
  console.log(`${CYAN}📊 Updating inventory files manually...${RESET}\n`)
  
  const timestamp = new Date().toISOString()
  
  // Update schema_map.json
  const schemaMap = {
    generatedAt: timestamp,
    tables: SCHEMA
  }
  
  const schemaMapPath = path.join(__dirname, '..', 'docs', 'dev', 'schema_map.json')
  await fs.writeFile(schemaMapPath, JSON.stringify(schemaMap, null, 2))
  console.log(`${GREEN}✓${RESET} Updated docs/dev/schema_map.json`)
  
  // Update baseline_db_inventory.md
  let inventoryMd = `# TrendSiam Database Schema Inventory

Generated: ${timestamp.split('T')[0]}

## Critical View: public_v_home_news

| Column | Position | Type | Description |
|--------|----------|------|-------------|
`

  SCHEMA.public_v_home_news.forEach((col, idx) => {
    const type = col.includes('_at') ? 'timestamptz' : 
                 col.includes('id') || col === 'title' || col === 'summary' || col === 'channel' || col === 'platform' || col === 'category' || col.includes('label') || col === 'ai_opinion' ? 'text' :
                 col === 'rank' ? 'integer' :
                 col === 'is_top3' ? 'boolean' :
                 col === 'views' || col === 'likes' || col === 'comments' ? 'bigint' :
                 col === 'popularity_score' || col === 'growth_rate_value' ? 'numeric' :
                 col === 'score_details' ? 'jsonb' : 'text'
    
    const desc = col === 'source_url' ? 'Source URL (NEVER NULL)' :
                 col === 'image_url' ? 'AI image URL (NULL except Top-3)' :
                 col === 'ai_prompt' ? 'AI prompt (NULL except Top-3)' :
                 col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    
    inventoryMd += `| ${col} | ${idx + 1} | ${type} | ${desc} |\n`
  })

  inventoryMd += `\n## Tables\n`

  Object.entries(SCHEMA).forEach(([table, columns]) => {
    if (table !== 'public_v_home_news') {
      inventoryMd += `\n### ${table}\n\n| Column | Position |\n|--------|----------|\n`
      columns.forEach((col, idx) => {
        inventoryMd += `| ${col} | ${idx + 1} |\n`
      })
    }
  })

  const inventoryMdPath = path.join(__dirname, '..', 'docs', 'dev', 'baseline_db_inventory.md')
  await fs.writeFile(inventoryMdPath, inventoryMd)
  console.log(`${GREEN}✓${RESET} Updated docs/dev/baseline_db_inventory.md`)
  
  // Update memory bank
  const memoryBankPath = path.join(__dirname, '..', '..', 'memory-bank', 'db_schema_inventory.mb')
  const memoryBankContent = await fs.readFile(memoryBankPath, 'utf-8')
  
  // Keep the existing header and critical view section, just update the timestamp
  const updatedMemoryBank = memoryBankContent.replace(
    /Generated: \d{4}-\d{2}-\d{2}.*$/m,
    `Generated: ${timestamp.split('T')[0]}`
  )
  
  await fs.writeFile(memoryBankPath, updatedMemoryBank)
  console.log(`${GREEN}✓${RESET} Updated memory-bank/db_schema_inventory.mb`)
  
  console.log(`\n${GREEN}✅ Manual inventory update complete!${RESET}`)
}

updateInventory().catch(console.error)
