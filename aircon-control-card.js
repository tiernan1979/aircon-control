class AirconControlCard extends HTMLElement {
  constructor() {
    super();
    this._localTemp = null;
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error('You need to define an entity in the config');
    }
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

    const minTemp = climate.attributes.min_temp ?? 16;
    const maxTemp = climate.attributes.max_temp ?? 30;
    const currentTemp = climate.attributes.temperature ?? climate.attributes.current_temperature ?? minTemp;

    if (this._localTemp !== null && Math.abs(this._localTemp - currentTemp) < 0.1) {
      this._localTemp = null;
    }
    const displayTemp = this._localTemp !== null ? this._localTemp : currentTemp;

    const hvacAction = (climate.attributes.hvac_action ?? climate.state ?? 'off').toLowerCase();
    const fanModes = climate.attributes.fan_modes ?? [];
    const currentFanMode = (climate.attributes.fan_mode ?? '').toString();

    const getState = (id) => {
      const s = hass.states[id];
      if (!s) return 'N/A';
      if (s.state === 'unknown' || s.state === 'unavailable') return 'N/A';
      return s.state;
    };

    const solar = config.solar_sensor ? getState(config.solar_sensor) : 'N/A';
    const houseTemp = config.house_temp_sensor ? getState(config.house_temp_sensor) : 'N/A';
    const outsideTemp = config.outside_temp_sensor ? getState(config.outside_temp_sensor) : 'N/A';
    const houseHum = config.house_humidity_sensor ? getState(config.house_humidity_sensor) : 'N/A';
    const outsideHum = config.outside_humidity_sensor ? getState(config.outside_humidity_sensor) : 'N/A';

    // Mode mapping
    const modeMap = {
      cooling: { color: '#1e90ff', icon: 'mdi:snowflake', label: 'Cooling' },
      heating: { color: '#e67e22', icon: 'mdi:fire', label: 'Heating' },
      fan:     { color: '#16a085', icon: 'mdi:fan', label: 'Fan' },
      dry:     { color: '#3498db', icon: 'mdi:water-percent', label: 'Dry' },
      auto:    { color: '#9b59b6', icon: 'mdi:autorenew', label: 'Auto' },
      idle:    { color: '#888', icon: 'mdi:power', label: 'Idle' },
      off:     { color: '#555', icon: 'mdi:power-off', label: 'Off' },
    };

    const modeData = modeMap[hvacAction] || modeMap.off;

    // Build room slider controls
    let roomControls = '';
    if (Array.isArray(config.rooms)) {
      roomControls += '<div class="room-section">';
      config.rooms.forEach(room => {
        if (!room.name || !room.slider_entity || !room.sensor_entity) {
          return;
        }
        const sliderEnt = hass.states[room.slider_entity];
        let sliderVal = 0;
        if (sliderEnt) {
          if (sliderEnt.attributes.current_position != null) {
            sliderVal = parseInt(sliderEnt.attributes.current_position) || 0;
          } else if (!isNaN(parseInt(sliderEnt.state))) {
            sliderVal = parseInt(sliderEnt.state);
          }
        }
        const sensorEnt = hass.states[room.sensor_entity];
        const sensorVal = sensorEnt && !isNaN(parseFloat(sensorEnt.state))
          ? parseFloat(sensorEnt.state)
          : null;

        if (sliderVal < 0) sliderVal = 0;
        if (sliderVal > 100) sliderVal = 100;

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
                style="--percent:${sliderVal}%;"
              />
              <div class="slider-info">
                <span class="slider-name">${room.name}</span>
                <span class="slider-status">${sliderVal}%</span>
                <span class="slider-temp">${sensorVal !== null ? sensorVal.toFixed(1) + '°C' : 'N/A'}</span>
              </div>
            </div>
          </div>
        `;
      });
      roomControls += '</div>';
    }

    // HTML + styles
    this.innerHTML = `
      <style>
        :host {
          font-family: 'Roboto', sans-serif;
          background: #18181b;
          color: white;
          border-radius: 12px;
          padding: 16px;
          display: block;
          max-width: 380px;
        }

        ha-icon {
          vertical-align: middle;
          margin: 0;
          padding: 0;
        }

        .temp-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          margin: 16px 0;
          position: relative;
        }

        .temp-circle {
          background: #111214;
          border-radius: 50%;
          width: 130px;
          height: 130px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          color: white;
          box-shadow: 0 10px 25px -5px ${modeData.color};
        }

        .temp-circle .setpoint {
          font-size: 20px; /* smaller */
          font-weight: bold;
        }

        .temp-circle .mode-icon {
          font-size: 20px;
          margin-top: 4px;
          color: ${modeData.color};
        }

        .circle-button {
          width: 32px;
          height: 32px;
          background: #333;
          color: white;
          border: none;
          border-radius: 50%;
          font-size: 20px;
          cursor: pointer;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 16px auto;
          max-width: 200px;
        }

        .mode-selector {
          text-align: center;
          margin: 12px 0;
        }
        .mode-btn {
          margin: 4px;
          padding: 6px 10px;
          border-radius: 16px;
          background: #333;
          color: white;
          font-size: 13px;
          cursor: pointer;
          border: none;
          outline: none;
        }
        .mode-btn.selected {
          background: ${modeData.color};
          color: white;
        }

        .info-line {
          text-align: center;
          font-size: 13px;
          color: #ccc;
          margin-top: 12px;
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
          height: 8px;
          border-radius: 4px;
          background: #555;
          outline: none;
          -webkit-appearance: none;
        }
        .styled-room-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          background: ${modeData.color};
          border: 2px solid white;
          border-radius: 50%;
          cursor: pointer;
          margin-top: -6px;
        }
        .styled-room-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: ${modeData.color};
          border: 2px solid white;
          border-radius: 50%;
          cursor: pointer;
        }

        .slider-info {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          color: #ccc;
          margin-top: 4px;
        }
        .slider-name { flex: 1; text-align: left; }
        .slider-status { flex: 0 0 50px; text-align: center; }
        .slider-temp { flex: 0 0 50px; text-align: right; }
      </style>

      <div class="controls">
        <button id="dec" class="circle-button">−</button>
        <div class="temp-circle">
          <div class="setpoint">${displayTemp.toFixed(1)}°C</div>
          <ha-icon icon="${modeData.icon}" class="mode-icon"></ha-icon>
        </div>
        <button id="inc" class="circle-button">+</button>
      </div>

      <div class="mode-selector">
        ${Object.entries(modeMap).map(([modeKey, md]) => {
          const sel = climate.attributes.hvac_mode === modeKey ? 'selected' : '';
          return `<button class="mode-btn ${sel}" data-mode="${modeKey}">${md.label}</button>`;
        }).join('')}
      </div>

      <div class="info-line">
        ${houseTemp}°C / ${outsideTemp}°C | Solar: ${solar} | Humidity: ${houseHum}%/${outsideHum}%
      </div>

      ${roomControls}
    `;

    // Event listeners

    // Mode buttons
    this.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const mode = e.currentTarget.getAttribute('data-mode');
        this._hass.callService('climate', 'set_hvac_mode', {
          entity_id: config.entity,
          hvac_mode: mode,
        });
      });
    });

    // Setpoint +/- buttons
    this.querySelector('#inc').addEventListener('click', () => {
      this._changeTemp(1, minTemp, maxTemp);
    });
    this.querySelector('#dec').addEventListener('click', () => {
      this._changeTemp(-1, minTemp, maxTemp);
    });

    // Room sliders
    this.querySelectorAll('.styled-room-slider').forEach(slider => {
      const entityId = slider.dataset.entity;
      const statusSpan = slider.parentElement.querySelector('.slider-status');
      slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        slider.style.setProperty('--percent', val + '%');
        if (statusSpan) statusSpan.textContent = `${val}%`;
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
    let temp = climate.attributes.temperature ?? climate.attributes.current_temperature ?? min;
    temp = Math.round((temp + delta));  // 1 degree increments
    if (temp < min) temp = min;
    if (temp > max) temp = max;
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
