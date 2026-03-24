import type { NextApiRequest, NextApiResponse } from "next";

type HealthResponse = {
  ok: boolean;
  timestamp: string;
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthResponse | { error: string }>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  return res.status(200).json({
    ok: true,
    timestamp: new Date().toISOString(),
  });
}
