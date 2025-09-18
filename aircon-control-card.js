class AirconControlCard extends HTMLElement {
  constructor() {
    super();
    this._localTemp = null;
  }

  setConfig(config) {
    if (!config.entity) throw new Error('You need to define an entity');
    this.config = config;
    // Optional toggle for showing mode names
    this.showModeNames = config.show_mode_names !== false;
  }

  set hass(hass) {
    this._hass = hass;
    const config = this.config;
    const climate = hass.states[config.entity];
    if (!climate) {
      this.innerHTML = `<hui-warning>${config.entity} not available</hui-warning>`;
      return;
    }

    // Basic parameters
    const minTemp = climate.attributes.min_temp ?? 16;
    const maxTemp = climate.attributes.max_temp ?? 30;
    const currentTemp = climate.attributes.temperature ?? climate.attributes.current_temperature ?? minTemp;

    // Manage local temp override
    if (this._localTemp !== null && Math.abs(this._localTemp - currentTemp) < 0.1) {
      this._localTemp = null;
    }
    const displayTemp = (this._localTemp !== null ? this._localTemp : currentTemp);

    const currentMode = climate.attributes.hvac_mode ?? climate.state;
    const powerOn = climate.state !== 'off';

    // Fan speed (if available)
    const fanModes = climate.attributes.fan_modes ?? [];
    const currentFanMode = climate.attributes.fan_mode ?? null;

    // Mode data map
    const modeData = {
      off:      { icon: 'mdi:power',        color: '#777',       name: 'Off' },
      cool:     { icon: 'mdi:snowflake',    color: '#2196F3',     name: 'Cool' },
      heat:     { icon: 'mdi:fire',         color: '#F44336',     name: 'Heat' },
      fan_only: { icon: 'mdi:fan',          color: '#9E9E9E',     name: 'Fan' },
      dry:      { icon: 'mdi:water-percent', color: '#009688',     name: 'Dry' },
      auto:     { icon: 'mdi:autorenew',    color: '#FFC107',     name: 'Auto' },
    };

    const glowColor = modeData[currentMode]?.color || '#16a085';

    // Build mode + power buttons row (includes Off as a mode)
    let modeButtons = '<div class="modes">';
    Object.entries(modeData).forEach(([modeKey, md]) => {
      const isSelected = (currentMode === modeKey);
      const colorStyle = `color:${isSelected ? md.color : '#ccc'}`;
      modeButtons += `
        <button class="mode-btn ${isSelected ? 'mode-selected' : ''}" data-mode="${modeKey}" style="${colorStyle}">
          <ha-icon icon="${md.icon}" style="${colorStyle}"></ha-icon>
          ${ this.showModeNames ? `<span class="mode-name">${md.name}</span>` : '' }
        </button>`;
    });
    modeButtons += '</div>';

    // Build fan speed buttons (only if available and unit is on)
    let fanSpeedButtons = '';
    if (fanModes.length > 0 && powerOn) {
      fanSpeedButtons = '<div class="fan-modes">';
      fanModes.forEach(fm => {
        const sel = (currentFanMode && currentFanMode.toLowerCase() === fm.toLowerCase()) ? 'fan-selected' : '';
        fanSpeedButtons += `
          <button class="fan-btn ${sel}" data-fan-mode="${fm}" style="${ sel ? `color:${glowColor}` : 'color:#ccc' }">
            <span class="fan-name">${fm.charAt(0).toUpperCase() + fm.slice(1)}</span>
          </button>`;
      });
      fanSpeedButtons += '</div>';
    }

    // Room sliders (bigger, info inside)
    let roomControls = '';
    if (config.rooms && Array.isArray(config.rooms)) {
      roomControls += '<div class="room-section">';
      config.rooms.forEach(room => {
        const sliderEnt = hass.states[room.slider_entity];
        const sensorEnt = hass.states[room.sensor_entity];
        const sliderVal = sliderEnt?.attributes?.current_position ?? 0;
        const sensorVal = sensorEnt && !isNaN(Number(sensorEnt.state)) ? Number(sensorEnt.state) : null;

        roomControls += `
          <div class="room-block">
            <input
              type="range"
              class="styled-room-slider"
              min="0" max="100" step="1"
              value="${sliderVal}"
              data-entity="${room.slider_entity}"
              style="--percent:${sliderVal}%;"
            />
            <div class="slider-info">
              <span class="slider-name">${room.name}</span>
              <span class="slider-status">${sliderVal}%</span>
              <span class="slider-temp">${ sensorVal !== null ? sensorVal.toFixed(1) + '°C' : 'N/A' }</span>
            </div>
          </div>`;
      });
      roomControls += '</div>';
    }

    // HTML + Styles
    this.innerHTML = `
      <style>
        :host {
          font-family: 'Roboto', sans-serif;
          background: #000; /* black */
          color: white;
          border-radius: 12px;
          padding: 16px;
          display: block;
          max-width: 360px;
          user-select: none;
        }
        .modes, .fan-modes {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
        }
        .mode-btn, .fan-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          cursor: pointer;
          background: transparent;
          border: none;
          outline: none;
          color: #ccc;
          transition: color 0.3s;
        }
        .mode-btn.mode-selected, .fan-btn.fan-selected {
          color: ${glowColor};
        }
        .mode-btn ha-icon, .fan-btn ha-icon {
          font-size: 24px;
          transition: color 0.3s;
        }
        .mode-name, .fan-name {
          font-size: 12px;
        }
        /* Setpoint + circle area */
        .temp-setpoint-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
        }
        .setpoint-button {
          width: 36px; height: 36px;
          background: #333; border-radius: 50%;
          font-size: 24px; color: white;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: background-color 0.3s;
        }
        .setpoint-button:hover {
          background: ${glowColor};
        }
        .temp-circle {
          width: 140px; height: 140px;
          background: #222; border-radius: 50%;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          position: relative;
          box-shadow: 0 8px 12px -4px rgba(0,0,0,0.8), 0 0 20px 2px rgba(0,0,0,0.9);
        }
        .temp-value {
          font-size: 44px; font-weight: 700;
          color: white;
          user-select: none;
        }
        .mode-in-circle {
          margin-top: 6px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 18px;
          color: ${glowColor};
        }
        /* Sliders */
        .room-section {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .room-block {
          position: relative;
          width: 100%;
        }
        .styled-room-slider {
          width: 100%;
          height: 26px;
          -webkit-appearance: none;
          appearance: none;
          border-radius: 14px;
          background: linear-gradient(to right, ${glowColor} var(--percent), #444 var(--percent));
          outline: none;
          cursor: pointer;
          transition: background 0.3s ease;
          margin: 0;
        }
        .styled-room-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 26px; height: 26px;
          background: ${glowColor};
          border: 2px solid white;
          border-radius: 50%;
          margin-top: -7px;
          transition: background-color 0.3s;
        }
        .styled-room-slider::-moz-range-thumb {
          width: 26px; height: 26px;
          background: ${glowColor};
          border: 2px solid white;
          border-radius: 50%;
        }
        .slider-info {
          position: absolute;
          top: 2px;
          left: 12px;
          right: 12px;
          height: 22px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          pointer-events: none;
          font-size: 13px;
          color: white;
          user-select: none;
        }
        .slider-name {
          flex: 1;
        }
        .slider-status, .slider-temp {
          width: 50px;
          text-align: right;
        }
      </style>

      ${modeButtons}

      ${fanSpeedButtons}

      <div class="temp-setpoint-wrapper" aria-label="Set Point Controls">
        <button class="setpoint-button" id="dec-setpoint">−</button>
        <div class="temp-circle">
          <div class="temp-value">${displayTemp.toFixed(1)}°C</div>
          ${ (powerOn && currentMode && currentMode !== 'off') ? `
            <div class="mode-in-circle">
              <ha-icon icon="${modeData[currentMode]?.icon}"></ha-icon>
              <span>${modeData[currentMode]?.name}</span>
            </div>` : ''
          }
        </div>
        <button class="setpoint-button" id="inc-setpoint">+</button>
      </div>

      ${roomControls}
    `;

    // Event listeners

    // Mode / Off button
    this.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const mode = btn.getAttribute('data-mode');
        if (mode === 'off') {
          hass.callService('climate', 'turn_off', { entity_id: config.entity });
        } else {
          hass.callService('climate', 'set_hvac_mode', {
            entity_id: config.entity,
            hvac_mode: mode
          });
        }
      });
    });

    // Fan speed buttons
    this.querySelectorAll('.fan-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const fm = btn.getAttribute('data-fan-mode');
        hass.callService('climate', 'set_fan_mode', {
          entity_id: config.entity,
          fan_mode: fm
        });
      });
    });

    // Setpoint + / −
    this.querySelector('#dec-setpoint').addEventListener('click', () => {
      this._localTemp = (this._localTemp ?? displayTemp) - 1;
      if (this._localTemp < minTemp) this._localTemp = minTemp;
      this._hass.callService('climate', 'set_temperature', {
        entity_id: config.entity,
        temperature: this._localTemp
      });
    });
    this.querySelector('#inc-setpoint').addEventListener('click', () => {
      this._localTemp = (this._localTemp ?? displayTemp) + 1;
      if (this._localTemp > maxTemp) this._localTemp = maxTemp;
      this._hass.callService('climate', 'set_temperature', {
        entity_id: config.entity,
        temperature: this._localTemp
      });
    });

    // Sliders
    this.querySelectorAll('.styled-room-slider').forEach(slider => {
      slider.addEventListener('input', e => {
        const val = Number(e.target.value);
        slider.style.setProperty('--percent', `${val}%`);
      });
      slider.addEventListener('change', e => {
        const val = Number(e.target.value);
        const entityId = e.target.getAttribute('data-entity');
        hass.callService('cover', 'set_cover_position', {
          entity_id: entityId,
          position: val
        });
      });
    });

  }

  getCardSize() {
    return 6;
  }
}

customElements.define('aircon-control-card', AirconControlCard);
