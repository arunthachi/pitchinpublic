# Migration Quick Start Guide

## TL;DR - Just Give Me The Commands!

### Scenario 1: Fresh Supabase Project

```
1. Open Supabase SQL Editor
2. Copy entire content of: supabase/migrations/001_create_core_schema.sql
3. Click Run
4. Copy entire content of: supabase/migrations/002_add_gamification_tables.sql
5. Click Run
6. Copy entire content of: supabase/migrations/003_add_triggers_and_functions.sql
7. Click Run

Done! ✅ All 13 tables created
```

### Scenario 2: Already Have Core Tables

```
1. Open Supabase SQL Editor
2. Copy entire content of: supabase/migrations/002_add_gamification_tables.sql
3. Click Run
4. Copy entire content of: supabase/migrations/003_add_triggers_and_functions.sql
5. Click Run

Done! ✅ Gamification tables added, triggers created
```

### Scenario 3: Have Everything, Just Need Triggers

```
1. Open Supabase SQL Editor
2. Copy entire content of: supabase/migrations/003_add_triggers_and_functions.sql
3. Click Run

Done! ✅ Triggers and functions created
```

---

## How to Know Which Scenario You're In

### Check existing tables:

1. Go to **Supabase Dashboard → Table Editor**
2. See what tables exist:

| Tables Present | Run This |
|---|---|
| None | 001, 002, 003 |
| profiles, pitches, etc. | 002, 003 |
| profiles, pitches, reactions, + gamification tables | 003 only |
| Everything | Nothing! You're done |

---

## Step-by-Step: Applying Migrations

### Step 1: Open Supabase SQL Editor

```
Supabase Dashboard
  → (Your Project)
    → SQL Editor
      → New Query
```

### Step 2: Copy Migration File

```
supabase/migrations/001_create_core_schema.sql
  → Copy ALL content
  → Paste into SQL Editor
```

### Step 3: Execute

```
Click RUN button (top right)
Wait for success message ✅
```

### Step 4: Repeat for Next Migration

```
Clear editor
Copy next migration file
Click RUN
```

---

## What Each Migration Does

### Migration 001: Core Tables ❌→✅

```
Creates:
  ✅ profiles (user accounts)
  ✅ companies (company info)
  ✅ pitches (pitch videos)
  ✅ reactions (roasts/toasts)
  ✅ feedback (detailed feedback)
  ✅ bookmarks (saved pitches)
  ✅ follows (user following)
  ✅ pitch_views (analytics)
  ✅ notifications (user notifications)

Time: ~2 seconds
```

### Migration 002: Gamification ❌→✅

```
Creates:
  ✅ user_streaks (streak tracking)
  ✅ achievements (badges)
  ✅ daily_challenges (daily prompts)
  ✅ challenge_responses (user responses)

Time: ~1 second
```

### Migration 003: Triggers & Functions ❌→✅

```
Creates:
  ✅ Automatic timestamp updates
  ✅ Count tracking (followers, pitches, etc.)
  ✅ RPC functions for API endpoints
  ✅ Profile creation on signup
  ✅ And 15+ more automation functions

Time: ~2 seconds
```

---

## Success Indicators

### After Running Migration 001:

Check **Table Editor** and see:
- profiles
- companies
- pitches
- reactions
- feedback
- bookmarks
- follows
- pitch_views
- notifications

### After Running Migration 002:

Check **Table Editor** and see:
- user_streaks
- achievements
- daily_challenges
- challenge_responses

### After Running Migration 003:

Check **SQL Editor** and run:
```sql
-- Should show 20+ triggers
SELECT * FROM information_schema.triggers
WHERE trigger_schema = 'public' ORDER BY trigger_name;

-- Should show 20+ functions
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' ORDER BY routine_name;
```

---

## Common Errors & Fixes

### "Error: Relation 'profiles' already exists"

**Cause:** Table already created, migration not idempotent

**Fix:** The migration SHOULD handle this with `IF NOT EXISTS`
- If you see this, it means the migration file wasn't using IF NOT EXISTS
- Use the migration files from `/supabase/migrations/` folder

### "Error: Permission denied for schema public"

**Cause:** Using wrong API key

**Fix:**
1. Get your **service_role** key (not anon key)
2. Use that for migrations
3. Or use Supabase Dashboard SQL Editor (easier)

### "Error: Foreign key constraint fails"

**Cause:** Tables created in wrong order

**Fix:**
1. Run migrations in order: 001 → 002 → 003
2. Don't skip migrations
3. Don't run them out of order

---

## Testing Your Setup

### Test 1: Verify Tables Exist

```sql
-- Copy into SQL Editor and Run
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Should list 13 tables
```

### Test 2: Verify RLS Enabled

```sql
-- Copy into SQL Editor and Run
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- All tables should show: true
```

### Test 3: Verify Triggers Created

```sql
-- Copy into SQL Editor and Run
SELECT trigger_name, table_name
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY trigger_name;

-- Should list 15+ triggers
```

---

## Reverting (If Something Goes Wrong)

### ⚠️ IMPORTANT: Migrations Are One-Way

Migrations add tables but don't remove them. To remove:

```sql
-- ⚠️ CAREFUL: This deletes data!
DROP TABLE IF EXISTS table_name CASCADE;

-- Only use if you really need to remove everything
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
```

**Best practice:** Never run migrations against production!

---

## Next Steps After Migrations

1. ✅ Run all 3 migrations
2. ✅ Verify tables in Table Editor
3. ✅ Set environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
   CLOUDFLARE_STREAM_API_TOKEN=your_token
   ```
4. ✅ Test API endpoints
5. ✅ Start using the app!

---

## Still Stuck?

1. **Check Supabase docs:** https://supabase.com/docs/guides/database/migrations
2. **Check error message** in Supabase dashboard
3. **Verify migrations** are run in order (001, 002, 003)
4. **Try smaller tests:** Run just one migration at a time
5. **Ask for help:** Include error message and which migration failed
