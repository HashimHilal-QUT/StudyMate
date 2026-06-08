/* ============================================================
   My Study Friends — App Logic
   ============================================================ */

const STATE = {
  userId:   localStorage.getItem("sm_userId") || null,
  myAvatar: localStorage.getItem("sm_avatar") || null,
  profiles: [],
  filtered: [],
};

// ========================
// PAGE NAVIGATION
// ========================
function showPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const page = document.getElementById(pageId);
  if (page) page.classList.add("active");
  if (pageId === "page-gallery") loadGallery();
}

function showModal(id)  { document.getElementById(id).classList.remove("hidden"); }
function hideModal(id)  { document.getElementById(id).classList.add("hidden"); }
function showLoginPrompt() { showModal("modal-login"); }

// ========================
// BOOT
// ========================
document.addEventListener("DOMContentLoaded", () => {
  initAvatarGrid();
  initPillSelects();
  initBioCounter();
  initSubjectTags();
  if (STATE.userId) showPage("page-gallery");
});

// ========================
// LOGIN
// ========================
async function handleLogin() {
  const input = document.getElementById("login-id").value.trim();
  if (!input) return;
  try {
    const res = await fetch(`/.netlify/functions/get-profiles?userId=${encodeURIComponent(input)}`);
    if (res.ok) {
      STATE.userId = input;
      localStorage.setItem("sm_userId", input);
      hideModal("modal-login");
      showPage("page-gallery");
    } else {
      alert("Student ID not found. Please check and try again.");
    }
  } catch (e) {
    alert("Could not connect. Please try again.");
  }
}

// ========================
// LOGOUT
// ========================
function handleLogout() { showModal("modal-logout"); }

function confirmLogout() {
  STATE.userId = null;
  STATE.myAvatar = null;
  STATE.profiles = [];
  STATE.filtered = [];
  localStorage.removeItem("sm_userId");
  localStorage.removeItem("sm_avatar");
  hideModal("modal-logout");
  showPage("page-landing");
}

// ========================
// REGISTRATION
// ========================
const subjects = [];

function initAvatarGrid() {
  const grid = document.getElementById("avatar-grid");
  if (!grid) return;
  grid.innerHTML = "";
  AVATARS.forEach(av => {
    const btn = document.createElement("button");
    btn.className = "avatar-option";
    btn.setAttribute("data-key", av.key);
    btn.title = av.label;
    btn.textContent = av.emoji;
    btn.onclick = () => {
      document.querySelectorAll(".avatar-option").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
    };
    grid.appendChild(btn);
  });
}

function initSubjectTags() {
  const input = document.getElementById("reg-subject-input");
  if (!input) return;
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = input.value.trim();
      if (val && subjects.length < 8) {
        subjects.push(val);
        input.value = "";
        renderSubjectTags();
      }
    }
  });
}

function renderSubjectTags() {
  const list = document.getElementById("reg-subject-tags");
  list.innerHTML = subjects.map((s, i) =>
    `<span class="tag">${escHtml(s)}<button onclick="removeSubject(${i})">×</button></span>`
  ).join("");
}

function removeSubject(i) { subjects.splice(i, 1); renderSubjectTags(); }

function initPillSelects() {
  document.querySelectorAll(".pill-select").forEach(group => {
    group.querySelectorAll(".pill").forEach(pill => {
      pill.addEventListener("click", () => {
        group.querySelectorAll(".pill").forEach(p => p.classList.remove("selected"));
        pill.classList.add("selected");
      });
    });
  });
}

function initBioCounter() {
  const bio  = document.getElementById("reg-bio");
  const hint = document.getElementById("bio-chars");
  if (!bio) return;
  bio.addEventListener("input", () => { hint.textContent = `${bio.value.length}/200`; });
}

