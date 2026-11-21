import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { INITIAL_SEED_STATE, type PersistedStoreState } from '../lib/seedData';

export interface AdminCredentialRecord {
  username: string;
  salt: string;
  hash: string;
}

export interface ExtendedPersistedStoreState extends PersistedStoreState {
  adminCredential?: AdminCredentialRecord | null;
}

const STORE_KV_KEY = 'lazord:store:v1';
const UPLOAD_KV_PREFIX = 'lazord:upload:v1:';

interface KvCredentials {
  url: string;
  token: string;
}

declare global {
  var __lazordWarmStore: ExtendedPersistedStoreState | undefined;
  var __lazordWarmUploads: Map<string, { contentType: string; data: Buffer }> | undefined;
}

export function isServerlessReadOnlyRuntime(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.VERCEL_ENV ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.NOW_REGION
  );
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

  if (!url || !token) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  return { url: url.replace(/\/+$/, ''), token };
}

export function hasCloudKvConfigured(): boolean {
  return getKvCredentials() !== null;
}

async function kvCommand<T>(creds: KvCredentials, args: (string | number)[]): Promise<T | null> {
  const response = await fetch(creds.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${creds.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!response.ok) {
    throw new Error(`KV request failed with status ${response.status}`);
  }
  const payload = (await response.json()) as { result?: T; error?: string };
  if (payload.error) {
    throw new Error(payload.error);
  }
  return payload.result ?? null;
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

function normalizeStoreState(raw: unknown): ExtendedPersistedStoreState {
  const parsed = (raw && typeof raw === 'object' ? raw : {}) as Partial<ExtendedPersistedStoreState>;
  const loadedSettings = parsed.settings ?? structuredClone(INITIAL_SEED_STATE.settings);
  if (loadedSettings.whatsappNumber === '96892481750') {
    loadedSettings.whatsappNumber = '96879115527';
  }
  return {
    products: Array.isArray(parsed.products)
      ? parsed.products
      : structuredClone(INITIAL_SEED_STATE.products),
    orders: Array.isArray(parsed.orders)
      ? parsed.orders
      : structuredClone(INITIAL_SEED_STATE.orders),
    promoCodes: Array.isArray(parsed.promoCodes)
      ? parsed.promoCodes
      : structuredClone(INITIAL_SEED_STATE.promoCodes),
    settings: loadedSettings,
    totalStoreVisits:
      typeof parsed.totalStoreVisits === 'number'
        ? parsed.totalStoreVisits
        : INITIAL_SEED_STATE.totalStoreVisits,
    adminCredential:
      parsed.adminCredential &&
      typeof parsed.adminCredential.username === 'string' &&
      typeof parsed.adminCredential.salt === 'string' &&
      typeof parsed.adminCredential.hash === 'string'
        ? parsed.adminCredential
        : null,
  };
}

export async function readStoreState(): Promise<ExtendedPersistedStoreState> {
  const kv = getKvCredentials();
  if (kv) {
    try {
      const rawJson = await kvCommand<string>(kv, ['GET', STORE_KV_KEY]);
      if (rawJson) {
        const parsed = normalizeStoreState(JSON.parse(rawJson));
        globalThis.__lazordWarmStore = parsed;
        return parsed;
      }
      const seeded = normalizeStoreState(INITIAL_SEED_STATE);
      await kvCommand(kv, ['SET', STORE_KV_KEY, JSON.stringify(seeded)]);
      globalThis.__lazordWarmStore = seeded;
      return seeded;
    } catch {
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
    const normalized = normalizeStoreState(JSON.parse(raw));
    globalThis.__lazordWarmStore = normalized;
    return normalized;
  } catch {
    if (!globalThis.__lazordWarmStore) {
      globalThis.__lazordWarmStore = normalizeStoreState(INITIAL_SEED_STATE);
    }
    return globalThis.__lazordWarmStore;
  }
}

export async function writeStoreState(state: ExtendedPersistedStoreState): Promise<void> {
  const normalized = normalizeStoreState(state);
  globalThis.__lazordWarmStore = normalized;

  const kv = getKvCredentials();
  if (kv) {
    await kvCommand(kv, ['SET', STORE_KV_KEY, JSON.stringify(normalized)]);
    return;
  }

  try {
    const { storeFile } = ensureStorageDirs();
    const tmpFile = `${storeFile}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(normalized, null, 2), 'utf8');
    fs.renameSync(tmpFile, storeFile);
  } catch {
    // Keep warm in-memory state if local temp write fails
  }
}

function getWarmUploadMap(): Map<string, { contentType: string; data: Buffer }> {
  if (!globalThis.__lazordWarmUploads) {
    globalThis.__lazordWarmUploads = new Map();
  }
  return globalThis.__lazordWarmUploads;
}

export async function saveUploadedImage(params: {
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
    await kvCommand(kv, [
      'SET',
      `${UPLOAD_KV_PREFIX}${filename}`,
      JSON.stringify({ contentType, base64: params.buffer.toString('base64') }),
    ]);
    return `/api/uploads/${filename}`;
  }

  // On serverless without external KV storage, preserve smaller validated images as data URLs
  // so receipts and product photos never break across cold starts.
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

export async function readUploadedImage(
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
      // Fall through to disk / warm map
    }
  }

  const cached = getWarmUploadMap().get(filename);
  if (cached) {
    return cached;
  }

  try {
    const { uploadsDir } = getStoragePaths();
    const resolved = path.resolve(uploadsDir, filename);
    if (!resolved.startsWith(uploadsDir + path.sep)) {
      return null;
    }
    if (!fs.existsSync(resolved)) {
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
