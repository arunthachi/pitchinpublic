import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { LeadCaptureModal } from '@/components/LeadCaptureModal';
import { appUrlFor } from '@/lib/site-urls';

type Audience = 'organizer' | 'founder';

interface MarketingHeaderProps {
  audience?: Audience;
  currentPath?: '/' | '/for-events' | '/founders' | '/about' | '/contact' | '/terms';
  ctaSource?: string;
  showLeadCta?: boolean;
}

const navigation = [
  { href: '/for-events', label: 'For organizers', audience: 'organizer' as const },
  { href: '/founders', label: 'For founders', audience: 'founder' as const },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export function MarketingHeader({
  audience,
  currentPath,
  ctaSource = 'marketing-header',
  showLeadCta = true,
}: MarketingHeaderProps) {
  const ctaAudience = audience ?? 'organizer';
  return (
    <>
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[100] -translate-y-24 rounded-lg bg-neon-cyan px-4 py-3 font-bold text-slate-950 transition focus:translate-y-0"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#05070a]/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="Pitch in Public home">
            <BrandMark className="h-10 w-10 shrink-0" />
            <span className="truncate font-heading text-base font-black text-white sm:text-lg">
              Pitch in Public
            </span>
          </Link>

          <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
            {navigation.map((item) => {
              const isCurrent = item.href === currentPath;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                    isCurrent
                      ? 'bg-white/10 text-white'
                      : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <a
              href={appUrlFor('/?signin=1')}
              className="hidden items-center gap-1 rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-slate-200 transition hover:border-neon-cyan/60 hover:text-neon-cyan sm:inline-flex"
            >
              Sign in
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
            {showLeadCta ? (
              <LeadCaptureModal
                type={ctaAudience}
                triggerLabel={ctaAudience === 'founder' ? 'Request founder access' : 'Request organizer access'}
                source={ctaSource}
                triggerIcon={false}
                triggerClassName="cta-primary inline-flex items-center justify-center px-4 py-2 text-sm font-black"
              />
            ) : null}
          </div>
        </div>

        <nav
          aria-label="Mobile navigation"
          className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3 lg:hidden"
        >
          {navigation.map((item) => {
            const isCurrent = item.href === currentPath;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isCurrent ? 'page' : undefined}
                className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold ${
                  isCurrent ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
