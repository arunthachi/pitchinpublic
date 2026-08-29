import { z } from 'zod';
import { createRequestSupabase } from '@/lib/admin';

export const visibilityUpdateSchema = z.object({ visibility: z.enum(['public', 'private']) }).strict();

export function ownerScopedVisibilityUpdate(supabase: NonNullable<ReturnType<typeof createRequestSupabase>>, input: { pitchId: string; visibility: 'public' | 'private' }) {
  return supabase.rpc('update_pitch_visibility_locked', {
    target_pitch_id: input.pitchId,
    target_visibility: input.visibility,
  });
}
