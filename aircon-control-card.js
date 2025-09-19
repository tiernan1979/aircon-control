class AirconControlCard extends HTMLElement {
  constructor() {
    super();
    this._localTemp = null;
    this._localSliderValues = {}; // ← NEW: stores temporary slider states
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('You need to define an entity');
    }
    this.config = config;
    this.showModeNames = config.show_mode_names !== false;
  }

  set hass(hass) {
    this._hass = hass;
    const cfg = this.config;
    const climate = hass.states[cfg.entity];
    if (!climate) {
      this.innerHTML = `<hui-warning>${cfg.entity} not available</hui-warning>`;
      return;
    }

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
      off:      { icon: 'mdi:power',         color: '#D69E5E', name: 'Off' },
      cool:     { icon: 'mdi:snowflake',     color: '#2196F3', name: 'Cool' },
      heat:     { icon: 'mdi:fire',          color: '#F44336', name: 'Heat' },
      fan_only: { icon: 'mdi:fan',           color: '#9E9E9E', name: 'Fan' },
      dry:      { icon: 'mdi:water-percent', color: '#009688', name: 'Dry' },
      auto:     { icon: 'mdi:autorenew',     color: '#FFC107', name: 'Auto' },
    };

    const glowColor = modeData[currentMode]?.color ?? '#b37fed';

    const getState = id => {
      const s = hass.states[id];
      if (!s || s.state === 'unknown' || s.state === 'unavailable') {
        return null;
      }
      return s.state;
    };

    const sensorSolar = cfg.solar_sensor ? getState(cfg.solar_sensor) : null;
    const sensorHouseTemp = cfg.house_temp_sensor ? getState(cfg.house_temp_sensor) : null;
    const sensorHouseHum = cfg.house_humidity_sensor ? getState(cfg.house_humidity_sensor) : null;
    const sensorOutsideTemp = cfg.outside_temp_sensor ? getState(cfg.outside_temp_sensor) : null;
    const sensorOutsideHum = cfg.outside_humidity_sensor ? getState(cfg.outside_humidity_sensor) : null;

    let sensorLine = '';
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
      sensorLine = `<div class="sensor-line">${parts.join(' | ')}</div>`;
    }

    let modeButtons = '<div class="modes">';
    Object.entries(modeData).forEach(([modeKey, md]) => {
      const isSel = currentMode === modeKey;
      const color = isSel ? md.color : '#ccc';
      modeButtons += `
        <button class="mode-btn ${isSel ? 'mode-selected' : ''}" data-mode="${modeKey}" style="color:${color}">
          <ha-icon icon="${md.icon}" style="color:${color}"></ha-icon>
          ${ this.showModeNames ? `<span class="mode-name">${md.name}</span>` : '' }
        </button>`;
    });
    modeButtons += '</div>';

    let fanSpeedButtons = '<div class="fan-modes">';
    fanModes.forEach(fm => {
      const sel = (currentFanMode && currentFanMode.toLowerCase() === fm.toLowerCase()) ? 'fan-selected' : '';
      fanSpeedButtons += `
        <button class="fan-btn ${sel}" data-fan-mode="${fm}" style="${ sel ? `color:${glowColor}` : 'color:#ccc' }">
          <span class="fan-name">${fm.charAt(0).toUpperCase() + fm.slice(1)}</span>
        </button>`;
    });
    fanSpeedButtons += '</div>';

    let roomControls = '';
    if (cfg.rooms && Array.isArray(cfg.rooms)) {
      roomControls += '<div class="room-section">';
      cfg.rooms.forEach(room => {
        const sliderEnt = hass.states[room.slider_entity];
        const sensorEnt = hass.states[room.sensor_entity];
        let sliderVal = 0;
        if (sliderEnt) {
          if (sliderEnt.attributes.current_position != null) {
            sliderVal = parseInt(sliderEnt.attributes.current_position) || 0;
          } else if (!isNaN(Number(sliderEnt.state))) {
            sliderVal = Number(sliderEnt.state);
          }
        }
        sliderVal = Math.max(0, Math.min(100, sliderVal));
        const sensorVal = (sensorEnt && !isNaN(Number(sensorEnt.state))) ? Number(sensorEnt.state) : null;
        
        // 🔄 NEW: Get local color override or fallback
        const sliderColor = room.color ?? this.config.slider_color ?? '#1B86EF';
        const gradientStart = shadeColor(sliderColor, -40); // you'll need a utility like this
        
        // 🎨 Generate a dynamic gradient using sliderColor
        const sliderGradient = `linear-gradient(to right, ${shadeColor(sliderColor, -30)}, ${sliderColor}, ${shadeColor(sliderColor, 20)})`;
        
        roomControls += `
          <div class="room-block">
            <input
              type="range"
              class="styled-room-slider no-thumb"
              min="0" max="100" step="1"
              value="${this._localSliderValues[room.slider_entity] ?? sliderVal}"
              data-entity="${room.slider_entity}"
              style="--percent:${sliderVal}%; --gradient-start:${gradientStart}; --gradient-end:${sliderColor};"
            />
            <div class="slider-info">
              <span class="slider-name">${room.name}</span>
              ${
                sensorVal !== null
                  ? `<span class="slider-temp">${sensorVal.toFixed(1)}°C</span>`
                  : `<span class="slider-temp"></span>`
              }
              <span class="slider-status">${sliderVal}%</span>
            </div>
          </div>`;
      });
      roomControls += '</div>';
    }
    // If any slider is focused (being dragged), skip re-rendering innerHTML:
    const sliders = this.querySelectorAll('.styled-room-slider.no-thumb');
    let anySliderFocused = false;
    sliders.forEach(slider => {
      if (document.activeElement === slider) anySliderFocused = true;
    });
    
    if (!anySliderFocused) {
    

      this.innerHTML = `
        <style>
          :host {
            font-family: 'Roboto', sans-serif;
            background: var(--card-background-color, #000); /* fallback to black */
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
            font-size: 14px; /* increased by +2 */
          }
  
          .mode-btn.mode-selected, .fan-btn.fan-selected {
            color: ${glowColor};
          }
  
          .mode-btn ha-icon, .fan-btn ha-icon {
            font-size: 26px; /* +2 */
          }
  
          .mode-name, .fan-name {
            font-size: 14px; /* +2 */
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
            background: ${glowColor};
          }
          
          .temp-circle-container {
            position: relative;
            width: 140px;
            height: 140px;
            margin: 0 16px; /* keep spacing for buttons */
          }
          
  
          .temp-circle-container.glow .glow-bottom {
            opacity: 0.6; /* brighter when ON */
            animation: glowPulse 12s infinite ease-in-out;
          }
          
          .glow-bottom {
            position: absolute;
            bottom: -12px;
            left: 50%;
            transform: translateX(-50%);
            width: 140px;
            height: 70px;
            background: ${glowColor};
            border-radius: 0 0 70px 70px / 0 0 70px 70px;
            filter: blur(14px); /* reduce blur for visibility */
            opacity: 0.2; /* increase base glow */
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
              radial-gradient(circle at 60% 60%, rgba(255,105,180, 0.2), transparent 70%),   /* pink highlight */
              radial-gradient(circle at 30% 30%, rgba(186,85,211, 0.3), transparent 70%),    /* purple swirl */
              radial-gradient(circle at center, #0a0a0a 40%, #000000 100%);                  /* black base */
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
              opacity: 0.2; /* subtle glow baseline */
            }
            50% {
              opacity: 0.6; /* soft max glow */
            }
          }
  
          .temp-value {
            font-size: 30px; /* +2 */
            font-weight: 600;
            color: white;
          }
  
          .mode-in-circle {
            margin-top: 6px;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 18px; /* +2 */
            color: ${glowColor};
          }
  
          .sensor-line {
            font-size: 14px; /* +2 */
            color: #777;
            margin-top: 12px;
            text-align: center;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
          }
  
          .sensor-line ha-icon {
            font-size: 16px; /* +2 */
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
            font-size: 15px; /* +2 */
            color: white;
          }
  
          .sensor-line ha-icon[icon="mdi:home-outline"] {
            color: #4fc3f7; /* light blue */
          }
          .sensor-line ha-icon[icon="mdi:weather-sunny"] {
            color: #ffca28; /* sunny yellow */
          }
          .sensor-line ha-icon[icon="mdi:solar-power"] {
            color: #fbc02d; /* golden */
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
            text-align: center; /* center horizontally */
            display: flex;
            justify-content: center; /* horizontal centering with flex */
            align-items: center;     /* vertical centering */
            
          }
        </style>
  
        ${modeButtons}
        ${fanSpeedButtons}
  
        <div class="temp-setpoint-wrapper">
          <button class="setpoint-button" id="dec-setpoint">−</button>
          <div class="temp-circle-container ${powerOn ? 'glow' : ''}">
            <div class="glow-bottom"></div>
            <div class="temp-circle">
              <div class="reflection"></div>          
              <div class="temp-value">${displayTemp.toFixed(1)}°C</div>
              <div class="mode-in-circle">
                <ha-icon icon="${modeData[currentMode]?.icon}"></ha-icon>
                <span>${modeData[currentMode]?.name}</span>
              </div>
            </div>
          </div>
  
          <button class="setpoint-button" id="inc-setpoint">+</button>
        </div>
  
        ${sensorLine}
  
        ${roomControls}
      `;
    }
    // Event listeners (unchanged)
    this.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        if (mode === 'off') {
          hass.callService('climate', 'turn_off', { entity_id: cfg.entity });
        } else {
          hass.callService('climate', 'set_hvac_mode', {
            entity_id: cfg.entity,
            hvac_mode: mode
          });
        }
      });
    });

    this.querySelectorAll('.fan-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const fm = btn.getAttribute('data-fan-mode');
        hass.callService('climate', 'set_fan_mode', {
          entity_id: cfg.entity,
          fan_mode: fm
        });
      });
    });

    this.querySelector('#dec-setpoint').addEventListener('click', () => {
      let nt = this._localTemp ?? displayTemp;
      nt = nt - 1;
      if (nt < minTemp) nt = minTemp;
      this._localTemp = nt;
      hass.callService('climate', 'set_temperature', {
        entity_id: cfg.entity,
        temperature: nt
      });
    });

    this.querySelector('#inc-setpoint').addEventListener('click', () => {
      let nt = this._localTemp ?? displayTemp;
      nt = nt + 1;
      if (nt > maxTemp) nt = maxTemp;
      this._localTemp = nt;
      hass.callService('climate', 'set_temperature', {
        entity_id: cfg.entity,
        temperature: nt
      });
    });
    
    this.querySelectorAll('.styled-room-slider.no-thumb').forEach(slider => {
      const entityId = slider.getAttribute('data-entity');
      const sliderEnt = hass.states[entityId];
    
      let sliderVal = 0;
      if (sliderEnt) {
        if (sliderEnt.attributes.current_position != null) {
          sliderVal = parseInt(sliderEnt.attributes.current_position) || 0;
        } else if (!isNaN(Number(sliderEnt.state))) {
          sliderVal = Number(sliderEnt.state);
        }
      }
      sliderVal = Math.max(0, Math.min(100, sliderVal));
    
      // Only update slider UI if not being actively dragged
      if (document.activeElement !== slider) {
        slider.value = sliderVal;
        slider.style.setProperty('--percent', `${sliderVal}%`);
    
        // ✅ Update the slider-status text properly
        const sliderStatus = slider.parentElement.querySelector('.slider-status');
        if (sliderStatus) {
          sliderStatus.textContent = `${sliderVal}%`;
        }
      }
    
      // ✅ Live update during sliding (input)
      slider.addEventListener('input', e => {
        const val = Number(e.target.value);
        const entityId = e.target.getAttribute('data-entity');
        this._localSliderValues[entityId] = val;
    
        // Update visual track style
        e.target.style.setProperty('--percent', `${val}%`);
    
        // ✅ Update slider-status text live
        const sliderStatus = e.target.parentElement.querySelector('.slider-status');
        if (sliderStatus) {
          sliderStatus.textContent = `${val}%`;
        }
      });
    
      // ✅ On release, commit value to HA and clear local override
      slider.addEventListener('change', e => {
        const val = Number(e.target.value);
        const entityId = e.target.getAttribute('data-entity');
        this._localSliderValues[entityId] = val;
    
        hass.callService('cover', 'set_cover_position', {
          entity_id: entityId,
          position: val,
        });
    
        // Optional: Clear local override after sending (recommended)
        delete this._localSliderValues[entityId];
      });
    });


    });

  }

  getCardSize() {
    return 6;
  }
}
function shadeColor(color, percent) {
  let R = parseInt(color.substring(1,3),16);
  let G = parseInt(color.substring(3,5),16);
  let B = parseInt(color.substring(5,7),16);

  R = parseInt(R * (100 + percent) / 100);
  G = parseInt(G * (100 + percent) / 100);
  B = parseInt(B * (100 + percent) / 100);

  R = (R<255)?R:255;  
  G = (G<255)?G:255;  
  B = (B<255)?B:255;  

  const RR = (R.toString(16).length==1)?"0"+R.toString(16):R.toString(16);
  const GG = (G.toString(16).length==1)?"0"+G.toString(16):G.toString(16);
  const BB = (B.toString(16).length==1)?"0"+B.toString(16):B.toString(16);

  return "#"+RR+GG+BB;
}


customElements.define('aircon-control-card', AirconControlCard);
