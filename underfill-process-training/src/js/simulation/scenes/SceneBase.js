export class SceneBase {
  constructor(name, description) {
    this.name = name;
    this.description = description;
    this._initialized = false;
    this._animating = false;
    this._elapsed = 0;
    this._speed = 1;
    this._animId = null;
  }

  init(scene, camera) {
    this._scene = scene;
    this._camera = camera;
    this._initialized = true;
  }

  update(dt) {
    if (!this._animating) return;
    this._elapsed += dt * this._speed;
  }

  reset() {
    this._elapsed = 0;
  }

  play() {
    this._animating = true;
  }

  pause() {
    this._animating = false;
  }

  isAnimating() { return this._animating; }

  setSpeed(s) { this._speed = Math.max(0.1, Math.min(5, s)); }
  getSpeed() { return this._speed; }

  getParams() { return {}; }

  setParam(name, value) {}

  resize(w, h) {
    if (this._camera) {
      const aspect = w / h || 1;
      if (this._camera.type === 'PerspectiveCamera') {
        this._camera.aspect = aspect;
        this._camera.updateProjectionMatrix();
      }
    }
  }

  destroy() {
    this.pause();
    this._initialized = false;
    this._scene = null;
    this._camera = null;
  }
}
