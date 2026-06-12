export class HeatSolver {
  constructor(config = {}) {
    this.nx = config.nx || 30;
    this.nz = config.nz || 30;
    this.cellSize = config.cellSize || 1.0;
    this.dt = config.dt || 0.005;
    this.ambientTemp = config.ambientTemp || 25;
    this.liquidus = config.liquidus || 217;

    this.T = new Float32Array(this.nx * this.nz);
    this.T.fill(this.ambientTemp);
    this.alpha = new Float32Array(this.nx * this.nz);
    this.alpha.fill(0.5); // default FR4 diffusivity mm²/s
    this.active = new Uint8Array(this.nx * this.nz);
    this.active.fill(1);
    this.latentHeat = config.latentHeat || 60; // J/g
    this.phaseProgress = new Float32Array(this.nx * this.nz);

    this.timeAboveLiquidus = 0;
    this._prevT = null;

    // Oven profile: function(t) => temperature
    this.ovenProfile = config.ovenProfile || ((t) => {
      if (t < 0.3) return 25 + (150 - 25) * (t / 0.3);
      if (t < 0.55) return 150 + (180 - 150) * ((t - 0.3) / 0.25);
      if (t < 0.8) return 180 + (245 - 180) * ((t - 0.55) / 0.25);
      return 245 - (245 - 80) * ((t - 0.8) / 0.2);
    });
  }

  setMaterial(gridX, gridZ, alphaValue) {
    if (gridX < 0 || gridX >= this.nx || gridZ < 0 || gridZ >= this.nz) return;
    this.alpha[gridZ * this.nx + gridX] = alphaValue;
  }

  setRect(x1, z1, x2, z2, alphaValue) {
    for (let gz = z1; gz <= z2; gz++)
      for (let gx = x1; gx <= x2; gx++)
        this.setMaterial(gx, gz, alphaValue);
  }

  setInitialTemp(temp) {
    this.T.fill(temp);
  }

  step(dt, progress) {
    const subSteps = Math.ceil(dt / this.dt);
    const subDt = dt / subSteps;
    const nx = this.nx, nz = this.nz;
    const ovenT = this.ovenProfile(progress);

    for (let s = 0; s < subSteps; s++) {
      const T2 = new Float32Array(this.T);

      for (let iz = 0; iz < nz; iz++) {
        for (let ix = 0; ix < nx; ix++) {
          const idx = iz * nx + ix;
          if (!this.active[idx]) continue;

          let laplacian = 0;
          let neighborCount = 0;

          // 5-point stencil
          if (ix > 0) { laplacian += T2[idx - 1] - T2[idx]; neighborCount++; }
          if (ix < nx - 1) { laplacian += T2[idx + 1] - T2[idx]; neighborCount++; }
          if (iz > 0) { laplacian += T2[idx - nx] - T2[idx]; neighborCount++; }
          if (iz < nz - 1) { laplacian += T2[idx + nx] - T2[idx]; neighborCount++; }

          // Convection at edges (simplified)
          if (ix === 0 || ix === nx - 1 || iz === 0 || iz === nz - 1) {
            laplacian += (ovenT - T2[idx]) * 2;
          }

          let dT = this.alpha[idx] * laplacian * subDt / (this.cellSize * this.cellSize);

          // Phase change (simplified latent heat)
          if (T2[idx] >= this.liquidus - 5 && T2[idx] <= this.liquidus + 5 && this.phaseProgress[idx] < 1) {
            const phaseRate = 0.02;
            this.phaseProgress[idx] = Math.min(1, this.phaseProgress[idx] + phaseRate);
            dT *= (1 - this.phaseProgress[idx] * 0.5);
          }

          this.T[idx] = T2[idx] + dT;
        }
      }

      // Track time above liquidus
      const maxT = Math.max(...this.T);
      if (maxT >= this.liquidus) this.timeAboveLiquidus += subDt;
    }
  }

  getTemperature(gridX, gridZ) {
    if (gridX < 0 || gridX >= this.nx || gridZ < 0 || gridZ >= this.nz) return 0;
    return this.T[gridZ * this.nx + gridX];
  }

  getMaxTemperature() {
    let max = 0;
    for (let i = 0; i < this.T.length; i++) if (this.T[i] > max) max = this.T[i];
    return max;
  }

  getTemperatureGrid() {
    return { data: this.T, nx: this.nx, nz: this.nz };
  }

  reset() {
    this.T.fill(this.ambientTemp);
    this.phaseProgress.fill(0);
    this.timeAboveLiquidus = 0;
  }
}
