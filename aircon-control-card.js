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

    const modes = ['cool', 'heat', 'fan_only', 'dry', 'auto'];
    const currentMode = climate.attributes.hvac_mode || climate.attributes.operation_mode || climate.state;

    let modeButtons = '<div class="modes">';
    modes.forEach(mode => {
      const selected = currentMode === mode ? 'mode-selected' : '';
      modeButtons += `<button class="mode-btn ${selected}" data-mode="${mode}">${mode}</button>`;
    });
    modeButtons += '</div>';

    this.innerHTML = `
      <style>
        .power {
          text-align: center;
          margin-bottom: 20px;
        }
        button {
          cursor: pointer;
          border: none;
          outline: none;
          transition: background-color 0.3s ease;
        }
        /* Power button */
        #power {
          background-color: #16a085;
          color: white;
          font-weight: bold;
          padding: 10px 30px;
          border-radius: 25px;
          font-size: 20px;
          box-shadow: 0 4px 6px rgba(22, 160, 133, 0.4);
        }
        #power:hover {
          background-color: #1abc9c;
        }

        /* Temperature circle */
        .temp {
          width: 120px;
          height: 120px;
          line-height: 120px;
          margin: 0 auto 20px auto;
          border-radius: 50%;
          background-color: #16a085;
          font-size: 56px;
          font-weight: bold;
          text-align: center;
          color: white;
          box-shadow: 0 0 15px #16a085;
          user-select: none;
        }

        /* Controls +/- buttons */
        .controls {
          display: flex;
          justify-content: center;
          margin-bottom: 20px;
        }
        .controls button {
          width: 60px;
          height: 60px;
          font-size: 36px;
          font-weight: bold;
          border-radius: 50%;
          background-color: #34495e;
          color: white;
          margin: 0 15px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        .controls button:hover {
          background-color: #2ecc71;
          box-shadow: 0 6px 12px rgba(46, 204, 113, 0.6);
        }

        /* Mode buttons */
        .modes {
          text-align: center;
          margin-bottom: 20px;
        }
        .modes button {
          margin: 0 8px;
          padding: 8px 18px;
          border-radius: 20px;
          background-color: #34495e;
          color: white;
          font-weight: 600;
          font-size: 16px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          user-select: none;
          transition: background-color 0.3s ease;
        }
        .modes button:hover {
          background-color: #2ecc71;
        }
        .mode-selected {
          background-color: #1abc9c !important;
          font-weight: 700;
          box-shadow: 0 4px 10px rgba(26, 188, 156, 0.7);
          text-decoration: underline;
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
