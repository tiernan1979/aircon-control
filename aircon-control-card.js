class AirconControlCard extends HTMLElement {
  constructor() {
    super();
    this._localTemp = null;
    this._localSliderValues = {};
    this._sliderDragging = {};
    this._lastStates = {}; // Track last known states to detect changes
    this._setpointListenersAdded = false;
    this.attachShadow({ mode: 'open' });

    // Initialize HTML structure once
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
          color: var(--glow-color);
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
          background: var(--glow-color);
        }

        .temp-circle-container {
          position: relative;
          width: 140px;
          height: 140px;
          margin: 0 16px;
        }

        .temp-circle-container.glow .glow-bottom {
          opacity: 0.6;
          animation: halfGlowPulse 12s infinite ease-in-out;
        }

        .glow-bottom {
          position: absolute;
          bottom: -12px;
          left: 50%;
          transform: translateX(-50%);
          width: 140px;
          height: 70px;
          background: var(--glow-color);
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

        @keyframes halfGlowPulse {
          0%, 100% {
            opacity: 0.2;
          }
          50% {
            opacity: 0.6;
          }
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
          color: var(--glow-color);
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

        .sensor-line ha-icon[icon="mdi:home-outline"] {
          color: #4fc3f7;
        }
        .sensor-line ha-icon[icon="mdi:weather-sunny"] {
          color: #ffca28;
        }
        .sensor-line ha-icon[icon="mdi:solar-power"] {
          color: #fbc02d;
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

        .styled-room-slider {
          width: 100%;
          height: 34px;
          -webkit-appearance: none;
          appearance: none;
          border-radius: 12px;
          outline: none;
          transition: background 0.3s ease;
          margin: 0;
          margin-bottom: -10px;
        }

        .styled-room-slider.no-thumb::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 0;
          height: 0;
          transition: left 0.3s ease;
        }

        .styled-room-slider.no-thumb::-moz-range-thumb {
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
      </style>
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
              <span></span>
            </div>
          </div>
        </div>
        <button class="setpoint-button" id="inc-setpoint">+</button>
      </div>
      <div class="sensor-line"></div>
      <div class="room-section"></div>
    `;
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('You need to define an entity');
    }
    this.config = config;
    this.showModeNames = config.show_mode_names !== false;

    const modeData = {
      off: { icon: 'mdi:power', color: '#D69E5E', name: 'Off' },
      cool: { icon: 'mdi:snowflake', color: '#2196F3', name: 'Cool' },
      heat: { icon: 'mdi:fire', color: '#F44336', name: 'Heat' },
      fan_only: { icon: 'mdi:fan', color: '#9E9E9E', name: 'Fan' },
      dry: { icon: 'mdi:water-percent', color: '#009688', name: 'Dry' },
      auto: { icon: 'mdi:autorenew', color: '#FFC107', name: 'Auto' },
    };

    // Initialize HVAC mode buttons
    const modesContainer = this.shadowRoot.querySelector('.modes');
    let modeButtons = '';
    Object.entries(modeData).forEach(([modeKey, md]) => {
      modeButtons += `
        <button class="mode-btn" data-mode="${modeKey}" style="color:#ccc">
          <ha-icon icon="${md.icon}" style="color:#ccc"></ha-icon>
          ${this.showModeNames ? `<span class="mode-name">${md.name}</span>` : ''}
        </button>`;
    });
    modesContainer.innerHTML = modeButtons;

    modesContainer.querySelectorAll('.mode-btn').forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', () => {
        const mode = newBtn.getAttribute('data-mode');
        if (this._hass) {
          if (mode === 'off') {
            this._hass.callService('climate', 'turn_off', { entity_id: config.entity });
          } else {
            this._hass.callService('climate', 'set_hvac_mode', {
              entity_id: config.entity,
              hvac_mode: mode
            });
          }
        }
      });
    });

    // Initialize fan mode buttons with fallback
    const fanModesContainer = this.shadowRoot.querySelector('.fan-modes');
    const fallbackFanModes = ['low', 'medium', 'high', 'auto']; // Fallback if hass is unavailable
    const fanModes = this._hass && this._hass.states[config.entity]?.attributes.fan_modes?.length > 0
      ? this._hass.states[config.entity].attributes.fan_modes
      : fallbackFanModes;
    let fanSpeedButtons = '';
    fanModes.forEach(fm => {
      fanSpeedButtons += `
        <button class="fan-btn" data-fan-mode="${fm}" style="color:#ccc">
          <span class="fan-name">${fm.charAt(0).toUpperCase() + fm.slice(1)}</span>
        </button>`;
    });
    fanModesContainer.innerHTML = fanSpeedButtons;

    fanModesContainer.querySelectorAll('.fan-btn').forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', () => {
        const fm = newBtn.getAttribute('data-fan-mode');
        if (this._hass) {
          this._hass.callService('climate', 'set_fan_mode', {
            entity_id: config.entity,
            fan_mode: fm
          });
        }
      });
    });

    // Initialize room controls
    const roomSection = this.shadowRoot.querySelector('.room-section');
    if (config.rooms && Array.isArray(config.rooms)) {
      let roomControls = '';
      config.rooms.forEach(room => {
        const sliderColor = room.color ?? config.slider_color ?? '#1B86EF';
        const gradientStart = this.shadeColor(sliderColor, -40);
        roomControls += `
          <div class="room-block" data-entity="${room.slider_entity}">
            <input
              type="range"
              class="styled-room-slider no-thumb"
              min="0" max="100" step="1"
              value="0"
              data-entity="${room.slider_entity}"
              style="--gradient-start:${gradientStart}; --gradient-end:${sliderColor}; --percent:0%;"
            />
            <div class="slider-info">
              <span class="slider-name">${room.name}</span>
              <span class="slider-temp"></span>
              <span class="slider-status">0%</span>
            </div>
          </div>`;
      });
      roomSection.innerHTML = roomControls;

      this.shadowRoot.querySelectorAll('.styled-room-slider.no-thumb').forEach(slider => {
        const entityId = slider.getAttribute('data-entity');
        this._sliderDragging[entityId] = false;

        const newSlider = slider.cloneNode(true);
        slider.parentNode.replaceChild(newSlider, slider);

        newSlider.addEventListener('pointerdown', () => {
          this._sliderDragging[entityId] = true;
        });

        newSlider.addEventListener('pointerup', () => {
          this._sliderDragging[entityId] = false;
        });

        newSlider.addEventListener('pointercancel', () => {
          this._sliderDragging[entityId] = false;
        });

        newSlider.addEventListener('input', e => {
          const val = Number(e.target.value);
          this._localSliderValues[entityId] = val;
          e.target.style.setProperty('--percent', `${val}%`);
          const statusEl = e.target.parentElement.querySelector('.slider-status');
          if (statusEl) {
            statusEl.textContent = `${val}%`;
          }
        });

        newSlider.addEventListener('change', e => {
          const val = Number(e.target.value);
          this._localSliderValues[entityId] = undefined;
          if (this._hass) {
            this._hass.callService('cover', 'set_cover_position', {
              entity_id: entityId,
              position: val,
            });
          }
        });
      });
    } else {
      roomSection.innerHTML = '';
    }

    // Add setpoint button listeners
    if (!this._setpointListenersAdded) {
      const decBtn = this.shadowRoot.querySelector('#dec-setpoint');
      decBtn.addEventListener('click', () => {
        if (!this._hass || !this._hass.states[config.entity]) return;
        const climate = this._hass.states[config.entity];
        const minTemp = climate.attributes.min_temp ?? 16;
        const displayTemp = this._localTemp ?? (climate.attributes.temperature ?? climate.attributes.current_temperature ?? minTemp);
        let nt = displayTemp - 1;
        if (nt < minTemp) nt = minTemp;
        this._localTemp = nt;
        this._hass.callService('climate', 'set_temperature', {
          entity_id: config.entity,
          temperature: nt
        });
      });

      const incBtn = this.shadowRoot.querySelector('#inc-setpoint');
      incBtn.addEventListener('click', () => {
        if (!this._hass || !this._hass.states[config.entity]) return;
        const climate = this._hass.states[config.entity];
        const maxTemp = climate.attributes.max_temp ?? 30;
        const displayTemp = this._localTemp ?? (climate.attributes.temperature ?? climate.attributes.current_temperature ?? maxTemp);
        let nt = displayTemp + 1;
        if (nt > maxTemp) nt = maxTemp;
        this._localTemp = nt;
        this._hass.callService('climate', 'set_temperature', {
          entity_id: config.entity,
          temperature: nt
        });
      });
      this._setpointListenersAdded = true;
    }
  }

  set hass(hass) {
    this._hass = hass;
    const cfg = this.config;
    if (!cfg || !hass.states[cfg.entity]) {
      this.shadowRoot.innerHTML = `<hui-warning>${cfg?.entity || 'Entity'} not available</hui-warning>`;
      return;
    }

    const climate = hass.states[cfg.entity];
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
      off: { icon: 'mdi:power', color: '#D69E5E', name: 'Off' },
      cool: { icon: 'mdi:snowflake', color: '#2196F3', name: 'Cool' },
      heat: { icon: 'mdi:fire', color: '#F44336', name: 'Heat' },
      fan_only: { icon: 'mdi:fan', color: '#9E9E9E', name: 'Fan' },
      dry: { icon: 'mdi:water-percent', color: '#009688', name: 'Dry' },
      auto: { icon: 'mdi:autorenew', color: '#FFC107', name: 'Auto' },
    };

    const glowColor = modeData[currentMode]?.color ?? '#b37fed';
    if (this._lastStates.glowColor !== glowColor) {
      this.shadowRoot.host.style.setProperty('--glow-color', glowColor);
      this._lastStates.glowColor = glowColor;
    }

    const getState = id => {
      const s = hass.states[id];
      if (!s || s.state === 'unknown' || s.state === 'unavailable') {
        return null;
      }
      return s.state;
    };

    // Update sensor line only if sensors have changed
    const sensorSolar = cfg.solar_sensor ? getState(cfg.solar_sensor) : null;
    const sensorHouseTemp = cfg.house_temp_sensor ? getState(cfg.house_temp_sensor) : null;
    const sensorHouseHum = cfg.house_humidity_sensor ? getState(cfg.house_humidity_sensor) : null;
    const sensorOutsideTemp = cfg.outside_temp_sensor ? getState(cfg.outside_temp_sensor) : null;
    const sensorOutsideHum = cfg.outside_humidity_sensor ? getState(cfg.outside_humidity_sensor) : null;

    const sensorKey = `${sensorSolar}|${sensorHouseTemp}|${sensorHouseHum}|${sensorOutsideTemp}|${sensorOutsideHum}`;
    if (this._lastStates.sensorKey !== sensorKey) {
      const sensorLine = this.shadowRoot.querySelector('.sensor-line');
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
        sensorLine.innerHTML = parts.join(' | ');
      } else {
        sensorLine.innerHTML = '';
      }
      this._lastStates.sensorKey = sensorKey;
    }

    // Update mode buttons only if mode has changed
    if (this._lastStates.currentMode !== currentMode) {
      this.shadowRoot.querySelectorAll('.mode-btn').forEach(btn => {
        const modeKey = btn.getAttribute('data-mode');
        const isSel = currentMode === modeKey;
        const color = isSel ? modeData[modeKey].color : '#ccc';
        btn.classList.toggle('mode-selected', isSel);
        btn.style.color = color;
        btn.querySelector('ha-icon').style.color = color;
      });
      this._lastStates.currentMode = currentMode;
    }

    // Update fan mode buttons only if fan mode has changed
    if (this._lastStates.currentFanMode !== currentFanMode) {
      this.shadowRoot.querySelectorAll('.fan-btn').forEach(btn => {
        const fm = btn.getAttribute('data-fan-mode');
        const sel = currentFanMode && currentFanMode.toLowerCase() === fm.toLowerCase();
        btn.classList.toggle('fan-selected', sel);
        btn.style.color = sel ? glowColor : '#ccc';
      });
      this._lastStates.currentFanMode = currentFanMode;
    }

    // Update temperature display and mode in circle only if temperature, power state, or mode has changed
    const tempKey = `${displayTemp}|${powerOn}|${currentMode}`;
    if (this._lastStates.tempKey !== tempKey) {
      const tempCircleContainer = this.shadowRoot.querySelector('.temp-circle-container');
      tempCircleContainer.classList.toggle('glow', powerOn);
      const tempValue = this.shadowRoot.querySelector('.temp-value');
      tempValue.textContent = `${displayTemp.toFixed(1)}°C`;
      const modeInCircle = this.shadowRoot.querySelector('.mode-in-circle');
      modeInCircle.querySelector('ha-icon').setAttribute('icon', modeData[currentMode]?.icon || '');
      modeInCircle.querySelector('span').textContent = modeData[currentMode]?.name || '';
      this._lastStates.tempKey = tempKey;
    }

    // Update room sliders only if their state or sensor has changed
    if (cfg.rooms && Array.isArray(cfg.rooms)) {
      this.shadowRoot.querySelectorAll('.room-block').forEach(block => {
        const entityId = block.getAttribute('data-entity');
        const slider = block.querySelector('.styled-room-slider');
        const sliderEnt = hass.states[entityId];
        const room = cfg.rooms.find(r => r.slider_entity === entityId);
        const sensorEnt = room ? hass.states[room.sensor_entity] : null;
        let sliderVal = 0;
        if (sliderEnt) {
          if (sliderEnt.attributes.current_position != null) {
            sliderVal = parseInt(sliderEnt.attributes.current_position) || 0;
          } else if (!isNaN(Number(sliderEnt.state))) {
            sliderVal = Number(sliderEnt.state);
          }
        }
        sliderVal = Math.max(0, Math.min(100, sliderVal));
        const sensorVal = sensorEnt && !isNaN(Number(sensorEnt.state)) ? Number(sensorEnt.state) : null;

        const sliderKey = `${sliderVal}|${sensorVal}`;
        if (this._lastStates[entityId] !== sliderKey && !this._sliderDragging[entityId]) {
          const localVal = this._localSliderValues[entityId];
          const displayVal = localVal !== undefined ? localVal : sliderVal;
          slider.value = displayVal;
          slider.style.setProperty('--percent', `${displayVal}%`);
          const sliderStatus = block.querySelector('.slider-status');
          if (sliderStatus) {
            sliderStatus.textContent = `${displayVal}%`;
          }
          const sliderTemp = block.querySelector('.slider-temp');
          if (sliderTemp) {
            sliderTemp.textContent = sensorVal !== null ? `${sensorVal.toFixed(1)}°C` : '';
          }
          this._lastStates[entityId] = sliderKey;
        }
      });
    }
  }

  shadeColor(color, percent) {
    let R = parseInt(color.substring(1, 3), 16);
    let G = parseInt(color.substring(3, 5), 16);
    let B = parseInt(color.substring(5, 7), 16);

    R = parseInt(R * (100 + percent) / 100);
    G = parseInt(G * (100 + percent) / 100);
    B = parseInt(B * (100 + percent) / 100);

    R = R < 255 ? R : 255;
    G = G < 255 ? G : 255;
    B = B < 255 ? B : 255;

    const RR = R.toString(16).length === 1 ? "0" + R.toString(16) : R.toString(16);
    const GG = G.toString(16).length === 1 ? "0" + G.toString(16) : G.toString(16);
    const BB = B.toString(16).length === 1 ? "0" + B.toString(16) : B.toString(16);

    return "#" + RR + GG + BB;
  }

  getCardSize() {
    return 6;
  }
}

customElements.define('aircon-control-card', AirconControlCard);
