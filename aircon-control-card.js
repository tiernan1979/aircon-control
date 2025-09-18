class AirconControlCard extends HTMLElement {
  constructor() {
    super();
    this._localTemp = null;
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('You need to define an entity');
    }
    this.config = config;
  }

  set hass(hass) {
    this._hass = hass;
    const climate = hass.states[this.config.entity];

    if (!climate) {
      this.innerHTML = `<hui-warning>${this.config.entity} not available</hui-warning>`;
      return;
    }

    // Main climate info
    const minTemp = climate.attributes.min_temp || 16;
    const maxTemp = climate.attributes.max_temp || 30;

    const haTemp = climate.attributes.temperature || climate.attributes.current_temperature || minTemp;
    const displayTemp = this._localTemp !== null ? this._localTemp : haTemp;
    if (this._localTemp !== null && Math.abs(this._localTemp - haTemp) < 0.1) this._localTemp = null;

    // HVAC mode buttons
    const modes = ['cool', 'heat', 'fan_only', 'dry', 'auto'];
    const currentMode = climate.attributes.hvac_mode || climate.attributes.operation_mode || climate.state;

    let modeButtons = '<div class="modes">';
    modes.forEach(mode => {
      const selected = currentMode === mode ? 'mode-selected' : '';
      modeButtons += `<button class="mode-btn ${selected}" data-mode="${mode}">${mode}</button>`;
    });
    modeButtons += '</div>';

    // Helper to get sensor state safely
    const getSensorState = id => hass.states[id]?.state ?? 'N/A';

    // Get sensors values or fallback to N/A
    const solar = this.config.solar_sensor ? getSensorState(this.config.solar_sensor) : 'N/A';
    const houseTemp = this.config.house_temp_sensor ? getSensorState(this.config.house_temp_sensor) : 'N/A';
    const outsideTemp = this.config.outside_temp_sensor ? getSensorState(this.config.outside_temp_sensor) : 'N/A';
    const houseHum = this.config.house_humidity_sensor ? getSensorState(this.config.house_humidity_sensor) : 'N/A';
    const outsideHum = this.config.outside_humidity_sensor ? getSensorState(this.config.outside_humidity_sensor) : 'N/A';

    // Slider value and entity for room temp control
    const sliderEntityId = this.config.slider_entity;
    const sliderEntity = sliderEntityId ? hass.states[sliderEntityId] : null;
    const sliderValue = sliderEntity ? parseFloat(sliderEntity.state) : null;
    const sliderMin = sliderEntity?.attributes?.min ?? 16;
    const sliderMax = sliderEntity?.attributes?.max ?? 30;

    // Build HTML
    this.innerHTML = `
      <style>
        /* Styles simplified and consistent */

        :host {
          font-family: 'Roboto', sans-serif;
          color: white;
          background: #263238;
          border-radius: 15px;
          padding: 16px;
          display: block;
          max-width: 320px;
          box-sizing: border-box;
        }
        .power {
          text-align: center;
          margin-bottom: 12px;
        }
        button {
          cursor: pointer;
          border: none;
          outline: none;
          transition: background-color 0.3s ease;
          user-select: none;
        }
        #power {
          background-color: #16a085;
          color: white;
          font-weight: bold;
          padding: 10px 28px;
          border-radius: 25px;
          font-size: 20px;
          box-shadow: 0 4px 6px rgba(22, 160, 133, 0.4);
          width: 100%;
          max-width: 200px;
        }
        #power:hover {
          background-color: #1abc9c;
        }
        .temp {
          width: 120px;
          height: 120px;
          line-height: 120px;
          margin: 0 auto 16px auto;
          border-radius: 50%;
          background-color: #16a085;
          font-size: 56px;
          font-weight: bold;
          text-align: center;
          color: white;
          box-shadow: 0 0 15px #16a085;
          user-select: none;
        }
        .controls {
          display: flex;
          justify-content: center;
          margin-bottom: 16px;
        }
        .controls button {
          width: 60px;
          height: 60px;
          font-size: 36px;
          font-weight: bold;
          border-radius: 50%;
          background-color: #34495e;
          color: white;
          margin: 0 15px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
          transition: background-color 0.3s ease;
        }
        .controls button:hover:not(:disabled) {
          background-color: #2ecc71;
          box-shadow: 0 6px 12px rgba(46, 204, 113, 0.6);
        }
        .controls button:disabled {
          background-color: #7f8c8d;
          cursor: not-allowed;
          box-shadow: none;
        }
        .modes {
          text-align: center;
          margin-bottom: 20px;
        }
        .modes button {
          margin: 0 8px;
          padding: 8px 18px;
          border-radius: 20px;
          background-color: #34495e;
          color: white;
          font-weight: 600;
          font-size: 16px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          user-select: none;
          transition: background-color 0.3s ease;
        }
        .modes button:hover {
          background-color: #2ecc71;
        }
        .mode-selected {
          background-color: #1abc9c !important;
          font-weight: 700;
          box-shadow: 0 4px 10px rgba(26, 188, 156, 0.7);
          text-decoration: underline;
        }
        .slider-container {
          margin: 16px auto;
          width: 80%;
          text-align: center;
        }
        .slider-container input[type="range"] {
          width: 100%;
          cursor: pointer;
        }
        .slider-label {
          margin-top: 8px;
          font-size: 14px;
          color: #ddd;
        }
        .info-line {
          font-size: 14px;
          color: #ccc;
          text-align: center;
          margin-top: 12px;
          user-select: none;
        }
        .info-line span {
          margin: 0 8px;
          font-weight: 600;
        }
      </style>

      <div class="power">
        <button id="power">${climate.state === 'off' ? 'Turn On' : 'Turn Off'}</button>
      </div>

      <div class="temp">${displayTemp.toFixed(1)}°C</div>

      ${modeButtons}

      <div class="controls">
        <button id="dec" ${displayTemp <= minTemp ? 'disabled' : ''}>-</button>
        <button id="inc" ${displayTemp >= maxTemp ? 'disabled' : ''}>+</button>
      </div>

      ${sliderEntity ? `
      <div class="slider-container">
        <input type="range" min="${sliderMin}" max="${sliderMax}" step="0.5" value="${sliderValue}">
        <div class="slider-label">Room Temp: ${sliderValue.toFixed(1)}°C</div>
      </div>
      ` : ''}

      <div class="info-line">
        <span>Solar: ${solar}</span>|
        <span>Temp: ${houseTemp}°C / ${outsideTemp}°C</span>|
        <span>Humidity: ${houseHum}% / ${outsideHum}%</span>
      </div>
    `;

    // Power toggle
    this.querySelector('#power').addEventListener('click', () => {
      const service = climate.state === 'off' ? 'turn_on' : 'turn_off';
      this._hass.callService('climate', service, { entity_id: this.config.entity });
    });

    // Mode buttons
    this.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const mode = e.target.getAttribute('data-mode');
        this._hass.callService('climate', 'set_hvac_mode', {
          entity_id: this.config.entity,
          hvac_mode: mode,
        });
      });
    });

    // Temperature increment/decrement
    this.querySelector('#inc').addEventListener('click', () => {
      this._changeTemp(0.5, minTemp, maxTemp);
    });
    this.querySelector('#dec').addEventListener('click', () => {
      this._changeTemp(-0.5, minTemp, maxTemp);
    });

    // Slider control listener
    if (sliderEntity) {
      const slider = this.querySelector('.slider-container input[type="range"]');
      const label = this.querySelector('.slider-label');

      slider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        label.textContent = `Room Temp: ${val.toFixed(1)}°C`;
      });

      slider.addEventListener('change', (e) => {
        const val = parseFloat(e.target.value);
        this._hass.callService('input_number', 'set_value', {
          entity_id: sliderEntityId,
          value: val,
        });
      });
    }
  }

  _changeTemp(delta, min, max) {
    const climate = this._hass.states[this.config.entity];
    let currentTemp = climate.attributes.temperature || climate.attributes.current_temperature || min;
    let newTemp = currentTemp + delta;
    if (newTemp < min) newTemp = min;
    if (newTemp > max) newTemp = max;

    this._localTemp = newTemp;

    this._hass.callService('climate', 'set_temperature', {
      entity_id: this.config.entity,
      temperature: newTemp,
    });
  }

  getCardSize() {
    return 4;
  }
}

customElements.define('aircon-control-card', AirconControlCard);
