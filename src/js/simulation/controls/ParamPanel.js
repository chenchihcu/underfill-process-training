export class ParamPanel {
  constructor(container) {
    this._container = container;
    this._controls = {};
    this._blocked = false;
    this._onChange = null;
  }

  onChange(callback) {
    this._onChange = callback;
  }

  build(params) {
    this._container.innerHTML = '';
    this._controls = {};

    const fragment = document.createDocumentFragment();

    params.forEach(cfg => {
      const group = document.createElement('div');
      group.className = 'param-group';

      const label = document.createElement('label');
      label.className = 'param-label';
      label.textContent = cfg.label;

      const valueSpan = document.createElement('span');
      valueSpan.className = 'param-value';
      label.appendChild(valueSpan);

      let input;
      switch (cfg.type) {
        case 'slider':
          input = this._buildSlider(cfg, valueSpan);
          break;
        case 'select':
          input = this._buildSelect(cfg, valueSpan);
          break;
        case 'number':
          input = this._buildNumberInput(cfg, valueSpan);
          break;
      }

      if (input) {
        input.addEventListener('input', () => this._onInputChange(cfg.key, input, valueSpan));
        input.addEventListener('change', () => this._onInputChange(cfg.key, input, valueSpan));
        this._controls[cfg.key] = { input, config: cfg, valueSpan };
        group.appendChild(label);
        group.appendChild(input);
      }

      fragment.appendChild(group);
    });

    this._container.appendChild(fragment);
  }

  _buildSlider(cfg, valueSpan) {
    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'param-slider';
    input.min = cfg.min;
    input.max = cfg.max;
    input.step = cfg.step || (cfg.type === 'float' ? 0.01 : 1);
    input.value = cfg.default ?? cfg.min;
    valueSpan.textContent = this._formatValue(cfg, parseFloat(input.value));
    return input;
  }

  _buildSelect(cfg, valueSpan) {
    const select = document.createElement('select');
    select.className = 'param-select';
    cfg.options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      select.appendChild(option);
    });
    select.value = cfg.default ?? cfg.options[0].value;
    valueSpan.textContent = cfg.options.find(o => o.value === select.value)?.label || select.value;
    return select;
  }

  _buildNumberInput(cfg, valueSpan) {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'param-number';
    input.min = cfg.min;
    input.max = cfg.max;
    input.step = cfg.step || 1;
    input.value = cfg.default ?? cfg.min;
    valueSpan.textContent = this._formatValue(cfg, parseFloat(input.value));
    return input;
  }

  _onInputChange(key, input, valueSpan) {
    if (this._blocked) return;
    const cfg = this._controls[key]?.config;
    if (!cfg) return;
    const val = input.type === 'select-one' ? input.value : parseFloat(input.value);
    valueSpan.textContent = this._formatValue(cfg, val);
    if (this._onChange) this._onChange(key, val, this.getValues());
  }

  blockChanges(yes) {
    this._blocked = yes;
  }

  getValues() {
    const values = {};
    Object.entries(this._controls).forEach(([key, ctrl]) => {
      values[key] = ctrl.input.type === 'select-one' ? ctrl.input.value : parseFloat(ctrl.input.value);
    });
    return values;
  }

  setValues(data) {
    this.blockChanges(true);
    Object.entries(data).forEach(([key, value]) => {
      const ctrl = this._controls[key];
      if (!ctrl) return;
      ctrl.input.value = value;
      ctrl.valueSpan.textContent = this._formatValue(ctrl.config, value);
    });
    this.blockChanges(false);
  }

  _formatValue(cfg, val) {
    if (typeof val === 'string') return val;
    if (cfg.unit) return val + ' ' + cfg.unit;
    if (cfg.type === 'float' || cfg.step < 1) return val.toFixed(2);
    return Math.round(val).toString();
  }
}
