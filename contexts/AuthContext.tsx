import {
  clearClientAuthSession,
  ensureNestTelegramSession,
  fetchCurrentProfile,
} from '@/api/users';
import { TelegramLoginWidget } from '@/components/TelegramLoginWidget';
import { getStoredAuthToken, setStoredAuthToken } from '@/lib/api-client';
import {
  authClient,
  signInWithTelegramBrowser as exchangeTelegramWidgetForSession,
  reloadOnceForTelegramInitData,
  setStoredBetterAuthToken,
  signInTelegramMiniApp,
  waitForTelegramInitData,
  waitForTelegramWebApp,
} from '@/lib/auth-client';
import { normalizeTelegramBotUsername } from '@/lib/telegram-bot-username';
import { useUserStore } from '@/store/useUserStore';
import { AlertCircle, LogIn, ShieldCheck } from 'lucide-react';
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
  /** Browser: Nest `ensureNestTelegramSession` (login or register) then Better Auth session. */
  signInWithTelegramBrowser: (fields: object) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Convenience for UI */
  isAuthenticated: boolean;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function refreshJwtForNest(): Promise<void> {
  // If we already have a token from NestJS, do not overwrite it with Better Auth's local JWT
  if (getStoredAuthToken()) return;

  try {
    const { data, error } = await authClient.token();
    if (error || !data?.token) {
      setStoredAuthToken(null);
      return;
    }
    setStoredAuthToken(data.token);
  } catch {
    setStoredAuthToken(null);
  }
}

