# 🗃️ Database Schema (Auto-generated)

*Last Updated: 4/22/2026, 11:55:01 AM*

---

## 📋 Table: media

| Column | Type |
| :--- | :--- |
| `ratings_fetched_at` | timestamp with time zone |
| `id` | uuid |
| `release_year` | integer |
| `last_scraped_at` | timestamp with time zone |
| `created_at` | timestamp with time zone |
| `updated_at` | timestamp with time zone |
| `tmdb_id` | bigint |
| `type` | character varying |
| `title` | character varying |
| `synopsis` | text |
| `poster_url` | text |
| `backdrop_url` | text |
| `imdb_id` | character varying |
| `imdb_rating` | text |
| `rt_score` | text |
| `metascore` | text |

## 📋 Table: watched_history

| Column | Type |
| :--- | :--- |
| `id` | uuid |
| `user_id` | uuid |
| `tmdb_id` | bigint |
| `watched_at` | timestamp with time zone |
| `rating` | integer |
| `personal_rating` | integer |
| `original_release_date` | date |
| `title` | text |
| `poster_url` | text |
| `review` | text |

## 📋 Table: watchlist

| Column | Type |
| :--- | :--- |
| `updated_at` | timestamp with time zone |
| `sort_order` | integer |
| `order_index` | integer |
| `id` | uuid |
| `user_id` | uuid |
| `media_id` | uuid |
| `watched` | boolean |
| `added_at` | timestamp with time zone |

## 📋 Table: streaming_cache

| Column | Type |
| :--- | :--- |
| `tmdb_id` | bigint |
| `platforms` | jsonb |
| `updated_at` | timestamp with time zone |
| `item_type` | text |

## 📋 Table: media_cast_crew

| Column | Type |
| :--- | :--- |
| `id` | uuid |
| `media_id` | uuid |
| `person_id` | uuid |
| `created_at` | timestamp with time zone |
| `updated_at` | timestamp with time zone |
| `role_type` | character varying |
| `character` | character varying |
| `job` | character varying |

## 📋 Table: profiles

| Column | Type |
| :--- | :--- |
| `id` | uuid |
| `created_at` | timestamp with time zone |
| `email` | text |

## 📋 Table: waitlist

| Column | Type |
| :--- | :--- |
| `id` | uuid |
| `created_at` | timestamp with time zone |
| `migrated_at` | timestamp with time zone |
| `email` | text |
| `status` | text |

## 📋 Table: people

| Column | Type |
| :--- | :--- |
| `id` | uuid |
| `updated_at` | timestamp with time zone |
| `created_at` | timestamp with time zone |
| `name` | character varying |
| `headshot_url` | text |

## 📋 Table: user_preferences

| Column | Type |
| :--- | :--- |
| `user_id` | uuid |
| `saved_provider_ids` | ARRAY |
| `updated_at` | timestamp with time zone |
| `watch_region` | text |

## 📋 Table: watchlists

| Column | Type |
| :--- | :--- |
| `id` | uuid |
| `user_id` | uuid |
| `added_at` | timestamp with time zone |
| `movie_id` | text |

## 📋 Table: platforms

| Column | Type |
| :--- | :--- |
| `created_at` | timestamp with time zone |
| `updated_at` | timestamp with time zone |
| `id` | uuid |
| `name` | character varying |
| `logo_url` | text |

## 📋 Table: user_profiles

| Column | Type |
| :--- | :--- |
| `id` | uuid |
| `created_at` | timestamp with time zone |
| `updated_at` | timestamp with time zone |
| `enabled_services` | ARRAY |
| `display_name` | character varying |
| `avatar_url` | text |
| `subscription_tier` | text |
| `stripe_customer_id` | text |

## 📋 Table: media_availability

| Column | Type |
| :--- | :--- |
| `id` | uuid |
| `media_id` | uuid |
| `platform_id` | uuid |
| `price` | numeric |
| `created_at` | timestamp with time zone |
| `updated_at` | timestamp with time zone |
| `access_type` | character varying |
| `direct_url` | text |

