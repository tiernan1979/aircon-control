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
      </style>

      <div class="power">
        <button id="power">${climate.state === 'off' ? 'Turn On' : 'Turn Off'}</button>
      </div>

      <div class="temp">${climate.attributes.temperature || '--'}°C</div>
      <div class="controls">
        <button id="dec">-</button>
        <button id="inc">+</button>
      </div>
    `;

    this.querySelector('#power').addEventListener('click', () => {
      const service = climate.state === 'off' ? 'turn_on' : 'turn_off';
      this._hass.callService('climate', service, { entity_id: this.config.entity });
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
