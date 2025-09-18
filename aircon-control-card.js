
class AirconControlCard extends HTMLElement {
  constructor() {
    super();
    this._localSetpoint = null;
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error('You must define a climate entity in the config');
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
    const currentSetpoint = climate.attributes.temperature ?? climate.attributes.target_temperature ?? minTemp;

    // Display setpoint, allow local override
    if (
      this._localSetpoint !== null &&
      Math.abs(this._localSetpoint - currentSetpoint) < 0.5
    ) {
      this._localSetpoint = null;
    }
    const displaySetpoint = this._localSetpoint !== null
      ? this._localSetpoint
      : currentSetpoint;

    const hvacAction = (climate.attributes.hvac_action ?? climate.state ?? 'off').toString().toLowerCase();
    const hvacMode = (climate.state ?? 'off').toString().toLowerCase();

    const getState = (id) => {
      const s = hass.states[id];
      if (!s || s.state === 'unknown' || s.state === 'unavailable') return 'N/A';
      return s.state;
    };
    const houseTemp = config.house_temp_sensor ? getState(config.house_temp_sensor) : 'N/A';
    const outsideTemp = config.outside_temp_sensor ? getState(config.outside_temp_sensor) : 'N/A';
    const solar = config.solar_sensor ? getState(config.solar_sensor) : 'N/A';
    const houseHum = config.house_humidity_sensor ? getState(config.house_humidity_sensor) : 'N/A';
    const outsideHum = config.outside_humidity_sensor ? getState(config.outside_humidity_sensor) : 'N/A';

    // mode map (use hvac modes + hvac_action if needed)
    const modeMap = {
      cooling: { color: '#1e90ff', icon: 'mdi:snowflake', label: 'Cooling' },
      heat:    { color: '#e67e22', icon: 'mdi:fire', label: 'Heating' },
      dry:     { color: '#3498db', icon: 'mdi:water-percent', label: 'Dry' },
      fan_only:{ color: '#16a085', icon: 'mdi:fan', label: 'Fan' },
      auto:    { color: '#9b59b6', icon: 'mdi:autorenew', label: 'Auto' },
      off:     { color: '#555', icon: 'mdi:power-off', label: 'Off' }
    };
    const modeKey = hvacMode;  // you might want to also use hvacAction if you want more precise mode
    const modeData = modeMap[modeKey] || modeMap.off;

    // build slider blocks
    let roomControls = '';
    if (Array.isArray(config.rooms)) {
      roomControls += '<div class="room-section">';
      config.rooms.forEach(room => {
        if (!room.name || !room.slider_entity || !room.sensor_entity) return;
        const sliderEnt = hass.states[room.slider_entity];
        let sliderVal = 0;
        if (sliderEnt) {
          if (sliderEnt.attributes.current_position != null) {
            sliderVal = parseInt(sliderEnt.attributes.current_position) || 0;
          } else if (!isNaN(Number(sliderEnt.state))) {
            sliderVal = Number(sliderEnt.state);
          }
        }
        const sensorEnt = hass.states[room.sensor_entity];
        const sensorVal = sensorEnt && !isNaN(Number(sensorEnt.state))
          ? Number(sensorEnt.state)
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
                <span class="slider-temp">${sensorVal != null ? sensorVal.toFixed(1) + '°C' : 'N/A'}</span>
              </div>
            </div>
          </div>
        `;
      });
      roomControls += '</div>';
    }

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
        ha-icon {
          vertical-align: middle;
        }
        .controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 16px auto;
          max-width: 220px;
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
          align-items: center;
          justify-content: center;
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
          --glow-color: ${modeData.color};
          animation: pulseGlow 5s ease-in-out infinite;
        }
        @keyframes pulseGlow {
          0%, 100% {
            box-shadow: 0 10px 25px -5px var(--glow-color);
          }
          50% {
            box-shadow: 0 10px 40px 0 var(--glow-color);
          }
        }
        .setpoint {
          font-size: 20px;
          font-weight: bold;
        }
        .circle-mode {
          font-size: 18px;
          margin-top: 4px;
          display: flex;
          align-items: center;
          gap: 4px;
          color: var(--glow-color);
        }
        .mode-selector {
          text-align: center;
          margin: 12px 0;
          display: flex;
          justify-content: center;
          gap: 8px;
          flex-wrap: wrap;
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
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .mode-btn.selected {
          background: var(--glow-color);
          color: white;
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
          height: 8px;
          border-radius: 4px;
          background: #555;
          outline: none;
          appearance: none;
        }
        .styled-room-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 0;
          height: 0;
        }
        .styled-room-slider::-moz-range-thumb {
          width: 0;
          height: 0;
        }
        .styled-room-slider::-webkit-slider-runnable-track {
          height: 8px;
          border-radius: 4px;
          background: linear-gradient(to right, var(--glow-color) var(--percent), #555 var(--percent));
        }
        .styled-room-slider::-moz-range-track {
          height: 8px;
          border-radius: 4px;
          background: linear-gradient(to right, var(--glow-color) var(--percent), #555 var(--percent));
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
          <div class="setpoint">${displaySetpoint.toFixed(0)}°C</div>
          <div class="circle-mode">
            <ha-icon icon="${modeData.icon}"></ha-icon>
            <span>${modeData.label}</span>
          </div>
        </div>
        <button id="inc" class="circle-button">+</button>
      </div>

      <div class="mode-selector">
        ${Object.entries(modeMap).map(([modeKey, md]) => {
          const sel = (climate.state === modeKey) ? 'selected' : '';
          return `<button class="mode-btn ${sel}" data-mode="${modeKey}">
                    <ha-icon icon="${md.icon}"></ha-icon>
                    ${md.label}
                  </button>`;
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
          hvac_mode: mode
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
      slider.addEventListener('input', e => {
        const val = Number(e.target.value);
        slider.style.setProperty('--percent', val + '%');
        if (statusSpan) statusSpan.textContent = `${val}%`;
      });
      slider.addEventListener('change', e => {
        const val = Number(e.target.value);
        this._hass.callService('cover', 'set_cover_position', {
          entity_id: entityId,
          position: val
        });
      });
    });

  }

  _changeTemp(delta, min, max) {
    const climate = this._hass.states[this.config.entity];
    let temp = climate.attributes.temperature ?? climate.attributes.current_temperature ?? min;
    temp = Math.round(temp + delta);
    if (temp < min) temp = min;
    if (temp > max) temp = max;
    this._localSetpoint = temp;
    this._hass.callService('climate', 'set_temperature', {
      entity_id: this.config.entity,
      temperature: temp
    });
  }

  getCardSize() {
    return 5;
  }
}

customElements.define('aircon-control-card', AirconControlCard);
