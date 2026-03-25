/** Body for `POST /auth/telegram-register` and `POST /auth/telegram-login`. */
export interface NestTelegramAuthBody {
  telegramId: string;
  username: string;
  firstName: string;
  lastName: string;
}

export interface UserProfile {
  id: string;
  telegramId: string;
  username?: string;
  email?: string;
  name?: string;
  role?: string;
  level?: string;
  /** Wallet/coins; omit from API until exposed (defaults to 0). */
  coins: number;
}
