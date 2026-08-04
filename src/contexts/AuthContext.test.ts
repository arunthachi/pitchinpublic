import assert from 'node:assert/strict';
import test from 'node:test';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import {
  attachAuthLifecycleRevalidation,
  createAuthLifecycleController,
  type AuthClientLike,
  type AuthLifecycleSnapshot,
} from './AuthContext';

class RevalidationTarget extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible';
}

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

type SessionResult = {
  data: { session: Session | null };
  error: unknown | null;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createSession(id: string): Session {
  return {
    access_token: `access-${id}`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: 1_900_000_000,
    refresh_token: `refresh-${id}`,
    user: {
      id,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-08-04T00:00:00.000Z',
    } as User,
  };
}

function createAuthClient(
  sessionRequests: Array<Deferred<SessionResult>>,
  signOutResults: Array<{ error: unknown | null }> = [{ error: null }]
) {
  let authChange: ((event: AuthChangeEvent, session: Session | null) => void) | null = null;
  let unsubscribed = false;
  let requestIndex = 0;
  let signOutIndex = 0;

  const client: AuthClientLike = {
    auth: {
      getSession: () => sessionRequests[requestIndex++].promise,
      onAuthStateChange(callback) {
        authChange = callback;
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                unsubscribed = true;
              },
            },
          },
        };
      },
      signOut: async () => signOutResults[Math.min(signOutIndex++, signOutResults.length - 1)],
    },
  };

  return {
    client,
    emit(event: AuthChangeEvent, session: Session | null) {
      assert.ok(authChange, 'auth subscription should be registered');
      authChange(event, session);
    },
    wasUnsubscribed: () => unsubscribed,
  };
}

function captureLifecycle(client: AuthClientLike) {
  const snapshots: AuthLifecycleSnapshot[] = [];
  const timeouts: Array<() => void> = [];
  const controller = createAuthLifecycleController({
    client,
    onChange: (snapshot) => snapshots.push(snapshot),
    scheduleTimeout: (callback) => {
      timeouts.push(callback);
      return timeouts.length as unknown as ReturnType<typeof setTimeout>;
    },
    cancelTimeout: () => {},
  });

  return { controller, snapshots, timeouts };
}

test('keeps restoring during a slow lookup and accepts its eventual session', async () => {
  const request = deferred<SessionResult>();
  const auth = createAuthClient([request]);
  const { controller, snapshots } = captureLifecycle(auth.client);

  const started = controller.start();
  assert.equal(snapshots.at(-1)?.status, 'restoring');

  const session = createSession('slow-user');
  request.resolve({ data: { session }, error: null });
  await started;

  assert.equal(snapshots.at(-1)?.status, 'authenticated');
  assert.equal(snapshots.at(-1)?.user?.id, 'slow-user');
});

test('publishes anonymous only after Supabase confirms there is no session', async () => {
  const request = deferred<SessionResult>();
  const auth = createAuthClient([request]);
  const { controller, snapshots } = captureLifecycle(auth.client);

  const started = controller.start();
  assert.notEqual(snapshots.at(-1)?.status, 'anonymous');
  request.resolve({ data: { session: null }, error: null });
  await started;

  assert.deepEqual(snapshots.at(-1), {
    status: 'anonymous',
    user: null,
    session: null,
    error: null,
  });
});

test('exposes a recoverable error and succeeds on retry', async () => {
  const failed = deferred<SessionResult>();
  const recovered = deferred<SessionResult>();
  const auth = createAuthClient([failed, recovered]);
  const { controller, snapshots } = captureLifecycle(auth.client);

  const started = controller.start();
  failed.resolve({ data: { session: null }, error: new Error('offline') });
  await started;
  assert.equal(snapshots.at(-1)?.status, 'error');
  assert.equal(snapshots.at(-1)?.error?.code, 'restore_failed');

  const retrying = controller.retry();
  assert.equal(snapshots.at(-1)?.status, 'restoring');
  assert.equal(snapshots.at(-1)?.error?.code, 'restore_failed');
  recovered.resolve({ data: { session: createSession('recovered-user') }, error: null });
  await retrying;

  assert.equal(snapshots.at(-1)?.status, 'authenticated');
  assert.equal(snapshots.at(-1)?.error, null);
});

test('ignores a late response from an older restore generation', async () => {
  const first = deferred<SessionResult>();
  const second = deferred<SessionResult>();
  const auth = createAuthClient([first, second]);
  const { controller, snapshots } = captureLifecycle(auth.client);

  const originalRestore = controller.start();
  const latestRestore = controller.retry();
  second.resolve({ data: { session: null }, error: null });
  await latestRestore;
  assert.equal(snapshots.at(-1)?.status, 'anonymous');

  first.resolve({ data: { session: createSession('stale-user') }, error: null });
  await originalRestore;
  assert.equal(snapshots.at(-1)?.status, 'anonymous');
  assert.equal(snapshots.at(-1)?.user, null);
});

