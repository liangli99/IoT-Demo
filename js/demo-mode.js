/**
 * TECH 300 IoT Demo — Guided Demo Sequence (demo-mode.js)
 * ─────────────────────────────────────────────────────────
 * Auto-sequences through the Dashboard, walking a live audience through
 * the entire 5-tier IoT pipeline story in ~60 seconds.
 *
 * Steps:
 *   1. Highlight Tier 1 — shows live sensor readings, BLE advertising log
 *   2. Highlight Tier 2 — BLE tab, show RSSI and ADV packets
 *   3. Highlight Tier 3 — Gateway tab, store-and-forward, MQTT translation
 *   4. Highlight Tier 4 — AWS tab, Rules Engine SQL
 *   5. INJECT ANOMALY  — temp spike → alert fires → DynamoDB + Lambda shown
 *   6. Highlight Tier 5 — AC auto-control engages, relay actuation confirmed
 *   7. Resolution      — anomaly cleared, system returns to normal
 *
 * Runs entirely on dashboard.html. No cross-page navigation needed.
 */

(function () {
  'use strict';

  const DEMO_KEY       = 'tech300-demo-active';
  const DEMO_STEP_KEY  = 'tech300-demo-step';

  // ── Demo Script ────────────────────────────────────────────────────────
  const STEPS = [
    {
      id: 'intro',
      duration: 3000,
      tab: null,
      title: '🎬 Demo Starting — TECH 300 IoT Pipeline',
      body: 'Welcome to the end-to-end IoT demonstration. We will walk through all 5 tiers of the system in real time.',
      highlight: null
    },
    {
      id: 'tier1',
      duration: 6000,
      tab: 'pipeline',
      title: '🎛️ Tier 1 — ESP32 Sensor Nodes',
      body: 'Three ESP32 nodes are awake and sampling. Each runs a 4-phase RTC duty cycle: SLEEP → WAKE → SAMPLE → BROADCAST. DHT22 and MPU6050 data is captured here.',
      highlight: '.node-card'
    },
    {
      id: 'tier2',
      duration: 6000,
      tab: 'ble',
      title: '📶 Tier 2 — BLE 5.0 Advertisement',
      body: 'Each node broadcasts ADV_IND packets over BLE 5.0 (IEEE 802.15.1, 2.4 GHz). Watch the live RSSI signal strength and service UUID 0x181A (Environmental Sensing).',
      highlight: '.ble-packet-row'
    },
    {
      id: 'tier3',
      duration: 6000,
      tab: 'gateway',
      title: '🖥️ Tier 3 — Raspberry Pi 4 Edge Gateway',
      body: 'The gateway translates raw BLE GATT frames to structured MQTT JSON payloads. Store-and-Forward ensures no data loss during WAN outages.',
      highlight: '.gateway-card'
    },
    {
      id: 'tier4_pre',
      duration: 5000,
      tab: 'aws',
      title: '☁️ Tier 4 — AWS IoT Core Rules Engine',
      body: 'Every MQTT packet is evaluated against the SQL rule: SELECT * FROM \'iot/telemetry/+\' WHERE temp > 0. Normal readings route straight to DynamoDB.',
      highlight: '.rule-sql-block'
    },
    {
      id: 'spike',
      duration: 2000,
      tab: 'aws',
      title: '⚠️ INJECTING TEMPERATURE ANOMALY…',
      body: 'Simulating overheating event on sensor_node_01. Temperature will exceed 30°C threshold in 2 seconds.',
      highlight: null,
      action: 'inject_spike'
    },
    {
      id: 'alert',
      duration: 7000,
      tab: 'aws',
      title: '🚨 Alert Pipeline Triggered!',
      body: 'Temp > 30°C matched! Rules Engine invoked Lambda function HighTempAlertFn. SNS notification dispatched. DynamoDB record flagged as ALERT status.',
      highlight: '.alert-row'
    },
    {
      id: 'tier5',
      duration: 6000,
      tab: 'fleet',
      title: '❄️ Tier 5 — AC Auto-Control Engaged',
      body: 'ACController detected temperature above threshold (26°C). Relay actuator commanded ON via AWS MQTT downlink → Edge Gateway → BLE GATT write → ESP32.',
      highlight: '.actuator-card'
    },
    {
      id: 'resolution',
      duration: 5000,
      tab: 'fleet',
      title: '✅ Resolution — System Returning to Normal',
      body: 'AC compressor is cooling the node. Temperature dropping back below 24°C. ACController will automatically disengage the relay when threshold is reached.',
      highlight: null,
      action: 'clear_spike'
    },
    {
      id: 'done',
      duration: 4000,
      tab: 'pipeline',
      title: '🎓 Demo Complete — TECH 300 IoT Demo System',
      body: 'You have seen all 5 tiers: ESP32 sensors → BLE 5.0 → Raspberry Pi Edge Gateway → AWS IoT Core → AC Auto-Control. Explore the Mobile App and AWS Cloud Console for more.',
      highlight: null,
      action: 'done'
    }
  ];

  // ── State ──────────────────────────────────────────────────────────────
  let _running    = false;
  let _stepIndex  = 0;
  let _timer      = null;
  let _overlay    = null;
  let _sim        = null;

  // ── Public API ─────────────────────────────────────────────────────────
  window.DemoMode = {
    start(sim) {
      if (_running) return;
      _sim     = sim || (window.SimBus && window.SimBus.getSim()) || null;
      _running = true;
      _stepIndex = 0;
      localStorage.setItem(DEMO_KEY, '1');
      localStorage.setItem(DEMO_STEP_KEY, '0');
      if (window.NavBar) window.NavBar.setDemoRunning(true);
      _createOverlay();
      _runStep();
    },

    stop() {
      _running = false;
      _stepIndex = 0;
      localStorage.removeItem(DEMO_KEY);
      localStorage.removeItem(DEMO_STEP_KEY);
      if (window.NavBar) window.NavBar.setDemoRunning(false);
      _destroyOverlay();
      if (_timer) { clearTimeout(_timer); _timer = null; }
    },

    toggle(sim) {
      if (_running) { window.DemoMode.stop(); } else { window.DemoMode.start(sim); }
    },

    isRunning() { return _running; }
  };

  // ── Auto-start if flag is set (navigated from another page) ──────────
  document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem(DEMO_KEY) === '1') {
      // Wait briefly for sim engine to be ready
      setTimeout(() => {
        window.DemoMode.start();
      }, 800);
    }
  });

  // ── Core sequence ───────────────────────────────────────────────────────
  function _runStep() {
    if (!_running) return;
    if (_stepIndex >= STEPS.length) {
      window.DemoMode.stop();
      return;
    }

    const step = STEPS[_stepIndex];
    localStorage.setItem(DEMO_STEP_KEY, String(_stepIndex));

    // Switch dashboard tab
    if (step.tab) _switchTab(step.tab);

    // Update overlay
    _updateOverlay(step, _stepIndex + 1, STEPS.length);

    // Highlight element
    if (step.highlight) _pulse(step.highlight);

    // Trigger actions
    if (step.action === 'inject_spike' && _sim) {
      _sim.triggerTempAnomaly('sensor_node_01');
    } else if (step.action === 'clear_spike' && _sim) {
      // Clear after a couple seconds into this step
      setTimeout(() => {
        if (_sim) _sim.clearAnomaly('sensor_node_01');
      }, 3000);
    } else if (step.action === 'done') {
      // Nothing extra
    }

    _stepIndex++;
    _timer = setTimeout(_runStep, step.duration);
  }

  // ── Tab switching (index.html) ─────────────────────────────────────────
  function _switchTab(tabId) {
    const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (btn) btn.click();
  }

  // ── Element pulse highlight ─────────────────────────────────────────────
  function _pulse(selector) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.style.transition = 'box-shadow 0.4s ease';
    el.style.boxShadow  = '0 0 0 3px #00d4ff, 0 0 30px rgba(0,212,255,0.4)';
    setTimeout(() => {
      el.style.boxShadow = '';
    }, 2500);
  }

  // ── Overlay (HUD) ──────────────────────────────────────────────────────
  function _createOverlay() {
    _overlay = document.createElement('div');
    _overlay.id = 'demo-mode-overlay';
    _overlay.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 999999;
      background: rgba(4,8,16,0.95);
      border: 1px solid rgba(0,212,255,0.3);
      border-radius: 16px;
      padding: 16px 22px;
      max-width: 640px;
      width: calc(100vw - 48px);
      display: flex;
      align-items: flex-start;
      gap: 14px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.6), 0 0 40px rgba(0,212,255,0.06);
      font-family: 'Inter', sans-serif;
      animation: demoSlideUp 0.35s cubic-bezier(0.4,0,0.2,1);
      backdrop-filter: blur(20px);
    `;

    // Inject keyframe
    if (!document.getElementById('demo-mode-styles')) {
      const s = document.createElement('style');
      s.id = 'demo-mode-styles';
      s.textContent = `
        @keyframes demoSlideUp {
          from { opacity:0; transform: translateX(-50%) translateY(20px); }
          to   { opacity:1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes demoProgress {
          from { width: 100%; }
          to   { width: 0%; }
        }
        #demo-mode-overlay .dm-progress-bar {
          position: absolute;
          bottom: 0; left: 0;
          height: 3px;
          border-radius: 0 0 16px 16px;
          background: linear-gradient(90deg, #00d4ff, #6366f1);
          animation: demoProgress linear;
        }
      `;
      document.head.appendChild(s);
    }

    document.body.appendChild(_overlay);
  }

  function _updateOverlay(step, current, total) {
    if (!_overlay) return;

    const isAlert   = step.id === 'alert' || step.id === 'spike';
    const titleColor = isAlert ? '#f43f5e' : '#00d4ff';
    const icon       = _iconForStep(step.id);

    _overlay.innerHTML = `
      <div style="font-size:1.6rem;flex-shrink:0;line-height:1;">${icon}</div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
          <span style="font-size:0.72rem;font-family:'JetBrains Mono',monospace;font-weight:700;
                       color:${titleColor};text-transform:uppercase;letter-spacing:0.1em;">
            DEMO ${current}/${total}
          </span>
          <span style="flex:1;height:1px;background:rgba(255,255,255,0.08);"></span>
          <button onclick="window.DemoMode.stop()"
                  style="font-size:0.65rem;color:#64748b;background:none;border:none;cursor:pointer;
                         padding:0 4px;font-family:'JetBrains Mono',monospace;">
            [ESC] Stop
          </button>
        </div>
        <div style="font-size:0.9rem;font-weight:700;color:#fff;margin-bottom:5px;line-height:1.3;">
          ${step.title}
        </div>
        <div style="font-size:0.78rem;color:#94a3b8;line-height:1.5;">
          ${step.body}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
          <div style="display:flex;gap:4px;">
            ${STEPS.map((_, i) => `
              <span style="width:${i < current ? '12' : '6'}px;height:4px;border-radius:2px;
                           background:${i < current ? '#00d4ff' : 'rgba(255,255,255,0.1)'};
                           transition:all 0.3s;"></span>
            `).join('')}
          </div>
          <span style="font-size:0.68rem;color:#475569;font-family:'JetBrains Mono',monospace;">
            Next in ${(step.duration / 1000).toFixed(0)}s
          </span>
        </div>
      </div>
      <div class="dm-progress-bar" style="animation-duration:${step.duration}ms;"></div>
    `;
  }

  function _destroyOverlay() {
    if (_overlay) { _overlay.remove(); _overlay = null; }
  }

  function _iconForStep(id) {
    const icons = {
      intro:       '🎬', tier1: '🎛️', tier2: '📶', tier3: '🖥️',
      tier4_pre:   '☁️', spike: '⚠️',  alert: '🚨', tier5:  '❄️',
      resolution:  '✅', done:  '🎓'
    };
    return icons[id] || '📡';
  }

  // Keyboard shortcut — Escape to stop demo
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _running) window.DemoMode.stop();
  });

})();
