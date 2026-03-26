import { getPublicSiteUrl } from '@/lib/site-url';
import { getTelegramLoginWidgetBlockReason } from '@/lib/telegram-domain';
import { normalizeTelegramBotUsername } from '@/lib/telegram-bot-username';
import { cn } from '@/lib/utils';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface TelegramLoginWidgetProps {
  botName: string;
  /** Extra classes on the widget wrapper (min-height helps while the iframe loads). */
  className?: string;
  /**
   * Same-page login (localhost / when `NEXT_PUBLIC_SITE_URL` is unset).
   * Not used when redirect mode is active (production with `NEXT_PUBLIC_SITE_URL`).
   */
  onAuth?: (user: TelegramUser) => void | Promise<void>;
  /** Must be unique if multiple widgets mount. */
  globalCallbackName?: string;
  buttonSize?: 'large' | 'medium' | 'small';
  cornerRadius?: number;
  requestAccess?: 'write' | 'read';
}

export function TelegramLoginWidget({
  botName,
  className = '',
  onAuth,
  globalCallbackName = 'onTelegramAuth',
  buttonSize = 'large',
  cornerRadius = 8,
  requestAccess = 'write',
}: TelegramLoginWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onAuthRef = useRef(onAuth);
  const [domainBlock, setDomainBlock] = useState<string | null>(null);

  useEffect(() => {
    onAuthRef.current = onAuth;
  }, [onAuth]);

  useLayoutEffect(() => {
    setDomainBlock(getTelegramLoginWidgetBlockReason());
  }, []);

  useEffect(() => {
    if (!containerRef.current || domainBlock !== null) {
      if (containerRef.current) containerRef.current.innerHTML = '';
      return;
    }

    const bot = normalizeTelegramBotUsername(botName);
    if (!bot) return;

    const siteUrl = getPublicSiteUrl();
    const useRedirect = Boolean(siteUrl);

    if (!useRedirect && typeof onAuthRef.current !== 'function') {
      return;
    }

    const w = window as unknown as Record<string, unknown>;

    if (!useRedirect) {
      w[globalCallbackName] = (user: TelegramUser) => {
        void onAuthRef.current?.(user);
      };
    }

    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', bot);
    script.setAttribute('data-size', buttonSize);
    script.setAttribute('data-radius', cornerRadius.toString());
    script.setAttribute('data-request-access', requestAccess);

    if (useRedirect && siteUrl) {
      const url = new URL(`${siteUrl}/auth/telegram-callback`);
      script.setAttribute('data-auth-url', url.toString());
    } else {
      script.setAttribute('data-onauth', `${globalCallbackName}(user)`);
    }

    containerRef.current.appendChild(script);

    return () => {
      if (!useRedirect) {
        delete w[globalCallbackName];
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [
    botName,
    buttonSize,
    cornerRadius,
    requestAccess,
    globalCallbackName,
    domainBlock,
  ]);

  const botNormalized = normalizeTelegramBotUsername(botName);

  return (
    <div
      className={cn(
        'flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-zinc-700/40 bg-zinc-950/50 px-2 py-3',
        className,
      )}
    >
      {!botNormalized ? (
        <p className='px-2 text-center text-xs text-amber-500/90 leading-relaxed'>
          Set <code className='text-zinc-400'>NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</code> to your
          bot&apos;s username (from @BotFather), not the display name.
        </p>
      ) : null}

      {domainBlock ? (
        <p className='max-w-xs px-2 text-center text-xs text-amber-500/90 leading-relaxed'>
          {domainBlock}
        </p>
      ) : null}

      <div
        ref={containerRef}
        className={cn(
          'flex min-h-[52px] w-full flex-col items-center justify-center',
          domainBlock || !botNormalized ? 'min-h-0' : null,
        )}
      />
    </div>
  );
}
