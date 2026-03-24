/**
 * Telegram Login Widget expects `data-telegram-login` = bot username only (no @, no spaces).
 * Display names like "Hot MM Manhwa Premium Bot" are invalid — use e.g. hotmmmanhwapremium_bot.
 */
export function normalizeTelegramBotUsername(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("@")) s = s.slice(1);
  return s.trim();
}
