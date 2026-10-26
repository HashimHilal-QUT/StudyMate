let networkView = 'graph';
let networkDemo = false;
const networkFrames = new Set();
const NETWORK_DEMO = [
  ['Alex', 'Brisbane', 'Queensland University of Technology', ['Python', 'Data science'], 'Collaborative', 'Weekday evenings'],
  ['Maya', 'Brisbane', 'Queensland University of Technology', ['Python', 'Mathematics'], 'Collaborative', 'Weekday evenings'],
  ['Sam', 'Brisbane', 'University of Queensland', ['Biology', 'Chemistry'], 'Silent focus', 'Weekends'],
  ['Zoe', 'Brisbane', 'University of Queensland', ['Biology', 'Mathematics'], 'Silent focus', 'Weekends'],
  ['Leo', 'Melbourne', 'Monash University', ['Design', 'Psychology'], 'Discussion heavy', 'Weekends'],
  ['Ari', 'Melbourne', 'Monash University', ['Psychology', 'Statistics'], 'Discussion heavy', 'Weekends'],
  ['Noah', 'Melbourne', 'University of Melbourne', ['Design', 'Architecture'], 'Collaborative', 'Weekday afternoons'],
  ['Ivy', 'Sydney', 'University of Sydney', ['Economics', 'Statistics'], 'Exam crammer', 'Late nights'],
  ['Kai', 'Sydney', 'University of Sydney', ['Economics', 'Accounting'], 'Exam crammer', 'Late nights'],
  ['Ruby', 'Sydney', 'University of New South Wales', ['Python', 'Engineering'], 'Collaborative', 'Weekends'],
  ['Finn', 'Perth', 'Curtin University', ['Engineering', 'Mathematics'], 'Silent focus', 'Weekday mornings'],
  ['Ella', 'Perth', 'Curtin University', ['Engineering', 'Physics'], 'Silent focus', 'Weekday mornings'],
].map((row, i) => ({ id: `demo-${i}`, firstName: row[0], city: row[1], university: row[2], subjects: row[3],
  studyStyle: row[4], availability: row[5], avatar: ['avatar_owl', 'avatar_fox', 'avatar_panda', 'avatar_cat'][i % 4],
  bio: 'Fictional demo profile — explore the map to find shared study interests.', contact: {} }));

