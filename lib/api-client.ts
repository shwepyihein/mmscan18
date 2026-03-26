import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";
import { getBackendBaseUrl } from "@/lib/backend-base-url";

const API_URL = getBackendBaseUrl();

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

const TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "auth_refresh_token";

type RetryableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

function unwrapNestEnvelope(payload: unknown): Record<string, unknown> | null {
  const raw =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : null;
  if (!raw) return null;
  const inner = raw.data;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    return inner as Record<string, unknown>;
  }
  return raw;
}

function pickAccessToken(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const t = p.accessToken ?? p.token ?? p.access_token ?? p.jwt;
  return typeof t === "string" && t.length > 0 ? t : null;
}

function pickRefreshTokenFromDto(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const t = p.refreshToken ?? p.refresh_token;
  return typeof t === "string" && t.length > 0 ? t : null;
}

/** Nest `AuthResponseDto` (flat or `{ data: ... }`) → sessionStorage. */
export function applyNestAuthResponseDto(data: unknown): void {
  const inner = unwrapNestEnvelope(data);
  const root = inner ?? (data && typeof data === "object" ? data : null);
  if (!root || typeof root !== "object") return;
  const token =
    pickAccessToken(root) ??
    (inner && typeof inner === "object" ? pickAccessToken(inner) : null);
  const refresh =
    pickRefreshTokenFromDto(root) ??
    (inner && typeof inner === "object"
      ? pickRefreshTokenFromDto(inner)
      : null);
  if (token) setStoredAuthToken(token);
  if (refresh) setStoredRefreshToken(refresh);
}

export function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setStoredAuthToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setStoredRefreshToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
  else sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}

/** `POST /auth/refresh` with raw axios (no Bearer); updates stored tokens. */
export async function refreshBackendSession(): Promise<boolean> {
  const rt = getStoredRefreshToken();
  if (!rt) return false;
  try {
    const res = await axios.post<unknown>(
      `${API_URL}/auth/refresh`,
      { refreshToken: rt },
      { withCredentials: true },
    );
    applyNestAuthResponseDto(res.data);
    const inner = unwrapNestEnvelope(res.data) ?? res.data;
    return Boolean(
      pickAccessToken(inner) ??
        (typeof res.data === "object" && res.data
          ? pickAccessToken(res.data)
          : null),
    );
  } catch {
    return false;
  }
}

function isAuthMutationPath(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes("auth/refresh") ||
    u.includes("auth/login") ||
    u.includes("auth/telegram-register") ||
    u.includes("auth/telegram-login") ||
    u.includes("auth/telegram-user-exists")
  );
}

let refreshQueue: Promise<boolean> | null = null;

function enqueueRefresh(): Promise<boolean> {
  if (!refreshQueue) {
    refreshQueue = refreshBackendSession().finally(() => {
      refreshQueue = null;
    });
  }
  return refreshQueue;
}

apiClient.interceptors.request.use((config) => {
  const t = getStoredAuthToken();
  if (t) {
    config.headers.Authorization = `Bearer ${t}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const original = error.config as RetryableRequestConfig | undefined;
    const url = String(original?.url ?? "");

    if (
      status !== 401 ||
      !original ||
      original._retry ||
      isAuthMutationPath(url)
    ) {
      return Promise.reject(error);
    }

    const ok = await enqueueRefresh();
    if (!ok) {
      setStoredAuthToken(null);
      setStoredRefreshToken(null);
      return Promise.reject(error);
    }

    original._retry = true;
    const next = getStoredAuthToken();
    if (next) {
      original.headers.Authorization = `Bearer ${next}`;
    }
    return apiClient.request(original);
  },
);
