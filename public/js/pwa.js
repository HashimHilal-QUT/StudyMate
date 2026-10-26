let installPrompt = null;
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function syncInstallButtons() { document.querySelectorAll('[data-install-app]').forEach(b => b.hidden = standalone()); }
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; syncInstallButtons(); });
window.addEventListener('appinstalled', () => { installPrompt = null; syncInstallButtons(); });
async function installApp() {
  if (installPrompt) {
    const prompt = installPrompt;
    installPrompt = null;
    await prompt.prompt();
    await prompt.userChoice;
  } else { showModal('modal-install'); }
}
function updateConnectivity() { document.getElementById('connection-status').hidden = navigator.onLine; }
window.addEventListener('online', updateConnectivity);
window.addEventListener('offline', updateConnectivity);
document.addEventListener('DOMContentLoaded', () => {
  syncInstallButtons(); updateConnectivity();
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').then(registration => {
    function offerUpdate() {
      if (!registration.waiting || !navigator.serviceWorker.controller) return;
      const button = document.getElementById('app-update');
      button.hidden = false;
      button.onclick = () => registration.waiting?.postMessage('ACTIVATE_UPDATE');
    }
    offerUpdate();
    registration.addEventListener('updatefound', () => {
      registration.installing?.addEventListener('statechange', offerUpdate);
    });
    let refreshing = false;
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !refreshing) { refreshing = true; location.reload(); }
    });
  }).catch(() => { /* Normal online browsing remains available. */ });
});
