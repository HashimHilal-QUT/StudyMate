const crypto = require('node:crypto');
const webauthn = require('@simplewebauthn/server');
const auth = require('./lib/auth');
exports.handler = async event => {
  if (event.httpMethod !== 'POST') return auth.response(405, { error: 'Method not allowed' });
  if (!auth.sameOrigin(event)) return auth.response(403, { error: 'Request not allowed' });
  try {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return auth.response(400, { error: 'Invalid request' }); }
    const db = auth.client();
    const { origin, rpID } = auth.origin();
    if (!await auth.takeAttempt(db, `passkey-${auth.ipKey(event)}`, 120)) return auth.response(429, { error: 'Too many requests. Please try again in 15 minutes.' }, { 'Retry-After': '900' });
    if (body.action === 'complete-registration') {
      const pending = await auth.consumeChallenge(db, body.challengeId, 'register');
      if (!pending) return auth.response(400, { error: 'Sign-up expired. Please start again.' });
      let result;
      try { result = await webauthn.verifyRegistrationResponse({ response: body.credential, expectedChallenge: pending.challenge,
        expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true, supportedAlgorithmIDs: [-7, -257] }); }
      catch { return auth.response(400, { error: 'Passkey verification failed. Please start sign-up again.' }); }
      if (!result.verified) return auth.response(400, { error: 'Passkey verification failed.' });
      const credential = result.registrationInfo.credential;
      const account = { partitionKey: 'account', rowKey: pending.accountKey, userId: pending.userId,
        pinSalt: pending.pinSalt, pinHash: pending.pinHash, authVersion: crypto.randomUUID(),
        credentialId: credential.id, publicKey: Buffer.from(credential.publicKey).toString('base64'),
        counter: credential.counter, transports: JSON.stringify(credential.transports || []) };
      try { await db.createEntity(account); }
      catch (err) { if (err.statusCode === 409) return auth.response(409, { error: 'This account already exists. Please sign in.' }); throw err; }
      let profileCreated = false, keyCreated = false;
      try {
        await db.createEntity(JSON.parse(pending.profile)); profileCreated = true;
        await db.createEntity({ partitionKey: 'passkey', rowKey: auth.hash(credential.id), accountKey: pending.accountKey }); keyCreated = true;
        const sessionCookie = await auth.issueSession(db, pending.userId, account.authVersion);
        return auth.response(201, { userId: pending.userId }, { 'Set-Cookie': sessionCookie });
      } catch (err) {
        await Promise.allSettled([db.deleteEntity('account', pending.accountKey),
          ...(profileCreated ? [db.deleteEntity('profile', pending.userId)] : []),
          ...(keyCreated ? [db.deleteEntity('passkey', auth.hash(credential.id))] : [])]);
        throw err;
      }
    }
    if (body.action === 'reset-options') {
      // A discoverable passkey identifies its owner; no public profile facts are used.
      const options = await webauthn.generateAuthenticationOptions({ rpID, userVerification: 'required', allowCredentials: [] });
      const challengeId = await auth.saveChallenge(db, { purpose: 'reset', challenge: options.challenge });
      return auth.response(200, { options, challengeId });
    }
    if (body.action === 'reset-pin') {
      if (!auth.validPin(body.pin)) return auth.response(400, { error: 'Choose a PIN with exactly four digits.' });
      const pending = await auth.consumeChallenge(db, body.challengeId, 'reset');
      if (!pending) return auth.response(400, { error: 'Reset expired. Please try again.' });
      const credentialId = body.credential?.id;
      const key = typeof credentialId === 'string' && await auth.find(db, 'passkey', auth.hash(credentialId));
      const account = key && await auth.find(db, 'account', key.accountKey);
      if (!account || account.credentialId !== credentialId) return auth.response(401, { error: 'Use the passkey saved when you joined.' });
      let result;
      try { result = await webauthn.verifyAuthenticationResponse({ response: body.credential, expectedChallenge: pending.challenge,
        expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
        credential: { id: account.credentialId, publicKey: new Uint8Array(Buffer.from(account.publicKey, 'base64')),
          counter: account.counter, transports: JSON.parse(account.transports || '[]') } }); }
      catch { return auth.response(401, { error: 'Passkey verification failed. Your PIN has not changed.' }); }
      if (!result.verified) return auth.response(401, { error: 'Passkey verification failed.' });
      const authVersion = crypto.randomUUID();
      await db.updateEntity({ partitionKey: 'account', rowKey: account.rowKey, ...await auth.newPin(body.pin),
        authVersion, counter: result.authenticationInfo.newCounter }, 'Merge', { etag: account.etag });
      // Clear PIN lockout only after passkey proof. All older sessions are now invalid.
      const limit = await auth.find(db, 'limit', `login-${account.rowKey}`);
      if (limit) await db.deleteEntity('limit', limit.rowKey);
      return auth.response(200, { userId: account.userId }, { 'Set-Cookie': await auth.issueSession(db, account.userId, authVersion) });
    }
    return auth.response(400, { error: 'Unknown action' });
  } catch (err) {
    console.error('Passkey operation failed:', err.name);
    return auth.response(err.statusCode === 412 ? 409 : 500, { error: 'Could not complete that request. Please try again.' });
  }
};
