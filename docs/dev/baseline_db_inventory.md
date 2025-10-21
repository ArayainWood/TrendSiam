# TrendSiam Database Schema Inventory

Generated: 2024-01-31 (Manual baseline)

## Critical View: public_v_home_news

| Column | Position | Type | Description |
|--------|----------|------|-------------|
| id | 1 | text | Unique identifier |
| title | 2 | text | Title of the news item |
| summary | 3 | text | Thai summary |
| summary_en | 4 | text | English summary |
| category | 5 | text | Content category |
| platform | 6 | text | Source platform |
| channel | 7 | text | Channel name |
| published_at | 8 | timestamptz | Publication timestamp |
| source_url | 9 | text | Source URL (NEVER NULL) |
| image_url | 10 | text | AI image URL (NULL except Top-3) |
| ai_prompt | 11 | text | AI prompt (NULL except Top-3) |
| popularity_score | 12 | numeric | Popularity score |
| rank | 13 | integer | Ranking position |
| is_top3 | 14 | boolean | Top-3 flag |
| views | 15 | bigint | View count |
| likes | 16 | bigint | Like count |
| comments | 17 | bigint | Comment count |
| growth_rate_value | 18 | numeric | Growth rate percentage |
| growth_rate_label | 19 | text | Growth rate label |
| ai_opinion | 20 | text | AI analysis opinion |
| score_details | 21 | jsonb | Detailed scoring breakdown |

## Tables

### news_trends

| Column | Position |
|--------|----------|
| id | 1 |
| title | 2 |
| summary | 3 |
| summary_en | 4 |
| description | 5 |
| category | 6 |
| platform | 7 |
| channel | 8 |
| video_id | 9 |
| external_id | 10 |
| popularity_score | 11 |
| published_at | 12 |
| published_date | 13 |
| source_url | 14 |
| view_count | 15 |
| like_count | 16 |
| comment_count | 17 |
| growth_rate | 18 |
| ai_image_url | 19 |
| ai_image_prompt | 20 |
| platform_mentions | 21 |
| keywords | 22 |
| ai_opinion | 23 |
| score_details | 24 |
| reason | 25 |
| summary_date | 26 |
| created_at | 27 |
| updated_at | 28 |

### stories

| Column | Position |
|--------|----------|
| story_id | 1 |
| source_id | 2 |
| title | 3 |
| description | 4 |
| summary | 5 |
| summary_en | 6 |
| platform | 7 |
| channel | 8 |
| category | 9 |
| duration | 10 |
| publish_time | 11 |
| ai_image_prompt | 12 |
| created_at | 13 |
| updated_at | 14 |

### snapshots

| Column | Position |
|--------|----------|
| id | 1 |
| story_id | 2 |
| snapshot_date | 3 |
| view_count | 4 |
| like_count | 5 |
| comment_count | 6 |
| share_count | 7 |
| popularity_score | 8 |
| rank | 9 |
| growth_rate | 10 |
| raw_view | 11 |
| raw_like | 12 |
| raw_comment | 13 |
| created_at | 14 |

### image_files

| Column | Position |
|--------|----------|
| id | 1 |
| story_id | 2 |
| storage_path | 3 |
| file_path | 4 |
| file_size | 5 |
| mime_type | 6 |
| width | 7 |
| height | 8 |
| format | 9 |
| metadata | 10 |
| is_valid | 11 |
| is_deleted | 12 |
| created_at | 13 |
| last_verified_at | 14 |
| expires_at | 15 |

### ai_images

| Column | Position |
|--------|----------|
| id | 1 |
| news_id | 2 |
| image_url | 3 |
| prompt | 4 |
| model_used | 5 |
| generation_params | 6 |
| cost | 7 |
| is_active | 8 |
| created_at | 9 |
| updated_at | 10 |

### system_meta

| Column | Position |
|--------|----------|
| key | 1 |
| value | 2 |
| description | 3 |
| created_at | 4 |
| updated_at | 5 |

### stats

| Column | Position |
|--------|----------|
| id | 1 |
| metric_name | 2 |
| metric_value | 3 |
| metric_date | 4 |
| metadata | 5 |
| created_at | 6 |
| updated_at | 7 |

### weekly_report_snapshots

| Column | Position |
|--------|----------|
| snapshot_id | 1 |
| status | 2 |
| range_start | 3 |
| range_end | 4 |
| built_at | 5 |
| algo_version | 6 |
| data_version | 7 |
| items | 8 |
| meta | 9 |
| created_at | 10 |