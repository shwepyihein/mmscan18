import { useEffect, useRef } from "react";

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
  onAuth: (user: TelegramUser) => void;
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
  
  // Create a ref for the callback so it's fresh in the closure
  const onAuthRef = useRef(onAuth);
  useEffect(() => {
    onAuthRef.current = onAuth;
  }, [onAuth]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Define the global callback
    (window as any).onTelegramAuth = (user: TelegramUser) => {
      onAuthRef.current(user);
    };

    // Clear previous widget
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botName);
    script.setAttribute("data-size", buttonSize);
    script.setAttribute("data-radius", cornerRadius.toString());
    script.setAttribute("data-request-access", requestAccess);
    script.setAttribute("data-onauth", "onTelegramAuth(user)");

    containerRef.current.appendChild(script);

    return () => {
      delete (window as any).onTelegramAuth;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [botName, buttonSize, cornerRadius, requestAccess]);

  return <div ref={containerRef} className="flex justify-center" />;
}
