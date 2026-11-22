import crypto from 'node:crypto';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import os from 'node:os';
import path from 'node:path';

// --- Domain Types (Self-contained for zero-dependency Vercel ESM bundling) ---

type ProductCategory = 'perfume' | 'bukhoor';
type DiscountType = 'percentage' | 'fixed';
type OrderStatus =
  | 'قيد المراجعة'
  | 'تم تأكيد الدفع'
  | 'جاري التجهيز'
  | 'تم الشحن'
  | 'تم التوصيل'
  | 'مرفوض';

interface Product {
  id: string;
  nameAr: string;
  category: ProductCategory;
  notesAr: string;
  sizeLabel: string;
  priceOmr: number;
  imageUrl: string;
  featured?: boolean;
  createdAt: string;
}

interface OrderItem {
  productId: string;
  nameAr: string;
  category: ProductCategory;
  sizeLabel: string;
  unitPriceOmr: number;
  quantity: number;
  lineTotalOmr: number;
}

interface Order {
  id: string;
  orderNumber: string;
  trackingNumber: string;
  customerName: string;
  customerPhone: string;
  city: string;
  address: string;
  items: OrderItem[];
  originalSubtotal: number;
  promoCodeUsed: string | null;
  discountAmount: number;
  finalTotal: number;
  receiptImageUrl: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

interface PromoCode {
  id: string;
  code: string;
  discountType: DiscountType;
  value: number;
  active: boolean;
  createdAt: string;
}

interface StoreSettings {
  brandName: string;
  brandBio: string;
  bankPhoneNumber: string;
  bankAccountLabel: string;
  whatsappNumber: string;
  currencyLabel: string;
}

interface AdminCredentialRecord {
  username: string;
  salt: string;
  hash: string;
}

interface PersistedStoreState {
  products: Product[];
  orders: Order[];
  promoCodes: PromoCode[];
  settings: StoreSettings;
  totalStoreVisits: number;
  adminCredential?: AdminCredentialRecord | null;
  seedResetV2?: boolean;
}

// --- Constants & Initial Seed State ---

const SESSION_COOKIE_NAME = 'lazord_owner_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_JSON_BODY_BYTES = 8 * 1024 * 1024;
const KV_TIMEOUT_MS = 4000;
const STORE_KV_KEY = 'lazord:store:v1';
const UPLOAD_KV_PREFIX = 'lazord:upload:v1:';

const ORDER_STATUS_LIST: OrderStatus[] = [
  'قيد المراجعة',
  'تم تأكيد الدفع',
  'جاري التجهيز',
  'تم الشحن',
  'تم التوصيل',
  'مرفوض',
];

const OMAN_GOVERNORATES = [
  'محافظة مسقط',
  'محافظة ظفار',
  'محافظة مسندم',
  'محافظة البريمي',
  'محافظة الداخلية',
  'محافظة شمال الباطنة',
  'محافظة جنوب الباطنة',
  'محافظة جنوب الشرقية',
  'محافظة شمال الشرقية',
  'محافظة الظاهرة',
  'محافظة الوسطى',
] as const;

const LEGACY_SEED_ORDER_IDS = new Set(['ord-seed-1001', 'ord-seed-1002']);
const LEGACY_SEED_VISITS = 128;

const INITIAL_SEED_STATE: PersistedStoreState = {
  totalStoreVisits: 0,
  seedResetV2: true,
  settings: {
    brandName: 'LAZORD | لازورد',
    brandBio:
      'دار لازورد للعطور الفاخرة والبخور الأصيل؛ ننسج خلاصة العود المعتّق والزعفران واللبان العماني والعنبر الدافئ في تركيبات راقية تعبّر عن الفخامة العربية الهادئة والحرفية العالية.',
    bankPhoneNumber: '92481750',
    bankAccountLabel: 'حساب تحويل بنكي مباشر — دار لازورد للعطور',
    whatsappNumber: '96879115527',
    currencyLabel: 'ر.ع',
  },
  products: [
    {
      id: 'prod-oud-sultani',
      nameAr: 'عود لازورد الملكي',
      category: 'perfume',
      notesAr: 'العود الكمبودي المعتّق · الزعفران الفاخر · العنبر الأسود وخشب الصندل',
      sizeLabel: '100 مل · Eau de Parfum',
      priceOmr: 34.0,
      imageUrl: '/src/assets/images/perfume_royal_oud_1795258094810.jpg',
      featured: true,
      createdAt: '2026-10-12T09:00:00.000Z',
    },
    {
      id: 'prod-amber-velvet',
      nameAr: 'عنبر مخملي',
      category: 'perfume',
      notesAr: 'العنبر الدافئ · الفانيليا المدغشقرية · الهيل المحمّص واللبان الحوجري',
      sizeLabel: '100 مل · Extrait de Parfum',
      priceOmr: 28.5,
      imageUrl: '/src/assets/images/perfume_amber_velvet_1795258095576.jpg',
      featured: true,
      createdAt: '2026-10-14T09:00:00.000Z',
    },
    {
      id: 'prod-musk-saffron',
      nameAr: 'مسك الزعفران الأبيض',
      category: 'perfume',
      notesAr: 'المسك الصافي · خيوط الزعفران · زهر البرتقال وخشب الأرز الناعم',
      sizeLabel: '75 مل · Eau de Parfum',
      priceOmr: 24.0,
      imageUrl: '/src/assets/images/perfume_musk_saffron_1795258094847.jpg',
      featured: false,
      createdAt: '2026-10-16T09:00:00.000Z',
    },
    {
      id: 'prod-bukhoor-diwan',
      nameAr: 'بخور الديوان الفاخر',
      category: 'bukhoor',
      notesAr: 'رقائق العود الطبيعي المشبعة بدهن الورد الطائفي والعنبر الملكي',
      sizeLabel: '60 جم · علبة محفوظة',
      priceOmr: 18.0,
      imageUrl: '/src/assets/images/bukhoor_royal_charcoal_1795258094434.jpg',
      featured: true,
      createdAt: '2026-10-18T09:00:00.000Z',
    },
    {
      id: 'prod-bukhoor-taif',
      nameAr: 'معمول الطائف المعتّق',
      category: 'bukhoor',
      notesAr: 'كرات بخور يدوية بمسك الغزال والورد الطائفي ودهن العود الهندي',
      sizeLabel: '80 جم · وعاء خزفي ذهبي',
      priceOmr: 21.5,
      imageUrl: '/src/assets/images/bukhoor_taif_incense_1795258094152.jpg',
      featured: false,
      createdAt: '2026-10-20T09:00:00.000Z',
    },
  ],
  promoCodes: [
    {
      id: 'promo-lazord15',
      code: 'LAZORD15',
      discountType: 'percentage',
      value: 15,
      active: true,
      createdAt: '2026-10-10T08:00:00.000Z',
    },
    {
      id: 'promo-oud5',
      code: 'OUD5',
      discountType: 'fixed',
      value: 5,
      active: true,
      createdAt: '2026-10-15T08:00:00.000Z',
    },
  ],
  orders: [],
};

// --- Warm In-Memory Fallback & Safe Persistence ---

declare global {
  var __lazordWarmStore: PersistedStoreState | undefined;
  var __lazordWarmUploads: Map<string, { contentType: string; data: Buffer }> | undefined;
  var __lazordEphemeralSecret: string | undefined;
}

function isServerlessReadOnlyRuntime(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.VERCEL_ENV ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.NOW_REGION
  );
}