async function handleRegister() {
  const firstName     = document.getElementById("reg-firstname").value.trim();
  const selectedAvatar = document.querySelector(".avatar-option.selected");
  const university    = document.getElementById("reg-university").value.trim();
  const studyStyle    = document.querySelector("#study-style-select .pill.selected")?.dataset.value || "";
  const availability  = document.querySelector("#availability-select .pill.selected")?.dataset.value || "";
  const bio           = document.getElementById("reg-bio").value.trim();
  const instagram     = document.getElementById("reg-instagram").value.trim();
  const linkedin      = document.getElementById("reg-linkedin").value.trim();
  const discord       = document.getElementById("reg-discord").value.trim();

  document.getElementById("reg-error").classList.add("hidden");
  if (!firstName)      { showError("Please enter your first name."); return; }
  if (!selectedAvatar) { showError("Please choose an avatar."); return; }

  const btn = document.getElementById("reg-submit");
  btn.disabled = true;
  btn.innerHTML = "<span>Initialising…</span>";

  try {
    const res = await fetch("/.netlify/functions/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, avatar: selectedAvatar.dataset.key, subjects, studyStyle, availability, university, bio, contact: { instagram, linkedin, discord } }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Registration failed");

    STATE.userId  = data.userId;
    STATE.myAvatar = selectedAvatar.dataset.key;
    localStorage.setItem("sm_userId",  data.userId);
    localStorage.setItem("sm_avatar", selectedAvatar.dataset.key);

    document.getElementById("display-user-id").textContent = data.userId;
    showModal("modal-save-id");
  } catch (err) {
    showError(err.message || "Something went wrong. Please try again.");
    btn.disabled = false;
    btn.innerHTML = "<span>Initialise &amp; Enter the Network →</span>";
  }
}

function showError(msg) {
  const el = document.getElementById("reg-error");
  el.textContent = msg;
  el.classList.remove("hidden");
}

function copyUserId() {
  const id = document.getElementById("display-user-id").textContent;
  navigator.clipboard.writeText(id).then(() => {
    const btn = event.target;
    const orig = btn.textContent;
    btn.textContent = "✓ Copied!";
    setTimeout(() => btn.textContent = orig, 2000);
  });
}

// ========================
// GALLERY
// ========================
async function loadGallery() {
  if (!STATE.userId) return;

  const grid    = document.getElementById("gallery-grid");
  const loading = document.getElementById("gallery-loading");
  const empty   = document.getElementById("gallery-empty");
  const count   = document.getElementById("gallery-count");

  grid.innerHTML = "";
  loading.classList.remove("hidden");
  empty.classList.add("hidden");
  count.textContent = "";

  try {
    const res  = await fetch(`/.netlify/functions/get-profiles?userId=${encodeURIComponent(STATE.userId)}`);
    const data = await res.json();
    STATE.profiles = data.profiles || [];
    STATE.filtered = [...STATE.profiles];
  } catch (e) {
    STATE.profiles = [];
    STATE.filtered = [];
  }

  loading.classList.add("hidden");

  if (STATE.profiles.length === 0) {
    empty.classList.remove("hidden");
    return;
  }

  renderGallery();
}

function renderGallery() {
  const grid  = document.getElementById("gallery-grid");
  const empty = document.getElementById("gallery-empty");
  const count = document.getElementById("gallery-count");

  grid.innerHTML = "";

  if (STATE.filtered.length === 0) {
    empty.classList.remove("hidden");
    count.textContent = "0 nodes";
    return;
  }

  empty.classList.add("hidden");
  count.textContent = `${STATE.filtered.length} node${STATE.filtered.length !== 1 ? "s" : ""} online`;

  STATE.filtered.forEach(profile => {
    grid.appendChild(buildBadge(profile));
  });
}

function buildBadge(profile) {
  const card = document.createElement("div");
  card.className = "student-badge";
  card.onclick = () => openProfile(profile);

  const subjectTags = (profile.subjects || []).slice(0, 3)
    .map(s => `<span class="badge-subject">${escHtml(s)}</span>`).join("");

  card.innerHTML = `
    <span class="badge-avatar">${getAvatarEmoji(profile.avatar)}</span>
    <div class="badge-name">${escHtml(profile.firstName)}</div>
    <div class="badge-uni">${escHtml(profile.university || "—")}</div>
    ${subjectTags ? `<div class="badge-subjects">${subjectTags}</div>` : ""}
    ${profile.bio ? `<div class="badge-bio">${escHtml(profile.bio)}</div>` : ""}
    <div class="badge-footer">
      <span class="badge-style">${escHtml(profile.studyStyle || "")}</span>
      <span class="badge-cta">VIEW →</span>
    </div>
  `;
  return card;
}

