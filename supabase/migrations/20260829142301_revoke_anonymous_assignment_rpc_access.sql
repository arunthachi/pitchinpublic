-- These organizer/accountability RPCs were documented and intended for
-- authenticated callers only. Older explicit anon ACLs survive a PUBLIC-only
-- revoke, so remove both sources before restoring the authenticated grant.
REVOKE ALL ON FUNCTION public.get_event_review_assignments(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_review_assignments(uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.get_review_assignment_event_identities(uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_review_assignment_event_identities(uuid[])
  TO authenticated;
