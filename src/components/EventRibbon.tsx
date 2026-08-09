'use client';

import Link from 'next/link';
import { ArrowRight, CalendarDays, Mail } from 'lucide-react';
import type { RibbonModel } from '@/lib/event-orientation';

/**
 * One slim strip on the practice home for founders with an event life: the
 * pending invitation, or the nearest-deadline active event. Renders nothing
 * for solo founders — the practice feed stays untouched for them.
 */
export function EventRibbon({ model }: { model: RibbonModel }) {
  if (!model) return null;

  const isInvitation = model.kind === 'invitation';
  return (
    <Link
      href={model.href}
      className="pointer-events-auto flex min-h-11 max-w-full items-center gap-2 rounded-full border border-white/10 bg-black/60 px-4 py-2 text-sm font-bold text-white backdrop-blur-xl transition hover:border-neon-cyan/45"
    >
      {isInvitation ? (
        <Mail className="h-4 w-4 shrink-0 text-neon-lime" aria-hidden="true" />
      ) : (
        <CalendarDays className="h-4 w-4 shrink-0 text-neon-cyan" aria-hidden="true" />
      )}
      <span className="min-w-0 truncate">{model.name}</span>
      <span className="shrink-0 text-xs font-semibold text-slate-400">
        {isInvitation
          ? 'Invitation waiting'
          : model.kind === 'event' && model.submitted
            ? 'Submitted'
            : model.kind === 'event' && model.countdown
              ? model.countdown
              : 'Open'}
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
    </Link>
  );
}
