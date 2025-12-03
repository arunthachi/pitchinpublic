-- Migration 002: Add Gamification Tables (Idempotent)
-- Adds streak tracking, achievements, and daily challenges
-- Safe to run multiple times - will skip existing tables

-- =============================================
-- 10. USER_STREAKS TABLE (Phase 1 Week 3)
-- =============================================
CREATE TABLE IF NOT EXISTS user_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  last_activity_type TEXT,
  total_activities INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON user_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_streaks_current_streak ON user_streaks(current_streak DESC);
CREATE INDEX IF NOT EXISTS idx_user_streaks_best_streak ON user_streaks(best_streak DESC);

ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "User streaks are viewable by everyone"
  ON user_streaks FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Users can update their own streaks"
  ON user_streaks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own streak record"
  ON user_streaks FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- =============================================
-- 11. ACHIEVEMENTS TABLE (Phase 1 Week 3)
-- =============================================
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL,
  badge_name TEXT NOT NULL,
  badge_description TEXT,
  badge_icon TEXT,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_achievements_user_id ON achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_achievements_badge_id ON achievements(badge_id);
CREATE INDEX IF NOT EXISTS idx_achievements_unlocked_at ON achievements(unlocked_at DESC);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Achievements are viewable by everyone"
  ON achievements FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Authenticated users can create achievements"
  ON achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- =============================================
-- 12. DAILY_CHALLENGES TABLE (Phase 1 Week 3)
-- =============================================
CREATE TABLE IF NOT EXISTS daily_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT DEFAULT 'medium',
  challenge_date DATE NOT NULL UNIQUE,
  response_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_challenges_challenge_date ON daily_challenges(challenge_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_challenges_category ON daily_challenges(category);
CREATE INDEX IF NOT EXISTS idx_daily_challenges_created_at ON daily_challenges(created_at DESC);

ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Daily challenges are viewable by everyone"
  ON daily_challenges FOR SELECT
  USING (true);


-- =============================================
-- 13. CHALLENGE_RESPONSES TABLE (Phase 1 Week 3)
-- =============================================
CREATE TABLE IF NOT EXISTS challenge_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES daily_challenges(id) ON DELETE CASCADE,
  response TEXT NOT NULL,
  pitch_id UUID REFERENCES pitches(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, challenge_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_responses_user_id ON challenge_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_responses_challenge_id ON challenge_responses(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_responses_created_at ON challenge_responses(created_at DESC);

ALTER TABLE challenge_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Responses are viewable by everyone"
  ON challenge_responses FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Authenticated users can create responses"
  ON challenge_responses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own responses"
  ON challenge_responses FOR DELETE
  USING (auth.uid() = user_id);
