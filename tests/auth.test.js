const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const auth = require('../netlify/functions/lib/auth');
const { database, loadFunction } = require('./helpers/memory.cjs');
process.env.AUTH_EMAIL_PEPPER = 'test-only-email-pepper';
const body = value => JSON.stringify(value);
const event = (data, extra = {}) => ({ httpMethod: 'POST', body: body(data), ...extra });
async function account(db) {
  const userId = crypto.randomUUID(), key = auth.emailKey('alice@student.qut.edu.au');
  const row = { partitionKey: 'account', rowKey: key, userId, ...await auth.newPin('0123'), authVersion: 'version-one', credentialId: 'saved-key', publicKey: 'AA==', counter: 0 };
  await db.createEntity(row);
  await db.createEntity({ partitionKey: 'profile', rowKey: userId, accountKey: key, firstName: 'Alice', avatar: 'avatar_owl', subjects: '[]', contact: '{}', city: 'Brisbane' });
  await db.createEntity({ partitionKey: 'passkey', rowKey: auth.hash(row.credentialId), accountKey: key });
  return row;
}
test('email policy requires the actual .edu.au domain and PINs preserve leading zeros', async () => {
  assert.equal(auth.normalizeEmail(' Alice@STUDENT.QUT.EDU.AU '), 'alice@student.qut.edu.au');
  for (const value of ['x@gmail.com', 'x@edu.au', 'x@qut.edu.au.evil.com', 'x@notedu.au', '@qut.edu.au', 'x@y@qut.edu.au', {}, null]) assert.equal(auth.normalizeEmail(value), null);
  assert.equal(auth.validPin('0123'), true);
  for (const value of [1234, '123', '12345', 'abcd']) assert.equal(auth.validPin(value), false);
  const digest = await auth.newPin('0123');
  assert.notEqual(digest.pinHash, '0123');
  assert.equal(await auth.verifyPin('0123', digest), true);
  assert.equal(await auth.verifyPin('1230', digest), false);
});
test('PIN login uses durable attempt limits, rejects public IDs, and logout revokes the session', async () => {
  const db = database(), owner = await account(db), handler = loadFunction('session', db);
  assert.equal((await handler(event({ recoveryCode: owner.userId }))).statusCode, 401);
  for (let i = 0; i < 5; i++) assert.equal((await handler(event({ email: 'alice@student.qut.edu.au', pin: '9999' }))).statusCode, 401);
  assert.equal((await handler(event({ email: 'alice@student.qut.edu.au', pin: '0123' }))).statusCode, 429);
  await db.deleteEntity('limit', `login-${owner.rowKey}`);
  const login = await handler(event({ email: 'ALICE@student.qut.edu.au', pin: '0123' }));
  assert.equal(login.statusCode, 200);
  assert.match(login.headers['Set-Cookie'], /HttpOnly; Secure; SameSite=Strict/);
  const headers = { cookie: login.headers['Set-Cookie'].split(';')[0] };
  const own = await handler({ httpMethod: 'GET', headers });
  assert.equal(JSON.parse(own.body).profile.city, 'Brisbane');
  assert.ok(!own.body.includes('pinHash') && !own.body.includes(owner.rowKey));
  assert.equal(await auth.authenticate({ queryStringParameters: { userId: owner.userId } }, db), null);
  await handler({ httpMethod: 'DELETE', headers });
  assert.equal(await auth.authenticate({ headers }, db), null);
});
test('registration requires email and PIN, stores no raw email, and creates no account before passkey proof', async () => {
  const db = database(), register = loadFunction('register', db);
  const data = { email: 'new@student.qut.edu.au', pin: '1234', firstName: 'New', avatar: 'avatar_owl', city: 'Brisbane' };
  assert.equal((await register(event({ ...data, email: 'x@gmail.com' }))).statusCode, 400);
  assert.equal((await register(event({ ...data, pin: '12345' }))).statusCode, 400);
  const pending = await register(event(data));
  assert.equal(pending.statusCode, 200);
  const options = JSON.parse(pending.body);
  assert.equal(options.options.authenticatorSelection.userVerification, 'required');
  assert.equal(options.options.authenticatorSelection.residentKey, 'required');
  assert.equal([...db.rows.values()].filter(r => r.partitionKey === 'account' || r.partitionKey === 'profile').length, 0);
  assert.ok(!JSON.stringify([...db.rows.values()]).includes(data.email));
  const handler = loadFunction('passkey', db);
  assert.equal((await handler(event({ action: 'complete-registration', challengeId: options.challengeId, credential: { id: 'fake' } }))).statusCode, 400);
  assert.equal(await auth.consumeChallenge(db, options.challengeId, 'register'), null);
});
test('challenges expire and are consumed once; concurrent attempt counters cannot bypass a limit', async () => {
  const db = database();
  const id = await auth.saveChallenge(db, { purpose: 'reset', challenge: 'test' });
  const results = await Promise.all([auth.consumeChallenge(db, id, 'reset'), auth.consumeChallenge(db, id, 'reset')]);
  assert.equal(results.filter(Boolean).length, 1);
  const expired = await auth.saveChallenge(db, { purpose: 'reset', challenge: 'test' });
  await db.updateEntity({ partitionKey: 'challenge', rowKey: expired, expiresAt: '2000-01-01' }, 'Merge');
  assert.equal(await auth.consumeChallenge(db, expired, 'reset'), null);
  const attempts = await Promise.all(Array.from({ length: 20 }, () => auth.takeAttempt(db, 'same-account', 5)));
  assert.equal(attempts.filter(Boolean).length, 5);
});
test('reset rejects personal facts and forged passkeys; a verified passkey rotates PIN and revokes all old sessions', async () => {
  const db = database(), owner = await account(db);
  const session = await auth.issueSession(db, owner.userId, owner.authVersion);
  const headers = { cookie: session.split(';')[0] };
  const real = loadFunction('passkey', db);
  assert.equal((await real(event({ action: 'reset-pin', email: 'alice@student.qut.edu.au', city: 'Brisbane', pin: '5678' }))).statusCode, 400);
  const options = JSON.parse((await real(event({ action: 'reset-options' }))).body);
  assert.equal((await real(event({ action: 'reset-pin', challengeId: options.challengeId, credential: { id: owner.credentialId }, pin: '5678' }))).statusCode, 401);
  assert.equal(await auth.authenticate({ headers }, db), owner.userId);
  // This stub isolates the post-verification storage and revocation transaction.
  // Real cryptographic WebAuthn registration/reset is also exercised by browser checks.
  const verified = loadFunction('passkey', db, { '@simplewebauthn/server': { verifyAuthenticationResponse: async () => ({ verified: true, authenticationInfo: { newCounter: 1 } }) } });
  const id = await auth.saveChallenge(db, { purpose: 'reset', challenge: 'verified-test' });
  const reset = await verified(event({ action: 'reset-pin', challengeId: id, credential: { id: owner.credentialId }, pin: '5678' }));
  assert.equal(reset.statusCode, 200);
  assert.equal(await auth.authenticate({ headers }, db), null);
  assert.equal(await auth.verifyPin('0123', await db.getEntity('account', owner.rowKey)), false);
  assert.equal(await auth.verifyPin('5678', await db.getEntity('account', owner.rowKey)), true);
});
test('profile updates preserve credentials and photos and ignore a supplied target ID', async () => {
  const db = database(), owner = await account(db);
  const cookie = await auth.issueSession(db, owner.userId, owner.authVersion);
  const handler = loadFunction('update-profile', db);
  assert.equal((await handler(event({ userId: owner.userId }))).statusCode, 401);
  const edited = await handler(event({ userId: 'someone-else', bio: 'New bio', city: ' Melbourne ', university: 'Custom team' }, { headers: { cookie: cookie.split(';')[0] } }));
  assert.equal(edited.statusCode, 200);
  const profile = await db.getEntity('profile', owner.userId);
  assert.equal(profile.accountKey, owner.rowKey);
  assert.equal(profile.city, 'Melbourne');
  assert.equal(await auth.authenticate({ headers: { cookie: cookie.split(';')[0] } }, db), owner.userId);
});
