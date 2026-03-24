import { fetchCurrentProfile, clearClientAuthSession, syncNestTelegramLogin } from "@/api/users";
import {
  authClient,
  reloadOnceForTelegramInitData,
  signInTelegramMiniApp,
  signInWithTelegramBrowser as exchangeTelegramWidgetForSession,
  waitForTelegramInitData,
  waitForTelegramWebApp,
} from "@/lib/auth-client";
import { setStoredAuthToken, getStoredAuthToken } from "@/lib/api-client";
import { useUserStore } from "@/store/useUserStore";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  isTelegramMiniApp: boolean;
  error: string | null;
  /** Browser: Telegram Login Widget or `/auth/telegram-callback` → Better Auth (sign-in + create user). Not Nest. */
  signInWithTelegramBrowser: (fields: object) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Convenience for UI */
  isAuthenticated: boolean;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function refreshJwtForNest(): Promise<void> {
  // If we already have a token from NestJS, do not overwrite it with Better Auth's local JWT
  if (getStoredAuthToken()) return;
  
  try {
    const { data, error } = await authClient.token();
    if (error || !data?.token) {
      setStoredAuthToken(null);
      return;
    }
    setStoredAuthToken(data.token);
  } catch {
    setStoredAuthToken(null);
  }
}

function fallbackProfileFromSessionUser(user: {
  id: string;
  name?: string | null;
  telegramId?: string | null;
}) {
  return {
    id: user.id,
    telegramId: String(user.telegramId ?? user.id),
    username: user.name ?? undefined,
    coins: 0,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending, error: sessionError, refetch } =
    authClient.useSession();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [isTelegramMiniApp, setIsTelegramMiniApp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tmaBootstrapped, setTmaBootstrapped] = useState(false);
  const setProfile = useUserStore((s) => s.setProfile);
  const logoutStore = useUserStore((s) => s.logout);

  const user = session?.user;

  const refreshProfile = useCallback(async () => {
    await refreshJwtForNest();
    try {
      const p = await fetchCurrentProfile();
      setProfile(p);
    } catch {
      const r = await fetch("/api/auth/get-session", { credentials: "include" });
      const j = (await r.json()) as {
        user?: { id: string; name?: string | null; telegramId?: string | null };
      };
      if (j?.user) setProfile(fallbackProfileFromSessionUser(j.user));
    }
    setStatus("authenticated");
  }, [setProfile]);

  const signOut = useCallback(async () => {
    await authClient.signOut();
    clearClientAuthSession();
    logoutStore();
    setStatus("unauthenticated");
  }, [logoutStore]);

  /**
   * Mini App: better-auth-telegram `signInWithMiniApp` using `Telegram.WebApp.initData`
   * (no @telegram-apps/sdk — detection via `window.Telegram.WebApp`).
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined") {
        setTmaBootstrapped(true);
        return;
      }
      const inMiniApp = await waitForTelegramWebApp();
      if (cancelled) return;
      setIsTelegramMiniApp(inMiniApp);
      if (!inMiniApp) {
        setTmaBootstrapped(true);
        return;
      }
      const initData = await waitForTelegramInitData();
      if (cancelled) return;
      if (!initData?.trim()) {
        if (reloadOnceForTelegramInitData()) {
          return;
        }
        setTmaBootstrapped(true);
        return;
      }
      try {
        await syncNestTelegramLogin(initData);
        await signInTelegramMiniApp();
        await refetch();
        await refreshProfile();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Telegram sync failed");
        }
      } finally {
        if (!cancelled) setTmaBootstrapped(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refetch]);

  /** Derive status + profile from Better Auth session + Nest `/auth/me`. */
  useEffect(() => {
    if (!tmaBootstrapped || isPending) {
      setStatus("loading");
      return;
    }

    if (!user) {
      setStatus("unauthenticated");
      return;
    }

    let cancelled = false;
    (async () => {
      await refreshJwtForNest();
      try {
        const p = await fetchCurrentProfile();
        if (!cancelled) {
          setProfile(p);
          setStatus("authenticated");
        }
      } catch {
        if (!cancelled) {
          const r = await fetch("/api/auth/get-session", { credentials: "include" });
          const j = (await r.json()) as {
            user?: { id: string; name?: string | null; telegramId?: string | null };
          };
          if (j?.user) setProfile(fallbackProfileFromSessionUser(j.user));
          setStatus("authenticated");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isPending, tmaBootstrapped, user, setProfile]);

  useEffect(() => {
    if (sessionError) {
      setError(sessionError.message ?? "Session error");
    }
  }, [sessionError]);

  const signInWithTelegramBrowser = useCallback(
    async (fields: object) => {
      setError(null);
      await syncNestTelegramLogin(fields);
      await exchangeTelegramWidgetForSession(fields);
      await refetch();
      await refreshProfile();
    },
    [refetch, refreshProfile],
  );

  const isLoading = status === "loading" || isPending || !tmaBootstrapped;
  const isAuthenticated = status === "authenticated";

  const value = useMemo(
    () => ({
      status,
      isTelegramMiniApp,
      error,
      signInWithTelegramBrowser,
      refreshProfile,
      signOut,
      isAuthenticated,
      isLoading,
    }),
    [
      status,
      isTelegramMiniApp,
      error,
      signInWithTelegramBrowser,
      refreshProfile,
      signOut,
      isAuthenticated,
      isLoading,
    ],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
