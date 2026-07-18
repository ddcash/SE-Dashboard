'use strict';
// Constants and APP_CONFIG are defined in config.js (loaded first)

// ═══════════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════════
const S = {
  dir:              null,
  pendingHandle:    null,
  masterHandle:     null,
  masterAssetsHandle: null,
  masterFileName:   '',
  masterData:       { version: 1, categories: [] },
  data:             { version: 1, categories: [] },
  cfg:              { theme: 'dark', layout: {}, hidden: { bookmarks: [], categories: [] }, cardPositions: {}, masterPrompted: false, overrides: { bookmarks: {}, categories: {} }, userCategories: [], userBookmarks: [], groups: [] },
  assetUrls:        {},
  masterAssetUrls:  {},
  query:            '',
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
  const sanitized = u.replace(/[\x00-\x20\x7F-\x9F]/g, '');
  if (/^(javascript|data|vbscript):/i.test(sanitized)) return '#';
  return u;
}

// ⚡ Bolt: Cache lowercased query to avoid O(N) string allocations during loop
let _lastFuzzyQ = null;
let _lastFuzzyQLower = null;

function fuzzyMatch(str, q) {
  if (!q) return true;
  if (q !== _lastFuzzyQ) {
    _lastFuzzyQ = q;
    _lastFuzzyQLower = q.toLowerCase();
  }
  str = String(str).toLowerCase();
  let i = 0;
  for (const ch of _lastFuzzyQLower) { i = str.indexOf(ch, i); if (i === -1) return false; i++; }
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
  const cats = S.data.categories || [];
  if (!cats.length) { showToast('Create a category first.'); openCategoryModal(null); return; }
  openCardModal(S.activeCat || cats[0].id, null);
}

function resetLayout() {
  // Only remove positions of cards that are NOT in a group
  if (S.cfg.cardPositions) {
     for (const id in S.cfg.cardPositions) {
         if (!S.cfg.cardPositions[id].groupId && !id.startsWith('grp-')) {
             delete S.cfg.cardPositions[id];
         }
     }
  }

  // Also space out groups automatically if they have no position (or reset them too)
  // Let's reset groups as well, so they get auto-arranged, but items INSIDE groups keep their relative x/y.
  if (S.cfg.cardPositions) {
     for (const id in S.cfg.cardPositions) {
         if (id.startsWith('grp-')) {
             delete S.cfg.cardPositions[id];
         }
     }
  }

  S.cfg.forceAbsoluteLayout = false;
  render();
  showToast('Layout reset — top-level items re-arranged.');
}

// Assign a grid position (in vw units) to every card that has no saved position.
// Called after loadData and after every render (idempotent — only acts on new cards).
function autoArrangeCards() {
  if (!S.cfg.cardPositions) S.cfg.cardPositions = {};
  const cats = S.data.categories || [];
  if (!cats.length) return;

  // ⚡ Bolt: Early return if all bookmarks already have positions to skip expensive O(N log N) sorting
  let missingPositions = false;
  for (const cat of cats) {
    for (const bm of cat.bookmarks) {
      if (!(bm.id in S.cfg.cardPositions)) {
        missingPositions = true;
        break;
      }
    }
    if (missingPositions) break;
  }
  if (!missingPositions) return;

  const vw       = window.innerWidth || 1200;
  const { cardWidth: CARD_W, cardHeight: CARD_H, gap: GAP, padding: PAD } = APP_CONFIG.canvas;
  const cols     = Math.max(1, Math.floor((vw - PAD * 2) / (CARD_W + GAP)));
  let count = Object.keys(S.cfg.cardPositions).length;
  let changed = false;

  // Flatten and sort items (bookmarks and groups) so hidden items come last
  // We only arrange bookmarks that are NOT in a group.
  const allBms = [];
  for (const cat of cats) {
    for (const bm of cat.bookmarks) {
      if (!S.cfg.cardPositions[bm.id] || !S.cfg.cardPositions[bm.id].groupId) {
         allBms.push(bm);
      }
    }
  }

  // Add groups to be arranged alongside bookmarks
  if (S.cfg.groups) {
      for (const group of S.cfg.groups) {
         allBms.push(group);
      }
  }

  // ⚡ Bolt: Cache hidden lookups to a Set for O(1) checks during sorting
  const hiddenBms = new Set(S.cfg.hidden?.bookmarks || []);

  allBms.sort((a, b) => {
    const aHidden = hiddenBms.has(a.id) ? 1 : 0;
    const bHidden = hiddenBms.has(b.id) ? 1 : 0;
    return aHidden - bHidden;
  });

  let currentX = PAD;
  let currentY = PAD;
  let rowHeight = CARD_H;

  // We need to figure out where to start placing new items.
  // Find the bottom-most item
  for (const id in S.cfg.cardPositions) {
     const pos = S.cfg.cardPositions[id];
     if (pos.x !== undefined && !pos.groupId) {
        currentY = Math.max(currentY, pos.y + (pos.h || CARD_H) + GAP);
     }
  }

  for (const bm of allBms) {
    if (!(bm.id in S.cfg.cardPositions)) {
      // Find the item's custom width if it has one
      // Since it doesn't have a position yet, it might not have w/h, but let's default
      const w = CARD_W;
      const h = CARD_H;

      if (currentX + w > vw - PAD) {
         currentX = PAD;
         currentY += rowHeight + GAP;
         rowHeight = h;
      } else {
         rowHeight = Math.max(rowHeight, h);
      }

      S.cfg.cardPositions[bm.id] = {
        x: currentX,
        y: currentY,
        _px: true
      };

      currentX += w + GAP;
      changed = true;
    }
  }
  if (changed) saveData();
}

// Expand canvas so all positioned cards are fully visible.
// ⚡ Bolt: Optimized canvas height recalculation during drag.
// Instead of O(N) array allocation via Object.entries() on every 60fps pointermove,
// we cache the max static Y of all non-dragged items and do an O(1) comparison during drag.
function applyLayout() {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;

  // If a category or query is selected, we want an auto-arranged wrapped view regardless of custom positions
  if (S.activeCat || S.query) {
      canvas.dataset.wrapped = "true";
      // Using flex layout with wrap enables variable-sized cards to flow naturally.
      canvas.style.display = 'flex';
      canvas.style.flexWrap = 'wrap';
      canvas.style.gap = `${APP_CONFIG.canvas.gap}px`;
      canvas.style.alignItems = 'flex-start';
      canvas.style.alignContent = 'flex-start';
      const cards = Array.from(canvas.querySelectorAll('.card'));
      cards.forEach(card => {
          card.style.position = 'relative';
          card.style.left = '';
          card.style.top = '';
      });
      return;
  }

  const vw = window.innerWidth;
  const positions = S.cfg.cardPositions || {};
  let maxRight = 0;

  const cards = Array.from(canvas.querySelectorAll('.card'));
  cards.forEach(card => {
    const id = card.dataset.id;
    if (positions[id] && positions[id].x !== undefined) {
      const w = positions[id].w || APP_CONFIG.canvas.cardWidth;
      maxRight = Math.max(maxRight, positions[id].x + w);
    }
  });

  const isWrapped = maxRight > (vw - APP_CONFIG.canvas.padding);

  // Once manually arranged via drag, don't re-wrap immediately until reset or specifically requested
  // We determine if we've been dragged out of wrapping by checking if wrapped is "false" but would be true,
  // except we just changed it to false in the drag event.
  // Actually, simpler: if it is wrapped, but we are actively setting it to false in pointermove/up,
  // applyLayout is recalculating and setting it BACK to true because maxRight is large.
  // We can add a flag to S.cfg to indicate we are using "absolute layout".
  if (S.cfg.forceAbsoluteLayout) {
     canvas.dataset.wrapped = "false";
     canvas.style.display = 'block';
     cards.forEach(card => {
       const id = card.dataset.id;
       if (positions[id] && positions[id].x !== undefined) {
         card.style.position = 'absolute';
         card.style.left = positions[id].x + 'px';
         card.style.top = positions[id].y + 'px';
       }
     });
     return;
  }

  if (isWrapped) {
    canvas.dataset.wrapped = "true";
    canvas.style.display = 'flex';
    canvas.style.flexWrap = 'wrap';
    canvas.style.alignItems = 'flex-start';
    canvas.style.alignContent = 'flex-start';
    canvas.style.gap = `${APP_CONFIG.canvas.gap}px`;
    cards.forEach(card => {
      if (card.closest('.group-content')) return;
      card.style.position = 'relative';
      card.style.left = '';
      card.style.top = '';
    });
  } else {
    canvas.dataset.wrapped = "false";
    canvas.style.display = 'block';
    cards.forEach(card => {
      const id = card.dataset.id;
      if (positions[id] && positions[id].x !== undefined) {
        card.style.position = 'absolute';
        card.style.left = positions[id].x + 'px';
        card.style.top = positions[id].y + 'px';
      }
    });
  }

  updateCanvasHeight();
}

function updateCanvasHeight() {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;
  const minH = window.innerHeight - 120; // header + filter bar

  if (canvas.dataset.wrapped === "true") {
    canvas.style.minHeight = minH + 'px';
    return;
  }

  let maxYPx = minH;
  if (_drag && _drag.maxStaticPx !== undefined) {
    maxYPx = Math.max(_drag.maxStaticPx, _drag.curY + 150);
  } else {
    const positions = S.cfg.cardPositions || {};
    for (const id in positions) {
      const y = (_drag && _drag.bmId === id) ? _drag.curY : positions[id].y;
      maxYPx = Math.max(maxYPx, y + 150);
    }
    if (_drag) maxYPx = Math.max(maxYPx, _drag.curY + 150);
  }
  canvas.style.minHeight = maxYPx + 60 + 'px';
}

// ── Pointer-event drag ───────────────────────────────────────
let _drag = null;

let _resizeTimeout;
let _cardResizeObserver;

function initFreeDrag() {
  if (_cardResizeObserver) _cardResizeObserver.disconnect();

  _cardResizeObserver = new ResizeObserver(entries => {
    let changed = false;
    for (const entry of entries) {
      const card = entry.target;
      const bmId = card.dataset.id;
      // If the card was resized explicitly by the user, width/height will be explicitly set in pixels in the style string
      if (!card.style.width && !card.style.height) continue;

      const w = card.offsetWidth;
      const h = card.offsetHeight;

      if (!S.cfg.cardPositions[bmId]) continue;

      if (S.cfg.cardPositions[bmId].w !== w || S.cfg.cardPositions[bmId].h !== h) {
        S.cfg.cardPositions[bmId].w = w;
        S.cfg.cardPositions[bmId].h = h;
        changed = true;
      }
    }
    if (changed) {
      clearTimeout(_resizeTimeout);
      _resizeTimeout = setTimeout(() => { saveData(); updateCanvasHeight(); }, 500);
    }
  });

  document.querySelectorAll('#canvas .card, #canvas .card--group .card').forEach(card => {
    // Remove any previous listener to avoid double-binding after re-render
    card.removeEventListener('pointerdown', onDragStart);
    card.addEventListener('pointerdown', onDragStart, { passive: false });
    _cardResizeObserver.observe(card);
  });
}

function onDragStart(e) {
  if (e.button !== 0) return;
  e.stopPropagation();
  // Only initiate drag if the user specifically clicks the drag handle.
  // This ensures CSS resize handles (usually bottom-right) aren't swallowed by drag.
  if (!e.target.closest('.card-drag-handle')) return;

  // Don't drag when interacting with links, buttons, or action overlays
  if (e.target.closest('a, button, .card-actions')) return;

  // Allow dragging even when wrapped. We will convert visual position to absolute on drop.
  const canvas = document.getElementById('canvas');
  /* if (canvas && canvas.dataset.wrapped === "true") {
    showToast('Cannot drag cards while window is small. Resize window to enable dragging.');
    return;
  } */

  e.preventDefault();

  const card   = e.currentTarget;

  const isGrid = canvas && canvas.dataset.wrapped === "true";
  let startX = parseFloat(card.style.left) || 0;
  let startY = parseFloat(card.style.top)  || 0;

  const isGroup = card.classList.contains('card--group');
  const parentGroup = card.closest('.card--group');

  if (isGrid || (parentGroup && !isGroup)) {
      // If we're in grid mode OR dragging a card out of a group, calculate absolute starting position relative to canvas
      const canvasRect = canvas.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      startX = cardRect.left - canvasRect.left;
      startY = cardRect.top - canvasRect.top + canvas.scrollTop;

      if (parentGroup && !isGroup) {
          // Force layout translation relative to the main canvas
          card.style.position = 'absolute';
          card.style.left = startX + 'px';
          card.style.top = startY + 'px';
          // Move the DOM node out of the group and into the canvas so it isn't clipped and moves relative to canvas
          canvas.appendChild(card);
      }
  }

  const bmId   = card.dataset.id;

  // Pre-calculate max static Y of all OTHER cards so updateCanvasHeight is O(1) during 60fps pointermove
  let maxStaticPx = window.innerHeight - 120;
  const positions = S.cfg.cardPositions || {};
  for (const id in positions) {
    if (id !== bmId) maxStaticPx = Math.max(maxStaticPx, positions[id].y + 150);
  }

  _drag = {
    bmId,
    el:   card,
    startClientX: e.clientX,
    startClientY: e.clientY,
    startX, startY,
    canvas: document.getElementById('canvas'),
    curX: startX, curY: startY,
    moved: false,
    maxStaticPx, // ⚡ Bolt: Cached O(1) height calculation value
  };

  // If moving a card out of a group, append it to canvas so it's not clipped by the group's bounding box
  if (parentGroup && !isGroup) {
     const canvasEl = document.getElementById('canvas');
     // Force layout translation
     card.style.left = startX + 'px';
     card.style.top = startY + 'px';
     canvasEl.appendChild(card);
  }

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

async function readJSON(nameOrHandle) {
  try {
    const fh = typeof nameOrHandle === 'string'
      ? await S.dir.getFileHandle(nameOrHandle)
      : nameOrHandle;
    return JSON.parse(await (await fh.getFile()).text());
  } catch { return null; }
}

async function writeJSON(nameOrHandle, obj) {
  const fh = typeof nameOrHandle === 'string'
    ? await S.dir.getFileHandle(nameOrHandle, { create: true })
    : nameOrHandle;
  const w = await fh.createWritable();
  await w.write(JSON.stringify(obj, null, 2));
  await w.close();
}

async function writeMasterJSON(obj) {
  if (S.cfg.masterFileUrl) {
    try {
      const res = await fetch(S.cfg.masterFileUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(obj, null, 2)
      });
      if (res.ok) {
        showToast('Master changes saved to remote URL.');
      } else {
        showToast('Failed to save to URL. Read-only?');
      }
    } catch (e) {
      showToast('Failed to save to URL: ' + e.message);
    }
    return;
  }
  if (!S.dir) return;
  let fh = S.masterHandle;
  if (!fh) fh = await S.dir.getFileHandle(APP_CONFIG.files.master, { create: true });
  await writeJSON(fh, obj);
}

