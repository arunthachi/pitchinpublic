# Pitch in Public - Supabase Schema Setup

## Overview

Phase 1 Release requires setting up Supabase tables. This guide covers two approaches:
- **Safe Migration System** (Recommended for existing projects)
- **Full Schema Setup** (Recommended for fresh projects)

---

## ⚡ Quick Start: Safe Migration System

For projects with existing tables, use the **idempotent migration files** in `supabase/migrations/`:

### In 3 Steps:

1. **Run Migration 001**
   - Copy: `supabase/migrations/001_create_core_schema.sql`
   - Paste into Supabase SQL Editor
   - Click Run

2. **Run Migration 002**
   - Copy: `supabase/migrations/002_add_gamification_tables.sql`
   - Paste into Supabase SQL Editor
   - Click Run

3. **Run Migration 003**
   - Copy: `supabase/migrations/003_add_triggers_and_functions.sql`
   - Paste into Supabase SQL Editor
   - Click Run

✅ Done! All tables, indexes, RLS policies, and triggers are created.

### Why Use Migrations?

✅ **Idempotent**: Safe to run multiple times
✅ **Non-destructive**: Won't delete existing data
✅ **Ordered**: Ensures correct table dependencies
✅ **Traceable**: Clear history of schema changes
✅ **Reversible**: Can apply migrations selectively

See `supabase/MIGRATION_QUICK_START.md` for detailed steps.

---

## Detailed Migration Guide

See `supabase/MIGRATIONS.md` for:
- How to apply migrations
- Understanding each migration
- Troubleshooting guide
- Testing your setup
- Adding new migrations

---

## Full Schema Reference

### ✅ Main Schema (Already Defined in `supabase-schema.sql`)

These tables support **Week 1-2 features**:

| Table | Purpose | Week | Status |
|-------|---------|------|--------|
| `profiles` | User profile data | 1 | ✅ Exists |
| `companies` | Company/startup info | Future | ✅ Exists |
| `pitches` | Pitch videos | 1 | ✅ Exists |
| `reactions` | Roast/toast reactions | 2 | ✅ Exists |
| `feedback` | Detailed feedback | 2 | ✅ Exists |
| `bookmarks` | Saved pitches | 2 | ✅ Exists |
| `follows` | User following | Future | ✅ Exists |
| `pitch_views` | View analytics | Future | ✅ Exists |
| `notifications` | User notifications | Future | ✅ Exists |

**Key Fields in `pitches` table:**
```sql
- video_id TEXT           -- Cloudflare Stream video ID
- video_provider TEXT     -- 'cloudflare' for video hosting
- roast_count INTEGER     -- Quick reaction counter
- toast_count INTEGER     -- Quick reaction counter
- bookmark_count INTEGER  -- Bookmark counter
```

**Key Fields in `profiles` table:**
```sql
- pitches_count INTEGER   -- Total pitches by user
- followers_count INTEGER -- Total followers
- following_count INTEGER -- Total following
```

---

### ✨ Gamification Schema (Added by Migration 002)

These tables support **Week 3-4 features**:

#### 1. **user_streaks** Table
Tracks daily activity streaks and milestones.

```sql
user_id (FK)           -- Links to profiles
current_streak INT     -- Days active in a row
best_streak INT        -- All-time record
last_activity_date     -- Last time user was active (YYYY-MM-DD)
last_activity_type     -- 'pitch', 'roast', 'toast', 'feedback', 'challenge'
total_activities INT   -- Count of all activities
```

**Purpose:**
- Streak counter (🔥 5 days)
- Milestone detection (5, 10, 25, 50, 100 days)
- Daily engagement tracking

**Updated by:**
- POST `/api/user/streak` - after any activity
- POST `/api/pitches/[pitchId]/reaction` - after roast/toast
- POST `/api/pitches/[pitchId]/feedback` - after feedback
- POST `/api/daily-challenge/respond` - after challenge response

