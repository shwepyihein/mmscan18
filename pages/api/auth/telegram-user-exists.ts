import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { getBetterAuthProxySecret } from "@/lib/auth-proxy-secret";
import { DEFAULT_TELEGRAM_USER_EXISTS_PATH } from "@/lib/telegram-auth-paths";

/**
 * Proxies to backend `/auth/telegram-user-exists` (POST JSON from client; GET optional).
 * Override path with `TELEGRAM_USER_EXISTS_PATH`.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const key = getBetterAuthProxySecret();
  const path =
    process.env.TELEGRAM_USER_EXISTS_PATH ?? DEFAULT_TELEGRAM_USER_EXISTS_PATH;
  if (!apiUrl) {
    return res.status(500).json({ error: "NEXT_PUBLIC_API_URL is not set" });
  }

  const base = apiUrl.replace(/\/$/, "");
  const pathNorm = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${pathNorm}`;

  const headers: Record<string, string> = {
    ...(key ? { Authorization: `Bearer ${key}` } : {}),
  };

  try {
    const response =
      req.method === "GET"
        ? await axios.get(url, {
            params: req.query,
            headers,
            withCredentials: true,
            validateStatus: () => true,
          })
        : await axios.post(url, req.body, {
            headers: {
              "Content-Type": "application/json",
              ...headers,
            },
            withCredentials: true,
            validateStatus: () => true,
          });

    const setCookie = response.headers["set-cookie"];
    if (setCookie) {
      res.setHeader("Set-Cookie", setCookie);
    }

    return res.status(response.status).json(response.data);
  } catch {
    return res.status(502).json({ error: "Upstream request failed" });
  }
}
