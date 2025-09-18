# Aircon Control Card

A custom Lovelace card for Home Assistant to control your aircon with multiple sensors and room sliders.

## Installation

### Manual

1. Download `aircon-control-card.js` to your `www/custom_cards/` folder.
2. Add resource in Lovelace configuration:
   ```yaml
   resources:
     - url: /local/custom_cards/aircon-control-card.js
       type: module
