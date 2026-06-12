const POLY6 = (r, h) => {
  if (r >= h || r <= 0) return 0;
  const q = (h * h - r * r) / (h * h * h);
  return 4 / (Math.PI * h * h) * q * q * q;
};

const SPIKY = (r, h) => {
  if (r >= h || r <= 0) return 0;
  const q = (h - r) / (h * h * h);
  return -30 / (Math.PI * h * h) * q * q;
};

const VISC = (r, h) => {
  if (r >= h || r <= 0) return 0;
  const q = (h - r) / h;
  return 40 / (Math.PI * h * h) * q;
};

export class SPHSolver {
  constructor(config = {}) {
    this.h = config.h || 0.5;
    this.restDensity = config.restDensity || 1.0;
    this.stiffness = config.stiffness || 10.0;
    this.viscosity = config.viscosity || 0.5;
    this.capillaryForce = config.capillaryForce || 2.0;
    this.maxParticles = config.maxParticles || 1200;
    this.dt = config.dt || 0.004;
    this.h2 = this.h * this.h;

    this.bounds = config.bounds || { xMin: -7, xMax: 7, zMin: -7, zMax: 7 };
    this.obstacles = config.obstacles || [];

    this.px = new Float32Array(this.maxParticles);
    this.pz = new Float32Array(this.maxParticles);
    this.vx = new Float32Array(this.maxParticles);
    this.vz = new Float32Array(this.maxParticles);
    this.density = new Float32Array(this.maxParticles);
    this.pressure = new Float32Array(this.maxParticles);
    this.fx = new Float32Array(this.maxParticles);
    this.fz = new Float32Array(this.maxParticles);
    this.active = new Uint8Array(this.maxParticles);
    this.count = 0;
  }

  addParticle(x, z) {
    if (this.count >= this.maxParticles) return;
    const i = this.count;
    this.px[i] = x; this.pz[i] = z;
    this.vx[i] = 0; this.vz[i] = 0;
    this.active[i] = 1;
    this.count++;
  }

  addRectGrid(xMin, xMax, zMin, zMax, spacing) {
    for (let x = xMin; x <= xMax; x += spacing)
      for (let z = zMin; z <= zMax; z += spacing)
        this.addParticle(x, z);
  }

  addEdgeSource(edge, count, spread) {
    const { xMin, xMax, zMin, zMax } = this.bounds;
    spread = spread || (xMax - xMin) * 0.9;
    const cx = (xMin + xMax) / 2;
    for (let i = 0; i < count; i++) {
      let x, z;
      switch (edge) {
        case 'bottom': x = cx - spread/2 + Math.random() * spread; z = zMin; break;
        case 'top': x = cx - spread/2 + Math.random() * spread; z = zMax; break;
        case 'left': x = xMin; z = (zMin + zMax)/2 - spread/2 + Math.random() * spread; break;
        case 'right': x = xMax; z = (zMin + zMax)/2 - spread/2 + Math.random() * spread; break;
      }
      this.addParticle(x, z);
    }
  }

  step(dt) {
    const subSteps = Math.ceil(dt / this.dt);
    const subDt = dt / subSteps;
    for (let s = 0; s < subSteps; s++) {
      this._computeDensity();
      this._computeForces();
      this._integrate(subDt);
    }
  }

  _computeDensity() {
    const N = this.count;
    this.density.fill(0, 0, N);
    for (let i = 0; i < N; i++) {
      if (!this.active[i]) continue;
      let d = 0;
      for (let j = 0; j < N; j++) {
        if (i === j || !this.active[j]) continue;
        const dx = this.px[i] - this.px[j];
        const dz = this.pz[i] - this.pz[j];
        const r2 = dx * dx + dz * dz;
        if (r2 < this.h2) d += POLY6(Math.sqrt(r2), this.h);
      }
      this.density[i] = d + this.restDensity;
      this.pressure[i] = this.stiffness * (this.density[i] - this.restDensity);
    }
  }

