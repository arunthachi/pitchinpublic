import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Platform Control | Pitch in Public',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function PipSuperAdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