interface KvCredentials {
  url: string;
  token: string;
}

function getKvCredentials(): KvCredentials | null {
  const url = (
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    ''
  ).trim();
  const token = (
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    ''
  ).trim();

  if (!url || !token || !/^https?:\/\//i.test(url)) {
    return null;
  }
  return { url: url.replace(/\/+$/, ''), token };
}

async function kvCommand<T>(creds: KvCredentials, args: (string | number)[]): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), KV_TIMEOUT_MS);
  try {
    const response = await fetch(creds.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`KV HTTP ${response.status}`);
    }
    const payload = (await response.json()) as { result?: T; error?: string };
    if (payload.error) {
      throw new Error(payload.error);
    }
    return payload.result ?? null;
  } finally {
    clearTimeout(timer);
  }
}

function getStoragePaths(): { dataDir: string; uploadsDir: string; storeFile: string } {
  const baseDir = isServerlessReadOnlyRuntime()
    ? path.join(os.tmpdir(), 'lazord-data')
    : path.resolve(process.cwd(), 'data');
  return {
    dataDir: baseDir,
    uploadsDir: path.join(baseDir, 'uploads'),
    storeFile: path.join(baseDir, 'lazord-store.json'),
  };
}

function ensureStorageDirs(): { dataDir: string; uploadsDir: string; storeFile: string } {
  const paths = getStoragePaths();
  fs.mkdirSync(paths.dataDir, { recursive: true });
  fs.mkdirSync(paths.uploadsDir, { recursive: true });
  return paths;
}

function cloneSeedState(): PersistedStoreState {
  return JSON.parse(JSON.stringify(INITIAL_SEED_STATE)) as PersistedStoreState;
}

function normalizeStoreState(raw: unknown): PersistedStoreState {
  const parsed = (raw && typeof raw === 'object' ? raw : {}) as Partial<PersistedStoreState>;
  const seed = cloneSeedState();
  const loadedSettings = parsed.settings ? { ...seed.settings, ...parsed.settings } : seed.settings;
  if (loadedSettings.whatsappNumber === '96892481750') {
    loadedSettings.whatsappNumber = '96879115527';
  }
  return {
    products: Array.isArray(parsed.products) ? parsed.products : seed.products,
    orders: Array.isArray(parsed.orders) ? parsed.orders : seed.orders,
    promoCodes: Array.isArray(parsed.promoCodes) ? parsed.promoCodes : seed.promoCodes,
    settings: loadedSettings,
    totalStoreVisits:
      typeof parsed.totalStoreVisits === 'number'
        ? Math.max(0, Math.floor(parsed.totalStoreVisits))
        : seed.totalStoreVisits,
    adminCredential:
      parsed.adminCredential &&
      typeof parsed.adminCredential.username === 'string' &&
      typeof parsed.adminCredential.salt === 'string' &&
      typeof parsed.adminCredential.hash === 'string'
        ? parsed.adminCredential
        : null,
    seedResetV2: parsed.seedResetV2 === true,
  };
}

function migrateLegacySeedState(raw: unknown): {
  state: PersistedStoreState;
  migrated: boolean;
} {
  const normalized = normalizeStoreState(raw);
  if (normalized.seedResetV2) {
    return { state: normalized, migrated: false };
  }

  const realOrders = normalized.orders.filter((order) => !LEGACY_SEED_ORDER_IDS.has(order.id));
  const nextVisits =
    realOrders.length === 0
      ? 0
      : Math.max(0, normalized.totalStoreVisits - LEGACY_SEED_VISITS);

  return {
    state: {
      ...normalized,
      orders: realOrders,
      totalStoreVisits: nextVisits,
      seedResetV2: true,
    },
    migrated: true,
  };
}

export async function readStoreState(): Promise<PersistedStoreState> {
  const kv = getKvCredentials();
  if (kv) {
    try {
      const rawJson = await kvCommand<string>(kv, ['GET', STORE_KV_KEY]);
      if (rawJson) {
        const { state, migrated } = migrateLegacySeedState(JSON.parse(rawJson));
        if (migrated) {
          await kvCommand(kv, ['SET', STORE_KV_KEY, JSON.stringify(state)]);
        }
        globalThis.__lazordWarmStore = state;
        return state;
      }
      const seeded = normalizeStoreState(INITIAL_SEED_STATE);
      await kvCommand(kv, ['SET', STORE_KV_KEY, JSON.stringify(seeded)]);
      globalThis.__lazordWarmStore = seeded;
      return seeded;
    } catch (err) {
      console.warn('LAZORD KV read fallback:', err instanceof Error ? err.message : 'KV error');
      if (globalThis.__lazordWarmStore) {
        return globalThis.__lazordWarmStore;
      }
    }
  }

  try {
    const { storeFile } = ensureStorageDirs();
    if (!fs.existsSync(storeFile)) {
      const initial = globalThis.__lazordWarmStore
        ? normalizeStoreState(globalThis.__lazordWarmStore)
        : normalizeStoreState(INITIAL_SEED_STATE);
      fs.writeFileSync(storeFile, JSON.stringify(initial, null, 2), 'utf8');
      globalThis.__lazordWarmStore = initial;
      return initial;
    }
    const raw = fs.readFileSync(storeFile, 'utf8');
    const { state, migrated } = migrateLegacySeedState(JSON.parse(raw));
    if (migrated) {
      const tmpFile = `${storeFile}.${crypto.randomUUID()}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf8');
      fs.renameSync(tmpFile, storeFile);
    }
    globalThis.__lazordWarmStore = state;
    return state;
  } catch {
    if (!globalThis.__lazordWarmStore) {
      globalThis.__lazordWarmStore = normalizeStoreState(INITIAL_SEED_STATE);
    }
    return globalThis.__lazordWarmStore;
  }
}

async function writeStoreState(state: PersistedStoreState): Promise<void> {
  const normalized = normalizeStoreState(state);
  globalThis.__lazordWarmStore = normalized;

  const kv = getKvCredentials();
  if (kv) {
    try {
      await kvCommand(kv, ['SET', STORE_KV_KEY, JSON.stringify(normalized)]);
      return;
    } catch (err) {
      console.warn('LAZORD KV write fallback:', err instanceof Error ? err.message : 'KV error');
    }
  }

  try {
    const { storeFile } = ensureStorageDirs();
    const tmpFile = `${storeFile}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(normalized, null, 2), 'utf8');
    fs.renameSync(tmpFile, storeFile);
  } catch {
    // Keep warm in-memory state if temp disk write is unavailable
  }
}

