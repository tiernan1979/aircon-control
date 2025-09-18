/* aircon-control-card.js */

import { LitElement, html, css } from 'lit';
import { classMap } from 'lit/directives/class-map.js';

class AirconControlCard extends LitElement {
  static get properties() {
    return {
      hass: Object,
      config: Object,
      _powerOn: { type: Boolean, state: true },
      _currentMode: { type: String, state: true },
      _currentTemperature: { type: Number, state: true },
      _temperatureStep: { type: Number, state: true },
      _tempChart: { type: Object },
      _humidityChart: { type: Object },
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
        --primary-color: #16a085;
        --background-color: #2c3e50;
        --button-bg: #34495e;
        --button-hover-bg: #1abc9c;
        --onoff-bg: #e74c3c;
        --cool-bg: #3498db;
        --heat-bg: #e67e22;
        --fan-bg: #f39c12;
        --dry-bg: #95a5a6;
        font-family: Arial, sans-serif;
        color: white;
      }

      .aircon-card {
        background-color: var(--background-color);
        border-radius: 15px;
        padding: 20px;
        max-width: 400px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .controls {
        display: flex;
        justify-content: space-around;
        width: 100%;
        margin-bottom: 20px;
      }

      button.control-btn {
        border: none;
        border-radius: 50%;
        color: white;
        padding: 15px;
        font-size: 20px;
        cursor: pointer;
        background-color: var(--button-bg);
        transition: background-color 0.3s;
        width: 50px;
        height: 50px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      button.control-btn:hover {
        background-color: var(--button-hover-bg);
      }

      button.on-off {
        background-color: var(--onoff-bg);
      }
      button.cool {
        background-color: var(--cool-bg);
      }
      button.heat {
        background-color: var(--heat-bg);
      }
      button.fan {
        background-color: var(--fan-bg);
      }
      button.dry {
        background-color: var(--dry-bg);
      }

      .temp-display {
        text-align: center;
        margin-bottom: 30px;
        user-select: none;
      }

      .temp-circle {
        background-color: var(--primary-color);
        border-radius: 50%;
        padding: 40px;
        width: 120px;
        height: 120px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 20px auto;
        box-shadow: 0 0 10px var(--primary-color);
      }

      .temp-circle h2 {
        font-size: 48px;
        margin: 0;
        font-weight: bold;
      }

      .temp-control {
        display: flex;
        justify-content: center;
        gap: 20px;
      }

      button.temp-btn {
        background-color: var(--primary-color);
        border: none;
        color: white;
        font-size: 30px;
        font-weight: bold;
        cursor: pointer;
        border-radius: 6px;
        width: 50px;
        height: 50px;
        user-select: none;
        transition: background-color 0.3s;
      }

      button.temp-btn:hover {
        background-color: #138170;
      }

      .sensor-graphs {
        width: 100%;
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
    `;
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('You need to define an entity');
    }
    this.config = config;
    this._temperatureStep = config.temperature_step || 1;
  }

  get _climate() {
    return this.hass.states[this.config.entity];
  }

  // Update states from HA climate entity
  updated(changedProps) {
    if (!this.hass || !this.config) return;

    const climate = this._climate;
    if (!climate) return;

    const prevPowerOn = this._powerOn;
    const prevMode = this._currentMode;
    const prevTemp = this._currentTemperature;

    this._powerOn = climate.state === 'heat' || climate.state === 'cool' || climate.state === 'fan_only' || climate.state === 'dry' || climate.state === 'auto';
    this._currentMode = climate.attributes.operation_mode || climate.state;
    this._currentTemperature = climate.attributes.temperature || climate.attributes.current_temperature || 24;

    if (
      changedProps.has('hass') &&
      (prevPowerOn !== this._powerOn || prevMode !== this._currentMode || prevTemp !== this._currentTemperature)
    ) {
      this._updateCharts();
    }
  }

  firstUpdated() {
    // Chart.js init

    const tempCtx = this.shadowRoot.getElementById('temperatureGraph').getContext('2d');
    const humidityCtx = this.shadowRoot.getElementById('humidityGraph').getContext('2d');

    // Initial empty datasets, will update on data update
    this._tempChart = new Chart(tempCtx, {
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

    this._humidityChart = new Chart(humidityCtx, {
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

    this._updateCharts();
  }

  _updateCharts() {
    // Example: Simulated data or from sensors if defined in config.sensors

    // Pull sensor data if configured
    const tempSensorId = this.config.temp_sensor || null;
    const humiditySensorId = this.config.humidity_sensor || null;

    let tempData = [];
    let tempLabels = [];
    let humidityData = [];
    let humidityLabels = [];

    if (tempSensorId && this.hass.states[tempSensorId]) {
      // Ideally, you would use a history API or persistent data for charts.
      // For demo, we just push current value multiple times.
      const tempValue = parseFloat(this.hass.states[tempSensorId].state);
      tempData = [tempValue - 1, tempValue, tempValue + 1, tempValue, tempValue - 0.5];
      tempLabels = ['-4h', '-3h', '-2h', '-1h', 'Now'];
    } else {
      // fallback dummy data
      tempData = [22, 23, 24, 23, 22];
      tempLabels = ['10am', '12pm', '2pm', '4pm', '6pm'];
    }

    if (humiditySensorId && this.hass.states[humiditySensorId]) {
      const humidityValue = parseFloat(this.hass.states[humiditySensorId].state);
      humidityData = [humidityValue - 5, humidityValue - 2, humidityValue, humidityValue - 1, humidityValue];
      humidityLabels = ['-4h', '-3h', '-2h', '-1h', 'Now'];
    } else {
      humidityData = [60, 62, 64, 63, 60];
      humidityLabels = ['10am', '12pm', '2pm', '4pm', '6pm'];
    }

    if (this._tempChart && this._humidityChart) {
      this._tempChart.data.labels = tempLabels;
      this._tempChart.data.datasets[0].data = tempData;
      this._tempChart.update();

      this._humidityChart.data.labels = humidityLabels;
      this._humidityChart.data.datasets[0].data = humidityData;
      this._humidityChart.update();
    }
  }

  _togglePower() {
    const service = this._powerOn ? 'turn_off' : 'turn_on';
    this.hass.callService('climate', service, {
      entity_id: this.config.entity,
    });
  }

  _setMode(mode) {
    this.hass.callService('climate', 'set_hvac_mode', {
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
    this.hass.callService('climate', 'set_temperature', {
      entity_id: this.config.entity,
      temperature: temp,
    });
  }

  render() {
    const powerBtnClass = {
      'control-btn': true,
      'on-off': true,
    };

    const modeButtons = [
      { mode: 'cool', icon: '❄️', className: 'cool' },
      { mode: 'heat', icon: '🔥', className: 'heat' },
      { mode: 'fan_only', icon: '💨', className: 'fan' },
      { mode: 'dry', icon: '💧', className: 'dry' },
    ];

    return html`
      <div class="aircon-card">
        <div class="controls">
          <button
            class=${classMap(powerBtnClass)}
            @click=${this._togglePower}
            title="Toggle Power"
          >
            ${this._powerOn ? '⏻' : '⭘'}
          </button>

          ${modeButtons.map(
            (btn) => html`
              <button
                class="control-btn ${btn.className}"
                @click=${() => this._setMode(btn.mode)}
                title="Set mode ${btn.mode}"
                ?disabled=${!this._powerOn}
                style=${this._currentMode === btn.mode ? 'box-shadow: 0 0 10px var(--primary-color);' : ''}
              >
                ${btn.icon}
              </button>
            `
          )}
        </div>

        <div class="temp-display">
          <div class="temp-circle">
            <h2>${this._currentTemperature ?? '--'}°C</h2>
          </div>
          <div class="temp-control">
            <button class="temp-btn" @click=${this._decreaseTemp} ?disabled=${!this._powerOn}>-</button>
            <button class="temp-btn" @click=${this._increaseTemp} ?disabled=${!this._powerOn}>+</button>
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
      </div>
    `;
  }
}

customElements.define('aircon-control-card', AirconControlCard);
