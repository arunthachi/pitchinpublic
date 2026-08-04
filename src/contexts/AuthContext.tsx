'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { createClient, hasSupabaseConfig } from '@/lib/supabase/client';

export type AuthStatus = 'restoring' | 'authenticated' | 'anonymous' | 'error';

export type AuthLifecycleError = {
  code: 'configuration' | 'restore_failed' | 'restore_timeout' | 'sign_out_failed';
  message: string;
};

export type AuthLifecycleSnapshot = {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  error: AuthLifecycleError | null;
};

type AuthSubscription = {
  unsubscribe: () => void;
};

export type AuthClientLike = {
  auth: {
    getSession: () => Promise<{
      data: { session: Session | null };
      error: unknown | null;
    }>;
    onAuthStateChange: (
      callback: (event: AuthChangeEvent, session: Session | null) => void
    ) => { data: { subscription: AuthSubscription } };
    signOut: () => Promise<{ error: unknown | null }>;
  };
};

type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;

type AuthLifecycleControllerOptions = {
  client: AuthClientLike;
  onChange: (snapshot: AuthLifecycleSnapshot) => void;
  timeoutMs?: number;
  scheduleTimeout?: (callback: () => void, delay: number) => TimeoutHandle;
  cancelTimeout?: (handle: TimeoutHandle) => void;
};

export type AuthLifecycleController = {
  start: () => Promise<void>;
  retry: () => Promise<void>;
  signOut: () => Promise<void>;
  dispose: () => void;
  getSnapshot: () => AuthLifecycleSnapshot;
};

export const AUTH_RESTORE_TIMEOUT_MS = 10_000;

const INITIAL_AUTH_SNAPSHOT: AuthLifecycleSnapshot = {
  status: 'restoring',
  user: null,
  session: null,
  error: null,
};

function restorationFailure(code: AuthLifecycleError['code']): AuthLifecycleError {
  if (code === 'restore_timeout') {
    return {
      code,
      message: 'Session restoration is taking longer than expected. Check your connection and try again.',
    };
  }

  if (code === 'sign_out_failed') {
    return {
      code,
      message: 'We could not sign you out. Check your connection and try again.',
    };
  }

  if (code === 'configuration') {
    return {
      code,
      message: 'Sign-in is temporarily unavailable. Please try again later.',
    };
  }

  return {
    code,
    message: 'We could not restore your session. Check your connection and try again.',
  };
}

/**
 * Coordinates Supabase session restoration independently from React so every
 * asynchronous transition can be generation-guarded and tested deterministically.
 */
export function createAuthLifecycleController({
  client,
  onChange,
  timeoutMs = AUTH_RESTORE_TIMEOUT_MS,
  scheduleTimeout = globalThis.setTimeout,
  cancelTimeout = globalThis.clearTimeout,
}: AuthLifecycleControllerOptions): AuthLifecycleController {
  let snapshot = INITIAL_AUTH_SNAPSHOT;
  let generation = 0;
  let disposed = false;
  let started = false;
  let timeoutHandle: TimeoutHandle | null = null;
  let subscription: AuthSubscription | null = null;

  const publish = (next: AuthLifecycleSnapshot) => {
    if (disposed) return;
    snapshot = next;
    onChange(next);
  };

  const clearRestoreTimeout = () => {
    if (timeoutHandle === null) return;
    cancelTimeout(timeoutHandle);
    timeoutHandle = null;
  };

  const publishSession = (session: Session | null) => {
    publish({
      status: session ? 'authenticated' : 'anonymous',
      session,
      user: session?.user ?? null,
      error: null,
    });
  };

  const handleAuthStateChange = (_event: AuthChangeEvent, session: Session | null) => {
    generation += 1;
    clearRestoreTimeout();
    publishSession(session);
  };

  const retry = async () => {
    const requestGeneration = ++generation;
    clearRestoreTimeout();

    // Preserve a previous failure while retrying so legacy consumers cannot
    // briefly render their anonymous state before the retry is confirmed.
    publish({
      status: 'restoring',
      user: snapshot.user,
      session: snapshot.session,
      error: snapshot.error,
    });

    timeoutHandle = scheduleTimeout(() => {
      if (disposed || requestGeneration !== generation) return;
      generation += 1;
      timeoutHandle = null;
      publish({
        status: 'error',
        user: snapshot.user,
        session: snapshot.session,
        error: restorationFailure('restore_timeout'),
      });
    }, timeoutMs);

    try {
      const result = await client.auth.getSession();
      if (disposed || requestGeneration !== generation) return;

      clearRestoreTimeout();
      if (result.error) {
        publish({
          status: 'error',
          user: snapshot.user,
          session: snapshot.session,
          error: restorationFailure('restore_failed'),
        });
        return;
      }

      publishSession(result.data.session);
    } catch {
      if (disposed || requestGeneration !== generation) return;
      clearRestoreTimeout();
      publish({
        status: 'error',
        user: snapshot.user,
        session: snapshot.session,
        error: restorationFailure('restore_failed'),
      });
    }
  };

  const start = async () => {
    if (started || disposed) return;
    started = true;
    subscription = client.auth.onAuthStateChange(handleAuthStateChange).data.subscription;
    await retry();
  };

  const signOut = async () => {
    const requestGeneration = ++generation;
    clearRestoreTimeout();

    const result = await client.auth.signOut();
    if (disposed || requestGeneration !== generation) return;

    if (result.error) {
      publish({
        status: 'error',
        user: snapshot.user,
        session: snapshot.session,
        error: restorationFailure('sign_out_failed'),
      });
      throw result.error;
    }

    publishSession(null);
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    generation += 1;
    clearRestoreTimeout();
    subscription?.unsubscribe();
    subscription = null;
  };

  return {
    start,
    retry,
    signOut,
    dispose,
    getSnapshot: () => snapshot,
  };
}

