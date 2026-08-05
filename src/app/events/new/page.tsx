'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { LeadCaptureModal } from '@/components/LeadCaptureModal';
import { ActionPageNav } from '@/components/ActionPageNav';
import { destination } from '@/lib/app-navigation';
import {
  EVENT_FOCUS_OPTIONS,
  EVENT_PITCH_LENGTH_OPTIONS,
  EVENT_VISIBILITY_OPTIONS,
} from '@/lib/event-settings';
import { getInviteContinuationCounts, parseBulkFounderEmails } from '@/lib/event-dashboard';
import { createClientIdempotencyKey } from '@/lib/idempotency';

const focusOptions = [...EVENT_FOCUS_OPTIONS];
const visibilityOptions = EVENT_VISIBILITY_OPTIONS;

function openNativeDatePicker(input: HTMLInputElement) {
  try {
    (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
  } catch {
    input.focus();
  }
}

function NewEventContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, signOut } = useAuth();
  const [roleLoading, setRoleLoading] = useState(true);
  const [accessCheckVersion, setAccessCheckVersion] = useState(0);
  const [isRecheckingAccess, setIsRecheckingAccess] = useState(false);
  const [canManageEvents, setCanManageEvents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [acceptedInvite, setAcceptedInvite] = useState<{ organizationName: string | null; email: string | null } | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    eventDate: '',
    submissionDeadline: '',
    pitchLengthSeconds: 60,
    focus: focusOptions[0],
    visibility: 'unlisted' as keyof typeof visibilityOptions,
    accessCode: '',
  });
  const [founderEmails, setFounderEmails] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const advancedTriggerRef = useRef<HTMLButtonElement>(null);
  const eventCreationKeyRef = useRef('');
  const organizerAccepted = searchParams.get('organizer') === 'accepted';

  useEffect(() => {
    if (!showAdvanced) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setShowAdvanced(false);
      window.requestAnimationFrame(() => advancedTriggerRef.current?.focus());
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [showAdvanced]);

  useEffect(() => {
    if (!organizerAccepted || typeof window === 'undefined') return;

    const raw = window.sessionStorage.getItem('pip.organizer-invite-accepted');
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { organizationName?: string | null; email?: string | null };
      setAcceptedInvite({
        organizationName: parsed.organizationName || null,
        email: parsed.email || null,
      });
    } catch (error) {
      console.warn('Could not parse accepted organizer invite context:', error);
    } finally {
      window.sessionStorage.removeItem('pip.organizer-invite-accepted');
    }
  }, [organizerAccepted]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setRoleLoading(false);
      setCanManageEvents(false);
      return;
    }

    let cancelled = false;

    const checkOrganizerAccess = async () => {
      try {
        const supabase = createClient();
        let hasAccess = false;
        const attempts = organizerAccepted ? 2 : 1;

        for (let attempt = 0; attempt < attempts; attempt += 1) {
          const { data } = await supabase
            .from('profile_roles')
            .select('role')
            .eq('user_id', user.id)
            .in('role', ['organizer', 'admin']);

          hasAccess = Boolean(data?.length);
          if (hasAccess || attempt === attempts - 1) break;

          await new Promise((resolve) => window.setTimeout(resolve, 500));
        }

        if (!cancelled) {
          setCanManageEvents(hasAccess);
        }
      } catch (error) {
        console.error('Could not check organizer access:', error);
        if (!cancelled) setCanManageEvents(false);
      } finally {
        if (!cancelled) {
          setRoleLoading(false);
          setIsRecheckingAccess(false);
        }
      }
    };

    checkOrganizerAccess();

    return () => {
      cancelled = true;
    };
  }, [accessCheckVersion, loading, organizerAccepted, user]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');

    try {
      const parsedEmails = parseBulkFounderEmails(founderEmails);
      if (parsedEmails.invalid.length || parsedEmails.overflow) {
        throw new Error(
          parsedEmails.overflow
            ? 'Invite up to 50 founders at a time.'
            : `Fix ${parsedEmails.invalid.length} invalid founder email address${parsedEmails.invalid.length === 1 ? '' : 'es'}.`
        );
      }
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': eventCreationKeyRef.current || (eventCreationKeyRef.current = createClientIdempotencyKey()),
        },
        body: JSON.stringify({
          ...form,
          focus: form.focus,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        const firstIssue = data.issues
          ? (Object.values(data.issues).flat().find((issue) => typeof issue === 'string') as string | undefined)
          : null;
        throw new Error(firstIssue || data.error || 'Could not create pitch event.');
      }

      let invited = 0;
      let inviteFailed = 0;
      if (parsedEmails.emails.length) {
        try {
          const inviteResponse = await fetch(`/api/events/${data.event.slug}/invites`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emails: parsedEmails.emails, role: 'founder', sendEmail: true }),
          });
          const inviteData = await inviteResponse.json().catch(() => ({}));
          const outcome = getInviteContinuationCounts(
            inviteResponse.ok,
            inviteData,
            parsedEmails.emails.length
          );
          invited = outcome.invited;
          inviteFailed = outcome.failed;
        } catch {
          inviteFailed = parsedEmails.emails.length;
        }
      }

      const next = new URLSearchParams({ created: '1' });
      if (invited) next.set('invited', String(invited));
      if (inviteFailed) next.set('inviteFailed', String(inviteFailed));
      router.push(`/events/${data.event.slug}/dashboard?${next.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create pitch event.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || roleLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-white">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center text-white">
        <h1 className="font-heading text-4xl font-bold">Sign in to create a pitch event.</h1>
        <Link href="/" className="cta-primary mt-6 rounded-xl px-5 py-3 font-heading font-bold">
          Go to app
        </Link>
      </div>
    );
  }

  if (!canManageEvents) {
    return (
      <div className="min-h-screen bg-background text-white">
        <ActionPageNav
          ariaLabel="Organizer access navigation"
          links={[destination('feed')]}
          account={user ? { email: user.email, profileHref: '/me', onSignOut: signOut } : undefined}
        />
        <main className="mx-auto flex min-h-[70dvh] max-w-xl items-center px-4 py-10 sm:px-6">
          <section className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-neon-cyan">
              {organizerAccepted ? 'Organizer invite accepted' : 'Organizer access'}
            </p>
            <h1 className="mt-2 font-heading text-3xl font-black leading-tight">
              {organizerAccepted ? 'Finishing your organizer setup' : 'Organizer access is invite-only'}
            </h1>
            <p className="mt-3 text-base leading-7 text-slate-300">
              {organizerAccepted
                ? `${acceptedInvite?.organizationName || 'Your organization'} is linked to this account. Check once more to open event creation.`
                : 'Request access if you run founder cohorts, competitions, or pitch programs.'}
            </p>
            <div className="mt-6">
              {organizerAccepted ? (
                <button
                  type="button"
                  disabled={isRecheckingAccess}
                  onClick={() => {
                    setIsRecheckingAccess(true);
                    setAccessCheckVersion((version) => version + 1);
                  }}
                  className="cta-primary inline-flex min-h-12 w-full items-center justify-center rounded-xl px-5 font-heading font-black"
                >
                  {isRecheckingAccess ? 'Checking access...' : 'Check access again'}
                </button>
              ) : (
                <LeadCaptureModal
                  type="organizer"
                  triggerLabel="Request organizer invite"
                  source="events-new-gate"
                  triggerClassName="cta-primary inline-flex min-h-12 w-full items-center justify-center rounded-xl px-5 font-heading font-black"
                />
              )}
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background text-white">
      <ActionPageNav
        ariaLabel="Create event navigation"
        links={[destination('myEvents'), destination('createEvent', true), destination('feed')]}
        account={{ email: user.email, profileHref: '/me', onSignOut: signOut }}
      />
      <main className="mx-auto max-w-2xl px-4 py-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-8">
        <header className="mb-5">
          <h1 className="font-heading text-3xl font-black leading-tight sm:text-4xl">Create event</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Name it, choose the pitch day, and invite founders.</p>
        </header>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Event name">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-dark" required maxLength={120} autoFocus />
          </Field>
          <Field label="Pitch day">
            <input
              type="date"
              value={form.eventDate}
              onClick={(e) => openNativeDatePicker(e.currentTarget)}
              onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
              className="input-dark cursor-pointer"
              required
            />
          </Field>
          <Field label="Founder emails (optional)">
            <input
              type="text"
              inputMode="email"
              value={founderEmails}
              onChange={(e) => setFounderEmails(e.target.value)}
              className="input-dark"
              placeholder="founder@startup.com, cofounder@startup.com"
              aria-describedby="founder-email-help"
            />
            <span id="founder-email-help" className="mt-1.5 block text-xs leading-5 text-slate-500">Separate multiple addresses with commas.</span>
          </Field>

          <button
            ref={advancedTriggerRef}
            type="button"
            aria-expanded={showAdvanced}
            aria-controls="event-advanced-settings"
            onClick={() => setShowAdvanced((current) => !current)}
            className="flex min-h-11 w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 text-left text-sm font-bold text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
          >
            Advanced settings
            <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>

          {showAdvanced ? (
            <div id="event-advanced-settings" className="space-y-4 border-l border-white/10 pl-4">
              <Field label="Description">
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-dark min-h-20 resize-y" maxLength={1000} />
              </Field>
              <Field label="Submission deadline">
                <input type="date" value={form.submissionDeadline} max={form.eventDate} onClick={(e) => openNativeDatePicker(e.currentTarget)} onChange={(e) => setForm({ ...form, submissionDeadline: e.target.value })} className="input-dark cursor-pointer" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Pitch length">
                  <select value={form.pitchLengthSeconds} onChange={(e) => setForm({ ...form, pitchLengthSeconds: Number(e.target.value) })} className="input-dark">
                    {EVENT_PITCH_LENGTH_OPTIONS.map((option) => <option key={option.seconds} value={option.seconds}>{option.label}</option>)}
                  </select>
                </Field>
                <Field label="Practice focus">
                  <select value={form.focus} onChange={(e) => setForm({ ...form, focus: e.target.value as typeof form.focus })} className="input-dark">
                    {focusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Founder access">
                <select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as keyof typeof visibilityOptions })} className="input-dark">
                  {Object.entries(visibilityOptions).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}
                </select>
                <span className="mt-1.5 block text-xs leading-5 text-slate-500">{visibilityOptions[form.visibility].helper}</span>
              </Field>
              <Field label="Access code (optional)">
                <input value={form.accessCode} onChange={(e) => setForm({ ...form, accessCode: e.target.value })} className="input-dark" minLength={4} maxLength={32} autoComplete="off" />
              </Field>
            </div>
          ) : null}

          {error ? <p role="alert" className="rounded-xl border border-roast/25 bg-roast/10 px-4 py-3 text-sm font-semibold text-roast">{error}</p> : null}

          <button disabled={isSaving} className="cta-primary inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 font-heading font-black disabled:opacity-60">
            {isSaving ? 'Creating event...' : founderEmails.trim() ? 'Create and invite founders' : 'Create event'}
            <ArrowRight className="h-5 w-5" />
          </button>
        </form>
      </main>
    </div>
  );
}

export default function NewEventPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[100dvh] items-center justify-center bg-background text-white">Loading organizer setup...</div>}>
      <NewEventContent />
    </Suspense>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-300">{label}</span>
      {children}
    </label>
  );
}
