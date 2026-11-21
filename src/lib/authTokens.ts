import crypto from 'node:crypto';

export const DEFAULT_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

let fallbackEphemeralSecret: string | null = null;

export function constantTimeMatch(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function resolveSessionSecret(params: {
  envSessionSecret?: string;
  envUsername?: string;
  envPassword?: string;
}): string {
  const explicit = (params.envSessionSecret || '').trim();
  if (explicit) return explicit;

  const envPass = (params.envPassword || '').trim();
  if (envPass) {
    const envUser = (params.envUsername || 'owner@lazord.om').trim();
    return crypto
      .createHmac('sha256', 'lazord-owner-session-key-v1')
      .update(`${envUser}\0${envPass}`)
      .digest('hex');
  }

  if (!fallbackEphemeralSecret) {
    fallbackEphemeralSecret = crypto.randomBytes(32).toString('hex');
  }
  return fallbackEphemeralSecret;
}

export function verifyOwnerCredentials(
  inputUsername: string,
  inputPassword: string,
  envUsername: string | undefined,
  envPassword: string | undefined
): { valid: boolean; configured: boolean; canonicalUsername: string } {
  const expectedPassword = (envPassword || '').trim();
  const canonicalUsername = (envUsername || 'owner@lazord.om').trim() || 'owner@lazord.om';

  if (!expectedPassword) {
    return {
      valid: false,
      configured: false,
      canonicalUsername,
    };
  }

  const cleanUser = (inputUsername || '').trim();
  const cleanPass = (inputPassword || '').trim();

  const userValid = constantTimeMatch(cleanUser.toLowerCase(), canonicalUsername.toLowerCase());
  const passValid = constantTimeMatch(cleanPass, expectedPassword);

  return {
    valid: userValid && passValid,
    configured: true,
    canonicalUsername,
  };
}

export function hashPasswordScrypt(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password.trim(), salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPasswordScrypt(password: string, salt: string, expectedHash: string): boolean {
  if (!password || !salt || !expectedHash) return false;
  const derived = crypto.scryptSync(password.trim(), salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function signSessionToken(
  username: string,
  secret: string,
  ttlMs: number = DEFAULT_SESSION_TTL_MS
): string {
  const exp = Date.now() + ttlMs;
  const payload = Buffer.from(JSON.stringify({ username, exp }), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(
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

export function extractBearerToken(authorizationHeader: string | undefined): string | undefined {
  if (typeof authorizationHeader !== 'string') return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  return match && match[1] ? match[1].trim() : undefined;
}
