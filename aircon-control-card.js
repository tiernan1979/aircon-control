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
      off:      { icon: 'mdi:power',         color: '#CDB79E',       name: 'Off' }, // warm sand
      cool:     { icon: 'mdi:snowflake',     color: '#2196F3',       name: 'Cool' },
      heat:     { icon: 'mdi:fire',          color: '#F44336',       name: 'Heat' },
      fan_only: { icon: 'mdi:fan',           color: '#9E9E9E',       name: 'Fan' },
      dry:      { icon: 'mdi:water-percent',  color: '#009688',      name: 'Dry' },
      auto:     { icon: 'mdi:autorenew',     color: '#FFC107',       name: 'Auto' },
    };

    const glowColor = modeData[currentMode]?.color ?? '#16a085';

    // Sensor info
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

    // Mode + Off buttons row
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

    // Fan speed (always visible)
    let fanSpeedButtons = '<div class="fan-modes">';
    fanModes.forEach(fm => {
      const sel = (currentFanMode && currentFanMode.toLowerCase() === fm.toLowerCase()) ? 'fan-selected' : '';
      fanSpeedButtons += `
        <button class="fan-btn ${sel}" data-fan-mode="${fm}" style="${ sel ? `color:${glowColor}` : 'color:#ccc' }">
          <span class="fan-name">${fm.charAt(0).toUpperCase() + fm.slice(1)}</span>
        </button>`;
    });
    fanSpeedButtons += '</div>';

    // Room sliders, remove thumb, adjusted spacing and size, jitter fixed, only show if sensor_entity present
    let roomControls = '';
    if (cfg.rooms && Array.isArray(cfg.rooms)) {
      roomControls += '<div class="room-section">';
      cfg.rooms.forEach(room => {
        const sliderEnt = hass.states[room.slider_entity];
        const sensorEnt = hass.states[room.sensor_entity];
        if (!sensorEnt) return; // Skip if sensor_entity not provided or unavailable

        let sliderVal = 0;
        if (sliderEnt) {
          if (sliderEnt.attributes.current_position != null) {
            sliderVal = parseInt(sliderEnt.attributes.current_position) || 0;
          } else if (!isNaN(Number(sliderEnt.state))) {
            sliderVal = Number(sliderEnt.state);
          }
        }
        sliderVal = Math.max(0, Math.min(100, sliderVal));
        const sensorVal = (sensorEnt && !isNaN(Number(sensorEnt.state))) ? Number(sensorEnt.state) : null;

        // Position the cover % based on presence of temperature sensorVal
        const percentPositionClass = sensorVal !== null ? 'percent-center' : 'percent-right';

        roomControls += `
          <div class="room-block">
            <input
              type="range"
              class="styled-room-slider"
              min="0" max="100" step="1"
              value="${sliderVal}"
              data-entity="${room.slider_entity}"
              style="--percent:${sliderVal}%; --fill-color:${glowColor}"
            />
            <div class="slider-info">
              <span class="slider-name">${room.name}</span>
              <span class="slider-status ${percentPositionClass}">${sliderVal}%</span>
              ${ sensorVal !== null ? `<span class="slider-temp">${sensorVal.toFixed(1)}°C</span>` : `` }
            </div>
          </div>`;
      });
      roomControls += '</div>';
    }

    this.innerHTML = `
      <style>
        :host {
          font-family: 'Roboto', sans-serif;
          background: #000;
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
        }
        .mode-btn.mode-selected, .fan-btn.fan-selected {
          color: ${glowColor};
        }
        .mode-btn ha-icon, .fan-btn ha-icon {
          font-size: 24px;
        }
        .mode-name, .fan-name {
          font-size: 12px;
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
          font-size: 22px;
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
        .temp-circle {
          width: 140px;
          height: 140px;
          background: #222;
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        /* Glow only outside circle, half arc */
        .temp-circle::after {
          content: '';
          position: absolute;
          bottom: 4px;
          left: 15%;
          width: 70%;
          height: 8px;
          box-shadow: 0 0 20px 8px ${glowColor};
          border-radius: 50%;
          filter: blur(8px);
          clip-path: polygon(0% 100%, 100% 100%, 100% 50%, 0% 50%);
          /* creates glow on bottom half outside circle */
          pointer-events: none;
        }
        .temp-value {
          font-size: 32px;
          font-weight: 600;
          color: white;
        }
        .mode-in-circle {
          margin-top: 4px;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 16px;
          color: ${glowColor};
        }

        .sensor-line {
          font-size: 12px;
          color: #777;
          margin-top: 12px;
          text-align: center;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
        }
        .sensor-line ha-icon {
          font-size: 14px;
          color: #888;
        }

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
          height: 32px; /* made fatter */
          -webkit-appearance: none;
          appearance: none;
          border-radius: 16px;
          background: linear-gradient(
            to right,
            var(--fill-color) var(--percent),
            #444 var(--percent)
          );
          outline: none;
          transition: background 0.3s ease;
          margin: 0;
        }
        /* Slider thumb */
        .styled-room-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 32px;
          border-radius: 8px;
          background: ${glowColor};
          cursor: pointer;
          transition: background-color 0.3s ease;
          border: none;
          margin-top: 0px;
          position: relative;
          z-index: 10;
        }
        .styled-room-slider::-webkit-slider-thumb:hover {
          background-color: #fff;
        }
        .styled-room-slider::-moz-range-thumb {
          width: 20px;
          height: 32px;
          border-radius: 8px;
          background: ${glowColor};
          cursor: pointer;
          border: none;
          position: relative;
          z-index: 10;
        }
        .styled-room-slider::-moz-range-thumb:hover {
          background-color: #fff;
        }

        .slider-info {
          position: relative;
          height: 32px;
          display: flex;
          justify-content: flex-start;
          align-items: center;
          pointer-events: none;
          font-size: 13px;
          color: white;
          gap: 12px;
          margin-top: 4px;
        }
        .slider-name {
          flex: 1;
        }
        /* Positions for percent */
        .slider-status {
          white-space: nowrap;
          font-weight: 600;
        }
        .percent-center {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
        }
        .percent-right {
          margin-left: auto;
        }
        .slider-temp {
          white-space: nowrap;
        }

      </style>

      ${modeButtons}
      ${fanSpeedButtons}

      <div class="temp-setpoint-wrapper">
        <button class="setpoint-button" id="dec-setpoint">−</button>
        <div class="temp-circle">
          <div class="temp-value">${displayTemp.toFixed(1)}°C</div>
          <div class="mode-in-circle">
            <ha-icon icon="${modeData[currentMode]?.icon}"></ha-icon>
            <span>${modeData[currentMode]?.name}</span>
          </div>
        </div>
        <button class="setpoint-button" id="inc-setpoint">+</button>
      </div>

      ${sensorLine}

      ${roomControls}
    `;

    // Event-listeners

    this.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        if (mode === 'off') {
          hass.callService('climate', 'turn_off', { entity_id: cfg.entity });
        } else {
          hass.callService('climate', 'set_hvac_mode', {
            entity_id: cfg.entity,
            hvac_mode: mode
          });
        }
      });
    });

    this.querySelectorAll('.fan-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const fm = btn.getAttribute('data-fan-mode');
        hass.callService('climate', 'set_fan_mode', {
          entity_id: cfg.entity,
          fan_mode: fm
        });
      });
    });

    this.querySelector('#dec-setpoint').addEventListener('click', () => {
      let nt = this._localTemp ?? displayTemp;
      nt = nt - 1;
      if (nt < minTemp) nt = minTemp;
      this._localTemp = nt;
      hass.callService('climate', 'set_temperature', {
        entity_id: cfg.entity,
        temperature: nt
      });
    });

    this.querySelector('#inc-setpoint').addEventListener('click', () => {
      let nt = this._localTemp ?? displayTemp;
      nt = nt + 1;
      if (nt > maxTemp) nt = maxTemp;
      this._localTemp = nt;
      hass.callService('climate', 'set_temperature', {
        entity_id: cfg.entity,
        temperature: nt
      });
    });

    // Room slider event handling (debounced)
    let sliderTimeout;
    this.querySelectorAll('.styled-room-slider').forEach(slider => {
      slider.addEventListener('input', e => {
        const el = e.target;
        const entityId = el.getAttribute('data-entity');
        const val = Number(el.value);

        // Update slider background fill dynamically
        el.style.setProperty('--percent', `${val}%`);

        // Update the displayed percentage value
        const statusSpan = el.nextElementSibling.querySelector('.slider-status');
        if (statusSpan) statusSpan.textContent = `${val}%`;

        // Clear any previous timeout
        if (sliderTimeout) clearTimeout(sliderTimeout);
        sliderTimeout = setTimeout(() => {
          this._localTemp = null; // reset local temp so display is accurate
          hass.callService('cover', 'set_cover_position', {
            entity_id: entityId,
            position: val
          });
        }, 300);
      });
    });
  }

  getCardSize() {
    return 4;
  }
}

customElements.define('aircon-control-card', AirconControlCard);