async function loadMasterData() {
  let bm = null;

  if (S.cfg.masterFileUrl) {
    try {
      const res = await fetch(S.cfg.masterFileUrl);
      if (res.ok || res.status === 0) {
        bm = await res.json();
        return bm;
      }
    } catch (e) {
      console.warn('Could not fetch master URL:', e);
      showToast('Failed to load master file from URL.');
    }
  }

  if (S.masterHandle) {
    bm = await readJSON(S.masterHandle);
    if (!bm) {
      showToast('Unable to read selected master file. Please reselect the master file.');
      S.masterHandle = null;
      S.masterFileName = '';
      idbSet('masterHandle', null).catch(() => {});
    }
  }

  if (!bm && S.dir && !S.pendingMasterHandle && !S.cfg.masterFileUrl) {
    const localHandle = await S.dir.getFileHandle(APP_CONFIG.files.master, { create: false }).catch(() => null);
    if (localHandle) {
      const localData = await readJSON(localHandle);
      if (localData) {
        bm = localData;
        if (!S.masterHandle) {
          S.masterHandle = localHandle;
          S.masterFileName = APP_CONFIG.files.master;
          idbSet('masterHandle', localHandle).catch(() => {});
        }
        if (!S.masterAssetsHandle) {
          const localAssetsDir = await S.dir.getDirectoryHandle(APP_CONFIG.assets.subdir, { create: false }).catch(() => null);
          if (localAssetsDir) {
            S.masterAssetsHandle = localAssetsDir;
            idbSet('masterAssetsHandle', localAssetsDir).catch(() => {});
          }
        }
      }
    }
  }

  return bm;
}

async function selectMasterFile() {
  if (!('showOpenFilePicker' in window)) {
    alert('The File System Access API is required to select a master file. Please use Chrome or Edge.');
    return;
  }

  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'JSON files', accept: { 'application/json': ['.json'] } }],
      multiple: false,
    });
    if (!handle) return;

    S.masterHandle = handle;
    S.masterFileName = handle.name;
    await idbSet('masterHandle', handle);

    const bm = await readJSON(handle);
    if (bm) {
      S.masterData = bm;
      mergeData();
      showToast(`Master file loaded: ${handle.name}`);
    } else {
      await writeMasterJSON(DEFAULT_DATA);
      S.masterData = DEFAULT_DATA;
      mergeData();
      showToast(`Created master file: ${handle.name}`);
    }
    S.cfg.masterPrompted = true;
    await writeJSON(APP_CONFIG.files.settings, S.cfg);
    await loadAssets();
    render();
  } catch (e) {
    if (e.name !== 'AbortError') console.error('selectMasterFile:', e);
  }
}

async function selectDefaultMasterFile() {
  if (!S.dir) return;
  try {
    const handle = await S.dir.getFileHandle(APP_CONFIG.files.master, { create: true });
    S.masterHandle = handle;
    S.masterFileName = APP_CONFIG.files.master;
    await idbSet('masterHandle', handle);
    const bm = await readJSON(handle);
    if (bm) {
      S.masterData = bm;
      mergeData();
      showToast('Using local master_bookmarks.json file.');
    } else {
      await writeMasterJSON(DEFAULT_DATA);
      S.masterData = DEFAULT_DATA;
      mergeData();
      showToast('Created master_bookmarks.json in the current directory.');
    }
    if (!S.masterAssetsHandle) {
      const localAssetsDir = await S.dir.getDirectoryHandle(APP_CONFIG.assets.subdir, { create: false }).catch(() => null);
      if (localAssetsDir) {
        S.masterAssetsHandle = localAssetsDir;
        await idbSet('masterAssetsHandle', localAssetsDir).catch(() => {});
      }
    }
    S.cfg.masterPrompted = true;
    await writeJSON(APP_CONFIG.files.settings, S.cfg);
    await loadAssets();
    render();
  } catch (e) {
    if (e.name !== 'AbortError') console.error('selectDefaultMasterFile:', e);
  }
}

async function saveMasterAssetsUrl() {
  const urlInput = document.getElementById('master-assets-url-input');
  if (!urlInput) return;
  const url = urlInput.value.trim();

  S.cfg.masterAssetsUrl = url;
  if (url) {
      S.masterAssetsHandle = null;
      S.pendingMasterAssetsHandle = null;
      await idbSet('masterAssetsHandle', null);
  }

  await writeJSON(APP_CONFIG.files.settings, S.cfg);

  await loadAssets();
  render();
  showToast('Master assets location updated.');
}

async function saveMasterUrl() {
  const urlInput = document.getElementById('master-url-input');
  if (!urlInput || !urlInput.value) return;
  const url = urlInput.value.trim();

  S.cfg.masterFileUrl = url;
  S.cfg.masterPrompted = true;
  S.masterHandle = null;
  S.masterFileName = '';
  S.pendingMasterHandle = null;
  await idbSet('masterHandle', null);
  await writeJSON(APP_CONFIG.files.settings, S.cfg);

  try {
    const res = await fetch(url);
    if (!res.ok && res.status !== 0) throw new Error('Network response was not ok');
    const bm = await res.json();
    S.masterData = bm;
    mergeData();
    render();
    showToast('Master file location updated.');
  } catch (err) {
    showToast('Location saved, but could not load it yet: ' + err.message);
  }
}

function openMasterFileModal() {
  openModal(`
    <div class="modal-header">
      <h2>Select Shared Master File</h2>
      <button class="btn-icon" aria-label="Close" onclick="closeModal()"><i data-lucide="X" style="width:15px;height:15px"></i></button>
    </div>
    <div class="modal-body">
      <p class="hint-text">Choose a shared master_bookmarks.json file that can be accessed by other users or services.</p>
      <p>Select a central file outside the local app folder, or use the local default file inside this directory.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn--primary" onclick="selectMasterFile(); closeModal();">
          <i data-lucide="FolderSearch" style="width:13px;height:13px"></i>
          Choose Shared Master File
        </button>
        <button class="btn btn--ghost" onclick="selectDefaultMasterFile(); closeModal();">
          <i data-lucide="FileText" style="width:13px;height:13px"></i>
          Use Local master_bookmarks.json
        </button>
      </div>
      <div style="margin-top:18px; display:flex; gap:10px;">
        <input type="text" id="master-url-input" class="form-input" placeholder="https://... or C:\... or /mnt/..." style="flex:1;">
        <button class="btn btn--primary" onclick="saveMasterUrl(); closeModal();">Load from URL/Path</button>
      </div>
      <div style="margin-top:18px;">
        <p class="hint-text">If your shared master file lives alongside a shared <code>assets/</code> folder, select that folder here so the app can load shared icons and images.</p>
        <div style="display:flex; gap:10px;">
          <button class="btn btn--ghost" onclick="selectMasterAssetsFolder(); closeModal();" style="flex-shrink:0;">
            <i data-lucide="FolderSearch" style="width:13px;height:13px"></i>
            Select Folder
          </button>
          <input type="text" id="master-assets-url-input" class="form-input" placeholder="https://.../assets or C:\...\assets" style="flex:1;">
          <button class="btn btn--primary" onclick="saveMasterAssetsUrl(); closeModal();">Set URL/Path</button>
        </div>
      </div>
    </div>`);
}

function isMasterCategory(catId) {
  return S.masterData.categories.some(c => c.id === catId);
}

async function selectMasterAssetsFolder() {
  if (!('showDirectoryPicker' in window)) {
    alert('The File System Access API is required to select a master assets folder. Please use Chrome or Edge.');
    return;
  }
  try {
    const folder = await window.showDirectoryPicker();
    if (!folder) return;

    let assetsHandle = folder;
    const hasMaster = await folder.getFileHandle(APP_CONFIG.files.master, { create: false }).catch(() => null);
    if (hasMaster) {
      const dir = await folder.getDirectoryHandle('assets', { create: false }).catch(() => null);
      if (dir) assetsHandle = dir;
    } else {
      const nested = await folder.getDirectoryHandle('assets', { create: false }).catch(() => null);
      if (nested) assetsHandle = nested;
    }

    S.masterAssetsHandle = assetsHandle;
    await idbSet('masterAssetsHandle', assetsHandle);
    await loadAssets();
    showToast('Master assets folder loaded.');
  } catch (e) {
    if (e.name !== 'AbortError') console.error('selectMasterAssetsFolder:', e);
  }
}

function isMasterBookmark(bmId) {
  return S.masterData.categories.some(c => c.bookmarks.some(b => b.id === bmId));
}

function getCategoryOverride(catId) {
  return (S.cfg.overrides?.categories?.[catId]) || {};
}

function getBookmarkOverride(bmId) {
  return (S.cfg.overrides?.bookmarks?.[bmId]) || {};
}

function mergeCategory(masterCat) {
  const override = getCategoryOverride(masterCat.id);
  return {
    ...masterCat,
    __master: true,
    name: override.name ?? masterCat.name,
    icon: override.icon ?? masterCat.icon,
    color: override.color ?? masterCat.color,
    bookmarks: [],
  };
}

function mergeBookmark(masterBm) {
  const override = getBookmarkOverride(masterBm.id);
  return {
    ...masterBm,
    __master: true,
    description: override.description ?? masterBm.description,
    tags: override.tags ?? masterBm.tags,
    icon: override.icon ?? masterBm.icon,
    customStyle: { ...masterBm.customStyle, ...(override.customStyle || {}) },
    clicks: override.clicks !== undefined ? override.clicks : (masterBm.clicks || 0),
  };
}

function findUserBookmark(bmId) {
  return S.cfg.userBookmarks.find(b => b.id === bmId);
}

function findUserCategory(catId) {
  return S.cfg.userCategories.find(c => c.id === catId);
}

function mergeData() {
  const dataMap = new Map();

  // Add master categories first
  for (const cat of S.masterData.categories) {
    dataMap.set(cat.id, mergeCategory(cat));
  }

  // Add master bookmarks with overrides
  for (const cat of S.masterData.categories) {
    const target = dataMap.get(cat.id);
    for (const bm of cat.bookmarks) {
      target.bookmarks.push(mergeBookmark(bm));
    }
  }

  // Add user categories
  for (const cat of S.cfg.userCategories || []) {
    if (!dataMap.has(cat.id)) {
      dataMap.set(cat.id, { ...cat, __user: true, bookmarks: [] });
    }
  }

  // Add user bookmarks into their categories
  const existingUsers = new Set();
  for (const bm of S.cfg.userBookmarks || []) {
    const catId = bm.categoryId || (S.masterData.categories[0]?.id || 'default');
    let category = dataMap.get(catId);
    if (!category) {
      category = { id: catId, name: 'Imported', icon: 'Folder', color: '#6366f1', __user: true, bookmarks: [] };
      dataMap.set(catId, category);
      if (!S.cfg.userCategories.some(c => c.id === catId)) {
        S.cfg.userCategories.push({ id: catId, name: category.name, icon: category.icon, color: category.color });
      }
    }
    category.bookmarks.push({ ...bm, __user: true });
    existingUsers.add(bm.id);
  }

  // Ensure view has all master and user categories
  S.data = {
    version: S.masterData.version || 1,
    categories: Array.from(dataMap.values()).map(cat => ({ ...cat, bookmarks: cat.bookmarks.slice() })),
  };
}

async function restoreSavedMasterHandles() {
  try {
    const saved = await idbGet('masterHandle');
    if (saved) {
      const perm = await saved.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        S.masterHandle = saved;
        S.masterFileName = saved.name;
      } else {
        S.pendingMasterHandle = saved;
      }
    }
  } catch (e) {
    console.warn('Could not restore master handle:', e.message);
    S.masterHandle = null;
    S.masterFileName = '';
    S.cfg.masterPrompted = false;
  }

  try {
    const savedAssets = await idbGet('masterAssetsHandle');
    if (savedAssets) {
      const perm = await savedAssets.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        S.masterAssetsHandle = savedAssets;
      } else {
        S.pendingMasterAssetsHandle = savedAssets;
      }
    }
  } catch (e) {
    console.warn('Could not restore master assets handle:', e.message);
    S.masterAssetsHandle = null;
  }
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

