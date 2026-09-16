/**
 * TECH 300 IoT Demo — Unified Navigation Bar (nav-bar.js)
 * ──────────────────────────────────────────────────────────
 * Injects a consistent 44-px system bar at the very top of every page.
 * Detects current page automatically. Reads live metrics from SimBus/localStorage
 * and refreshes every 2 s to display system health across all tabs.
 *
 * Usage: include this script in <head> (before other scripts).
 * The bar inserts itself as the first child of <body> and adds
 * compensating padding-top so existing content is not obscured.
 *
 * Pages that have their own position:fixed navbars (landing.html,
 * aws-cloud.html) are detected and their top offset shifted automatically.
 */

(function () {
  'use strict';

  // ── Page identity map ────────────────────────────────────────────────
  const PAGES = [
    { id: 'landing',    file: 'index.html',       label: '🏠 Home',             color: '#94a3b8' },
    { id: 'dashboard',  file: 'dashboard.html',   label: '🖥 Dashboard',        color: '#00e5ff' },
    { id: 'perception', file: 'perception.html',  label: '🎛️ Perception Layer', color: '#06b6d4' },
    { id: 'gateway',    file: 'gateway.html',     label: '📟 Edge Gateway',     color: '#10b981' },
    { id: 'aws',        file: 'aws-cloud.html',   label: '☁️ AWS Cloud',        color: '#ff9900' },
    { id: 'app',        file: 'app.html',         label: '📱 Mobile App',       color: '#a855f7' },
    { id: 'design',     file: 'design.html',      label: '📖 Technical Design',  color: '#38bdf8' },
  ];

  const BAR_HEIGHT = 44; // px
  const STORAGE_KEY = 'tech300-sim-state';

  // ── Detect current page ───────────────────────────────────────────────
  function detectCurrentPage() {
    const path = location.pathname.toLowerCase();
    const href = location.href.toLowerCase();
    if (path.endsWith('dashboard.html')  || href.includes('dashboard.html'))  return 'dashboard';
    if (path.endsWith('perception.html') || href.includes('perception.html')) return 'perception';
    if (path.endsWith('gateway.html')    || href.includes('gateway.html'))    return 'gateway';
    if (path.endsWith('app.html')        || href.includes('app.html'))        return 'app';
    if (path.endsWith('aws-cloud.html')  || href.includes('aws-cloud.html'))  return 'aws';
    if (path.endsWith('design.html')     || href.includes('design.html'))     return 'design';
    return 'landing'; // index.html, landing.html, or root
  }

  // ── Read snapshot from localStorage ──────────────────────────────────
  function readSnapshot() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const snap = JSON.parse(raw);
      if (Date.now() - snap.ts > 30000) return null; // stale
      return snap;
    } catch (_) { return null; }
  }

  // ── Build status metric text ──────────────────────────────────────────
  function buildStatusHTML(snap) {
    if (!snap) {
      return `
        <span class="nb-stat">
          <span class="nb-dot" style="background:#64748b;"></span>
          <span style="color:#64748b">No active tab</span>
        </span>`;
    }

    const nodesOnline  = Object.values(snap.nodes || {}).filter(n => n.state !== 'SLEEP').length;
    const totalNodes   = Object.keys(snap.nodes || {}).length || 3;
    const packets      = (snap.totalPacketsIngested || 0).toLocaleString();
    const alerts       = snap.lambdaAlertCount || 0;
    const wan          = snap.gatewayWanConnected !== false;
    const alertColor   = alerts > 0 ? '#f43f5e' : '#10b981';
    const wanColor     = wan ? '#10b981' : '#f43f5e';

    return `
      <span class="nb-stat">
        <span class="nb-dot" style="background:#10b981;animation:nb-blink 1.5s infinite;"></span>
        <span style="color:#10b981;font-weight:700;">${nodesOnline}/${totalNodes}</span>
        <span style="color:#64748b;">Nodes Online</span>
      </span>
      <span class="nb-sep">|</span>
      <span class="nb-stat">
        <span style="color:#00d4ff;">↑ ${packets}</span>
        <span style="color:#64748b;">Packets</span>
      </span>
      <span class="nb-sep">|</span>
      <span class="nb-stat">
        <span style="color:${alertColor};font-weight:700;">⚠ ${alerts}</span>
        <span style="color:#64748b;">Alerts</span>
      </span>
      <span class="nb-sep">|</span>
      <span class="nb-stat">
        <span class="nb-dot" style="background:${wanColor};"></span>
        <span style="color:${wanColor};">WAN ${wan ? 'Connected' : 'Offline'}</span>
      </span>`;
  }

  // ── Inject the bar ────────────────────────────────────────────────────
  function injectNavBar() {
    const currentPage = detectCurrentPage();
    const snap        = readSnapshot();

    // ── CSS ──────────────────────────────────────────────────────────────
    const style = document.createElement('style');
    style.id    = 'tech300-navbar-styles';
    style.textContent = `
      #tech300-navbar {
        position: fixed;
        top: 0; left: 0; right: 0;
        height: ${BAR_HEIGHT}px;
        background: #040810;
        border-bottom: 1px solid rgba(0,212,255,0.12);
        display: flex;
        align-items: center;
        padding: 0 16px;
        z-index: 99999;
        font-family: 'Inter', -apple-system, sans-serif;
        font-size: 0.78rem;
        gap: 0;
        user-select: none;
        box-shadow: 0 2px 20px rgba(0,0,0,0.5);
      }

      /* Orange accent line at very top */
      #tech300-navbar::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 2px;
        background: linear-gradient(90deg, #00d4ff 0%, #6366f1 40%, #ff9900 70%, #10b981 100%);
      }

      .nb-brand {
        display: flex;
        align-items: center;
        gap: 8px;
        text-decoration: none;
        color: #fff;
        font-weight: 700;
        font-size: 0.82rem;
        padding-right: 16px;
        border-right: 1px solid rgba(255,255,255,0.08);
        flex-shrink: 0;
      }
      .nb-brand-icon {
        width: 26px; height: 26px;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(245, 158, 11, 0.4);
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
        padding: 2px;
        box-shadow: 0 0 8px rgba(245, 158, 11, 0.2);
      }
      .nb-brand-icon img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        border-radius: 4px;
      }
      .nb-brand-name { letter-spacing: -0.01em; }
      .nb-brand-sub  { font-size: 0.6rem; color: #64748b; font-family: 'JetBrains Mono', monospace; }

      .nb-links {
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 0 12px;
        border-right: 1px solid rgba(255,255,255,0.08);
        flex-shrink: 0;
      }

      .nb-link {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 5px 11px;
        border-radius: 6px;
        font-size: 0.78rem;
        font-weight: 500;
        color: #64748b;
        text-decoration: none;
        transition: color 0.15s, background 0.15s;
        cursor: pointer;
        white-space: nowrap;
        position: relative;
      }
      .nb-link:hover { color: #fff; background: rgba(255,255,255,0.05); }
      .nb-link.active {
        color: #fff;
        font-weight: 700;
      }
      .nb-link.active::after {
        content: '';
        position: absolute;
        bottom: -1px; left: 8px; right: 8px;
        height: 2px;
        border-radius: 2px;
        background: var(--nb-active-color, #00d4ff);
      }

      .nb-link[data-page="landing"].active   { --nb-active-color: #94a3b8; }
      .nb-link[data-page="dashboard"].active { --nb-active-color: #00d4ff; }
      .nb-link[data-page="perception"].active{ --nb-active-color: #06b6d4; }
      .nb-link[data-page="gateway"].active   { --nb-active-color: #10b981; }
      .nb-link[data-page="aws"].active       { --nb-active-color: #ff9900; }
      .nb-link[data-page="app"].active       { --nb-active-color: #a855f7; }
      .nb-link[data-page="design"].active    { --nb-active-color: #38bdf8; }

      .nb-status {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 12px;
        flex: 1;
        overflow: hidden;
      }

      .nb-stat {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 0.72rem;
        white-space: nowrap;
      }

      .nb-sep {
        color: rgba(255,255,255,0.1);
        font-size: 0.8rem;
      }

      .nb-dot {
        width: 6px; height: 6px;
        border-radius: 50%;
        display: inline-block;
        flex-shrink: 0;
      }

      .nb-right {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-left: auto;
        padding-left: 12px;
        border-left: 1px solid rgba(255,255,255,0.08);
        flex-shrink: 0;
      }

      .nb-demo-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: 6px;
        font-size: 0.72rem;
        font-weight: 700;
        background: linear-gradient(135deg, rgba(14,165,233,0.2), rgba(99,102,241,0.2));
        border: 1px solid rgba(99,102,241,0.35);
        color: #a5b4fc;
        cursor: pointer;
        transition: all 0.15s;
        text-decoration: none;
        white-space: nowrap;
      }
      .nb-demo-btn:hover {
        background: linear-gradient(135deg, rgba(14,165,233,0.35), rgba(99,102,241,0.35));
        color: #fff;
        border-color: rgba(99,102,241,0.6);
      }
      .nb-demo-btn.running {
        background: rgba(244,63,94,0.15);
        border-color: rgba(244,63,94,0.4);
        color: #f43f5e;
      }

      .nb-version {
        font-size: 0.62rem;
        font-family: 'JetBrains Mono', monospace;
        color: #334155;
        white-space: nowrap;
      }

      @keyframes nb-blink {
        0%,100%{opacity:1} 50%{opacity:0.25}
      }

      /* Responsive: hide status strip on narrow screens */
      @media (max-width: 900px) {
        .nb-status { display: none; }
      }
      @media (max-width: 600px) {
        .nb-brand-sub { display: none; }
        .nb-link span.nb-lbl { display: none; }
        .nb-demo-btn span.nb-demo-lbl { display: none; }
        .nb-version { display: none; }
      }
    `;
    document.head.appendChild(style);

    // ── HTML ─────────────────────────────────────────────────────────────
    const bar    = document.createElement('div');
    bar.id       = 'tech300-navbar';
    bar.setAttribute('role', 'navigation');
    bar.setAttribute('aria-label', 'TECH 300 IoT System Navigation');

    const linksHTML = PAGES.map(p => {
      const active = p.id === currentPage ? 'active' : '';
      return `<a class="nb-link ${active}" data-page="${p.id}" href="${_relPath(p.file, currentPage)}">${p.label}</a>`;
    }).join('');

    bar.innerHTML = `
      <a class="nb-brand" href="${_relPath('index.html', currentPage)}">
        <div class="nb-brand-icon">
          <img src="${_relPath('assets/images/westcliff_icon_192.png', currentPage)}" alt="Westcliff University Logo">
        </div>
        <div>
          <div class="nb-brand-name">TECH 300 IoT Demo</div>
          <div class="nb-brand-sub"><span style="color:#94a3b8;">Westcliff University</span> · <span style="color:#fbbf24; font-weight:700;">Prof. Liang Li</span></div>
        </div>
      </a>

      <div class="nb-links">${linksHTML}</div>

      <div class="nb-status" id="nb-status-strip">
        ${buildStatusHTML(snap)}
      </div>

      <div class="nb-right">
        <button class="nb-demo-btn" id="nb-demo-btn" title="Run guided demo sequence">
          ▶ <span class="nb-demo-lbl">Run Demo</span>
        </button>
        <span class="nb-version">v1.0 · us-east-1</span>
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
  }

  // Resolve relative path from current page to target file
  function _relPath(target, currentPage) {
    // All files are in the same directory
    return target;
  }

  // Adjust existing fixed/sticky navs and body padding
  function _compensateLayout(currentPage) {
    // Universal: push body down so bar doesn't overlap content
    const compensateStyle = document.createElement('style');
    compensateStyle.textContent = `
      body { padding-top: ${BAR_HEIGHT}px !important; }
    `;

    // Pages with their own position:fixed top navs — shift them down
    if (currentPage === 'landing') {
      compensateStyle.textContent += `
        nav.topnav { top: ${BAR_HEIGHT}px !important; }
        section.hero { padding-top: ${120 + BAR_HEIGHT}px !important; }
      `;
    }
    if (currentPage === 'aws') {
      compensateStyle.textContent += `
        .aws-topbar { top: ${BAR_HEIGHT}px !important; }
        .app-shell  { margin-top: ${BAR_HEIGHT + 60}px !important; }
        .sidebar    { top: ${BAR_HEIGHT + 60}px !important; }
      `;
    }
    if (currentPage === 'perception') {
      compensateStyle.textContent += `
        .perception-topbar  { top: ${BAR_HEIGHT}px !important; }
        .perception-sidebar { top: ${BAR_HEIGHT + 60}px !important; height: calc(100vh - ${BAR_HEIGHT + 60}px) !important; }
        .perception-layout  { margin-top: ${BAR_HEIGHT + 60}px !important; }
      `;
    }
    if (currentPage === 'gateway') {
      compensateStyle.textContent += `
        .gw-topbar  { top: ${BAR_HEIGHT}px !important; }
        .gw-sidebar { top: ${BAR_HEIGHT + 60}px !important; }
        .gw-layout  { margin-top: ${BAR_HEIGHT + 60}px !important; }
      `;
    }
    if (currentPage === 'design') {
      compensateStyle.textContent += `
        .design-topbar { top: ${BAR_HEIGHT}px !important; }
        .doc-sidebar   { top: ${BAR_HEIGHT + 56}px !important; height: calc(100vh - ${BAR_HEIGHT + 56}px) !important; }
        .design-layout { margin-top: ${BAR_HEIGHT + 56}px !important; }
      `;
    }
    if (currentPage === 'dashboard') {
      // .app-header is position:sticky — padding-top on body is enough
      // but the sticky top must account for our bar
      compensateStyle.textContent += `
        .app-header { top: 0; }
      `;
    }
    if (currentPage === 'app') {
      // app.html uses a full-viewport phone frame — prevent body scrolling
      compensateStyle.textContent += `
        body { overflow: hidden !important; }
        .phone-frame-outer { height: calc(100vh - ${BAR_HEIGHT}px) !important; }
      `;
    }
    document.head.appendChild(compensateStyle);
  }

  // Poll localStorage every 2 s for status updates
  function _startStatusRefresh() {
    const strip = document.getElementById('nb-status-strip');
    if (!strip) return;

    setInterval(() => {
      const snap = readSnapshot();
      strip.innerHTML = buildStatusHTML(snap);
    }, 2000);

    // Also listen on SimBus if available
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

  // Demo button: triggers DemoMode if available, otherwise navigates to dashboard
  function _initDemoButton(currentPage) {
    const btn = document.getElementById('nb-demo-btn');
    if (!btn) return;

    // Check if demo is already running
    const demoRunning = localStorage.getItem('tech300-demo-active') === '1';
    if (demoRunning) {
      btn.classList.add('running');
      btn.innerHTML = '■ <span class="nb-demo-lbl">Stop Demo</span>';
    }

    btn.addEventListener('click', () => {
      if (window.DemoMode) {
        window.DemoMode.toggle();
      } else {
        // Navigate to dashboard with demo flag set
        localStorage.setItem('tech300-demo-active', '1');
        localStorage.setItem('tech300-demo-step', '0');
        if (currentPage !== 'dashboard') {
          window.location.href = 'dashboard.html#demo';
        } else {
          // Reload to trigger demo mode
          window.location.reload();
        }
      }
    });
  }

  // ── Auto-initialize when DOM is ready ─────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectNavBar);
  } else {
    injectNavBar();
  }

  // Expose for external use
  window.NavBar = {
    refresh() {
      const strip = document.getElementById('nb-status-strip');
      if (strip) strip.innerHTML = buildStatusHTML(readSnapshot());
    },
    setDemoRunning(running) {
      const btn = document.getElementById('nb-demo-btn');
      if (!btn) return;
      btn.classList.toggle('running', running);
      btn.innerHTML = running
        ? '■ <span class="nb-demo-lbl">Stop Demo</span>'
        : '▶ <span class="nb-demo-lbl">Run Demo</span>';
    }
  };

})();
