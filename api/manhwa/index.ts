import { isAxiosError } from 'axios';

import { apiClient } from '@/lib/api-client';
import { getBackendBaseUrl } from '@/lib/backend-base-url';

import type {
  ChapterReadMmJsonPage,
  ChapterReadTextSettings,
  MmJsonOverlayBlock,
} from './chapter-read';

export type {
  ChapterReadChapter,
  ChapterReadManhwa,
  ChapterReadMmJsonPage,
  ChapterReadResponse,
  ChapterReadTextBlock,
  ChapterReadTextSettings,
  MmJsonOverlayBlock,
} from './chapter-read';

const API_URL = getBackendBaseUrl();

const PUBLIC_MANHWA = '/public/manhwa';

export interface ManhwaChapterSummary {
  id?: string;
  chapterNo: number;
  title?: string;
  /** ISO date from API (`publishedAt`, `createdAt`, etc.) */
  publishedAt?: string;
  /** Unlock cost when API provides it */
  coinPrice?: number;
  /** Server flag: chapter requires purchase / is paywalled. */
  isLocked?: boolean;
}

const NEW_CHAPTER_MS = 24 * 60 * 60 * 1000;

/** True when `publishedAt` is within the last 24 hours (and not in the future). */
export function isChapterNewByPublishedAt(
  publishedAt: string | undefined,
): boolean {
  if (!publishedAt) return false;
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return false;
  const now = Date.now();
  if (t > now) return false;
  return now - t <= NEW_CHAPTER_MS;
}

export interface Manhwa {
  id: string;
  title: string;
  slug: string;
  coverImageUrl: string;
  rating: number;
  synopsis: string;
  author: string;
  chaptersCount: number;
  /** Latest chapters from API when provided (newest first preferred). */
  lastChapters?: ManhwaChapterSummary[];
  /** Full chapter list from detail/list API when `chapters` array is present (ascending by chapterNo). */
  chapters?: ManhwaChapterSummary[];
  genres?: string[];
}

function parseLastChapters(raw: unknown): ManhwaChapterSummary[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ManhwaChapterSummary[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const chapterNo = Number(
      o.chapterNo ?? o.chapter_no ?? o.number ?? o.chapterNumber ?? o.no,
    );
    if (!Number.isFinite(chapterNo)) continue;
    const title = typeof o.title === 'string' ? o.title : undefined;
    const publishedRaw =
      o.publishedAt ?? o.published_at ?? o.createdAt ?? o.created_at;
    const publishedAt =
      typeof publishedRaw === 'string' ? publishedRaw : undefined;
    const id = typeof o.id === 'string' ? o.id : undefined;
    const coinRaw = o.coinPrice ?? o.coin_price ?? o.price;
    const coinPrice = (() => {
      const n = Number(coinRaw);
      return Number.isFinite(n) && n >= 0 ? n : undefined;
    })();
    const isLocked =
      typeof o.isLocked === 'boolean'
        ? o.isLocked
        : typeof o.is_locked === 'boolean'
          ? o.is_locked
          : undefined;
    out.push({
      id,
      chapterNo,
      title,
      publishedAt,
      coinPrice,
      ...(isLocked !== undefined ? { isLocked } : {}),
    });
  }
  return out.length > 0 ? out : undefined;
}

/** From full `chapters` array: keep the two highest chapter numbers (newest first). */
function parseLatestTwoFromChaptersArray(
  raw: unknown,
): ManhwaChapterSummary[] | undefined {
  const parsed = parseLastChapters(raw);
  if (!parsed?.length) return undefined;
  const sorted = [...parsed].sort((a, b) => b.chapterNo - a.chapterNo);
  return sorted.slice(0, 2);
}

/** Last two chapters for list UI: prefers API `lastChapters`, else derives from `chaptersCount`. */
export function getLastTwoChapters(manhwa: Manhwa): ManhwaChapterSummary[] {
  if (manhwa.lastChapters && manhwa.lastChapters.length > 0) {
    const sorted = [...manhwa.lastChapters].sort(
      (a, b) => b.chapterNo - a.chapterNo,
    );
    return sorted.slice(0, 2);
  }
  const n = manhwa.chaptersCount;
  if (n <= 0) return [];
  if (n === 1) return [{ chapterNo: 1 }];
  return [{ chapterNo: n }, { chapterNo: n - 1 }];
}

