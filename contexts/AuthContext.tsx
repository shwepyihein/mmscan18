import {
  fetchCurrentProfile,
  syncTelegramUser,
  clearClientAuthSession,
} from "@/api/users";
import { authClient } from "@/lib/auth-client";
import { setStoredAuthToken } from "@/lib/api-client";
import { useUserStore } from "@/store/useUserStore";
import { isTMA, retrieveLaunchParams } from "@telegram-apps/sdk";
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
  /** Browser: Telegram Login Widget payload or `/auth/telegram-callback` query. */
  loginWithTelegramBrowser: (fields: object) => Promise<void>;
  /** Browser: same widget payload; creates a new Better Auth user. */
  registerWithTelegramBrowser: (fields: object) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Convenience for UI */
  isAuthenticated: boolean;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function refreshJwtForNest(): Promise<void> {
  const { data, error } = await authClient.token();
  if (error || !data?.token) {
    setStoredAuthToken(null);
    return;
  }
  setStoredAuthToken(data.token);
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

function toStringFields(fields: object): Record<string, string> {
  const stringFields: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    stringFields[k] = typeof v === "string" ? v : String(v);
  }
  return stringFields;
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

  /** Mini App: verify initData with Better Auth, then refetch session. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tma = await isTMA();
      if (cancelled) return;
      setIsTelegramMiniApp(tma);
      if (!tma) {
        setTmaBootstrapped(true);
        return;
      }
      try {
        const lp = retrieveLaunchParams();
        const raw = lp.initDataRaw;
        if (!raw) {
          setTmaBootstrapped(true);
          return;
        }
        await syncTelegramUser(raw);
        await refetch();
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

  const signInWithTelegramWidget = useCallback(
    async (fields: object) => {
      setError(null);
      const res = await fetch("/api/auth/telegram/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(toStringFields(fields)),
      });
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!res.ok) {
        throw new Error(
          typeof body?.message === "string" ? body.message : "Telegram login failed",
        );
      }
      await refetch();
      await refreshJwtForNest();
      await refreshProfile();
    },
    [refetch, refreshProfile],
  );

  const loginWithTelegramBrowser = signInWithTelegramWidget;

  const registerWithTelegramBrowser = signInWithTelegramWidget;

  const isLoading = status === "loading" || isPending || !tmaBootstrapped;
  const isAuthenticated = status === "authenticated";

  const value = useMemo(
    () => ({
      status,
      isTelegramMiniApp,
      error,
      loginWithTelegramBrowser,
      registerWithTelegramBrowser,
      refreshProfile,
      signOut,
      isAuthenticated,
      isLoading,
    }),
    [
      status,
      isTelegramMiniApp,
      error,
      loginWithTelegramBrowser,
      registerWithTelegramBrowser,
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