test('auth events supersede a pending restore and dispose unsubscribes', async () => {
  const request = deferred<SessionResult>();
  const auth = createAuthClient([request]);
  const { controller, snapshots } = captureLifecycle(auth.client);

  const started = controller.start();
  auth.emit('SIGNED_IN', createSession('event-user'));
  assert.equal(snapshots.at(-1)?.status, 'authenticated');
  assert.equal(snapshots.at(-1)?.user?.id, 'event-user');

  auth.emit('SIGNED_OUT', null);
  assert.equal(snapshots.at(-1)?.status, 'anonymous');

  request.resolve({ data: { session: null }, error: null });
  await started;
  assert.equal(snapshots.at(-1)?.status, 'anonymous');

  controller.dispose();
  assert.equal(auth.wasUnsubscribed(), true);
});

test('a timed-out lookup becomes an error and cannot sign the user out later', async () => {
  const request = deferred<SessionResult>();
  const auth = createAuthClient([request]);
  const { controller, snapshots, timeouts } = captureLifecycle(auth.client);

  const started = controller.start();
  timeouts[0]();
  assert.equal(snapshots.at(-1)?.status, 'error');
  assert.equal(snapshots.at(-1)?.error?.code, 'restore_timeout');

  request.resolve({ data: { session: null }, error: null });
  await started;
  assert.equal(snapshots.at(-1)?.status, 'error');
});

test('turns a rejected session lookup into a recoverable restore error', async () => {
  const request = deferred<SessionResult>();
  const auth = createAuthClient([request]);
  const { controller, snapshots } = captureLifecycle(auth.client);

  const started = controller.start();
  request.reject(new Error('network unavailable'));
  await started;

  assert.equal(snapshots.at(-1)?.status, 'error');
  assert.equal(snapshots.at(-1)?.error?.code, 'restore_failed');
});

test('signs out an authenticated lifecycle and clears the retained session', async () => {
  const request = deferred<SessionResult>();
  const auth = createAuthClient([request]);
  const { controller, snapshots } = captureLifecycle(auth.client);

  const started = controller.start();
  request.resolve({ data: { session: createSession('signed-in-user') }, error: null });
  await started;
  await controller.signOut();

  assert.deepEqual(snapshots.at(-1), {
    status: 'anonymous',
    user: null,
    session: null,
    error: null,
  });
});

test('preserves the authenticated session and surfaces a failed sign-out', async () => {
  const request = deferred<SessionResult>();
  const signOutError = new Error('sign out failed');
  const auth = createAuthClient([request], [{ error: signOutError }]);
  const { controller, snapshots } = captureLifecycle(auth.client);

  const started = controller.start();
  request.resolve({ data: { session: createSession('retained-user') }, error: null });
  await started;

  await assert.rejects(controller.signOut(), signOutError);
  assert.equal(snapshots.at(-1)?.status, 'error');
  assert.equal(snapshots.at(-1)?.error?.code, 'sign_out_failed');
  assert.equal(snapshots.at(-1)?.user?.id, 'retained-user');
  assert.equal(snapshots.at(-1)?.session?.user.id, 'retained-user');
});

test('retries a failed restore when connectivity returns and detaches cleanly', async () => {
  const failed = deferred<SessionResult>();
  const recovered = deferred<SessionResult>();
  const auth = createAuthClient([failed, recovered]);
  const { controller, snapshots } = captureLifecycle(auth.client);
  const onlineTarget = new RevalidationTarget();
  const visibilityTarget = new RevalidationTarget();

  const started = controller.start();
  failed.resolve({ data: { session: null }, error: new Error('offline') });
  await started;
  assert.equal(snapshots.at(-1)?.status, 'error');

  const detach = attachAuthLifecycleRevalidation({
    controller,
    onlineTarget,
    visibilityTarget,
  });
  onlineTarget.dispatchEvent(new Event('online'));
  recovered.resolve({ data: { session: createSession('online-user') }, error: null });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(snapshots.at(-1)?.user?.id, 'online-user');

  detach();
  const snapshotCount = snapshots.length;
  onlineTarget.dispatchEvent(new Event('online'));
  assert.equal(snapshots.length, snapshotCount);
});

test('revalidates a visible session but ignores hidden and restoring states', async () => {
  const first = deferred<SessionResult>();
  const visibleRefresh = deferred<SessionResult>();
  const auth = createAuthClient([first, visibleRefresh]);
  const { controller, snapshots } = captureLifecycle(auth.client);
  const onlineTarget = new RevalidationTarget();
  const visibilityTarget = new RevalidationTarget();

  const started = controller.start();
  first.resolve({ data: { session: createSession('visible-user') }, error: null });
  await started;

  const detach = attachAuthLifecycleRevalidation({
    controller,
    onlineTarget,
    visibilityTarget,
  });
  visibilityTarget.visibilityState = 'hidden';
  visibilityTarget.dispatchEvent(new Event('visibilitychange'));
  assert.equal(snapshots.at(-1)?.status, 'authenticated');

  visibilityTarget.visibilityState = 'visible';
  visibilityTarget.dispatchEvent(new Event('visibilitychange'));
  assert.equal(snapshots.at(-1)?.status, 'restoring');
  const snapshotCount = snapshots.length;
  visibilityTarget.dispatchEvent(new Event('visibilitychange'));
  assert.equal(snapshots.length, snapshotCount);

  visibleRefresh.resolve({ data: { session: createSession('refreshed-user') }, error: null });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(snapshots.at(-1)?.user?.id, 'refreshed-user');
  detach();
});
