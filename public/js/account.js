function validStudentEmail(value) {
  return /^[^\s@]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+edu\.au$/i.test(value.trim());
}
function passkeysSupported() { return window.isSecureContext && !!window.PublicKeyCredential && !!navigator.credentials; }
function decodeBase64url(value) {
  const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
function encodeBase64url(value) {
  return btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function credentialJSON(credential) {
  const response = {};
  for (const key of ['clientDataJSON', 'attestationObject', 'authenticatorData', 'signature', 'userHandle']) {
    if (credential.response[key]) response[key] = encodeBase64url(credential.response[key]);
  }
  if (credential.response.getTransports) response.transports = credential.response.getTransports();
  return { id: credential.id, rawId: encodeBase64url(credential.rawId), type: credential.type, response,
    authenticatorAttachment: credential.authenticatorAttachment, clientExtensionResults: credential.getClientExtensionResults() };
}
async function createPasskey(options) {
  if (!passkeysSupported()) throw new Error('Use an up-to-date browser on a phone or computer with passkey support to join.');
  const publicKey = { ...options, challenge: decodeBase64url(options.challenge),
    user: { ...options.user, id: decodeBase64url(options.user.id) },
    excludeCredentials: (options.excludeCredentials || []).map(c => ({ ...c, id: decodeBase64url(c.id) })) };
  return credentialJSON(await navigator.credentials.create({ publicKey }));
}
async function usePasskey(options) {
  if (!passkeysSupported()) throw new Error('Open this app on a device with access to your saved passkey.');
  const publicKey = { ...options, challenge: decodeBase64url(options.challenge),
    allowCredentials: (options.allowCredentials || []).map(c => ({ ...c, id: decodeBase64url(c.id) })) };
  return credentialJSON(await navigator.credentials.get({ publicKey }));
}
function accountError(err) {
  return ['NotAllowedError', 'AbortError'].includes(err.name)
    ? 'Passkey setup or verification was cancelled. You can try again. Use your device’s screen lock or a saved passkey.'
    : err.message || 'Could not connect. Please try again.';
}
async function accountRequest(endpoint, body) {
  const res = await fetch(`/.netlify/functions/${endpoint}`, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not complete that request.');
  return data;
}
async function handlePinReset() {
  const pin = document.getElementById('reset-pin');
  const confirm = document.getElementById('reset-pin-confirm');
  const error = document.getElementById('reset-error');
  const button = document.getElementById('reset-submit');
  error.classList.add('hidden');
  if (!/^\d{4}$/.test(pin.value) || pin.value !== confirm.value) {
    error.textContent = 'Enter the same four-digit PIN in both fields.';
    error.classList.remove('hidden'); return;
  }
  button.disabled = true;
  try {
    const { options, challengeId } = await accountRequest('passkey', { action: 'reset-options' });
    const credential = await usePasskey(options);
    const result = await accountRequest('passkey', { action: 'reset-pin', challengeId, credential, pin: pin.value });
    STATE.userId = result.userId;
    pin.value = ''; confirm.value = '';
    document.getElementById('login-pin').value = '';
    hideModal('modal-reset'); hideModal('modal-login');
    showPage('page-gallery');
    showToast('PIN updated. Your other sessions have been signed out.');
  } catch (err) { error.textContent = accountError(err); error.classList.remove('hidden'); }
  finally { button.disabled = false; }
}
function showToast(message) {
  const toast = document.getElementById('app-toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => toast.classList.add('hidden'), 6000);
}
