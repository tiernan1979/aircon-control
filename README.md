# Aircon Control Card

A custom Lovelace card for Home Assistant to control your air conditioner with multiple sensors and room sliders.

---

## Features

- Temperature control with increment/decrement buttons and circular display  
- HVAC mode selection (Off, Cool, Heat, Fan-only, Dry, Auto) with icons  
- Fan speed control from climate entity fan modes  
- Multiple room sliders to control aircon covers with real-time updates  
- Sensor display for solar power, house/outside temperature and humidity  
- Smooth slider interaction. Room temperature sensor in cover slider
- Customizable colors and responsive design  

---

## Installation

### HACS Installation (Recommended)

1. In Home Assistant, go to **HACS**  
2. Click **Custom Repositories**
3. Add Repository https://github.com/tiernan1979/aircon-control/
4. Select type as Dashboard 
5. Search for **Aircon Control Card** 
6. Click **Download** and then **Install**  
7. Add the resource automatically or manually verify it's added in **Settings > Dashboards > Resources**

### Manual Installation

1. Download `aircon-control-card.js` to your `www/custom_cards/` folder in Home Assistant.  
2. Add the following resource entry to your Lovelace configuration:

```yaml
resources:
  - url: /local/custom_cards/aircon-control-card.js
    type: module
```
3. Reload the UI

### Usage

* Use + / - buttons to adgust target temperature
* Tap HVAC mode ions to switch modes
* Select fan speed if available
* Drag room sliders to control vent positions
* View sensor data display below the controls

## Configuration Options

| Option                | Type      | Required | Description                                                    |
|-----------------------|-----------|----------|----------------------------------------------------------------|
| `type`                | string    | Yes      | The card type, always `"custom:aircon-control-card"`           |
| `entity`              | string    | Yes      | The main climate entity ID (e.g., `climate.living_room_ac`)     |
| `show_mode_names`     | boolean   | No       | Whether to show HVAC mode names alongside icons   Default: true              |
| `sphere_primary_color` | string/rgb| No       | The sphere primary color       Default purple                  |
| `sphere_secondary_color` | string/rgb| No       | The sphere secondary color   Default: black                   |
| `text_color`          | string    | No   | Text color of sliders/sensors/menu's etc Default white|
| `slider_color`        | hex    | No       | Default named color for sliders if not specified per room HEX Code only ie #ffffff   |
| `rooms`               | array     | No       | List of room slider configurations                              |
| &nbsp;&nbsp;`name`          | string    | Yes (per room) | Name displayed for each room slider                             |
| &nbsp;&nbsp;`slider_entity` | string    | Yes (per room) | Entity ID for the cover or vent slider                          |
| &nbsp;&nbsp;`sensor_entity` | string    | No       | Optional temperature or other sensor entity for the room        |
| &nbsp;&nbsp;`color`          | hex    | No       | named color code for the slider and UI elements in the room HEX Code only ie #ffffff     |
| `solar_sensor`        | string    | No       | Sensor entity for solar power                                   |
| `house_temp_sensor`   | string    | No       | Sensor entity for house temperature                             |
| `house_humidity_sensor`| string   | No       | Sensor entity for house humidity                                |
| `outside_temp_sensor` | string    | No       | Sensor entity for outside temperature                           |
| `outside_humidity_sensor` | string| No       | Sensor entity for outside humidity                              |


---

### Notes

- At minimum, you **must specify** `type` and `entity`.  
- `rooms` array is optional; if not included, room sliders won’t be displayed.  
- Sensor and color options are optional and can be omitted based on your setup.


### Configuration Example

```yaml
type: 'custom:aircon-control-card'
entity: climate.living_room_ac
show_mode_names: true
sphere_primary_color: blue
sphere_secondary_color: black
slider_color: "#1B86EF"
rooms:
  - name: "Living Room Vent"
    slider_entity: cover.living_room_vent
    sensor_entity: sensor.living_room_temperature
    color: "#1B86EF"

  - name: "Bedroom Vent"
    slider_entity: cover.bedroom_vent
    sensor_entity: sensor.bedroom_temperature

solar_sensor: sensor.solar_power
house_temp_sensor: sensor.house_temperature
house_humidity_sensor: sensor.house_humidity
outside_temp_sensor: sensor.outside_temperature
outside_humidity_sensor: sensor.outside_humidity


```

### License
MIT License
```yaml

---

### Git commands to add README.md

```bash
git add README.md
git commit -m "Add README with installation & usage instructions including HACS"
git push origin main
```
