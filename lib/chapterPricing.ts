/** Chapters 1..N (inclusive) are free to read without unlocking. */
export const FREE_CHAPTER_THROUGH = 5;

/** Default coin cost for locked chapters when API omits `coinPrice` (see `.env`). */
export function getDefaultChapterCoinPrice(): number {
  const raw = process.env.NEXT_PUBLIC_DEFAULT_CHAPTER_COIN_PRICE;
  const n = raw === undefined || raw === '' ? 5 : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 5;
}

export function resolveEpisodeCoinPrice(
  chapterNo: number,
  apiCoinPrice?: number,
): number {
  if (chapterNo <= FREE_CHAPTER_THROUGH) return 0;
  if (
    typeof apiCoinPrice === 'number' &&
    Number.isFinite(apiCoinPrice) &&
    apiCoinPrice >= 0
  ) {
    return apiCoinPrice;
  }
  return getDefaultChapterCoinPrice();
}
