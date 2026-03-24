import { useAuth } from '@/components/AuthProvider';
import { TelegramLoginWidget } from '@/components/TelegramLoginWidget';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  getTelegramWebAppDebugSnapshot,
  waitForTelegramInitData,
} from '@/lib/auth-client';
import { normalizeTelegramBotUsername } from '@/lib/telegram-bot-username';
import {
  isLocalhostHostname,
  isPublicSiteUrlHostMismatch,
} from '@/lib/telegram-domain';
import { useUserStore } from '@/store/useUserStore';
import {
  AlertTriangle,
  ChevronLeft,
  History,
  LogOut,
  Settings,
  Star,
  User,
  Wallet,
} from 'lucide-react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function Profile() {
  const router = useRouter();
  const profile = useUserStore((state) => state.profile);
  const {
    status,
    isTelegramMiniApp,
    signInWithTelegramBrowser,
    signOut,
    isLoading,
    isAuthenticated,
    error: authError,
  } = useAuth();
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const [telegramDomainHint, setTelegramDomainHint] = useState<
    'localhost' | 'host_mismatch' | null
  >(null);
  const [browserHost, setBrowserHost] = useState('');
  /** Mini App: JSON snapshot of `initData` for debugging (dev-only visibility). */
  const [miniAppInitDataJson, setMiniAppInitDataJson] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setBrowserHost(window.location.host);
    if (isLocalhostHostname(window.location.hostname)) {
      setTelegramDomainHint('localhost');
      return;
    }
    if (isPublicSiteUrlHostMismatch()) {
      setTelegramDomainHint('host_mismatch');
      return;
    }
    setTelegramDomainHint(null);
  }, []);

  useEffect(() => {
    if (!isTelegramMiniApp) {
      setMiniAppInitDataJson(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const raw = await waitForTelegramInitData({ timeoutMs: 15000 });
      if (cancelled) return;
      if (!raw?.trim()) {
        setMiniAppInitDataJson(
          JSON.stringify(
            {
              ...getTelegramWebAppDebugSnapshot(),
              note: 'Signed initData still empty after ready()+wait. If initDataUnsafe has user but initData is empty, you did not open as a Mini App from Telegram (use the bot Menu / button). Plain browser or some in-app browsers never get a signed string.',
            },
            null,
            2,
          ),
        );
        return;
      }
      try {
        const params = new URLSearchParams(raw);
        const parsed: Record<string, unknown> = {};
        for (const [key, value] of Array.from(params.entries())) {
          if (key === 'user' || key === 'receiver' || key === 'chat') {
            try {
              parsed[key] = JSON.parse(value) as unknown;
            } catch {
              parsed[key] = value;
            }
          } else if (key === 'auth_date' || key === 'can_send_after') {
            parsed[key] = Number(value);
          } else {
            parsed[key] = value;
          }
        }
        setMiniAppInitDataJson(
          JSON.stringify(
            { initDataRaw: raw, parsed, initDataLength: raw.length },
            null,
            2,
          ),
        );
      } catch {
        setMiniAppInitDataJson(JSON.stringify({ initDataRaw: raw }, null, 2));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isTelegramMiniApp]);

  const botName = normalizeTelegramBotUsername(
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? '',
  );
  const siteUrlEnv = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim();

  return (
    <>
      <Head>
        <title>Account | hotManhwammhub</title>
      </Head>
      <div className='flex flex-col gap-6 py-4 md:gap-8 md:py-8'>
        <header className='flex items-center justify-between gap-2 p-2'>
          <div className='flex items-center gap-3 min-w-0 flex-1'>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='h-10 w-10 shrink-0 rounded-full border border-zinc-800 bg-zinc-900/80 text-zinc-100 hover:bg-zinc-800'
              onClick={() => router.back()}
              aria-label='Back'
            >
              <ChevronLeft className='h-6 w-6' />
            </Button>
            <div className='w-14 h-14 rounded-2xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-500 shadow-lg shadow-violet-900/10 shrink-0'>
              <User size={28} />
            </div>
            <div className='flex flex-col min-w-0'>
              <h1 className='text-xl font-black text-zinc-50 uppercase tracking-tight truncate'>
                {profile?.username || 'Guest User'}
              </h1>
              <p className='text-zinc-500 text-[11px] font-bold uppercase tracking-widest truncate'>
                {isAuthenticated && profile?.telegramId
                  ? `Telegram · ${profile.telegramId}`
                  : `ID: ${profile?.id ?? '—'}`}
              </p>
            </div>
          </div>
          <Button
            variant='ghost'
            size='icon'
            className='text-zinc-600 shrink-0'
            aria-label='Settings'
          >
            <Settings size={20} />
          </Button>
        </header>

        {isTelegramMiniApp && miniAppInitDataJson ? (
          <div className='rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3'>
            <p className='mb-2 text-[10px] font-black uppercase tracking-widest text-emerald-500/90'>
              Mini App · initData (debug)
            </p>
            <pre className='max-h-48 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-relaxed text-zinc-400'>
              {miniAppInitDataJson}
            </pre>
          </div>
        ) : null}

        {authError && isTelegramMiniApp ? (
          <div
            role='alert'
            className='flex flex-col gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4 text-left text-sm text-red-300'
          >
            <p className='font-bold text-red-200'>Mini App sign-in failed</p>
            <p className='text-xs leading-relaxed'>{authError}</p>
            <div className='border-t border-red-500/20 pt-3 text-[11px] leading-relaxed text-zinc-400'>
              <p className='mb-2 font-semibold text-zinc-300'>
                Sign-in runs on this Next.js app (Better Auth), not on your Nest
                API URL.
              </p>
              <ul className='list-inside list-disc space-y-2'>
                <li>
                  Server env:{' '}
                  <code className='text-zinc-500'>DATABASE_URL</code>,{' '}
                  <code className='text-zinc-500'>BETTER_AUTH_SECRET</code>,{' '}
                  <code className='text-zinc-500'>TELEGRAM_BOT_TOKEN</code>{' '}
                  (same bot as Mini App),{' '}
                  <code className='text-zinc-500'>BETTER_AUTH_URL</code> = your
                  site origin.
                </li>
                <li>
                  Run DB migrations:{' '}
                  <code className='text-zinc-500'>
                    npx @better-auth/cli migrate -y
                  </code>{' '}
                  (or{' '}
                  <code className='text-zinc-500'>npm run migrate:auth</code>).
                </li>
                <li>
                  Mini App: better-auth-telegram{' '}
                  <code className='text-zinc-500'>autoSignInFromMiniApp</code> →{' '}
                  <code className='text-zinc-500'>
                    POST /api/auth/telegram/miniapp/signin
                  </code>{' '}
                  with <code className='text-zinc-500'>Telegram.WebApp.initData</code>.
                  If sign-in fails, check{' '}
                  <code className='text-zinc-500'>TELEGRAM_BOT_TOKEN</code> and reopen
                  the Mini App (initData expires).
                </li>
                <li>
                  Wallet data may call Nest (
                  <code className='text-zinc-500'>NEXT_PUBLIC_API_URL</code>)
                  with a Better Auth JWT — that is separate from signing in.
                </li>
              </ul>
            </div>
          </div>
        ) : null}

        {!isLoading && status === 'unauthenticated' && !isTelegramMiniApp && (
          <Card className='border-zinc-800 bg-zinc-900/60 rounded-3xl'>
            <CardContent className='flex flex-col gap-6 p-6'>
              <div className='text-center space-y-1'>
                <h2 className='text-sm font-bold text-zinc-200'>
                  Continue with Telegram
                </h2>
                <p className='text-xs text-zinc-500'>
                  Account is created or linked on{' '}
                  <span className='text-zinc-400'>this site</span> via Better Auth (
                  <code className='text-[10px] text-zinc-500'>POST /api/auth/telegram/signin</code>
                  ). Your Nest API (
                  <code className='text-[10px] text-zinc-500'>NEXT_PUBLIC_API_URL</code>
                  ) is used for profile/wallet after login, not for this step.
                </p>
              </div>
              <p className='text-center text-sm font-medium text-zinc-400'>
                Link your account to sync wallet and unlocks.
              </p>
              {telegramDomainHint === 'localhost' ? (
                <div
                  role='status'
                  className='flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-left text-xs text-amber-100/90'
                >
                  <AlertTriangle className='h-5 w-5 shrink-0 text-amber-400' />
                  <div className='space-y-2 leading-relaxed'>
                    <p className='font-bold text-amber-200'>
                      Local desktop · Telegram widget (browser)
                    </p>
                    <p>
                      Run{' '}
                      <code className='rounded bg-zinc-950/50 px-1 py-0.5 text-[11px]'>
                        npm run dev
                      </code>{' '}
                      and open{' '}
                      <code className='rounded bg-zinc-950/50 px-1 text-[11px]'>
                        http://localhost:3000
                      </code>
                      . The Login Widget is built for a public HTTPS domain —
                      Telegram does not allow{' '}
                      <code className='rounded bg-zinc-950/50 px-1 py-0.5 text-[11px]'>
                        localhost
                      </code>{' '}
                      for the Login Widget, so you will see{' '}
                      <strong className='text-amber-200'>Bot domain invalid</strong>{' '}
                      here. Use a public HTTPS URL (e.g.{' '}
                      <span className='whitespace-nowrap'>ngrok</span>) and
                      register <strong>that exact hostname</strong> in
                      @BotFather → Bot Settings → Domain.
                    </p>
                    <p>
                      If the widget says the bot was not found, check{' '}
                      <code className='rounded bg-zinc-950/50 px-1 text-[11px]'>
                        NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
                      </code>{' '}
                      is the <strong>username</strong> only (e.g.{' '}
                      <code className='text-[11px]'>
                        hotmmmanhwapremium_bot
                      </code>
                      ), not the display name and not with{' '}
                      <code className='text-[11px]'>@</code>.
                    </p>
                    <p className='text-amber-200/80'>
                      Or test the widget on your production domain after setting{' '}
                      <code className='rounded bg-zinc-950/50 px-1 text-[11px]'>
                        NEXT_PUBLIC_SITE_URL
                      </code>{' '}
                      to match it.
                    </p>
                  </div>
                </div>
              ) : null}
              {telegramDomainHint === 'host_mismatch' && siteUrlEnv ? (
                <div
                  role='status'
                  className='flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-left text-xs text-amber-100/90'
                >
                  <AlertTriangle className='h-5 w-5 shrink-0 text-amber-400' />
                  <div className='space-y-2 leading-relaxed'>
                    <p className='font-bold text-amber-200'>Domain mismatch</p>
                    <p>
                      You opened this app on{' '}
                      <code className='rounded bg-zinc-950/50 px-1 py-0.5 text-[11px]'>
                        {browserHost || '…'}
                      </code>{' '}
                      but{' '}
                      <code className='rounded bg-zinc-950/50 px-1 text-[11px]'>
                        NEXT_PUBLIC_SITE_URL
                      </code>{' '}
                      is{' '}
                      <code className='break-all rounded bg-zinc-950/50 px-1 text-[11px]'>
                        {siteUrlEnv}
                      </code>
                      . Telegram requires the site origin to match the bot
                      domain in BotFather (including{' '}
                      <code className='text-[11px]'>www</code> vs non-www).
                    </p>
                  </div>
                </div>
              ) : null}
              {telegramDomainHint === null && browserHost ? (
                <div
                  role='status'
                  className='flex gap-3 rounded-2xl border border-zinc-700/60 bg-zinc-950/40 p-4 text-left text-xs text-zinc-300'
                >
                  <AlertTriangle className='h-5 w-5 shrink-0 text-zinc-500' />
                  <div className='space-y-2 leading-relaxed'>
                    <p className='font-bold text-zinc-200'>
                      If Telegram shows &quot;Bot domain invalid&quot;
                    </p>
                    <p>
                      The hostname in your address bar must be registered for
                      this bot. In @BotFather open your bot →{' '}
                      <strong className='text-zinc-200'>Bot Settings</strong> →{' '}
                      <strong className='text-zinc-200'>Configure Domain</strong>{' '}
                      (or send <code className='text-[11px]'>/setdomain</code>).
                      Add <strong className='text-zinc-200'>only</strong> the host
                      name below (no <code className='text-[11px]'>https://</code>
                      , no path):
                    </p>
                    <p className='rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 py-2 font-mono text-[13px] text-emerald-300/90'>
                      {browserHost}
                    </p>
                    <p className='text-zinc-500'>
                      <code className='text-[11px] text-zinc-400'>www</code> and
                      apex domains are different — register the one you actually
                      use. Each preview URL (e.g. Vercel{' '}
                      <code className='text-[11px]'>*.vercel.app</code>) needs
                      its own entry unless you use a single custom domain.
                    </p>
                  </div>
                </div>
              ) : null}
              {botName ? (
                <div className='flex w-full max-w-md flex-col gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-5 mx-auto'>
                  <TelegramLoginWidget
                    botName={botName}
                    className='min-h-[72px]'
                    globalCallbackName='onTelegramAuthProfile'
                    onAuth={async (u) => {
                      setTelegramError(null);
                      try {
                        await signInWithTelegramBrowser(u);
                      } catch (e) {
                        setTelegramError(
                          e instanceof Error
                            ? e.message
                            : 'Telegram sign-in failed',
                        );
                      }
                    }}
                  />
                  {telegramError ? (
                    <p className='text-center text-xs text-red-400'>
                      {telegramError}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className='text-center text-xs text-zinc-600'>
                  Set{' '}
                  <code className='text-zinc-500'>
                    NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
                  </code>{' '}
                  for the Telegram buttons.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card className='bg-zinc-900 border-zinc-800 rounded-3xl overflow-hidden shadow-2xl shadow-zinc-950/50'>
          <CardContent className='p-8 flex flex-col items-center justify-center gap-1 relative overflow-hidden'>
            <div className='absolute top-0 right-0 p-8 opacity-5'>
              <Star size={120} className='text-amber-400 fill-amber-400' />
            </div>

            <span className='text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2'>
              Available Balance
            </span>
            <div className='flex items-center gap-3'>
              <span className='text-5xl font-black text-zinc-50 tracking-tighter'>
                {!isAuthenticated ? '—' : (profile?.coins ?? 0)}
              </span>
              <div className='flex flex-col'>
                <Star className='w-5 h-5 text-amber-500 fill-amber-500 mb-0.5' />
                <span className='text-[10px] font-black text-amber-500 uppercase'>
                  Coins
                </span>
              </div>
            </div>

            <Button
              onClick={() => router.push('/shop')}
              className='mt-8 w-full bg-zinc-50 hover:bg-zinc-200 text-zinc-950 h-12 text-xs font-black rounded-xl uppercase tracking-[0.15em]'
            >
              Top Up Now
            </Button>
          </CardContent>
        </Card>

        <div className='flex flex-col gap-2 mt-2'>
          <h3 className='text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] px-2 mb-2'>
            History & Activity
          </h3>
          <Button
            variant='ghost'
            className='justify-start gap-4 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-900 h-14 rounded-2xl px-4'
          >
            <div className='w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center'>
              <Wallet size={18} />
            </div>
            <span className='text-sm font-bold'>Transaction History</span>
          </Button>
          <Button
            variant='ghost'
            className='justify-start gap-4 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-900 h-14 rounded-2xl px-4'
          >
            <div className='w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center'>
              <History size={18} />
            </div>
            <span className='text-sm font-bold'>Recently Read</span>
          </Button>

          {isAuthenticated ? (
            <>
              <div className='h-px bg-zinc-900 my-4' />
              <Button
                variant='ghost'
                className='justify-start gap-4 text-red-500/60 hover:text-red-400 hover:bg-red-500/5 h-14 rounded-2xl px-4'
                type='button'
                onClick={() => void signOut()}
              >
                <div className='w-10 h-10 rounded-xl bg-red-500/5 flex items-center justify-center'>
                  <LogOut size={18} />
                </div>
                <span className='text-sm font-bold'>Logout Session</span>
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
