export interface UserProfile {
  id: string;
  telegramId: string;
  username?: string;
  /** Wallet/coins; `GET /auth/me` may omit until the API exposes it (defaults to 0). */
  coins: number;
}

/** `POST /auth/telegram-user-exists` response shape (Nest `UserExistsResponseDto`). */
export interface TelegramUserExistsResponse {
  exists: boolean;
  userId?: string;
}
