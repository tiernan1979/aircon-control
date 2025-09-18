class AirconControlCard extends HTMLElement {
  setConfig(config) {
    if (!config.entity) {
      throw new Error('You need to define an entity');
    }
    this.config = config;
  }

  set hass(hass) {
    this._hass = hass;
    const entityId = this.config.entity;
    const climate = hass.states[entityId];

    if (!climate) {
      this.innerHTML = `<hui-warning>${entityId} not available</hui-warning>`;
      return;
    }

    // Define supported modes and current mode
    const modes = ['cool', 'heat', 'fan_only', 'dry', 'auto'];
    const currentMode = climate.attributes.hvac_mode || climate.attributes.operation_mode || climate.state;

    // Build mode buttons html
    let modeButtons = '<div class="modes" style="text-align:center; margin:15px 0;">';
    modes.forEach(mode => {
      const selected = currentMode === mode ? 'font-weight:bold; text-decoration: underline;' : '';
      modeButtons += `<button class="mode-btn" data-mode="${mode}" style="margin: 0 5px; cursor:pointer; ${selected}">${mode}</button>`;
    });
    modeButtons += '</div>';

    this.innerHTML = `
      <style>
        .power {
          text-align: center;
          margin-bottom: 15px;
        }
        button {
          font-size: 24px;
          margin: 0 10px;
          cursor: pointer;
        }
        .temp {
          font-size: 48px;
          font-weight: bold;
          text-align: center;
        }
        .controls {
          display: flex;
          justify-content: center;
          margin-top: 10px;
        }
        .modes button {
          border-radius: 6px;
          padding: 5px 10px;
          background-color: #34495e;
          color: white;
          border: none;
        }
        .modes button:hover {
          background-color: #2ecc71;
        }
      </style>

      <div class="power">
        <button id="power">${climate.state === 'off' ? 'Turn On' : 'Turn Off'}</button>
      </div>

      <div class="temp">${climate.attributes.temperature || '--'}°C</div>

      ${modeButtons}

      <div class="controls">
        <button id="dec">-</button>
        <button id="inc">+</button>
      </div>
    `;

    // Add event listeners
    this.querySelector('#power').addEventListener('click', () => {
      const service = climate.state === 'off' ? 'turn_on' : 'turn_off';
      this._hass.callService('climate', service, { entity_id: this.config.entity });
    });

    this.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const mode = e.target.getAttribute('data-mode');
        this._hass.callService('climate', 'set_hvac_mode', {
          entity_id: this.config.entity,
          hvac_mode: mode,
        });
      });
    });

    this.querySelector('#inc').addEventListener('click', () => this._changeTemp(1));
    this.querySelector('#dec').addEventListener('click', () => this._changeTemp(-1));
  }

  _changeTemp(delta) {
    const climate = this._hass.states[this.config.entity];
    const currentTemp = climate.attributes.temperature || climate.attributes.current_temperature;

    if (currentTemp == null) return;

    const newTemp = currentTemp + delta;

    this._hass.callService('climate', 'set_temperature', {
      entity_id: this.config.entity,
      temperature: newTemp,
    });
  }
}

customElements.define('aircon-control-card', AirconControlCard);
