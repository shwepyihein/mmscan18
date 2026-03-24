export interface UserProfile {
  id: string;
  telegramId: string;
  username?: string;
  /** Wallet/coins; `GET /auth/me` may omit until the API exposes it (defaults to 0). */
  coins: number;
}

/** `POST /api/auth/telegram/user-exists` response (Better Auth). */
export interface TelegramUserExistsResponse {
  exists: boolean;
  userId?: string;
}
