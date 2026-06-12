export class Controls {
  constructor(container) {
    this._container = container;
    this._callbacks = {};
    this._speed = 1;
    this._isPlaying = false;
  }

  build() {
    this._container.innerHTML = '';

    const bar = document.createElement('div');
    bar.className = 'control-bar';

    const btnPlay = document.createElement('button');
    btnPlay.className = 'ctrl-btn ctrl-btn--play';
    btnPlay.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20"><polygon points="6,3 20,12 6,21" fill="currentColor"/></svg>';
    btnPlay.title = '播放 (Play)';
    btnPlay.addEventListener('click', () => this._fire('play'));

    const btnPause = document.createElement('button');
    btnPause.className = 'ctrl-btn ctrl-btn--pause';
    btnPause.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/></svg>';
    btnPause.title = '暫停 (Pause)';
    btnPause.addEventListener('click', () => this._fire('pause'));

    const btnReset = document.createElement('button');
    btnReset.className = 'ctrl-btn ctrl-btn--reset';
    btnReset.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M1 4v6h6M3.5 17.5a9 9 0 101.5-12L1 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    btnReset.title = '重置 (Reset)';
    btnReset.addEventListener('click', () => this._fire('reset'));

    const speedGroup = document.createElement('div');
    speedGroup.className = 'ctrl-speed';

    const speedLabel = document.createElement('span');
    speedLabel.className = 'ctrl-speed-label';
    speedLabel.textContent = '速度';

    const speedSlider = document.createElement('input');
    speedSlider.type = 'range';
    speedSlider.className = 'ctrl-speed-slider';
    speedSlider.min = 0.1;
    speedSlider.max = 5;
    speedSlider.step = 0.1;
    speedSlider.value = 1;
    speedSlider.addEventListener('input', () => {
      this._speed = parseFloat(speedSlider.value);
      speedVal.textContent = this._speed.toFixed(1) + 'x';
      this._fire('speed', this._speed);
    });

    const speedVal = document.createElement('span');
    speedVal.className = 'ctrl-speed-val';
    speedVal.textContent = '1.0x';

    speedGroup.append(speedLabel, speedSlider, speedVal);

    this._statusEl = document.createElement('span');
    this._statusEl.className = 'ctrl-status';
    this._statusEl.textContent = '就緒 (Ready)';

    bar.append(btnPlay, btnPause, btnReset, speedGroup, this._statusEl);
    this._container.appendChild(bar);
  }

  on(event, callback) {
    this._callbacks[event] = callback;
  }

  setStatus(text) {
    if (this._statusEl) this._statusEl.textContent = text;
  }

  setPlaying(isPlaying) {
    this._isPlaying = isPlaying;
    this.setStatus(isPlaying ? '模擬中 (Animating)' : '已暫停 (Paused)');
  }

  setSpeed(speed) {
    this._speed = Math.max(0.1, Math.min(5, speed));
    const slider = this._container.querySelector('.ctrl-speed-slider');
    const val = this._container.querySelector('.ctrl-speed-val');
    if (slider) slider.value = this._speed;
    if (val) val.textContent = this._speed.toFixed(1) + 'x';
  }

  getSpeed() { return this._speed; }

  _fire(event, data) {
    if (this._callbacks[event]) this._callbacks[event](data);
  }
}