/** Query params for GET /public/manhwa (matches backend listManhwa). */
export type ManhwaSortBy = 'latest' | 'popular' | 'rating';

export interface GetManhwasParams {
  page?: number;
  limit?: number;
  genre?: string;
  sortBy?: ManhwaSortBy;
}

export interface ManhwaListMeta {
  page: number;
  limit: number;
  total?: number;
  totalPages?: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

function emptyListMeta(page: number, limit: number): ManhwaListMeta {
  return { page, limit, total: 0, totalPages: 0 };
}

function unwrapManhwaList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    if (Array.isArray(p.data)) return p.data;
    if (Array.isArray(p.manhwas)) return p.manhwas;
    if (Array.isArray(p.items)) return p.items;
    if (Array.isArray(p.results)) return p.results;
  }
  return [];
}

function parseManhwaListPayload(payload: unknown): {
  list: unknown[];
  meta?: ManhwaListMeta;
} {
  if (Array.isArray(payload)) return { list: payload };
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    const list = unwrapManhwaList(payload);
    const page = p.page ?? p.currentPage ?? p.current_page;
    const limit = p.limit ?? p.perPage ?? p.per_page ?? p.take;
    const total = p.total ?? p.totalCount ?? p.total_count;
    const totalPages = p.totalPages ?? p.total_pages ?? p.lastPage;
    if (page != null && limit != null) {
      return {
        list,
        meta: {
          page: Number(page),
          limit: Number(limit),
          ...(typeof total === 'number' ? { total } : {}),
          ...(typeof totalPages === 'number' ? { totalPages } : {}),
        },
      };
    }
    return { list };
  }
  return { list: [] };
}

export function normalizeManhwa(raw: unknown): Manhwa | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = r.id ?? r._id;
  const title = r.title;
  if (id == null || typeof title !== 'string') return null;
  const slug =
    (typeof r.slugUrl === 'string' && r.slugUrl.length > 0 && r.slugUrl) ||
    (typeof r.slug === 'string' && r.slug.length > 0 && r.slug) ||
    String(id);
  const coverImageUrl =
    (typeof r.coverImageUrl === 'string' && r.coverImageUrl) ||
    (typeof r.coverImage === 'string' && r.coverImage) ||
    (typeof r.cover_image === 'string' && r.cover_image) ||
    (typeof r.coverUrl === 'string' && r.coverUrl) ||
    '';
  const rating = Number(r.rating ?? 0);
  const synopsis =
    typeof r.synopsis === 'string'
      ? r.synopsis
      : typeof r.description === 'string'
        ? r.description
        : '';
  const author =
    typeof r.author === 'string' ? r.author : String(r.author ?? '');
  const chaptersCount = Number(
    r.chaptersCount ??
      r.chapters_count ??
      r.totalChapters ??
      r.chapterCount ??
      0,
  );
  const genres =
    Array.isArray(r.genres) && r.genres.every((g) => typeof g === 'string')
      ? (r.genres as string[])
      : undefined;
  const chaptersFromApi = parseLastChapters(r.chapters);
  const chaptersSortedAsc =
    chaptersFromApi && chaptersFromApi.length > 0
      ? [...chaptersFromApi].sort((a, b) => a.chapterNo - b.chapterNo)
      : undefined;

  const lastChapters =
    parseLastChapters(r.lastChapters) ??
    parseLastChapters(r.last_chapters) ??
    parseLatestTwoFromChaptersArray(r.chapters) ??
    parseLastChapters(r.recentChapters) ??
    parseLastChapters(r.latestChapters);

  return {
    id: String(id),
    title,
    slug,
    coverImageUrl,
    rating,
    synopsis,
    author,
    chaptersCount,
    ...(lastChapters ? { lastChapters } : {}),
    ...(chaptersSortedAsc ? { chapters: chaptersSortedAsc } : {}),
    ...(genres ? { genres } : {}),
  };
}

/**
 * GET /public/manhwa — paginated list (requires `page` & `limit` on the server).
 * Returns normalized items plus optional pagination meta when the API sends it.
 */
