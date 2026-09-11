/**
 * TECH 300 - End-to-End IoT Demo System Simulation Engine
 * Simulates Tier 1 (Sensors) -> Tier 2 (BLE 5.0) -> Tier 3 (Edge Gateway)
 * -> Tier 4 (AWS IoT Core, Rules Engine, DynamoDB, Lambda) -> Tier 5 (Actuation confirmation)
 */

class IoTSimulationEngine {
  constructor() {
    this.isRunning = true;
    this.speedMultiplier = 1;
    this.tickInterval = 1000;
    this.timerId = null;

    // Simulation metrics
    this.totalPacketsIngested = 1248;
    this.totalPacketsDropped = 3;
    this.gatewayWanConnected = true;
    this.localBuffer = []; // Raspberry Pi store-and-forward queue
    this.bleMode = 'advertising'; // 'advertising' or 'connected_gatt'
    
    // AWS DynamoDB simulated storage (max 200 records)
    this.dynamoDbRecords = [];
    this.maxDynamoDbRecords = 150;

    // Lambda execution log
    this.lambdaAlertLogs = [];

    // Nodes state
    this.nodes = {
      sensor_node_01: {
        id: 'sensor_node_01',
        name: 'Environmental Lab Node',
        type: 'ESP32-WROOM-32 + DHT22/MPU6050',
        location: 'Engineering Hall Lab 204',
        battery: 94.2, // %
        batteryVolts: 3.95,
        temp: 24.2,
        humidity: 52.8,
        pressure: 1013.4,
        vibration: 0.04,
        rssi: -62,
        rtcInterval: 10, // seconds
        rtcCounter: 0,
        state: 'SAMPLE', // SLEEP, WAKE, SAMPLE, BROADCAST
        currentDrawMa: 65,
        anomalyActive: false,
        // Actuators
        fanState: false,
        fanPwm: 60,
        relayState: false,
        acState: false,   // AC compressor state (driven by relay + ACController)
        ledState: 'OFF', // OFF, BLINK, SOLID
        lastSeen: Date.now()
      },
      sensor_node_02: {
        id: 'sensor_node_02',
        name: 'Server Room Rack Node',
        type: 'ESP32-WROOM-32 + BME280',
        location: 'DC Rack Row B-04',
        battery: 100.0,
        batteryVolts: 4.20,
        temp: 22.8,
        humidity: 41.5,
        pressure: 1014.1,
        vibration: 0.09,
        rssi: -58,
        rtcInterval: 8,
        rtcCounter: 0,
        state: 'SLEEP',
        currentDrawMa: 0.01,
        anomalyActive: false,
        fanState: true,
        fanPwm: 85,
        relayState: true,
        acState: true,    // Server room AC always on
        ledState: 'SOLID',
        lastSeen: Date.now()
      },
      sensor_node_03: {
        id: 'sensor_node_03',
        name: 'Smart Agriculture Node',
        type: 'Nordic nRF52840 + Enviro Probe',
        location: 'Research Greenhouse #3',
        battery: 81.6,
        batteryVolts: 3.82,
        temp: 26.7,
        humidity: 68.4,
        pressure: 1011.8,
        vibration: 0.02,
        rssi: -74,
        rtcInterval: 15,
        rtcCounter: 0,
        state: 'SLEEP',
        currentDrawMa: 0.008,
        anomalyActive: false,
        fanState: false,
        fanPwm: 40,
        relayState: false,
        acState: false,
        ledState: 'OFF',
        lastSeen: Date.now()
      }
    };

    // Pre-populate some historical DynamoDB records
    this._initHistoricalData();

    // Callbacks
    this.listeners = {
      telemetry: [],
      alert: [],
      actuationAck: [],
      pipelineStage: []
    };

    this.start();

    // Auto-connect to SimBus so events broadcast cross-tab.
    // SimBus may not be loaded yet (script order), so defer to next tick.
    setTimeout(() => {
      if (window.SimBus && typeof window.SimBus.connect === 'function') {
        window.SimBus.connect(this);
      }
    }, 0);
  }


