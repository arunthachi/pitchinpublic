import { z } from 'zod';
import { createRequestSupabase } from '@/lib/admin';

export const visibilityUpdateSchema = z.object({ visibility: z.enum(['public', 'private']) }).strict();

export function ownerScopedVisibilityUpdate(supabase: NonNullable<ReturnType<typeof createRequestSupabase>>, input: { pitchId: string; userId: string; visibility: 'public' | 'private' }) {
  return supabase.from('pitches').update({ visibility: input.visibility, updated_at: new Date().toISOString() }).eq('id', input.pitchId).eq('user_id', input.userId).is('deleted_at', null).select('id, public_id, visibility, event_id').maybeSingle();
}
