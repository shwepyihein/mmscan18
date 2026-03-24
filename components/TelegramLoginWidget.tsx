import { useEffect, useRef } from "react";
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

interface TelegramLoginWidgetProps {
  botName: string;
  /**
   * Same-page login (localhost / when `NEXT_PUBLIC_SITE_URL` is unset).
   * Not used when redirect mode is active (production with `NEXT_PUBLIC_SITE_URL`).
   */
  onAuth?: (user: TelegramUser) => void | Promise<void>;
  buttonSize?: "large" | "medium" | "small";
  cornerRadius?: number;
  requestAccess?: "write" | "read";
}

export function TelegramLoginWidget({
  botName,
  onAuth,
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

    const siteUrl = getPublicSiteUrl();
    const useRedirect = Boolean(siteUrl);

    if (!useRedirect && typeof onAuthRef.current !== "function") {
      return;
    }

    if (!useRedirect) {
      (window as unknown as { onTelegramAuth?: (user: TelegramUser) => void }).onTelegramAuth = (
        user: TelegramUser,
      ) => {
        void onAuthRef.current?.(user);
      };
    }

    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botName);
    script.setAttribute("data-size", buttonSize);
    script.setAttribute("data-radius", cornerRadius.toString());
    script.setAttribute("data-request-access", requestAccess);

    if (useRedirect && siteUrl) {
      script.setAttribute(
        "data-auth-url",
        `${siteUrl}/auth/telegram-callback`,
      );
    } else {
      script.setAttribute("data-onauth", "onTelegramAuth(user)");
    }

    containerRef.current.appendChild(script);

    return () => {
      if (!useRedirect) {
        delete (window as unknown as { onTelegramAuth?: unknown }).onTelegramAuth;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [botName, buttonSize, cornerRadius, requestAccess]);

  return <div ref={containerRef} className="flex justify-center" />;
}