async function loadAssetsFromDir(dirHandle) {
  const urls = {};
  const allowed = /\.(png|jpe?g|gif|webp|svg|avif|ico)$/i;
  try {
    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind !== 'file') continue;
      if (!allowed.test(name)) continue;
      const file = await handle.getFile();
      if (!file.type.startsWith('image/') && !allowed.test(name)) continue;
      urls[name] = URL.createObjectURL(file);
    }
  } catch (e) {
    console.warn('Asset folder load failed:', e.message);
  }
  return urls;
}

async function loadAssets() {
  S.assetUrls = {};
  S.masterAssetUrls = {};
  if (S.dir) {
    try {
      const assets = await S.dir.getDirectoryHandle('assets', { create: true });
      S.assetUrls = await loadAssetsFromDir(assets);
    } catch (e) {
      console.warn('Assets load failed:', e.message);
      S.assetUrls = {};
    }
  }
  if (S.masterAssetsHandle) {
    try {
      S.masterAssetUrls = await loadAssetsFromDir(S.masterAssetsHandle);
    } catch (e) {
      console.warn('Master assets load failed:', e.message);
      S.masterAssetUrls = {};
    }
  }
  S.assetUrls = { ...S.masterAssetUrls, ...S.assetUrls };
}

async function loadData() {
  const cfg = await readJSON(APP_CONFIG.files.settings);
  if (cfg) S.cfg  = cfg;
  else     await writeJSON(APP_CONFIG.files.settings, S.cfg);
  // Ensure structures exist for older local_settings files
  if (!S.cfg.hidden)             S.cfg.hidden = { bookmarks: [], categories: [] };
  if (!S.cfg.hidden.bookmarks)   S.cfg.hidden.bookmarks  = [];
  if (!S.cfg.hidden.categories)  S.cfg.hidden.categories = [];
  if (!S.cfg.cardPositions)      S.cfg.cardPositions = {};
  if (!S.cfg.overrides)          S.cfg.overrides = { bookmarks: {}, categories: {} };
  if (!Array.isArray(S.cfg.userCategories)) S.cfg.userCategories = [];
  if (!Array.isArray(S.cfg.userBookmarks))  S.cfg.userBookmarks = [];
  if (!Array.isArray(S.cfg.masterCommits))  S.cfg.masterCommits = [];
  if (!S.cfg.themeSettings) S.cfg.themeSettings = {
    themeMode: 'dark',
    accentColor: '#89b4fa',
    bgType: 'solid',
    bgSolid: '#000000',
    bgColor1: '#0b1021',
    bgColor2: '#111827',
    bgAngle: '140',
    bgImageUrl: '',
    bgImageLocal: '',
    bgOverlay: '0.18',
    cardOpacity: '0.96',
    cardRadius: '14',
    cardShadow: 'medium',
    showCategoryBadge: true,
    fontScale: '1',
    cardTextScale: '1',
  };
  if (typeof S.cfg.masterPrompted !== 'boolean') S.cfg.masterPrompted = false;

  await restoreSavedMasterHandles();
  const bm  = await loadMasterData();

  await loadAssets();
  if (bm) {
    S.masterData = bm;
  } else if (S.cfg.masterPrompted) {
    await writeMasterJSON(DEFAULT_DATA);
    S.masterData = DEFAULT_DATA;
  } else {
    S.masterData = DEFAULT_DATA;
  }

  if (!Array.isArray(S.masterData.categories)) {
    S.masterData.categories = [];
  }

  if (S.cfg.cardPositions) {
    let migrated = false;
    for (const id in S.cfg.cardPositions) {
      if (!S.cfg.cardPositions[id]._px) {
        S.cfg.cardPositions[id].x = S.cfg.cardPositions[id].x * 1200 / 100;
        S.cfg.cardPositions[id].y = S.cfg.cardPositions[id].y * 1200 / 100;
        S.cfg.cardPositions[id]._px = true;
        migrated = true;
      }
    }
    if (migrated) await writeJSON(APP_CONFIG.files.settings, S.cfg);
  }

  mergeData();
  // Record mtime so pollChanges() can detect external edits
  try {
    const fh = S.masterHandle || await S.dir.getFileHandle(APP_CONFIG.files.master, { create: true });
    _lastModified = (await fh.getFile()).lastModified;
  } catch {}
}

// Poll every 4 s for external edits to master_bookmarks.json
// (e.g. the user edited the file directly in a text editor)
let _lastEtag = ''; // for tracking URL changes

async function pollChanges() {
  if (document.hidden || _lastModified === 0) return;

  if (S.cfg && S.cfg.masterFileUrl) {
    try {
      const res = await fetch(S.cfg.masterFileUrl, { method: 'HEAD' });
      if (!res.ok) return;
      const etag = res.headers.get('ETag') || res.headers.get('Last-Modified');
      if (etag && _lastEtag && etag !== _lastEtag) {
        _lastEtag = etag;
        const fetchRes = await fetch(S.cfg.masterFileUrl);
        S.masterData = await fetchRes.json();
        mergeData();
        render();
        showToast('Bookmarks reloaded — external change detected');
      } else if (etag && !_lastEtag) {
        _lastEtag = etag;
      }
    } catch (e) {}
    return;
  }

  if (!S.dir) return;
  try {
    const fh   = S.masterHandle || await S.dir.getFileHandle(APP_CONFIG.files.master, { create: true });
    const file = await fh.getFile();
    if (file.lastModified > _lastModified) {
      _lastModified = file.lastModified;
      S.masterData = JSON.parse(await file.text());
      mergeData();
      render();
      showToast('Bookmarks reloaded — external change detected');
    }
  } catch {}
}
setInterval(pollChanges, APP_CONFIG.poll.intervalMs);

async function saveData() {
  if (!S.dir) return;
  await createBackup();
  await writeJSON(APP_CONFIG.files.settings, S.cfg);
}

function renderMasterCommitHistory() {
  if (!Array.isArray(S.cfg.masterCommits) || !S.cfg.masterCommits.length) {
    return '<div class="hint-text">No previous master commits recorded.</div>';
  }
  return `<div class="commit-history">
    ${S.cfg.masterCommits.slice(-5).reverse().map(c => `
      <div class="commit-entry">
        <div class="commit-meta"><strong>${esc(c.message)}</strong></div>
        <div class="commit-meta"><small>${esc(new Date(c.ts).toLocaleString())}</small></div>
      </div>
    `).join('')}
  </div>`;
}

async function reloadMasterEditor() {
  if (!S.masterHandle && S.dir) {
    const handle = await S.dir.getFileHandle(APP_CONFIG.files.master, { create: true });
    S.masterHandle = handle;
    S.masterFileName = handle.name;
  }
  const latest = await loadMasterData();
  if (latest) {
    S.masterData = latest;
    render();
  }
  openMasterEditorModal();
}

async function saveMasterEditor() {
  const msgEl  = document.getElementById('master-commit-message');
  if (!msgEl) return;
  const commitMsg = msgEl.value.trim();
  if (!commitMsg) {
    showToast('Please enter a commit message before saving.');
    return;
  }

  let masterData = S.masterData;
  const mode = document.getElementById('master-editor-json-panel')?.classList.contains('hidden') ? 'visual' : 'json';
  if (mode === 'json') {
    const jsonEl = document.getElementById('master-json-editor');
    if (!jsonEl) return;
    try {
      masterData = JSON.parse(jsonEl.value.trim());
    } catch (err) {
      showToast('Invalid JSON: ' + err.message);
      return;
    }
  } else {
    const list = document.getElementById('master-editor-list');
    if (!list) return;
    masterData = { version: 1, categories: [] };
    for (const catEl of list.querySelectorAll('.master-category-panel')) {
      const catId = catEl.dataset.catId;
      const name = catEl.querySelector('[name="cat-name"]').value.trim() || 'Category';
      const icon = catEl.querySelector('[name="cat-icon"]').value;
      const color = catEl.querySelector('[name="cat-color"]').value;
      const category = { id: catId, name, icon, color, bookmarks: [] };
      for (const bmEl of catEl.querySelectorAll('.master-bookmark-row')) {
        const bmId = bmEl.dataset.bmId;
        const title = bmEl.querySelector('[name="bm-title"]').value.trim() || 'Untitled';
        const url = bmEl.querySelector('[name="bm-url"]').value.trim();
        const description = bmEl.querySelector('[name="bm-description"]').value.trim();
        const tags = bmEl.querySelector('[name="bm-tags"]').value.split(',').map(t => t.trim()).filter(Boolean);
        const hideCategoryBadge = bmEl.querySelector('[name="bm-hide-category"]')?.checked;
        category.bookmarks.push({
          id: bmId,
          title,
          url,
          description,
          tags,
          clicks: 0,
          icon: { type: 'lucide', value: bmEl.querySelector('[name="bm-icon"]').value || 'Link' },
          customStyle: hideCategoryBadge ? { hideCategoryBadge: true } : {},
        });
      }
      masterData.categories.push(category);
    }
  }

  S.masterData = masterData;
  await writeMasterJSON(S.masterData);
  S.cfg.masterCommits = S.cfg.masterCommits || [];
  S.cfg.masterCommits.push({ id: `commit-${uid()}`, ts: new Date().toISOString(), message: commitMsg });
  await writeJSON(APP_CONFIG.files.settings, S.cfg);
  mergeData();
  closeModal();
  render();
  showToast('Master changes committed: ' + commitMsg);
}

function openMasterEditorModal() {
  openModal(`
    <div class="modal-header">
      <h2>Edit Master Bookmarks</h2>
      <button class="btn-icon" aria-label="Close" onclick="closeModal()"><i data-lucide="X" style="width:15px;height:15px"></i></button>
    </div>
    <div class="modal-body">
      <div class="master-editor-tabs">
        <button type="button" class="btn btn--ghost master-editor-tab btn--active" id="master-editor-tab-visual" onclick="setMasterEditorMode('visual')">Visual Editor</button>
        <button type="button" class="btn btn--ghost master-editor-tab" id="master-editor-tab-json" onclick="setMasterEditorMode('json')">JSON Editor</button>
      </div>
      <div id="master-editor-list" class="master-editor-list"></div>
      <div id="master-editor-json-panel" class="master-editor-json-panel hidden">
        <div class="form-row">
          <label for="master-json-editor">Master JSON</label>
          <textarea id="master-json-editor" class="form-input form-textarea" rows="16">${esc(JSON.stringify(S.masterData, null, 2))}</textarea>
        </div>
      </div>
      <div class="form-row">
        <label for="master-commit-message">Commit Message *</label>
        <textarea id="master-commit-message" class="form-input form-textarea" rows="3" placeholder="Describe the master update..." required></textarea>
      </div>
      <div class="form-section">Recent Master Commits</div>
      ${renderMasterCommitHistory()}
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn--ghost" onclick="closeModal()">Cancel</button>
      <button type="button" class="btn btn--ghost" onclick="reloadMasterEditor()">Reload Latest</button>
      <button type="button" class="btn btn--primary" onclick="saveMasterEditor()">Commit Master Changes</button>
    </div>`);
  populateMasterEditorVisual();
  setMasterEditorMode('visual');
}

function setMasterEditorMode(mode) {
  document.querySelectorAll('.master-editor-tab').forEach(btn => btn.classList.remove('btn--active'));
  document.getElementById(`master-editor-tab-${mode}`)?.classList.add('btn--active');
  const list = document.getElementById('master-editor-list');
  const jsonPanel = document.getElementById('master-editor-json-panel');
  if (!list || !jsonPanel) return;
  if (mode === 'json') {
    list.classList.add('hidden');
    jsonPanel.classList.remove('hidden');
  } else {
    list.classList.remove('hidden');
    jsonPanel.classList.add('hidden');
  }
}

function populateMasterEditorVisual() {
  const container = document.getElementById('master-editor-list');
  if (!container) return;
  container.innerHTML = '';
  const categories = S.masterData.categories || [];
  const html = categories.map(cat => `
    <div class="master-category-panel" data-cat-id="${cat.id}">
      <div class="master-category-header">
        <div>
          <label>Name</label>
          <input type="text" class="form-input" name="cat-name" value="${esc(cat.name)}">
        </div>
        <div>
          <label>Icon</label>
          <input type="text" class="form-input" name="cat-icon" value="${esc(cat.icon)}">
        </div>
        <div>
          <label>Color</label>
          <input type="color" class="form-input" name="cat-color" value="${esc(cat.color || '#6366f1')}">
        </div>
        <button type="button" class="btn btn--danger" data-cat-id="${esc(cat.id)}" onclick="deleteMasterCategory(this.dataset.catId)">Delete Category</button>
      </div>
      <div class="master-bookmark-list">
        ${cat.bookmarks.map(bm => `
          <div class="master-bookmark-row" data-bm-id="${bm.id}">
            <div class="master-bookmark-row-top">
              <div><label>Title</label><input type="text" class="form-input" name="bm-title" value="${esc(bm.title)}"></div>
              <div><label>URL</label><input type="text" class="form-input" name="bm-url" value="${esc(bm.url)}"></div>
              <div><label>Icon</label><input type="text" class="form-input" name="bm-icon" value="${esc(bm.icon?.value || 'Link')}"></div>
              <button type="button" class="btn btn--danger" data-cat-id="${esc(cat.id)}" data-bm-id="${esc(bm.id)}" onclick="deleteMasterBookmark(this.dataset.catId, this.dataset.bmId)">Delete</button>
            </div>
            <div class="master-bookmark-row-bottom">
              <div><label>Description</label><input type="text" class="form-input" name="bm-description" value="${esc(bm.description||'')}"></div>
              <div><label>Tags</label><input type="text" class="form-input" name="bm-tags" value="${esc((bm.tags||[]).join(', '))}"></div>
              <div class="form-row"><label><input type="checkbox" name="bm-hide-category" ${bm.customStyle?.hideCategoryBadge ? 'checked' : ''}> Hide category badge</label></div>
            </div>
          </div>
        `).join('')}
        <button type="button" class="btn btn--ghost master-editor-add-btn" data-cat-id="${esc(cat.id)}" onclick="addMasterBookmark(this.dataset.catId)">Add Bookmark</button>
      </div>
    </div>
  `).join('');
  container.innerHTML = html + '<button type="button" class="btn btn--ghost master-editor-add-btn" onclick="addMasterCategory()">Add Category</button>';
}