function getWarmUploadMap(): Map<string, { contentType: string; data: Buffer }> {
  if (!globalThis.__lazordWarmUploads) {
    globalThis.__lazordWarmUploads = new Map();
  }
  return globalThis.__lazordWarmUploads;
}

async function saveUploadedImage(params: {
  ext: 'png' | 'jpg' | 'webp';
  buffer: Buffer;
  originalDataUrl: string;
}): Promise<string> {
  const filename = `${crypto.randomUUID()}.${params.ext}`;
  const contentType =
    params.ext === 'png'
      ? 'image/png'
      : params.ext === 'webp'
        ? 'image/webp'
        : 'image/jpeg';

  const kv = getKvCredentials();
  if (kv) {
    try {
      await kvCommand(kv, [
        'SET',
        `${UPLOAD_KV_PREFIX}${filename}`,
        JSON.stringify({ contentType, base64: params.buffer.toString('base64') }),
      ]);
      return `/api/uploads/${filename}`;
    } catch (err) {
      console.warn('LAZORD KV upload fallback:', err instanceof Error ? err.message : 'KV error');
    }
  }

  // On serverless without persistent KV, embed small validated images as data URLs
  // so receipts and product photos stay intact across cold starts.
  if (isServerlessReadOnlyRuntime() && params.buffer.length <= 900 * 1024) {
    return params.originalDataUrl;
  }

  getWarmUploadMap().set(filename, { contentType, data: params.buffer });

  try {
    const { uploadsDir } = ensureStorageDirs();
    const resolved = path.resolve(uploadsDir, filename);
    if (resolved.startsWith(uploadsDir + path.sep)) {
      fs.writeFileSync(resolved, params.buffer);
    }
  } catch {
    // Warm map fallback stays populated
  }

  return `/api/uploads/${filename}`;
}

async function readUploadedImage(
  filename: string
): Promise<{ contentType: string; data: Buffer } | null> {
  if (!/^[a-zA-Z0-9-]+\.(png|jpg|webp)$/.test(filename)) {
    return null;
  }

  const kv = getKvCredentials();
  if (kv) {
    try {
      const raw = await kvCommand<string>(kv, ['GET', `${UPLOAD_KV_PREFIX}${filename}`]);
      if (raw) {
        const parsed = JSON.parse(raw) as { contentType?: string; base64?: string };
        if (parsed.contentType && parsed.base64) {
          return {
            contentType: parsed.contentType,
            data: Buffer.from(parsed.base64, 'base64'),
          };
        }
      }
    } catch {
      // Fall through to warm map / disk
    }
  }

  const cached = getWarmUploadMap().get(filename);
  if (cached) {
    return cached;
  }

  try {
    const { uploadsDir } = getStoragePaths();
    const resolved = path.resolve(uploadsDir, filename);
    if (!resolved.startsWith(uploadsDir + path.sep) || !fs.existsSync(resolved)) {
      return null;
    }
    const ext = path.extname(filename).toLowerCase();
    const contentType =
      ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    return {
      contentType,
      data: fs.readFileSync(resolved),
    };
  } catch {
    return null;
  }
}

// --- Pure Business & Auth Logic ---

