# Supabase Migrations Guide

This directory contains safe, idempotent SQL migrations for the Pitch in Public application. Each migration can be run multiple times without causing errors.

## Migration Overview

| File | Purpose | Status | Safe to Run |
|------|---------|--------|-------------|
| `001_create_core_schema.sql` | Create base tables (profiles, pitches, etc.) | Phase 1 Weeks 1-2 | ✅ Always |
| `002_add_gamification_tables.sql` | Add streak, achievement, challenge tables | Phase 1 Weeks 3-4 | ✅ Always |
| `003_add_triggers_and_functions.sql` | Add all triggers and RPC functions | Phase 1 Complete | ✅ Always |

## What Makes These Migrations Safe?

1. **Idempotent**: Use `IF NOT EXISTS` to skip existing objects
2. **Non-destructive**: Never drop tables or remove columns
3. **Replayable**: Safe to run multiple times
4. **Ordered**: Number prefixes ensure correct execution order

### Example: Idempotent SQL

```sql
-- ❌ UNSAFE: Will fail if table exists
CREATE TABLE users (id UUID PRIMARY KEY);

-- ✅ SAFE: Skips if table exists
CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY);

-- ❌ UNSAFE: Will fail if policy already exists
CREATE POLICY "Public access" ON users FOR SELECT USING (true);

-- ✅ SAFE: Replaces existing policy
CREATE POLICY IF NOT EXISTS "Public access" ON users FOR SELECT USING (true);
```

---

## How to Apply Migrations

### Option 1: Apply All at Once (Recommended for Fresh Setup)

**For new Supabase projects:**

1. Copy entire content of `001_create_core_schema.sql`
2. Paste into Supabase SQL Editor
3. Click **Run**
4. Repeat for `002_add_gamification_tables.sql`
5. Repeat for `003_add_triggers_and_functions.sql`

### Option 2: Apply Incrementally (Recommended for Existing Projects)

**For projects with existing tables:**

1. Start with whichever migration applies to your current state
2. Run in order: 001 → 002 → 003
3. Each will skip existing tables/functions

**Example scenarios:**

- **Just set up Supabase**: Run 001, then 002, then 003
- **Already have core tables**: Run 002 to add gamification, then 003 for triggers
- **Have everything except triggers**: Run only 003

### Option 3: Command Line (If Using Supabase CLI)

```bash
# List pending migrations
supabase migration list

# Apply specific migration
supabase db push --file supabase/migrations/001_create_core_schema.sql

# Apply all pending migrations
supabase db push
```

---

## Safety Practices

### ✅ DO

- Run migrations in order (001 → 002 → 003)
- Use `IF NOT EXISTS` for all CREATE statements
- Use `CREATE OR REPLACE` for functions
- Always test in a development database first
- Keep migrations focused on a single concern

### ❌ DON'T

- Drop tables or columns
- Use `CASCADE` in production without careful review
- Skip migrations in the sequence
- Modify migrations after running them
- Run migrations without understanding them first

---

## Tracking Applied Migrations

Create a table to track which migrations have been applied:

```sql
-- Optional: Create migrations table to track history
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- After running 001
INSERT INTO migrations (name) VALUES ('001_create_core_schema');

-- After running 002
INSERT INTO migrations (name) VALUES ('002_add_gamification_tables');

-- After running 003
INSERT INTO migrations (name) VALUES ('003_add_triggers_and_functions');

-- View applied migrations
SELECT * FROM migrations ORDER BY applied_at;
```

---

## Understanding Each Migration

### Migration 001: Core Schema

**Creates:**
- `profiles` - User profile data
- `companies` - Company/startup info
- `pitches` - Pitch video submissions
- `reactions` - Roast/toast reactions
- `feedback` - Detailed feedback
- `bookmarks` - Saved pitches
- `follows` - User following
- `pitch_views` - View analytics
- `notifications` - User notifications

