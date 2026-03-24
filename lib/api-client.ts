import axios from "axios";
import { getBackendBaseUrl } from "@/lib/backend-base-url";

const API_URL = getBackendBaseUrl();

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

const TOKEN_KEY = "auth_token";

export function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setStoredAuthToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

apiClient.interceptors.request.use((config) => {
  const t = getStoredAuthToken();
  if (t) {
    config.headers.Authorization = `Bearer ${t}`;
  }
  return config;
});
