import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { INITIAL_SEED_STATE, type PersistedStoreState } from './src/lib/seedData';
import {
  extractBearerToken,
  signSessionToken,
  verifyOwnerCredentials,
  verifySessionToken,
} from './src/lib/authTokens';
import {
  calculateCartTotals,
  computeStoreAnalytics,
  formatOmr,
  generateNextOrderNumber,
  generateUniqueTrackingNumber,
  normalizePromoInput,
  roundOmr,
  validateCheckoutInput,
} from './src/lib/storeLogic';
import {
  ORDER_STATUS_LIST,
  type Order,
  type OrderItem,
  type OrderStatus,
  type Product,
  type PromoCode,
  type PublicOrderTracking,
} from './src/types/store';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const STORE_FILE = path.join(DATA_DIR, 'lazord-store.json');

const SESSION_SECRET = (
  process.env.LAZORD_SESSION_SECRET || 'lazord-dev-session-secret-change-me'
).trim();
const SESSION_COOKIE_NAME = 'lazord_owner_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function ensureStorageDirs(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function readStoreState(): PersistedStoreState {
  ensureStorageDirs();
  if (!fs.existsSync(STORE_FILE)) {
    const initial = structuredClone(INITIAL_SEED_STATE);
    fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as PersistedStoreState;
    const loadedSettings = parsed.settings ?? INITIAL_SEED_STATE.settings;
    if (loadedSettings.whatsappNumber === '96892481750') {
      loadedSettings.whatsappNumber = '96879115527';
    }
    return {
      products: Array.isArray(parsed.products) ? parsed.products : INITIAL_SEED_STATE.products,
      orders: Array.isArray(parsed.orders) ? parsed.orders : INITIAL_SEED_STATE.orders,
      promoCodes: Array.isArray(parsed.promoCodes)
        ? parsed.promoCodes
        : INITIAL_SEED_STATE.promoCodes,
      settings: loadedSettings,
      totalStoreVisits:
        typeof parsed.totalStoreVisits === 'number'
          ? parsed.totalStoreVisits
          : INITIAL_SEED_STATE.totalStoreVisits,
    };
  } catch {
    const fallback = structuredClone(INITIAL_SEED_STATE);
    fs.writeFileSync(STORE_FILE, JSON.stringify(fallback, null, 2), 'utf8');
    return fallback;
  }
}

