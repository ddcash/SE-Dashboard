'use strict';
// Constants and APP_CONFIG are defined in config.js (loaded first)

// ═══════════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════════
const S = {
  dir:           null,
  pendingHandle: null,
  data:          JSON.parse(JSON.stringify(DEFAULT_DATA)),
  cfg:           { theme: 'dark', layout: {}, hidden: { bookmarks: [], categories: [] }, cardPositions: {} },
  assetUrls:     {},
  query:         '',
  paletteOpen:   false,
  showHidden:    false,
  activeCat:     null, // active category filter pill
};

let _lastModified = 0; // tracks master_bookmarks.json mtime for external-change detection

// ═══════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════
const uid = () => Math.random().toString(36).slice(2, 10);

function esc(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function sanitizeUrl(url) {
  if (!url) return '';
  const u = String(url).trim();
  try {
    const parsed = new URL(u, 'http://dummy');
    if (['javascript:', 'vbscript:', 'data:'].includes(parsed.protocol)) {
      return 'about:blank';
    }
  } catch (e) {
    if (/^\s*(javascript|vbscript|data):/i.test(u)) {
      return 'about:blank';
    }
  }
  return u;
}

function sanitizeUrl(url) {
  if (!url) return '#';
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('data:')) {
    return 'about:blank';
  }
  return trimmed;
}

function fuzzyMatch(str, q) {
  if (!q) return true;
  str = str.toLowerCase(); q = q.toLowerCase();
  let i = 0;
  for (const ch of q) { i = str.indexOf(ch, i); if (i === -1) return false; i++; }
  return true;
}

// ═══════════════════════════════════════════════════════════════
//  VISIBILITY HELPERS  (stored in local_settings, never touches master file)
// ═══════════════════════════════════════════════════════════════
function isHidden(type, id) {
  return (S.cfg.hidden?.[type] || []).includes(id);
}

function hideItem(type, id) {
  if (!S.cfg.hidden[type].includes(id)) S.cfg.hidden[type].push(id);
  render();
  saveData();
}

function unhideItem(type, id) {
  S.cfg.hidden[type] = S.cfg.hidden[type].filter(x => x !== id);
  render();
  saveData();
}

function toggleShowHidden() {
  S.showHidden = !S.showHidden;
  render();
}

// ═══════════════════════════════════════════════════════════════
//  FREEFORM CANVAS — position, arrange, drag
// ═══════════════════════════════════════════════════════════════

function setActiveCat(id) {
  S.activeCat = (S.activeCat === id) ? null : id; // toggle
  render();
}

function openNewBookmarkModal() {
  const cats = S.data.categories;
  if (!cats.length) { showToast('Create a category first.'); openCategoryModal(null); return; }
  openCardModal(S.activeCat || cats[0].id, null);
}

function resetLayout() {
  S.cfg.cardPositions = {};
  render();
  showToast('Layout reset — cards re-arranged.');
}

// Assign a grid position (in vw units) to every card that has no saved position.
// Called after loadData and after every render (idempotent — only acts on new cards).
function autoArrangeCards() {
  if (!S.cfg.cardPositions) S.cfg.cardPositions = {};
  const vw       = window.innerWidth || 1200;
  const { cardWidth: CARD_W, cardHeight: CARD_H, gap: GAP, padding: PAD } = APP_CONFIG.canvas;
  const cols     = Math.max(1, Math.floor((vw - PAD * 2) / (CARD_W + GAP)));
  const toVw     = px => px / vw * 100;
  let col = 0, row = 0, changed = false;

  for (const cat of S.data.categories) {
    for (const bm of cat.bookmarks) {
      if (!(bm.id in S.cfg.cardPositions)) {
        S.cfg.cardPositions[bm.id] = {
          x: toVw(PAD + col * (CARD_W + GAP)),
          y: toVw(PAD + row * (CARD_H + GAP)),
        };
        col++;
        if (col >= cols) { col = 0; row++; }
        changed = true;
      }
    }
  }
  if (changed) saveData();
}

// Expand canvas so all positioned cards are fully visible.
// ⚡ Bolt: Optimized canvas height recalculation during drag.
// Instead of O(N) array allocation via Object.entries() on every 60fps pointermove,
// we cache the max static Y of all non-dragged items and do an O(1) comparison during drag.
function updateCanvasHeight() {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;
  const vw  = window.innerWidth;
  const minH = window.innerHeight - 120; // header + filter bar
  let maxYPx = minH;

  if (_drag && _drag.maxStaticVw !== undefined) {
    maxYPx = Math.max(_drag.maxStaticVw, (_drag.curY * vw / 100) + 150);
  } else {
    const positions = S.cfg.cardPositions || {};
    for (const id in positions) {
      const y = (_drag && _drag.bmId === id) ? _drag.curY : positions[id].y;
      maxYPx = Math.max(maxYPx, (y * vw / 100) + 150);
    }
    if (_drag) maxYPx = Math.max(maxYPx, (_drag.curY * vw / 100) + 150);
  }
  canvas.style.minHeight = maxYPx + 60 + 'px';
}

// ── Pointer-event drag ───────────────────────────────────────
let _drag = null;

function initFreeDrag() {
  document.querySelectorAll('#canvas .card').forEach(card => {
    // Remove any previous listener to avoid double-binding after re-render
    card.removeEventListener('pointerdown', onDragStart);
    card.addEventListener('pointerdown', onDragStart, { passive: false });
  });
}

function onDragStart(e) {
  if (e.button !== 0) return;
  // Don't drag when interacting with links, buttons, or action overlays
  if (e.target.closest('a, button, .card-actions')) return;
  e.preventDefault();

  const card   = e.currentTarget;
  const vw     = window.innerWidth;
  const startX = parseFloat(card.style.left) || 0; // current position in vw
  const startY = parseFloat(card.style.top)  || 0;
  const bmId   = card.dataset.id;

  // Pre-calculate max static Y of all OTHER cards so updateCanvasHeight is O(1) during 60fps pointermove
  let maxStaticVw = window.innerHeight - 120;
  const positions = S.cfg.cardPositions || {};
  for (const id in positions) {
    if (id !== bmId) maxStaticVw = Math.max(maxStaticVw, (positions[id].y * vw / 100) + 150);
  }

  _drag = {
    bmId,
    el:   card,
    startClientX: e.clientX,
    startClientY: e.clientY,
    startX, startY, vw,
    canvas: document.getElementById('canvas'),
    curX: startX, curY: startY,
    moved: false,
    maxStaticVw, // ⚡ Bolt: Cached O(1) height calculation value
  };

  card.classList.add('card--dragging');
  document.body.style.userSelect = 'none';
}

