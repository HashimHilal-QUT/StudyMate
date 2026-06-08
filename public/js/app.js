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
