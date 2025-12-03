-- =============================================
-- Phase 1 Gamification Tables
-- Required for Weeks 3-4: Streaks, Achievements, Daily Challenges
-- =============================================
-- Run these in Supabase SQL Editor after the main schema

-- =============================================
-- 1. USER_STREAKS TABLE
-- Track user's daily activity streaks
-- =============================================
CREATE TABLE user_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,

  -- Streak tracking
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,

  -- Activity tracking
  last_activity_date DATE,
  last_activity_type TEXT, -- 'pitch', 'roast', 'toast', 'feedback', 'challenge'
  total_activities INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_user_streaks_user_id ON user_streaks(user_id);
CREATE INDEX idx_user_streaks_current_streak ON user_streaks(current_streak DESC);
CREATE INDEX idx_user_streaks_best_streak ON user_streaks(best_streak DESC);

-- Enable RLS
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "User streaks are viewable by everyone"
  ON user_streaks FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own streaks"
  ON user_streaks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own streak record"
  ON user_streaks FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- =============================================
-- 2. ACHIEVEMENTS TABLE
-- Track which badges/achievements user has unlocked
-- =============================================
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL, -- 'first_pitch', 'five_pitches', 'ten_pitches', 'five_day_streak', 'ten_day_streak', 'fifty_roasts', 'fifty_toasts', 'feedback_expert'

  -- Badge metadata
  badge_name TEXT NOT NULL,
  badge_description TEXT,
  badge_icon TEXT, -- Emoji icon

  -- Timestamps
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicate unlocks
  UNIQUE(user_id, badge_id)
);

-- Indexes for performance
CREATE INDEX idx_achievements_user_id ON achievements(user_id);
CREATE INDEX idx_achievements_badge_id ON achievements(badge_id);
CREATE INDEX idx_achievements_unlocked_at ON achievements(unlocked_at DESC);

-- Enable RLS
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Achievements are viewable by everyone"
  ON achievements FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create achievements"
  ON achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- =============================================
-- 3. DAILY_CHALLENGES TABLE
-- Daily challenge prompts that rotate each day
-- =============================================
CREATE TABLE daily_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Challenge content
  prompt TEXT NOT NULL,
  category TEXT NOT NULL, -- 'Product', 'Market', 'Traction', 'Vision'
  difficulty TEXT DEFAULT 'medium', -- 'easy', 'medium', 'hard'

  -- Date tracking (one challenge per day)
  challenge_date DATE NOT NULL UNIQUE,

  -- Aggregate metrics
  response_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_daily_challenges_challenge_date ON daily_challenges(challenge_date DESC);
CREATE INDEX idx_daily_challenges_category ON daily_challenges(category);
CREATE INDEX idx_daily_challenges_created_at ON daily_challenges(created_at DESC);

-- Enable RLS
ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Daily challenges are viewable by everyone"
  ON daily_challenges FOR SELECT
  USING (true);


-- =============================================
-- 4. CHALLENGE_RESPONSES TABLE
-- Track user responses to daily challenges
-- =============================================
CREATE TABLE challenge_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES daily_challenges(id) ON DELETE CASCADE,

  -- Response content
  response TEXT NOT NULL,
  pitch_id UUID REFERENCES pitches(id) ON DELETE SET NULL, -- Optional: link to a pitch

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- One response per user per challenge (per day)
  UNIQUE(user_id, challenge_id)
);

-- Indexes
CREATE INDEX idx_challenge_responses_user_id ON challenge_responses(user_id);
CREATE INDEX idx_challenge_responses_challenge_id ON challenge_responses(challenge_id);
CREATE INDEX idx_challenge_responses_created_at ON challenge_responses(created_at DESC);

-- Enable RLS
ALTER TABLE challenge_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Responses are viewable by everyone"
  ON challenge_responses FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create responses"
  ON challenge_responses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own responses"
  ON challenge_responses FOR DELETE
  USING (auth.uid() = user_id);


-- =============================================
-- TRIGGERS FOR GAMIFICATION TABLES
-- =============================================

-- Function to update user_streaks updated_at
CREATE OR REPLACE FUNCTION update_user_streaks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_streaks_updated_at
  BEFORE UPDATE ON user_streaks
  FOR EACH ROW
  EXECUTE FUNCTION update_user_streaks_updated_at();


-- Function to update daily_challenges updated_at
CREATE OR REPLACE FUNCTION update_daily_challenges_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_challenges_updated_at
  BEFORE UPDATE ON daily_challenges
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_challenges_updated_at();


-- Function to update challenge response count
CREATE OR REPLACE FUNCTION update_challenge_response_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE daily_challenges SET response_count = response_count + 1
    WHERE id = NEW.challenge_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE daily_challenges SET response_count = GREATEST(0, response_count - 1)
    WHERE id = OLD.challenge_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER challenge_response_count_trigger
  AFTER INSERT OR DELETE ON challenge_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_challenge_response_count();


-- =============================================
-- RPC FUNCTIONS FOR STREAK UPDATES
-- =============================================

-- Function to increment user pitches count (called from pitch creation)
CREATE OR REPLACE FUNCTION increment_user_pitches_count(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE profiles SET pitches_count = pitches_count + 1
  WHERE id = user_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
