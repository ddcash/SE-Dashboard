'use strict';

// ═══════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════
const LUCIDE_ICONS = [
  'Globe','Code','Github','GitBranch','Folder','FolderOpen','File','FileText','FileCode',
  'Link','Link2','Bookmark','BookMarked','Star','Heart','Home','Search','Settings','Settings2',
  'Terminal','Database','Server','Cloud','CloudUpload','Download','Upload','Archive',
  'Mail','MessageSquare','MessageCircle','Video','Music','Image','Camera','Mic',
  'Monitor','Smartphone','Laptop','Tablet','Cpu','HardDrive','Wifi','Lock','Key','Shield',
  'User','Users','Building','Building2','Map','MapPin','Navigation','Compass',
  'Calendar','Clock','Bell','BellRing','Zap','Flame','Award','Trophy','Gem',
  'Layers','Package','Box','Book','BookOpen','Newspaper','Rss','Hash','Tag','AtSign',
  'Wrench','Cog','Braces','Brackets','Code2','Play','Pause','Headphones','Radio',
  'Coffee','Briefcase','Figma','Slack','Chrome','Youtube','Twitter','Linkedin',
  'ExternalLink','ArrowRight','Pencil','Pen','Edit2','Eye','EyeOff','Grid','List',
  'PieChart','BarChart','Activity','TrendingUp','Rocket','Sparkles','Brain','Bot'
];

const CAT_COLORS = [
  '#6366f1','#8b5cf6','#a855f7','#ec4899','#f43f5e',
  '#f97316','#eab308','#84cc16','#22c55e','#14b8a6',
  '#06b6d4','#3b82f6','#89b4fa','#cba6f7','#78716c'
];

const DEFAULT_DATA = {
  version: 1,
  categories: [
    {
      id: 'cat-start',
      name: 'Getting Started',
      icon: 'BookOpen',
      color: '#89b4fa',
      bookmarks: [
        {
          id: 'bm-github', title: 'GitHub', url: 'https://github.com',
          description: 'Code hosting & version control', tags: ['dev','git'],
          clicks: 0, icon: { type: 'lucide', value: 'Github' }, customStyle: {}
        },
        {
          id: 'bm-hn', title: 'Hacker News', url: 'https://news.ycombinator.com',
          description: 'Tech news & discussion', tags: ['news','tech'],
          clicks: 0, icon: { type: 'lucide', value: 'Newspaper' }, customStyle: {}
        },
        {
          id: 'bm-mdn', title: 'MDN Web Docs', url: 'https://developer.mozilla.org',
          description: 'Web platform documentation', tags: ['docs','web'],
          clicks: 0, icon: { type: 'lucide', value: 'BookOpen' }, customStyle: {}
        }
      ]
    }
  ]
};

// ═══════════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════════
const S = {
  dir:        null,
  data:       JSON.parse(JSON.stringify(DEFAULT_DATA)),
  cfg:        { theme: 'dark', layout: { gridColumns: 4 } },
  assetUrls:  {},
  query:      '',
  paletteOpen: false,
};

// ═══════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════
const uid = () => Math.random().toString(36).slice(2, 10);

