import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractBearerToken,
  hashPasswordScrypt,
  resolveSessionSecret,
  signSessionToken,
  verifyOwnerCredentials,
  verifyPasswordScrypt,
  verifySessionToken,
} from './authTokens';

const TEST_SECRET = 'test-lazord-secret';

test('verifyOwnerCredentials trims whitespace on env and input credentials', () => {
  const res = verifyOwnerCredentials(
    '  owner@lazord.om  ',
    '  SecretPass123  ',
    ' owner@lazord.om \n',
    ' SecretPass123 \r\n'
  );
  assert.equal(res.configured, true);
  assert.equal(res.valid, true);
  assert.equal(res.canonicalUsername, 'owner@lazord.om');

  const invalid = verifyOwnerCredentials(
    'owner@lazord.om',
    'WrongPass',
    'owner@lazord.om',
    'SecretPass123'
  );
  assert.equal(invalid.configured, true);
  assert.equal(invalid.valid, false);

  const unconfigured = verifyOwnerCredentials('owner@lazord.om', 'AnyPass', undefined, undefined);
  assert.equal(unconfigured.configured, false);
  assert.equal(unconfigured.valid, false);
});

test('scrypt password hashing and verification work cleanly', () => {
  const { salt, hash } = hashPasswordScrypt('MySecurePass99');
  assert.equal(verifyPasswordScrypt('MySecurePass99', salt, hash), true);
  assert.equal(verifyPasswordScrypt('WrongPass', salt, hash), false);
});

test('resolveSessionSecret stays deterministic across instances when admin env is configured', () => {
  const s1 = resolveSessionSecret({ envUsername: 'owner@lazord.om', envPassword: 'p1' });
  const s2 = resolveSessionSecret({ envUsername: 'owner@lazord.om', envPassword: 'p1' });
  assert.equal(s1, s2);
  assert.ok(s1.length >= 32);

  const explicit = resolveSessionSecret({ envSessionSecret: 'explicit-secret', envPassword: 'p1' });
  assert.equal(explicit, 'explicit-secret');
});

test('signSessionToken and verifySessionToken round-trip and reject tampered/expired tokens', () => {
  const token = signSessionToken('owner@lazord.om', TEST_SECRET, 60_000);
  const verified = verifySessionToken(token, TEST_SECRET);
  assert.deepEqual(verified, { username: 'owner@lazord.om' });

  const tampered = `${token.slice(0, -2)}xx`;
  assert.equal(verifySessionToken(tampered, TEST_SECRET), null);

  const expired = signSessionToken('owner@lazord.om', TEST_SECRET, -1000);
  assert.equal(verifySessionToken(expired, TEST_SECRET), null);
});

test('extractBearerToken parses Authorization Bearer header cleanly', () => {
  assert.equal(extractBearerToken('Bearer abc.def'), 'abc.def');
  assert.equal(extractBearerToken('  bearer   token-123  '), 'token-123');
  assert.equal(extractBearerToken('Basic xyz'), undefined);
  assert.equal(extractBearerToken(undefined), undefined);
});
