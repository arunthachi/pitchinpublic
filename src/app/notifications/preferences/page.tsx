'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Sparkles, Bell, ArrowLeft, Loader2 } from 'lucide-react';

type Preferences = {
  user_id: string;
  email_enabled: boolean;
  daily_nudge_time: string;
  timezone: string;
};

export default function NotificationPreferencesPage() {
  const { user, loading } = useAuth();
  const [preferences, setPreferences] = useState<Preferences | null>(null);
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

        if (!response.ok) {
          throw new Error(data.error || 'Could not load preferences.');
        }

        if (cancelled) return;

        setPreferences(data.preferences);
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

  const handleToggle = async (nextValue: boolean) => {
    if (!preferences) return;

    setSaving(true);
    setError('');
    setStatus('');

    try {
      const response = await fetch('/api/notification-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailEnabled: nextValue }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not save preferences.');
      }

      setPreferences(data.preferences);
      setStatus(nextValue ? 'Automated nudges are on.' : 'Automated nudges are off.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save preferences.');
    } finally {
      setSaving(false);
    }
  };

  const emailEnabled = preferences?.email_enabled ?? false;

  if (!loading && !user) {
    return (
      <main className="min-h-screen bg-black px-4 py-8 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl flex-col justify-center">
          <Card className="border-white/10 bg-white/[0.05]">
            <CardHeader>
              <CardTitle className="text-white">Sign in to manage nudges</CardTitle>
              <CardDescription>
                Keep automated pitch prompts and deadline reminders on or off without affecting organizer announcements.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-slate-300">
                This route only controls automated founder nudges. Organizer announcements stay separate.
              </p>
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

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_45%),linear-gradient(180deg,#020617_0%,#050608_100%)] px-4 py-6 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-2xl flex-col justify-center">
        <div className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-neon-cyan">
          <Sparkles className="h-4 w-4" />
          Automated nudges
        </div>

        <Card className="border-white/10 bg-white/[0.05] shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
          <CardHeader className="space-y-3">
            <CardTitle className="text-3xl text-white">Email preferences</CardTitle>
            <CardDescription className="text-base leading-6">
              Turn automated pitch practice emails on or off. Daily founder prompts and deadline reminders use this setting.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error ? (
              <div className="rounded-2xl border border-roast/30 bg-roast/10 px-4 py-3 text-sm text-roast">
                {error}
              </div>
            ) : null}

            <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4 sm:p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-neon-cyan/15 text-neon-cyan">
                  <Bell className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-heading text-xl font-black text-white">Founder nudges</p>
                      <p className="mt-1 text-sm leading-6 text-slate-400">
                        Today&apos;s pitch task and event deadline reminders only. Organizer announcements are not controlled here.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold ${emailEnabled ? 'text-neon-lime' : 'text-slate-400'}`}>
                        {emailEnabled ? 'On' : 'Off'}
                      </span>
                      <Switch checked={emailEnabled} onCheckedChange={handleToggle} disabled={saving || !preferences} />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <InfoPill label="Send time" value={preferences?.daily_nudge_time?.slice(0, 5) || '09:00'} />
                    <InfoPill label="Timezone" value={preferences?.timezone || 'America/New_York'} />
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-400">
                    <strong className="text-slate-200">Copy note:</strong> automated emails start with{' '}
                    <span className="text-neon-cyan">Today&apos;s pitch task: make the customer obvious in sentence one. Record a 60-sec take.</span>
                  </p>
                </div>
              </div>
            </div>

            {status ? (
              <p className="text-sm font-medium text-neon-lime">{status}</p>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild variant="outline" className="rounded-full border-white/15 bg-white/[0.03] text-white hover:bg-white/[0.06]">
                <Link href="/">Back to app</Link>
              </Button>

              <div className="flex items-center gap-2 text-sm text-slate-400">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <span>{saving ? 'Saving changes' : 'Switch changes save immediately'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-white">{value}</p>
    </div>
  );
}
