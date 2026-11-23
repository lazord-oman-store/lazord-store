import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import vercelHandler from '../../api/index';

interface MockResponseResult {
  statusCode: number;
  headers: Record<string, string | string[]>;
  bodyText: string;
  json<T = unknown>(): T;
}

async function invokeVercelApi(params: {
  method: string;
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
  preParsedBody?: boolean;
}): Promise<MockResponseResult> {
  const req = new EventEmitter() as IncomingMessage & { body?: unknown };
  req.method = params.method;
  req.url = params.url;
  req.headers = { ...params.headers };
  (req as unknown as { socket: { encrypted: boolean } }).socket = { encrypted: false };

  const rawBody = params.body !== undefined ? JSON.stringify(params.body) : '';
  if (params.preParsedBody && params.body !== undefined) {
    req.body = params.body;
  }

  const headers: Record<string, string | string[]> = {};
  const chunks: Buffer[] = [];
  const res = {
    statusCode: 200,
    setHeader(name: string, value: string | string[]) {
      headers[name.toLowerCase()] = value;
    },
    end(chunk?: Buffer | string) {
      if (chunk !== undefined) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk);
      }
    },
  } as unknown as ServerResponse;

  const done = vercelHandler(req, res);

  if (!params.preParsedBody) {
    process.nextTick(() => {
      if (rawBody) {
        req.emit('data', Buffer.from(rawBody, 'utf8'));
      }
      req.emit('end');
    });
  }

  await done;
  const bodyText = Buffer.concat(chunks).toString('utf8');
  return {
    statusCode: res.statusCode,
    headers,
    bodyText,
    json<T = unknown>() {
      return JSON.parse(bodyText) as T;
    },
  };
}