export const getManhwasPaginated = async (
  params?: GetManhwasParams,
): Promise<{ items: Manhwa[]; meta?: ManhwaListMeta }> => {
  const page = params?.page ?? DEFAULT_PAGE;
  const limit = params?.limit ?? DEFAULT_LIMIT;
  const query: Record<string, string | number> = { page, limit };
  if (params?.genre) query.genre = params.genre;
  if (params?.sortBy) query.sortBy = params.sortBy;

  if (!API_URL) {
    return { items: [], meta: emptyListMeta(page, limit) };
  }

  try {
    const response = await apiClient.get(PUBLIC_MANHWA, {
      params: query,
    });
    const { list, meta } = parseManhwaListPayload(response.data);
    const items = list
      .map(normalizeManhwa)
      .filter((m): m is Manhwa => m !== null);
    return { items, meta };
  } catch {
    return { items: [] };
  }
};

/** GET /public/manhwa — convenience: returns only the manhwa array. */
export const getManhwas = async (
  params?: GetManhwasParams,
): Promise<Manhwa[]> => {
  const { items } = await getManhwasPaginated(params);
  return items;
};

/** GET /public/manhwa/{id} — manhwa details */
export const getManhwaById = async (
  id: string,
): Promise<Manhwa | undefined> => {
  if (!API_URL) return undefined;
  try {
    const response = await apiClient.get(
      `${PUBLIC_MANHWA}/${encodeURIComponent(id)}`,
    );
    return normalizeManhwa(response.data) ?? undefined;
  } catch {
    return undefined;
  }
};

/** Same as getManhwaById (route param may be legacy slug in bookmarks). */
export const getManhwaBySlug = getManhwaById;

/** GET /public/manhwa/{manhwaId}/chapters-list — full chapter list + unlock status */
export const getManhwaChaptersList = async (
  manhwaId: string,
): Promise<unknown> => {
  if (!API_URL) {
    throw new Error('NEXT_PUBLIC_API_URL is not set');
  }
  const { data } = await apiClient.get(
    `${PUBLIC_MANHWA}/${encodeURIComponent(manhwaId)}/chapters-list`,
  );
  return data;
};

/** Unwrap common API envelopes to a chapter array for `chapters-list` responses. */
export function parseChaptersListPayload(
  payload: unknown,
): ManhwaChapterSummary[] {
  const raw = (() => {
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === 'object') {
      const p = payload as Record<string, unknown>;
      const nested = p.data ?? p.chapters ?? p.items ?? p.results ?? p.list;
      if (Array.isArray(nested)) return nested;
    }
    return [];
  })();
  return parseLastChapters(raw) ?? [];
}

/** Same as getManhwaChaptersList but returns normalized rows; never throws. */
export async function getManhwaChaptersListNormalized(
  manhwaId: string,
): Promise<ManhwaChapterSummary[]> {
  if (!API_URL) return [];
  try {
    const data = await getManhwaChaptersList(manhwaId);
    return parseChaptersListPayload(data);
  } catch {
    return [];
  }
}

/** GET /public/manhwa/{manhwaId}/chapters — chapter range */
export const getManhwaChaptersRange = async (
  manhwaId: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<unknown> => {
  if (!API_URL) {
    throw new Error('NEXT_PUBLIC_API_URL is not set');
  }
  const { data } = await apiClient.get(
    `${PUBLIC_MANHWA}/${encodeURIComponent(manhwaId)}/chapters`,
    { params },
  );
  return data;
};

/**
 * GET `/public/manhwa/{manhwaId}/chapters/{chapterNo}` — chapter reader payload.
 * Uses `apiClient` so Bearer auth is sent when the user is logged in.
 */
export const getManhwaChapterByNumber = async (
  manhwaId: string,
  chapterNo: number,
): Promise<unknown> => {
  if (!API_URL) {
    throw new Error('NEXT_PUBLIC_API_URL is not set');
  }
  const { data } = await apiClient.get(
    `${PUBLIC_MANHWA}/${encodeURIComponent(manhwaId)}/chapters/${encodeURIComponent(String(chapterNo))}`,
  );
  return data;
};

/** Nest-style body: `{ message: "Locked", error: "Forbidden", statusCode: 403 }` or wrapped in `data`. */
function nestStyleErrorBody(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  const inner = o.data;
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    const i = inner as Record<string, unknown>;
    if (typeof i.message === 'string') return i;
  }
  return o;
}