function getProtocolTag(url) {
  if (!url) return null;
  if (url.startsWith('file://')) return 'local';
  if (/^https?:\/\//.test(url)) return null;
  const m = url.match(/^([a-z][a-z0-9+\-.]+):/i);
  return m ? m[1] : null;
}

// ═══════════════════════════════════════════════════════════════
//  INDEXED DB — persist directory handle across page loads
// ═══════════════════════════════════════════════════════════════
function _idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('bookmark-mgr', 1);
    r.onupgradeneeded = e => e.target.result.createObjectStore('kv');
    r.onsuccess = e => res(e.target.result);
    r.onerror   = () => rej(r.error);
  });
}
async function idbGet(key) {
  const db = await _idbOpen();
  return new Promise((res, rej) => {
    const r = db.transaction('kv').objectStore('kv').get(key);
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej(r.error);
  });
}
async function idbSet(key, val) {
  const db = await _idbOpen();
  return new Promise((res, rej) => {
    const r = db.transaction('kv','readwrite').objectStore('kv').put(val, key);
    r.onsuccess = () => res();
    r.onerror   = () => rej(r.error);
  });
}

// ═══════════════════════════════════════════════════════════════
//  STORAGE MANAGER
// ═══════════════════════════════════════════════════════════════
async function openDirectory() {
  if (!('showDirectoryPicker' in window)) {
    alert('File System Access API is required.\nPlease use Chrome or Edge.');
    return false;
  }
  try {
    S.dir = await window.showDirectoryPicker({ mode: 'readwrite' });
    idbSet('dirHandle', S.dir).catch(() => {}); // persist for next page load
    await loadData();
    return true;
  } catch (e) {
    if (e.name !== 'AbortError') console.error('Directory picker error:', e);
    return false;
  }
}

async function readJSON(name) {
  try {
    const fh = await S.dir.getFileHandle(name);
    return JSON.parse(await (await fh.getFile()).text());
  } catch { return null; }
}

async function writeJSON(name, obj) {
  const fh = await S.dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(JSON.stringify(obj, null, 2));
  await w.close();
}

