'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient, hasSupabaseConfig } from '@/lib/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const finishSignedOut = () => {
      if (!isMounted) return;
      setUser(null);
      setSession(null);
      setLoading(false);
    };

    if (!hasSupabaseConfig()) {
      finishSignedOut();
      return;
    }

    const supabase = createClient();
    const authTimeout = window.setTimeout(finishSignedOut, 2500);

    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!isMounted) return;
        window.clearTimeout(authTimeout);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        window.clearTimeout(authTimeout);
        finishSignedOut();
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      window.clearTimeout(authTimeout);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      window.clearTimeout(authTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    if (!hasSupabaseConfig()) {
      setUser(null);
      setSession(null);
      return;
    }

    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