function fallbackProfileFromSessionUser(user: {
  id: string;
  name?: string | null;
  telegramId?: string | null;
}) {
  return {
    id: user.id,
    telegramId: String(user.telegramId ?? user.id),
    username: user.name ?? undefined,
    coins: 0,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    data: session,
    isPending,
    error: sessionError,
    refetch,
  } = authClient.useSession();
  const [isTelegramMiniApp, setIsTelegramMiniApp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tmaBootstrapped, setTmaBootstrapped] = useState(false);
  const setProfile = useUserStore((s) => s.setProfile);
  const logoutStore = useUserStore((s) => s.logout);

  const user = session?.user;

  /** Better Auth finished loading session (or "no session") and Mini App probe done. */
  const sessionResolved = tmaBootstrapped && !isPending;

  const status: AuthStatus = !sessionResolved
    ? 'loading'
    : user
      ? 'authenticated'
      : 'unauthenticated';

  const isLoading = !sessionResolved;
  const isAuthenticated = Boolean(user) && sessionResolved;

  const refreshProfile = useCallback(async () => {
    await refreshJwtForNest();
    try {
      const p = await fetchCurrentProfile();
      setProfile(p);
    } catch {
      const { data } = await authClient.getSession();
      if (data?.user) {
        setProfile(fallbackProfileFromSessionUser(data.user));
      }
    }
  }, [setProfile]);

  const signOut = useCallback(async () => {
    await authClient.signOut();
    clearClientAuthSession();
    setStoredBetterAuthToken(null);
    logoutStore();
  }, [logoutStore]);

  /**
   * Mini App: better-auth-telegram `signInWithMiniApp` using `Telegram.WebApp.initData`
   * (no @telegram-apps/sdk — detection via `window.Telegram.WebApp`).
   */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === 'undefined') {
        setTmaBootstrapped(true);
        return;
      }
      const inMiniApp = await waitForTelegramWebApp();

      if (cancelled) return;
      setIsTelegramMiniApp(inMiniApp);
      if (!inMiniApp) {
        setTmaBootstrapped(true);
        return;
      }
      const initData = await waitForTelegramInitData();
      if (cancelled) return;
      if (!initData?.trim()) {
        if (reloadOnceForTelegramInitData()) {
          return;
        }
        setTmaBootstrapped(true);
        return;
      }
      try {
        const nest = await ensureNestTelegramSession(initData);
        if (!nest.ok) {
          if (!cancelled) {
            setError('Could not sync with the server.');
          }
          return;
        }
        await signInTelegramMiniApp(initData);
        /**
         * Telegram WebView sometimes applies `Set-Cookie` slightly after the
         * sign-in fetch resolves. Retry `get-session` so `useSession` catches up.
         * The header fallback will help here too.
         */
        for (let attempt = 0; attempt < 6; attempt++) {
          const { data } = await authClient.getSession();
          if (data?.user) break;
          await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
        }
        await refetch();
        await refreshProfile();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Telegram sync failed');
        }
      } finally {
        if (!cancelled) setTmaBootstrapped(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refetch, refreshProfile]);

  /** Load Nest profile when Better Auth session is present. */
  useEffect(() => {
    if (!sessionResolved || !user) return;

    let cancelled = false;
    (async () => {
      await refreshJwtForNest();
      try {
        const p = await fetchCurrentProfile();
        if (!cancelled) setProfile(p);
      } catch {
        if (cancelled) return;
        const { data } = await authClient.getSession();
        if (data?.user) {
          setProfile(fallbackProfileFromSessionUser(data.user));
        } else {
          setProfile(fallbackProfileFromSessionUser(user));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionResolved, user, setProfile]);

  useEffect(() => {
    if (sessionError) {
      setError(sessionError.message ?? 'Session error');
    }
  }, [sessionError]);

  const signInWithTelegramBrowser = useCallback(
    async (fields: object) => {
      setError(null);
      const nest = await ensureNestTelegramSession(fields);
      if (!nest.ok) {
        setError('Could not sync with the server.');
        return;
      }
      await exchangeTelegramWidgetForSession(fields);
      await refetch();
      await refreshProfile();
    },
    [refetch, refreshProfile],
  );

  const value = useMemo(
    () => ({
      status,
      isTelegramMiniApp,
      error,
      signInWithTelegramBrowser,
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
      refreshProfile,
      signOut,
      isAuthenticated,
      isLoading,
    ],
  );

  const botName = normalizeTelegramBotUsername(
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? '',
  );

  if (isLoading) {
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
              Synchronizing Secure Session
            </p>
          </div>
        </div>
      </AuthContext.Provider>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthContext.Provider value={value}>
        <div className='fixed inset-0 z-[9999] bg-zinc-950 flex flex-col items-center justify-center p-8 text-center gap-10'>
          <div className='flex flex-col items-center gap-6'>
            <div className='w-24 h-24 rounded-3xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-500 shadow-2xl shadow-violet-900/10'>
              <LogIn size={48} />
            </div>
            <div className='flex flex-col gap-2'>
              <h1 className='text-3xl font-black text-zinc-50 uppercase tracking-tighter'>
                Welcome
              </h1>
              <p className='text-sm text-zinc-500 font-medium max-w-[240px] leading-relaxed'>
                Sign in with Telegram to access your premium manhwa library.
              </p>
            </div>
          </div>

          <div className='w-full max-w-xs flex flex-col gap-4'>
            {isTelegramMiniApp ? (
              <div className='p-4 rounded-2xl bg-red-500/5 border border-red-500/10 flex items-start gap-3 text-left'>
                <AlertCircle className='w-5 h-5 text-red-500 shrink-0 mt-0.5' />
                <div className='flex flex-col gap-1'>
                  <p className='text-xs font-black text-red-500 uppercase'>
                    Sync Failed
                  </p>
                  <p className='text-[10px] text-zinc-500 font-bold leading-tight uppercase tracking-wider'>
                    Please restart the mini-app from your Telegram bot.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <TelegramLoginWidget
                  botName={botName}
                  buttonSize='large'
                  onAuth={signInWithTelegramBrowser}
                />
                <p className='text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-2'>
                  Official Secure Login via Telegram
                </p>
              </>
            )}
          </div>

          {error && (
            <p className='text-xs text-red-400/80 font-medium bg-red-500/5 px-4 py-2 rounded-full border border-red-500/10'>
              {error}
            </p>
          )}
        </div>
      </AuthContext.Provider>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
