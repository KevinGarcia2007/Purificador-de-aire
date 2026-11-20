'use strict';
// Monitor ambiental SINTÉTICO. No procede de sensores ni de la RMCAB.
(() => {
  const KEY='plan_planta_monitoreo_v1', LIMIT=1500, PERIOD_MS=10000;
  const spec={
    pm25:{label:'PM2.5',unit:'µg/m³',min:8,max:65,mean:27,vol:0.6,returnRate:0.018},
    pm10:{label:'PM10',unit:'µg/m³',min:18,max:110,mean:49,vol:0.85,returnRate:0.016},
    co2:{label:'CO₂',unit:'ppm',min:420,max:1200,mean:680,vol:4.0,returnRate:0.015},
    co:{label:'CO',unit:'ppm',min:.1,max:3,mean:.65,vol:.035,returnRate:.020}
  };
  const keys=Object.keys(spec), el=id=>document.getElementById(id);
  let readings=[],unsent=new Set(),running=true,last={},ticks=0,busy=false;
  try{const data=JSON.parse(localStorage.getItem(KEY)||'{}');if(Array.isArray(data.readings))readings=data.readings.slice(-LIMIT);if(Array.isArray(data.unsent))unsent=new Set(data.unsent);if(data.last)last=data.last;}catch{}
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  // Ruido gaussiano: pequeños cambios son frecuentes, grandes cambios son raros.
  function gaussian(){const a=1-Math.random(),b=Math.random();return Math.sqrt(-2*Math.log(a))*Math.cos(2*Math.PI*b)}
  function clockTarget(k,when){const c=spec[k],hour=when.getHours()+when.getMinutes()/60;const commute=Math.exp(-Math.pow((hour-8)/2.4,2))+0.8*Math.exp(-Math.pow((hour-18.5)/2.6,2));const daily=Math.sin(2*Math.PI*(hour-7)/24);const adjust=k==='pm25'?7*commute:k==='pm10'?11*commute:k==='co2'?95*daily+45*commute:0.12*commute;return clamp(c.mean+adjust,c.min,c.max)}
  function nextReading(){const now=new Date(),row={id:(crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random()),measured_at:now.toISOString(),source:'synthetic'};ticks++;
    // Episodios lentos y compartidos entre PM2.5/PM10: afectan varios pasos.
    const pollutionEpisode=Math.sin(ticks/32)*2.5+Math.sin(ticks/78)*1.7;
    for(const k of keys){const c=spec[k],prior=Number.isFinite(last[k])?last[k]:c.mean;
      const target=clockTarget(k,now)+(k==='pm25'?pollutionEpisode:k==='pm10'?pollutionEpisode*1.5:0);
      const change=c.returnRate*(target-prior)+c.vol*clamp(gaussian(),-2.5,2.5);
      const value=clamp(prior+change,c.min,c.max);
      row[k]=Number(value.toFixed(2));last[k]=row[k];}
    readings.push(row);if(readings.length>LIMIT)readings.shift();unsent.add(row.id);saveLocal();render();
  }
  function saveLocal(){try{const active=new Set(readings.map(r=>r.id));unsent=new Set([...unsent].filter(id=>active.has(id)));localStorage.setItem(KEY,JSON.stringify({readings,last,unsent:[...unsent]}))}catch{el('monitorStatus').textContent='Almacenamiento local lleno: exporta CSV y libera espacio.'}}
  function format(v,d=1){return Number(v).toLocaleString('es-CO',{maximumFractionDigits:d})}
  function render(){const newest=readings[readings.length-1];el('monitorMetrics').innerHTML=keys.map(k=>`<article class="monitor-reading"><small>${spec[k].label} · SENSOR VIRTUAL</small><b>${newest?format(newest[k],2):'—'}</b><span>${spec[k].unit} · SIMULADO</span></article>`).join('');el('monitorCount').textContent=`${readings.length} lecturas en histórico local`;el('monitorRows').innerHTML=readings.slice(-12).reverse().map(r=>`<tr><td>${new Date(r.measured_at).toLocaleString('es-CO')}</td>${keys.map(k=>`<td>${format(r[k],2)}</td>`).join('')}<td>Simulación</td></tr>`).join('')||'<tr><td colspan="6">Aún no hay muestras.</td></tr>';draw();}
  function draw(){const canvas=el('monitorChart');if(!canvas)return;const rect=canvas.getBoundingClientRect();if(rect.width<50)return;const ratio=Math.min(2,devicePixelRatio||1),w=rect.width,h=230;canvas.width=w*ratio;canvas.height=h*ratio;const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);const k=el('monitorMetric').value,c=spec[k],data=readings.slice(-80);let lo=c.min,hi=c.max;
    ctx.font='11px sans-serif';for(let i=0;i<=4;i++){const y=20+i*44;ctx.strokeStyle='#355c50';ctx.beginPath();ctx.moveTo(48,y);ctx.lineTo(w-12,y);ctx.stroke();ctx.fillStyle='#b6d5c6';ctx.fillText(format(hi-(hi-lo)*i/4,1),5,y+4)}
    if(data.length<2){ctx.fillText('Iniciando histórico...',w/2-50,110);return;}
    ctx.strokeStyle='#8bf1ba';ctx.lineWidth=2.5;ctx.beginPath();data.forEach((r,i)=>{const x=48+i*(w-60)/Math.max(1,data.length-1),y=196-(r[k]-lo)/(hi-lo)*176;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y)});ctx.stroke();ctx.fillStyle='#e2f9e9';ctx.fillText(`Muestras: ${data.length} · último valor: ${format(data[data.length-1][k],2)} ${c.unit}`,52,215);
  }
  async function sync(){if(busy)return;if(typeof cloud==='undefined'||!cloud||typeof cloudUser==='undefined'||!cloudUser){el('monitorStatus').textContent='Histórico local activo · configura Supabase para guardar en la nube.';return;}
    busy=true;el('monitorSync').disabled=true;
    try{const pending=readings.filter(r=>unsent.has(r.id));for(let i=0;i<pending.length;i+=100){const batch=pending.slice(i,i+100).map(r=>({...r,owner_id:cloudUser}));const {error}=await cloud.from('air_monitor_readings').upsert(batch,{onConflict:'id'});if(error)throw error;for(const r of batch)unsent.delete(r.id);saveLocal()}
      el('monitorStatus').textContent=`✓ Supabase actualizado · ${pending.length} lecturas nuevas enviadas. Muestreo sintético cada 10 s.`;
    }catch(err){el('monitorStatus').textContent='Error al guardar monitoreo: '+err.message;console.warn('PLAN PLANTA monitor',err)}finally{busy=false;el('monitorSync').disabled=false;}}
  function download(){const head=['id','measured_at',...keys,'source'];const body=readings.map(r=>head.map(k=>r[k]).join(','));const data='\uFEFF'+[head.join(','),...body].join('\n');const url=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='plan_planta_monitoreo_sintetico.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),500)}
  function useInput(){if(!readings.length)return;if(typeof state!=='undefined'&&state.running){el('monitorStatus').textContent='Finaliza o pausa la purificación antes de cargar la lectura.';return;}const r=readings[readings.length-1];for(const k of keys)el(k+'In').value=r[k];if(typeof syncInput==='function')syncInput();document.querySelector('[data-target="inicio"]').click();showStatus('Lectura sintética del monitor aplicada a la entrada del simulador.');}
  el('monitorToggle').addEventListener('click',()=>{running=!running;el('monitorToggle').textContent=running?'⏸ Pausar monitor':'▶ Reanudar monitor';el('monitorStatus').textContent=running?'Monitor activo. Datos de prueba, no sensores reales.':'Monitor en pausa; el histórico se conserva.';if(running)nextReading()});
  el('monitorMetric').addEventListener('change',draw);el('monitorSync').addEventListener('click',sync);el('monitorExport').addEventListener('click',download);el('useMonitorInput').addEventListener('click',useInput);window.addEventListener('resize',draw);
  if(!readings.length)nextReading();else{last=Object.fromEntries(keys.map(k=>[k,Number.isFinite(last[k])?last[k]:readings[readings.length-1][k]]));render()}
  setInterval(()=>{if(running)nextReading()},PERIOD_MS);
  // Lotes reducen escrituras en Supabase. Solo al estar la pestaña abierta.
  setInterval(()=>{if(running&&unsent.size)sync()},60000);
})();
