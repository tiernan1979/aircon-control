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
              data-entity="${
