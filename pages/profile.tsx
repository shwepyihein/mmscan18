import Head from "next/head";
import { User, Wallet, History, LogOut, Star, Settings, ChevronLeft, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/components/AuthProvider";
import { TelegramLoginWidget } from "@/components/TelegramLoginWidget";
import { useUserStore } from "@/store/useUserStore";
import { useRouter } from "next/router";
import { useState } from "react";

export default function Profile() {
  const router = useRouter();
  const profile = useUserStore((state) => state.profile);
  const {
    status,
    isTelegramMiniApp,
    loginWithTelegramBrowser,
    registerWithTelegramBrowser,
    signOut,
    isLoading,
    error: authError,
  } = useAuth();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const botName = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "").trim();

  return (
    <>
      <Head>
        <title>Account | hotManhwammhub</title>
      </Head>
      <div className="p-4 flex flex-col gap-6">
        <header className="flex items-center justify-between gap-2 p-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full border border-zinc-800 bg-zinc-900/80 text-zinc-100 hover:bg-zinc-800"
              onClick={() => router.back()}
              aria-label="Back"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <div className="w-14 h-14 rounded-2xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-500 shadow-lg shadow-violet-900/10 shrink-0">
              <User size={28} />
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-xl font-black text-zinc-50 uppercase tracking-tight truncate">
                {profile?.username || "Guest User"}
              </h1>
              <p className="text-zinc-500 text-[11px] font-bold uppercase tracking-widest truncate">
                ID: {profile?.id || "---"}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="text-zinc-600 shrink-0" aria-label="Settings">
            <Settings size={20} />
          </Button>
        </header>

        {authError && isTelegramMiniApp ? (
          <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-center text-sm text-red-400">
            {authError}
          </p>
        ) : null}

        {!isLoading && status === "unauthenticated" && !isTelegramMiniApp && (
          <Card className="border-zinc-800 bg-zinc-900/60 rounded-3xl">
            <CardContent className="flex flex-col gap-6 p-6">
              <p className="text-center text-sm font-medium text-zinc-400">
                Use Telegram in the browser to sync your wallet and unlocks.
              </p>
              {botName ? (
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-4">
                    <div className="flex items-center justify-center gap-2 text-zinc-200">
                      <LogIn className="h-4 w-4 text-violet-400" />
                      <span className="text-xs font-black uppercase tracking-widest">
                        Login
                      </span>
                    </div>
                    <TelegramLoginWidget
                      botName={botName}
                      authMode="login"
                      globalCallbackName="onTelegramAuthLogin"
                      onAuth={async (u) => {
                        setLoginError(null);
                        setRegisterError(null);
                        try {
                          await loginWithTelegramBrowser(u);
                        } catch (e) {
                          setLoginError(
                            e instanceof Error ? e.message : "Telegram login failed",
                          );
                        }
                      }}
                    />
                    {loginError ? (
                      <p className="text-center text-xs text-red-400">{loginError}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-4">
                    <div className="flex items-center justify-center gap-2 text-zinc-200">
                      <UserPlus className="h-4 w-4 text-emerald-400" />
                      <span className="text-xs font-black uppercase tracking-widest">
                        Register
                      </span>
                    </div>
                    <TelegramLoginWidget
                      botName={botName}
                      authMode="register"
                      globalCallbackName="onTelegramAuthRegister"
                      onAuth={async (u) => {
                        setRegisterError(null);
                        setLoginError(null);
                        try {
                          await registerWithTelegramBrowser(u);
                        } catch (e) {
                          setRegisterError(
                            e instanceof Error ? e.message : "Telegram register failed",
                          );
                        }
                      }}
                    />
                    {registerError ? (
                      <p className="text-center text-xs text-red-400">{registerError}</p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-center text-xs text-zinc-600">
                  Set{" "}
                  <code className="text-zinc-500">NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</code>{" "}
                  for the Telegram buttons.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="bg-zinc-900 border-zinc-800 rounded-3xl overflow-hidden shadow-2xl shadow-zinc-950/50">
          <CardContent className="p-8 flex flex-col items-center justify-center gap-1 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
               <Star size={120} className="text-amber-400 fill-amber-400" />
            </div>
            
            <span className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Available Balance</span>
            <div className="flex items-center gap-3">
              <span className="text-5xl font-black text-zinc-50 tracking-tighter">
                {profile?.coins || 0}
              </span>
              <div className="flex flex-col">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500 mb-0.5" />
                <span className="text-[10px] font-black text-amber-500 uppercase">Coins</span>
              </div>
            </div>
            
            <Button 
              onClick={() => router.push("/shop")}
              className="mt-8 w-full bg-zinc-50 hover:bg-zinc-200 text-zinc-950 h-12 text-xs font-black rounded-xl uppercase tracking-[0.15em]"
            >
              Top Up Now
            </Button>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2 mt-2">
          <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] px-2 mb-2">History & Activity</h3>
          <Button variant="ghost" className="justify-start gap-4 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-900 h-14 rounded-2xl px-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center">
               <Wallet size={18} />
            </div>
            <span className="text-sm font-bold">Transaction History</span>
          </Button>
          <Button variant="ghost" className="justify-start gap-4 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-900 h-14 rounded-2xl px-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center">
               <History size={18} />
            </div>
            <span className="text-sm font-bold">Recently Read</span>
          </Button>
          
          <div className="h-px bg-zinc-900 my-4" />
          
          <Button
            variant="ghost"
            className="justify-start gap-4 text-red-500/60 hover:text-red-400 hover:bg-red-500/5 h-14 rounded-2xl px-4"
            onClick={() => signOut()}
          >
            <div className="w-10 h-10 rounded-xl bg-red-500/5 flex items-center justify-center">
               <LogOut size={18} />
            </div>
            <span className="text-sm font-bold">Logout Session</span>
          </Button>
        </div>
      </div>
    </>
  );
}
