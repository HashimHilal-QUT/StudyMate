const crypto = require('node:crypto');
const sharp = require('sharp');
const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob');
const auth = require('./lib/auth');
function container() {
  const account = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  return new BlobServiceClient(`https://${account}.blob.core.windows.net`,
    new StorageSharedKeyCredential(account, process.env.AZURE_STORAGE_ACCOUNT_KEY)).getContainerClient('studymate-photos');
}
exports.handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return auth.response(405, { error: 'Method not allowed' });
  if (!auth.sameOrigin(event)) return auth.response(403, { error: 'Request not allowed' });
  try {
    const db = auth.client();
    const userId = await auth.authenticate(event, db);
    if (!userId) return auth.response(401, { error: 'Please sign in to access student photos.' });
    if (event.httpMethod === 'GET') {
      const id = event.queryStringParameters?.userId;
      if (!/^[a-f0-9-]{36}$/.test(id || '')) return auth.response(400, { error: 'Invalid profile' });
      const profile = await auth.find(db, 'profile', id);
      if (!profile?.photoVersion) return auth.response(404, { error: 'Photo not found' });
      const data = await container().getBlockBlobClient(`${id}/${profile.photoVersion}.jpg`).downloadToBuffer();
      return { statusCode: 200, headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff' }, isBase64Encoded: true, body: data.toString('base64') };
    }
    if (!await auth.takeAttempt(db, `photo-${userId}`, 20, 3600)) return auth.response(429, { error: 'Too many photo changes. Please try later.' });
    if ((event.body || '').length > 500000) return auth.response(413, { error: 'Please choose a smaller photo.' });
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return auth.response(400, { error: 'Invalid photo request' }); }
    const existing = await db.getEntity('profile', userId);
    const blobs = container();
    if (body.remove === true) {
      await db.updateEntity({ partitionKey: 'profile', rowKey: userId, photoVersion: '' }, 'Merge', { etag: existing.etag });
      if (existing.photoVersion) await blobs.getBlockBlobClient(`${userId}/${existing.photoVersion}.jpg`).deleteIfExists().catch(() => {});
      return auth.response(200, { photoUrl: null });
    }
    if (typeof body.photo !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(body.photo)) return auth.response(400, { error: 'Choose a JPEG, PNG or WebP photo using the photo picker.' });
    const input = Buffer.from(body.photo.split(',')[1], 'base64');
    if (input[0] !== 0xff || input[1] !== 0xd8 || input[2] !== 0xff) return auth.response(400, { error: 'This photo could not be read. Please choose another.' });
    if (input.length > 300000) return auth.response(413, { error: 'Please choose a smaller photo.' });
    let data;
    try {
      // Decode and re-encode on the server too: reject disguised files and strip EXIF/location metadata.
      data = await sharp(input, { limitInputPixels: 4000000 }).rotate().resize(384, 384, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
    } catch { return auth.response(400, { error: 'This photo could not be read. Please choose another.' }); }
    await blobs.createIfNotExists(); // Private by default. No public ACL or browser storage credentials.
    const version = crypto.randomUUID();
    const blob = blobs.getBlockBlobClient(`${userId}/${version}.jpg`);
    await blob.uploadData(data, { blobHTTPHeaders: { blobContentType: 'image/jpeg', blobCacheControl: 'private, no-store' } });
    try { await db.updateEntity({ partitionKey: 'profile', rowKey: userId, photoVersion: version }, 'Merge', { etag: existing.etag }); }
    catch (err) { await blob.deleteIfExists().catch(() => {}); throw err; }
    if (existing.photoVersion) await blobs.getBlockBlobClient(`${userId}/${existing.photoVersion}.jpg`).deleteIfExists().catch(() => {});
    return auth.response(200, { photoUrl: `/.netlify/functions/photo?userId=${encodeURIComponent(userId)}&v=${version}` });
  } catch (err) {
    console.error('Photo operation failed:', err.name);
    return auth.response(err.statusCode === 412 ? 409 : 500, { error: 'Could not save or load the photo. Please try again.' });
  }
};
