import { apiClient } from '@/lib/api-client';

function nestErrorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'response' in e) {
    const data = (e as { response?: { data?: unknown } }).response?.data;
    if (data && typeof data === 'object') {
      const m = (data as Record<string, unknown>).message;
      if (typeof m === 'string') return m;
      if (Array.isArray(m)) return m.map(String).join(', ');
    }
  }
  if (e instanceof Error) return e.message;
  return 'Request failed';
}

function unwrapList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    if (Array.isArray(p.data)) return p.data;
    if (Array.isArray(p.items)) return p.items;
    if (Array.isArray(p.requests)) return p.requests;
  }
  return [];
}

export type WalletRequestStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface WalletMyRequest {
  id: string;
  status: WalletRequestStatus;
  createdAt: string;
  /** Coins credited when approved (from package or API field). */
  amountCoins: number;
  currency?: string;
  priceAmount?: string;
  description?: string;
}

function mapRequestStatus(raw: string): WalletRequestStatus {
  const u = raw.toUpperCase();
  if (
    ['COMPLETED', 'APPROVED', 'SUCCESS', 'FULFILLED', 'PAID'].includes(u)
  ) {
    return 'COMPLETED';
  }
  if (
    ['FAILED', 'REJECTED', 'CANCELLED', 'DECLINED', 'DENIED'].includes(u)
  ) {
    return 'FAILED';
  }
  return 'PENDING';
}

/**
 * GET /wallet/my-requests — current user’s coin purchase / top-up requests (invoice flow).
 */
export async function getWalletMyRequests(): Promise<WalletMyRequest[]> {
  const { data } = await apiClient.get<unknown>('/wallet/my-requests');
  const list = unwrapList(data);
  const out: WalletMyRequest[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const id = r.id ?? r._id;
    if (id == null) continue;
    const pkg = r.coinPackage;
    const pkgObj =
      pkg && typeof pkg === 'object' ? (pkg as Record<string, unknown>) : null;
    const amountCoins = Number(
      r.coins ??
        r.coinAmount ??
        r.amount ??
        pkgObj?.coins ??
        pkgObj?.coinAmount ??
        0,
    );
    const createdRaw = r.createdAt ?? r.created_at;
    const createdAt =
      typeof createdRaw === 'string'
        ? createdRaw
        : createdRaw instanceof Date
          ? createdRaw.toISOString()
          : '';
    const currency =
      typeof r.currency === 'string'
        ? r.currency
        : typeof pkgObj?.currency === 'string'
          ? pkgObj.currency
          : undefined;
    const priceRaw = r.priceAmount ?? r.price ?? pkgObj?.price;
    const priceAmount =
      priceRaw != null && priceRaw !== ''
        ? String(priceRaw)
        : undefined;
    out.push({
      id: String(id),
      status: mapRequestStatus(String(r.status ?? 'PENDING')),
      createdAt,
      amountCoins: Number.isFinite(amountCoins) ? amountCoins : 0,
      currency,
      priceAmount,
      description:
        typeof r.description === 'string'
          ? r.description
          : typeof r.note === 'string'
            ? r.note
            : undefined,
    });
  }
  return out;
}

function unwrapStringIds(payload: unknown): string[] {
  let list: unknown[] = [];
  if (Array.isArray(payload)) list = payload;
  else if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    const nested =
      p.data ??
      p.chapterIds ??
      p.unlockedChapterIds ??
      p.ids ??
      p.chapters;
    if (Array.isArray(nested)) list = nested;
  }
  const out: string[] = [];
  for (const item of list) {
    if (typeof item === 'string' && item.length > 0) {
      out.push(item);
      continue;
    }
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      const id =
        o.chapterId ?? o.id ?? (o.chapter && typeof o.chapter === 'object'
          ? (o.chapter as Record<string, unknown>).id
          : undefined);
      if (id != null) out.push(String(id));
    }
  }
  return out;
}

export interface WalletUnlockResult {
  coinBalance?: number;
}

/**
 * POST /wallet/unlock — spend coins and unlock a chapter (server source of truth).
 */
export async function postWalletUnlock(params: {
  chapterId: string;
}): Promise<WalletUnlockResult> {
  try {
    const { data } = await apiClient.post<unknown>('/wallet/unlock', params);
    if (!data || typeof data !== 'object') return {};
    const d = data as Record<string, unknown>;
    const user = d.user;
    const u =
      user && typeof user === 'object'
        ? (user as Record<string, unknown>)
        : d;
    const raw = u.coinBalance ?? u.coins ?? d.coinBalance ?? d.newBalance;
    const coinBalance =
      raw != null && raw !== '' ? Number(raw) : undefined;
    return {
      coinBalance:
        typeof coinBalance === 'number' && Number.isFinite(coinBalance)
          ? coinBalance
          : undefined,
    };
  } catch (e) {
    throw new Error(nestErrorMessage(e));
  }
}

/**
 * GET /wallet/unlocked-chapters — chapter IDs the current user has unlocked.
 */
export async function getWalletUnlockedChapters(): Promise<string[]> {
  const { data } = await apiClient.get<unknown>('/wallet/unlocked-chapters');
  return unwrapStringIds(data);
}
