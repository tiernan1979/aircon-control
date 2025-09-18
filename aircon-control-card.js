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
    const currentTemp = climate.attributes.temperature ?? climate.attributes.current_temperature ?? minTemp;
    const hvacAction = climate.attributes.hvac_action || climate.state;
    const fanModes = climate.attributes.fan_modes || [];
    const currentFanMode = climate.attributes.fan_mode || '';

    if (this._localTemp !== null && Math.abs(this._localTemp - currentTemp) < 0.1) {
      this._localTemp = null;
    }

    const displayTemp = this._localTemp !== null ? this._localTemp : currentTemp;

    const getState = (id) => hass.states[id]?.state ?? 'N/A';
    const solar = config.solar_sensor ? getState(config.solar_sensor) : 'N/A';
    const houseTemp = config.house_temp_sensor ? getState(config.house_temp_sensor) : 'N/A';
    const outsideTemp = config.outside_temp_sensor ? getState(config.outside_temp_sensor) : 'N/A';
    const houseHum = config.house_humidity_sensor ? getState(config.house_humidity_sensor) : 'N/A';
    const outsideHum = config.outside_humidity_sensor ? getState(config.outside_humidity_sensor) : 'N/A';

    // Determine mode color and icon
    const modeMap = {
      'cooling': { color: '#1e90ff', icon: 'mdi:snowflake', label: 'Cooling' },
      'heating': { color: '#e67e22', icon: 'mdi:fire', label: 'Heating' },
      'drying': { color: '#3498db', icon: 'mdi:water-percent', label: 'Dry' },
      'fan':     { color: '#16a085', icon: 'mdi:fan', label: 'Fan' },
      'idle':    { color: '#888', icon: 'mdi:power', label: 'Idle' },
      'off':     { color: '#555', icon: 'mdi:power', label: 'Off' },
      'auto':    { color: '#9b59b6', icon: 'mdi:autorenew', label: 'Auto' },
    };

    const currentMode = hvacAction.toLowerCase();
    const modeData = modeMap[currentMode] || modeMap['idle'];
    // Room sliders
    let roomControls = '';
    if (config.rooms && Array.isArray(config.rooms)) {
      roomControls += '<div class="room-section">';
      config.rooms.forEach(room => {
        const sliderEnt = hass.states[room.slider_entity];
        const sensorEnt = hass.states[room.sensor_entity];
        const sliderVal = sliderEnt?.attributes?.current_position ?? parseInt(sliderEnt?.state) ?? 0;
        const sensorVal = sensorEnt ? parseFloat(sensorEnt.state) : null;

        roomControls += `
          <div class="room-block">
            <div class="slider-container">
              <input
                type="range"
                class="styled-room-slider"
                min="0"
                max="100"
                step="1"
                value="${sliderVal}"
                data-entity="${room.slider_entity}"
              >
              <div class="slider-info">
                <span class="slider-name">${room.name}</span>
                <span class="slider-status">${sliderVal}%</span>
                <span class="slider-temp">${sensorVal != null ? sensorVal.toFixed(1) + '°C' : 'N/A'}</span>
              </div>
            </div>
          </div>
        `;
      });
      roomControls += '</div>';
    }

    // Inner HTML
    this.innerHTML = `
      <style>
        :host {
          font-family: 'Roboto', sans-serif;
          background: #1c1c1c;
          color: white;
          border-radius: 12px;
          padding: 16px;
          display: block;
          max-width: 380px;
        }
        button {
          cursor: pointer;
          border: none;
          outline: none;
          background: none;
        }
        .temp-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 16px 0;
          position: relative;
        }
        .temp-circle {
          background: #111214;
          border-radius: 50%;
          width: 140px;
          height: 140px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 25px -5px ${modeData.color};
          flex-direction: column;
          position: relative;
          color: white;
        }
        .temp-circle .setpoint {
          font-size: 28px;
          font-weight: bold;
        }
        .temp-circle .mode-icon {
          font-size: 24px;
          margin-top: 4px;
        }
        .circle-button {
          width: 36px;
          height: 36px;
          font-size: 24px;
          color: white;
          background: #333;
          border-radius: 50%;
        }
        .controls {
          display: flex;
          justify-content: space-between;
          margin: 12px auto 0;
          max-width: 200px;
        }
        .modes {
          text-align: center;
          margin: 12px 0;
        }
        .mode-btn {
          margin: 5px;
          padding: 6px 10px;
          border-radius: 16px;
          background: #444;
          color: white;
        }
        .mode-selected {
          background: ${modeData.color};
          font-weight: bold;
        }
        .info-line {
          text-align: center;
          font-size: 13px;
          color: #ccc;
          margin-top: 10px;
        }
        .room-section {
          margin-top: 16px;
        }
        .slider-container {
          position: relative;
          margin-bottom: 24px;
        }
        .styled-room-slider {
          width: 100%;
          accent-color: ${modeData.color};
        }
        .slider-info {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          margin-top: 4px;
          color: #ccc;
        }
      </style>

      <div class="controls">
        <button class="circle-button" id="dec">-</button>
        <div class="temp-circle">
          <div class="setpoint">${displayTemp.toFixed(1)}°C</div>
          <ha-icon icon="${modeData.icon}" class="mode-icon"></ha-icon>
        </div>
        <button class="circle-button" id="inc">+</button>
      </div>

      <div class="modes">
        ${['cool', 'heat', 'fan_only', 'dry', 'auto'].map(mode => {
          const selected = climate.attributes.hvac_mode === mode ? 'mode-selected' : '';
          const label = config.show_mode_icons ? `<ha-icon icon="${modeMap[mode]?.icon || 'mdi:help'}"></ha-icon>` : mode;
          return `<button class="mode-btn ${selected}" data-mode="${mode}">${label}</button>`;
        }).join('')}
      </div>

      <div class="info-line">
        House Temp: ${houseTemp}°C | Solar: ${solar} | Outside: ${outsideTemp}°C | Humidity: ${houseHum}%/${outsideHum}%
      </div>

      ${roomControls}
    `;
    // Power toggle if you need it later
     this.querySelector('#power').addEventListener('click', () => {
       const service = climate.state === 'off' ? 'turn_on' : 'turn_off';
       hass.callService('climate', service, { entity_id: config.entity });
     });

    // Mode buttons
    this.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const mode = e.currentTarget.getAttribute('data-mode');
        hass.callService('climate', 'set_hvac_mode', {
          entity_id: config.entity,
          hvac_mode: mode,
        });
      });
    });

    // Temperature +/- buttons
    this.querySelector('#inc').addEventListener('click', () => {
      this._changeTemp(0.5, minTemp, maxTemp);
    });

    this.querySelector('#dec').addEventListener('click', () => {
      this._changeTemp(-0.5, minTemp, maxTemp);
    });

    // Room slider logic
    this.querySelectorAll('.styled-room-slider').forEach(slider => {
      const entityId = slider.dataset.entity;
      const sliderInfo = slider.parentElement.querySelector('.slider-status');

      slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        sliderInfo.textContent = `${val}%`;
      });

      slider.addEventListener('change', (e) => {
        const val = parseInt(e.target.value);
        this._hass.callService('cover', 'set_cover_position', {
          entity_id: entityId,
          position: val,
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