  _initHistoricalData() {
    const now = Math.floor(Date.now() / 1000);
    const nodeIds = Object.keys(this.nodes);
    
    for (let i = 50; i >= 1; i--) {
      const ts = now - i * 5;
      const nId = nodeIds[i % nodeIds.length];
      const baseTemp = nId === 'sensor_node_01' ? 24 : nId === 'sensor_node_02' ? 22.5 : 26;
      const rec = {
        device_id: nId,
        timestamp: ts,
        temp: +(baseTemp + (Math.sin(i * 0.2) * 1.5) + (Math.random() * 0.4 - 0.2)).toFixed(2),
        humidity: +(50 + (Math.cos(i * 0.15) * 8) + (Math.random() * 0.5)).toFixed(1),
        pressure: +(1013.2 + (Math.random() * 0.8 - 0.4)).toFixed(1),
        vibration: +(0.03 + Math.random() * 0.03).toFixed(3),
        battery: +(95 - i * 0.02).toFixed(1),
        topic: `tech300/telemetry/${nId}`
      };
      this.dynamoDbRecords.push(rec);
    }
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  start() {
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = setInterval(() => this._tick(), this.tickInterval / this.speedMultiplier);
  }

  setSpeed(mult) {
    this.speedMultiplier = mult;
    this.start();
  }

  togglePause() {
    this.isRunning = !this.isRunning;
    return this.isRunning;
  }

  setGatewayWan(connected) {
    this.gatewayWanConnected = connected;
    if (connected && this.localBuffer.length > 0) {
      // Flush local buffer (Store & Forward)
      const flushedCount = this.localBuffer.length;
      while (this.localBuffer.length > 0) {
        const item = this.localBuffer.shift();
        this._processAwsCoreIngest(item);
      }
      return flushedCount;
    }
    return 0;
  }

  setBleMode(mode) {
    this.bleMode = mode;
  }

  triggerTempAnomaly(nodeId = 'sensor_node_01') {
    const node = this.nodes[nodeId];
    if (!node) return;
    node.anomalyActive = true;
    node.temp = 34.8 + Math.random() * 3.5; // Trigger > 30.0°C alert
    node.vibration = 0.48; // Spike vibration as well
    // Force immediate broadcast
    node.state = 'SAMPLE';
    node.rtcCounter = node.rtcInterval;
  }

  clearAnomaly(nodeId = 'sensor_node_01') {
    const node = this.nodes[nodeId];
    if (!node) return;
    node.anomalyActive = false;
    node.temp = 24.2;
    node.vibration = 0.04;
  }

  setGatewayWan(connected) {
    this.gatewayWanConnected = !!connected;
    let count = 0;
    if (this.gatewayWanConnected && this.localBuffer.length > 0) {
      const toFlush = [...this.localBuffer];
      count = toFlush.length;
      this.localBuffer = [];
      toFlush.forEach(item => this._processAwsCoreIngest(item));
      this.emit('pipelineStage', { stage: 'GATEWAY_FLUSHED', count: count });
    }
    return count;
  }

  toggleGatewayWan() {
    this.setGatewayWan(!this.gatewayWanConnected);
    return this.gatewayWanConnected;
  }

  injectBurst(count = 50, nodeId = 'sensor_node_01') {
    const node = this.nodes[nodeId] || this.nodes.sensor_node_01;
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        this._simulateSensors(node);
        this._broadcastBlePacket(node);
      }, i * 35);
    }
  }

  /**
   * Bi-directional Remote Actuation Loop
   * Presentation -> AWS MQTT Downlink -> Edge Gateway -> BLE GATT Write -> ESP32
   */
  dispatchActuatorCommand(nodeId, action, value) {
    const node = this.nodes[nodeId];
    if (!node) return { error: 'Unknown device node' };

    const cmdPacket = {
      command_id: 'cmd_' + Math.random().toString(36).substring(2, 9),
      target_device: nodeId,
      action: action, // 'fan', 'relay', 'led', 'sleep_interval'
      value: value,
      origin: 'tech300/presentation/web_client',
      timestamp: Date.now()
    };

    // Stage 1: Dispatched to AWS MQTT Broker
    this.emit('actuationAck', { stage: 'MQTT_DISPATCHED', packet: cmdPacket });

    // Stage 2: AWS Gateway Ingestion & BLE downlink (Simulated latency)
    setTimeout(() => {
      this.emit('actuationAck', { stage: 'GATEWAY_DOWNLINK', packet: cmdPacket });

      // Stage 3: ESP32 Hardware execution
      setTimeout(() => {
        if (action === 'fan') {
          node.fanState = !!value;
        } else if (action === 'fan_pwm') {
          node.fanPwm = Number(value);
        } else if (action === 'relay') {
          node.relayState = !!value;
          node.acState    = !!value; // Keep acState in sync with relay
        } else if (action === 'led') {
          node.ledState = value;
        } else if (action === 'sleep_interval') {
          node.rtcInterval = Number(value);
        }

        this.emit('actuationAck', { 
          stage: 'HARDWARE_CONFIRMED', 
          packet: cmdPacket,
          nodeState: {
            fanState: node.fanState,
            fanPwm: node.fanPwm,
            relayState: node.relayState,
            ledState: node.ledState,
            rtcInterval: node.rtcInterval
          }
        });
      }, 350 / this.speedMultiplier);
    }, 250 / this.speedMultiplier);

    return cmdPacket;
  }

  _tick() {
    if (!this.isRunning) return;

    // Simulate each node's RTC Duty Cycle
    Object.values(this.nodes).forEach(node => {
      node.rtcCounter++;

      // Cycle states:
      // SLEEP -> WAKE -> SAMPLE -> BROADCAST -> SLEEP
      if (node.rtcCounter >= node.rtcInterval) {
        // Time to wake and broadcast
        node.state = 'WAKE';
        node.currentDrawMa = 42.0;

        setTimeout(() => {
          node.state = 'SAMPLE';
          node.currentDrawMa = 68.5;
          this._simulateSensors(node);

          setTimeout(() => {
            node.state = 'BROADCAST';
            node.currentDrawMa = 84.0;
            this._broadcastBlePacket(node);

            setTimeout(() => {
              node.state = 'SLEEP';
              node.currentDrawMa = node.id === 'sensor_node_03' ? 0.008 : 0.010;
              node.rtcCounter = 0;
            }, 300 / this.speedMultiplier);
          }, 250 / this.speedMultiplier);
        }, 150 / this.speedMultiplier);
      }
    });
  }

  _simulateSensors(node) {
    if (node.anomalyActive) {
      // Keep anomaly high with slight jitter
      node.temp += (Math.random() * 0.4 - 0.2);
      node.humidity += (Math.random() * 0.6 - 0.3);
    } else {
      // Natural thermal & environmental drift
      const deltaT = (Math.random() * 0.16 - 0.08);
      node.temp = +(node.temp + deltaT).toFixed(2);
      // Bound temperatures realistically
      if (node.id === 'sensor_node_01' && (node.temp < 20 || node.temp > 28)) node.temp = 24.2;
      if (node.id === 'sensor_node_02' && (node.temp < 18 || node.temp > 25)) node.temp = 22.5;
      if (node.id === 'sensor_node_03' && (node.temp < 22 || node.temp > 31)) node.temp = 26.5;

      // Humidity
      node.humidity = +(node.humidity + (Math.random() * 0.4 - 0.2)).toFixed(1);
      // Pressure
      node.pressure = +(node.pressure + (Math.random() * 0.1 - 0.05)).toFixed(1);
      // Vibration
      node.vibration = +(0.02 + Math.random() * 0.04).toFixed(3);
    }

    // Battery slow discharge
    node.battery = +(Math.max(10, node.battery - 0.001)).toFixed(3);
    node.batteryVolts = +(3.3 + (node.battery / 100) * 0.9).toFixed(2);
    node.lastSeen = Date.now();
  }

  _broadcastBlePacket(node) {
    // Generate BLE Frame
    const rawAdvPayload = {
      adv_flags: '0x06',
      service_uuid: '0x181A', // Environmental Sensing
      device_mac: node.id === 'sensor_node_01' ? 'C4:4F:33:18:A2:9B' : node.id === 'sensor_node_02' ? 'B8:27:EB:4F:91:0C' : 'F2:20:AF:71:39:4D',
      data: {
        id: node.id,
        temp_c: node.temp,
        hum_pct: node.humidity,
        press_hpa: node.pressure,
        vibe_g: node.vibration,
        batt_pct: Math.floor(node.battery)
      },
      rssi_dbm: node.rssi + Math.floor(Math.random() * 5 - 2),
      timestamp: Math.floor(Date.now() / 1000)
    };

    this.emit('pipelineStage', { stage: 'BLE_BROADCAST', data: rawAdvPayload });

    // Edge Gateway (Raspberry Pi 4) ingests frame via bleak
    this._gatewayBleIngest(rawAdvPayload);
  }

  _gatewayBleIngest(blePacket) {
    // Edge protocol translation: raw BLE bytes -> Structured MQTT JSON
    const mqttPayload = {
      device_id: blePacket.data.id,
      temp: blePacket.data.temp_c,
      humidity: blePacket.data.hum_pct,
      pressure: blePacket.data.press_hpa,
      vibration: blePacket.data.vibe_g,
      battery: blePacket.data.batt_pct,
      rssi: blePacket.rssi_dbm,
      timestamp: blePacket.timestamp
    };

    const topic = `tech300/telemetry/${mqttPayload.device_id}`;

    this.emit('pipelineStage', { 
      stage: 'GATEWAY_TRANSLATION', 
      inputBle: blePacket, 
      outputMqtt: { topic, payload: mqttPayload } 
    });

    if (!this.gatewayWanConnected) {
      // Store in local buffer (local survivability)
      this.localBuffer.push({ topic, payload: mqttPayload });
      this.emit('pipelineStage', { stage: 'GATEWAY_CACHED', count: this.localBuffer.length });
      return;
    }

    // Publish to AWS IoT Core over mTLS (Port 8883)
    this._processAwsCoreIngest({ topic, payload: mqttPayload });
  }

  _processAwsCoreIngest({ topic, payload }) {
    this.totalPacketsIngested++;

    // 1. IoT Rules Engine Evaluation:
    // SELECT device_id, temp, humidity, timestamp FROM 'tech300/telemetry/+' WHERE temp > 0
    const ruleMatch = payload.temp > 0;
    
    // 2. Alert condition: temp > 30.0°C triggers AWS Lambda
    const isAlert = payload.temp > 30.0;
    if (isAlert) {
      const alertItem = {
        id: 'alert_' + Date.now(),
        device_id: payload.device_id,
        temp: payload.temp,
        threshold: 30.0,
        timestamp: payload.timestamp,
        message: `CRITICAL: High temperature detected on ${payload.device_id} (${payload.temp}°C > 30.0°C). Lambda triggered push alert!`
      };
      this.lambdaAlertLogs.unshift(alertItem);
      if (this.lambdaAlertLogs.length > 30) this.lambdaAlertLogs.pop();
      this.emit('alert', alertItem);
    }

    // 3. DynamoDB persistence
    const dynamoRecord = {
      device_id: payload.device_id,
      timestamp: payload.timestamp,
      temp: payload.temp,
      humidity: payload.humidity,
      pressure: payload.pressure,
      vibration: payload.vibration,
      battery: payload.battery,
      rssi: payload.rssi,
      topic: topic
    };

    this.dynamoDbRecords.unshift(dynamoRecord);
    if (this.dynamoDbRecords.length > this.maxDynamoDbRecords) {
      this.dynamoDbRecords.pop();
    }

    // 4. Broadcast live telemetry to Presentation Layer
    this.emit('telemetry', dynamoRecord);
    this.emit('pipelineStage', { 
      stage: 'AWS_PERSISTED', 
      dynamoRecord, 
      ruleMatch, 
      isAlert 
    });
  }

  getRecentTelemetry(nodeId = null, limit = 50) {
    if (!nodeId) return this.dynamoDbRecords.slice(0, limit);
    return this.dynamoDbRecords.filter(r => r.device_id === nodeId).slice(0, limit);
  }
}

// Attach to window
window.IoTSimulationEngine = IoTSimulationEngine;
