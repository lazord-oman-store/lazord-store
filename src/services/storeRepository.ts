import type {
  AdminDashboardData,
  Order,
  OrderStatus,
  Product,
  PromoCode,
  PublicOrderTracking,
  PublicStorefrontData,
  StoreAnalytics,
  StoreSettings,
} from '../types/store';
import type { CartTotalsResult } from '../lib/storeLogic';

export interface CreateOrderPayload {
  customerName: string;
  customerPhone: string;
  city: string;
  address: string;
  items: { productId: string; quantity: number }[];
  promoCode: string | null;
  receiptImageUrl: string;
}

/**
 * Modular repository interface designed so Firebase Firestore, Storage, and Auth
 * can replace the REST API adapter with zero changes to UI components.
 */
export interface LazordStoreRepository {
  getStorefront(): Promise<PublicStorefrontData>;
  recordVisit(): Promise<void>;
  uploadImage(dataUrl: string): Promise<string>;
  validatePromoCode(
    code: string,
    items: { productId: string; quantity: number }[]
  ): Promise<{ promo: PromoCode; totals: CartTotalsResult }>;
  submitOrder(payload: CreateOrderPayload): Promise<Order>;
  trackOrder(trackingNumber: string): Promise<PublicOrderTracking>;
  getOwnerSession(): Promise<{ authenticated: boolean; username?: string; needsSetup?: boolean }>;
  setupOwner(username: string, password: string): Promise<{ authenticated: boolean; username: string }>;
  loginOwner(username: string, password: string): Promise<{ authenticated: boolean; username: string }>;
  logoutOwner(): Promise<void>;
  getAdminDashboard(): Promise<AdminDashboardData>;
  updateOrderStatus(
    orderId: string,
    status: OrderStatus
  ): Promise<{ order: Order; analytics: StoreAnalytics }>;
  createProduct(product: Omit<Product, 'id' | 'createdAt'>): Promise<Product>;
  updateProduct(id: string, patch: Partial<Product>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  createPromoCode(promo: Omit<PromoCode, 'id' | 'createdAt'>): Promise<PromoCode>;
  togglePromoCode(id: string, active: boolean): Promise<PromoCode>;
  deletePromoCode(id: string): Promise<void>;
  updateSettings(settings: Partial<StoreSettings>): Promise<StoreSettings>;
  changeOwnerPassword(payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<{ ok: boolean; username: string }>;
}

const OWNER_TOKEN_STORAGE_KEY = 'lazord_owner_token';
let memoryOwnerToken: string | null = null;

export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly needsSetup?: boolean;
  constructor(message: string, status: number, needsSetup?: boolean) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.needsSetup = needsSetup;
  }
}

export function getStoredOwnerToken(): string | null {
  if (memoryOwnerToken) return memoryOwnerToken;
  if (typeof window === 'undefined') return null;
  try {
    const fromSession = window.sessionStorage.getItem(OWNER_TOKEN_STORAGE_KEY);
    if (fromSession) {
      memoryOwnerToken = fromSession;
      return fromSession;
    }
    const fromLocal = window.localStorage.getItem(OWNER_TOKEN_STORAGE_KEY);
    if (fromLocal) {
      memoryOwnerToken = fromLocal;
      return fromLocal;
    }
  } catch {
    // Storage access may be restricted in hardened contexts; memory token still works
  }
  return null;
}

function setStoredOwnerToken(token: string): void {
  memoryOwnerToken = token;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(OWNER_TOKEN_STORAGE_KEY, token);
  } catch {
    // ignore storage errors
  }
  try {
    window.localStorage.setItem(OWNER_TOKEN_STORAGE_KEY, token);
  } catch {
    // ignore storage errors
  }
}

