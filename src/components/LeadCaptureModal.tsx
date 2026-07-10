'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Building2, CheckCircle2, Globe2, Loader2, Mail, X } from 'lucide-react';

type LeadType = 'founder' | 'organizer';

interface LeadCaptureModalProps {
  type: LeadType;
  triggerLabel: string;
  triggerClassName?: string;
  triggerIcon?: boolean;
  title?: string;
  subtitle?: string;
  source?: string;
  initialEmail?: string;
}

type SubmitState = 'idle' | 'loading' | 'success' | 'error';

const copyByType: Record<LeadType, { title: string; subtitle: string; nameLabel: string; namePlaceholder: string }> = {
  founder: {
    title: 'Request founder invite',
    subtitle: 'Tell us where to send access and what you are building.',
    nameLabel: 'Startup name',
    namePlaceholder: 'ReachCopilot',
  },
  organizer: {
    title: 'Request organizer access',
    subtitle: 'Share the program, event, or cohort where founders need better pitch practice.',
    nameLabel: 'Organization name',
    namePlaceholder: 'Startup Westport',
  },
};

export function LeadCaptureModal({
  type,
  triggerLabel,
  triggerClassName,
  triggerIcon = true,
  title,
  subtitle,
  source,
  initialEmail = '',
}: LeadCaptureModalProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<SubmitState>('idle');
  const [message, setMessage] = useState('');
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const modalCopy = copyByType[type];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    setEmail(initialEmail);
  }, [initialEmail]);

  const resetAndClose = () => {
    setOpen(false);
    setState('idle');
    setMessage('');
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState('loading');
    setMessage('');

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          email,
          name,
          website,
          source: source || window.location.pathname,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || 'Something went wrong. Please email hello@pitchinpublic.io.');
      }

      setState('success');
      setMessage('You are in. We will follow up by email.');
      setName('');
      setWebsite('');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Something went wrong. Please email hello@pitchinpublic.io.');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setState('idle');
          setMessage('');
        }}
        className={triggerClassName}
      >
        {triggerLabel}
        {triggerIcon ? <ArrowRight className="h-5 w-5" aria-hidden="true" /> : null}
      </button>

      {mounted && open
        ? createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto overscroll-contain bg-black/88 px-3 py-4 backdrop-blur-2xl sm:px-6 sm:py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default"
            onClick={resetAndClose}
          />
          <div className="relative my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-[2rem] border border-white/18 bg-[#08111f]/98 shadow-2xl shadow-black/60 backdrop-blur-2xl [scrollbar-width:thin] sm:max-h-[calc(100dvh-3rem)]">
            <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_18%_0%,rgba(0,230,246,0.26),transparent_20rem),radial-gradient(circle_at_82%_0%,rgba(183,255,42,0.18),transparent_18rem)]" />
            <div className="relative border-b border-white/10 p-6 sm:p-7">
              <button
                type="button"
                aria-label="Close lead form"
                onClick={resetAndClose}
                className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10 text-slate-200 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-neon-cyan">
                {type === 'founder' ? 'Founder access' : 'Organizer access'}
              </p>
              <h2 id={titleId} className="mt-3 max-w-sm font-heading text-3xl font-black leading-tight text-white">
                {title || modalCopy.title}
              </h2>
              <p className="mt-3 max-w-md leading-7 text-slate-300">{subtitle || modalCopy.subtitle}</p>
            </div>

            {state === 'success' ? (
              <div className="p-6 sm:p-7">
                <div className="rounded-3xl border border-neon-lime/25 bg-neon-lime/10 p-6 text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-neon-lime text-slate-950">
                    <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 font-heading text-2xl font-black text-white">Request received</h3>
                  <p className="mt-3 leading-7 text-slate-300">{message}</p>
                  <button
                    type="button"
                    onClick={resetAndClose}
                    className="cta-primary mt-6 inline-flex w-full items-center justify-center rounded-full px-5 py-3 font-heading font-black"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4 p-5 sm:p-7">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-200">Email</span>
                  <span className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 focus-within:border-neon-cyan/70 focus-within:ring-2 focus-within:ring-neon-cyan/20">
                    <Mail className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@company.com"
                      autoComplete="email"
                      required
                      className="min-w-0 flex-1 bg-transparent text-base font-semibold text-white outline-none placeholder:text-slate-500"
                    />
                  </span>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-200">{modalCopy.nameLabel}</span>
                  <span className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 focus-within:border-neon-cyan/70 focus-within:ring-2 focus-within:ring-neon-cyan/20">
                    <Building2 className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder={modalCopy.namePlaceholder}
                      autoComplete="organization"
                      required
                      className="min-w-0 flex-1 bg-transparent text-base font-semibold text-white outline-none placeholder:text-slate-500"
                    />
                  </span>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-200">Website or LinkedIn</span>
                  <span className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 focus-within:border-neon-cyan/70 focus-within:ring-2 focus-within:ring-neon-cyan/20">
                    <Globe2 className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                    <input
                      type="text"
                      value={website}
                      onChange={(event) => setWebsite(event.target.value)}
                      placeholder="https://..."
                      autoComplete="url"
                      className="min-w-0 flex-1 bg-transparent text-base font-semibold text-white outline-none placeholder:text-slate-500"
                    />
                  </span>
                </label>

                {message ? (
                  <p className={`text-sm ${state === 'error' ? 'text-red-300' : 'text-slate-300'}`}>{message}</p>
                ) : null}

                <button
                  type="submit"
                  disabled={state === 'loading'}
                  className="cta-primary inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-4 font-heading font-black disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {state === 'loading' ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
                  {state === 'loading' ? 'Sending...' : type === 'founder' ? 'Request founder invite' : 'Request organizer access'}
                </button>

              </form>
            )}
          </div>
        </div>,
          document.body
        )
        : null}
    </>
  );
}
