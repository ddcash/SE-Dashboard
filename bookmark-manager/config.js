'use strict';

// ═══════════════════════════════════════════════════════════════
//  APP CONFIGURATION  — loaded before app.js
// ═══════════════════════════════════════════════════════════════

const APP_VERSION = '1.1.0';

const APP_CONFIG = {
  // Persistent file names (inside the connected directory)
  files: {
    master:   'master_bookmarks.json',
    settings: 'local_settings.json',
  },

  // Automatic timestamped backups written to <dir>/backups/
  backup: {
    enabled:  true,
    maxCount: 20,         // oldest are deleted once this limit is exceeded
    subdir:   'backups',
  },

  // Local image/icon storage — <dir>/assets/
  assets: {
    subdir:    'assets',
    maxSizeMB: 5,
  },

  // Freeform canvas — card dimensions used for initial auto-arrange
  canvas: {
    cardWidth:  280,   // px
    cardHeight: 95,    // px
    gap:        16,    // px
    padding:    16,    // px
  },

  // How often to check for external edits to master_bookmarks.json (ms)
  poll: {
    intervalMs: 4000,
  },
};

// ── Palette of available category accent colours ──────────────
const CAT_COLORS = [
  '#6366f1','#8b5cf6','#a855f7','#ec4899','#f43f5e',
  '#f97316','#eab308','#84cc16','#22c55e','#14b8a6',
  '#06b6d4','#3b82f6','#89b4fa','#cba6f7','#78716c',
];

// ── Lucide icon names available in the card/category editors ──
const LUCIDE_ICONS = [
  // Web & Dev
  'Globe','Code','Code2','Github','GitBranch','GitCommit','Terminal','Braces','Brackets',
  'Server','Database','Cloud','CloudUpload','CloudOff','Wifi','WifiOff','Cpu','HardDrive',
  'Lock','Unlock','Key','Shield','ShieldCheck','Bug','Wrench','Cog','Hammer','Settings','Settings2',
  // Files & Storage
  'Folder','FolderOpen','File','FileText','FileCode','Archive','Package','Box','Layers',
  'Download','Upload','Link','Link2','ExternalLink','Share','Share2','Copy',
  // UI & Layout
  'Bookmark','BookMarked','BookOpen','Book','Newspaper','Hash','Tag','AtSign',
  'Grid','List','Layout','LayoutGrid','AppWindow','Search','Filter','Sliders',
  // Communication
  'Mail','MessageSquare','MessageCircle','Bell','BellRing','Phone','Video','Mic',
  // People
  'User','Users','UserCheck','Contact','Building','Building2','Briefcase',
  // Media
  'Image','Camera','Music','Headphones','Radio','Youtube','Play','Pause','Square',
  // Navigation & Maps
  'Map','MapPin','Navigation','Compass','Home','ArrowRight','ArrowUpRight',
  // Time
  'Calendar','Clock','Timer','AlarmClock',
  // Nature & Misc
  'Star','Heart','Zap','Flame','Rocket','Sparkles','Brain','Bot','Award','Trophy','Gem',
  'Coffee','Sun','Moon','Leaf','Snowflake','Wind','CloudRain',
  // Business
  'DollarSign','CreditCard','ShoppingCart','TrendingUp','BarChart','PieChart','Activity',
  // Social (brand-like)
  'Figma','Slack','Chrome','Twitter','Linkedin','Rss',
  // Actions
  'Plus','Minus','X','Check','Pencil','Eye','EyeOff','RefreshCw','RotateCcw',
  'ChevronRight','ChevronDown','MoreHorizontal','GripVertical',
];

// ── Default data written on first connect (demo bookmarks) ────
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
          clicks: 0, icon: { type: 'lucide', value: 'Github' }, customStyle: {},
        },
        {
          id: 'bm-mdn', title: 'MDN Web Docs', url: 'https://developer.mozilla.org',
          description: 'Web platform documentation', tags: ['docs','web'],
          clicks: 0, icon: { type: 'lucide', value: 'BookOpen' }, customStyle: {},
        },
      ],
    },
  ],
};
