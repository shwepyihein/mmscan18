import { useAuth } from "@/components/AuthProvider";
import { TelegramLoginWidget } from "@/components/TelegramLoginWidget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeTelegramBotUsername } from "@/lib/telegram-bot-username";
import Head from "next/head";
import { useRouter } from "next/router";
import { LogIn } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const {
    signInWithTelegramBrowser,
    signInWithEmailPassword,
    error,
    isAuthenticated,
    status,
    isTelegramMiniApp,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const submitting = status === "loading";

  const botName = normalizeTelegramBotUsername(
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "",
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    const raw =
      typeof router.query.next === "string" ? router.query.next : "/profile";
    const next =
      raw.startsWith("/") && !raw.startsWith("//") ? raw : "/profile";
    void router.replace(next);
  }, [isAuthenticated, router]);

  async function onEmailSubmit(e: FormEvent) {
    e.preventDefault();
    await signInWithEmailPassword(email, password);
  }

  if (isTelegramMiniApp) {
    return (
      <>
        <Head>
          <title>Sign in | hotManhwammhub</title>
        </Head>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 py-16 text-center">
          <p className="text-sm text-zinc-500">
            Open this app from Telegram to sign in, or use a normal browser.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Sign in | hotManhwammhub</title>
      </Head>
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-10 px-6 py-16">
        <div className="flex flex-col items-center gap-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-violet-500/20 bg-violet-600/10 text-violet-500 shadow-2xl shadow-violet-900/10">
            <LogIn size={48} />
          </div>
          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-3xl font-black uppercase tracking-tighter text-zinc-50">
              Welcome
            </h1>
            <p className="max-w-[280px] text-sm font-medium leading-relaxed text-zinc-500">
              Sign in with email or Telegram to access your premium library.
            </p>
          </div>
        </div>

        <form
          onSubmit={(e) => void onEmailSubmit(e)}
          className="flex w-full max-w-xs flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="login-email"
              className="text-[10px] font-black uppercase tracking-widest text-zinc-500"
            >
              Email
            </label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={submitting}
              className="border-zinc-800 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-600"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="login-password"
              className="text-[10px] font-black uppercase tracking-widest text-zinc-500"
            >
              Password
            </label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={submitting}
              className="border-zinc-800 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-600"
            />
          </div>
          <Button
            type="submit"
            disabled={submitting}
            className="h-11 w-full bg-violet-600 font-bold text-white hover:bg-violet-500"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="relative flex w-full max-w-xs items-center gap-4 py-2">
          <div className="h-px flex-1 bg-zinc-800" />
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
            or
          </span>
          <div className="h-px flex-1 bg-zinc-800" />
        </div>

        <div className="flex w-full max-w-xs flex-col gap-4">
          <TelegramLoginWidget
            botName={botName}
            onAuth={signInWithTelegramBrowser}
          />
          <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-600">
            Secure login via Telegram
          </p>
        </div>

        {error ? (
          <p className="rounded-full border border-red-500/10 bg-red-500/5 px-4 py-2 text-xs font-medium text-red-400">
            {error}
          </p>
        ) : null}
      </div>
    </>
  );
}
