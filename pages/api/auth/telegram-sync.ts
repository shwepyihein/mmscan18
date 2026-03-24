import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

/**
 * Proxies Telegram Mini App `initData` to the backend so `BETTER_AUTH_API_KEY`
 * never ships to the browser.
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
  if (!apiUrl) {
    return res.status(500).json({ error: "NEXT_PUBLIC_API_URL is not set" });
  }

  try {
    const response = await axios.post(`${apiUrl}/users/sync`, req.body, {
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
  } catch (e) {
    return res.status(502).json({ error: "Upstream sync failed" });
  }
}
