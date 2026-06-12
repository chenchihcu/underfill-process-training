export function lerp(a, b, t) { return a + (b - a) * t; }

export function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

export function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export function easeOut(t) { return 1 - (1 - t) * (1 - t); }

export function smoothstep(t) { return t * t * (3 - 2 * t); }

export class Tween {
  constructor(target, prop, from, to, duration, easing = easeInOut) {
    this.target = target;
    this.prop = prop;
    this.from = from;
    this.to = to;
    this.duration = duration;
    this.easing = easing;
    this.elapsed = 0;
    this.done = false;
  }
  update(dt) {
    if (this.done) return;
    this.elapsed += dt;
    const t = clamp(this.elapsed / this.duration, 0, 1);
    const e = this.easing(t);
    this.target[this.prop] = lerp(this.from, this.to, e);
    if (t >= 1) this.done = true;
  }
}

export class Sequence {
  constructor(steps) {
    this.steps = steps;
    this.index = 0;
    this.t = 0;
    this.done = false;
  }
  get current() { return this.steps[this.index]; }
  get progress() {
    if (this.steps.length === 0) return 1;
    return (this.index + this.t) / this.steps.length;
  }
  update(dt) {
    if (this.done || this.index >= this.steps.length) {
      this.done = true;
      return;
    }
    const step = this.current;
    this.t += dt / step.duration;
    if (this.t >= 1) {
      this.t = 1;
      if (step.onTick) step.onTick(1);
      this.index++;
      this.t = 0;
      if (this.index >= this.steps.length) this.done = true;
    } else {
      if (step.onTick) step.onTick(easeInOut(this.t));
    }
  }
  reset() {
    this.index = 0;
    this.t = 0;
    this.done = false;
  }
}