export function clearStoredOwnerToken(): void {
  memoryOwnerToken = null;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(OWNER_TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
  try {
    window.localStorage.removeItem(OWNER_TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

async function requestJson<T>(
  url: string,
  init?: RequestInit,
  options?: { attachAuth?: boolean }
): Promise<T> {
  const token = options?.attachAuth ? getStoredOwnerToken() : null;
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new ApiRequestError(
      'تعذر الوصول إلى خدمة الخادم (/api). يرجى التأكد من تفعيل مسارات API في بيئة النشر.',
      response.status
    );
  }

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    needsSetup?: boolean;
  } & T;
  if (response.status === 401 && options?.attachAuth) {
    clearStoredOwnerToken();
    throw new UnauthorizedError(
      payload.error || 'غير مصرح بالدخول. يرجى تسجيل الدخول كصاحب البراند.'
    );
  }
  if (!response.ok) {
    throw new ApiRequestError(
      payload.error || 'حدث خطأ أثناء الاتصال بالخادم.',
      response.status,
      payload.needsSetup
    );
  }
  return payload;
}

class ApiStoreRepository implements LazordStoreRepository {
  getStorefront(): Promise<PublicStorefrontData> {
    return requestJson<PublicStorefrontData>('/api/storefront');
  }

  async recordVisit(): Promise<void> {
    await requestJson('/api/visits', { method: 'POST', body: '{}' });
  }

  async uploadImage(dataUrl: string): Promise<string> {
    const res = await requestJson<{ url: string }>('/api/uploads', {
      method: 'POST',
      body: JSON.stringify({ dataUrl }),
    });
    return res.url;
  }

  validatePromoCode(
    code: string,
    items: { productId: string; quantity: number }[]
  ): Promise<{ promo: PromoCode; totals: CartTotalsResult }> {
    return requestJson<{ promo: PromoCode; totals: CartTotalsResult }>('/api/promo/validate', {
      method: 'POST',
      body: JSON.stringify({ code, items }),
    });
  }

  async submitOrder(payload: CreateOrderPayload): Promise<Order> {
    const res = await requestJson<{ order: Order }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.order;
  }

  async trackOrder(trackingNumber: string): Promise<PublicOrderTracking> {
    const res = await requestJson<{ order: PublicOrderTracking }>(
      `/api/orders/track/${encodeURIComponent(trackingNumber.trim())}`
    );
    return res.order;
  }

  getOwnerSession(): Promise<{ authenticated: boolean; username?: string; needsSetup?: boolean }> {
    return requestJson<{ authenticated: boolean; username?: string; needsSetup?: boolean }>(
      '/api/auth/session',
      undefined,
      { attachAuth: true }
    );
  }

  async setupOwner(
    username: string,
    password: string
  ): Promise<{ authenticated: boolean; username: string }> {
    const res = await requestJson<{ authenticated: boolean; username: string; token?: string }>(
      '/api/auth/setup',
      {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }
    );
    if (res.token) {
      setStoredOwnerToken(res.token);
    }
    return { authenticated: res.authenticated, username: res.username };
  }

  async loginOwner(
    username: string,
    password: string
  ): Promise<{ authenticated: boolean; username: string }> {
    const res = await requestJson<{ authenticated: boolean; username: string; token?: string }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }
    );
    if (res.token) {
      setStoredOwnerToken(res.token);
    }
    return { authenticated: res.authenticated, username: res.username };
  }

  async logoutOwner(): Promise<void> {
    try {
      await requestJson('/api/auth/logout', { method: 'POST', body: '{}' }, { attachAuth: true });
    } finally {
      clearStoredOwnerToken();
    }
  }

  getAdminDashboard(): Promise<AdminDashboardData> {
    return requestJson<AdminDashboardData>('/api/admin/dashboard', undefined, {
      attachAuth: true,
    });
  }

  updateOrderStatus(
    orderId: string,
    status: OrderStatus
  ): Promise<{ order: Order; analytics: StoreAnalytics }> {
    return requestJson<{ order: Order; analytics: StoreAnalytics }>(
      `/api/admin/orders/${encodeURIComponent(orderId)}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
      { attachAuth: true }
    );
  }

  async createProduct(product: Omit<Product, 'id' | 'createdAt'>): Promise<Product> {
    const res = await requestJson<{ product: Product }>(
      '/api/admin/products',
      {
        method: 'POST',
        body: JSON.stringify(product),
      },
      { attachAuth: true }
    );
    return res.product;
  }

  async updateProduct(id: string, patch: Partial<Product>): Promise<Product> {
    const res = await requestJson<{ product: Product }>(
      `/api/admin/products/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(patch),
      },
      { attachAuth: true }
    );
    return res.product;
  }

  async deleteProduct(id: string): Promise<void> {
    await requestJson(
      `/api/admin/products/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
      { attachAuth: true }
    );
  }

  async createPromoCode(promo: Omit<PromoCode, 'id' | 'createdAt'>): Promise<PromoCode> {
    const res = await requestJson<{ promoCode: PromoCode }>(
      '/api/admin/promo-codes',
      {
        method: 'POST',
        body: JSON.stringify(promo),
      },
      { attachAuth: true }
    );
    return res.promoCode;
  }

  async togglePromoCode(id: string, active: boolean): Promise<PromoCode> {
    const res = await requestJson<{ promoCode: PromoCode }>(
      `/api/admin/promo-codes/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      },
      { attachAuth: true }
    );
    return res.promoCode;
  }

  async deletePromoCode(id: string): Promise<void> {
    await requestJson(
      `/api/admin/promo-codes/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
      { attachAuth: true }
    );
  }

  async updateSettings(settings: Partial<StoreSettings>): Promise<StoreSettings> {
    const res = await requestJson<{ settings: StoreSettings }>(
      '/api/admin/settings',
      {
        method: 'PUT',
        body: JSON.stringify(settings),
      },
      { attachAuth: true }
    );
    return res.settings;
  }

  async changeOwnerPassword(payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<{ ok: boolean; username: string }> {
    const res = await requestJson<{ ok: boolean; username: string; token?: string }>(
      '/api/admin/password',
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
      { attachAuth: true }
    );
    if (res.token) {
      setStoredOwnerToken(res.token);
    }
    return { ok: res.ok, username: res.username };
  }
}

export const storeRepository: LazordStoreRepository = new ApiStoreRepository();
