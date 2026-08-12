import type { DeckAccessContext } from '@/lib/pitch-deck';

type ParticipantRow = { user_id: string; role?: string | null; status?: string | null };

/** Assemble the event-scoped deck authorization context. */
export function buildDeckAccessContext(input: {
  requesterId: string;
  ownerId: string;
  organizerId: string;
  participantRows: ParticipantRow[] | null | undefined;
  isPlatformAdmin: boolean;
}): DeckAccessContext {
  const requesterRow = input.participantRows?.find((row) => row.user_id === input.requesterId) || null;
  const ownerRow = input.participantRows?.find((row) => row.user_id === input.ownerId) || null;
  return {
    requesterId: input.requesterId,
    deckOwnerId: input.ownerId,
    isPlatformAdmin: input.isPlatformAdmin,
    event: {
      organizerId: input.organizerId,
      requesterRole: requesterRow?.role,
      requesterStatus: requesterRow?.status,
      ownerRole: ownerRow?.role,
      ownerStatus: ownerRow?.status,
    },
  };
}
