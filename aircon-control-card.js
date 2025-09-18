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

    // Mode icons (Material Design Icons)
    const modeIcons = {
      cool: 'mdi:snowflake',
      heat: 'mdi:fire',
      fan_only: 'mdi:fan',
      dry: 'mdi:weather-pouring',
      auto: 'mdi:autorenew',
    };

    // Power icon
    const powerIcon = climate.state === 'off' ? 'mdi:power-off' : 'mdi:power';

    // Glow colors for modes
    const modeGlowColors = {
      cool: '#3fc3ff',
      heat: '#ff5e57',
      fan_only: '#8fbc8f',
      dry: '#a9a9a9',
      auto: '#f1c40f',
      off: '#444',
    };

    // Use mode glow or off color
    const glowColor = modeGlowColors[currentMode] || modeGlowColors.off;

    // Generate mode buttons with icon or name depending on config
    const showModeIcons = config.show_mode_icons !== false; // default true
    let modeButtons = '<div class="modes">';
    modes.forEach(mode => {
      const selected = currentMode === mode ? 'mode-selected' : '';
      if (showModeIcons) {
        modeButtons += `<button class="mode-btn ${selected}" data-mode="${mode}" title="${mode}">
          <ha-icon icon="${modeIcons[mode]}"></ha-icon>
        </button>`;
      } else {
        modeButtons += `<button class="mode-btn ${selected}" data-mode="${mode}">${mode}</button>`;
      }
    });
    modeButtons += '</div>';

    // Power button content: icon or text
    const showPowerIcon = config.show_power_icon !== false; // default true
    const powerContent = showPowerIcon
      ? `<ha-icon icon="${powerIcon}"></ha-icon>`
      : (climate.state === 'off' ? 'Turn On' : 'Turn Off');

    // Generate room sliders styled like big-slider-card with info inside slider bar
    let roomControls = '';
    if (config.rooms && Array.isArray(config.rooms)) {
      roomControls += '<div class="room-section">';
      config.rooms.forEach(room => {
        const sliderEnt = hass.states[room.slider_entity];
        const sensorEnt = hass.states[room.sensor_entity];
        const sliderValRaw = sliderEnt ? (sliderEnt.attributes.current_position ?? sliderEnt.state) : 0;
        const sliderVal = parseInt(sliderValRaw);
        const sensorVal = sensorEnt ? parseFloat(sensorEnt.state) : null;
        const min = sliderEnt?.attributes?.min ?? 0;
        const max = sliderEnt?.attributes?.max ?? 100;

        // Handle NaN gracefully
        const safeSliderVal = isNaN(sliderVal) ? 0 : sliderVal;

        roomControls += `
          <div class="room-slider-wrapper">
            <input
              type="range"
              class="styled-room-slider"
              data-entity="${room.slider_entity}"
              min="${min}"
              max="${max}"
              step="1"
              value="${safeSliderVal}"
              style="--percent:${safeSliderVal}%;"
              aria-label="${room.name} Cover"
            >
            <div class="slider-labels">
              <div class="label-name">${room.name}</div>
              <div class="label-status">${safeSliderVal === 0 ? 'Closed' : safeSliderVal === 100 ? 'Open' : safeSliderVal + '%'}</div>
              <div class="label-temp">${sensorVal !== null && !isNaN(sensorVal) ? sensorVal.toFixed(1) + '°C' : 'N/A'}</div>
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
          background: #263238;
          color: white;
          border-radius: 12px;
          padding: 16px;
          display: block;
          max-width: 360px;
          user-select: none;
        }

        ha-icon {
          width: 20px;
          height: 20px;
          color: white;
          vertical-align: middle;
          pointer-events: none;
        }

        /* House temp at top */
        .house-temp {
          font-size: 14px;
          color: #bbb;
          text-align: center;
          margin-bottom: 12px;
          user-select: text;
          font-weight: 500;
        }

        /* Big circle with dark grey background */
        .temp-wrapper {
          position: relative;
          margin: 0 auto 14px;
          width: 120px;
          height: 120px;
          border-radius: 50%;
          background: #111214;
          box-shadow:
            0 6px 14px -4px var(--glow-color),
            0 10px 20px -10px var(--glow-color);
          display: flex;
          align-items: center;
          justify-content: center;
          user-select: none;
        }

        /* Bottom-only glow: create a pseudo-element */
        .temp-wrapper::after {
          content: '';
          position: absolute;
          bottom: 4px;
          left: 50%;
          transform: translateX(-50%);
          width: 100px;
          height: 40px;
          pointer-events: none;
          filter: blur(18px);
          background-color: var(--glow-color);
          border-radius: 50%;
          opacity: 0.5;
          z-index: 0;
        }

        /* Temperature text */
        .temp {
          font-size: 48px;
          font-weight: 700;
          color: white;
          z-index: 1;
          user-select: none;
        }

        /* Power button smaller */
        #power {
          width: 36px;
          height: 36px;
          background: #16a085;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          margin: 0 auto 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.3s ease;
          user-select: none;
          color: white;
        }
        #power:hover {
          background: #1abc9c;
        }
        #power ha-icon {
          width: 22px;
          height: 22px;
          color: white;
        }

        /* Mode buttons */
        .modes {
          text-align: center;
          margin: 10px 0 18px;
        }
        .modes button {
          margin: 5px 6px;
          padding: 6px 10px;
          border-radius: 16px;
          background: #34495e;
          color: white;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-weight: 500;
          user-select: none;
          transition: background-color 0.3s ease;
          cursor: pointer;
          border: none;
          outline: none;
          min-width: 40px;
          height: 36px;
        }
        .modes button:hover {
          background: #1abc9c;
          color: white;
        }
        .mode-selected {
          background: #1abc9c !important;
          font-weight: bold;
          text-decoration: underline;
          color: white !important;
        }
        .modes button ha-icon {
          width: 20px;
          height: 20px;
          pointer-events: none;
        }

        /* Info line under modes */
        .info-line {
          text-align: center;
          font-size: 14px;
          color: #ccc;
          margin: 12px 0 16px;
          user-select: none;
        }

        /* Rooms section */
        .room-section {
          margin-top: 0;
        }
        .room-slider-wrapper {
          margin-bottom: 24px;
          user-select: none;
        }

        /* Big slider style */
        .styled-room-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 36px;
          background: linear-gradient(to right, #1abc9c 0%, #1abc9c var(--percent), #555 var(--percent), #555 100%);
          border-radius: 18px;
          outline: none;
          cursor: pointer;
          position: relative;
          transition: background 0.3s ease;
        }
        .styled-room-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 28px;
          height: 28px;
          background: #1abc9c;
          border-radius: 50%;
          border: 2px solid white;
          cursor: pointer;
          position: relative;
          z-index: 3;
          margin-top: -12px;
          transition: background-color 0.3s ease;
        }
        .styled-room-slider::-moz-range-thumb {
          width: 28px;
          height: 28px;
          background: #1abc9c;
          border-radius: 50%;
          border: 2px solid white;
          cursor: pointer;
          position: relative;
          z-index: 3;
          transition: background-color 0.3s ease;
        }
        .styled-room-slider:hover::-webkit-slider-thumb {
          background: #16a085;
        }
        .styled-room-slider:hover::-moz-range-thumb {
          background: #16a085;
        }

        /* Slider labels inside the slider container but below the bar */
        .slider-labels {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          color: #ddd;
          margin-top: 6px;
          padding: 0 6px;
          user-select: text;
        }
        .label-name {
          font-weight: 600;
          flex: 1;
          text-align: left;
          color: #a9d5d3;
        }
        .label-status {
          flex: 0 0 50px;
          text-align: center;
          color: #ccc;
          font-weight: 500;
        }
        .label-temp {
          flex: 0 0 50px;
          text-align: right;
          color: #ccc;
        }

      </style>

      <div class="house-temp">House Temp: ${houseTemp}°C</div>

      <button id="power" title="${climate.state === 'off' ? 'Turn On' : 'Turn Off'}">${powerContent}</button>

      <div class="temp-wrapper" style="--glow-color: ${glowColor}">
        <div class="temp">${displayTemp.toFixed(1)}°C</div>
      </div>

      ${modeButtons}

      <div class="info-line">
        Solar: ${solar} | Outside Temp: ${outsideTemp}° | Humidity: ${houseHum}% / ${outsideHum}%
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
        const mode = e.currentTarget.getAttribute('data-mode');
        hass.callService('climate', 'set_hvac_mode', {
          entity_id: config.entity,
          hvac_mode: mode,
        });
      });
    });

    this.querySelectorAll('.styled-room-slider').forEach(slider => {
      const entityId = slider.dataset.entity;
      slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        slider.style.setProperty('--percent', val + '%');

        // Update label status text dynamically
        const wrapper = e.target.parentElement;
        if (wrapper) {
          const statusEl = wrapper.querySelector('.label-status');
          if (statusEl) {
            statusEl.textContent = val === 0 ? 'Closed' : val === 100 ? 'Open' : val + '%';
          }
        }
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
    temp = Math.max(min, Math.min(max, temp + delta));
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
