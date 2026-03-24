import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { getBetterAuthProxySecret } from "@/lib/auth-proxy-secret";
import { DEFAULT_TELEGRAM_REGISTER_PATH } from "@/lib/telegram-auth-paths";

/**
 * Browser Telegram Login Widget → backend `POST /auth/telegram-register`.
 * Override with `TELEGRAM_REGISTER_PATH` (same as Mini App register).
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const key = getBetterAuthProxySecret();
  const path =
    process.env.TELEGRAM_REGISTER_PATH ?? DEFAULT_TELEGRAM_REGISTER_PATH;

  if (!apiUrl) {
    return res.status(500).json({ error: "NEXT_PUBLIC_API_URL is not set" });
  }

  const base = apiUrl.replace(/\/$/, "");
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
    return res.status(502).json({ error: "Upstream register failed" });
  }
}
