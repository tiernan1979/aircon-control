class AirconControlCard extends HTMLElement {
  constructor() {
    super();
    this._localTemp = null;
    this._localSliderValues = {};
    this._sliderDragging = {};
    this.attachShadow({ mode: 'open' });  // Use shadow DOM for style encapsulation
  }

  setConfig(config) {
    if (!config.entity) throw new Error('You need to define an entity');
    this.config = config;
    this.showModeNames = config.show_mode_names !== false;
  }

  connectedCallback() {
    // Build the static HTML once

    // Inject styles
    this.shadowRoot.innerHTML = `
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
        button {
          cursor: pointer;
          background: transparent;
          border: none;
          outline: none;
          color: #ccc;
          font-size: 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          transition: color 0.3s;
        }
        button.mode-selected, button.fan-selected {
          color: var(--glow-color, #b37fed);
        }
        button ha-icon {
          font-size: 26px;
          color: inherit;
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
        .temp-circle::before {
          content: '';
          position: absolute;
          top: 18px;
          left: 20px;
          width: 48px;
          height: 28px;
          background: radial-gradient(circle at 30% 30%, rgba(255 255 255 / 0.8), transparent 70%);
          border-radius: 50%;
          filter: blur(2px);
          pointer-events: none;
          z-index: 2;
        }
        .temp-circle::after {
          content: '';
          position: absolute;
          top: 50px;
          left: 80px;
          width: 30px;
          height: 15px;
          background: radial-gradient(circle at 50% 50%, rgba(255 255 255 / 0.4), transparent 70%);
          border-radius: 50%;
          filter: blur(1.5px);
          pointer-events: none;
          z-index: 2;
        }
        .temp-circle .reflection {
          position: absolute;
          top: 30px;
          left: 50px;
          width: 40px;
          height: 40px;
          background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8), transparent 70%);
          border-radius: 50%;
          pointer-events: none;
          filter: blur(6px);
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
        input[type="range"].styled-room-slider {
          width: 100%;
          height: 34px;
          -webkit-appearance: none;
          appearance: none;
          border-radius: 12px;
          outline: none;
          transition: background 0.3s ease;
          margin: 0 0 -10px 0;
          background: linear-gradient(to right, var(--gradient-start, #0a3d73) 0%, var(--gradient-end, #1B86EF) var(--percent), #333 var(--percent), #333 100%);
        }
        input[type="range"].no-thumb::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 0;
          height: 0;
          transition: left 0.3s ease;
          cursor: pointer;
        }
        input[type="range"].no-thumb::-moz-range-thumb {
          width: 0;
          height: 0;
          transition: left 0.3s ease;
          cursor: pointer;
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
        .sensor-line ha-icon[icon="mdi:home-outline"] {
          color: #4fc3f7;
        }
        .sensor-line ha-icon[icon="mdi:weather-sunny"] {
          color: #ffca28;
        }
        .sensor-line ha-icon[icon="mdi:solar-power"] {
          color: #fbc02d;
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
      </style>

      <div id="modeButtons" class="modes"></div>
      <div id="fanButtons" class="fan-modes"></div>

      <div class="temp-setpoint-wrapper">
        <button id="decSetpoint" class="setpoint-button">−</button>
        <div id="tempCircleContainer" class="temp-circle-container">
          <div class="glow-bottom"></div>
          <div class="temp-circle">
            <div class="reflection"></div>
            <div id="tempValue" class="temp-value">--°</div>
            <div id="modeInCircle" class="mode-in-circle">
              <ha-icon id="modeIcon" icon="mdi:power"></ha-icon>
              <span id="modeName">--</span>
            </div>
          </div>
        </div>
        <button id="incSetpoint" class="setpoint-button">+</button>
      </div>

      <div class="room-section" id="roomSliders"></div>

      <div class="sensor-line" id="sensorInfo">
        <ha-icon icon="mdi:home-outline"></ha-icon>
        <span id="roomTemp">--°</span>
        <ha-icon icon="mdi:weather-sunny"></ha-icon>
        <span id="outsideTemp">--°</span>
        <ha-icon icon="mdi:solar-power"></ha-icon>
        <span id="solarPower">-- W</span>
      </div>
    `;

    // Cache references for later updates
    this.$modeButtons = this.shadowRoot.getElementById('modeButtons');
    this.$fanButtons = this.shadowRoot.getElementById('fanButtons');
    this.$decSetpoint = this.shadowRoot.getElementById('decSetpoint');
    this.$incSetpoint = this.shadowRoot.getElementById('incSetpoint');
    this.$tempValue = this.shadowRoot.getElementById('tempValue');
    this.$modeIcon = this.shadowRoot.getElementById('modeIcon');
    this.$modeName = this.shadowRoot.getElementById('modeName');
    this.$tempCircleContainer = this.shadowRoot.getElementById('tempCircleContainer');
    this.$roomSliders = this.shadowRoot.getElementById('roomSliders');
    this.$sensorInfo = this.shadowRoot.getElementById('sensorInfo');
    this.$roomTemp = this.shadowRoot.getElementById('roomTemp');
    this.$outsideTemp = this.shadowRoot.getElementById('outsideTemp');
    this.$solarPower = this.shadowRoot.getElementById('solarPower');

    // Bind event handlers
    this.$decSetpoint.addEventListener('click', () => this.changeSetpoint(-1));
    this.$incSetpoint.addEventListener('click', () => this.changeSetpoint(1));

    // Set initial slider dragging state
    this._sliderDragging = {};
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.config || !hass) return;

    const entity = hass.states[this.config.entity];
    if (!entity) return;

    // Extract attributes
    const attrs = entity.attributes || {};
    const currentTemp = entity.state === 'off' ? null : Number(entity.attributes.current_temperature || entity.attributes.temperature || entity.attributes.current_temp);
    const targetTemp = Number(entity.attributes.temperature);
    const minTemp = Number(entity.attributes.min_temp) || 16;
    const maxTemp = Number(entity.attributes.max_temp) || 30;
    const modes = entity.attributes.available_modes || entity.attributes.modes || [];
    const fanModes = entity.attributes.fan_modes || [];
    const currentMode = entity.state === 'off' ? 'off' : entity.state;
    const currentFanMode = entity.attributes.fan_mode || '';

    // Update temperature circle and mode display
    this.updateTemperatureDisplay(targetTemp, currentMode);

    // Update mode buttons
    this.updateModeButtons(modes, currentMode);

    // Update fan mode buttons
    this.updateFanButtons(fanModes, currentFanMode);

    // Update setpoint buttons enabled state
    this.updateSetpointButtons(targetTemp, minTemp, maxTemp);

    // Update room sliders for each sensor (if any)
    if (attrs.room_sliders && Array.isArray(attrs.room_sliders)) {
      this.updateRoomSliders(attrs.room_sliders, hass);
    }

    // Update sensor info line
    this.updateSensorInfo(hass, attrs);

  }

  updateTemperatureDisplay(temp, mode) {
    if (temp == null || isNaN(temp)) {
      this.$tempValue.textContent = '--°';
    } else {
      this.$tempValue.textContent = `${Math.round(temp)}°`;
    }

    // Update glow on temp circle only if mode is cooling or heating
    const glowModes = ['cool', 'heat', 'dry', 'auto'];
    if (glowModes.includes(mode)) {
      this.$tempCircleContainer.classList.add('glow');
    } else {
      this.$tempCircleContainer.classList.remove('glow');
    }

    // Update mode icon and text
    const modeIconMap = {
      off: 'mdi:power',
      cool: 'mdi:snowflake',
      heat: 'mdi:fire',
      dry: 'mdi:water-percent',
      auto: 'mdi:autorenew',
      fan_only: 'mdi:fan'
    };
    this.$modeIcon.setAttribute('icon', modeIconMap[mode] || 'mdi:power');
    this.$modeName.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
  }

  updateModeButtons(modes, currentMode) {
    // Only update if modes changed or first time
    if (!this._lastModes || JSON.stringify(this._lastModes) !== JSON.stringify(modes)) {
      this._lastModes = modes;
      this.$modeButtons.innerHTML = '';
      modes.forEach(mode => {
        const btn = document.createElement('button');
        btn.setAttribute('title', mode.charAt(0).toUpperCase() + mode.slice(1));
        btn.classList.toggle('mode-selected', mode === currentMode);
        btn.innerHTML = `<ha-icon icon="${this.getModeIcon(mode)}"></ha-icon>` + (this.showModeNames ? `<div>${mode.charAt(0).toUpperCase() + mode.slice(1)}</div>` : '');
        btn.addEventListener('click', () => this.setMode(mode));
        this.$modeButtons.appendChild(btn);
      });
    } else {
      // Update selected mode button only
      [...this.$modeButtons.children].forEach(btn => {
        btn.classList.toggle('mode-selected', btn.title.toLowerCase() === currentMode);
      });
    }
  }

  updateFanButtons(fanModes, currentFanMode) {
    if (!this._lastFanModes || JSON.stringify(this._lastFanModes) !== JSON.stringify(fanModes)) {
      this._lastFanModes = fanModes;
      this.$fanButtons.innerHTML = '';
      fanModes.forEach(fan => {
        const btn = document.createElement('button');
        btn.setAttribute('title', fan.charAt(0).toUpperCase() + fan.slice(1));
        btn.classList.toggle('fan-selected', fan === currentFanMode);
        btn.innerHTML = `<ha-icon icon="${this.getFanIcon(fan)}"></ha-icon>` + (this.showModeNames ? `<div>${fan.charAt(0).toUpperCase() + fan.slice(1)}</div>` : '');
        btn.addEventListener('click', () => this.setFanMode(fan));
        this.$fanButtons.appendChild(btn);
      });
    } else {
      [...this.$fanButtons.children].forEach(btn => {
        btn.classList.toggle('fan-selected', btn.title.toLowerCase() === currentFanMode);
      });
    }
  }

  updateSetpointButtons(temp, min, max) {
    this.$decSetpoint.disabled = temp <= min;
    this.$incSetpoint.disabled = temp >= max;
  }

  updateRoomSliders(roomSliders, hass) {
    // We'll build the sliders only if the set of sliders has changed (by name)
    const sliderKeys = roomSliders.map(s => s.name).join(',');
    if (this._lastSliderKeys !== sliderKeys) {
      this._lastSliderKeys = sliderKeys;
      this.$roomSliders.innerHTML = '';

      roomSliders.forEach(slider => {
        const div = document.createElement('div');
        div.classList.add('room-block');
        div.innerHTML = `
          <div class="slider-info">
            <div class="slider-name">${slider.name}</div>
            <div class="slider-status">--</div>
            <div class="slider-temp">--°</div>
          </div>
          <input
            type="range"
            min="${slider.min_temp ?? 16}"
            max="${slider.max_temp ?? 30}"
            step="1"
            class="styled-room-slider no-thumb"
            value="${slider.value ?? slider.min_temp ?? 16}"
            data-entity="${slider.entity}"
          />
        `;
        this.$roomSliders.appendChild(div);

        const input = div.querySelector('input[type=range]');
        const statusEl = div.querySelector('.slider-status');
        const tempEl = div.querySelector('.slider-temp');

        // Update UI for initial value
        this.updateSliderGradient(input);

        // Event handlers
        input.addEventListener('input', e => {
          // Store dragging state
          this._sliderDragging[slider.name] = true;
          this.updateSliderGradient(e.target);
          // update displayed value
          tempEl.textContent = e.target.value + '°';
          statusEl.textContent = '...';
        });
        input.addEventListener('change', e => {
          this._sliderDragging[slider.name] = false;
          this.updateSliderGradient(e.target);
          tempEl.textContent = e.target.value + '°';
          statusEl.textContent = 'Set';
          this.callServiceToSetTemp(e.target.dataset.entity, Number(e.target.value));
        });
      });
    } else {
      // Update values only for existing sliders
      const sliderDivs = Array.from(this.$roomSliders.children);
      roomSliders.forEach(slider => {
        const div = sliderDivs.find(d => d.querySelector('.slider-name').textContent === slider.name);
        if (!div) return;
        const input = div.querySelector('input[type=range]');
        const statusEl = div.querySelector('.slider-status');
        const tempEl = div.querySelector('.slider-temp');

        if (!this._sliderDragging[slider.name]) {
          input.value = slider.value;
          tempEl.textContent = slider.value + '°';
          statusEl.textContent = 'OK';
          this.updateSliderGradient(input);
        }
      });
    }
  }

  updateSensorInfo(hass, attrs) {
    // Example: attributes should contain room_temperature, outside_temperature, solar_power
    const roomTemp = hass.states[attrs.room_temperature_entity]?.state || '--';
    const outsideTemp = hass.states[attrs.outside_temperature_entity]?.state || '--';
    const solarPower = hass.states[attrs.solar_power_entity]?.state || '--';

    this.$roomTemp.textContent = roomTemp + '°';
    this.$outsideTemp.textContent = outsideTemp + '°';
    this.$solarPower.textContent = solarPower + (solarPower !== '--' ? ' W' : '');
  }

  updateSliderGradient(input) {
    const min = Number(input.min);
    const max = Number(input.max);
    const val = Number(input.value);
    const percent = ((val - min) / (max - min)) * 100;
    input.style.setProperty('--percent', `${percent}%`);
  }

  getModeIcon(mode) {
    const icons = {
      off: 'mdi:power',
      cool: 'mdi:snowflake',
      heat: 'mdi:fire',
      dry: 'mdi:water-percent',
      auto: 'mdi:autorenew',
      fan_only: 'mdi:fan'
    };
    return icons[mode] || 'mdi:power';
  }

  getFanIcon(fan) {
    const icons = {
      low: 'mdi:fan-speed-1',
      medium: 'mdi:fan-speed-2',
      high: 'mdi:fan-speed-3',
      auto: 'mdi:fan',
      silent: 'mdi:fan-off',
    };
    return icons[fan] || 'mdi:fan';
  }

  setMode(mode) {
    if (!this._hass || !this.config.entity) return;
    this._hass.callService('climate', 'set_hvac_mode', {
      entity_id: this.config.entity,
      hvac_mode: mode,
    });
  }

  setFanMode(fanMode) {
    if (!this._hass || !this.config.entity) return;
    this._hass.callService('climate', 'set_fan_mode', {
      entity_id: this.config.entity,
      fan_mode: fanMode,
    });
  }

  changeSetpoint(delta) {
    if (!this._hass || !this.config.entity) return;

    const entity = this._hass.states[this.config.entity];
    if (!entity) return;
    const attrs = entity.attributes;
    const currentTemp = Number(attrs.temperature);
    const minTemp = Number(attrs.min_temp) || 16;
    const maxTemp = Number(attrs.max_temp) || 30;
    let newTemp = currentTemp + delta;
    if (newTemp < minTemp) newTemp = minTemp;
    if (newTemp > maxTemp) newTemp = maxTemp;

    this._hass.callService('climate', 'set_temperature', {
      entity_id: this.config.entity,
      temperature: newTemp,
    });
  }

  callServiceToSetTemp(entityId, temp) {
    if (!this._hass) return;
    this._hass.callService('climate', 'set_temperature', {
      entity_id: entityId,
      temperature: temp,
    });
  }
}

customElements.define('aircon-control-card', AirconControlCard);
