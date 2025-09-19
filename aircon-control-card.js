class AirconControlCard extends HTMLElement {
  constructor() {
    super();
    this._localTemp = null;
    this._localSliderValues = {};
    this._sliderDragging = {};
    this._initialized = false;

    // Bind methods
    this._onModeClick = this._onModeClick.bind(this);
    this._onFanClick = this._onFanClick.bind(this);
    this._onSetpointDec = this._onSetpointDec.bind(this);
    this._onSetpointInc = this._onSetpointInc.bind(this);
    this._onSliderInput = this._onSliderInput.bind(this);
    this._onSliderChange = this._onSliderChange.bind(this);
    this._onSliderPointerDown = this._onSliderPointerDown.bind(this);
    this._onSliderPointerUp = this._onSliderPointerUp.bind(this);
  }

  setConfig(config) {
    if (!config.entity) throw new Error('You need to define an entity');
    this.config = config;
    this.showModeNames = config.show_mode_names !== false;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._initialized) {
      this._buildCard();
      this._initialized = true;
    }
    this._updateCard();
  }

  _buildCard() {
    const style = document.createElement('style');
    style.textContent = `
      /* Keep your original styles here, trimmed for brevity */
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
      button.mode-btn, button.fan-btn {
        cursor: pointer;
        background: transparent;
        border: none;
        outline: none;
        font-size: 14px;
        color: #ccc;
        transition: color 0.3s;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
      }
      button.mode-btn.mode-selected, button.fan-btn.fan-selected {
        color: var(--glow-color, #b37fed);
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
        background: var(--glow-color, #b37fed);
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
        background: var(--glow-color, #b37fed);
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
          radial-gradient(circle at center, #0a0a0a 40%, #000000 100%);
        box-shadow:
          inset 0 10px 15px rgba(255, 255, 255, 0.1),
          inset 0 -10px 15px rgba(0, 0, 0, 0.8);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 34px;
        font-weight: 600;
      }
      .temp-value {
        font-size: 30px;
        font-weight: 600;
        color: white;
      }
      .mode-in-circle {
        margin-top: 6px;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 18px;
        color: var(--glow-color, #b37fed);
      }
      .sensor-line {
        font-size: 14px;
        color: #777;
        margin-top: 12px;
        text-align: center;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 8px;
      }
      .sensor-line ha-icon {
        font-size: 16px;
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
      input.styled-room-slider {
        width: 100%;
        height: 34px;
        -webkit-appearance: none;
        appearance: none;
        border-radius: 12px;
        outline: none;
        transition: background 0.3s ease;
        margin: 0 0  -10px 0;
        background: linear-gradient(to right, var(--gradient-start, #0a3d73) 0%, var(--gradient-end, #1B86EF) var(--percent), #333 var(--percent), #333 100%);
      }
      input.styled-room-slider.no-thumb::-webkit-slider-thumb,
      input.styled-room-slider.no-thumb::-moz-range-thumb {
        width: 0;
        height: 0;
        transition: left 0.3s ease;
      }
      .slider-info {
        position: absolute;
        top: 6px;
        left: 12px;
        right: 12px;
        height: 22px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        pointer-events: none;
        font-family: 'Georgia', 'Playfair Display', serif;
        font-size: 15px;
        color: white;
      }
      .slider-name {
        flex: 1;
        width: 200px;
      }
      .slider-status {
        width: 50px;
        text-align: right;
      }
      .slider-temp {
        width: 50px;
        text-align: center;
        display: flex;
        justify-content: center;
        align-items: center;
      }
    `;

    this.appendChild(style);

    // Main container div
    this._container = document.createElement('div');
    this.appendChild(this._container);

    // Prepare the static parts: mode buttons, fan buttons, temp circle, sensors, rooms container
    this._container.innerHTML = `
      <div class="modes"></div>
      <div class="fan-modes"></div>
      <div class="temp-setpoint-wrapper">
        <button class="setpoint-button" id="dec-setpoint">−</button>
        <div class="temp-circle-container">
          <div class="glow-bottom"></div>
          <div class="temp-circle">
            <div class="reflection"></div>
            <div class="temp-value"></div>
            <div class="mode-in-circle">
              <ha-icon></ha-icon>
              <span class="mode-name"></span>
            </div>
          </div>
        </div>
        <button class="setpoint-button" id="inc-setpoint">+</button>
      </div>
      <div class="sensor-line"></div>
      <div class="room-section"></div>
    `;

    // Cache references for update
    this._modesEl = this._container.querySelector('.modes');
    this._fanModesEl = this._container.querySelector('.fan-modes');
    this._tempValueEl = this._container.querySelector('.temp-value');
    this._tempCircleContainer = this._container.querySelector('.temp-circle-container');
    this._modeIconEl = this._container.querySelector('.mode-in-circle ha-icon');
    this._modeNameEl = this._container.querySelector('.mode-in-circle span.mode-name');
    this._sensorLineEl = this._container.querySelector('.sensor-line');
    this._roomSectionEl = this._container.querySelector('.room-section');
    this._decBtn = this._container.querySelector('#dec-setpoint');
    this._incBtn = this._container.querySelector('#inc-setpoint');

    // Attach event listeners
    this._decBtn.addEventListener('click', this._onSetpointDec);
    this._incBtn.addEventListener('click', this._onSetpointInc);
  }

  _updateCard() {
    const cfg = this.config;
    const hass = this._hass;
    const climate = hass.states[cfg.entity];
    if (!climate) {
      this._container.innerHTML = `<div>Entity ${cfg.entity} not found</div>`;
      return;
    }

    // Determine mode, fan mode, temp, etc.
    const state = climate.state;
    const attrs = climate.attributes;
    const hvac_modes = attrs.hvac_modes || [];
    const fan_modes = attrs.fan_modes || [];
    const current_mode = attrs.hvac_mode || 'off';
    const current_fan_mode = attrs.fan_mode || '';
    const min_temp = attrs.min_temp || 16;
    const max_temp = attrs.max_temp || 30;
    const temperature = attrs.temperature ?? attrs.target_temp_step ? this._localTemp ?? attrs.temperature : attrs.temperature;
    const step = attrs.target_temp_step || 0.5;
    const current_temp = this._localTemp ?? attrs.temperature;

    // Update mode buttons (only once, then just update selected classes)
    if (!this._modesBuilt) {
      this._modesEl.innerHTML = '';
      hvac_modes.forEach(mode => {
        const btn = document.createElement('button');
        btn.textContent = this.showModeNames ? mode : '';
        btn.title = mode;
        btn.className = 'mode-btn';
        btn.dataset.mode = mode;
        btn.addEventListener('click', this._onModeClick);
        this._modesEl.appendChild(btn);
      });
      this._modesBuilt = true;
    }

    // Update mode buttons selected state
    [...this._modesEl.children].forEach(btn => {
      btn.classList.toggle('mode-selected', btn.dataset.mode === current_mode);
    });

    // Update fan mode buttons (same pattern)
    if (!this._fanModesBuilt) {
      this._fanModesEl.innerHTML = '';
      fan_modes.forEach(fan => {
        const btn = document.createElement('button');
        btn.textContent = fan;
        btn.title = fan;
        btn.className = 'fan-btn';
        btn.dataset.fan = fan;
        btn.addEventListener('click', this._onFanClick);
        this._fanModesEl.appendChild(btn);
      });
      this._fanModesBuilt = true;
    }
    [...this._fanModesEl.children].forEach(btn => {
      btn.classList.toggle('fan-selected', btn.dataset.fan === current_fan_mode);
    });

    // Update temp circle temperature display
    this._tempValueEl.textContent = current_temp ? current_temp.toFixed(1) : '--';

    // Update mode icon & text in circle
    this._modeIconEl.setAttribute('icon', this._iconForMode(current_mode));
    this._modeNameEl.textContent = this.showModeNames ? current_mode : '';

    // Glow animation if active (heating or cooling)
    if (state === 'heat' || state === 'cool') {
      this._tempCircleContainer.classList.add('glow');
    } else {
      this._tempCircleContainer.classList.remove('glow');
    }

    // Update sensor line
    this._updateSensorLine();

    // Update room sliders if config.rooms present
    if (Array.isArray(cfg.rooms)) {
      this._updateRoomSliders(cfg.rooms, hass);
    } else {
      this._roomSectionEl.innerHTML = '';
    }
  }

  _updateSensorLine() {
    const hass = this._hass;
    const attrs = hass.states[this.config.entity]?.attributes || {};
    const sensors = [];

    if (attrs.current_temperature_sensor) {
      const sensorState = hass.states[attrs.current_temperature_sensor];
      if (sensorState) {
        sensors.push(`<ha-icon icon="mdi:thermometer"></ha-icon> ${sensorState.state}°C`);
      }
    }
    if (attrs.outdoor_temperature_sensor) {
      const sensorState = hass.states[attrs.outdoor_temperature_sensor];
      if (sensorState) {
        sensors.push(`<ha-icon icon="mdi:weather-partly-cloudy"></ha-icon> ${sensorState.state}°C`);
      }
    }
    if (attrs.temperature_sensor) {
      const sensorState = hass.states[attrs.temperature_sensor];
      if (sensorState) {
        sensors.push(`<ha-icon icon="mdi:thermometer-lines"></ha-icon> ${sensorState.state}°C`);
      }
    }
    if (sensors.length > 0) {
      this._sensorLineEl.innerHTML = sensors.join('&nbsp;&nbsp;&nbsp;');
    } else {
      this._sensorLineEl.innerHTML = '';
    }
  }

  _updateRoomSliders(rooms, hass) {
    // Build room sliders if not done
    if (!this._roomsBuilt) {
      this._roomSectionEl.innerHTML = '';
      rooms.forEach(room => {
        const block = document.createElement('div');
        block.className = 'room-block';
        block.innerHTML = `
          <input type="range" min="${room.min || 16}" max="${room.max || 30}" step="${room.step || 0.5}"
            class="styled-room-slider" data-room="${room.entity}" />
          <div class="slider-info">
            <div class="slider-name">${room.name || room.entity}</div>
            <div class="slider-temp"></div>
            <div class="slider-status"></div>
          </div>
        `;
        this._roomSectionEl.appendChild(block);

        // Setup event listeners for the slider
        const slider = block.querySelector('input[type=range]');
        slider.addEventListener('input', this._onSliderInput);
        slider.addEventListener('change', this._onSliderChange);
        slider.addEventListener('pointerdown', this._onSliderPointerDown);
        slider.addEventListener('pointerup', this._onSliderPointerUp);
      });
      this._roomsBuilt = true;
    }

    // Update each slider with current state
    this._roomSectionEl.querySelectorAll('input.styled-room-slider').forEach(slider => {
      const roomEntity = slider.dataset.room;
      const roomState = hass.states[roomEntity];
      if (!roomState) return;

      const val = this._localSliderValues[roomEntity] ?? Number(roomState.state);
      slider.value = val;

      // Update gradient background fill
      const min = Number(slider.min);
      const max = Number(slider.max);
      const percent = ((val - min) / (max - min)) * 100;
      slider.style.setProperty('--percent', `${percent}%`);

      // Update slider info
      const info = slider.nextElementSibling;
      if (info) {
        info.querySelector('.slider-temp').textContent = `${val.toFixed(1)}°`;
        info.querySelector('.slider-status').textContent = roomState.state === 'off' ? 'Off' : '';
      }
    });
  }

  // Helpers and event handlers

  _iconForMode(mode) {
    const map = {
      off: 'mdi:power',
      heat: 'mdi:fire',
      cool: 'mdi:snowflake',
      auto: 'mdi:autorenew',
      dry: 'mdi:water-percent',
      fan_only: 'mdi:fan',
    };
    return map[mode] || 'mdi:air-conditioner';
  }

  _onModeClick(e) {
    const mode = e.currentTarget.dataset.mode;
    if (!mode) return;

    this._callService('set_hvac_mode', { hvac_mode: mode });
  }

  _onFanClick(e) {
    const fan = e.currentTarget.dataset.fan;
    if (!fan) return;

    this._callService('set_fan_mode', { fan_mode: fan });
  }

  _onSetpointDec() {
    this._adjustTemperature(-1);
  }

  _onSetpointInc() {
    this._adjustTemperature(1);
  }

  _adjustTemperature(delta) {
    const climate = this._hass.states[this.config.entity];
    if (!climate) return;

    const attrs = climate.attributes;
    let currentTemp = this._localTemp ?? attrs.temperature;
    if (typeof currentTemp !== 'number') return;

    let newTemp = currentTemp + delta;
    if (attrs.min_temp && newTemp < attrs.min_temp) newTemp = attrs.min_temp;
    if (attrs.max_temp && newTemp > attrs.max_temp) newTemp = attrs.max_temp;

    this._localTemp = newTemp;
    this._tempValueEl.textContent = newTemp.toFixed(1);

    // Delay sending command on local temp, or send immediately?
    this._callService('set_temperature', { temperature: newTemp });
  }

  _onSliderInput(e) {
    const slider = e.target;
    const roomEntity = slider.dataset.room;
    if (!roomEntity) return;

    const val = parseFloat(slider.value);
    this._localSliderValues[roomEntity] = val;

    // Update gradient fill dynamically
    const min = Number(slider.min);
    const max = Number(slider.max);
    const percent = ((val - min) / (max - min)) * 100;
    slider.style.setProperty('--percent', `${percent}%`);

    // Update display temp
    const info = slider.nextElementSibling;
    if (info) {
      info.querySelector('.slider-temp').textContent = `${val.toFixed(1)}°`;
    }
  }

  _onSliderChange(e) {
    const slider = e.target;
    const roomEntity = slider.dataset.room;
    if (!roomEntity) return;

    const val = parseFloat(slider.value);
    this._localSliderValues[roomEntity] = val;

    // Call the climate set_temperature for that room entity
    this._callServiceForEntity(roomEntity, 'set_temperature', { temperature: val });
  }

  _onSliderPointerDown(e) {
    this._sliderDragging[e.target.dataset.room] = true;
  }

  _onSliderPointerUp(e) {
    const roomEntity = e.target.dataset.room;
    if (!roomEntity) return;

    this._sliderDragging[roomEntity] = false;

    // On pointer up, make sure to send latest value if needed
    const val = this._localSliderValues[roomEntity];
    if (val !== undefined) {
      this._callServiceForEntity(roomEntity, 'set_temperature', { temperature: val });
    }
  }

  _callService(service, data) {
    if (!this._hass || !this.config.entity) return;
    this._hass.callService('climate', service, { entity_id: this.config.entity, ...data });
  }

  _callServiceForEntity(entityId, service, data) {
    if (!this._hass) return;
    this._hass.callService('climate', service, { entity_id: entityId, ...data });
  }
}

customElements.define('aircon-control-card', AirconControlCard);
