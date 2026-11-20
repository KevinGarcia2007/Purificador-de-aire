
'use strict';

// PLAN PLANTA - Gráfico de contaminación estilo trading
// Datos sintéticos. No son mediciones ambientales reales.

(() => {
  const host = document.getElementById('monitoreo');
  if (!host) return;

  const panel = document.createElement('article');
  panel.className = 'panel chart-panel trading-panel';

  panel.innerHTML = `
    <div class="trading-heading">
      <div>
        <p class="trading-eyebrow">● SIMULACIÓN EN VIVO</p>
        <h3>Contaminación y efecto del purificador</h3>
        <p class="small-muted">
          Verde: aire ambiental simulado.
          Azul: salida simulada del purificador.
        </p>
      </div>

      <label class="monitor-selector">
        Contaminante
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

    <canvas id="tradingChart" height="310"></canvas>

    <div class="trading-key">
      <span>🟢 Entrada ambiental</span>
      <span>🔵 Salida tratada</span>
      <span>Actualización cada 2 segundos</span>
    </div>

    <p class="small-muted">
      Para reducir la línea azul, selecciona un filtro y
      pulsa Iniciar purificación en la pestaña Planta.
      Los resultados son exclusivamente simulados.
    </p>
  `;

  const metrics = document.getElementById('monitorMetrics');

  if (metrics) {
    metrics.insertAdjacentElement('afterend', panel);
  } else {
    host.prepend(panel);
  }

  const $ = id => document.getElementById(id);

  const units = {
    pm25: 'µg/m³',
    pm10: 'µg/m³',
    co2: 'ppm',
    co: 'ppm'
  };

  const bounds = {
    pm25: [8, 65],
    pm10: [18, 110],
    co2: [420, 1200],
    co: [0.1, 3]
  };

  const names = {
    pm25: 'PM2.5',
    pm10: 'PM10',
    co2: 'CO₂',
    co: 'CO'
  };

  const ambient = {
    pm25: 27,
    pm10: 49,
    co2: 680,
    co: 0.65
  };

  const volatility = {
    pm25: 0.25,
    pm10: 0.4,
    co2: 1.7,
    co: 0.012
  };

  const points = [];
  const MAX_POINTS = 90;

  let currentFilter = null;
  let previousActive = false;
  let finishedAt = 0;

  const clamp = (v, min, max) =>
    Math.max(min, Math.min(max, v));

  const fmt = v =>
    Number(v).toLocaleString('es-CO', {
      maximumFractionDigits: 2
    });

  // Leer las mediciones del monitor existente
  function latestMonitor() {
    try {
      const data = JSON.parse(
        localStorage.getItem('plan_planta_monitoreo_v1') || '{}'
      );

      const rows = data.readings;

      return Array.isArray(rows) && rows.length
        ? rows[rows.length - 1]
        : null;
    } catch {
      return null;
    }
  }

  // Variación gradual, sin saltos bruscos
  function updateAmbient() {
    const target = latestMonitor();

    for (const key of Object.keys(ambient)) {
      const [min, max] = bounds[key];

      const base =
        target && Number.isFinite(Number(target[key]))
          ? Number(target[key])
          : (min + max) / 2;

      const noise =
        (Math.random() + Math.random() + Math.random() - 1.5)
        * volatility[key];

      const change = 0.18 * (base - ambient[key]) + noise;

      ambient[key] = clamp(
        ambient[key] + change,
        min,
        max
      );
    }
  }

  // Obtener intensidad del proceso de purificación
  function treatmentStrength() {
    if (
      typeof state === 'undefined' ||
      typeof filters === 'undefined'
    ) return 0;

    if (state.running && !state.paused) {
      currentFilter = state.filter;
      previousActive = true;
      finishedAt = 0;
      return clamp(state.progress, 0, 1);
    }

    if (state.running && state.paused) {
      return clamp(state.progress, 0, 1);
    }

    if (previousActive) {
      previousActive = false;
      finishedAt = Date.now();
    }

    // Mantener brevemente el resultado tras el ciclo
    // y luego volver a representar aire sin tratar.
    if (!finishedAt) return 0;

    return clamp(
      1 - (Date.now() - finishedAt - 15000) / 30000,
      0,
      1
    );
  }

  function tick() {
    updateAmbient();

    const strength = treatmentStrength();

    const filter =
      typeof filters !== 'undefined' && currentFilter
        ? filters[currentFilter]
        : null;

    const duration =
      typeof state !== 'undefined'
        ? Math.min(1, Number(state.duration || 10) / 10)
        : 1;

    const incoming = { ...ambient };
    const outgoing = {};

    for (const key of Object.keys(incoming)) {
      const rate = filter ? (filter.rate[key] || 0) : 0;

      outgoing[key] = Math.max(
        0,
        incoming[key] * (1 - rate * strength * duration)
      );
    }

    points.push({
      time: Date.now(),
      incoming,
      outgoing
    });

    if (points.length > MAX_POINTS) {
      points.shift();
    }

    const key = $('tradingMetric').value;

    $('tradeAmbient').textContent =
      `Entrada: ${fmt(incoming[key])} ${units[key]}`;

    $('tradeTreated').textContent =
      `Salida: ${fmt(outgoing[key])} ${units[key]}`;

    const reduction =
      100 * (1 - outgoing[key] / Math.max(incoming[key], 0.001));

    $('tradeEffect').textContent =
      strength > 0.001
        ? `${filter ? filter.name : 'Filtro activo'} · −${fmt(reduction)}%`
        : 'Sin purificación activa';

    $('tradeLive').textContent = document.hidden
      ? '● PESTAÑA EN SEGUNDO PLANO'
      : '● EN VIVO';

    draw();
  }

  function draw() {
    const canvas = $('tradingChart');
    const width = canvas.getBoundingClientRect().width;

    if (width < 100) return;

    const height = 310;
    const dpi = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(width * dpi);
    canvas.height = Math.round(height * dpi);

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpi, 0, 0, dpi, 0, 0);

    const key = $('tradingMetric').value;

    const margin = {
      left: 56,
      right: 14,
      top: 18,
      bottom: 34
    };

    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const values = points.flatMap(p => [
      p.incoming[key],
      p.outgoing[key]
    ]);

    let low = Math.min(...values, bounds[key][0]);
    let high = Math.max(...values, bounds[key][1]);

    const padding = (high - low) * 0.08 || 1;

    low = Math.max(0, low - padding);
    high += padding;

    const x = index =>
      margin.left +
      (points.length < 2
        ? 0
        : index / (points.length - 1) * chartWidth);

    const y = value =>
      margin.top + chartHeight -
      (value - low) / (high - low) * chartHeight;

    // Cuadrícula y valores del eje vertical
    ctx.font = '11px system-ui';
    ctx.lineWidth = 1;

    for (let i = 0; i <= 5; i++) {
      const posY = margin.top + chartHeight * i / 5;

      ctx.strokeStyle = 'rgba(153,214,184,.14)';
      ctx.beginPath();
      ctx.moveTo(margin.left, posY);
      ctx.lineTo(width - margin.right, posY);
      ctx.stroke();

      ctx.fillStyle = '#b1d6c1';
      ctx.textAlign = 'right';

      ctx.fillText(
        fmt(high - i * (high - low) / 5),
        margin.left - 9,
        posY + 4
      );
    }

    // Etiquetas de tiempo
    ctx.textAlign = 'left';

    for (let i = 0; i < 4; i++) {
      const index = Math.min(
        points.length - 1,
        Math.round(i * Math.max(0, points.length - 1) / 3)
      );

      if (index >= 0) {
        const time = new Date(
          points[index].time
        ).toLocaleTimeString('es-CO');

        ctx.fillText(time, x(index) - 15, height - 9);
      }
    }

    function plot(field, color, fill = false) {
      if (!points.length) return;

      // Sombreado bajo la línea de entrada
      if (fill) {
        const gradient = ctx.createLinearGradient(
          0, margin.top, 0, height - margin.bottom
        );

        gradient.addColorStop(0, 'rgba(87,238,151,.18)');
        gradient.addColorStop(1, 'rgba(87,238,151,0)');

        ctx.beginPath();

        points.forEach((p, i) => {
          if (i === 0) {
            ctx.moveTo(x(i), y(p[field][key]));
          } else {
            ctx.lineTo(x(i), y(p[field][key]));
          }
        });

        ctx.lineTo(x(points.length - 1), margin.top + chartHeight);
        ctx.lineTo(x(0), margin.top + chartHeight);
        ctx.closePath();

        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Línea principal
      ctx.beginPath();

      points.forEach((p, i) => {
        if (i === 0) {
          ctx.moveTo(x(i), y(p[field][key]));
        } else {
          ctx.lineTo(x(i), y(p[field][key]));
        }
      });

      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();

      // Marcador del último precio/medición
      const lastPoint = points[points.length - 1];

      ctx.beginPath();
      ctx.arc(
        x(points.length - 1),
        y(lastPoint[field][key]),
        4,
        0,
        Math.PI * 2
      );

      ctx.fillStyle = color;
      ctx.fill();
    }

    plot('incoming', '#78ee9f', true);
    plot('outgoing', '#62c4ff');

    ctx.fillStyle = '#d5e9dc';
    ctx.textAlign = 'left';
    ctx.font = '11px system-ui';

    ctx.fillText(
      `${names[key]} · ${units[key]} · DATOS SINTÉTICOS`,
      margin.left,
      12
    );
  }

  $('tradingMetric').addEventListener('change', () => {
    const key = $('tradingMetric').value;
    const last = points[points.length - 1];

    if (last) {
      $('tradeAmbient').textContent =
        `Entrada: ${fmt(last.incoming[key])} ${units[key]}`;

      $('tradeTreated').textContent =
        `Salida: ${fmt(last.outgoing[key])} ${units[key]}`;
    }

    draw();
  });

  window.addEventListener('resize', draw);

  tick();
  setInterval(tick, 2000);
})();
