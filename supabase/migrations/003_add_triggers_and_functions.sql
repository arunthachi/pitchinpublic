-- Migration 003: Add Triggers and Functions (Idempotent)
-- Creates all database triggers and RPC functions
-- Safe to run multiple times - uses DROP IF EXISTS before CREATE

-- =============================================
-- UTILITY FUNCTIONS & TRIGGERS
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
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pitches_updated_at ON pitches;
CREATE TRIGGER update_pitches_updated_at
  BEFORE UPDATE ON pitches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_feedback_updated_at ON feedback;
CREATE TRIGGER update_feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- =============================================
-- AUTHENTICATION & PROFILE SETUP
-- =============================================

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
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- =============================================
-- COMPANY SLUG GENERATION
-- =============================================

-- Function to generate slug from company name
CREATE OR REPLACE FUNCTION generate_slug(company_name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(regexp_replace(company_name, '[^a-zA-Z0-9]+', '-', 'g'));
END;
$$ LANGUAGE plpgsql;

-- Function to auto-generate slug for companies
CREATE OR REPLACE FUNCTION auto_generate_company_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_slug(NEW.name);

    -- Handle duplicates by appending random string
    WHILE EXISTS (SELECT 1 FROM companies WHERE slug = NEW.slug AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)) LOOP
      NEW.slug := generate_slug(NEW.name) || '-' || substr(md5(random()::text), 1, 6);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS company_slug_trigger ON companies;
CREATE TRIGGER company_slug_trigger
  BEFORE INSERT OR UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_company_slug();


-- =============================================
-- FOLLOWER/FOLLOWING COUNT UPDATES
-- =============================================

-- Function to update follower/following counts
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET followers_count = followers_count + 1
    WHERE id = NEW.following_id;

    UPDATE profiles SET following_count = following_count + 1
    WHERE id = NEW.follower_id;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET followers_count = GREATEST(0, followers_count - 1)
    WHERE id = OLD.following_id;

    UPDATE profiles SET following_count = GREATEST(0, following_count - 1)
    WHERE id = OLD.follower_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS follow_count_trigger ON follows;
CREATE TRIGGER follow_count_trigger
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW
  EXECUTE FUNCTION update_follow_counts();


-- =============================================
-- COMPANY COUNT UPDATES
-- =============================================

-- Function to update company counts on profiles
CREATE OR REPLACE FUNCTION update_profile_company_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET companies_count = companies_count + 1
    WHERE id = NEW.founder_id;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET companies_count = GREATEST(0, companies_count - 1)
    WHERE id = OLD.founder_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profile_company_count_trigger ON companies;
CREATE TRIGGER profile_company_count_trigger
  AFTER INSERT OR DELETE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_company_counts();


-- =============================================
-- PITCH COUNT UPDATES
-- =============================================

-- Function to update pitch counts
CREATE OR REPLACE FUNCTION update_pitch_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET pitches_count = pitches_count + 1
    WHERE id = NEW.user_id;

    UPDATE companies SET pitches_count = pitches_count + 1
    WHERE id = NEW.company_id;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET pitches_count = GREATEST(0, pitches_count - 1)
    WHERE id = OLD.user_id;

    UPDATE companies SET pitches_count = GREATEST(0, pitches_count - 1)
    WHERE id = OLD.company_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pitch_count_trigger ON pitches;
CREATE TRIGGER pitch_count_trigger
  AFTER INSERT OR DELETE ON pitches
  FOR EACH ROW
  EXECUTE FUNCTION update_pitch_counts();


-- =============================================
-- REACTION COUNT UPDATES
-- =============================================

-- Function to update reaction counts on pitches and companies
CREATE OR REPLACE FUNCTION update_reaction_counts()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT company_id INTO v_company_id FROM pitches WHERE id = COALESCE(NEW.pitch_id, OLD.pitch_id);

  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'roast' THEN
      UPDATE pitches SET roast_count = roast_count + 1
      WHERE id = NEW.pitch_id;

      UPDATE companies SET total_roasts = total_roasts + 1
      WHERE id = v_company_id;
    ELSE
      UPDATE pitches SET toast_count = toast_count + 1
      WHERE id = NEW.pitch_id;

      UPDATE companies SET total_toasts = total_toasts + 1
      WHERE id = v_company_id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.type = 'roast' THEN
      UPDATE pitches SET roast_count = GREATEST(0, roast_count - 1)
      WHERE id = OLD.pitch_id;

      UPDATE companies SET total_roasts = GREATEST(0, total_roasts - 1)
      WHERE id = v_company_id;
    ELSE
      UPDATE pitches SET toast_count = GREATEST(0, toast_count - 1)
      WHERE id = OLD.pitch_id;

      UPDATE companies SET total_toasts = GREATEST(0, total_toasts - 1)
      WHERE id = v_company_id;
    END IF;
  END IF;

  -- Update interest score
  UPDATE pitches
  SET interest_score = (toast_count * 2) - roast_count + (views_count / 10)
  WHERE id = COALESCE(NEW.pitch_id, OLD.pitch_id);

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reaction_count_trigger ON reactions;
CREATE TRIGGER reaction_count_trigger
  AFTER INSERT OR DELETE ON reactions
  FOR EACH ROW
  EXECUTE FUNCTION update_reaction_counts();


-- =============================================
-- VIEW COUNT UPDATES
-- =============================================

-- Function to update view counts on pitches and companies
CREATE OR REPLACE FUNCTION update_view_counts()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT company_id INTO v_company_id FROM pitches WHERE id = NEW.pitch_id;

  UPDATE pitches SET views_count = views_count + 1
  WHERE id = NEW.pitch_id;

  UPDATE companies SET total_views = total_views + 1
  WHERE id = v_company_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS view_count_trigger ON pitch_views;
CREATE TRIGGER view_count_trigger
  AFTER INSERT ON pitch_views
  FOR EACH ROW
  EXECUTE FUNCTION update_view_counts();


-- =============================================
-- BOOKMARK COUNT UPDATES
-- =============================================

-- Function to update bookmark counts on pitches
CREATE OR REPLACE FUNCTION update_bookmark_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE pitches SET bookmark_count = bookmark_count + 1
    WHERE id = NEW.pitch_id;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE pitches SET bookmark_count = GREATEST(0, bookmark_count - 1)
    WHERE id = OLD.pitch_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bookmark_count_trigger ON bookmarks;
CREATE TRIGGER bookmark_count_trigger
  AFTER INSERT OR DELETE ON bookmarks
  FOR EACH ROW
  EXECUTE FUNCTION update_bookmark_counts();


-- =============================================
-- GAMIFICATION TRIGGERS
-- =============================================

-- Function to update user_streaks updated_at
CREATE OR REPLACE FUNCTION update_user_streaks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_streaks_updated_at ON user_streaks;
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

DROP TRIGGER IF EXISTS daily_challenges_updated_at ON daily_challenges;
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

DROP TRIGGER IF EXISTS challenge_response_count_trigger ON challenge_responses;
CREATE TRIGGER challenge_response_count_trigger
  AFTER INSERT OR DELETE ON challenge_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_challenge_response_count();


-- =============================================
-- RPC FUNCTIONS FOR API ENDPOINTS
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
