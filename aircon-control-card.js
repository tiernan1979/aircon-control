class AirconControlCard extends HTMLElement {
  constructor() {
    super();
    this._localTemp = null;
  }

  setConfig(config) {
    if (!config.entity) throw new Error('You need to define an entity');
    this.config = config;
  }

  set hass(hass) {
    this._hass = hass;
    const config = this.config;
    const climate = hass.states[config.entity];

    if (!climate) {
      this.innerHTML = `<hui-warning>${config.entity} not available</hui-warning>`;
      return;
    }

    const minTemp = climate.attributes.min_temp || 16;
    const maxTemp = climate.attributes.max_temp || 30;
    const currentTemp = climate.attributes.temperature || climate.attributes.current_temperature || minTemp;

    if (this._localTemp !== null && Math.abs(this._localTemp - currentTemp) < 0.1) {
      this._localTemp = null;
    }

    const displayTemp = this._localTemp !== null ? this._localTemp : currentTemp;

    const modes = ['cool', 'heat', 'fan_only', 'dry', 'auto'];
    const currentMode = climate.attributes.hvac_mode || climate.state;

    // Sensors
    const getState = (id) => hass.states[id]?.state ?? 'N/A';
    const solar = config.solar_sensor ? getState(config.solar_sensor) : 'N/A';
    const houseTemp = config.house_temp_sensor ? getState(config.house_temp_sensor) : 'N/A';
    const outsideTemp = config.outside_temp_sensor ? getState(config.outside_temp_sensor) : 'N/A';
    const houseHum = config.house_humidity_sensor ? getState(config.house_humidity_sensor) : 'N/A';
    const outsideHum = config.outside_humidity_sensor ? getState(config.outside_humidity_sensor) : 'N/A';

    // Generate mode buttons
    let modeButtons = '<div class="modes">';
    modes.forEach(mode => {
      const selected = currentMode === mode ? 'mode-selected' : '';
      modeButtons += `<button class="mode-btn ${selected}" data-mode="${mode}">${mode}</button>`;
    });
    modeButtons += '</div>';

    // Generate room sliders
    let roomControls = '';
    if (config.rooms && Array.isArray(config.rooms)) {
      roomControls += '<div class="room-section">';
      config.rooms.forEach(room => {
        const sliderEnt = hass.states[room.slider_entity];
        const sensorEnt = hass.states[room.sensor_entity];

        // Use current_position or position attribute for slider value
        const sliderVal = sliderEnt && (sliderEnt.attributes.current_position !== undefined
          ? parseFloat(sliderEnt.attributes.current_position)
          : sliderEnt.attributes.position !== undefined
            ? parseFloat(sliderEnt.attributes.position)
            : 0);

        // Room temperature value from sensor
        const sensorVal = sensorEnt ? parseFloat(sensorEnt.state) : null;

        const min = 0;
        const max = 100;
        const step = 1;

        let openDisplay = '';
        if (sliderVal === 0) {
          openDisplay = 'Closed';
        } else if (sliderVal === 100) {
          openDisplay = 'Open';
        } else {
          openDisplay = `${sliderVal.toFixed(0)}%`;
        }

        roomControls += `
          <div class="room-slider-wrapper">
            <input type="range"
              class="styled-room-slider"
              data-entity="${room.slider_entity}"
              min="${min}" max="${max}" step="${step}" value="${sliderVal}">
            <div class="slider-labels">
              <span class="label-name">${room.name}</span>
              <span class="label-status">${openDisplay}</span>
              <span class="label-temp">${sensorVal != null ? sensorVal.toFixed(1) : 'N/A'}°C</span>
            </div>
          </div>
        `;
      });
      roomControls += '</div>';
    }

    // Inject HTML
    this.innerHTML = `
      <style>
        :host {
          font-family: 'Roboto', sans-serif;
          background: #263238;
          color: white;
          border-radius: 12px;
          padding: 16px;
          display: block;
          max-width: 360px;
        }
        button {
          cursor: pointer;
          border: none;
          outline: none;
        }
        #power {
          width: 100%;
          background: #16a085;
          color: white;
          padding: 10px;
          border-radius: 20px;
          font-size: 18px;
          margin-bottom: 12px;
        }
        #power:hover {
          background: #1abc9c;
        }
        .temp {
          font-size: 56px;
          font-weight: bold;
          text-align: center;
          margin: 12px auto;
          background: #1abc9c;
          border-radius: 50%;
          width: 120px;
          height: 120px;
          line-height: 120px;
          box-shadow: 0 0 12px #1abc9c;
        }
        .controls {
          display: flex;
          justify-content: center;
          margin: 10px 0;
        }
        .controls button {
          width: 50px;
          height: 50px;
          font-size: 24px;
          background: #34495e;
          color: white;
          border-radius: 50%;
          margin: 0 10px;
        }
        .modes {
          text-align: center;
          margin: 10px 0;
        }
        .modes button {
          margin: 5px;
          padding: 6px 14px;
          border-radius: 16px;
          background: #34495e;
          color: white;
        }
        .mode-selected {
          background: #1abc9c !important;
          font-weight: bold;
          text-decoration: underline;
        }
        .info-line {
          text-align: center;
          font-size: 14px;
          color: #ccc;
          margin: 12px 0 6px;
        }
        .room-section {
          margin-top: 20px;
        }
        .room-slider-wrapper {
          margin-bottom: 20px;
        }
        .styled-room-slider {
          width: 100%;
          height: 24px;
          background: #444;
          accent-color: #16a085;
          border-radius: 12px;
          margin: 6px 0 4px 0;
          -webkit-appearance: none;
        }
        .styled-room-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #1abc9c;
          border: 2px solid #fff;
          cursor: pointer;
          margin-top: -4px;
          transition: background 0.3s ease;
        }
        .styled-room-slider::-webkit-slider-thumb:hover {
          background: #16a085;
        }
        .styled-room-slider::-moz-range-thumb {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #1abc9c;
          border: 2px solid #fff;
          cursor: pointer;
          transition: background 0.3s ease;
        }
        .styled-room-slider::-moz-range-thumb:hover {
          background: #16a085;
        }
        .slider-labels {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
          color: #ddd;
          font-weight: 500;
        }
        .label-name {
          flex: 1;
          text-align: left;
          white-space: nowrap;
        }
        .label-status {
          flex: 1;
          text-align: center;
          white-space: nowrap;
        }
        .label-temp {
          flex: 1;
          text-align: right;
          white-space: nowrap;
        }
      </style>

      <button id="power">${climate.state === 'off' ? 'Turn On' : 'Turn Off'}</button>
      <div class="temp">${displayTemp.toFixed(1)}°C</div>
      ${modeButtons}
      <div class="controls">
        <button id="dec">-</button>
        <button id="inc">+</button>
      </div>
      <div class="info-line">
        Solar: ${solar} | Temp: ${houseTemp}°/${outsideTemp}° | Humidity: ${houseHum}%/${outsideHum}%
      </div>
      ${roomControls}
    `;

    // Event Listeners
    this.querySelector('#power').addEventListener('click', () => {
      const service = climate.state === 'off' ? 'turn_on' : 'turn_off';
      hass.callService('climate', service, { entity_id: config.entity });
    });

    this.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const mode = e.target.getAttribute('data-mode');
        hass.callService('climate', 'set_hvac_mode', {
          entity_id: config.entity,
          hvac_mode: mode,
        });
      });
    });

    this.querySelector('#inc').addEventListener('click', () => {
      this._changeTemp(0.5, minTemp, maxTemp);
    });

    this.querySelector('#dec').addEventListener('click', () => {
      this._changeTemp(-0.5, minTemp, maxTemp);
    });

    this.querySelectorAll('.styled-room-slider').forEach(slider => {
      const entityId = slider.dataset.entity;
      slider.addEventListener('input', (e) => {
        const labelStatus = slider.nextElementSibling.querySelector('.label-status');
        if (labelStatus) {
          const val = parseInt(e.target.value);
          if (val === 0) labelStatus.textContent = 'Closed';
          else if (val === 100) labelStatus.textContent = 'Open';
          else labelStatus.textContent = `${val}%`;
        }
      });
      slider.addEventListener('change', (e) => {
        this._hass.callService('cover', 'set_cover_position', {
          entity_id: entityId,
          position: parseInt(e.target.value),
        });
      });
    });
  }

  _changeTemp(delta, min, max) {
    const climate = this._hass.states[this.config.entity];
    let temp = climate.attributes.temperature || climate.attributes.current_temperature || min;
    temp = Math.max(min, Math.min(max, parseFloat((temp + delta).toFixed(1))));
    this._localTemp = temp;
    this._hass.callService('climate', 'set_temperature', {
      entity_id: this.config.entity,
      temperature: temp,
    });
  }

  getCardSize() {
    return 5;
  }
}

customElements.define('aircon-control-card', AirconControlCard);
