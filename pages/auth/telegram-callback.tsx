import { useAuth } from "@/components/AuthProvider";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

const QUERY_SKIP = new Set(["mode", "next"]);

/** Telegram Login Widget redirects here with `id`, `hash`, `auth_date`, etc. */
export default function TelegramAuthCallbackPage() {
  const router = useRouter();
  const { loginWithTelegramBrowser } = useAuth();
  const [message, setMessage] = useState("Signing in with Telegram…");
  const [isError, setIsError] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!router.isReady || startedRef.current) return;
    const q = router.query;
    if (!q || Object.keys(q).length === 0) return;

    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(q)) {
      if (QUERY_SKIP.has(k)) continue;
      if (typeof v === "string") fields[k] = v;
      else if (Array.isArray(v) && typeof v[0] === "string") fields[k] = v[0];
    }

    if (!fields.id) {
      setIsError(true);
      setMessage("Missing Telegram login payload. Open the app from Telegram or try again.");
      return;
    }

    startedRef.current = true;
    loginWithTelegramBrowser(fields)
      .then(() => {
        const next =
          typeof router.query.next === "string" && router.query.next.startsWith("/")
            ? router.query.next
            : "/profile";
        router.replace(next);
      })
      .catch((e: unknown) => {
        startedRef.current = false;
        setIsError(true);
        setMessage(
          e instanceof Error ? e.message : "Could not complete Telegram sign-in.",
        );
      });
  }, [
    router.isReady,
    router.query,
    loginWithTelegramBrowser,
    router,
  ]);

  return (
    <>
      <Head>
        <title>Telegram sign-in | hotManhwammhub</title>
      </Head>
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 p-6 md:p-10">
        <p
          className={`max-w-md text-center text-sm font-medium md:text-base ${isError ? "text-red-400" : "text-zinc-300"}`}
        >
          {message}
        </p>
      </div>
    </>
  );
}
