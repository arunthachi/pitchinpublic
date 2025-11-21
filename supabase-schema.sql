-- =============================================
-- Pitch in Public - Supabase Database Schema
-- =============================================
-- Run these in Supabase SQL Editor in order
-- =============================================

-- 1. PROFILES TABLE
-- Extends Supabase auth.users with additional profile info
-- =============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  username TEXT UNIQUE,
  avatar_url TEXT,
  bio TEXT,
  website TEXT,
  twitter_handle TEXT,
  linkedin_url TEXT,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  pitches_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster username lookups
CREATE INDEX idx_profiles_username ON profiles(username);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);


-- =============================================
-- 2. PITCHES TABLE
-- Main table for pitch videos
-- =============================================
CREATE TABLE pitches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Company & Pitch Info
  company_name TEXT NOT NULL,
  hook TEXT NOT NULL,
  description TEXT,
  stage TEXT NOT NULL, -- e.g., 'Pre-Seed', 'Seed', 'Series A'
  industry TEXT NOT NULL,

  -- Video Info
  video_url TEXT NOT NULL,
  video_provider TEXT DEFAULT 'cloudflare', -- 'cloudflare', 'mux', 'bunny'
  video_id TEXT, -- Provider-specific video ID
  thumbnail_url TEXT,
  duration INTEGER, -- in seconds

  -- Engagement Metrics
  views_count INTEGER DEFAULT 0,
  roast_count INTEGER DEFAULT 0,
  toast_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  interest_score INTEGER DEFAULT 0, -- Calculated score for ranking

  -- Status
  status TEXT DEFAULT 'published', -- 'draft', 'published', 'archived'
  is_featured BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX idx_pitches_user_id ON pitches(user_id);
CREATE INDEX idx_pitches_created_at ON pitches(created_at DESC);
CREATE INDEX idx_pitches_interest_score ON pitches(interest_score DESC);
CREATE INDEX idx_pitches_status ON pitches(status);
CREATE INDEX idx_pitches_industry ON pitches(industry);
CREATE INDEX idx_pitches_stage ON pitches(stage);

-- Enable RLS
ALTER TABLE pitches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pitches
CREATE POLICY "Published pitches are viewable by everyone"
  ON pitches FOR SELECT
  USING (status = 'published' OR auth.uid() = user_id);

CREATE POLICY "Users can insert their own pitches"
  ON pitches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pitches"
  ON pitches FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pitches"
  ON pitches FOR DELETE
  USING (auth.uid() = user_id);


-- =============================================
-- 3. REACTIONS TABLE
-- Roasts and Toasts (quick reactions)
-- =============================================
CREATE TABLE reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('roast', 'toast')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure one reaction per user per pitch
  UNIQUE(pitch_id, user_id)
);

-- Indexes
CREATE INDEX idx_reactions_pitch_id ON reactions(pitch_id);
CREATE INDEX idx_reactions_user_id ON reactions(user_id);
CREATE INDEX idx_reactions_type ON reactions(type);

-- Enable RLS
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Reactions are viewable by everyone"
  ON reactions FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create reactions"
  ON reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reactions"
  ON reactions FOR DELETE
  USING (auth.uid() = user_id);


-- =============================================
-- 4. FEEDBACK TABLE
-- Detailed feedback on pitches
-- =============================================
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('roast', 'toast')),

  -- Feedback Content
  content TEXT NOT NULL,
  is_public BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_feedback_pitch_id ON feedback(pitch_id);
CREATE INDEX idx_feedback_user_id ON feedback(user_id);
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);

-- Enable RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public feedback is viewable by everyone"
  ON feedback FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Authenticated users can create feedback"
  ON feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback"
  ON feedback FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feedback"
  ON feedback FOR DELETE
  USING (auth.uid() = user_id);


-- =============================================
-- 5. FOLLOWS TABLE
-- User following relationships
-- =============================================
CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent self-follows and duplicate follows
  CHECK (follower_id != following_id),
  UNIQUE(follower_id, following_id)
);

