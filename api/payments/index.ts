import axios from 'axios';
import { apiClient } from '@/lib/api-client';
import { getBackendBaseUrl } from '@/lib/backend-base-url';

const API_URL = getBackendBaseUrl();

export interface PaymentPackage {
  id: string;
  coins: number;
  price: number;
  currency: string;
}

/** POST /wallet/purchase-request (multipart `invoice` + body fields). */
export interface PurchaseRequestPayload {
  coinPackageId: string;
  currency: string;
  /** Must match catalog price for this package (no locale grouping). */
  priceAmount: string;
  invoice: File;
}

/** @deprecated Use `PurchaseRequestPayload` */
export type TransactionRequest = PurchaseRequestPayload;

function unwrapCoinPackages(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    if (Array.isArray(p.data)) return p.data;
    if (Array.isArray(p.packages)) return p.packages;
    if (Array.isArray(p.coinPackages)) return p.coinPackages;
  }
  return [];
}

function normalizeCurrency(raw: unknown): string {
  const s =
    typeof raw === 'string' && raw.length > 0 ? raw.trim().toUpperCase() : '';
  if (s === 'THB' || s === 'MMK') return s;
  return s || 'MMK';
}

function normalizeCoinPackage(raw: unknown): PaymentPackage | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = r.id ?? r._id;
  const coins = r.coins ?? r.coinAmount ?? r.amount;
  const currency = normalizeCurrency(r.currency ?? r.currencyCode);
  const price =
    r.price ??
    r.priceMmk ??
    r.priceInMmk ??
    r.priceThb ??
    r.price_thb ??
    r.priceInThb;
  if (id == null || coins == null || price == null) return null;
  return {
    id: String(id),
    coins: Number(coins),
    price: Number(price),
    currency,
  };
}

/** Formatted numeric amount (locale by currency: THB vs MMK). */
export function formatCoinPackageAmount(
  pkg: Pick<PaymentPackage, 'price' | 'currency'>,
): string {
  const locale = pkg.currency === 'THB' ? 'th-TH' : 'en-US';
  return pkg.price.toLocaleString(locale);
}

/** Canonical price string for `wallet/purchase-request` (matches backend catalog, no commas). */
export function priceAmountForPurchaseRequest(
  pkg: Pick<PaymentPackage, 'price'>,
): string {
  const n = Number(pkg.price);
  if (!Number.isFinite(n)) return '0';
  return n.toString();
}

export function formatCoinPackagePrice(
  pkg: Pick<PaymentPackage, 'price' | 'currency'>,
): string {
  return `${formatCoinPackageAmount(pkg)} ${pkg.currency}`;
}

/** Coin packages from the backend `/coin-packages` route. */
export const getCoinPackages = async (): Promise<PaymentPackage[]> => {
  const response = await axios.get(`${API_URL}/coin-packages`);
  return unwrapCoinPackages(response.data)
    .map(normalizeCoinPackage)
    .filter((p): p is PaymentPackage => p !== null);
};

/** @deprecated Use `getCoinPackages` */
export const getPaymentPackages = getCoinPackages;

export const submitPaymentRequest = async (
  payload: PurchaseRequestPayload,
): Promise<unknown> => {
  const formData = new FormData();
  formData.append('invoice', payload.invoice);
  formData.append('coinPackageId', payload.coinPackageId);
  formData.append('currency', payload.currency.trim().toUpperCase());
  formData.append('priceAmount', payload.priceAmount);

  const { data } = await apiClient.post(
    '/wallet/purchase-request',
    formData,
  );
  return data;
};