function esc(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fuzzyMatch(str, q) {
  if (!q) return true;
  str = str.toLowerCase(); q = q.toLowerCase();
  let i = 0;
  for (const ch of q) { i = str.indexOf(ch, i); if (i === -1) return false; i++; }
  return true;
}

function getProtocolTag(url) {
  if (!url) return null;
  if (url.startsWith('file://')) return 'local';
  if (/^https?:\/\//.test(url)) return null;
  const m = url.match(/^([a-z][a-z0-9+\-.]+):/i);
  return m ? m[1] : null;
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
  try {
    const bkDir = await S.dir.getDirectoryHandle('backups', { create: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fh = await bkDir.getFileHandle(`bookmarks-${ts}.json`, { create: true });
    const w = await fh.createWritable();
    await w.write(JSON.stringify(S.data, null, 2));
    await w.close();
  } catch (e) { console.warn('Backup skipped:', e.message); }
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
  await loadAssets();
}

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
  if (icon.type === 'favicon') {
    // Direct /favicon.ico — works for internet sites AND internal/intranet hosts; fails gracefully offline
    const origin = (() => { try { const u = new URL(icon.value || ''); return u.origin; } catch { return ''; } })();
    const fb = `this.parentNode.innerHTML='<i data-lucide=\\'Globe\\' style=\\'width:${size}px;height:${size}px\\'></i>';if(typeof lucide!=='undefined')lucide.createIcons();`;
    return origin
      ? `<img src="${esc(origin)}/favicon.ico" class="card-favicon" onerror="${fb}">`
      : `<i data-lucide="Globe" style="width:${size}px;height:${size}px"></i>`;
  }
  if (icon.type === 'url') {
    const fb = `this.parentNode.innerHTML='<i data-lucide=\\'Link\\' style=\\'width:${size}px;height:${size}px\\'></i>';if(typeof lucide!=='undefined')lucide.createIcons();`;
    return `<img src="${esc(icon.value)}" class="card-favicon" onerror="${fb}">`;
  }
  if (icon.type === 'local') {
    const url = S.assetUrls[icon.value];
    if (url) {
      const fb = `this.parentNode.innerHTML='<i data-lucide=\\'Image\\' style=\\'width:${size}px;height:${size}px\\'></i>';if(typeof lucide!=='undefined')lucide.createIcons();`;
      return `<img src="${url}" class="card-favicon" onerror="${fb}">`;
    }
    return `<i data-lucide="Image" style="width:${size}px;height:${size}px"></i>`;
  }
  return `<i data-lucide="Link" style="width:${size}px;height:${size}px"></i>`;
}

function renderCard(bm, catId) {
  const proto = getProtocolTag(bm.url);
  const cs    = bm.customStyle || {};
  const style = [
    cs.cardColor   ? `background:${cs.cardColor}`   : '',
    cs.borderColor ? `border-color:${cs.borderColor}` : ''
  ].filter(Boolean).join(';');

  const tags     = (bm.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');
  const protoTag = proto
    ? `<span class="proto-tag proto-tag--${proto === 'local' ? 'local' : 'app'}">${proto === 'local' ? 'Local File' : proto + '://'}</span>`
    : '';
  const clicks   = bm.clicks
    ? `<span class="click-count"><i data-lucide="MousePointerClick" style="width:10px;height:10px"></i>${bm.clicks}</span>`
    : '';

  return `
    <div class="card" data-id="${bm.id}" data-cat="${catId}" style="${style}">
      <a href="${esc(bm.url)}" target="_blank" rel="noreferrer" class="card-link"
         onclick="trackClick(event,'${bm.id}','${catId}')">
        <div class="card-icon-wrap">${renderIcon(bm.icon, 20)}</div>
        <div class="card-body">
          <div class="card-title">${esc(bm.title)}</div>
          ${bm.description ? `<div class="card-desc">${esc(bm.description)}</div>` : ''}
          <div class="card-meta">${protoTag}${tags}${clicks}</div>
        </div>
      </a>
      <div class="card-actions" onclick="event.stopPropagation()">
        <button class="btn-icon btn-icon--edit" title="Edit" aria-label="Edit bookmark" onclick="openCardModal('${catId}','${bm.id}')">
          <i data-lucide="Pencil" style="width:12px;height:12px"></i>
        </button>
        <button class="btn-icon btn-icon--del" title="Delete" aria-label="Delete bookmark" onclick="deleteCard('${catId}','${bm.id}')">
          <i data-lucide="Trash2" style="width:12px;height:12px"></i>
        </button>
      </div>
    </div>`;
}

function renderCategory(cat) {
  const bms = S.query
    ? cat.bookmarks.filter(b =>
        fuzzyMatch(b.title, S.query) || fuzzyMatch(b.url, S.query) ||
        fuzzyMatch(b.description || '', S.query) || (b.tags||[]).some(t => fuzzyMatch(t, S.query)))
    : cat.bookmarks;

  if (S.query && bms.length === 0) return '';

  return `
    <div class="category" data-cat-id="${cat.id}" style="--cat-color:${esc(cat.color || '#6366f1')}">
      <div class="category-header">
        <div class="category-icon" style="color:${esc(cat.color || '#6366f1')}">
          ${renderIcon({ type: 'lucide', value: cat.icon || 'Folder' }, 16)}
        </div>
        <span class="category-name">${esc(cat.name)}</span>
        <span class="category-count">${cat.bookmarks.length}</span>
        <div class="category-actions">
          <button class="btn-icon" title="Edit category" aria-label="Edit category" onclick="openCategoryModal('${cat.id}')">
            <i data-lucide="Settings2" style="width:12px;height:12px"></i>
          </button>
          <button class="btn-icon btn-icon--del" title="Delete category" aria-label="Delete category" onclick="deleteCategory('${cat.id}')">
            <i data-lucide="Trash2" style="width:12px;height:12px"></i>
          </button>
        </div>
      </div>
      <div class="cards-grid" data-cat-id="${cat.id}">
        ${bms.map(b => renderCard(b, cat.id)).join('')}
      </div>
      <button class="btn-add-card" onclick="openCardModal('${cat.id}',null)">
        <i data-lucide="Plus" style="width:13px;height:13px"></i> Add Bookmark
      </button>
    </div>`;
}

function render() {
  const app = document.getElementById('app');
  app.innerHTML = S.dir ? renderDashboard() : renderConnect();
  if (typeof lucide !== 'undefined') lucide.createIcons();
  initDragDrop();
}

function renderConnect() {
  const ok = 'showDirectoryPicker' in window;
  return `
    <div class="connect-screen">
      <div class="connect-card">
        <div class="connect-logo">
          <i data-lucide="Bookmark" style="width:36px;height:36px"></i>
        </div>
        <h1>Bookmark Manager</h1>
        <p>A local-first bookmark manager. All data stays on your device — no servers, no accounts, no tracking.</p>
        ${ok ? `
          <button class="btn btn--primary btn--lg" onclick="handleConnect()">
            <i data-lucide="FolderOpen" style="width:17px;height:17px"></i>
            Connect Directory
          </button>
          <p class="hint">Select or create a folder to store your bookmarks data.</p>
        ` : `
          <div class="error-box">
            <i data-lucide="AlertTriangle" style="width:16px;height:16px;flex-shrink:0"></i>
            <div>This app requires the <strong>File System Access API</strong>.<br>Please open in <strong>Chrome</strong> or <strong>Edge</strong>.</div>
          </div>
        `}
      </div>
    </div>`;
}

function renderDashboard() {
  const cats = S.data.categories || [];
  const isEmpty = cats.length === 0 && !S.query;

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
          <input type="text" id="search-input" class="search-input"
            placeholder="Search… (Ctrl+K for commands)"
            value="${esc(S.query)}"
            oninput="handleSearch(this.value)"
            onkeydown="if(event.key==='Escape')handleSearch('')">
          ${S.query ? `<button class="search-clear" title="Clear search" aria-label="Clear search" onclick="handleSearch('')">
            <i data-lucide="X" style="width:12px;height:12px"></i></button>` : ''}
        </div>
      </div>
      <div class="header-right">
        <button class="btn btn--ghost" onclick="openImportModal()" title="Import bookmarks">
          <i data-lucide="Upload" style="width:13px;height:13px"></i>
          <span>Import</span>
        </button>
        <button class="btn btn--ghost" onclick="exportData()" title="Export bookmarks">
          <i data-lucide="Download" style="width:13px;height:13px"></i>
          <span>Export</span>
        </button>
        <button class="btn btn--primary" onclick="openCategoryModal(null)">
          <i data-lucide="FolderPlus" style="width:13px;height:13px"></i>
          <span>New Category</span>
        </button>
      </div>
    </header>
    <main class="dashboard">
      ${isEmpty ? `
        <div class="empty-state">
          <i data-lucide="BookMarked" style="width:48px;height:48px"></i>
          <p>No categories yet. Create one to start adding bookmarks.</p>
          <button class="btn btn--primary" onclick="openCategoryModal(null)">
            <i data-lucide="FolderPlus" style="width:13px;height:13px"></i> Create Category
          </button>
        </div>` : ''}
      <div class="categories-grid" id="categories-grid">
        ${cats.map(renderCategory).join('')}
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
  const cat  = S.data.categories.find(c => c.id === catId);
  const bm   = bmId ? cat?.bookmarks.find(b => b.id === bmId) : null;
  const iType = bm?.icon?.type || 'lucide';
  const iVal  = bm?.icon?.value || 'Link';
  const cs    = bm?.customStyle || {};

  const iconGrid = LUCIDE_ICONS.map(n => `
    <button type="button" class="icon-option ${iType === 'lucide' && iVal === n ? 'selected' : ''}"
      data-icon="${n}" onclick="pickLucideIcon(this,'${n}')">
      <i data-lucide="${n}" style="width:16px;height:16px"></i>
    </button>`).join('');

  const catOptions = S.data.categories.map(c =>
    `<option value="${c.id}" ${c.id === catId ? 'selected' : ''}>${esc(c.name)}</option>`).join('');

  openModal(`
    <div class="modal-header">
      <h2>${bm ? 'Edit Bookmark' : 'New Bookmark'}</h2>
      <button class="btn-icon" title="Close" aria-label="Close modal" onclick="closeModal()"><i data-lucide="X" style="width:15px;height:15px"></i></button>
    </div>
    <div class="modal-body">
      <form id="card-form" onsubmit="submitCard(event,'${catId}','${bmId||''}')">
        <div class="form-row">
          <label>Title *</label>
          <input type="text" name="title" class="form-input" required
            value="${esc(bm?.title||'')}" placeholder="My Bookmark">
        </div>
        <div class="form-row">
          <label>URL *</label>
          <input type="text" name="url" class="form-input" required
            value="${esc(bm?.url||'')}" placeholder="https://… or file:/// or vscode://…">
        </div>
        <div class="form-row">
          <label>Description</label>
          <textarea name="description" class="form-input form-textarea"
            placeholder="Optional notes…">${esc(bm?.description||'')}</textarea>
        </div>
        <div class="form-row">
          <label>Tags <span class="hint-inline">(comma-separated)</span></label>
          <input type="text" name="tags" class="form-input"
            value="${esc((bm?.tags||[]).join(', '))}" placeholder="dev, work, tools">
        </div>
        <div class="form-row">
          <label>Category</label>
          <select name="categoryId" class="form-input">${catOptions}</select>
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
            <input type="text" class="form-input" style="margin-bottom:6px" placeholder="Search icons…" oninput="filterIcons(this.value)">
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
          ${bm ? `<button type="button" class="btn btn--danger"
            onclick="deleteCard('${catId}','${bmId}');closeModal()">Delete</button>` : ''}
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
  const cat   = catId ? S.data.categories.find(c => c.id === catId) : null;
  const cIcon = cat?.icon  || 'Folder';
  const cColor= cat?.color || CAT_COLORS[0];

  const iconGrid = LUCIDE_ICONS.map(n => `
    <button type="button" class="icon-option ${cIcon===n?'selected':''}"
      data-icon="${n}" onclick="pickLucideIcon(this,'${n}')">
      <i data-lucide="${n}" style="width:16px;height:16px"></i>
    </button>`).join('');

  const swatches = CAT_COLORS.map(c => `
    <button type="button" class="color-swatch ${c===cColor?'selected':''}"
      style="background:${c}" onclick="pickCatColor(this,'${c}')"></button>`).join('');

  openModal(`
    <div class="modal-header">
      <h2>${cat ? 'Edit Category' : 'New Category'}</h2>
      <button class="btn-icon" title="Close" aria-label="Close modal" onclick="closeModal()"><i data-lucide="X" style="width:15px;height:15px"></i></button>
    </div>
    <div class="modal-body">
      <form id="cat-form" onsubmit="submitCategory(event,'${catId||''}')">
        <div class="form-row">
          <label>Name *</label>
          <input type="text" name="name" class="form-input" required
            value="${esc(cat?.name||'')}" placeholder="Dev Tools">
        </div>

        <div class="form-section">Icon</div>
        <input type="text" class="form-input" style="margin-bottom:8px"
          placeholder="Search icons…" oninput="filterIcons(this.value)">
        <div class="icon-grid" id="icon-grid">${iconGrid}</div>
        <input type="hidden" name="icon" value="${cIcon}">

        <div class="form-section">Color</div>
        <div class="color-swatches">${swatches}</div>
        <input type="hidden" name="color" value="${cColor}">

        <div class="modal-footer">
          ${cat ? `<button type="button" class="btn btn--danger"
            onclick="deleteCategory('${catId}');closeModal()">Delete</button>` : ''}
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
      <button class="btn-icon" title="Close" aria-label="Close modal" onclick="closeModal()"><i data-lucide="X" style="width:15px;height:15px"></i></button>
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
  await saveData();
  render();
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
  await saveData();
  render();
}

async function deleteCard(catId, bmId) {
  const cat = S.data.categories.find(c => c.id === catId);
  const bm  = cat?.bookmarks.find(b => b.id === bmId);
  if (!bm || !confirm(`Delete "${bm.title}"?`)) return;
  cat.bookmarks = cat.bookmarks.filter(b => b.id !== bmId);
  await saveData();
  render();
}

async function deleteCategory(catId) {
  const cat = S.data.categories.find(c => c.id === catId);
  if (!cat || !confirm(`Delete category "${cat.name}" and all ${cat.bookmarks.length} bookmark(s)?`)) return;
  S.data.categories = S.data.categories.filter(c => c.id !== catId);
  await saveData();
  render();
}

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
  await saveData();
  render();
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
        <input type="text" id="palette-input" class="palette-input"
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

  const cmdsHtml = matchCmds.map((c, i) => `
    <div class="palette-item" onclick="window._palActions[${i}]()">
      <i data-lucide="${c.icon}" style="width:14px;height:14px"></i>
      <span>${esc(c.label)}</span>
      <span class="palette-item-type">Command</span>
    </div>`).join('');

  const bmsHtml = matchBms.map(({ bm, cat }) => `
    <div class="palette-item" onclick="window.open('${esc(bm.url)}','_blank');closePalette()">
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

// ═══════════════════════════════════════════════════════════════
//  DRAG & DROP  (SortableJS)
// ═══════════════════════════════════════════════════════════════
let _sortables = [];

function initDragDrop() {
  _sortables.forEach(s => { try { s.destroy(); } catch {} });
  _sortables = [];
  if (typeof Sortable === 'undefined') return;

  // Category column reordering
  const grid = document.getElementById('categories-grid');
  if (grid) {
    _sortables.push(Sortable.create(grid, {
      animation: 180,
      handle: '.category-header',
      ghostClass: 'sortable-ghost',
      dragClass: 'sortable-drag',
      onEnd(evt) {
        const moved = S.data.categories.splice(evt.oldIndex, 1)[0];
        S.data.categories.splice(evt.newIndex, 0, moved);
        saveData();
      }
    }));
  }

  // Card reordering (within & across categories)
  document.querySelectorAll('.cards-grid').forEach(el => {
    _sortables.push(Sortable.create(el, {
      group: 'cards',
      animation: 180,
      ghostClass: 'sortable-ghost',
      dragClass: 'sortable-drag',
      onEnd(evt) {
        const fromId  = evt.from.dataset.catId;
        const toId    = evt.to.dataset.catId;
        const movedId = evt.item.dataset.id;
        const fromCat = S.data.categories.find(c => c.id === fromId);
        const toCat   = S.data.categories.find(c => c.id === toId);
        if (!fromCat || !toCat) return;

        // Read authoritative order from DOM
        const moved = fromCat.bookmarks.find(b => b.id === movedId);
        if (!moved) return;
        fromCat.bookmarks = fromCat.bookmarks.filter(b => b.id !== movedId);

        const newOrder = Array.from(evt.to.children).map(el => el.dataset.id);
        const bmMap = Object.fromEntries(toCat.bookmarks.map(b => [b.id, b]));
        bmMap[movedId] = moved;
        toCat.bookmarks = newOrder.map(id => bmMap[id]).filter(Boolean);
        // Append any items not in DOM (edge case)
        for (const b of toCat.bookmarks) if (!newOrder.includes(b.id)) toCat.bookmarks.push(b);

        saveData();
      }
    }));
  });
}

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

// ═══════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════
async function handleConnect() {
  const ok = await openDirectory();
  if (ok) { render(); showToast(`Connected to "${S.dir.name}"`); }
}

render();
