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

/** Use localStorage for TMA persistence */
const TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "auth_refresh_token";

type RetryableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

function unwrapNestEnvelope(payload: unknown): Record<string, unknown> | null {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, any>;
    if (p.data && typeof p.data === "object" && !Array.isArray(p.data)) return p.data;
    return p;
  }
  return null;
}

function pickToken(payload: any, type: 'access' | 'refresh'): string | null {
  if (!payload || typeof payload !== "object") return null;
  if (type === 'access') {
    const t = payload.accessToken ?? payload.token ?? payload.access_token ?? payload.jwt;
    return typeof t === "string" ? t : null;
  }
  const t = payload.refreshToken ?? payload.refresh_token;
  return typeof t === "string" ? t : null;
}

export function applyNestAuthResponseDto(data: unknown): void {
  const root = unwrapNestEnvelope(data);
  if (!root) return;
  const token = pickToken(root, 'access');
  const refresh = pickToken(root, 'refresh');
  if (token) setStoredAuthToken(token);
  if (refresh) setStoredRefreshToken(refresh);
}

export function getStoredAuthToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
}

export function setStoredAuthToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getStoredRefreshToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem(REFRESH_TOKEN_KEY) : null;
}

export function setStoredRefreshToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token);
  else localStorage.removeItem(REFRESH_TOKEN_KEY);
}

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
    return !!pickToken(unwrapNestEnvelope(res.data), 'access');
  } catch {
    return false;
  }
}

function isAuthMutationPath(url: string): boolean {
  const u = url.toLowerCase();
  return ["auth/refresh", "auth/login", "auth/telegram-register", "auth/telegram-login", "auth/telegram-user-exists"]
    .some(path => u.includes(path));
}

let refreshQueue: Promise<boolean> | null = null;
function enqueueRefresh(): Promise<boolean> {
  if (!refreshQueue) {
    refreshQueue = refreshBackendSession().finally(() => { refreshQueue = null; });
  }
  return refreshQueue;
}

apiClient.interceptors.request.use((config) => {
  const t = getStoredAuthToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

apiClient.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as RetryableRequestConfig | undefined;
    if (error.response?.status !== 401 || !original || original._retry || isAuthMutationPath(original.url || "")) {
      return Promise.reject(error);
    }
    const ok = await enqueueRefresh();
    if (!ok) {
      clearStoredTokens();
      return Promise.reject(error);
    }
    original._retry = true;
    const next = getStoredAuthToken();
    if (next) original.headers.Authorization = `Bearer ${next}`;
    return apiClient.request(original);
  },
);

function clearStoredTokens() {
  setStoredAuthToken(null);
  setStoredRefreshToken(null);
}
