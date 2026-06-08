/* ============================================================
   StudyMate — App Logic
   ============================================================ */

// ========================
// STATE
// ========================
const STATE = {
  userId: localStorage.getItem("sm_userId") || null,
  myAvatar: localStorage.getItem("sm_avatar") || null,
  profiles: [],        // queue of profiles to swipe
  currentIndex: 0,
  matchCount: 0,
  isDragging: false,
  startX: 0,
  startY: 0,
  currentX: 0,
};

// ========================
// PAGE NAVIGATION
// ========================
function showPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const page = document.getElementById(pageId);
  if (page) page.classList.add("active");

  if (pageId === "page-swipe") loadProfiles();
  if (pageId === "page-matches") loadMatches();
}

function showLoginPrompt() {
  document.getElementById("modal-login").classList.remove("hidden");
}

function showModal(id) {
  document.getElementById(id).classList.remove("hidden");
}

function hideModal(id) {
  document.getElementById(id).classList.add("hidden");
}

// ========================
// LOGIN
// ========================
async function handleLogin() {
  const input = document.getElementById("login-id").value.trim();
  if (!input) return;

  // Validate that this userId exists by trying to fetch profiles for it
  try {
    const res = await fetch(`/.netlify/functions/get-profiles?userId=${encodeURIComponent(input)}`);
    if (res.ok) {
      STATE.userId = input;
      localStorage.setItem("sm_userId", input);
      hideModal("modal-login");
      showPage("page-swipe");
    } else {
      alert("Student ID not found. Please check and try again.");
    }
  } catch (e) {
    alert("Could not connect. Please try again.");
  }
}

// ========================
// REGISTRATION
// ========================
// Build avatar grid
function initAvatarGrid() {
  const grid = document.getElementById("avatar-grid");
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

// Subjects tag input
const subjects = [];
document.addEventListener("DOMContentLoaded", () => {
  initAvatarGrid();
  initPillSelects();
  initBioCounter();
  initSubjectTags();

  // Auto-login if userId saved
  if (STATE.userId) {
    showPage("page-swipe");
  }
});

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
    `<span class="tag">${s}<button onclick="removeSubject(${i})">×</button></span>`
  ).join("");
}

function removeSubject(i) {
  subjects.splice(i, 1);
  renderSubjectTags();
}

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
  const bio = document.getElementById("reg-bio");
  const hint = document.getElementById("bio-chars");
  if (!bio) return;
  bio.addEventListener("input", () => {
    hint.textContent = `${bio.value.length}/200`;
  });
}

async function handleRegister() {
  const firstName = document.getElementById("reg-firstname").value.trim();
  const selectedAvatar = document.querySelector(".avatar-option.selected");
  const university = document.getElementById("reg-university").value.trim();
  const studyStyle = document.querySelector("#study-style-select .pill.selected")?.dataset.value || "";
  const availability = document.querySelector("#availability-select .pill.selected")?.dataset.value || "";
  const bio = document.getElementById("reg-bio").value.trim();
  const instagram = document.getElementById("reg-instagram").value.trim();
  const linkedin = document.getElementById("reg-linkedin").value.trim();
  const discord = document.getElementById("reg-discord").value.trim();

  const errEl = document.getElementById("reg-error");
  errEl.classList.add("hidden");

  if (!firstName) { showError("Please enter your first name."); return; }
  if (!selectedAvatar) { showError("Please choose an avatar."); return; }

  const submitBtn = document.getElementById("reg-submit");
  submitBtn.disabled = true;
  submitBtn.innerHTML = "<span>Creating profile…</span>";

  const payload = {
    firstName,
    avatar: selectedAvatar.dataset.key,
    subjects,
    studyStyle,
    availability,
    university,
    bio,
    contact: { instagram, linkedin, discord },
  };

  try {
    const res = await fetch("/.netlify/functions/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Registration failed");

    STATE.userId = data.userId;
    STATE.myAvatar = selectedAvatar.dataset.key;
    localStorage.setItem("sm_userId", data.userId);
    localStorage.setItem("sm_avatar", selectedAvatar.dataset.key);

    // Show ID save modal
    document.getElementById("display-user-id").textContent = data.userId;
    showModal("modal-save-id");

  } catch (err) {
    showError(err.message || "Something went wrong. Please try again.");
    submitBtn.disabled = false;
    submitBtn.innerHTML = "<span>Create profile & start swiping →</span>";
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
    btn.textContent = "✅ Copied!";
    setTimeout(() => btn.textContent = "📋 Copy ID", 2000);
  });
}

function startSwiping() {
  showPage("page-swipe");
}