**RLS Policies:** All tables have Row Level Security enabled
**Triggers:** None yet (added in Migration 003)

### Migration 002: Gamification

**Creates:**
- `user_streaks` - Track daily activity streaks
- `achievements` - User badge/achievement records
- `daily_challenges` - Daily challenge prompts
- `challenge_responses` - User responses to challenges

**Features:**
- Automatic timestamp tracking (updated_at)
- Unique constraints to prevent duplicates
- Proper indexing for query performance

### Migration 003: Triggers & Functions

**Creates Triggers For:**
- Automatic timestamp updates
- Follow/follower count tracking
- Pitch count updates
- Reaction count updates
- View count updates
- Bookmark count updates
- Challenge response tracking

**Creates Functions For:**
- Auto-profile creation on signup
- Company slug generation
- Counting aggregations
- Interest score calculation

---

## Adding New Migrations

When adding new features that require schema changes:

1. Create new file: `supabase/migrations/004_your_feature.sql`
2. Use incrementing number (004, 005, etc.)
3. Use `IF NOT EXISTS` for all CREATE statements
4. Add descriptive header comment
5. Keep related changes together
6. Test thoroughly before deploying

### Template for New Migration

```sql
-- Migration 004: Your Feature Description
-- Created: YYYY-MM-DD
-- Purpose: What problem does this solve?

-- =============================================
-- TABLE NAME
-- =============================================
CREATE TABLE IF NOT EXISTS new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Add columns...
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_new_table_user_id ON new_table(user_id);

-- RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY IF NOT EXISTS "New table access policy"
  ON new_table FOR SELECT
  USING (auth.uid() = user_id);
```

---

## Troubleshooting

### Migration Fails: "Duplicate Key"

**Problem:** "Column already exists" or similar error

**Solution:** Check if using `IF NOT EXISTS` or `IF NOT EXISTS` not working properly
- Ensure you're running the right migration version
- Check Supabase table structure in dashboard

### Migration Fails: "Permission Denied"

**Problem:** "Permission denied for schema public"

**Solution:**
- Use an admin/service role key in Supabase, not anon key
- Ensure you have appropriate database permissions
- Check role settings in Supabase dashboard

### Trigger Not Firing

**Problem:** Counter updates not happening

**Solution:**
- Ensure Migration 003 was run
- Check trigger exists: `SELECT * FROM information_schema.triggers`
- Verify function exists: `SELECT * FROM pg_proc WHERE proname LIKE 'update_*'`

---

## Viewing Applied Migrations in Supabase

To see what's been created:

1. **Tables**: Dashboard → Table Editor → See all tables
2. **Indexes**: SQL Editor → Query:
   ```sql
   SELECT * FROM pg_indexes WHERE schemaname = 'public';
   ```
3. **Triggers**: SQL Editor → Query:
   ```sql
   SELECT * FROM information_schema.triggers WHERE trigger_schema = 'public';
   ```
4. **Functions**: SQL Editor → Query:
   ```sql
   SELECT * FROM pg_proc WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
   ```

---

## Phase 1 Complete Schema

After running all 3 migrations, you'll have:

**13 Tables:**
- 9 Core tables (Weeks 1-2)
- 4 Gamification tables (Weeks 3-4)

**20+ Indexes:** For optimal query performance

**15+ Triggers:** For automatic counting and updates

**20+ Functions:** For RPC endpoints and automations

**RLS Policies:** Securing all data access

---

## Next Steps

1. **Apply migrations** in Supabase dashboard
2. **Verify tables** appear in Table Editor
3. **Test API endpoints** with curl or Postman
4. **Monitor logs** for any errors
5. **Commit migrations** to version control

---

## Need Help?

- Check error message in Supabase dashboard
- Review the SQL in the migration file
- Ensure migrations are run in order (001, 002, 003)
- Try running migrations one at a time to isolate issues
- Check Supabase documentation: https://supabase.com/docs/guides/database/migrations
