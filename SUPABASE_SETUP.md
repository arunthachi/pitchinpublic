# Supabase Database Setup Guide

This guide explains how to set up your Supabase database for Pitch in Public.

## 📋 Quick Setup

1. **Create a Supabase Project**
   - Go to [https://app.supabase.com](https://app.supabase.com)
   - Click "New Project"
   - Fill in project details

2. **Run the Schema**
   - Go to SQL Editor in Supabase Dashboard
   - Copy the entire contents of `supabase-schema.sql`
   - Paste and click "Run"

3. **Enable Authentication Providers**
   - Go to Authentication > Providers
   - Enable Phone provider for SMS OTP sign in
   - Enable Google OAuth for desktop sign in
   - Enable LinkedIn OIDC for professional founder identity
   - Keep X/Twitter as an optional profile field or later account-linking provider, not the primary signup path

4. **Add Environment Variables**
   - Copy `.env.example` to `.env.local`
   - Add your Supabase URL and Anon Key from Project Settings > API

---

## 🗃️ Database Tables Overview

### 1. **profiles** - User Profiles
Extends Supabase auth with additional user information.

**Fields:**
- `id` - Links to auth.users
- `email`, `full_name`, `username`
- `avatar_url`, `bio`, `website`
- `twitter_handle`, `linkedin_url`
- `followers_count`, `following_count`, `pitches_count`

**Auto-created:** When user signs up via trigger

---

### 2. **pitches** - Main Content Table
Stores all pitch videos and metadata.

**Fields:**
- Company info: `company_name`, `hook`, `description`
- Stage: `stage` (Pre-Seed, Seed, Series A, etc.)
- Industry: `industry` (SaaS, FinTech, etc.)
- Video: `video_url`, `video_provider`, `video_id`, `thumbnail_url`, `duration`
- Metrics: `views_count`, `roast_count`, `toast_count`, `interest_score`
- Status: `status` (draft, published, archived)

**Indexes:** Optimized for queries by user, date, score, industry, stage

---

### 3. **reactions** - Roasts & Toasts
Quick reactions (like/dislike equivalent).

**Fields:**
- `pitch_id`, `user_id`, `type` (roast/toast)
- **Constraint:** One reaction per user per pitch

**Auto-updates:** Reaction counts on pitches via trigger

---

### 4. **feedback** - Detailed Comments
Long-form feedback on pitches.

**Fields:**
- `pitch_id`, `user_id`, `type` (roast/toast)
- `content` - The feedback text
- `is_public` - Public or private feedback

**Privacy:** Can be public or private (founder-only)

---

### 5. **follows** - User Connections
Who follows whom.

**Fields:**
- `follower_id`, `following_id`
- **Constraint:** Cannot follow yourself, no duplicates

**Auto-updates:** Follower/following counts on profiles

---

### 6. **pitch_views** - Analytics
Track video views for analytics.

**Fields:**
- `pitch_id`, `user_id` (nullable for anonymous)
- `ip_address`, `user_agent`
- Timestamp

**Privacy:** Only pitch owner can view their analytics

---

### 7. **notifications** - User Alerts
System notifications.

**Fields:**
- `user_id`, `type`, `title`, `message`, `link`
- `is_read` - Read/unread status

**Types:** roast, toast, follow, feedback, etc.

---

## 🔒 Row Level Security (RLS)

All tables have RLS enabled with policies:

### profiles
- ✅ Everyone can view public profiles
- ✅ Users can update their own profile

### pitches
- ✅ Everyone can view published pitches
- ✅ Users can CRUD their own pitches
- ✅ Users can view their own drafts

### reactions
- ✅ Everyone can view reactions
- ✅ Authenticated users can create/delete their reactions

### feedback
- ✅ Everyone can view public feedback
- ✅ Authenticated users can create feedback
- ✅ Users can update/delete their own feedback

### follows
- ✅ Everyone can view follows
- ✅ Authenticated users can follow/unfollow

### pitch_views
- ✅ Anyone can record a view
- ✅ Only pitch owner can see view analytics

### notifications
- ✅ Users can only see/update their own notifications

---

## ⚙️ Automatic Features

### Triggers & Functions

1. **Auto-create profile on signup**
   - When user signs up, profile is auto-created
   - Pulls name and avatar from OAuth providers when available
   - Phone OTP users can complete profile details after first login

2. **Update timestamps**
   - `updated_at` auto-updates on any record change

3. **Auto-update counts**
   - Follower/following counts update when users follow
   - Pitch counts update when pitches created/deleted
   - Reaction counts (roast/toast) update on pitches
   - Interest score auto-calculates: `(toasts * 2) - roasts + (views / 10)`

---

## 🔍 Useful Queries

### Get user's pitches
```sql
SELECT * FROM pitches
WHERE user_id = 'user-id'
ORDER BY created_at DESC;
```

### Get pitch with reactions
```sql
SELECT
  p.*,
  COUNT(CASE WHEN r.type = 'roast' THEN 1 END) as roasts,
  COUNT(CASE WHEN r.type = 'toast' THEN 1 END) as toasts
FROM pitches p
LEFT JOIN reactions r ON p.id = r.pitch_id
WHERE p.id = 'pitch-id'
GROUP BY p.id;
```

### Get trending pitches
```sql
SELECT * FROM pitches
WHERE status = 'published'
ORDER BY interest_score DESC
LIMIT 20;
```

### Get user's feed (from followed users)
```sql
SELECT p.* FROM pitches p
INNER JOIN follows f ON p.user_id = f.following_id
WHERE f.follower_id = 'user-id'
AND p.status = 'published'
ORDER BY p.created_at DESC;
```

---

## 🚀 Next Steps

After running the schema:

1. **Test Authentication**
   - Sign up with Google/GitHub/Email
   - Verify profile is auto-created

2. **Create Sample Data**
   - Create a pitch via the app
   - Test reactions, feedback, follows

3. **Set up Storage** (for video uploads)
   - Go to Storage in Supabase
   - Create a bucket named `pitch-videos`
   - Set appropriate permissions

4. **Configure Email Templates** (optional)
   - Go to Authentication > Email Templates
   - Customize magic link email

---

## 📝 Migration Tips

- Run schema in SQL Editor in order (top to bottom)
- Check for any errors after each section
- Verify RLS policies are enabled
- Test with real user accounts

## 🐛 Troubleshooting

**Profile not created on signup?**
- Check trigger: `on_auth_user_created`
- Verify it's enabled

**RLS blocking queries?**
- Check policies match your auth setup
- Use Supabase SQL logs to debug

**Counts not updating?**
- Check triggers are enabled
- Verify foreign key relationships

---

## 📚 Learn More

- [Supabase Docs](https://supabase.com/docs)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Database Functions](https://supabase.com/docs/guides/database/functions)
