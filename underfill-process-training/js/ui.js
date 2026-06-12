export function createControlPanel(container, config) {
  container.innerHTML = '';
  const groups = config.groups || [];
  for (const g of groups) {
    const div = document.createElement('div');
    div.className = 'ctrl-group';
    if (g.title) {
      const h3 = document.createElement('h3');
      h3.textContent = g.title;
      div.appendChild(h3);
    }
    for (const item of g.items) {
      div.appendChild(createControl(item));
    }
    container.appendChild(div);
  }
}

function createControl(item) {
  switch (item.type) {
    case 'slider': return createSlider(item);
    case 'select': return createSelect(item);
    case 'button': return createButton(item);
    case 'toggle': return createToggle(item);
    case 'buttons': return createButtonRow(item);
    case 'legend': return createLegend(item);
    case 'label': return createLabel(item);
    case 'material': return createMaterialSelect(item);
    default: return document.createDocumentFragment();
  }
}

function createSlider(item) {
  const row = document.createElement('div');
  row.className = 'ctrl-row';
  const label = document.createElement('label');
  label.textContent = item.label;
  row.appendChild(label);
  const input = document.createElement('input');
  input.type = 'range';
  input.min = item.min ?? 0;
  input.max = item.max ?? 100;
  input.step = item.step ?? 1;
  input.value = item.value ?? 50;
  input.dataset.key = item.key;
  row.appendChild(input);
  const val = document.createElement('span');
  val.className = 'value';
  val.textContent = formatValue(input.value, item.unit);
  input.addEventListener('input', () => {
    val.textContent = formatValue(input.value, item.unit);
    if (item.onChange) item.onChange(parseFloat(input.value));
  });
  row.appendChild(val);
  return row;
}

function createSelect(item) {
  const row = document.createElement('div');
  row.className = 'ctrl-row';
  const label = document.createElement('label');
  label.textContent = item.label;
  row.appendChild(label);
  const sel = document.createElement('select');
  sel.dataset.key = item.key;
  for (const opt of (item.options || [])) {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    sel.appendChild(o);
  }
  sel.value = item.value ?? '';
  sel.addEventListener('change', () => {
    if (item.onChange) item.onChange(sel.value);
  });
  row.appendChild(sel);
  return row;
}

function createButton(item) {
  const btn = document.createElement('button');
  btn.className = `btn ${item.style || ''}`;
  btn.textContent = item.label;
  btn.dataset.key = item.key;
  btn.addEventListener('click', () => {
    if (item.onClick) item.onClick();
  });
  const row = document.createElement('div');
  row.className = 'ctrl-row';
  row.appendChild(btn);
  return row;
}

function createToggle(item) {
  const row = document.createElement('div');
  row.className = 'ctrl-row toggle-row';
  const label = document.createElement('label');
  label.textContent = item.label;
  const wrap = document.createElement('div');
  wrap.className = 'toggle-row';
  for (const opt of (item.options || [])) {
    const btn = document.createElement('button');
    btn.className = `btn ${opt.active ? 'active' : ''}`;
    btn.textContent = opt.label;
    btn.dataset.value = opt.value;
    btn.addEventListener('click', () => {
      wrap.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (item.onChange) item.onChange(opt.value);
    });
    wrap.appendChild(btn);
  }
  row.appendChild(label);
  row.appendChild(wrap);
  return row;
}

function createButtonRow(item) {
  const row = document.createElement('div');
  row.className = 'btn-row';
  for (const btnCfg of (item.buttons || [])) {
    const btn = document.createElement('button');
    btn.className = `btn ${btnCfg.style || ''}`;
    btn.textContent = btnCfg.label;
    btn.dataset.key = btnCfg.key;
    btn.addEventListener('click', () => {
      if (btnCfg.onClick) btnCfg.onClick();
    });
    row.appendChild(btn);
  }
  return row;
}

function createLegend(item) {
  const row = document.createElement('div');
  row.className = 'legend';
  for (const entry of (item.entries || [])) {
    const el = document.createElement('span');
    el.className = 'legend-item';
    el.innerHTML = `<span class="legend-swatch" style="background:${entry.color}"></span>${entry.label}`;
    row.appendChild(el);
  }
  return row;
}

function createLabel(item) {
  const row = document.createElement('div');
  row.className = 'ctrl-row';
  const span = document.createElement('span');
  span.style.cssText = 'font-size:13px;color:var(--muted);';
  span.textContent = item.text;
  row.appendChild(span);
  return row;
}

function formatValue(v, unit) {
  const n = parseFloat(v);
  if (unit === 'mm') return n.toFixed(1) + ' mm';
  if (unit === 'MPa') return n.toFixed(2) + ' MPa';
  if (unit === '°C') return n.toFixed(0) + ' °C';
  if (unit === 'ms') return n.toFixed(0) + ' ms';
  if (unit === 's') return n.toFixed(1) + 's';
  if (unit === '%') return n.toFixed(0) + '%';
  if (unit === '×') return n.toFixed(1) + '×';
  return n.toFixed(0);
}

function createMaterialSelect(item) {
  const frag = document.createDocumentFragment();
  // Preset selector
  const row = document.createElement('div');
  row.className = 'ctrl-row';
  const label = document.createElement('label');
  label.textContent = item.label || 'Material';
  row.appendChild(label);
  const sel = document.createElement('select');
  sel.dataset.key = item.key;
  for (const p of (item.presets || [])) {
    const o = document.createElement('option');
    o.value = p.key;
    o.textContent = p.label;
    sel.appendChild(o);
  }
  sel.value = item.value || '';
  sel.addEventListener('change', () => {
    if (item.onChange) item.onChange(sel.value, item.category);
  });
  row.appendChild(sel);
  frag.appendChild(row);

  // Parameter display
  if (item.showParams) {
    const paramsDiv = document.createElement('div');
    paramsDiv.className = 'mat-params';
    paramsDiv.dataset.key = item.key + '-params';
    frag.appendChild(paramsDiv);

    // Initial render
    const updateParams = () => {
      const db = item._db;
      if (!db) return;
      const preset = db.getPreset(item.category, sel.value);
      if (!preset) return;
      const cat = db.getCategory(item.category);
      if (!cat) return;
      paramsDiv.innerHTML = '';
      for (const prop of cat.properties) {
        if (preset[prop.key] === undefined) continue;
        const p = document.createElement('p');
        p.className = 'mat-param';
        p.innerHTML = `<span>${prop.label}</span><span>${preset[prop.key]} ${prop.unit || ''}</span>`;
        paramsDiv.appendChild(p);
      }
    };
    updateParams();
    sel.addEventListener('change', updateParams);
  }

  return frag;
}

export function setStatus(bar, detail) {
  const sb = document.getElementById('statusBar');
  const sd = document.getElementById('statusDetail');
  if (sb) sb.textContent = bar || '';
  if (sd) sd.textContent = detail || '';
}