-- Indexes
CREATE INDEX idx_follows_follower_id ON follows(follower_id);
CREATE INDEX idx_follows_following_id ON follows(following_id);

-- Enable RLS
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Follows are viewable by everyone"
  ON follows FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can follow others"
  ON follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
  ON follows FOR DELETE
  USING (auth.uid() = follower_id);


-- =============================================
-- 6. VIEWS TABLE
-- Track pitch views for analytics
-- =============================================
CREATE TABLE pitch_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- NULL for anonymous views
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_pitch_views_pitch_id ON pitch_views(pitch_id);
CREATE INDEX idx_pitch_views_created_at ON pitch_views(created_at DESC);

-- Enable RLS
ALTER TABLE pitch_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can create a view"
  ON pitch_views FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Pitch owners can view their analytics"
  ON pitch_views FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM pitches WHERE id = pitch_views.pitch_id
    )
  );


-- =============================================
-- 7. NOTIFICATIONS TABLE
-- User notifications
-- =============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'roast', 'toast', 'follow', 'feedback', etc.
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);


-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pitches_updated_at
  BEFORE UPDATE ON pitches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- Function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- Function to update follower/following counts
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment follower count for the user being followed
    UPDATE profiles SET followers_count = followers_count + 1
    WHERE id = NEW.following_id;

    -- Increment following count for the follower
    UPDATE profiles SET following_count = following_count + 1
    WHERE id = NEW.follower_id;

  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement follower count
    UPDATE profiles SET followers_count = GREATEST(0, followers_count - 1)
    WHERE id = OLD.following_id;

    -- Decrement following count
    UPDATE profiles SET following_count = GREATEST(0, following_count - 1)
    WHERE id = OLD.follower_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER follow_count_trigger
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW
  EXECUTE FUNCTION update_follow_counts();


-- Function to update pitch counts
CREATE OR REPLACE FUNCTION update_pitch_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET pitches_count = pitches_count + 1
    WHERE id = NEW.user_id;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET pitches_count = GREATEST(0, pitches_count - 1)
    WHERE id = OLD.user_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pitch_count_trigger
  AFTER INSERT OR DELETE ON pitches
  FOR EACH ROW
  EXECUTE FUNCTION update_pitch_counts();


-- Function to update reaction counts on pitches
CREATE OR REPLACE FUNCTION update_reaction_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'roast' THEN
      UPDATE pitches SET roast_count = roast_count + 1
      WHERE id = NEW.pitch_id;
    ELSE
      UPDATE pitches SET toast_count = toast_count + 1
      WHERE id = NEW.pitch_id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.type = 'roast' THEN
      UPDATE pitches SET roast_count = GREATEST(0, roast_count - 1)
      WHERE id = OLD.pitch_id;
    ELSE
      UPDATE pitches SET toast_count = GREATEST(0, toast_count - 1)
      WHERE id = OLD.pitch_id;
    END IF;
  END IF;

  -- Update interest score (simple formula: toasts * 2 - roasts + views / 10)
  UPDATE pitches
  SET interest_score = (toast_count * 2) - roast_count + (views_count / 10)
  WHERE id = COALESCE(NEW.pitch_id, OLD.pitch_id);

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reaction_count_trigger
  AFTER INSERT OR DELETE ON reactions
  FOR EACH ROW
  EXECUTE FUNCTION update_reaction_counts();


-- =============================================
-- SAMPLE DATA (Optional - for testing)
-- =============================================
-- You can uncomment this after setting up auth and replace UUIDs with real user IDs

/*
INSERT INTO pitches (user_id, company_name, hook, stage, industry, video_url) VALUES
  ('your-user-id-here', 'TechFlow', 'AI-powered workflow automation for startups', 'Seed', 'SaaS', 'https://example.com/video1.mp4'),
  ('your-user-id-here', 'GreenBox', 'Sustainable packaging for e-commerce', 'Pre-Seed', 'Climate Tech', 'https://example.com/video2.mp4');
*/
