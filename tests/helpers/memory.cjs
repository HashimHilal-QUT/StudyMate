function database() {
  const rows = new Map();
  let version = 0;
  const key = (p, r) => `${p}/${r}`;
  const fail = code => { throw Object.assign(new Error(`Storage ${code}`), { statusCode: code }); };
  return {
    rows,
    async createEntity(e) {
      const k = key(e.partitionKey, e.rowKey);
      if (rows.has(k)) fail(409);
      rows.set(k, { ...e, etag: String(++version) });
    },
    async getEntity(p, r) { const row = rows.get(key(p, r)); if (!row) fail(404); return { ...row }; },
    async deleteEntity(p, r, options = {}) {
      const row = rows.get(key(p, r)); if (!row) fail(404);
      if (options.etag && options.etag !== row.etag) fail(412);
      rows.delete(key(p, r));
    },
    async updateEntity(e, mode, options = {}) {
      const k = key(e.partitionKey, e.rowKey), old = rows.get(k);
      if (!old) fail(404);
      if (options.etag && options.etag !== old.etag) fail(412);
      rows.set(k, { ...(mode === 'Merge' ? old : {}), ...e, etag: String(++version) });
    },
    listEntities() { return (async function* () { for (const e of rows.values()) if (e.partitionKey === 'profile') yield { ...e }; })(); },
  };
}
function blobStore() {
  const blobs = new Map();
  const container = { async createIfNotExists() {}, getBlockBlobClient(name) { return {
    async uploadData(data) { blobs.set(name, data); },
    async downloadToBuffer() { return blobs.get(name); },
    async deleteIfExists() { blobs.delete(name); },
  }; } };
  return { blobs, sdk: { BlobServiceClient: function () { return { getContainerClient() { return container; } }; }, StorageSharedKeyCredential: function () {} } };
}
function loadFunction(name, db, overrides = {}) {
  const vm = require('node:vm');
  const fs = require('node:fs');
  const { createRequire } = require('node:module');
  const filename = require.resolve(`../../netlify/functions/${name}`);
  const localRequire = createRequire(filename);
  const auth = require('../../netlify/functions/lib/auth');
  const exported = {};
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    exports: exported, process, console, Buffer, Uint8Array, URL,
    require(id) {
      if (overrides[id]) return overrides[id];
      if (id === '@azure/data-tables') return { TableClient: function () { return db; }, AzureNamedKeyCredential: function () {} };
      if (id === './lib/auth') return { ...auth, client: () => db };
      return localRequire(id);
    },
  });
  return exported.handler;
}
module.exports = { database, loadFunction, blobStore };
