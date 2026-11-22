// gem.fm MVP frontend — vanilla JS, talks to the Express API.
const $ = (sel, el = document) => el.querySelector(sel);
const view = $('#view');
const state = { userId: null, me: null, tab: 'discover', liveFilter: 'saved', queue: [] };

try { state.userId = Number(localStorage.getItem('gemfm:user')) || null; } catch {}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initial = (name) => esc((name || '?').trim()[0].toUpperCase());

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    ...opts,
    headers: { 'content-type': 'application/json', 'x-user-id': state.userId || '', ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
  return data;
}

// Spotify share link -> embed URL
function spotifyEmbed(url) {
  const m = /open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|artist|playlist)\/([A-Za-z0-9]+)/.exec(url || '');
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0` : null;
}
function player(url) {
  const src = spotifyEmbed(url);
  return src
    ? `<iframe class="spotify" src="${src}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" title="Spotify player"></iframe>`
    : `<div class="no-audio">No Spotify link yet. <a href="/artists.html">Add one on the Artists page</a>.</div>`;
}

const sqlDate = (s) => new Date(s.replace(' ', 'T') + 'Z');
function when(s) {
  const d = sqlDate(s);
  const days = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 864e5);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (days <= 0) return `Tonight, ${time}`;
  if (days === 1) return `Tomorrow, ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
}
function ago(s) {
  const mins = Math.max(1, Math.round((Date.now() - sqlDate(s)) / 6e4));
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} d ago`;
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2200);
}
function openSheet(html) { $('#sheet-body').innerHTML = html; $('#sheet').hidden = false; }
function closeSheet() { $('#sheet').hidden = true; }
$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet' || e.target.closest('[data-close]')) closeSheet(); });

async function refreshMe() {
  state.me = await api('/me');
  $('#points').textContent = `${state.me.stats.points} pts`;
  const a = $('#me-btn');
  a.style.background = state.me.color;
  a.textContent = initial(state.me.name);
}

// ---------- Login (demo users) ----------
async function pickUser() {
  const users = await api('/users');
  openSheet(`
    <p class="eyebrow">Demo mode</p>
    <h2>Who’s listening?</h2>
    <p class="muted small">Pick a demo account. Each one has its own saves, friends and stamps.</p>
    <div class="stamps">${users.map((u) => `
      <button class="btn person" data-user="${u.id}">
        <span class="row"><span class="avatar" style="background:${u.color}">${initial(u.name)}</span>${esc(u.name)}</span>
        <span class="muted small">@${esc(u.handle)}</span>
      </button>`).join('')}
    </div>`);
  $('#sheet-body').onclick = async (e) => {
    const b = e.target.closest('[data-user]');
    if (!b) return;
    state.userId = Number(b.dataset.user);
    try { localStorage.setItem('gemfm:user', state.userId); } catch {}
    state.queue = [];
    closeSheet();
    await refreshMe();
    show(state.tab);
  };
}

// ---------- Discover ----------
async function renderDiscover() {
  if (!state.queue.length) {
    const d = await api('/discover');
    state.queue = d.artists;
  }
  const { today, goal } = state.me;
  const done = today >= goal;
  const a = state.queue[0];
  view.innerHTML = `
    <div class="progress">
      <div class="row between">
        <span class="eyebrow">${done ? 'Bonus round' : 'Daily challenge'}</span>
        <span class="small muted">${Math.min(today, goal)} / ${goal} artists</span>
      </div>
      <div class="bar"><div style="width:${Math.min(100, (today / goal) * 100)}%"></div></div>
    </div>
    ${a ? `
    <article class="card" id="card">
      <div class="card-art" style="background:linear-gradient(150deg, ${a.color}, #120E1A 140%)">
        <span class="card-initial" aria-hidden="true">${initial(a.name)}</span>
        <span class="stamp-label save" id="lbl-save">SAVE</span>
        <span class="stamp-label skip" id="lbl-skip">SKIP</span>
        <span class="chip">${esc(a.genre)} · ${esc(a.city)}</span>
        <h3>${esc(a.name)}</h3>
      </div>
      <div class="card-body">
        <p class="muted" style="margin:0">${esc(a.bio)}</p>
        <div class="row" style="flex-wrap:wrap">
          <span class="chip">${a.saves} ${a.saves === 1 ? 'fan' : 'fans'} so far</span>
          ${a.next_gig ? `<span class="chip hot">Live ${esc(when(a.next_gig))}</span>` : ''}
        </div>
        ${player(a.spotify_url)}
      </div>
    </article>
    <div class="actions">
      <button class="btn" id="skip">Skip</button>
      <button class="btn primary" id="save">Save</button>
    </div>
    <p class="small muted" style="text-align:center;margin:0">Drag the card or use the buttons.</p>`
    : `<div class="panel empty"><h2>You’ve heard everyone</h2><p>New artists join every week. Check the Live tab for shows from the ones you saved.</p></div>`}
  `;
  if (!a) return;
  $('#skip').onclick = () => swipe(false);
  $('#save').onclick = () => swipe(true);
  enableDrag($('#card'), $('.card-art'));
}

function enableDrag(card, handle) {
  let startX = 0, dx = 0, active = false;
  handle.addEventListener('pointerdown', (e) => {
    active = true; startX = e.clientX; dx = 0;
    card.classList.add('dragging');
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', (e) => {
    if (!active) return;
    dx = e.clientX - startX;
    card.style.transform = `translateX(${dx}px) rotate(${dx / 20}deg)`;
    $('#lbl-save').style.opacity = Math.max(0, Math.min(1, dx / 100));
    $('#lbl-skip').style.opacity = Math.max(0, Math.min(1, -dx / 100));
  });
  const end = () => {
    if (!active) return;
    active = false;
    card.classList.remove('dragging');
    if (Math.abs(dx) > 100) swipe(dx > 0);
    else { card.style.transform = ''; $('#lbl-save').style.opacity = 0; $('#lbl-skip').style.opacity = 0; }
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

let swiping = false;
async function swipe(liked) {
  if (swiping) return;
  swiping = true;
  const a = state.queue[0];
  const card = $('#card');
  if (card) { card.style.transform = `translateX(${liked ? 480 : -480}px) rotate(${liked ? 20 : -20}deg)`; card.style.opacity = 0; }
  try {
    const r = await api('/swipes', { method: 'POST', body: { artistId: a.id, liked } });
    state.queue.shift();
    await refreshMe();
    if (r.completed) toast('Daily challenge done! +10 pts');
    else toast(liked ? `Saved ${a.name} · +3 pts` : 'Skipped · +1 pt');
    setTimeout(() => { swiping = false; renderDiscover(); }, 220);
  } catch (err) { swiping = false; toast(err.message); renderDiscover(); }
}

// ---------- Live ----------
async function renderLive() {
  const gigs = await api('/gigs' + (state.liveFilter === 'saved' ? '?saved=1' : ''));
  view.innerHTML = `
    <div><p class="eyebrow">Guadalajara</p><h2>Gigs near you</h2></div>
    <div class="seg" role="tablist">
      <button data-f="saved" class="${state.liveFilter === 'saved' ? 'on' : ''}">From my saves</button>
      <button data-f="all" class="${state.liveFilter === 'all' ? 'on' : ''}">All gigs</button>
    </div>
    ${gigs.length ? gigs.map((g) => {
      const d = sqlDate(g.starts_at);
      return `
      <article class="panel gig">
        <div class="date" style="background:${g.color};color:#F6F1FA">
          <b>${d.getDate()}</b><span>${d.toLocaleDateString([], { month: 'short' })}</span>
        </div>
        <div class="gig-info">
          <h3>${esc(g.artist)}</h3>
          <span class="small muted">${esc(g.venue)} · ${esc(g.area)}</span>
          <span class="small">${esc(when(g.starts_at))} · ${g.price_mxn ? `$${g.price_mxn} MXN` : 'Free entry'}</span>
          <div class="row" style="flex-wrap:wrap">
            ${g.saved ? '<span class="chip hot">You saved them</span>' : `<span class="chip">${esc(g.genre)}</span>`}
            ${g.friends_there ? `<span class="chip">${esc(g.friends_there)} checked in</span>` : ''}
          </div>
          <div class="row" style="margin-top:4px">
            ${g.checked_in
              ? '<button class="btn small" disabled>Stamp collected</button>'
              : `<button class="btn small primary" data-checkin="${g.id}" data-artist="${esc(g.artist)}">Check in</button>`}
            <span class="small muted">${g.attendees} ${g.attendees === 1 ? 'fan' : 'fans'} there</span>
          </div>
        </div>
      </article>`;
    }).join('') : `<div class="panel empty">${state.liveFilter === 'saved'
      ? 'None of your saved artists have upcoming gigs. Save more in Discover or see all gigs.'
      : 'No upcoming gigs yet.'}</div>`}
    <p class="small muted" style="text-align:center;margin:0">Demo: check-in works anytime. The real app would confirm you’re at the venue.</p>`;
  view.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { state.liveFilter = b.dataset.f; renderLive(); }));
  view.querySelectorAll('[data-checkin]').forEach((b) => (b.onclick = async () => {
    try {
      const r = await api(`/gigs/${b.dataset.checkin}/checkin`, { method: 'POST' });
      await refreshMe();
      openSheet(`
        <div class="big-stamp"><span class="eyebrow">Early fan</span><b>#${r.fanNumber}</b><span>${b.dataset.artist}</span></div>
        <p style="text-align:center;margin:0">You were here before they got big. +25 pts</p>
        <button class="btn primary" data-close>Nice</button>`);
      renderLive();
    } catch (err) { toast(err.message); }
  }));
}

// ---------- Friends ----------
const feedLine = (f) => ({
  rec: `recommends <b>${esc(f.artist)}</b>`,
  save: `saved <b>${esc(f.artist)}</b>`,
  checkin: `got an early-fan stamp for <b>${esc(f.artist)}</b> at ${esc(f.venue)}`,
}[f.type]);

async function renderFriends() {
  const [feed, profile] = await Promise.all([api('/feed'), api('/users/' + state.userId)]);
  view.innerHTML = `
    <div class="row between"><h2>Friends</h2><button class="btn small" id="find">Add friends</button></div>
    <form class="panel" id="rec-form" style="display:flex;flex-direction:column;gap:10px">
      <span class="eyebrow">Share a recommendation</span>
      ${profile.saved.length ? `
        <select id="rec-artist" aria-label="Artist">${profile.saved.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select>
        <input id="rec-note" maxlength="200" placeholder="Why should your friends listen?" aria-label="Note">
        <button class="btn primary">Share</button>`
      : '<p class="muted small" style="margin:0">Save an artist in Discover to recommend them here.</p>'}
    </form>
    ${feed.length ? feed.map((f) => `
      <article class="panel feed-item">
        <span class="avatar" style="background:${f.user_color}">${initial(f.user)}</span>
        <div class="feed-text">
          <span><button class="linkish" data-profile="${f.user_id}">${f.user_id === state.userId ? 'You' : esc(f.user)}</button> ${feedLine(f)}</span>
          ${f.note ? `<span class="note">“${esc(f.note)}”</span>` : ''}
          ${f.type === 'rec' ? player(f.spotify_url) : ''}
          <span class="small muted">${ago(f.at)}</span>
        </div>
      </article>`).join('')
    : '<div class="panel empty">Your feed is empty. Add friends to see what they’re discovering.</div>'}`;
  $('#find').onclick = findPeople;
  view.querySelectorAll('[data-profile]').forEach((b) => (b.onclick = () => renderProfile(Number(b.dataset.profile))));
  const form = $('#rec-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!$('#rec-artist')) return;
    try {
      await api('/recommendations', { method: 'POST', body: { artistId: Number($('#rec-artist').value), note: $('#rec-note').value } });
      await refreshMe();
      toast('Shared with your friends · +5 pts');
      renderFriends();
    } catch (err) { toast(err.message); }
  };
}

async function findPeople() {
  const draw = async (q = '') => {
    const people = await api('/people?q=' + encodeURIComponent(q));
    $('#people').innerHTML = people.map((p) => `
      <div class="person">
        <span class="row"><span class="avatar" style="background:${p.color}">${initial(p.name)}</span>
          <span>${esc(p.name)}<br><span class="small muted">@${esc(p.handle)}</span></span></span>
        <button class="btn small ${p.following ? '' : 'primary'}" data-follow="${p.id}" data-on="${p.following}">${p.following ? 'Following' : 'Follow'}</button>
      </div>`).join('') || '<p class="muted">No one matches that name.</p>';
  };
  openSheet(`
    <h2>Add friends</h2>
    <input id="people-q" placeholder="Search by name or @handle" aria-label="Search people">
    <div id="people" class="stamps"></div>
    <button class="btn" data-close>Done</button>`);
  await draw();
  $('#people-q').oninput = (e) => draw(e.target.value);
  $('#people').onclick = async (e) => {
    const b = e.target.closest('[data-follow]');
    if (!b) return;
    await api('/follows/' + b.dataset.follow, { method: b.dataset.on === '1' ? 'DELETE' : 'POST' });
    await draw($('#people-q').value);
    if (state.tab === 'friends') renderFriends();
  };
}

// ---------- Profile ----------
async function renderProfile(id = state.userId) {
  const p = await api('/users/' + id);
  const mine = id === state.userId;
  view.innerHTML = `
    <div class="row">
      <span class="avatar" style="background:${p.color};width:64px;height:64px;font-size:26px">${initial(p.name)}</span>
      <div style="flex:1;min-width:0"><h2>${esc(p.name)}</h2><span class="muted">@${esc(p.handle)}</span></div>
      ${mine ? '<button class="btn small" id="switch">Switch user</button>'
        : `<button class="btn small ${p.isFollowing ? '' : 'primary'}" id="follow">${p.isFollowing ? 'Following' : 'Follow'}</button>`}
    </div>
    <div class="panel stats">
      <div><b>${p.stats.points}</b><span class="small muted">points</span></div>
      <div><b>${p.stats.saves}</b><span class="small muted">artists saved</span></div>
      <div><b>${p.stats.checkins}</b><span class="small muted">stamps</span></div>
    </div>
    <section style="display:flex;flex-direction:column;gap:10px">
      <span class="eyebrow">Badges</span>
      <div class="badges">${p.stats.badges.map((b) => `
        <div class="badge ${b.earned ? 'earned' : ''}">
          <b>${esc(b.name)}</b><span class="small muted">${b.earned ? 'Earned' : esc(b.hint)}</span>
        </div>`).join('')}</div>
    </section>
    <section style="display:flex;flex-direction:column;gap:10px">
      <span class="eyebrow">Early-fan stamps</span>
      ${p.stamps.length ? `<div class="stamps">${p.stamps.map((s) => `
        <div class="stamp"><span><b>${esc(s.artist)}</b><br><span class="small muted">${esc(s.venue)} · ${ago(s.created_at)}</span></span>
        <span class="chip hot">Fan #${s.fan_number}</span></div>`).join('')}</div>`
      : '<p class="muted small" style="margin:0">No stamps yet. Check in at a gig in the Live tab.</p>'}
    </section>
    <section style="display:flex;flex-direction:column;gap:10px">
      <span class="eyebrow">Saved artists</span>
      ${p.saved.length ? `<div class="row" style="flex-wrap:wrap">${p.saved.map((a) => `<span class="chip">${esc(a.name)}</span>`).join('')}</div>`
      : '<p class="muted small" style="margin:0">Nothing saved yet.</p>'}
    </section>`;
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  state.tab = 'profile';
  if (mine) $('#switch').onclick = pickUser;
  else $('#follow').onclick = async () => {
    await api('/follows/' + id, { method: p.isFollowing ? 'DELETE' : 'POST' });
    renderProfile(id);
  };
}

// ---------- Routing ----------
const screens = { discover: renderDiscover, live: renderLive, friends: renderFriends, profile: () => renderProfile() };
async function show(tab) {
  state.tab = tab;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  try { await screens[tab](); } catch (err) { view.innerHTML = `<div class="panel empty">${esc(err.message)}</div>`; }
  window.scrollTo(0, 0);
}
document.querySelectorAll('.tab').forEach((t) => (t.onclick = () => show(t.dataset.tab)));
$('#me-btn').onclick = () => state.userId ? show('profile') : pickUser();

(async function boot() {
  if (!state.userId) return pickUser();
  try { await refreshMe(); show('discover'); }
  catch { state.userId = null; pickUser(); }
})();