async function createBackup() {
  if (!APP_CONFIG.backup.enabled) return;
  try {
    const bkDir = await S.dir.getDirectoryHandle(APP_CONFIG.backup.subdir, { create: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fh = await bkDir.getFileHandle(`bookmarks-${ts}.json`, { create: true });
    const w  = await fh.createWritable();
    await w.write(JSON.stringify(S.data, null, 2));
    await w.close();
    await pruneBackups(bkDir);
  } catch (e) { console.warn('Backup skipped:', e.message); }
}

async function pruneBackups(bkDir) {
  try {
    if (!bkDir) bkDir = await S.dir.getDirectoryHandle(APP_CONFIG.backup.subdir, { create: false });
    const names = [];
    for await (const [name, handle] of bkDir.entries()) {
      if (handle.kind === 'file' && name.endsWith('.json')) names.push(name);
    }
    names.sort(); // ISO timestamps compare correctly as strings (oldest first)
    while (names.length > APP_CONFIG.backup.maxCount) {
      await bkDir.removeEntry(names.shift());
    }
  } catch (e) { console.warn('Backup prune skipped:', e.message); }
}

async function saveAsset(file) {
  const assets = await S.dir.getDirectoryHandle('assets', { create: true });
  const name = `${uid()}-${file.name.replace(/[^a-z0-9._-]/gi, '_')}`;
  const fh = await assets.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(file);
  await w.close();
  S.assetUrls[name] = URL.createObjectURL(file);
  return name;
}

async function loadAssets() {
  try {
    const assets = await S.dir.getDirectoryHandle('assets', { create: true });
    for await (const [name, handle] of assets.entries()) {
      if (handle.kind === 'file') {
        S.assetUrls[name] = URL.createObjectURL(await handle.getFile());
      }
    }
  } catch (e) { console.warn('Assets load failed:', e.message); }
}

async function loadData() {
  const bm  = await readJSON('master_bookmarks.json');
  const cfg = await readJSON('local_settings.json');
  if (bm)  S.data = bm;
  else     await writeJSON('master_bookmarks.json', S.data);
  if (cfg) S.cfg  = cfg;
  else     await writeJSON('local_settings.json', S.cfg);
  // Ensure structures exist for older local_settings files
  if (!S.cfg.hidden)             S.cfg.hidden = { bookmarks: [], categories: [] };
  if (!S.cfg.hidden.bookmarks)   S.cfg.hidden.bookmarks  = [];
  if (!S.cfg.hidden.categories)  S.cfg.hidden.categories = [];
  if (!S.cfg.cardPositions)      S.cfg.cardPositions = {};
  await loadAssets();
  // Record mtime so pollChanges() can detect external edits
  try {
    const fh = await S.dir.getFileHandle('master_bookmarks.json');
    _lastModified = (await fh.getFile()).lastModified;
  } catch {}
}

// Poll every 4 s for external edits to master_bookmarks.json
// (e.g. the user edited the file directly in a text editor)
async function pollChanges() {
  if (!S.dir || document.hidden || _lastModified === 0) return;
  try {
    const fh   = await S.dir.getFileHandle('master_bookmarks.json');
    const file = await fh.getFile();
    if (file.lastModified > _lastModified) {
      _lastModified = file.lastModified;
      S.data = JSON.parse(await file.text());
      render();
      showToast('Bookmarks reloaded — external change detected');
    }
  } catch {}
}
setInterval(pollChanges, APP_CONFIG.poll.intervalMs);

async function saveData() {
  if (!S.dir) return;
  await createBackup();
  await writeJSON('master_bookmarks.json', S.data);
  await writeJSON('local_settings.json',   S.cfg);
}

// ═══════════════════════════════════════════════════════════════
//  RENDER ENGINE
// ═══════════════════════════════════════════════════════════════
function renderIcon(icon, size = 16) {
  if (!icon || icon.type === 'lucide') {
    return `<i data-lucide="${esc(icon?.value || 'Link')}" style="width:${size}px;height:${size}px"></i>`;
  }
  // ⚡ Bolt: Added loading="lazy" to all icon <img> tags below.
  // When rendering the freeform canvas, all cards are added to the DOM to calculate layout.
  // Lazy loading prevents massive network contention from fetching hundreds of favicons simultaneously.
  if (icon.type === 'favicon') {
    // Direct /favicon.ico — works for internet sites AND internal/intranet hosts; fails gracefully offline
    const origin = (() => { try { const u = new URL(icon.value || ''); return u.origin; } catch { return ''; } })();
    const fb = `this.parentNode.innerHTML='<i data-lucide=\\'Globe\\' style=\\'width:${size}px;height:${size}px\\'></i>';if(typeof lucide!=='undefined')lucide.createIcons();`;
    return origin
      ? `<img src="${esc(origin)}/favicon.ico" class="card-favicon" loading="lazy" onerror="${fb}">`
      : `<i data-lucide="Globe" style="width:${size}px;height:${size}px"></i>`;
  }
  if (icon.type === 'url') {
    const fb = `this.parentNode.innerHTML='<i data-lucide=\\'Link\\' style=\\'width:${size}px;height:${size}px\\'></i>';if(typeof lucide!=='undefined')lucide.createIcons();`;
    return `<img src="${esc(icon.value)}" class="card-favicon" loading="lazy" onerror="${fb}">`;
  }
  if (icon.type === 'local') {
    const url = S.assetUrls[icon.value];
    if (url) {
      const fb = `this.parentNode.innerHTML='<i data-lucide=\\'Image\\' style=\\'width:${size}px;height:${size}px\\'></i>';if(typeof lucide!=='undefined')lucide.createIcons();`;
      return `<img src="${url}" class="card-favicon" loading="lazy" onerror="${fb}">`;
    }
    return `<i data-lucide="Image" style="width:${size}px;height:${size}px"></i>`;
  }
  return `<i data-lucide="Link" style="width:${size}px;height:${size}px"></i>`;
}

// ⚡ Bolt: Pass cat object directly to avoid O(N) lookup per card during render
function renderCard(bm, cat, dimmed) {
  const catId  = cat.id;
  const hidden = isHidden('bookmarks', bm.id);
  const proto  = getProtocolTag(bm.url);
  const cs     = bm.customStyle || {};
  const pos    = S.cfg.cardPositions?.[bm.id] || { x: 0, y: 0 };

  const inlineStyle = [
    `left:${pos.x}vw`,
    `top:${pos.y}vw`,
    cs.cardColor   ? `background:${esc(cs.cardColor)}`     : '',
    cs.borderColor ? `border-color:${esc(cs.borderColor)}` : '',
  ].filter(Boolean).join(';');

  const cat        = S.data.categories.find(c => c.id === catId);
  const catColor   = esc(cat?.color || '#6366f1');
  const catBadge   = `<span class="card-cat-badge" style="background:${catColor}22;color:${catColor};border-color:${catColor}44">
                        ${renderIcon({ type:'lucide', value: cat?.icon||'Folder' }, 9)} ${esc(cat?.name||'')}
                      </span>`;
  const tags       = (bm.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');
  const protoTag   = proto
    ? `<span class="proto-tag proto-tag--${proto === 'local' ? 'local' : 'app'}">${proto === 'local' ? 'Local File' : proto + '://'}</span>`
    : '';
  const clicks     = bm.clicks
    ? `<span class="click-count"><i data-lucide="MousePointerClick" style="width:10px;height:10px"></i>${bm.clicks}</span>`
    : '';
  const hiddenBadge = hidden
    ? `<span class="hidden-badge"><i data-lucide="EyeOff" style="width:9px;height:9px"></i> hidden</span>`
    : '';
  const hideBtn = hidden
    ? `<button class="btn-icon btn-icon--unhide" title="Unhide" aria-label="Unhide bookmark" onclick="unhideItem('bookmarks','${bm.id}')">
         <i data-lucide="Eye" style="width:12px;height:12px"></i>
       </button>`
    : `<button class="btn-icon btn-icon--hide" title="Hide from view" aria-label="Hide bookmark" onclick="hideItem('bookmarks','${bm.id}')">
         <i data-lucide="EyeOff" style="width:12px;height:12px"></i>
       </button>`;

  const classes = ['card',
    hidden  ? 'card--hidden' : '',
    dimmed  ? 'card--dim'    : '',
  ].filter(Boolean).join(' ');

  return `
    <div class="${classes}" data-id="${bm.id}" data-cat="${catId}" style="${inlineStyle}">
      <div class="card-drag-handle">
        <i data-lucide="GripVertical" style="width:11px;height:11px"></i>
      </div>
      <a href="${esc(sanitizeUrl(bm.url))}" target="_blank" rel="noreferrer" class="card-link"
         onclick="trackClick(event,'${bm.id}','${catId}')">
        <div class="card-icon-wrap">${renderIcon(bm.icon, 20)}</div>
        <div class="card-body">
          <div class="card-title">${esc(bm.title)}</div>
          ${bm.description ? `<div class="card-desc">${esc(bm.description)}</div>` : ''}
          <div class="card-meta">${catBadge}${protoTag}${tags}${hiddenBadge}${clicks}</div>
        </div>
      </a>
      <div class="card-actions" onclick="event.stopPropagation()">
        <button class="btn-icon btn-icon--edit" title="Edit" aria-label="Edit bookmark" onclick="openCardModal('${catId}','${bm.id}')">
          <i data-lucide="Pencil" style="width:12px;height:12px"></i>
        </button>
        ${hideBtn}
      </div>
    </div>`;
}

// Flat list of all visible cards for the canvas layout
function renderAllCards() {
  const searching = !!S.query;
  let html = '';

  // ⚡ Bolt optimization: Use Sets for O(1) hidden status lookups instead of O(n) array scans
  const hiddenCats = new Set(S.cfg.hidden?.categories || []);
  const hiddenBms = new Set(S.cfg.hidden?.bookmarks || []);

  for (const cat of S.data.categories) {
    const catHidden  = hiddenCats.has(cat.id);
    if (!searching && !S.showHidden && catHidden) continue;

    for (const bm of cat.bookmarks) {
      const bmHidden = hiddenBms.has(bm.id);
      if (!searching && !S.showHidden && bmHidden) continue;

      if (searching) {
        const match =
          fuzzyMatch(bm.title,           S.query) ||
          fuzzyMatch(bm.url,             S.query) ||
          fuzzyMatch(bm.description||'', S.query) ||
          (bm.tags||[]).some(t => fuzzyMatch(t, S.query));
        if (!match) continue;
      }

      // Dim card when category filter is active and this card isn't in that category
      const dimmed = !searching && !!S.activeCat && S.activeCat !== cat.id;
      html += renderCard(bm, cat, dimmed);
    }
  }
  return html;
}

function render() {
  if (S.dir) autoArrangeCards(); // fill in positions for any new cards before DOM build
  const app = document.getElementById('app');
  app.innerHTML = S.dir ? renderDashboard() : renderConnect();
  if (typeof lucide !== 'undefined') lucide.createIcons();
  if (S.dir) { initFreeDrag(); updateCanvasHeight(); }
}

function renderConnect() {
  const ok = 'showDirectoryPicker' in window;
  const logo = `<div class="connect-logo"><i data-lucide="Bookmark" style="width:36px;height:36px"></i></div>`;

  if (!ok) return `
    <div class="connect-screen"><div class="connect-card">
      ${logo}<h1>Bookmark Manager</h1>
      <div class="error-box">
        <i data-lucide="AlertTriangle" style="width:16px;height:16px;flex-shrink:0"></i>
        <div>This app requires the <strong>File System Access API</strong>.<br>Please open in <strong>Chrome</strong> or <strong>Edge</strong>.</div>
      </div>
    </div></div>`;

  // Returning from a page reload — one click to restore
  if (S.pendingHandle) return `
    <div class="connect-screen"><div class="connect-card">
      ${logo}<h1>Bookmark Manager</h1>
      <p>Grant access to resume your last session.</p>
      <button class="btn btn--primary btn--lg" onclick="handleResume()">
        <i data-lucide="FolderOpen" style="width:17px;height:17px"></i>
        Resume &ldquo;${esc(S.pendingHandle.name)}&rdquo;
      </button>
      <p style="margin:14px 0 6px;color:var(--text3);font-size:12px">or</p>
      <button class="btn btn--ghost" onclick="handleConnect()">Connect Different Directory</button>
    </div></div>`;

  // First visit
  return `
    <div class="connect-screen"><div class="connect-card">
      ${logo}<h1>Bookmark Manager</h1>
      <p>A local-first bookmark manager. All data stays on your device — no servers, no accounts, no tracking.</p>
      <button class="btn btn--primary btn--lg" onclick="handleConnect()">
        <i data-lucide="FolderOpen" style="width:17px;height:17px"></i>
        Connect Directory
      </button>
      <p class="hint">Select or create a folder to store your bookmarks data.</p>
    </div></div>`;
}

function renderDashboard() {
  const cats        = S.data.categories || [];
  const isEmpty     = cats.length === 0 && !S.query;
  const hiddenBmCount  = (S.cfg.hidden?.bookmarks  || []).length;
  const hiddenCatCount = (S.cfg.hidden?.categories || []).length;
  const hiddenTotal    = hiddenBmCount + hiddenCatCount;

  // ⚡ Bolt optimization: O(1) lookups for hidden status
  const hiddenCats = new Set(S.cfg.hidden?.categories || []);
  const hiddenBms = new Set(S.cfg.hidden?.bookmarks || []);

  const catPills = cats.map(cat => {
    const active   = S.activeCat === cat.id;
    const catHidden = hiddenCats.has(cat.id);
    const visCount = cat.bookmarks.filter(b => !hiddenBms.has(b.id)).length;
    return `
      <button class="cat-pill ${active ? 'cat-pill--active' : ''} ${catHidden ? 'cat-pill--hidden' : ''}"
        style="--pill-color:${esc(cat.color||'#6366f1')}"
        onclick="setActiveCat('${cat.id}')" title="${esc(cat.name)}">
        ${renderIcon({ type:'lucide', value: cat.icon||'Folder' }, 12)}
        <span>${esc(cat.name)}</span>
        <span class="cat-pill-count">${visCount}</span>
      </button>`;
  }).join('');

  return `
    <header class="app-header">
      <div class="header-left">
        <div class="app-logo">
          <i data-lucide="Bookmark" style="width:18px;height:18px"></i>
          <span>Bookmarks</span>
        </div>
        <div class="dir-badge" title="Connected directory">
          <i data-lucide="FolderOpen" style="width:11px;height:11px"></i>
          <span>${esc(S.dir.name)}</span>
        </div>
      </div>
      <div class="header-center">
        <div class="search-wrap">
          <i data-lucide="Search" class="search-icon" style="width:14px;height:14px"></i>
          <input type="text" id="search-input" class="search-input" aria-label="Search bookmarks"
            placeholder="Search… (Ctrl+K for commands)"
            value="${esc(S.query)}"
            oninput="handleSearch(this.value)"
            onkeydown="if(event.key==='Escape')handleSearch('')">
          ${S.query ? `<button class="search-clear" onclick="handleSearch('')" aria-label="Clear search">
            <i data-lucide="X" style="width:12px;height:12px"></i></button>` : ''}
        </div>
      </div>
      <div class="header-right">
        ${hiddenTotal > 0 ? `
        <button class="btn ${S.showHidden ? 'btn--hidden-active' : 'btn--ghost'}" onclick="toggleShowHidden()"
          title="${S.showHidden ? 'Click to hide hidden items again' : `${hiddenTotal} item${hiddenTotal>1?'s':''} hidden — click to reveal`}">
          <i data-lucide="${S.showHidden ? 'Eye' : 'EyeOff'}" style="width:13px;height:13px"></i>
          <span>${S.showHidden ? 'Showing hidden' : hiddenTotal + ' hidden'}</span>
        </button>` : ''}
        <button class="btn btn--ghost" onclick="openImportModal()" title="Import bookmarks">
          <i data-lucide="Upload" style="width:13px;height:13px"></i>
          <span>Import</span>
        </button>
        <button class="btn btn--ghost" onclick="exportData()" title="Export bookmarks">
          <i data-lucide="Download" style="width:13px;height:13px"></i>
          <span>Export</span>
        </button>
        <button class="btn btn--ghost" onclick="resetLayout()" title="Reset card positions">
          <i data-lucide="LayoutGrid" style="width:13px;height:13px"></i>
          <span>Reset Layout</span>
        </button>
        <button class="btn btn--primary" onclick="openCategoryModal(null)">
          <i data-lucide="FolderPlus" style="width:13px;height:13px"></i>
          <span>New Category</span>
        </button>
      </div>
    </header>

    <div class="cat-filter-bar">
      ${catPills}
      <button class="cat-pill-action" onclick="openNewBookmarkModal()" title="Add bookmark">
        <i data-lucide="Plus" style="width:13px;height:13px"></i> Add Bookmark
      </button>
      <button class="cat-pill-action cat-pill-action--cat" onclick="openCategoryModal(null)" title="New category">
        <i data-lucide="FolderPlus" style="width:13px;height:13px"></i> New Category
      </button>
    </div>

    <main class="dashboard">
      ${isEmpty ? `
        <div class="empty-state">
          <i data-lucide="BookMarked" style="width:48px;height:48px"></i>
          <p>No categories yet. Create one to start adding bookmarks.</p>
          <button class="btn btn--primary" onclick="openCategoryModal(null)">
            <i data-lucide="FolderPlus" style="width:13px;height:13px"></i> Create Category
          </button>
        </div>` : ''}
      <div class="canvas" id="canvas">
        ${renderAllCards()}
      </div>
    </main>`;
}

// ═══════════════════════════════════════════════════════════════
//  MODAL ENGINE
// ═══════════════════════════════════════════════════════════════
function openModal(html) {
  const el = document.getElementById('modal-overlay');
  el.innerHTML = `<div class="modal">${html}</div>`;
  el.classList.remove('hidden');
  el.classList.add('visible');
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Browsers sometimes don't trigger autofocus when elements are added via innerHTML.
  const autoFocusEl = el.querySelector('[autofocus]');
  if (autoFocusEl) {
    // A small timeout ensures the element is rendered and can receive focus.
    setTimeout(() => autoFocusEl.focus(), 10);
  }
}

function closeModal() {
  const el = document.getElementById('modal-overlay');
  el.classList.remove('visible');
  setTimeout(() => { el.classList.add('hidden'); el.innerHTML = ''; }, 200);
}

// ═══════════════════════════════════════════════════════════════
//  CARD MODAL
// ═══════════════════════════════════════════════════════════════
function openCardModal(catId, bmId) {
  const cat    = S.data.categories.find(c => c.id === catId);
  const bm     = bmId ? cat?.bookmarks.find(b => b.id === bmId) : null;
  const bmHidden = bm ? isHidden('bookmarks', bmId) : false;
  const iType  = bm?.icon?.type || 'lucide';
  const iVal   = bm?.icon?.value || 'Link';
  const cs     = bm?.customStyle || {};

  const iconGrid = LUCIDE_ICONS.map(n => `
    <button type="button" aria-label="${n} icon" class="icon-option ${iType === 'lucide' && iVal === n ? 'selected' : ''}"
      data-icon="${n}" onclick="pickLucideIcon(this,'${n}')">
      <i data-lucide="${n}" style="width:16px;height:16px"></i>
    </button>`).join('');

  const catOptions = S.data.categories.map(c =>
    `<option value="${c.id}" ${c.id === catId ? 'selected' : ''}>${esc(c.name)}</option>`).join('');

  openModal(`
    <div class="modal-header">
      <h2>${bm ? 'Edit Bookmark' : 'New Bookmark'}</h2>
      <button class="btn-icon" aria-label="Close" onclick="closeModal()"><i data-lucide="X" style="width:15px;height:15px"></i></button>
    </div>
    <div class="modal-body">
      <form id="card-form" onsubmit="submitCard(event,'${catId}','${bmId||''}')">
        <div class="form-row">
          <label for="bm-title">Title *</label>
          <input id="bm-title" type="text" name="title" class="form-input" required
            value="${esc(bm?.title||'')}" placeholder="My Bookmark">
        </div>
        <div class="form-row">
          <label for="bm-url">URL *</label>
          <input id="bm-url" type="text" name="url" class="form-input" required
            value="${esc(bm?.url||'')}" placeholder="https://… or file:/// or vscode://…">
        </div>
        <div class="form-row">
          <label for="bm-desc">Description</label>
          <textarea id="bm-desc" name="description" class="form-input form-textarea"
            placeholder="Optional notes…">${esc(bm?.description||'')}</textarea>
        </div>
        <div class="form-row">
          <label for="bm-tags">Tags <span class="hint-inline">(comma-separated)</span></label>
          <input id="bm-tags" type="text" name="tags" class="form-input"
            value="${esc((bm?.tags||[]).join(', '))}" placeholder="dev, work, tools">
        </div>
        <div class="form-row">
          <label for="bm-category">Category</label>
          <select id="bm-category" name="categoryId" class="form-input">${catOptions}</select>
        </div>

        <div class="form-section">Icon</div>
        <div class="form-row">
          <div class="icon-type-tabs">
            <button type="button" class="icon-tab ${iType==='lucide'?'active':''}" onclick="switchIconTab(this,'lucide')">Lucide</button>
            <button type="button" class="icon-tab ${iType==='favicon'?'active':''}" onclick="switchIconTab(this,'favicon')">Favicon</button>
            <button type="button" class="icon-tab ${iType==='url'?'active':''}" onclick="switchIconTab(this,'url')">Image URL</button>
            <button type="button" class="icon-tab ${iType==='local'?'active':''}" onclick="switchIconTab(this,'local')">Upload</button>
          </div>
          <input type="hidden" name="iconType" value="${iType}">
          <input type="hidden" name="iconValue" value="${esc(iVal)}">

          <div id="icon-panel-lucide" class="icon-panel ${iType!=='lucide'?'hidden':''}">
            <input type="text" aria-label="Search icons" class="form-input" style="margin-bottom:6px" placeholder="Search icons…" oninput="filterIcons(this.value)">
            <div class="icon-grid" id="icon-grid">${iconGrid}</div>
          </div>
          <div id="icon-panel-favicon" class="icon-panel ${iType!=='favicon'?'hidden':''}">
            <p class="hint-text">Fetches <code>/favicon.ico</code> directly from the bookmark's host. Works for any accessible site or internal server. Falls back to a globe icon when the host is unreachable.</p>
          </div>
          <div id="icon-panel-url" class="icon-panel ${iType!=='url'?'hidden':''}">
            <input type="text" id="icon-url-input" class="form-input"
              placeholder="https://example.com/icon.png"
              value="${iType==='url'?esc(iVal):''}"
              oninput="setIconValue(this.value)">
          </div>
          <div id="icon-panel-local" class="icon-panel ${iType!=='local'?'hidden':''}">
            <input type="file" class="form-input" accept="image/*" onchange="handleIconUpload(this)">
            ${iType==='local' && S.assetUrls[iVal]
              ? `<img src="${S.assetUrls[iVal]}" class="icon-preview-img">` : ''}
          </div>
        </div>

        <div class="form-section">Custom Style <span class="hint-inline">(optional)</span></div>
        <div class="form-row form-row--cols">
          <div>
            <label><input type="checkbox" name="useCardColor" ${cs.cardColor?'checked':''}
              onchange="toggleColor(this,'card-color-pick')"> Card Color</label>
            <input type="color" id="card-color-pick" name="cardColor"
              value="${cs.cardColor||'#1e1e2e'}" class="color-input"
              style="display:${cs.cardColor?'':'none'};margin-top:6px">
          </div>
          <div>
            <label><input type="checkbox" name="useBorderColor" ${cs.borderColor?'checked':''}
              onchange="toggleColor(this,'border-color-pick')"> Border Color</label>
            <input type="color" id="border-color-pick" name="borderColor"
              value="${cs.borderColor||'#45475a'}" class="color-input"
              style="display:${cs.borderColor?'':'none'};margin-top:6px">
          </div>
        </div>

        <div class="modal-footer">
          ${bm ? `<button type="button" class="btn ${bmHidden ? 'btn--primary' : 'btn--ghost'}"
            onclick="${bmHidden ? 'unhide' : 'hide'}Item('bookmarks','${bmId}');closeModal()">
            <i data-lucide="${bmHidden ? 'Eye' : 'EyeOff'}" style="width:13px;height:13px"></i>
            ${bmHidden ? 'Unhide' : 'Hide'}</button>` : ''}
          <div class="spacer"></div>
          <button type="button" class="btn btn--ghost" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn--primary">Save</button>
        </div>
      </form>
    </div>`);
}

// ═══════════════════════════════════════════════════════════════
//  CATEGORY MODAL
// ═══════════════════════════════════════════════════════════════
function openCategoryModal(catId) {
  const cat      = catId ? S.data.categories.find(c => c.id === catId) : null;
  const catHidden = cat ? isHidden('categories', catId) : false;
  const cIcon    = cat?.icon  || 'Folder';
  const cColor   = cat?.color || CAT_COLORS[0];

  const iconGrid = LUCIDE_ICONS.map(n => `
    <button type="button" aria-label="${n} icon" class="icon-option ${cIcon===n?'selected':''}"
      data-icon="${n}" onclick="pickLucideIcon(this,'${n}')">
      <i data-lucide="${n}" style="width:16px;height:16px"></i>
    </button>`).join('');

  const swatches = CAT_COLORS.map(c => `
    <button type="button" aria-label="${c} color" class="color-swatch ${c===cColor?'selected':''}"
      style="background:${c}" onclick="pickCatColor(this,'${c}')"></button>`).join('');

  openModal(`
    <div class="modal-header">
      <h2>${cat ? 'Edit Category' : 'New Category'}</h2>
      <button class="btn-icon" aria-label="Close" onclick="closeModal()"><i data-lucide="X" style="width:15px;height:15px"></i></button>
    </div>
    <div class="modal-body">
      <form id="cat-form" onsubmit="submitCategory(event,'${catId||''}')">
        <div class="form-row">
          <label for="cat-name">Name *</label>
          <input id="cat-name" type="text" name="name" class="form-input" required
            value="${esc(cat?.name||'')}" placeholder="Dev Tools">
        </div>

        <div class="form-section">Icon</div>
        <input type="text" aria-label="Search icons" class="form-input" style="margin-bottom:8px"
          placeholder="Search icons…" oninput="filterIcons(this.value)">
        <div class="icon-grid" id="icon-grid">${iconGrid}</div>
        <input type="hidden" name="icon" value="${cIcon}">

        <div class="form-section">Color</div>
        <div class="color-swatches">${swatches}</div>
        <input type="hidden" name="color" value="${cColor}">

        <div class="modal-footer">
          ${cat ? `<button type="button" class="btn ${catHidden ? 'btn--primary' : 'btn--ghost'}"
            onclick="${catHidden ? 'unhide' : 'hide'}Item('categories','${catId}');closeModal()">
            <i data-lucide="${catHidden ? 'Eye' : 'EyeOff'}" style="width:13px;height:13px"></i>
            ${catHidden ? 'Unhide' : 'Hide'}</button>` : ''}
          <div class="spacer"></div>
          <button type="button" class="btn btn--ghost" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn--primary">Save</button>
        </div>
      </form>
    </div>`);
}

// ═══════════════════════════════════════════════════════════════
//  IMPORT MODAL
// ═══════════════════════════════════════════════════════════════
function openImportModal() {
  window._importData = null;
  openModal(`
    <div class="modal-header">
      <h2>Import Bookmarks</h2>
      <button class="btn-icon" aria-label="Close" onclick="closeModal()"><i data-lucide="X" style="width:15px;height:15px"></i></button>
    </div>
    <div class="modal-body">
      <p class="hint-text">Supports Chrome/Safari HTML export, JSON, and CSV files.</p>
      <div class="import-drop-zone" id="import-dz"
        ondragover="event.preventDefault();this.classList.add('drag-over')"
        ondragleave="this.classList.remove('drag-over')"
        ondrop="handleImportDrop(event)">
        <i data-lucide="UploadCloud" style="width:32px;height:32px;opacity:0.35"></i>
        <p style="margin:0">Drag & drop file here, or</p>
        <input type="file" id="import-file" accept=".html,.htm,.json,.csv" style="display:none"
          onchange="processImportFile(this.files[0])">
        <button type="button" class="btn btn--ghost"
          onclick="document.getElementById('import-file').click()">Choose File</button>
      </div>
      <div id="import-preview"></div>
      <div class="modal-footer">
        <button type="button" class="btn btn--ghost" onclick="closeModal()">Cancel</button>
        <button type="button" class="btn btn--primary" id="import-confirm"
          style="display:none" onclick="confirmImport()">Import All</button>
      </div>
    </div>`);
}

// ═══════════════════════════════════════════════════════════════
//  MODAL FORM HELPERS
// ═══════════════════════════════════════════════════════════════
function pickLucideIcon(el, name) {
  document.querySelectorAll('.icon-option').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  // Update hidden input in either form
  const form = document.getElementById('card-form') || document.getElementById('cat-form');
  if (form) {
    const inp = form.querySelector('[name="iconValue"], [name="icon"]');
    if (inp) inp.value = name;
  }
}

function switchIconTab(el, type) {
  document.querySelectorAll('.icon-tab').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('.icon-panel').forEach(p => p.classList.add('hidden'));
  document.getElementById(`icon-panel-${type}`)?.classList.remove('hidden');
  const form = document.getElementById('card-form');
  if (form) {
    form.querySelector('[name="iconType"]').value = type;
    if (type === 'favicon') {
      const url = form.querySelector('[name="url"]')?.value || '';
      form.querySelector('[name="iconValue"]').value = url;
    }
  }
}

function setIconValue(val) {
  document.getElementById('card-form')?.querySelector('[name="iconValue"]')?.setAttribute('value', val);
  const f = document.getElementById('card-form');
  if (f) f.querySelector('[name="iconValue"]').value = val;
}

async function handleIconUpload(input) {
  if (!input.files[0]) return;
  if (!S.dir) { alert('Connect a directory first.'); return; }
  try {
    const name = await saveAsset(input.files[0]);
    setIconValue(name);
    const panel = document.getElementById('icon-panel-local');
    let img = panel?.querySelector('.icon-preview-img');
    if (!img) { img = document.createElement('img'); img.className = 'icon-preview-img'; panel?.appendChild(img); }
    img.src = S.assetUrls[name];
  } catch (e) { showToast('Upload failed: ' + e.message); }
}

function filterIcons(q) {
  document.querySelectorAll('.icon-option').forEach(btn => {
    btn.style.display = fuzzyMatch(btn.dataset.icon, q) ? '' : 'none';
  });
}

function toggleColor(checkbox, pickerId) {
  const pick = document.getElementById(pickerId);
  if (pick) pick.style.display = checkbox.checked ? '' : 'none';
}

function pickCatColor(el, color) {
  document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  const form = document.getElementById('cat-form');
  if (form) form.querySelector('[name="color"]').value = color;
}

// ═══════════════════════════════════════════════════════════════
//  SAVE / DELETE
// ═══════════════════════════════════════════════════════════════
async function submitCard(e, catId, bmId) {
  e.preventDefault();
  const fd    = new FormData(e.target);
  const title = fd.get('title').trim();
  const url   = fd.get('url').trim();
  const desc  = fd.get('description').trim();
  const tags  = fd.get('tags').split(',').map(t => t.trim()).filter(Boolean);
  const iType = fd.get('iconType');
  let   iVal  = fd.get('iconValue');
  const newCat= fd.get('categoryId');

  if (iType === 'favicon') iVal = url;

  const cs = {};
  if (fd.get('useCardColor'))   cs.cardColor   = fd.get('cardColor');
  if (fd.get('useBorderColor')) cs.borderColor = fd.get('borderColor');

  const srcCat = S.data.categories.find(c => c.id === catId);
  if (!srcCat) return;

  if (bmId) {
    const bm = srcCat.bookmarks.find(b => b.id === bmId);
    if (!bm) return;
    Object.assign(bm, { title, url, description: desc, tags, icon: { type: iType, value: iVal }, customStyle: cs });
    if (newCat !== catId) {
      srcCat.bookmarks = srcCat.bookmarks.filter(b => b.id !== bmId);
      S.data.categories.find(c => c.id === newCat)?.bookmarks.push(bm);
    }
  } else {
    const bm = { id: `bm-${uid()}`, title, url, description: desc, tags, clicks: 0,
                 icon: { type: iType, value: iVal }, customStyle: cs };
    (S.data.categories.find(c => c.id === newCat) || srcCat).bookmarks.push(bm);
  }

  closeModal();
  render();      // immediate — user sees the change at once
  saveData();    // background write, no await
}

async function submitCategory(e, catId) {
  e.preventDefault();
  const fd    = new FormData(e.target);
  const name  = fd.get('name').trim();
  const icon  = fd.get('icon');
  const color = fd.get('color');

  if (catId) {
    const cat = S.data.categories.find(c => c.id === catId);
    if (cat) Object.assign(cat, { name, icon, color });
  } else {
    S.data.categories.push({ id: `cat-${uid()}`, name, icon, color, bookmarks: [] });
  }

  closeModal();
  render();      // immediate
  saveData();    // background
}

// Items are never removed from master_bookmarks.json.
// Use hideItem() / unhideItem() to control per-user visibility via local_settings.json.

// ═══════════════════════════════════════════════════════════════
//  CLICK TRACKING
// ═══════════════════════════════════════════════════════════════
function trackClick(event, bmId, catId) {
  // Non-blocking background write; don't prevent default
  const bm = S.data.categories.find(c => c.id === catId)?.bookmarks.find(b => b.id === bmId);
  if (bm) { bm.clicks = (bm.clicks || 0) + 1; saveData(); }
}

// ═══════════════════════════════════════════════════════════════
//  SEARCH
// ═══════════════════════════════════════════════════════════════
function handleSearch(q) {
  S.query = q;
  render();
  const inp = document.getElementById('search-input');
  if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
}

// ═══════════════════════════════════════════════════════════════
//  EXPORT
// ═══════════════════════════════════════════════════════════════
function exportData() {
  const blob = new Blob([JSON.stringify(S.data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url, download: `bookmarks-${new Date().toISOString().slice(0,10)}.json`
  });
  a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════
//  IMPORT ENGINE
// ═══════════════════════════════════════════════════════════════
function parseHTML(html) {
  const doc  = new DOMParser().parseFromString(html, 'text/html');
  const cats = [];

  function processNode(el, parent) {
    for (const child of el.children) {
      if (child.tagName !== 'DT') continue;
      const h3  = child.querySelector(':scope > h3');
      const a   = child.querySelector(':scope > a');
      const dl  = child.querySelector(':scope > dl, :scope > dd > dl');

      if (h3) {
        const cat = {
          id: `cat-${uid()}`, name: h3.textContent.trim(),
          icon: 'Folder', color: CAT_COLORS[cats.length % CAT_COLORS.length], bookmarks: []
        };
        cats.push(cat);
        if (dl) processNode(dl, cat);
      } else if (a) {
        const bm = {
          id: `bm-${uid()}`, title: a.textContent.trim(), url: a.getAttribute('href') || '',
          description: '', tags: [], clicks: 0, icon: { type: 'favicon', value: a.getAttribute('href')||'' }, customStyle: {}
        };
        if (parent) { parent.bookmarks.push(bm); }
        else {
          let fallback = cats.find(c => c.name === 'Imported');
          if (!fallback) {
            fallback = { id: `cat-${uid()}`, name: 'Imported', icon: 'Download',
                         color: CAT_COLORS[0], bookmarks: [] };
            cats.push(fallback);
          }
          fallback.bookmarks.push(bm);
        }
      }
    }
  }

  const dl = doc.querySelector('dl');
  if (dl) processNode(dl, null);
  return cats;
}

function parseCSV(csv) {
  const rows  = csv.split('\n').filter(r => r.trim());
  if (rows.length < 2) return [];
  const hdr   = rows[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g,''));
  const idx   = f => hdr.indexOf(f);
  const uIdx  = idx('url'); const tIdx = idx('title');
  const cIdx  = idx('category'); const tagIdx = idx('tags'); const dIdx = idx('description') !== -1 ? idx('description') : idx('desc');
  const catMap = {};

  for (let i = 1; i < rows.length; i++) {
    const cols   = rows[i].match(/(".*?"|[^,]+)/g)?.map(c => c.trim().replace(/^"|"$/g,'')) || [];
    const url    = cols[uIdx] || '';
    const title  = cols[tIdx] || url;
    const catNm  = (cIdx >= 0 && cols[cIdx]) ? cols[cIdx] : 'Imported';
    if (!catMap[catNm]) catMap[catNm] = {
      id: `cat-${uid()}`, name: catNm, icon: 'Folder',
      color: CAT_COLORS[Object.keys(catMap).length % CAT_COLORS.length], bookmarks: []
    };
    catMap[catNm].bookmarks.push({
      id: `bm-${uid()}`, title, url,
      description: dIdx >= 0 ? (cols[dIdx]||'') : '',
      tags: tagIdx >= 0 ? cols[tagIdx].split(';').map(t=>t.trim()).filter(Boolean) : [],
      clicks: 0, icon: { type: 'favicon', value: url }, customStyle: {}
    });
  }
  return Object.values(catMap);
}

function parseJSONImport(json) {
  if (json.categories) return json.categories;
  if (Array.isArray(json)) {
    return [{
      id: `cat-${uid()}`, name: 'Imported', icon: 'Download',
      color: CAT_COLORS[0],
      bookmarks: json.map(item => ({
        id: `bm-${uid()}`, title: item.title || item.url,
        url: item.url || item.href || '', description: item.description || item.desc || '',
        tags: item.tags || [], clicks: 0,
        icon: { type: 'favicon', value: item.url || '' }, customStyle: {}
      }))
    }];
  }
  return [];
}

function handleImportDrop(e) {
  e.preventDefault();
  document.getElementById('import-dz')?.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) processImportFile(e.dataTransfer.files[0]);
}

async function processImportFile(file) {
  const text = await file.text();
  let cats = [];
  try {
    if (/\.html?$/i.test(file.name))  cats = parseHTML(text);
    else if (/\.csv$/i.test(file.name)) cats = parseCSV(text);
    else if (/\.json$/i.test(file.name)) cats = parseJSONImport(JSON.parse(text));
    else { showToast('Unsupported file type'); return; }
  } catch (e) {
    document.getElementById('import-preview').innerHTML =
      `<div class="error-box"><i data-lucide="AlertTriangle" style="width:15px;height:15px;flex-shrink:0"></i><div>Parse error: ${esc(e.message)}</div></div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  const total = cats.reduce((n, c) => n + c.bookmarks.length, 0);
  window._importData = cats;
  document.getElementById('import-preview').innerHTML = `
    <div class="import-preview">
      <p>Found <strong>${cats.length} categories</strong> with <strong>${total} bookmarks</strong>:</p>
      <ul>${cats.map(c => `<li>${esc(c.name)} — ${c.bookmarks.length} bookmark(s)</li>`).join('')}</ul>
    </div>`;
  const btn = document.getElementById('import-confirm');
  if (btn) btn.style.display = '';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function confirmImport() {
  const cats = window._importData;
  if (!cats) return;
  const existing = new Set(S.data.categories.flatMap(c => c.bookmarks.map(b => b.url)));
  let addedCats = 0, addedBms = 0, dupes = 0;

  for (const cat of cats) {
    let dest = S.data.categories.find(c => c.name === cat.name);
    if (!dest) { dest = { ...cat, bookmarks: [] }; S.data.categories.push(dest); addedCats++; }
    for (const bm of cat.bookmarks) {
      if (!existing.has(bm.url)) {
        dest.bookmarks.push(bm); existing.add(bm.url); addedBms++;
      } else dupes++;
    }
  }

  closeModal();
  render();
  saveData();
  showToast(`Imported ${addedBms} bookmarks into ${addedCats} new categories.${dupes ? ` (${dupes} duplicates skipped)` : ''}`);
}

// ═══════════════════════════════════════════════════════════════
//  COMMAND PALETTE
// ═══════════════════════════════════════════════════════════════
function openPalette() {
  if (!S.dir) return;
  S.paletteOpen = true;
  const el = document.getElementById('palette-overlay');
  el.innerHTML = `
    <div class="palette">
      <div class="palette-search-wrap">
        <i data-lucide="Terminal" style="width:15px;height:15px"></i>
        <input type="text" id="palette-input" class="palette-input" aria-label="Command palette input"
          placeholder="Search bookmarks or type a command…"
          oninput="updatePalette(this.value)"
          onkeydown="onPaletteKey(event)">
        <kbd style="font-size:11px;color:var(--text3)">ESC</kbd>
      </div>
      <div id="palette-results" class="palette-results"></div>
    </div>`;
  el.classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons();
  document.getElementById('palette-input')?.focus();
  updatePalette('');
}

function closePalette() {
  S.paletteOpen = false;
  const el = document.getElementById('palette-overlay');
  el.classList.add('hidden');
  el.innerHTML = '';
}

function updatePalette(q) {
  const CMDS = [
    { label: 'New Category',      icon: 'FolderPlus', fn: () => { closePalette(); openCategoryModal(null); } },
    { label: 'Import Bookmarks',  icon: 'Upload',     fn: () => { closePalette(); openImportModal(); } },
    { label: 'Export Bookmarks',  icon: 'Download',   fn: () => { closePalette(); exportData(); } },
    { label: 'Reconnect Directory', icon: 'FolderOpen', fn: () => { closePalette(); handleConnect(); } },
  ];

  const matchCmds = CMDS.filter(c => fuzzyMatch(c.label, q));
  const matchBms  = [];

  if (q) {
    outer:
    for (const cat of S.data.categories) {
      for (const bm of cat.bookmarks) {
        if (fuzzyMatch(bm.title, q) || fuzzyMatch(bm.url, q) || (bm.tags||[]).some(t => fuzzyMatch(t, q))) {
          matchBms.push({ bm, cat });
          if (matchBms.length >= 8) break outer;
        }
      }
    }
  }

  // Store action refs
  window._palActions = matchCmds.map(c => c.fn);
  window._palBms = matchBms.map(m => m.bm);

  const cmdsHtml = matchCmds.map((c, i) => `
    <div class="palette-item" onclick="window._palActions[${i}]()">
      <i data-lucide="${c.icon}" style="width:14px;height:14px"></i>
      <span>${esc(c.label)}</span>
      <span class="palette-item-type">Command</span>
    </div>`).join('');

  const bmsHtml = matchBms.map(({ bm, cat }) => `
    <div class="palette-item" data-url="${esc(sanitizeUrl(bm.url))}" onclick="window.open(this.dataset.url,'_blank');closePalette()">
      <i data-lucide="ExternalLink" style="width:14px;height:14px"></i>
      <span>${esc(bm.title)}</span>
      <span class="palette-item-type">${esc(cat.name)}</span>
    </div>`).join('');

  const res = document.getElementById('palette-results');
  if (!res) return;

  if (!cmdsHtml && !bmsHtml) {
    res.innerHTML = `<div class="palette-empty">No results for "${esc(q)}"</div>`;
  } else {
    res.innerHTML =
      (cmdsHtml ? `<div class="palette-section-label">Commands</div>${cmdsHtml}` : '') +
      (bmsHtml  ? `<div class="palette-section-label">Bookmarks</div>${bmsHtml}` : '');
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function onPaletteKey(e) {
  if (e.key === 'Escape') closePalette();
}

// ═══════════════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════════════
function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('toast--visible')));
  setTimeout(() => { t.classList.remove('toast--visible'); setTimeout(() => t.remove(), 300); }, 3800);
}

// initDragDrop replaced by initFreeDrag (pointer-event canvas drag)

// ═══════════════════════════════════════════════════════════════
//  GLOBAL EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    S.paletteOpen ? closePalette() : openPalette();
  }
  if (e.key === 'Escape' && S.paletteOpen) closePalette();
});

document.getElementById('palette-overlay').addEventListener('click', e => {
  if (e.target.id === 'palette-overlay') closePalette();
});

document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target.id === 'modal-overlay') closeModal();
});

document.addEventListener('pointermove', e => {
  if (!_drag) return;
  e.preventDefault();
  const dx = (e.clientX - _drag.startClientX) / _drag.vw * 100;
  const dy = (e.clientY - _drag.startClientY) / _drag.vw * 100;
  _drag.curX = Math.max(0, _drag.startX + dx);
  _drag.curY = Math.max(0, _drag.startY + dy);
  _drag.el.style.left = _drag.curX + 'vw';
  _drag.el.style.top  = _drag.curY + 'vw';
  _drag.moved = true;
  updateCanvasHeight();
}, { passive: false });

document.addEventListener('pointerup', e => {
  if (!_drag) return;
  _drag.el.classList.remove('card--dragging');
  document.body.style.userSelect = '';
  if (_drag.moved) {
    S.cfg.cardPositions[_drag.bmId] = { x: _drag.curX, y: _drag.curY };
    saveData();
    updateCanvasHeight();
  }
  _drag = null;
});

document.addEventListener('pointercancel', () => {
  if (!_drag) return;
  _drag.el.classList.remove('card--dragging');
  document.body.style.userSelect = '';
  _drag = null;
});

window.addEventListener('resize', () => {
  updateCanvasHeight();
});

// ═══════════════════════════════════════════════════════════════
//  INIT & CONNECT HANDLERS
// ═══════════════════════════════════════════════════════════════
async function handleConnect() {
  const ok = await openDirectory();
  if (ok) { render(); showToast(`Connected to "${S.dir.name}"`); }
}

async function handleResume() {
  if (!S.pendingHandle) return;
  try {
    const perm = await S.pendingHandle.requestPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      S.dir = S.pendingHandle;
      S.pendingHandle = null;
      await loadData();
      render();
      showToast(`Resumed — ${S.dir.name}`);
    }
  } catch (e) {
    if (e.name !== 'AbortError') console.error(e);
  }
}

async function init() {
  // Try to restore the directory handle saved from the last session
  try {
    const saved = await idbGet('dirHandle');
    if (saved) {
      // queryPermission doesn't require a user gesture — succeeds silently in the same browser session
      const perm = await saved.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        S.dir = saved;
        await loadData();
      } else {
        // Different session: permission expired, but we can offer a one-click restore
        S.pendingHandle = saved;
      }
    }
  } catch (e) {
    console.warn('Could not restore directory handle:', e.message);
  }
  render();
}

init();