/** Chapter read returned 403 because the episode is paywalled (`message: "Locked"`). */
export function isChapterLockedForbiddenError(error: unknown): boolean {
  if (!isAxiosError(error)) return false;
  const status = error.response?.status;
  if (status !== 403) return false;
  const payload = nestStyleErrorBody(error.response?.data);
  const msg = payload?.message;
  return typeof msg === 'string' && msg.toLowerCase() === 'locked';
}

/** Unwrap `{ data: { ... } }` or return object root for chapter payloads. */
function unwrapChapterPayload(
  payload: unknown,
): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') return null;
  const o = payload as Record<string, unknown>;
  const inner = o.data;
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    return inner as Record<string, unknown>;
  }
  return o;
}

function pickChapterRowId(o: Record<string, unknown>): string | undefined {
  const id = o.id ?? o._id ?? o.chapterId ?? o.chapter_id;
  if (typeof id === 'string' && id.length > 0) return id;
  if (typeof id === 'number' && Number.isFinite(id)) return String(id);
  return undefined;
}

function chapterRowNumber(o: Record<string, unknown>): number | undefined {
  const n = Number(
    o.chapterNo ?? o.chapter_no ?? o.number ?? o.chapterNumber ?? o.no,
  );
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Reader payloads often include `chapters: [...]` with real DB ids; unlock/wallet expects that id.
 */
export function resolveChapterIdFromChaptersArray(
  payload: unknown,
  chapterNo: number,
): string | undefined {
  if (!Number.isFinite(chapterNo)) return undefined;
  const p = unwrapChapterPayload(payload);
  if (!p) return undefined;

  const arrays: unknown[] = [];
  if (Array.isArray(p.chapters)) arrays.push(p.chapters);

  const ch =
    p.chapter && typeof p.chapter === 'object' && !Array.isArray(p.chapter)
      ? (p.chapter as Record<string, unknown>)
      : null;
  const mw = ch?.manhwa ?? p.manhwa;
  if (mw && typeof mw === 'object') {
    const m = mw as Record<string, unknown>;
    if (Array.isArray(m.chapters)) arrays.push(m.chapters);
  }

  for (const raw of arrays) {
    if (!Array.isArray(raw)) continue;
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const no = chapterRowNumber(o);
      if (no !== chapterNo) continue;
      const id = pickChapterRowId(o);
      if (id) return id;
    }
  }
  return undefined;
}

/** Image URLs for the vertical reader from a chapter read payload. */
export function extractChapterPageUrls(payload: unknown): string[] {
  const p = unwrapChapterPayload(payload);
  if (!p) return [];
  const raw =
    p.images ??
    p.pages ??
    p.imageUrls ??
    p.image_urls ??
    p.urls ??
    p.pageUrls ??
    p.slides;
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item.length > 0) {
      out.push(item);
      continue;
    }
    if (item && typeof item === 'object') {
      const row = item as Record<string, unknown>;
      const u = row.url ?? row.src ?? row.imageUrl ?? row.image_url;
      if (typeof u === 'string' && u.length > 0) out.push(u);
    }
  }
  return out;
}

/**
 * Episodes for detail UI (newest first): only rows returned in API `chapters`
 * (no synthetic 1..`chaptersCount` list).
 */
export function getEpisodesForDetail(manhwa: Manhwa): ManhwaChapterSummary[] {
  const list = manhwa.chapters;
  if (!list?.length) return [];
  return [...list].sort((a, b) => b.chapterNo - a.chapterNo);
}

export function extractChapterManhwaTitle(
  payload: unknown,
): string | undefined {
  const p = unwrapChapterPayload(payload);
  if (!p) return undefined;
  const ch =
    p.chapter && typeof p.chapter === 'object' && !Array.isArray(p.chapter)
      ? (p.chapter as Record<string, unknown>)
      : p;
  const m = ch.manhwa ?? p.manhwa;
  if (m && typeof m === 'object') {
    const t = (m as Record<string, unknown>).title;
    if (typeof t === 'string') return t;
  }
  const t = p.manhwaTitle ?? p.manhwa_title;
  return typeof t === 'string' ? t : undefined;
}

