class AirconControlCard extends HTMLElement {
  constructor() {
    super();
    this._localTemp = null;
    this._localSliderValues = {};
    this._sliderDragging = {};
    this._lastStates = {};
    this._setpointListenersAdded = false;
    this._lastConfig = null;               // <-- for config-change detection
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          font-family: 'Roboto', sans-serif;
          background: var(--card-background-color, #000);
          color: var(--text-color, white);
          border-radius: 12px;
          padding: 16px;
          display: block;
          user-select: none;
          transition: background-color 0.3s ease;
        }
        .modes {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
          background:
            linear-gradient(145deg, rgba(255,255,255,0.1), rgba(0,0,0,0.3)),
            radial-gradient(circle at 60% 60%, var(--sphere-secondary, rgba(255,105,180, 0.2)), transparent 70%),
            radial-gradient(circle at 30% 30%, var(--sphere-primary, rgba(186,85,211, 0.3)), transparent 70%),
            radial-gradient(circle at center, #0a0a0a 40%, #000000 100%);
          border-radius: 50px;
          padding: 10px;
          box-shadow:
            inset 0 8px 12px rgba(255, 255, 255, 0.15),
            inset 0 -8px 12px rgba(0, 0, 0, 0.9),
            0 3px 6px rgba(0, 0, 0, 0.4);
          width: fit-content;
          margin: 0 auto 12px;
        }
        .fan-modes {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        .fan-btn-container {
          background: linear-gradient(145deg, var(--fan-base-color-light), var(--fan-base-color-dark));
          border-radius: 6px;
          padding: 4px 8px;
          box-shadow:
            0 2px 4px rgba(0, 0, 0, 0.3),
            inset 0 1px 2px rgba(255, 255, 255, 0.1);
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
          transition: color 0.3s, transform 0.2s;
          font-size: 14px;
        }
        .mode-btn:hover, .fan-btn:hover {
          transform: scale(1.1);
        }
        .mode-btn.mode-selected, .fan-btn.fan-selected {
          color: var(--glow-color);
        }
        .mode-btn ha-icon, .fan-btn ha-icon {
          font-size: 26px;
        }
        .mode-name, .fan-name {
          font-size: 14px;
          color: var(--text-color, white);
        }
        .temp-setpoint-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .setpoint-button {
          width: 40px;
          height: 40px;
          background: linear-gradient(145deg, var(--button-color), var(--button-color-dark));
          border-radius: 50%;
          font-size: 28px;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: 1px solid #444;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.1);
          transition: background 0.3s, box-shadow 0.3s, transform 0.2s;
        }
        .setpoint-button:hover {
          background: linear-gradient(145deg, var(--glow-color), var(--button-color-dark));
          box-shadow: 0 0 8px var(--glow-color), 0 2px 4px rgba(0, 0, 0, 0.4);
          transform: scale(1.1);
        }
        .temp-circle-container {
          position: relative;
          width: 140px;
          height: 140px;
          margin: 0 16px;
        }
        .temp-circle-container.glow .glow-bottom {
          opacity: 0.8;
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
          filter: blur(10px);
          opacity: 0.4;
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
            radial-gradient(circle at 60% 60%, var(--sphere-secondary, rgba(255,105,180, 0.2)), transparent 70%),
            radial-gradient(circle at 30% 30%, var(--sphere-primary, rgba(186,85,211, 0.3)), transparent 70%),
            radial-gradient(circle at center, #0a0a0a 40%, #000000 100%);
          box-shadow:
            inset 0 10px 15px rgba(255, 255, 255, 0.1),
            inset 0 -10px 15px rgba(0, 0, 0, 0.8);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
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
          background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.8), transparent 70%);
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
          background: radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.4), transparent 70%);
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
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        .temp-value {
          font-size: 30px;
          font-weight: 600;
        }
        .mode-in-circle {
          margin-top: 6px;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 18px;
        }
        .sensor-line {
          font-size: 14px фестивал;
          margin: 12px auto;
          text-align: center;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          background: linear-gradient(145deg, var(--slider-base-color-light), var(--slider-base-color-dark));
          border-radius: 6px;
          padding: 4px 8px;
          box-shadow:
            0 2px 4px rgba(0, 0, 0, 0.3),
            inset 0 1px 2px rgba(255, 255, 255, 0.1);
          width: fit-content;
        }
        .sensor-line ha-icon {
          font-size: 16px;
        }
        .sensor-line ha-icon[icon="mdi:home-outline"] { color: #4fc3f7; }
        .sensor-line ha-icon[icon="mdi:weather-sunny"] { color: #ffca28; }
        .sensor-line ha-icon[icon="mdi:solar-power"] { color: #fbc02d; }
        .clickable-sensor {
          cursor: pointer;
          text-decoration: underline;
          color: inherit;
        }
        .room-section {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
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
            var(--gradient-dark) 0%,
            var(--gradient-start) var(--percent),
            var(--light-gradient-end) var(--percent)
          );
          z-index: 1;
        }
        .styled-room-slider.no-thumb::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 0; height: 0;
        }
        .styled-room-slider.no-thumb::-moz-range-thumb {
          width: 0; height: 0;
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
          color: var(--text-color, white);
          z-index: 2;
        }
        .slider-info * { pointer-events: auto; }
        .slider-name { flex: 1; width: 200px; }
        .slider-status { width: 50px; text-align: right; }
        .slider-temp {
          width: 50px;
          text-align: center;
          cursor: pointer;
          text-decoration: underline;
        }

        /* ---------- view_mode CSS ---------- */
        .view-aircon .modes,
        .view-aircon .fan-modes,
        .view-aircon .temp-setpoint-wrapper,
        .view-aircon .sensor-line { display: none; }
        .view-sliders .room-section { display: none; }
      </style>

      <div class="modes"></div>
      <div class="fan-modes"></div>
      <div class="temp-setpoint-wrapper">
        <button class="setpoint-button" id="dec-setpoint" style="--button-color: var(--dec-button-color); --button-color-dark: var(--dec-button-color-dark)">−</button>
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
        <button class="setpoint-button" id="inc-setpoint" style="--button-color: var(--inc-button-color); --button-color-dark: var(--inc-button-color-dark)">+</button>
      </div>
      <div class="sensor-line"></div>
      <div class="room-section"></div>
    `;
  }

  /* -------------------------------------------------
     COLOR HELPERS – 100 % unchanged from your original
  ------------------------------------------------- */
  hexToRgb(hex) {
    let cleanHex = hex.replace(/^#/, '');
    if (cleanHex.length === 3) cleanHex = cleanHex.split('').map(c => c + c).join('');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return { r, g, b };
  }
  rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  }
  hslToRgb(h, s, l) {
    s /= 100; l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (0 <= h && h < 60) { r = c; g = x; b = 0; }
    else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
    else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
    else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
    else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
    else if (300 <= h && h < 360) { r = c; g = 0; b = x; }
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    return { r, g, b };
  }
  getComplementaryColor(hex) {
    const { r, g, b } = this.hexToRgb(hex);
    const { h, s, l } = this.rgbToHsl(r, g, b);
    const compH = (h + 180) % 360;
    const compL = Math.min(l + 10, 80);
    const { r: newR, g: newG, b: newB } = this.hslToRgb(compH, s, compL);
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  }
  rgbToHex(rgb) {
    const result = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(rgb);
    if (!result) return rgb;
    const r = parseInt(result[1]).toString(16).padStart(2, '0');
    const g = parseInt(result[2]).toString(16).padStart(2, '0');
    const b = parseInt(result[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  hexToRgba(hex, opacity) {
    const { r, g, b } = this.hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
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
    const RR = R.toString(16).padStart(2, '0');
    const GG = G.toString(16).padStart(2, '0');
    const BB = B.toString(16).padStart(2, '0');
    return "#" + RR + GG + BB;
  }

  /* -------------------------------------------------
     CONFIGURATION
  ------------------------------------------------- */
  setConfig(config) {
    if (!config.entity) throw new Error('You need to define an entity');
    this.config = config;
    this.showModeNames = config.show_mode_names !== false;
    this.viewMode = config.view_mode || "full";   // full | sliders | aircon

    /* ---- view_mode class on host ---- */
    this.shadowRoot.host.classList.remove('view-full', 'view-sliders', 'view-aircon');
    this.shadowRoot.host.classList.add(`view-${this.viewMode}`);

    /* ---- original styling vars ---- */
    const textColor = config.text_color || "white";
    this.shadowRoot.host.style.setProperty('--text-color', textColor);

    const spherePrimary = config.sphere_primary_color || 'rgba(186,85,211, 0.3)';
    const sphereSecondary = config.sphere_secondary_color || 'rgba(255,105,180, 0.2)';
    this.shadowRoot.host.style.setProperty('--sphere-primary', spherePrimary);
    this.shadowRoot.host.style.setProperty('--sphere-secondary', sphereSecondary);

    const defaultSliderColor = config.slider_color || '#1B86EF';
    this.shadowRoot.host.style.setProperty('--slider-base-color', defaultSliderColor);
    this.shadowRoot.host.style.setProperty('--slider-base-color-light', this.hexToRgba(this.shadeColor(defaultSliderColor, 20), 0.2));
    this.shadowRoot.host.style.setProperty('--slider-base-color-dark', this.hexToRgba(this.shadeColor(defaultSliderColor, -20), 0.2));
    this.shadowRoot.host.style.setProperty('--fan-base-color', this.shadeColor(defaultSliderColor, -25));
    this.shadowRoot.host.style.setProperty('--fan-base-color-light', this.hexToRgba(this.shadeColor(defaultSliderColor, -10), 0.2));
    this.shadowRoot.host.style.setProperty('--fan-base-color-dark', this.hexToRgba(this.shadeColor(defaultSliderColor, -30), 0.3));

    /* ---- mode data ---- */
    const modeData = {
      off: { icon: 'mdi:power', color: '#D69E5E', name: 'Off' },
      cool: { icon: 'mdi:snowflake', color: '#2196F3', name: 'Cool' },
      heat: { icon: 'mdi:fire', color: '#F44336', name: 'Heat' },
      fan_only: { icon: 'mdi:fan', color: '#9E9E9E', name: 'Fan' },
      dry: { icon: 'mdi:water-percent', color: '#009688', name: 'Dry' },
      auto: { icon: 'mdi:autorenew', color: '#FFC107', name: 'Auto' },
    };

    /* ---- HVAC mode buttons ---- */
    const modesContainer = this.shadowRoot.querySelector('.modes');
    let modeButtons = '';
    Object.entries(modeData).forEach(([k, v]) => {
      modeButtons += `
        <button class="mode-btn" data-mode="${k}" style="color:#ccc">
          <ha-icon icon="${v.icon}" style="color:#ccc"></ha-icon>
          ${this.showModeNames ? `<span class="mode-name">${v.name}</span>` : ''}
        </button>`;
    });
    modesContainer.innerHTML = modeButtons;

    /* ---- Fan mode buttons ---- */
    const fanModesContainer = this.shadowRoot.querySelector('.fan-modes');
    const fallbackFanModes = ['low', 'medium', 'high', 'auto'];
    const fanModes = this._hass && this._hass.states[config.entity]?.attributes.fan_modes?.length > 0
      ? this._hass.states[config.entity].attributes.fan_modes
      : fallbackFanModes;
    let fanSpeedButtons = '';
    const fanColor = this.getComplementaryColor(defaultSliderColor);
    fanModes.forEach(fm => {
      fanSpeedButtons += `
        <div class="fan-btn-container">
          <button class="fan-btn" data-fan-mode="${fm}" style="color:#ccc" data-fan-color="${fanColor}">
            <span class="fan-name">${fm.charAt(0).toUpperCase() + fm.slice(1)}</span>
          </button>
        </div>`;
    });
    fanModesContainer.innerHTML = fanSpeedButtons;

    /* ---- Room sliders ---- */
    const roomSection = this.shadowRoot.querySelector('.room-section');
    if (config.rooms && Array.isArray(config.rooms)) {
      let roomHTML = '';
      config.rooms.forEach(room => {
        const sliderColor = room.color ?? config.slider_color ?? '#1B86EF';
        const primary = this.hexToRgba(sliderColor, 0.7);
        const dark = this.hexToRgba(this.shadeColor(sliderColor, -40), 0.3);
        const light = this.hexToRgba(this.shadeColor(sliderColor, 50), 0.1);
        roomHTML += `
          <div class="room-block" data-entity="${room.slider_entity}" data-temp-entity="${room.sensor_entity || ''}">
            <input type="range" class="styled-room-slider no-thumb"
                   min="0" max="100" step="5" value="0"
                   data-entity="${room.slider_entity}" data-temp-entity="${room.sensor_entity || ''}"
                   style="--gradient-dark:${dark}; --gradient-start:${primary}; --light-gradient-end:${light}; --percent:0%;">
            <div class="slider-info">
              <span class="slider-name">${room.name}</span>
              <span class="slider-temp" data-entity="${room.sensor_entity || ''}">--°C</span>
              <span class="slider-status">0%</span>
            </div>
          </div>`;
      });
      roomSection.innerHTML = roomHTML;
    } else {
      roomSection.innerHTML = '';
    }

    /* ---- Attach all listeners ---- */
    this._attachListeners();
  }

  /* -------------------------------------------------
     LISTENERS (mode, fan, sliders, setpoint)
  ------------------------------------------------- */
  _attachListeners() {
    const cfg = this.config;

    /* ---- Mode & Fan buttons (clone to remove old listeners) ---- */
    this.shadowRoot.querySelectorAll('.mode-btn, .fan-btn').forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', () => {
        const isMode = newBtn.classList.contains('mode-btn');
        const key = isMode ? 'data-mode' : 'data-fan-mode';
        const value = newBtn.getAttribute(key);
        if (!this._hass) return;
        if (isMode && value === 'off') {
          this._hass.callService('climate', 'turn_off', { entity_id: cfg.entity });
        } else if (isMode) {
          this._hass.callService('climate', 'set_hvac_mode', { entity_id: cfg.entity, hvac_mode: value });
        } else {
          this._hass.callService('climate', 'set_fan_mode', { entity_id: cfg.entity, fan_mode: value });
        }
      });
    });

    /* ---- Room sliders + clickable temperature ---- */
    this.shadowRoot.querySelectorAll('.room-block').forEach(block => {
      const slider = block.querySelector('.styled-room-slider');
      const tempEl = block.querySelector('.slider-temp');
      const entityId = slider.dataset.entity;
      const tempEntityId = slider.dataset.tempEntity;

      this._sliderDragging[entityId] = false;

      const newSlider = slider.cloneNode(true);
      slider.parentNode.replaceChild(newSlider, slider);

      newSlider.addEventListener('pointerdown', () => { this._sliderDragging[entityId] = true; });
      newSlider.addEventListener('pointerup', () => { this._sliderDragging[entityId] = false; });
      newSlider.addEventListener('pointercancel', () => { this._sliderDragging[entityId] = false; });

      newSlider.addEventListener('input', e => {
        const val = Number(e.target.value);
        this._localSliderValues[entityId] = val;
        e.target.style.setProperty('--percent', `${val}%`);
        block.querySelector('.slider-status').textContent = `${val}%`;
      });

      newSlider.addEventListener('change', e => {
        const val = Number(e.target.value);
        this._localSliderValues[entityId] = undefined;
        if (this._hass) {
          this._hass.callService('cover', 'set_cover_position', { entity_id: entityId, position: val });
        }
      });

      /* ---- Clickable temperature sensor ---- */
      if (tempEl && tempEntityId) {
        tempEl.style.cursor = 'pointer';
        tempEl.addEventListener('click', ev => {
          ev.stopPropagation();
          const moreInfo = new Event('hass-more-info', { bubbles: true, composed: true });
          moreInfo.detail = { entityId: tempEntityId };
          tempEl.dispatchEvent(moreInfo);
        });
      }
    });

    /* ---- Setpoint buttons (once) ---- */
    if (!this._setpointListenersAdded) {
      const decBtn = this.shadowRoot.querySelector('#dec-setpoint');
      const incBtn = this.shadowRoot.querySelector('#inc-setpoint');
      decBtn?.addEventListener('click', () => this._adjustTemp(-1));
      incBtn?.addEventListener('click', () => this._adjustTemp(1));
      this._setpointListenersAdded = true;
    }
  }

  _adjustTemp(delta) {
    if (!this._hass || !this.config) return;
    const climate = this._hass.states[this.config.entity];
    const minTemp = climate.attributes.min_temp ?? 16;
    const maxTemp = climate.attributes.max_temp ?? 30;
    const current = this._localTemp ?? (climate.attributes.temperature ?? minTemp);
    let newTemp = current + delta;
    newTemp = Math.max(minTemp, Math.min(maxTemp, newTemp));
    this._localTemp = newTemp;
    this._hass.callService('climate', 'set_temperature', {
      entity_id: this.config.entity,
      temperature: newTemp
    });
  }

  /* -------------------------------------------------
     HASS UPDATE (your original logic – unchanged)
  ------------------------------------------------- */
  set hass(hass) {
    this._hass = hass;
    const cfg = this.config;
    if (!cfg || !hass.states[cfg.entity]) {
      this.shadowRoot.innerHTML = `<hui-warning>${cfg?.entity || 'Entity'} not available</hui-warning>`;
      return;
    }

    /* ---- Re-run setConfig if the yaml config changed ---- */
    const cfgStr = JSON.stringify(cfg);
    if (this._lastConfig !== cfgStr) {
      this._lastConfig = cfgStr;
      this.setConfig(cfg);
    }

    const climate = hass.states[cfg.entity];
    const minTemp = climate.attributes.min_temp ?? 16;
    const maxTemp = climate.attributes.max_temp ?? 30;
    const currentTemp = climate.attributes.temperature ?? climate.attributes.current_temperature ?? minTemp;

    if (this._localTemp !== null && Math.abs(this._localTemp - currentTemp) < 0.1) {
      this._localTemp = null;
    }
    const displayTemp = this._localTemp !== null ? this._localTemp : currentTemp;

    const currentMode = climate.attributes.hvac_mode ?? climate.state;
    const powerOn = climate.state !== 'off';
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

    const isHeatMode = currentMode === 'heat';
    const decColor = isHeatMode ? '#F44336' : '#2196F3';
    const incColor = isHeatMode ? '#2196F3' : '#F44336';
    if (this._lastStates.decColor !== decColor || this._lastStates.incColor !== incColor) {
      this.shadowRoot.querySelector('#dec-setpoint').style.setProperty('--button-color', decColor);
      this.shadowRoot.querySelector('#dec-setpoint').style.setProperty('--button-color-dark', this.shadeColor(decColor, -20));
      this.shadowRoot.querySelector('#inc-setpoint').style.setProperty('--button-color', incColor);
      this.shadowRoot.querySelector('#inc-setpoint').style.setProperty('--button-color-dark', this.shadeColor(incColor, -20));
      this._lastStates.decColor = decColor;
      this._lastStates.incColor = incColor;
    }

    const getState = id => {
      const s = hass.states[id];
      if (!s || s.state === 'unknown' || s.state === 'unavailable') return null;
      return s.state;
    };

    /* ---- sensor line ---- */
    const sensorSolar = cfg.solar_sensor ? getState(cfg.solar_sensor) : null;
    const sensorHouseTemp = cfg.house_temp_sensor ? getState(cfg.house_temp_sensor) : null;
    const sensorHouseHum = cfg.house_humidity_sensor ? getState(cfg.house_humidity_sensor) : null;
    const sensorOutsideTemp = cfg.outside_temp_sensor ? getState(cfg.outside_temp_sensor) : null;
    const sensorOutsideHum = cfg.outside_humidity_sensor ? getState(cfg.outside_humidity_sensor) : null;

    const sensorKey = `${sensorSolar}|${sensorHouseTemp}|${sensorHouseHum}|${sensorOutsideTemp}|${sensorOutsideHum}`;
    if (this._lastStates.sensorKey !== sensorKey) {
      const line = this.shadowRoot.querySelector('.sensor-line');
      const parts = [];

      if (sensorHouseTemp !== null || sensorHouseHum !== null) {
        const t = sensorHouseTemp !== null ? `<span class="clickable-sensor" data-entity="${cfg.house_temp_sensor}">${sensorHouseTemp}°C</span>` : '';
        const h = sensorHouseHum !== null ? `<span class="clickable-sensor" data-entity="${cfg.house_humidity_sensor}">${sensorHouseHum}%</span>` : '';
        parts.push(`<ha-icon icon="mdi:home-outline"></ha-icon> ${t}${t && h ? ' / ' : ''}${h}`);
      }
      if (sensorOutsideTemp !== null || sensorOutsideHum !== null) {
        const t = sensorOutsideTemp !== null ? `<span class="clickable-sensor" data-entity="${cfg.outside_temp_sensor}">${sensorOutsideTemp}°C</span>` : '';
        const h = sensorOutsideHum !== null ? `<span class="clickable-sensor" data-entity="${cfg.outside_humidity_sensor}">${sensorOutsideHum}%</span>` : '';
        parts.push(`<ha-icon icon="mdi:weather-sunny"></ha-icon> ${t}${t && h ? ' / ' : ''}${h}`);
      }
      if (sensorSolar !== null) {
        parts.push(`<ha-icon icon="mdi:solar-power"></ha-icon> <span class="clickable-sensor" data-entity="${cfg.solar_sensor}">${sensorSolar}</span>`);
      }

      line.innerHTML = parts.length ? parts.join(' | ') : '';
      line.querySelectorAll('.clickable-sensor').forEach(el => {
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => {
          const ev = new Event('hass-more-info', { bubbles: true, composed: true });
          ev.detail = { entityId: el.dataset.entity };
          el.dispatchEvent(ev);
        });
      });
      this._lastStates.sensorKey = sensorKey;
    }

    /* ---- mode buttons ---- */
    if (this._lastStates.currentMode !== currentMode) {
      this.shadowRoot.querySelectorAll('.mode-btn').forEach(btn => {
        const modeKey = btn.dataset.mode;
        const sel = currentMode === modeKey;
        const col = sel ? modeData[modeKey].color : '#ccc';
        btn.classList.toggle('mode-selected', sel);
        btn.style.color = col;
        btn.querySelector('ha-icon').style.color = col;
      });
      this._lastStates.currentMode = currentMode;
    }

    /* ---- fan buttons ---- */
    if (this._lastStates.currentFanMode !== currentFanMode) {
      const defaultSliderColor = cfg.slider_color || '#1B86EF';
      const buttonColor = defaultSliderColor;
      this.shadowRoot.querySelectorAll('.fan-btn').forEach(btn => {
        const fm = btn.dataset.fanMode;
        const sel = currentFanMode && currentFanMode.toLowerCase() === fm.toLowerCase();
        btn.classList.toggle('fan-selected', sel);
        const container = btn.closest('.fan-btn-container');
        if (container) {
          container.style.background = sel
            ? buttonColor
            : 'linear-gradient(145deg, var(--fan-base-color-light), var(--fan-base-color-dark))';
          container.style.boxShadow = sel
            ? 'inset 0 3px 6px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(255, 255, 255, 0.2)'
            : '0 2px 4px rgba(0, 0, 0, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.1)';
        }
      });
      this._lastStates.currentFanMode = currentFanMode;
    }

    /* ---- temperature display ---- */
    const tempKey = `${displayTemp}`;
    if (this._lastStates.tempValueKey !== tempKey) {
      const el = this.shadowRoot.querySelector('.temp-value');
      if (el) el.textContent = `${displayTemp.toFixed(1)}°C`;
      this._lastStates.tempValueKey = tempKey;
    }

    /* ---- glow when on ---- */
    const powerKey = `${powerOn}`;
    if (this._lastStates.powerKey !== powerKey) {
      this.shadowRoot.querySelector('.temp-circle-container').classList.toggle('glow', powerOn);
      this._lastStates.powerKey = powerKey;
    }

    /* ---- mode icon/label in circle ---- */
    const modeKey = `${currentMode}`;
    if (this._lastStates.modeKey !== modeKey) {
      const circle = this.shadowRoot.querySelector('.mode-in-circle');
      const mode = modeData[currentMode] || {};
      const icon = circle.querySelector('ha-icon');
      const label = circle.querySelector('span');
      if (icon) { icon.setAttribute('icon', mode.icon || ''); icon.style.color = mode.color || ''; }
      if (label) { label.textContent = mode.name || ''; label.style.color = mode.color || ''; }
      this._lastStates.modeKey = modeKey;
    }

    /* ---- room sliders (state + sensor) ---- */
    if (cfg.rooms && Array.isArray(cfg.rooms)) {
      this.shadowRoot.querySelectorAll('.room-block').forEach(block => {
        const entityId = block.dataset.entity;
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
        sliderVal = Math.round(sliderVal / 5) * 5;
        sliderVal = Math.max(0, Math.min(100, sliderVal));

        const sensorVal = sensorEnt && !isNaN(Number(sensorEnt.state)) ? Number(sensorEnt.state) : null;
        const key = `${sliderVal}|${sensorVal}`;

        if (this._lastStates[entityId] !== key && !this._sliderDragging[entityId]) {
          const local = this._localSliderValues[entityId];
          const disp = local !== undefined ? local : sliderVal;
          slider.value = disp;
          slider.style.setProperty('--percent', `${disp}%`);
          block.querySelector('.slider-status').textContent = `${disp}%`;
          const tempEl = block.querySelector('.slider-temp');
          if (tempEl) tempEl.textContent = sensorVal !== null ? `${sensorVal.toFixed(1)}°C` : '';
          this._lastStates[entityId] = key;
        }
      });
    }
  }

  getCardSize() { return 6; }
}
customElements.define('aircon-control-card', AirconControlCard);
