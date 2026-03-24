import { useEffect, useRef } from "react";
import { normalizeTelegramBotUsername } from "@/lib/telegram-bot-username";
import { getPublicSiteUrl } from "@/lib/site-url";
import { cn } from "@/lib/utils";

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
  buttonSize?: "large" | "medium" | "small";
  cornerRadius?: number;
  requestAccess?: "write" | "read";
}

export function TelegramLoginWidget({
  botName,
  className = "",
  onAuth,
  globalCallbackName = "onTelegramAuth",
  buttonSize = "large",
  cornerRadius = 8,
  requestAccess = "write",
}: TelegramLoginWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onAuthRef = useRef(onAuth);
  useEffect(() => {
    onAuthRef.current = onAuth;
  }, [onAuth]);

  useEffect(() => {
    if (!containerRef.current) return;

    const bot = normalizeTelegramBotUsername(botName);
    if (!bot) return;

    const siteUrl = getPublicSiteUrl();
    const useRedirect = Boolean(siteUrl);

    if (!useRedirect && typeof onAuthRef.current !== "function") {
      return;
    }

    const w = window as unknown as Record<string, unknown>;

    if (!useRedirect) {
      w[globalCallbackName] = (user: TelegramUser) => {
        void onAuthRef.current?.(user);
      };
    }

    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", bot);
    script.setAttribute("data-size", buttonSize);
    script.setAttribute("data-radius", cornerRadius.toString());
    script.setAttribute("data-request-access", requestAccess);

    if (useRedirect && siteUrl) {
      const url = new URL(`${siteUrl}/auth/telegram-callback`);
      script.setAttribute("data-auth-url", url.toString());
    } else {
      script.setAttribute("data-onauth", `${globalCallbackName}(user)`);
    }

    containerRef.current.appendChild(script);

    return () => {
      if (!useRedirect) {
        delete w[globalCallbackName];
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [botName, buttonSize, cornerRadius, requestAccess, globalCallbackName]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex min-h-[52px] w-full flex-col items-center justify-center rounded-xl border border-zinc-700/40 bg-zinc-950/50 px-2 py-3",
        className,
      )}
    />
  );
}
