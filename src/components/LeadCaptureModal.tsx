'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
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
type FieldErrors = Partial<Record<'email' | 'name', string>>;

const copyByType: Record<LeadType, { title: string; subtitle: string; nameLabel: string; namePlaceholder: string }> = {
  founder: {
    title: 'Request founder access',
    subtitle: 'Leave your email and startup name. We will follow up with the next step.',
    nameLabel: 'Startup name',
    namePlaceholder: 'ReachCopilot',
  },
  organizer: {
    title: 'Request organizer invite',
    subtitle: 'Share the program, event, or cohort. Organizer access stays invite-only.',
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
  const [warning, setWarning] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const statusId = useId();
  const emailErrorId = useId();
  const nameErrorId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const successButtonRef = useRef<HTMLButtonElement>(null);
  const submittingRef = useRef(false);
  const submissionEpochRef = useRef(0);
  const requestIdRef = useRef('');
  const activeRequestRef = useRef<AbortController | null>(null);
  const modalCopy = copyByType[type];

  useEffect(() => {
    setMounted(true);
  }, []);

  const resetAndClose = useCallback(() => {
    submissionEpochRef.current += 1;
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
    submittingRef.current = false;
    requestIdRef.current = '';
    setOpen(false);
    setState('idle');
    setMessage('');
    setWarning('');
    setFieldErrors({});
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : triggerRef.current;
    const focusTimer = window.requestAnimationFrame(() => titleRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        resetAndClose();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        ) || []
      ).filter((element) => element.offsetParent !== null);
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
      window.requestAnimationFrame(() => previousFocus?.focus());
    };
  }, [open, resetAndClose]);

  useEffect(() => {
    setEmail(initialEmail);
  }, [initialEmail]);

  useEffect(() => {
    if (open && state === 'success') successButtonRef.current?.focus();
  }, [open, state]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const nextErrors: FieldErrors = {};
    if (!emailRef.current?.validity.valid) {
      nextErrors.email = emailRef.current?.validity.typeMismatch
        ? 'Enter a valid email address.'
        : 'Enter your email address.';
    }
    if (!nameRef.current?.validity.valid) {
      nextErrors.name = `Enter your ${modalCopy.nameLabel.toLowerCase()}.`;
    }
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      if (nextErrors.email) emailRef.current?.focus();
      else nameRef.current?.focus();
      return;
    }

    submittingRef.current = true;
    const submissionEpoch = ++submissionEpochRef.current;
    const requestController = new AbortController();
    activeRequestRef.current = requestController;
    setState('loading');
    setMessage('');
    setWarning('');
    setFieldErrors({});

    try {
      if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID();
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: requestController.signal,
        body: JSON.stringify({
          requestId: requestIdRef.current,
          type,
          email,
          name,
          website,
          source: source || window.location.pathname,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        message?: string;
        warning?: string | null;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Something went wrong. Please email hello@pitchinpublic.io.');
      }

      if (submissionEpoch === submissionEpochRef.current) {
        setState('success');
        setMessage(payload.message || 'Request received. We will follow up by email.');
        setWarning(payload.warning || '');
        setName('');
        setWebsite('');
      }
    } catch (error) {
      if (submissionEpoch === submissionEpochRef.current) {
        setState('error');
        setMessage(error instanceof Error ? error.message : 'Something went wrong. Please email hello@pitchinpublic.io.');
        setWarning('');
      }
    } finally {
      if (activeRequestRef.current === requestController) {
        activeRequestRef.current = null;
        submittingRef.current = false;
      }
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          requestIdRef.current = crypto.randomUUID();
          setOpen(true);
          setState('idle');
          setMessage('');
          setFieldErrors({});
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
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) resetAndClose();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabIndex={-1}
            className="relative my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-[2rem] border border-white/18 bg-[#08111f]/98 shadow-2xl shadow-black/60 backdrop-blur-2xl [scrollbar-width:thin] sm:max-h-[calc(100dvh-3rem)]"
          >
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
                {type === 'founder' ? 'Founder access' : 'Organizer invite'}
              </p>
              <h2 ref={titleRef} id={titleId} tabIndex={-1} className="mt-3 max-w-sm font-heading text-3xl font-black leading-tight text-white outline-none">
                {title || modalCopy.title}
              </h2>
              <p id={descriptionId} className="mt-3 max-w-md leading-7 text-slate-300">{subtitle || modalCopy.subtitle}</p>
            </div>

            {state === 'success' ? (
              <div className="p-6 sm:p-7">
                <div className="rounded-3xl border border-neon-lime/25 bg-neon-lime/10 p-6 text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-neon-lime text-slate-950">
                    <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 font-heading text-2xl font-black text-white">Request received</h3>
                  <p role="status" aria-live="polite" className="mt-3 leading-7 text-slate-300">{message}</p>
                  {warning ? (
                    <p className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
                      {warning}
                    </p>
                  ) : null}
                  <button
                    ref={successButtonRef}
                    type="button"
                    onClick={resetAndClose}
                    className="cta-primary mt-6 inline-flex w-full items-center justify-center rounded-full px-5 py-3 font-heading font-black"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} noValidate className="space-y-4 p-5 sm:p-7">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-200">Email</span>
                  <span className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 focus-within:border-neon-cyan/70 focus-within:ring-2 focus-within:ring-neon-cyan/20">
                    <Mail className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                    <input
                      ref={emailRef}
                      type="email"
                      value={email}
                      onChange={(event) => {
                        requestIdRef.current = '';
                        setEmail(event.target.value);
                        if (fieldErrors.email) setFieldErrors((current) => ({ ...current, email: undefined }));
                      }}
                      placeholder="you@company.com"
                      autoComplete="email"
                      required
                      aria-label="Email"
                      aria-invalid={fieldErrors.email ? true : undefined}
                      aria-describedby={fieldErrors.email ? emailErrorId : undefined}
                      className="min-w-0 flex-1 bg-transparent text-base font-semibold text-white outline-none placeholder:text-slate-500"
                    />
                  </span>
                  {fieldErrors.email ? <span id={emailErrorId} role="alert" className="mt-2 block text-sm text-red-300">{fieldErrors.email}</span> : null}
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-200">{modalCopy.nameLabel}</span>
                  <span className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 focus-within:border-neon-cyan/70 focus-within:ring-2 focus-within:ring-neon-cyan/20">
                    <Building2 className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                    <input
                      ref={nameRef}
                      type="text"
                      value={name}
                      onChange={(event) => {
                        requestIdRef.current = '';
                        setName(event.target.value);
                        if (fieldErrors.name) setFieldErrors((current) => ({ ...current, name: undefined }));
                      }}
                      placeholder={modalCopy.namePlaceholder}
                      autoComplete="organization"
                      required
                      aria-label={modalCopy.nameLabel}
                      aria-invalid={fieldErrors.name ? true : undefined}
                      aria-describedby={fieldErrors.name ? nameErrorId : undefined}
                      className="min-w-0 flex-1 bg-transparent text-base font-semibold text-white outline-none placeholder:text-slate-500"
                    />
                  </span>
                  {fieldErrors.name ? <span id={nameErrorId} role="alert" className="mt-2 block text-sm text-red-300">{fieldErrors.name}</span> : null}
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-200">Website or LinkedIn</span>
                  <span className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 focus-within:border-neon-cyan/70 focus-within:ring-2 focus-within:ring-neon-cyan/20">
                    <Globe2 className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                    <input
                      type="text"
                      value={website}
                      onChange={(event) => {
                        requestIdRef.current = '';
                        setWebsite(event.target.value);
                      }}
                      placeholder="https://..."
                      autoComplete="url"
                      className="min-w-0 flex-1 bg-transparent text-base font-semibold text-white outline-none placeholder:text-slate-500"
                    />
                  </span>
                </label>

                {message ? (
                  <p id={statusId} role={state === 'error' ? 'alert' : 'status'} aria-live="polite" className={`text-sm ${state === 'error' ? 'text-red-300' : 'text-slate-300'}`}>
                    {message}
                    {state === 'error' ? (
                      <> <a href="mailto:hello@pitchinpublic.io" className="font-bold underline underline-offset-2 hover:text-white">Email hello@pitchinpublic.io</a> if the problem continues.</>
                    ) : null}
                  </p>
                ) : null}
                {warning ? (
                  <p className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
                    {warning}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={state === 'loading'}
                  aria-describedby={message ? statusId : undefined}
                  className="cta-primary inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-4 font-heading font-black disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {state === 'loading' ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
                  {state === 'loading' ? 'Sending...' : type === 'founder' ? 'Request founder access' : 'Request organizer invite'}
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