interface AuthContextType extends AuthLifecycleSnapshot {
  /** Backwards-compatible alias used by existing auth consumers. */
  loading: boolean;
  retry: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  ...INITIAL_AUTH_SNAPSHOT,
  loading: true,
  retry: async () => {},
  signOut: async () => {},
});

function AuthRecoveryScreen({
  error,
  retry,
}: {
  error: AuthLifecycleError;
  retry: () => Promise<void>;
}) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#05070A] px-5 py-[max(2rem,env(safe-area-inset-top))] text-white">
      <section
        aria-labelledby="auth-recovery-title"
        aria-describedby="auth-recovery-message"
        className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center shadow-2xl backdrop-blur-xl sm:p-8"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
          Pitch in Public
        </p>
        <h1 id="auth-recovery-title" className="mt-3 text-2xl font-semibold">
          We could not check your session
        </h1>
        <p id="auth-recovery-message" role="alert" className="mt-3 text-sm leading-6 text-slate-300">
          {error.message}
        </p>
        <button
          type="button"
          onClick={() => void retry()}
          className="mt-6 min-h-11 w-full rounded-full bg-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
        >
          Retry session check
        </button>
      </section>
    </main>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthLifecycleSnapshot>(INITIAL_AUTH_SNAPSHOT);
  const controllerRef = useRef<AuthLifecycleController | null>(null);

  useEffect(() => {
    if (!hasSupabaseConfig()) {
      setAuth({
        status: 'anonymous',
        user: null,
        session: null,
        error: null,
      });
      return;
    }

    const controller = createAuthLifecycleController({
      client: createClient() as AuthClientLike,
      onChange: setAuth,
    });
    controllerRef.current = controller;
    void controller.start();

    const retryAfterConnectivityReturns = () => {
      if (controller.getSnapshot().status === 'error') {
        void controller.retry();
      }
    };
    const revalidateWhenVisible = () => {
      if (document.visibilityState === 'visible' && controller.getSnapshot().status !== 'restoring') {
        void controller.retry();
      }
    };

    window.addEventListener('online', retryAfterConnectivityReturns);
    document.addEventListener('visibilitychange', revalidateWhenVisible);

    return () => {
      window.removeEventListener('online', retryAfterConnectivityReturns);
      document.removeEventListener('visibilitychange', revalidateWhenVisible);
      controller.dispose();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, []);

  const retry = useCallback(async () => {
    if (!hasSupabaseConfig()) {
      setAuth({
        status: 'error',
        user: null,
        session: null,
        error: restorationFailure('configuration'),
      });
      return;
    }

    await controllerRef.current?.retry();
  }, []);

  const signOut = useCallback(async () => {
    if (!hasSupabaseConfig() || !controllerRef.current) {
      setAuth({ status: 'anonymous', user: null, session: null, error: null });
      return;
    }

    await controllerRef.current.signOut();
  }, []);

  const value: AuthContextType = {
    ...auth,
    // Existing consumers use `loading` to replace their entire page. Keep
    // authenticated content mounted during foreground token revalidation so
    // returning to an installed app never flashes a loading or signed-out UI.
    loading: auth.status === 'restoring' && !auth.session,
    retry,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {!auth.user && auth.error ? <AuthRecoveryScreen error={auth.error} retry={retry} /> : children}
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
