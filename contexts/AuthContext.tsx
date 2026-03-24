import {
  fetchCurrentProfile,
  loginWithTelegramWidget,
  registerWithTelegramWidget,
  syncTelegramUser,
  clearClientAuthSession,
} from "@/api/users";
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
  /** Browser: same widget payload, upstream `/auth/telegram-register`. */
  registerWithTelegramBrowser: (fields: object) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => void;
  /** Convenience for UI */
  isAuthenticated: boolean;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [isTelegramMiniApp, setIsTelegramMiniApp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setProfile = useUserStore((s) => s.setProfile);
  const logoutStore = useUserStore((s) => s.logout);

  const refreshProfile = useCallback(async () => {
    const p = await fetchCurrentProfile();
    setProfile(p);
    setStatus("authenticated");
  }, [setProfile]);

  const signOut = useCallback(() => {
    clearClientAuthSession();
    logoutStore();
    setStatus("unauthenticated");
  }, [logoutStore]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const tma = await isTMA();
        if (cancelled) return;
        setIsTelegramMiniApp(tma);

        if (tma) {
          try {
            const lp = retrieveLaunchParams();
            const raw = lp.initDataRaw;
            if (!raw) {
              setStatus("unauthenticated");
              return;
            }
            const profile = await syncTelegramUser(raw);
            if (!cancelled) {
              setProfile(profile);
              setStatus("authenticated");
            }
          } catch (e) {
            if (!cancelled) {
              setError(
                e instanceof Error ? e.message : "Telegram sync failed",
              );
              setStatus("unauthenticated");
            }
          }
          return;
        }

        try {
          const p = await fetchCurrentProfile();
          if (!cancelled) {
            setProfile(p);
            setStatus("authenticated");
          }
        } catch {
          if (!cancelled) setStatus("unauthenticated");
        }
      } catch {
        if (!cancelled) setStatus("unauthenticated");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setProfile]);

  const toStringFields = (fields: object): Record<string, string> => {
    const stringFields: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined || v === null) continue;
      stringFields[k] = typeof v === "string" ? v : String(v);
    }
    return stringFields;
  };

  const loginWithTelegramBrowser = useCallback(
    async (fields: object) => {
      setError(null);
      const profile = await loginWithTelegramWidget(toStringFields(fields));
      setProfile(profile);
      setStatus("authenticated");
    },
    [setProfile],
  );

  const registerWithTelegramBrowser = useCallback(
    async (fields: object) => {
      setError(null);
      const profile = await registerWithTelegramWidget(toStringFields(fields));
      setProfile(profile);
      setStatus("authenticated");
    },
    [setProfile],
  );

  const isLoading = status === "loading";
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
