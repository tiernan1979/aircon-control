class AirconControlCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._config = null;
  }

  static get observedAttributes() {
    return ['hass'];
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  getCardSize() {
    return 6 + (this._config?.rooms?.length || 0) * 2;
  }

  setConfig(config) {
    if (!config.climate_entity) {
      throw new Error('You need to define climate_entity');
    }
    this._config = config;
  }

  render() {
    if (!this._hass || !this._config) {
      this.shadowRoot.innerHTML = `<ha-card>Loading...</ha-card>`;
      return;
    }

    const climate = this._hass.states[this._config.climate_entity];
    if (!climate) {
      this.shadowRoot.innerHTML = `<ha-card>Climate entity not found</ha-card>`;
      return;
    }

    // climate attributes
    const hvacMode = climate.state;
    const attrs = climate.attributes;
    const currentTemp = attrs.current_temperature || '–';
    const setTemp = attrs.temperature || attrs.target_temp_step || '–';
    const hvacModes = attrs.hvac_modes || ['off', 'heat', 'cool', 'auto', 'fan_only'];

    // sensors from config
    const solar = this._hass.states[this._config.solar_sensor]?.state || '–';
    const outsideTemp = this._hass.states[this._config.outside_temp_sensor]?.state || '–';
    const outsideHumidity = this._hass.states[this._config.outside_humidity_sensor]?.state || '–';
    const houseTemp = this._hass.states[this._config.house_temp_sensor]?.state || '–';
    const houseHumidity = this._hass.states[this._config.house_humidity_sensor]?.state || '–';

    // styles for slider like slider-button-card
    const sliderStyle = `
      .slider-container {
        display: flex;
        align-items: center;
        margin: 10px 0;
        font-family: 'Roboto', sans-serif;
      }
      label {
        width: 110px;
        font-weight: 600;
        font-size: 1.1em;
        user-select: none;
      }
      input[type=range] {
        -webkit-appearance: none;
        width: 200px;
        height: 14px;
        border-radius: 10px;
        background: linear-gradient(90deg, var(--slider-color-on, #42a5f5) 0%, var(--slider-color-on, #42a5f5) var(--pos), var(--slider-color-off, #ddd) var(--pos), var(--slider-color-off, #ddd) 100%);
        outline: none;
        margin: 0 10px;
        cursor: pointer;
        transition: background 0.3s ease;
      }
      input[type=range]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 26px;
        height: 26px;
        background: var(--slider-thumb-color, #fff);
        border: 2px solid var(--slider-color-on, #42a5f5);
        border-radius: 50%;
        cursor: pointer;
        margin-top: -6px;
        box-shadow: 0 0 4px rgba(66,165,245,0.7);
        transition: background 0.3s ease, border-color 0.3s ease;
      }
      input[type=range]::-moz-range-thumb {
        width: 26px;
        height: 26px;
        background: var(--slider-thumb-color, #fff);
        border: 2px solid var(--slider-color-on, #42a5f5);
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 0 4px rgba(66,165,245,0.7);
        transition: background 0.3s ease, border-color 0.3s ease;
      }
      .toggle-btn {
        cursor: pointer;
        border: none;
        background: none;
        color: var(--toggle-color, #42a5f5);
        font-size: 26px;
        user-select: none;
        width: 32px;
        height: 32px;
        padding: 0;
        margin-left: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.3s ease;
      }
      .toggle-btn.off {
        color: #aaa;
      }
      .room-temp {
        font-size: 0.9em;
        color: var(--secondary-text-color, #666);
        margin-left: 120px;
        user-select: none;
      }
      .modes {
        display: flex;
        gap: 10px;
        margin-bottom: 12px;
        user-select: none;
      }
      .mode-btn {
        padding: 6px 14px;
        background: var(--mode-btn-bg, #eee);
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        border: none;
        color: #333;
        transition: background 0.3s ease;
      }
      .mode-btn.active {
        background: var(--mode-btn-active-bg, #42a5f5);
        color: white;
        box-shadow: 0 2px 8px rgb(66 165 245 / 0.4);
      }
      .temp-controls {
        display: flex;
        align-items: center;
        font-size: 1.5em;
        margin-bottom: 12px;
      }
      .temp-controls button {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: none;
        background: var(--mode-btn-bg, #eee);
        font-size: 1.3em;
        cursor: pointer;
        color: #333;
        margin: 0 8px;
        transition: background 0.3s ease;
      }
      .temp-controls button:hover {
        background: var(--mode-btn-active-bg, #42a5f5);
        color: white;
      }
      .temp-display {
        min-width: 48px;
        text-align: center;
        font-weight: 700;
      }
      .sensor-row {
        display: flex;
        gap: 20px;
        font-size: 0.9em;
        color: var(--secondary-text-color, #666);
        margin-bottom: 16px;
        user-select: none;
      }
      .sensor-item {
        background: var(--mode-btn-bg, #eee);
        border-radius: 6px;
        padding: 6px 12px;
        white-space: nowrap;
      }
      ha-card {
        padding: 16px;
        font-family: 'Roboto', sans-serif;
      }
    `;

    // Build mode buttons HTML
    const modesHtml = hvacModes
      .map(
        (mode) => `<button
          class="mode-btn ${mode === hvacMode ? 'active' : ''}"
          data-mode="${mode}"
          >${mode.charAt(0).toUpperCase() + mode.slice(1)}</button>`
      )
      .join('');

    // Build sensors display
    const sensorsHtml = `
      <div class="sensor-row">
        <div class="sensor
