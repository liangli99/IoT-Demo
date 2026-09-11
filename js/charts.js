/**
 * TECH 300 IoT Demo - Canvas-based Real-time Streaming Charts
 * Provides ultra-smooth 60fps telemetry graphs with threshold zones,
 * neon glowing lines, and gradient fills.
 */

class TelemetryChart {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    
    this.options = {
      title: options.title || 'Telemetry',
      unit: options.unit || '',
      color: options.color || '#00e5ff',
      glowColor: options.glowColor || 'rgba(0, 229, 255, 0.35)',
      fillColor: options.fillColor || 'rgba(0, 229, 255, 0.08)',
      threshold: options.threshold !== undefined ? options.threshold : null,
      thresholdColor: options.thresholdColor || '#f43f5e',
      minVal: options.minVal !== undefined ? options.minVal : null,
      maxVal: options.maxVal !== undefined ? options.maxVal : null,
      maxPoints: options.maxPoints || 30
    };

    this.dataPoints = [];
    this._initCanvas();
    window.addEventListener('resize', () => this._handleResize());
  }

  _initCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width || 400;
    this.height = rect.height || 220;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.draw();
  }

  _handleResize() {
    this._initCanvas();
  }

  addDataPoint(val, timestamp = Date.now()) {
    this.dataPoints.push({ val, timestamp });
    if (this.dataPoints.length > this.options.maxPoints) {
      this.dataPoints.shift();
    }
    this.draw();
  }

  setData(points) {
    this.dataPoints = points.slice(-this.options.maxPoints);
    this.draw();
  }

  clear() {
    this.dataPoints = [];
    this.draw();
  }

  draw() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    // Padding
    const padL = 45;
    const padR = 20;
    const padT = 20;
    const padB = 30;
    const chartW = w - padL - padR;
    const chartH = h - padT - padB;

    if (this.dataPoints.length < 2) {
      // Empty state
      ctx.fillStyle = '#64748b';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Awaiting incoming telemetry stream...', w / 2, h / 2);
      return;
    }

    // Determine min and max Y
    const vals = this.dataPoints.map(d => d.val);
    let min = this.options.minVal !== null ? this.options.minVal : Math.min(...vals);
    let max = this.options.maxVal !== null ? this.options.maxVal : Math.max(...vals);

    if (this.options.threshold !== null) {
      max = Math.max(max, this.options.threshold + 2);
    }
    if (min === max) {
      min -= 1;
      max += 1;
    } else {
      const padding = (max - min) * 0.15;
      min -= padding;
      max += padding;
    }

    // Grid lines (Horizontal)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';

    const numTicks = 4;
    for (let i = 0; i <= numTicks; i++) {
      const yVal = min + (max - min) * (i / numTicks);
      const yPos = padT + chartH - (i / numTicks) * chartH;
      ctx.beginPath();
      ctx.moveTo(padL, yPos);
      ctx.lineTo(w - padR, yPos);
      ctx.stroke();
      ctx.fillText(yVal.toFixed(1) + this.options.unit, padL - 8, yPos + 3);
    }

    // Alert threshold line if configured
    if (this.options.threshold !== null && this.options.threshold >= min && this.options.threshold <= max) {
      const threshY = padT + chartH - ((this.options.threshold - min) / (max - min)) * chartH;
      ctx.save();
      ctx.strokeStyle = this.options.thresholdColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padL, threshY);
      ctx.lineTo(w - padR, threshY);
      ctx.stroke();

      ctx.fillStyle = this.options.thresholdColor;
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`ALERT THRESHOLD (${this.options.threshold}${this.options.unit})`, padL + 6, threshY - 4);
      ctx.restore();
    }

    // Coordinates mapping
    const getX = (idx) => padL + (idx / (this.options.maxPoints - 1)) * chartW;
    const getY = (val) => padT + chartH - ((val - min) / (max - min)) * chartH;

    const len = this.dataPoints.length;
    const offset = this.options.maxPoints - len;

    // Draw Gradient Area Fill
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(getX(offset), padT + chartH);

    for (let i = 0; i < len; i++) {
      const x = getX(i + offset);
      const y = getY(this.dataPoints[i].val);
      if (i === 0) {
        ctx.lineTo(x, y);
      } else {
        const prevX = getX(i - 1 + offset);
        const prevY = getY(this.dataPoints[i - 1].val);
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    }

    const lastX = getX(len - 1 + offset);
    ctx.lineTo(lastX, padT + chartH);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, padT, 0, padT + chartH);
    gradient.addColorStop(0, this.options.fillColor);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();

    // Draw Main Curve with Glow
    ctx.save();
    ctx.strokeStyle = this.options.color;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = this.options.glowColor;
    ctx.shadowBlur = 8;
    ctx.beginPath();

    for (let i = 0; i < len; i++) {
      const x = getX(i + offset);
      const y = getY(this.dataPoints[i].val);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevX = getX(i - 1 + offset);
        const prevY = getY(this.dataPoints[i - 1].val);
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    }
    ctx.stroke();
    ctx.restore();

    // Draw pulsing head marker on latest point
    if (len > 0) {
      const latestVal = this.dataPoints[len - 1].val;
      const hx = getX(len - 1 + offset);
      const hy = getY(latestVal);

      ctx.save();
      ctx.fillStyle = this.options.color;
      ctx.shadowColor = this.options.glowColor;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(hx, hy, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(hx, hy, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

// Chart Manager to orchestrate all 4 telemetry charts
class TelemetryChartsManager {
  constructor() {
    this.charts = {};
  }

  init() {
    this.charts.temp = new TelemetryChart('chart-temp', {
      title: 'Temperature',
      unit: '°C',
      color: '#f43f5e',
      glowColor: 'rgba(244, 63, 94, 0.4)',
      fillColor: 'rgba(244, 63, 94, 0.12)',
      threshold: 30.0,
      thresholdColor: '#ff2a5f',
      minVal: 15,
      maxVal: 38
    });

    this.charts.humidity = new TelemetryChart('chart-humidity', {
      title: 'Relative Humidity',
      unit: '%',
      color: '#00e5ff',
      glowColor: 'rgba(0, 229, 255, 0.4)',
      fillColor: 'rgba(0, 229, 255, 0.12)',
      minVal: 20,
      maxVal: 90
    });

    this.charts.pressure = new TelemetryChart('chart-pressure', {
      title: 'Barometric Pressure',
      unit: ' hPa',
      color: '#a855f7',
      glowColor: 'rgba(168, 85, 247, 0.4)',
      fillColor: 'rgba(168, 85, 247, 0.12)',
      minVal: 1005,
      maxVal: 1025
    });

    this.charts.vibration = new TelemetryChart('chart-vibration', {
      title: '6-Axis Vibration / Motion',
      unit: ' g',
      color: '#10b981',
      glowColor: 'rgba(168, 85, 247, 0.4)',
      fillColor: 'rgba(16, 185, 129, 0.12)',
      minVal: 0,
      maxVal: 0.6
    });
  }

  pushReading(record) {
    if (this.charts.temp) this.charts.temp.addDataPoint(record.temp, record.timestamp);
    if (this.charts.humidity) this.charts.humidity.addDataPoint(record.humidity, record.timestamp);
    if (this.charts.pressure) this.charts.pressure.addDataPoint(record.pressure, record.timestamp);
    if (this.charts.vibration) this.charts.vibration.addDataPoint(record.vibration, record.timestamp);
  }

  loadHistory(historyRecords) {
    if (!historyRecords || historyRecords.length === 0) return;
    const sorted = [...historyRecords].sort((a, b) => a.timestamp - b.timestamp);

    if (this.charts.temp) {
      this.charts.temp.setData(sorted.map(r => ({ val: r.temp, timestamp: r.timestamp })));
    }
    if (this.charts.humidity) {
      this.charts.humidity.setData(sorted.map(r => ({ val: r.humidity, timestamp: r.timestamp })));
    }
    if (this.charts.pressure) {
      this.charts.pressure.setData(sorted.map(r => ({ val: r.pressure, timestamp: r.timestamp })));
    }
    if (this.charts.vibration) {
      this.charts.vibration.setData(sorted.map(r => ({ val: r.vibration, timestamp: r.timestamp })));
    }
  }
}

window.TelemetryChartsManager = TelemetryChartsManager;
