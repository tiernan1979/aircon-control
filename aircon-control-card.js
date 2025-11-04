class AirconControlCard extends HTMLElement {
  constructor() {
    super();
    this._localTemp = null;
    this._localSliderValues = {};
    this._sliderDragging = {};
    this._lastStates = {};
    this._setpointListenersAdded = false;
    this._lastConfig = null;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          font-family: 'Roboto', sans-serif;
          background: var(--card-background-color, #000);
          color: var(--text-color, white);
          border-radius: 12px;
          padding: 16px;
          display: block;
          user-select: none;
          transition: background-color 0.3s ease;
        }
        .modes {
          display: flex; justify-content: center; align-items: center; gap: 12px;
          margin-bottom: 12px;
          background:
            linear-gradient(145deg, rgba(255,255,255,0.1), rgba(0,0,0,0.3)),
            radial-gradient(circle at 60% 60%, var(--sphere-secondary, rgba(255,105,180, 0.2)), transparent 70%),
            radial-gradient(circle at 30% 30%, var(--sphere-primary, rgba(186,85,211, 0.3)), transparent 70%),
            radial-gradient(circle at center, #0a0a0a 40%, #000000 100%);
          border-radius: 50px; padding: 10px;
          box-shadow:
            inset 0 8px 12px rgba(255,255,255,0.15),
            inset 0 -8px 12px rgba(0,0,0,0.9),
            0 3px 6px rgba(0,0,0,0.4);
          width: fit-content; margin: 0 auto 12px;
        }
        .fan-modes { display:flex; justify-content:center; align-items:center; gap:12px; margin-bottom:12px; }
        .fan-btn-container {
          background: linear-gradient(145deg, var(--fan-base-color-light), var(--fan-base-color-dark));
          border-radius:6px; padding:4px 8px;
          box-shadow:0 2px 4px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.1);
        }
        .mode-btn,.fan-btn{
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          gap:4px; cursor:pointer; background:transparent; border:none; outline:none;
          color:#ccc; transition:color .3s,transform .2s; font-size:14px;
        }
        .mode-btn:hover,.fan-btn:hover{transform:scale(1.1);}
        .mode-btn.mode-selected,.fan-btn.fan-selected{color:var(--glow-color);}
        .mode-btn ha-icon,.fan-btn ha-icon{font-size:26px;}
        .mode-name,.fan-name{font-size:14px;color:var(--text-color,white);}

        .temp-setpoint-wrapper{display:flex;justify-content:center;align-items:center;gap:12px;margin-bottom:16px;}
        .setpoint-button{
          width:40px;height:40px;
          background:linear-gradient(145deg,var(--button-color),var(--button-color-dark));
          border-radius:50%;font-size:28px;color:white;
          display:flex;align-items:center;justify-content:center;cursor:pointer;
          border:1px solid #444;
          box-shadow:0 2px 4px rgba(0,0,0,0.4),inset 0 1px 2px rgba(255,255,255,0.1);
          transition:background .3s,box-shadow .3s,transform .2s;
        }
        .setpoint-button:hover{
          background:linear-gradient(145deg,var(--glow-color),var(--button-color-dark));
          box-shadow:0 0 8px var(--glow-color),0 2px 4px rgba(0,0,0,0.4);
          transform:scale(1.1);
        }

        .temp-circle-container{position:relative;width:140px;height:140px;margin:0 16px;}
        .temp-circle-container.glow .glow-bottom{opacity:.8;animation:halfGlowPulse 12s infinite ease-in-out;}
        .glow-bottom{
          position:absolute;bottom:-12px;left:50%;transform:translateX(-50%);
          width:140px;height:70px;background:var(--glow-color);
          border-radius:0 0 70px 70px / 0 0 70px 70px;
          filter:blur(10px);opacity:.4;pointer-events:none;
          transition:opacity .5s ease;animation:none;z-index:0;
        }
        .temp-circle{
          position:relative;z-index:1;width:140px;height:140px;
          border-radius:50%;
          background:
            radial-gradient(circle at 60% 60%, var(--sphere-secondary, rgba(255,105,180, 0.2)), transparent 70%),
            radial-gradient(circle at 30% 30%, var(--sphere-primary, rgba(186,85,211, 0.3)), transparent 70%),
            radial-gradient(circle at center, #0a0a0a 40%, #000000 100%);
          box-shadow:inset 0 10px 15px rgba(255,255,255,0.1),inset 0 -10px 15px rgba(0,0,0,0.8);
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          font-size:34px;font-weight:600;
        }
        .temp-circle::before{
          content:'';position:absolute;top:18px;left:20px;width:48px;height:28px;
          background:radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8), transparent 70%);
          border-radius:50%;filter:blur(2px);pointer-events:none;z-index:2;
        }
        .temp-circle::after{
          content:'';position:absolute;top:50px;left:80px;width:30px;height:15px;
          background:radial-gradient(circle at 50% 50%, rgba(255,255,255,0.4), transparent 70%);
          border-radius:50%;filter:blur(1.5px);pointer-events:none;z-index:2;
        }
        .temp-circle .reflection{
          position:absolute;top:30px;left:50px;width:40px;height:40px;
          background:radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8), transparent 70%);
          border-radius:50%;pointer-events:none;filter:blur(6px);
        }
        @keyframes halfGlowPulse{0%,100%{opacity:0.4;}50%{opacity:0.8;}}
        .temp-value{font-size:30px;font-weight:600;}
        .mode-in-circle{margin-top:6px;display:flex;align-items:center;gap:6px;font-size:18px;}

        .sensor-line{
          font-size:14px;margin:12px auto;text-align:center;
          display:flex;justify-content:center;align-items:center;gap:8px;
          background:linear-gradient(145deg,var(--slider-base-color-light),var(--slider-base-color-dark));
          border-radius:6px;padding:4px 8px;
          box-shadow:0 2px 4px rgba(0,0,0,0.3),inset 0 1px 2px rgba(255,255,255,0.1);
          width:fit-content;
        }
        .sensor-line ha-icon{font-size:16px;}
        .sensor-line ha-icon[icon="mdi:home-outline"]{color:#4fc3f7;}
        .sensor-line ha-icon[icon="mdi:weather-sunny"]{color:#ffca28;}
        .sensor-line ha-icon[icon="mdi:solar-power"]{color:#fbc02d;}
        .clickable-sensor{cursor:pointer;text-decoration:none;color:inherit;}

        .room-section{margin-top:12px;display:flex;flex-direction:column;gap:2px;}
        .room-block{position:relative;width:100%;}
        .styled-room-slider{
          width:100%;height:34px;-webkit-appearance:none;appearance:none;
          border-radius:12px;outline:none;transition:background .3s ease;
          margin:0;margin-bottom:-10px;
          background:linear-gradient(to right,
            var(--gradient-dark) 0%,
            var(--gradient-start) var(--percent),
            var(--light-gradient-end) var(--percent)
          );
          z-index:1;
          cursor:pointer;
        }
        /* Invisible thumb – allows full-track click & drag */
        .styled-room-slider::-webkit-slider-thumb{
          -webkit-appearance:none;width:0;height:0;cursor:pointer;
        }
        .styled-room-slider::-moz-range-thumb{
          width:0;height:0;border:none;cursor:pointer;
        }
        .slider-info{
          position:absolute;top:6px;left:12px;right:12px;height:22px;
          display:flex;justify-content:space-between;align-items:center;
          pointer-events:none;font-family:'Georgia','Playfair Display',serif;
          font-size:15px;color:var(--text-color,white);z-index:2;
        }
        .slider-info *{pointer-events:auto;}
        .slider-name{flex:1;width:200px;}
        .slider-status{width:50px;text-align:right;}
        .slider-temp{
          width:50px;text-align:center;cursor:pointer;
          text-decoration:none;
        }

        .view-aircon .modes,
        .view-aircon .fan-modes,
        .view-aircon .temp-setpoint-wrapper,
        .view-aircon .sensor-line{display:none;}
        .view-sliders .room-section{display:none;}
      </style>

      <div class="modes"></div>
      <div class="fan-modes"></div>
      <div class="temp-setpoint-wrapper">
        <button class="setpoint-button" id="dec-setpoint" style="--button-color:var(--dec-button-color);--button-color-dark:var(--dec-button-color-dark)">−</button>
        <div class="temp-circle-container">
          <div class="glow-bottom"></div>
          <div class="temp-circle">
            <div class="reflection"></div>
            <div class="temp-value"></div>
            <div class="mode-in-circle"><ha-icon></ha-icon><span></span></div>
          </div>
        </div>
        <button class="setpoint-button" id="inc-setpoint" style="--button-color:var(--inc-button-color);--button-color-dark:var(--inc-button-color-dark)">+</button>
      </div>
      <div class="sensor-line"></div>
      <div class="room-section"></div>
    `;
  }

  /* -------------------------------------------------
     COLOR HELPERS – unchanged
  ------------------------------------------------- */
  hexToRgb(hex){
    let h=hex.replace(/^#/,'');if(h.length===3)h=h.split('').map(c=>c+c).join('');
    return{r:parseInt(h.substr(0,2),16),g:parseInt(h.substr(2,2),16),b:parseInt(h.substr(4,2),16)};
  }
  rgbToHsl(r,g,b){
    r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b);
    let h,s,l=(max+min)/2;
    if(max===min){h=s=0;}else{
      const d=max-min;s=l>0.5?d/(2-max-min):d/(max+min);
      switch(max){
        case r:h=(g-b)/d+(g<b?6:0);break;
        case g:h=(b-r)/d+2;break;
        case b:h=(r-g)/d+4;break;
      }h/=6;
    }
    return{h:h*360,s:s*100,l:l*100};
  }
  hslToRgb(h,s,l){
    s/=100;l/=100;const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;
    let r=0,g=0,b=0;
    if(0<=h&&h<60){r=c;g=x;b=0;}else if(60<=h&&h<120){r=x;g=c;b=0;}
    else if(120<=h&&h<180){r=0;g=c;b=x;}else if(180<=h&&h<240){r=0;g=x;b=c;}
    else if(240<=h&&h<300){r=x;g=0;b=c;}else if(300<=h&&h<360){r=c;g=0;b=x;}
    r=Math.round((r+m)*255);g=Math.round((g+m)*255);b=Math.round((b+m)*255);
    return{r,g,b};
  }
  getComplementaryColor(hex){
    const{r,g,b}=this.hexToRgb(hex);
    const{h,s,l}=this.rgbToHsl(r,g,b);
    const compH=(h+180)%360,compL=Math.min(l+10,80);
    const{r:newR,g:newG,b:newB}=this.hslToRgb(compH,s,compL);
    return`#${newR.toString(16).padStart(2,'0')}${newG.toString(16).padStart(2,'0')}${newB.toString(16).padStart(2,'0')}`;
  }
  rgbToHex(rgb){
    const m=/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(rgb);
    if(!m)return rgb;
    return'#'+[m[1],m[2],m[3]].map(v=>parseInt(v).toString(16).padStart(2,'0')).join('');
  }
  hexToRgba(hex,opacity){
    const{r,g,b}=this.hexToRgb(hex);
    return`rgba(${r},${g},${b},${opacity})`;
  }
  shadeColor(color,percent){
    let R=parseInt(color.substring(1,3),16),G=parseInt(color.substring(3,5),16),B=parseInt(color.substring(5,7),16);
    R=parseInt(R*(100+percent)/100);G=parseInt(G*(100+percent)/100);B=parseInt(B*(100+percent)/100);
    R=R<255?R:255;G=G<255?G:255;B=B<255?B:255;
    return'#'+[R,G,B].map(v=>v.toString(16).padStart(2,'0')).join('');
  }

  /* -------------------------------------------------
     CONFIG
  ------------------------------------------------- */
  setConfig(config){
    if(!config.entity)throw new Error('You need to define an entity');
    this.config=config;
    this.showModeNames=config.show_mode_names!==false;
    this.viewMode=config.view_mode||"full";

    this.shadowRoot.host.classList.remove('view-full','view-sliders','view-aircon');
    this.shadowRoot.host.classList.add(`view-${this.viewMode}`);

    const textColor=config.text_color||"white";
    this.shadowRoot.host.style.setProperty('--text-color',textColor);

    const spherePrimary=config.sphere_primary_color||'rgba(186,85,211,0.3)';
    const sphereSecondary=config.sphere_secondary_color||'rgba(255,105,180,0.2)';
    this.shadowRoot.host.style.setProperty('--sphere-primary',spherePrimary);
    this.shadowRoot.host.style.setProperty('--sphere-secondary',sphereSecondary);

    const defaultSliderColor=config.slider_color||'#1B86EF';
    this.shadowRoot.host.style.setProperty('--slider-base-color',defaultSliderColor);
    this.shadowRoot.host.style.setProperty('--slider-base-color-light',this.hexToRgba(this.shadeColor(defaultSliderColor,20),0.2));
    this.shadowRoot.host.style.setProperty('--slider-base-color-dark',this.hexToRgba(this.shadeColor(defaultSliderColor,-20),0.2));
    this.shadowRoot.host.style.setProperty('--fan-base-color',this.shadeColor(defaultSliderColor,-25));
    this.shadowRoot.host.style.setProperty('--fan-base-color-light',this.hexToRgba(this.shadeColor(defaultSliderColor,-10),0.2));
    this.shadowRoot.host.style.setProperty('--fan-base-color-dark',this.hexToRgba(this.shadeColor(defaultSliderColor,-30),0.3));

    const modeData={off:{icon:'mdi:power',color:'#D69E5E',name:'Off'},
                    cool:{icon:'mdi:snowflake',color:'#2196F3',name:'Cool'},
                    heat:{icon:'mdi:fire',color:'#F44336',name:'Heat'},
                    fan_only:{icon:'mdi:fan',color:'#9E9E9E',name:'Fan'},
                    dry:{icon:'mdi:water-percent',color:'#009688',name:'Dry'},
                    auto:{icon:'mdi:autorenew',color:'#FFC107',name:'Auto'}};

    const modes=this.shadowRoot.querySelector('.modes');
    let html='';Object.entries(modeData).forEach(([k,v])=>{
      html+=`<button class="mode-btn" data-mode="${k}" style="color:#ccc">
               <ha-icon icon="${v.icon}" style="color:#ccc"></ha-icon>
               ${this.showModeNames?`<span class="mode-name">${v.name}</span>`:''}
             </button>`;
    });modes.innerHTML=html;

    const fanModesCont=this.shadowRoot.querySelector('.fan-modes');
    const fallback=['low','medium','high','auto'];
    const fanModes=this._hass?.states[config.entity]?.attributes.fan_modes?.length>0
                    ?this._hass.states[config.entity].attributes.fan_modes:fallback;
    let fanHtml='';fanModes.forEach(f=>{fanHtml+=`<div class="fan-btn-container">
                                    <button class="fan-btn" data-fan-mode="${f}" style="color:#ccc">
                                      <span class="fan-name">${f.charAt(0).toUpperCase()+f.slice(1)}</span>
                                    </button>
                                  </div>`;});
    fanModesCont.innerHTML=fanHtml;

    const roomSec=this.shadowRoot.querySelector('.room-section');
    if(config.rooms&&Array.isArray(config.rooms)){
      let rhtml='';config.rooms.forEach(r=>{
        const col=r.color??config.slider_color??'#1B86EF';
        const prim=this.hexToRgba(col,0.7),dark=this.hexToRgba(this.shadeColor(col,-40),0.3),
              light=this.hexToRgba(this.shadeColor(col,50),0.1);
        rhtml+=`<div class="room-block" data-entity="${r.slider_entity}" data-temp-entity="${r.sensor_entity||''}">
                  <input type="range" class="styled-room-slider" min="0" max="100" step="5" value="0"
                         data-entity="${r(lambda_entity}" data-temp-entity="${r.sensor_entity||''}"
                         style="--gradient-dark:${dark};--gradient-start:${prim};--light-gradient-end:${light};--percent:0%;">
                  <div class="slider-info">
                    <span class="slider-name">${r.name}</span>
                    <span class="slider-temp" data-entity="${r.sensor_entity||''}">--°C</span>
                    <span class="slider-status">0%</span>
                  </div>
                </div>`;
      });roomSec.innerHTML=rhtml;
    }else roomSec.innerHTML='';

    this._attachListeners();
  }

  /* -------------------------------------------------
     LISTENERS – now with full-track click & drag
  ------------------------------------------------- */
  _attachListeners(){
    const cfg=this.config;

    // Mode & fan buttons
    this.shadowRoot.querySelectorAll('.mode-btn,.fan-btn').forEach(b=>{
      const nb=b.cloneNode(true);b.parentNode.replaceChild(nb,b);
      nb.addEventListener('click',()=>{
        const isMode=nb.classList.contains('mode-btn');
        const val=nb.getAttribute(isMode?'data-mode':'data-fan-mode');
        if(!this._hass)return;
        if(isMode&&val==='off')this._hass.callService('climate','turn_off',{entity_id:cfg.entity});
        else if(isMode)this._hass.callService('climate','set_hvac_mode',{entity_id:cfg.entity,hvac_mode:val});
        else this._hass.callService('climate','set_fan_mode',{entity_id:cfg.entity,fan_mode:val});
      });
    });

    // Room sliders – full track interaction
    this.shadowRoot.querySelectorAll('.room-block').forEach(block=>{
      const slider=block.querySelector('.styled-room-slider');
      const tempEl=block.querySelector('.slider-temp');
      const eid=slider.dataset.entity;
      const tempEid=slider.dataset.tempEntity;

      this._sliderDragging[eid]=false;
      const ns=slider.cloneNode(true);slider.parentNode.replaceChild(ns,slider);

      // Click anywhere on track
      ns.addEventListener('click', e => {
        const rect = ns.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = x / rect.width;
        const value = Math.round(percent * 100 / 5) * 5;
        ns.value = value;
        ns.dispatchEvent(new Event('input', { bubbles: true }));
        ns.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Drag support
      ns.addEventListener('pointerdown', e => {
        this._sliderDragging[eid] = true;
        ns.setPointerCapture(e.pointerId);
        const moveHandler = ev => {
          if (!this._sliderDragging[eid]) return;
          const rect = ns.getBoundingClientRect();
          const x = ev.clientX - rect.left;
          const percent = Math.max(0, Math.min(1, x / rect.width));
          const value = Math.round(percent * 100 / 5) * 5;
          ns.value = value;
          ns.dispatchEvent(new Event('input', { bubbles: true }));
        };
        const upHandler = () => {
          this._sliderDragging[eid] = false;
          ns.releasePointerCapture(e.pointerId);
          ns.removeEventListener('pointermove', moveHandler);
          ns.removeEventListener('pointerup', upHandler);
          ns.removeEventListener('pointercancel', upHandler);
          ns.dispatchEvent(new Event('change', { bubbles: true }));
        };
        ns.addEventListener('pointermove', moveHandler);
        ns.addEventListener('pointerup', upHandler);
        ns.addEventListener('pointercancel', upHandler);
      });

      // Input updates local value & UI
      ns.addEventListener('input', e => {
        const v = +e.target.value;
        this._localSliderValues[eid] = v;
        e.target.style.setProperty('--percent', v + '%');
        block.querySelector('.slider-status').textContent = v + '%';
      });

      // Change sends to HA
      ns.addEventListener('change', e => {
        const v = +e.target.value;
        this._localSliderValues[eid] = undefined;
        if(this._hass) this._hass.callService('cover','set_cover_position',{entity_id:eid,position:v});
      });

      // Room temp click → more-info
      if(tempEl && tempEid){
        tempEl.style.cursor='pointer';
        tempEl.addEventListener('click', ev=>{
          ev.stopPropagation();
          const mi=new Event('hass-more-info',{bubbles:true,composed:true});
          mi.detail={entityId:tempEid};
          tempEl.dispatchEvent(mi);
        });
      }
    });

    // Setpoint buttons
    if(!this._setpointListenersAdded){
      this.shadowRoot.getElementById('dec-setpoint')?.addEventListener('click',()=>this._adjustTemp(-1));
      this.shadowRoot.getElementById('inc-setpoint')?.addEventListener('click',()=>this._adjustTemp(1));
      this._setpointListenersAdded=true;
    }
  }

  _adjustTemp(delta){
    if(!this._hass||!this.config)return;
    const c=this._hass.states[this.config.entity];
    const min=c.attributes.min_temp??16,max=c.attributes.max_temp??30;
    const cur=this._localTemp??(c.attributes.temperature??min);
    let nt=cur+delta;nt=Math.max(min,Math.min(max,nt));
    this._localTemp=nt;
    this._hass.callService('climate','set_temperature',{entity_id:this.config.entity,temperature:nt});
  }

  /* -------------------------------------------------
     HASS UPDATE
  ------------------------------------------------- */
  set hass(hass){
    this._hass=hass;
    const cfg=this.config;
    if(!cfg||!hass.states[cfg.entity]){
      this.shadowRoot.innerHTML=`<hui-warning>${cfg?.entity||'Entity'} not available</hui-warning>`;
      return;
    }

    const cfgStr=JSON.stringify(cfg);
    if(this._lastConfig!==cfgStr){this._lastConfig=cfgStr;this.setConfig(cfg);}

    const climate=hass.states[cfg.entity];
    const minTemp=climate.attributes.min_temp??16;
    const maxTemp=climate.attributes.max_temp??30;
    const curTemp=climate.attributes.temperature??climate.attributes.current_temperature??minTemp;

    if(this._localTemp!==null&&Math.abs(this._localTemp-curTemp)<0.1)this._localTemp=null;
    const dispTemp=this._localTemp!==null?this._localTemp:curTemp;

    const curMode=climate.attributes.hvac_mode??climate.state;
    const powerOn=climate.state!=='off';
    const curFan=climate.attributes.fan_mode??null;

    const modeData={off:{icon:'mdi:power',color:'#D69E5E',name:'Off'},
                    cool:{icon:'mdi:snowflake',color:'#2196F3',name:'Cool'},
                    heat:{icon:'mdi:fire',color:'#F44336',name:'Heat'},
                    fan_only:{icon:'mdi:fan',color:'#9E9E9E',name:'Fan'},
                    dry:{icon:'mdi:water-percent',color:'#009688',name:'Dry'},
                    auto:{icon:'mdi:autorenew',color:'#FFC107',name:'Auto'}};

    const glow glow=modeData[curMode]?.color??'#b37fed';
    if(this._lastStates.glowColor!==glow){
      this.shadowRoot.host.style.setProperty('--glow-color',glow);
      this._lastStates.glowColor=glow;
    }

    const heat=curMode==='heat';
    const decC=heat?'#F44336':'#2196F3',incC=heat?'#2196F3':'#F44336';
    if(this._lastStates.decColor!==decC||this._lastStates.incColor!==incC){
      this.shadowRoot.querySelector('#dec-setpoint').style.setProperty('--button-color',decC);
      this.shadowRoot.querySelector('#dec-setpoint').style.setProperty('--button-color-dark',this.shadeColor(decC,-20));
      this.shadowRoot.querySelector('#inc-setpoint').style.setProperty('--button-color',incC);
      this.shadowRoot.querySelector('#inc-setpoint').style.setProperty('--button-color-dark',this.shadeColor(incC,-20));
      this._lastStates.decColor=decC;this._lastStates.incColor=incC;
    }

    const getS=id=>{const s=hass.states[id];return(!s||s.state==='unknown'||s.state==='unavailable')?null:s.state;};

    const sSolar=cfg.solar_sensor?getS(cfg.solar_sensor):null;
    const sHT=cfg.house_temp_sensor?getS(cfg.house_temp_sensor):null;
    const sHH=cfg.house_humidity_sensor?getS(cfg.house_humidity_sensor):null;
    const sOT=cfg.outside_temp_sensor?getS(cfg.outside_temp_sensor):null;
    const sOH=cfg.outside_humidity_sensor?getS(cfg.outside_humidity_sensor):null;
    const sk=`${sSolar}|${sHT}|${sHH}|${sOT}|${sOH}`;
    if(this._lastStates.sensorKey!==sk){
      const line=this.shadowRoot.querySelector('.sensor-line');
      const parts=[];
      if(sHT!==null||sHH!==null){
        const t=sHT!==null?`<span class="clickable-sensor" data-entity="${cfg.house_temp_sensor}">${sHT}°C</span>`:'';
        const h=sHH!==null?`<span class="clickable-sensor" data-entity="${cfg.house_humidity_sensor}">${sHH}%</span>`:'';
        parts.push(`<ha-icon icon="mdi:home-outline"></ha-icon> ${t}${t&&h?' / ':''}${h}`);
      }
      if(sOT!==null||sOH!==null){
        const t=sOT!==null?`<span class="clickable-sensor" data-entity="${cfg.outside_temp_sensor}">${sOT}°C</span>`:'';
        const h=sOH!==null?`<span class="clickable-sensor" data-entity="${cfg.outside_humidity_sensor}">${sOH}%</span>`:'';
        parts.push(`<ha-icon icon="mdi:weather-sunny"></ha-icon> ${t}${t&&h?' / ':''}${h}`);
      }
      if(sSolar!==null)parts.push(`<ha-icon icon="mdi:solar-power"></ha-icon> <span class="clickable-sensor" data-entity="${cfg.solar_sensor}">${sSolar}</span>`);
      line.innerHTML=parts.length?parts.join(' | '):'';
      line.querySelectorAll('.clickable-sensor').forEach(el=>{
        el.style.cursor='pointer';
        el.addEventListener('click',()=>{const ev=new Event('hass-more-info',{bubbles:true,composed:true});ev.detail={entityId:el.dataset.entity};el.dispatchEvent(ev);});
      });
      this._lastStates.sensorKey=sk;
    }

    if(this._lastStates.currentMode!==curMode){
      this.shadowRoot.querySelectorAll('.mode-btn').forEach(b=>{
        const mk=b.dataset.mode;const sel=curMode===mk;
        const col=sel?modeData[mk].color:'#ccc';
        b.classList.toggle('mode-selected',sel);
        b.style.color=col;b.querySelector('ha-icon').style.color=col;
      });
      this._lastStates.currentMode=curMode;
    }

    if(this._lastStates.currentFanMode!==curFan){
      const defCol=cfg.slider_color||'#1B86EF';
      this.shadowRoot.querySelectorAll('.fan-btn').forEach(b=>{
        const fm=b.dataset.fanMode;const sel=curFan&&curFan.toLowerCase()===fm.toLowerCase();
        b.classList.toggle('fan-selected',sel);
        const cont=b.closest('.fan-btn-container');
        if(cont){
          cont.style.background=sel?defCol:'linear-gradient(145deg,var(--fan-base-color-light),var(--fan-base-color-dark))';
          cont.style.boxShadow=sel?'inset 0 3px 6px rgba(0,0,0,0.4),0 1px 2px rgba(255,255,255,0.2)'
                                 :'0 2px 4px rgba(0,0,0,0.3),inset 0 1px 2px rgba(255,255,255,0.1)';
        }
      });
      this._lastStates.currentFanMode=curFan;
    }

    const tempK=`${dispTemp}`;
    if(this._lastStates.tempValueKey!==tempK){
      const el=this.shadowRoot.querySelector('.temp-value');
      if(el)el.textContent=`${dispTemp.toFixed(1)}°C`;
      this._lastStates.tempValueKey=tempK;
    }

    const powerK=`${powerOn}`;
    if(this._lastStates.powerKey!==powerK){
      this.shadowRoot.querySelector('.temp-circle-container').classList.toggle('glow',powerOn);
      this._lastStates.powerKey=powerK;
    }

    const modeK=`${curMode}`;
    if(this._lastStates.modeKey!==modeK){
      const circ=this.shadowRoot.querySelector('.mode-in-circle');
      const m=modeData[curMode]||{};
      const ic=circ.querySelector('ha-icon'),lb=circ.querySelector('span');
      if(ic){ic.setAttribute('icon',m.icon||'');ic.style.color=m.color||'';}
      if(lb){lb.textContent=m.name||'';lb.style.color=m.color||'';}
      this._lastStates.modeKey=modeK;
    }

    if(cfg.rooms&&Array.isArray(cfg.rooms)){
      this.shadowRoot.querySelectorAll('.room-block').forEach(block=>{
        const eid=block.dataset.entity;
        const slider=block.querySelector('.styled-room-slider');
        const ent=hass.states[eid];
        const room=cfg.rooms.find(r=>r.slider_entity===eid);
        const sens=room?hass.states[room.sensor_entity]:null;

        let val=0;
        if(ent){
          if(ent.attributes.current_position!=null)val=parseInt(ent.attributes.current_position)||0;
          else if(!isNaN(Number(ent.state)))val=Number(ent.state);
        }
        val=Math.round(val/5)*5;val=Math.max(0,Math.min(100,val));
        const sensVal=sens&&!isNaN(Number(sens.state))?Number(sens.state):null;
        const key=`${val}|${sensVal}`;

        if(this._lastStates[eid]!==key&&!this._sliderDragging[eid]){
          const loc=this._localSliderValues[eid];
          const disp=loc!==undefined?loc:val;
          slider.value=disp;
          slider.style.setProperty('--percent',disp+'%');
          block.querySelector('.slider-status').textContent=disp+'%';
          const tEl=block.querySelector('.slider-temp');
          if(tEl)tEl.textContent=sensVal!==null?`${sensVal.toFixed(1)}°C`:'';
          this._lastStates[eid]=key;
        }
      });
    }
  }

  getCardSize(){return 6;}
}
customElements.define('aircon-control-card', AirconControlCard);
