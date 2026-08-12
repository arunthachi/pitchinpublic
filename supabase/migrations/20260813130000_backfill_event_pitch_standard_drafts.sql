-- Events created before the integrated Pitch Standard release do not have a
-- draft revision. Give each one the same recommended starting point used by
-- new events so organizers can publish without recreating their event.

INSERT INTO public.event_pitch_guideline_drafts (
  event_id,
  revision,
  title,
  instructions,
  criteria,
  disclosure_mode,
  updated_by
)
SELECT
  event.id,
  1,
  'A clear, audience-ready pitch',
  'Use this plan to prepare a focused pitch that your audience can understand and act on.',
  public.universal_pitch_standard(),
  COALESCE(event.feedback_disclosure_mode, 'role_only'),
  event.organizer_id
FROM public.pitch_events AS event
WHERE NOT EXISTS (
  SELECT 1
  FROM public.event_pitch_guideline_drafts AS draft
  WHERE draft.event_id = event.id
)
ON CONFLICT (event_id) DO NOTHING;
