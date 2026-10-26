const auth = require('./lib/auth');
exports.handler = async event => {
  if (!['GET', 'POST', 'DELETE'].includes(event.httpMethod)) return auth.response(405, { error: 'Method not allowed' });
  try {
    const db = auth.client();
    if (event.httpMethod === 'DELETE') {
      const token = auth.sessionToken(event);
      if (token) {
        try { await db.deleteEntity('session', auth.hash(token)); }
        catch (err) { if (err.statusCode !== 404) throw err; }
      }
      return auth.response(200, { success: true }, { 'Set-Cookie': auth.cookie('', 0) });
    }
    if (event.httpMethod === 'POST') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch { return auth.response(400, { error: 'Invalid request' }); }
      const code = auth.normalizeCode(body.recoveryCode);
      if (!code) return auth.response(401, { error: 'Recovery code not recognised. Check your saved code.' });
      let credential;
      try { credential = await db.getEntity('recovery', auth.hash(code)); }
      catch (err) { if (err.statusCode !== 404) throw err; }
      if (!credential) return auth.response(401, { error: 'Recovery code not recognised. Check your saved code.' });
      await db.getEntity('profile', credential.userId);
      return auth.response(200, { userId: credential.userId }, { 'Set-Cookie': await auth.issueSession(db, credential.userId) });
    }
    const userId = await auth.authenticate(event, db);
    if (!userId) return auth.response(401, { error: 'Please restore your profile with your recovery code.' });
    const p = await db.getEntity('profile', userId);
    return auth.response(200, { userId, profile: { id: userId, firstName: p.firstName, avatar: p.avatar,
      subjects: JSON.parse(p.subjects || '[]'), studyStyle: p.studyStyle, availability: p.availability,
      university: p.university, bio: p.bio, contact: JSON.parse(p.contact || '{}') } });
  } catch (err) {
    console.error('session error:', err);
    return auth.response(500, { error: 'Could not access your profile. Please try again.' });
  }
};
