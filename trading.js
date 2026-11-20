'use strict';
/* PLAN PLANTA - Gráfico estilo trading: datos AMBIENTALES SINTÉTICOS.
 * No utiliza sensores físicos. No sustituye monitoreo certificado.
 * Se monta dentro de la pestaña existente "Monitor en vivo".
 */
(() => {
  const host = document.getElementById('monitoreo');
  if (!host) return;
  const chartPanel = document.createElement('article');
  chartPanel.className = 'panel chart-panel trading-panel';
  chartPanel.innerHTML = `
    <div class="trading-heading">
      <div><p class="trading-eyebrow">● SIMULACIÓN EN VIVO · ESTILO TRADING</p>
        <h3>Variación de contaminación y efecto del purificador</h3>
        <p class="small-muted">Verde: aire ambiental simulado · Azul: salida simulada del filtro. La planta no modifica el aire exterior.</p></div>
      <label class="monitor-selector">Contaminante
        <select id="tradingMetric">
          <option value="pm25">PM2.5 (µg/m³)</option>
          <option value="pm10">PM10 (µg/m³)</option>
          <option value="co2">CO₂ (ppm)</option>
          <option value="co">CO (ppm)</option>
        </select>
      </label>
    </div>
    <div class="trading-badges">
      <span id="tradeLive">● EN VIVO</span>
      <span id="tradeAmbient">Entrada: —</span>
      <span id="tradeTreated">Salida: —</span>
      <span id="tradeEffect">Tratamiento inactivo</span>
    </div>
    <canvas id="tradingChart" height="310" aria-label="Serie temporal de entrada y salida de aire simulado"></canvas>
    <div class="trading-key"><span><i class="trade-dot green"></i> Entrada ambiental</span><span><i class="trade-dot blue"></i> Salida tratada</span><span>Una muestra visual cada 2 s · últimos 3 minutos</span></div>
    <p class="small-muted" style="margin-top:8px">La salida solo se reduce al ejecutar <b>Iniciar purificación</b> en la pestaña Planta. Seleccionar un filtro o pulsar una alerta únicamente prepara la acción. CO no se considera controlado de forma segura mediante este prototipo.</p>`;
  const metrics = document.getElementById('monitorMetrics');
  if (metrics) metrics.insertAdjacentElement('afterend', chartPanel);
  else host.prepend(chartPanel);

  const $ = id => document.getElementById(id);
  const unit = {pm25:'µg/m³', pm10:'µg/m³', co2:'ppm', co:'ppm'};
  const bounds = {pm25:[8,65], pm10:[18,110], co2:[420,1200], co:[0.1,3]};
  const labels = {pm25:'PM2.5',pm10:'PM10',co2:'CO₂',co:'CO'};
  const ambient = {pm25:27, pm10:49, co2:680, co:0.65};
  const points = [];
  const maxPoints = 90; // 90 x 2 s = 3 minutos
  let currentFilter = null, previousActive = false, finishedAt = 0;
  const vol = {pm25:0.25,pm10:0.40,co2:1.7,co:0.012};
  const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
  const fmt = v => Number(v).toLocaleString('es-CO',{maximumFractionDigits:2});
  function latestMonitor() {
    try {
      const raw = JSON.parse(localStorage.getItem('plan_planta_monitoreo_v1') || '{}');
      const rows = raw.readings;
      return Array.isArray(rows) && rows.length ? rows[rows.length-1] : null;
    } catch { return null; }
  }
  // La tendencia de base sigue el monitor de 10 s; esta vista interpola con
  // pequeñas fluctuaciones para actualizarse más suavemente cada 2 s.
  function updateAmbient() {
    const target = latestMonitor();
    for (const k of Object.keys(ambient)) {
      const [min,max] = bounds[k];
      const base = target && Number.isFinite(+target[k]) ? +target[k] : (min+max)/2;
      const delta = 0.18 * (base - ambient[k]) + (Math.random()+Math.random()+Math.random()-1.5)*vol[k];
      ambient[k] = clamp(ambient[k]+delta,min,max);
    }
  }
  function treatmentStrength() {
    if (typeof state === 'undefined' || typeof filters === 'undefined') return 0;
    if (state.running && !state.paused) {
      currentFilter = state.filter;
      previousActive = true;
      finishedAt = 0;
      return clamp(state.progress,0,1);
    }
    if (state.running && state.paused) return clamp(state.progress,0,1);
    if (previousActive) {
      previousActive = false;
      finishedAt = Date.now();
    }
    // Una vez terminado el ciclo, se muestra brevemente el resultado;
    // después la gráfica vuelve a comparar con aire sin tratar.
    return finishedAt ? clamp(1-(Date.now()-finishedAt-15000)/30000,0,1) : 0;
  }
  function tick() {
    updateAmbient();
    const strength = treatmentStrength();
    const filter = typeof filters !== 'undefined' && currentFilter ? filters[currentFilter] : null;
    const duration = typeof state !== 'undefined' ? Math.min(1,Number(state.duration||10)/10) : 1;
    const incoming = {...ambient}, outgoing = {};
    for (const k of Object.keys(incoming)) {
      let rate = filter ? (filter.rate[k] || 0) : 0;
      // Los porcentajes son parámetros del simulador, no eficiencia certificada.
      outgoing[k] = Math.max(0,incoming[k]*(1-rate*strength*duration));
    }
    points.push({time:Date.now(), incoming, outgoing});
    if (points.length>maxPoints) points.shift();
    const k = $('tradingMetric').value;
    $('tradeAmbient').textContent = `Entrada: ${fmt(incoming[k])} ${unit[k]}`;
    $('tradeTreated').textContent = `Salida: ${fmt(outgoing[k])} ${unit[k]}`;
    $('tradeEffect').textContent = strength>0.001
      ? `Filtro ${filter?filter.name:'activo'} · −${fmt(100*(1-outgoing[k]/Math.max(incoming[k],0.001)))}%`
      : 'Sin purificación activa';
    $('tradeLive').textContent = document.hidden ? '● PESTAÑA EN SEGUNDO PLANO' : '● EN VIVO';
    draw();
  }
  function draw() {
    const canvas = $('tradingChart');
    const width = canvas.getBoundingClientRect().width;
    if (width < 100) return;
    const h=310, dpi=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(width*dpi); canvas.height=Math.round(h*dpi);
    const ctx=canvas.getContext('2d'); ctx.setTransform(dpi,0,0,dpi,0,0);
    ctx.clearRect(0,0,width,h);
    const key=$('tradingMetric').value, margin={l:56,r:14,t:18,b:34};
    const cw=width-margin.l-margin.r,ch=h-margin.t-margin.b;
    const vals=points.flatMap(p=>[p.incoming[key],p.outgoing[key]]);
    let low=Math.min(...vals, bounds[key][0]),high=Math.max(...vals,bounds[key][1]);
    const pad=(high-low)*0.08||1;low=Math.max(0,low-pad);high+=pad;
    const x=i=>margin.l+(points.length<2?0:i/(points.length-1)*cw);
    const y=v=>margin.t+ch-(v-low)/(high-low)*ch;
    ctx.font='11px system-ui';ctx.lineWidth=1;
    for(let i=0;i<=5;i++){
      const yy=margin.t+(ch*i/5);
      ctx.strokeStyle='rgba(153,214,184,.14)';ctx.beginPath();ctx.moveTo(margin.l,yy);ctx.lineTo(width-margin.r,yy);ctx.stroke();
      ctx.fillStyle='#b1d6c1';ctx.textAlign='right';ctx.fillText(fmt(high-i*(high-low)/5),margin.l-9,yy+4);
    }
    ctx.textAlign='left';
    for(let i=0;i<4;i++){
      const index=Math.min(points.length-1,Math.round(i*Math.max(0,points.length-1)/3));
      if(index>=0)ctx.fillText(new Date(points[index].time).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),x(index)-15,h-9);
    }
    const plot=(field,color,fill=false)=>{
      if(!points.length)return;
      if(fill){const grad=ctx.createLinearGradient(0,margin.t,0,h-margin.b);grad.addColorStop(0,'rgba(87,238,151,.18)');grad.addColorStop(1,'rgba(87,238,151,0)');ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(x(i),y(p[field][key])):ctx.moveTo(x(i),y(p[field][key])));ctx.lineTo(x(points.length-1),margin.t+ch);ctx.lineTo(x(0),margin.t+ch);ctx.closePath();ctx.fillStyle=grad;ctx.fill()}
      ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(x(i),y(p[field][key])):ctx.moveTo(x(i),y(p[field][key])));
      ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();
      const p=points.at(-1);ctx.beginPath();ctx.arc(x(points.length-1),y(p[field][key]),4,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
    };
    plot('incoming','#78ee9f',true);plot('outgoing','#62c4ff');
    ctx.fillStyle='#d5e9dc';ctx.textAlign='left';ctx.font='11px system-ui';ctx.fillText(`${labels[key]} · ${unit[key]} · DATOS SINTÉTICOS`,margin.l,12);
  }
  $('tradingMetric').addEventListener('change',()=>{const k=$('tradingMetric').value;const p=points.at(-1);if(p){$('tradeAmbient').textContent=`Entrada: ${fmt(p.incoming[k])} ${unit[k]}`;$('tradeTreated').textContent=`Salida: ${fmt(p.outgoing[k])} ${unit[k]}`;}draw()});
  window.addEventListener('resize',draw);
  tick();setInterval(tick,2000);
})();
