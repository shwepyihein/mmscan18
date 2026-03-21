import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const PUBLIC_MANHWA = '/public/manhwa';

export interface ManhwaChapterSummary {
  id?: string;
  chapterNo: number;
  title?: string;
  /** ISO date from API (`publishedAt`, `createdAt`, etc.) */
  publishedAt?: string;
  /** Unlock cost when API provides it */
  coinPrice?: number;
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
    out.push({ id, chapterNo, title, publishedAt, coinPrice });
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
    const response = await axios.get(`${API_URL}${PUBLIC_MANHWA}`, {
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
    const response = await axios.get(
      `${API_URL}${PUBLIC_MANHWA}/${encodeURIComponent(id)}`,
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
  const { data } = await axios.get(
    `${API_URL}${PUBLIC_MANHWA}/${encodeURIComponent(manhwaId)}/chapters-list`,
  );
  return data;
};

/** GET /public/manhwa/{manhwaId}/chapters — chapter range */
export const getManhwaChaptersRange = async (
  manhwaId: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<unknown> => {
  if (!API_URL) {
    throw new Error('NEXT_PUBLIC_API_URL is not set');
  }
  const { data } = await axios.get(
    `${API_URL}${PUBLIC_MANHWA}/${encodeURIComponent(manhwaId)}/chapters`,
    { params },
  );
  return data;
};

/** GET /public/manhwa/{manhwaId}/chapters/{chapterNo} — read chapter by number */
export const getManhwaChapterByNumber = async (
  manhwaId: string,
  chapterNo: number,
): Promise<unknown> => {
  if (!API_URL) {
    throw new Error('NEXT_PUBLIC_API_URL is not set');
  }
  const { data } = await axios.get(
    `${API_URL}${PUBLIC_MANHWA}/${encodeURIComponent(manhwaId)}/chapters/${chapterNo}`,
  );
  return data;
};

/** Image URLs for the vertical reader from a chapter read payload. */
export function extractChapterPageUrls(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const p = payload as Record<string, unknown>;
  const raw =
    p.pages ?? p.images ?? p.imageUrls ?? p.image_urls ?? p.urls ?? p.pageUrls;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string' && x.length > 0);
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
  if (!payload || typeof payload !== 'object') return undefined;
  const p = payload as Record<string, unknown>;
  const m = p.manhwa;
  if (m && typeof m === 'object') {
    const t = (m as Record<string, unknown>).title;
    if (typeof t === 'string') return t;
  }
  const t = p.manhwaTitle ?? p.manhwa_title;
  return typeof t === 'string' ? t : undefined;
}
