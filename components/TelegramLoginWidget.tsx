import { useEffect, useRef } from "react";
import { normalizeTelegramBotUsername } from "@/lib/telegram-bot-username";
import { getPublicSiteUrl } from "@/lib/site-url";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export type TelegramAuthMode = "login" | "register";

interface TelegramLoginWidgetProps {
  botName: string;
  /**
   * Same-page login (localhost / when `NEXT_PUBLIC_SITE_URL` is unset).
   * Not used when redirect mode is active (production with `NEXT_PUBLIC_SITE_URL`).
   */
  onAuth?: (user: TelegramUser) => void | Promise<void>;
  /** Must be unique if multiple widgets mount (e.g. `onTelegramAuthLogin` / `onTelegramAuthRegister`). */
  globalCallbackName?: string;
  /** Sent as `?mode=` on redirect callback URL. */
  authMode?: TelegramAuthMode;
  buttonSize?: "large" | "medium" | "small";
  cornerRadius?: number;
  requestAccess?: "write" | "read";
}

export function TelegramLoginWidget({
  botName,
  onAuth,
  globalCallbackName = "onTelegramAuth",
  authMode = "login",
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
      url.searchParams.set("mode", authMode);
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
  }, [
    botName,
    buttonSize,
    cornerRadius,
    requestAccess,
    globalCallbackName,
    authMode,
  ]);

  return <div ref={containerRef} className="flex justify-center" />;
}
