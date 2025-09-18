class AirconControlCard extends HTMLElement {
  constructor() {
    super();
    this._localTemp = null;
    this._useModeIcons = true;
    this._usePowerIcon = true;
  }

  setConfig(config) {
    if (!config.entity) throw new Error('You need to define an entity');
    this.config = config;
    // Optional toggles to switch icons/text for modes and power button
    this._useModeIcons = config.show_mode_icons !== false; // default true
    this._usePowerIcon = config.show_power_icon !== false; // default true
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
    const modeLabels = {
      cool: 'Cool',
      heat: 'Heat',
      fan_only: 'Fan',
      dry: 'Dry',
      auto: 'Auto',
    };

    // Simple SVG icons for modes
    const modeIcons = {
      cool: `<svg viewBox="0 0 24 24" width="20" height="20" fill="#4fc3f7"><path d="M12 2v20m10-10H2"/></svg>`, // snowflake style
      heat: `<svg viewBox="0 0 24 24" width="20" height="20" fill="#e57373"><path d="M12 22V2m0 0C8 5 6 9 6 12c0 3 2 7 6 10"/></svg>`, // flame-ish
      fan_only: `<svg viewBox="0 0 24 24" width="20" height="20" fill="#81c784"><circle cx="12" cy="12" r="10" stroke="none"/></svg>`, // fan circle placeholder
      dry: `<svg viewBox="0 0 24 24" width="20" height="20" fill="#ba68c8"><path d="M12 2l-2 4 4 4-4 4 4 4"/></svg>`, // droplet
      auto: `<svg viewBox="0 0 24 24" width="20" height="20" fill="#ffd54f"><circle cx="12" cy="12" r="8" stroke="none"/></svg>`, // auto circle
    };

    // Power icons
    const powerOnIcon = `<svg viewBox="0 0 24 24" width="24" height="24" fill="#1abc9c"><path d="M12 2v10"/></svg>`;
    const powerOffIcon = `<svg viewBox="0 0 24 24" width="24" height="24" fill="#e74c3c"><circle cx="12" cy="12" r="10"/></svg>`;

    const currentMode = climate.attributes.hvac_mode || climate.state;

    // Sensors
    const getState = (id) => hass.states[id]?.state ?? 'N/A';
    const solar = config.solar_sensor ? getState(config.solar_sensor) : 'N/A';
    const houseTemp = config.house_temp_sensor ? getState(config.house_temp_sensor) : 'N/A';
    const outsideTemp = config.outside_temp_sensor ? getState(config.outside_temp_sensor) : 'N/A';
    const houseHum = config.house_humidity_sensor ? getState(config.house_humidity_sensor) : 'N/A';
    const outsideHum = config.outside_humidity_sensor ? getState(config.outside_humidity_sensor) : 'N/A';

    // Mode buttons HTML
    let modeButtons = '<div class="modes">';
    modes.forEach(mode => {
      const selected = currentMode === mode ? 'mode-selected' : '';
      const content = this._useModeIcons ? modeIcons[mode] : modeLabels[mode];
      modeButtons += `<button class="mode-btn ${selected}" data-mode="${mode}" title="${modeLabels[mode]}">${content}</button>`;
    });
    modeButtons += '</div>';

    // Room sliders
    let roomControls = '';
    if (config.rooms && Array.isArray(config.rooms)) {
      roomControls += '<div class="room-section">';
      config.rooms.forEach(room => {
        const sliderEnt = hass.states[room.slider_entity];
        const sensorEnt = hass.states[room.sensor_entity];
        const sliderVal = sliderEnt && (sliderEnt.attributes.current_position !== undefined
          ? parseFloat(sliderEnt.attributes.current_position)
          : sliderEnt.attributes.position !== undefined
            ? parseFloat(sliderEnt.attributes.position)
            : 0);
        const sensorVal = sensorEnt ? parseFloat(sensorEnt.state) : null;

        roomControls += `
          <div class="room-slider-wrapper">
            <input
              type="range"
              class="styled-room-slider"
              data-entity="${room.slider_entity}"
              min="0" max="100" step="1"
              value="${sliderVal}"
              aria-label="${room.name} slider"
            />
            <div class="slider-labels">
              <span class="label-name">${room.name}</span>
              <span class="label-status">${sliderVal === 0 ? 'Closed' : sliderVal === 100 ? 'Open' : sliderVal + '%'}</span>
              <span class="label-temp">${sensorVal != null ? sensorVal.toFixed(1) : 'N/A'}°C</span>
            </div>
          </div>
        `;
      });
      roomControls += '</div>';
    }

    // Color glow based on mode
    const modeGlowColors = {
      heat: 'rgba(229, 115, 115, 0.6)',    // red-ish
      cool: 'rgba(79, 195, 247, 0.6)',    // blue-ish
      fan_only: 'rgba(129, 199, 132, 0.6)', // green-ish
      dry: 'rgba(186, 104, 200, 0.6)',    // purple-ish
      auto: 'rgba(255, 213, 79, 0.6)',    // yellow-ish
      off: 'rgba(0,0,0,0)',                // no glow
    };

    // Power button content
    const powerContent = climate.state === 'off'
      ? (this._usePowerIcon ? powerOffIcon : 'Turn On')
      : (this._usePowerIcon ? powerOnIcon : 'Turn Off');

    // Inject HTML
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
        button {
          cursor: pointer;
          border: none;
          outline: none;
          background: transparent;
          color: white;
          transition: background-color 0.3s ease;
        }
        button:focus {
          outline: 2px solid #1abc9c;
        }
        #power {
          width: 100%;
          background: #16a085;
          color: white;
          padding: 10px;
          border-radius: 20px;
          font-size: 18px;
          margin-bottom: 12px;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          user-select: none;
          transition: background-color 0.3s ease;
        }
        #power:hover {
          background: #1abc9c;
        }
        .temp-wrapper {
          position: relative;
          width: 120px;
          height: 120px;
          margin: 12px auto;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .temp-glow {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          border-radius: 50%;
          background: black;
          filter: drop-shadow(0 0 12px var(--glow-color));
          box-shadow: 0 0 30px var(--glow-color);
          transition: box-shadow 0.4s ease;
          z-index: 0;
        }
        .temp {
          font-size: 36px;
          font-weight: 700;
          text-align: center;
          color: white;
          border-radius: 50%;
          width: 120px;
          height: 120px;
          line-height: 120px;
          z-index: 1;
          user-select: none;
        }
        .modes {
          text-align: center;
          margin: 10px 0;
        }
        .modes button {
          margin: 5px;
          padding: 6px 14px;
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
        .room-section {
          margin-top: 20px;
        }
        .room-slider-wrapper {
          margin-bottom: 20px;
        }
        .slider-labels {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          color: #ddd;
          margin-top: 4px;
          user-select: none;
        }
        .label-name {
          font-weight: 600;
        }
        .label-status {
          font-weight: 400;
          font-style: italic;
        }
        .label-temp {
          font-weight: 400;
        }
        /* Styled slider */
        .styled-room-slider {
          -webkit-appearance: none;
          width: 100%;
          height: 8px;
          background: #555;
          border-radius: 4px;
          outline: none;
          cursor: pointer;
          position: relative;
          overflow: hidden;
        }
        .styled-room-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          background: #1abc9c;
          border-radius: 50%;
          border: 2px solid white;
          cursor: pointer;
          position: relative;
          z-index: 3;
          margin-top: -6px;
          transition: background-color 0.3s ease;
        }
        .styled-room-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: #1abc9c;
          border-radius: 50%;
          border: 2px solid white;
          cursor: pointer;
          position: relative;
          z-index: 3;
        }
        /* Track fill color */
        .styled-room-slider::-webkit-slider-runnable-track {
          height: 8px;
          background: linear-gradient(to right, #1abc9c 0%, #1abc9c var(--percent), #555 var(--percent), #555 100%);
          border-radius: 4px;
        }
        .styled-room-slider::-moz-range-track {
          height: 8px;
          background: linear-gradient(to right, #1abc9c 0%, #1abc9c var(--percent), #555 var(--percent), #555 100%);
          border-radius: 4px;
        }
      </style>

      <button id="power" title="${climate.state === 'off' ? 'Turn On' : 'Turn Off'}">${powerContent}</button>

      <div class="temp-wrapper" style="--glow-color: ${modeGlowColors[currentMode] ?? 'transparent'}">
        <div class="temp-glow"></div>
        <div class="temp">${displayTemp.toFixed(1)}°C</div>
      </div>

      ${modeButtons}

      <div class="info-line" style="font-size: 14px; color: #ccc; text-align: center; margin: 12px 0 6px;">
        Solar: ${solar} | Temp: ${houseTemp}°/${outsideTemp}° | Humidity: ${houseHum}%/${outsideHum}%
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
        const mode = e.target.getAttribute('data-mode');
        hass.callService('climate', 'set_hvac_mode', {
          entity_id: config.entity,
          hvac_mode: mode,
        });
      });
    });

    this.querySelectorAll('.styled-room-slider').forEach(slider => {
      const entityId = slider.dataset.entity;
      const labelStatus = slider.nextElementSibling.querySelector('.label-status');
      slider.style.setProperty('--percent', slider.value + '%');
      slider.addEventListener('input', (e) => {
        const val = e.target.value;
        slider.style.setProperty('--percent', val + '%');
        labelStatus.textContent = val == 0 ? 'Closed' : val == 100 ? 'Open' : val + '%';
      });
      slider.addEventListener('change', (e) => {
        hass.callService('cover', 'set_cover_position', {
          entity_id: entityId,
          position: parseInt(e.target.value),
        });
      });
    });
  }

  getCardSize() {
    return 6;
  }
}

customElements.define('aircon-control-card', AirconControlCard);
