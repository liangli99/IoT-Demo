/**
 * TECH 300 IoT Demo — Unified Navigation Bar & Universal Theme Engine (nav-bar.js)
 * ─────────────────────────────────────────────────────────────────────────────────
 * Injects a consistent 48-px system bar at the very top of every page.
 * Detects current page automatically. Reads live metrics from SimBus/localStorage
 * and refreshes every 2 s to display system health across all tabs.
 *
 * Integrated Universal Theme Engine:
 *   - Supports instant switching between Cyberpunk Obsidian Dark Mode and
 *     Ultra-Clean High-Contrast Light Mode across all 8 pages.
 *   - Enforces dark, high-contrast, perfectly legible text on all light backgrounds.
 *   - Persists user preference via localStorage and syncs across tabs via BroadcastChannel.
 *
 * Usage: include this script in <head> (before other scripts).
 */

(function () {
  'use strict';

  const THEME_KEY = 'tech300-theme';
  const BAR_HEIGHT = 60; // px (enlarged for high-prominence readability)
  const STORAGE_KEY = 'tech300-sim-state';

  // ── 0. Immediate Early Theme Application (Zero-Flicker) ─────────────────
  let currentTheme = localStorage.getItem(THEME_KEY);
  if (!currentTheme) {
    currentTheme = 'light';
    try { localStorage.setItem(THEME_KEY, 'light'); } catch (_) {}
  }
  if (currentTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    if (document.body) document.body.classList.add('light-theme');
  }

  // ── Page identity map ──────────────────────────────────────────────────
  const PAGES = [
    { id: 'landing',    file: 'index.html',       label: '🏠 Home',             color: '#94a3b8' },
    { id: 'dashboard',  file: 'dashboard.html',   label: '🖥 Dashboard',        color: '#00e5ff' },
    { id: 'perception', file: 'perception.html',  label: '🎛️ Perception Layer', color: '#06b6d4' },
    { id: 'proximity',  file: 'proximity.html',   label: '📶 Proximity (BLE)',  color: '#c084fc' },
    { id: 'gateway',    file: 'gateway.html',     label: '📟 Edge Gateway',     color: '#10b981' },
    { id: 'aws',        file: 'aws-cloud.html',   label: '☁️ AWS Cloud',        color: '#ff9900' },
    { id: 'app',        file: 'app.html',         label: '📱 Mobile App',       color: '#a855f7' },
    { id: 'design',     file: 'design.html',      label: '📖 Technical Design',  color: '#38bdf8' },
  ];

  // ── Detect current page ─────────────────────────────────────────────────
  function detectCurrentPage() {
    const path = location.pathname.toLowerCase();
    const href = location.href.toLowerCase();
    if (path.endsWith('dashboard.html')  || href.includes('dashboard.html'))  return 'dashboard';
    if (path.endsWith('perception.html') || href.includes('perception.html')) return 'perception';
    if (path.endsWith('proximity.html')  || href.includes('proximity.html'))  return 'proximity';
    if (path.endsWith('gateway.html')    || href.includes('gateway.html'))    return 'gateway';
    if (path.endsWith('app.html')        || href.includes('app.html'))        return 'app';
    if (path.endsWith('aws-cloud.html')  || href.includes('aws-cloud.html'))  return 'aws';
    if (path.endsWith('design.html')     || href.includes('design.html'))     return 'design';
    return 'landing'; // index.html, landing.html, or root
  }

  // ── Read snapshot from localStorage ────────────────────────────────────
  function readSnapshot() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const snap = JSON.parse(raw);
      if (Date.now() - snap.ts > 30000) return null; // stale
      return snap;
    } catch (_) { return null; }
  }

  // ── Build status metric text ────────────────────────────────────────────
  function buildStatusHTML(snap) {
    if (!snap) {
      return `
        <span class="nb-stat">
          <span class="nb-dot" style="background:#64748b;"></span>
          <span style="color:var(--text-dim, #64748b)">No active tab</span>
        </span>`;
    }

    const nodesOnline  = Object.values(snap.nodes || {}).filter(n => n.state !== 'SLEEP').length;
    const totalNodes   = Object.keys(snap.nodes || {}).length || 3;
    const packets      = (snap.totalPacketsIngested || 0).toLocaleString();
    const alerts       = snap.lambdaAlertCount || 0;
    const wan          = snap.gatewayWanConnected !== false;
    const alertColor   = alerts > 0 ? '#dc2626' : '#059669';
    const wanColor     = wan ? '#059669' : '#dc2626';

    return `
      <span class="nb-stat">
        <span class="nb-dot" style="background:#059669;animation:nb-blink 1.5s infinite;"></span>
        <span style="color:#059669;font-weight:700;">${nodesOnline}/${totalNodes}</span>
        <span class="nb-stat-lbl">Nodes Online</span>
      </span>
      <span class="nb-sep">|</span>
      <span class="nb-stat">
        <span style="color:#0284c7;font-weight:700;">↑ ${packets}</span>
        <span class="nb-stat-lbl">Packets</span>
      </span>
      <span class="nb-sep">|</span>
      <span class="nb-stat">
        <span style="color:${alertColor};font-weight:700;">⚠ ${alerts}</span>
        <span class="nb-stat-lbl">Alerts</span>
      </span>
      <span class="nb-sep">|</span>
      <span class="nb-stat">
        <span class="nb-dot" style="background:${wanColor};"></span>
        <span style="color:${wanColor};font-weight:600;">WAN ${wan ? 'Connected' : 'Offline'}</span>
      </span>`;
  }

  // ── Inject the bar & theme styles ───────────────────────────────────────
  function injectNavBar() {
    const currentPage = detectCurrentPage();
    const snap        = readSnapshot();

    // ── CSS ───────────────────────────────────────────────────────────────
    const style = document.createElement('style');
    style.id    = 'tech300-navbar-and-theme-styles';
    style.textContent = `
      #tech300-navbar {
        position: fixed;
        top: 0; left: 0; right: 0;
        height: ${BAR_HEIGHT}px;
        background: #040810;
        border-bottom: 1.5px solid rgba(0,212,255,0.18);
        display: flex;
        align-items: center;
        padding: 0 18px;
        z-index: 99999;
        font-family: 'Inter', -apple-system, sans-serif;
        font-size: 0.92rem;
        gap: 0;
        user-select: none;
        box-shadow: 0 4px 24px rgba(0,0,0,0.5);
        transition: background 0.25s ease, border-color 0.25s ease;
      }

      /* Multi-color gradient accent line at very top */
      #tech300-navbar::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 2.5px;
        background: linear-gradient(90deg, #00d4ff 0%, #6366f1 40%, #ff9900 70%, #10b981 100%);
      }

      .nb-brand {
        display: flex;
        align-items: center;
        gap: 12px;
        text-decoration: none;
        color: #fff;
        padding-right: 18px;
        border-right: 1px solid rgba(255,255,255,0.12);
        flex-shrink: 0;
      }
      .nb-brand-icon {
        width: 42px; height: 42px;
        border-radius: 50%;
        background: rgba(0, 212, 255, 0.15);
        border: 2px solid rgba(0, 212, 255, 0.55);
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
        overflow: hidden;
        box-shadow: 0 0 12px rgba(0, 212, 255, 0.3);
      }
      .nb-brand-icon img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center top;
        display: block;
      }
      .nb-brand-info {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 3px;
      }
      .nb-brand-title-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .nb-brand-name {
        letter-spacing: -0.015em;
        font-weight: 800;
        font-size: 1.15rem;
        color: #fff;
        white-space: nowrap;
        line-height: 1.2;
      }
      .nb-brand-sub {
        font-size: 0.82rem;
        color: #94a3b8;
        display: flex;
        align-items: center;
        gap: 5px;
        white-space: nowrap;
      }
      .nb-prof-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 10px;
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.22) 0%, rgba(217, 119, 6, 0.35) 100%);
        border: 1.5px solid rgba(245, 158, 11, 0.55);
        border-radius: 999px;
        color: #fef3c7;
        font-size: 0.82rem;
        font-weight: 600;
        box-shadow: 0 0 10px rgba(245, 158, 11, 0.2);
        line-height: 1.3;
      }
      .nb-prof-badge strong {
        color: #fbbf24;
        font-weight: 800;
      }

      .nb-links {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 0 16px;
        flex-shrink: 0;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .nb-links::-webkit-scrollbar { display: none; }

      .nb-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 13px;
        border-radius: 6px;
        font-size: 0.94rem;
        font-weight: 600;
        color: #cbd5e1;
        text-decoration: none;
        transition: color 0.15s, background 0.15s;
        cursor: pointer;
        white-space: nowrap;
        position: relative;
      }
      .nb-link:hover { color: #fff; background: rgba(255,255,255,0.08); }
      .nb-link.active {
        color: #fff;
        font-weight: 800;
      }
      .nb-link.active::after {
        content: '';
        position: absolute;
        bottom: -1px; left: 8px; right: 8px;
        height: 3px;
        border-radius: 2px;
        background: var(--nb-active-color, #00d4ff);
      }

      .nb-link[data-page="landing"].active   { --nb-active-color: #94a3b8; }
      .nb-link[data-page="dashboard"].active { --nb-active-color: #00d4ff; }
      .nb-link[data-page="perception"].active{ --nb-active-color: #06b6d4; }
      .nb-link[data-page="proximity"].active { --nb-active-color: #c084fc; }
      .nb-link[data-page="gateway"].active   { --nb-active-color: #10b981; }
      .nb-link[data-page="aws"].active       { --nb-active-color: #ff9900; }
      .nb-link[data-page="app"].active       { --nb-active-color: #a855f7; }
      .nb-link[data-page="design"].active    { --nb-active-color: #38bdf8; }

      .nb-status {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 16px;
        flex: 1;
        overflow: hidden;
      }

      .nb-stat {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.82rem;
        white-space: nowrap;
      }
      .nb-stat-lbl { color: #64748b; font-weight: 600; }

      .nb-sep {
        color: rgba(255,255,255,0.12);
        font-size: 0.90rem;
      }

      .nb-dot {
        width: 7px; height: 7px;
        border-radius: 50%;
        display: inline-block;
        flex-shrink: 0;
      }

      .nb-right {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-left: auto;
        padding-left: 16px;
        border-left: 1px solid rgba(255,255,255,0.08);
        flex-shrink: 0;
      }

      /* Theme Toggle Button in Navbar */
      .nb-theme-btn {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 7px 15px;
        border-radius: 7px;
        font-size: 0.88rem;
        font-weight: 700;
        background: rgba(255, 255, 255, 0.10);
        border: 1.5px solid rgba(255, 255, 255, 0.22);
        color: #f1f5f9;
        cursor: pointer;
        transition: all 0.18s ease;
        white-space: nowrap;
      }
      .nb-theme-btn:hover {
        background: rgba(255, 255, 255, 0.20);
        color: #fff;
        border-color: #38bdf8;
        transform: translateY(-1px);
      }

      .nb-demo-btn {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 7px 16px;
        border-radius: 7px;
        font-size: 0.88rem;
        font-weight: 800;
        background: linear-gradient(135deg, #0284c7 0%, #4f46e5 100%);
        border: 1.5px solid #6366f1;
        color: #ffffff !important;
        cursor: pointer;
        transition: all 0.15s;
        text-decoration: none;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
      }
      .nb-demo-btn:hover {
        background: linear-gradient(135deg, #0369a1 0%, #4338ca 100%);
        color: #ffffff !important;
        border-color: #818cf8;
        transform: translateY(-1px);
      }
      .nb-demo-btn.running {
        background: #e11d48 !important;
        border-color: #f43f5e !important;
        color: #ffffff !important;
        box-shadow: 0 2px 8px rgba(225, 29, 72, 0.4);
      }
      [data-theme="light"] .nb-demo-btn {
        background: #2563eb !important;
        color: #ffffff !important;
        border: 1.5px solid #1d4ed8 !important;
        font-weight: 800 !important;
        box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25) !important;
      }
      [data-theme="light"] .nb-demo-btn:hover {
        background: #1d4ed8 !important;
        border-color: #1e40af !important;
        color: #ffffff !important;
      }
      [data-theme="light"] .nb-demo-btn.running {
        background: #e11d48 !important;
        border-color: #be123c !important;
        color: #ffffff !important;
        box-shadow: 0 2px 8px rgba(225, 29, 72, 0.3) !important;
      }

      .nb-version {
        font-size: 0.76rem;
        font-family: 'JetBrains Mono', monospace;
        color: #64748b;
        white-space: nowrap;
      }

      @keyframes nb-blink {
        0%,100%{opacity:1} 50%{opacity:0.25}
      }

      /* Responsive */
      @media (max-width: 960px) {
        .nb-status { display: none; }
      }
      @media (max-width: 640px) {
        .nb-brand-sub { display: none; }
        .nb-link span.nb-lbl { display: none; }
        .nb-demo-btn span.nb-demo-lbl { display: none; }
        .nb-theme-btn span.nb-theme-lbl { display: none; }
        .nb-version { display: none; }
      }

      /* ═══════════════════════════════════════════════════════════════════
         UNIVERSAL LIGHT THEME (HIGH-CONTRAST DARK TEXT & CRISP BACKGROUND)
         ═══════════════════════════════════════════════════════════════════ */
      [data-theme="light"],
      body.light-theme {
        --bg-void:       #f8fafc !important;
        --bg-deep:       #f1f5f9 !important;
        --bg-surface:    #ffffff !important;
        --bg-card:       #ffffff !important;
        --bg-card-alt:   #f8fafc !important;
        --bg-card-hover: #f1f5f9 !important;
        --bg-elevated:   #ffffff !important;
        --bg-code:       #f8fafc !important;
        --bg-figure:     #ffffff !important;
        --bg-primary:    #f8fafc !important;
        --bg-secondary:  #f1f5f9 !important;
        --bg-tertiary:   #e2e8f0 !important;
        --bg-raised:     #f1f5f9 !important;
        --aws-dark:      #f1f5f9 !important;
        --aws-darker:    #e2e8f0 !important;
        --aws-navy:      #ffffff !important;

        --border:        #cbd5e1 !important;
        --border-subtle: #cbd5e1 !important;
        --border-card:   #cbd5e1 !important;
        --border-glow:   rgba(2, 132, 199, 0.35) !important;
        --border-accent: rgba(5, 150, 105, 0.35) !important;
        --border-aws:    rgba(217, 119, 6, 0.35) !important;

        /* CRISP, DEEP DARK TEXT TOKENS */
        --text-main:      #0f172a !important; /* Deepest Slate 900 */
        --text-primary:   #0f172a !important;
        --text-muted:     #1e293b !important; /* Slate 800 */
        --text-secondary: #334155 !important; /* Slate 700 */
        --text-dim:       #475569 !important; /* Slate 600 */

        /* VIBRANT HIGH-CONTRAST ACCENT COLORS */
        --cyan:      #0284c7 !important; /* Sky 600 */
        --cyan-glow: rgba(2, 132, 199, 0.25) !important;
        --emerald:   #059669 !important; /* Emerald 600 */
        --emerald-glow: rgba(5, 150, 105, 0.25) !important;
        --amber:     #d97706 !important; /* Amber 600 */
        --amber-glow: rgba(217, 119, 6, 0.25) !important;
        --rose:      #dc2626 !important; /* Red 600 */
        --rose-glow: rgba(220, 38, 38, 0.25) !important;
        --purple:    #7e22ce !important; /* Purple 700 */
        --purple-glow: rgba(126, 34, 206, 0.25) !important;
        --blue:      #2563eb !important; /* Blue 600 */
        --indigo:    #4f46e5 !important; /* Indigo 600 */

        /* Page-specific accent tokens in light mode */
        --pc-teal:   #0891b2 !important;
        --gw-green:  #059669 !important;
        --ble-purple:#7e22ce !important;
        --app-purple:#7e22ce !important;
        --aws-orange:#d97706 !important;

        --shadow-card: 0 4px 20px rgba(0, 0, 0, 0.06), 0 0 1px 1px rgba(0, 0, 0, 0.05) !important;
      }

      [data-theme="light"] body,
      body.light-theme {
        background: #f8fafc !important;
        background-image: none !important;
        background-color: #f8fafc !important;
        color: #0f172a !important;
      }

      /* Clean subtle background grid in light mode */
      [data-theme="light"] body::before,
      body.light-theme::before {
        background-image:
          radial-gradient(circle at 15% 10%, rgba(2, 132, 199, 0.04) 0%, transparent 45%),
          radial-gradient(circle at 85% 20%, rgba(126, 34, 206, 0.035) 0%, transparent 50%),
          linear-gradient(#e2e8f0 1px, transparent 1px),
          linear-gradient(90deg, #e2e8f0 1px, transparent 1px) !important;
        background-size: 100% 100%, 100% 100%, 36px 36px, 36px 36px !important;
        opacity: 0.65 !important;
      }

      /* ── Universal Heading Rules: Extra Dark & High Contrast ── */
      [data-theme="light"] h1, [data-theme="light"] h2, [data-theme="light"] h3,
      [data-theme="light"] h4, [data-theme="light"] h5, [data-theme="light"] h6,
      [data-theme="light"] .hero-title, [data-theme="light"] .section-title,
      [data-theme="light"] .page-title, [data-theme="light"] .card-title,
      [data-theme="light"] .info-card-title, [data-theme="light"] .step-title-group h3,
      [data-theme="light"] .bench-panel-title, [data-theme="light"] .doc-section-header h2,
      [data-theme="light"] .fc-title, [data-theme="light"] .cta-title,
      [data-theme="light"] .app-brand-title, [data-theme="light"] .proximity-brand-title,
      [data-theme="light"] .gw-brand-title, [data-theme="light"] .perception-brand-title,
      [data-theme="light"] .design-title-text h1, [data-theme="light"] .app-title-text,
      [data-theme="light"] .pn-title, [data-theme="light"] .node-title,
      [data-theme="light"] .stat-val, [data-theme="light"] .metric-val,
      [data-theme="light"] .tb-logo-text, [data-theme="light"] .hdb-name,
      [data-theme="light"] .panel-title {
        color: #0f172a !important;
        font-weight: 700 !important;
      }

      /* ── Universal Paragraph & Body Text: Dark & Clear ── */
      [data-theme="light"] p,
      [data-theme="light"] .hero-subtitle,
      [data-theme="light"] .section-desc,
      [data-theme="light"] .fc-desc,
      [data-theme="light"] .info-card p,
      [data-theme="light"] .step-card p,
      [data-theme="light"] .doc-section p,
      [data-theme="light"] .cta-desc,
      [data-theme="light"] li,
      [data-theme="light"] .step-list li,
      [data-theme="light"] .pn-detail,
      [data-theme="light"] .node-desc,
      [data-theme="light"] .desc,
      [data-theme="light"] .card-desc,
      [data-theme="light"] .panel-desc {
        color: #1e293b !important;
      }

      /* ── Strong / Bold Text in Light Theme ── */
      [data-theme="light"] strong,
      [data-theme="light"] b {
        color: #0f172a !important;
        font-weight: 700 !important;
      }

      /* ── Muted, Sub-labels & Metadata ── */
      [data-theme="light"] .text-muted,
      [data-theme="light"] .text-dim,
      [data-theme="light"] .doc-figure-caption,
      [data-theme="light"] .app-brand-sub,
      [data-theme="light"] .proximity-brand-sub,
      [data-theme="light"] .gw-brand-sub,
      [data-theme="light"] .perception-brand-sub,
      [data-theme="light"] .design-title-text p,
      [data-theme="light"] .footer-text,
      [data-theme="light"] .stat-label,
      [data-theme="light"] .metric-label,
      [data-theme="light"] .nav-section-hdr,
      [data-theme="light"] .nav-section-title,
      [data-theme="light"] .sidebar-heading,
      [data-theme="light"] .step-phase-badge,
      [data-theme="light"] .info-card-sub,
      [data-theme="light"] .ctrl-sub,
      [data-theme="light"] .sr-sub,
      [data-theme="light"] .m-section-hdr,
      [data-theme="light"] .m-ctrl-sub,
      [data-theme="light"] .nb-stat-lbl,
      [data-theme="light"] .tb-logo-sub,
      [data-theme="light"] .tb-account,
      [data-theme="light"] .tb-breadcrumb,
      [data-theme="light"] .status-label,
      [data-theme="light"] label,
      [data-theme="light"] .hdb-role,
      [data-theme="light"] .hdb-tagline {
        color: #334155 !important;
      }

      /* ── Overrides for Inline White/Light Styles ── */
      [data-theme="light"] [style*="color:#fff"],
      [data-theme="light"] [style*="color: #fff"],
      [data-theme="light"] [style*="color: white"],
      [data-theme="light"] [style*="color:#ffffff"],
      [data-theme="light"] [style*="color: #ffffff"],
      [data-theme="light"] [style*="color:rgb(255"] {
        color: #0f172a !important;
      }

      [data-theme="light"] [style*="background:linear-gradient(135deg, rgba(14,22,38"],
      [data-theme="light"] [style*="background: rgba(7,10,18"],
      [data-theme="light"] [style*="background:rgba(7,10,18"] {
        background: #ffffff !important;
        border-color: #cbd5e1 !important;
      }

      /* ── System Nav Bar in Light Mode ── */
      [data-theme="light"] #tech300-navbar {
        background: #ffffff !important;
        border-bottom: 1.5px solid #cbd5e1 !important;
        box-shadow: 0 4px 18px rgba(0,0,0,0.06) !important;
      }
      [data-theme="light"] .nb-brand-name { color: #0f172a !important; font-weight: 800 !important; }
      [data-theme="light"] .nb-brand { border-right-color: #cbd5e1 !important; }
      [data-theme="light"] .nb-link { color: #1e293b !important; font-weight: 600 !important; }
      [data-theme="light"] .nb-link:hover { color: #0284c7 !important; background: #f1f5f9 !important; }
      [data-theme="light"] .nb-link.active { color: #0f172a !important; font-weight: 800 !important; background: #e0f2fe !important; }
      [data-theme="light"] .nb-sep { color: #cbd5e1 !important; }
      [data-theme="light"] .nb-right { border-left-color: #cbd5e1 !important; }
      [data-theme="light"] .nb-prof-badge {
        background: #fef3c7 !important;
        border: 1.5px solid #d97706 !important;
        color: #78350f !important;
        font-weight: 600 !important;
      }
      [data-theme="light"] .nb-prof-badge strong {
        color: #0f172a !important;
        font-weight: 800 !important;
      }
      [data-theme="light"] .nb-theme-btn {
        background: #f1f5f9 !important;
        border: 1.5px solid #0284c7 !important;
        color: #0f172a !important;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08) !important;
      }
      [data-theme="light"] .nb-theme-btn:hover {
        background: #e0f2fe !important;
        border-color: #0369a1 !important;
        color: #0284c7 !important;
        box-shadow: 0 4px 10px rgba(2, 132, 199, 0.2) !important;
      }

      /* ── Sub-header Bars across All Pages ── */
      [data-theme="light"] .app-topbar,
      [data-theme="light"] .gw-topbar,
      [data-theme="light"] .proximity-topbar,
      [data-theme="light"] .perception-topbar,
      [data-theme="light"] .design-topbar,
      [data-theme="light"] .aws-topbar,
      [data-theme="light"] .tier-quick-banner,
      [data-theme="light"] .app-header {
        background: rgba(255, 255, 255, 0.98) !important;
        border-bottom-color: #cbd5e1 !important;
        box-shadow: 0 2px 12px rgba(0,0,0,0.05) !important;
      }

      /* ── Sidebars on All Pages ── */
      [data-theme="light"] .app-sidebar,
      [data-theme="light"] .proximity-sidebar,
      [data-theme="light"] .gw-sidebar,
      [data-theme="light"] .doc-sidebar,
      [data-theme="light"] .sidebar,
      [data-theme="light"] .pc-sidebar {
        background: #ffffff !important;
        border-right-color: #cbd5e1 !important;
        border-left-color: #cbd5e1 !important;
        box-shadow: 2px 0 10px rgba(0,0,0,0.02) !important;
      }
      [data-theme="light"] .nav-item,
      [data-theme="light"] .doc-nav-link,
      [data-theme="light"] .sb-item {
        color: #334155 !important;
      }
      [data-theme="light"] .nav-item:hover,
      [data-theme="light"] .doc-nav-link:hover,
      [data-theme="light"] .sb-item:hover {
        background: #f1f5f9 !important;
        color: #0284c7 !important;
      }
      [data-theme="light"] .nav-item.active,
      [data-theme="light"] .doc-nav-link.active,
      [data-theme="light"] .sb-item.active {
        background: #e0f2fe !important;
        color: #0369a1 !important;
        border-color: #0284c7 !important;
        font-weight: 700 !important;
      }
      [data-theme="light"] .nav-badge,
      [data-theme="light"] .nav-badge-pill {
        background: #e2e8f0 !important;
        color: #0f172a !important;
      }

      /* ── All Cards & Elevated Containers: Pure White Background & Crisp Border ── */
      [data-theme="light"] .feature-card,
      [data-theme="light"] .info-card,
      [data-theme="light"] .step-card,
      [data-theme="light"] .metric-card,
      [data-theme="light"] .node-card,
      [data-theme="light"] .bench-panel,
      [data-theme="light"] .doc-body,
      [data-theme="light"] .doc-figure-card,
      [data-theme="light"] .cta-card,
      [data-theme="light"] .card,
      [data-theme="light"] .gw-card,
      [data-theme="light"] .page-hero,
      [data-theme="light"] .hero-designer-banner,
      [data-theme="light"] .stats-ribbon,
      [data-theme="light"] .table-container,
      [data-theme="light"] .stat-card,
      [data-theme="light"] .chart-card,
      [data-theme="light"] .pipeline-card,
      [data-theme="light"] .switch-card,
      [data-theme="light"] .arch-node,
      [data-theme="light"] .scenario-test-bench,
      [data-theme="light"] .system-status-strip,
      [data-theme="light"] .tier-card,
      [data-theme="light"] .tier-column,
      [data-theme="light"] .node-item,
      [data-theme="light"] .bcm2711-card,
      [data-theme="light"] .pinout-card,
      [data-theme="light"] .freertos-card,
      [data-theme="light"] .beacon-card,
      [data-theme="light"] .radar-card,
      [data-theme="light"] .main-panel,
      [data-theme="light"] .lambda-card,
      [data-theme="light"] .phone-simulator-frame {
        background: #ffffff !important;
        border-color: #cbd5e1 !important;
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.05) !important;
        color: #0f172a !important;
      }

      /* ── Tabs Navigation in Dashboard ── */
      [data-theme="light"] .tabs-navigation {
        border-bottom-color: #cbd5e1 !important;
      }
      [data-theme="light"] .tab-btn {
        background: #f1f5f9 !important;
        border-color: #cbd5e1 !important;
        color: #334155 !important;
      }
      [data-theme="light"] .tab-btn:hover {
        background: #e2e8f0 !important;
        color: #0f172a !important;
      }
      [data-theme="light"] .tab-btn.active {
        background: #ffffff !important;
        border-color: #0284c7 !important;
        color: #0284c7 !important;
        font-weight: 700 !important;
      }

      /* ── Tables on All Pages ── */
      [data-theme="light"] table,
      [data-theme="light"] .custom-table,
      [data-theme="light"] .bom-table,
      [data-theme="light"] .dynamo-table,
      [data-theme="light"] .spec-table,
      [data-theme="light"] .gatt-table {
        background: #ffffff !important;
        color: #0f172a !important;
        border-color: #cbd5e1 !important;
      }
      [data-theme="light"] th {
        background: #f1f5f9 !important;
        color: #0f172a !important;
        border-color: #cbd5e1 !important;
        font-weight: 700 !important;
      }
      [data-theme="light"] td {
        color: #1e293b !important;
        border-color: #e2e8f0 !important;
      }
      [data-theme="light"] tr:hover td {
        background: #f8fafc !important;
      }

      /* ── Stat Pills, Badges & Action Buttons ── */
      [data-theme="light"] .stat-pill,
      [data-theme="light"] .status-pill,
      [data-theme="light"] .tier-badge-link {
        background: #f8fafc !important;
        border-color: #cbd5e1 !important;
        color: #0f172a !important;
      }
      [data-theme="light"] .btn-action.secondary,
      [data-theme="light"] .btn-topbar {
        background: #f1f5f9 !important;
        border-color: #cbd5e1 !important;
        color: #0f172a !important;
      }
      [data-theme="light"] .btn-action.secondary:hover,
      [data-theme="light"] .btn-topbar:hover {
        background: #e2e8f0 !important;
        color: #0284c7 !important;
      }

      /* ── Code Blocks, Syntax & Consoles ── */
      [data-theme="light"] .code-studio,
      [data-theme="light"] .code-block-wrap,
      [data-theme="light"] .doc-code-block,
      [data-theme="light"] .stream-console,
      [data-theme="light"] .log-container,
      [data-theme="light"] .terminal-window {
        background: #f8fafc !important;
        border-color: #cbd5e1 !important;
        color: #0f172a !important;
      }
      [data-theme="light"] .code-studio-bar {
        background: #f1f5f9 !important;
        border-bottom-color: #cbd5e1 !important;
      }
      [data-theme="light"] .code-tab {
        color: #475569 !important;
      }
      [data-theme="light"] .code-tab.active {
        color: #0284c7 !important;
        background: #ffffff !important;
        border-bottom-color: #0284c7 !important;
      }
      [data-theme="light"] pre,
      [data-theme="light"] code {
        color: #0f172a !important;
      }
      [data-theme="light"] p code,
      [data-theme="light"] li code,
      [data-theme="light"] td code {
        background: #e2e8f0 !important;
        color: #0f172a !important;
      }

      /* ── Form Controls, Inputs & Selects ── */
      [data-theme="light"] input,
      [data-theme="light"] select,
      [data-theme="light"] textarea {
        background: #ffffff !important;
        border-color: #cbd5e1 !important;
        color: #0f172a !important;
      }

      /* ── Footer on Index ── */
      [data-theme="light"] footer {
        background: #f1f5f9 !important;
        border-top-color: #cbd5e1 !important;
        color: #0f172a !important;
      }
      [data-theme="light"] .footer-text strong {
        color: #0f172a !important;
      }
      [data-theme="light"] .footer-text span {
        color: #334155 !important;
      }
      [data-theme="light"] .footer-contact a {
        color: #334155 !important;
      }
      [data-theme="light"] .footer-contact a:hover {
        color: #0284c7 !important;
      }

      /* ── Hero Designer Banner on Index ── */
      [data-theme="light"] .hero-designer-banner {
        background: #ffffff !important;
        border-color: #cbd5e1 !important;
      }
      [data-theme="light"] .hdb-name {
        color: #92400e !important;
        -webkit-text-fill-color: #92400e !important;
        background: none !important;
        filter: none !important;
      }
      [data-theme="light"] .hdb-tagline,
      [data-theme="light"] .hdb-role {
        color: #1e293b !important;
      }

      /* ── Phone Simulator Theme in App.html & Index.html ── */
      [data-theme="light"] .phone-content {
        background: #f8fafc !important;
      }
      [data-theme="light"] .m-card {
        background: #ffffff !important;
        border-color: #cbd5e1 !important;
      }
      [data-theme="light"] .m-card-val,
      [data-theme="light"] .m-gauge-val {
        color: #0f172a !important;
      }
      [data-theme="light"] .m-gauge-card,
      [data-theme="light"] .m-sparkline-card,
      [data-theme="light"] .m-ac-panel {
        background: #ffffff !important;
        border-color: #cbd5e1 !important;
        box-shadow: 0 4px 16px rgba(0,0,0,0.06) !important;
      }
      [data-theme="light"] .m-ac-title {
        color: #0f172a !important;
      }
      [data-theme="light"] .bottom-nav {
        background: #ffffff !important;
        border-top-color: #cbd5e1 !important;
      }
      [data-theme="light"] .m-nav-btn {
        color: #475569 !important;
      }
      [data-theme="light"] .m-nav-btn.active {
        color: #7e22ce !important;
      }
      [data-theme="light"] .app-bar {
        background: #ffffff !important;
        border-bottom-color: #cbd5e1 !important;
      }
      [data-theme="light"] .status-bar {
        color: #0f172a !important;
      }
      [data-theme="light"] .stream-packet {
        background: #ffffff !important;
        border-color: #cbd5e1 !important;
      }
      [data-theme="light"] .stream-packet pre {
        color: #0f172a !important;
      }

      /* ── Specific Elements on index.html / Landing ── */
      [data-theme="light"] nav.topnav {
        background: rgba(255, 255, 255, 0.96) !important;
        border-bottom: 1px solid #cbd5e1 !important;
        box-shadow: 0 2px 10px rgba(0,0,0,0.05) !important;
      }
      [data-theme="light"] .nav-name { color: #0f172a !important; }
      [data-theme="light"] .nav-link { color: #334155 !important; }
      [data-theme="light"] .nav-link:hover { color: #0284c7 !important; background: #f1f5f9 !important; }
      [data-theme="light"] section.hero { background: transparent !important; }
      [data-theme="light"] .hero-title { color: #0f172a !important; }
      [data-theme="light"] .hero-subtitle { color: #334155 !important; }
      [data-theme="light"] .hero-eyebrow { background: #f1f5f9 !important; border-color: #cbd5e1 !important; color: #0284c7 !important; }
      [data-theme="light"] .btn-secondary-hero {
        background: #ffffff !important;
        color: #0f172a !important;
        border: 1.5px solid #cbd5e1 !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05) !important;
      }
      [data-theme="light"] .btn-secondary-hero:hover {
        background: #f1f5f9 !important;
        border-color: #0284c7 !important;
        color: #0284c7 !important;
      }
      [data-theme="light"] .hero-stats {
        background: #ffffff !important;
        border: 1px solid #cbd5e1 !important;
        box-shadow: 0 4px 18px rgba(0,0,0,0.05) !important;
      }
      [data-theme="light"] .hero-stat-val { color: #0f172a !important; }
      [data-theme="light"] .hero-stat-lbl { color: #475569 !important; }
      [data-theme="light"] .section-tag { background: #f1f5f9 !important; border-color: #cbd5e1 !important; color: #0284c7 !important; }
      [data-theme="light"] .section-title { color: #0f172a !important; }
      [data-theme="light"] .section-desc { color: #334155 !important; }
      [data-theme="light"] .step-num { background: #f1f5f9 !important; color: #0284c7 !important; border-color: #cbd5e1 !important; }
      [data-theme="light"] .step-name { color: #0f172a !important; }
      [data-theme="light"] .step-sub { color: #475569 !important; }
      [data-theme="light"] .step-desc { color: #334155 !important; }
      [data-theme="light"] .step-specs { border-top-color: #e2e8f0 !important; }
      [data-theme="light"] .spec-key { color: #64748b !important; }
      [data-theme="light"] .spec-val { color: #0f172a !important; }
      [data-theme="light"] .feature-icon-box { background: #f1f5f9 !important; border-color: #cbd5e1 !important; }
      [data-theme="light"] .feature-title { color: #0f172a !important; }
      [data-theme="light"] .feature-desc { color: #334155 !important; }
      [data-theme="light"] .feature-tag { background: #e2e8f0 !important; color: #334155 !important; }
      [data-theme="light"] .cta-box { background: #ffffff !important; border-color: #cbd5e1 !important; box-shadow: 0 4px 20px rgba(0,0,0,0.06) !important; }

      /* ── 5-Tier Pipeline Architecture Flow in Light Mode ── */
      [data-theme="light"] .pipeline-step-title {
        color: #0f172a !important;
        font-size: 1.05rem !important;
        font-weight: 800 !important;
      }
      [data-theme="light"] .pipeline-step-sub {
        color: #1e293b !important;
        font-size: 0.86rem !important;
        font-weight: 600 !important;
        line-height: 1.6 !important;
      }
      [data-theme="light"] .pipeline-arrow {
        color: #0284c7 !important;
        font-size: 1.6rem !important;
        font-weight: 700 !important;
      }
      [data-theme="light"] .pipeline-icon-box {
        background: #ffffff !important;
        box-shadow: 0 4px 18px rgba(0,0,0,0.06) !important;
      }
      [data-theme="light"] .ps1 { border-color: rgba(244,63,94,0.5) !important; }
      [data-theme="light"] .ps2 { border-color: rgba(2,132,199,0.5) !important; }
      [data-theme="light"] .ps3 { border-color: rgba(5,150,105,0.5) !important; }
      [data-theme="light"] .ps4 { border-color: rgba(126,34,206,0.5) !important; }
      [data-theme="light"] .ps5 { border-color: rgba(217,119,6,0.5) !important; }

      /* ── Dashboard 5-Tier Columns & Hardware Info in Light Mode ── */
      [data-theme="light"] .tier-column {
        background: #ffffff !important;
        border: 1.5px solid #cbd5e1 !important;
        box-shadow: 0 4px 18px rgba(0,0,0,0.06) !important;
      }
      [data-theme="light"] .tier-header {
        border-bottom: 1.5px solid #e2e8f0 !important;
      }
      [data-theme="light"] .tier-title,
      [data-theme="light"] .tier-title a {
        color: #0f172a !important;
        font-weight: 800 !important;
      }
      [data-theme="light"] .tier-subtitle {
        color: #334155 !important;
        font-weight: 700 !important;
        font-size: 0.82rem !important;
      }
      [data-theme="light"] .tier-num {
        background: #e0f2fe !important;
        color: #0284c7 !important;
        border: 1.5px solid #38bdf8 !important;
        font-weight: 800 !important;
      }
      [data-theme="light"] .device-hardware-box {
        background: #f8fafc !important;
        border: 1.5px solid #cbd5e1 !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.03) !important;
      }
      [data-theme="light"] .hw-row {
        border-bottom: 1px solid #e2e8f0 !important;
      }
      [data-theme="light"] .hw-label {
        color: #475569 !important;
        font-weight: 700 !important;
        font-size: 0.84rem !important;
      }
      [data-theme="light"] .hw-val {
        color: #0284c7 !important;
        font-weight: 800 !important;
        font-size: 0.84rem !important;
      }
      [data-theme="light"] .duty-cycle-bar .duty-step {
        background: #f1f5f9 !important;
        color: #334155 !important;
        border: 1.5px solid #cbd5e1 !important;
        font-weight: 700 !important;
        font-size: 0.72rem !important;
      }
      [data-theme="light"] .duty-cycle-bar .duty-step span {
        color: #475569 !important;
        font-weight: 600 !important;
        font-size: 0.65rem !important;
      }
      [data-theme="light"] .duty-cycle-bar .duty-step.active {
        background: #dcfce7 !important;
        color: #15803d !important;
        border: 1.5px solid #22c55e !important;
        font-weight: 800 !important;
      }
      [data-theme="light"] .duty-cycle-bar .duty-step.active span {
        color: #166534 !important;
        font-weight: 700 !important;
      }
      [data-theme="light"] [style*="background:rgba(0,0,0,0.4)"] {
        background: #f8fafc !important;
        border: 1.5px solid #cbd5e1 !important;
        color: #0f172a !important;
      }
      [data-theme="light"] .active-node-name {
        color: #0284c7 !important;
        font-weight: 800 !important;
      }
      [data-theme="light"] .active-node-id {
        color: #334155 !important;
        font-weight: 700 !important;
      }

      /* ── Proximity BLE Console in Light Mode ── */
      [data-theme="light"] .node-select-card {
        background: #f8fafc !important;
        border: 1.5px solid #cbd5e1 !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.04) !important;
      }
      [data-theme="light"] .node-select-card:hover {
        background: #f1f5f9 !important;
        border-color: #0284c7 !important;
      }
      [data-theme="light"] .node-select-card.active {
        background: #eff6ff !important;
        border: 2px solid #0284c7 !important;
        box-shadow: 0 4px 16px rgba(2,132,199,0.18) !important;
      }
      [data-theme="light"] .node-card-name {
        color: #0f172a !important;
        font-size: 0.95rem !important;
        font-weight: 800 !important;
      }
      [data-theme="light"] .node-select-card.active .node-card-name {
        color: #0369a1 !important;
      }
      [data-theme="light"] .node-card-sub {
        color: #334155 !important;
        font-size: 0.80rem !important;
        font-weight: 600 !important;
      }
      [data-theme="light"] .gatt-char-box {
        background: #f8fafc !important;
        border: 1.5px solid #cbd5e1 !important;
        box-shadow: 0 2px 6px rgba(0,0,0,0.03) !important;
      }
      [data-theme="light"] .char-meta-name {
        color: #0f172a !important;
        font-size: 0.92rem !important;
        font-weight: 800 !important;
      }
      [data-theme="light"] .char-meta-uuid {
        color: #475569 !important;
        font-size: 0.78rem !important;
        font-weight: 600 !important;
      }
      [data-theme="light"] .char-val-disp {
        color: #0284c7 !important;
        font-size: 1.1rem !important;
        font-weight: 800 !important;
      }
      [data-theme="light"] #session-title {
        color: #0f172a !important;
        font-weight: 800 !important;
      }

      /* ── Edge Gateway & Perception Metric Cards in Light Mode ── */
      [data-theme="light"] .metric-hero {
        color: #0f172a !important;
        font-weight: 900 !important;
        font-size: 2.2rem !important;
      }
      [data-theme="light"] .metric-hero-unit {
        color: #334155 !important;
        font-weight: 700 !important;
        font-size: 0.95rem !important;
      }
      [data-theme="light"] .card-head .card-title {
        color: #0f172a !important;
        font-weight: 800 !important;
        font-size: 0.98rem !important;
      }
      [data-theme="light"] .card-tag {
        background: #f1f5f9 !important;
        color: #0284c7 !important;
        border: 1.5px solid #cbd5e1 !important;
        font-weight: 800 !important;
        font-size: 0.74rem !important;
      }
      [data-theme="light"] .gw-card {
        background: #ffffff !important;
        border: 1.5px solid #cbd5e1 !important;
        box-shadow: 0 4px 16px rgba(0,0,0,0.05) !important;
      }
      [data-theme="light"] .chip-map-container {
        background: #ffffff !important;
        border: 1.5px solid #cbd5e1 !important;
        box-shadow: 0 4px 18px rgba(0,0,0,0.05) !important;
      }
      [data-theme="light"] .chip-map-header h3 {
        color: #0f172a !important;
        font-weight: 800 !important;
      }
      [data-theme="light"] .board-chip-box {
        background: #f8fafc !important;
        border: 1.5px solid #cbd5e1 !important;
      }
      [data-theme="light"] .board-chip-box .chip-name {
        color: #0f172a !important;
        font-weight: 800 !important;
      }
      [data-theme="light"] .board-chip-box .chip-details {
        color: #1e293b !important;
        font-weight: 600 !important;
        line-height: 1.6 !important;
      }
      [data-theme="light"] .spec-label {
        color: #475569 !important;
        font-weight: 600 !important;
      }
      [data-theme="light"] .spec-val {
        color: #0f172a !important;
        font-weight: 700 !important;
      }

      /* ── AWS IoT Cloud Console: Metrics & Architecture Diagram in Light Mode ── */
      [data-theme="light"] .mc-value {
        color: #0f172a !important;
        font-weight: 900 !important;
        font-size: 2.1rem !important;
      }
      [data-theme="light"] .mc-label {
        color: #334155 !important;
        font-weight: 800 !important;
        font-size: 0.78rem !important;
        letter-spacing: 0.06em !important;
      }
      [data-theme="light"] .mc-sub {
        color: #475569 !important;
        font-weight: 600 !important;
        font-size: 0.76rem !important;
      }
      [data-theme="light"] .metric-card {
        background: #ffffff !important;
        border: 1.5px solid #cbd5e1 !important;
        box-shadow: 0 4px 16px rgba(0,0,0,0.05) !important;
      }
      [data-theme="light"] .arch-diagram {
        background: #f8fafc !important;
        border: 1.5px solid #cbd5e1 !important;
        padding: 24px !important;
        border-radius: 16px !important;
      }
      [data-theme="light"] .arch-box {
        background: #ffffff !important;
        border-width: 2px !important;
        box-shadow: 0 4px 14px rgba(0,0,0,0.06) !important;
      }
      [data-theme="light"] .ab-name {
        color: #0f172a !important;
        font-size: 0.86rem !important;
        font-weight: 800 !important;
      }
      [data-theme="light"] .ab-sub {
        color: #334155 !important;
        font-size: 0.74rem !important;
        font-weight: 600 !important;
      }
      [data-theme="light"] .flow-line {
        background: #0284c7 !important;
        height: 2px !important;
      }
      [data-theme="light"] .arch-arrow-h,
      [data-theme="light"] .arch-arrow-v {
        color: #0284c7 !important;
        font-size: 1.4rem !important;
        font-weight: 800 !important;
      }
      [data-theme="light"] .arch-box.iot    { border-color: #f59e0b !important; }
      [data-theme="light"] .arch-box.ddb    { border-color: #10b981 !important; }
      [data-theme="light"] .arch-box.lambda { border-color: #f43f5e !important; }
      [data-theme="light"] .arch-box.sns    { border-color: #a855f7 !important; }
      [data-theme="light"] .arch-box.iam    { border-color: #0284c7 !important; }
      [data-theme="light"] .arch-box.cw     { border-color: #f59e0b !important; }
      [data-theme="light"] .svc-pill {
        background: #f1f5f9 !important;
        border: 1.5px solid #cbd5e1 !important;
        color: #0f172a !important;
        font-weight: 700 !important;
      }
      [data-theme="light"] .lfn-stat-val {
        color: #0f172a !important;
        font-weight: 800 !important;
        font-size: 1.15rem !important;
      }
      [data-theme="light"] .lfn-stat-lbl {
        color: #475569 !important;
        font-weight: 600 !important;
      }

      /* ── Universal Badges, Labels & Sidebar Category Titles ── */
      [data-theme="light"] .sidebar-hdr,
      [data-theme="light"] .nav-section-hdr,
      [data-theme="light"] .nav-section-title,
      [data-theme="light"] .sidebar-heading,
      [data-theme="light"] .menu-category {
        color: #334155 !important;
        font-weight: 800 !important;
        font-size: 0.74rem !important;
        letter-spacing: 0.08em !important;
      }
      [data-theme="light"] .badge,
      [data-theme="light"] .nav-badge,
      [data-theme="light"] .badge-pill,
      [data-theme="light"] .chip-tag,
      [data-theme="light"] .pill-tag {
        background: #e2e8f0 !important;
        color: #0f172a !important;
        border: 1px solid #cbd5e1 !important;
        font-weight: 700 !important;
        font-size: 0.72rem !important;
      }
      [data-theme="light"] .badge-purple {
        background: #f3e8ff !important;
        color: #6b21a8 !important;
        border: 1px solid #c084fc !important;
        font-weight: 700 !important;
      }
      [data-theme="light"] .badge-cyan {
        background: #e0f2fe !important;
        color: #0369a1 !important;
        border: 1px solid #38bdf8 !important;
        font-weight: 700 !important;
      }
      [data-theme="light"] .badge-green {
        background: #dcfce7 !important;
        color: #166534 !important;
        border: 1px solid #4ade80 !important;
        font-weight: 700 !important;
      }
      [data-theme="light"] .badge-amber {
        background: #fef3c7 !important;
        color: #92400e !important;
        border: 1px solid #fcd34d !important;
        font-weight: 700 !important;
      }
      [data-theme="light"] .terminal-window,
      [data-theme="light"] .terminal-container {
        background: #0f172a !important;
        color: #38bdf8 !important;
        border: 1.5px solid #334155 !important;
      }
      [data-theme="light"] .terminal-window pre,
      [data-theme="light"] .terminal-container pre {
        color: #e2e8f0 !important;
        font-weight: 600 !important;
      }

      /* ── Arch Strip under Hero in Light Mode ── */
      [data-theme="light"] .arch-label {
        color: #0f172a !important;
        font-size: 0.80rem !important;
        font-weight: 700 !important;
      }
      [data-theme="light"] .arch-icon {
        background: #ffffff !important;
        box-shadow: 0 4px 14px rgba(0,0,0,0.05) !important;
      }
      [data-theme="light"] .arch-arrow {
        color: #0284c7 !important;
        font-size: 1.35rem !important;
        font-weight: 700 !important;
      }

      /* ── Footer in Light Mode ── */
      [data-theme="light"] .footer-title-strong {
        color: #0f172a !important;
        font-weight: 800 !important;
        font-size: 1.15rem !important;
      }
      [data-theme="light"] .footer-designer-lbl {
        color: #92400e !important;
        font-weight: 700 !important;
        font-size: 0.86rem !important;
      }

      /* Reduce particle canvas opacity in light mode */
      [data-theme="light"] #particle-canvas {
        opacity: 0.12 !important;
        filter: invert(1) contrast(1.2) !important;
      }
    `;
    document.head.appendChild(style);

    // ── HTML Markup for Top Navbar ────────────────────────────────────────
    const bar    = document.createElement('div');
    bar.id       = 'tech300-navbar';
    bar.setAttribute('role', 'navigation');
    bar.setAttribute('aria-label', 'IoT System Navigation');

    const linksHTML = PAGES.map(p => {
      const active = p.id === currentPage ? 'active' : '';
      let linkHtml = `<a class="nb-link ${active}" data-page="${p.id}" href="${_relPath(p.file, currentPage)}">${p.label}</a>`;
      if (p.id === 'landing' && currentPage === 'landing') {
        linkHtml += `<a class="nb-link" href="#features">Features</a><a class="nb-link" href="#pipeline">Architecture</a>`;
      }
      return linkHtml;
    }).join('');

    const isLightInitial = currentTheme === 'light';

    bar.innerHTML = `
      <a class="nb-brand" href="${_relPath('index.html', currentPage)}" title="IoT Demo System — Designed by Prof. Liang Li">
        <div class="nb-brand-icon">
          <img src="${_relPath('assets/images/liangli_photo.jpg', currentPage)}" alt="Prof. Liang Li">
        </div>
        <div class="nb-brand-info">
          <div class="nb-brand-title-row">
            <span class="nb-brand-name">IoT Demo System</span>
          </div>
          <div class="nb-brand-sub">
            <span class="nb-prof-badge">Course &amp; Demo Designer: <strong>Prof. Liang Li</strong></span>
          </div>
        </div>
      </a>

      <div class="nb-links">${linksHTML}</div>

      <div class="nb-right">
        <button class="nb-theme-btn" id="nb-theme-btn" title="Toggle Light / Dark Mode" aria-label="Toggle theme">
          <span id="nb-theme-icon">${isLightInitial ? '🌙' : '☀️'}</span>
          <span class="nb-theme-lbl" id="nb-theme-lbl">${isLightInitial ? 'Dark Theme' : 'Light Theme'}</span>
        </button>
        <button class="nb-demo-btn" id="nb-demo-btn" title="Run guided demo sequence">
          ▶ <span class="nb-demo-lbl">Run Demo</span>
        </button>
      </div>
    `;

    // Insert as first child of body
    if (document.body.firstChild) {
      document.body.insertBefore(bar, document.body.firstChild);
    } else {
      document.body.appendChild(bar);
    }

    // ── Compensate page content ───────────────────────────────────────────
    _compensateLayout(currentPage);

    // ── Live status refresh ───────────────────────────────────────────────
    _startStatusRefresh();

    // ── Demo button ───────────────────────────────────────────────────────
    _initDemoButton(currentPage);

    // ── Theme Manager ─────────────────────────────────────────────────────
    _initThemeManager();
  }

  // ── Theme Manager Initialization ────────────────────────────────────────
  function _initThemeManager() {
    function auditTextContrast(theme) {
      if (theme === 'light') {
        const elements = document.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, li, td, th, label, strong, b');
        elements.forEach(el => {
          if (el.style && el.style.color) {
            const c = el.style.color.trim().toLowerCase();
            if (c === '#fff' || c === '#ffffff' || c === 'white' || c.includes('255, 255, 255') || c.includes('255,255,255')) {
              el.setAttribute('data-theme-orig-color', el.style.color);
              el.style.color = '#0f172a';
            }
          }
        });
      } else {
        const elements = document.querySelectorAll('[data-theme-orig-color]');
        elements.forEach(el => {
          el.style.color = el.getAttribute('data-theme-orig-color');
          el.removeAttribute('data-theme-orig-color');
        });
      }
    }

    function applyTheme(theme) {
      currentTheme = theme;
      localStorage.setItem(THEME_KEY, theme);
      document.documentElement.setAttribute('data-theme', theme);
      if (document.body) {
        document.body.classList.toggle('light-theme', theme === 'light');
      }

      const icon = document.getElementById('nb-theme-icon');
      const lbl  = document.getElementById('nb-theme-lbl');
      if (icon && lbl) {
        if (theme === 'light') {
          icon.textContent = '🌙';
          lbl.textContent  = 'Dark Theme';
        } else {
          icon.textContent = '☀️';
          lbl.textContent  = 'Light Theme';
        }
      }

      auditTextContrast(theme);
    }

    // Ensure theme is applied to body
    applyTheme(currentTheme);

    const btn = document.getElementById('nb-theme-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
        applyTheme(nextTheme);

        // Broadcast theme change across all open tabs
        try {
          const ch = new BroadcastChannel('tech300-theme-sync');
          ch.postMessage({ theme: nextTheme });
        } catch (_) {}
      });
    }

    // Listen for cross-tab theme changes
    try {
      const ch = new BroadcastChannel('tech300-theme-sync');
      ch.addEventListener('message', (e) => {
        if (e.data && e.data.theme) {
          applyTheme(e.data.theme);
        }
      });
    } catch (_) {}
  }

  // Resolve relative path from current page to target file
  function _relPath(target, currentPage) {
    return target;
  }

  // Adjust existing fixed/sticky navs and body padding
  function _compensateLayout(currentPage) {
    const compensateStyle = document.createElement('style');
    compensateStyle.textContent = `
      body { padding-top: ${BAR_HEIGHT}px !important; }
      .app-topbar, .gw-topbar, .proximity-topbar, .perception-topbar, .design-topbar, .aws-topbar, .tier-quick-banner, nav.topnav {
        top: ${BAR_HEIGHT}px !important;
      }
    `;
    document.head.appendChild(compensateStyle);
  }

  // Live status refresh interval
  function _startStatusRefresh() {
    const strip = document.getElementById('nb-status-strip');
    if (!strip) return;

    setInterval(() => {
      const snap = readSnapshot();
      strip.innerHTML = buildStatusHTML(snap);
    }, 2000);

    if (window.SimBus) {
      window.SimBus.on('telemetry', () => {
        const snap = readSnapshot();
        strip.innerHTML = buildStatusHTML(snap);
      });
      window.SimBus.on('alert', () => {
        const snap = readSnapshot();
        strip.innerHTML = buildStatusHTML(snap);
      });
    }
  }

  // Demo button initialization
  function _initDemoButton(currentPage) {
    const btn = document.getElementById('nb-demo-btn');
    if (!btn) return;

    const demoRunning = localStorage.getItem('tech300-demo-active') === '1';
    if (demoRunning) {
      btn.classList.add('running');
      btn.innerHTML = '■ <span class="nb-demo-lbl">Stop Demo</span>';
    }

    btn.addEventListener('click', () => {
      if (window.DemoMode) {
        window.DemoMode.toggle();
      } else {
        localStorage.setItem('tech300-demo-active', '1');
        localStorage.setItem('tech300-demo-step', '0');
        if (currentPage !== 'dashboard') {
          window.location.href = 'dashboard.html#demo';
        } else {
          window.location.reload();
        }
      }
    });
  }

  // ── Auto-initialize when DOM is ready ───────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectNavBar);
  } else {
    injectNavBar();
  }

  // Expose for external access
  window.NavBar = {
    refresh() {
      const strip = document.getElementById('nb-status-strip');
      if (strip) strip.innerHTML = buildStatusHTML(readSnapshot());
    },
    setTheme(theme) {
      localStorage.setItem(THEME_KEY, theme);
      document.documentElement.setAttribute('data-theme', theme);
      if (document.body) document.body.classList.toggle('light-theme', theme === 'light');
    },
    getTheme() {
      return localStorage.getItem(THEME_KEY) || 'dark';
    }
  };

})();
