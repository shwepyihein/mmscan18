import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

/**
 * Proxies Telegram Login Widget payload (browser) to the backend.
 * Set `TELEGRAM_BROWSER_LOGIN_PATH` if your Nest route differs (default `/users/sync`).
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
  const key = process.env.BETTER_AUTH_API_KEY;
  /** Backend route that accepts Telegram Login Widget fields (see Telegram docs). */
  const path =
    process.env.TELEGRAM_BROWSER_LOGIN_PATH ?? "/users/telegram-login";

  if (!apiUrl) {
    return res.status(500).json({ error: "NEXT_PUBLIC_API_URL is not set" });
  }

  try {
    const response = await axios.post(
      `${apiUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`,
      req.body,
      {
        headers: {
          "Content-Type": "application/json",
          ...(key ? { Authorization: `Bearer ${key}` } : {}),
        },
        withCredentials: true,
        validateStatus: () => true,
      },
    );

    const setCookie = response.headers["set-cookie"];
    if (setCookie) {
      res.setHeader("Set-Cookie", setCookie);
    }

    return res.status(response.status).json(response.data);
  } catch {
    return res.status(502).json({ error: "Upstream login failed" });
  }
}
