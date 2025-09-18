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

    // Use room sensor for display temp
    const roomSensor = config.house_temp_sensor ? hass.states[config.house_temp_sensor] : null;
    const sensorTemp = roomSensor ? parseFloat(roomSensor.state) : (climate.attributes.current_temperature || minTemp);

    if (this._localTemp !== null && Math.abs(this._localTemp - climate.attributes.temperature) < 0.1) {
      this._localTemp = null;
    }

    const displayTemp = sensorTemp;

    const modes = ['cool', 'heat', 'fan_only', 'dry', 'auto'];
    const currentMode = climate.attributes.hvac_mode || climate.state;

    const getState = (id) => hass.states[id]?.state ?? 'N/A';
    const solar = config.solar_sensor ? getState(config.solar_sensor) : 'N/A';
    const houseTemp = config.house_temp_sensor ? getState(config.house_temp_sensor) : 'N/A';
    const outsideTemp = config.outside_temp_sensor ? getState(config.outside_temp_sensor) : 'N/A';
    const houseHum = config.house_humidity_sensor ? getState(config.house_humidity_sensor) : 'N/A';
    const outsideHum = config.outside_humidity_sensor ? getState(config.outside_humidity_sensor) : 'N/A';

    let modeButtons = '<div class="modes">';
    modes.forEach(mode => {
      const selected = currentMode === mode ? 'mode-selected' : '';
      modeButtons += `<button class="mode-btn ${selected}" data-mode="${mode}">${mode}</button>`;
    });
    modeButtons += '</div>';

    let roomControls = '';
    if (config.rooms && Array.isArray(config.rooms)) {
      roomControls += '<div class="room-list">';
      config.rooms.forEach(room => {
        const sliderEnt = hass.states[room.slider_entity];
        const sensorEnt = hass.states[room.sensor_entity];
        const sliderVal = sliderEnt ? parseFloat(sliderEnt.state) : 0;
        const sensorVal = sensorEnt ? parseFloat(sensorEnt.state) : null;
        const min = sliderEnt?.attributes?.min ?? 0;
        const max = sliderEnt?.attributes?.max ?? 100;

        let openDisplay = '';
        if (sliderVal === 0) {
          openDisplay = '0%';
        } else if (sliderVal === 100) {
          openDisplay = 'Open';
        } else {
          openDisplay = `${sliderVal.toFixed(0)}%`;
        }

        roomControls += `
          <div class="room-slider-wrapper">
            <input type="range"
              class="styled-room-slider"
              data-entity="${room.slider_entity}"
              min="${min}" max="${max}" step="1" value="${sliderVal}">
            <div class="slider-labels">
              <span class="label-name">${room.name}</span>
              <span class="label-status">${openDisplay}</span>
              <span class="label-temp">${sensorVal != null ? sensorVal.toFixed(1) : 'N/A'}°C</span>
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
          max-width: 400px;
        }
        button {
          cursor: pointer;
          border: none;
          outline: none;
        }
        #power {
          width: 100%;
          background: #16a085;
          color: white;
          padding: 10px;
          border-radius: 20px;
          font-size: 18px;
          margin-bottom: 12px;
        }
        #power:hover {
          background: #1abc9c;
        }
        .temp {
          font-size: 56px;
          font-weight: bold;
          text-align: center;
          margin: 12px auto 4px;
          background: #1abc9c;
          border-radius: 50%;
          width: 120px;
          height: 120px;
          line-height: 120px;
          box-shadow: 0 0 12px #1abc9c;
        }
        .temp-label {
          text-align: center;
          font-size: 14px;
          color: #ccc;
          margin-bottom: 8px;
        }
        .controls {
          display: flex;
          justify-content: center;
          margin: 10px 0;
        }
        .controls button {
          width: 50px;
          height: 50px;
          font-size: 24px;
          background: #34495e;
          color: white;
          border-radius: 50%;
          margin: 0 10px;
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
        }
        .mode-selected {
          background: #1abc9c !important;
          font-weight: bold;
          text-decoration: underline;
        }
        .info-line {
          text-align: center;
          font-size: 14px;
          color: #ccc;
          margin: 12px 0 6px;
        }

        /* Room Slider Style */
        .room-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 20px;
        }

        .room-slider-wrapper {
          position: relative;
          background: linear-gradient(to right, #1e3c72, #2a5298);
          border-radius: 12px;
          overflow: hidden;
          height: 40px;
        }

        .styled-room-slider {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          z-index: 2;
          cursor: pointer;
        }

        .slider-labels {
          display: flex;
          justify-content: space-between;
          align-items: center;
          height: 100%;
          padding: 0 12px;
          color: #fff;
          font-size: 15px;
          z-index: 1;
          pointer-events: none;
          font-weight: 500;
        }
      </style>

      <button id="power">${climate.state === 'off' ? 'Turn On' : 'Turn Off'}</button>
      <div class="temp">${displayTemp.toFixed(1)}°C</div>
      <div class="temp-label">Room Temp</div>
      ${modeButtons}
      <div class="controls">
        <button id="dec">-</button>
        <button id="inc">+</button>
      </div>
      <div class="info-line">
        Solar: ${solar} | Temp: ${houseTemp}°/${outsideTemp}° | Humidity: ${houseHum}%/${outsideHum}%
      </div>
      ${roomControls}
    `;

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

    this.querySelector('#inc').addEventListener('click', () => {
      this._changeTemp(0.5, minTemp, maxTemp);
    });

    this.querySelector('#dec').addEventListener('click', () => {
      this._changeTemp(-0.5, minTemp, maxTemp);
    });

    this.querySelectorAll('.styled-room-slider').forEach(slider => {
      const entityId = slider.dataset.entity;
      slider.addEventListener('change', (e) => {
        this._hass.callService('input_number', 'set_value', {
          entity_id: entityId,
          value: parseFloat(e.target.value),
        });
      });
    });
  }

  _changeTemp(delta, min, max) {
    const climate = this._hass.states[this.config.entity];
    let temp = climate.attributes.temperature || climate.attributes.current_temperature || min;
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
