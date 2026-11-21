import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  extractBearerToken,
  hashPasswordScrypt,
  resolveSessionSecret,
  signSessionToken,
  verifyOwnerCredentials,
  verifyPasswordScrypt,
  verifySessionToken,
} from '../lib/authTokens';
import {
  calculateCartTotals,
  computeStoreAnalytics,
  formatOmr,
  generateNextOrderNumber,
  generateUniqueTrackingNumber,
  normalizePromoInput,
  roundOmr,
  validateCheckoutInput,
} from '../lib/storeLogic';
import {
  ORDER_STATUS_LIST,
  type Order,
  type OrderItem,
  type OrderStatus,
  type Product,
  type PromoCode,
  type PublicOrderTracking,
} from '../types/store';
import {
  readStoreState,
  readUploadedImage,
  saveUploadedImage,
  writeStoreState,
  type ExtendedPersistedStoreState,
} from './storePersistence';

const SESSION_COOKIE_NAME = 'lazord_owner_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_JSON_BODY_BYTES = 8 * 1024 * 1024;

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(payload);
}

function sendBuffer(
  res: ServerResponse,
  statusCode: number,
  contentType: string,
  data: Buffer | string,
  cacheControl = 'no-store'
): void {
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
  const bearer = extractBearerToken(authHeader);
  if (bearer) return bearer;
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

function getEffectiveSessionSecret(state?: ExtendedPersistedStoreState): string {
  const explicitOrEnv = resolveSessionSecret({
    envSessionSecret: process.env.LAZORD_SESSION_SECRET,
    envUsername: process.env.LAZORD_ADMIN_USERNAME,
    envPassword: process.env.LAZORD_ADMIN_PASSWORD,
  });

  if (
    (process.env.LAZORD_SESSION_SECRET || '').trim() ||
    (process.env.LAZORD_ADMIN_PASSWORD || '').trim()
  ) {
    return explicitOrEnv;
  }

  if (state?.adminCredential) {
    return crypto
      .createHmac('sha256', 'lazord-claim-session-v1')
      .update(`${state.adminCredential.username}\0${state.adminCredential.salt}\0${state.adminCredential.hash}`)
      .digest('hex');
  }

  return explicitOrEnv;
}

function isEnvAuthConfigured(): boolean {
  return Boolean((process.env.LAZORD_ADMIN_PASSWORD || '').trim());
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

export function resolveApiPathname(reqUrl: string | undefined): string {
  const parsed = new URL(reqUrl || '/', 'http://localhost');
  const rewrittenPath = parsed.searchParams.get('__apiPath');
  if (rewrittenPath !== null) {
    const clean = rewrittenPath.replace(/^\/+/, '');
    return clean ? `/api/${clean}` : '/api';
  }
  return parsed.pathname;
}

export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const method = (req.method || 'GET').toUpperCase();
  const pathname = resolveApiPathname(req.url);

  try {
    // --- Health & Public Storefront API ---
    if (method === 'GET' && pathname === '/api/health') {
      sendJson(res, 200, { ok: true });
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

    // --- Image Upload (Receipts & Product Photos) ---
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
        sendBuffer(res, 404, 'text/plain; charset=utf-8', 'Not found');
        return;
      }
      sendBuffer(res, 200, asset.contentType, asset.data, 'public, max-age=31536000, immutable');
      return;
    }

    // Dynamic clean SVG receipt image for seeded orders
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

    // --- Promo Validation ---
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
      const promo = state.promoCodes.find(
        (p) => normalizePromoInput(p.code) === normalized
      );
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

    // --- Order Submission & Tracking ---
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
      const state = isEnvAuthConfigured() ? undefined : await readStoreState();
      const secret = getEffectiveSessionSecret(state);
      const session = verifySessionToken(extractSessionToken(req), secret);
      const needsSetup = !isEnvAuthConfigured() && !state?.adminCredential;

      if (!session) {
        sendJson(res, 200, { authenticated: false, needsSetup });
        return;
      }
      sendJson(res, 200, { authenticated: true, username: session.username, needsSetup: false });
      return;
    }

    if (method === 'POST' && pathname === '/api/auth/setup') {
      if (isEnvAuthConfigured()) {
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
      const token = signSessionToken(cleanUser, secret, SESSION_TTL_MS);
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
      const envAuth = verifyOwnerCredentials(
        body.username || '',
        body.password || '',
        process.env.LAZORD_ADMIN_USERNAME,
        process.env.LAZORD_ADMIN_PASSWORD
      );

      if (envAuth.configured) {
        if (!envAuth.valid) {
          sendJson(res, 401, {
            error:
              'بيانات الدخول غير صحيحة. يرجى التحقق من البريد/اسم المستخدم وكلمة المرور.',
          });
          return;
        }
        const secret = getEffectiveSessionSecret();
        const token = signSessionToken(envAuth.canonicalUsername, secret, SESSION_TTL_MS);
        const cookieAttrs = buildCookieAttributes(req, Math.floor(SESSION_TTL_MS / 1000));
        res.setHeader(
          'Set-Cookie',
          `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieAttrs}`
        );
        sendJson(res, 200, {
          authenticated: true,
          username: envAuth.canonicalUsername,
          token,
        });
        return;
      }

      // Fallback to first-run claimed scrypt credential when env var is not configured
      const state = await readStoreState();
      if (!state.adminCredential) {
        sendJson(res, 400, {
          error:
            'يرجى إعداد حساب صاحب البراند أو ضبط متغيرات البيئة LAZORD_ADMIN_USERNAME و LAZORD_ADMIN_PASSWORD.',
          needsSetup: true,
        });
        return;
      }

      const cleanUser = (body.username || '').trim().toLowerCase();
      const expectedUser = state.adminCredential.username.trim().toLowerCase();
      const userMatches = cleanUser === expectedUser;
      const passMatches = verifyPasswordScrypt(
        body.password || '',
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
      const token = signSessionToken(state.adminCredential.username, secret, SESSION_TTL_MS);
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
      const state = await readStoreState();
      const secret = getEffectiveSessionSecret(state);
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
        const body = await readJsonBody<Partial<ExtendedPersistedStoreState['settings']>>(req);
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
              ? body.whatsappNumber.trim() || state.settings.whatsappNumber
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
