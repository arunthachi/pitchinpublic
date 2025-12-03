# PHASE 1 IMPLEMENTATION SPECIFICATION
## Mobile-First App + Gamification (Complete Technical Roadmap)

**Status:** Ready for Implementation
**Timeline:** 4 weeks
**Target Launch:** Production-ready mobile app with gamification

---

## TABLE OF CONTENTS

1. [Product Decisions Summary](#product-decisions-summary)
2. [Database Schema Design](#database-schema-design)
3. [API Endpoint Specification](#api-endpoint-specification)
4. [Component Architecture](#component-architecture)
5. [Implementation Timeline (Week-by-Week)](#implementation-timeline)
6. [Detailed File-by-File Changes](#detailed-file-by-file-changes)
7. [Data Flow Diagrams](#data-flow-diagrams)
8. [Success Metrics](#success-metrics)

---

## PRODUCT DECISIONS SUMMARY

### Final Decisions (Locked In)

| Decision | Resolution | Rationale |
|----------|-----------|-----------|
| **Streak Activation** | ANY activity (pitch OR feedback) | Daily activation > daily pitching. Maximize retention. |
| **Notifications** | Full-screen modal 1x daily + toasts | Daily habit trigger + lightweight engagement |
| **Reaction UX** | Optimistic update (instant animation) | TikTok-like speed = stickiness |
| **Video Storage** | Archive after 90 days (cold storage) | Cost control + accessibility |
| **Daily Challenges** | Required visibility, optional completion | Habit trigger without friction |
| **Badge Count** | 8 core badges for Phase 1 | Sweet spot: prestige + focus |

### Badge Set (Phase 1)

```
1. 🎬 First Pitch Posted
2. 💬 First Feedback Given
3. 🔥 5-Day Streak
4. 👍 10-Feedback Contributor
5. 🥂 Supportive Founder (Toasts > Roasts)
6. 🔥 Honest Builder (Roasts > Toasts)
7. 📈 Pitch of the Week Nominee
8. ⭐ Featured Founder (trending)
```

---

## DATABASE SCHEMA DESIGN

### New Tables for Phase 1

```sql
-- =============================================
-- GAMIFICATION: Daily Challenges
-- =============================================
CREATE TABLE daily_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL,
  category TEXT NOT NULL, -- 'explain_simple', 'market_size', 'elevator_pitch', etc.
  prompt TEXT NOT NULL,   -- "Explain like you're talking to a 10-year-old"
  difficulty TEXT,        -- 'easy', 'medium', 'hard'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_daily_challenges_date ON daily_challenges(date DESC);

-- =============================================
-- GAMIFICATION: User Streaks
-- =============================================
CREATE TABLE user_streaks (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  last_activity_type TEXT, -- 'pitch' or 'feedback'
  total_activities INTEGER DEFAULT 0,
  streak_started_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_streaks_current ON user_streaks(current_streak DESC);

-- =============================================
-- GAMIFICATION: User Achievements/Badges
-- =============================================
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL, -- 'first_pitch', 'streak_5', etc.
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

CREATE INDEX idx_achievements_user ON achievements(user_id);
CREATE INDEX idx_achievements_badge ON achievements(badge_id);

-- =============================================
-- GAMIFICATION: Challenge Responses
-- =============================================
CREATE TABLE challenge_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  daily_challenge_id UUID NOT NULL REFERENCES daily_challenges(id),
  responded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, daily_challenge_id)
);

CREATE INDEX idx_challenge_responses_user ON challenge_responses(user_id);
CREATE INDEX idx_challenge_responses_challenge ON challenge_responses(daily_challenge_id);

-- =============================================
-- USER STATS (Denormalized for Speed)
-- =============================================
ALTER TABLE profiles ADD COLUMN (
  total_pitches_posted INTEGER DEFAULT 0,
  total_feedback_given INTEGER DEFAULT 0,
  total_helpful_feedback INTEGER DEFAULT 0,
  feedback_helpful_rating DECIMAL(3,2) DEFAULT 0,
  badges_count INTEGER DEFAULT 0,
  last_streak_update TIMESTAMP WITH TIME ZONE
);

-- =============================================
-- PITCH DETAILS (Enhanced for Submissions)
-- =============================================
ALTER TABLE pitches ADD COLUMN (
  title VARCHAR(150),
  description TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  daily_challenge_id UUID REFERENCES daily_challenges(id)
);

-- =============================================
-- NOTIFICATIONS TABLE (Already exists, add status)
-- =============================================
ALTER TABLE notifications ADD COLUMN (
  action_url TEXT,
  is_viewed BOOLEAN DEFAULT false,
  notification_type TEXT -- 'achievement', 'streak', 'feedback', 'challenge', 'trending'
);
```

### Migration Notes

```sql
-- Run these ONLY if tables don't exist:
-- 1. Create daily_challenges table
-- 2. Create user_streaks table
-- 3. Create achievements table
-- 4. Create challenge_responses table
-- 5. Seed 365 daily_challenges (one per day)
-- 6. Add columns to profiles
-- 7. Add columns to pitches
-- 8. Add columns to notifications

-- Migration order: Tables first, then columns, then seed data
```

---

## API ENDPOINT SPECIFICATION

### Phase 1 API Endpoints (Complete)

#### Pitch Management

```
POST /api/pitches
├─ Purpose: Create a new pitch
├─ Auth: Required (JWT)
├─ Body: {
│   videoId: string,
│   title: string (max 150 chars),
│   description: string (max 500 chars),
│   challengeId?: string (optional)
│ }
├─ Returns: { id, createdAt, videoUrl }
└─ Status: 201 Created / 400 Bad Request / 401 Unauthorized

GET /api/pitches?limit=10&offset=0
├─ Purpose: Fetch pitches for feed
├─ Auth: Optional (user_id if authenticated)
├─ Returns: Array of pitches with engagement counts
└─ Status: 200 OK

GET /api/pitches/[pitchId]
├─ Purpose: Get single pitch details
├─ Returns: Full pitch with feedback + reactions
└─ Status: 200 OK / 404 Not Found
```

#### Reactions (Roast/Toast)

```
POST /api/pitches/[pitchId]/roast
├─ Purpose: Quick roast (tap) or leave detailed feedback (double-click)
├─ Auth: Required
├─ Body: {
│   isQuick: boolean,
│   feedbackText?: string (only if isQuick=false)
│ }
├─ Returns: { count, isOptimistic: true }
└─ Optimistic Update: Return immediately, POST async

POST /api/pitches/[pitchId]/toast
├─ Purpose: Quick toast reaction
├─ Auth: Required
├─ Body: { isQuick: boolean, feedbackText?: string }
└─ Same as roast

DELETE /api/pitches/[pitchId]/roast
├─ Purpose: Remove roast (undo)
├─ Returns: Updated count
```

#### Gamification: Streaks

```
GET /api/user/streak
├─ Purpose: Get current user's streak data
├─ Auth: Required
├─ Returns: {
│   currentStreak: number,
│   bestStreak: number,
│   lastActivityDate: date,
│   totalActivities: number
│ }

POST /api/user/streak/update
├─ Purpose: Update streak (called after pitch/feedback)
├─ Auth: Required
├─ Body: { activityType: 'pitch' | 'feedback' }
├─ Returns: {
│   streakContinued: boolean,
│   newStreak: number,
│   achievement?: { id, name, icon }
│ }
└─ Idempotent: Safe to call multiple times per day
```

#### Gamification: Achievements

```
GET /api/user/achievements
├─ Purpose: Get user's unlocked badges
├─ Auth: Required
├─ Returns: Array of badge objects {
│   id: 'first_pitch',
│   name: 'First Pitch Posted',
│   icon: '🎬',
│   unlockedAt: date
│ }

POST /api/achievements/unlock
├─ Purpose: Check and unlock achievements (internal)
├─ Auth: Internal/Server only
├─ Body: { userId, trigger: 'pitch_created' | 'feedback_given' | ... }
└─ Returns: { unlockedBadges: [], notifications: [] }
```

#### Gamification: Daily Challenge

```
GET /api/daily-challenge/today
├─ Purpose: Get today's challenge
├─ Auth: Optional
├─ Returns: {
│   id: uuid,
│   date: date,
│   prompt: "Explain like you're talking to a 10-year-old",
│   category: 'explain_simple',
│   difficulty: 'easy',
│   userCompleted: boolean (if auth)
│ }

POST /api/daily-challenge/[challengeId]/respond
├─ Purpose: Mark challenge as completed (when publishing pitch with challenge)
├─ Auth: Required
├─ Body: { pitchId: string }
├─ Returns: { completed: true, badge?: achievement }

GET /api/daily-challenge/all?month=2025-01
├─ Purpose: Get all challenges for a month
├─ Returns: Array of challenges
```

#### User Stats (Gamification Dashboard)

```
GET /api/user/stats
├─ Purpose: Get user's gamification stats
├─ Auth: Required
├─ Returns: {
│   profile: { name, avatar },
│   streaks: { current, best },
│   badges: { count, list },
│   activities: { pitches, feedback },
│   ranking: { weeklyRank, monthlyRank }
│ }

GET /api/leaderboard?period=week&type=feedback
├─ Purpose: Get top reviewers/creators
├─ Returns: Array of users ranked by activity
```

#### Notifications

```
GET /api/notifications?limit=20
├─ Purpose: Get user's notifications
├─ Auth: Required
├─ Returns: Array of notifications with type

POST /api/notifications/[notificationId]/view
├─ Purpose: Mark notification as viewed
├─ Auth: Required
```

---

## COMPONENT ARCHITECTURE

### Component Hierarchy (New & Modified)

```
src/components/
├─ RecordingStudio.tsx (ENHANCED)
│  ├─ Step1_RecordUpload
│  ├─ Step2_AddDetails (NEW)
│  │  ├─ Input: Title field
│  │  ├─ Input: Description field
│  │  └─ Card: Daily Challenge (if applicable)
│  └─ Step3_Publish (ENHANCED)
│     ├─ PostPublishModal (NEW)
│     └─ ShareOptions (NEW)
│
├─ DailyChallengeBanner.tsx (NEW)
│  ├─ Shows today's challenge at top of feed
│  ├─ "Use Challenge" / "Skip" buttons
│  └─ Visual: Card with difficulty indicator
│
├─ GamificationStats.tsx (NEW)
│  ├─ User stats sidebar/widget
│  ├─ Displays: Pitches, Feedback, Streak, Rank
│  └─ Collapsible for mobile
│
├─ AchievementUnlock.tsx (NEW)
│  ├─ Full-screen celebration modal
│  ├─ Shows badge + confetti animation
│  └─ Auto-dismiss after 3 seconds
│
├─ FloatingReactions.tsx (MODIFIED)
│  ├─ Already has roast/toast/bookmark/share
│  ├─ ADD: Optimistic update logic
│  ├─ ADD: Streak notification trigger
│  └─ ADD: Achievement check after feedback
│
├─ StreakNotification.tsx (NEW)
│  ├─ Toast notification for streak milestones
│  ├─ "Your streak ends in 12 hours!"
│  └─ "🔥 7-day streak achieved!"
│
├─ TopNavBar.tsx (MODIFIED)
│  └─ ADD: Daily challenge banner if available
│
└─ BottomNavBar.tsx (MODIFIED)
   └─ ADD: Streak counter display
```

### New Context/Provider

```
src/contexts/
└─ GamificationContext.tsx (NEW)
   ├─ Manages: user streaks, badges, stats
   ├─ Provides: checkStreak(), unlockAchievement(), getStats()
   ├─ Caches: Fetch once per session, update on action
   └─ Subscribes: To pitch/feedback events
```

### New Utilities

```
src/lib/
├─ gamification.ts (NEW - Core logic)
│  ├─ updateUserStreak(userId, activityType)
│  ├─ checkAchievementUnlock(userId, trigger)
│  ├─ getDailyChallenge(date)
│  ├─ calculateUserRank(userId)
│  ├─ BADGE_DEFINITIONS constant
│  └─ ACHIEVEMENT_TRIGGERS object
│
├─ notifications.ts (NEW)
│  ├─ showAchievementUnlock()
│  ├─ showStreakWarning()
│  ├─ showNewChallenge()
│  └─ queue notification system
│
└─ share.ts (ENHANCED)
   ├─ generateShareText(pitch, challenge?)
   ├─ shareToX(text, link)
   ├─ shareViaEmail(recipients, link)
   └─ copyToClipboard(link)
```

---

## IMPLEMENTATION TIMELINE (Week-by-Week)

### WEEK 1: Submission Flow Foundation

**Goal:** Make pitches persist end-to-end

#### Tasks (Estimated 40 hours):

**Day 1-2: Submission API & Database (8 hours)**
- [ ] Create POST /api/pitches endpoint
  - Validate: videoId, title, description
  - Save to pitches table
  - Return pitch with engagement counts
- [ ] Test with Insomnia/Postman
- [ ] Add error handling & validation

**Day 2-3: RecordingStudio Enhancement (10 hours)**
- [ ] Add Step2_AddDetails component
  - Title input (max 150 chars, live counter)
  - Description input (max 500 chars, live counter)
- [ ] Add Step3_Publish component
  - Show pitch preview
  - Loading state during submission
  - Success screen with pitch ID
- [ ] Wire up POST /api/pitches from form
- [ ] Handle errors gracefully

**Day 3-4: Data Migration (6 hours)**
- [ ] Update src/app/page.tsx
  - Replace mock getLegacyPitches() with real API call
  - GET /api/pitches?limit=10&offset=0
  - Handle loading state
  - Handle empty state
- [ ] Test feed loads real pitches
- [ ] Add infinite scroll pagination

**Day 4-5: Share & Distribution (8 hours)**
- [ ] Create PostPublishModal component
  - Show pitch stats
  - Share to X button (prefilled text)
  - Copy link button
  - Email invite option
- [ ] Implement share functions
- [ ] Test on mobile (actual device)

**Day 5: QA & Polish (8 hours)**
- [ ] Test end-to-end: Record → Submit → See in Feed
- [ ] Mobile testing on various devices
- [ ] Error scenarios: failed upload, network error
- [ ] Performance: optimize image loading

**Deliverable:** Users can submit pitches and see them immediately in feed

---

### WEEK 2: Reactions & Persistence

**Goal:** Make roasts/toasts actually save + optimize UX

#### Tasks (Estimated 40 hours):

**Day 1-2: Roast/Toast API (10 hours)**
- [ ] Create POST /api/pitches/[pitchId]/roast
  - Accept: isQuick boolean, feedbackText?
  - Save to reactions table OR feedback table
  - Return: count, timestamp
- [ ] Create POST /api/pitches/[pitchId]/toast (same structure)
- [ ] Add DELETE /api/pitches/[pitchId]/roast (undo)
- [ ] Update reactions counters with triggers

**Day 2-3: Optimistic UI in FloatingReactions (8 hours)**
- [ ] Implement optimistic update:
  - Tap button → immediately increment counter
  - Trigger animation
  - POST in background
  - If error: show toast "Couldn't save, try again"
- [ ] Add retry logic
- [ ] Prevent double-counting

**Day 3-4: Feedback Form Integration (12 hours)**
- [ ] Wire QuickFeedbackPanel to POST endpoint
  - GET form data (emoji scores + notes)
  - POST to /api/pitches/[pitchId]/roast or toast
  - Show loading state
  - Handle errors
  - Close on success
- [ ] Store scores to database (not just notes)
- [ ] Update feedback display on pitch detail page

**Day 4: Real-time Updates (6 hours)**
- [ ] Update counters when feedback arrives
  - useEffect polling OR WebSocket (if needed)
  - Refresh roast/toast counts every 5 seconds
- [ ] Test simultaneous reactions from multiple users

**Day 5: QA & Mobile Polish (4 hours)**
- [ ] Test roasting on mobile
- [ ] Test toasting on mobile
- [ ] Verify counters update
- [ ] Check performance (animations smooth)

**Deliverable:** Roasts/toasts save to database, counters update in real-time

---

### WEEK 3: Gamification System (Streaks, Badges, Challenges)

**Goal:** Implement full gamification loop

#### Tasks (Estimated 45 hours):

**Day 1: Daily Challenges Foundation (10 hours)**
- [ ] Seed daily_challenges table with 365 prompts
  - One prompt per day for a year
  - Categories: 'explain_simple', 'market_size', 'elevator_pitch', etc.
  - Difficulty levels
- [ ] Create GET /api/daily-challenge/today endpoint
- [ ] Create DailyChallengeBanner component
  - Show today's challenge
  - Show difficulty indicator
  - "Use Challenge" button (links to RecordingStudio with challengeId)
  - "Skip" button
- [ ] Wire to top of feed

**Day 2: Streak System (12 hours)**
- [ ] Create user_streaks table schema
- [ ] Implement POST /api/user/streak/update
  - Called after pitch OR feedback
  - Check last_activity_date
  - Calculate current_streak
  - If yesterday: increment. If older: reset to 1.
  - Return: streakData + achievement unlock?
- [ ] Implement GET /api/user/streak
- [ ] Add GamificationStats component
  - Display: currentStreak, bestStreak, totalActivities
  - Show visual: "🔥 7 days"
- [ ] Call streak update after every interaction

**Day 3: Achievement System (15 hours)**
- [ ] Create achievements table schema
- [ ] Implement POST /api/achievements/unlock
  - Check 8 badge triggers:
    1. First pitch (count === 1)
    2. First feedback (count === 1)
    3. Streak === 5
    4. Feedback count === 10
    5. Toast count > Roast count
    6. Roast count > Toast count
    7. Pitch trending (views > threshold)
    8. Featured (editor picked)
  - Insert to achievements table
  - Return: { unlockedBadges: [], newNotifications: [] }
- [ ] Create AchievementUnlock component
  - Full-screen modal: badge name + icon + confetti
  - Auto-dismiss after 3 seconds
  - Trigger on mount when achievement unlocked
- [ ] Implement GET /api/user/achievements
- [ ] Add badges to GamificationStats

**Day 4: Notifications (6 hours)**
- [ ] Implement toast notifications for:
  - Achievement unlocked
  - Streak milestone (7, 14, 30 days)
  - Streak warning ("ends in 12 hours")
  - New feedback received
- [ ] Create StreakNotification component
- [ ] Wire to GamificationContext

**Day 5: Integration & Testing (2 hours)**
- [ ] Test end-to-end: Post pitch → Unlock "First Pitch" badge
- [ ] Test: Give feedback → Unlock "First Feedback" badge
- [ ] Test: Maintain streak for 5 days → Unlock badge
- [ ] Test achievement celebration animation

**Deliverable:** Streaks tracked, badges unlock, notifications show

---

### WEEK 4: Polish, Distribution, Launch

**Goal:** Production-ready, all features integrated, optimized

#### Tasks (Estimated 35 hours):

**Day 1-2: Enhancement & Optimization (14 hours)**
- [ ] Profile page shows badges & stats
- [ ] Leaderboard: top creators, top reviewers
- [ ] Challenge response tracking
- [ ] Video archival logic (soft delete after 90 days)
- [ ] Performance optimization:
  - Lazy load images
  - Cache API responses
  - Optimize bundle size
  - Fast mobile load (<2s)

**Day 2-3: Comprehensive Testing (12 hours)**
- [ ] Manual testing on 3+ mobile devices
  - iOS Safari
  - Android Chrome
  - Slow 3G network
- [ ] Test all user flows:
  - Record pitch
  - Submit with challenge
  - Roast another pitch
  - Check badge unlocked
  - Share to X
- [ ] Test error scenarios:
  - Network timeout
  - Upload failure
  - Invalid input
  - Session expiration

**Day 3-4: Bug Fixes & QA (6 hours)**
- [ ] Fix any issues from testing
- [ ] Verify mobile UX is smooth
- [ ] Check accessibility (keyboard nav, contrast)
- [ ] Final performance audit

**Day 4-5: Launch Prep (3 hours)**
- [ ] Create launch announcement
- [ ] Prepare beta user guide
- [ ] Set up monitoring/analytics
- [ ] Document known issues (if any)

**Deliverable:** Production-ready Phase 1, all gamification active

---

## DETAILED FILE-BY-FILE CHANGES

### Files to Create (15 new files)

```
NEW COMPONENTS:
├─ src/components/Step2_AddDetails.tsx (200 lines)
├─ src/components/Step3_Publish.tsx (300 lines)
├─ src/components/PostPublishModal.tsx (250 lines)
├─ src/components/DailyChallengeBanner.tsx (180 lines)
├─ src/components/GamificationStats.tsx (220 lines)
├─ src/components/AchievementUnlock.tsx (150 lines)
├─ src/components/StreakNotification.tsx (100 lines)

NEW CONTEXT:
├─ src/contexts/GamificationContext.tsx (280 lines)

NEW UTILITIES:
├─ src/lib/gamification.ts (400 lines)
├─ src/lib/notifications.ts (200 lines)
├─ src/lib/share.ts (180 lines)

NEW TYPES:
├─ src/types/gamification.ts (150 lines)

NEW API ROUTES:
├─ src/app/api/pitches/route.ts (create POST endpoint)
├─ src/app/api/user/streak/route.ts
├─ src/app/api/achievements/route.ts
├─ src/app/api/daily-challenge/route.ts
```

### Files to Modify (8 existing files)

```
ENHANCED:
├─ src/components/RecordingStudio.tsx
│  ├─ Add Step2_AddDetails (title + description fields)
│  ├─ Add Step3_Publish (success screen)
│  ├─ Wire form submission to POST /api/pitches
│  └─ Handle publishing state

├─ src/components/FloatingReactions.tsx
│  ├─ Add optimistic update logic
│  ├─ Add streak update trigger
│  ├─ Add achievement check after action
│  └─ Better error handling

├─ src/app/page.tsx (feed)
│  ├─ Replace mock data with GET /api/pitches
│  ├─ Add DailyChallengeBanner at top
│  ├─ Add GamificationStats sidebar
│  └─ Add infinite scroll pagination

├─ src/app/layout.tsx
│  ├─ Wrap with GamificationProvider
│  └─ Add NotificationQueue component

├─ src/contexts/AuthContext.tsx
│  ├─ Add gamification data to user context
│  └─ Preload streak/badges on login

├─ src/types/index.ts
│  ├─ Add types for gamification
│  ├─ Update Pitch type (add title, description, challengeId)
│  └─ Add Achievement, Streak types

├─ supabase-schema.sql (MIGRATIONS)
│  ├─ Create daily_challenges table
│  ├─ Create user_streaks table
│  ├─ Create achievements table
│  ├─ Create challenge_responses table
│  └─ Add columns to profiles, pitches, notifications

└─ package.json
   └─ Add dependencies if needed (none required for Phase 1)
```

---

## DATA FLOW DIAGRAMS

### Flow 1: Pitch Submission + Gamification Trigger

```
USER RECORDS VIDEO
        ↓
[RecordingStudio Step 1]
        ↓
USER ADDS TITLE + DESCRIPTION
        ↓
[RecordingStudio Step 2]
        ↓
USER TAPS "PUBLISH"
        ↓
POST /api/pitches {videoId, title, description, challengeId?}
        ↓
Backend:
├─ Save pitch to DB
├─ Call checkAchievementUnlock(userId, 'pitch_created')
│  └─ If first pitch: INSERT into achievements
├─ Call updateUserStreak(userId, 'pitch')
│  └─ Increment/reset streak
├─ Call checkDailyChallenge(pitchId, challengeId)
│  └─ If challenge: INSERT into challenge_responses
└─ Return: {pitchId, createdAt}
        ↓
[RecordingStudio Step 3 - Success Screen]
        ↓
Show stats:
├─ Views: 0
├─ Roasts: 0
├─ Toasts: 0
├─ Your streak: 🔥 3 days
├─ New badge unlocked?: [AchievementUnlock modal]
        ↓
Offer SHARE OPTIONS:
├─ [Share on X]
├─ [Email invite]
├─ [Copy link]
└─ [Back to Feed]
```

### Flow 2: Roasting + Streak Update

```
USER TAPS ROAST BUTTON
        ↓
FloatingReactions.handleRoastClick()
        ├─ IMMEDIATE (Optimistic):
        │  ├─ Increment roastCount state
        │  ├─ Play animation
        │  ├─ setJustRoasted(true)
        │  └─ Show updated counter
        │
        └─ BACKGROUND (Async):
           ├─ POST /api/pitches/[pitchId]/roast {isQuick: true}
           │  └─ Save to reactions table
           │
           └─ POST /api/user/streak/update {activityType: 'feedback'}
              ├─ Update user_streaks
              ├─ Check achievement unlock (Honest Builder?, etc.)
              └─ Check streak milestone (send notification?)
```

### Flow 3: Achievement Unlock + Celebration

```
Achievement Condition Met
(e.g., user gives 10th feedback)
        ↓
Backend POST /api/achievements/unlock
├─ Check eligibility
├─ INSERT into achievements table
└─ Return: {unlockedBadges: [{id, name, icon}]}
        ↓
Frontend GamificationContext updates
├─ Receive achievement data
├─ Trigger AchievementUnlock component
└─ Emit notification
        ↓
[AchievementUnlock Modal]
├─ Show badge icon (🎬, 🥂, 🔥, etc.)
├─ Show badge name
├─ Play confetti animation
└─ Auto-dismiss after 3 seconds
        ↓
[StreakNotification Toast]
├─ "Congratulations! You earned 'First Feedback'"
└─ Slide in from bottom, fade out
        ↓
GamificationStats updates
└─ Badges count increments
```

---

## SUCCESS METRICS (KPIs to Track)

### Week 1 Metrics (Submissions)
```
- Pitches submitted per day (target: 5+)
- Average submission time (target: < 45 seconds)
- Error rate on submission (target: < 2%)
- Abandonment rate Step 2→3 (target: < 10%)
```

### Week 2 Metrics (Reactions)
```
- Roasts given per pitch (target: 2+)
- Toasts given per pitch (target: 2+)
- Feedback submission rate (target: 10% of viewers)
- Reaction error rate (target: < 1%)
```

### Week 3 Metrics (Gamification)
```
- % of users with active streak (target: 40%+)
- Average streak length (target: 5+ days)
- Badges unlocked per user (target: 2+ average)
- Daily challenge completion (target: 20%+)
- Challenge → Pitch conversion (target: 15%+)
```

### Week 4 Metrics (Overall)
```
- Daily Active Users (target: 50% of signups)
- Daily Pitches (target: 2+ per active user)
- Daily Feedback (target: 5+ per active user)
- Return visit rate (Day 7: target 25%)
- Return visit rate (Day 30: target 10%)
- Share clicks (target: 35% of new pitches)
```

---

## QUESTIONS & CLARIFICATIONS

Before implementing, confirm:

### 1. Video Processing

**Q:** Do videos need to be transcoded immediately, or can we do that async?
- A: Recommend async (user doesn't wait for transcoding)
- Files: `/src/app/api/videos/upload-url/route.ts` already handles this

### 2. Real-time vs Polling

**Q:** Should reactions update real-time or poll every N seconds?
- A: Start with 5-second polling (simpler)
- Upgrade to WebSocket later if needed

### 3. Database: Scores Storage

**Q:** Should emoji feedback (😵😕😐🙂😍) be stored as:
- Option A: Integer 1-5 in database
- Option B: Store emoji directly
- A: Recommend integer 1-5 (map 😵=1, 😕=2, etc. on display)

### 4. Notifications: Push vs In-App

**Q:** Should notifications send push (browser) or just in-app?
- A: Start with in-app only
- Add push notifications in Phase 2

### 5. Archive after 90 Days

**Q:** How to handle playback of archived videos?
- A: Still playable (redirect to cold storage)
- Show "Archived" badge
- 1-click restore to hot storage

---

## IMPLEMENTATION CHECKLIST

Use this to track progress:

**WEEK 1:**
- [ ] POST /api/pitches endpoint (create pitch)
- [ ] GET /api/pitches (list feed)
- [ ] Step2_AddDetails component (title/description)
- [ ] Step3_Publish component (success)
- [ ] PostPublishModal with share buttons
- [ ] Update page.tsx to use real API
- [ ] End-to-end test: Record → Submit → View

**WEEK 2:**
- [ ] POST /api/pitches/[pitchId]/roast endpoint
- [ ] POST /api/pitches/[pitchId]/toast endpoint
- [ ] Optimistic updates in FloatingReactions
- [ ] Feedback form integration
- [ ] Real-time counter updates
- [ ] Mobile testing

**WEEK 3:**
- [ ] Seed daily_challenges table
- [ ] DailyChallengeBanner component
- [ ] POST /api/user/streak/update endpoint
- [ ] GET /api/user/streak endpoint
- [ ] GamificationStats component
- [ ] achievements table + unlock logic
- [ ] AchievementUnlock component
- [ ] Badge display on profile

**WEEK 4:**
- [ ] Leaderboard page
- [ ] Profile page with badges
- [ ] Performance optimization
- [ ] Mobile QA on real devices
- [ ] Bug fixes
- [ ] Launch prep

---

## NEXT STEPS

1. **Review this specification** - Confirm all technical decisions
2. **Set up database** - Run SQL migrations from schema
3. **Start Week 1** - Begin with pitch submission flow
4. **Daily standups** - Track progress against checklist
5. **Weekly reviews** - Assess metrics and adjust

---

**Document Version:** 1.0
**Last Updated:** December 3, 2025
**Status:** Ready for Implementation

**Ready to build Phase 1?** Let's go. 🚀
