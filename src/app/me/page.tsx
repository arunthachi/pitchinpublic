'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

export default function MePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    const openOwnProfile = async () => {
      if (!user) return;

      const supabase = createClient();
      const { data } = await supabase
        .from('profiles')
        .select('public_handle, username')
        .eq('id', user.id)
        .single();

      const handle = data?.public_handle || data?.username;
      router.replace(handle ? `/profile/${encodeURIComponent(handle)}` : '/');
    };

    openOwnProfile();
  }, [loading, router, user]);

  if (!loading && !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-center text-white">
        <h1 className="font-heading text-4xl font-black">Sign in to open your pitch portfolio.</h1>
        <p className="mt-3 max-w-md text-slate-400">
          Your profile becomes the home for practice reps, final takes, and feedback signals.
        </p>
        <Link href="/" className="mt-6 rounded-xl bg-neon-cyan px-5 py-3 font-heading font-bold text-slate-950">
          Go to app
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon-cyan border-t-transparent" />
    </div>
  );
}
