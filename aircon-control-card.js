class AirconControlCard extends HTMLElement {
  constructor() {
    super();
    this._localTemp = null;
    this._localSliderValues = {}; // ← NEW: stores temporary slider states
    this._sliderUpdateTimestamps = {}; // ← NEW: remember when each slider was updated
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('You need to define an entity');
    }
    this.config = {
      default_slider_color: '#66ccff', // fallback light blue
      config
    };
    this.showModeNames = config.show_mode_names !== false;
  }

  set hass(hass) {
    this._hass = hass;
    const cfg = this.config;
    const climate = hass.states[cfg.entity];
    if (!climate) {
      this.innerHTML = `<hui-warning>${cfg.entity} not available</hui-warning>`;
      return;
    }

    const minTemp = climate.attributes.min_temp ?? 16;
    const maxTemp = climate.attributes.max_temp ?? 30;
    const currentTemp = climate.attributes.temperature ?? climate.attributes.current_temperature ?? minTemp;

    if (
      this._localTemp !== null &&
      Math.abs(this._localTemp - currentTemp) < 0.1
    ) {
      this._localTemp = null;
    }
    const displayTemp = this._localTemp !== null ? this._localTemp : currentTemp;

    const currentMode = climate.attributes.hvac_mode ?? climate.state;
    const powerOn = climate.state !== 'off';

    const fanModes = climate.attributes.fan_modes ?? [];
    const currentFanMode = climate.attributes.fan_mode ?? null;

    const modeData = {
      off:      { icon: 'mdi:power',         color: '#D69E5E', name: 'Off' },
      cool:     { icon: 'mdi:snowflake',     color: '#2196F3', name: 'Cool' },
      heat:     { icon: 'mdi:fire',          color: '#F44336', name: 'Heat' },
      fan_only: { icon: 'mdi:fan',           color: '#9E9E9E', name: 'Fan' },
      dry:      { icon: 'mdi:water-percent', color: '#009688', name: 'Dry' },
      auto:     { icon: 'mdi:autorenew',     color: '#FFC107', name: 'Auto' },
    };

    const glowColor = modeData[currentMode]?.color ?? '#b37fed';

    const getState = id => {
      const s = hass.states[id];
      if (!s || s.state === 'unknown' || s.state === 'unavailable') {
        return null;
      }
      return s.state;
    };

    const sensorSolar = cfg.solar_sensor ? getState(cfg.solar_sensor) : null;
    const sensorHouseTemp = cfg.house_temp_sensor ? getState(cfg.house_temp_sensor) : null;
    const sensorHouseHum = cfg.house_humidity_sensor ? getState(cfg.house_humidity_sensor) : null;
    const sensorOutsideTemp = cfg.outside_temp_sensor ? getState(cfg.outside_temp_sensor) : null;
    const sensorOutsideHum = cfg.outside_humidity_sensor ? getState(cfg.outside_humidity_sensor) : null;

    let sensorLine = '';
    if (
      sensorSolar !== null ||
      sensorHouseTemp !== null ||
      sensorHouseHum !== null ||
      sensorOutsideTemp !== null ||
      sensorOutsideHum !== null
    ) {
      const parts = [];
      if (sensorHouseTemp !== null || sensorHouseHum !== null) {
        const temp = sensorHouseTemp !== null ? `${sensorHouseTemp}°C` : '';
        const hum = sensorHouseHum !== null ? `${sensorHouseHum}%` : '';
        parts.push(`<ha-icon icon="mdi:home-outline"></ha-icon> ${temp}${temp && hum ? ' / ' : ''}${hum}`);
      }
      if (sensorOutsideTemp !== null || sensorOutsideHum !== null) {
        const temp = sensorOutsideTemp !== null ? `${sensorOutsideTemp}°C` : '';
        const hum = sensorOutsideHum !== null ? `${sensorOutsideHum}%` : '';
        parts.push(`<ha-icon icon="mdi:weather-sunny"></ha-icon> ${temp}${temp && hum ? ' / ' : ''}${hum}`);
      }
      if (sensorSolar !== null) {
        parts.push(`<ha-icon icon="mdi:solar-power"></ha-icon> ${sensorSolar}`);
      }
      sensorLine = `<div class="sensor-line">${parts.join(' | ')}</div>`;
    }

    let modeButtons = '<div class="modes">';
    Object.entries(modeData).forEach(([modeKey, md]) => {
      const isSel = currentMode === modeKey;
      const color = isSel ? md.color : '#ccc';
      modeButtons += `
        <button class="mode-btn ${isSel ? 'mode-selected' : ''}" data-mode="${modeKey}" style="color:${color}">
          <ha-icon icon="${md.icon}" style="color:${color}"></ha-icon>
          ${ this.showModeNames ? `<span class="mode-name">${md.name}</span>` : '' }
        </button>`;
    });
    modeButtons += '</div>';

    let fanSpeedButtons = '<div class="fan-modes">';
    fanModes.forEach(fm => {
      const sel = (currentFanMode && currentFanMode.toLowerCase() === fm.toLowerCase()) ? 'fan-selected' : '';
      fanSpeedButtons += `
        <button class="fan-btn ${sel}" data-fan-mode="${fm}" style="${ sel ? `color:${glowColor}` : 'color:#ccc' }">
          <span class="fan-name">${fm.charAt(0).toUpperCase() + fm.slice(1)}</span>
        </button>`;
    });
    fanSpeedButtons += '</div>';

    let roomControls = '';
    if (cfg.rooms && Array.isArray(cfg.rooms)) {
      roomControls += '<div class="room-section">';
      cfg.rooms.forEach(room => {
        const roomEntity = room.slider_entity;
        const sensorEntity = room.sensor_entity;
      
        const sliderEnt = roomEntity && hass.states[roomEntity];
        const sensorEnt = sensorEntity && hass.states[sensorEntity];
      
        let sliderVal = 0;
      
        if (sliderEnt) {
          if (sliderEnt.attributes && sliderEnt.attributes.current_position != null) {
            sliderVal = parseInt(sliderEnt.attributes.current_position) || 0;
          } else if (!isNaN(Number(sliderEnt.state))) {
            sliderVal = Number(sliderEnt.state);
          }
        }
      
        sliderVal = Math.max(0, Math.min(100, sliderVal)); // clamp to 0-100
      
        const sensorVal = (sensorEnt && !isNaN(Number(sensorEnt.state)))
          ? Number(sensorEnt.state)
          : null;
      
        const localVal = this._localSliderValues?.[roomEntity];
        const recentUpdate = this._sliderUpdateTimestamps?.[roomEntity];
        const now = Date.now();
        const showLocal = localVal !== undefined && recentUpdate && (now - recentUpdate < 2000);
        const effectiveVal = showLocal ? localVal : sliderVal;
        const sliderColor = room.slider_color || cfg.default_slider_color || '#66ccff';
        
        roomControls += `
          <div class="room-block">
            <input
              type="range"
              class="styled-room-slider no-thumb"
              min="0" max="100" step="1"
              value="${effectiveVal}"
              data-entity="${room.slider_entity}"
              style="--percent:${sliderVal}%; --fill-color:${sliderColor}"
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

    this.innerHTML = `
      <style>
        :host {
          font-family: 'Roboto', sans-serif;
          background: var(--card-background-color, #000); /* fallback to black */
          color: var(--primary-text-color, white);
          border-radius: 12px;
          padding: 16px;
          display: block;
          max-width: 360px;
          user-select: none;
          transition: background-color 0.3s ease;
        }

        .modes, .fan-modes {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
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
          font-size: 14px; /* increased by +2 */
        }

        .mode-btn.mode-selected, .fan-btn.fan-selected {
          color: ${glowColor};
        }

        .mode-btn ha-icon, .fan-btn ha-icon {
          font-size: 26px; /* +2 */
        }

        .mode-name, .fan-name {
          font-size: 14px; /* +2 */
        }

        .temp-setpoint-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .setpoint-button {
          width: 32px;
          height: 32px;
          background: #333;
          border-radius: 50%;
          font-size: 24px;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background-color 0.3s;
        }

        .setpoint-button:hover {
          background: ${glowColor};
        }
        
        .temp-circle-container {
          position: relative;
          width: 140px;
          height: 140px;
          margin: 0 16px; /* keep spacing for buttons */
        }
        

        .temp-circle-container.glow .glow-bottom {
          opacity: 0.6; /* brighter when ON */
          animation: glowPulse 12s infinite ease-in-out;
        }
        
        .glow-bottom {
          position: absolute;
          bottom: -12px;
          left: 50%;
          transform: translateX(-50%);
          width: 140px;
          height: 70px;
          background: ${glowColor};
          border-radius: 0 0 70px 70px / 0 0 70px 70px;
          filter: blur(14px); /* reduce blur for visibility */
          opacity: 0.2; /* increase base glow */
          pointer-events: none;
          transition: opacity 0.5s ease;
          animation: none;
          z-index: 0;
        }
                
        .temp-circle {
          position: relative;
          z-index: 1;
          width: 140px;
          height: 140px;
          border-radius: 50%;
          background:
            radial-gradient(circle at 60% 60%, rgba(255,105,180, 0.2), transparent 70%),   /* pink highlight */
            radial-gradient(circle at 30% 30%, rgba(186,85,211, 0.3), transparent 70%),    /* purple swirl */
            radial-gradient(circle at center, #0a0a0a 40%, #000000 100%);                  /* black base */
          box-shadow:
            inset 0 10px 15px rgba(255, 255, 255, 0.1),
            inset 0 -10px 15px rgba(0, 0, 0, 0.8);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 34px;
          font-weight: 600;
        }
        
        .temp-circle::before {
          content: '';
          position: absolute;
          top: 18px;
          left: 18px;
          right: 18px;
          bottom: 18px;
          border-radius: 50%;
          box-shadow: inset 0 0 20px 3px rgba(255, 105, 180, 0.5);
          pointer-events: none;
          z-index: -1;
        }

        .temp-unit {
          font-size: 16px;
          margin-left: 4px;
          color: #d1d1d1;
          font-weight: 400;
        }

        .sensor-line {
          text-align: center;
          margin-bottom: 12px;
          font-size: 12px;
          color: #bbb;
        }

        .room-section {
          margin-top: 12px;
        }

        .room-block {
          margin-bottom: 12px;
        }

        .styled-room-slider {
          width: 100%;
          -webkit-appearance: none;
          appearance: none;
          height: 8px;
          border-radius: 8px;
          background: linear-gradient(
            90deg,
            var(--fill-color, #66ccff) var(--percent, 50%),
            #444 var(--percent, 50%)
          );
          outline: none;
          cursor: pointer;
          transition: background 0.3s ease;
        }

        .styled-room-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          background: var(--fill-color, #66ccff);
          cursor: pointer;
          border-radius: 50%;
          border: 2px solid white;
          transition: background 0.3s ease;
          position: relative;
          z-index: 1;
        }

        .styled-room-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          background: var(--fill-color, #66ccff);
          border-radius: 50%;
          border: 2px solid white;
          cursor: pointer;
          transition: background 0.3s ease;
          position: relative;
          z-index: 1;
        }

        .no-thumb::-webkit-slider-thumb {
          display: none;
        }

        .slider-info {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
          color: #ccc;
          margin-top: 4px;
          font-weight: 500;
        }

        .slider-name {
          font-weight: 600;
        }

        @keyframes glowPulse {
          0%, 100% {
            opacity: 0.4;
          }
          50% {
            opacity: 0.8;
          }
        }
      </style>

      ${sensorLine}
      
      <div class="temp-setpoint-wrapper">
        <button class="setpoint-button" id="temp-dec">−</button>
        <div class="temp-circle-container ${powerOn ? 'glow' : ''}">
          <div class="glow-bottom"></div>
          <div class="temp-circle">${displayTemp.toFixed(1)}<span class="temp-unit">°C</span></div>
        </div>
        <button class="setpoint-button" id="temp-inc">+</button>
      </div>
      
      ${modeButtons}
      ${fanSpeedButtons}
      ${roomControls}
    `;

    this.querySelector('#temp-dec').onclick = () => this._changeTemp(-0.5);
    this.querySelector('#temp-inc').onclick = () => this._changeTemp(0.5);

    this.shadowRoot?.querySelectorAll('.mode-btn').forEach(button => {
      button.onclick = () => this._setMode(button.dataset.mode);
    });

    this.querySelectorAll('.mode-btn').forEach(button => {
      button.onclick = () => this._setMode(button.dataset.mode);
    });

    this.querySelectorAll('.fan-btn').forEach(button => {
      button.onclick = () => this._setFanMode(button.dataset.fanMode);
    });

    this.querySelectorAll('.styled-room-slider').forEach(slider => {
      slider.oninput = e => {
        const ent = e.target.dataset.entity;
        const val = parseInt(e.target.value);
        if (!ent) return;

        this._localSliderValues[ent] = val;
        this._sliderUpdateTimestamps[ent] = Date.now();

        // Update slider UI
        e.target.style.setProperty('--percent', `${val}%`);

        const statusSpan = e.target.nextElementSibling?.querySelector('.slider-status');
        if (statusSpan) statusSpan.textContent = `${val}%`;
      };

      slider.onchange = e => {
        const ent = e.target.dataset.entity;
        const val = parseInt(e.target.value);
        if (!ent) return;
        this._localSliderValues[ent] = val;
        this._sliderUpdateTimestamps[ent] = Date.now();

        this._callService('climate', 'set_hvac_mode', {
          entity_id: this.config.entity,
          hvac_mode: 'auto',
        });

        this._callService('cover', 'set_cover_position', {
          entity_id: ent,
          position: val,
        });
      };
    });
  }

  _callService(domain, service, data) {
    this._hass.callService(domain, service, data);
  }

  _changeTemp(delta) {
    if (!this._hass) return;

    const climate = this._hass.states[this.config.entity];
    if (!climate) return;

    let curTemp = climate.attributes.temperature ?? climate.attributes.current_temperature;
    if (curTemp === undefined) return;

    let newTemp = Number(curTemp) + delta;
    const minTemp = climate.attributes.min_temp ?? 16;
    const maxTemp = climate.attributes.max_temp ?? 30;
    newTemp = Math.min(Math.max(newTemp, minTemp), maxTemp);

    this._localTemp = newTemp;

    this._callService('climate', 'set_temperature', {
      entity_id: this.config.entity,
      temperature: newTemp,
    });
  }

  _setMode(mode) {
    if (!this._hass) return;
    this._callService('climate', 'set_hvac_mode', {
      entity_id: this.config.entity,
      hvac_mode: mode,
    });
  }

  _setFanMode(fanMode) {
    if (!this._hass) return;
    this._callService('climate', 'set_fan_mode', {
      entity_id: this.config.entity,
      fan_mode: fanMode,
    });
  }
}

if (!customElements.get('aircon-control-card')) {
  customElements.define('aircon-control-card', AirconControlCard);
}
