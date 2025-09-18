class CustomAirconControlCard extends HTMLElement {
  setConfig(config) {
    if (!config.entity) {
      throw new Error('Please define an entity');
    }
    this.config = config;
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  getCardSize() {
    return 5;
  }

  render() {
    if (!this._hass) return;

    const entityId = this.config.entity;
    const stateObj = this._hass.states[entityId];
    if (!stateObj) return;

    // --- Fetch attributes ---
    const hvacMode = stateObj.attributes.hvac_mode || 'off';
    const hvacAction = stateObj.attributes.hvac_action || 'idle'; // heating/cooling/off/idle
    const fanMode = stateObj.attributes.fan_mode || 'off'; // low/medium/high/off
    const setpoint = stateObj.attributes.temperature || '--';

    // --- House Temp from sensor ---
    let houseTemp = '--';
    if (this.config.house_temp_sensor) {
      const houseTempState = this._hass.states[this.config.house_temp_sensor];
      if (houseTempState && houseTempState.state !== 'unavailable' && houseTempState.state !== 'unknown') {
        houseTemp = houseTempState.state;
      }
    }

    // Display mode icons or text
    const displayIcons = this.config.display_mode_icons ?? true;

    // --- Glow colors for HVAC action ---
    const glowColors = {
      heating: 'rgba(255, 120, 0, 0.7)',
      cooling: 'rgba(0, 140, 255, 0.7)',
      idle: 'rgba(100, 100, 100, 0.1)',
      off: 'rgba(100, 100, 100, 0.1)',
    };

    const glowColor = glowColors[hvacAction.toLowerCase()] || glowColors.idle;

    // --- Icons for modes and fan ---
    const modeIcons = {
      off: 'mdi:power',
      cool: 'mdi:snowflake',
      heat: 'mdi:fire',
      fan_only: 'mdi:fan',
      auto: 'mdi:auto-fix',
    };

    const fanIcons = {
      off: 'mdi:fan-off',
      low: 'mdi:fan-speed-1',
      medium: 'mdi:fan-speed-2',
      high: 'mdi:fan-speed-3',
    };

    // Clear previous content
    this.innerHTML = '';

    // Container styles
    const container = document.createElement('div');
    container.style.fontFamily = "'Roboto', sans-serif";
    container.style.background = '#222';
    container.style.color = '#eee';
    container.style.borderRadius = '15px';
    container.style.padding = '20px';
    container.style.width = '320px';
    container.style.boxSizing = 'border-box';

    // House Temp at top
    const houseTempDiv = document.createElement('div');
    houseTempDiv.textContent = `🏠 House Temp: ${houseTemp}°`;
    houseTempDiv.style.fontSize = '1.1rem';
    houseTempDiv.style.fontWeight = '600';
    houseTempDiv.style.marginBottom = '15px';
    houseTempDiv.style.textAlign = 'center';
    container.appendChild(houseTempDiv);

    // Circle wrapper
    const circleWrapper = document.createElement('div');
    circleWrapper.style.position = 'relative';
    circleWrapper.style.margin = '0 auto';
    circleWrapper.style.width = '160px';
    circleWrapper.style.height = '160px';

    // Pulse ring
    const pulseRing = document.createElement('div');
    pulseRing.style.position = 'absolute';
    pulseRing.style.top = '50%';
    pulseRing.style.left = '50%';
    pulseRing.style.transform = 'translate(-50%, -50%)';
    pulseRing.style.width = '160px';
    pulseRing.style.height = '160px';
    pulseRing.style.borderRadius = '50%';
    pulseRing.style.boxShadow = `0 0 15px 6px ${glowColor}`;
    pulseRing.style.animation = 'pulseGlow 3s infinite ease-in-out';
    pulseRing.style.zIndex = '1';

    // Center circle
    const centerCircle = document.createElement('div');
    centerCircle.style.position = 'absolute';
    centerCircle.style.top = '50%';
    centerCircle.style.left = '50%';
    centerCircle.style.transform = 'translate(-50%, -50%)';
    centerCircle.style.width = '120px';
    centerCircle.style.height = '120px';
    centerCircle.style.borderRadius = '50%';
    centerCircle.style.background = 'radial-gradient(circle at center, #000 60%, #222 100%)';
    centerCircle.style.border = `4px solid ${glowColor}`;
    centerCircle.style.zIndex = '2';
    centerCircle.style.display = 'flex';
    centerCircle.style.flexDirection = 'column';
    centerCircle.style.justifyContent = 'center';
    centerCircle.style.alignItems = 'center';
    centerCircle.style.color = '#fff';

    // HVAC action text
    const hvacActionText = document.createElement('div');
    hvacActionText.textContent = hvacAction.charAt(0).toUpperCase() + hvacAction.slice(1);
    hvacActionText.style.fontSize = '1.1rem';
    hvacActionText.style.fontWeight = '600';
    hvacActionText.style.marginBottom = '6px';

    // Setpoint temp text
    const setpointText = document.createElement('div');
    setpointText.textContent = `${setpoint}°`;
    setpointText.style.fontSize = '2.5rem';
    setpointText.style.fontWeight = '700';

    centerCircle.appendChild(hvacActionText);
    centerCircle.appendChild(setpointText);

    circleWrapper.appendChild(pulseRing);
    circleWrapper.appendChild(centerCircle);
    container.appendChild(circleWrapper);

    // Fan mode display
    const fanModeDiv = document.createElement('div');
    fanModeDiv.style.marginTop = '15px';
    fanModeDiv.style.textAlign = 'center';
    fanModeDiv.style.display = 'flex';
    fanModeDiv.style.justifyContent = 'center';
    fanModeDiv.style.alignItems = 'center';
    fanModeDiv.style.gap = '8px';

    const fanIconEl = document.createElement('ha-icon');
    const fanIconName = fanIcons[fanMode.toLowerCase()] || 'mdi:fan';
    fanIconEl.setAttribute('icon', fanIconName);
    fanIconEl.style.width = '28px';
    fanIconEl.style.height = '28px';

    const fanText = document.createElement('div');
    fanText.textContent = `Fan: ${fanMode.charAt(0).toUpperCase() + fanMode.slice(1)}`;
    fanText.style.fontWeight = '600';
    fanText.style.fontSize = '1rem';

    fanModeDiv.appendChild(fanIconEl);
    fanModeDiv.appendChild(fanText);
    container.appendChild(fanModeDiv);

    // Modes buttons container
    const hvacModes = ['off', 'cool', 'heat', 'fan_only', 'auto'];

    const modesContainer = document.createElement('div');
    modesContainer.style.display = 'flex';
    modesContainer.style.justifyContent = 'space-between';
    modesContainer.style.marginTop = '20px';

    hvacModes.forEach(mode => {
      const btn = document.createElement('button');
      btn.style.flex = '1';
      btn.style.margin = '0 6px';
      btn.style.padding = '10px 0';
      btn.style.background = (hvacMode === mode) ? '#1e88e5' : '#444';
      btn.style.color = '#fff';
      btn.style.border = 'none';
      btn.style.borderRadius = '12px';
      btn.style.fontSize = '1rem';
      btn.style.cursor = 'pointer';
      btn.style.display = 'flex';
      btn.style.flexDirection = 'column';
      btn.style.alignItems = 'center';
      btn.style.justifyContent = 'center';
      btn.style.gap = '6px';

      btn.onclick = () => {
        this._hass.callService('climate', 'set_hvac_mode', {
          entity_id: entityId,
          hvac_mode: mode,
        });
      };

      if (displayIcons) {
        const icon = document.createElement('ha-icon');
        icon.setAttribute('icon', modeIcons[mode]);
        icon.style.width = '28px';
        icon.style.height = '28px';
        btn.appendChild(icon);
      } else {
        btn.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
      }

      if (displayIcons) {
        const label = document.createElement('div');
        label.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
        label.style.fontSize = '0.8rem';
        btn.appendChild(label);
      }

      modesContainer.appendChild(btn);
    });

    container.appendChild(modesContainer);

    // Power toggle button
    const powerBtn = document.createElement('button');
    const powerOn = hvacMode !== 'off';
    powerBtn.style.background = powerOn ? '#d32f2f' : '#444';
    powerBtn.style.color = '#fff';
    powerBtn.style.border = 'none';
    powerBtn.style.borderRadius = '14px';
    powerBtn.style.padding = '14px 0';
    powerBtn.style.cursor = 'pointer';
    powerBtn.style.marginTop = '20px';
    powerBtn.style.width = '100%';
    powerBtn.style.fontWeight = '700';
    powerBtn.style.fontSize = '1.1rem';

    powerBtn.textContent = powerOn ? 'Turn Off' : 'Turn On';

    powerBtn.onclick = () => {
      this._hass.callService('climate', powerOn ? 'turn_off' : 'turn_on', {
        entity_id: entityId,
      });
    };

    container.appendChild(powerBtn);

    // Append container
    this.appendChild(container);

    // Add pulse animation styles (only once)
    if (!this.style.querySelector('#pulseGlowStyle')) {
      const style = document.createElement('style');
      style.id = 'pulseGlowStyle';
      style.textContent = `
        @keyframes pulseGlow {
          0%, 100% {
            box-shadow: 0 0 15px 6px ${glowColor};
          }
          50% {
            box-shadow: 0 0 25px 12px ${glowColor};
          }
        }
      `;
      this.appendChild(style);
    }
  }
}

customElements.define('custom-aircon-control-card', CustomAirconControlCard);