---

#### 2. **achievements** Table
Tracks which badges user has unlocked.

```sql
user_id (FK)       -- Links to profiles
badge_id TEXT      -- Unique badge identifier (e.g., 'first_pitch')
badge_name TEXT    -- Display name (e.g., 'First Pitch')
badge_description  -- Hover tooltip text
badge_icon TEXT    -- Emoji (e.g., '🎬')
unlocked_at        -- Timestamp when badge was earned
```

**Unique badges (8 total):**
- `first_pitch` 🎬 - Create first pitch
- `five_pitches` 5️⃣ - Create 5 pitches
- `ten_pitches` 🔟 - Create 10 pitches
- `five_day_streak` 🔥 - 5-day activity streak
- `ten_day_streak` ⚡ - 10-day activity streak
- `fifty_roasts` 🔥 - Receive 50+ roasts
- `fifty_toasts` 🥂 - Receive 50+ toasts
- `feedback_expert` 💡 - Submit 25+ detailed feedback

**Purpose:**
- Achievement/badge system
- User profile display
- Leaderboard ranking

**Queried by:**
- GET `/api/user/achievements` - fetch user's badges
- POST `/api/user/achievements` - unlock new badge
- GET `/api/leaderboard?type=badges` - rank by badge count

---

#### 3. **daily_challenges** Table
Daily challenge prompts that rotate once per day.

```sql
id UUID            -- Unique challenge ID
prompt TEXT        -- Challenge question/prompt
category TEXT      -- 'Product', 'Market', 'Traction', 'Vision'
difficulty TEXT    -- 'easy', 'medium', 'hard'
challenge_date     -- Date (YYYY-MM-DD) - ONE per day, UNIQUE
response_count INT -- How many users responded
created_at         -- Auto-set
```

**Example challenge:**
```
prompt: "What's the #1 problem your product solves?"
category: "Product"
difficulty: "easy"
challenge_date: "2024-12-03"
```

**Purpose:**
- Daily engagement prompt
- Habit formation (one challenge per day)
- Community response aggregation

**Accessed by:**
- GET `/api/daily-challenge` - fetch today's challenge (auto-creates if missing)
- POST `/api/daily-challenge/respond` - submit user response

---

#### 4. **challenge_responses** Table
Tracks user responses to daily challenges.

```sql
id UUID         -- Response ID
user_id (FK)    -- Links to profiles
challenge_id    -- Links to daily_challenges
response TEXT   -- User's text answer (max 2000 chars)
pitch_id (FK)   -- Optional: link response to a pitch
created_at      -- Timestamp

UNIQUE(user_id, challenge_id)  -- One response per user per challenge
```

**Purpose:**
- Store user responses to challenges
- Link pitches to challenge responses
- Trigger streak updates
- Build community engagement

**Accessed by:**
- GET `/api/daily-challenge` - check if user responded today
- POST `/api/daily-challenge/respond` - create response

---

## Setup Instructions

### Method 1: Use Migration Files (Recommended)

1. See `supabase/MIGRATION_QUICK_START.md` for step-by-step instructions
2. Run 3 migrations in order (001, 002, 003)
3. Done!

### Method 2: Manual SQL Entry

**For fresh setup only:**

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy entire content of `supabase-schema.sql`
3. Paste into SQL Editor
4. Click **Run**
5. Verify all tables created successfully

---

## Environment Variables

Ensure you have these in `.env.local`:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key

