const auth = require('./lib/auth');
exports.handler = async event => {
  if (!['GET', 'POST', 'DELETE'].includes(event.httpMethod)) return auth.response(405, { error: 'Method not allowed' });
  if (!auth.sameOrigin(event)) return auth.response(403, { error: 'Request not allowed' });
  try {
    const db = auth.client();
    if (event.httpMethod === 'DELETE') {
      const token = auth.sessionToken(event);
      if (token && await auth.find(db, 'session', auth.hash(token))) await db.deleteEntity('session', auth.hash(token));
      return auth.response(200, { success: true }, { 'Set-Cookie': auth.cookie('', 0) });
    }
    if (event.httpMethod === 'POST') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch { return auth.response(400, { error: 'Invalid request' }); }
      const email = auth.normalizeEmail(body.email);
      if (!email || !auth.validPin(body.pin)) return auth.response(401, { error: 'Check your university email and four-digit PIN.' });
      const key = auth.emailKey(email);
      if (!await auth.takeAttempt(db, `login-ip-${auth.ipKey(event)}`, 120) || !await auth.takeAttempt(db, `login-${key}`, 5)) {
        return auth.response(429, { error: 'Too many attempts. Wait 15 minutes, or use your passkey to reset your PIN now.' }, { 'Retry-After': '900' });
      }
      const account = await auth.find(db, 'account', key);
      if (!await auth.verifyPin(body.pin, account)) return auth.response(401, { error: 'Check your university email and four-digit PIN.' });
      await db.deleteEntity('limit', `login-${key}`);
      return auth.response(200, { userId: account.userId }, { 'Set-Cookie': await auth.issueSession(db, account.userId, account.authVersion) });
    }
    const userId = await auth.authenticate(event, db);
    if (!userId) return auth.response(401, { error: 'Please sign in with your university email and PIN.' });
    return auth.response(200, { userId, profile: auth.publicProfile(await db.getEntity('profile', userId)) });
  } catch (err) {
    console.error('Session failed:', err.name);
    return auth.response(500, { error: 'Could not access your profile. Please try again.' });
  }
};
