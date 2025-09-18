class AirconControlCard extends HTMLElement {
  constructor() {
    super();
    this._localTemp = null;
    this._debounceTimers = {};
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

    // Get min/max/current temp
    const minTemp = climate.attributes.min_temp ?? 16;
    const maxTemp = climate.attributes.max_temp ?? 30;
    const currentTemp = climate.attributes.temperature ?? climate.attributes.current_temperature ?? minTemp;

    if (this._localTemp !== null && Math.abs(this._localTemp - currentTemp) < 0.1) {
      this._localTemp = null;
    }
    const displayTemp = this._localTemp !== null ? this._localTemp : currentTemp;

    const currentMode = climate.attributes.hvac_mode ?? climate.state;
    const powerOn = climate.state !== 'off';

    const fanModes = climate.attributes.fan_modes ?? [];
    const currentFanMode = climate.attributes.fan_mode ?? null;

    // Mode data with colors (warm sand for off)
    const modeData = {
      off:      { icon: 'mdi:power',         color: '#cbb289',       name: 'Off' },          // warm sand
      cool:     { icon: 'mdi:snowflake',     color: '#2196F3',       name: 'Cool' },
      heat:     { icon: 'mdi:fire',          color: '#F44336',       name: 'Heat' },
      fan_only: { icon: 'mdi:fan',           color: '#9E9E9E',       name: 'Fan' },
      dry:      { icon: 'mdi:water-percent',  color: '#009688',       name: 'Dry' },
      auto:     { icon: 'mdi:autorenew',     color: '#FFC107',       name: 'Auto' },
    };

    // Glow color for selected mode
    const glowColor = modeData[currentMode]?.color ?? '#16a085';

    // Helper to get sensor state, returns null if unknown/unavailable
    const getState = (id) => {
      const s = hass.states[id];
      if (!s || s.state === 'unknown' || s.state === 'unavailable') return null;
      return s.state;
    };

    // Sensors for solar, house temp/hum, outside temp/hum
    const sensorSolar = cfg.solar_sensor ? getState(cfg.solar_sensor) : null;
    const sensorHouseTemp = cfg.house_temp_sensor ? getState(cfg.house_temp_sensor) : null;
    const sensorHouseHum = cfg.house_humidity_sensor ? getState(cfg.house_humidity_sensor) : null;
    const sensorOutsideTemp = cfg.outside_temp_sensor ? getState(cfg.outside_temp_sensor) : null;
    const sensorOutsideHum = cfg.outside_humidity_sensor ? getState(cfg.outside_humidity_sensor) : null;

    // Combine house temp/humidity into one display
    let houseTempHum = '';
    if (sensorHouseTemp !== null && sensorHouseHum !== null) {
      houseTempHum = `<ha-icon icon="mdi:home-outline"></ha-icon> ${sensorHouseTemp}°C / ${sensorHouseHum}%`;
    } else if (sensorHouseTemp !== null) {
      houseTempHum = `<ha-icon icon="mdi:home-outline"></ha-icon> ${sensorHouseTemp}°C`;
    } else if (sensorHouseHum !== null) {
      houseTempHum = `<ha-icon icon="mdi:water-percent"></ha-icon> ${sensorHouseHum}%`;
    }

    // Sensor line parts
    const sensorParts = [];
    if (houseTempHum) sensorParts.push(houseTempHum);
    if (sensorOutsideTemp !== null) sensorParts.push(`<ha-icon icon="mdi:weather-sunny"></ha-icon> ${sensorOutsideTemp}°C`);
    if (sensorOutsideHum !== null) sensorParts.push(`<ha-icon icon="mdi:water-percent"></ha-icon> ${sensorOutsideHum}%`);
    if (sensorSolar !== null) sensorParts.push(`<ha-icon icon="mdi:solar-power"></ha-icon> ${sensorSolar}`);

    const sensorLine = sensorParts.length ? `<div class="sensor-line">${sensorParts.join(' | ')}</div>` : '';

    // Mode buttons with colors and mode names below icons
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

    // Fan speed buttons, selected fan mode colored by glowColor
    let fanSpeedButtons = '<div class="fan-modes">';
    fanModes.forEach(fm => {
      const sel = (currentFanMode && currentFanMode.toLowerCase() === fm.toLowerCase()) ? 'fan-selected' : '';
      fanSpeedButtons += `
        <button class="fan-btn ${sel}" data-fan-mode="${fm}" style="${ sel ? `color:${glowColor}` : 'color:#ccc' }">
          <span class="fan-name">${fm.charAt(0).toUpperCase() + fm.slice(1)}</span>
        </button>`;
    });
    fanSpeedButtons += '</div>';

    // Room sliders, only show if sensor_entity given
    let roomControls = '';
    if (cfg.rooms && Array.isArray(cfg.rooms)) {
      roomControls += '<div class="room-section">';
      cfg.rooms.forEach(room => {
        if (!room.sensor_entity) return; // skip if no sensor_entity

        const sliderEnt = hass.states[room.slider_entity];
        const sensorEnt = hass.states[room.sensor_entity];
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

        // Determine if sensorVal is temp (basic check)
        const isTemp = sensorVal !== null && sensorVal >= -20 && sensorVal <= 50;

        // slider info placement: center if temp, else right
        const sliderStatusStyle = isTemp ? 'slider-status center' : 'slider-status right';

        roomControls += `
          <div class="room-block">
            <input
              type="range"
              class="styled-room-slider"
              min="0" max="100" step="1"
              value="${sliderVal}"
              data-entity="${room.slider_entity}"
              style="--percent:${sliderVal}%; --fill-color:${glowColor};"
            />
            <div class="slider-info">
              <span class="slider-name">${room.name}</span>
              <span class="${sliderStatusStyle}">${sliderVal}%</span>
              <span class="slider-temp">${ isTemp ? sensorVal.toFixed(1) + '°C' : '' }</span>
            </div>
          </div>`;
      });
      roomControls += '</div>';
    }

    // Set the innerHTML
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

        /* Modes and Fan Buttons */

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
          padding: 4px;
          border-radius: 6px;
        }
        .mode-btn.mode-selected, .fan-btn.fan-selected {
          color: var(--glow-color);
        }
        .mode-btn:hover:not(.mode-selected), .fan-btn:hover:not(.fan-selected) {
          color: var(--glow-color);
        }
        .mode-btn ha-icon, .fan-btn ha-icon {
          font-size: 28px;
          transition: color 0.3s;
        }
        .mode-name, .fan-name {
          font-size: 12px;
          user-select: none;
        }

        /* Color + / - buttons with warm sand and heat/cool colors */

        .temp-setpoint-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 20px;
          margin-bottom: 16px;
        }
        .setpoint-button {
          width: 36px;
          height: 36px;
          background: #333;
          border-radius: 50%;
          font-size: 24px;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background-color 0.3s;
          user-select: none;
        }
        .setpoint-button:hover {
          filter: brightness(1.2);
        }
        #dec-setpoint {
          background-color: #F44336; /* red */
        }
        #dec-setpoint:hover {
          background-color: #D32F2F;
        }
        #inc-setpoint {
          background-color: #FF9800; /* orange */
        }
        #inc-setpoint:hover {
          background-color: #F57C00;
        }

        /* Temperature Circle with pulsing half-glow */

        .temp-circle {
          width: 140px;
          height: 140px;
          background: #222;
          border-radius: 50%;
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 0 10px #000;
          user-select: none;
        }

        /* The half glowing arc, pulsing */

        .temp-circle::before {
          content: '';
          position: absolute;
          top: -12px;
          left: 50%;
          width: 140px;
          height: 140px;
          border-radius: 50%;
          box-sizing: border-box;
          border: 8px solid transparent;
          border-top-color: var(--glow-color);
          border-left-color: var(--glow-color);
          border-right-color: transparent;
          border-bottom-color: transparent;
          transform: translateX(-50%) rotate(45deg);
          filter: drop-shadow(0 0 8px var(--glow-color));
          animation: pulseGlow 2.5s infinite ease-in-out;
          pointer-events: none;
          z-index: 0;
        }

        @keyframes pulseGlow {
          0%, 100% {
            filter: drop-shadow(0 0 10px var(--glow-color));
          }
          50% {
            filter: drop-shadow(0 0 18px var(--glow-color));
          }
        }

        .temp-value {
          font-size: 48px;
          font-weight: 700;
          color: white;
          z-index: 1;
          user-select: none;
        }

        .mode-in-circle {
          margin-top: 8px;
          color: var(--glow-color);
          font-weight: 600;
          display: flex;
          flex-direction: column;
          align-items: center;
          z-index: 1;
          user-select: none;
        }
        .mode-in-circle ha-icon {
          font-size: 30px;
          margin-bottom: 2px;
        }

        /* Sensor line */

        .sensor-line {
          font-size: 12px;
          color: #bbb;
          margin-bottom: 10px;
          display: flex;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
          user-select: none;
        }
        .sensor-line ha-icon {
          vertical-align: middle;
          font-size: 16px;
          margin-right: 4px;
          color: #aaa;
        }

        /* Room sliders */

        .room-section {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          user-select: none;
        }
        .room-block {
          display: flex;
          flex-direction: column;
          gap: 4px;
          color: white;
        }
        input.styled-room-slider {
          -webkit-appearance: none;
          width: 100%;
          height: 22px;
          background: #444;
          border-radius: 12px;
          outline: none;
          position: relative;
          overflow: visible;
          cursor: pointer;
        }
        /* Slider fill styling */

        input.styled-room-slider::-webkit-slider-runnable-track {
          height: 22px;
          background: linear-gradient(to right, var(--fill-color) var(--percent), #444 var(--percent));
          border-radius: 12px;
        }
        input.styled-room-slider::-moz-range-track {
          height: 22px;
          background: linear-gradient(to right, var(--fill-color) var(--percent), #444 var(--percent));
          border-radius: 12px;
        }

        input.styled-room-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 28px;
          height: 28px;
          background: var(--fill-color);
          border-radius: 50%;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 8px var(--fill-color);
          margin-top: -3px;
          transition: background-color 0.3s;
          position: relative;
          z-index: 1;
        }
        input.styled-room-slider::-moz-range-thumb {
          width: 28px;
          height: 28px;
          background: var(--fill-color);
          border-radius: 50%;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 8px var(--fill-color);
          position: relative;
          z-index: 1;
        }
        input.styled-room-slider:focus::-webkit-slider-thumb {
          box-shadow: 0 0 14px 3px var(--fill-color);
        }
        input.styled-room-slider:focus::-moz-range-thumb {
          box-shadow: 0 0 14px 3px var(--fill-color);
        }

        /* Slider info below slider */

        .slider-info {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          user-select: none;
          color: white;
        }
        .slider-name {
          flex: 1;
          user-select: none;
        }
        .slider-status {
          width: 40px;
          text-align: center;
          font-weight: 600;
          user-select: none;
        }
        .slider-status.center {
          width: 40px;
          margin: 0 auto;
          text-align: center;
        }
        .slider-status.right {
          text-align: right;
        }
        .slider-temp {
          margin-left: 10px;
          font-weight: 600;
          color: #ddd;
          user-select: none;
          min-width: 40px;
          text-align: right;
        }
      </style>

      ${modeButtons}
      ${fanSpeedButtons}

      <div class="temp-setpoint-wrapper">
        <button class="setpoint-button" id="dec-setpoint" title="Decrease Temperature">−</button>
        <div class="temp-circle" style="--glow-color:${glowColor}">
          <div class="temp-value">${displayTemp.toFixed(1)}°C</div>
          <div class="mode-in-circle">
            <ha-icon icon="${modeData[currentMode]?.icon || 'mdi:power'}"></ha-icon>
            <span>${modeData[currentMode]?.name || currentMode}</span>
          </div>
        </div>
        <button class="setpoint-button" id="inc-setpoint" title="Increase Temperature">+</button>
      </div>

      ${sensorLine}

      ${roomControls}
    `;

    // Store reference to hass for event handlers
    const hassRef = hass;

    // Event handlers for mode buttons
    this.querySelectorAll('.mode-btn').forEach(btn => {
      btn.onclick = () => {
        const mode = btn.getAttribute('data-mode');
        if (mode === 'off') {
          hassRef.callService('climate', 'turn_off', { entity_id: cfg.entity });
        } else {
          hassRef.callService('climate', 'set_hvac_mode', { entity_id: cfg.entity, hvac_mode: mode });
        }
      };
    });

    // Fan buttons event handlers
    this.querySelectorAll('.fan-btn').forEach(btn => {
      btn.onclick = () => {
        const fanMode = btn.getAttribute('data-fan-mode');
        hassRef.callService('climate', 'set_fan_mode', { entity_id: cfg.entity, fan_mode: fanMode });
      };
    });

    // Increment/decrement temperature buttons
    this.querySelector('#dec-setpoint').onclick = () => {
      let newTemp = displayTemp - 0.5;
      if (newTemp < minTemp) newTemp = minTemp;
      this._localTemp = newTemp;
      hassRef.callService('climate', 'set_temperature', { entity_id: cfg.entity, temperature: newTemp });
    };
    this.querySelector('#inc-setpoint').onclick = () => {
      let newTemp = displayTemp + 0.5;
      if (newTemp > maxTemp) newTemp = maxTemp;
      this._localTemp = newTemp;
      hassRef.callService('climate', 'set_temperature', { entity_id: cfg.entity, temperature: newTemp });
    };

    // Room sliders input event handlers with debounce and update style
    this.querySelectorAll('.styled-room-slider').forEach(slider => {
      const entityId = slider.getAttribute('data-entity');
      slider.addEventListener('input', e => {
        const val = Number(e.target.value);
        e.target.style.setProperty('--percent', `${val}%`);

        // Update slider status text inside the slider-info div
        const parent = e.target.parentElement;
        if (!parent) return;
        const statusSpan = parent.querySelector('.slider-status');
        if (statusSpan) {
          // If center class, center the status above thumb roughly
          if (statusSpan.classList.contains('center')) {
            // position approx middle of slider thumb
            statusSpan.style.marginLeft = `calc(${val}% - 20px)`;
          } else {
            statusSpan.style.marginLeft = '0';
          }
          statusSpan.textContent = `${val}%`;
        }

        // Debounce service call to avoid jitter
        clearTimeout(this._debounceTimers[entityId]);
        this._debounceTimers[entityId] = setTimeout(() => {
          hassRef.callService('cover', 'set_cover_position', { entity_id: entityId, position: val });
        }, 400);
      });
    });
  }

  getCardSize() {
    return 3;
  }
}

customElements.define('aircon-control-card', AirconControlCard);