function addMasterCategory() {
  const newCat = {
    id: `cat-${uid()}`,
    name: 'New Category',
    icon: 'Folder',
    color: '#6366f1',
    bookmarks: [],
  };
  S.masterData.categories.push(newCat);
  populateMasterEditorVisual();
}

function addMasterBookmark(catId) {
  const cat = S.masterData.categories.find(c => c.id === catId);
  if (!cat) return;
  cat.bookmarks.push({
    id: `bm-${uid()}`,
    title: 'New Bookmark',
    url: '',
    description: '',
    tags: [],
    clicks: 0,
    icon: { type: 'lucide', value: 'Link' },
    customStyle: {},
  });
  populateMasterEditorVisual();
}

function deleteMasterCategory(catId) {
  if (!confirm('Delete this master category and all its bookmarks?')) return;
  S.masterData.categories = S.masterData.categories.filter(c => c.id !== catId);
  populateMasterEditorVisual();
}

function populateSettingsModal() {
  const s = S.cfg.themeSettings || {};
  document.getElementById('settings-theme-mode').value = s.themeMode || 'dark';
  document.getElementById('settings-accent-color').value = s.accentColor || '#89b4fa';
  document.getElementById('settings-font-scale').value = s.fontScale || '1';
  document.getElementById('settings-font-scale-value').textContent = `${Math.round((s.fontScale || 1) * 100)}%`;
  document.getElementById('settings-card-text-scale').value = s.cardTextScale || '1';
  document.getElementById('settings-card-text-scale-value').textContent = `${Math.round((s.cardTextScale || 1) * 100)}%`;
  document.getElementById('settings-show-category-badge').checked = s.showCategoryBadge !== false;
  document.getElementById('settings-card-opacity').value = s.cardOpacity || '0.96';
  document.getElementById('settings-card-opacity-value').textContent = `${Math.round((s.cardOpacity || 0.96) * 100)}%`;
  document.getElementById('settings-bg-type').value = s.bgType || 'solid';
  document.getElementById('settings-bg-solid').value = s.bgSolid || '#000000';
  document.getElementById('settings-bg-color1').value = s.bgColor1 || '#090910';
  document.getElementById('settings-bg-color2').value = s.bgColor2 || '#0e0e1a';
  document.getElementById('settings-bg-angle').value = s.bgAngle || '135';
  document.getElementById('settings-bg-image-url').value = s.bgImageUrl || '';
  document.getElementById('settings-bg-overlay').value = s.bgOverlay || '0.16';
  document.getElementById('settings-bg-overlay-value').textContent = `${Math.round((s.bgOverlay || 0.16) * 100)}%`;
  toggleBgOptions();
}

function toggleBgOptions() {
  const type = document.getElementById('settings-bg-type')?.value;
  document.querySelectorAll('.bg-options').forEach(el => el.classList.add('hidden'));
  if (type === 'solid') document.getElementById('bg-solid-options')?.classList.remove('hidden');
  if (type === 'gradient') document.getElementById('bg-gradient-options')?.classList.remove('hidden');
  if (type === 'image') document.getElementById('bg-image-options')?.classList.remove('hidden');
}

async function handleBackgroundUpload(input) {
  if (!input.files?.[0]) return;
  try {
    const name = await saveAsset(input.files[0]);
    S.cfg.themeSettings.bgImageLocal = name;
    S.cfg.themeSettings.bgImageUrl = '';
    document.getElementById('settings-bg-image-url').value = '';
    showToast('Background image uploaded. Save settings to apply.');
  } catch (e) {
    showToast('Background upload failed: ' + e.message);
  }
}

function saveSettings() {
  const s = S.cfg.themeSettings || {};
  s.themeMode = document.getElementById('settings-theme-mode')?.value || 'dark';
  s.accentColor = document.getElementById('settings-accent-color')?.value || '#89b4fa';
  s.fontScale = document.getElementById('settings-font-scale')?.value || '1';
  s.cardTextScale = document.getElementById('settings-card-text-scale')?.value || '1';
  s.cardOpacity = document.getElementById('settings-card-opacity')?.value || '0.96';
  s.showCategoryBadge = document.getElementById('settings-show-category-badge')?.checked;
  s.bgType = document.getElementById('settings-bg-type')?.value || 'gradient';
  s.bgSolid = document.getElementById('settings-bg-solid')?.value || '#090910';
  s.bgColor1 = document.getElementById('settings-bg-color1')?.value || '#090910';
  s.bgColor2 = document.getElementById('settings-bg-color2')?.value || '#0e0e1a';
  s.bgAngle = document.getElementById('settings-bg-angle')?.value || '135';
  s.bgImageUrl = document.getElementById('settings-bg-image-url')?.value.trim() || '';
  s.bgOverlay = document.getElementById('settings-bg-overlay')?.value || '0.16';
  if (s.bgType !== 'image') {
    s.bgImageLocal = '';
  } else if (s.bgImageUrl) {
    s.bgImageLocal = '';
  }
  S.cfg.themeSettings = s;
  applyThemeSettings();
  saveData();
  closeModal();
  render();
  showToast('Settings saved.');
}

function resetThemeSettings() {
  S.cfg.themeSettings = {
    themeMode: 'dark',
    accentColor: '#89b4fa',
    bgType: 'solid',
    bgSolid: '#000000',
    bgColor1: '#0b1021',
    bgColor2: '#111827',
    bgAngle: '140',
    bgImageUrl: '',
    bgImageLocal: '',
    bgOverlay: '0.18',
    cardOpacity: '0.96',
    cardRadius: '14',
    cardShadow: 'medium',
    showCategoryBadge: true,
    fontScale: '1',
    cardTextScale: '1',
  };
  applyThemeSettings();
  populateSettingsModal();
}

function applyThemeSettings() {
  const s = S.cfg.themeSettings || {};
  const root = document.documentElement;
  root.style.setProperty('--accent', s.accentColor || '#89b4fa');
  root.style.setProperty('--card-opacity', s.cardOpacity || '1');
  root.style.setProperty('--card-text-scale', s.cardTextScale || '1');
  root.style.setProperty('--card-radius', `${s.cardRadius || 12}px`);
  const shadowMap = {
    none: 'none',
    medium: '0 4px 16px rgba(0,0,0,0.15)',
    strong: '0 12px 40px rgba(0,0,0,0.25)',
  };
  root.style.setProperty('--card-shadow', shadowMap[s.cardShadow] || shadowMap.medium);
  root.style.setProperty('--card-hover-shadow', shadowMap.strong);
  root.style.setProperty('--font-scale', s.fontScale || '1');
  if (s.bgType === 'solid') {
    root.style.setProperty('--bg', s.bgSolid || '#090910');
    root.style.setProperty('--bg-image', 'none');
  } else if (s.bgType === 'gradient') {
    const c1 = s.bgColor1 || '#090910';
    const c2 = s.bgColor2 || '#0e0e1a';
    root.style.setProperty('--bg', `linear-gradient(${s.bgAngle || 135}deg, ${c1} 0%, ${c2} 100%)`);
    root.style.setProperty('--bg-image', 'none');
    root.style.setProperty('--bg-image-size', 'cover');
    root.style.setProperty('--bg-image-position', 'center center');
    root.style.setProperty('--bg-image-repeat', 'no-repeat');
  } else {
    const imageUrl = (s.bgImageLocal && S.assetUrls[s.bgImageLocal]) ? S.assetUrls[s.bgImageLocal] : s.bgImageUrl;
    root.style.setProperty('--bg', '#090910');
    root.style.setProperty('--bg-image', imageUrl ? `url("${imageUrl}")` : 'none');
    root.style.setProperty('--bg-image-size', 'cover');
    root.style.setProperty('--bg-image-position', 'center center');
    root.style.setProperty('--bg-image-repeat', 'no-repeat');
  }
  root.style.setProperty('--bg-overlay', s.bgOverlay || '0.16');
  if (s.themeMode === 'light') {
    root.style.setProperty('--bg2', '#f5f5f8');
    root.style.setProperty('--surface', 'rgba(255,255,255,0.85)');
    root.style.setProperty('--surface2', 'rgba(255,255,255,0.92)');
    root.style.setProperty('--surface3', 'rgba(255,255,255,0.96)');
    root.style.setProperty('--border', 'rgba(15,15,20,0.12)');
    root.style.setProperty('--border2', 'rgba(15,15,20,0.18)');
    root.style.setProperty('--text', '#111827');
    root.style.setProperty('--text2', '#374151');
    root.style.setProperty('--text3', '#6b7280');
  } else if (s.themeMode === 'system') {
    root.style.removeProperty('--bg2');
    root.style.removeProperty('--surface');
    root.style.removeProperty('--surface2');
    root.style.removeProperty('--surface3');
    root.style.removeProperty('--border');
    root.style.removeProperty('--border2');
    root.style.removeProperty('--text');
    root.style.removeProperty('--text2');
    root.style.removeProperty('--text3');
  } else {
    root.style.setProperty('--bg2', '#0e0e1a');
    root.style.setProperty('--surface', 'rgba(255,255,255,0.04)');
    root.style.setProperty('--surface2', 'rgba(255,255,255,0.07)');
    root.style.setProperty('--surface3', 'rgba(255,255,255,0.10)');
    root.style.setProperty('--border', 'rgba(255,255,255,0.07)');
    root.style.setProperty('--border2', 'rgba(255,255,255,0.13)');
    root.style.setProperty('--text', '#cdd6f4');
    root.style.setProperty('--text2', '#a6adc8');
    root.style.setProperty('--text3', '#585b70');
  }
}

function openSettingsModal() {
  openModal(`
    <div class="modal-header">
      <h2>Settings</h2>
      <button class="btn-icon" aria-label="Close" onclick="closeModal()"><i data-lucide="X" style="width:15px;height:15px"></i></button>
    </div>
    <div class="modal-body settings-modal-body">
      <div class="settings-grid">
        <section class="settings-section">
          <h3>General</h3>
          <label>Theme Mode</label>
          <select id="settings-theme-mode" class="form-input">
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </select>
          <label>Accent Color</label>
          <input type="color" id="settings-accent-color" class="form-input" value="#89b4fa">
          <label>Font Scale</label>
          <input type="range" id="settings-font-scale" class="form-input" min="0.8" max="1.4" step="0.05" value="1" oninput="document.getElementById('settings-font-scale-value').textContent = Math.round(this.value * 100) + '%'">
          <div class="settings-helper"><span id="settings-font-scale-value">100%</span></div>
          <label>Card Text Scale</label>
          <input type="range" id="settings-card-text-scale" class="form-input" min="0.8" max="1.6" step="0.05" value="1" oninput="document.getElementById('settings-card-text-scale-value').textContent = Math.round(this.value * 100) + '%'">
          <div class="settings-helper"><span id="settings-card-text-scale-value">100%</span></div>
          <label><input type="checkbox" id="settings-show-category-badge"> Show category badges</label>
          <label>Card Opacity</label>
          <input type="range" id="settings-card-opacity" class="form-input" min="0.4" max="1" step="0.02" value="0.96" oninput="document.getElementById('settings-card-opacity-value').textContent = Math.round(this.value*100) + '%'">
          <div class="settings-helper"><span id="settings-card-opacity-value">96%</span></div>
        </section>
        <section class="settings-section">
          <h3>Background</h3>
          <label>Background Type</label>
          <select id="settings-bg-type" class="form-input" onchange="toggleBgOptions()">
            <option value="solid">Solid</option>
            <option value="gradient">Gradient</option>
            <option value="image">Image</option>
          </select>
          <div id="bg-solid-options" class="bg-options">
            <label>Solid Color</label>
            <input type="color" id="settings-bg-solid" class="form-input" value="#000000">
          </div>
          <div id="bg-gradient-options" class="bg-options">
            <label>Gradient Color 1</label>
            <input type="color" id="settings-bg-color1" class="form-input" value="#090910">
            <label>Gradient Color 2</label>
            <input type="color" id="settings-bg-color2" class="form-input" value="#0e0e1a">
            <label>Angle</label>
            <input type="number" id="settings-bg-angle" class="form-input" min="0" max="360" value="135">
          </div>
          <div id="bg-image-options" class="bg-options hidden">
            <label>Image URL</label>
            <input type="text" id="settings-bg-image-url" class="form-input" placeholder="https://example.com/bg.jpg">
            <label>Upload Background</label>
            <input type="file" id="settings-bg-image-upload" class="form-input" accept="image/*" onchange="handleBackgroundUpload(this)">
            <label>Overlay Opacity</label>
            <input type="range" id="settings-bg-overlay" class="form-input" min="0" max="0.6" step="0.05" value="0.16" oninput="document.getElementById('settings-bg-overlay-value').textContent = Math.round(this.value * 100) + '%'">
            <div class="settings-helper"><span id="settings-bg-overlay-value">16%</span></div>
          </div>
        </section>
      </div>
      <section class="settings-section settings-preview-panel">
        <h3>Preview</h3>
        <div class="settings-preview" id="settings-preview">Main page appearance will update after saving.</div>
      </section>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn--ghost" onclick="resetThemeSettings()">Reset Defaults</button>
      <div class="spacer"></div>
      <button type="button" class="btn btn--ghost" onclick="closeModal()">Cancel</button>
      <button type="button" class="btn btn--primary" onclick="saveSettings()">Save Settings</button>
    </div>`);
  populateSettingsModal();
}


