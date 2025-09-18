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

    // HVAC mode and fan mode
    const currentMode = climate.attributes.hvac_mode || climate.state;
    const hvacAction = climate.attributes.hvac_action || null;
    const fanMode = climate.attributes.fan_mode || null;

    // Power state
    const powerOn = climate.state !== 'off';

    // Sensors
    const getState = (id) => hass.states[id]?.state ?? null;
    const solar = config.solar_sensor ? getState(config.solar_sensor) : null;
    const houseTemp = config.house_temp_sensor ? getState(config.house_temp_sensor) : null;
    const outsideTemp = config.outside_temp_sensor ? getState(config.outside_temp_sensor) : null;
    const houseHum = config.house_humidity_sensor ? getState(config.house_humidity_sensor) : null;
    const outsideHum = config.outside_humidity_sensor ? getState(config.outside_humidity_sensor) : null;

    // Modes & Icons with colors
    const modeData = {
      cool: { icon: 'mdi:snowflake', color: '#2196F3', name: 'Cool' },
      heat: { icon: 'mdi:fire', color: '#F44336', name: 'Heat' },
      fan_only: { icon: 'mdi:fan', color: '#9E9E9E', name: 'Fan' },
      dry: { icon: 'mdi:water-off', color: '#009688', name: 'Dry' },
      auto: { icon: 'mdi:autorenew', color: '#FFC107', name: 'Auto' },
    };

    // Generate mode buttons with icons and colored text (color only on icon + text)
    let modeButtons = '<div class="modes">';
    Object.entries(modeData).forEach(([mode, data]) => {
      const selected = currentMode === mode ? 'mode-selected' : '';
      modeButtons += `
        <button class="mode-btn ${selected}" data-mode="${mode}" style="color:${currentMode === mode ? data.color : '#ccc'};">
          <ha-icon icon="${data.icon}" style="color:${currentMode === mode ? data.color : '#ccc'};"></ha-icon>
          ${config.show_mode_names !== false ? `<span class="mode-name">${data.name}</span>` : ''}
        </button>`;
    });
    modeButtons += '</div>';

    // Room sliders with info inside bar (from 0.0.4.2.0)
    let roomControls = '';
    if (config.rooms && Array.isArray(config.rooms)) {
      roomControls += '<div class="room-section">';
      config.rooms.forEach(room => {
        const sliderEnt = hass.states[room.slider_entity];
        const sensorEnt = hass.states[room.sensor_entity];
        const sliderVal = sliderEnt?.attributes?.current_position ?? 0;
        const sensorVal = sensorEnt ? parseFloat(sensorEnt.state) : null;
        const min = 0;
        const max = 100;

        roomControls += `
          <div class="room-block">
            <input type="range" class="styled-room-slider" data-entity="${room.slider_entity}" min="${min}" max="${max}" step="1" value="${sliderVal}" style="--percent: ${sliderVal}%;">
            <div class="slider-info">
              <div class="slider-name">${room.name}</div>
              <div class="slider-status">${sliderVal}%</div>
              <div class="slider-temp">${sensorVal !== null ? sensorVal.toFixed(1) + '°C' : 'N/A'}</div>
            </div>
          </div>`;
      });
      roomControls += '</div>';
    }

    // Sensors info line only if sensors provided
    let sensorLine = '';
    if (solar || houseTemp || outsideTemp || houseHum || outsideHum) {
      sensorLine = `<div class="sensor-line">`;
      if (solar) sensorLine += `Solar: ${solar} | `;
      if (houseTemp) sensorLine += `House: ${houseTemp}° | `;
      if (outsideTemp) sensorLine += `Outside: ${outsideTemp}° | `;
      if (houseHum) sensorLine += `Humidity: ${houseHum}% | `;
      if (outsideHum) sensorLine += `Outside Humidity: ${outsideHum}%`;
      sensorLine = sensorLine.trim();
      if (sensorLine.endsWith('|')) sensorLine = sensorLine.slice(0, -1);
      sensorLine += `</div>`;
    }

    // Glow color from mode
    const glowColor = modeData[currentMode]?.color || '#1abc9c';

    // Inject HTML
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
          box-shadow: 0 0 20px #000 inset;
        }
        button {
          cursor: pointer;
          border: none;
          outline: none;
          background: transparent;
          color: inherit;
          font: inherit;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 14px;
          transition: color 0.3s;
        }
        #power {
          width: 100%;
          background: ${powerOn ? '#16a085' : '#444'};
          color: white;
          padding: 10px;
          border-radius: 20px;
          font-size: 16px;
          margin-bottom: 12px;
          font-weight: 600;
          user-select: none;
          transition: background-color 0.3s ease;
        }
        #power:hover {
          background: ${powerOn ? '#1abc9c' : '#666'};
        }
        .temp-circle {
          position: relative;
          width: 120px;
          height: 120px;
          margin: 0 auto 14px auto;
          background: #222;
          border-radius: 50%;
          box-shadow:
            0 8px 8px -4px rgba(0,0,0,0.8),
            0 0 20px 2px rgba(0,0,0,0.9);
          user-select: none;
        }
        .temp-value {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 54px;
          font-weight: 700;
          color: white;
          text-shadow:
            0 0 10px #000,
            0 0 20px #000;
          user-select: none;
        }
        .setpoint-controls {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 24px;
          margin-bottom: 14px;
          user-select: none;
        }
        .setpoint-value {
          font-size: 18px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          color: ${glowColor};
          user-select: none;
        }
        .setpoint-controls button {
          width: 36px;
          height: 36px;
          background: #333;
          border-radius: 50%;
          font-size: 26px;
          line-height: 26px;
          font-weight: 600;
          color: white;
          user-select: none;
          transition: background-color 0.3s;
        }
        .setpoint-controls button:hover {
          background: ${glowColor};
          cursor: pointer;
        }
        .modes {
          text-align: center;
          margin-bottom: 16px;
          user-select: none;
        }
        .modes button {
          margin: 6px 8px;
          padding: 6px 10px;
          border-radius: 16px;
          background: transparent;
          color: #ccc;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          user-select: none;
          font-size: 14px;
          transition: color 0.3s ease;
        }
        .mode-selected {
          font-weight: 700 !important;
        }
        .mode-btn ha-icon {
          font-size: 24px;
          vertical-align: middle;
          transition: color 0.3s ease;
        }
        .mode-name {
          font-size: 14px;
          user-select: none;
        }
        .room-section {
          margin-top: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          user-select: none;
        }
        .room-block {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .styled-room-slider {
          width: 100%;
          -webkit-appearance: none;
          appearance: none;
          height: 14px;
          border-radius: 8px;
          background: linear-gradient(to right, ${glowColor} var(--percent), #222 var(--percent));
          outline: none;
          cursor: pointer;
          transition: background 0.3s ease;
          margin: 0;
        }
        .styled-room-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          background: ${glowColor};
          cursor: pointer;
          border-radius: 50%;
          border: none;
          margin-top: -4px;
          transition: background 0.3s ease;
          box-shadow: 0 0 10px 3px ${glowColor};
        }
        .styled-room-slider::-moz-range-thumb {
          width: 22px;
          height: 22px;
          background: ${glowColor};
          cursor: pointer;
          border-radius: 50%;
          border: none;
          box-shadow: 0 0 10px 3px ${glowColor};
        }
        .slider-info {
          display: flex;
          justify-content: space-between;
          color: #ccc;
          font-size: 12px;
          margin-top: 2px;
          font-weight: 500;
          user-select: none;
        }
        .slider-name {
          flex: 1;
          font-weight: 600;
        }
        .slider-status, .slider-temp {
          min-width: 40px;
          text-align: right;
        }
        .sensor-line {
          font-size: 12px;
          color: #888;
          margin-top: 10px;
          user-select: none;
        }
      </style>

      <button id="power">${powerOn ? 'Turn OFF' : 'Turn ON'}</button>

      <div class="temp-circle" title="Set Point">
        <div class="temp-value">${displayTemp.toFixed(1)}°C</div>
      </div>

      <div class="setpoint-controls" aria-label="Adjust Set Point">
        <button id="dec-setpoint" title="Decrease Set Point">−</button>
        <div class="setpoint-value" title="Mode">
          <ha-icon icon="${modeData[currentMode]?.icon || 'mdi:help-circle'}" style="color:${modeData[currentMode]?.color || '#fff'};"></ha-icon>
          <span>${modeData[currentMode]?.name || currentMode}</span>
        </div>
        <button id="inc-setpoint" title="Increase Set Point">+</button>
      </div>

      ${modeButtons}

      ${roomControls}

      ${sensorLine}
    `;

    // Power button
    this.querySelector('#power').onclick = () => {
      const service = powerOn ? 'turn_off' : 'turn_on';
      hass.callService('climate', service, { entity_id: config.entity });
    };

    // Setpoint +/-
    this.querySelector('#dec-setpoint').onclick = () => {
      if (this._localTemp === null) this._localTemp = currentTemp;
      if (this._localTemp > minTemp) this._localTemp -= 1;
      this._localTemp = Math.max(minTemp, this._localTemp);
      this.updateSetTemp();
    };

    this.querySelector('#inc-setpoint').onclick = () => {
      if (this._localTemp === null) this._localTemp = currentTemp;
      if (this._localTemp < maxTemp) this._localTemp += 1;
      this._localTemp = Math.min(maxTemp, this._localTemp);
      this.updateSetTemp();
    };

    // Mode buttons
    this.querySelectorAll('.mode-btn').forEach(btn => {
      btn.onclick = () => {
        const mode = btn.dataset.mode;
        hass.callService('climate', 'set_hvac_mode', {
          entity_id: config.entity,
          hvac_mode: mode,
        });
      };
    });

    // Room sliders
    this.querySelectorAll('.styled-room-slider').forEach(slider => {
      slider.oninput = (e) => {
        const entity = e.target.dataset.entity;
        const value = parseInt(e.target.value, 10);
        e.target.style.setProperty('--percent', `${value}%`);
        hass.callService('cover', 'set_cover_position', {
          entity_id: entity,
          position: value,
        });
      };
    });
  }

  updateSetTemp() {
    if (!this._hass || !this.config) return;
    const temp = this._localTemp;
    if (temp === null) return;
    this._hass.callService('climate', 'set_temperature', {
      entity_id: this.config.entity,
      temperature: temp,
    });
  }

  getCardSize() {
    return 6;
  }
}

customElements.define('aircon-control-card', AirconControlCard);
