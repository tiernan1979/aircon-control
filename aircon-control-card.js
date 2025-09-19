class AirconControlCard extends HTMLElement {
  constructor() {
    super();
    this._localTemp = null;
    this._localSliderValues = {};
    this._sliderTimers = {}; // 🔁 store debounce timers
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

    if (this._localTemp !== null && Math.abs(this._localTemp - currentTemp) < 0.1) {
      this._localTemp = null;
    }
    const displayTemp = this._localTemp !== null ? this._localTemp : currentTemp;

    const currentMode = climate.attributes.hvac_mode ?? climate.state;
    const powerOn = climate.state !== 'off';

    const modeData = {
      off:      { icon: 'mdi:power',         color: '#D69E5E', name: 'Off' },
      cool:     { icon: 'mdi:snowflake',     color: '#2196F3', name: 'Cool' },
      heat:     { icon: 'mdi:fire',          color: '#F44336', name: 'Heat' },
      fan_only: { icon: 'mdi:fan',           color: '#9E9E9E', name: 'Fan' },
      dry:      { icon: 'mdi:water-percent', color: '#009688', name: 'Dry' },
      auto:     { icon: 'mdi:autorenew',     color: '#FFC107', name: 'Auto' },
    };

    const glowColor = modeData[currentMode]?.color ?? '#b37fed';

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

        const entityId = room.slider_entity;
        const localVal = this._localSliderValues[entityId] ?? sliderVal;

        // 👇 Determine slider color: per-room → global → default (lightblue)
        const sliderColor = room.color || cfg.room_slider_color || 'lightblue';

        roomControls += `
          <div class="room-block">
            <input
              type="range"
              class="styled-room-slider no-thumb"
              min="0" max="100" step="1"
              value="${localVal}"
              data-entity="${entityId}"
              style="--percent:${localVal}%; --fill-color:${sliderColor};"
            />
            <div class="slider-info">
              <span class="slider-name">${room.name}</span>
              <span class="slider-status">${localVal}%</span>
              <span class="slider-temp">${ sensorVal !== null ? sensorVal.toFixed(1) + '°C' : 'N/A' }</span>
            </div>
          </div>`;
      });
      roomControls += '</div>';
    }

    this.innerHTML = `
      <style>
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
          height: 28px;
          -webkit-appearance: none;
          appearance: none;
          border-radius: 12px;
          outline: none;
          margin: 0;
          margin-bottom: -5px;
          background: linear-gradient(
            to right,
            var(--fill-color, lightblue) 0%,
            var(--fill-color, lightblue) var(--percent),
            #333 var(--percent),
            #333 100%
          );
        }
        .styled-room-slider.no-thumb::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 0;
          height: 0;
        }
        .styled-room-slider.no-thumb::-moz-range-thumb {
          width: 0;
          height: 0;
        }
        .slider-info {
          position: absolute;
          top: 3px;
          left: 12px;
          right: 12px;
          height: 22px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 15px;
          color: white;
        }
        .slider-name {
          flex: 1;
        }
        .slider-status {
          width: 50px;
          text-align: right;
        }
        .slider-temp {
          width: 50px;
          text-align: center;
        }
      </style>

      ${roomControls}
    `;

    // 🔄 Room slider logic with debounce
    this.querySelectorAll('.styled-room-slider.no-thumb').forEach(slider => {
      const entityId = slider.getAttribute('data-entity');
      slider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        e.target.style.setProperty('--percent', `${val}%`);
        this._localSliderValues[entityId] = val;

        // 💥 Debounce call to avoid flickering
        if (this._sliderTimers[entityId]) {
          clearTimeout(this._sliderTimers[entityId]);
        }
        this._sliderTimers[entityId] = setTimeout(() => {
          hass.callService('cover', 'set_cover_position', {
            entity_id: entityId,
            position: val
          });
        }, 500); // 500ms delay
      });
    });
  }

  getCardSize() {
    return 3;
  }
}

customElements.define('aircon-control-card', AirconControlCard);