// ========================
// SWIPE LOGIC
// ========================
async function loadProfiles() {
  if (!STATE.userId) return;

  const stack = document.getElementById("card-stack");
  const loading = document.getElementById("swipe-loading");
  const empty = document.getElementById("empty-state");
  const actions = document.getElementById("swipe-actions");

  stack.innerHTML = "";
  loading.classList.remove("hidden");
  empty.classList.add("hidden");
  actions.style.opacity = "0.4";
  actions.style.pointerEvents = "none";

  try {
    const res = await fetch(`/.netlify/functions/get-profiles?userId=${encodeURIComponent(STATE.userId)}`);
    const data = await res.json();
    STATE.profiles = data.profiles || [];
    STATE.currentIndex = 0;
  } catch (e) {
    STATE.profiles = [];
  }

  loading.classList.add("hidden");

  if (STATE.profiles.length === 0) {
    empty.classList.remove("hidden");
    return;
  }

  actions.style.opacity = "1";
  actions.style.pointerEvents = "all";

  // Render top 3 cards
  const toRender = STATE.profiles.slice(0, Math.min(3, STATE.profiles.length));
  toRender.reverse().forEach((profile, i) => {
    const card = buildCard(profile);
    stack.appendChild(card);
  });

  // Attach drag to top card
  attachDrag(stack.lastElementChild, STATE.profiles[0]);
}

function buildCard(profile) {
  const card = document.createElement("div");
  card.className = "swipe-card";
  card.dataset.id = profile.id;

  const subjectTags = (profile.subjects || []).slice(0, 4)
    .map(s => `<span class="card-tag">${s}</span>`).join("");
  const styleTags = profile.studyStyle
    ? `<span class="card-tag style">${profile.studyStyle}</span>` : "";
  const availTag = profile.availability
    ? `<span class="card-tag avail">${profile.availability}</span>` : "";

  card.innerHTML = `
    <div class="swipe-indicator like">❤️ YES</div>
    <div class="swipe-indicator nope">NOPE</div>
    <div class="card-image-area">
      <div class="card-avatar">${getAvatarEmoji(profile.avatar)}</div>
      <div class="card-gradient-overlay"></div>
    </div>
    <div class="card-info">
      <div class="card-name">${escHtml(profile.firstName)}</div>
      <div class="card-university">${escHtml(profile.university || "")}</div>
      <div class="card-tags">
        ${subjectTags}${styleTags}${availTag}
      </div>
      ${profile.bio ? `<div class="card-bio">${escHtml(profile.bio)}</div>` : ""}
    </div>
  `;

  return card;
}

function attachDrag(card, profile) {
  if (!card) return;
  card.classList.add("is-top");

  let startX, startY, isDragging = false;

  function onStart(e) {
    isDragging = true;
    const point = e.touches ? e.touches[0] : e;
    startX = point.clientX;
    startY = point.clientY;
    card.style.transition = "none";
  }

  function onMove(e) {
    if (!isDragging) return;
    const point = e.touches ? e.touches[0] : e;
    const dx = point.clientX - startX;
    const dy = point.clientY - startY;
    const rotate = dx * 0.08;

    card.style.transform = `translateX(${dx}px) translateY(${dy * 0.3}px) rotate(${rotate}deg)`;

    if (dx > 30) {
      card.classList.add("dragging-right");
      card.classList.remove("dragging-left");
    } else if (dx < -30) {
      card.classList.add("dragging-left");
      card.classList.remove("dragging-right");
    } else {
      card.classList.remove("dragging-right", "dragging-left");
    }
  }

  function onEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    const point = e.changedTouches ? e.changedTouches[0] : e;
    const dx = point.clientX - startX;

    card.style.transition = "";
    card.classList.remove("dragging-right", "dragging-left");

    if (Math.abs(dx) > 100) {
      const dir = dx > 0 ? "right" : "left";
      executeSwipe(card, profile, dir);
    } else {
      card.style.transform = "";
    }
  }

  card.addEventListener("mousedown", onStart);
  card.addEventListener("touchstart", onStart, { passive: true });
  document.addEventListener("mousemove", onMove);
  document.addEventListener("touchmove", onMove, { passive: true });
  document.addEventListener("mouseup", onEnd);
  document.addEventListener("touchend", onEnd);
}

function swipeCard(direction) {
  const stack = document.getElementById("card-stack");
  const topCard = stack.querySelector(".is-top");
  if (!topCard) return;

  const profile = STATE.profiles[STATE.currentIndex];
  if (!profile) return;

  executeSwipe(topCard, profile, direction);
}

async function executeSwipe(card, profile, direction) {
  // Animate card out
  card.style.transform = "";
  card.classList.add(direction === "right" ? "exit-right" : "exit-left");

  // Record swipe in background
  if (STATE.userId) {
    try {
      const res = await fetch("/.netlify/functions/swipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          swiperId: STATE.userId,
          targetId: profile.id,
          direction,
        }),
      });
      const data = await res.json();

      if (data.isMatch) {
        // Show match modal after short delay
        setTimeout(() => showMatchModal(profile, data.matchContact), 400);
      }
    } catch (e) { /* non-blocking */ }
  }

  STATE.currentIndex++;

  // After animation, remove card and advance stack
  setTimeout(() => {
    card.remove();
    advanceStack();
  }, 450);
}

