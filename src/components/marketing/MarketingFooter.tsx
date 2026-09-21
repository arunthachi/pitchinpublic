import Link from 'next/link';
import { ArrowUpRight, Mail } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { appUrlFor } from '@/lib/site-urls';

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#05070a]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_0.8fr_0.8fr] lg:px-8">
        <div>
          <Link href="/" className="inline-flex items-center gap-3" aria-label="Pitch in Public home">
            <BrandMark className="h-10 w-10" />
            <span className="font-heading text-lg font-black">Pitch in Public</span>
          </Link>
          <p className="mt-4 max-w-sm leading-7 text-slate-400">
            Guided pitch preparation for founder programs and pitch events, with human feedback and
            controlled event practice.
          </p>
        </div>

        <div>
          <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Explore</p>
          <ul className="mt-4 space-y-3 text-sm font-semibold text-slate-300">
            <li><Link className="hover:text-neon-cyan" href="/for-events">For organizers</Link></li>
            <li><Link className="hover:text-neon-cyan" href="/founders">For founders</Link></li>
            <li><Link className="hover:text-neon-cyan" href="/about">About</Link></li>
            <li><Link className="hover:text-neon-cyan" href="/terms">Terms &amp; policies</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Connect</p>
          <ul className="mt-4 space-y-3 text-sm font-semibold text-slate-300">
            <li>
              <a className="inline-flex items-center gap-2 hover:text-neon-cyan" href="mailto:hello@pitchinpublic.io">
                <Mail className="h-4 w-4" aria-hidden="true" />
                Email us
              </a>
            </li>
            <li><Link className="hover:text-neon-cyan" href="/contact">Contact</Link></li>
            <li>
              <a className="inline-flex items-center gap-1 hover:text-neon-cyan" href={appUrlFor('/?signin=1')}>
                Open the app
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-5 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} Pitch in Public. Early access is invite-only.
      </div>
    </footer>
  );
}