// ========================
// SEARCH / FILTER
// ========================
function filterGallery() {
  const q = document.getElementById("search-input").value.trim().toLowerCase();
  if (!q) {
    STATE.filtered = [...STATE.profiles];
  } else {
    STATE.filtered = STATE.profiles.filter(p => {
      const haystack = [
        p.firstName,
        p.university,
        p.bio,
        p.studyStyle,
        p.availability,
        ...(p.subjects || []),
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }
  renderGallery();
}

// ========================
// PROFILE DETAIL MODAL
// ========================
function openProfile(profile) {
  document.getElementById("modal-avatar").textContent = getAvatarEmoji(profile.avatar);
  document.getElementById("modal-name").textContent   = profile.firstName;
  document.getElementById("modal-uni").textContent    = profile.university || "";

  // Tags
  const tagsEl = document.getElementById("modal-tags");
  let tagsHtml = "";
  (profile.subjects || []).forEach(s => {
    tagsHtml += `<span class="profile-tag subject">${escHtml(s)}</span>`;
  });
  if (profile.studyStyle)   tagsHtml += `<span class="profile-tag style">${escHtml(profile.studyStyle)}</span>`;
  if (profile.availability) tagsHtml += `<span class="profile-tag avail">${escHtml(profile.availability)}</span>`;
  tagsEl.innerHTML = tagsHtml;

  // Bio
  const bioWrap = document.getElementById("modal-bio-wrap");
  const bioEl   = document.getElementById("modal-bio");
  if (profile.bio) {
    bioEl.textContent = profile.bio;
    bioWrap.style.display = "block";
  } else {
    bioWrap.style.display = "none";
  }

  // Contact
  const contactEl = document.getElementById("modal-contact");
  const c = profile.contact || {};
  if (c.instagram || c.linkedin || c.discord) {
    let html = "";
    if (c.instagram) html += `<div class="profile-contact-item"><span class="pci-label">IG</span><span class="pci-value">@${escHtml(c.instagram)}</span></div>`;
    if (c.linkedin)  html += `<div class="profile-contact-item"><span class="pci-label">LI</span><span class="pci-value">${escHtml(c.linkedin)}</span></div>`;
    if (c.discord)   html += `<div class="profile-contact-item"><span class="pci-label">DC</span><span class="pci-value">${escHtml(c.discord)}</span></div>`;
    contactEl.innerHTML = html;
  } else {
    contactEl.innerHTML = `<p class="pci-empty">NO CONTACT INFO SHARED</p>`;
  }

  showModal("modal-profile");
}

// ========================
// UTILITIES
// ========================
function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ========================
// QR CODE — GENERATE & DOWNLOAD
// ========================
let _qrInstance = null;

function generateQR(userId) {
  const canvas = document.getElementById("qr-canvas");
  if (!canvas) return;

  // qrcodejs needs a container div, so we use the canvas parent
  const wrap = canvas.parentElement;
  wrap.innerHTML = "";                     // clear previous

  try {
    _qrInstance = new QRCode(wrap, {
      text:          userId,
      width:         180,
      height:        180,
      colorDark:     "#050810",
      colorLight:    "#ffffff",
      correctLevel:  QRCode.CorrectLevel.H,
    });
  } catch (e) {
    wrap.innerHTML = `<p style="color:var(--text-soft);font-size:12px;padding:20px">QR unavailable</p>`;
  }
}

function downloadQR() {
  const wrap = document.getElementById("qr-canvas")?.parentElement || document.querySelector(".qr-wrap");
  const img  = wrap?.querySelector("img") || wrap?.querySelector("canvas");
  if (!img) return;

  const src = img.tagName === "CANVAS"
    ? img.toDataURL("image/png")
    : img.src;

  const a  = document.createElement("a");
  a.href   = src;
  a.download = "mystudyfriends-access-key.png";
  a.click();
}

// Patch handleRegister to call generateQR after getting userId
const _origRegister = handleRegister;
// Override the showModal call — hook into after modal-save-id appears
const _origShowModal = showModal;
window.showModal = function(id) {
  _origShowModal(id);
  if (id === "modal-save-id") {
    const userId = document.getElementById("display-user-id").textContent;
    // slight delay so DOM is visible
    setTimeout(() => generateQR(userId), 80);
  }
};

// ========================
// QR CODE — CAMERA SCAN LOGIN
// ========================
let _scanStream   = null;
let _scanInterval = null;

async function startQRScan() {
  const statusEl = document.getElementById("qr-status");
  const video    = document.getElementById("qr-video");
  if (!video) return;

  statusEl.textContent = "Requesting camera…";

  try {
    _scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });
    video.srcObject = _scanStream;
    statusEl.textContent = "Align your QR code in the frame";

    // Use BarcodeDetector if available (Chrome/Edge)
    if ("BarcodeDetector" in window) {
      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      _scanInterval = setInterval(async () => {
        try {
          const codes = await detector.detect(video);
          if (codes.length > 0) {
            const value = codes[0].rawValue;
            stopQRScan();
            autoLoginFromQR(value);
          }
        } catch (_) {}
      }, 400);
    } else {
      // Fallback: canvas decode via jsQR (loaded lazily)
      await loadJsQR();
      _scanInterval = setInterval(() => {
        if (!window.jsQR) return;
        const c   = document.createElement("canvas");
        c.width   = video.videoWidth  || 320;
        c.height  = video.videoHeight || 320;
        const ctx = c.getContext("2d");
        ctx.drawImage(video, 0, 0, c.width, c.height);
        const imageData = ctx.getImageData(0, 0, c.width, c.height);
        const code = window.jsQR(imageData.data, imageData.width, imageData.height);
        if (code?.data) {
          stopQRScan();
          autoLoginFromQR(code.data);
        }
      }, 400);
    }
  } catch (err) {
    statusEl.textContent = "Camera access denied — paste your key instead";
  }
}

function loadJsQR() {
  return new Promise(resolve => {
    if (window.jsQR) { resolve(); return; }
    const s  = document.createElement("script");
    s.src    = "https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js";
    s.onload = resolve;
    document.head.appendChild(s);
  });
}

function stopQRScan() {
  clearInterval(_scanInterval);
  _scanInterval = null;
  if (_scanStream) {
    _scanStream.getTracks().forEach(t => t.stop());
    _scanStream = null;
  }
  const video = document.getElementById("qr-video");
  if (video) video.srcObject = null;
}

async function autoLoginFromQR(value) {
  const statusEl = document.getElementById("qr-status");
  if (statusEl) statusEl.textContent = "QR detected — verifying…";

  try {
    const res = await fetch(`/.netlify/functions/get-profiles?userId=${encodeURIComponent(value)}`);
    if (res.ok) {
      STATE.userId = value;
      localStorage.setItem("sm_userId", value);
      hideModal("modal-login");
      showPage("page-gallery");
    } else {
      if (statusEl) statusEl.textContent = "QR not recognised — try the Key tab";
      // restart scan
      setTimeout(startQRScan, 1500);
    }
  } catch (e) {
    if (statusEl) statusEl.textContent = "Connection error — try again";
  }
}

// ========================
// LOGIN TAB SWITCHING
// ========================
function switchLoginTab(tab) {
  document.getElementById("login-panel-id").classList.toggle("hidden", tab !== "id");
  document.getElementById("login-panel-qr").classList.toggle("hidden", tab !== "qr");
  document.getElementById("tab-id").classList.toggle("active", tab === "id");
  document.getElementById("tab-qr").classList.toggle("active", tab === "qr");

  if (tab === "qr") {
    startQRScan();
  } else {
    stopQRScan();
  }
}

// Stop camera when login modal is closed
const _origHideModal = hideModal;
window.hideModal = function(id) {
  _origHideModal(id);
  if (id === "modal-login") stopQRScan();
};

// ========================
// PROFILE MODAL — CLICK OVERLAY TO CLOSE
// ========================
function handleProfileModalClick(e) {
  // close only if clicking the dark backdrop, not the box inside
  if (e.target === document.getElementById("modal-profile")) {
    hideModal("modal-profile");
  }
}
