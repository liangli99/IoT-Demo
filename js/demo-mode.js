/**
 * IoT Demo System — Guided Demo Sequence (demo-mode.js)
 * ─────────────────────────────────────────────────────────
 * Auto-sequences through the Dashboard, walking a live audience through
 * the entire 5-tier IoT pipeline story in ~60 seconds.
 *
 * Steps:
 *   1. Intro        — Overview of 5-tier pipeline
 *   2. Tier 1       — ESP32 Sensor Nodes (Perception)
 *   3. Tier 2       — BLE 5.0 Proximity Network (Southbound)
 *   4. Tier 3       — Raspberry Pi 4 Edge Gateway
 *   5. Tier 4       — AWS IoT Cloud & Rules Engine
 *   6. Anomaly      — Inject temperature runaway (>30°C)
 *   7. Alert        — AWS Lambda alert execution & SNS dispatch
 *   8. Tier 5       — Reverse Actuation & Relay engagement
 *   9. Fleet        — Live Multi-Node Telemetry Charts
 *  10. Resolution   — Anomaly cleared, normal baseline restored
 *  11. Done         — Guided tour complete
 */

(function () {
  'use strict';

  const DEMO_KEY      = 'tech300-demo-active';
  const DEMO_STEP_KEY = 'tech300-demo-step';

  // ── Demo Script ────────────────────────────────────────────────────────
  const STEPS = [
    {
      id: 'intro',
      duration: 3500,
      tab: 'pipeline',
      title: '🎬 Demo Starting — 5-Tier IoT Architecture Tour',
      body: 'Welcome to the end-to-end IoT demonstration system. We will walk through all 5 tiers of the live telemetry & control pipeline in real time.',
      highlight: '.pipeline-flow-container'
    },
    {
      id: 'tier1',
      duration: 5500,
      tab: 'pipeline',
      title: '🎛️ Tier 1 — Perception Layer (ESP32 Nodes)',
      body: 'Constrained ESP32-WROOM-32 nodes operate on FreeRTOS with RTC deep-sleep duty cycles. Transducers read environmental (BME280/DHT22) and vibration (MPU6050) telemetry.',
      highlight: '.tier-column:nth-child(1)'
    },
    {
      id: 'tier2',
      duration: 5500,
      tab: 'pipeline',
      title: '📶 Tier 2 — Proximity Network (BLE 5.0 Southbound)',
      body: 'Field nodes broadcast ADV_IND frames over 2.4 GHz BLE 5.0 (IEEE 802.15.1) with AES-128 CCM link encryption and service UUID 0x181A (Environmental Sensing).',
      highlight: '.tier-column:nth-child(2)'
    },
    {
      id: 'tier3',
      duration: 5500,
      tab: 'pipeline',
      title: '🖥️ Tier 3 — Edge Gateway Layer (Raspberry Pi 4)',
      body: 'The Raspberry Pi 4 edge host translates raw BLE GATT frames into JSON payloads. A local SQLite store-and-forward engine prevents data loss during WAN partitions.',
      highlight: '.tier-column:nth-child(3)'
    },
    {
      id: 'tier4_pre',
      duration: 5000,
      tab: 'aws',
      title: '☁️ Tier 4 — AWS IoT Cloud & Rules Engine',
      body: 'Ingested MQTT packets hit AWS IoT Core (port 8883 mTLS). SQL rule evaluates incoming payloads and routes valid data directly into Amazon DynamoDB.',
      highlight: '.code-editor-card'
    },
    {
      id: 'tier5_phone_intro',
      duration: 5500,
      tab: 'pipeline',
      title: '📱 Tier 5 — Presentation Layer (Cell Phone App)',
      body: 'The mobile app connects via WebSockets and REST. Showing live temperature, barometric pressure, humidity, battery level, and compressor control in real time.',
      highlight: '#tier5-phone-app'
    },
    {
      id: 'spike',
      duration: 3000,
      tab: 'aws',
      title: '⚠️ Injecting High-Temperature Anomaly (>30°C)…',
      body: 'Simulating thermal runaway event on sensor_node_01. Temperature quickly crosses the 30.0°C alert threshold.',
      highlight: null,
      action: 'inject_spike'
    },
    {
      id: 'alert',
      duration: 5500,
      tab: 'aws',
      title: '🚨 AWS Lambda Alert Dispatched!',
      body: 'Temp > 30°C condition matched! Rules Engine executes HighTempAlertFn Lambda, publishing SNS alert notification and logging to CloudWatch.',
      highlight: '#lambda-alert-body'
    },
    {
      id: 'tier5_phone_alert',
      duration: 6500,
      tab: 'pipeline',
      title: '🚨 Tier 5 — Cell Phone App: Overheat Push Alert (>30°C)!',
      body: 'Observe the Cell Phone App in Tier 5: Real-time telemetry detects temp crossing 30.0°C! The phone flashes a High-Temp Alert banner, triggers push notification, and switches AC Cooling to ACTIVE!',
      highlight: '#tier5-phone-app'
    },
    {
      id: 'tier5_actuation',
      duration: 5500,
      tab: 'actuation',
      title: '🕹️ Tier 5 — Closed-Loop Reverse Actuation',
      body: 'Autonomous supervisory controller detects overheat. Downlink control command dispatches via AWS IoT Core MQTT → Edge Gateway → BLE GATT → SSR Relay (GPIO 23) engaged!',
      highlight: '.control-panel-card'
    },
    {
      id: 'fleet',
      duration: 5500,
      tab: 'fleet',
      title: '📊 Tier 5 — Fleet Telemetry & Live Streaming Charts',
      body: 'Continuous 60fps canvas sparklines stream multi-node telemetry. All 3 field nodes maintain synchronization with sub-200 ms end-to-end latency.',
      highlight: '.fleet-cards-grid'
    },
    {
      id: 'resolution',
      duration: 5000,
      tab: 'pipeline',
      title: '✅ Anomaly Resolved — Restoring Normal Baseline',
      body: 'Cooling active. Node temperature returns below safe hysteresis threshold (<24°C). The Cell Phone App in Tier 5 clears the overheat alert back to normal.',
      highlight: '#tier5-phone-app',
      action: 'clear_spike'
    },
    {
      id: 'done',
      duration: 4500,
      tab: 'pipeline',
      title: '🎓 Guided Demo Complete!',
      body: 'You have observed the complete 5-tier IoT demonstration system: ESP32 → BLE 5.0 → Edge Gateway → AWS IoT Core → Real-time Actuation & Dashboard.',
      highlight: null,
      action: 'done'
    }
  ];

  // ── Cell App -> Fan Reverse Downlink Steps (5 Tiers) ───────────────────
  const DOWNLINK_STEPS = [
    {
      id: 'downlink_t5',
      duration: 3800,
      tab: 'pipeline',
      title: '📱 Tier 5 — Presentation Layer (Cell Phone App)',
      body: 'User presses "Actuate ESP32 Fan" on IoTSense mobile app. Mobile client generates JSON downlink actuation payload and initiates MQTT publish via AWS IoT Core.',
      highlight: '.tier-column:nth-child(5)',
      action: 'downlink_t5'
    },
    {
      id: 'downlink_t4',
      duration: 3800,
      tab: 'pipeline',
      title: '☁️ Tier 4 — AWS IoT Cloud Broker (mTLS Port 8883)',
      body: 'AWS IoT Core broker receives command on topic "iot/actuation/sensor_node_01" over mTLS 8883. Rules engine evaluates policy and routes downlink packet to Edge Gateway.',
      highlight: '.tier-column:nth-child(4)',
      action: 'downlink_t4'
    },
    {
      id: 'downlink_t3',
      duration: 3800,
      tab: 'pipeline',
      title: '🖥️ Tier 3 — Edge Gateway Layer (Raspberry Pi 4)',
      body: 'Raspberry Pi 4 edge gateway intercepts MQTT packet and translates JSON into BLE GATT Characteristic Write frame (UUID 0x2A56, 100% duty cycle).',
      highlight: '.tier-column:nth-child(3)',
      action: 'downlink_t3'
    },
    {
      id: 'downlink_t2',
      duration: 3800,
      tab: 'pipeline',
      title: '📶 Tier 2 — Proximity Network (BLE 5.0 ATT Write)',
      body: 'BlueZ GATT Client transmits AES-128 CCM encrypted ATT Write frame over 2.4 GHz RF (IEEE 802.15.1) to target ESP32 node MAC C4:4F:33:18:A2:9B.',
      highlight: '.tier-column:nth-child(2)',
      action: 'downlink_t2'
    },
    {
      id: 'downlink_t1',
      duration: 5200,
      tab: 'pipeline',
      title: '🎛️ Tier 1 — Perception Layer (ESP32 Fan Actuated!)',
      body: 'ESP32 FreeRTOS task executes PWM actuation on GPIO 18: Cooling Fan SPINS UP to 100% (3,200 RPM)! Motor current draws 128.5 mA and round-trip ACK returns.',
      highlight: '.tier-column:nth-child(1)',
      action: 'downlink_t1'
    }
  ];

  // ── State ──────────────────────────────────────────────────────────────
  let _running     = false;
  let _stepIndex   = 0;
  let _timer       = null;
  let _overlay     = null;
  let _sim         = null;
  let _activeSteps = STEPS;

  // ── Public API ─────────────────────────────────────────────────────────
  window.DemoMode = {
    start(sim) {
      if (_running) window.DemoMode.stop();
      _activeSteps = STEPS;
      _sim = sim || (window.SimBus && window.SimBus.getSim()) || window._tech300Sim || window.sim || null;
      _running = true;
      _stepIndex = 0;
      localStorage.setItem(DEMO_KEY, '1');
      localStorage.setItem(DEMO_STEP_KEY, '0');
      if (window.NavBar && window.NavBar.setDemoRunning) {
        window.NavBar.setDemoRunning(true);
      }
      const demoBtn = document.getElementById('nb-demo-btn');
      if (demoBtn) {
        demoBtn.classList.add('running');
        demoBtn.innerHTML = '■ <span class="nb-demo-lbl">Stop Demo</span>';
      }
      _createOverlay();
      _runStep();
    },

    startDownlinkDemo(sim) {
      if (_running) window.DemoMode.stop();
      _activeSteps = DOWNLINK_STEPS;
      _sim = sim || (window.SimBus && window.SimBus.getSim()) || window._tech300Sim || window.sim || null;
      _running = true;
      _stepIndex = 0;
      if (window.NavBar && window.NavBar.setDemoRunning) {
        window.NavBar.setDemoRunning(true);
      }
      const demoBtn = document.getElementById('nb-demo-btn');
      if (demoBtn) {
        demoBtn.classList.add('running');
        demoBtn.innerHTML = '■ <span class="nb-demo-lbl">Stop Demo</span>';
      }
      _createOverlay();
      _runStep();
    },

    stop() {
      _running = false;
      _stepIndex = 0;
      _activeSteps = STEPS;
      localStorage.removeItem(DEMO_KEY);
      localStorage.removeItem(DEMO_STEP_KEY);
      if (window.NavBar && window.NavBar.setDemoRunning) {
        window.NavBar.setDemoRunning(false);
      }
      const demoBtn = document.getElementById('nb-demo-btn');
      if (demoBtn) {
        demoBtn.classList.remove('running');
        demoBtn.innerHTML = '▶ <span class="nb-demo-lbl">Run Demo</span>';
      }
      const phoneBtn = document.getElementById('t5-btn-phone-fan');
      if (phoneBtn) {
        phoneBtn.innerHTML = '🌀 Actuate ESP32 Fan (Downlink)';
        phoneBtn.style.borderColor = 'var(--cyan)';
        phoneBtn.style.color = '#fff';
      }
      const benchBtn = document.getElementById('sb-btn-app-fan-demo');
      if (benchBtn) {
        benchBtn.innerHTML = '📱 Cell App ➔ Fan Actuation Flow';
      }
      document.querySelectorAll('.tier-column').forEach(c => {
        c.classList.remove('active-stage');
        c.style.boxShadow = '';
      });
      const t4SqlBox = document.getElementById('t4-sql-rule-box');
      if (t4SqlBox) {
        t4SqlBox.innerHTML = `
          <span style="color:#f43f5e">SELECT</span> device_id, temp, humidity<br>
          <span style="color:#f43f5e">FROM</span> <span style="color:#10b981">'iot/telemetry/+'</span><br>
          <span style="color:#f43f5e">WHERE</span> temp &gt; 0<br>
          <span style="color:#64748b">-- Action 1: DynamoDB PutItem</span><br>
          <span style="color:#64748b">-- Action 2: Lambda temp &gt; 30°C</span>
        `;
      }
      _destroyOverlay();
      if (_timer) { clearTimeout(_timer); _timer = null; }
    },

    toggle(sim) {
      if (_running) {
        window.DemoMode.stop();
      } else {
        window.DemoMode.start(sim);
      }
    },

    isRunning() { return _running; }
  };

  // ── Auto-start if flag is set (navigated from another page or hash) ──────
  document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem(DEMO_KEY) === '1' || window.location.hash === '#demo') {
      setTimeout(() => {
        window.DemoMode.start();
      }, 700);
    }
  });

  // ── Core sequence ───────────────────────────────────────────────────────
  function _runStep() {
    if (!_running) return;
    if (_stepIndex >= _activeSteps.length) {
      window.DemoMode.stop();
      return;
    }

    const step = _activeSteps[_stepIndex];
    localStorage.setItem(DEMO_STEP_KEY, String(_stepIndex));

    // Ensure sim reference is fresh
    if (!_sim) {
      _sim = (window.SimBus && window.SimBus.getSim()) || window._tech300Sim || window.sim || null;
    }

    // Switch dashboard tab
    if (step.tab) _switchTab(step.tab);

    // Update overlay with active step list
    _updateOverlay(step, _stepIndex + 1, _activeSteps.length, _activeSteps);

    // Highlight element with smooth center scroll
    if (step.highlight) _pulse(step.highlight);

    // Trigger actions
    if (step.action === 'inject_spike' && _sim) {
      if (_sim.triggerTempAnomaly) _sim.triggerTempAnomaly('sensor_node_01');
    } else if (step.action === 'clear_spike' && _sim) {
      setTimeout(() => {
        if (_sim && _sim.clearAnomaly) _sim.clearAnomaly('sensor_node_01');
      }, 2500);
    } else if (step.action === 'downlink_t5') {
      const phoneBtn = document.getElementById('t5-btn-phone-fan');
      if (phoneBtn) {
        phoneBtn.innerHTML = '⏳ 1. App Publishing...';
        phoneBtn.style.borderColor = '#00e5ff';
      }
      const benchBtn = document.getElementById('sb-btn-app-fan-demo');
      if (benchBtn) {
        benchBtn.innerHTML = '⏳ Downlink Flow Running...';
      }
      const t5Alert = document.getElementById('t5-phone-alert');
      const t5AlertIcon = document.getElementById('t5-phone-alert-icon');
      const t5AlertText = document.getElementById('t5-phone-alert-text');
      if (t5Alert) {
        t5Alert.className = 't5-phone-alert-banner alert-active';
        if (t5AlertIcon) t5AlertIcon.textContent = '📲';
        if (t5AlertText) t5AlertText.innerHTML = '<strong>DOWNLINK TX:</strong> Fan Actuation (PWM 100%)';
      }
      if (typeof playSound === 'function') playSound('click');
      if (typeof showToast === 'function') showToast('📱 STEP 1 (Tier 5 Mobile App): User pressed Fan Actuation on IoTSense App. Generating MQTT command...', 'info');
    } else if (step.action === 'downlink_t4') {
      const phoneBtn = document.getElementById('t5-btn-phone-fan');
      if (phoneBtn) phoneBtn.innerHTML = '⏳ 2. AWS Broker Routing...';
      const t4SqlBox = document.getElementById('t4-sql-rule-box');
      if (t4SqlBox) {
        t4SqlBox.innerHTML = `
          <span style="color:#00e5ff">TOPIC:</span> <span style="color:#10b981">'iot/actuation/sensor_node_01'</span><br>
          <span style="color:#f43f5e">ACTION:</span> DOWNLINK_ROUTE -&gt; Edge Gateway<br>
          <span style="color:#a855f7">AUTH:</span> mTLS X.509 RSA-2048 (Policy: DownlinkAllow)<br>
          <span style="color:#64748b">-- Dispatched to RPi 4 Gateway via Port 8883</span>
        `;
      }
      if (typeof playSound === 'function') playSound('click');
      if (typeof showToast === 'function') showToast('☁️ STEP 2 (Tier 4 AWS IoT Core): MQTT Broker received command on topic "iot/actuation/sensor_node_01" (mTLS 8883)...', 'info');
    } else if (step.action === 'downlink_t3') {
      const phoneBtn = document.getElementById('t5-btn-phone-fan');
      if (phoneBtn) phoneBtn.innerHTML = '⏳ 3. Gateway Translating...';
      const t3Box = document.getElementById('t3-mqtt-packet');
      if (t3Box) {
        t3Box.textContent = JSON.stringify({
          downlink_action: "TRANSLATE_TO_BLE_GATT",
          mqtt_topic: `iot/actuation/sensor_node_01`,
          target_mac: "C4:4F:33:18:A2:9B",
          gatt_handle: "0x002A",
          gatt_uuid: "0x2A56",
          write_value_hex: "0x64 (PWM 100%)",
          timestamp: Math.floor(Date.now() / 1000)
        }, null, 2);
      }
      if (typeof playSound === 'function') playSound('click');
      if (typeof showToast === 'function') showToast('📟 STEP 3 (Tier 3 Edge Gateway): RPi 4 translates MQTT JSON to BLE GATT Char Write (UUID 0x2A56)...', 'info');
    } else if (step.action === 'downlink_t2') {
      const phoneBtn = document.getElementById('t5-btn-phone-fan');
      if (phoneBtn) phoneBtn.innerHTML = '⏳ 4. BLE 5.0 ATT Write...';
      const t2Box = document.getElementById('t2-ble-packet');
      if (t2Box) {
        t2Box.textContent = `ATT_WRITE_REQ [MAC: C4:4F:33:18:A2:9B]\nUUID: 0x2A56 (Fan PWM Actuator)\nVALUE: 0x64 (100% Duty Cycle)\nENCRYPTION: AES-128 CCM Over-the-Air`;
      }
      if (typeof playSound === 'function') playSound('click');
      if (typeof showToast === 'function') showToast('📶 STEP 4 (Tier 2 Proximity BLE 5.0): Transmitting AES-128 CCM encrypted ATT Write frame over 2.4GHz RF to ESP32...', 'info');
    } else if (step.action === 'downlink_t1') {
      if (typeof playSound === 'function') playSound('ack');
      if (typeof showToast === 'function') showToast('🎛️ STEP 5 (Tier 1 Perception): ESP32 GPIO 18 Fan SPINS UP at 100% PWM! E2E RTT ~142ms confirmed.', 'success');

      if (_sim) {
        _sim.dispatchActuatorCommand('sensor_node_01', 'fan', true);
        _sim.dispatchActuatorCommand('sensor_node_01', 'fan_pwm', 100);
      }

      const fanIcon = document.getElementById('t1-fan-icon');
      const fanPwm = document.getElementById('t1-fan-pwm');
      const fanRpm = document.getElementById('t1-fan-rpm');
      const fanBadge = document.getElementById('t1-fan-status-badge');
      const powerDraw = document.getElementById('t1-power-draw');

      if (fanIcon) fanIcon.classList.add('fan-spinning');
      if (fanPwm) {
        fanPwm.textContent = 'PWM: 100%';
        fanPwm.style.color = 'var(--cyan)';
      }
      if (fanRpm) {
        fanRpm.textContent = '3,200 RPM';
        fanRpm.style.color = 'var(--emerald)';
      }
      if (fanBadge) {
        fanBadge.textContent = 'ACTIVE (100%)';
        fanBadge.style.background = 'rgba(0,229,255,0.2)';
        fanBadge.style.color = 'var(--cyan)';
      }
      if (powerDraw) {
        powerDraw.textContent = '128.5 mA';
        powerDraw.style.color = 'var(--amber)';
      }

      const phoneBtn = document.getElementById('t5-btn-phone-fan');
      if (phoneBtn) {
        phoneBtn.innerHTML = '✅ FAN ACTIVE (100% PWM)';
        phoneBtn.style.borderColor = 'var(--emerald)';
        phoneBtn.style.color = 'var(--emerald)';
      }
      const benchBtn = document.getElementById('sb-btn-app-fan-demo');
      if (benchBtn) {
        benchBtn.innerHTML = '📱 Cell App ➔ Fan Actuation Flow';
      }
      const t5Ac = document.getElementById('t5-phone-ac');
      if (t5Ac) {
        t5Ac.textContent = 'COOLING ACTIVE';
        t5Ac.className = 't5-ac-badge active';
      }
      const t5Alert = document.getElementById('t5-phone-alert');
      const t5AlertIcon = document.getElementById('t5-phone-alert-icon');
      const t5AlertText = document.getElementById('t5-phone-alert-text');
      if (t5Alert) {
        t5Alert.className = 't5-phone-alert-banner nominal';
        if (t5AlertIcon) t5AlertIcon.textContent = '✅';
        if (t5AlertText) t5AlertText.innerHTML = '<strong>ACK RECEIVED:</strong> ESP32 Fan Active (RTT ~142ms)';
      }

      if (_sim && _sim.nodes && _sim.nodes.sensor_node_01) {
        const node = _sim.nodes.sensor_node_01;
        let coolCount = 0;
        const coolInterval = setInterval(() => {
          if (coolCount++ < 12 && node.temp > 21.0) {
            node.temp = +(node.temp - 0.35).toFixed(1);
          } else {
            clearInterval(coolInterval);
          }
        }, 600);
      }
    } else if (step.action === 'done') {
      // Completed step
    }

    _stepIndex++;
    _timer = setTimeout(_runStep, step.duration);
  }

  // ── Tab switching ───────────────────────────────────────────────────────
  function _switchTab(tabId) {
    const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (btn) btn.click();
  }

  // ── Element pulse highlight ─────────────────────────────────────────────
  function _pulse(selector) {
    const el = document.querySelector(selector);
    if (!el) return;
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (_) {}
    document.querySelectorAll('.tier-column').forEach(c => {
      c.classList.remove('active-stage');
      c.style.boxShadow = '';
    });
    if (el.classList.contains('tier-column')) {
      el.classList.add('active-stage');
    }
    el.style.transition = 'box-shadow 0.4s ease, border-color 0.4s ease';
    el.style.boxShadow  = '0 0 0 3px #00d4ff, 0 0 30px rgba(0, 212, 255, 0.45)';
    setTimeout(() => {
      el.style.boxShadow = '';
    }, 2800);
  }

  // ── Overlay (HUD) ──────────────────────────────────────────────────────
  function _createOverlay() {
    if (_overlay) return;
    _overlay = document.createElement('div');
    _overlay.id = 'demo-mode-overlay';

    // Inject styles once
    if (!document.getElementById('demo-mode-styles')) {
      const s = document.createElement('style');
      s.id = 'demo-mode-styles';
      s.textContent = `
        @keyframes demoSlideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes demoProgress {
          from { width: 100%; }
          to   { width: 0%; }
        }
        #demo-mode-overlay {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 999999;
          background: rgba(8, 14, 28, 0.96);
          border: 1.5px solid rgba(0, 212, 255, 0.35);
          border-radius: 16px;
          padding: 16px 22px;
          max-width: 640px;
          width: calc(100vw - 48px);
          display: flex;
          align-items: flex-start;
          gap: 14px;
          box-shadow: 0 12px 50px rgba(0, 0, 0, 0.75), 0 0 35px rgba(0, 212, 255, 0.12);
          font-family: var(--font-sans, 'Inter', -apple-system, sans-serif);
          animation: demoSlideUp 0.35s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(20px);
          color: #f8fafc;
        }
        [data-theme="light"] #demo-mode-overlay {
          background: rgba(255, 255, 255, 0.98) !important;
          border: 2px solid #cbd5e1 !important;
          box-shadow: 0 12px 50px rgba(0, 0, 0, 0.18), 0 0 25px rgba(2, 132, 199, 0.15) !important;
          color: #0f172a !important;
        }
        #demo-mode-overlay .dm-title {
          font-size: 0.92rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 5px;
          line-height: 1.3;
        }
        [data-theme="light"] #demo-mode-overlay .dm-title {
          color: #0f172a !important;
        }
        #demo-mode-overlay .dm-body {
          font-size: 0.78rem;
          color: #94a3b8;
          line-height: 1.55;
        }
        [data-theme="light"] #demo-mode-overlay .dm-body {
          color: #334155 !important;
        }
        #demo-mode-overlay .dm-progress-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 3.5px;
          border-radius: 0 0 16px 16px;
          background: linear-gradient(90deg, #00d4ff, #6366f1);
          animation: demoProgress linear forwards;
        }
        [data-theme="light"] #demo-mode-overlay .dm-progress-bar {
          background: linear-gradient(90deg, #0284c7, #7c3aed) !important;
        }
        #demo-mode-overlay .dm-stop-btn {
          font-size: 0.68rem;
          color: #64748b;
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px 6px;
          font-family: var(--font-mono, monospace);
          font-weight: 600;
          transition: color 0.15s;
        }
        #demo-mode-overlay .dm-stop-btn:hover {
          color: #f43f5e;
        }
        [data-theme="light"] #demo-mode-overlay .dm-stop-btn {
          color: #64748b !important;
        }
        [data-theme="light"] #demo-mode-overlay .dm-stop-btn:hover {
          color: #e11d48 !important;
        }
      `;
      document.head.appendChild(s);
    }

    document.body.appendChild(_overlay);
  }

  function _updateOverlay(step, current, total) {
    if (!_overlay) return;

    const stepsList  = _activeSteps || STEPS;
    const isAlert    = step.id === 'alert' || step.id === 'spike';
    const titleColor = isAlert ? '#f43f5e' : 'var(--cyan, #00d4ff)';
    const icon       = _iconForStep(step.id);

    _overlay.innerHTML = `
      <div style="width:42px; height:42px; border-radius:10px; background:linear-gradient(135deg, rgba(0,212,255,0.22), rgba(99,102,241,0.25)); border:1.5px solid rgba(0,212,255,0.45); display:flex; align-items:center; justify-content:center; font-size:1.45rem; flex-shrink:0; box-shadow:0 0 16px rgba(0,212,255,0.25); margin-top:1px;">
        ${icon}
      </div>
      <div style="flex:1; min-width:0;">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
          <span style="font-size:0.72rem; font-family:var(--font-mono, monospace); font-weight:700;
                       color:${titleColor}; text-transform:uppercase; letter-spacing:0.1em;">
            DEMO STEP ${current} / ${total}
          </span>
          <span style="flex:1; height:1px; background:rgba(255,255,255,0.12);"></span>
          <button class="dm-stop-btn" onclick="window.DemoMode.stop()" title="Stop Guided Demo Sequence">
            [ESC] Stop Demo
          </button>
        </div>
        <div class="dm-title">
          ${step.title}
        </div>
        <div class="dm-body">
          ${step.body}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
          <div style="display:flex; gap:4px;">
            ${stepsList.map((_, i) => `
              <span style="width:${i < current ? '14' : '7'}px; height:4px; border-radius:2px;
                           background:${i < current ? 'var(--cyan, #00d4ff)' : 'rgba(255,255,255,0.18)'};
                           transition:all 0.3s;"></span>
            `).join('')}
          </div>
          <span style="font-size:0.68rem; color:#94a3b8; font-family:var(--font-mono, monospace); font-weight:600;">
            ${current === total ? 'Complete' : `Next in ${(step.duration / 1000).toFixed(0)}s`}
          </span>
        </div>
      </div>
      <div class="dm-progress-bar" style="animation-duration:${step.duration}ms;"></div>
    `;
  }

  function _destroyOverlay() {
    if (_overlay) {
      _overlay.remove();
      _overlay = null;
    }
  }

  function _iconForStep(id) {
    const icons = {
      intro:              '🎬',
      tier1:              '🎛️',
      tier2:              '📶',
      tier3:              '🖥️',
      tier4_pre:          '☁️',
      tier5_phone_intro:  '📱',
      spike:              '⚠️',
      alert:              '🚨',
      tier5_phone_alert:  '🚨',
      tier5_actuation:    '🕹️',
      fleet:              '📊',
      resolution:         '✅',
      done:               '🎓',
      downlink_t5:        '📱',
      downlink_t4:        '☁️',
      downlink_t3:        '🖥️',
      downlink_t2:        '📶',
      downlink_t1:        '🌀'
    };
    return icons[id] || '📡';
  }

  // Keyboard shortcut — Escape to stop demo
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _running) {
      window.DemoMode.stop();
    }
  });

})();
