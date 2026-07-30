'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell, CalendarClock, Loader2, Mail, MessageSquareText, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

type Preferences = {
  user_id: string;
  email_enabled: boolean;
  founder_nudges_enabled: boolean;
  reviewer_digest_enabled: boolean;
  organizer_digest_enabled: boolean;
  daily_nudge_time: string;
  timezone: string;
};

type Roles = {
  founder: boolean;
  reviewer: boolean;
  organizer: boolean;
};

type PreferencePatch = {
  emailEnabled?: boolean;
  founderNudgesEnabled?: boolean;
  reviewerDigestEnabled?: boolean;
  organizerDigestEnabled?: boolean;
  dailyNudgeTime?: string;
  timezone?: string;
};

const TIME_OPTIONS = Array.from({ length: 34 }, (_, index) => {
  const totalMinutes = 6 * 60 + index * 30;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;

  return {
    value: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`,
    label: `${hour12}:${String(minute).padStart(2, '0')} ${period}`,
  };
});

const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time' },
  { value: 'America/Chicago', label: 'Central Time' },
  { value: 'America/Denver', label: 'Mountain Time' },
  { value: 'America/Los_Angeles', label: 'Pacific Time' },
];

function normalizeTimeValue(value?: string | null) {
  if (!value) return '09:00:00';
  const [hour = '09', minute = '00'] = value.split(':');
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00`;
}

export default function NotificationPreferencesPage() {
  const { user, loading } = useAuth();
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [roles, setRoles] = useState<Roles>({ founder: true, reviewer: false, organizer: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;

    const loadPreferences = async () => {
      setError('');
      try {
        const response = await fetch('/api/notification-preferences', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load preferences.');
        if (cancelled) return;
        setPreferences(data.preferences);
        setRoles(data.roles || { founder: true, reviewer: false, organizer: false });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load preferences.');
        }
      }
    };

    loadPreferences();
    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  const savePreferences = async (patch: PreferencePatch, successMessage: string) => {
    if (!preferences) return;
    setSaving(true);
    setError('');
    setStatus('');

    try {
      const response = await fetch('/api/notification-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save preferences.');
      setPreferences(data.preferences);
      setStatus(successMessage);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save preferences.');
    } finally {
      setSaving(false);
    }
  };

  if (!loading && !user) {
    return (
      <main className="min-h-screen bg-black px-4 py-8 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl flex-col justify-center">
          <Card className="border-white/10 bg-white/[0.05]">
            <CardHeader>
              <CardTitle className="text-white">Sign in to manage notifications</CardTitle>
              <CardDescription>Control practice, review, and organizer updates from one place.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full bg-neon-cyan px-5 py-3 font-bold text-slate-950"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to app
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const emailEnabled = preferences?.email_enabled ?? false;
  const selectedTime = normalizeTimeValue(preferences?.daily_nudge_time);
  const selectedTimezone = preferences?.timezone || 'America/New_York';

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_40%),linear-gradient(180deg,#020617_0%,#050608_100%)] px-4 py-6 text-white">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-neon-cyan">
          <Sparkles className="h-4 w-4" />
          Notifications
        </div>

        <Card className="border-white/10 bg-white/[0.05] shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
          <CardHeader className="space-y-3">
            <CardTitle className="text-3xl text-white">Email preferences</CardTitle>
            <CardDescription className="text-base leading-6">
              Choose the updates that help you act. Transactional and security emails are always sent when required.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {error ? (
              <div className="rounded-2xl border border-roast/30 bg-roast/10 px-4 py-3 text-sm text-roast">{error}</div>
            ) : null}

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-slate-200">
                <Mail className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-heading text-base font-black text-white">Email notifications</p>
                <p className="mt-1 text-sm text-slate-400">Master control for automated updates below.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-bold ${emailEnabled ? 'text-neon-lime' : 'text-slate-400'}`}>
                  {emailEnabled ? 'On' : 'Off'}
                </span>
                <Switch
                  checked={emailEnabled}
                  disabled={saving || !preferences}
                  onCheckedChange={(value) =>
                    savePreferences(
                      { emailEnabled: value },
                      value ? 'Email notifications are on.' : 'Email notifications are off.'
                    )
                  }
                />
              </div>
            </div>

            <div className="grid gap-3">
              {roles.founder ? (
                <PreferenceRow
                  icon={<Bell className="h-5 w-5" />}
                  title="Practice and pitch-room nudges"
                  description="Your daily practice task plus event reminders at 7 days, 72 hours, and 24 hours."
                  checked={preferences?.founder_nudges_enabled ?? true}
                  disabled={saving || !preferences || !emailEnabled}
                  onCheckedChange={(value) =>
                    savePreferences(
                      { founderNudgesEnabled: value },
                      value ? 'Founder nudges are on.' : 'Founder nudges are paused.'
                    )
                  }
                />
              ) : null}

              {roles.reviewer ? (
                <PreferenceRow
                  icon={<MessageSquareText className="h-5 w-5" />}
                  title="Review queue reminders"
                  description="Due-soon assignments and one Tuesday digest when pitches are waiting."
                  checked={preferences?.reviewer_digest_enabled ?? true}
                  disabled={saving || !preferences || !emailEnabled}
                  onCheckedChange={(value) =>
                    savePreferences(
                      { reviewerDigestEnabled: value },
                      value ? 'Reviewer reminders are on.' : 'Reviewer reminders are paused.'
                    )
                  }
                />
              ) : null}

              {roles.organizer ? (
                <PreferenceRow
                  icon={<CalendarClock className="h-5 w-5" />}
                  title="Organizer readiness updates"
                  description="A Monday snapshot and deadline alerts only when founder submissions are missing."
                  checked={preferences?.organizer_digest_enabled ?? true}
                  disabled={saving || !preferences || !emailEnabled}
                  onCheckedChange={(value) =>
                    savePreferences(
                      { organizerDigestEnabled: value },
                      value ? 'Organizer updates are on.' : 'Organizer updates are paused.'
                    )
                  }
                />
              ) : null}
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <p className="mb-3 font-heading text-base font-black text-white">Preferred delivery time</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Send around</span>
                  <select
                    value={selectedTime}
                    disabled={saving || !preferences}
                    onChange={(event) =>
                      savePreferences({ dailyNudgeTime: event.target.value }, 'Preferred delivery time saved.')
                    }
                    className="mt-2 w-full appearance-none bg-transparent font-heading text-lg font-black text-white outline-none disabled:opacity-60"
                    aria-label="Preferred email delivery time"
                  >
                    {TIME_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value} className="bg-slate-950 text-white">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Timezone</span>
                  <select
                    value={selectedTimezone}
                    disabled={saving || !preferences}
                    onChange={(event) => savePreferences({ timezone: event.target.value }, 'Timezone saved.')}
                    className="mt-2 w-full appearance-none bg-transparent font-heading text-lg font-black text-white outline-none disabled:opacity-60"
                    aria-label="Email delivery timezone"
                  >
                    {TIMEZONE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value} className="bg-slate-950 text-white">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Routine emails arrive near this local time. Urgent deadlines take priority, with at most one automated
                email within 20 hours.
              </p>
            </div>

            {status ? <p className="text-sm font-medium text-neon-lime">{status}</p> : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                asChild
                variant="outline"
                className="rounded-full border-white/15 bg-white/[0.03] text-white hover:bg-white/[0.06]"
              >
                <Link href="/">Back to app</Link>
              </Button>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <span>{saving ? 'Saving changes' : 'Changes save immediately'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function PreferenceRow({
  icon,
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neon-cyan/10 text-neon-cyan">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-base font-black text-white">{title}</p>
        <p className="mt-1 text-sm leading-5 text-slate-400">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}
