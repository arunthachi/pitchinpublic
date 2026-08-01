'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Clipboard,
  Clock3,
  Download,
  FileCheck2,
  MessageSquareText,
  Printer,
  RefreshCw,
  Sparkles,
  Target,
  Trophy,
  UserCheck,
  Users,
  Video,
} from 'lucide-react';
import type { EventOutcomeFounder, EventOutcomeReport } from '@/lib/event-outcomes';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; report: EventOutcomeReport }
  | { kind: 'error'; status: number; message: string };

function formatDate(value?: string | null, includeTime = false) {
  if (!value) return 'Not available';
  const date = value.includes('T') ? new Date(value) : new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString(undefined, includeTime
    ? { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatMinutes(value: number | null) {
  if (value === null) return 'No data';
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function yesNo(value: boolean) {
  return value ? 'Yes' : 'No';
}

export default function EventOutcomeReportPage() {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(slug)}/outcomes`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.report) {
        setState({
          kind: 'error',
          status: response.status,
          message: payload.error || 'Could not load the event outcome report.',
        });
        return;
      }
      setState({ kind: 'ready', report: payload.report });
    } catch {
      setState({ kind: 'error', status: 0, message: 'Could not load the event outcome report.' });
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const copyReportLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (state.kind === 'loading') return <ReportSkeleton />;
  if (state.kind === 'error') return <ReportError state={state} onRetry={load} slug={slug} />;

  const { report } = state;
  const { metrics } = report;
  const metricCards = [
    { label: 'Invited', value: metrics.invited, icon: Users, detail: 'Tracked founder invitations' },
    { label: 'Joined', value: metrics.joined, icon: UserCheck, detail: 'Active event founders' },
    { label: 'First Take', value: metrics.firstTake, icon: Video, detail: 'Founders who recorded' },
    { label: 'Improved Take', value: metrics.improvedTake, icon: Sparkles, detail: 'Founders with 2+ takes' },
    { label: 'Feedback coverage', value: metrics.feedbackCoverage.percent === null ? 'No data' : `${metrics.feedbackCoverage.percent}%`, icon: MessageSquareText, detail: `${metrics.feedbackCoverage.count} of ${metrics.feedbackCoverage.total} First-Take founders` },
    { label: 'Final submission', value: metrics.finalSubmission, icon: FileCheck2, detail: 'Submitted or locked' },
    { label: 'Best Take', value: metrics.bestTake, icon: Trophy, detail: 'Founders who selected one' },
    { label: 'Pitch-ready', value: metrics.pitchReady, icon: Target, detail: 'Readiness rating of 4' },
  ];
  const funnel = [
    { label: 'Joined', value: metrics.joined },
    { label: 'First Take', value: metrics.firstTake },
    { label: 'Improved Take', value: metrics.improvedTake },
    { label: 'Final submission', value: metrics.finalSubmission },
    { label: 'Best Take', value: metrics.bestTake },
  ];

  return (
    <div className="outcome-report min-h-screen bg-background text-white">
      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        <nav className="no-print mb-5 flex items-center justify-between gap-3" aria-label="Report navigation">
          <Link
            href={`/events/${encodeURIComponent(slug)}/dashboard`}
            className="btn-glass inline-flex min-h-11 items-center gap-2 px-4 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <span className="text-xs font-bold uppercase text-slate-500">Private organizer report</span>
        </nav>

        <header className="outcome-print-section border-b border-white/10 pb-6 sm:pb-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-neon-cyan">Event outcome report</p>
              <h1 className="mt-2 break-words font-heading text-3xl font-black sm:text-4xl">{report.event.name}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Founder participation, practice progress, feedback responsiveness, and submission outcomes.
              </p>
              <dl className="mt-4 grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
                <div><dt className="inline font-bold text-slate-300">Pitch day: </dt><dd className="inline">{formatDate(report.event.eventDate)}</dd></div>
                <div><dt className="inline font-bold text-slate-300">Generated: </dt><dd className="inline">{formatDate(report.event.generatedAt, true)}</dd></div>
                <div><dt className="inline font-bold text-slate-300">Window starts: </dt><dd className="inline">{formatDate(report.event.reportingStart)}</dd></div>
                <div><dt className="inline font-bold text-slate-300">Window ends: </dt><dd className="inline">{formatDate(report.event.reportingEnd, true)}</dd></div>
              </dl>
            </div>

            <div className="no-print grid w-full grid-cols-1 gap-2 sm:grid-cols-3 lg:w-auto" aria-label="Report actions">
              <button
                type="button"
                onClick={copyReportLink}
                className="btn-glass inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
              >
                {copied ? <Check className="h-4 w-4 text-neon-lime" /> : <Clipboard className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy link'}
              </button>
              <a
                href={`/api/events/${encodeURIComponent(slug)}/outcomes?format=csv`}
                className="btn-glass inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
              >
                <Download className="h-4 w-4" />
                CSV
              </a>
              <button
                type="button"
                onClick={() => window.print()}
                className="cta-primary inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2 text-sm font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
            </div>
          </div>
          <p aria-live="polite" className="sr-only">{copied ? 'Report link copied.' : ''}</p>
        </header>

        <section className="outcome-print-section py-7" aria-labelledby="outcomes-heading">
          <SectionHeading id="outcomes-heading" eyebrow="Primary and completion outcomes" title="Program snapshot" />
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {metricCards.map((metric) => (
              <MetricCard key={metric.label} {...metric} />
            ))}
          </div>
        </section>

        <section className="outcome-print-section border-t border-white/10 py-7" aria-labelledby="progress-heading">
          <SectionHeading id="progress-heading" eyebrow="Founder funnel" title="Progress through the event" />
          {metrics.joined ? (
            <div className="mt-5 space-y-4">
              {funnel.map((item) => {
                const percent = Math.round((item.value / metrics.joined) * 100);
                return (
                  <div key={item.label} className="outcome-print-item grid gap-2 sm:grid-cols-[10rem_1fr_5rem] sm:items-center">
                    <div className="flex items-center justify-between gap-3 text-sm font-bold">
                      <span>{item.label}</span><span className="sm:hidden">{item.value} ({percent}%)</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                      <div className="h-full rounded-full bg-neon-cyan" style={{ width: `${percent}%` }} />
                    </div>
                    <span className="hidden text-right text-sm font-bold text-slate-300 sm:block">{item.value} · {percent}%</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No founders have joined" body="The progress funnel will appear after an invited founder joins the event." />
          )}
        </section>

        <section className="outcome-print-section border-t border-white/10 py-7" aria-labelledby="feedback-heading">
          <SectionHeading id="feedback-heading" eyebrow="Feedback responsiveness" title="Coverage and timing" />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <CompactMetric label="Coverage" value={metrics.feedbackCoverage.percent === null ? 'No data' : `${metrics.feedbackCoverage.percent}%`} />
            <CompactMetric label="Median first feedback" value={formatMinutes(metrics.medianTimeToFirstFeedbackMinutes)} />
            <CompactMetric label="Average first feedback" value={formatMinutes(metrics.averageTimeToFirstFeedbackMinutes)} />
          </div>
          <p className="mt-3 text-sm text-slate-400">
            Timing uses {metrics.timeToFirstFeedbackSampleSize} founder{metrics.timeToFirstFeedbackSampleSize === 1 ? '' : 's'} with a valid first-feedback timestamp.
          </p>

          <div className="mt-6">
            <h3 className="font-heading text-lg font-black">Common improvement signals</h3>
            {report.commonImprovementSignals.length ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {report.commonImprovementSignals.map((signal) => (
                  <div key={signal.label} className="outcome-print-item rounded-lg border border-white/10 bg-white/[0.04] p-3">
                    <p className="break-words font-bold">{signal.label}</p>
                    <p className="mt-1 text-xs text-slate-400">{signal.founderCount} founders · {signal.occurrences} signals</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No improvement signals yet" body="Structured Roast signals will appear after eligible takes receive feedback." />
            )}
          </div>
        </section>

        <section className="outcome-print-section border-t border-white/10 py-7" aria-labelledby="roster-heading">
          <SectionHeading id="roster-heading" eyebrow="Participant results" title="Founder roster and submission summary" />
          {report.founders.length ? (
            <>
              <div className="mt-4 hidden overflow-hidden rounded-lg border border-white/10 md:block">
                <table className="w-full table-fixed border-collapse text-left text-sm">
                  <thead className="bg-white/[0.06] text-xs uppercase text-slate-400">
                    <tr>
                      <th className="w-[27%] px-3 py-3">Founder</th>
                      <th className="w-[15%] px-3 py-3">Access</th>
                      <th className="w-[12%] px-3 py-3">Takes</th>
                      <th className="w-[13%] px-3 py-3">Feedback</th>
                      <th className="w-[15%] px-3 py-3">Submission</th>
                      <th className="w-[18%] px-3 py-3">Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.founders.map((founder) => <FounderTableRow key={`${founder.email}-${founder.founderName}`} founder={founder} />)}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 grid gap-3 md:hidden">
                {report.founders.map((founder) => <FounderMobileRow key={`${founder.email}-${founder.founderName}`} founder={founder} />)}
              </div>
            </>
          ) : (
            <EmptyState title="No founder roster yet" body="Founder invitations and joined participants will appear here." />
          )}
        </section>

        <section className="outcome-print-section border-t border-white/10 py-7" aria-labelledby="definitions-heading">
          <SectionHeading id="definitions-heading" eyebrow="Method" title="Metric definitions" />
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">{report.attributionNote}</p>
          <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {report.definitions.map((definition) => (
              <div key={definition.label} className="outcome-print-item border-l-2 border-neon-cyan/50 pl-3">
                <dt className="font-bold">{definition.label}</dt>
                <dd className="mt-1 text-sm leading-6 text-slate-400">{definition.definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </div>
  );
}

function SectionHeading({ id, eyebrow, title }: { id: string; eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase text-neon-cyan">{eyebrow}</p>
      <h2 id={id} className="mt-1 font-heading text-2xl font-black">{title}</h2>
    </div>
  );
}

function MetricCard({ label, value, detail, icon: Icon }: { label: string; value: string | number; detail: string; icon: typeof Users }) {
  return (
    <article className="outcome-print-item min-w-0 rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-4">
      <Icon className="h-5 w-5 text-neon-cyan" aria-hidden="true" />
      <p className="mt-3 break-words text-xs font-bold uppercase text-slate-400">{label}</p>
      <p className="mt-1 break-words font-heading text-2xl font-black sm:text-3xl">{value}</p>
      <p className="mt-1 break-words text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="outcome-print-item rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs font-bold uppercase text-slate-400">{label}</p>
      <p className="mt-2 font-heading text-2xl font-black">{value}</p>
    </div>
  );
}

function FounderTableRow({ founder }: { founder: EventOutcomeFounder }) {
  return (
    <tr className="outcome-print-item border-t border-white/10 align-top">
      <td className="px-3 py-3"><strong className="block break-words">{founder.founderName}</strong><span className="block break-all text-xs text-slate-500">{founder.email || 'No email'}</span></td>
      <td className="px-3 py-3 text-slate-300">{founder.membershipStatus}<span className="block text-xs text-slate-500">{founder.invitationStatus}</span></td>
      <td className="px-3 py-3 font-bold">{founder.eligibleTakeCount}<span className="block text-xs font-normal text-slate-500">Improved: {yesNo(founder.improvedTakeCompleted)}</span></td>
      <td className="px-3 py-3 font-bold">{founder.feedbackItemsReceived}<span className="block text-xs font-normal text-slate-500">{formatMinutes(founder.minutesToFirstFeedback)}</span></td>
      <td className="px-3 py-3 text-slate-300">{founder.finalSubmissionCompleted ? 'Submitted' : 'Not submitted'}<span className="block text-xs text-slate-500">{formatDate(founder.submittedDate)}</span></td>
      <td className="px-3 py-3 text-slate-300">Best Take: {yesNo(founder.bestTakeCompleted)}<span className="block text-xs text-slate-500">Pitch-ready: {yesNo(founder.pitchReady)}</span></td>
    </tr>
  );
}

function FounderMobileRow({ founder }: { founder: EventOutcomeFounder }) {
  const fields = [
    ['Access', `${founder.membershipStatus} · ${founder.invitationStatus}`],
    ['Eligible takes', `${founder.eligibleTakeCount} · Improved: ${yesNo(founder.improvedTakeCompleted)}`],
    ['Feedback', `${founder.feedbackItemsReceived} · First: ${formatMinutes(founder.minutesToFirstFeedback)}`],
    ['Submission', founder.finalSubmissionCompleted ? `Submitted ${formatDate(founder.submittedDate)}` : 'Not submitted'],
    ['Outcome', `Best Take: ${yesNo(founder.bestTakeCompleted)} · Pitch-ready: ${yesNo(founder.pitchReady)}`],
  ];
  return (
    <article className="outcome-print-item min-w-0 rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <h3 className="break-words font-heading text-lg font-black">{founder.founderName}</h3>
      <p className="break-all text-xs text-slate-500">{founder.email || 'No email'}</p>
      <dl className="mt-4 grid gap-3">
        {fields.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 text-sm">
            <dt className="font-bold text-slate-400">{label}</dt><dd className="min-w-0 break-words text-slate-200">{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="outcome-print-item mt-4 rounded-lg border border-dashed border-white/15 p-5">
      <p className="font-bold">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-400">{body}</p>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="min-h-screen bg-background text-white" aria-label="Loading event outcome report">
      <main className="mx-auto max-w-6xl animate-pulse px-4 py-8 sm:px-6">
        <div className="h-11 w-32 rounded-lg bg-white/10" />
        <div className="mt-8 h-8 w-2/3 rounded-lg bg-white/10" />
        <div className="mt-3 h-4 w-1/2 rounded-lg bg-white/10" />
        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-32 rounded-lg bg-white/[0.06]" />)}
        </div>
      </main>
    </div>
  );
}

function ReportError({ state, onRetry, slug }: { state: Extract<LoadState, { kind: 'error' }>; onRetry: () => void; slug: string }) {
  const title = state.status === 401
    ? 'Sign in to view this report'
    : state.status === 403
      ? 'Organizer access required'
      : state.status === 404
        ? 'Report not found'
        : 'Could not load the report';
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-white">
      <main className="w-full max-w-lg rounded-lg border border-white/10 bg-white/[0.04] p-6 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-roast" />
        <h1 className="mt-4 font-heading text-2xl font-black">{title}</h1>
        <p className="mt-2 leading-6 text-slate-400">{state.message}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href={`/events/${encodeURIComponent(slug)}/dashboard`} className="btn-glass inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2 font-bold">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          {state.status !== 403 && state.status !== 404 ? (
            <button type="button" onClick={onRetry} className="cta-primary inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2 font-black">
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          ) : null}
        </div>
      </main>
    </div>
  );
}