function openCategoryEditModal() {
  const categories = S.data.categories || [];
  const rows = categories.map(cat => {
    return `
      <div class="delete-category-row">
        <div>
          <strong>${esc(cat.name)}</strong>
        </div>
        <button type="button" class="btn btn--primary" data-cat-id="${esc(cat.id)}" onclick="closeModal(); openCategoryModal(this.dataset.catId)">
          <i data-lucide="Pencil" style="width:13px;height:13px"></i> Edit
        </button>
      </div>`;
  }).join('');

  openModal(`
    <div class="modal-header">
      <h2>Edit Category</h2>
      <button class="btn-icon" aria-label="Close" onclick="closeModal()"><i data-lucide="X" style="width:15px;height:15px"></i></button>
    </div>
    <div class="modal-body">
      ${rows || '<p class="hint">No categories available to edit.</p>'}
    </div>
  `);
}


function openGroupModal(groupId) {
    let group = null;
    if (groupId && S.cfg.groups) {
        group = S.cfg.groups.find(g => g.id === groupId);
    }

    openModal(`
    <div class="modal-header">
      <h2>${group ? 'Edit Group' : 'New Group'}</h2>
      ${group ? `<button type="button" class="btn btn--danger" style="margin-right: 12px;" data-group-id="${esc(groupId)}" onclick="deleteGroup(this.dataset.groupId)">
          <i data-lucide="Trash2" style="width:13px;height:13px"></i> Delete
      </button>` : ''}
      <button class="btn-icon" aria-label="Close" onclick="closeModal()"><i data-lucide="X" style="width:15px;height:15px"></i></button>
    </div>
    <div class="modal-body">
      <form id="group-form" data-group-id="${esc(groupId || '')}" onsubmit="submitGroup(event)">
        <div class="form-row">
          <label for="grp-title">Group Title</label>
          <input id="grp-title" type="text" name="title" class="form-input" required
            value="${esc(group?.title || '')}" placeholder="My Group">
        </div>
        <div class="form-row">
          <label>Appearance</label>
          <div style="display:flex; gap:8px;">
             <input type="text" name="bgColor" class="form-input" placeholder="Background Color (e.g. #333, rgba...)" value="${esc(group?.bgColor || '')}">
             <input type="text" name="textColor" class="form-input" placeholder="Text Color" value="${esc(group?.textColor || '')}">
          </div>
        </div>
        <div class="form-row">
          <label>Background Image URL</label>
          <input type="text" name="bgImage" class="form-input" placeholder="https://..." value="${esc(group?.bgImage || '')}">
        </div>
        <div class="form-row">
          <label>Text Style</label>
          <div style="display:flex; gap:16px;">
             <label class="custom-checkbox">
               <input type="checkbox" name="textWeight" value="bold" ${group?.textWeight === 'bold' ? 'checked' : ''}>
               <div class="checkbox-box"></div>
               Bold
             </label>
             <label class="custom-checkbox">
               <input type="checkbox" name="textItalic" value="true" ${group?.textItalic ? 'checked' : ''}>
               <div class="checkbox-box"></div>
               Italic
             </label>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn--primary">Save</button>
        </div>
      </form>
    </div>
  `);
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function submitGroup(e) {
    const groupId = e.target.dataset.groupId;
    e.preventDefault();
    const fd = new FormData(e.target);
    const title = fd.get('title').trim();
    const bgColor = fd.get('bgColor').trim();
    const textColor = fd.get('textColor').trim();
    const bgImage = fd.get('bgImage').trim();
    const textWeight = fd.get('textWeight');
    const textItalic = fd.get('textItalic') === 'true';

    if (!S.cfg.groups) S.cfg.groups = [];

    if (groupId) {
        const group = S.cfg.groups.find(g => g.id === groupId);
        if (group) {
            Object.assign(group, { title, bgColor, textColor, bgImage, textWeight, textItalic });
        }
    } else {
        const newGroup = {
            id: `grp-${uid()}`,
            title,
            bgColor,
            textColor,
            bgImage,
            textWeight,
            textItalic
        };
        S.cfg.groups.push(newGroup);
    }

    closeModal();
    render();
    saveData();
}

function deleteGroup(groupId) {
    if (!confirm("Delete this group? The cards inside it will not be deleted, they will just be removed from the group.")) return;
    if (S.cfg.groups) {
        S.cfg.groups = S.cfg.groups.filter(g => g.id !== groupId);

        // Remove any cards that were attached to this group
        if (S.cfg.cardPositions) {
            for (const bmId in S.cfg.cardPositions) {
                if (S.cfg.cardPositions[bmId].groupId === groupId) {
                    delete S.cfg.cardPositions[bmId].groupId;
                }
            }
        }
    }
    closeModal();
    render();
    saveData();
}

function openCategoryDeleteModal() {
  const categories = S.data.categories || [];
  const rows = categories.map(cat => {
    const isMaster = isMasterCategory(cat.id);
    return `
      <div class="delete-category-row">
        <div>
          <strong>${esc(cat.name)}</strong>
          <div class="hint-text">${isMaster ? 'Provided by master file — will be hidden.' : 'User-created category — will be deleted.'}</div>
        </div>
        <button type="button" class="btn ${isMaster ? 'btn--ghost' : 'btn--danger'}" data-cat-id="${esc(cat.id)}" onclick="deleteCategory(this.dataset.catId)">
          <i data-lucide="${isMaster ? 'EyeOff' : 'Trash2'}" style="width:13px;height:13px"></i>
          ${isMaster ? 'Hide' : 'Delete'}
        </button>
      </div>`;
  }).join('');

  openModal(`
    <div class="modal-header">
      <h2>Delete or Hide Category</h2>
      <button class="btn-icon" aria-label="Close" onclick="closeModal()"><i data-lucide="X" style="width:15px;height:15px"></i></button>
    </div>
    <div class="modal-body">
      <p class="hint-text">Select a category to remove. Master-provided categories can only be hidden.</p>
      ${rows || '<div class="hint-text">No categories available.</div>'}
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn--ghost" onclick="closeModal()">Cancel</button>
    </div>`);
}

function deleteCategory(catId) {
  const isMaster = isMasterCategory(catId);
  if (isMaster) {
    hideItem('categories', catId);
    showToast('Master category hidden.');
  } else {
    if (!confirm('Delete this category and all user-created bookmarks inside it?')) return;
    S.data.categories = S.data.categories.filter(c => c.id !== catId);
    S.cfg.userCategories = (S.cfg.userCategories || []).filter(c => c.id !== catId);
    S.cfg.userBookmarks = (S.cfg.userBookmarks || []).filter(b => b.categoryId !== catId);
    showToast('Category deleted.');
  }
  closeModal();
  render();
  saveData();
}

function deleteMasterBookmark(catId, bmId) {
  if (!confirm('Delete this master bookmark?')) return;
  const cat = S.masterData.categories.find(c => c.id === catId);
  if (!cat) return;
  cat.bookmarks = cat.bookmarks.filter(b => b.id !== bmId);
  populateMasterEditorVisual();
}

function confirmDeleteBookmark(bmId, catId) {
  if (!confirm('Delete this bookmark? This cannot be undone.')) return;
  deleteBookmark(bmId, catId);
}

function deleteBookmark(bmId, catId) {
  const category = S.data.categories.find(c => c.id === catId);
  if (!category) return;
  category.bookmarks = category.bookmarks.filter(b => b.id !== bmId);
  S.cfg.userBookmarks = (S.cfg.userBookmarks || []).filter(b => b.id !== bmId);
  closeModal();
  render();
  saveData();
  showToast('Bookmark deleted.');
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
    let url = S.assetUrls[icon.value];
    if (!url && S.cfg.masterAssetsUrl) url = S.cfg.masterAssetsUrl + '/' + icon.value;
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

  const hideCatBadge = cs.hideCategoryBadge || (S.cfg.themeSettings?.showCategoryBadge === false);
  const isBgImage = cs.bgImage && (bm.icon?.type === 'url' || bm.icon?.type === 'local');
  let bgImgSrc = null;
  if (isBgImage) {
    if (bm.icon.type === 'url') {
      bgImgSrc = esc(bm.icon.value);
    } else {
      bgImgSrc = S.assetUrls[bm.icon.value];
      if (!bgImgSrc && S.cfg.masterAssetsUrl) bgImgSrc = S.cfg.masterAssetsUrl + '/' + bm.icon.value;
    }
  }

  const cardOpacity = cs.cardOpacity !== undefined ? cs.cardOpacity : (S.cfg.themeSettings?.cardOpacity || 1);
  const cardTextScale = cs.textSize ? parseFloat(cs.textSize) : 1;
  const cardColorStyle = cs.cardColor ? (isBgImage ? `background-color:${esc(cs.cardColor)}` : `background:${esc(cs.cardColor)}`) : '';
  const bgImageStyle = isBgImage && bgImgSrc ? `background-image:url("${bgImgSrc}");background-size:cover;background-position:center center;background-repeat:no-repeat` : '';
  const inlineStyle = [
    pos.w ? `width:${pos.w}px` : '',
    pos.h ? `height:${pos.h}px` : '',
    !(S.activeCat || S.query) && pos.groupId && pos.x !== undefined ? `left:${pos.x}px !important; top:${pos.y}px !important;` : '',
    `--card-opacity:${cardOpacity}`,
    `--card-local-text-scale:${cardTextScale}`,
    cardColorStyle,
    bgImageStyle,
    cs.borderColor ? `border-color:${esc(cs.borderColor)}` : '',
    cs.textColor ? `color:${esc(cs.textColor)}; --text:${esc(cs.textColor)}; --text3:${esc(cs.textColor)};` : '',
    cs.textWeight === 'bold' && !cs.hideText ? 'font-weight:bold' : '',
    cs.textItalic && !cs.hideText ? 'font-style:italic' : '',
  ].filter(Boolean).join(';');

  const catColor   = esc(cat?.color || '#6366f1');
  const catBadge   = hideCatBadge ? '' : `<span class="card-cat-badge" style="background:${catColor}22;color:${catColor};border-color:${catColor}44">
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
    ? `<button class="btn-icon btn-icon--unhide" title="Unhide" aria-label="Unhide bookmark" onclick="unhideItem('bookmarks', this.closest('.card').dataset.id)">
         <i data-lucide="Eye" style="width:12px;height:12px"></i>
       </button>`
    : `<button class="btn-icon btn-icon--hide" title="Hide from view" aria-label="Hide bookmark" onclick="hideItem('bookmarks', this.closest('.card').dataset.id)">
         <i data-lucide="EyeOff" style="width:12px;height:12px"></i>
       </button>`;

  const classes = ['card',
    hidden  ? 'card--hidden' : '',
    dimmed  ? 'card--dim'    : '',
    pos.groupId ? 'card--grouped' : '',
  ].filter(Boolean).join(' ');

  return `
    <div class="${classes}" data-id="${esc(bm.id)}" data-cat="${esc(catId)}" style="${inlineStyle}">
      <div class="card-drag-handle">
        <i data-lucide="GripVertical" style="width:11px;height:11px"></i>
      </div>
      <a href="${esc(sanitizeUrl(bm.url))}" target="_blank" rel="noreferrer" class="card-link"
         onclick="trackClick(event, this.closest('.card').dataset.id, this.closest('.card').dataset.cat)">
        ${bgImgSrc ? `<img src="${bgImgSrc}" class="card-bg-image">` : ''}
        ${cs.hideIcon ? '' : `<div class="card-icon-wrap">${renderIcon(bm.icon, 20)}</div>`}
        ${cs.hideText ? '' : `
        <div class="card-body">
          <div class="card-title">${esc(bm.title)}</div>
          ${bm.description ? `<div class="card-desc">${esc(bm.description)}</div>` : ''}
          <div class="card-meta">${catBadge}${protoTag}${tags}${hiddenBadge}${clicks}</div>
        </div>`}
      </a>
      <div class="card-actions" onclick="event.stopPropagation()">
        ${pos.groupId ? `<button class="btn-icon" title="Remove from Group" aria-label="Remove from group" onclick="removeFromGroup(this.closest('.card').dataset.id)">
          <i data-lucide="ListMinus" style="width:12px;height:12px"></i>
        </button>` : ''}
        <button class="btn-icon btn-icon--edit" title="Edit" aria-label="Edit bookmark" onclick="openCardModal(this.closest('.card').dataset.cat, this.closest('.card').dataset.id)">
          <i data-lucide="Pencil" style="width:12px;height:12px"></i>
        </button>
        ${hideBtn}
      </div>
    </div>`;
}

// Flat list of all visible cards for the canvas layout

function renderGroup(group, innerHTML = '') {
    const pos = S.cfg.cardPositions?.[group.id] || { x: 0, y: 0 };
    const inlineStyle = [
        pos.w ? `width:${pos.w}px` : '',
        pos.h ? `height:${pos.h}px` : '',
        group.bgImage ? `background-image:url('${esc(group.bgImage)}');background-size:cover;background-position:center;` : '',
        group.bgColor ? `background-color:${esc(group.bgColor)};` : '',
        group.textColor ? `color:${esc(group.textColor)};--text:${esc(group.textColor)};` : ''
    ].filter(Boolean).join(';');

    return `
    <div class="card card--group" data-id="${esc(group.id)}" style="${inlineStyle}">
      <div class="card-drag-handle group-drag-handle">
         <i data-lucide="GripHorizontal" style="width:14px;height:14px;opacity:0.5"></i>
      </div>
      <div class="group-header">
         <h3 style="${group.textWeight === 'bold' ? 'font-weight:bold;' : ''} ${group.textItalic ? 'font-style:italic;' : ''}">
           ${esc(group.title || 'Group')}
         </h3>
      </div>
      <div class="group-content">
          ${innerHTML}
      </div>
      <div class="card-actions" onclick="event.stopPropagation()">
        <button class="btn-icon btn-icon--edit" title="Edit" aria-label="Edit group" onclick="openGroupModal(this.closest('.card').dataset.id)">
          <i data-lucide="Pencil" style="width:12px;height:12px"></i>
        </button>
      </div>
    </div>`;
}

function renderAllCards() {
  let cardsHtml = '';

  // ⚡ Bolt optimization: Use Sets for O(1) hidden status lookups instead of O(n) array scans
  const hiddenCats = new Set(S.cfg.hidden?.categories || []);
  const hiddenBms = new Set(S.cfg.hidden?.bookmarks || []);

  if (S.cfg.groups) {
      for (const group of S.cfg.groups) {
          // Only render groups if NO active category is selected (otherwise we just want a flat list)
          if (!S.activeCat) {
              html += renderGroup(group);
          }
      }
  }

  for (const cat of S.data.categories) {
    const catHidden  = hiddenCats.has(cat.id);
    if (!S.showHidden && catHidden) continue;

    for (const bm of cat.bookmarks) {
      const bmHidden = hiddenBms.has(bm.id);
      if (!S.showHidden && bmHidden) continue;

      // If a category filter is active, entirely skip cards not in that category
      if (S.activeCat && S.activeCat !== cat.id) continue;
      const dimmed = false;

      const pos = S.cfg.cardPositions?.[bm.id];
      if (!S.activeCat && pos && pos.groupId) {
         // This card belongs to a group, defer rendering to that group
         if (!window._groupHtml) window._groupHtml = {};
         if (!window._groupHtml[pos.groupId]) window._groupHtml[pos.groupId] = '';
         window._groupHtml[pos.groupId] += renderCard(bm, cat, dimmed);
      } else {
         cardsHtml += renderCard(bm, cat, dimmed);
      }
    }
  }

  let html = '';
  if (S.cfg.groups) {
      for (const group of S.cfg.groups) {
          // Only render groups if NO active category is selected (otherwise we just want a flat list)
          if (!S.activeCat) {
              const content = window._groupHtml?.[group.id] || '';
              html += renderGroup(group, content);
          }
      }
  }
  window._groupHtml = {};

  return html + cardsHtml;
}


function renderSearchResults() {
  const rows = [];
  const hiddenCats = new Set(S.cfg.hidden?.categories || []);
  const hiddenBms = new Set(S.cfg.hidden?.bookmarks || []);

  for (const cat of S.data.categories) {
    if (!S.showHidden && hiddenCats.has(cat.id)) continue;
    // ⚡ Bolt: Hoist loop-invariant category name match to avoid redundant work per bookmark
    const catMatch = fuzzyMatch(cat.name || '', S.query);

    for (const bm of cat.bookmarks) {
      if (!S.showHidden && hiddenBms.has(bm.id)) continue;
      const match = catMatch ||
        fuzzyMatch(bm.title,            S.query) ||
        fuzzyMatch(bm.url,              S.query) ||
        fuzzyMatch(bm.description||'',  S.query) ||
        (bm.tags||[]).some(t => fuzzyMatch(t, S.query));
      if (!match) continue;
      rows.push({ bm, cat });
    }
  }

  if (!rows.length) {
    return `
      <div class="empty-state">
        <i data-lucide="SearchX" style="width:48px;height:48px"></i>
        <p>No results found for "${esc(S.query)}"</p>
        <button class="btn btn--primary" onclick="handleSearch('')">
          <i data-lucide="X" style="width:13px;height:13px"></i> Clear Search
        </button>
      </div>`;
  }

  return `
    <div class="search-results search-results--cards">
      ${rows.map(({ bm, cat }) => renderCard(bm, cat, false, true)).join('')}
    </div>`;
}

function render() {
  applyThemeSettings();
  if (S.dir && !S.query) autoArrangeCards(); // fill in positions for any new cards before DOM build
  const app = document.getElementById('app');
  app.innerHTML = S.dir ? renderDashboard() : renderConnect();
  if (typeof lucide !== 'undefined') lucide.createIcons();
  if (S.dir) { initFreeDrag(); applyLayout(); }
}

function promptMasterFileIfNeeded() {
  if (!S.dir || S.masterHandle || S.cfg.masterPrompted) return;
  openMasterFileModal();
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
  // Let the wrapper know if it's search or filtered
  const isSearchOrFilter = S.query || S.activeCat;
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
        style="--pill-color:${esc(cat.color||'#6366f1')}" data-cat-id="${esc(cat.id)}"
        onclick="setActiveCat(this.dataset.catId)" title="${esc(cat.name)}">
        ${renderIcon({ type:'lucide', value: cat.icon||'Folder' }, 12)}
        <span>${esc(cat.name)}</span>
        <span class="cat-pill-count">${visCount}</span>
      </button>`;
  }).join('');

  const masterBanner = S.pendingMasterHandle
    ? `<div class="master-banner">
         <p><strong>Master file access expired.</strong> Grant access to resume using the shared master file.</p>
         <button class="btn btn--primary" onclick="handleResumeMaster()">Resume Shared Master File</button>
       </div>`
    : (!S.masterHandle && !S.cfg.masterFileUrl && !S.cfg.masterPrompted)
      ? `<div class="master-banner">
           <p><strong>Master file not configured.</strong> Select or create a shared master file to get started.</p>
           <button class="btn btn--ghost" onclick="openMasterFileModal()">Configure Master File</button>
         </div>`
      : '';

  return `
    ${masterBanner}
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
        ${(S.masterAssetsHandle || S.cfg.masterAssetsUrl) ? `<div class="dir-badge" title="Master assets loaded">
          <i data-lucide="Image" style="width:11px;height:11px"></i>
          <span>Master assets</span>
        </div>` : ''}
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
        <button class="btn btn--primary" onclick="openNewBookmarkModal()" title="Add bookmark">
          <i data-lucide="Plus" style="width:13px;height:13px"></i>
          <span>Bookmark</span>
        </button>
      </div>
    </header>

    <div class="cat-filter-bar">
      ${catPills}
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
        ${S.query ? renderSearchResults() : renderAllCards()}
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

async function publishBookmark(catId, bmId) {
  if (!confirm("Are you sure you want to publish this bookmark to the master file for everyone to see?")) return;

  const cat = S.data.categories.find(c => c.id === catId);
  const bm = cat?.bookmarks.find(b => b.id === bmId);
  if (!cat || !bm) return;

  // Check if master category exists
  let masterCat = S.masterData.categories.find(c => c.id === cat.id || c.name === cat.name);
  if (!masterCat) {
     masterCat = {
       id: cat.__master ? cat.id : `cat-${uid()}`,
       name: cat.name,
       icon: cat.icon,
       color: cat.color,
       bookmarks: []
     };
     S.masterData.categories.push(masterCat);
  }

  // Check for dupes
  const exists = masterCat.bookmarks.find(b => b.url === bm.url);
  if (exists) {
    const keepLocal = confirm(`This URL already exists in the master file under ${masterCat.name}. Do you want to hide the master's version and keep your local edits visible?`);
    if (keepLocal) {
      if (!S.cfg.hidden) S.cfg.hidden = { bookmarks: [], categories: [] };
      if (!S.cfg.hidden.bookmarks.includes(exists.id)) {
        S.cfg.hidden.bookmarks.push(exists.id);
      }
      showToast('Master version hidden. Your local version is visible.');
    } else {
      deleteBookmark(bm.id, cat.id);
      showToast('Local duplicate deleted. Master version is now visible.');
    }
    saveData();
    closeModal();
    render();
    return;
  }

  const masterBm = {
    id: `bm-${uid()}`,
    title: bm.title,
    url: bm.url,
    description: bm.description,
    tags: bm.tags,
    icon: bm.icon,
    clicks: bm.clicks,
    customStyle: bm.customStyle
  };

  masterCat.bookmarks.push(masterBm);

  // Save to master
  await writeMasterJSON(S.masterData);

  // Optionally delete local version since it's now in master
  if (confirm("Published successfully! Do you want to delete your local copy since it is now in the master file?")) {
    cat.bookmarks = cat.bookmarks.filter(b => b.id !== bmId);
    S.cfg.userBookmarks = (S.cfg.userBookmarks || []).filter(b => b.id !== bmId);
  }

  mergeData();
  saveData();
  closeModal();
  render();
}


