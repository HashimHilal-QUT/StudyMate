const crypto = require('node:crypto');
const { generateRegistrationOptions } = require('@simplewebauthn/server');
const auth = require('./lib/auth');
exports.handler = async event => {
  if (event.httpMethod !== 'POST') return auth.response(405, { error: 'Method not allowed' });
  if (!auth.sameOrigin(event)) return auth.response(403, { error: 'Request not allowed' });
  try {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return auth.response(400, { error: 'Invalid request' }); }
    const { firstName, avatar, subjects, studyStyle, availability, university, city, bio, contact, pin } = body;
    const email = auth.normalizeEmail(body.email);
    if (!email) return auth.response(400, { error: 'Enter your university email ending in .edu.au.' });
    if (!auth.validPin(pin)) return auth.response(400, { error: 'Choose a PIN with exactly four digits.' });
    if (typeof firstName !== 'string' || !firstName.trim() || !/^avatar_[a-z]+$/.test(avatar || '')) return auth.response(400, { error: 'First name and an avatar or photo are required.' });
    if ([city, university, studyStyle, availability, bio].some(v => v != null && typeof v !== 'string') ||
        (subjects != null && (!Array.isArray(subjects) || subjects.length > 8 || subjects.some(s => typeof s !== 'string')))) return auth.response(400, { error: 'Please check your profile fields.' });
    const cleanName = firstName.trim().replace(/[^\p{L}\p{M}\s'-]/gu, '').slice(0, 30);
    if (!cleanName) return auth.response(400, { error: 'Please enter your first name.' });
    const db = auth.client();
    if (!await auth.takeAttempt(db, `register-${auth.ipKey(event)}`, 100, 3600)) return auth.response(429, { error: 'Too many sign-up attempts. Please try later.' }, { 'Retry-After': '3600' });
    const accountKey = auth.emailKey(email);
    if (await auth.find(db, 'account', accountKey)) return auth.response(409, { error: 'Unable to create this account. Try signing in or using your passkey to reset your PIN.' });
    const userId = crypto.randomUUID();
    const safeContact = {};
    for (const key of ['instagram', 'linkedin', 'facebook', 'discord']) {
      if (typeof contact?.[key] === 'string') safeContact[key] = contact[key].replace(key === 'discord' ? /[\u0000-\u001f]/g : /[^a-zA-Z0-9._-]/g, '').slice(0, 50);
    }
    const profile = { partitionKey: 'profile', rowKey: userId, accountKey, firstName: cleanName, avatar,
      subjects: JSON.stringify((subjects || []).map(s => s.trim().slice(0, 60))), studyStyle: studyStyle || '',
      availability: availability || '', university: (university || '').trim().slice(0, 100), city: (city || '').trim().slice(0, 60),
      bio: (bio || '').slice(0, 200), contact: JSON.stringify(safeContact), createdAt: new Date().toISOString() };
    const { rpID } = auth.origin();
    const options = await generateRegistrationOptions({ rpName: 'My Study Friends', rpID,
      userID: new Uint8Array(Buffer.from(userId)), userName: `${cleanName} · ${userId.slice(0, 8)}`,
      userDisplayName: cleanName, attestationType: 'none',
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' }, supportedAlgorithmIDs: [-7, -257] });
    const pinFields = await auth.newPin(pin);
    const challengeId = await auth.saveChallenge(db, { purpose: 'register', challenge: options.challenge,
      accountKey, userId, profile: JSON.stringify(profile), ...pinFields });
    return auth.response(200, { options, challengeId });
  } catch (err) {
    console.error('Registration failed:', err.name);
    return auth.response(500, { error: 'Could not start registration. Please try again.' });
  }
};