function writeStoreState(state: PersistedStoreState): void {
  ensureStorageDirs();
  const tmpFile = `${STORE_FILE}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmpFile, STORE_FILE);
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    out[key] = val;
  }
  return out;
}

function extractSessionToken(req: Request): string | undefined {
  const bearer = extractBearerToken(req.headers.authorization);
  if (bearer) return bearer;
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE_NAME];
}

function buildCookieAttributes(req: Request, maxAgeSeconds: number): string {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const sameSite = isHttps ? 'SameSite=None; Secure' : 'SameSite=Lax';
  return `HttpOnly; Path=/; ${sameSite}; Max-Age=${maxAgeSeconds}`;
}

function requireOwnerAuth(req: Request, res: Response, next: NextFunction): void {
  const session = verifySessionToken(extractSessionToken(req), SESSION_SECRET);
  if (!session) {
    res.status(401).json({ error: 'غير مصرح بالدخول. يرجى تسجيل الدخول كصاحب البراند.' });
    return;
  }
  next();
}

function toPublicTracking(order: Order): PublicOrderTracking {
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

async function startServer(): Promise<void> {
  ensureStorageDirs();
  readStoreState();

  const app = express();
  app.use(express.json({ limit: '8mb' }));

  // --- Health & Public Storefront API ---
  app.get('/api/storefront', (_req, res) => {
    const state = readStoreState();
    res.json({
      products: state.products,
      settings: state.settings,
    });
  });

  app.post('/api/visits', (_req, res) => {
    const state = readStoreState();
    state.totalStoreVisits += 1;
    writeStoreState(state);
    res.json({ ok: true, totalStoreVisits: state.totalStoreVisits });
  });

  // --- Image Upload (Receipts & Product Photos) ---
  app.post('/api/uploads', (req, res) => {
    const { dataUrl } = req.body as { dataUrl?: string };
    if (!dataUrl || typeof dataUrl !== 'string') {
      res.status(400).json({ error: 'يرجى اختيار صورة صالحة للرفع.' });
      return;
    }

    const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) {
      res.status(400).json({ error: 'صيغة الصورة غير مدعومة. الصيغ المدعومة: PNG, JPG, WEBP.' });
      return;
    }

    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 5 * 1024 * 1024) {
      res.status(400).json({ error: 'حجم الصورة يتجاوز الحد الأقصى المسموح (5 ميجابايت).' });
      return;
    }

    const filename = `${crypto.randomUUID()}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
    res.status(201).json({ url: `/api/uploads/${filename}` });
  });

  app.get('/api/uploads/:filename', (req, res) => {
    const { filename } = req.params;
    if (!/^[a-zA-Z0-9-]+\.(png|jpg|webp)$/.test(filename)) {
      res.status(400).send('Invalid filename');
      return;
    }
    const target = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(target)) {
      res.status(404).send('Not found');
      return;
    }
    res.sendFile(target);
  });

  // Dynamic clean SVG receipt image for seeded orders so owner receipt modal works out of the box
  app.get('/api/seed-receipt/:orderNumber', (req, res) => {
    const state = readStoreState();
    const order = state.orders.find((o) => o.orderNumber === req.params.orderNumber);
    const amountText = order ? formatOmr(order.finalTotal) : '0.000 ر.ع';
    const refText = order ? order.orderNumber : 'LZD-1000';
    const senderText = order ? order.customerName : 'عميل لازورد';

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
      <text x="448" y="340" text-anchor="end" fill="#615B52" font-family="sans-serif" font-size="14">المحوِّل</text>
      <text x="72" y="340" text-anchor="start" fill="#181715" font-family="sans-serif" font-size="15" font-weight="bold">${senderText}</text>
      <text x="448" y="388" text-anchor="end" fill="#615B52" font-family="sans-serif" font-size="14">المستفيد</text>
      <text x="72" y="388" text-anchor="start" fill="#181715" font-family="sans-serif" font-size="15" font-weight="bold">LAZORD | لازورد</text>
      <text x="448" y="436" text-anchor="end" fill="#615B52" font-family="sans-serif" font-size="14">رقم الحساب / الهاتف</text>
      <text x="72" y="436" text-anchor="start" fill="#181715" font-family="monospace" font-size="15">${state.settings.bankPhoneNumber}</text>
      <text x="448" y="484" text-anchor="end" fill="#615B52" font-family="sans-serif" font-size="14">رقم المرجع</text>
      <text x="72" y="484" text-anchor="start" fill="#181715" font-family="monospace" font-size="15">OM-${refText}-BANK</text>
      <line x1="56" y1="528" x2="464" y2="528" stroke="#ECE6D8" stroke-width="1.5" stroke-dasharray="6 4"/>
      <text x="260" y="572" text-anchor="middle" fill="#615B52" font-family="sans-serif" font-size="12">نسخة إيصال معتمدة للمراجعة في لوحة تحكم لازورد</text>
    </svg>`;
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.send(svg);
  });

  // --- Promo Validation ---
  app.post('/api/promo/validate', (req, res) => {
    const { code, items } = req.body as {
      code?: string;
      items?: { productId: string; quantity: number }[];
    };

    const normalized = normalizePromoInput(code || '');
    if (!normalized) {
      res.status(400).json({ error: 'يرجى إدخال كود الخصم أولاً.' });
      return;
    }

    const state = readStoreState();
    const promo = state.promoCodes.find(
      (p) => normalizePromoInput(p.code) === normalized
    );
    if (!promo) {
      res.status(404).json({ error: 'كود الخصم غير موجود. تأكد من كتابة الكود بشكل صحيح.' });
      return;
    }
    if (!promo.active) {
      res.status(400).json({ error: 'كود الخصم هذا متوقف حالياً.' });
      return;
    }

    const resolvedItems = (Array.isArray(items) ? items : [])
      .map((entry) => {
        const product = state.products.find((p) => p.id === entry.productId);
        return product ? { product, quantity: entry.quantity } : null;
      })
      .filter((x): x is { product: Product; quantity: number } => x !== null);

    const totals = calculateCartTotals(resolvedItems, promo);
    res.json({ valid: true, promo, totals });
  });

  // --- Order Submission & Tracking ---
  app.post('/api/orders', (req, res) => {
    const body = req.body as {
      customerName?: string;
      customerPhone?: string;
      city?: string;
      address?: string;
      items?: { productId: string; quantity: number }[];
      promoCode?: string | null;
      receiptImageUrl?: string;
    };

    const state = readStoreState();
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
      res.status(400).json({ error: validationError });
      return;
    }

    let matchedPromo: PromoCode | null = null;
    if (body.promoCode && body.promoCode.trim()) {
      const normalized = normalizePromoInput(body.promoCode);
      const found = state.promoCodes.find(
        (p) => normalizePromoInput(p.code) === normalized && p.active
      );
      if (!found) {
        res.status(400).json({ error: 'كود الخصم المستخدم غير صالح أو غير مفعّل.' });
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
    writeStoreState(state);
    res.status(201).json({ order: newOrder });
  });

  app.get('/api/orders/track/:trackingNumber', (req, res) => {
    const query = req.params.trackingNumber.trim().toUpperCase();
    if (!query) {
      res.status(400).json({ error: 'يرجى إدخال رقم التتبع.' });
      return;
    }
    const state = readStoreState();
    const order = state.orders.find(
      (o) => o.trackingNumber.toUpperCase() === query
    );
    if (!order) {
      res.status(404).json({ error: 'لم يتم العثور على طلب بهذا رقم التتبع. تأكد من الرقم وحاول مرة أخرى.' });
      return;
    }
    res.json({ order: toPublicTracking(order) });
  });

  // --- Owner Authentication API ---
  app.get('/api/auth/session', (req, res) => {
    const session = verifySessionToken(extractSessionToken(req), SESSION_SECRET);
    if (!session) {
      res.json({ authenticated: false });
      return;
    }
    res.json({ authenticated: true, username: session.username });
  });

  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body as { username?: string; password?: string };
    const { valid, canonicalUsername } = verifyOwnerCredentials(
      username || '',
      password || '',
      process.env.LAZORD_ADMIN_USERNAME,
      process.env.LAZORD_ADMIN_PASSWORD
    );

    if (!valid) {
      res.status(401).json({ error: 'بيانات الدخول غير صحيحة. يرجى التحقق من البريد/اسم المستخدم وكلمة المرور.' });
      return;
    }

    const token = signSessionToken(canonicalUsername, SESSION_SECRET, SESSION_TTL_MS);
    const cookieAttrs = buildCookieAttributes(req, Math.floor(SESSION_TTL_MS / 1000));
    res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieAttrs}`);
    res.json({ authenticated: true, username: canonicalUsername, token });
  });

  app.post('/api/auth/logout', (req, res) => {
    const cookieAttrs = buildCookieAttributes(req, 0);
    res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=; ${cookieAttrs}`);
    res.json({ authenticated: false });
  });

  // --- Protected Owner Admin API ---
  app.get('/api/admin/dashboard', requireOwnerAuth, (_req, res) => {
    const state = readStoreState();
    const analytics = computeStoreAnalytics(state.orders, state.totalStoreVisits);
    res.json({
      analytics,
      orders: state.orders,
      products: state.products,
      promoCodes: state.promoCodes,
      settings: state.settings,
    });
  });

  app.patch('/api/admin/orders/:id/status', requireOwnerAuth, (req, res) => {
    const { id } = req.params;
    const { status } = req.body as { status?: OrderStatus };
    if (!status || !ORDER_STATUS_LIST.includes(status)) {
      res.status(400).json({ error: 'حالة الطلب المحددة غير صالحة.' });
      return;
    }

    const state = readStoreState();
    const order = state.orders.find((o) => o.id === id);
    if (!order) {
      res.status(404).json({ error: 'الطلب غير موجود.' });
      return;
    }

    order.status = status;
    order.updatedAt = new Date().toISOString();
    writeStoreState(state);

    res.json({
      order,
      analytics: computeStoreAnalytics(state.orders, state.totalStoreVisits),
    });
  });

  app.post('/api/admin/products', requireOwnerAuth, (req, res) => {
    const body = req.body as Partial<Product>;
    const nameAr = (body.nameAr || '').trim();
    const notesAr = (body.notesAr || '').trim();
    const sizeLabel = (body.sizeLabel || '').trim();
    const priceOmr = roundOmr(Number(body.priceOmr));
    const category = body.category === 'bukhoor' ? 'bukhoor' : 'perfume';
    const imageUrl = (body.imageUrl || '').trim();

    if (!nameAr || !notesAr || !Number.isFinite(priceOmr) || priceOmr <= 0) {
      res.status(400).json({ error: 'يرجى إدخال اسم المنتج والوصف العطري وسعر صحيح.' });
      return;
    }

    const state = readStoreState();
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
    writeStoreState(state);
    res.status(201).json({ product: newProduct });
  });

  app.put('/api/admin/products/:id', requireOwnerAuth, (req, res) => {
    const { id } = req.params;
    const body = req.body as Partial<Product>;
    const state = readStoreState();
    const index = state.products.findIndex((p) => p.id === id);
    if (index === -1) {
      res.status(404).json({ error: 'المنتج غير موجود.' });
      return;
    }

    const existing = state.products[index];
    const priceOmr =
      body.priceOmr !== undefined ? roundOmr(Number(body.priceOmr)) : existing.priceOmr;
    if (!Number.isFinite(priceOmr) || priceOmr <= 0) {
      res.status(400).json({ error: 'يرجى إدخال سعر صحيح للمنتج.' });
      return;
    }

    const updated: Product = {
      ...existing,
      nameAr: body.nameAr !== undefined ? body.nameAr.trim() || existing.nameAr : existing.nameAr,
      category: body.category === 'bukhoor' || body.category === 'perfume' ? body.category : existing.category,
      notesAr: body.notesAr !== undefined ? body.notesAr.trim() || existing.notesAr : existing.notesAr,
      sizeLabel: body.sizeLabel !== undefined ? body.sizeLabel.trim() || existing.sizeLabel : existing.sizeLabel,
      priceOmr,
      imageUrl: body.imageUrl !== undefined ? body.imageUrl.trim() || existing.imageUrl : existing.imageUrl,
    };

    state.products[index] = updated;
    writeStoreState(state);
    res.json({ product: updated });
  });

  app.delete('/api/admin/products/:id', requireOwnerAuth, (req, res) => {
    const { id } = req.params;
    const state = readStoreState();
    const nextProducts = state.products.filter((p) => p.id !== id);
    if (nextProducts.length === state.products.length) {
      res.status(404).json({ error: 'المنتج غير موجود.' });
      return;
    }
    state.products = nextProducts;
    writeStoreState(state);
    res.json({ ok: true });
  });

  app.post('/api/admin/promo-codes', requireOwnerAuth, (req, res) => {
    const body = req.body as Partial<PromoCode>;
    const code = normalizePromoInput(body.code || '');
    const discountType = body.discountType === 'fixed' ? 'fixed' : 'percentage';
    const value = Number(body.value);

    if (!code || code.length < 2) {
      res.status(400).json({ error: 'يرجى إدخال كود خصم لا يقل عن حرفين.' });
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      res.status(400).json({ error: 'يرجى إدخال قيمة خصم صحيحة أكبر من صفر.' });
      return;
    }
    if (discountType === 'percentage' && value > 100) {
      res.status(400).json({ error: 'نسبة الخصم لا يمكن أن تتجاوز 100%.' });
      return;
    }

    const state = readStoreState();
    if (state.promoCodes.some((p) => normalizePromoInput(p.code) === code)) {
      res.status(409).json({ error: 'هذا الكود موجود بالفعل.' });
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
    writeStoreState(state);
    res.status(201).json({ promoCode: newPromo });
  });

  app.patch('/api/admin/promo-codes/:id', requireOwnerAuth, (req, res) => {
    const { id } = req.params;
    const body = req.body as Partial<PromoCode>;
    const state = readStoreState();
    const promo = state.promoCodes.find((p) => p.id === id);
    if (!promo) {
      res.status(404).json({ error: 'كود الخصم غير موجود.' });
      return;
    }
    if (typeof body.active === 'boolean') {
      promo.active = body.active;
    }
    writeStoreState(state);
    res.json({ promoCode: promo });
  });

  app.delete('/api/admin/promo-codes/:id', requireOwnerAuth, (req, res) => {
    const { id } = req.params;
    const state = readStoreState();
    const next = state.promoCodes.filter((p) => p.id !== id);
    if (next.length === state.promoCodes.length) {
      res.status(404).json({ error: 'كود الخصم غير موجود.' });
      return;
    }
    state.promoCodes = next;
    writeStoreState(state);
    res.json({ ok: true });
  });

  app.put('/api/admin/settings', requireOwnerAuth, (req, res) => {
    const body = req.body as Partial<PersistedStoreState['settings']>;
    const state = readStoreState();
    state.settings = {
      ...state.settings,
      brandBio: body.brandBio !== undefined ? body.brandBio.trim() || state.settings.brandBio : state.settings.brandBio,
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
          ? body.whatsappNumber.trim() || state.settings.whatsappNumber
          : state.settings.whatsappNumber,
    };
    writeStoreState(state);
    res.json({ settings: state.settings });
  });

  // --- Vite Dev Middleware / Production Static Serving ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LAZORD server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start LAZORD server:', err);
  process.exit(1);
});
