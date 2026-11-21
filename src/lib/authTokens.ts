import crypto from 'node:crypto';

export const DEFAULT_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export function constantTimeMatch(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function verifyOwnerCredentials(
  inputUsername: string,
  inputPassword: string,
  envUsername: string | undefined,
  envPassword: string | undefined
): { valid: boolean; canonicalUsername: string } {
  const canonicalUsername = (envUsername || 'owner@lazord.om').trim() || 'owner@lazord.om';
  const expectedPassword = (envPassword || 'Lazord@2026').trim() || 'Lazord@2026';

  const cleanUser = (inputUsername || '').trim();
  const cleanPass = (inputPassword || '').trim();

  const userValid =
    constantTimeMatch(cleanUser.toLowerCase(), canonicalUsername.toLowerCase()) ||
    constantTimeMatch(cleanUser.toLowerCase(), 'admin');
  const passValid = constantTimeMatch(cleanPass, expectedPassword);

  return {
    valid: userValid && passValid,
    canonicalUsername,
  };
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
  if (!token) return null;
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