function advanceStack() {
  const stack = document.getElementById("card-stack");
  const cards = stack.querySelectorAll(".swipe-card");
  const empty = document.getElementById("empty-state");
  const actions = document.getElementById("swipe-actions");

  // No more profiles
  if (STATE.currentIndex >= STATE.profiles.length) {
    if (cards.length === 0) {
      empty.classList.remove("hidden");
      actions.style.opacity = "0.4";
      actions.style.pointerEvents = "none";
    }
    return;
  }

  // Re-stack visuals
  cards.forEach((c, i) => {
    c.classList.remove("is-top");
    if (i === cards.length - 1) {
      c.classList.add("is-top");
      c.style.transform = "";
    }
  });

  // Append a new card from queue if available
  const nextProfileIndex = STATE.currentIndex + 2;
  if (nextProfileIndex < STATE.profiles.length) {
    const newCard = buildCard(STATE.profiles[nextProfileIndex]);
    stack.insertBefore(newCard, stack.firstChild);
  }

  // Attach drag to new top
  const topCard = stack.querySelector(".is-top");
  if (topCard) {
    attachDrag(topCard, STATE.profiles[STATE.currentIndex]);
  }
}

// ========================
// MATCH MODAL
// ========================
function showMatchModal(profile, contact) {
  const myAvatar = STATE.myAvatar || "avatar_owl";

  document.getElementById("match-modal-avatars").innerHTML =
    `<span>${getAvatarEmoji(myAvatar)}</span><span class="connector">◆</span><span>${getAvatarEmoji(profile.avatar)}</span>`;

  document.getElementById("match-modal-name").textContent =
    `You and ${profile.firstName} are study buddies!`;

  // Show contact info
  const contactEl = document.getElementById("match-modal-contact");
  if (contact && Object.values(contact).some(v => v)) {
    let html = "";
    if (contact.instagram) html += `<div class="match-contact-item"><span class="match-contact-label">IG</span><span>@${escHtml(contact.instagram)}</span></div>`;
    if (contact.linkedin) html += `<div class="match-contact-item"><span class="match-contact-label">LI</span><span>${escHtml(contact.linkedin)}</span></div>`;
    if (contact.discord) html += `<div class="match-contact-item"><span class="match-contact-label">DC</span><span>${escHtml(contact.discord)}</span></div>`;
    contactEl.innerHTML = html || "<p style='color:var(--text-dim);font-size:12px;font-family:var(--font-display);letter-spacing:.05em'>NO CONTACT INFO SHARED</p>";
  } else {
    contactEl.innerHTML = "<p style='color:var(--text-dim);font-size:12px;font-family:var(--font-display);letter-spacing:.05em'>NO CONTACT INFO SHARED</p>";
  }

  showModal("modal-match");

  // Update match badge
  STATE.matchCount++;
  updateMatchBadge();
}

function updateMatchBadge() {
  const badge = document.getElementById("match-badge");
  if (STATE.matchCount > 0) {
    badge.textContent = STATE.matchCount;
    badge.classList.remove("hidden");
  }
}

// ========================
// MATCHES PAGE
// ========================
async function loadMatches() {
  if (!STATE.userId) return;

  const grid = document.getElementById("matches-grid");
  const loading = document.getElementById("matches-loading");
  const empty = document.getElementById("matches-empty");

  grid.innerHTML = "";
  loading.classList.remove("hidden");
  empty.classList.add("hidden");

  try {
    const res = await fetch(`/.netlify/functions/get-matches?userId=${encodeURIComponent(STATE.userId)}`);
    const data = await res.json();
    const matches = data.matches || [];

    loading.classList.add("hidden");

    if (matches.length === 0) {
      empty.classList.remove("hidden");
      return;
    }

    matches.forEach(m => {
      grid.appendChild(buildMatchCard(m));
    });

    // Update badge
    STATE.matchCount = matches.length;
    updateMatchBadge();

  } catch (e) {
    loading.classList.add("hidden");
    empty.classList.remove("hidden");
  }
}

function buildMatchCard(match) {
  const p = match.partner;
  const card = document.createElement("div");
  card.className = "match-card";

  let contactHtml = "";
  if (p.contact) {
    if (p.contact.instagram) contactHtml += `<span class="contact-chip">IG @${escHtml(p.contact.instagram)}</span>`;
    if (p.contact.linkedin) contactHtml += `<span class="contact-chip">LI ${escHtml(p.contact.linkedin)}</span>`;
    if (p.contact.discord) contactHtml += `<span class="contact-chip">DC ${escHtml(p.contact.discord)}</span>`;
  }

  card.innerHTML = `
    <div class="match-card-avatar">${getAvatarEmoji(p.avatar)}</div>
    <div class="match-card-name">${escHtml(p.firstName)}</div>
    <div class="match-card-uni">${escHtml(p.university || "")}</div>
    <div class="match-contact-icons">${contactHtml || '<span style="color:var(--text-dim);font-size:10px;font-family:var(--font-display);letter-spacing:.05em">NO CONTACT</span>'}</div>
  `;

  return card;
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
