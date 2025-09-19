class AirconControlCard extends HTMLElement {
  constructor() {
    super();
    this._localTemp = null;
    this._localSliderValues = {};
    this._sliderTimers = {};
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('You need to define an entity');
    }
    this.config = config;
    this.showModeNames = config.show_mode_names !== false;

    // Add default global room slider color if provided, or fallback
    this.config.room_slider_color = config.room_slider_color || '#3399ff';  // a deeper blue
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

    // Sensors
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

    // Mode buttons
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

    // Fan speed buttons (if used)
    let fanSpeedButtons = '<div class="fan-modes">';
    fanModes.forEach(fm => {
      const sel = (currentFanMode && currentFanMode.toLowerCase() === fm.toLowerCase()) ? 'fan-selected' : '';
      const color = sel ? glowColor : '#ccc';
      fanSpeedButtons += `
        <button class="fan-btn ${sel}" data-fan-mode="${fm}" style="color:${color}">
          <span class="fan-name">${fm.charAt(0).toUpperCase() + fm.slice(1)}</span>
        </button>`;
    });
    fanSpeedButtons += '</div>';

    // Room sliders + controls
    let roomControls = '';
    if (cfg.rooms && Array.isArray(cfg.rooms)) {
      roomControls += '<div class="room-section">';
      cfg.rooms.forEach(room => {
        // Defensive checks
        if (!room.slider_entity) return;

        const sliderEnt = hass.states[room.slider_entity];
        const sensorEnt = room.sensor_entity ? hass.states[room.sensor_entity] : null;
        let sliderVal = 0;
        if (sliderEnt) {
          if (sliderEnt.attributes && sliderEnt.attributes.current_position != null) {
            sliderVal = parseInt(sliderEnt.attributes.current_position) || 0;
          } else if (!isNaN(Number(sliderEnt.state))) {
            sliderVal = Number(sliderEnt.state);
          }
        }
        sliderVal = Math.max(0, Math.min(100, sliderVal));
        const sensorVal = (sensorEnt && !isNaN(Number(sensorEnt.state))) ? Number(sensorEnt.state) : null;

        const entityId = room.slider_entity;
        const localVal = this._localSliderValues[entityId] != null ? this._localSliderValues[entityId] : sliderVal;

        // Determine slider color: per-room override, or global, or default
        const sliderColor = room.color || cfg.room_slider_color || '#3399ff';

        roomControls += `
          <div class="room-block">
            <input
              type="range"
              class="styled-room-slider no-thumb"
              min="0" max="100" step="1"
              value="${localVal}"
              data-entity="${entityId}"
              style="--percent:${localVal}%; --fill-color:${sliderColor};"
            />
            <div class="slider-info">
              <span class="slider-name">${room.name}</span>
              <span class="slider-status">${localVal}%</span>
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
          background: var(--card-background-color, #000);
          color: var(--primary-text-color, white);
          border-radius: 12px;
          padding: 16px;
          display: block;
          max-width: 360px;
          user-select: none;
          transition: background-color 0.3s ease;
        }
        .sensor-line {
          font-size: 14px;
          color: var(--secondary-text-color, #aaa);
          margin-bottom: 12px;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
        }
        .sensor-line ha-icon {
          font-size: 16px;
          opacity: 0.8;
        }
        /* nicer icon colors */
        .sensor-line ha-icon[icon*="home"] {
          color: var(--accent-color, #4caf50);
        }
        .sensor-line ha-icon[icon*="weather"] {
          color: var(--primary-color, #2196F3);
        }
        .sensor-line ha-icon[icon*="solar"] {
          color: var(--warning-color, #ff9800);
        }

        .room-section {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .room-block {
          position: relative;
          width: 100%;
        }
        .styled-room-slider {
          width: 100%;
          height: 28px;
          -webkit-appearance: none;
          appearance: none;
          border-radius: 12px;
          background: linear-gradient(
            to right,
            var(--fill-color, #3399ff) 0%,
            var(--fill-color, #3399ff) var(--percent),
            #333 var(--percent),
            #333 100%
          );
          outline: none;
          margin: 0;
          transition: background 0.3s ease;
        }
        .styled-room-slider.no-thumb::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 0;
          height: 0;
        }
        .styled-room-slider.no-thumb::-moz-range-thumb {
          width: 0;
          height: 0;
        }
        .slider-info {
          margin-top: 4px;
          display: flex;
          justify-content: space-between;
          font-size: 14px;
          color: var(--primary-text-color, white);
        }
        .slider-name {
          flex: 1;
        }
        .slider-status {
          width: 50px;
          text-align: right;
        }
        .slider-temp {
          width: 50px;
          text-align: center;
        }
      </style>

      <div class="temp-setpoint-wrapper">
        <button class="setpoint-button" id="dec-setpoint">−</button>
        <div class="temp-circle-container ${powerOn ? 'glow' : ''}">
          <!-- your glow bottom etc here, circle, mode etc -->
          <div class="glow-bottom"></div>
          <div class="temp-circle">
            <div class="reflection"></div>
            <div class="temp-value">${displayTemp.toFixed(1)}°C</div>
            <div class="mode-in-circle">
              <ha-icon icon="${modeData[currentMode]?.icon}"></ha-icon>
              <span>${modeData[currentMode]?.name}</span>
            </div>
          </div>
        </div>
        <button class="setpoint-button" id="inc-setpoint">+</button>
      </div>

      ${sensorLine}
      ${modeButtons}
      ${fanSpeedButtons}
      ${roomControls}
    `;

    // Event listeners for setpoint buttons (increase / decrease) etc
    this.querySelector('#dec-setpoint')?.addEventListener('click', () => {
      let nt = this._localTemp ?? displayTemp;
      nt = nt - 1;
      if (nt < minTemp) nt = minTemp;
      this._localTemp = nt;
      hass.callService('climate', 'set_temperature', {
        entity_id: cfg.entity,
        temperature: nt
      });
    });
    this.querySelector('#inc-setpoint')?.addEventListener('click', () => {
      let nt = this._localTemp ?? displayTemp;
      nt = nt + 1;
      if (nt > maxTemp) nt = maxTemp;
      this._localTemp = nt;
      hass.callService('climate', 'set_temperature', {
        entity_id: cfg.entity,
        temperature: nt
      });
    });

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

    this.querySelectorAll('.styled-room-slider.no-thumb').forEach(slider => {
      const entityId = slider.getAttribute('data-entity');
      slider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        slider.style.setProperty('--percent', `${val}%`);
        this._localSliderValues[entityId] = val;

        if (this._sliderTimers[entityId]) {
          clearTimeout(this._sliderTimers[entityId]);
        }
        this._sliderTimers[entityId] = setTimeout(() => {
          hass.callService('cover', 'set_cover_position', {
            entity_id: entityId,
            position: val
          });
        }, 500); // delay to reduce flicker
      });
    });
  }

  getCardSize() {
    return 6;
  }
}

if (!customElements.get('aircon-control-card')) {
  customElements.define('aircon-control-card', AirconControlCard);
}
