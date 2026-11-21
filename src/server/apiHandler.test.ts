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

    // 4. Protected admin dashboard succeeds with Bearer token
    const dash = await invokeVercelApi({
      method: 'GET',
      url: '/api/index?__apiPath=admin/dashboard',
      headers: { authorization: `Bearer ${loginJson.token}` },
    });
    assert.equal(dash.statusCode, 200);
    const dashJson = dash.json<{ analytics: { pendingOrders: number }; orders: unknown[] }>();
    assert.ok(dashJson.orders.length >= 2);

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
    assert.equal(dash.json<{ analytics: { totalStoreVisits: number } }>().analytics.totalStoreVisits, 129);
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