function parseOptionalChapterNavNo(raw: unknown): number | null | undefined {
  if (raw === null) return null;
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** Reader-only fields from a single chapter payload (no separate manhwa/chapters-list calls). */
export function extractChapterReaderMeta(payload: unknown): {
  manhwaTitle?: string;
  chaptersCount?: number;
  chapterNo?: number;
  chapterTitle?: string;
  coinPrice?: number;
  isLocked?: boolean;
  chapterApiId?: string;
  nextChapterNo?: number | null;
  prevChapterNo?: number | null;
} {
  const p = unwrapChapterPayload(payload);
  if (!p) return {};
  const ch =
    p.chapter && typeof p.chapter === 'object' && !Array.isArray(p.chapter)
      ? (p.chapter as Record<string, unknown>)
      : p;

  const mw = ch.manhwa ?? p.manhwa;
  let manhwaTitle: string | undefined;
  let chaptersCount: number | undefined;
  if (mw && typeof mw === 'object') {
    const m = mw as Record<string, unknown>;
    if (typeof m.title === 'string') manhwaTitle = m.title;
    const cc = m.totalChapters ?? m.chaptersCount ?? m.chapters_count;
    const n = Number(cc);
    if (Number.isFinite(n) && n >= 0) chaptersCount = n;
  }
  manhwaTitle =
    manhwaTitle ??
    (typeof p.manhwaTitle === 'string' ? p.manhwaTitle : undefined) ??
    (typeof p.manhwa_title === 'string' ? p.manhwa_title : undefined);

  const chNoRaw =
    ch.chapterNo ?? ch.chapter_no ?? p.chapterNo ?? p.chapter_no ?? p.number;
  const chapterNo =
    typeof chNoRaw === 'number' && Number.isFinite(chNoRaw)
      ? chNoRaw
      : typeof chNoRaw === 'string' && Number.isFinite(Number(chNoRaw))
        ? Number(chNoRaw)
        : undefined;

  const chapterTitle =
    typeof ch.title === 'string'
      ? ch.title
      : typeof ch.chapterTitle === 'string'
        ? ch.chapterTitle
        : typeof p.title === 'string'
          ? p.title
          : typeof p.chapterTitle === 'string'
            ? p.chapterTitle
            : undefined;

  const coinRaw =
    ch.coinPrice ?? ch.coin_price ?? p.coinPrice ?? p.coin_price ?? p.price;
  const coinPrice = (() => {
    if (typeof coinRaw === 'number' && Number.isFinite(coinRaw) && coinRaw >= 0)
      return coinRaw;
    if (typeof coinRaw === 'string' && Number.isFinite(Number(coinRaw)))
      return Number(coinRaw);
    return undefined;
  })();

  const isLocked =
    typeof ch.isLocked === 'boolean'
      ? ch.isLocked
      : typeof p.isLocked === 'boolean'
        ? p.isLocked
        : undefined;

  let chapterApiId =
    typeof ch.id === 'string'
      ? ch.id
      : typeof p.id === 'string'
        ? p.id
        : undefined;
  if (
    (chapterApiId == null || chapterApiId.length === 0) &&
    chapterNo != null &&
    Number.isFinite(chapterNo)
  ) {
    chapterApiId = resolveChapterIdFromChaptersArray(payload, chapterNo);
  }

  const nextChapterNo = parseOptionalChapterNavNo(
    p.nextChapterNo ?? p.next_chapter_no,
  );
  const prevChapterNo = parseOptionalChapterNavNo(
    p.prevChapterNo ?? p.prev_chapter_no,
  );

  return {
    manhwaTitle,
    chaptersCount,
    chapterNo,
    chapterTitle,
    coinPrice,
    isLocked,
    chapterApiId,
    nextChapterNo,
    prevChapterNo,
  };
}

/**
 * Per-page subtitle lines with API `settings` (font, color, alignment) when present.
 */
export function extractMmJsonStyledPages(
  payload: unknown,
): Array<Array<{ text: string; settings?: ChapterReadTextSettings }>> {
  const raw = extractMmjsonRaw(payload);
  if (!raw || !Array.isArray(raw)) return [];
  const first = raw[0];
  if (
    !first ||
    typeof first !== 'object' ||
    Array.isArray(first) ||
    !('texts' in (first as object))
  ) {
    return [];
  }
  return (raw as ChapterReadMmJsonPage[]).map((page) => {
    const texts = page.texts;
    if (!Array.isArray(texts)) return [];
    return texts.map((t) => ({
      text: String((t as { text?: unknown }).text ?? ''),
      settings: (t as { settings?: ChapterReadTextSettings }).settings,
    }));
  });
}

function parseMmJsonBox(
  raw: unknown,
): [number, number, number, number] | undefined {
  if (!Array.isArray(raw) || raw.length < 4) return undefined;
  const nums = raw.slice(0, 4).map((v) => Number(v));
  if (!nums.every((n) => Number.isFinite(n))) return undefined;
  return [nums[0], nums[1], nums[2], nums[3]];
}

/**
 * Per-page text blocks including `box` [x, y, w, h] in natural image pixels (editor-compatible).
 */
export function extractMmJsonOverlayPages(
  payload: unknown,
): MmJsonOverlayBlock[][] {
  const raw = extractMmjsonRaw(payload);
  if (!raw || !Array.isArray(raw)) return [];
  const first = raw[0];
  if (
    !first ||
    typeof first !== 'object' ||
    Array.isArray(first) ||
    !('texts' in (first as object))
  ) {
    return [];
  }
  return (raw as ChapterReadMmJsonPage[]).map((page) => {
    const texts = page.texts;
    if (!Array.isArray(texts)) return [];
    return texts.map((t) => {
      const rec = t as {
        text?: unknown;
        box?: unknown;
        settings?: ChapterReadTextSettings;
      };
      return {
        text: String(rec.text ?? ''),
        box: parseMmJsonBox(rec.box),
        settings: rec.settings,
      };
    });
  });
}

/** Raw mmjson reference: URL string, JSON string, or embedded object. */
export function extractMmjsonRaw(
  payload: unknown,
): string | Record<string, unknown> | unknown[] | null {
  const p = unwrapChapterPayload(payload);
  if (!p) return null;
  const raw = p.mmjson ?? p.mmJson ?? p.MMJSON;
  if (raw == null) return null;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return null;
}

/**
 * Normalize mmjson into one subtitle string per page (0-based index matches page order).
 * Supports: string[], { pages: [...] }, { items: [...] }, array of { text | lines | page }.
 */
export function parseMmjsonToPageSubtitles(mmjson: unknown): string[] {
  if (mmjson == null) return [];
  if (typeof mmjson === 'string') {
    const t = mmjson.trim();
    if (!t) return [];
    if (t.startsWith('{') || t.startsWith('[')) {
      try {
        return parseMmjsonToPageSubtitles(JSON.parse(t) as unknown);
      } catch {
        return [];
      }
    }
    return [];
  }
  if (Array.isArray(mmjson)) {
    if (mmjson.length === 0) return [];
    const first = mmjson[0];
    if (
      first &&
      typeof first === 'object' &&
      !Array.isArray(first) &&
      'texts' in (first as object)
    ) {
      return (mmjson as Array<{ texts?: unknown }>).map((block) => {
        const texts = block.texts;
        if (!Array.isArray(texts)) return '';
        return texts
          .map((t) => {
            if (t && typeof t === 'object' && 'text' in t) {
              return String((t as { text?: unknown }).text ?? '');
            }
            return '';
          })
          .filter((s) => s.length > 0)
          .join('\n');
      });
    }
    if (mmjson.every((x) => typeof x === 'string')) {
      return mmjson as string[];
    }
    const out: string[] = [];
    for (const item of mmjson) {
      if (typeof item === 'string') {
        out.push(item);
        continue;
      }
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        const text = o.text ?? o.subtitle ?? o.content;
        const lines = o.lines;
        if (typeof text === 'string') {
          out.push(text);
        } else if (Array.isArray(lines)) {
          out.push(
            lines.filter((l): l is string => typeof l === 'string').join('\n'),
          );
        }
      }
    }
    return out;
  }
  if (typeof mmjson === 'object') {
    const o = mmjson as Record<string, unknown>;
    const nested = o.pages ?? o.items ?? o.slides ?? o.data;
    if (Array.isArray(nested)) return parseMmjsonToPageSubtitles(nested);
  }
  return [];
}
