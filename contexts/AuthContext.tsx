import {
  clearClientAuthSession,
  ensureNestTelegramSession,
  fetchCurrentProfile,
} from '@/api/users';
import { TelegramLoginWidget } from '@/components/TelegramLoginWidget';
import { getStoredAuthToken } from '@/lib/api-client';
import {
  authClient,
  signInWithTelegramBrowser as exchangeTelegramWidgetForSession,
  reloadOnceForTelegramInitData,
  signInTelegramMiniApp,
  waitForTelegramInitData,
  waitForTelegramWebApp,
  setStoredBetterAuthToken,
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
  signInWithTelegramBrowser: (fields: object) => Promise<void>;
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

  /** 
   * RELIABLE AUTH CHECK: 
   * In TMA, we trust the NestJS token in localStorage.
   * If we have a token, we are 'authenticated' even if Better Auth get-session is null.
   */
  const isAuthenticated = status === 'authenticated';
  const isLoading = status === 'loading' || !bootstrapped;

  const refreshProfile = useCallback(async (retries = 3) => {
    const token = getStoredAuthToken();
    if (!token) {
      setStatus('unauthenticated');
      return;
    }

    for (let i = 0; i < retries; i++) {
      try {
        const p = await fetchCurrentProfile();
        setProfile(p);
        setStatus('authenticated');
        return;
      } catch (err) {
        console.error(`Profile fetch attempt ${i+1} failed`, err);
        if (i === retries - 1) {
          // Final attempt failed, but we still have a token. 
          // We stay in 'authenticated' state but with a null profile fallback if needed.
          setStatus('authenticated'); 
        }
        await new Promise(r => setTimeout(r, 500 * (i + 1)));
      }
    }
  }, [setProfile]);

  const signOut = useCallback(async () => {
    try { await authClient.signOut(); } catch {}
    clearClientAuthSession();
    setStoredBetterAuthToken(null);
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
          // 1. Get NestJS Session (Our source of truth)
          const nest = await ensureNestTelegramSession(initData);
          if (!nest.ok) throw new Error('Backend sync failed');

          // 2. Try Better Auth in background (Don't let it block us)
          signInTelegramMiniApp(initData).catch(err => console.warn('Better Auth background sync failed', err));

          // 3. Load profile from NestJS
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

    return () => { cancelled = true; };
  }, [refreshProfile]);

  const signInWithTelegramBrowser = useCallback(async (fields: object) => {
    setError(null);
    setStatus('loading');
    try {
      const nest = await ensureNestTelegramSession(fields);
      if (!nest.ok) throw new Error('Could not sync with the server.');
      
      // Attempt Better Auth sync
      try { await exchangeTelegramWidgetForSession(fields); } catch {}
      
      await refreshProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
      setStatus('unauthenticated');
    }
  }, [refreshProfile]);

  const value = useMemo(() => ({
    status,
    isTelegramMiniApp,
    error,
    signInWithTelegramBrowser,
    refreshProfile,
    signOut,
    isAuthenticated,
    isLoading,
  }), [status, isTelegramMiniApp, error, signInWithTelegramBrowser, refreshProfile, signOut, isAuthenticated, isLoading]);

  const botName = normalizeTelegramBotUsername(process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? '');

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
            <h2 className='text-xl font-black text-zinc-50 uppercase tracking-tighter'>Initializing</h2>
            <p className='text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]'>Secure Session</p>
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
              <h1 className='text-3xl font-black text-zinc-50 uppercase tracking-tighter'>Welcome</h1>
              <p className='text-sm text-zinc-500 font-medium max-w-[240px] leading-relaxed'>
                Sign in with Telegram to access your premium library.
              </p>
            </div>
          </div>

          <div className='w-full max-w-xs flex flex-col gap-4'>
            {isTelegramMiniApp ? (
              <div className='p-4 rounded-2xl bg-red-500/5 border border-red-500/10 flex items-start gap-3 text-left'>
                <AlertCircle className='w-5 h-5 text-red-500 shrink-0 mt-0.5' />
                <div className='flex flex-col gap-1'>
                  <p className='text-xs font-black text-red-500 uppercase'>Sync Failed</p>
                  <p className='text-[10px] text-zinc-500 font-bold leading-tight uppercase tracking-wider'>
                    Please restart the mini-app.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <TelegramLoginWidget botName={botName} onAuth={signInWithTelegramBrowser} />
                <p className='text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-2'>Secure Login via Telegram</p>
              </>
            )}
          </div>
          {error && <p className='text-xs text-red-400 font-medium bg-red-500/5 px-4 py-2 rounded-full border border-red-500/10'>{error}</p>}
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
