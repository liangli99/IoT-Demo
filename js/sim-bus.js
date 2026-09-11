/**
 * TECH 300 IoT Demo — Simulation State Bus (sim-bus.js)
 * ─────────────────────────────────────────────────────
 * Cross-tab event broadcasting via BroadcastChannel API.
 * Allows all open browser tabs (landing, dashboard, app, AWS) to share a
 * single live simulation state without a server.
 *
 * Architecture:
 *   Publisher tab (whichever created a simulation engine first) broadcasts
 *   telemetry + alert events → all Subscriber tabs receive them in real-time.
 *   A compact state snapshot is persisted in localStorage so newly-opened
 *   tabs can catch up instantly.
 */

(function () {
  'use strict';

  const CHANNEL_NAME  = 'tech300-iot-sim';
  const STORAGE_KEY   = 'tech300-sim-state';
  const SNAPSHOT_TTL  = 30000; // 30 s — ignore stale snapshots

  class SimulationBus {
    constructor() {
      this._listeners = {};
      this._sim       = null;
      this._isPublisher = false;

      // Open BroadcastChannel (no-op in environments where it is unsupported)
      try {
        this._ch = new BroadcastChannel(CHANNEL_NAME);
        this._ch.addEventListener('message', (e) => this._onChannelMessage(e));
      } catch (_) {
        this._ch = null; // Safari Private / older browsers — graceful degrade
      }

      // Load last snapshot immediately so pages can pre-warm
      this._lastSnapshot = this._loadSnapshot();
    }

    // ── Publisher API ─────────────────────────────────────────────────────
    /**
     * Attach a live IoTSimulationEngine as the event publisher.
     * Should be called on the page that created the engine.
     */
    connect(sim) {
      if (this._sim) return; // already connected
      this._sim = sim;
      this._isPublisher = true;

      sim.on('telemetry', (record) => {
        this._saveSnapshot(sim);
        this._broadcast('telemetry', record);
      });

      sim.on('alert', (alertItem) => {
        this._broadcast('alert', alertItem);
      });

      sim.on('actuationAck', (ack) => {
        this._broadcast('actuationAck', ack);
      });
    }

    // ── Subscriber API ────────────────────────────────────────────────────
    /**
     * Register a callback for cross-tab events.
     * event: 'telemetry' | 'alert' | 'actuationAck' | 'snapshot'
     */
    on(event, callback) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(callback);
    }

    /**
     * Get the last persisted state snapshot (may be from another tab).
     * Returns null if no snapshot or snapshot is stale.
     */
    getSnapshot() {
      return this._lastSnapshot;
    }

    /**
     * Return the live simulation engine if this tab is the publisher,
     * otherwise null.
     */
    getSim() {
      return this._sim;
    }

    isPublisher() {
      return this._isPublisher;
    }

    // ── Internal ─────────────────────────────────────────────────────────
    _broadcast(event, data) {
      if (!this._ch) return;
      try {
        this._ch.postMessage({ event, data, ts: Date.now() });
      } catch (_) {}
    }

    _onChannelMessage(e) {
      const { event, data } = e.data || {};
      if (!event) return;

      // Update local snapshot cache when we receive a telemetry update
      if (event === 'telemetry') {
        this._lastSnapshot = this._loadSnapshot();
      }

      this._emit(event, data);
    }

    _emit(event, data) {
      (this._listeners[event] || []).forEach(cb => {
        try { cb(data); } catch (_) {}
      });
    }

    _saveSnapshot(sim) {
      try {
        const nodes = {};
        Object.entries(sim.nodes).forEach(([id, n]) => {
          nodes[id] = {
            temp:         +n.temp.toFixed(2),
            humidity:     +n.humidity.toFixed(1),
            pressure:     +n.pressure.toFixed(1),
            vibration:    +n.vibration.toFixed(3),
            battery:      +n.battery.toFixed(1),
            state:        n.state,
            acState:      n.acState,
            relayState:   n.relayState,
            fanState:     n.fanState,
            anomalyActive:n.anomalyActive
          };
        });

        const snapshot = {
          ts:                    Date.now(),
          totalPacketsIngested:  sim.totalPacketsIngested,
          lambdaAlertCount:      sim.lambdaAlertLogs.length,
          dynamoDbCount:         sim.dynamoDbRecords.length,
          isRunning:             sim.isRunning,
          gatewayWanConnected:   sim.gatewayWanConnected,
          nodes
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
        this._lastSnapshot = snapshot;
      } catch (_) {}
    }

    _loadSnapshot() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const snap = JSON.parse(raw);
        // Discard stale snapshots
        if (Date.now() - snap.ts > SNAPSHOT_TTL) return null;
        return snap;
      } catch (_) {
        return null;
      }
    }
  }

  // Singleton — shared across all modules on this page
  window.SimBus = new SimulationBus();

})();
