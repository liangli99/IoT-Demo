/**
 * TECH 300 IoT Demo - Main UI Orchestrator
 * Connects Simulation Engine, Canvas Charts, DynamoDB Inspector,
 * Actuation Switches, and Hardware Documentation.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Audio Synthesizer (Web Audio API - zero external dependencies)
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function playSound(type) {
    if (!audioCtx || audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    if (type === 'click') {
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === 'ack') {
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.06); // E5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'alert') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(880, now + 0.1);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    }
  }

  // 2. Initialize Core Modules
  const sim = new IoTSimulationEngine();
  window._tech300Sim = sim; // Expose for DemoMode and SimBus integration
  if (window.DemoMode) window.DemoMode._sim = sim;
  const chartsManager = new TelemetryChartsManager();
  chartsManager.init();


  let activeNodeId = 'sensor_node_01';
  let activeTab = 'pipeline';

  // Pre-load initial historical data to charts
  const initialHistory = sim.getRecentTelemetry(activeNodeId, 30);
  chartsManager.loadHistory(initialHistory);

  // 3. Tab Switching Navigation
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      playSound('click');
      const targetTab = btn.getAttribute('data-tab');
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const panel = document.getElementById(`tab-${targetTab}`);
      if (panel) panel.classList.add('active');
      activeTab = targetTab;

      // Force charts resize if switching to fleet tab
      if (targetTab === 'fleet') {
        setTimeout(() => {
          Object.values(chartsManager.charts).forEach(c => c._handleResize());
        }, 50);
      }
    });
  });

  // 4. Node Card Selector (Fleet Tab & Controls)
  const nodeCards = document.querySelectorAll('.node-card');
  nodeCards.forEach(card => {
    card.addEventListener('click', () => {
      playSound('click');
      const nId = card.getAttribute('data-node-id');
      selectActiveNode(nId);
    });
  });

  function selectActiveNode(nId) {
    activeNodeId = nId;
    nodeCards.forEach(c => {
      c.classList.toggle('selected', c.getAttribute('data-node-id') === nId);
    });

    // Update charts with node's telemetry
    const history = sim.getRecentTelemetry(nId, 30);
    chartsManager.loadHistory(history);

    // Update actuation panel values
    updateActuationPanelUI();

    // Update active node name displays
    const nodeObj = sim.nodes[nId];
    document.querySelectorAll('.active-node-name').forEach(el => el.textContent = nodeObj.name);
    document.querySelectorAll('.active-node-id').forEach(el => el.textContent = nodeObj.id);
  }

  // 5. Global Simulation Controls
  const btnToggleSim = document.getElementById('btn-toggle-sim');
  const speedSelect = document.getElementById('speed-select');
  const btnInjectAnomaly = document.getElementById('btn-inject-anomaly');
  const btnClearAnomaly = document.getElementById('btn-clear-anomaly');
  const btnToggleGateway = document.getElementById('btn-toggle-gateway');

  if (btnToggleSim) {
    btnToggleSim.addEventListener('click', () => {
      playSound('click');
      const running = sim.togglePause();
      btnToggleSim.innerHTML = running ? '⏸ Pause Stream' : '▶ Resume Stream';
      btnToggleSim.classList.toggle('btn-amber', !running);
      btnToggleSim.classList.toggle('btn-primary', running);
    });
  }

  if (speedSelect) {
    speedSelect.addEventListener('change', (e) => {
      playSound('click');
      sim.setSpeed(parseFloat(e.target.value));
    });
  }

  if (btnInjectAnomaly) {
    btnInjectAnomaly.addEventListener('click', () => {
      playSound('alert');
      sim.triggerTempAnomaly(activeNodeId);
      showToast(`⚠️ Anomaly Injected: Forcing temperature spike (>30°C) on ${activeNodeId}`, 'alert');
    });
  }

  if (btnClearAnomaly) {
    btnClearAnomaly.addEventListener('click', () => {
      playSound('click');
      sim.clearAnomaly(activeNodeId);
      showToast(`Normal baseline restored on ${activeNodeId}`, 'success');
    });
  }

  if (btnToggleGateway) {
    btnToggleGateway.addEventListener('click', () => {
      playSound('click');
      const newStatus = !sim.gatewayWanConnected;
      const flushed = sim.setGatewayWan(newStatus);
      if (newStatus) {
        btnToggleGateway.innerHTML = '🌐 Disconnect Gateway WAN';
        btnToggleGateway.classList.remove('btn-amber');
        btnToggleGateway.classList.add('btn');
        showToast(`Gateway WAN Reconnected. Flushed ${flushed} cached packets to AWS IoT Core!`, 'success');
      } else {
        btnToggleGateway.innerHTML = '⚠️ Reconnect Gateway WAN';
        btnToggleGateway.classList.add('btn-amber');
        showToast(`Gateway WAN Offline. Simulating local SQLite store-and-forward caching on Raspberry Pi.`, 'alert');
      }
      updateGatewayStatusUI();
    });
  }

  // 5b. Demo Operations & Scenario Test Center Switchboard
  const sbBtnTempSpike = document.getElementById('sb-btn-temp-spike');
  if (sbBtnTempSpike) {
    sbBtnTempSpike.addEventListener('click', () => {
      playSound('alert');
      sim.triggerTempAnomaly(activeNodeId);
      showToast(`🚨 Temp Spike Injected (>30°C) on ${activeNodeId}. AWS Lambda alert triggered!`, 'alert');
    });
  }

  const sbBtnToggleRelay = document.getElementById('sb-btn-toggle-relay');
  if (sbBtnToggleRelay) {
    sbBtnToggleRelay.addEventListener('click', () => {
      playSound('click');
      const node = sim.nodes[activeNodeId];
      const newState = !node.relayState;
      sim.dispatchActuatorCommand(activeNodeId, 'relay', newState);
      updateActuationPanelUI();
      showToast(`⚡ Physical Relay ${newState ? 'ENGAGED' : 'DISENGAGED'} on ${activeNodeId}`, 'success');
    });
  }

  const sbBtnWanToggle = document.getElementById('sb-btn-wan-toggle');
  if (sbBtnWanToggle) {
    sbBtnWanToggle.addEventListener('click', () => {
      playSound('click');
      const newStatus = !sim.gatewayWanConnected;
      const flushed = sim.setGatewayWan(newStatus);
      if (newStatus) {
        sbBtnWanToggle.innerHTML = '🔌 Toggle Gateway WAN';
        sbBtnWanToggle.classList.remove('btn-amber');
        sbBtnWanToggle.classList.add('btn');
        showToast(`Gateway WAN Reconnected. Flushed ${flushed} cached packets to AWS IoT Core!`, 'success');
      } else {
        sbBtnWanToggle.innerHTML = '⚠️ Reconnect Gateway WAN';
        sbBtnWanToggle.classList.add('btn-amber');
        showToast(`Gateway WAN Offline. Simulating local SQLite store-and-forward caching on Raspberry Pi.`, 'alert');
      }
      updateGatewayStatusUI();
    });
  }

  const sbBtnBurst = document.getElementById('sb-btn-burst-test');
  if (sbBtnBurst) {
    sbBtnBurst.addEventListener('click', () => {
      playSound('click');
      sim.injectBurst(50, activeNodeId);
      showToast(`🌊 Injected 50-Packet Telemetry Burst on ${activeNodeId}! Benchmarking throughput.`, 'info');
    });
  }

  const sbBtnReset = document.getElementById('sb-btn-reset-baseline');
  if (sbBtnReset) {
    sbBtnReset.addEventListener('click', () => {
      playSound('click');
      Object.keys(sim.nodes).forEach(nId => sim.clearAnomaly(nId));
      showToast('Baseline telemetry restored across all fleet nodes.', 'success');
    });
  }

  const sbBtnDemo = document.getElementById('sb-btn-guided-demo');
  if (sbBtnDemo) {
    sbBtnDemo.addEventListener('click', () => {
      playSound('click');
      if (window.DemoMode) {
        window.DemoMode.toggle();
      } else {
        showToast('Starting guided demo tour...', 'info');
      }
    });
  }

  // Latency Benchmarking Probe
  const btnLatencyProbe = document.getElementById('btn-run-latency-probe');
  const latencyProbeLog = document.getElementById('latency-probe-log');
  if (btnLatencyProbe) {
    btnLatencyProbe.addEventListener('click', () => {
      playSound('click');
      if (!latencyProbeLog) return;
      const probeId = 'probe_' + Math.floor(1000 + Math.random() * 9000);
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
      
      const bleMs = (16 + Math.random() * 5).toFixed(1);
      const gwMs = (21 + Math.random() * 6).toFixed(1);
      const awsMs = (78 + Math.random() * 12).toFixed(1);
      const totalRtt = (+bleMs + +gwMs + +awsMs + 20.0).toFixed(1);

      const bleCard = document.getElementById('metric-ble-latency');
      const gwCard = document.getElementById('metric-gw-latency');
      const awsCard = document.getElementById('metric-aws-latency');
      const rttCard = document.getElementById('metric-rtt-latency');
      if (bleCard) bleCard.textContent = `${bleMs} ms`;
      if (gwCard) gwCard.textContent = `${gwMs} ms`;
      if (awsCard) awsCard.textContent = `${awsMs} ms`;
      if (rttCard) rttCard.textContent = `${totalRtt} ms`;

      const lines = [
        `<div style="color:var(--emerald); margin-top:8px;">[${timeStr}] PROBE_INIT: Dispatched ping probe ${probeId} targeting ${activeNodeId}</div>`,
        `<div style="color:var(--cyan);">[${timeStr}] HOP 1 (BLE 5.0): GATT characteristic read completed (+${bleMs}ms)</div>`,
        `<div style="color:#a5b4fc);">[${timeStr}] HOP 2 (Edge Gateway): Frame translated to JSON & queued (+${gwMs}ms)</div>`,
        `<div style="color:var(--amber);">[${timeStr}] HOP 3 (AWS IoT Core): MQTT mTLS 8883 delivered, DynamoDB ACK (+${awsMs}ms)</div>`,
        `<div style="color:#34d399; font-weight:700;">[${timeStr}] PROBE_COMPLETE: Round-trip verified. Total E2E Latency: ${totalRtt}ms [OPTIMAL]</div>`
      ];

      lines.forEach((l, idx) => {
        setTimeout(() => {
          latencyProbeLog.innerHTML = l + latencyProbeLog.innerHTML;
          if (idx === lines.length - 1) playSound('ack');
        }, idx * 120);
      });

      showToast(`⚡ Probe ${probeId} executed! End-to-End RTT: ${totalRtt}ms`, 'success');
    });
  }

  // 6. Actuation / Remote Control Panel
  const fanToggle = document.getElementById('switch-fan');
  const fanPwmRange = document.getElementById('range-fan-pwm');
  const fanPwmVal = document.getElementById('pwm-val-display');
  const relayToggle = document.getElementById('switch-relay');
  const ledSelect = document.getElementById('select-led-mode');
  const rtcSelect = document.getElementById('select-rtc-interval');
  const terminalLog = document.getElementById('actuation-terminal-log');

  function updateActuationPanelUI() {
    const node = sim.nodes[activeNodeId];
    if (!node) return;
    if (fanToggle) fanToggle.checked = node.fanState;
    if (fanPwmRange) fanPwmRange.value = node.fanPwm;
    if (fanPwmVal) fanPwmVal.textContent = `${node.fanPwm}%`;
    if (relayToggle) relayToggle.checked = node.relayState;
    if (ledSelect) ledSelect.value = node.ledState;
    if (rtcSelect) rtcSelect.value = node.rtcInterval;
  }

  if (fanToggle) {
    fanToggle.addEventListener('change', (e) => {
      playSound('click');
      sim.dispatchActuatorCommand(activeNodeId, 'fan', e.target.checked);
    });
  }

  if (fanPwmRange) {
    fanPwmRange.addEventListener('input', (e) => {
      if (fanPwmVal) fanPwmVal.textContent = `${e.target.value}%`;
    });
    fanPwmRange.addEventListener('change', (e) => {
      playSound('click');
      sim.dispatchActuatorCommand(activeNodeId, 'fan_pwm', parseInt(e.target.value));
    });
  }

  if (relayToggle) {
    relayToggle.addEventListener('change', (e) => {
      playSound('click');
      sim.dispatchActuatorCommand(activeNodeId, 'relay', e.target.checked);
    });
  }

  if (ledSelect) {
    ledSelect.addEventListener('change', (e) => {
      playSound('click');
      sim.dispatchActuatorCommand(activeNodeId, 'led', e.target.value);
    });
  }

  if (rtcSelect) {
    rtcSelect.addEventListener('change', (e) => {
      playSound('click');
      sim.dispatchActuatorCommand(activeNodeId, 'sleep_interval', parseInt(e.target.value));
    });
  }

  // Actuation ACK Logger
  sim.on('actuationAck', (evt) => {
    if (!terminalLog) return;
    const timeStr = new Date().toISOString().substring(11, 23);
    const line = document.createElement('div');
    line.className = 'term-line';

    if (evt.stage === 'MQTT_DISPATCHED') {
      line.className += ' cmd-sent';
      line.innerHTML = `[${timeStr}] 📤 <strong>PUB</strong> iot/commands/${evt.packet.target_device}: { action: "${evt.packet.action}", value: ${evt.packet.value} } (QoS 1)`;
    } else if (evt.stage === 'GATEWAY_DOWNLINK') {
      line.className += ' gateway-ack';
      line.innerHTML = `[${timeStr}] 🔀 <strong>GW-ACK</strong> Raspberry Pi 4 received downlink; converting to BLE GATT Write Characteristic (UUID: 0xFFE2)`;
    } else if (evt.stage === 'HARDWARE_CONFIRMED') {
      playSound('ack');
      line.className += ' device-ack';
      line.innerHTML = `[${timeStr}] ✅ <strong>ESP32-EXEC</strong> Node confirmation received! Peripheral state updated. Round-trip: <span style="color:#00e5ff">148ms</span>`;
      showToast(`Actuation confirmed on ${evt.packet.target_device}: ${evt.packet.action} -> ${evt.packet.value}`, 'success');
    }

    terminalLog.prepend(line);
    // Keep max 60 lines
    while (terminalLog.children.length > 60) {
      terminalLog.removeChild(terminalLog.lastChild);
    }
  });

  // 7. Telemetry Ingestion Event Listener
  sim.on('telemetry', (record) => {
    // If telemetry belongs to active node, push to charts
    if (record.device_id === activeNodeId) {
      chartsManager.pushReading(record);
    }

    // Update Fleet Card Badges
    updateFleetCard(record.device_id);

    // Update Top Header Counters
    const totalIngestedEl = document.getElementById('stat-total-ingested');
    if (totalIngestedEl) totalIngestedEl.textContent = sim.totalPacketsIngested.toLocaleString();

    // Prepend to DynamoDB table if active or visible
    prependDynamoDbRow(record);

    // Update Tier 1 Pipeline view values
    updatePipelineViewUI(record);
  });

  // Lambda Alert Event Listener
  sim.on('alert', (alertItem) => {
    playSound('alert');
    showToast(alertItem.message, 'alert');
    prependLambdaAlertRow(alertItem);
  });

  // 8. Pipeline View UI Updates
  function updatePipelineViewUI(record) {
    const node = sim.nodes[record.device_id];
    if (!node) return;

    // Only update tier 1 if it matches active node
    if (record.device_id === activeNodeId) {
      const elState = document.getElementById('t1-node-state');
      const elPower = document.getElementById('t1-power-draw');
      const elBatt = document.getElementById('t1-battery-volts');
      const elTemp = document.getElementById('t1-temp');
      const elHum = document.getElementById('t1-humidity');
      const elPress = document.getElementById('t1-pressure');

      if (elState) elState.textContent = node.state;
      if (elPower) elPower.textContent = `${node.currentDrawMa.toFixed(1)} mA`;
      if (elBatt) elBatt.textContent = `${node.batteryVolts.toFixed(2)}V (${node.battery.toFixed(0)}%)`;
      if (elTemp) elTemp.textContent = `${record.temp.toFixed(1)} °C`;
      if (elHum) elHum.textContent = `${record.humidity.toFixed(1)} %`;
      if (elPress) elPress.textContent = `${record.pressure.toFixed(1)} hPa`;

      // Duty Cycle Steps highlight
      const steps = ['sleep', 'wake', 'sample', 'broadcast'];
      steps.forEach(st => {
        const stepEl = document.getElementById(`duty-step-${st}`);
        if (stepEl) {
          stepEl.classList.toggle('active', node.state.toLowerCase() === st);
        }
      });

      // Tier 2: BLE Sniffer Frame
      const bleSnifferBox = document.getElementById('t2-ble-packet');
      if (bleSnifferBox) {
        const hexMock = `ADV_IND [MAC: ${record.device_id === 'sensor_node_01' ? 'C4:4F:33:18:A2:9B' : 'B8:27:EB:4F:91:0C'}] RSSI: ${record.rssi}dBm\nUUID: 0x181A Payload: [T:${(record.temp*100).toString(16).toUpperCase()} H:${(record.humidity*10).toString(16).toUpperCase()} P:${Math.floor(record.pressure).toString(16).toUpperCase()}]`;
        bleSnifferBox.textContent = hexMock;
      }

      // Tier 3: Edge Gateway Translation Preview
      const gwMqttBox = document.getElementById('t3-mqtt-packet');
      if (gwMqttBox) {
        gwMqttBox.textContent = JSON.stringify({
          topic: `iot/telemetry/${record.device_id}`,
          qos: 1,
          payload: {
            device_id: record.device_id,
            temp: record.temp,
            humidity: record.humidity,
            pressure: record.pressure,
            timestamp: record.timestamp
          }
        }, null, 2);
      }
    }
  }

  // 9. Fleet Cards Updater
  function updateFleetCard(nodeId) {
    const node = sim.nodes[nodeId];
    if (!node) return;

    const card = document.querySelector(`.node-card[data-node-id="${nodeId}"]`);
    if (!card) return;

    const tempEl = card.querySelector('.metric-temp-val');
    const humEl = card.querySelector('.metric-hum-val');
    const pressEl = card.querySelector('.metric-press-val');
    const battEl = card.querySelector('.metric-batt-val');
    const stateBadge = card.querySelector('.node-state-badge');

    if (tempEl) {
      tempEl.textContent = `${node.temp.toFixed(1)}°C`;
      tempEl.classList.toggle('alert-high', node.temp > 30.0);
    }
    if (humEl) humEl.textContent = `${node.humidity.toFixed(1)}%`;
    if (pressEl) pressEl.textContent = `${node.pressure.toFixed(1)} hPa`;
    if (battEl) battEl.textContent = `${node.battery.toFixed(0)}%`;
    if (stateBadge) {
      stateBadge.textContent = node.state;
      stateBadge.style.color = node.state === 'SLEEP' ? 'var(--text-dim)' : 'var(--emerald)';
    }
  }

  // Initial update for all fleet cards
  Object.keys(sim.nodes).forEach(nId => updateFleetCard(nId));

  // 10. Gateway Status UI
  function updateGatewayStatusUI() {
    const wanStatusDot = document.getElementById('gw-wan-dot');
    const wanStatusText = document.getElementById('gw-wan-text');
    const gwBufferCount = document.getElementById('gw-buffer-count');

    if (wanStatusDot) {
      wanStatusDot.style.backgroundColor = sim.gatewayWanConnected ? 'var(--emerald)' : 'var(--rose)';
    }
    if (wanStatusText) {
      wanStatusText.textContent = sim.gatewayWanConnected ? 'CONNECTED' : 'OFFLINE (STORE & FORWARD)';
      wanStatusText.style.color = sim.gatewayWanConnected ? 'var(--emerald)' : 'var(--rose)';
    }
    if (gwBufferCount) {
      gwBufferCount.textContent = `${sim.localBuffer.length} cached`;
    }
  }

  // 11. DynamoDB Table Management
  const dynamoTableBody = document.getElementById('dynamodb-table-body');
  const ddbNodeFilter = document.getElementById('ddb-node-filter');

  function renderFullDynamoDbTable() {
    if (!dynamoTableBody) return;
    dynamoTableBody.innerHTML = '';
    const filter = ddbNodeFilter ? ddbNodeFilter.value : 'all';
    const records = filter === 'all' 
      ? sim.dynamoDbRecords 
      : sim.dynamoDbRecords.filter(r => r.device_id === filter);

    records.slice(0, 50).forEach(r => {
      const row = createDynamoDbRow(r);
      dynamoTableBody.appendChild(row);
    });
  }

  function createDynamoDbRow(r) {
    const tr = document.createElement('tr');
    const isAlert = r.temp > 30.0;
    tr.innerHTML = `
      <td style="color:var(--cyan);">${r.device_id}</td>
      <td style="color:var(--text-dim);">${r.timestamp} <span style="font-size:0.7rem;">(${new Date(r.timestamp * 1000).toLocaleTimeString()})</span></td>
      <td style="color:${isAlert ? 'var(--rose); font-weight:bold;' : 'var(--text-main)'};">${r.temp.toFixed(2)} °C</td>
      <td>${r.humidity.toFixed(1)} %</td>
      <td>${r.pressure.toFixed(1)} hPa</td>
      <td>${(r.vibration || 0.04).toFixed(3)} g</td>
      <td><span class="badge" style="background:rgba(16,185,129,0.15); color:var(--emerald); padding:2px 6px; border-radius:4px;">QoS 1 ACK</span></td>
    `;
    return tr;
  }

  function prependDynamoDbRow(r) {
    if (!dynamoTableBody) return;
    const filter = ddbNodeFilter ? ddbNodeFilter.value : 'all';
    if (filter !== 'all' && r.device_id !== filter) return;

    const row = createDynamoDbRow(r);
    dynamoTableBody.prepend(row);
    if (dynamoTableBody.children.length > 50) {
      dynamoTableBody.removeChild(dynamoTableBody.lastChild);
    }
  }

  if (ddbNodeFilter) {
    ddbNodeFilter.addEventListener('change', () => {
      playSound('click');
      renderFullDynamoDbTable();
    });
  }
  renderFullDynamoDbTable();

  // 12. Lambda Alert Table
  const lambdaAlertBody = document.getElementById('lambda-alert-body');
  function prependLambdaAlertRow(alertItem) {
    if (!lambdaAlertBody) return;
    const tr = document.createElement('tr');
    tr.style.background = 'rgba(244, 63, 94, 0.08)';
    tr.innerHTML = `
      <td style="color:var(--rose); font-weight:bold;">${alertItem.id}</td>
      <td style="color:var(--cyan);">${alertItem.device_id}</td>
      <td style="color:var(--rose); font-weight:bold;">${alertItem.temp.toFixed(2)} °C</td>
      <td style="color:var(--text-muted); font-size:0.75rem;">${alertItem.message}</td>
      <td><span class="badge" style="background:rgba(244,63,94,0.2); color:var(--rose); padding:2px 6px; border-radius:4px;">SNS Sent</span></td>
    `;
    lambdaAlertBody.prepend(tr);
    if (lambdaAlertBody.children.length > 15) {
      lambdaAlertBody.removeChild(lambdaAlertBody.lastChild);
    }
  }

  // 13. CSV Export Functionality
  const btnExportCsv = document.getElementById('btn-export-csv');
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      playSound('click');
      const data = sim.dynamoDbRecords;
      if (!data || data.length === 0) {
        showToast('No data available to export.', 'alert');
        return;
      }
      const headers = ['device_id', 'timestamp', 'datetime', 'temp_c', 'humidity_pct', 'pressure_hpa', 'vibration_g', 'topic'];
      const rows = data.map(d => [
        d.device_id,
        d.timestamp,
        `"${new Date(d.timestamp * 1000).toISOString()}"`,
        d.temp,
        d.humidity,
        d.pressure,
        d.vibration,
        `"${d.topic}"`
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `IoT_Telemetry_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Telemetry CSV dataset exported successfully!', 'success');
    });
  }

  // 14. Image Lightbox Modal Viewer for Course Document Figures
  const modalOverlay = document.getElementById('img-modal-overlay');
  const modalImg = document.getElementById('modal-lightbox-img');
  const modalCaption = document.getElementById('modal-lightbox-caption');
  const modalClose = document.getElementById('modal-lightbox-close');

  document.querySelectorAll('.doc-figure-img').forEach(img => {
    img.addEventListener('click', () => {
      playSound('click');
      if (modalOverlay && modalImg) {
        modalImg.src = img.src;
        if (modalCaption) {
          const captionEl = img.parentElement.querySelector('.doc-figure-caption');
          modalCaption.textContent = captionEl ? captionEl.textContent : '';
        }
        modalOverlay.classList.add('active');
      }
    });
  });

  if (modalClose) {
    modalClose.addEventListener('click', () => {
      if (modalOverlay) modalOverlay.classList.remove('active');
    });
  }
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) modalOverlay.classList.remove('active');
    });
  }

  // 15. Toast Notification System
  const toastContainer = document.getElementById('toast-container');
  function showToast(msg, type = 'info') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'alert' ? 'alert-toast' : type === 'success' ? 'success-toast' : ''}`;
    toast.innerHTML = `
      <div>${msg}</div>
      <button style="background:none; border:none; color:inherit; cursor:pointer; margin-left:10px; font-size:1.1rem;">&times;</button>
    `;
    const closeBtn = toast.querySelector('button');
    closeBtn.addEventListener('click', () => toast.remove());

    toastContainer.appendChild(toast);
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 4500);
  }

  // Clock in status bar
  setInterval(() => {
    const clockEl = document.getElementById('realtime-clock');
    if (clockEl) {
      clockEl.textContent = new Date().toLocaleTimeString();
    }
  }, 1000);

  // Initial welcome toast
  setTimeout(() => {
    showToast('🚀 TECH 300 IoT Demo System online. 5-Tier stack streaming active.', 'success');
  }, 500);
});
