const photoChoices = { reg: { data: null, existing: null, remove: false }, edit: { data: null, existing: null, remove: false } };
function renderAvatar(element, profile) {
  element.replaceChildren();
  const fallback = getAvatarEmoji(profile.avatar);
  element.textContent = fallback;
  // Only this same-origin authenticated endpoint may serve a profile photo.
  if (!/^\/\.netlify\/functions\/photo\?userId=[a-f0-9-]{36}&v=[a-f0-9-]{36}$/.test(profile.photoUrl || '')) return;
  const img = document.createElement('img');
  img.alt = ''; img.src = profile.photoUrl; img.className = 'student-photo'; img.loading = 'lazy';
  img.onerror = () => { element.textContent = fallback; };
  element.replaceChildren(img);
}
function photoPreview(prefix, source, emoji = '🦉') {
  const preview = document.getElementById(`${prefix}-photo-preview`);
  preview.replaceChildren();
  if (source) { const img = document.createElement('img'); img.src = source; img.alt = 'Your selected profile photo'; preview.appendChild(img); }
  else preview.textContent = emoji;
}
function chooseEmoji(prefix, avatar) {
  const state = photoChoices[prefix];
  state.data = null; state.remove = !!state.existing;
  document.getElementById(`${prefix}-photo`).value = '';
  photoPreview(prefix, null, getAvatarEmoji(avatar));
  document.getElementById(`${prefix}-photo-status`).textContent = 'Emoji avatar selected.';
}
function initPhotoPickers() {
  for (const prefix of ['reg', 'edit']) {
    document.getElementById(`${prefix}-photo`).addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      const status = document.getElementById(`${prefix}-photo-status`);
      status.textContent = 'Preparing your photo…';
      const submit = document.getElementById(prefix === 'reg' ? 'reg-submit' : 'edit-submit');
      submit.disabled = true;
      try {
        if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.size > 12 * 1024 * 1024) throw new Error('Choose a photo under 12 MB. JPEG, PNG and WebP work best.');
        const image = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 384;
        const ctx = canvas.getContext('2d');
        const side = Math.min(image.width, image.height);
        ctx.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, 384, 384);
        image.close();
        const data = canvas.toDataURL('image/jpeg', 0.85);
        photoChoices[prefix].data = data;
        photoChoices[prefix].remove = false;
        photoPreview(prefix, data);
        status.textContent = 'Photo selected. It will be saved with your profile.';
      } catch (err) {
        status.textContent = err.message || 'Could not read that photo. Try JPEG or PNG.';
        e.target.value = '';
      } finally { submit.disabled = false; }
    });
  }
}
async function saveProfilePhoto(prefix) {
  const state = photoChoices[prefix];
  if (!state.data && !state.remove) return;
  const result = await accountRequest('photo', state.data ? { photo: state.data } : { remove: true });
  state.existing = result.photoUrl; state.data = null; state.remove = false;
}
