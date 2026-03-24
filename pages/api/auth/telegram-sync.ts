import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { getBackendBaseUrl } from "@/lib/backend-base-url";
import { getBetterAuthProxySecret } from "@/lib/auth-proxy-secret";
import { DEFAULT_TELEGRAM_SYNC_PATH } from "@/lib/telegram-auth-paths";

/**
 * Proxies Telegram Mini App `initData` to the backend.
 * Default upstream: `/auth/telegram-login` (upsert). Override with `TELEGRAM_SYNC_PATH`.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const base = getBackendBaseUrl();
  const key = getBetterAuthProxySecret();
  const path =
    process.env.TELEGRAM_SYNC_PATH ?? DEFAULT_TELEGRAM_SYNC_PATH;
  if (!base) {
    return res.status(500).json({ error: "NEXT_PUBLIC_API_URL is not set" });
  }
  const pathNorm = path.startsWith("/") ? path : `/${path}`;

  try {
    const response = await axios.post(`${base}${pathNorm}`, req.body, {
      headers: {
        "Content-Type": "application/json",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
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
    return res.status(502).json({ error: "Upstream sync failed" });
  }
}