# Cloudflare Stream
CLOUDFLARE_STREAM_API_TOKEN=your_token
CLOUDFLARE_ACCOUNT_ID=your_account_id
```

---

## Data Flow Examples

### Example 1: User Creates Pitch
1. POST `/api/pitches` - creates pitch record
2. Trigger `pitch_count_trigger` - increments `profiles.pitches_count`
3. Trigger `increment_user_pitches_count()` RPC - updates profile
4. Check for badge: if `pitches_count == 1`, unlock "first_pitch" badge
5. POST `/api/user/streak` - creates/updates streak

### Example 2: User Gets Roasted
1. POST `/api/pitches/[id]/reaction` with `type: 'roast'`
2. Trigger `reaction_count_trigger` - increments `pitches.roast_count`
3. Trigger `update_reaction_counts()` - updates `companies.total_roasts`
4. POST `/api/user/streak` - updates streak
5. Check for badge: if `pitch.roast_count >= 50`, unlock "fifty_roasts"

### Example 3: Daily Challenge Response
1. GET `/api/daily-challenge` - fetches today's challenge or creates one
2. User sees modal with prompt
3. POST `/api/daily-challenge/respond` - creates response
4. Trigger `challenge_response_count_trigger` - increments `daily_challenges.response_count`
5. POST `/api/user/streak` - updates streak (challenge counts as activity)
6. Success celebration triggers `AchievementUnlock` modal if badge earned

### Example 4: Leaderboard Ranking
1. GET `/api/leaderboard?type=streaks`
2. Query joins:
   - `profiles` → select name, avatar, pitches_count
   - `user_streaks` → select current_streak, best_streak, total_activities
   - `achievements` → count(id) for badge count
3. Sort by `user_streaks.current_streak DESC`
4. Return top 20 with ranking

---

## Row Level Security (RLS) Policies

All tables have RLS enabled with these policies:

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `profiles` | Public | Own | Own | Own |
| `pitches` | Public (if published) | Own | Own | Own |
| `reactions` | Public | Auth users | - | Own |
| `feedback` | Public (if is_public) | Auth users | Own | Own |
| `achievements` | Public | Auth users | - | - |
| `user_streaks` | Public | Own | Own | - |
| `daily_challenges` | Public | - | - | - |
| `challenge_responses` | Public | Auth users | - | Own |

**Note:** RLS prevents unauthorized data access while allowing community viewing.

---

## Indexes for Performance

All tables have indexes on:
- Foreign keys (user_id, pitch_id, etc.)
- Sorting columns (created_at DESC, streak DESC)
- Filter columns (status, category, etc.)

This ensures queries on the leaderboard, feed, and achievement lists are fast.

---

## Testing Checklist

- [ ] Run migrations in order (001, 002, 003)
- [ ] Verify 13 tables in Table Editor
- [ ] Test streak creation: POST `/api/user/streak`
- [ ] Test achievement unlock: POST `/api/user/achievements`
- [ ] Test daily challenge: GET `/api/daily-challenge`
- [ ] Test leaderboard: GET `/api/leaderboard?type=streaks`
- [ ] Create pitch and verify counts update
- [ ] Get roasted and verify streak updates
- [ ] Answer daily challenge and verify response saved

---

## Troubleshooting

### "Migration file not found"
- Ensure you're using files from `supabase/migrations/` directory
- Check file names are correct (001, 002, 003)

### "Permission denied for schema public"
- Use admin key or service_role key
- Use Supabase dashboard SQL Editor instead

### "Relation already exists"
- This should not happen with migration files (they use IF NOT EXISTS)
- Check you're using the correct migration files from this repo

### "Foreign key constraint fails"
- Ensure migrations are run in order: 001 → 002 → 003
- Don't skip migrations

---

## Next Steps

1. **Apply migrations** using `supabase/MIGRATION_QUICK_START.md`
2. **Verify tables** appear in Supabase Table Editor
3. **Set environment variables** with your API keys
4. **Test API endpoints** with curl or Postman
5. **Start using** the application!

---

## Additional Resources

- **Migrations Guide**: `supabase/MIGRATIONS.md`
- **Quick Start**: `supabase/MIGRATION_QUICK_START.md`
- **Full Schema**: `supabase-schema.sql`
- **Supabase Docs**: https://supabase.com/docs/guides/database/migrations
