-- Migration 008: Practice habit loop
-- Adds server-backed daily pitch prompts, pitch goals, rep metadata, best-take
-- tracking, and outbound notification intent logs.

CREATE TABLE IF NOT EXISTS practice_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My pitch practice',
  company_name TEXT,
  context TEXT,
  target_date DATE,
  event_id UUID REFERENCES pitch_events(id) ON DELETE SET NULL,
  focus TEXT NOT NULL DEFAULT 'clarity',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  best_pitch_id UUID REFERENCES pitches(id) ON DELETE SET NULL,
  current_prompt_key TEXT NOT NULL DEFAULT 'opening-clarity',
  prompt_started_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practice_goals_user_status ON practice_goals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_practice_goals_event_id ON practice_goals(event_id);
CREATE INDEX IF NOT EXISTS idx_practice_goals_target_date ON practice_goals(target_date);

ALTER TABLE practice_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their practice goals" ON practice_goals;
CREATE POLICY "Users can view their practice goals"
  ON practice_goals FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their practice goals" ON practice_goals;
CREATE POLICY "Users can create their practice goals"
  ON practice_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their practice goals" ON practice_goals;
CREATE POLICY "Users can update their practice goals"
  ON practice_goals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their practice goals" ON practice_goals;
CREATE POLICY "Users can delete their practice goals"
  ON practice_goals FOR DELETE
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS practice_reps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES practice_goals(id) ON DELETE SET NULL,
  pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  prompt_key TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  rep_number INTEGER NOT NULL DEFAULT 1,
  is_best_take BOOLEAN NOT NULL DEFAULT false,
  readiness INTEGER CHECK (readiness BETWEEN 1 AND 4),
  clarity_delta INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, pitch_id)
);

CREATE INDEX IF NOT EXISTS idx_practice_reps_user_created ON practice_reps(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_practice_reps_goal_rep ON practice_reps(goal_id, rep_number DESC);
CREATE INDEX IF NOT EXISTS idx_practice_reps_pitch_id ON practice_reps(pitch_id);
CREATE INDEX IF NOT EXISTS idx_practice_reps_best_take ON practice_reps(user_id, is_best_take) WHERE is_best_take = true;

ALTER TABLE practice_reps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their practice reps" ON practice_reps;
CREATE POLICY "Users can view their practice reps"
  ON practice_reps FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their practice reps" ON practice_reps;
CREATE POLICY "Users can create their practice reps"
  ON practice_reps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their practice reps" ON practice_reps;
CREATE POLICY "Users can update their practice reps"
  ON practice_reps FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  sms_enabled BOOLEAN NOT NULL DEFAULT false,
  daily_nudge_time TIME WITHOUT TIME ZONE DEFAULT '09:00',
  timezone TEXT DEFAULT 'America/New_York',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their notification preferences" ON notification_preferences;
CREATE POLICY "Users can view their notification preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can upsert their notification preferences" ON notification_preferences;
CREATE POLICY "Users can upsert their notification preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their notification preferences" ON notification_preferences;
CREATE POLICY "Users can update their notification preferences"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS nudge_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES practice_goals(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'sms')),
  kind TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'skipped', 'failed')),
  scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nudge_events_user_created ON nudge_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nudge_events_status_scheduled ON nudge_events(status, scheduled_for);

ALTER TABLE nudge_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their nudges" ON nudge_events;
CREATE POLICY "Users can view their nudges"
  ON nudge_events FOR SELECT
  USING (auth.uid() = user_id);

ALTER TABLE pitches ADD COLUMN IF NOT EXISTS practice_goal_id UUID REFERENCES practice_goals(id) ON DELETE SET NULL;
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS prompt_key TEXT;
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS prompt_text TEXT;
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS is_best_take BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_pitches_practice_goal_id ON pitches(practice_goal_id);
CREATE INDEX IF NOT EXISTS idx_pitches_user_best_take ON pitches(user_id, is_best_take) WHERE is_best_take = true;

CREATE OR REPLACE FUNCTION mark_best_take(target_pitch_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id UUID;
  target_goal_id UUID;
BEGIN
  SELECT user_id, practice_goal_id INTO target_user_id, target_goal_id
  FROM pitches
  WHERE id = target_pitch_id;

  IF target_user_id IS NULL OR target_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Pitch not found or not owned by current user';
  END IF;

  UPDATE pitches
  SET is_best_take = false
  WHERE user_id = target_user_id
    AND (target_goal_id IS NULL OR practice_goal_id IS NOT DISTINCT FROM target_goal_id);

  UPDATE practice_reps
  SET is_best_take = false
  WHERE user_id = target_user_id
    AND (target_goal_id IS NULL OR goal_id IS NOT DISTINCT FROM target_goal_id);

  UPDATE pitches
  SET is_best_take = true, updated_at = NOW()
  WHERE id = target_pitch_id;

  UPDATE practice_reps
  SET is_best_take = true
  WHERE pitch_id = target_pitch_id;

  IF target_goal_id IS NOT NULL THEN
    UPDATE practice_goals
    SET best_pitch_id = target_pitch_id, updated_at = NOW()
    WHERE id = target_goal_id AND user_id = target_user_id;
  END IF;
END;
$$;

COMMENT ON TABLE practice_goals IS 'Founder pitch-practice goals that drive daily prompts, countdowns, and best-take selection.';
COMMENT ON TABLE practice_reps IS 'One row per published practice pitch, tied to the prompt and goal that produced it.';
COMMENT ON TABLE nudge_events IS 'Notification intent log for in-app/email/SMS nudges. Sending can be added without changing product state.';