function addTagBubble(val) {
   val = val.trim();
   if (!val) return;
   const container = document.getElementById('tag-bubbles');

   // Don't add if already exists visually
   for(const bubble of container.querySelectorAll('.tag-bubble')) {
       if(bubble.textContent.replace('×', '').trim() === val) return;
   }

   const span = document.createElement('span');
   span.className = 'tag-bubble';
   span.innerHTML = `${esc(val)} <button type="button" class="tag-remove" onclick="this.parentElement.remove(); updateTagsInput()">&times;</button>`;
   container.appendChild(span);
   updateTagsInput();
}

function updateTagsInput() {
   const container = document.getElementById('tag-bubbles');
   const tags = Array.from(container.querySelectorAll('.tag-bubble')).map(el => el.textContent.replace('×', '').trim());
   document.getElementById('bm-tags-hidden').value = tags.join(',');
}

function openNewCategoryFromEditor() {
   closeModal(); // close current bookmark modal
   openCategoryModal(null);
}

function openCardModal(catId, bmId) {
  const cat    = S.data.categories.find(c => c.id === catId);
  const bm     = bmId ? cat?.bookmarks.find(b => b.id === bmId) : null;
  const bmHidden = bm ? isHidden('bookmarks', bmId) : false;
  const iType  = bm?.icon?.type || 'lucide';
  const iVal   = bm?.icon?.value || 'Link';
  const cs     = bm?.customStyle || {};
  const isMaster = bm?.__master;

  const iconGrid = LUCIDE_ICONS.map(n => `
    <button type="button" aria-label="${n} icon" class="icon-option ${iType === 'lucide' && iVal === n ? 'selected' : ''}"
      data-icon="${n}" onclick="pickLucideIcon(this, this.dataset.icon)">
      <i data-lucide="${n}" style="width:16px;height:16px"></i>
    </button>`).join('');

  const localAssets = Object.keys(S.assetUrls || {});
  const catOptions = [...S.data.categories].sort((a,b) => a.name.localeCompare(b.name)).map(c =>
    `<option value="${c.id}" ${c.id === catId ? 'selected' : ''}>${esc(c.name)}</option>`).join('');

  openModal(`
    <div class="modal-header">
      <h2>${bm ? 'Edit Bookmark' : 'New Bookmark'}</h2>
      ${bm && !isMaster ? `<button type="button" class="btn btn--primary" style="margin-right: 12px;" data-cat-id="${esc(catId)}" data-bm-id="${esc(bmId)}" onclick="publishBookmark(this.dataset.catId, this.dataset.bmId)">
          <i data-lucide="UploadCloud" style="width:13px;height:13px"></i> Publish to Master
      </button>` : ''}
      <button class="btn-icon" aria-label="Close" onclick="closeModal()"><i data-lucide="X" style="width:15px;height:15px"></i></button>
    </div>
    <div class="modal-body">
      <form id="card-form" data-cat-id="${esc(catId)}" data-bm-id="${esc(bmId||'')}" onsubmit="submitCard(event)">
        <div class="form-row">
          <label for="bm-title">Title *</label>
          <input id="bm-title" type="text" name="title" class="form-input" required
            value="${esc(bm?.title||'')}" placeholder="My Bookmark" ${isMaster ? 'readonly' : ''}>
        </div>
        <div class="form-row">
          <label for="bm-url">URL *</label>
          <input id="bm-url" type="text" name="url" class="form-input" required
            value="${esc(bm?.url||'')}" placeholder="https://… or file:/// or vscode://…" ${isMaster ? 'readonly' : ''}>
        </div>
        ${isMaster ? '<p class="hint-text">Title and URL are managed by the shared master file and cannot be changed here.</p>' : ''}
        <div class="form-row">
          <label for="bm-desc">Description</label>
          <textarea id="bm-desc" name="description" class="form-input form-textarea"
            placeholder="Optional notes…">${esc(bm?.description||'')}</textarea>
        </div>
        <div class="form-row">
          <label>Tags</label>
          <div class="tag-input-container">
             <div id="tag-bubbles" style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:4px;">
                 ${(bm?.tags||[]).map(t => `<span class="tag-bubble">${esc(t)} <button type="button" class="tag-remove" onclick="this.parentElement.remove(); updateTagsInput()">&times;</button></span>`).join('')}
             </div>
             <input type="hidden" id="bm-tags-hidden" name="tags" value="${esc((bm?.tags||[]).join(','))}">
             <input id="bm-tags-input" type="text" class="form-input" placeholder="Type a tag and press Enter/Comma"
                onkeydown="if(event.key==='Enter'||event.key===','){event.preventDefault(); addTagBubble(this.value); this.value='';}">
          </div>
        </div>
        <div class="form-row">
          <label for="bm-category">Category</label>
          <div style="display:flex; gap:8px;">
            <select id="bm-category" name="categoryId" class="form-input" style="flex:1;" ${isMaster ? 'disabled' : ''}>
              ${catOptions}
            </select>
            <button type="button" class="btn btn--ghost" onclick="openNewCategoryFromEditor()" title="New Category">
               <i data-lucide="Plus" style="width:14px;height:14px"></i>
            </button>
          </div>
          ${isMaster ? '<p class="hint-text">Master bookmarks cannot be moved between categories.</p>' : ''}
        </div>

        <div class="form-row">
          <label><input type="checkbox" name="hideIconMain" ${cs.hideIcon ? 'checked' : ''}> Hide icon on card</label>
          <p class="hint-text">Hide the icon entirely.</p>
        </div>
        <div class="form-row">
          <label><input type="checkbox" name="hideCategoryBadge" ${cs.hideCategoryBadge ? 'checked' : ''}> Hide category badge on card</label>
          <p class="hint-text">Keep the card cleaner by hiding the category label.</p>
        </div>
        <div class="form-row">
          <label>Card Opacity <span class="hint-inline">(override)</span></label>
          <input type="range" id="card-opacity" name="cardOpacity" class="form-input" min="0.4" max="1" step="0.02" value="${cs.cardOpacity||''}" oninput="document.getElementById('card-opacity-value').textContent = this.value ? Math.round(this.value*100)+'%' : 'inherit'">
          <div class="settings-helper"><span id="card-opacity-value">${cs.cardOpacity ? Math.round(cs.cardOpacity*100) + '%' : 'inherit'}</span></div>
          <p class="hint-text">Override the global card opacity for this bookmark.</p>
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
            <div class="form-row">
              <input type="file" class="form-input" accept="image/*" onchange="handleIconUpload(this)">
            </div>
            <div class="form-row">
              <label for="local-asset-purpose">Use uploaded asset as</label>
              <select id="local-asset-purpose" name="localAssetPurpose" class="form-input" onchange="setIconPurpose(this.value)">
                <option value="icon" ${iType==='local' && !cs.bgImage ? 'selected' : ''}>Icon</option>
                <option value="background" ${iType==='local' && cs.bgImage ? 'selected' : ''}>Background Image</option>
              </select>
            </div>
            ${Object.keys(S.assetUrls || {}).length ? `
            <div class="asset-gallery" style="max-height: 200px; overflow-y: auto; resize: vertical;">
              ${Object.entries(S.assetUrls).map(([name, url]) => `
                <button type="button" class="asset-thumb ${iType==='local' && iVal===name ? 'selected' : ''}"
                  data-asset-name="${esc(name)}" onclick="selectLocalAsset(this.dataset.assetName)">
                  <img src="${url}" alt="Asset" loading="lazy" onmouseenter="showAssetPreview(this.src)" onmouseleave="hideAssetPreview()"/>
                </button>
              `).join('')}
            </div>
            ` : '<p class="hint-text">Upload an image to use it here.</p>'}
            ${iType==='local' && (S.assetUrls[iVal] || S.cfg.masterAssetsUrl)
              ? `<img src="${S.assetUrls[iVal] || (S.cfg.masterAssetsUrl + '/' + iVal)}" class="icon-preview-img">` : ''}
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
        <div class="form-row form-row--cols" id="bg-image-options" style="display:${iType==='url' || iType==='local'?'flex':'none'}">
          <div style="flex:1">
            <label><input type="checkbox" name="useBgImage" ${cs.bgImage?'checked':''}> Use image as background</label>
          </div>
          <div style="flex:1">
            <label><input type="checkbox" name="hideText" ${cs.hideText?'checked':''}> Hide text overlay</label>
          </div>
          <div style="flex:1">
            <label><input type="checkbox" name="hideIcon" ${cs.hideIcon?'checked':''}> Hide icon on card</label>
          </div>
        </div>
        <div class="form-section">Text Formatting <span class="hint-inline">(optional)</span></div>
        <div class="form-row form-row--cols">
          <div>
            <label>Text Color</label>
            <input type="color" name="textColor" value="${cs.textColor||'#ffffff'}" class="color-input">
          </div>
          <div>
            <label>Text Size</label>
            <input type="range" id="card-text-size" name="textSize" class="form-input" min="0.8" max="1.8" step="0.05" value="${cs.textSize ? parseFloat(cs.textSize) : 1}" oninput="document.getElementById('card-text-size-value').textContent = Math.round(this.value * 100) + '%'">
            <div class="settings-helper"><span id="card-text-size-value">${cs.textSize ? Math.round(parseFloat(cs.textSize) * 100) + '%' : '100%'}</span></div>
          </div>
        </div>
        <div class="form-row form-row--cols">
          <div>
            <label><input type="checkbox" name="textBold" ${cs.textWeight==='bold'?'checked':''}> Bold text</label>
          </div>
          <div>
            <label><input type="checkbox" name="textItalic" ${cs.textItalic ? 'checked' : ''}> Italic text</label>
          </div>
        </div>

        <div class="modal-footer">
          ${bm && !isMaster ? `<button type="button" class="btn btn--danger" data-cat-id="${esc(catId)}" data-bm-id="${esc(bm.id)}" onclick="confirmDeleteBookmark(this.dataset.bmId, this.dataset.catId)">
            <i data-lucide="Trash2" style="width:13px;height:13px"></i>
            Delete
          </button>` : ''}
          ${bm ? `<button type="button" class="btn ${bmHidden ? 'btn--primary' : 'btn--ghost'}"
            data-bmid="${esc(bmId)}" onclick="${bmHidden ? 'unhide' : 'hide'}Item('bookmarks', this.dataset.bmid);closeModal()">
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

async function publishCategory(catId) {
  if (!confirm("Are you sure you want to publish this entire category to the master file?")) return;

  const cat = S.data.categories.find(c => c.id === catId);
  if (!cat) return;

  // Check if master category exists
  let masterCat = S.masterData.categories.find(c => c.name === cat.name);
  if (masterCat) {
     alert("A category with this name already exists in the master file. You should move your bookmarks into it manually or publish them individually.");
     return;
  }

  masterCat = {
    id: `cat-${uid()}`,
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
    bookmarks: []
  };

  // Clone bookmarks
  for (const bm of cat.bookmarks) {
    masterCat.bookmarks.push({
      id: `bm-${uid()}`,
      title: bm.title,
      url: bm.url,
      description: bm.description,
      tags: bm.tags,
      icon: bm.icon,
      clicks: bm.clicks,
      customStyle: bm.customStyle
    });
  }

  S.masterData.categories.push(masterCat);

  // Save to master
  await writeMasterJSON(S.masterData);

  if (confirm("Category published successfully! Do you want to delete your local copy since it is now in the master file?")) {
    S.data.categories = S.data.categories.filter(c => c.id !== catId);
    S.cfg.userCategories = (S.cfg.userCategories || []).filter(c => c.id !== catId);
    S.cfg.userBookmarks = (S.cfg.userBookmarks || []).filter(b => b.categoryId !== catId);
  }

  mergeData();
  saveData();
  closeModal();
  render();
}

function openCategoryModal(catId) {
  const cat      = catId ? S.data.categories.find(c => c.id === catId) : null;
  const catHidden = cat ? isHidden('categories', catId) : false;
  const catOverride = cat && cat.__master ? getCategoryOverride(catId) : {};
  const cIcon    = cat ? (catOverride.icon ?? cat.icon) : 'Folder';
  const cColor   = cat ? (catOverride.color ?? cat.color) : CAT_COLORS[0];

  const iconGrid = LUCIDE_ICONS.map(n => `
    <button type="button" aria-label="${n} icon" class="icon-option ${cIcon===n?'selected':''}"
      data-icon="${n}" onclick="pickLucideIcon(this, this.dataset.icon)">
      <i data-lucide="${n}" style="width:16px;height:16px"></i>
    </button>`).join('');

  const swatches = CAT_COLORS.map(c => `
    <button type="button" aria-label="${c} color" class="color-swatch ${c===cColor?'selected':''}"
      style="background:${c}" data-color="${c}" onclick="pickCatColor(this, this.dataset.color)"></button>`).join('');

  openModal(`
    <div class="modal-header">
      <h2>${cat ? 'Edit Category' : 'New Category'}</h2>
      ${cat && !cat.__master ? `<button type="button" class="btn btn--primary" style="margin-right: 12px;" data-cat-id="${esc(catId)}" onclick="publishCategory(this.dataset.catId)">
          <i data-lucide="UploadCloud" style="width:13px;height:13px"></i> Publish to Master
      </button>` : ''}
      <button class="btn-icon" aria-label="Close" onclick="closeModal()"><i data-lucide="X" style="width:15px;height:15px"></i></button>
    </div>
    <div class="modal-body">
      <form id="cat-form" data-cat-id="${esc(catId||'')}" onsubmit="submitCategory(event)">
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
            data-cat-id="${esc(catId)}" onclick="${catHidden ? 'unhide' : 'hide'}Item('categories', this.dataset.catId);closeModal()">
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
  const f = document.getElementById('card-form');
  if (!f) return;
  const input = f.querySelector('[name="iconValue"]');
  if (input) {
    input.setAttribute('value', val);
    input.value = val;
  }
}

function setIconPurpose(value) {
  const f = document.getElementById('card-form');
  if (!f) return;
  const bgToggle = f.querySelector('[name="useBgImage"]');
  const purposeSelect = document.getElementById('local-asset-purpose');
  if (purposeSelect) purposeSelect.value = value;
  if (bgToggle) {
    if (value === 'background') {
      bgToggle.checked = true;
      const bgOptions = document.getElementById('bg-image-options');
      if (bgOptions) bgOptions.style.display = 'flex';
    } else {
      bgToggle.checked = false;
      const bgOptions = document.getElementById('bg-image-options');
      if (bgOptions) bgOptions.style.display = 'none';
    }
  }
}

function selectLocalAsset(name) {
  setIconValue(name);
  const panel = document.getElementById('icon-panel-local');
  panel?.querySelectorAll('.asset-thumb').forEach(btn => btn.classList.remove('selected'));
  const selected = panel?.querySelector(`.asset-thumb[data-asset-name="${esc(name)}"]`);
  if (selected) selected.classList.add('selected');
  const form = document.getElementById('card-form');
  if (form) form.querySelector('[name="iconType"]').value = 'local';
}

async function handleIconUpload(input) {
  if (!input.files[0]) return;
  if (!S.dir) { alert('Connect a directory first.'); return; }
  try {
    const name = await saveAsset(input.files[0]);
    selectLocalAsset(name);
    const panel = document.getElementById('icon-panel-local');
    let img = panel?.querySelector('.icon-preview-img');
    if (!img) { img = document.createElement('img'); img.className = 'icon-preview-img'; panel?.appendChild(img); }
    img.src = S.assetUrls[name];
    setIconPurpose(document.getElementById('local-asset-purpose')?.value || 'icon');
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
async function submitCard(e) {
  const catId = e.target.dataset.catId;
  const bmId = e.target.dataset.bmId;
  // ensure card stays in place
  if (bmId && S.cfg.cardPositions[bmId] && !S.cfg.cardPositions[bmId]._px) {
     S.cfg.cardPositions[bmId]._px = true;
  }
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
  if (fd.get('useBgImage')) {
    cs.bgImage = true;
    cs.hideText = fd.get('hideText') === 'on';
  }
  cs.hideIcon = fd.get('hideIcon') === 'on' || fd.get('hideIconMain') === 'on';
  const textColor = fd.get('textColor');
  if (textColor) cs.textColor = textColor;
  const textSize = fd.get('textSize');
  if (textSize) cs.textSize = textSize;
  if (fd.get('textBold') === 'on') cs.textWeight = 'bold';
  if (fd.get('textItalic') === 'on') cs.textItalic = true;
  if (fd.get('hideCategoryBadge') === 'on') cs.hideCategoryBadge = true;
  const cardOpacity = fd.get('cardOpacity');
  if (cardOpacity) cs.cardOpacity = parseFloat(cardOpacity);

  const srcCat = S.data.categories.find(c => c.id === catId);
  if (!srcCat) return;

  if (bmId) {
    const bm = srcCat.bookmarks.find(b => b.id === bmId);
    if (!bm) return;
    if (bm.__master) {
      const override = {
        description: desc,
        tags,
        icon: { type: iType, value: iVal },
        customStyle: cs,
      };
      if (!S.cfg.overrides.bookmarks[bmId]) S.cfg.overrides.bookmarks[bmId] = {};
      Object.assign(S.cfg.overrides.bookmarks[bmId], override);
      if (!cs.hideCategoryBadge && S.cfg.overrides.bookmarks[bmId].customStyle) {
        delete S.cfg.overrides.bookmarks[bmId].customStyle.hideCategoryBadge;
        if (!Object.keys(S.cfg.overrides.bookmarks[bmId].customStyle).length) {
          delete S.cfg.overrides.bookmarks[bmId].customStyle;
        }
      }
      mergeData();
      // Do not move master bookmarks between categories.
    } else {
      Object.assign(bm, { title, url, description: desc, tags, icon: { type: iType, value: iVal }, customStyle: cs });
      const userBm = findUserBookmark(bmId);
      if (userBm) {
        Object.assign(userBm, { title, url, description: desc, tags, icon: { type: iType, value: iVal }, customStyle: cs });
        if (newCat !== catId) userBm.categoryId = newCat;
      }
      if (newCat !== catId) {
        srcCat.bookmarks = srcCat.bookmarks.filter(b => b.id !== bmId);
        S.data.categories.find(c => c.id === newCat)?.bookmarks.push(bm);
      }
    }
  } else {
    const bm = { id: `bm-${uid()}`, title, url, description: desc, tags, clicks: 0,
                 icon: { type: iType, value: iVal }, customStyle: cs };
    const destCat = S.data.categories.find(c => c.id === newCat) || srcCat;
    destCat.bookmarks.push(bm);
    S.cfg.userBookmarks.push({ ...bm, categoryId: destCat.id });
  }

  closeModal();
  render();      // immediate — user sees the change at once
  saveData();    // background write, no await
}

async function submitCategory(e) {
  const catId = e.target.dataset.catId;
  e.preventDefault();
  const fd    = new FormData(e.target);
  const name  = fd.get('name').trim();
  const icon  = fd.get('icon');
  const color = fd.get('color');

  if (catId) {
    const cat = S.data.categories.find(c => c.id === catId);
    if (!cat) return;
    if (cat.__master) {
      if (!S.cfg.overrides.categories[catId]) S.cfg.overrides.categories[catId] = {};
      Object.assign(S.cfg.overrides.categories[catId], { name, icon, color });
      mergeData();
    } else {
      Object.assign(cat, { name, icon, color });
      const localCat = S.cfg.userCategories.find(c => c.id === catId);
      if (localCat) Object.assign(localCat, { name, icon, color });
    }
  } else {
    const newCat = { id: `cat-${uid()}`, name, icon, color, bookmarks: [] };
    S.data.categories.push(newCat);
    S.cfg.userCategories.push({ id: newCat.id, name, icon, color });
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

  // Unfocus category if one is focused
  if (S.activeCat) {
    S.activeCat = null;
    render();
  }
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


function removeFromGroup(bmId) {
    if (S.cfg.cardPositions && S.cfg.cardPositions[bmId]) {
        // Place it somewhere visible on the main canvas
        S.cfg.cardPositions[bmId].x = 16;
        S.cfg.cardPositions[bmId].y = 16;
        delete S.cfg.cardPositions[bmId].groupId;
        saveData();
        render();
        applyLayout();
        showToast('Item removed from group.');
    }
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
    if (!dest) {
      dest = { ...cat, bookmarks: [] };
      S.data.categories.push(dest);
      S.cfg.userCategories.push({ id: dest.id, name: dest.name, icon: dest.icon, color: dest.color });
      addedCats++;
    }
    for (const bm of cat.bookmarks) {
      if (!existing.has(bm.url)) {
        dest.bookmarks.push(bm);
        S.cfg.userBookmarks.push({ ...bm, categoryId: dest.id });
        existing.add(bm.url);
        addedBms++;
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
    { label: 'New Group',         icon: 'Layout',    fn: () => { closePalette(); openGroupModal(null); } },
    { label: 'Edit Category',     icon: 'Pencil',    fn: () => { closePalette(); openCategoryEditModal(); } },
    { label: 'Delete Category',   icon: 'Trash2',    fn: () => { closePalette(); openCategoryDeleteModal(); } },
    { label: 'Change Background', icon: 'Image',     fn: () => { closePalette(); openSettingsModal(); } },
    { label: 'Settings',          icon: 'SlidersHorizontal', fn: () => { closePalette(); openSettingsModal(); } },
    { label: 'Import Bookmarks',  icon: 'Upload',     fn: () => { closePalette(); openImportModal(); } },
    { label: 'Export Bookmarks',  icon: 'Download',   fn: () => { closePalette(); exportData(); } },
    { label: 'Reset Layout',      icon: 'LayoutGrid', fn: () => { closePalette(); resetLayout(); } },
    { label: 'Edit Master Bookmarks', icon: 'Edit3', fn: () => { closePalette(); openMasterEditorModal(); } },
    { label: 'Configure Master File', icon: 'FileText', fn: () => { closePalette(); openMasterFileModal(); } },
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
    <div class="palette-item" data-url="${esc(sanitizeUrl(bm.url))}" onclick="window.open(this.getAttribute('data-url'),'_blank');closePalette()">
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



document.addEventListener('pointermove', e => {
  if (!_drag) return;
  e.preventDefault();

  if (!_drag.moved) {
    _drag.moved = true;
    const canvas = document.getElementById('canvas');
    if (canvas && canvas.dataset.wrapped === "true") {
      S.cfg.forceAbsoluteLayout = true;
      canvas.dataset.wrapped = "false";
      canvas.style.display = 'block';
      // Force all cards to absolute layout so the whole layout doesn't collapse
      const cards = Array.from(canvas.querySelectorAll('.card'));
      cards.forEach(card => {
        const id = card.dataset.id;
        const pos = S.cfg.cardPositions[id];
        if (pos && pos.x !== undefined) {
           card.style.position = 'absolute';
           card.style.left = pos.x + 'px';
           card.style.top = pos.y + 'px';
        }
      });
      _drag.el.style.position = 'absolute';
    }
  }

  const dx = e.clientX - _drag.startClientX;
  const dy = e.clientY - _drag.startClientY;

  // Calculate relative to the canvas.
  // We use the absolute client positions minus the canvas bounding box,
  // to ensure that no matter where the mouse is, we move the card globally on the canvas.
  const canvas = document.getElementById('canvas');
  if (canvas) {
     const canvasRect = canvas.getBoundingClientRect();
     // The absolute position on canvas = mouse pos - canvas top/left - offset where mouse grabbed card
     // To keep it simple, we just use the delta from the start pos like before,
     // but we no longer constrain it to 0,0 locally if we drag out of a group,
     // because it might go negative relative to the original group coordinate system,
     // but we translated the startX and startY to canvas coords in onDragStart!
     // We no longer constrain it to 0,0 locally if we drag out of a group,
     // because it might go negative relative to the original group coordinate system,
     // but we translated the startX and startY to canvas coords in onDragStart!
     // We still need to factor in canvas scrolling if it's scrolling
     _drag.curX = Math.max(0, _drag.startX + dx);
     _drag.curY = Math.max(0, _drag.startY + dy);

     // Update position dynamically, ignoring important
     _drag.el.style.setProperty('left', _drag.curX + 'px', 'important');
     _drag.el.style.setProperty('top', _drag.curY + 'px', 'important');
  } else {
     _drag.curX = Math.max(0, _drag.startX + dx);
     _drag.curY = Math.max(0, _drag.startY + dy);

     _drag.el.style.left = _drag.curX + 'px';
     _drag.el.style.top  = _drag.curY + 'px';
  }
  _drag.el.style.left = _drag.curX + 'px';
  _drag.el.style.top  = _drag.curY + 'px';

  updateCanvasHeight();
}, { passive: false });

document.addEventListener('pointerup', e => {
  if (!_drag) return;
  _drag.el.classList.remove('card--dragging');
  document.body.style.userSelect = '';
  if (_drag.moved) {
    // If the canvas was wrapped, disable wrapping globally or switch to absolute layout
    const canvas = document.getElementById('canvas');
    if (canvas && canvas.dataset.wrapped === "true") {
      canvas.dataset.wrapped = "false";
      canvas.style.display = 'block';
    }

    // Check if we dropped on a group (only for bookmarks, not groups)
    let targetGroupId = null;
    if (!_drag.el.classList.contains('card--group')) {
        // Find which group we are hovering over
        const groups = document.querySelectorAll('.card--group');
        for (const grp of groups) {
             const rect = grp.getBoundingClientRect();
             if (e.clientX >= rect.left && e.clientX <= rect.right &&
                 e.clientY >= rect.top && e.clientY <= rect.bottom) {
                 targetGroupId = grp.dataset.id;
                 break;
             }
        }
    }

    const existing = S.cfg.cardPositions[_drag.bmId] || {};

    if (targetGroupId) {
       // Snap inside group
       const groupEl = document.querySelector(`.card--group[data-id="${targetGroupId}"]`);
       const groupRect = groupEl.getBoundingClientRect();
       const groupContentEl = groupEl.querySelector('.group-content');
       const groupContentRect = groupContentEl.getBoundingClientRect();

       // Calculate relative x,y inside group container (approximate based on current drag position)
       // We want the position relative to .group-content, not just .card--group
       // Since the canvas handles scroll, let's use the raw bounding boxes.
       // Use absolute client positions, not bounding rects which might be off due to transforms during drag
       // _drag.curX and curY are relative to the canvas. We want it relative to groupContentRect
       const canvasRect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
       const canvasScrollTop = canvas ? canvas.scrollTop : 0;
       const canvasScrollLeft = canvas ? canvas.scrollLeft : 0;

       const absX = _drag.curX + canvasRect.left - canvasScrollLeft;
       const absY = _drag.curY + canvasRect.top - canvasScrollTop;

       const relX = absX - groupContentRect.left;
       const relY = absY - groupContentRect.top;

       S.cfg.cardPositions[_drag.bmId] = { ...existing, x: relX, y: relY, groupId: targetGroupId, _px: true };
    } else {
        if (existing.groupId && !_drag.el.classList.contains('card--group')) {
            // we dragged it out of a group
            delete existing.groupId;
        }
        S.cfg.cardPositions[_drag.bmId] = { ...existing, x: _drag.curX, y: _drag.curY, _px: true };
        delete S.cfg.cardPositions[_drag.bmId].groupId;
    }

    // Switch the dragged card to absolute so it doesn't snap back immediately
    // If it's in a group we rely on render() to place it there physically in DOM
    _drag.el.style.position = 'absolute';
    _drag.el.style.left = _drag.curX + 'px';
    _drag.el.style.top = _drag.curY + 'px';

    saveData();
    render();
    applyLayout();
  }
  _drag = null;
});

document.addEventListener('pointercancel', () => {
  if (!_drag) return;
  _drag.el.classList.remove('card--dragging');
  document.body.style.userSelect = '';
  // Native drag on links causes pointercancel. Treat as a drop if moved.
  if (_drag.moved) {
    const existing = S.cfg.cardPositions[_drag.bmId] || {};
    S.cfg.cardPositions[_drag.bmId] = { ...existing, x: _drag.curX, y: _drag.curY, _px: true };
    saveData();
    applyLayout();
  }
  _drag = null;
});

window.addEventListener('resize', () => {
  applyLayout();
});

// ═══════════════════════════════════════════════════════════════
//  INIT & CONNECT HANDLERS
// ═══════════════════════════════════════════════════════════════
async function handleConnect() {
  const ok = await openDirectory();
  if (ok) {
    render();
    promptMasterFileIfNeeded();
    showToast(`Connected to "${S.dir.name}"`);
  }
}

async function handleResumeMaster() {
  if (S.pendingMasterHandle) {
    try {
      const perm = await S.pendingMasterHandle.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        S.masterHandle = S.pendingMasterHandle;
        S.masterFileName = S.pendingMasterHandle.name;
        S.pendingMasterHandle = null;
        await idbSet('masterHandle', S.masterHandle);
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.error(e);
    }
  }
  if (S.pendingMasterAssetsHandle) {
    try {
      const perm = await S.pendingMasterAssetsHandle.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        S.masterAssetsHandle = S.pendingMasterAssetsHandle;
        S.pendingMasterAssetsHandle = null;
        await idbSet('masterAssetsHandle', S.masterAssetsHandle);
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.error(e);
    }
  }
  await loadData();
  render();
  showToast('Master file resumed.');
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
      promptMasterFileIfNeeded();
      showToast(`Resumed — ${S.dir.name}`);
      await handleResumeMaster();
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
  promptMasterFileIfNeeded();
}

init();


// ═══════════════════════════════════════════════════════════════
//  ASSET PREVIEW POPUP
// ═══════════════════════════════════════════════════════════════
function showAssetPreview(src) {
  let popup = document.getElementById('asset-preview-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'asset-preview-popup';
    popup.style.position = 'fixed';
    popup.style.bottom = '20px';
    popup.style.right = '20px';
    popup.style.zIndex = '99999';
    popup.style.backgroundColor = 'var(--bg2)';
    popup.style.border = '1px solid var(--border)';
    popup.style.borderRadius = '8px';
    popup.style.padding = '8px';
    popup.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
    popup.style.pointerEvents = 'none';
    popup.style.transition = 'opacity 0.2s ease-in-out';

    const img = document.createElement('img');
    img.id = 'asset-preview-img';
    img.style.maxWidth = '300px';
    img.style.maxHeight = '300px';
    img.style.objectFit = 'contain';
    img.style.display = 'block';

    popup.appendChild(img);
    document.body.appendChild(popup);
  }

  const img = document.getElementById('asset-preview-img');
  img.src = src;
  popup.style.opacity = '1';
}

function hideAssetPreview() {
  const popup = document.getElementById('asset-preview-popup');
  if (popup) {
    popup.style.opacity = '0';
  }
}
