const { test } = require('node:test');
const assert = require('node:assert/strict');
const auth = require('../netlify/functions/lib/auth');
function database() {
  const rows = new Map();
  const key = (p, r) => `${p}/${r}`;
  return {
    rows,
    async createEntity(e) { rows.set(key(e.partitionKey, e.rowKey), e); },
    async getEntity(p, r) { if (!rows.has(key(p, r))) throw Object.assign(new Error('Missing'), { statusCode: 404 }); return rows.get(key(p, r)); },
    async deleteEntity(p, r) { rows.delete(key(p, r)); },
    async updateEntity(e) { rows.set(key(e.partitionKey, e.rowKey), e); },
    listEntities() { return (async function* () { for (const e of rows.values()) if (e.partitionKey === 'profile') yield e; })(); },
  };
}
test('recovery codes normalize separators and reject UUIDs and malformed codes', () => {
  const codes = new Set(Array.from({ length: 1000 }, () => auth.newRecoveryCode()));
  assert.equal(codes.size, 1000);
  for (const code of codes) {
    assert.match(code, /^([A-F0-9]{4}-){5}[A-F0-9]{4}$/);
    assert.equal(auth.normalizeCode(code.toLowerCase()), code.replaceAll('-', ''));
  }
  assert.equal(auth.normalizeCode('d46f70c2-8860-4594-a068-e5caf8daf59c'), null);
  assert.equal(auth.normalizeCode({}), null);
});
test('sessions are hashed, expire, and ignore public user IDs', async () => {
  const db = database();
  const cookie = await auth.issueSession(db, 'alice');
  assert.match(cookie, /HttpOnly; Secure; SameSite=Strict/);
  const event = { headers: { cookie: cookie.split(';')[0] } };
  assert.equal(await auth.authenticate(event, db), 'alice');
  assert.equal(await auth.authenticate({ queryStringParameters: { userId: 'alice' } }, db), null);
  const session = [...db.rows.values()][0];
  assert.notEqual(session.rowKey, auth.sessionToken(event));
  session.expiresAt = '2000-01-01T00:00:00Z';
  assert.equal(await auth.authenticate(event, db), null);
});
test('restore, own profile, rejection, and logout lifecycle', async () => {
  const db = database();
  const original = auth.client;
  auth.client = () => db;
  try {
    const handler = require('../netlify/functions/session').handler;
    const code = auth.newRecoveryCode();
    await db.createEntity({ partitionKey: 'profile', rowKey: 'alice', firstName: 'Alice', subjects: '[]', contact: '{}' });
    await db.createEntity({ partitionKey: 'recovery', rowKey: auth.hash(auth.normalizeCode(code)), userId: 'alice' });
    assert.equal((await handler({ httpMethod: 'GET', headers: {}, queryStringParameters: { userId: 'alice' } })).statusCode, 401);
    assert.equal((await handler({ httpMethod: 'POST', body: JSON.stringify({ recoveryCode: auth.newRecoveryCode() }) })).statusCode, 401);
    const restored = await handler({ httpMethod: 'POST', body: JSON.stringify({ recoveryCode: code.toLowerCase() }) });
    assert.equal(restored.statusCode, 200);
    assert.equal(JSON.parse(restored.body).userId, 'alice');
    const headers = { cookie: restored.headers['Set-Cookie'].split(';')[0] };
    const own = await handler({ httpMethod: 'GET', headers });
    assert.equal(JSON.parse(own.body).profile.firstName, 'Alice');
    assert.equal(own.headers['Cache-Control'], 'no-store');
    assert.equal((await handler({ httpMethod: 'DELETE', headers })).statusCode, 200);
    assert.equal((await handler({ httpMethod: 'GET', headers })).statusCode, 401);
  } finally { auth.client = original; }
});

function loadFunction(name, db) {
  const vm = require('node:vm');
  const fs = require('node:fs');
  const exported = {};
  vm.runInNewContext(fs.readFileSync(require.resolve(`../netlify/functions/${name}`), 'utf8'), {
    exports: exported, process, console,
    require(id) {
      if (id === '@azure/data-tables') return { TableClient: function () { return db; }, AzureNamedKeyCredential: function () {} };
      if (id === './lib/auth') return auth;
      return require(id);
    },
  });
  return exported.handler;
}
test('registration returns a private code, listing excludes it, and edits use session ownership', async () => {
  const db = database();
  const register = loadFunction('register', db);
  const created = await register({ httpMethod: 'POST', body: JSON.stringify({ firstName: 'Alice', avatar: 'avatar_owl' }) });
  assert.equal(created.statusCode, 201);
  const { userId, recoveryCode } = JSON.parse(created.body);
  assert.ok(auth.normalizeCode(recoveryCode));
  assert.ok(!JSON.stringify([...db.rows.values()]).includes(recoveryCode));
  const headers = { cookie: created.headers['Set-Cookie'].split(';')[0] };
  const list = loadFunction('get-profiles', db);
  assert.equal((await list({ httpMethod: 'GET', queryStringParameters: { userId } })).statusCode, 401);
  await db.createEntity({ partitionKey: 'profile', rowKey: 'bob', firstName: 'Bob', avatar: 'avatar_fox', subjects: '[]', contact: '{}' });
  const listed = await list({ httpMethod: 'GET', headers, queryStringParameters: { includeSelf: 'true' } });
  assert.equal(listed.statusCode, 200);
  assert.deepEqual(JSON.parse(listed.body).profiles.map(p => p.id), ['bob']);
  assert.ok(!listed.body.includes(recoveryCode));
  const update = loadFunction('update-profile', db);
  assert.equal((await update({ httpMethod: 'POST', body: JSON.stringify({ userId }) })).statusCode, 401);
  const edited = await update({ httpMethod: 'POST', headers, body: JSON.stringify({ userId: 'bob', bio: 'My new bio' }) });
  assert.equal(edited.statusCode, 200);
  assert.equal((await db.getEntity('profile', userId)).bio, 'My new bio');
  assert.equal((await db.getEntity('profile', 'bob')).bio, undefined);
  for (const name of ['swipe', 'get-matches']) {
    const handler = loadFunction(name, db);
    const result = await handler({ httpMethod: name === 'swipe' ? 'POST' : 'GET', body: JSON.stringify({ swiperId: userId, targetId: 'bob', direction: 'right' }), queryStringParameters: { userId } });
    assert.equal(result.statusCode, 401);
  }
});
