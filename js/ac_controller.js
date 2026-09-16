/**
 * TECH 300 — IoT Demo: AC Auto-Control Module
 * ──────────────────────────────────────────────────────────────────────────
 * Monitors temperature telemetry from the simulation engine and automatically
 * controls the relay actuator (simulating an AC compressor circuit).
 *
 * Logic:
 *   AUTO mode → ON  when temp ≥ onThreshold  (default 26.0 °C)
 *   AUTO mode → OFF when temp ≤ offThreshold (default 24.0 °C)
 *   MANUAL mode → user forces state, auto-control suspended
 *
 * AC maps to the 'relay' actuator command in IoTSimulationEngine.
 * Events emitted: 'stateChange', 'autoEvent'
 */

class ACController {
  /**
   * @param {IoTSimulationEngine} sim   - Shared simulation engine instance
   * @param {string}              nodeId - Target sensor node ID
   */
  constructor(sim, nodeId = 'sensor_node_01') {
    this.sim = sim;
    this.nodeId = nodeId;

    // State
    this.acOn        = false;     // Current AC compressor state
    this.autoMode    = true;      // true = auto; false = manual
    this.onThreshold = 26.0;      // °C — turn AC ON  above this
    this.offThreshold= 24.0;      // °C — turn AC OFF below this
    this.fanSpeed    = 75;        // % PWM for cooling fan when AC is ON
    this.setPoint    = 25.0;      // Target comfort setpoint (display only)

    // History log (max 60 events)
    this.eventLog = [];

    // Listeners
    this._listeners = {
      stateChange: [],
      autoEvent:   []
    };

    // Bind to simulation telemetry
    this.sim.on('telemetry', (record) => {
      if (record.device_id === this.nodeId) {
        this._evaluate(record.temp, record);
      }
    });

    // Sync initial state from node
    const node = this.sim.nodes[this.nodeId];
    if (node) {
      this.acOn = node.relayState;
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /** Set the target node (e.g. when user switches node) */
  setNode(nodeId) {
    this.nodeId = nodeId;
    const node = this.sim.nodes[nodeId];
    if (node) this.acOn = node.relayState;
    this._emit('stateChange', this.getStatus());
  }

  /** Enable/disable autonomous temperature-based control */
  setAutoMode(enabled) {
    this.autoMode = enabled;
    const reason = enabled
      ? 'Auto-mode enabled — system will manage AC based on temperature thresholds.'
      : 'Manual override active — auto-control suspended.';
    this._log('MODE_CHANGE', reason);
    this._emit('stateChange', this.getStatus());
    return this.getStatus();
  }

  /** Update temperature thresholds */
  setThresholds(onTemp, offTemp) {
    if (typeof onTemp  === 'number') this.onThreshold  = onTemp;
    if (typeof offTemp === 'number') this.offThreshold = offTemp;
    this._log('THRESHOLD_SET', `Thresholds updated → ON: ${this.onThreshold}°C | OFF: ${this.offThreshold}°C`);
    this._emit('stateChange', this.getStatus());
  }

  /** Set fan speed (PWM %) used when AC turns on in auto mode */
  setFanSpeed(pct) {
    this.fanSpeed = Math.max(10, Math.min(100, pct));
    if (this.acOn) {
      this.sim.dispatchActuatorCommand(this.nodeId, 'fan_pwm', this.fanSpeed);
    }
  }

  /**
   * Manual override: force AC ON or OFF regardless of auto mode
   * @param {'ON'|'OFF'} state
   */
  manualOverride(state) {
    const turnOn = state === 'ON';
    this._applyAC(turnOn, `Manual override → AC ${state}`);
  }

  /** Return current full status snapshot */
  getStatus() {
    const node = this.sim.nodes[this.nodeId];
    return {
      acOn:         this.acOn,
      autoMode:     this.autoMode,
      onThreshold:  this.onThreshold,
      offThreshold: this.offThreshold,
      fanSpeed:     this.fanSpeed,
      setPoint:     this.setPoint,
      nodeId:       this.nodeId,
      currentTemp:  node ? node.temp : null,
      eventLog:     this.eventLog.slice(0, 30)
    };
  }

  /** Subscribe to events: 'stateChange' | 'autoEvent' */
  on(event, callback) {
    if (this._listeners[event]) {
      this._listeners[event].push(callback);
    }
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  /** Called on every telemetry tick; applies auto-control logic */
  _evaluate(temp, record) {
    if (!this.autoMode) return; // Manual mode — do nothing

    const wasOn = this.acOn;

    if (!this.acOn && temp >= this.onThreshold) {
      this._applyAC(true,
        `AUTO: temp ${temp.toFixed(1)}°C ≥ threshold ${this.onThreshold}°C → AC ON`);
    } else if (this.acOn && temp <= this.offThreshold) {
      this._applyAC(false,
        `AUTO: temp ${temp.toFixed(1)}°C ≤ threshold ${this.offThreshold}°C → AC OFF`);
    }

    // Emit autoEvent every tick with current state for UI refresh
    this._emit('autoEvent', {
      temp,
      acOn:    this.acOn,
      autoMode: this.autoMode,
      changed: wasOn !== this.acOn,
      record
    });
  }

  /** Apply the AC state to the simulation hardware */
  _applyAC(turnOn, reason) {
    if (this.acOn === turnOn) return; // No change

    this.acOn = turnOn;

    // Drive relay actuator (AC compressor)
    this.sim.dispatchActuatorCommand(this.nodeId, 'relay', turnOn);

    // Drive fan at configured speed when AC is on
    this.sim.dispatchActuatorCommand(this.nodeId, 'fan', turnOn);
    if (turnOn) {
      this.sim.dispatchActuatorCommand(this.nodeId, 'fan_pwm', this.fanSpeed);
    }

    this._log(turnOn ? 'AC_ON' : 'AC_OFF', reason);
    this._emit('stateChange', this.getStatus());
  }

  _log(type, message) {
    const entry = {
      id:        Date.now(),
      type,      // 'AC_ON' | 'AC_OFF' | 'MODE_CHANGE' | 'THRESHOLD_SET'
      message,
      timestamp: new Date().toLocaleTimeString(),
      nodeId:    this.nodeId
    };
    this.eventLog.unshift(entry);
    if (this.eventLog.length > 60) this.eventLog.pop();
  }

  _emit(event, data) {
    (this._listeners[event] || []).forEach(cb => cb(data));
  }
}

// Attach to window for global access from both dashboard.html and app.html
window.ACController = ACController;
