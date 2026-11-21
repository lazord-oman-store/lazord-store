import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractBearerToken,
  signSessionToken,
  verifyOwnerCredentials,
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
  assert.equal(res.valid, true);
  assert.equal(res.canonicalUsername, 'owner@lazord.om');

  const invalid = verifyOwnerCredentials(
    'owner@lazord.om',
    'WrongPass',
    'owner@lazord.om',
    'SecretPass123'
  );
  assert.equal(invalid.valid, false);
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
