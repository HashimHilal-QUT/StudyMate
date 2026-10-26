/* ============================================================
   My Study Friends — App Logic
   ============================================================ */

const STATE = {
  userId: null,
  myAvatar: null,
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
document.addEventListener("DOMContentLoaded", async () => {
  initAvatarGrid();
  initPillSelects();
  initBioCounter();
  initSubjectTags();
  localStorage.removeItem("sm_userId");
  localStorage.removeItem("sm_avatar");
  try {
    const res = await fetch("/.netlify/functions/session");
    if (res.ok) {
      const data = await res.json();
      STATE.userId = data.userId;
      STATE.myAvatar = data.profile.avatar;
      showPage("page-gallery");

    }
  } catch { /* Landing remains available when offline. */ }
});

// ========================
// LOGIN
// ========================
async function handleLogin() {
  const input = document.getElementById("login-id");
  const error = document.getElementById("login-error");
  const button = document.getElementById("login-submit");
  error.classList.add("hidden");
  if (!input.value.trim()) { input.focus(); return; }
  button.disabled = true;
  try {
    const res = await fetch("/.netlify/functions/session", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recoveryCode: input.value.trim() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not restore your profile.");
    STATE.userId = data.userId;
    input.value = "";
    hideModal("modal-login");
    showPage("page-gallery");
  } catch (err) {
    error.textContent = err.message || "Could not connect. Please try again.";
    error.classList.remove("hidden");
  } finally { button.disabled = false; }
}

function handleLogout() { showModal("modal-logout"); }
async function confirmLogout() {
  try {
    const res = await fetch("/.netlify/functions/session", { method: "DELETE" });
    if (!res.ok) throw new Error();
    STATE.userId = null;
    STATE.myAvatar = null;
    STATE.profiles = [];
    STATE.filtered = [];
    document.getElementById("gallery-grid").innerHTML = "";
    document.getElementById("modal-contact").textContent = "";
    document.getElementById("display-recovery-code").textContent = "";
    hideModal("modal-logout");
    showPage("page-landing");
  } catch { alert("Could not log out. Please try again."); }
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
  const selectedAvatar = document.querySelector("#avatar-grid .avatar-option.selected");
  const university    = document.getElementById("reg-university").value.trim();
  const studyStyle    = document.querySelector("#study-style-select .pill.selected")?.dataset.value || "";
  const availability  = document.querySelector("#availability-select .pill.selected")?.dataset.value || "";
  const bio           = document.getElementById("reg-bio").value.trim();
  const instagram     = document.getElementById("reg-instagram").value.trim();
  const linkedin      = document.getElementById("reg-linkedin").value.trim();
  const facebook      = document.getElementById("reg-facebook").value.trim();
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
      body: JSON.stringify({ firstName, avatar: selectedAvatar.dataset.key, subjects, studyStyle, availability, university, bio, contact: { instagram, linkedin, facebook, discord } }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Registration failed");

    STATE.userId  = data.userId;
    STATE.myAvatar = selectedAvatar.dataset.key;


    document.getElementById("display-recovery-code").textContent = data.recoveryCode;
    showModal("modal-save-id");
    btn.disabled = false;
    btn.innerHTML = "<span>Initialise &amp; Enter the Network →</span>";
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
    const res  = await fetch(`/.netlify/functions/get-profiles`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load students.");
    STATE.profiles = data.profiles || [];
    STATE.filtered = [...STATE.profiles];
  } catch (e) {
    loading.classList.add("hidden");
    empty.classList.remove("hidden");
    empty.textContent = "Could not load students. Please check your connection and try again.";
    return;
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
  if (c.instagram || c.linkedin || c.facebook || c.discord) {
    let html = "";
    if (c.instagram) html += `<div class="profile-contact-item"><span class="pci-label">IG</span><span class="pci-value">@${escHtml(c.instagram)}</span></div>`;
    if (c.linkedin)  html += `<div class="profile-contact-item"><span class="pci-label">LI</span><span class="pci-value">${escHtml(c.linkedin)}</span></div>`;
    if (c.facebook)  html += `<div class="profile-contact-item"><span class="pci-label">FB</span><span class="pci-value">${escHtml(c.facebook)}</span></div>`;
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

// Recovery codes are shown once and never saved in browser storage.
async function copyRecoveryCode(button) {
  try {
    await navigator.clipboard.writeText(document.getElementById("display-recovery-code").textContent);
    button.textContent = "Copied!";
    setTimeout(() => button.textContent = "Copy code", 2000);
  } catch { alert("Please select and copy the recovery code manually."); }
}
function downloadRecoveryCode() {
  const code = document.getElementById("display-recovery-code").textContent;
  const blob = new Blob([`My Study Friends recovery code\n\n${code}\n\nKeep this private. Restore your profile at https://mystudyfriends.netlify.app/\n`], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "my-study-friends-recovery-code.txt";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ================================================
// PROFILE MODAL — CLICK BACKDROP TO CLOSE
// ================================================
function handleProfileModalClick(e) {
  if (e.target === document.getElementById("modal-profile")) {
    hideModal("modal-profile");
  }
}

// ================================================
// BORDER FRAMES — show on all pages except landing
// ================================================
function updateBorderFrames(pageId) {
  const frames = document.getElementById("border-frames");
  if (!frames) return;
  if (pageId === "page-landing") {
    frames.classList.remove("visible");
  } else {
    frames.classList.add("visible");
  }
}

// Patch showPage to also toggle border frames
const _baseShowPage = showPage;
window.showPage = function(pageId) {
  _baseShowPage(pageId);
  updateBorderFrames(pageId);
  if (pageId === "page-edit") loadEditProfile();
};

// ================================================
// EDIT PROFILE — load current data into the form
// ================================================
const editSubjects = [];

function loadEditProfile() {
  if (!STATE.userId) { showPage("page-gallery"); return; }

  fetchOwnProfile().then(profile => {
    if (!profile) return;

    // Populate locked name
    document.getElementById("edit-firstname-display").textContent = profile.firstName || "—";

    // Avatar grid
    initEditAvatarGrid(profile.avatar);

    // University
    document.getElementById("edit-university").value = profile.university || "";

    // Subjects
    editSubjects.length = 0;
    (profile.subjects || []).forEach(s => editSubjects.push(s));
    renderEditSubjectTags();

    // Study style
    const styleGroup = document.getElementById("edit-study-style-select");
    styleGroup.querySelectorAll(".pill").forEach(p => {
      p.classList.toggle("selected", p.dataset.value === profile.studyStyle);
    });

    // Availability
    const availGroup = document.getElementById("edit-availability-select");
    availGroup.querySelectorAll(".pill").forEach(p => {
      p.classList.toggle("selected", p.dataset.value === profile.availability);
    });

    // Bio
    const bio = document.getElementById("edit-bio");
    bio.value = profile.bio || "";
    document.getElementById("edit-bio-chars").textContent = `${bio.value.length}/200`;

    // Contact
    const c = profile.contact || {};
    document.getElementById("edit-instagram").value = c.instagram || "";
    document.getElementById("edit-linkedin").value  = c.linkedin  || "";
    document.getElementById("edit-facebook").value  = c.facebook  || "";
    document.getElementById("edit-discord").value   = c.discord   || "";

    // Wire up bio counter
    bio.oninput = () => {
      document.getElementById("edit-bio-chars").textContent = `${bio.value.length}/200`;
    };

    // Wire up edit subject enter key
    const subjectInput = document.getElementById("edit-subject-input");
    subjectInput.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const val = subjectInput.value.trim();
        if (val && editSubjects.length < 8) {
          editSubjects.push(val);
          subjectInput.value = "";
          renderEditSubjectTags();
        }
      }
    };

    // Wire up pill selects for edit page
    document.querySelectorAll("#edit-study-style-select .pill, #edit-availability-select .pill")
      .forEach(pill => {
        pill.onclick = () => {
          pill.closest(".pill-select").querySelectorAll(".pill").forEach(p => p.classList.remove("selected"));
          pill.classList.add("selected");
        };
      });
  });
}

async function fetchOwnProfile() {
  try {
    const res = await fetch("/.netlify/functions/session");
    if (!res.ok) return null;
    const data = await res.json();
    return data.profile || null;
  } catch {
    return null;
  }
}

function initEditAvatarGrid(selectedKey) {
  const grid = document.getElementById("edit-avatar-grid");
  if (!grid) return;
  grid.innerHTML = "";
  AVATARS.forEach(av => {
    const btn = document.createElement("button");
    btn.className = "avatar-option" + (av.key === selectedKey ? " selected" : "");
    btn.setAttribute("data-key", av.key);
    btn.title = av.label;
    btn.textContent = av.emoji;
    btn.onclick = () => {
      grid.querySelectorAll(".avatar-option").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
    };
    grid.appendChild(btn);
  });
}

function renderEditSubjectTags() {
  const list = document.getElementById("edit-subject-tags");
  list.innerHTML = editSubjects.map((s, i) =>
    `<span class="tag">${escHtml(s)}<button onclick="removeEditSubject(${i})">×</button></span>`
  ).join("");
}
function removeEditSubject(i) { editSubjects.splice(i, 1); renderEditSubjectTags(); }

async function handleEditProfile() {
  if (!STATE.userId) return;

  const selectedAvatar = document.querySelector("#edit-avatar-grid .avatar-option.selected");
  const university     = document.getElementById("edit-university").value.trim();
  const studyStyle     = document.querySelector("#edit-study-style-select .pill.selected")?.dataset.value || "";
  const availability   = document.querySelector("#edit-availability-select .pill.selected")?.dataset.value || "";
  const bio            = document.getElementById("edit-bio").value.trim();
  const instagram      = document.getElementById("edit-instagram").value.trim();
  const linkedin       = document.getElementById("edit-linkedin").value.trim();
  const facebook       = document.getElementById("edit-facebook").value.trim();
  const discord        = document.getElementById("edit-discord").value.trim();

  const errEl     = document.getElementById("edit-error");
  const successEl = document.getElementById("edit-success");
  errEl.classList.add("hidden");
  successEl.classList.add("hidden");

  if (!selectedAvatar) {
    errEl.textContent = "Please choose an avatar.";
    errEl.classList.remove("hidden");
    return;
  }

  const btn = document.getElementById("edit-submit");
  btn.disabled = true;
  btn.innerHTML = "<span>Saving…</span>";

  try {
    const res = await fetch("/.netlify/functions/update-profile", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: STATE.userId,
        avatar:       selectedAvatar.dataset.key,
        subjects:     editSubjects,
        studyStyle,
        availability,
        university,
        bio,
        contact: { instagram, linkedin, facebook, discord },
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Update failed");

    // Update stored avatar
    STATE.myAvatar = selectedAvatar.dataset.key;


    successEl.classList.remove("hidden");
    setTimeout(() => successEl.classList.add("hidden"), 3000);
  } catch (err) {
    errEl.textContent = err.message || "Something went wrong.";
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.innerHTML = "<span>Save Changes →</span>";
  }
}
