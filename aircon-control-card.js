class AirconControlCard extends HTMLElement {
  constructor() {
    super();
    this._localTemp = null;
  }

  setConfig(config) {
    if (!config.entity) throw new Error('You need to define an entity');
    this.config = config;
    this.showModeNames = config.show_mode_names ?? true; // default true, toggle with config
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

    const availableModes = climate.attributes.hvac_modes || ['cool', 'heat', 'fan_only', 'dry', 'auto'];
    const currentHvacAction = climate.attributes.hvac_action || climate.state;
    const currentMode = climate.state;

    const fanModes = climate.attributes.fan_modes || [];

    const modeData = {
      cool: { icon: 'mdi:snowflake', color: '#4FC3F7' },
      heat: { icon: 'mdi:fire', color: '#EF5350' },
      fan_only: { icon: 'mdi:fan', color: '#9E9E9E' },
      dry: { icon: 'mdi:water-percent', color: '#AB47BC' },
      auto: { icon: 'mdi:autorenew', color: '#66BB6A' },
    };

    const powerOn = climate.state !== 'off';

    // Helper to get sensor state or null if not found
    const getSensorState = (id) => id && hass.states[id] ? hass.states[id].state : null;

    // Only show sensors if configured and valid
    const solar = getSensorState(config.solar_sensor);
    const houseTempSensor = getSensorState(config.house_temp_sensor);
    const outsideTempSensor = getSensorState(config.outside_temp_sensor);
    const houseHumSensor = getSensorState(config.house_humidity_sensor);
    const outsideHumSensor = getSensorState(config.outside_humidity_sensor);

    // Generate mode buttons
    let modeButtons = '<div class="modes">';
    availableModes.forEach(mode => {
      if (!(mode in modeData)) return;
      const data = modeData[mode];
      const isSelected = currentMode === mode;
      const colorStyle = isSelected ? `style="color:${data.color}"` : '';
      modeButtons += `
        <button class="mode-btn" data-mode="${mode}" ${colorStyle} title="${mode}">
          <ha-icon icon="${data.icon}"></ha-icon>
          ${this.showModeNames ? `<div class="mode-name" style="color:${isSelected ? data.color : '#eee'}">${mode.replace('_',' ')}</div>` : ''}
        </button>`;
    });
    modeButtons += '</div>';

    // Room sliders
    let roomControls = '';
    if (config.rooms && Array.isArray(config.rooms)) {
      roomControls += '<div class="room-section">';
      config.rooms.forEach(room => {
        const sliderEnt = hass.states[room.slider_entity];
        let sliderVal = 0;
        if (sliderEnt) {
          if (sliderEnt.attributes.current_position != null) {
            sliderVal = parseInt(sliderEnt.attributes.current_position) || 0;
          } else if (!isNaN(Number(sliderEnt.state))) {
            sliderVal = Number(sliderEnt.state);
          }
        }
        sliderVal = Math.min(Math.max(sliderVal, 0), 100);

        const sensorEnt = hass.states[room.sensor_entity || room.room_temp_entity];
        const sensorVal = sensorEnt && !isNaN(Number(sensorEnt.state)) ? Number(sensorEnt.state) : null;

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
                style="--percent: ${sliderVal}%; --fill-color: ${modeData[currentMode]?.color || '#16a085'}"
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

    const glowColor = modeData[currentMode]?.color || '#16a085';

    // Compose optional sensors info line
    let sensorLine = '';
    if (houseTempSensor || outsideTempSensor || houseHumSensor || outsideHumSensor || solar) {
      sensorLine += '<div class="sensor-line">';
      if (houseTempSensor !== null && outsideTempSensor !== null) {
        sensorLine += `<span class="house-outside-temp">House: ${houseTempSensor}°C / Outside: ${outsideTempSensor}°C</span>`;
      } else if (houseTempSensor !== null) {
        sensorLine += `<span class="house-temp">House: ${houseTempSensor}°C</span>`;
      } else if (outsideTempSensor !== null) {
        sensorLine += `<span class="outside-temp">Outside: ${outsideTempSensor}°C</span>`;
      }
      if (houseHumSensor !== null) {
        sensorLine += ` <span class="house-humidity">House Humidity: ${houseHumSensor}%</span>`;
      }
      if (outsideHumSensor !== null) {
        sensorLine += ` <span class="outside-humidity">Outside Humidity: ${outsideHumSensor}%</span>`;
      }
      if (solar !== null) {
        sensorLine += ` <span class="solar">Solar: ${solar} W</span>`;
      }
      sensorLine += '</div>';
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
          max-width: 400px;
          user-select: none;
        }
        button {
          cursor: pointer;
          border: none;
          outline: none;
          background: transparent;
          color: inherit;
          font-family: inherit;
        }
        #power {
          width: 120px;
          background: #16a085;
          color: white;
          padding: 8px;
          border-radius: 20px;
          font-size: 16px;
          margin: 10px auto 14px auto;
          display: block;
          transition: background-color 0.3s ease;
        }
        #power:hover {
          background: #1abc9c;
        }
        .temp-circle {
          position: relative;
          margin: 0 auto 14px auto;
          width: 120px;
          height: 120px;
          border-radius: 50%;
          background: #111;
          box-shadow: 0 0 20px 6px rgba(0,0,0,0.9);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          color: white;
        }
        .temp-circle::after {
          content: '';
          position: absolute;
          bottom: 8px;
          left: 15%;
          width: 70%;
          height: 18px;
          box-shadow: 0 0 20px 8px ${glowColor};
          border-radius: 50%;
          filter: blur(8px);
          z-index: 0;
        }
        .temp-value {
          font-size: 36px;
          font-weight: 700;
          z-index: 1;
        }
        .setpoint-controls {
          position: relative;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 12px 0 18px 0;
          max-width: 280px;
          margin-left: auto;
          margin-right: auto;
          color: white;
        }
        .setpoint-controls button {
          font-size: 28px;
          width: 40px;
          height: 40px;
          background: #34495e;
          border-radius: 8px;
          color: white;
          font-weight: 700;
          user-select: none;
          transition: background-color 0.3s ease;
        }
        .setpoint-controls button:hover {
          background: #1abc9c;
          color: #000;
        }
        .setpoint-value {
          font-size: 28px;
          font-weight: 600;
          width: 100px;
          text-align: center;
          user-select: none;
          z-index: 1;
          color: white;
          text-shadow: 0 0 6px ${glowColor};
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 6px;
        }
        .setpoint-value ha-icon {
          font-size: 22px;
          margin-right: 4px;
          color: ${glowColor};
        }
        .modes {
          display: flex;
          justify-content: center;
          gap: 14px;
          margin-bottom: 18px;
          flex-wrap: wrap;
        }
        .mode-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          background: transparent;
          border-radius: 8px;
          padding: 6px 10px;
          transition: color 0.3s ease;
          color: #aaa;
          min-width: 50px;
          user-select: none;
          border: 2px solid transparent;
        }
        .mode-btn ha-icon {
          font-size: 28px;
          margin-bottom: 2px;
          transition: color 0.3s ease;
        }
        .mode-btn:hover {
          color: ${glowColor};
          border-color: ${glowColor};
        }
        .mode-name {
          font-size: 11px;
          font-weight: 500;
          color: inherit;
          white-space: nowrap;
          text-transform: capitalize;
        }
        .mode-btn[data-mode="${currentMode}"] {
          color: ${glowColor};
          border-color: ${glowColor};
          font-weight: 600;
        }
        .mode-btn[data-mode="${currentMode}"] ha-icon {
          color: ${glowColor};
        }
        .info-line {
          text-align: center;
          font-size: 14px;
          color: #ccc;
          margin: 12px 0 6px;
          user-select: none;
          display: flex;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .sensor-line {
          font-size: 13px;
          color: #bbb;
          display: flex;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }
        .room-section {
          margin-top: 20px;
        }
        .room-block {
          margin-bottom: 22px;
        }
        .slider-container {
          position: relative;
          width: 100%;
        }
        .styled-room-slider {
          -webkit-appearance: none;
          width: 100%;
          height: 18px;
          border-radius: 12px;
          background: #444;
          outline: none;
          cursor: pointer;
          --fill-color: #16a085;
          --percent: 0%;
        }
        .styled-room-slider::-webkit-slider-runnable-track {
          height: 18px;
          border-radius: 12px;
          background: linear-gradient(
            to right,
            var(--fill-color) var(--percent),
            #444 var(--percent)
          );
        }
        .styled-room-slider::-moz-range-track {
          height: 18px;
          border-radius: 12px;
          background: linear-gradient(
            to right,
            var(--fill-color) var(--percent),
            #444 var(--percent)
          );
        }
        /* Remove thumb */
        .styled-room-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 0;
          height: 0;
          margin-top: 0;
          cursor: pointer;
        }
        .styled-room-slider::-moz-range-thumb {
          width: 0;
          height: 0;
          cursor: pointer;
        }
        .slider-info {
          position: absolute;
          top: 50%;
          left: 10px;
          right: 10px;
          transform: translateY(-50%);
          display: flex;
          justify-content: space-between;
          color: white;
          font-size: 13px;
          font-weight: 600;
          pointer-events: none;
          user-select: none;
        }
        .slider-name {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-transform: capitalize;
        }
        .slider-status {
          width: 40px;
          text-align: right;
        }
        .slider-temp {
          width: 50px;
          text-align: right;
        }
      </style>

      <button id="power">${powerOn ? 'Turn Off' : 'Turn On'}</button>

      <div class="temp-circle">
        <div class="temp-value">${displayTemp.toFixed(1)}°C</div>
      </div>

      <div class="setpoint-controls">
        <button id="setpoint-decrease">-</button>
        <div class="setpoint-value">
          <ha-icon icon="${modeData[currentMode]?.icon || 'mdi:thermometer'}"></ha-icon>
          ${displayTemp.toFixed(1)}°C
        </div>
        <button id="setpoint-increase">+</button>
      </div>

      ${modeButtons}

      ${sensorLine}

      ${roomControls}
    `;

    // Attach event listeners

    this.querySelector('#power').onclick = () => {
      this._hass.callService('climate', 'turn_' + (powerOn ? 'off' : 'on'), { entity_id: config.entity });
    };

    this.querySelector('#setpoint-increase').onclick = () => {
      this.changeSetpoint(1, minTemp, maxTemp, climate, config.entity);
    };

    this.querySelector('#setpoint-decrease').onclick = () => {
      this.changeSetpoint(-1, minTemp, maxTemp, climate, config.entity);
    };

    this.querySelectorAll('.mode-btn').forEach(btn => {
      btn.onclick = () => {
        const mode = btn.getAttribute('data-mode');
        this._hass.callService('climate', 'set_hvac_mode', { entity_id: config.entity, hvac_mode: mode });
      };
    });

    // Room sliders listeners
    if (config.rooms && Array.isArray(config.rooms)) {
      this.querySelectorAll('.styled-room-slider').forEach(slider => {
        slider.oninput = (e) => {
          const val = Number(e.target.value);
          e.target.style.setProperty('--percent', val + '%');
          const entity_id = e.target.getAttribute('data-entity');
          if (entity_id) {
            this._hass.callService('cover', 'set_cover_position', { entity_id, position: val });
          }
        };
      });
    }
  }

  changeSetpoint(delta, minTemp, maxTemp, climate, entity) {
    let newTemp = (climate.attributes.temperature || climate.attributes.current_temperature || minTemp) + delta;
    newTemp = Math.min(maxTemp, Math.max(minTemp, newTemp));
    this._localTemp = newTemp;
    this._hass.callService('climate', 'set_temperature', {
      entity_id: entity,
      temperature: newTemp,
    });
  }

  getCardSize() {
    return 6;
  }
}

customElements.define('aircon-control-card', AirconControlCard);
