const crypto = require('node:crypto');
const { TableClient, AzureNamedKeyCredential } = require('@azure/data-tables');
const COOKIE = 'sm_session';
const SESSION_SECONDS = 60 * 60 * 24 * 90;
function client() {
  const account = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  return new TableClient(`https://${account}.table.core.windows.net`, 'studymatedb',
    new AzureNamedKeyCredential(account, process.env.AZURE_STORAGE_ACCOUNT_KEY));
}
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const newRecoveryCode = () => crypto.randomBytes(12).toString('hex').toUpperCase().match(/.{4}/g).join('-');
function normalizeCode(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/[\s-]/g, '').toUpperCase();
  return /^[A-F0-9]{24}$/.test(normalized) ? normalized : null;
}
function sessionToken(event) {
  const cookie = event.headers?.cookie || event.headers?.Cookie || '';
  const value = cookie.split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(value || '') ? value : null;
}
function cookie(value, age = SESSION_SECONDS) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
}
async function issueSession(db, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await db.createEntity({ partitionKey: 'session', rowKey: hash(token), userId,
    expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000).toISOString() });
  return cookie(token);
}
async function authenticate(event, db) {
  const token = sessionToken(event);
  if (!token) return null;
  try {
    const session = await db.getEntity('session', hash(token));
    return Date.parse(session.expiresAt) > Date.now() ? session.userId : null;
  } catch (err) { if (err.statusCode === 404) return null; throw err; }
}
function response(statusCode, body, extra = {}) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra }, body: JSON.stringify(body) };
}
module.exports = { client, hash, newRecoveryCode, normalizeCode, sessionToken, cookie, issueSession, authenticate, response };
