class AirconControlCard extends HTMLElement {
  constructor() {
    super();
    this._localTemp = null;
    this._localSliderValues = {}; // ← stores temporary slider states
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

        // Get local color override or fallback
        const sliderColor = room.color ?? this.config.slider_color ?? '#1B86EF';
        const gradientStart = shadeColor(sliderColor, -40);

        // Generate a dynamic gradient using sliderColor
        const sliderGradient = `linear-gradient(to right, ${shadeColor(sliderColor, -30)}, ${sliderColor}, ${shadeColor(sliderColor, 20)})`;

        roomControls += `
          <div class="room-block">
            <input
              type="range"
              class="styled-room-slider no-thumb"
              min="0" max="100" step="1"
              value="${this._localSliderValues[room.slider_entity] ?? sliderVal}"
              data-entity="${room.slider_entity}"
              style="--percent:${sliderVal}%; --gradient-start:${gradientStart}; --gradient-end:${sliderColor};"
            />
            <div class="slider-info">
              <span class="slider-name">${room.name}</span>
              ${
                sensorVal !== null
                  ? `<span class="slider-temp">${sensorVal.toFixed(1)}°C</span>`
                  : `<span class="slider-temp"></span>`
              }
              <span class="slider-status">${sliderVal}%</span>
            </div>
          </div>`;
      });
      roomControls += '</div>';
    }

    this.innerHTML = `
      <style>
        :host {
          font-family: 'Roboto', sans-serif;
          background: var(--card-background-color, #000);
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
          font-size: 14px;
        }

        .mode-btn.mode-selected, .fan-btn.fan-selected {
          color: ${glowColor};
        }

        .mode-btn ha-icon, .fan-btn ha-icon {
          font-size: 26px;
        }

        .mode-name, .fan-name {
          font-size: 14px;
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
          margin: 0 16px;
        }

        .temp-circle-container.glow .glow-bottom {
          opacity: 0.6;
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
          filter: blur(14px);
          opacity: 0.2;
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
            radial-gradient(circle at 60% 60%, rgba(255,105,180, 0.2), transparent 70%),
            radial-gradient(circle at 30% 30%, rgba(186,85,211, 0.3), transparent 70%),
            radial-gradient(circle at center, #0a0a0a 40%, #111 90%);
          box-shadow:
            0 0 10px ${glowColor},
            inset 0 0 25px #000;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
          font-weight: 600;
          color: white;
          user-select: none;
        }

        @keyframes glowPulse {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.6; }
        }

        .sensor-line {
          font-size: 12px;
          text-align: center;
          color: #aaa;
          margin-bottom: 16px;
          display: flex;
          justify-content: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .sensor-line ha-icon {
          vertical-align: middle;
          height: 14px;
          width: 14px;
          fill: currentColor;
        }

        .room-section {
          margin-top: 12px;
        }

        .room-block {
          margin-bottom: 12px;
          user-select: none;
        }

        .styled-room-slider {
          width: 100%;
          -webkit-appearance: none;
          height: 8px;
          border-radius: 6px;
          background: linear-gradient(to right, var(--gradient-start), var(--gradient-end));
          outline: none;
          cursor: pointer;
          transition: background 0.3s ease;
          position: relative;
        }

        /* Remove thumb */
        .styled-room-slider.no-thumb::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 0;
          height: 0;
          cursor: pointer;
        }
        .styled-room-slider.no-thumb::-moz-range-thumb {
          width: 0;
          height: 0;
          cursor: pointer;
          border: none;
        }

        .slider-info {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          color: #eee;
          margin-top: 4px;
        }

        .slider-name {
          font-weight: 600;
          color: white;
        }

        .slider-temp, .slider-status {
          font-weight: 600;
        }

      </style>

      <div class="sensor-line">${sensorLine}</div>

      ${modeButtons}

      <div class="temp-setpoint-wrapper">
        <button class="setpoint-button" id="temp-down" title="Lower Temp">-</button>
        <div class="temp-circle-container ${powerOn ? 'glow' : ''}">
          <div class="glow-bottom"></div>
          <div class="temp-circle">${displayTemp.toFixed(1)}°C</div>
        </div>
        <button class="setpoint-button" id="temp-up" title="Increase Temp">+</button>
      </div>

      ${fanSpeedButtons}

      ${roomControls}
    `;

    // Button event listeners for mode buttons
    this.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const mode = e.currentTarget.getAttribute('data-mode');
        hass.callService('climate', 'set_hvac_mode', {
          entity_id: cfg.entity,
          hvac_mode: mode,
        });
      });
    });

    // Fan mode buttons
    this.querySelectorAll('.fan-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const fm = e.currentTarget.getAttribute('data-fan-mode');
        hass.callService('climate', 'set_fan_mode', {
          entity_id: cfg.entity,
          fan_mode: fm,
        });
      });
    });

    // Temp up/down buttons
    this.querySelector('#temp-up').addEventListener('click', () => {
      const newTemp = Math.min(displayTemp + 0.5, maxTemp);
      this._localTemp = newTemp;
      hass.callService('climate', 'set_temperature', {
        entity_id: cfg.entity,
        temperature: newTemp,
      });
    });

    this.querySelector('#temp-down').addEventListener('click', () => {
      const newTemp = Math.max(displayTemp - 0.5, minTemp);
      this._localTemp = newTemp;
      hass.callService('climate', 'set_temperature', {
        entity_id: cfg.entity,
        temperature: newTemp,
      });
    });

    // ROOM SLIDERS - important fix for sliding issue:

    this._sliderDragging = this._sliderDragging || {};

    this.querySelectorAll('.styled-room-slider.no-thumb').forEach(slider => {
      const entityId = slider.getAttribute('data-entity');

      // Initialize dragging flag if not yet
      if (this._sliderDragging[entityId] === undefined) {
        this._sliderDragging[entityId] = false;
      }

      const sliderEnt = hass.states[entityId];
      let sliderVal = 0;
      if (sliderEnt) {
        if (sliderEnt.attributes.current_position != null) {
          sliderVal = parseInt(sliderEnt.attributes.current_position) || 0;
        } else if (!isNaN(Number(sliderEnt.state))) {
          sliderVal = Number(sliderEnt.state);
        }
      }
      sliderVal = Math.max(0, Math.min(100, sliderVal));

      // Only update slider UI if not dragging
      if (!this._sliderDragging[entityId]) {
        const localVal = this._localSliderValues[entityId];
        const displayVal = (localVal !== undefined) ? localVal : sliderVal;
        slider.value = displayVal;
        slider.style.setProperty('--percent', `${displayVal}%`);
        const sliderStatus = slider.parentElement.querySelector('.slider-status');
        if (sliderStatus) {
          sliderStatus.textContent = `${displayVal}%`;
        }
      }

      // Pointer events to track dragging state
      slider.addEventListener('pointerdown', () => {
        this._sliderDragging[entityId] = true;
      });

      slider.addEventListener('pointerup', () => {
        this._sliderDragging[entityId] = false;
      });

      slider.addEventListener('pointercancel', () => {
        this._sliderDragging[entityId] = false;
      });

      slider.addEventListener('pointerleave', () => {
        this._sliderDragging[entityId] = false;
      });

      slider.addEventListener('input', e => {
        const val = Number(e.target.value);
        this._localSliderValues[entityId] = val;
        e.target.style.setProperty('--percent', `${val}%`);
        const statusEl = e.target.parentElement.querySelector('.slider-status');
        if (statusEl) {
          statusEl.textContent = `${val}%`;
        }
      });

      slider.addEventListener('change', e => {
        const val = Number(e.target.value);
        this._localSliderValues[entityId] = undefined;
        hass.callService('cover', 'set_cover_position', {
          entity_id: entityId,
          position: val,
        });
      });
    });
  }
}

customElements.define('aircon-control-card', AirconControlCard);

// Helper function to shade color for slider gradient and glow effect
function shadeColor(color, percent) {
  // color in #RRGGBB format, percent from -100 to 100
  let R = parseInt(color.substring(1,3),16);
  let G = parseInt(color.substring(3,5),16);
  let B = parseInt(color.substring(5,7),16);

  R = parseInt(R * (100 + percent) / 100);
  G = parseInt(G * (100 + percent) / 100);
  B = parseInt(B * (100 + percent) / 100);

  R = (R<255)?R:255;
  G = (G<255)?G:255;
  B = (B<255)?B:255;

  const RR = (R.toString(16).length===1)?"0"+R.toString(16):R.toString(16);
  const GG = (G.toString(16).length===1)?"0"+G.toString(16):G.toString(16);
  const BB = (B.toString(16).length===1)?"0"+B.toString(16):B.toString(16);

  return "#"+RR+GG+BB;
}