function roundOmr(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function formatOmr(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${roundOmr(safe).toFixed(3)} ر.ع`;
}

function normalizePromoInput(rawCode: string): string {
  return rawCode.trim().toUpperCase();
}

function generateNextOrderNumber(existingOrderNumbers: string[]): string {
  let maxNum = 1000;
  for (const raw of existingOrderNumbers) {
    const match = /^LZD-(\d+)$/i.exec(raw.trim());
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
  }
  return `LZD-${maxNum + 1}`;
}

function generateUniqueTrackingNumber(existingTrackingNumbers: Iterable<string>): string {
  const existing = new Set(
    Array.from(existingTrackingNumbers, (code) => code.trim().toUpperCase())
  );
  for (let attempt = 0; attempt < 500; attempt++) {
    const numeric = crypto.randomInt(10000, 100000);
    const candidate = `TRK-LZD-${numeric}`;
    if (!existing.has(candidate)) {
      return candidate;
    }
  }
  throw new Error('Unable to generate unique tracking number');
}

function calculateCartTotals(
  items: { product: Product; quantity: number }[],
  promoCode: PromoCode | null
) {
  const originalSubtotal = roundOmr(
    items.reduce((sum, item) => sum + item.product.priceOmr * Math.max(0, Math.floor(item.quantity)), 0)
  );
  if (!promoCode || !promoCode.active || originalSubtotal <= 0) {
    return {
      originalSubtotal,
      discountAmount: 0,
      finalTotal: originalSubtotal,
      appliedCode: null as string | null,
    };
  }
  const rawDiscount =
    promoCode.discountType === 'percentage'
      ? originalSubtotal * (Math.min(100, Math.max(0, promoCode.value)) / 100)
      : Math.max(0, promoCode.value);
  const discountAmount = roundOmr(Math.min(originalSubtotal, rawDiscount));
  const finalTotal = roundOmr(Math.max(0, originalSubtotal - discountAmount));
  return {
    originalSubtotal,
    discountAmount,
    finalTotal,
    appliedCode: promoCode.code,
  };
}

function computeStoreAnalytics(orders: Order[], totalStoreVisits: number) {
  const approvedOrders = orders.filter(
    (o) => o.status !== 'قيد المراجعة' && o.status !== 'مرفوض'
  );
  return {
    totalSalesRevenue: roundOmr(
      approvedOrders.reduce((sum, o) => sum + (Number.isFinite(o.finalTotal) ? o.finalTotal : 0), 0)
    ),
    totalOrders: approvedOrders.length,
    pendingOrders: orders.filter((o) => o.status === 'قيد المراجعة').length,
    totalStoreVisits: Math.max(0, Math.floor(totalStoreVisits)),
  };
}

function sanitizeWhatsAppDigits(phone: string): string {
  const ascii = String(phone || '')
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0));
  const digits = ascii.replace(/[^\d]/g, '').replace(/^0+/, '');
  if (!digits) return '';
  if (digits.startsWith('968')) {
    const subscriber = digits.slice(3).replace(/^0+/, '');
    if (subscriber.length === 8) {
      return `968${subscriber}`;
    }
  }
  if (digits.length === 8) {
    return `968${digits}`;
  }
  return digits;
}

function validateCheckoutInput(input: {
  customerName: string;
  customerPhone: string;
  city: string;
  address: string;
  receiptImageUrl: string;
  itemCount: number;
}): string | null {
  if (input.itemCount <= 0) return 'سلة التسوق فارغة، يرجى إضافة منتج واحد على الأقل.';
  if (input.customerName.trim().length < 2) return 'يرجى إدخال الاسم الكامل بشكل صحيح.';
  if (sanitizeWhatsAppDigits(input.customerPhone).length < 8) {
    return 'يرجى إدخال رقم هاتف صحيح للتواصل.';
  }
  if (!OMAN_GOVERNORATES.includes(input.city.trim() as (typeof OMAN_GOVERNORATES)[number])) {
    return 'يرجى اختيار المحافظة داخل سلطنة عُمان.';
  }
  if (input.address.trim().length < 4) return 'يرجى إدخال الولاية والمنطقة وتفاصيل العنوان.';
  if (!input.receiptImageUrl.trim()) return 'يرجى رفع صورة إيصال التحويل البنكي قبل تأكيد الطلب.';
  return null;
}

function constantTimeMatch(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function cleanEnvValue(value: string | undefined): string {
  const trimmed = (value || '').trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function getEffectiveSessionSecret(state?: PersistedStoreState): string {
  const explicit = cleanEnvValue(process.env.LAZORD_SESSION_SECRET);
  if (explicit) return explicit;

  const envPass = cleanEnvValue(process.env.LAZORD_ADMIN_PASSWORD);
  if (envPass) {
    const envUser = cleanEnvValue(process.env.LAZORD_ADMIN_USERNAME) || 'owner@lazord.om';
    return crypto
      .createHmac('sha256', 'lazord-owner-session-key-v1')
      .update(`${envUser}\0${envPass}`)
      .digest('hex');
  }

  if (state?.adminCredential) {
    return crypto
      .createHmac('sha256', 'lazord-claim-session-v1')
      .update(
        `${state.adminCredential.username}\0${state.adminCredential.salt}\0${state.adminCredential.hash}`
      )
      .digest('hex');
  }

  if (!globalThis.__lazordEphemeralSecret) {
    globalThis.__lazordEphemeralSecret = crypto.randomBytes(32).toString('hex');
  }
  return globalThis.__lazordEphemeralSecret;
}

function signSessionToken(username: string, secret: string): string {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ username, exp }), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionToken(
  token: string | undefined,
  secret: string
): { username: string } | null {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      username?: string;
      exp?: number;
    };
    if (!parsed.username || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      return null;
    }
    return { username: parsed.username };
  } catch {
    return null;
  }
}

function hashPasswordScrypt(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password.trim(), salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPasswordScrypt(password: string, salt: string, expectedHash: string): boolean {
  if (!password || !salt || !expectedHash) return false;
  const derived = crypto.scryptSync(password.trim(), salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

// --- HTTP Helpers ---

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  if (res.writableEnded) return;
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function sendBuffer(
  res: ServerResponse,
  statusCode: number,
  contentType: string,
  data: Buffer | string,
  cacheControl = 'no-store'
): void {
  if (res.writableEnded) return;
  res.statusCode = statusCode;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', cacheControl);
  res.end(data);
}

async function readJsonBody<T = Record<string, unknown>>(req: IncomingMessage): Promise<T> {
  const maybePreparsed = (req as IncomingMessage & { body?: unknown }).body;
  if (maybePreparsed !== undefined && maybePreparsed !== null) {
    if (typeof maybePreparsed === 'string') {
      if (!maybePreparsed.trim()) return {} as T;
      return JSON.parse(maybePreparsed) as T;
    }
    if (Buffer.isBuffer(maybePreparsed)) {
      const text = maybePreparsed.toString('utf8').trim();
      return text ? (JSON.parse(text) as T) : ({} as T);
    }
    if (typeof maybePreparsed === 'object') {
      return maybePreparsed as T;
    }
  }

  return new Promise<T>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    req.on('data', (chunk: Buffer | string) => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      totalBytes += buf.length;
      if (totalBytes > MAX_JSON_BODY_BYTES) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(buf);
    });

    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({} as T);
        return;
      }
      try {
        resolve(JSON.parse(raw) as T);
      } catch {
        reject(new Error('INVALID_JSON'));
      }
    });

    req.on('error', (err) => reject(err));
  });
}

function parseCookies(cookieHeader: string | string[] | undefined): Record<string, string> {
  const raw = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader;
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

function extractSessionToken(req: IncomingMessage): string | undefined {
  const authHeader = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization;
  if (typeof authHeader === 'string') {
    const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
    if (match && match[1]) return match[1].trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE_NAME];
}

function buildCookieAttributes(req: IncomingMessage, maxAgeSeconds: number): string {
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  const isHttps =
    proto === 'https' ||
    Boolean((req.socket as { encrypted?: boolean } | undefined)?.encrypted);
  const sameSite = isHttps ? 'SameSite=None; Secure; Partitioned' : 'SameSite=Lax';
  return `HttpOnly; Path=/; ${sameSite}; Max-Age=${maxAgeSeconds}`;
}

function resolveApiPathname(reqUrl: string | undefined): string {
  const parsed = new URL(reqUrl || '/', 'http://localhost');
  const rewrittenPath = parsed.searchParams.get('__apiPath');
  if (rewrittenPath !== null) {
    const clean = rewrittenPath.replace(/^\/+/, '');
    return clean ? `/api/${clean}` : '/api';
  }
  return parsed.pathname;
}

function toPublicTracking(order: Order) {
  return {
    orderNumber: order.orderNumber,
    trackingNumber: order.trackingNumber,
    customerName: order.customerName,
    city: order.city,
    items: order.items,
    originalSubtotal: order.originalSubtotal,
    promoCodeUsed: order.promoCodeUsed,
    discountAmount: order.discountAmount,
    finalTotal: order.finalTotal,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

// --- Main Vercel Serverless / Unified API Handler ---

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const method = (req.method || 'GET').toUpperCase();
  const pathname = resolveApiPathname(req.url);

  try {
    if (method === 'GET' && pathname === '/api/health') {
      sendJson(res, 200, {
        ok: true,
        envAuthConfigured: Boolean(cleanEnvValue(process.env.LAZORD_ADMIN_PASSWORD)),
        kvConfigured: Boolean(getKvCredentials()),
      });
      return;
    }

    if (method === 'GET' && pathname === '/api/storefront') {
      const state = await readStoreState();
      sendJson(res, 200, {
        products: state.products,
        settings: state.settings,
      });
      return;
    }

    if (method === 'POST' && pathname === '/api/visits') {
      const state = await readStoreState();
      state.totalStoreVisits += 1;
      await writeStoreState(state);
      sendJson(res, 200, { ok: true, totalStoreVisits: state.totalStoreVisits });
      return;
    }

    if (method === 'POST' && pathname === '/api/uploads') {
      const body = await readJsonBody<{ dataUrl?: string }>(req);
      const dataUrl = body.dataUrl;
      if (!dataUrl || typeof dataUrl !== 'string') {
        sendJson(res, 400, { error: 'يرجى اختيار صورة صالحة للرفع.' });
        return;
      }

      const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
      if (!match) {
        sendJson(res, 400, { error: 'صيغة الصورة غير مدعومة. الصيغ المدعومة: PNG, JPG, WEBP.' });
        return;
      }

      const ext = (match[1] === 'jpeg' ? 'jpg' : match[1]) as 'png' | 'jpg' | 'webp';
      const buffer = Buffer.from(match[2], 'base64');
      if (buffer.length > 5 * 1024 * 1024) {
        sendJson(res, 400, { error: 'حجم الصورة يتجاوز الحد الأقصى المسموح (5 ميجابايت).' });
        return;
      }

      const url = await saveUploadedImage({ ext, buffer, originalDataUrl: dataUrl });
      sendJson(res, 201, { url });
      return;
    }

    if (method === 'GET' && pathname.startsWith('/api/uploads/')) {
      const filename = decodeURIComponent(pathname.slice('/api/uploads/'.length));
      const asset = await readUploadedImage(filename);
      if (!asset) {
        sendJson(res, 404, { error: 'الصورة المطلوبة غير موجودة.' });
        return;
      }
      sendBuffer(res, 200, asset.contentType, asset.data, 'public, max-age=31536000, immutable');
      return;
    }

    if (method === 'GET' && pathname.startsWith('/api/seed-receipt/')) {
      const orderNumber = decodeURIComponent(pathname.slice('/api/seed-receipt/'.length));
      const state = await readStoreState();
      const order = state.orders.find((o) => o.orderNumber === orderNumber);
      const amountText = escapeXml(order ? formatOmr(order.finalTotal) : '0.000 ر.ع');
      const refText = escapeXml(order ? order.orderNumber : 'LZD-1000');
      const senderText = escapeXml(order ? order.customerName : 'عميل لازورد');
      const bankPhoneText = escapeXml(state.settings.bankPhoneNumber);

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="640" viewBox="0 0 520 640">
      <rect width="520" height="640" fill="#FAF8F4"/>
      <rect x="24" y="24" width="472" height="592" rx="12" fill="#FFFFFF" stroke="#E5DEC9" stroke-width="2"/>
      <rect x="24" y="24" width="472" height="96" rx="12" fill="#141311"/>
      <text x="260" y="68" text-anchor="middle" fill="#B59449" font-family="sans-serif" font-size="20" font-weight="bold">إيصال تحويل بنكي إلكتروني</text>
      <text x="260" y="96" text-anchor="middle" fill="#F2EDE3" font-family="monospace" font-size="13">BANK TRANSFER RECEIPT · ${refText}</text>
      <circle cx="260" cy="175" r="28" fill="#16A34A" fill-opacity="0.12"/>
      <path d="M248 175 l8 8 l16 -16" fill="none" stroke="#16A34A" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="260" y="226" text-anchor="middle" fill="#181715" font-family="sans-serif" font-size="18" font-weight="bold">تم تنفيذ التحويل بنجاح</text>
      <text x="260" y="264" text-anchor="middle" fill="#8E6F2D" font-family="monospace" font-size="28" font-weight="bold">${amountText}</text>
      <line x1="56" y1="296" x2="464" y2="296" stroke="#ECE6D8" stroke-width="1.5"/>
      <text x="448" y="340" text-anchor="end" fill="#615B52" font-family="sans-serif" font-size="14">المحوِّل</text>
      <text x="72" y="340" text-anchor="start" fill="#181715" font-family="sans-serif" font-size="15" font-weight="bold">${senderText}</text>
      <text x="448" y="388" text-anchor="end" fill="#615B52" font-family="sans-serif" font-size="14">المستفيد</text>
      <text x="72" y="388" text-anchor="start" fill="#181715" font-family="sans-serif" font-size="15" font-weight="bold">LAZORD | لازورد</text>
      <text x="448" y="436" text-anchor="end" fill="#615B52" font-family="sans-serif" font-size="14">رقم الحساب / الهاتف</text>
      <text x="72" y="436" text-anchor="start" fill="#181715" font-family="monospace" font-size="15">${bankPhoneText}</text>
      <text x="448" y="484" text-anchor="end" fill="#615B52" font-family="sans-serif" font-size="14">رقم المرجع</text>
      <text x="72" y="484" text-anchor="start" fill="#181715" font-family="monospace" font-size="15">OM-${refText}-BANK</text>
      <line x1="56" y1="528" x2="464" y2="528" stroke="#ECE6D8" stroke-width="1.5" stroke-dasharray="6 4"/>
      <text x="260" y="572" text-anchor="middle" fill="#615B52" font-family="sans-serif" font-size="12">نسخة إيصال معتمدة للمراجعة في لوحة تحكم لازورد</text>
    </svg>`;
      sendBuffer(res, 200, 'image/svg+xml; charset=utf-8', svg, 'public, max-age=3600');
      return;
    }

    if (method === 'POST' && pathname === '/api/promo/validate') {
      const body = await readJsonBody<{
        code?: string;
        items?: { productId: string; quantity: number }[];
      }>(req);

      const normalized = normalizePromoInput(body.code || '');
      if (!normalized) {
        sendJson(res, 400, { error: 'يرجى إدخال كود الخصم أولاً.' });
        return;
      }

      const state = await readStoreState();
      const promo = state.promoCodes.find((p) => normalizePromoInput(p.code) === normalized);
      if (!promo) {
        sendJson(res, 404, { error: 'كود الخصم غير موجود. تأكد من كتابة الكود بشكل صحيح.' });
        return;
      }
      if (!promo.active) {
        sendJson(res, 400, { error: 'كود الخصم هذا متوقف حالياً.' });
        return;
      }

      const resolvedItems = (Array.isArray(body.items) ? body.items : [])
        .map((entry) => {
          const product = state.products.find((p) => p.id === entry.productId);
          return product ? { product, quantity: entry.quantity } : null;
        })
        .filter((x): x is { product: Product; quantity: number } => x !== null);

      const totals = calculateCartTotals(resolvedItems, promo);
      sendJson(res, 200, { valid: true, promo, totals });
      return;
    }

    if (method === 'POST' && pathname === '/api/orders') {
      const body = await readJsonBody<{
        customerName?: string;
        customerPhone?: string;
        city?: string;
        address?: string;
        items?: { productId: string; quantity: number }[];
        promoCode?: string | null;
        receiptImageUrl?: string;
      }>(req);

      const state = await readStoreState();
      const requestedItems = Array.isArray(body.items) ? body.items : [];
      const cartPairs: { product: Product; quantity: number }[] = [];
      const orderItems: OrderItem[] = [];

      for (const entry of requestedItems) {
        const product = state.products.find((p) => p.id === entry.productId);
        const qty = Math.max(0, Math.floor(Number(entry.quantity) || 0));
        if (!product || qty <= 0) continue;
        cartPairs.push({ product, quantity: qty });
        orderItems.push({
          productId: product.id,
          nameAr: product.nameAr,
          category: product.category,
          sizeLabel: product.sizeLabel,
          unitPriceOmr: product.priceOmr,
          quantity: qty,
          lineTotalOmr: roundOmr(product.priceOmr * qty),
        });
      }

      const validationError = validateCheckoutInput({
        customerName: body.customerName || '',
        customerPhone: body.customerPhone || '',
        city: body.city || '',
        address: body.address || '',
        receiptImageUrl: body.receiptImageUrl || '',
        itemCount: orderItems.length,
      });

      if (validationError) {
        sendJson(res, 400, { error: validationError });
        return;
      }

      let matchedPromo: PromoCode | null = null;
      if (body.promoCode && body.promoCode.trim()) {
        const normalized = normalizePromoInput(body.promoCode);
        const found = state.promoCodes.find(
          (p) => normalizePromoInput(p.code) === normalized && p.active
        );
        if (!found) {
          sendJson(res, 400, { error: 'كود الخصم المستخدم غير صالح أو غير مفعّل.' });
          return;
        }
        matchedPromo = found;
      }

      const totals = calculateCartTotals(cartPairs, matchedPromo);
      const orderNumber = generateNextOrderNumber(state.orders.map((o) => o.orderNumber));
      const trackingNumber = generateUniqueTrackingNumber(
        state.orders.map((o) => o.trackingNumber)
      );
      const now = new Date().toISOString();

      const newOrder: Order = {
        id: `ord-${crypto.randomUUID()}`,
        orderNumber,
        trackingNumber,
        customerName: (body.customerName || '').trim(),
        customerPhone: (body.customerPhone || '').trim(),
        city: (body.city || '').trim(),
        address: (body.address || '').trim(),
        items: orderItems,
        originalSubtotal: totals.originalSubtotal,
        promoCodeUsed: totals.appliedCode,
        discountAmount: totals.discountAmount,
        finalTotal: totals.finalTotal,
        receiptImageUrl: (body.receiptImageUrl || '').trim(),
        status: 'قيد المراجعة',
        createdAt: now,
        updatedAt: now,
      };

      state.orders.unshift(newOrder);
      await writeStoreState(state);
      sendJson(res, 201, { order: newOrder });
      return;
    }

    if (method === 'GET' && pathname.startsWith('/api/orders/track/')) {
      const query = decodeURIComponent(pathname.slice('/api/orders/track/'.length))
        .trim()
        .toUpperCase();
      if (!query) {
        sendJson(res, 400, { error: 'يرجى إدخال رقم التتبع.' });
        return;
      }
      const state = await readStoreState();
      const order = state.orders.find((o) => o.trackingNumber.toUpperCase() === query);
      if (!order) {
        sendJson(res, 404, {
          error: 'لم يتم العثور على طلب بهذا رقم التتبع. تأكد من الرقم وحاول مرة أخرى.',
        });
        return;
      }
      sendJson(res, 200, { order: toPublicTracking(order) });
      return;
    }

    // --- Owner Authentication API ---
    if (method === 'GET' && pathname === '/api/auth/session') {
      const envPassword = cleanEnvValue(process.env.LAZORD_ADMIN_PASSWORD);
      const state = envPassword ? undefined : await readStoreState();
      const secret = getEffectiveSessionSecret(state);
      const session = verifySessionToken(extractSessionToken(req), secret);
      const needsSetup = !envPassword && !state?.adminCredential;

      if (!session) {
        sendJson(res, 200, { authenticated: false, needsSetup });
        return;
      }
      sendJson(res, 200, { authenticated: true, username: session.username, needsSetup: false });
      return;
    }

    if (method === 'POST' && pathname === '/api/auth/setup') {
      if (cleanEnvValue(process.env.LAZORD_ADMIN_PASSWORD)) {
        sendJson(res, 403, { error: 'تم إعداد بيانات الدخول مسبقاً عبر متغيرات البيئة.' });
        return;
      }
      const state = await readStoreState();
      if (state.adminCredential) {
        sendJson(res, 403, { error: 'تم تفعيل حساب صاحب البراند مسبقاً.' });
        return;
      }

      const body = await readJsonBody<{ username?: string; password?: string }>(req);
      const cleanUser = (body.username || '').trim();
      const cleanPass = (body.password || '').trim();
      if (cleanUser.length < 3 || cleanPass.length < 6) {
        sendJson(res, 400, {
          error: 'يرجى إدخال بريد أو اسم مستخدم (3 أحرف فأكثر) وكلمة مرور لا تقل عن 6 أحرف.',
        });
        return;
      }

      const { salt, hash } = hashPasswordScrypt(cleanPass);
      state.adminCredential = { username: cleanUser, salt, hash };
      await writeStoreState(state);

      const secret = getEffectiveSessionSecret(state);
      const token = signSessionToken(cleanUser, secret);
      const cookieAttrs = buildCookieAttributes(req, Math.floor(SESSION_TTL_MS / 1000));
      res.setHeader(
        'Set-Cookie',
        `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieAttrs}`
      );
      sendJson(res, 201, { authenticated: true, username: cleanUser, token });
      return;
    }

    if (method === 'POST' && pathname === '/api/auth/login') {
      const body = await readJsonBody<{ username?: string; password?: string }>(req);
      const cleanUser = (body.username || '').trim();
      const cleanPass = (body.password || '').trim();

      const envPass = cleanEnvValue(process.env.LAZORD_ADMIN_PASSWORD);
      const envUser = cleanEnvValue(process.env.LAZORD_ADMIN_USERNAME) || 'owner@lazord.om';

      if (envPass) {
        const userValid = constantTimeMatch(cleanUser.toLowerCase(), envUser.toLowerCase());
        const passValid = constantTimeMatch(cleanPass, envPass);
        if (!userValid || !passValid) {
          sendJson(res, 401, {
            error:
              'بيانات الدخول غير صحيحة. يرجى التحقق من البريد/اسم المستخدم وكلمة المرور.',
          });
          return;
        }
        const secret = getEffectiveSessionSecret();
        const token = signSessionToken(envUser, secret);
        const cookieAttrs = buildCookieAttributes(req, Math.floor(SESSION_TTL_MS / 1000));
        res.setHeader(
          'Set-Cookie',
          `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieAttrs}`
        );
        sendJson(res, 200, {
          authenticated: true,
          username: envUser,
          token,
        });
        return;
      }

      const state = await readStoreState();
      if (!state.adminCredential) {
        sendJson(res, 400, {
          error:
            'يرجى إعداد حساب صاحب البراند أو ضبط متغيرات البيئة LAZORD_ADMIN_USERNAME و LAZORD_ADMIN_PASSWORD.',
          needsSetup: true,
        });
        return;
      }

      const userMatches = constantTimeMatch(
        cleanUser.toLowerCase(),
        state.adminCredential.username.trim().toLowerCase()
      );
      const passMatches = verifyPasswordScrypt(
        cleanPass,
        state.adminCredential.salt,
        state.adminCredential.hash
      );

      if (!userMatches || !passMatches) {
        sendJson(res, 401, {
          error:
            'بيانات الدخول غير صحيحة. يرجى التحقق من البريد/اسم المستخدم وكلمة المرور.',
        });
        return;
      }

      const secret = getEffectiveSessionSecret(state);
      const token = signSessionToken(state.adminCredential.username, secret);
      const cookieAttrs = buildCookieAttributes(req, Math.floor(SESSION_TTL_MS / 1000));
      res.setHeader(
        'Set-Cookie',
        `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieAttrs}`
      );
      sendJson(res, 200, {
        authenticated: true,
        username: state.adminCredential.username,
        token,
      });
      return;
    }

    if (method === 'POST' && pathname === '/api/auth/logout') {
      const cookieAttrs = buildCookieAttributes(req, 0);
      res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=; ${cookieAttrs}`);
      sendJson(res, 200, { authenticated: false });
      return;
    }

    // --- Protected Owner Admin API ---
    if (pathname.startsWith('/api/admin/')) {
      const envPass = cleanEnvValue(process.env.LAZORD_ADMIN_PASSWORD);
      const state = await readStoreState();
      const secret = getEffectiveSessionSecret(envPass ? undefined : state);
      const session = verifySessionToken(extractSessionToken(req), secret);
      if (!session) {
        sendJson(res, 401, { error: 'غير مصرح بالدخول. يرجى تسجيل الدخول كصاحب البراند.' });
        return;
      }

      if (method === 'GET' && pathname === '/api/admin/dashboard') {
        const analytics = computeStoreAnalytics(state.orders, state.totalStoreVisits);
        sendJson(res, 200, {
          analytics,
          orders: state.orders,
          products: state.products,
          promoCodes: state.promoCodes,
          settings: state.settings,
        });
        return;
      }

      const orderStatusMatch = /^\/api\/admin\/orders\/([^/]+)\/status$/.exec(pathname);
      if (method === 'PATCH' && orderStatusMatch) {
        const id = decodeURIComponent(orderStatusMatch[1]);
        const body = await readJsonBody<{ status?: OrderStatus }>(req);
        const status = body.status;
        if (!status || !ORDER_STATUS_LIST.includes(status)) {
          sendJson(res, 400, { error: 'حالة الطلب المحددة غير صالحة.' });
          return;
        }

        const order = state.orders.find((o) => o.id === id);
        if (!order) {
          sendJson(res, 404, { error: 'الطلب غير موجود.' });
          return;
        }

        order.status = status;
        order.updatedAt = new Date().toISOString();
        await writeStoreState(state);

        sendJson(res, 200, {
          order,
          analytics: computeStoreAnalytics(state.orders, state.totalStoreVisits),
        });
        return;
      }

      if (method === 'POST' && pathname === '/api/admin/products') {
        const body = await readJsonBody<Partial<Product>>(req);
        const nameAr = (body.nameAr || '').trim();
        const notesAr = (body.notesAr || '').trim();
        const sizeLabel = (body.sizeLabel || '').trim();
        const priceOmr = roundOmr(Number(body.priceOmr));
        const category = body.category === 'bukhoor' ? 'bukhoor' : 'perfume';
        const imageUrl = (body.imageUrl || '').trim();

        if (!nameAr || !notesAr || !Number.isFinite(priceOmr) || priceOmr <= 0) {
          sendJson(res, 400, { error: 'يرجى إدخال اسم المنتج والوصف العطري وسعر صحيح.' });
          return;
        }

        const newProduct: Product = {
          id: `prod-${crypto.randomUUID().slice(0, 8)}`,
          nameAr,
          category,
          notesAr,
          sizeLabel: sizeLabel || (category === 'perfume' ? '100 مل · Eau de Parfum' : '60 جم'),
          priceOmr,
          imageUrl:
            imageUrl ||
            (category === 'perfume'
              ? '/src/assets/images/perfume_royal_oud_1795258094810.jpg'
              : '/src/assets/images/bukhoor_royal_charcoal_1795258094434.jpg'),
          featured: Boolean(body.featured),
          createdAt: new Date().toISOString(),
        };

        state.products.unshift(newProduct);
        await writeStoreState(state);
        sendJson(res, 201, { product: newProduct });
        return;
      }

      const productMatch = /^\/api\/admin\/products\/([^/]+)$/.exec(pathname);
      if (productMatch) {
        const id = decodeURIComponent(productMatch[1]);
        if (method === 'PUT') {
          const body = await readJsonBody<Partial<Product>>(req);
          const index = state.products.findIndex((p) => p.id === id);
          if (index === -1) {
            sendJson(res, 404, { error: 'المنتج غير موجود.' });
            return;
          }

          const existing = state.products[index];
          const priceOmr =
            body.priceOmr !== undefined ? roundOmr(Number(body.priceOmr)) : existing.priceOmr;
          if (!Number.isFinite(priceOmr) || priceOmr <= 0) {
            sendJson(res, 400, { error: 'يرجى إدخال سعر صحيح للمنتج.' });
            return;
          }

          const updated: Product = {
            ...existing,
            nameAr: body.nameAr !== undefined ? body.nameAr.trim() || existing.nameAr : existing.nameAr,
            category:
              body.category === 'bukhoor' || body.category === 'perfume'
                ? body.category
                : existing.category,
            notesAr:
              body.notesAr !== undefined ? body.notesAr.trim() || existing.notesAr : existing.notesAr,
            sizeLabel:
              body.sizeLabel !== undefined
                ? body.sizeLabel.trim() || existing.sizeLabel
                : existing.sizeLabel,
            priceOmr,
            imageUrl:
              body.imageUrl !== undefined
                ? body.imageUrl.trim() || existing.imageUrl
                : existing.imageUrl,
          };

          state.products[index] = updated;
          await writeStoreState(state);
          sendJson(res, 200, { product: updated });
          return;
        }

        if (method === 'DELETE') {
          const nextProducts = state.products.filter((p) => p.id !== id);
          if (nextProducts.length === state.products.length) {
            sendJson(res, 404, { error: 'المنتج غير موجود.' });
            return;
          }
          state.products = nextProducts;
          await writeStoreState(state);
          sendJson(res, 200, { ok: true });
          return;
        }
      }

      if (method === 'POST' && pathname === '/api/admin/promo-codes') {
        const body = await readJsonBody<Partial<PromoCode>>(req);
        const code = normalizePromoInput(body.code || '');
        const discountType = body.discountType === 'fixed' ? 'fixed' : 'percentage';
        const value = Number(body.value);

        if (!code || code.length < 2) {
          sendJson(res, 400, { error: 'يرجى إدخال كود خصم لا يقل عن حرفين.' });
          return;
        }
        if (!Number.isFinite(value) || value <= 0) {
          sendJson(res, 400, { error: 'يرجى إدخال قيمة خصم صحيحة أكبر من صفر.' });
          return;
        }
        if (discountType === 'percentage' && value > 100) {
          sendJson(res, 400, { error: 'نسبة الخصم لا يمكن أن تتجاوز 100%.' });
          return;
        }

        if (state.promoCodes.some((p) => normalizePromoInput(p.code) === code)) {
          sendJson(res, 409, { error: 'هذا الكود موجود بالفعل.' });
          return;
        }

        const newPromo: PromoCode = {
          id: `promo-${crypto.randomUUID().slice(0, 8)}`,
          code,
          discountType,
          value: roundOmr(value),
          active: body.active !== undefined ? Boolean(body.active) : true,
          createdAt: new Date().toISOString(),
        };

        state.promoCodes.unshift(newPromo);
        await writeStoreState(state);
        sendJson(res, 201, { promoCode: newPromo });
        return;
      }

      const promoMatch = /^\/api\/admin\/promo-codes\/([^/]+)$/.exec(pathname);
      if (promoMatch) {
        const id = decodeURIComponent(promoMatch[1]);
        if (method === 'PATCH') {
          const body = await readJsonBody<Partial<PromoCode>>(req);
          const promo = state.promoCodes.find((p) => p.id === id);
          if (!promo) {
            sendJson(res, 404, { error: 'كود الخصم غير موجود.' });
            return;
          }
          if (typeof body.active === 'boolean') {
            promo.active = body.active;
          }
          await writeStoreState(state);
          sendJson(res, 200, { promoCode: promo });
          return;
        }

        if (method === 'DELETE') {
          const next = state.promoCodes.filter((p) => p.id !== id);
          if (next.length === state.promoCodes.length) {
            sendJson(res, 404, { error: 'كود الخصم غير موجود.' });
            return;
          }
          state.promoCodes = next;
          await writeStoreState(state);
          sendJson(res, 200, { ok: true });
          return;
        }
      }

      if (method === 'PUT' && pathname === '/api/admin/settings') {
        const body = await readJsonBody<Partial<StoreSettings>>(req);
        state.settings = {
          ...state.settings,
          brandBio:
            body.brandBio !== undefined
              ? body.brandBio.trim() || state.settings.brandBio
              : state.settings.brandBio,
          bankPhoneNumber:
            body.bankPhoneNumber !== undefined
              ? body.bankPhoneNumber.trim() || state.settings.bankPhoneNumber
              : state.settings.bankPhoneNumber,
          bankAccountLabel:
            body.bankAccountLabel !== undefined
              ? body.bankAccountLabel.trim() || state.settings.bankAccountLabel
              : state.settings.bankAccountLabel,
          whatsappNumber:
            body.whatsappNumber !== undefined
              ? (() => {
                  const cleaned = sanitizeWhatsAppDigits(body.whatsappNumber);
                  return cleaned.length >= 8 ? cleaned : state.settings.whatsappNumber;
                })()
              : state.settings.whatsappNumber,
        };
        await writeStoreState(state);
        sendJson(res, 200, { settings: state.settings });
        return;
      }
    }

    sendJson(res, 404, { error: 'المسار غير موجود.' });
  } catch (err) {
    if (err instanceof Error && err.message === 'PAYLOAD_TOO_LARGE') {
      sendJson(res, 413, { error: 'حجم البيانات المرسلة كبير جداً.' });
      return;
    }
    if (err instanceof Error && err.message === 'INVALID_JSON') {
      sendJson(res, 400, { error: 'صيغة البيانات المرسلة غير صالحة.' });
      return;
    }
    console.error('LAZORD API error:', err instanceof Error ? err.message : 'Unknown error');
    sendJson(res, 500, { error: 'حدث خطأ غير متوقع في الخادم. يرجى المحاولة مرة أخرى.' });
  }
}
