class AirconControlCard extends HTMLElement {
  constructor() {
    super();
    this._localTemp = null;
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error('You need to define an entity in the config');
    }
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

    const minTemp = climate.attributes.min_temp ?? 16;
    const maxTemp = climate.attributes.max_temp ?? 30;
    const currentTemp = climate.attributes.temperature
        ?? climate.attributes.current_temperature
        ?? minTemp;

    const hvacAction = climate.attributes.hvac_action
        ?? climate.attributes.hvac_mode
        ?? climate.state
        ?? 'off';

    // fallback for fan modes
    const fanModes = climate.attributes.fan_modes ?? [];
    const currentFanMode = climate.attributes.fan_mode ?? '';

    if (this._localTemp !== null && Math.abs(this._localTemp - currentTemp) < 0.1) {
      this._localTemp = null;
    }
    const displayTemp = this._localTemp !== null ? this._localTemp : currentTemp;

    // read other sensor states safely
    const getState = (id) => {
      const s = hass.states[id];
      return s && s.state !== 'unknown' && s.state !== 'unavailable' ? s.state : 'N/A';
    };
    const solar = config.solar_sensor ? getState(config.solar_sensor) : 'N/A';
    const houseTemp = config.house_temp_sensor ? getState(config.house_temp_sensor) : 'N/A';
    const outsideTemp = config.outside_temp_sensor ? getState(config.outside_temp_sensor) : 'N/A';
    const houseHum = config.house_humidity_sensor ? getState(config.house_humidity_sensor) : 'N/A';
    const outsideHum = config.outside_humidity_sensor ? getState(config.outside_humidity_sensor) : 'N/A';

    // mode mapping
    const modeMap = {
      cooling: { color: '#1e90ff', icon: 'mdi:snowflake', label: 'Cooling' },
      heating: { color: '#e67e22', icon: 'mdi:fire', label: 'Heating' },
      drying: { color: '#3498db', icon: 'mdi:water-percent', label: 'Dry' },
      fan:     { color: '#16a085', icon: 'mdi:fan', label: 'Fan' },
      idle:    { color: '#888', icon: 'mdi:power', label: 'Idle' },
      off:     { color: '#555', icon: 'mdi:power-off', label: 'Off' },
      auto:    { color: '#9b59b6', icon: 'mdi:autorenew', label: 'Auto' },
    };

    const modeKey = hvacAction.toLowerCase();
    const modeData = modeMap[modeKey] || modeMap['off'];

    // build room sliders
    let roomControls = '';
    if (Array.isArray(config.rooms)) {
      roomControls = '<div class="room-section">';
      config.rooms.forEach(room => {
        if (!room.slider_entity || !room.sensor_entity || !room.name) {
          // skip malformed rooms
          return;
        }
        const sliderEnt = hass.states[room.slider_entity];
        let sliderVal = 0;
        if (sliderEnt) {
          if (sliderEnt.attributes.current_position != null) {
            sliderVal = parseInt(sliderEnt.attributes.current_position) || 0;
          } else if (!isNaN(parseInt(sliderEnt.state))) {
            sliderVal = parseInt(sliderEnt.state);
          }
        }
        const sensorEnt = hass.states[room.sensor_entity];
        const sensorVal = sensorEnt && !isNaN(parseFloat(sensorEnt.state))
            ? parseFloat(sensorEnt.state)
            : null;

        // clamp 0-100
        if (sliderVal < 0) sliderVal = 0;
        if (sliderVal > 100) sliderVal = 100;

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
                style="--percent: ${sliderVal}%;"
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

    this.innerHTML = `
      <style>
        :host {
          font-family: 'Roboto', sans-serif;
          background: #1c1c1c;
          color: #fff;
          border-radius: 12px;
          padding: 16px;
          display: block;
          max-width: 380px;
        }
        .temp-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
        }
        .temp-circle {
          background: #111214;
          border-radius: 50%;
          width: 130px;
          height: 130px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 20px -5px ${modeData.color};
          flex-direction: column;
          color: white;
          font-size: 14px;
        }
        .temp-circle .setpoint {
          font-size: 24px;
          font-weight: bold;
        }
        .temp-circle .mode-icon {
          font-size: 20px;
          margin-top: 4px;
          color: ${modeData.color};
        }
        .circle-button {
          width: 32px;
          height: 32px;
          background: #333;
          color: white;
          border: none;
          border-radius: 50%;
          font-size: 20px;
          cursor: pointer;
        }
        .controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 16px auto;
          max-width: 200px;
        }
        .info-line {
          text-align: center;
          font-size: 13px;
          color: #ccc;
          margin-top: 12px;
        }
        .room-section {
          margin-top: 16px;
        }
        .slider-container {
          position: relative;
          margin-bottom: 24px;
        }
        .styled-room-slider {
          width: 100%;
          height: 8px;
          border-radius: 4px;
          background: #555;
          outline: none;
          appearance: none;
          -webkit-appearance: none;
        }
        .styled-room-slider::-webkit-slider-thumb {
          appearance: none;
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          background: #1abc9c;
          border: 2px solid white;
          border-radius: 50%;
          cursor: pointer;
          margin-top: -6px;
        }
        .styled-room-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: #1abc9c;
          border: 2px solid white;
          border-radius: 50%;
          cursor: pointer;
        }
        .slider-info {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          color: #ccc;
          margin-top: 4px;
        }
        .slider-name { flex: 1; text-align: left; }
        .slider-status { flex: 0 0 50px; text-align: center; }
        .slider-temp { flex: 0 0 50px; text-align: right; }
      </style>

      <div class="controls">
        <button id="dec" class="circle-button">−</button>
        <div class="temp-circle">
          <div class="setpoint">${displayTemp.toFixed(1)}°C</div>
          <ha-icon icon="${modeData.icon}" class="mode-icon"></ha-icon>
        </div>
        <button id="inc" class="circle-button">+</button>
      </div>

      <div class="info-line">
        House Temp: ${houseTemp}°C | Solar: ${solar} | Outside: ${outsideTemp}°C | Humidity: ${houseHum}%/${outsideHum}%
      </div>

      ${roomControls}
    `;

    // Event listeners

    this.querySelector('#inc').addEventListener('click', () => {
      this._changeTemp(0.5, minTemp, maxTemp);
    });
    this.querySelector('#dec').addEventListener('click', () => {
      this._changeTemp(-0.5, minTemp, maxTemp);
    });

    this.querySelectorAll('.room-section .styled-room-slider').forEach(slider => {
      const entityId = slider.dataset.entity;
      const statusSpan = slider.parentElement.querySelector('.slider-status');
      slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        if (statusSpan) statusSpan.textContent = `${val}%`;
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
    let temp = climate.attributes.temperature ?? climate.attributes.current_temperature ?? min;
    temp = Math.max(min, Math.min(max, parseFloat((temp + delta).toFixed(1))));
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
