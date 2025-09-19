class AirconControlCard extends HTMLElement {
  constructor() {
    super();
    this._localTemp = null;
    this._localSliderValues = {};
    this._sliderDragging = {};
    this.attachShadow({ mode: 'open' });
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('You need to define an entity');
    }
    this.config = config;
    this.showModeNames = config.show_mode_names !== false;

    // Build HTML and styles only once
    this._buildCard();
  }

  // Utility to create DOM from string
  _createFragment(html) {
    return document.createRange().createContextualFragment(html);
  }

  _buildCard() {
    const style = document.createElement('style');
    style.textContent = `
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
        /* color updated dynamically */
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
        /* glow color updated dynamically */
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
        background: linear-gradient(
          to right,
          var(--gradient-start, #0a3d73) 0%,
          var(--gradient-end, #1B86EF) var(--percent),
          #333 var(--percent),
          #333 100%
        );
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
        width: 48px;
        font-weight: 600;
        font-size: 18px;
        text-align: right;
        font-family: monospace;
        color: white;
        user-select: none;
      }
    `;

    // Main container div
    const container = document.createElement('div');

    container.innerHTML = `
      <div class="modes">
        <button class="mode-btn" data-mode="off" title="Off">
          <ha-icon icon="mdi:power" style="font-size: 28px"></ha-icon>
          <span class="mode-name">Off</span>
        </button>
        <button class="mode-btn" data-mode="auto" title="Auto">
          <ha-icon icon="mdi:calendar-repeat" style="font-size: 28px"></ha-icon>
          <span class="mode-name">Auto</span>
        </button>
        <button class="mode-btn" data-mode="cool" title="Cool">
          <ha-icon icon="mdi:snowflake" style="font-size: 28px"></ha-icon>
          <span class="mode-name">Cool</span>
        </button>
        <button class="mode-btn" data-mode="dry" title="Dry">
          <ha-icon icon="mdi:water-percent" style="font-size: 28px"></ha-icon>
          <span class="mode-name">Dry</span>
        </button>
        <button class="mode-btn" data-mode="heat" title="Heat">
          <ha-icon icon="mdi:fire" style="font-size: 28px"></ha-icon>
          <span class="mode-name">Heat</span>
        </button>
      </div>

      <div class="temp-setpoint-wrapper">
        <button class="setpoint-button setpoint-minus" title="Decrease temp">-</button>
        <div class="temp-circle-container">
          <div class="temp-circle">
            <div class="reflection"></div>
            <div class="temp-value">--</div>
            <div class="mode-in-circle" style="visibility: hidden;">
              <ha-icon icon="mdi:weather-sunny"></ha-icon>
              <span class="mode-in-circle-name">--</span>
            </div>
          </div>
          <div class="glow-bottom"></div>
        </div>
        <button class="setpoint-button setpoint-plus" title="Increase temp">+</button>
      </div>

      <div class="fan-modes">
        <button class="fan-btn" data-fan="auto" title="Fan Auto">
          <ha-icon icon="mdi:fan-auto"></ha-icon>
          <span class="fan-name">Auto</span>
        </button>
        <button class="fan-btn" data-fan="low" title="Fan Low">
          <ha-icon icon="mdi:fan-speed-1"></ha-icon>
          <span class="fan-name">Low</span>
        </button>
        <button class="fan-btn" data-fan="medium" title="Fan Medium">
          <ha-icon icon="mdi:fan-speed-2"></ha-icon>
          <span class="fan-name">Medium</span>
        </button>
        <button class="fan-btn" data-fan="high" title="Fan High">
          <ha-icon icon="mdi:fan-speed-3"></ha-icon>
          <span class="fan-name">High</span>
        </button>
      </div>

      <div class="room-section">
        <!-- Room sensors sliders inserted here dynamically -->
      </div>
    `;

    // Clear shadow root
    this.shadowRoot.innerHTML = '';
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(container);

    // Cache important elements for update:
    this._modeButtons = Array.from(container.querySelectorAll('.mode-btn'));
    this._fanButtons = Array.from(container.querySelectorAll('.fan-btn'));
    this._tempValueEl = container.querySelector('.temp-value');
    this._modeInCircleEl = container.querySelector('.mode-in-circle');
    this._modeInCircleName = container.querySelector('.mode-in-circle-name');
    this._glowBottom = container.querySelector('.glow-bottom');
    this._tempCircleContainer = container.querySelector('.temp-circle-container');
    this._setpointMinus = container.querySelector('.setpoint-minus');
    this._setpointPlus = container.querySelector('.setpoint-plus');
    this._roomSection = container.querySelector('.room-section');

    // Event handlers for mode buttons
    this._modeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this._callService('set_hvac_mode', { hvac_mode: btn.dataset.mode });
      });
    });

    // Event handlers for fan buttons
    this._fanButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this._callService('set_fan_mode', { fan_mode: btn.dataset.fan });
      });
    });

    // Event handlers for +/- setpoint buttons
    this._setpointMinus.addEventListener('click', () => {
      if (this._localTemp != null) {
        this._setTemp(this._localTemp - 1);
      }
    });
    this._setpointPlus.addEventListener('click', () => {
      if (this._localTemp != null) {
        this._setTemp(this._localTemp + 1);
      }
    });

    // Initial room sliders map (key = room name)
    this._roomSliders = new Map();
  }

  // Utility to call service
  _callService(service, data) {
    if (!this.hass || !this.config || !this.config.entity) return;
    this.hass.callService('climate', service, {
      entity_id: this.config.entity,
      ...data,
    });
  }

  // Utility to set temperature (clamped)
  _setTemp(newTemp) {
    if (!this.hass || !this.config) return;
    const entity = this.hass.states[this.config.entity];
    if (!entity) return;

    const minTemp = entity.attributes.min_temp ?? 16;
    const maxTemp = entity.attributes.max_temp ?? 30;
    const temp = Math.min(Math.max(newTemp, minTemp), maxTemp);

    // Update local temp to prevent slider jump
    this._localTemp = temp;
    this._callService('set_temperature', { temperature: temp });
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.config || !hass) return;
    const entity = hass.states[this.config.entity];
    if (!entity) return;

    const state = entity.state;
    const attrs = entity.attributes;

    // --- MODE buttons ---
    const currentMode = attrs.hvac_mode || 'off';
    this._modeButtons.forEach(btn => {
      if (btn.dataset.mode === currentMode) {
        btn.classList.add('mode-selected');
        btn.style.color = attrs.hvac_mode === 'off' ? '#888' : '#B37FED';
      } else {
        btn.classList.remove('mode-selected');
        btn.style.color = '#ccc';
      }
    });

    // --- FAN buttons ---
    const currentFan = attrs.fan_mode || 'auto';
    this._fanButtons.forEach(btn => {
      if (btn.dataset.fan === currentFan) {
        btn.classList.add('fan-selected');
        btn.style.color = '#b37fed';
      } else {
        btn.classList.remove('fan-selected');
        btn.style.color = '#ccc';
      }
    });

    // --- Setpoint temp display ---
    let setpointTemp = attrs.temperature;
    // Handle local temp override while sliding
    if (this._localTemp != null) {
      setpointTemp = this._localTemp;
    }

    if (typeof setpointTemp === 'number') {
      this._tempValueEl.textContent = setpointTemp.toFixed(1);
      this._localTemp = setpointTemp;
    } else {
      this._tempValueEl.textContent = '--';
      this._localTemp = null;
    }

    // --- Mode name and icon inside circle ---
    if (currentMode && currentMode !== 'off') {
      this._modeInCircleEl.style.visibility = 'visible';
      const iconMap = {
        auto: 'mdi:calendar-repeat',
        cool: 'mdi:snowflake',
        dry: 'mdi:water-percent',
        heat: 'mdi:fire',
        off: 'mdi:power',
      };
      const iconName = iconMap[currentMode] || 'mdi:power';
      this._modeInCircleEl.querySelector('ha-icon').setAttribute('icon', iconName);
      this._modeInCircleName.textContent = currentMode.charAt(0).toUpperCase() + currentMode.slice(1);
    } else {
      this._modeInCircleEl.style.visibility = 'hidden';
    }

    // --- Glow color ---
    const glowColors = {
      off: '#444',
      auto: '#a28ee4',
      cool: '#4aa6fc',
      dry: '#449c5a',
      heat: '#d44e40',
    };
    const glowColor = glowColors[currentMode] || '#b37fed';

    this._glowBottom.style.background = glowColor;
    this._tempCircleContainer.style.setProperty('--glow-color', glowColor);

    // --- Glow animation toggle ---
    if (currentMode !== 'off') {
      this._tempCircleContainer.classList.add('glow');
    } else {
      this._tempCircleContainer.classList.remove('glow');
    }

    // --- Setpoint button hover glow ---
    this._setpointMinus.style.setProperty('background-color', glowColor);
    this._setpointPlus.style.setProperty('background-color', glowColor);
    this._setpointMinus.style.transition = 'background-color 0.3s ease';
    this._setpointPlus.style.transition = 'background-color 0.3s ease';

    // --- Sensors (rooms) sliders ---
    const rooms = attrs.rooms || [];

    // Clear old sliders if count changed
    if (this._roomSliders.size !== rooms.length) {
      this._roomSection.innerHTML = '';
      this._roomSliders.clear();

      rooms.forEach(room => {
        const roomBlock = document.createElement('div');
        roomBlock.className = 'room-block';

        // Slider input
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = 0;
        slider.max = 100;
        slider.step = 1;
        slider.className = 'styled-room-slider';
        slider.value = room.percentage;

        // Styling gradient fill by CSS variable
        slider.style.setProperty('--percent', `${room.percentage}%`);
        slider.style.setProperty('--gradient-start', '#0a3d73');
        slider.style.setProperty('--gradient-end', '#1B86EF');

        // Label/info overlay
        const info = document.createElement('div');
        info.className = 'slider-info';
        info.innerHTML = `
          <div class="slider-name">${room.name}</div>
          <div class="slider-status">${room.status}</div>
          <div class="slider-temp">${room.temp ? room.temp.toFixed(1) : '--'}°C</div>
        `;

        roomBlock.appendChild(slider);
        roomBlock.appendChild(info);

        // Attach slider event listeners
        slider.addEventListener('input', () => {
          this._localSliderValues[room.name] = Number(slider.value);
          slider.style.setProperty('--percent', `${slider.value}%`);
          // Update overlay value instantly
          info.querySelector('.slider-status').textContent = `${slider.value}%`;
        });
        slider.addEventListener('change', () => {
          // On release, call service or dispatch event
          this._callService('set_room_percentage', {
            room_name: room.name,
            percentage: Number(slider.value),
          });
          this._localSliderValues[room.name] = null;
        });

        this._roomSection.appendChild(roomBlock);
        this._roomSliders.set(room.name, { slider, info });
      });
    } else {
      // Update existing sliders values and overlays
      rooms.forEach(room => {
        const ref = this._roomSliders.get(room.name);
        if (!ref) return;
        const { slider, info } = ref;

        const localVal = this._localSliderValues[room.name];
        const val = localVal != null ? localVal : room.percentage;

        if (slider.value !== String(val)) {
          slider.value = val;
          slider.style.setProperty('--percent', `${val}%`);
        }
        info.querySelector('.slider-name').textContent = room.name;
        info.querySelector('.slider-status').textContent = `${val}%`;
        info.querySelector('.slider-temp').textContent = room.temp ? room.temp.toFixed(1) + '°C' : '--';
      });
    }
  }

  getCardSize() {
    return 3;
  }
}

customElements.define('aircon-control-card', AirconControlCard);
