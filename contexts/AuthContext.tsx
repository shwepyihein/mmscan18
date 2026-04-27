import {
  clearClientAuthSession,
  ensureNestTelegramSession,
  fetchCurrentProfile,
  loginWithEmailPassword,
} from '@/api/users';
import { getStoredAuthToken } from '@/lib/api-client';
import {
  reloadOnceForTelegramInitData,
  waitForTelegramInitData,
  waitForTelegramWebApp,
} from '@/lib/telegram-webapp';
import { useUserStore } from '@/store/useUserStore';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  status: AuthStatus;
  isTelegramMiniApp: boolean;
  error: string | null;
  signInWithTelegramBrowser: (fields: object) => Promise<void>;
  signInWithEmailPassword: (email: string, password: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [isTelegramMiniApp, setIsTelegramMiniApp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  const setProfile = useUserStore((s) => s.setProfile);
  const logoutStore = useUserStore((s) => s.logout);

  /** Nest JWT in localStorage is the source of truth for API access. */
  const isAuthenticated = status === 'authenticated';
  const isLoading = status === 'loading' || !bootstrapped;

  const refreshProfile = useCallback(
    async (retries = 3) => {
      const token = getStoredAuthToken();
      if (!token) {
        setStatus('unauthenticated');
        return;
      }

      for (let i = 0; i < retries; i++) {
        try {
          const p = await fetchCurrentProfile();
          setProfile(p);
          await useUserStore.getState().fetchUnlockedChapters();
          setStatus('authenticated');
          return;
        } catch {
          if (i === retries - 1) {
            // Final attempt failed, but we still have a token.
            // We stay in 'authenticated' state but with a null profile fallback if needed.
            setStatus('authenticated');
          }
          await new Promise((r) => setTimeout(r, 500 * (i + 1)));
        }
      }
    },
    [setProfile],
  );

  const signOut = useCallback(async () => {
    clearClientAuthSession();
    logoutStore();
    setStatus('unauthenticated');
  }, [logoutStore]);

  /** Initial Boot Sequence */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === 'undefined') return;

      const inMiniApp = await waitForTelegramWebApp();
      if (cancelled) return;
      setIsTelegramMiniApp(inMiniApp);

      const existingToken = getStoredAuthToken();

      if (inMiniApp) {
        const initData = await waitForTelegramInitData();
        if (cancelled) return;

        if (!initData?.trim()) {
          if (reloadOnceForTelegramInitData()) return;
          if (!existingToken) setStatus('unauthenticated');
          setBootstrapped(true);
          return;
        }

        try {
          const nest = await ensureNestTelegramSession(initData);
          if (!nest.ok) throw new Error('Backend sync failed');

          await refreshProfile();
        } catch (e) {
          if (!existingToken) {
            setError(e instanceof Error ? e.message : 'Authentication failed');
            setStatus('unauthenticated');
          }
        }
      } else {
        // Browser Mode
        if (existingToken) {
          await refreshProfile();
        } else {
          setStatus('unauthenticated');
        }
      }

      if (!cancelled) setBootstrapped(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshProfile]);

  const signInWithTelegramBrowser = useCallback(
    async (fields: object) => {
      setError(null);
      setStatus('loading');
      try {
        const nest = await ensureNestTelegramSession(fields);
        if (!nest.ok) throw new Error('Could not sync with the server.');

        await refreshProfile();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Login failed');
        setStatus('unauthenticated');
      }
    },
    [refreshProfile],
  );

  const signInWithEmailPassword = useCallback(
    async (email: string, password: string) => {
      setError(null);
      setStatus('loading');
      const result = await loginWithEmailPassword(email.trim(), password);
      if (!result.ok) {
        setError(result.message);
        setStatus('unauthenticated');
        return;
      }
      await refreshProfile();
    },
    [refreshProfile],
  );

  const value = useMemo(
    () => ({
      status,
      isTelegramMiniApp,
      error,
      signInWithTelegramBrowser,
      signInWithEmailPassword,
      refreshProfile,
      signOut,
      isAuthenticated,
      isLoading,
    }),
    [
      status,
      isTelegramMiniApp,
      error,
      signInWithTelegramBrowser,
      signInWithEmailPassword,
      refreshProfile,
      signOut,
      isAuthenticated,
      isLoading,
    ],
  );

  /** Only block the app with a spinner until first auth resolution — not during sign-in attempts. */
  if (!bootstrapped) {
    return (
      <AuthContext.Provider value={value}>
        <div className='fixed inset-0 z-[9999] bg-zinc-950 flex flex-col items-center justify-center p-6 text-center gap-6'>
          <div className='relative'>
            <div className='w-16 h-16 rounded-full border-4 border-zinc-900 border-t-violet-500 animate-spin' />
            <div className='absolute inset-0 flex items-center justify-center'>
              <ShieldCheck className='w-6 h-6 text-zinc-800' />
            </div>
          </div>
          <div className='flex flex-col gap-2'>
            <h2 className='text-xl font-black text-zinc-50 uppercase tracking-tighter'>
              Initializing
            </h2>
            <p className='text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]'>
              Secure Session
            </p>
          </div>
        </div>
      </AuthContext.Provider>
    );
  }

  /** Browser: show site + navbar; use `/login` for sign-in. Mini App: full-screen until signed in or error. */
  if (!isAuthenticated && isTelegramMiniApp) {
    return (
      <AuthContext.Provider value={value}>
        <div className='fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-10 bg-zinc-950 p-8 text-center'>
          <div className='flex max-w-xs flex-col gap-4'>
            <div className='flex items-start gap-3 rounded-2xl border border-red-500/10 bg-red-500/5 p-4 text-left'>
              <AlertCircle className='mt-0.5 h-5 w-5 shrink-0 text-red-500' />
              <div className='flex flex-col gap-1'>
                <p className='text-xs font-black uppercase text-red-500'>
                  Sync Failed
                </p>
                <p className='text-[10px] font-bold uppercase leading-tight tracking-wider text-zinc-500'>
                  Please restart the mini-app.
                </p>
              </div>
            </div>
            {error ? (
              <p className='rounded-full border border-red-500/10 bg-red-500/5 px-4 py-2 text-xs font-medium text-red-400'>
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </AuthContext.Provider>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
