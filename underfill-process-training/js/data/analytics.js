const MAX_SAMPLES = 300;
const SERIES_COLORS = ['#3B82F6', '#d97706', '#10B981', '#EF4444', '#a78bfa', '#ec4899'];

export let enabled = false;

let buffers = {};
let chartNodes = {};
let seriesColorIdx = {};

export function push(moduleName, data) {
  if (!enabled) return;
  if (!buffers[moduleName]) buffers[moduleName] = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    if (!buffers[moduleName][key]) {
      buffers[moduleName][key] = [];
      if (!seriesColorIdx[moduleName]) seriesColorIdx[moduleName] = {};
      seriesColorIdx[moduleName][key] = SERIES_COLORS[Object.keys(buffers[moduleName]).length % SERIES_COLORS.length];
    }
    const buf = buffers[moduleName][key];
    buf.push({ t: performance.now(), v: value });
    if (buf.length > MAX_SAMPLES) buf.shift();
  }
}

export function getSeries(moduleName, key) {
  return buffers[moduleName]?.[key] || [];
}

export function getLatest(moduleName, key) {
  const buf = buffers[moduleName]?.[key];
  return buf && buf.length > 0 ? buf[buf.length - 1].v : null;
}

export function getKeys(moduleName) {
  return buffers[moduleName] ? Object.keys(buffers[moduleName]) : [];
}

export function getStats(moduleName, key) {
  const buf = buffers[moduleName]?.[key];
  if (!buf || buf.length === 0) return null;
  const vals = buf.map(s => s.v);
  return {
    min: Math.min(...vals),
    max: Math.max(...vals),
    avg: vals.reduce((a, b) => a + b, 0) / vals.length,
    latest: vals[vals.length - 1],
    count: vals.length,
  };
}

export function exportCSV(moduleName) {
  const keys = getKeys(moduleName);
  if (keys.length === 0) return;
  let csv = 'time,' + keys.join(',') + '\n';
  const n = buffers[moduleName][keys[0]].length;
  for (let i = 0; i < n; i++) {
    const t = buffers[moduleName][keys[0]][i].t;
    const row = [t.toFixed(0)];
    for (const k of keys) {
      row.push(buffers[moduleName][k][i]?.v ?? '');
    }
    csv += row.join(',') + '\n';
  }
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${moduleName}_data.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function clearModule(moduleName) {
  delete buffers[moduleName];
  delete seriesColorIdx[moduleName];
}

// ── Chart Widget ───────────────────────────────────────────

export function createChartWidget(container, moduleName, keys, title) {
  const canvas = document.createElement('canvas');
  canvas.width = container.clientWidth || 280;
  canvas.height = container.clientHeight || 140;
  canvas.style.cssText = 'width:100%;height:100%;display:block;';
  container.appendChild(canvas);

  const widget = { canvas, moduleName, keys, title, animId: null };

  const draw = () => {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const pad = { top: 20, right: 12, bottom: 20, left: 40 };
    const cw = W - pad.left - pad.right;
    const ch = H - pad.top - pad.bottom;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.fillRect(0, 0, W, H);

    // Title
    if (title) {
      ctx.fillStyle = '#64748B';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(title, pad.left, 14);
    }

    // Find global min/max across all visible series
    let allVals = [];
    for (const k of keys) {
      const series = getSeries(moduleName, k);
      series.forEach(s => allVals.push(s.v));
    }
    if (allVals.length === 0) {
      ctx.fillStyle = '#CBD5E1';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No data', W / 2, H / 2);
      widget.animId = requestAnimationFrame(draw);
      return;
    }

    const dataMin = Math.min(...allVals);
    const dataMax = Math.max(...allVals);
    const range = dataMax - dataMin || 1;
    const yMin = dataMin - range * 0.1;
    const yMax = dataMax + range * 0.1;
    const yRange = yMax - yMin || 1;

    // Grid lines
    ctx.strokeStyle = 'rgba(71,85,105,0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (i / 4) * ch;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();

      // Y label
      const val = yMax - (i / 4) * yRange;
      ctx.fillStyle = '#64748b';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(1), pad.left - 4, y + 3);
    }

    // Draw each series
    for (let ki = 0; ki < keys.length; ki++) {
      const k = keys[ki];
      const series = getSeries(moduleName, k);
      if (series.length < 2) continue;

      const color = seriesColorIdx[moduleName]?.[k] || SERIES_COLORS[ki % SERIES_COLORS.length];
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      for (let i = 0; i < series.length; i++) {
        const x = pad.left + (i / (MAX_SAMPLES - 1 || 1)) * cw;
        const y = pad.top + (1 - (series[i].v - yMin) / yRange) * ch;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Latest value label
      const last = series[series.length - 1];
      if (last) {
        const lx = pad.left + ((series.length - 1) / (MAX_SAMPLES - 1 || 1)) * cw;
        const ly = pad.top + (1 - (last.v - yMin) / yRange) * ch;
        ctx.fillStyle = color;
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(last.v.toFixed(1), Math.min(lx + 3, W - pad.right - 40), ly - 4);
      }
    }

    widget.animId = requestAnimationFrame(draw);
  };

  draw();
  return widget;
}

export function destroyChartWidget(widget) {
  if (!widget) return;
  if (widget.animId) cancelAnimationFrame(widget.animId);
  if (widget.canvas && widget.canvas.parentNode) {
    widget.canvas.parentNode.removeChild(widget.canvas);
  }
}
