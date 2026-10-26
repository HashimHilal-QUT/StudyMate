const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { TableClient, AzureNamedKeyCredential } = require('@azure/data-tables');
const scrypt = promisify(crypto.scrypt);
const COOKIE = 'sm_session';
const SESSION_SECONDS = 60 * 60 * 24 * 90;
function client() {
  const account = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  return new TableClient(`https://${account}.table.core.windows.net`, 'studymatedb',
    new AzureNamedKeyCredential(account, process.env.AZURE_STORAGE_ACCOUNT_KEY));
}
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function normalizeEmail(value) {
  if (typeof value !== 'string' || value.length > 254) return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+edu\.au$/.test(email) ? email : null;
}
function emailKey(email) {
  // The storage key acts as a server-only pepper. Raw email addresses are not persisted.
  return crypto.createHmac('sha256', process.env.AUTH_EMAIL_PEPPER || process.env.AZURE_STORAGE_ACCOUNT_KEY).update(email).digest('hex');
}
const validPin = pin => typeof pin === 'string' && /^\d{4}$/.test(pin);
async function pinDigest(pin, salt) { return (await scrypt(pin, salt, 32)).toString('hex'); }
async function newPin(pin) {
  const pinSalt = crypto.randomBytes(16).toString('hex');
  return { pinSalt, pinHash: await pinDigest(pin, pinSalt) };
}
async function verifyPin(pin, account) {
  const actual = await pinDigest(pin, account?.pinSalt || 'missing-account-padding');
  const expected = account?.pinHash || '0'.repeat(64);
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex')) && !!account;
}
function sessionToken(event) {
  const cookie = event.headers?.cookie || event.headers?.Cookie || '';
  const value = cookie.split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(value || '') ? value : null;
}
function cookie(value, age = SESSION_SECONDS) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
}
async function find(db, partition, key) {
  try { return await db.getEntity(partition, key); }
  catch (err) { if (err.statusCode === 404) return null; throw err; }
}
async function issueSession(db, userId, authVersion) {
  const token = crypto.randomBytes(32).toString('hex');
  await db.createEntity({ partitionKey: 'session', rowKey: hash(token), userId, authVersion,
    expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000).toISOString() });
  return cookie(token);
}
async function authenticate(event, db) {
  const token = sessionToken(event);
  if (!token) return null;
  const session = await find(db, 'session', hash(token));
  if (!session || Date.parse(session.expiresAt) <= Date.now()) return null;
  const profile = await find(db, 'profile', session.userId);
  const account = profile?.accountKey && await find(db, 'account', profile.accountKey);
  return account?.authVersion && account.authVersion === session.authVersion ? session.userId : null;
}
function publicProfile(p) {
  return { id: p.rowKey, firstName: p.firstName, avatar: p.avatar,
    subjects: JSON.parse(p.subjects || '[]'), studyStyle: p.studyStyle, availability: p.availability,
    university: p.university, city: p.city || '', bio: p.bio, contact: JSON.parse(p.contact || '{}'),
    photoUrl: p.photoVersion ? `/.netlify/functions/photo?userId=${encodeURIComponent(p.rowKey)}&v=${encodeURIComponent(p.photoVersion)}` : null };
}
function response(statusCode, body, extra = {}) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra }, body: JSON.stringify(body) };
}
function origin() {
  const url = new URL(process.env.APP_ORIGIN || 'https://mystudyfriends.netlify.app');
  return { origin: url.origin, rpID: url.hostname };
}
function sameOrigin(event) {
  const supplied = event.headers?.origin || event.headers?.Origin;
  return !supplied || supplied === origin().origin;
}
// Durable, optimistic-concurrency counters: shared by every function instance.
async function takeAttempt(db, key, limit, seconds = 900) {
  for (let retry = 0; retry < 8; retry++) {
    const old = await find(db, 'limit', key);
    const now = Date.now();
    const active = old && Date.parse(old.expiresAt) > now;
    if (active && old.count >= limit) return false;
    const next = { partitionKey: 'limit', rowKey: key, count: active ? old.count + 1 : 1,
      expiresAt: active ? old.expiresAt : new Date(now + seconds * 1000).toISOString() };
    try {
      if (old) await db.updateEntity(next, 'Replace', { etag: old.etag });
      else await db.createEntity(next);
      return true;
    } catch (err) { if (![409, 412].includes(err.statusCode)) throw err; }
  }
  return false;
}
function ipKey(event) {
  // Netlify supplies this header. Do not trust client-controlled X-Forwarded-For.
  return hash(event.headers?.['x-nf-client-connection-ip'] || 'unknown-client');
}
async function saveChallenge(db, fields) {
  const challengeId = crypto.randomBytes(32).toString('hex');
  await db.createEntity({ partitionKey: 'challenge', rowKey: challengeId, ...fields,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() });
  return challengeId;
}
async function consumeChallenge(db, id, purpose) {
  if (!/^[a-f0-9]{64}$/.test(id || '')) return null;
  const record = await find(db, 'challenge', id);
  if (!record || record.purpose !== purpose || Date.parse(record.expiresAt) <= Date.now()) return null;
  try { await db.deleteEntity('challenge', id, { etag: record.etag }); }
  catch (err) { if ([404, 412].includes(err.statusCode)) return null; throw err; }
  return record;
}
module.exports = { client, hash, normalizeEmail, emailKey, validPin, pinDigest, newPin, verifyPin,
  sessionToken, cookie, issueSession, authenticate, response, find, publicProfile, origin, sameOrigin,
  takeAttempt, ipKey, saveChallenge, consumeChallenge };
