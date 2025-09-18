class AirconControlCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._powerOn = false;
    this._currentMode = '';
    this._currentTemperature = 24;
    this._temperatureStep = 1;
    this._tempChart = null;
    this._humidityChart = null;
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('You need to define an entity');
    }
    this.config = config;
    this._temperatureStep = config.temperature_step || 1;
  }

  connectedCallback() {
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    const climate = hass.states && hass.states[this.config.entity];
    if (!climate) {
      this.shadowRoot.innerHTML = `<div>Entity not found: ${this.config.entity}</div>`;
      return;
    }
    // Update states
    this._powerOn = ['heat', 'cool', 'fan_only', 'dry', 'auto'].includes(climate.state);
    this._currentMode = climate.attributes && (climate.attributes.operation_mode || climate.state);
    this._currentTemperature = climate.attributes && (climate.attributes.temperature || climate.attributes.current_temperature || 24);

    // Render or update UI
    this.render();
    this._updateCharts();
  }

  _togglePower() {
    const service = this._powerOn ? 'turn_off' : 'turn_on';
    this._hass.callService('climate', service, {
      entity_id: this.config.entity,
    });
  }

  _setMode(mode) {
    this._hass.callService('climate', 'set_hvac_mode', {
      entity_id: this.config.entity,
      hvac_mode: mode,
    });
  }

  _increaseTemp() {
    if (!this._currentTemperature) return;
    const newTemp = this._currentTemperature + this._temperatureStep;
    this._setTemperature(newTemp);
  }

  _decreaseTemp() {
    if (!this._currentTemperature) return;
    const newTemp = this._currentTemperature - this._temperatureStep;
    this._setTemperature(newTemp);
  }

  _setTemperature(temp) {
    this._hass.callService('climate', 'set_temperature', {
      entity_id: this.config.entity,
      temperature: temp,
    });
  }

  _updateCharts() {
    // Only update if charts exist
    if (!this._tempChart || !this._humidityChart) return;

    // Get sensor data from config if present
    const tempSensorId = this.config.temp_sensor;
    const humiditySensorId = this.config.humidity_sensor;

    let tempData = [];
    let tempLabels = [];
    let humidityData = [];
    let humidityLabels = [];

    if (tempSensorId && this._hass.states[tempSensorId]) {
      const val = parseFloat(this._hass.states[tempSensorId].state);
      tempData = [val - 1, val, val + 1, val, val - 0.5];
      tempLabels = ['-4h', '-3h', '-2h', '-1h', 'Now'];
    } else {
      tempData = [22, 23, 24, 23, 22];
      tempLabels = ['10am', '12pm', '2pm', '4pm', '6pm'];
    }

    if (humiditySensorId && this._hass.states[humiditySensorId]) {
      const val = parseFloat(this._hass.states[humiditySensorId].state);
      humidityData = [val - 5, val - 2, val, val - 1, val];
      humidityLabels = ['-4h', '-3h', '-2h', '-1h', 'Now'];
    } else {
      humidityData = [60, 62, 64, 63, 60];
      humidityLabels = ['10am', '12pm', '2pm', '4pm', '6pm'];
    }

    this._tempChart.data.labels = tempLabels;
    this._tempChart.data.datasets[0].data = tempData;
    this._tempChart.update();

    this._humidityChart.data.labels = humidityLabels;
    this._humidityChart.data.datasets[0].data = humidityData;
    this._humidityChart.update();
  }

  render() {
    if (!this.shadowRoot) return;

    const powerBtnStyle = `
      background-color: ${this._powerOn ? '#e74c3c' : '#34495e'};
      border-radius: 50%;
      color: white;
      width: 50px;
      height: 50px;
      font-size: 20px;
      border: none;
      cursor: pointer;
    `;

    const modeBtnStyles = {
      cool: 'background-color: #3498db;',
      heat: 'background-color: #e67e22;',
      fan_only: 'background-color: #f39c12;',
      dry: 'background-color: #95a5a6;',
    };

    const isDisabled = !this._powerOn;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: Arial, sans-serif;
          color: white;
          background: #2c3e50;
          border-radius: 15px;
          padding: 20px;
          max-width: 400px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }
        .controls {
          display: flex;
          justify-content: space-around;
          margin-bottom: 20px;
        }
        button.control-btn {
          border-radius: 50%;
          color: white;
          width: 50px;
          height: 50px;
          font-size: 20px;
          border: none;
          cursor: pointer;
          transition: box-shadow 0.3s ease;
          outline: none;
        }
        button.control-btn:hover:not(:disabled) {
          filter: brightness(1.2);
        }
        button.control-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        button.selected {
          box-shadow: 0 0 10px #16a085;
        }
        .temp-display {
          text-align: center;
          margin-bottom: 30px;
          user-select: none;
        }
        .temp-circle {
          background-color: #16a085;
          border-radius: 50%;
          width: 120px;
          height: 120px;
          display: flex;
          justify-content: center;
          align-items: center;
          margin: 0 auto 20px auto;
          box-shadow: 0 0 10px #16a085;
          font-weight: bold;
          font-size: 48px;
        }
        .temp-control {
          display: flex;
          justify-content: center;
          gap: 20px;
        }
        button.temp-btn {
          background-color: #16a085;
          border: none;
          color: white;
          font-size: 30px;
          width: 50px;
          height: 50px;
          border-radius: 6px;
          cursor: pointer;
          user-select: none;
        }
        button.temp-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        button.temp-btn:hover:not(:disabled) {
          background-color: #138170;
        }
        .sensor-graphs {
          display: flex;
          justify-content: space-around;
          gap: 20px;
        }
        .graph-container {
          width: 45%;
        }
        .graph-header {
          font-size: 14px;
          text-align: center;
          margin-bottom: 8px;
          color: #ddd;
          user-select: none;
        }
        canvas {
          width: 100% !important;
          height: 150px !important;
        }
      </style>
      <div class="controls">
        <button
          class="control-btn"
          style="${powerBtnStyle}"
          title="Toggle Power"
          id="powerBtn"
        >${this._powerOn ? '⏻' : '⭘'}</button>

        <button
          class="control-btn ${this._currentMode === 'cool' ? 'selected' : ''}"
          style="${modeBtnStyles.cool}"
          title="Cool Mode"
          id="coolBtn"
          ${isDisabled ? 'disabled' : ''}
        >❄️</button>

        <button
          class="control-btn ${this._currentMode === 'heat' ? 'selected' : ''}"
          style="${modeBtnStyles.heat}"
          title="Heat Mode"
          id="heatBtn"
          ${isDisabled ? 'disabled' : ''}
        >🔥</button>

        <button
          class="control-btn ${this._currentMode === 'fan_only' ? 'selected' : ''}"
          style="${modeBtnStyles.fan_only}"
          title="Fan Mode"
          id="fanBtn"
          ${isDisabled ? 'disabled' : ''}
        >💨</button>

        <button
          class="control-btn ${this._currentMode === 'dry' ? 'selected' : ''}"
          style="${modeBtnStyles.dry}"
          title="Dry Mode"
          id="dryBtn"
          ${isDisabled ? 'disabled' : ''}
        >💧</button>
      </div>

      <div class="temp-display">
        <div class="temp-circle">${this._currentTemperature}°C</div>
        <div class="temp-control">
          <button class="temp-btn" id="tempDownBtn" ${isDisabled ? 'disabled' : ''}>-</button>
          <button class="temp-btn" id="tempUpBtn" ${isDisabled ? 'disabled' : ''}>+</button>
        </div>
      </div>

      <div class="sensor-graphs">
        <div class="graph-container">
          <div class="graph-header">Temperature</div>
          <canvas id="temperatureGraph"></canvas>
        </div>
        <div class="graph-container">
          <div class="graph-header">Humidity</div>
          <canvas id="humidityGraph"></canvas>
        </div>
      </div>
    `;

    // Add event listeners
    this.shadowRoot.getElementById('powerBtn').onclick = () => this._togglePower();
    this.shadowRoot.getElementById('coolBtn').onclick = () => this._setMode('cool');
    this.shadowRoot.getElementById('heatBtn').onclick = () => this._setMode('heat');
    this.shadowRoot.getElementById('fanBtn').onclick = () => this._setMode('fan_only');
    this.shadowRoot.getElementById('dryBtn').onclick = () => this._setMode('dry');
    this.shadowRoot.getElementById('tempUpBtn').onclick = () => this._increaseTemp();
    this.shadowRoot.getElementById('tempDownBtn').onclick = () => this._decreaseTemp();

    // Initialize charts if not created
    if (!this._tempChart) {
      const ctxTemp = this.shadowRoot.getElementById('temperatureGraph').getContext('2d');
      this._tempChart = new Chart(ctxTemp, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'Temperature (°C)',
            data: [],
            borderColor: 'rgba(255, 99, 132, 1)',
            fill: false,
            tension: 0.3,
          }]
        },
        options: {
          responsive: true,
          animation: false,
          scales: {
            x: { display: true },
            y: { min: 0, max: 40 }
          },
          plugins: { legend: { display: false } }
        }
      });
    }

    if (!this._humidityChart) {
      const ctxHum = this.shadowRoot.getElementById('humidityGraph').getContext('2d');
      this._humidityChart = new Chart(ctxHum, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'Humidity (%)',
            data: [],
            borderColor: 'rgba(54, 162, 235, 1)',
            fill: false,
            tension: 0.3,
          }]
        },
        options: {
          responsive: true,
          animation: false,
          scales: {
            x: { display: true },
            y: { min: 0, max: 100 }
          },
          plugins: { legend: { display: false } }
        }
      });
    }
  }
}

customElements.define('aircon-control-card', AirconControlCard);