function resetTestVercelTmpData(): void {
  globalThis.__lazordWarmStore = undefined;
  globalThis.__lazordWarmUploads = undefined;
  const tmpDir = path.join(os.tmpdir(), 'lazord-data');
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

test('Vercel API handler handles env-based login, Bearer auth, and pre-parsed body under VERCEL=1', async () => {
  const prevVercel = process.env.VERCEL;
  const prevUser = process.env.LAZORD_ADMIN_USERNAME;
  const prevPass = process.env.LAZORD_ADMIN_PASSWORD;

  try {
    process.env.VERCEL = '1';
    process.env.LAZORD_ADMIN_USERNAME = '  owner@lazord.om  ';
    process.env.LAZORD_ADMIN_PASSWORD = '  VercelPass!99  ';
    resetTestVercelTmpData();

    // 1. Public storefront works with Vercel rewrite query param
    const sf = await invokeVercelApi({
      method: 'GET',
      url: '/api/index?__apiPath=storefront',
    });
    assert.equal(sf.statusCode, 200);
    const sfJson = sf.json<{ products: unknown[]; settings: { whatsappNumber: string } }>();
    assert.ok(sfJson.products.length > 0);
    assert.equal(sfJson.settings.whatsappNumber, '96879115527');

    // 2. Protected admin route rejects unauthenticated calls
    const unauth = await invokeVercelApi({
      method: 'GET',
      url: '/api/index?__apiPath=admin/dashboard',
    });
    assert.equal(unauth.statusCode, 401);

    // 3. Login with Vercel pre-parsed req.body and x-forwarded-proto=https
    const login = await invokeVercelApi({
      method: 'POST',
      url: '/api/index?__apiPath=auth/login',
      body: { username: 'owner@lazord.om', password: 'VercelPass!99' },
      headers: { 'x-forwarded-proto': 'https' },
      preParsedBody: true,
    });
    assert.equal(login.statusCode, 200);
    const loginJson = login.json<{ authenticated: boolean; token: string }>();
    assert.equal(loginJson.authenticated, true);
    assert.ok(loginJson.token);
    const setCookie = String(login.headers['set-cookie'] || '');
    assert.match(setCookie, /SameSite=None/);
    assert.match(setCookie, /Partitioned/);

    // 4. Protected admin dashboard succeeds with Bearer token and starts at clean zero baseline
    const dash = await invokeVercelApi({
      method: 'GET',
      url: '/api/index?__apiPath=admin/dashboard',
      headers: { authorization: `Bearer ${loginJson.token}` },
    });
    assert.equal(dash.statusCode, 200);
    const dashJson = dash.json<{
      analytics: {
        totalSalesRevenue: number;
        totalOrders: number;
        pendingOrders: number;
        totalStoreVisits: number;
      };
      orders: unknown[];
    }>();
    assert.equal(dashJson.orders.length, 0);
    assert.deepEqual(dashJson.analytics, {
      totalSalesRevenue: 0,
      totalOrders: 0,
      pendingOrders: 0,
      totalStoreVisits: 0,
    });

    // 5. Image upload + order submission work in Vercel runtime
    const upload = await invokeVercelApi({
      method: 'POST',
      url: '/api/index?__apiPath=uploads',
      body: {
        dataUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      },
      preParsedBody: true,
    });
    assert.equal(upload.statusCode, 201);
    const uploadJson = upload.json<{ url: string }>();
    assert.ok(uploadJson.url.startsWith('data:image/png;base64,'));
  } finally {
    resetTestVercelTmpData();
    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
    if (prevUser === undefined) delete process.env.LAZORD_ADMIN_USERNAME;
    else process.env.LAZORD_ADMIN_USERNAME = prevUser;
    if (prevPass === undefined) delete process.env.LAZORD_ADMIN_PASSWORD;
    else process.env.LAZORD_ADMIN_PASSWORD = prevPass;
  }
});

test('Vercel API supports first-run setup claim only when LAZORD_ADMIN_PASSWORD is unset', async () => {
  const prevVercel = process.env.VERCEL;
  const prevUser = process.env.LAZORD_ADMIN_USERNAME;
  const prevPass = process.env.LAZORD_ADMIN_PASSWORD;

  try {
    process.env.VERCEL = '1';
    delete process.env.LAZORD_ADMIN_USERNAME;
    delete process.env.LAZORD_ADMIN_PASSWORD;
    resetTestVercelTmpData();

    const sess = await invokeVercelApi({
      method: 'GET',
      url: '/api/index?__apiPath=auth/session',
    });
    assert.equal(sess.statusCode, 200);
    assert.deepEqual(sess.json(), { authenticated: false, needsSetup: true });

    const setup = await invokeVercelApi({
      method: 'POST',
      url: '/api/index?__apiPath=auth/setup',
      body: { username: 'brand-owner', password: 'StrongClaimPassword!1' },
      preParsedBody: true,
    });
    assert.equal(setup.statusCode, 201);
    const setupJson = setup.json<{ authenticated: boolean; token: string }>();
    assert.equal(setupJson.authenticated, true);
    assert.ok(setupJson.token);

    // Second setup attempt must be blocked
    const secondSetup = await invokeVercelApi({
      method: 'POST',
      url: '/api/index?__apiPath=auth/setup',
      body: { username: 'attacker', password: 'Password123' },
      preParsedBody: true,
    });
    assert.equal(secondSetup.statusCode, 403);

    // Login works with claimed credentials
    const login = await invokeVercelApi({
      method: 'POST',
      url: '/api/index?__apiPath=auth/login',
      body: { username: 'brand-owner', password: 'StrongClaimPassword!1' },
      preParsedBody: true,
    });
    assert.equal(login.statusCode, 200);
    assert.equal(login.json<{ authenticated: boolean }>().authenticated, true);
  } finally {
    resetTestVercelTmpData();
    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
    if (prevUser === undefined) delete process.env.LAZORD_ADMIN_USERNAME;
    else process.env.LAZORD_ADMIN_USERNAME = prevUser;
    if (prevPass === undefined) delete process.env.LAZORD_ADMIN_PASSWORD;
    else process.env.LAZORD_ADMIN_PASSWORD = prevPass;
  }
});

test('Vercel API falls back safely when KV/Redis fails and respects LAZORD_SESSION_SECRET', async () => {
  const prevVercel = process.env.VERCEL;
  const prevKvUrl = process.env.KV_REST_API_URL;
  const prevKvToken = process.env.KV_REST_API_TOKEN;
  const prevUser = process.env.LAZORD_ADMIN_USERNAME;
  const prevPass = process.env.LAZORD_ADMIN_PASSWORD;
  const prevSecret = process.env.LAZORD_SESSION_SECRET;

  try {
    process.env.VERCEL = '1';
    process.env.KV_REST_API_URL = 'http://127.0.0.1:9';
    process.env.KV_REST_API_TOKEN = 'invalid-token';
    process.env.LAZORD_ADMIN_USERNAME = 'owner@lazord.om';
    process.env.LAZORD_ADMIN_PASSWORD = 'SecretPassword#1';
    process.env.LAZORD_SESSION_SECRET = 'custom-vercel-session-secret-xyz';
    resetTestVercelTmpData();

    const visit = await invokeVercelApi({
      method: 'POST',
      url: '/api/index?__apiPath=visits',
      body: {},
      preParsedBody: true,
    });
    assert.equal(visit.statusCode, 200);
    assert.equal(visit.json<{ ok: boolean }>().ok, true);

    const login = await invokeVercelApi({
      method: 'POST',
      url: '/api/index?__apiPath=auth/login',
      body: { username: 'owner@lazord.om', password: 'SecretPassword#1' },
      preParsedBody: true,
    });
    assert.equal(login.statusCode, 200);
    const { token } = login.json<{ token: string }>();

    const dash = await invokeVercelApi({
      method: 'GET',
      url: '/api/index?__apiPath=admin/dashboard',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(dash.statusCode, 200);
    assert.equal(dash.json<{ analytics: { totalStoreVisits: number } }>().analytics.totalStoreVisits, 1);
  } finally {
    resetTestVercelTmpData();
    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
    if (prevKvUrl === undefined) delete process.env.KV_REST_API_URL;
    else process.env.KV_REST_API_URL = prevKvUrl;
    if (prevKvToken === undefined) delete process.env.KV_REST_API_TOKEN;
    else process.env.KV_REST_API_TOKEN = prevKvToken;
    if (prevUser === undefined) delete process.env.LAZORD_ADMIN_USERNAME;
    else process.env.LAZORD_ADMIN_USERNAME = prevUser;
    if (prevPass === undefined) delete process.env.LAZORD_ADMIN_PASSWORD;
    else process.env.LAZORD_ADMIN_PASSWORD = prevPass;
    if (prevSecret === undefined) delete process.env.LAZORD_SESSION_SECRET;
    else process.env.LAZORD_SESSION_SECRET = prevSecret;
  }
});

test('Order lifecycle updates pending, approved order count, sales revenue, and visits accurately', async () => {
  const prevVercel = process.env.VERCEL;
  const prevUser = process.env.LAZORD_ADMIN_USERNAME;
  const prevPass = process.env.LAZORD_ADMIN_PASSWORD;

  try {
    process.env.VERCEL = '1';
    process.env.LAZORD_ADMIN_USERNAME = 'owner@lazord.om';
    process.env.LAZORD_ADMIN_PASSWORD = 'LifecyclePass!2026';
    resetTestVercelTmpData();

    const login = await invokeVercelApi({
      method: 'POST',
      url: '/api/index?__apiPath=auth/login',
      body: { username: 'owner@lazord.om', password: 'LifecyclePass!2026' },
      preParsedBody: true,
    });
    const { token } = login.json<{ token: string }>();

    // Record 1 storefront visit
    const visit = await invokeVercelApi({
      method: 'POST',
      url: '/api/index?__apiPath=visits',
      body: {},
      preParsedBody: true,
    });
    assert.equal(visit.statusCode, 200);
    assert.equal(visit.json<{ totalStoreVisits: number }>().totalStoreVisits, 1);

    // Submit order #1 (34.000 OMR) -> enters as 'قيد المراجعة'
    const order1Res = await invokeVercelApi({
      method: 'POST',
      url: '/api/index?__apiPath=orders',
      body: {
        customerName: 'سعيد الحارثي',
        customerPhone: '91234567',
        city: 'محافظة مسقط',
        address: 'القرم، شارع 12',
        items: [{ productId: 'prod-oud-sultani', quantity: 1 }],
        receiptImageUrl: 'data:image/png;base64,iVBORw0KGgo=',
      },
      preParsedBody: true,
    });
    assert.equal(order1Res.statusCode, 201);
    const order1 = order1Res.json<{ order: { id: string; status: string; finalTotal: number } }>().order;
    assert.equal(order1.status, 'قيد المراجعة');
    assert.equal(order1.finalTotal, 34);

    // Dashboard right after order creation: pending=1, totalOrders=0, revenue=0, visits=1
    const dashAfterOrder1 = await invokeVercelApi({
      method: 'GET',
      url: '/api/index?__apiPath=admin/dashboard',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.deepEqual(
      dashAfterOrder1.json<{ analytics: Record<string, number> }>().analytics,
      {
        totalSalesRevenue: 0,
        totalOrders: 0,
        pendingOrders: 1,
        totalStoreVisits: 1,
      }
    );

    // Confirm order #1 -> pending=0, totalOrders=1, revenue=34
    const confirmRes = await invokeVercelApi({
      method: 'PATCH',
      url: `/api/index?__apiPath=admin/orders/${order1.id}/status`,
      headers: { authorization: `Bearer ${token}` },
      body: { status: 'تم تأكيد الدفع' },
      preParsedBody: true,
    });
    assert.equal(confirmRes.statusCode, 200);
    assert.deepEqual(
      confirmRes.json<{ analytics: Record<string, number> }>().analytics,
      {
        totalSalesRevenue: 34,
        totalOrders: 1,
        pendingOrders: 0,
        totalStoreVisits: 1,
      }
    );

    // Move order #1 to 'جاري التجهيز' -> no double-counting
    const prepRes = await invokeVercelApi({
      method: 'PATCH',
      url: `/api/index?__apiPath=admin/orders/${order1.id}/status`,
      headers: { authorization: `Bearer ${token}` },
      body: { status: 'جاري التجهيز' },
      preParsedBody: true,
    });
    assert.deepEqual(
      prepRes.json<{ analytics: Record<string, number> }>().analytics,
      {
        totalSalesRevenue: 34,
        totalOrders: 1,
        pendingOrders: 0,
        totalStoreVisits: 1,
      }
    );

    // Submit order #2 (18.000 OMR) -> pending=1, totalOrders=1, revenue=34
    const order2Res = await invokeVercelApi({
      method: 'POST',
      url: '/api/index?__apiPath=orders',
      body: {
        customerName: 'فاطمة المعمرية',
        customerPhone: '98765432',
        city: 'محافظة الداخلية',
        address: 'نزوى، حي التراث',
        items: [{ productId: 'prod-bukhoor-diwan', quantity: 1 }],
        receiptImageUrl: 'data:image/png;base64,iVBORw0KGgo=',
      },
      preParsedBody: true,
    });
    assert.equal(order2Res.statusCode, 201);
    const order2 = order2Res.json<{ order: { id: string } }>().order;

    // Reject order #2 -> pending=0, totalOrders stays 1, revenue stays 34
    const rejectRes = await invokeVercelApi({
      method: 'PATCH',
      url: `/api/index?__apiPath=admin/orders/${order2.id}/status`,
      headers: { authorization: `Bearer ${token}` },
      body: { status: 'مرفوض' },
      preParsedBody: true,
    });
    assert.equal(rejectRes.statusCode, 200);
    assert.deepEqual(
      rejectRes.json<{ analytics: Record<string, number> }>().analytics,
      {
        totalSalesRevenue: 34,
        totalOrders: 1,
        pendingOrders: 0,
        totalStoreVisits: 1,
      }
    );
  } finally {
    resetTestVercelTmpData();
    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
    if (prevUser === undefined) delete process.env.LAZORD_ADMIN_USERNAME;
    else process.env.LAZORD_ADMIN_USERNAME = prevUser;
    if (prevPass === undefined) delete process.env.LAZORD_ADMIN_PASSWORD;
    else process.env.LAZORD_ADMIN_PASSWORD = prevPass;
  }
});

test('Legacy persisted stores strip demo seed orders and fake 128 visit baseline once', async () => {
  const prevVercel = process.env.VERCEL;
  const prevUser = process.env.LAZORD_ADMIN_USERNAME;
  const prevPass = process.env.LAZORD_ADMIN_PASSWORD;

  try {
    process.env.VERCEL = '1';
    process.env.LAZORD_ADMIN_USERNAME = 'owner@lazord.om';
    process.env.LAZORD_ADMIN_PASSWORD = 'MigratePass!2026';
    resetTestVercelTmpData();

    const tmpDir = path.join(os.tmpdir(), 'lazord-data');
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'lazord-store.json'),
      JSON.stringify({
        totalStoreVisits: 128,
        products: [
          {
            id: 'prod-custom-keep',
            nameAr: 'دهن عود خاص',
            category: 'perfume',
            notesAr: 'عود صافي',
            sizeLabel: '12 مل',
            priceOmr: 45,
            imageUrl: '/src/assets/images/perfume_royal_oud_1795258094810.jpg',
            createdAt: '2026-11-01T00:00:00.000Z',
          },
        ],
        promoCodes: [],
        orders: [
          {
            id: 'ord-seed-1001',
            orderNumber: 'LZD-1001',
            trackingNumber: 'TRK-LZD-84920',
            customerName: 'Demo 1',
            customerPhone: '95128430',
            city: 'محافظة مسقط',
            address: 'بوشر',
            items: [],
            originalSubtotal: 44.2,
            promoCodeUsed: null,
            discountAmount: 0,
            finalTotal: 44.2,
            receiptImageUrl: '/api/seed-receipt/LZD-1001',
            status: 'جاري التجهيز',
            createdAt: '2026-11-18T11:30:00.000Z',
            updatedAt: '2026-11-19T09:15:00.000Z',
          },
          {
            id: 'ord-seed-1002',
            orderNumber: 'LZD-1002',
            trackingNumber: 'TRK-LZD-61504',
            customerName: 'Demo 2',
            customerPhone: '97410285',
            city: 'محافظة ظفار',
            address: 'صلالة',
            items: [],
            originalSubtotal: 28.5,
            promoCodeUsed: null,
            discountAmount: 0,
            finalTotal: 28.5,
            receiptImageUrl: '/api/seed-receipt/LZD-1002',
            status: 'قيد المراجعة',
            createdAt: '2026-11-20T14:20:00.000Z',
            updatedAt: '2026-11-20T14:20:00.000Z',
          },
        ],
      }),
      'utf8'
    );

    const login = await invokeVercelApi({
      method: 'POST',
      url: '/api/index?__apiPath=auth/login',
      body: { username: 'owner@lazord.om', password: 'MigratePass!2026' },
      preParsedBody: true,
    });
    const { token } = login.json<{ token: string }>();

    const dash = await invokeVercelApi({
      method: 'GET',
      url: '/api/index?__apiPath=admin/dashboard',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(dash.statusCode, 200);
    const body = dash.json<{
      analytics: Record<string, number>;
      orders: unknown[];
      products: { id: string }[];
    }>();
    assert.equal(body.orders.length, 0);
    assert.deepEqual(body.analytics, {
      totalSalesRevenue: 0,
      totalOrders: 0,
      pendingOrders: 0,
      totalStoreVisits: 0,
    });
    assert.equal(body.products[0]?.id, 'prod-custom-keep');
  } finally {
    resetTestVercelTmpData();
    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
    if (prevUser === undefined) delete process.env.LAZORD_ADMIN_USERNAME;
    else process.env.LAZORD_ADMIN_USERNAME = prevUser;
    if (prevPass === undefined) delete process.env.LAZORD_ADMIN_PASSWORD;
    else process.env.LAZORD_ADMIN_PASSWORD = prevPass;
  }
});

test('Admin can add/update outOfStock product state with safe fallback and API rejects ordering out-of-stock products', async () => {
  const prevVercel = process.env.VERCEL;
  const prevUser = process.env.LAZORD_ADMIN_USERNAME;
  const prevPass = process.env.LAZORD_ADMIN_PASSWORD;

  try {
    process.env.VERCEL = '1';
    process.env.LAZORD_ADMIN_USERNAME = 'owner@lazord.om';
    process.env.LAZORD_ADMIN_PASSWORD = 'StockPass!2026';
    resetTestVercelTmpData();

    // Legacy stored product without outOfStock property defaults safely to false
    const tmpDir = path.join(os.tmpdir(), 'lazord-data');
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'lazord-store.json'),
      JSON.stringify({
        totalStoreVisits: 0,
        seedResetV2: true,
        orders: [],
        promoCodes: [],
        products: [
          {
            id: 'prod-legacy-available',
            nameAr: 'عطر كلاسيك',
            category: 'perfume',
            notesAr: 'عود ومسك',
            sizeLabel: '100 مل',
            priceOmr: 30,
            imageUrl: '/src/assets/images/perfume_royal_oud_1795258094810.jpg',
            createdAt: '2026-10-01T00:00:00.000Z',
          },
        ],
      }),
      'utf8'
    );

    const sfBefore = await invokeVercelApi({
      method: 'GET',
      url: '/api/index?__apiPath=storefront',
    });
    assert.equal(sfBefore.statusCode, 200);
    const legacyProd = sfBefore.json<{ products: { id: string; outOfStock?: boolean }[] }>().products[0];
    assert.equal(legacyProd?.id, 'prod-legacy-available');
    assert.equal(legacyProd?.outOfStock, false);

    // Login as owner
    const login = await invokeVercelApi({
      method: 'POST',
      url: '/api/index?__apiPath=auth/login',
      body: { username: 'owner@lazord.om', password: 'StockPass!2026' },
      preParsedBody: true,
    });
    const { token } = login.json<{ token: string }>();

    // Create a new perfume marked as outOfStock: true
    const createdRes = await invokeVercelApi({
      method: 'POST',
      url: '/api/index?__apiPath=admin/products',
      headers: { authorization: `Bearer ${token}` },
      body: {
        nameAr: 'عود حصري نادر',
        category: 'perfume',
        notesAr: 'دهن عود قديم',
        sizeLabel: '50 مل',
        priceOmr: 45,
        outOfStock: true,
      },
      preParsedBody: true,
    });
    assert.equal(createdRes.statusCode, 201);
    const createdProduct = createdRes.json<{ product: { id: string; outOfStock?: boolean } }>().product;
    assert.equal(createdProduct.outOfStock, true);

    // Public storefront reflects outOfStock: true
    const sfAfterCreate = await invokeVercelApi({
      method: 'GET',
      url: '/api/index?__apiPath=storefront',
    });
    const createdInStore = sfAfterCreate
      .json<{ products: { id: string; outOfStock?: boolean }[] }>()
      .products.find((p) => p.id === createdProduct.id);
    assert.equal(createdInStore?.outOfStock, true);

    // Attempting to submit an order containing the out-of-stock product returns 400
    const blockedOrderRes = await invokeVercelApi({
      method: 'POST',
      url: '/api/index?__apiPath=orders',
      body: {
        customerName: 'سالم البلوشي',
        customerPhone: '91234567',
        city: 'محافظة مسقط',
        address: 'بوشر',
        items: [{ productId: createdProduct.id, quantity: 1 }],
        receiptImageUrl: 'data:image/png;base64,iVBORw0KGgo=',
      },
      preParsedBody: true,
    });
    assert.equal(blockedOrderRes.statusCode, 400);
    assert.ok(blockedOrderRes.json<{ error: string }>().error.includes('نفذت كميته'));

    // Toggle legacy product to outOfStock via PUT then back to available
    const putOutRes = await invokeVercelApi({
      method: 'PUT',
      url: `/api/index?__apiPath=admin/products/prod-legacy-available`,
      headers: { authorization: `Bearer ${token}` },
      body: { outOfStock: true },
      preParsedBody: true,
    });
    assert.equal(putOutRes.statusCode, 200);
    assert.equal(putOutRes.json<{ product: { outOfStock?: boolean } }>().product.outOfStock, true);

    const putBackRes = await invokeVercelApi({
      method: 'PUT',
      url: `/api/index?__apiPath=admin/products/prod-legacy-available`,
      headers: { authorization: `Bearer ${token}` },
      body: { outOfStock: false },
      preParsedBody: true,
    });
    assert.equal(putBackRes.statusCode, 200);
    assert.equal(putBackRes.json<{ product: { outOfStock?: boolean } }>().product.outOfStock, false);

    // Available product can still be ordered normally
    const okOrderRes = await invokeVercelApi({
      method: 'POST',
      url: '/api/index?__apiPath=orders',
      body: {
        customerName: 'سالم البلوشي',
        customerPhone: '91234567',
        city: 'محافظة مسقط',
        address: 'بوشر',
        items: [{ productId: 'prod-legacy-available', quantity: 1 }],
        receiptImageUrl: 'data:image/png;base64,iVBORw0KGgo=',
      },
      preParsedBody: true,
    });
    assert.equal(okOrderRes.statusCode, 201);
  } finally {
    resetTestVercelTmpData();
    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
    if (prevUser === undefined) delete process.env.LAZORD_ADMIN_USERNAME;
    else process.env.LAZORD_ADMIN_USERNAME = prevUser;
    if (prevPass === undefined) delete process.env.LAZORD_ADMIN_PASSWORD;
    else process.env.LAZORD_ADMIN_PASSWORD = prevPass;
  }
});