function stopNetworkAnimation() {
  networkFrames.forEach(cancelAnimationFrame);
  networkFrames.clear();
}
function scheduleNetworkFrame(callback) {
  const id = requestAnimationFrame(() => { networkFrames.delete(id); callback(); });
  networkFrames.add(id);
}
function setNetworkView(view) {
  networkView = view === 'cards' ? 'cards' : 'graph';
  renderGallery();
}
function toggleNetworkDemo() {
  networkDemo = !networkDemo;
  filterGallery();
}
function signalText(signal) {
  const prefix = signal.type === 'subject' ? 'studying' : signal.type === 'style' ? 'prefer' : 'available';
  return `${signal.count} ${prefix} ${signal.label}`;
}
function renderNetwork(profiles) {
  stopNetworkAnimation();
  const host = document.getElementById('network-groups');
  host.replaceChildren();
  const dimension = document.getElementById('cluster-by').value;
  const groups = StudyNetwork.clusters(profiles, dimension);
  document.getElementById('view-graph').setAttribute('aria-pressed', networkView === 'graph');
  document.getElementById('view-cards').setAttribute('aria-pressed', networkView === 'cards');
  document.getElementById('demo-toggle').setAttribute('aria-pressed', networkDemo);
  document.getElementById('demo-toggle').textContent = networkDemo ? 'Back to real students' : 'Try a demo network';
  document.getElementById('network-demo-notice').classList.toggle('hidden', !networkDemo);
  document.getElementById('gallery-empty').classList.toggle('hidden', profiles.length > 0);
  document.getElementById('gallery-count').textContent = `${profiles.length} ${networkDemo ? 'demo ' : ''}student${profiles.length === 1 ? '' : 's'}`;
  document.getElementById('network-summary').textContent = profiles.length
    ? `${groups.length} ${dimension === 'city' ? 'city' : 'university'} group${groups.length === 1 ? '' : 's'} · ${networkView === 'graph' ? 'Cyan links show groups. Violet links show shared subjects.' : 'Explore a group and open any student profile.'}`
    : 'Your network starts here. Invite a friend, or try the demo to explore connections.';
  // Keep the interactive map bounded; the cards view always includes every matching student.
  let remaining = 60;
  for (const group of groups) {
    if (networkView === 'graph' && remaining <= 0) break;
    const section = document.createElement('section');
    section.className = 'network-cluster';
    const heading = document.createElement('div');
    heading.className = 'cluster-heading';
    const title = document.createElement('h3');
    title.textContent = group.label;
    const size = document.createElement('span');
    size.textContent = `${group.profiles.length} student${group.profiles.length === 1 ? '' : 's'}`;
    heading.append(title, size);
    section.appendChild(heading);
    const insights = document.createElement('div');
    insights.className = 'cluster-insights';
    insights.setAttribute('aria-label', `Shared interests in ${group.label}`);
    if (!group.signals.length) {
      const note = document.createElement('span');
      note.className = 'cluster-note';
      note.textContent = 'A new connection waiting to happen. Shared interests appear when profiles overlap.';
      insights.appendChild(note);
    }
    const cards = [];
    group.signals.slice(0, 4).forEach(signal => {
      const chip = document.createElement('button');
      chip.className = 'insight-chip';
      chip.textContent = `✦ ${signalText(signal)}`;
      chip.setAttribute('aria-pressed', 'false');
      chip.onclick = () => {
        const active = chip.getAttribute('aria-pressed') !== 'true';
        insights.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', 'false'));
        chip.setAttribute('aria-pressed', active);
        cards.forEach(({ element, profile }) => {
          const values = signal.type === 'subject' ? profile.subjects || [] : [signal.type === 'style' ? profile.studyStyle : profile.availability];
          const matches = values.some(v => StudyNetwork.normalize(v) === StudyNetwork.normalize(signal.label));
          element.classList.toggle('signal-match', active && matches);
          element.classList.toggle('signal-muted', active && !matches);
        });
      };
      insights.appendChild(chip);
    });
    section.appendChild(insights);
    host.appendChild(section);
    if (networkView === 'cards') {
      const grid = document.createElement('div');
      grid.className = 'gallery-grid cluster-cards';
      group.profiles.forEach(profile => {
        const element = buildBadge(profile);
        cards.push({ element, profile });
        grid.appendChild(element);
      });
      section.appendChild(grid);
    } else {
      const visible = group.profiles.slice(0, Math.min(12, remaining));
      remaining -= visible.length;
      buildClusterGraph(section, group, visible, cards);
      if (visible.length < group.profiles.length) {
        const more = document.createElement('button');
        more.className = 'network-more';
        more.textContent = `View all ${group.profiles.length} students in cards →`;
        more.onclick = () => setNetworkView('cards');
        section.appendChild(more);
      }
    }
  }
  if (networkView === 'graph' && profiles.length > 60) {
    const more = document.createElement('button');
    more.className = 'network-more';
    more.textContent = 'Map preview shows up to 60 students, 12 per group. Open cards to see everyone →';
    more.onclick = () => setNetworkView('cards');
    host.appendChild(more);
  }
}
function buildClusterGraph(section, group, profiles, cards) {
  const scroll = document.createElement('div');
  scroll.className = 'graph-scroll';
  scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', `${group.label} connection map. Scroll horizontally on smaller screens. Tab to a student and press Enter to open their profile.`);
  const stage = document.createElement('div');
  stage.className = 'graph-stage';
  scroll.appendChild(stage);
  section.appendChild(scroll);
  const compact = scroll.clientWidth < 640;
  const width = Math.max(280, scroll.clientWidth);
  const height = compact ? 210 + Math.ceil(profiles.length / 2) * 130 : profiles.length > 8 ? 680 : 540;
  const edge = compact ? 68 : 84;
  if (compact) stage.classList.add('compact');
  stage.style.width = `${width}px`;
  stage.style.height = `${height}px`;
  const cx = width / 2, cy = compact ? 78 : height / 2;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('aria-hidden', 'true');
  stage.appendChild(svg);
  const hub = document.createElement('div');
  hub.className = 'graph-hub';
  const hubIcon = document.createElement('span');
  hubIcon.className = 'hub-icon';
  hubIcon.textContent = document.getElementById('cluster-by').value === 'city' ? '⌖' : '⌂';
  const hubTitle = document.createElement('strong');
  hubTitle.textContent = group.label;
  const hubCount = document.createElement('small');
  hubCount.textContent = `${group.profiles.length} study friends`;
  hub.append(hubIcon, hubTitle, hubCount);
  hub.style.left = `${cx}px`;
  hub.style.top = `${cy}px`;
  stage.appendChild(hub);
  const nodes = profiles.map((profile, i) => {
    const angle = i * Math.PI * 2 / profiles.length - Math.PI / 2;
    const tx = compact ? (i % 2 + 0.5) * width / 2 : cx + Math.cos(angle) * (width / 2 - 108);
    const ty = compact ? 220 + Math.floor(i / 2) * 130 : cy + Math.sin(angle) * (height / 2 - 66);
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'graph-student';
    element.setAttribute('aria-label', `View ${profile.firstName}'s profile`);
    const avatar = document.createElement('span'); avatar.className = 'graph-avatar'; renderAvatar(avatar, profile);
    const name = document.createElement('strong'); name.textContent = profile.firstName;
    const subject = document.createElement('small'); subject.textContent = (profile.subjects || []).slice(0, 2).join(' · ') || 'Say hello';
    element.append(avatar, name, subject);
    element.title = `${profile.firstName} · ${profile.university || profile.city || 'Study friend'}`;
    stage.appendChild(element);
    cards.push({ element, profile });
    return { profile, element, tx, ty, x: cx + (tx - cx) * 0.6, y: cy + (ty - cy) * 0.6, vx: 0, vy: 0, dragging: false, moved: false };
  });
  const links = [];
  function line(a, b, shared) {
    const element = document.createElementNS(svg.namespaceURI, 'line');
    element.setAttribute('class', shared ? 'graph-link shared' : 'graph-link');
    svg.appendChild(element);
    links.push({ a, b, element });
  }
  nodes.forEach(node => line({ x: cx, y: cy }, node, false));
  nodes.forEach((a, i) => nodes.slice(i + 1).forEach(b => {
    if (StudyNetwork.commonSubjects(a.profile, b.profile).length) line(a, b, true);
  }));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let running = false, frames = 0;
  function draw() {
    nodes.forEach(n => { n.element.style.left = `${n.x}px`; n.element.style.top = `${n.y}px`; });
    links.forEach(({ a, b, element }) => {
      element.setAttribute('x1', a.x); element.setAttribute('y1', a.y);
      element.setAttribute('x2', b.x); element.setAttribute('y2', b.y);
    });
  }
  function tick() {
    if (!stage.isConnected || !document.getElementById('page-gallery').classList.contains('active')) { running = false; return; }
    nodes.forEach(n => {
      if (n.dragging) return;
      n.vx = (n.vx + (n.tx - n.x) * 0.045) * 0.72;
      n.vy = (n.vy + (n.ty - n.y) * 0.045) * 0.72;
      n.x += n.vx; n.y += n.vy;
    });
    // Separate overlapping rectangles as the spring simulation settles.
    nodes.forEach((a, i) => nodes.slice(i + 1).forEach(b => {
      const dx = b.x - a.x, dy = b.y - a.y;
      const gap = compact ? 136 : 170;
      if (Math.abs(dx) < gap && Math.abs(dy) < 118) {
        if (Math.abs(dx) / gap > Math.abs(dy) / 118) {
          const push = (gap - Math.abs(dx)) * 0.15 * (dx < 0 ? -1 : 1);
          if (!a.dragging) a.x -= push;
          if (!b.dragging) b.x += push;
        } else {
          const push = (118 - Math.abs(dy)) * 0.15 * (dy < 0 ? -1 : 1);
          if (!a.dragging) a.y -= push;
          if (!b.dragging) b.y += push;
        }
      }
    }));
    nodes.forEach(n => { n.x = Math.max(edge, Math.min(width - edge, n.x)); n.y = Math.max(58, Math.min(height - 58, n.y)); });
    draw();
    if (++frames < 160 || nodes.some(n => n.dragging)) scheduleNetworkFrame(tick);
    else running = false;
  }
  function animate() {
    frames = 0;
    if (reducedMotion) { nodes.forEach(n => { n.x = n.tx; n.y = n.ty; }); draw(); return; }
    if (!running) { running = true; scheduleNetworkFrame(tick); }
  }
  nodes.forEach(n => {
    let startX, startY;
    n.element.onclick = () => { if (!n.moved) openProfile(n.profile); };
    n.element.onkeydown = () => { n.moved = false; };
    n.element.onpointerdown = e => {
      if (e.button !== 0) return;
      n.dragging = true; n.moved = false;
      startX = e.clientX; startY = e.clientY;
      n.element.setPointerCapture(e.pointerId);
      n.element.classList.add('dragging');
    };
    n.element.onpointermove = e => {
      if (!n.dragging) return;
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > 5) n.moved = true;
      if (!n.moved) return;
      const bounds = stage.getBoundingClientRect();
      n.x = n.tx = Math.max(edge, Math.min(width - edge, e.clientX - bounds.left));
      n.y = n.ty = Math.max(58, Math.min(height - 58, e.clientY - bounds.top));
      draw();
      animate();
    };
    const release = () => { n.dragging = false; n.element.classList.remove('dragging'); };
    n.element.onpointerup = release;
    n.element.onpointercancel = () => { release(); n.moved = true; };
    n.element.onlostpointercapture = release;
  });
  animate();
}
let networkResize;
window.addEventListener('resize', () => {
  clearTimeout(networkResize);
  networkResize = setTimeout(() => {
    if (document.getElementById('page-gallery').classList.contains('active') && networkView === 'graph') renderGallery();
  }, 200);
});
