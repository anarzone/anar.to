/* ---------- FocusGuard: a working model of FocusGuard 0.3.23 ----------
   Layout, copy, colours, thresholds and behaviour follow the app's origin/main: MenuBarView, ReadyComponents,
   MenuComponents, MenuPanes, MusicComponents, StatusGlyph, SessionRingView, TodayPage, ReportsPage, Settings*Pane,
   BlockOverlayView, BreakOverlayView, NotificationPresenter and the Intelligence code. All data here is made up. */
function mountFocusGuard() {
  const dlg = document.getElementById('fg');
  const $f = (id) => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const C = { focus: '#6155F5', drift: '#FF8D28', ink: '#E07316', other: 'rgba(0,0,0,.24)', control: 'rgba(0,0,0,.07)', grid: 'rgba(0,0,0,.13)', label: '#1D1D1F', warn: '#FF9F0A' };
  const DARK = { focus: '#6D7CFF', drift: '#DC7620', other: 'rgba(255,255,255,.34)', control: 'rgba(255,255,255,.12)' };
  const PRESETS = {
    gentle: { name: 'Gentle', silence: 20, notify: 60, cooldown: 60, block: 180, strict: false, note: 'Nudge after 1 min · block after 3 min' },
    standard: { name: 'Standard', silence: 10, notify: 30, cooldown: 60, block: 90, strict: false, note: 'Nudge after 30 s · block after 90 s' },
    strict: { name: 'Strict', silence: 10, notify: 30, cooldown: 60, block: 90, strict: true, note: 'Block the screen as soon as you drift' },
  };
  const GRACE = 120, OVERRIDE = 5;
  const LINES = [
    "5 more minutes — you've got this.", 'Refocus. Your future self will thank you.', 'One more push. Progress over perfection.',
    'You started for a reason. Pick it back up.', "Distractions wait. Your goals don't.", "Deep work pays. Surface scrolling doesn't.",
    'Close the tab. Open the doc.', 'Come back to it — you were almost there.',
  ];
  const MENU_TIPS = ['Stand up and look 20 feet away.', 'Refill your water.', 'Roll your shoulders and stretch your back.', 'Step outside for a minute of daylight.', 'Close your eyes and take five slow breaths.'];
  const BREAK_TIPS = ['Stand up and look at something 20 feet away.', 'Drink some water.', 'Roll your shoulders. Unclench your jaw.', 'Walk to another room and back.', 'Stretch your arms over your head for a few breaths.', 'Close your eyes. Just for a moment.'];
  const SITES = {
    gh: { host: 'github.com', url: 'github.com/anarzone/FocusGuard', fav: ['G', '#1F2328'] },
    yt: { host: 'youtube.com', url: 'www.youtube.com/watch?v=just-one-more', fav: ['Y', '#E62117'] },
    rd: { host: 'reddit.com', url: 'www.reddit.com/r/programming', fav: ['r', '#FF4500'] },
    hn: { host: 'news.ycombinator.com', url: 'news.ycombinator.com', fav: ['Y', '#FF6600'] },
    x: { host: 'x.com', url: 'x.com/home', fav: ['X', '#000000'] },
  };
  const APPS = {
    editor: { name: 'PhpStorm', win: 'fg-w-editor', fav: ['PS', '#7C3AED'], title: 'Visitor.php · anar.to' },
    chat: { name: 'Discord', win: 'fg-w-chat', fav: ['D', '#5865F2'], title: '# general' },
  };
  const GLYPH = { 'github.com': ['G', '#1F2328'], 'youtube.com': ['Y', '#E62117'], 'reddit.com': ['r', '#FF4500'], 'news.ycombinator.com': ['Y', '#FF6600'], 'x.com': ['X', '#000'],
    PhpStorm: ['PS', '#7C3AED'], Discord: ['D', '#5865F2'], Safari: ['S', '#1E88E5'], Slack: ['S', '#4A154B'], Xcode: ['X', '#1575F9'], '(?i)standup': ['Aa', '#8E8E93'] };
  const KIND_LABEL = { focus: 'Focus', neutral: 'Neutral', drift: 'Distracting' };
  const kindColor = (k) => (k === 'focus' ? C.focus : k === 'drift' ? C.drift : C.other);
  // A sample day before the current session (minutes after midnight). Two earlier sessions, some neutral time.
  const DAY = [[540, 548, 'o'], [570, 605, 'f'], [605, 612, 'd'], [612, 620, 'f'], [640, 650, 'o'], [700, 712, 'd'], [720, 735, 'o'], [820, 850, 'f'], [850, 856, 'd'], [856, 870, 'f'], [905, 915, 'o'], [940, 975, 'f'], [1000, 1009, 'd'], [1080, 1090, 'o']];
  const AVG = 58; // the sample's average focus rate
  const EARLIER = [
    { id: 'm1', label: 'Morning focus', start: 570 * 60, end: 620 * 60, len: 50, zone: 31 },
    { id: 'm2', label: 'Code review', start: 820 * 60, end: 870 * 60, len: 50, zone: 18 },
  ];
  // A sample week: focused, drifted and other minutes for Monday to Sunday; today's comes from the live demo.
  const WEEK = { f: [212, 248, 186, 265, 231, 95, 40], d: [34, 22, 41, 18, 27, 15, 10], o: [60, 48, 55, 62, 58, 20, 12] };
  const SEED = 'fffofoffffffffffffff';

  let s, ui, timer = null, lastTick = 0, overrideTimer = null, notifTimer = null, toastTimer = null, aiTimer = null;

  function freshState() {
    return {
      speed: 1, preset: 'standard', custom: null, clock: 21 * 3600 + 15 * 60,
      phase: 'session', label: 'Deep work', len: 50 * 60, startedAt: 20 * 3600 + 55 * 60, active: SEED.length * 60, extra: 0,
      minutes: SEED.split('').map((c) => (c === 'f' ? { f: 60, d: 0, o: 0 } : { f: 0, d: 0, o: 60 })),
      front: 'browser', site: 'gh', lastFocus: 'editor', streak: 0, drifted: false, lastNotify: -Infinity,
      block: false, graceUntil: -Infinity, exempt: new Set(), paused: false,
      zoneSince: 6 * 60, zoneRun: 14, bestRun: 14, bestToday: 31, driftByHost: {},
      done: [], recap: null, breakLen: 0, breakStart: 0, breakTip: 0, readyLen: 50, visits: {}, drifting: {},
      rules: { 'github.com': 'focus', 'youtube.com': 'drift', 'reddit.com': 'drift', 'news.ycombinator.com': 'drift', 'x.com': 'drift', PhpStorm: 'focus', Discord: 'drift', Safari: 'neutral', Slack: 'neutral', Xcode: 'focus', '(?i)standup': 'neutral' },
      userRules: [{ name: 'reddit.com', type: 'Site', kind: 'drift' }, { name: '(?i)standup', type: 'Title regex', kind: 'neutral' }],
      usage: { PhpStorm: 4300, 'github.com': 1500, Slack: 720, 'youtube.com': 540, Safari: 360, Discord: 240, 'news.ycombinator.com': 180 },
      types: { PhpStorm: 'App', Slack: 'App', Safari: 'App', Discord: 'App', Xcode: 'App' },
      music: { playing: false, list: 0, track: 0, pos: 42, shuffle: false, repeat: false, vol: 60, service: 'Apple Music' },
    };
  }
  function freshUI() {
    return {
      menu: true, pane: null, insTab: 'today', filter: 'all', query: '', addErr: '', chip: null, renaming: null, delSession: null, confirm: null,
      win: null, page: 'today', setPane: 'general', period: 'week', breakHidden: false,
      goal: 240, defLen: 50, prefs: { calendar: false, login: true, notifs: true, showTime: true, dock: true, reduce: false, weekends: false, strictBreaks: false, shortcuts: false, autostart: false, titlesOff: true, checkUpdates: true },
      keep: '1 year', ai: { enabled: false, provider: 'anthropic', model: '', baseURL: '', keySaved: false, tips: 'idle', payload: false },
    };
  }

  /* ---------- formatting ---------- */
  const fmtTime = (secs) => { const h = Math.floor(secs / 3600) % 24, m = Math.floor(secs / 60) % 60; return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
  const fmtM = (mins) => { mins = Math.max(0, Math.round(mins)); const h = Math.floor(mins / 60), m = mins % 60; return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`; };
  const clockText = (secs) => { secs = Math.max(0, Math.round(secs)); const h = Math.floor(secs / 3600), m = Math.floor(secs / 60) % 60, x = secs % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };
  const lenText = (min) => (min >= 120 && min % 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : min >= 120 ? `${min / 60}h` : `${min} minutes`);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const today = new Date();
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
  const dateLong = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const todayIdx = (today.getDay() + 6) % 7; // Monday = 0
  const weekTitle = (() => {
    const mon = new Date(today); mon.setDate(today.getDate() - todayIdx);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const m1 = mon.toLocaleDateString('en-GB', { month: 'long' }), m2 = sun.toLocaleDateString('en-GB', { month: 'long' });
    return m1 === m2 ? `${mon.getDate()} – ${sun.getDate()} ${m2} ${sun.getFullYear()}` : `${mon.getDate()} ${m1} – ${sun.getDate()} ${m2} ${sun.getFullYear()}`;
  })();

  /* ---------- icons ---------- */
  const I = {
    chart: '<svg viewBox="0 0 12 12" fill="currentColor"><rect x="1" y="6" width="2.4" height="5" rx=".6"/><rect x="4.8" y="3" width="2.4" height="8" rx=".6"/><rect x="8.6" y="1" width="2.4" height="10" rx=".6"/></svg>',
    grid: '<svg viewBox="0 0 12 12" fill="currentColor"><rect x="1" y="1" width="4.4" height="4.4" rx="1.2"/><rect x="6.6" y="1" width="4.4" height="4.4" rx="1.2"/><rect x="1" y="6.6" width="4.4" height="4.4" rx="1.2"/><rect x="6.6" y="6.6" width="4.4" height="4.4" rx="1.2"/></svg>',
    sliders: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M1 3.5h10M1 8.5h10"/><circle cx="4" cy="3.5" r="1.5" fill="currentColor"/><circle cx="8" cy="8.5" r="1.5" fill="currentColor"/></svg>',
    x: '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 2l6 6M8 2 2 8"/></svg>',
    play: '<svg viewBox="0 0 14 14" fill="currentColor"><path d="M4 2.2v9.6L11.6 7z"/></svg>',
    pause: '<svg viewBox="0 0 14 14" fill="currentColor"><rect x="3" y="2.5" width="2.8" height="9" rx=".8"/><rect x="8.2" y="2.5" width="2.8" height="9" rx=".8"/></svg>',
    plus: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 2v10M2 7h10"/></svg>',
    stop: '<svg viewBox="0 0 14 14" fill="currentColor"><rect x="2.5" y="2.5" width="9" height="9" rx="2"/></svg>',
    note: '<svg viewBox="0 0 14 14" fill="currentColor"><path d="M5 2.5 12 1v8.2a2 2 0 1 1-1.4-1.9V3.4L6.4 4.3v6.4a2 2 0 1 1-1.4-1.9z"/></svg>',
    wave: '<svg viewBox="0 0 14 14" fill="currentColor" class="wave"><rect x="1" y="5" width="1.6" height="4" rx=".8"/><rect x="4" y="3" width="1.6" height="8" rx=".8"/><rect x="7" y="1.5" width="1.6" height="11" rx=".8"/><rect x="10" y="4" width="1.6" height="6" rx=".8"/></svg>',
    search: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="6" cy="6" r="4.2"/><path d="m9.2 9.2 3.3 3.3"/></svg>',
    check: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 7.5 5.6 10.5 11.5 3.8"/></svg>',
    pencil: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M2.5 11.5 3 9l6.5-6.5 2 2L5 11z"/></svg>',
    trash: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2.5 4h9M5.5 4V2.6h3V4M3.8 4l.6 7.6h5.2l.6-7.6"/></svg>',
    cup: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6h8.5v3.5a3.5 3.5 0 0 1-3.5 3.5H6a3.5 3.5 0 0 1-3.5-3.5z"/><path d="M11 7h1a1.8 1.8 0 0 1 0 3.6h-1.2"/><path d="M5.5 2v1.8M8 2v1.8"/></svg>',
    chevL: '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 1.5 3 5l3.5 3.5"/></svg>',
    chevR: '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 1.5 7 5 3.5 8.5"/></svg>',
    down: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 1.5v7M4.2 5.8 7 8.6l2.8-2.8M2.5 9v3h9V9"/></svg>',
    spark: '<svg viewBox="0 0 14 14" fill="currentColor"><path d="M6 1c.4 2.6 1.4 3.6 4 4-2.6.4-3.6 1.4-4 4-.4-2.6-1.4-3.6-4-4 2.6-.4 3.6-1.4 4-4zM11 8.5c.2 1.2.6 1.6 1.8 1.8-1.2.2-1.6.6-1.8 1.8-.2-1.2-.6-1.6-1.8-1.8 1.2-.2 1.6-.6 1.8-1.8z"/></svg>',
    gear: '<svg viewBox="0 0 14 14" fill="currentColor"><path d="M6 1h2l.3 1.6 1.2.5 1.3-.9 1.4 1.4-.9 1.3.5 1.2L13 6v2l-1.6.3-.5 1.2.9 1.3-1.4 1.4-1.3-.9-1.2.5L8 13H6l-.3-1.6-1.2-.5-1.3.9-1.4-1.4.9-1.3-.5-1.2L1 8V6l1.6-.3.5-1.2-.9-1.3 1.4-1.4 1.3.9 1.2-.5zM7 4.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4z"/></svg>',
    timer: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="7" cy="8" r="4.8"/><path d="M7 8V5.5M5.5 1.5h3"/></svg>',
    bell: '<svg viewBox="0 0 14 14" fill="currentColor"><path d="M7 1.5a3.6 3.6 0 0 1 3.6 3.6v2.7l1.2 2H2.2l1.2-2V5.1A3.6 3.6 0 0 1 7 1.5zM5.6 11h2.8a1.4 1.4 0 0 1-2.8 0z"/></svg>',
    list: '<svg viewBox="0 0 14 14" fill="currentColor"><rect x="1.5" y="2" width="11" height="10" rx="2" opacity=".35"/><rect x="3.5" y="4" width="7" height="1.4" rx=".7"/><rect x="3.5" y="6.3" width="7" height="1.4" rx=".7"/><rect x="3.5" y="8.6" width="5" height="1.4" rx=".7"/></svg>',
    lock: '<svg viewBox="0 0 14 14" fill="currentColor"><path d="M4.2 6V4.5a2.8 2.8 0 0 1 5.6 0V6h.7a1 1 0 0 1 1 1v4.5a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm1.5 0h2.6V4.5a1.3 1.3 0 0 0-2.6 0z"/></svg>',
    info: '<svg viewBox="0 0 14 14" fill="currentColor"><path d="M7 1a6 6 0 1 1 0 12A6 6 0 0 1 7 1zm-.7 5v4.5h1.4V6zM7 3.2a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8z"/></svg>',
    clock: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="7" cy="7" r="5.5"/><path d="M7 4v3.2l2 1.3"/></svg>',
    sun: '<svg viewBox="0 0 22 22" fill="none" stroke="#6B5A86" stroke-width="1.6" stroke-linecap="round"><circle cx="11" cy="11" r="4"/><path d="M11 2v2.5M11 17.5V20M2 11h2.5M17.5 11H20M4.6 4.6l1.8 1.8M15.6 15.6l1.8 1.8M4.6 17.4l1.8-1.8M15.6 6.4l1.8-1.8"/></svg>',
    moon: '<svg viewBox="0 0 14 14" fill="currentColor"><path d="M8.6 1.2A5.6 5.6 0 1 0 12.8 9 4.6 4.6 0 0 1 8.6 1.2z"/></svg>',
    key: '<svg viewBox="0 0 14 14" fill="currentColor"><path d="M9 1.5a3.5 3.5 0 1 1-1.2 6.8L6.6 9.5H5.2v1.4H3.8v1.4H1.5v-2.3l4.2-4.2A3.5 3.5 0 0 1 9 1.5zm1 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg>',
    seal: '<svg viewBox="0 0 14 14" fill="currentColor"><path d="M7 .8l1.6 1.2 2-.1.6 1.9 1.6 1.2-.6 1.9.6 1.9-1.6 1.2-.6 1.9-2-.1L7 13.2 5.4 12l-2 .1-.6-1.9-1.6-1.2.6-1.9-.6-1.9 1.6-1.2.6-1.9 2 .1z"/><path d="M4.6 7.1 6.3 8.8 9.5 5.4" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    warn: '<svg viewBox="0 0 14 14" fill="currentColor"><path d="M7 1.2 13.2 12H.8zM6.3 5v3.6h1.4V5zM7 9.5a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6z"/></svg>',
    back: '<svg viewBox="0 0 14 14" fill="currentColor"><path d="M2 2.5h1.6v9H2zM12 2.5v9L4.4 7z"/></svg>',
    fwd: '<svg viewBox="0 0 14 14" fill="currentColor"><path d="M12 2.5h-1.6v9H12zM2 2.5v9L9.6 7z"/></svg>',
    shuffle: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 4h2.4l5.4 6h3.2M1.5 10h2.4l1.6-1.8M8 5.6 9.3 4h3.2M11 2.4 12.5 4 11 5.6M11 8.4l1.5 1.6L11 11.6"/></svg>',
    repeat: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 7V5.5A1.5 1.5 0 0 1 4 4h7.5M10 2.4 11.6 4 10 5.6M11.5 7v1.5A1.5 1.5 0 0 1 10 10H2.5M4 11.6 2.4 10 4 8.4"/></svg>',
    speaker: '<svg viewBox="0 0 14 14" fill="currentColor"><path d="M1.5 5h2.4L7 2.4v9.2L3.9 9H1.5z"/></svg>',
    speakerHi: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M1.5 5h2.4L7 2.4v9.2L3.9 9H1.5z" fill="currentColor" stroke="none"/><path d="M9 5a2.8 2.8 0 0 1 0 4M10.8 3.4a5 5 0 0 1 0 7.2"/></svg>',
    open: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="1.8" y="3.5" width="8.7" height="8.7" rx="2"/><path d="M7 7l5.2-5.2M8.6 1.8h3.6v3.6"/></svg>',
  };

  /* ---------- engine ---------- */
  const th = () => (s.preset === 'custom' ? s.custom : PRESETS[s.preset]);
  const sessionLen = () => s.len + s.extra;
  const left = () => Math.max(0, sessionLen() - s.active);
  const endsAt = () => s.clock + left();
  const breakLeft = () => Math.max(0, s.breakStart + s.breakLen * 60 - s.clock);
  const inSession = () => s.phase === 'session';

  function current() {
    if (s.front === 'browser') {
      const site = SITES[s.site];
      const kind = s.exempt.has(site.host) ? 'neutral' : (s.rules[site.host] || 'neutral');
      return { kind, name: site.host, app: 'Safari', detail: site.url, host: site.host, url: site.url, fav: site.fav };
    }
    if (s.front === 'fg') return { kind: 'neutral', name: 'FocusGuard', app: 'FocusGuard', detail: '', host: 'FocusGuard', url: '', fav: ['F', '#6155F5'] };
    const a = APPS[s.front];
    const kind = s.exempt.has(a.name) ? 'neutral' : (s.rules[a.name] || 'neutral');
    return { kind, name: a.name, app: a.name, detail: a.title, host: a.name, url: '', fav: a.fav };
  }
  const dominant = (m) => (m.d > 0 && m.d >= m.f && m.d >= m.o ? 'drift' : m.f > 0 && m.f >= m.o ? 'focus' : m.o > 0 ? 'other' : null);
  function totals(mins = s.minutes) {
    const t = { f: 0, d: 0, o: 0 };
    mins.forEach((m) => { const k = dominant(m); if (k === 'focus') t.f++; else if (k === 'drift') t.d++; else if (k === 'other') t.o++; });
    return t;
  }
  const pctOf = (t) => Math.round((t.f / Math.max(1, t.f + t.d + t.o)) * 100);

  // Today, built from the sample day, finished demo sessions and the live one.
  function daySpans() {
    const out = DAY.map(([a, b, k]) => [a, b, k]);
    s.done.forEach((d) => d.spans.forEach((x) => out.push(x)));
    if (s.phase === 'session') {
      const base = s.startedAt / 60;
      s.minutes.forEach((m, i) => { const k = dominant(m); if (k) out.push([base + i, base + i + 1, k[0]]); });
    }
    return out;
  }
  function todayTotals() {
    const t = { f: 0, d: 0, o: 0 };
    daySpans().forEach(([a, b, k]) => { t[k] += b - a; });
    return t;
  }
  function sessionsToday() {
    const list = EARLIER.map((e) => {
      const t = { f: 0, d: 0, o: 0 };
      DAY.forEach(([a, b, k]) => { const x = Math.max(a, e.start / 60), y = Math.min(b, e.end / 60); if (y > x) t[k] += y - x; });
      return { ...e, pct: pctOf(t), running: false };
    });
    s.done.forEach((d) => list.push(d));
    if (s.phase === 'session') list.push({ id: 'now', label: s.label, start: s.startedAt, end: null, len: Math.round(sessionLen() / 60), zone: s.bestRun, pct: pctOf(totals()), running: true, minsIn: Math.floor(s.active / 60) });
    return list.filter((x) => !(ui.deleted || []).includes(x.id)).map((x) => ({ ...x, label: (ui.labels || {})[x.id] || x.label }));
  }

  function resetStreak() { s.streak = 0; s.drifted = false; s.lastNotify = -Infinity; }

  function tick() {
    const now = performance.now();
    const dt = Math.min(0.5, (now - lastTick) / 1000) * s.speed;
    lastTick = now;
    s.clock += dt;
    const cur = current();
    if (cur.kind !== 'neutral' || s.front === 'browser') s.usage[cur.name] = (s.usage[cur.name] || 0) + dt;
    if (s.music.playing) { s.music.pos += dt / s.speed; if (s.music.pos > 214) { s.music.pos = 0; s.music.track++; } }
    if (s.phase === 'break') {
      if (breakLeft() <= 0) { endBreak(true); }
    } else if (s.phase === 'session' && !s.paused) {
      s.active += dt;
      const idx = Math.floor(s.active / 60);
      while (s.minutes.length <= idx) s.minutes.push({ f: 0, d: 0, o: 0 });
      const b = s.minutes[idx];
      if (cur.kind === 'focus') b.f += dt; else if (cur.kind === 'drift') b.d += dt; else b.o += dt;
      if (cur.kind === 'drift' && s.clock >= s.graceUntil) {
        const was = s.drifted;
        s.streak += dt;
        s.driftByHost[cur.host] = (s.driftByHost[cur.host] || 0) + dt;
        if (th().strict && !s.block) { s.drifted = true; showBlock(); }
        if (s.streak >= th().silence && !s.drifted) { s.drifted = true; shake(); }
        if (!was && s.drifted) s.zoneSince = Infinity;
        if (!s.block && ui.prefs.notifs && s.streak >= th().notify && s.clock - s.lastNotify >= th().cooldown && s.streak < th().block) {
          s.lastNotify = s.clock;
          notify(LINES[Math.floor(Math.random() * LINES.length)], cur.url ? `You've drifted to ${cur.host} (${cur.app}).` : `You've drifted to ${cur.app}.`);
        }
        if (!s.block && s.streak >= th().block) showBlock();
      } else if (s.drifted || s.streak > 0) resetStreak();
      if (cur.kind === 'focus') {
        if (!Number.isFinite(s.zoneSince)) s.zoneSince = s.active;
        s.zoneRun = Math.floor((s.active - s.zoneSince) / 60);
        s.bestRun = Math.max(s.bestRun, s.zoneRun);
      }
      if (left() <= 0) endSession();
    }
    render();
  }

  function startSession(min) {
    Object.assign(s, { phase: 'session', len: min * 60, extra: 0, startedAt: s.clock, active: 0, minutes: [], paused: false, zoneSince: 0, zoneRun: 0, bestRun: 0, driftByHost: {}, exempt: new Set(), recap: null, readyLen: min });
    resetStreak();
    if (s.music.list === 0 && !s.music.playing) { s.music.playing = true; }
    hideBreak();
  }
  function endSession() {
    const t = totals();
    const base = s.startedAt / 60;
    const spans = [];
    s.minutes.forEach((m, i) => { const k = dominant(m); if (k) spans.push([base + i, base + i + 1, k[0]]); });
    s.recap = { t, pct: pctOf(t), minutes: s.minutes.slice(), len: Math.round(sessionLen() / 60), start: s.startedAt, end: s.clock, longest: s.bestRun,
      most: Object.entries(s.driftByHost).sort((a, b) => b[1] - a[1])[0] || null, label: s.label };
    s.done.push({ id: `d${s.done.length}`, label: s.label, start: s.startedAt, end: s.clock, len: Math.max(1, Math.round((s.clock - s.startedAt) / 60)), zone: s.bestRun, pct: s.recap.pct, running: false, spans });
    s.bestToday = Math.max(s.bestToday, s.bestRun);
    s.phase = 'recap'; s.paused = false;
    hideBlock(); resetStreak();
    if (s.music.playing && s.music.list === 0) s.music.playing = false;
    const total = t.f + t.d + t.o;
    if (ui.prefs.notifs) notify('Session complete', `${total} min focus · ${s.recap.pct}% focused · ${s.label}`);
  }
  const breakFor = (min) => (min < 35 ? 5 : min < 70 ? 10 : min < 105 ? 15 : 20);
  function startBreak() {
    s.phase = 'break'; s.breakLen = breakFor(s.recap ? s.recap.len : 50); s.breakStart = s.clock; s.breakTip = Math.floor(Math.random() * MENU_TIPS.length);
    ui.breakHidden = false; ui.menu = false; ui.pane = null;
  }
  function endBreak(natural) {
    s.phase = 'ready'; hideBreak();
    if (natural && ui.prefs.notifs) notify("Break's over", 'Ready to start another session?');
  }
  function hideBreak() { ui.breakHidden = true; }

  /* ---------- notifications, toast, block ---------- */
  function notify(title, body) {
    $f('fg-n-title').textContent = title;
    $f('fg-n-body').textContent = body;
    const n = $f('fg-notif');
    n.classList.add('show');
    clearTimeout(notifTimer);
    notifTimer = setTimeout(() => n.classList.remove('show'), 5200);
  }
  function toast(msg) {
    const t = $f('fg-toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
  }
  function shake() { const si = $f('fg-status'); si.classList.remove('shake'); void si.offsetWidth; si.classList.add('shake'); }
  function arcPath(c, r, a0, a1) {
    const p = (a) => [c + r * Math.cos((a - 90) * Math.PI / 180), c + r * Math.sin((a - 90) * Math.PI / 180)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }
  function countSVG(leftSecs) {
    const frac = 1 - leftSecs / OVERRIDE;
    return `<circle cx="10" cy="10" r="8" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="2"></circle>${frac > 0 ? `<path d="${arcPath(10, 8, 0, Math.min(359.9, frac * 360))}" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="2" stroke-linecap="round"></path>` : ''}${leftSecs > 0 ? `<text x="10" y="13.2" text-anchor="middle" font-size="9" font-weight="600" fill="rgba(255,255,255,.75)">${Math.ceil(leftSecs)}</text>` : ''}`;
  }
  function showBlock() {
    s.block = true;
    $f('fg-notif').classList.remove('show');
    const b = $f('fg-block');
    b.hidden = false;
    requestAnimationFrame(() => b.classList.add('show'));
    const through = $f('fg-b-through');
    through.setAttribute('aria-disabled', 'true');
    clearInterval(overrideTimer);
    const started = performance.now();
    const step = () => {
      const l = Math.max(0, OVERRIDE - (performance.now() - started) / 1000);
      $f('fg-b-count').innerHTML = countSVG(l);
      $f('fg-b-keyhint').textContent = l > 0 ? `let me through, in ${Math.ceil(l)} s` : 'let me through, for 2 minutes';
      if (l <= 0) { through.setAttribute('aria-disabled', 'false'); clearInterval(overrideTimer); }
    };
    step();
    overrideTimer = setInterval(step, 100);
    render();
    $f('fg-b-back').focus({ preventScroll: true });
  }
  function hideBlock() { s.block = false; clearInterval(overrideTimer); const b = $f('fg-block'); b.classList.remove('show'); b.hidden = true; }

  /* ---------- drawing ---------- */
  function shieldGlyph(state, prog = 0) {
    const P = 'M8 1.6 13.1 3.7v3.7c0 3.1-2.1 5.8-5.1 7-3-1.2-5.1-3.9-5.1-7V3.7z';
    const o = `<path d="${P}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/>`;
    if (state === 'focusing') {
      const y = 14.4 - (Math.round(prog * 26) / 26) * 12.8;
      return `<defs><clipPath id="fgc${Math.round(prog * 26)}"><rect x="0" y="${y.toFixed(2)}" width="16" height="16"/></clipPath></defs>${o}<path d="${P}" fill="currentColor" clip-path="url(#fgc${Math.round(prog * 26)})"/>`;
    }
    if (state === 'paused') return `${o}<path d="M6.6 5.6v4.2M9.4 5.6v4.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`;
    if (state === 'drifted') return `${o}<path d="M8 4.8v3.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="10.9" r=".95" fill="currentColor"/>`;
    if (state === 'complete') return `<mask id="fgck"><rect width="16" height="16" fill="#fff"/><path d="M5.4 8.1 7.2 9.9 10.6 6.3" stroke="#000" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></mask><path d="${P}" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" mask="url(#fgck)"/>`;
    if (state === 'break') return '<path d="M2.8 7h8.2v2.8a3.3 3.3 0 0 1-3.3 3.3H6.1a3.3 3.3 0 0 1-3.3-3.3z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M11 8h.9a1.6 1.6 0 0 1 0 3.2H11" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5.4 2.6c-.5.8.5 1.3 0 2.2M8.1 2.6c-.5.8.5 1.3 0 2.2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>';
    return o;
  }
  function glyphState() {
    if (s.phase === 'break') return 'break';
    if (s.phase === 'recap') return 'complete';
    if (s.phase === 'ready') return 'ready';
    if (s.paused) return 'paused';
    if (s.drifted) return 'drifted';
    return 'focusing';
  }
  // SessionRingView: one cell per planned minute (max 60), each its dominant kind; arcs merge, 1.6° gaps.
  function ringSVG(size, lw, { closed = false, dark = false, rec = null } = {}) {
    const col = dark ? DARK : C;
    const lenMin = rec ? (closed ? Math.max(1, rec.minutes.length) : rec.len) : Math.round(sessionLen() / 60);
    const mins = rec ? rec.minutes : s.minutes;
    const active = rec ? mins.length * 60 : s.active;
    const per = Math.ceil(lenMin / 60), n = Math.ceil(lenMin / per), deg = 360 / n;
    const c = size / 2, r = (size - lw) / 2 - 3;
    const curCell = Math.min(n, Math.floor(active / 60 / per));
    const runs = [];
    for (let i = 0; i < Math.min(n, closed ? Math.ceil(mins.length / per) : curCell); i++) {
      const sum = { f: 0, d: 0, o: 0 };
      for (let k = i * per; k < (i + 1) * per && k < mins.length; k++) { sum.f += mins[k].f; sum.d += mins[k].d; sum.o += mins[k].o; }
      const kind = dominant(sum);
      const last = runs[runs.length - 1];
      if (last && last.kind === kind) last.b = (i + 1) * deg; else runs.push({ kind, a: i * deg, b: (i + 1) * deg });
    }
    const prog = Math.min(1, active / (lenMin * 60));
    let nowKind = null;
    if (!closed && curCell < n) {
      nowKind = current().kind === 'neutral' ? 'other' : current().kind;
      const last = runs[runs.length - 1];
      if (last && last.kind === nowKind) last.b = prog * 360; else runs.push({ kind: nowKind, a: curCell * deg, b: prog * 360 });
    }
    let out = `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${col.control}" stroke-width="${lw}"/>`;
    runs.forEach((run, i) => {
      if (!run.kind) return;
      let a = run.a, b = run.b;
      if (i > 0 && runs[i - 1].kind !== run.kind) a += 0.8;
      if (i < runs.length - 1 && runs[i + 1].kind !== run.kind) b -= 0.8;
      if (b - a < 0.3) return;
      out += `<path d="${arcPath(c, r, a, Math.min(b, 359.95))}" fill="none" stroke="${run.kind === 'other' ? col.other : col[run.kind]}" stroke-width="${lw}"/>`;
    });
    if (!closed && s.phase === 'session') {
      if (!s.paused && !dark) {
        const ri = r - lw / 2 - Math.max(5, lw * 0.45), w = Math.max(2, lw * 0.2), f = (s.active % 60) / 60;
        out += `<circle cx="${c}" cy="${c}" r="${ri}" fill="none" stroke="${col.control}" stroke-width="${w}"/>${f > 0.01 ? `<path d="${arcPath(c, ri, 0, Math.min(359.9, f * 360))}" fill="none" stroke="${col.focus}" stroke-opacity=".6" stroke-width="${w}" stroke-linecap="round"/>` : ''}`;
      }
      const a = prog * 360, kx = c + r * Math.cos((a - 90) * Math.PI / 180), ky = c + r * Math.sin((a - 90) * Math.PI / 180);
      out += `<circle cx="${kx.toFixed(2)}" cy="${ky.toFixed(2)}" r="${(lw * 0.65).toFixed(1)}" fill="#fff" stroke="${nowKind === 'other' ? col.other : col[nowKind] || col.focus}" stroke-width="${(lw * 0.23).toFixed(1)}"/>`;
    }
    return `${out}</svg>`;
  }
  const miniRing = (size, lw, frac, color = C.focus) => { const c = size / 2, r = (size - lw) / 2; return `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${C.control}" stroke-width="${lw}"/>${frac > 0 ? `<path d="${arcPath(c, r, 0, Math.min(359.9, frac * 360))}" fill="none" stroke="${color}" stroke-width="${lw}" stroke-linecap="round"/>` : ''}</svg>`; };
  const zoneGlyph = (on) => `<svg viewBox="0 0 18 18" aria-hidden="true" fill="none" stroke="${on ? C.focus : '#8A8A94'}" stroke-width="1.6"><circle cx="9" cy="9" r="7"/><circle cx="9" cy="9" r="3.6"/><circle cx="9" cy="9" r=".9" fill="${on ? C.focus : '#8A8A94'}"/></svg>`;
  const glyphTile = (name, size = 26) => { const [t, bg] = GLYPH[name] || [name[0].toUpperCase(), '#6E6E73']; return `<span class="gt" style="width:${size}px;height:${size}px;background:${bg};font-size:${Math.round(size * (t.length > 1 ? 0.36 : 0.46))}px">${esc(t)}</span>`; };

  // Day strip / timeline: window 8 AM to the latest of 6 PM, the planned end and now.
  function dayWindow(planEnd) {
    const spans = daySpans();
    const first = Math.min(...spans.map((x) => x[0]));
    const a = Math.max(4 * 60, Math.min(8 * 60, Math.floor(first / 60) * 60));
    const b = Math.max(18 * 60, Math.ceil(Math.max(planEnd || 0, s.clock / 60) / 60) * 60);
    return [a, b, spans];
  }
  function stripSVG(w, h, { ghost = 0, lanes = false } = {}) {
    const nowMin = s.clock / 60;
    const [a, b, spans] = dayWindow(ghost ? nowMin + ghost : 0);
    const x = (m) => ((m - a) / (b - a)) * w;
    const barY = lanes ? h * 0.32 : 0, barH = lanes ? h * 0.36 : 14;
    let out = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true" class="daystrip"><rect x="0" y="${barY}" width="${w}" height="${barH}" rx="4" fill="${C.control}"/>`;
    if (lanes) {
      const sess = [...EARLIER.map((e) => [e.start / 60, e.end / 60]), ...s.done.map((d) => [d.start / 60, d.end / 60])];
      if (s.phase === 'session') sess.push([s.startedAt / 60, nowMin]);
      sess.forEach(([p, q]) => { out += `<rect x="${x(p).toFixed(1)}" y="2" width="${Math.max(2, x(q) - x(p)).toFixed(1)}" height="${(h * 0.14).toFixed(1)}" rx="2" fill="${C.focus}" fill-opacity=".85"/>`; });
    }
    spans.forEach(([p, q, k]) => { out += `<rect x="${x(p).toFixed(1)}" y="${barY}" width="${Math.max(1, x(q) - x(p) - 0.4).toFixed(1)}" height="${barH}" fill="${k === 'f' ? C.focus : k === 'd' ? C.drift : C.other}"/>`; });
    if (ghost) out += `<rect x="${x(nowMin).toFixed(1)}" y="${barY + 0.75}" width="${(x(nowMin + ghost) - x(nowMin)).toFixed(1)}" height="${barH - 1.5}" rx="3" fill="${C.focus}" fill-opacity=".18" stroke="${C.focus}" stroke-width="1.5" stroke-dasharray="3 2"/>`;
    out += `<rect x="${(x(nowMin) - 0.75).toFixed(1)}" y="${barY - 3}" width="1.5" height="${barH + 6}" fill="${C.label}"/>`;
    const stepH = (b - a) / 60 <= 12 ? 2 : (b - a) / 60 <= 16 ? 3 : 4;
    for (let m = Math.ceil(a / 60 / stepH) * stepH * 60; m <= b; m += stepH * 60) {
      const hr = (m / 60) % 24, lbl = hr === 0 ? '12 AM' : hr === 12 ? '12 PM' : hr > 12 ? `${hr - 12} PM` : `${hr} AM`;
      out += `<text x="${Math.min(w - 14, Math.max(14, x(m))).toFixed(1)}" y="${h - 1}" text-anchor="middle" font-size="10" fill="#6E6E73">${lbl}</text>`;
    }
    return `${out}</svg>`;
  }

  /* ---------- the menu ---------- */
  function patch(host, parts) {
    const keep = new Map([...host.children].map((el) => [el.dataset.k, el]));
    let prev = null;
    parts.forEach(([k, html, cls = '']) => {
      let el = keep.get(k);
      if (!el) { el = document.createElement('div'); el.dataset.k = k; }
      keep.delete(k);
      if (el.className !== cls) el.className = cls;
      if (el._h !== html) { el.innerHTML = html; el._h = html; }
      const want = prev ? prev.nextSibling : host.firstChild;
      if (want !== el) host.insertBefore(el, want);
      prev = el;
    });
    keep.forEach((el) => el.remove());
  }
  const paneBtn = (key, label, icon) => `<button type="button" class="pb" data-a="pane" data-v="${key}" aria-pressed="${ui.pane === key}" aria-label="${label}" title="${label}">${icon}</button>`;
  function headerHTML() {
    const st = glyphState();
    let title, sub, tint = C.focus;
    if (s.phase === 'ready') { title = 'FocusGuard'; sub = '3-day streak · ready when you are'; }
    else if (s.phase === 'recap') { title = 'Session complete'; sub = `${s.recap.label} · ${fmtTime(s.recap.start)}–${fmtTime(s.recap.end)}`; }
    else if (s.phase === 'break') { title = 'Break'; sub = `Back at ${fmtTime(s.breakStart + s.breakLen * 60)} · blocking paused`; tint = C.label; }
    else if (s.paused) { title = s.label; sub = `Paused · ${fmtM(Math.ceil(left() / 60))} left`; tint = C.label; }
    else { title = s.drifted ? `${s.label} · drifted` : s.label; sub = `${Math.round(sessionLen() / 60)}-minute session · started ${fmtTime(s.startedAt)}`; if (s.drifted) tint = C.ink; }
    return `<div class="mh"><button type="button" class="mb-music${s.music.playing ? ' on' : ''}" data-a="pane" data-v="music" aria-pressed="${ui.pane === 'music'}" aria-label="Music">${s.music.playing ? I.wave : I.note}</button>
      <span class="mh-g" style="color:${tint}"><svg viewBox="0 0 16 16" aria-hidden="true">${shieldGlyph(st, Math.min(1, s.active / sessionLen()))}</svg></span>
      <div class="mh-t"><p class="mh-title" style="${s.drifted && s.phase === 'session' && !s.paused ? `color:${C.ink}` : ''}">${esc(title)}</p><p class="mh-sub">${esc(sub)}</p></div>
      <div class="mh-panes">${paneBtn('insights', 'Insights', I.chart)}${paneBtn('apps', 'Apps & sites', I.grid)}${paneBtn('quick', 'Quick settings', I.sliders)}</div></div>`;
  }
  const legend = (counts) => `<div class="lg"><span><i style="background:${C.focus}"></i>Focused${counts ? ` ${counts.f}` : ''}</span><span><i style="background:${C.drift}"></i>Drifted${counts ? ` ${counts.d}` : ''}</span><span><i style="background:${C.other}"></i>Other${counts ? ` ${counts.o}` : ''}</span>`;
  const nowRow = () => {
    const cur = current();
    const show = cur.detail && cur.detail !== cur.app;
    return `<div class="now">${glyphTile(cur.front === 'browser' ? cur.host : cur.name, 30)}<div class="now-t"><b>${esc(cur.name)}</b>${show ? `<small>${esc(cur.detail)}</small>` : ''}</div><span class="now-k"><i style="background:${cur.kind === 'focus' ? C.focus : cur.kind === 'drift' ? C.drift : C.other}"></i>${KIND_LABEL[cur.kind]}</span></div>`;
  };
  const platters = (items) => `<div class="plat">${items.map(([a, icon, label]) => `<button type="button" data-a="${a}"><span>${icon}</span>${label}</button>`).join('')}</div>`;
  function dialHTML(min) {
    const size = 168, lw = 13, c = 84, r = (size - lw) / 2 - 3;
    let svg = `<svg viewBox="0 0 168 168" aria-hidden="true"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${C.control}" stroke-width="${lw}"/>`;
    for (let m = 0; m < 120; m += 5) {
      const q = m % 15 === 0, len = q ? 6 : 3, r0 = r - lw / 2 - 4, a = (m / 120) * 2 * Math.PI;
      svg += `<line x1="${(c + r0 * Math.sin(a)).toFixed(2)}" y1="${(c - r0 * Math.cos(a)).toFixed(2)}" x2="${(c + (r0 - len) * Math.sin(a)).toFixed(2)}" y2="${(c - (r0 - len) * Math.cos(a)).toFixed(2)}" stroke="${q ? C.other : C.grid}" stroke-width="${q ? 1.5 : 1}"/>`;
    }
    [[30, c + r - 28, c + 3.5], [60, c, c + r - 22], [90, c - r + 28, c + 3.5]].forEach(([t, x, y]) => { svg += `<text x="${x}" y="${y}" text-anchor="middle" font-size="10" fill="rgba(0,0,0,.4)">${t}</text>`; });
    const frac = Math.min(1, min / 120), a = frac * 360;
    if (frac > 0) svg += `<path d="${arcPath(c, r, 0, Math.min(359.95, a))}" fill="none" stroke="${C.focus}" stroke-width="${lw}"/>`;
    const kx = c + r * Math.sin((a * Math.PI) / 180), ky = c - r * Math.cos((a * Math.PI) / 180);
    svg += `<circle cx="${kx.toFixed(2)}" cy="${ky.toFixed(2)}" r="${(lw * (ui.dragging ? 0.8 : 0.65)).toFixed(1)}" fill="#fff" stroke="${C.focus}" stroke-width="${(lw * 0.23).toFixed(1)}"/></svg>`;
    const big = min >= 120 ? `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}` : `${min}`;
    return `<div class="dial" data-drag="dial" role="slider" tabindex="0" aria-label="Session length" aria-valuemin="5" aria-valuemax="480" aria-valuenow="${min}" aria-valuetext="${lenText(min)}">${svg}<div class="dial-c"><b>${big}</b><span>${min >= 120 ? 'hours' : 'min'}</span><small>ends ${fmtTime(s.clock + min * 60)}</small></div></div>`;
  }
  function rulerHTML(min) {
    const ppm = 3.2, w = (480 - 5) * ppm;
    let svg = `<svg width="${w + 40}" height="40" viewBox="-20 0 ${w + 40} 40" aria-hidden="true">`;
    for (let m = 5; m <= 480; m += 5) {
      const x = (m - 5) * ppm, preset = m === 25 || m === 50 || m === 90, lbl = preset || m === 60 || (m >= 120 && m % 60 === 0);
      const hgt = lbl ? 14 : m % 15 === 0 ? 10 : 6;
      svg += `<rect x="${(x - (preset ? 1 : 0.5)).toFixed(1)}" y="${18 - hgt}" width="${preset ? 2 : 1}" height="${hgt}" fill="${preset ? C.focus : 'rgba(0,0,0,.28)'}"/>`;
      if (lbl) svg += `<text x="${x.toFixed(1)}" y="32" text-anchor="middle" font-size="${preset ? 11 : 10}" font-weight="${preset ? 600 : 400}" fill="${preset ? C.focus : '#6E6E73'}">${m >= 120 ? `${m / 60}h` : m}</text>`;
    }
    return `<div class="ruler" data-drag="ruler" role="slider" tabindex="0" aria-label="Session length, ruler" aria-valuemin="5" aria-valuemax="480" aria-valuenow="${min}" aria-valuetext="${lenText(min)}"><div class="ruler-in" style="transform:translateX(${(-(min - 5) * ppm - 20).toFixed(1)}px)">${svg}</div><i class="ruler-m"></i></div>`;
  }
  function menuSections() {
    const out = [['head', headerHTML()]];
    if (s.phase === 'ready') {
      const tt = todayTotals();
      out.push(['today', `<div class="td-row"><b class="td-big">${fmtM(tt.f)}</b><span class="td-cap">focused today</span><span class="td-r">${Math.round((tt.f / ui.goal) * 100)}% of ${fmtM(ui.goal)}</span></div>${stripSVG(280, 30, { ghost: s.readyLen })}`, 'mod']);
      out.push(['dial', `${dialHTML(s.readyLen)}${rulerHTML(s.readyLen)}`, 'mod dial-mod']);
      out.push(['start', `<button type="button" class="cbtn prom wide" data-a="start">Start ${lenText(s.readyLen)} of focus</button>`, 'start-row']);
      out.push(['now', nowRow(), 'mod']);
    } else if (s.phase === 'session') {
      const cur = current();
      if (s.drifted && !s.paused) {
        const blocks = th().strict || s.block ? 'Screen<br>blocked' : `Screen blocks<br>in ${Math.max(0, Math.ceil(th().block - s.streak))} s`;
        out.push(['drift', `<div class="dr-top">${glyphTile(cur.host, 30)}<div class="dr-t"><b>${esc(cur.host.replace(/^www\./, ''))}</b><small>You've been here ${clockText(s.streak)}</small></div><span class="dr-c">${blocks}</span></div><div class="dr-btns"><button type="button" class="cbtn prom" data-a="back">Back to work</button><button type="button" class="cbtn" data-a="forwork" title="Stop nudging about ${esc(cur.host)} until this session ends.">It's for work</button></div>`, 'mod tint-d']);
      }
      const t = totals();
      const big = clockText(left());
      out.push(['ring', `<div class="ring r168">${ringSVG(168, 13)}<div class="ring-c"><b class="${big.length > 5 ? 'sm' : ''}">${big}</b><span>left</span><small>${s.paused ? 'paused' : `ends ${fmtTime(endsAt())}`}</small></div></div>${legend()}<b class="lg-r">${pctOf(t)}% focused</b></div>`, 'mod ring-mod']);
      const zoneOn = !s.drifted && current().kind === 'focus';
      const right = s.drifted ? `<span class="zr">Run ended at ${s.zoneRun} min</span><span class="zr2">Restarts when you're back</span>` : s.zoneRun > s.bestToday ? '<span class="zr best">New best today</span>' : `<span class="zr">Best today ${s.bestToday} min</span><span class="zbar"><i style="width:${Math.min(100, (s.zoneRun / s.bestToday) * 100).toFixed(0)}%"></i></span>`;
      out.push(['zone', `<span class="zg${zoneOn ? ' on' : ''}">${zoneGlyph(zoneOn)}</span><div class="z-t"><span>In the zone</span><b>${s.drifted ? 0 : s.zoneRun} min</b></div><div class="z-r">${right}</div>`, 'mod zone-mod']);
      out.push(['plat', platters([['pause', s.paused ? I.play : I.pause, s.paused ? 'Resume' : 'Pause'], ['more', I.plus, '5 more min'], ['end', I.stop, 'End']])]);
      if (!s.drifted) out.push(['now', nowRow(), 'mod']);
    } else if (s.phase === 'recap') {
      const r = s.recap;
      out.push(['ring', `<div class="ring r168">${ringSVG(168, 13, { closed: true, rec: r })}<div class="ring-c"><b class="pct">${r.pct}%</b><span>focused</span><small>${r.t.f} of ${r.t.f + r.t.d + r.t.o} min</small></div></div>${legend(r.t)}</div>`, 'mod ring-mod']);
      out.push(['stats', `<div><span>Longest in the zone</span><b>${r.longest} min</b>${r.longest >= s.bestToday ? '<em>Best today</em>' : ''}</div><div><span>Most drift</span><b>${r.most ? `${esc(r.most[0])} · ${Math.max(1, Math.round(r.most[1] / 60))} min` : 'None'}</b></div>`, 'mod stats-mod']);
      out.push(['next', '<span>Up next</span><button type="button" data-a="done">Done</button>', 'next-row']);
      out.push(['brk', `<button type="button" class="cbtn prom wide" data-a="break">Take a ${breakFor(r.len)}-minute break</button>`, 'start-row']);
      out.push(['ruler', rulerHTML(s.readyLen), 'ruler-row']);
      out.push(['again', `<button type="button" class="cbtn wide" data-a="start">Start ${lenText(s.readyLen)}</button>`, 'start-row']);
    } else {
      const total = s.breakLen * 60, l = breakLeft(), c = 60, r = 52;
      out.push(['bring', `<div class="ring r120"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${C.control}" stroke-width="8"/>${l > 0 ? `<path d="${arcPath(c, r, 360 - (l / total) * 360, 359.9)}" fill="none" stroke="rgba(29,29,31,.78)" stroke-width="8" stroke-linecap="round"/>` : ''}</svg><div class="ring-c"><span>back at</span><b class="bk">${fmtTime(s.breakStart + total)}</b></div></div><p class="tip">${MENU_TIPS[s.breakTip]}</p>`, 'mod break-mod']);
      out.push(['plat', platters([['breakmore', I.plus, '5 more min'], ['endbreak', I.stop, 'End break']])]);
      if (ui.breakHidden) out.push(['showbrk', '<button type="button" class="cbtn wide" data-a="showbreak">Show the break screen</button>', 'start-row']);
    }
    out.push(['rows', `<i class="sep"></i>${s.phase !== 'ready' ? `<p class="row-t">Today · ${fmtM(todayTotals().f)} focused</p>` : ''}<button type="button" class="mrow" data-a="win" data-v="today">Open FocusGuard</button><button type="button" class="mrow" data-a="win" data-v="settings"><span>Settings…</span><kbd>⌘,</kbd></button><i class="sep"></i><button type="button" class="mrow" data-a="quit"><span>Quit FocusGuard</span><kbd>⌘Q</kbd></button>`, 'rows']);
    return out;
  }

  /* ---------- side panes ---------- */
  const paneTitle = (title, extra = '') => `<div class="pt"><h4>${title}</h4>${extra}<button type="button" class="pt-x" data-a="pane" data-v="${ui.pane}" aria-label="Close ${title}">${I.x}</button></div>`;
  const seg = (name, opts, val, small = false) => `<div class="seg${small ? ' sm' : ''}" role="group">${opts.map(([v, l]) => `<button type="button" data-a="${name}" data-v="${v}" aria-pressed="${val === v}">${l}</button>`).join('')}</div>`;
  const chipBtn = (name, kind) => `<span class="chip-w"><button type="button" class="kchip" data-a="chip" data-v="${esc(name)}">${KIND_LABEL[kind]} ▾</button>${ui.chip === name ? `<span class="chip-menu" role="menu">${['focus', 'neutral', 'drift'].map((k) => `<button type="button" role="menuitemradio" aria-checked="${k === kind}" data-a="setkind" data-v="${esc(name)}|${k}">${KIND_LABEL[k]}</button>`).join('')}</span>` : ''}</span>`;
  function usageRows(limit, { chip = true, barW = 70, only = null } = {}) {
    const rows = Object.entries(s.usage).filter(([n]) => !only || s.rules[n] === only).sort((a, b) => b[1] - a[1]).slice(0, limit);
    const max = Math.max(1, ...rows.map((r) => r[1]));
    return rows.map(([n, secs]) => { const k = s.rules[n] || 'neutral'; return `<div class="ur"><span class="ur-n">${esc(n)}</span><span class="ur-b" style="width:${barW}px"><i style="width:${((secs / max) * 100).toFixed(0)}%;background:${kindColor(k)}"></i></span><span class="ur-t">${fmtM(secs / 60)}</span>${chip ? chipBtn(n, k) : ''}</div>`; }).join('') || '<p class="empty">Nothing tracked yet.</p>';
  }
  function sessionRows(limit) {
    const list = sessionsToday().slice(-limit).reverse();
    return list.map((x) => {
      const when = x.running ? `${fmtTime(x.start)} – now · ${x.minsIn} of ${x.len} min` : `${fmtTime(x.start)}–${fmtTime(x.end)} · ${x.len} min`;
      if (ui.delSession === x.id) return `<div class="sr confirm"><span>Delete this session? Activity stays in reports.</span><button type="button" data-a="delsess" data-v="cancel">Cancel</button><button type="button" class="red" data-a="delsess" data-v="${x.id}">Delete</button></div>`;
      const name = ui.renaming === x.id ? `<input class="rename" data-rename="${x.id}" value="${esc(x.label)}" aria-label="Session name">` : `<b>${esc(x.label)}</b>`;
      return `<div class="sr">${miniRing(26, 4, x.pct / 100)}<div class="sr-t">${name}<small>${when}</small></div><span class="sr-p">${x.pct}%</span><span class="sr-a"><button type="button" data-a="rename" data-v="${x.id}" aria-label="Rename ${esc(x.label)}">${I.pencil}</button>${x.running ? '' : `<button type="button" data-a="delask" data-v="${x.id}" aria-label="Delete ${esc(x.label)}">${I.trash}</button>`}</span></div>`;
    }).join('');
  }
  function weekBars(h, barMax, { tooltip = true } = {}) {
    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'], full = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const tt = todayTotals();
    const data = days.map((d, i) => (i < todayIdx ? { f: WEEK.f[i], d: WEEK.d[i], o: WEEK.o[i] } : i === todayIdx ? tt : null));
    const top = Math.max(ui.goal * 1.15, ...data.filter(Boolean).map((x) => x.f + x.d + x.o));
    const y = (m) => h - (m / top) * h;
    const goalY = y(ui.goal);
    const bars = data.map((x, i) => {
      if (!x) return `<div class="wb future" title="${full[i]}"><span class="wb-stack" style="height:${((ui.goal / top) * 100).toFixed(1)}%"></span><em>${days[i]}</em></div>`;
      const tot = x.f + x.d + x.o;
      const seg2 = (v, col) => `<i style="height:${((v / tot) * 100).toFixed(1)}%;background:${col}"></i>`;
      return `<div class="wb${i === todayIdx ? ' today' : ''}" tabindex="0" title="${full[i]} · ${fmtM(x.f)} focused · ${pctOf(x)}%"><span class="wb-stack" style="height:${((tot / top) * 100).toFixed(1)}%;max-width:${barMax}px">${seg2(x.o, C.other)}${seg2(x.d, C.drift)}${seg2(x.f, C.focus)}</span><em>${days[i]}</em></div>`;
    }).join('');
    return `<div class="wk" style="height:${h + 18}px"><i class="wk-goal" style="top:${goalY.toFixed(1)}px"></i>${bars}</div>`;
  }
  function insightsHTML() {
    const ctl = seg('instab', [['today', 'Today'], ['week', 'Week']], ui.insTab, true);
    if (ui.insTab === 'today') {
      const tt = todayTotals(), rate = pctOf(tt), n = sessionsToday();
      return [['t', paneTitle('Insights', ctl)],
        ['tiles', `<div class="tile"><span>Focused</span><b>${fmtM(tt.f)}</b><small>${Math.round((tt.f / ui.goal) * 100)}% of goal</small></div><div class="tile"><span>Focus rate</span><b>${rate}%</b><small>${rate - AVG > 0 ? `+${rate - AVG}` : rate - AVG === 0 ? 'same as avg' : `−${AVG - rate}`}${rate - AVG ? ' pts vs avg' : ''}</small></div><div class="tile"><span>Sessions</span><b>${n.length}</b><small>${n.some((x) => x.running) ? '1 running' : 'today'}</small></div>`, 'tiles'],
        ['day', `<div class="sh"><b>Your day</b><span>Sessions on top, activity below</span></div>${stripSVG(320, 62, { lanes: true })}`, 'blk'],
        ['sess', `<div class="sh"><b>Sessions</b></div>${sessionRows(4)}`, 'blk'],
        ['apps', `<div class="sh"><b>Top apps &amp; sites today</b></div>${usageRows(4)}`, 'blk'],
        ['foot', '<span></span><button type="button" class="lnk" data-a="win" data-v="reports">Open full report ›</button>', 'pfoot']];
    }
    const tt = todayTotals();
    const F = WEEK.f.slice(0, todayIdx).reduce((a, b) => a + b, 0) + tt.f, D = WEEK.d.slice(0, todayIdx).reduce((a, b) => a + b, 0) + tt.d, O = WEEK.o.slice(0, todayIdx).reduce((a, b) => a + b, 0) + tt.o;
    return [['t', paneTitle('Insights', ctl)],
      ['tiles', `<div class="tile"><span>Focused</span><b>${fmtM(F)}</b><small>+1h 20m vs last week</small></div><div class="tile"><span>Focus rate</span><b>${pctOf({ f: F, d: D, o: O })}%</b><small>Best day: Thu</small></div><div class="tile"><span>Streak</span><b>3 days</b><small>goal met</small></div>`, 'tiles'],
      ['per', `<div class="sh"><b>Per day</b><span class="sw"><i style="background:${C.focus}"></i>Focused <i style="background:${C.drift}"></i>Drifted <i style="background:${C.other}"></i>Other</span></div>${weekBars(150, 28)}`, 'blk'],
      ['dist', `<div class="sh"><b>Top distractions</b></div>${usageRows(3, { chip: false, barW: 134, only: 'drift' })}`, 'blk'],
      ['foot', `<button type="button" class="cbtn sm" data-a="export">${I.down} Export CSV</button><button type="button" class="lnk" data-a="win" data-v="reports">Open full report ›</button>`, 'pfoot']];
  }
  function appRow(name, sub, kind, isRule) {
    return `<div class="ar">${glyphTile(name, 26)}<div class="ar-t"><b>${esc(name)}</b><small>${sub}</small></div><div class="kp" role="group" aria-label="Category for ${esc(name)}">${['focus', 'neutral', 'drift'].map((k) => `<button type="button" data-a="setkind" data-v="${esc(name)}|${k}" aria-pressed="${kind === k}" class="k-${k}">${k === 'drift' ? 'Distr.' : KIND_LABEL[k]}</button>`).join('')}</div>${isRule ? `<button type="button" class="ar-del" data-a="delrule" data-v="${esc(name)}" aria-label="Remove the rule for ${esc(name)}">${I.trash}</button>` : ''}</div>`;
  }
  function appsListHTML() {
    const q = ui.query.trim().toLowerCase();
    const used = Object.entries(s.usage).sort((a, b) => b[1] - a[1]).map(([n, secs]) => ({ n, sub: `${s.types[n] || 'Site'} · ${fmtM(secs / 60)} today`, kind: s.rules[n] || 'neutral', rule: false }));
    const usedNames = new Set(used.map((x) => x.n));
    const rules = s.userRules.filter((r) => !usedNames.has(r.name)).map((r) => ({ n: r.name, sub: `${r.type} · your rule`, kind: s.rules[r.name] || r.kind, rule: true }));
    const all = [...used, ...rules];
    const pass = (x) => (ui.filter === 'all' || x.kind === ui.filter) && (!q || x.n.toLowerCase().includes(q));
    const count = (k) => all.filter((x) => x.kind === k).length;
    const chips = [['all', 'All'], ['focus', `Focus ${count('focus')}`], ['neutral', `Neutral ${count('neutral')}`], ['drift', `Distracting ${count('drift')}`]].map(([v, l]) => `<button type="button" data-a="filter" data-v="${v}" aria-pressed="${ui.filter === v}">${l}</button>`).join('');
    const u = used.filter(pass), r = rules.filter(pass);
    const body = !u.length && !r.length ? `<p class="empty">${q ? `No matches for “${esc(ui.query)}”.` : 'Nothing tracked yet today.'}</p>`
      : `${u.length ? `<p class="lh">Used today</p>${u.map((x) => appRow(x.n, x.sub, x.kind, s.userRules.some((y) => y.name === x.n))).join('')}` : ''}${r.length ? `<p class="lh">Your rules</p>${r.map((x) => appRow(x.n, x.sub, x.kind, true)).join('')}` : ''}`;
    return [['chips', chips, 'fchips'], ['list', body, 'alist']];
  }
  function appsHTML(withTitle = true) {
    return [...(withTitle ? [['t', paneTitle('Apps &amp; sites')]] : []),
      ['search', `<label class="srch">${I.search}<input type="search" data-input="query" placeholder="Search apps and sites" aria-label="Search apps and sites"></label>`, 'srch-w'],
      ...appsListHTML(),
      ['add', '<input type="text" data-input="addsite" placeholder="Add a distracting site, e.g. reddit.com" aria-label="Add a distracting site"><button type="button" class="add-b" data-a="addsite">' + I.plus + ' Add</button>', 'addr'],
      ['note', `<p class="fn${ui.addErr ? ' err' : ''}">${ui.addErr || 'Changing a category also updates past activity in your reports.'}</p>`, '']];
  }
  const sw = (key, on) => `<button type="button" class="sw" role="switch" aria-checked="${on}" data-a="pref" data-v="${key}"><i></i></button>`;
  function quickHTML() {
    const p = th();
    const lens = [25, 50, 90].includes(ui.defLen) ? [25, 50, 90] : [25, 50, 90, ui.defLen];
    const row = (title, ctl, detail = '') => `<div class="qr"><div><span>${title}</span>${detail ? `<small>${detail}</small>` : ''}</div>${ctl}</div>`;
    const confirm = ui.confirm ? `<div class="qr confirm"><span>${ui.confirm === 'today' ? 'Delete everything tracked today?' : 'Erase all history, sessions and rules?'}</span><button type="button" data-a="confirm" data-v="cancel">Cancel</button><button type="button" class="red" data-a="confirm" data-v="ok">Delete</button></div>` : '';
    return [['t', paneTitle('Quick settings')],
      ['s1', `<p class="cap">Sessions</p><div class="grp">${row('Default length', seg('deflen', lens.map((m) => [String(m), String(m)]), String(ui.defLen), true))}${row('Daily focus goal', `<span class="step"><b>${fmtM(ui.goal)}</b><button type="button" data-a="goal" data-v="-" aria-label="Lower the goal">−</button><button type="button" data-a="goal" data-v="+" aria-label="Raise the goal">+</button></span>`)}</div>`],
      ['s2', `<p class="cap">When you drift</p><div class="grp"><div class="qr col">${seg('preset', [['gentle', 'Gentle'], ['standard', 'Standard'], ['strict', 'Strict']], s.preset)}<small>${s.preset === 'custom' ? 'Custom — tuned in Settings → Escalation' : p.note}</small></div>${row('Start sessions from calendar', sw('calendar', ui.prefs.calendar), ui.prefs.calendar ? 'Needs calendar access — set up in Settings' : '')}${row('Launch at login', sw('login', ui.prefs.login))}${row('Notifications', sw('notifs', ui.prefs.notifs), 'Nudges, session updates, daily wrap-up')}${row('Show time in menu bar', sw('showTime', ui.prefs.showTime), 'Minutes left, like “24m”')}</div>`],
      ['s3', `<p class="cap">Permissions</p><div class="grp">${row('Screen Recording', `<span class="ok">${I.check} Allowed</span>`)}${row('Notifications', `<span class="ok">${I.check} Allowed</span>`)}</div>`],
      ['s4', `<p class="cap">Data</p><div class="grp">${row('Keep history', `<button type="button" class="menu-b" data-a="keep">${ui.keep} ▾</button>`)}${confirm || `<button type="button" class="qr red-row" data-a="ask" data-v="today">Delete today's activity…</button><button type="button" class="qr red-row" data-a="ask" data-v="all">Erase all FocusGuard data…</button>`}</div>`],
      ['foot', '<span class="muted">Changes save instantly.</span><button type="button" class="lnk" data-a="win" data-v="settings">All settings ›</button>', 'pfoot']];
  }
  const LISTS = [
    { name: 'Focus mix', kind: 'Playlist', songs: 24, dur: '1 hr 12 min', art: 'linear-gradient(135deg,#6155F5,#A9A2FF)', sessions: true, tracks: ['Slow Current', 'Paper Planes', 'Long Exposure', 'Quiet Hours'] },
    { name: 'Rain & piano', kind: 'Playlist', songs: 31, dur: '1 hr 48 min', art: 'linear-gradient(135deg,#3D6A8F,#9CC4E4)', sessions: false, tracks: ['After the Shower', 'Window Seat', 'Grey Afternoon', 'Drizzle'] },
    { name: 'Late night', kind: 'Album', songs: 11, dur: '42 min', art: 'linear-gradient(135deg,#2B2433,#B86A78)', sessions: false, tracks: ['Night Bus', 'Neon Rain', 'Last Train Home', 'Afterglow'] },
  ];
  function musicHTML() {
    const m = s.music, L = LISTS[m.list], title = L.tracks[m.track % L.tracks.length];
    const pos = Math.floor(m.pos), dur = 214;
    return [['t', `<div class="pt"><h4>Music</h4><button type="button" class="cbtn xs" data-a="openmusic">${I.open} Open ${m.service}</button><button type="button" class="pt-x" data-a="pane" data-v="music" aria-label="Close Music">${I.x}</button></div>`],
      ['svc', seg('service', [['Apple Music', 'Apple Music'], ['Spotify', 'Spotify']], m.service), 'svc'],
      ['play', `<div class="art" style="background:${L.art}"></div><b class="mt">${title}</b><span class="ma">Sample artist</span><small class="mf">from ${L.name}</small><div class="seek"><i style="width:${((pos / dur) * 100).toFixed(1)}%"></i></div><div class="st"><span>${Math.floor(pos / 60)}:${String(pos % 60).padStart(2, '0')}</span><span>-${Math.floor((dur - pos) / 60)}:${String((dur - pos) % 60).padStart(2, '0')}</span></div><div class="tr"><button type="button" data-a="mshuffle" aria-pressed="${m.shuffle}" aria-label="Shuffle">${I.shuffle}</button><button type="button" data-a="mprev" aria-label="Previous">${I.back}</button><button type="button" class="pp" data-a="mplay" aria-label="${m.playing ? 'Pause' : 'Play'}">${m.playing ? I.pause : I.play}</button><button type="button" data-a="mnext" aria-label="Next">${I.fwd}</button><button type="button" data-a="mrepeat" aria-pressed="${m.repeat}" aria-label="Repeat">${I.repeat}</button></div><label class="vol">${I.speaker}<input type="range" min="0" max="100" value="${m.vol}" data-input="vol" aria-label="Volume">${I.speakerHi}</label>`, 'mplay'],
      ['lists', `<div class="sh"><b>Playlists</b></div>${LISTS.map((x, i) => `<button type="button" class="pl" data-a="mlist" data-v="${i}"><span class="pl-a" style="background:${x.art}"></span><span class="pl-t"><b>${x.name}</b><small>${m.playing && m.list === i ? 'Playing' : x.kind}</small></span>${x.sessions ? `<span class="pill-sess">${I.check} Sessions</span>` : ''}<span class="chev">${I.chevR}</span></button>`).join('')}<p class="fn">The Sessions playlist starts with each session, pauses with it and stops when it ends.</p>`, 'blk']];
  }

  /* ---------- the main window ---------- */
  const winNav = [['today', 'Today', I.clock], ['reports', 'Reports', I.chart], ['apps', 'Apps &amp; Sites', I.grid], ['settings', 'Settings', I.sliders]];
  function sessionCardHTML() {
    if (s.phase === 'session') return `<div class="scard">${miniRing(30, 5, Math.min(1, s.active / sessionLen()))}<div><b>${esc(s.label)}</b><small>${s.paused ? 'Paused' : `${Math.ceil(left() / 60)} min left`}</small></div><button type="button" class="circ" data-a="pause" aria-label="${s.paused ? 'Resume' : 'Pause'}">${s.paused ? I.play : I.pause}</button></div>`;
    if (s.phase === 'break') return `<div class="scard"><span class="cupi">${I.cup}</span><div><b>Break</b><small>Back at ${fmtTime(s.breakStart + s.breakLen * 60)}</small></div><button type="button" class="circ" data-a="endbreak" aria-label="End break">${I.stop}</button></div>`;
    return `<div class="scard"><button type="button" class="cbtn prom wide" data-a="start" data-len="${ui.defLen}">${I.play} Start ${ui.defLen} min focus</button></div>`;
  }
  function todayPage() {
    const tt = todayTotals(), rate = pctOf(tt), n = sessionsToday();
    const frac = Math.min(1, tt.f / ui.goal);
    const goalRing = `<svg viewBox="0 0 150 150" aria-hidden="true"><circle cx="75" cy="75" r="64" fill="none" stroke="rgba(97,85,245,.14)" stroke-width="17"/>${frac > 0 ? `<path d="${arcPath(75, 64, 0, Math.min(359.9, frac * 360))}" fill="none" stroke="${C.focus}" stroke-width="17" stroke-linecap="round"/>` : ''}</svg>`;
    let now;
    if (s.phase === 'session') {
      now = `<div class="nc-h"><span><i style="background:${C.focus}"></i>${esc(s.label)} · ${s.paused ? 'paused' : 'now'}</span><small>ends ${fmtTime(endsAt())}</small></div><div class="nc-b"><div class="ring r110">${ringSVG(110, 11)}<div class="ring-c"><b class="m">${clockText(left())}</b><span>left</span></div></div><div><span class="k">In the zone</span><b class="v">${s.drifted ? 0 : s.zoneRun} min</b><small>Best today ${s.bestToday} min</small></div></div><div class="pills"><button type="button" data-a="pause">${s.paused ? 'Resume' : 'Pause'}</button><button type="button" data-a="more">5 more min</button><button type="button" data-a="end">End</button></div>`;
    } else if (s.phase === 'break') {
      now = `<div class="nc-h"><span>${I.cup} On a break</span></div><p class="nc-p"><b>Back at ${fmtTime(s.breakStart + s.breakLen * 60)}</b><br>${MENU_TIPS[s.breakTip]}</p><div class="pills"><button type="button" data-a="breakmore">5 more min</button><button type="button" data-a="endbreak">End break</button></div>`;
    } else {
      const last = n[n.length - 1];
      now = `<div class="nc-h"><span>Ready to focus</span></div><p class="nc-p">${last ? `Last session: ${last.pct}% focused, ${last.zone} min in the zone.` : 'Pick a length and go. The menu bar shows how it\'s going.'}</p><div class="pills">${[25, 50, 90].map((m) => `<button type="button" data-a="pick" data-v="${m}" aria-pressed="${s.readyLen === m}">${m} min</button>`).join('')}</div><button type="button" class="cbtn prom wide" data-a="start">Start ${s.readyLen} minutes of focus</button>`;
    }
    return [['h', `<div class="ph"><div><h3>Today</h3><p>${dateLong}</p></div><div class="ph-c"><span class="stepper"><button type="button" data-a="toast" data-v="This demo only has today." aria-label="Previous day">${I.chevL}</button><button type="button" disabled aria-label="Next day">${I.chevR}</button></span><button type="button" class="hcap" data-a="export">Export</button></div></div>`],
      ['top', `<div class="wc goal"><div class="gr">${goalRing}<div class="gr-c"><b>${fmtM(tt.f)}</b><span>of ${fmtM(ui.goal)} goal</span></div></div><div class="gs"><div><span>Focus rate</span><b>${rate}%</b><small>${rate === AVG ? 'same as avg' : rate > AVG ? `+${rate - AVG} pts vs avg` : `−${AVG - rate} pts vs avg`}</small></div><div><span>Best in the zone</span><b>${Math.max(s.bestToday, s.bestRun)} min</b><small>longest run</small></div><div><span>Sessions</span><b>${n.length}</b><small>${fmtM(n.reduce((a, x) => a + (x.running ? x.minsIn : x.len), 0))} in sessions</small></div><div><span>Streak</span><b>3 days</b><small>goal met in a row</small></div></div></div><div class="wc nowc">${now}</div>`, 'row2'],
      ['day', `<div class="wc"><div class="ch"><b>Your day</b><span class="sw"><i style="background:${C.focus}"></i>Focused <i style="background:${C.drift}"></i>Drifted <i style="background:${C.other}"></i>Other</span></div>${stripSVG(640, 96, { lanes: true })}</div>`],
      ['bottom', `<div class="wc"><div class="ch"><b>Sessions</b><span>Hover to rename or delete</span></div>${sessionRows(6) || '<p class="empty">No sessions yet today.</p>'}</div><div class="wc"><div class="ch"><b>Top apps &amp; sites</b><button type="button" class="lnk" data-a="winpage" data-v="apps">Manage ›</button></div>${usageRows(5, { barW: 110 })}</div>`, 'row2 b']];
  }
  function summaryText() {
    const tt = todayTotals();
    const F = WEEK.f.slice(0, todayIdx).reduce((a, b) => a + b, 0) + tt.f, D = WEEK.d.slice(0, todayIdx).reduce((a, b) => a + b, 0) + tt.d, O = WEEK.o.slice(0, todayIdx).reduce((a, b) => a + b, 0) + tt.o;
    const dist = Object.entries(s.usage).filter(([n]) => s.rules[n] === 'drift').sort((a, b) => b[1] - a[1]).slice(0, 5);
    const dTot = Math.max(1, dist.reduce((a, x) => a + x[1], 0));
    return `Focus report — ${weekTitle}\nFocus: ${Math.round(F)} min (${pctOf({ f: F, d: D, o: O })}%)\nNeutral: ${Math.round(O)} min\nDistraction: ${Math.round(D)} min\nTracked total: ${Math.round(F + D + O)} min\nCurrent focus streak: 3 days\n7-day average focus: 214 min/day\n\nTop distractions:\n${dist.map(([n, x], i) => `${i + 1}. ${n} — ${Math.round(x / 60)} min (${Math.round((x / dTot) * 100)}% of distraction time)`).join('\n')}`;
  }
  function aiTips() {
    const top = Object.entries(s.usage).filter(([n]) => s.rules[n] === 'drift').sort((a, b) => b[1] - a[1])[0];
    return [
      `Start Deep work at 10 AM. Your strongest runs this week began then; keep email for the afternoon.`,
      top ? `${top[0]} took ${fmtM(top[1] / 60)} of today's drift. Leave it closed until your first session ends.` : 'Drift was low today. Keep the same session length tomorrow.',
      `Your 50-minute sessions hold above 80% focus. Stay at 50 and take the 10-minute break between them.`,
    ];
  }
  function reportsPage() {
    const titles = { day: dateLong, week: weekTitle, month: today.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), year: String(today.getFullYear()) };
    const vs = { day: 'vs the day before', week: 'vs last week', month: 'vs last month', year: 'vs last year' }[ui.period];
    const tt = todayTotals();
    const F = WEEK.f.slice(0, todayIdx).reduce((a, b) => a + b, 0) + tt.f, D = WEEK.d.slice(0, todayIdx).reduce((a, b) => a + b, 0) + tt.d, O = WEEK.o.slice(0, todayIdx).reduce((a, b) => a + b, 0) + tt.o;
    const top = Object.entries(s.usage).filter(([n]) => s.rules[n] === 'drift').sort((a, b) => b[1] - a[1])[0];
    let heat = '';
    const hrs = Array.from({ length: 13 }, (_, i) => 7 + i);
    ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach((d, di) => {
      heat += `<span class="hm-d">${d}</span>${hrs.map((h) => { const v = di > 4 ? (h > 9 && h < 14 ? 1 : 0) : Math.max(0, Math.round(4 - Math.abs(h - 10.5) * 0.9 + ((di * 7 + h) % 3) - 1)); return `<i class="hm-c l${Math.min(5, v)}"></i>`; }).join('')}`;
    });
    const highlights = [`Focus is up 12% ${vs} (${fmtM(F / 1.12)} → ${fmtM(F)}).`, 'Your strongest hour over the last two weeks starts at 10:00 AM.', top ? `${top[0]} is taking ${fmtM(top[1] / 60 * 0.4)} more than the period before.` : null, top ? `Most drift: ${top[0]}, ${fmtM(top[1] / 60)}.` : null].filter(Boolean);
    const a = ui.ai;
    const aiReady = a.enabled && a.keySaved;
    const btn = aiReady ? `<button type="button" class="cbtn xs prom" data-a="aitips" ${a.tips === 'loading' ? 'disabled' : ''}>${a.tips === 'loading' ? 'Thinking…' : a.tips === 'loaded' ? 'Refresh tips' : `${I.spark} Get AI tips`}</button>` : '';
    let ai;
    if (!aiReady) ai = `<p class="ai-n">Add an AI provider in Settings → AI for personal tips. Only a summary is sent, never window titles. <button type="button" class="lnk" data-a="winpage" data-v="settings:ai">Settings → AI ›</button></p>`;
    else if (a.tips === 'loading') ai = '<p class="ai-n"><span class="spin"></span> Reading this period…</p>';
    else if (a.tips === 'loaded') ai = `<hr>${aiTips().map((t) => `<p class="ai-t">${esc(t)}</p>`).join('')}<p class="ai-n">Sample tips written for this demo's data. In the app they come from your own AI provider.</p>`;
    else ai = '<p class="ai-n">Tips use your AI provider. Only a summary is sent, and only when you ask.</p>';
    return [['h', `<div class="ph"><div><h3>Reports</h3><p>${titles[ui.period]}</p></div><div class="ph-c">${seg('period', [['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']], ui.period, true)}<span class="stepper"><button type="button" data-a="toast" data-v="This demo only has this ${ui.period}." aria-label="Previous">${I.chevL}</button><button type="button" disabled aria-label="Next">${I.chevR}</button></span><button type="button" class="hcap" data-a="export">Export ▾</button></div></div>`],
      ['kpi', `<div class="kpi"><span>Focused</span><b>${fmtM(F)}</b><small>+12% ${vs}</small></div><div class="kpi"><span>Focus rate</span><b>${pctOf({ f: F, d: D, o: O })}%</b><small>+4 pts ${vs}</small></div><div class="kpi"><span>Longest in the zone</span><b>${Math.max(38, s.bestToday)} min</b><small>across ${9 + s.done.length} sessions</small></div><div class="kpi"><span>Drifted</span><b>${fmtM(D)}</b><small>−8% ${vs}</small></div>`, 'kpis'],
      ['mid', `<div class="wc"><div class="ch"><b>${ui.period === 'day' ? 'Per hour' : ui.period === 'year' ? 'Per month' : 'Per day'}</b><span class="sw"><i style="background:${C.focus}"></i>Focused <i style="background:${C.drift}"></i>Drifted <i style="background:${C.other}"></i>Other · Goal ${fmtM(ui.goal)}</span></div>${weekBars(180, 36)}</div><div class="wc ins"><div class="ch"><b>${zoneGlyph(true)} Insights</b>${btn}</div>${highlights.map((h) => `<p class="hl"><i></i>${esc(h)}</p>`).join('')}${ai}</div>`, 'row2 r'],
      ['bot', `<div class="wc"><div class="ch"><b>When you focus</b><span class="sw">Less <i class="hm-c l1"></i><i class="hm-c l2"></i><i class="hm-c l3"></i><i class="hm-c l4"></i><i class="hm-c l5"></i> More</span></div><div class="hm"><span></span>${hrs.map((h) => `<span class="hm-h">${h % 12 || 12}</span>`).join('')}${heat}</div></div><div class="wc"><div class="ch"><b>Apps &amp; sites</b></div>${usageRows(6, { barW: 64 })}</div>`, 'row2 r']];
  }
  function appsPage() {
    return [['h', '<div class="ph"><div><h3>Apps &amp; Sites</h3><p>Decide what counts as focus. Changes also update past reports.</p></div></div>'], ['card', '', 'wc appcard']];
  }
  const SETTINGS = [['general', 'General', I.gear, '#8E8E93'], ['sessions', 'Sessions', I.timer, '#6155F5'], ['escalation', 'Escalation', I.bell, '#FF9F0A'], ['rules', 'Rules', I.list, '#5E5CE6'], ['ai', 'AI', I.spark, '#AF52DE'], ['privacy', 'Privacy', I.lock, '#1A73E8'], ['about', 'About', I.info, '#FF8D28']];
  function settingsPane() {
    const row = (title, help, ctl) => `<div class="sr2"><div><b>${title}</b>${help ? `<small>${help}</small>` : ''}</div>${ctl}</div>`;
    const sec = (cap, body) => `<p class="sc">${cap}</p><div class="sg">${body}</div>`;
    const head = (title, desc) => `<h3 class="sp-t">${title}</h3><p class="sp-d">${desc}</p>`;
    const p = ui.prefs;
    switch (ui.setPane) {
      case 'general': return head('General', 'Appearance and launch behavior.') + sec('Startup', row('Launch at login', 'Open FocusGuard automatically when you sign in.', sw('login', p.login)) + row('Show in Dock', 'Adds a permanent FocusGuard icon to your Dock so you can launch it without finding the menu bar item. Takes effect immediately.', sw('dock', p.dock))) + sec('Appearance', row('Show time in menu bar', 'Minutes left beside the FocusGuard icon during a session or break, like “24m”.', sw('showTime', p.showTime)) + row('Show notifications', 'Drift nudges, session and break updates, and the daily wrap-up. Turn off to silence every FocusGuard notification.', sw('notifs', p.notifs)));
      case 'sessions': return head('Sessions', 'Defaults applied when you press Start without specifying a duration.') + sec('Daily goal', row('Daily focus goal', 'Drives the progress bar in the popover and the end-of-day summary notification.', `<span class="step"><b>${fmtM(ui.goal)}</b><button type="button" data-a="goal" data-v="-" aria-label="Lower the goal">−</button><button type="button" data-a="goal" data-v="+" aria-label="Raise the goal">+</button></span>`) + row('Weekends count toward streak', "When off, Saturday and Sunday are skipped during streak calculation so a quiet weekend doesn't break a weekday streak.", sw('weekends', p.weekends))) + sec('Defaults', row('Default duration', 'Used when you press Start without picking a length.', seg('deflen', [['25', '25'], ['50', '50'], ['90', '90'], ['120', '120']], String(ui.defLen), true)) + row('Default label', 'Shown in reports next to each session.', `<span class="field">${esc(s.label)}</span>`)) + sec('Breaks', row('Strict mode (no skipping)', 'When on, the break overlay can only be extended — Skip and Hide are disabled. Helps if you tend to skip your way through every break.', sw('strictBreaks', p.strictBreaks))) + sec('System focus', row('Run a Shortcut on session start/end', 'Pick Shortcuts like “FocusGuard · Start Work” to turn on a Focus mode.', sw('shortcuts', p.shortcuts))) + sec('Calendar autostart', row('Autostart on calendar event', p.autostart ? 'Match keyword: focus. No upcoming events containing the keyword in the next 12 hours.' : 'Start a session when an event matching a keyword begins.', sw('autostart', p.autostart)));
      case 'escalation': {
        const t = th();
        const stepRow = (title, key, help) => row(title, help, `<span class="step"><b>${t[key]} sec</b><button type="button" data-a="tune" data-v="${key}|-" aria-label="Less">−</button><button type="button" data-a="tune" data-v="${key}|+" aria-label="More">+</button></span>`);
        return head('Escalation', 'How FocusGuard responds when distraction is detected during a focus session.') + sec('Stages', stepRow('Silence threshold', 'silence', 'Short slips are logged quietly.') + row('Motivational notification', '', sw('notifs', p.notifs)) + stepRow('Notify threshold', 'notify', '') + stepRow('Notification cooldown', 'cooldown', '') + stepRow('Block threshold', 'block', '')) + sec('Mode', row('Strict mode', 'Skip silence + notify thresholds. Any distraction during a session triggers the block overlay immediately.', `<button type="button" class="sw" role="switch" aria-checked="${t.strict}" data-a="strictmode"><i></i></button>`) + row('Send test notification', '', '<button type="button" class="cbtn xs" data-a="testnotif">Send</button>'));
      }
      case 'rules': {
        const R = [['Xcode', 'App', 100], ['PhpStorm', 'App', 100], ['Slack', 'App', 100], ['github.com', 'Site', 100], ['youtube.com', 'Site', 100], ['news.ycombinator.com', 'Site', 100], ['x.com', 'Site', 100], ['Discord', 'App', 100], ...s.userRules.map((r) => [r.name, r.type, 200])];
        return head('Rules', 'Classify apps and websites as Focus, Neutral, or Distraction. Rules with higher priority win on conflict.') + `<div class="sg">${R.map(([n, type, pr]) => { const k = s.rules[n] || 'neutral'; return `<div class="sr2 rule"><i class="dot" style="background:${kindColor(k)}"></i><div><b>${esc(n)}</b><small>${type} · priority ${pr}</small></div>${chipBtn(n, k)}</div>`; }).join('')}</div>`;
      }
      case 'ai': {
        const a = ui.ai;
        const PROV = { anthropic: ['Anthropic (Claude)', 'claude-sonnet-4-6', 'A key from console.anthropic.com (sk-ant-…). Stored only in your Keychain.'], openai: ['OpenAI', 'gpt-5', 'An OpenAI API key (sk-…). Stored only in your Keychain.'], compatible: ['OpenAI-compatible', 'gpt-5', 'The API key for your endpoint. Stored only in your Keychain.'] }[a.provider];
        const banner = !a.enabled ? `<div class="ban gray">${I.moon} AI insights are off.</div>` : !a.keySaved ? `<div class="ban orange">${I.key} On — add your API key below to start.</div>` : `<div class="ban focus">${I.seal} Demo mode: tips are written for this demo's data, and nothing is sent.</div>`;
        let body = banner + sec('Enable', row('Generate AI insights', 'Adds a “Get AI tips” button to Reports. Data is sent only when you click it.', `<button type="button" class="sw" role="switch" aria-checked="${a.enabled}" data-a="aienable"><i></i></button>`));
        if (a.enabled) {
          body += sec('Provider', row('Service', 'Anthropic uses Claude; OpenAI-compatible works with OpenRouter, Groq, Ollama, and more.', `<select class="sel" data-input="provider" aria-label="AI service"><option value="anthropic"${a.provider === 'anthropic' ? ' selected' : ''}>Anthropic (Claude)</option><option value="openai"${a.provider === 'openai' ? ' selected' : ''}>OpenAI</option><option value="compatible"${a.provider === 'compatible' ? ' selected' : ''}>OpenAI-compatible</option></select>`) + row('Model', '', `<span class="field ph">${PROV[1]}</span>`) + (a.provider === 'compatible' ? row('Base URL', 'Origin only, e.g. http://localhost:11434 for Ollama.', '<span class="field ph">https://api.openai.com</span>') : ''));
          body += sec('Credentials', row('API key', a.keySaved ? 'This demo needs no key.' : PROV[2], `<span class="field ph">${a.keySaved ? 'Not needed in this demo' : 'Paste here'}</span><button type="button" class="cbtn xs" data-a="aikey">${a.keySaved ? 'Using sample tips' : 'Use sample tips'}</button>`) + row('Test connection', 'Sends a one-token request to verify the credential.', '<button type="button" class="cbtn xs" disabled title="Not available in the demo">Test</button>'));
        }
        body += sec('Privacy', `<div class="sr2 col"><p class="pv">FocusGuard only sends an aggregated summary — minutes, percentages, streaks, and the names/hosts of your top distractions. It never sends window titles, full URLs, or raw activity.</p><button type="button" class="lnk" data-a="payload">${a.payload ? 'Hide example payload' : 'Show example payload'}</button>${a.payload ? `<pre class="payload">${esc(summaryText())}</pre>` : ''}</div>`);
        return head('AI Insights', 'Optional AI coaching from your focus data. Off by default.') + body;
      }
      case 'privacy': {
        const T = ['Mail', 'Messages', 'Notes', '1Password 7', '1Password 8', 'Bitwarden', 'Slack', 'Discord', 'Telegram', 'WhatsApp', 'Calendar'];
        return head('Privacy', 'Your history is kept in a database on this Mac. You decide what gets recorded and for how long.') + sec('Title opt-out list', `<p class="sr2 note">Window titles are NOT recorded for these apps. Useful for Mail, Messages, password managers — anywhere the title can leak private content.</p>${T.map((n) => `<div class="sr2"><b>${n}</b><span class="muted">Default</span></div>`).join('')}`) + sec('Retention', row('Keep history for', 'Older sessions and activity events are pruned automatically each day.', `<button type="button" class="menu-b" data-a="keep">${ui.keep} ▾</button>`)) + sec('Your data', row('Stored on this Mac', `${12 + s.done.length} sessions · 4,${210 + s.done.length * 50} activity events · 3.1 MB`, '<button type="button" class="cbtn xs" data-a="toast" data-v="In the app this opens the database folder in Finder.">Reveal in Finder</button>') + row('Delete all data', 'Every session, activity event, and rule will be removed. This cannot be undone.', '<button type="button" class="cbtn xs red" data-a="ask" data-v="all">Delete…</button>'));
      }
      default: return `<div class="about"><img src="${dlg.querySelector('.fg-title img').src}" alt="" width="64" height="64"><b>FocusGuard</b><span>Version 0.3.23</span><button type="button" class="cbtn xs" data-a="toast" data-v="You're on the newest version, 0.3.23.">Check for Updates…</button><label class="muted"><input type="checkbox" checked disabled> Check automatically</label><p>Your activity history is stored on this Mac. FocusGuard goes online to check for updates and fetch site icons, for Spotify if you use it, and for AI tips only when you ask for them.</p></div>`;
    }
  }
  function settingsPage() {
    return [['h', '<div class="ph"><div><h3>Settings</h3><p>Every setting, as in the app.</p></div></div>'],
      ['body', `<nav class="st-nav" aria-label="Settings">${SETTINGS.map(([k, l, ic, col]) => `<button type="button" data-a="setpane" data-v="${k}" aria-current="${ui.setPane === k}"><span class="st-i" style="background:${col}">${ic}</span>${l}</button>`).join('')}</nav><div class="st-pane">${settingsPane()}</div>`, 'st']];
  }
  function renderWindow() {
    const w = $f('fg-win');
    w.hidden = !ui.win;
    if (!ui.win) return;
    if (!w._built) {
      w.innerHTML = '<div class="fgw-side"><div class="fgw-lights"><button type="button" data-a="closewin" aria-label="Close the window"></button><i></i><i></i></div><nav class="fgw-nav" aria-label="FocusGuard"></nav><div class="fgw-card"></div></div><div class="fgw-main" tabindex="-1"></div>';
      w._built = true;
    }
    const nav = winNav.map(([k, l, ic]) => `<button type="button" data-a="winpage" data-v="${k}" aria-current="${ui.page === k}">${ic}${l}</button>`).join('');
    const navEl = w.querySelector('.fgw-nav'); if (navEl._h !== nav) { navEl.innerHTML = nav; navEl._h = nav; }
    const card = sessionCardHTML(), cardEl = w.querySelector('.fgw-card'); if (cardEl._h !== card) { cardEl.innerHTML = card; cardEl._h = card; }
    const main = w.querySelector('.fgw-main');
    if (main.contains(document.activeElement) && document.activeElement.matches('[data-rename], select')) return;
    const parts = ui.page === 'today' ? todayPage() : ui.page === 'reports' ? reportsPage() : ui.page === 'apps' ? appsPage() : settingsPage();
    patch(main, parts);
    if (ui.page === 'apps') {
      const c = main.querySelector('[data-k="card"]');
      patch(c, appsHTML(false));
      const qi = c.querySelector('[data-input="query"]'); if (qi && qi.value !== ui.query && document.activeElement !== qi) qi.value = ui.query;
    }
  }

  /* ---------- the break screen ---------- */
  function renderBreak() {
    const b = $f('fg-break');
    const show = s.phase === 'break' && !ui.breakHidden;
    b.hidden = !show;
    if (!show) return;
    const total = s.breakLen * 60, l = breakLeft(), frac = l / total;
    const tip = BREAK_TIPS[Math.floor((s.clock - s.breakStart) / 20) % BREAK_TIPS.length];
    const html = `<p class="bk-k">Break · back at ${fmtTime(s.breakStart + total)}</p><h2>Nice work. Let your eyes rest.</h2>
      <div class="bk-area"><svg viewBox="0 0 340 340" aria-hidden="true"><circle cx="170" cy="170" r="160" fill="none" stroke="rgba(43,36,51,.08)" stroke-width="6"/>${frac > 0 ? `<path d="${arcPath(170, 160, 360 - frac * 360, 359.9)}" fill="none" stroke="rgba(43,36,51,.55)" stroke-width="6" stroke-linecap="round"/>` : ''}</svg><div class="orb"></div><div class="bk-c"><b class="bk-w"><span class="bi">${reduced ? 'Breathe slowly' : 'Breathe in'}</span>${reduced ? '' : '<span class="bo">Breathe out</span>'}</b><span>${clockText(l)} left</span></div></div>
      <p class="bk-tip">${I.sun}<span>${tip}</span></p>
      <div class="bk-btns">${ui.prefs.strictBreaks ? '<button type="button" data-a="breakmore">+5 minutes</button><p class="bk-note">Strict breaks are on, so this one runs to the end.</p><button type="button" class="hide bk-menu-end" data-a="endbreak">End it from the menu</button>' : '<button type="button" data-a="breakmore">+5 minutes</button><button type="button" data-a="endbreak">End break</button><button type="button" class="hide" data-a="hidebreak">Hide — keep the timer in the menu bar</button>'}</div>`;
    if (b._h !== html.replace(/\d+:\d\d left/, '')) { b.innerHTML = html; b._h = html.replace(/\d+:\d\d left/, ''); }
    else { const t = b.querySelector('.bk-c > span'); if (t) t.textContent = `${clockText(l)} left`; const arc = b.querySelector('path'); if (arc && frac > 0) arc.setAttribute('d', arcPath(170, 160, 360 - frac * 360, 359.9)); }
  }

  /* ---------- render everything ---------- */
  let menuBuilt = false;
  function render() {
    const cur = current();
    // menu bar
    $f('fg-front-name').textContent = s.front === 'browser' ? 'Safari' : s.front === 'fg' ? 'FocusGuard' : APPS[s.front].name;
    const st = glyphState();
    $f('fg-shield').innerHTML = shieldGlyph(st, Math.min(1, s.active / sessionLen()));
    const mins = s.phase === 'session' ? Math.ceil(left() / 60) : s.phase === 'break' ? Math.ceil(breakLeft() / 60) : 0;
    const label = $f('fg-status-time');
    label.textContent = ui.prefs.showTime && mins ? ` ${fmtM(mins)}` : '';
    label.className = s.paused ? 'paused' : '';
    $f('fg-status').style.color = st === 'drifted' ? C.ink : '#111';
    $f('fg-status').setAttribute('aria-expanded', String(ui.menu));
    $f('fg-clock').textContent = `${today.toLocaleDateString('en-US', { weekday: 'short' })} ${fmtTime(s.clock)}`;
    // desktop windows
    Object.entries(APPS).forEach(([key, app]) => $f(app.win).classList.toggle('front', s.front === key));
    $f('fg-w-browser').classList.toggle('front', s.front === 'browser');
    dlg.querySelectorAll('.dock [data-a="app"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === s.front)));
    dlg.querySelectorAll('.bm').forEach((b) => { if (b.dataset.v === s.site) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    dlg.querySelectorAll('[data-page]').forEach((p) => { p.hidden = p.dataset.page !== s.site; });
    $f('fg-url').textContent = SITES[s.site].url;
    // menu
    const menu = $f('fg-menu');
    menu.hidden = !ui.menu;
    if (!menuBuilt) { menu.innerHTML = '<div class="m-wrap"><div class="m-pane left"></div><div class="m-col"></div><div class="m-pane right"></div></div>'; menuBuilt = true; }
    if (ui.menu) {
      patch(menu.querySelector('.m-col'), menuSections());
      const leftP = menu.querySelector('.m-pane.left'), rightP = menu.querySelector('.m-pane.right');
      leftP.hidden = ui.pane !== 'music';
      rightP.hidden = !ui.pane || ui.pane === 'music';
      const typing = rightP.contains(document.activeElement) && document.activeElement.matches('input');
      if (ui.pane === 'music') patch(leftP, musicHTML());
      else if (ui.pane && !(typing && ui.pane !== 'apps')) {
        const parts = ui.pane === 'insights' ? insightsHTML() : ui.pane === 'apps' ? appsHTML() : quickHTML();
        patch(rightP, parts);
        const qi = rightP.querySelector('[data-input="query"]'); if (qi && qi.value !== ui.query && document.activeElement !== qi) qi.value = ui.query;
      }
    }
    renderWindow();
    renderBreak();
    if (s.block) {
      $f('fg-b-fav').textContent = cur.fav[0]; $f('fg-b-fav').style.background = cur.fav[1];
      $f('fg-b-pill').textContent = `${cur.host} · ${clockText(s.streak)} away from ${s.label}`;
      $f('fg-b-h').textContent = `Let's get back to ${s.label}.`;
      $f('fg-b-sub').textContent = `${cur.host} will still be there when your session ends at ${fmtTime(endsAt())}.`;
      $f('fg-b-ring').innerHTML = `${ringSVG(236, 15, { dark: true })}<div class="ring-c"><b class="xl">${clockText(left())}</b><span>left in this session</span></div>`;
      $f('fg-b-zone').textContent = s.zoneRun >= 1 ? `You were ${s.zoneRun} minutes in the zone before this. Pick it back up.` : '';
      $f('fg-b-back').textContent = s.lastFocus === 'editor' ? 'Back to PhpStorm' : 'Back to work';
      $f('fg-b-work').title = `Stop nudging about ${cur.host} until this session ends.`;
    }
    // guide
    dlg.querySelectorAll('.g-steps button').forEach((b) => b.classList.toggle('on', b.dataset.v === ui.guide));
    const t = th();
    $f('fg-preset-name').textContent = s.preset === 'custom' ? 'Custom' : t.name;
    $f('fg-l1').textContent = `at ${t.silence} s`;
    $f('fg-l2').textContent = t.strict ? 'skipped' : `at ${t.notify} s`;
    $f('fg-l3').textContent = t.strict ? 'right away' : `at ${t.block} s`;
    const bars = dlg.querySelectorAll('.ladder2 .bar span'), lis = dlg.querySelectorAll('.ladder2 li');
    [t.silence, t.notify, t.block].forEach((lv, i) => {
      const v = s.phase !== 'session' ? 0 : t.strict && i === 2 ? (s.block ? 1 : 0) : Math.min(1, s.streak / lv);
      bars[i].style.width = `${Math.round(v * 100)}%`;
      lis[i].classList.toggle('hit', v >= 1);
    });
  }

  /* ---------- actions ---------- */
  function setKind(name, kind) { s.rules[name] = kind; const r = s.userRules.find((x) => x.name === name); if (r) r.kind = kind; ui.chip = null; if (s.drifted && current().kind !== 'drift') resetStreak(); }
  function openWin(page) {
    ui.win = true; ui.menu = false;
    const [p, sub] = page.split(':');
    ui.page = p; if (sub) ui.setPane = sub;
    ui.chip = null;
    requestAnimationFrame(() => { const m = $f('fg-win').querySelector('.fgw-main'); if (m) m.scrollTop = 0; });
  }
  function seedSession() {
    startSession(ui.defLen);
    Object.assign(s, { startedAt: s.clock - SEED.length * 60, active: SEED.length * 60, minutes: SEED.split('').map((c) => (c === 'f' ? { f: 60, d: 0, o: 0 } : { f: 0, d: 0, o: 60 })), zoneSince: 6 * 60, zoneRun: 14, bestRun: 14 });
  }
  function guide(v) {
    ui.chip = null; ui.guide = v;
    const ensureSession = () => { if (s.phase !== 'session') seedSession(); };
    if (v === 'drift') { ensureSession(); ui.win = null; ui.menu = true; ui.pane = null; s.front = 'browser'; s.site = 'yt'; s.paused = false; toast(`Stay on YouTube: a nudge at ${th().notify} s, the pause screen at ${th().block} s.${s.speed === 1 ? ' In a hurry? Press “Speed up 6×” in the guide.' : ' The clock runs 6× fast right now.'}`); }
    else if (v === 'apps') { ui.win = null; ui.menu = true; ui.pane = 'apps'; }
    else if (v === 'quick') { ui.win = null; ui.menu = true; ui.pane = 'quick'; }
    else if (v === 'insights') { ui.win = null; ui.menu = true; ui.pane = 'insights'; }
    else if (v === 'end') { ui.win = null; ui.menu = true; ui.pane = null; if (s.phase === 'ready' || s.phase === 'recap') seedSession(); if (s.phase === 'session') endSession(); else if (s.phase === 'break') toast("You're on a break. End it from the menu or the break screen."); }
    else if (v === 'ready') { ui.win = null; ui.menu = true; ui.pane = null; if (s.phase === 'session') endSession(); if (s.phase === 'recap') s.phase = 'ready'; if (s.phase === 'break') endBreak(false); }
    else if (v === 'music') { ui.win = null; ui.menu = true; ui.pane = 'music'; }
    else if (v === 'reports') openWin('reports');
    else if (v === 'privacy') openWin('settings:privacy');
  }
  function act(a, v, el) {
    const cur = current();
    switch (a) {
      case 'menu': ui.menu = !ui.menu; break;
      case 'pane': ui.pane = ui.pane === v ? null : v; ui.chip = null; break;
      case 'instab': ui.insTab = v; break;
      case 'site': s.front = 'browser'; s.site = v; if (s.rules[SITES[v].host] === 'focus') s.lastFocus = 'browser'; visit(SITES[v].host); break;
      case 'app': s.front = v; if (v === 'editor') s.lastFocus = 'editor'; if (v === 'chat') visit('Discord'); break;
      case 'win': openWin(v); break;
      case 'closewin': ui.win = null; break;
      case 'winpage': openWin(v); break;
      case 'setpane': ui.setPane = v; break;
      case 'back': hideBlock(); if (s.lastFocus === 'editor') s.front = 'editor'; else { s.front = 'browser'; s.site = 'gh'; } resetStreak(); ui.menu = false; break;
      case 'forwork': s.exempt.add(cur.host); hideBlock(); resetStreak(); break;
      case 'through': if ($f('fg-b-through').getAttribute('aria-disabled') === 'true') return; hideBlock(); s.graceUntil = s.clock + GRACE; resetStreak(); break;
      case 'pause': if (s.phase !== 'session') return; s.paused = !s.paused; if (s.paused) { resetStreak(); hideBlock(); if (s.music.list === 0) s.music.playing = false; } else if (s.music.list === 0) s.music.playing = true; break;
      case 'more': if (s.phase === 'session') s.extra += 300; break;
      case 'end': if (s.phase === 'session') endSession(); break;
      case 'done': s.phase = 'ready'; break;
      case 'start': startSession(el && el.dataset.len ? Number(el.dataset.len) : s.readyLen); break;
      case 'pick': s.readyLen = Number(v); break;
      case 'break': startBreak(); break;
      case 'breakmore': s.breakLen += 5; break;
      case 'endbreak': endBreak(false); break;
      case 'hidebreak': if (ui.prefs.strictBreaks) { toast('Strict breaks are on, so this one runs to the end.'); return; } ui.breakHidden = true; break;
      case 'showbreak': ui.breakHidden = false; break;
      case 'filter': ui.filter = v; break;
      case 'chip': ui.chip = ui.chip === v ? null : v; break;
      case 'setkind': { const [n, k] = v.split('|'); setKind(n, k); break; }
      case 'delrule': s.userRules = s.userRules.filter((r) => r.name !== v); if (!s.usage[v]) delete s.rules[v]; break;
      case 'addsite': {
        const input = el.closest('.addr, [data-k="add"]').querySelector('input');
        const val = input.value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
        if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(val)) { ui.addErr = "That doesn't look like a site. Try something like example.com."; break; }
        ui.addErr = ''; s.rules[val] = 'drift'; if (!s.userRules.some((r) => r.name === val)) s.userRules.push({ name: val, type: 'Site', kind: 'drift' }); input.value = '';
        break;
      }
      case 'preset': s.preset = v; resetStreak(); break;
      case 'deflen': ui.defLen = Number(v); if (s.phase === 'ready') s.readyLen = ui.defLen; break;
      case 'goal': ui.goal = Math.max(15, Math.min(720, ui.goal + (v === '+' ? 15 : -15))); break;
      case 'pref': ui.prefs[v] = !ui.prefs[v]; break;
      case 'keep': { const K = ['30 days', '90 days', '6 months', '1 year', 'Keep all']; ui.keep = K[(K.indexOf(ui.keep) + 1) % K.length]; break; }
      case 'ask': ui.confirm = v; if (ui.win && ui.page === 'settings') { ui.pane = 'quick'; ui.menu = true; } break;
      case 'confirm':
        if (v === 'ok') {
          if (ui.confirm === 'today') { s.usage = {}; ui.deleted = [...(ui.deleted || []), 'm1', 'm2', ...s.done.map((d) => d.id)]; DAY.length = 0; toast("Today's activity is deleted in this demo. Reset the demo to bring it back."); }
          else { toast('In the app this erases everything. The demo keeps going: press Reset the demo to start over.'); }
        }
        ui.confirm = null; break;
      case 'rename': ui.renaming = v; requestAnimationFrame(() => { const i = dlg.querySelector(`[data-rename="${v}"]`); if (i) { i.focus(); i.select(); } }); break;
      case 'delask': ui.delSession = v; break;
      case 'delsess': if (v !== 'cancel') ui.deleted = [...(ui.deleted || []), v]; ui.delSession = null; break;
      case 'period': ui.period = v; break;
      case 'export': toast('In the app this saves a CSV of the period. Nothing to save in the demo.'); break;
      case 'toast': toast(v); break;
      case 'quit': toast('FocusGuard stays put in this demo. In the app this quits it.'); break;
      case 'speed': s.speed = s.speed === 6 ? 1 : 6; $f('fg-speed').textContent = s.speed === 6 ? 'Back to real time' : 'Speed up 6×'; $f('fg-speed-l').textContent = s.speed === 6 ? 'Demo clock runs 6× faster' : 'Demo clock runs in real time'; break;
      case 'reset': hideBlock(); $f('fg-notif').classList.remove('show'); DAY.splice(0, DAY.length, ...DAY0); s = freshState(); ui = freshUI(); $f('fg-speed').textContent = 'Speed up 6×'; $f('fg-speed-l').textContent = 'Demo clock runs in real time'; break;
      case 'g': guide(v); break;
      case 'tune': {
        const [k, dir] = v.split('|');
        const base = { ...th() };
        const STEP = { silence: 5, notify: 5, cooldown: 15, block: 15 }, MIN = { silence: 0, notify: 5, cooldown: 15, block: 30 }, MAX = { silence: 300, notify: 600, cooldown: 600, block: 900 };
        base[k] = Math.max(MIN[k], Math.min(MAX[k], base[k] + (dir === '+' ? STEP[k] : -STEP[k])));
        s.custom = { ...base, name: 'Custom', note: 'Custom — tuned in Settings → Escalation' }; s.preset = 'custom'; break;
      }
      case 'strictmode': s.custom = { ...th(), strict: !th().strict, name: 'Custom', note: 'Custom — tuned in Settings → Escalation' }; s.preset = s.custom.strict ? 'strict' : 'standard'; break;
      case 'testnotif': notify(LINES[Math.floor(Math.random() * LINES.length)], "You've drifted to Test app."); break;
      case 'aienable': ui.ai.enabled = !ui.ai.enabled; if (!ui.ai.enabled) { ui.ai.keySaved = false; ui.ai.tips = 'idle'; } break;
      case 'aikey': ui.ai.keySaved = true; toast('Sample tips are on. Open Reports and press Get AI tips.'); break;
      case 'payload': ui.ai.payload = !ui.ai.payload; break;
      case 'aitips': ui.ai.tips = 'loading'; clearTimeout(aiTimer); aiTimer = setTimeout(() => { ui.ai.tips = 'loaded'; render(); }, 1400); break;
      case 'mplay': s.music.playing = !s.music.playing; break;
      case 'mnext': s.music.track++; s.music.pos = 0; break;
      case 'mprev': s.music.track = Math.max(0, s.music.track - 1); s.music.pos = 0; break;
      case 'mshuffle': s.music.shuffle = !s.music.shuffle; break;
      case 'mrepeat': s.music.repeat = !s.music.repeat; break;
      case 'mlist': s.music.list = Number(v); s.music.track = 0; s.music.pos = 0; s.music.playing = true; break;
      case 'service': s.music.service = v; break;
      case 'openmusic': toast(`In the app this opens ${s.music.service}.`); break;
      default: return;
    }
    render();
  }
  const DAY0 = DAY.map((x) => x.slice());
  // Visiting a distracting site three times in ten minutes outside a session asks if you want to start one.
  function visit(host) {
    if (s.phase === 'session' || (s.rules[host] || 'neutral') !== 'drift') return;
    const list = (s.visits[host] = (s.visits[host] || []).filter((t) => s.clock - t < 600));
    list.push(s.clock);
    if (list.length >= 3 && (!s.drifting[host] || s.clock - s.drifting[host] > 3600) && ui.prefs.notifs) {
      s.drifting[host] = s.clock;
      notify('Drifting?', `You've been on ${host} a few times in the last 10 min — start a focus session?`);
    }
  }

  /* ---------- wiring ---------- */
  dlg.addEventListener('click', (e) => {
    const t = e.target.closest('[data-a]');
    if (t && dlg.contains(t)) { if (t.disabled) return; act(t.dataset.a, t.dataset.v, t); return; }
    const w = e.target.closest('.win');
    if (w && w.dataset.win) { s.front = w.dataset.win; if (w.dataset.win === 'editor') s.lastFocus = 'editor'; render(); }
    if (ui.chip && !e.target.closest('.chip-w')) { ui.chip = null; render(); }
  });
  dlg.addEventListener('input', (e) => {
    const k = e.target.dataset.input;
    if (k === 'query') { ui.query = e.target.value; render(); }
    else if (k === 'vol') s.music.vol = Number(e.target.value);
    else if (k === 'provider') { ui.ai.provider = e.target.value; e.target.blur(); render(); }
  });
  dlg.addEventListener('keydown', (e) => {
    if (e.target.matches('[data-input="addsite"]') && e.key === 'Enter') { e.preventDefault(); act('addsite', '', e.target); return; }
    if (e.target.matches('[data-rename]')) {
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); if (e.key === 'Enter') { ui.labels = { ...(ui.labels || {}), [e.target.dataset.rename]: e.target.value.trim() || 'Focus session' }; if (e.target.dataset.rename === 'now') s.label = e.target.value.trim() || 'Focus session'; } ui.renaming = null; e.target.blur(); render(); }
      return;
    }
    const sl = e.target.closest('[data-drag]');
    if (sl && ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(e.key)) {
      e.preventDefault();
      s.readyLen = Math.max(5, Math.min(480, s.readyLen + (e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 5 : -5)));
      render();
      requestAnimationFrame(() => { const again = dlg.querySelector(`[data-drag="${sl.dataset.drag}"]`); if (again) again.focus(); });
      return;
    }
    if (s.block && e.key === 'Enter' && !e.target.closest('button')) { e.preventDefault(); act('through'); }
  });
  dlg.addEventListener('focusout', (e) => { if (e.target.matches('[data-rename]') && ui.renaming) { ui.renaming = null; render(); } });
  dlg.addEventListener('cancel', (e) => {
    if (s.block) { e.preventDefault(); act('back'); return; }
    if (s.phase === 'break' && !ui.breakHidden) { e.preventDefault(); if (ui.prefs.strictBreaks) toast('Strict breaks are on, so this one runs to the end. You can still end it from the menu.'); else act('hidebreak'); return; }
    if (ui.chip) { e.preventDefault(); ui.chip = null; render(); }
  });
  // Dragging the twist dial and the length ruler (the menu host keeps the pointer capture across re-renders).
  const menuHost = $f('fg-menu');
  let drag = null;
  menuHost.addEventListener('pointerdown', (e) => {
    const d = e.target.closest('[data-drag]');
    if (!d) return;
    e.preventDefault();
    drag = { kind: d.dataset.drag, x: e.clientX, start: s.readyLen, el: d };
    ui.dragging = drag.kind === 'dial';
    menuHost.setPointerCapture(e.pointerId);
    move(e);
  });
  function move(e) {
    if (!drag) return;
    if (drag.kind === 'dial') {
      const box = menuHost.querySelector('.dial svg').getBoundingClientRect();
      const ang = (Math.atan2(e.clientX - (box.left + box.width / 2), -(e.clientY - (box.top + box.height / 2))) * 180) / Math.PI;
      const m = Math.round(((((ang + 360) % 360) / 360) * 120) / 5) * 5;
      s.readyLen = Math.max(5, Math.min(120, m || 120));
    } else {
      s.readyLen = Math.max(5, Math.min(480, Math.round((drag.start - (e.clientX - drag.x) / 3.2) / 5) * 5));
    }
    render();
  }
  menuHost.addEventListener('pointermove', move);
  const endDrag = () => { if (drag) { drag = null; ui.dragging = false; render(); } };
  menuHost.addEventListener('pointerup', endDrag);
  menuHost.addEventListener('pointercancel', endDrag);

  s = freshState(); ui = freshUI();
  return {
    start() { if (!timer) { lastTick = performance.now(); timer = setInterval(tick, 200); } render(); },
    stop() { clearInterval(timer); timer = null; },
  };
}