  _computeForces() {
    const N = this.count;
    this.fx.fill(0, 0, N);
    this.fz.fill(0, 0, N);

    for (let i = 0; i < N; i++) {
      if (!this.active[i]) continue;
      let fpx = 0, fpz = 0, fvx = 0, fvz = 0;
      const pi = this.pressure[i];

      for (let j = 0; j < N; j++) {
        if (i === j || !this.active[j]) continue;
        const dx = this.px[i] - this.px[j];
        const dz = this.pz[i] - this.pz[j];
        const r2 = dx * dx + dz * dz;
        if (r2 >= this.h2 || r2 < 1e-8) continue;
        const r = Math.sqrt(r2);
        const nrx = dx / r, nrz = dz / r;
        const pGrad = SPIKY(r, this.h);
        fpx -= (pi + this.pressure[j]) / (2 * this.density[j]) * nrx * pGrad;
        fpz -= (pi + this.pressure[j]) / (2 * this.density[j]) * nrz * pGrad;
        const vGrad = VISC(r, this.h);
        fvx += this.viscosity * (this.vx[j] - this.vx[i]) / this.density[j] * vGrad;
        fvz += this.viscosity * (this.vz[j] - this.vz[i]) / this.density[j] * vGrad;
      }

      this.fx[i] = fpx + fvx;
      this.fz[i] = fpz + fvz;
      this.fz[i] += this.capillaryForce;
    }
  }

  _integrate(dt) {
    const { xMin, xMax, zMin, zMax } = this.bounds;
    for (let i = 0; i < this.count; i++) {
      if (!this.active[i]) continue;
      this.vx[i] += this.fx[i] * dt;
      this.vz[i] += this.fz[i] * dt;
      this.vx[i] *= 0.98;
      this.vz[i] *= 0.98;
      const speed = Math.sqrt(this.vx[i] * this.vx[i] + this.vz[i] * this.vz[i]);
      if (speed > 5) { this.vx[i] = (this.vx[i] / speed) * 5; this.vz[i] = (this.vz[i] / speed) * 5; }
      this.px[i] += this.vx[i] * dt;
      this.pz[i] += this.vz[i] * dt;
      if (this.px[i] < xMin) { this.px[i] = xMin; this.vx[i] *= -0.3; }
      if (this.px[i] > xMax) { this.px[i] = xMax; this.vx[i] *= -0.3; }
      if (this.pz[i] < zMin) { this.pz[i] = zMin; this.vz[i] *= -0.3; }
      if (this.pz[i] > zMax) { this.pz[i] = zMax; this.vz[i] *= -0.3; }
      for (const obs of this.obstacles) {
        const dx = this.px[i] - obs.x;
        const dz = this.pz[i] - obs.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < obs.r) {
          const nx = dx / dist, nz = dz / dist;
          this.px[i] = obs.x + nx * obs.r;
          this.pz[i] = obs.z + nz * obs.r;
          const vn = this.vx[i] * nx + this.vz[i] * nz;
          if (vn < 0) { this.vx[i] -= vn * nx * 1.2; this.vz[i] -= vn * nz * 1.2; }
        }
      }
    }
  }

  getFillFraction() {
    const { zMin } = this.bounds;
    if (this.count === 0) return 0;
    let advanced = 0;
    for (let i = 0; i < this.count; i++) {
      if (this.active[i] && this.pz[i] > zMin + 0.5) advanced++;
    }
    return Math.min(advanced / Math.max(this.count * 0.7, 1), 1);
  }

  getParticleData() {
    const positions = new Float32Array(this.count * 3);
    const colors = new Float32Array(this.count * 3);
    const sizes = new Float32Array(this.count);
    const frontZ = this.bounds.zMax;
    for (let i = 0; i < this.count; i++) {
      const ix = i * 3;
      positions[ix] = this.px[i];
      positions[ix + 1] = 0.02;
      positions[ix + 2] = this.pz[i];
      const speed = Math.sqrt(this.vx[i] * this.vx[i] + this.vz[i] * this.vz[i]);
      const t = Math.min(speed / 2, 1);
      // Core: warm orange; Fast: bright yellow/white
      const r = 0.8 + t * 0.2;
      const g = 0.4 + t * 0.5;
      const b = 0.1 + t * 0.2;
      colors[ix] = r; colors[ix + 1] = g; colors[ix + 2] = b;
      sizes[i] = 0.08 + Math.random() * 0.04;
    }
    return { positions, colors, sizes, count: this.count };
  }

  reset() {
    this.count = 0;
  }
}
