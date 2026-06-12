export class StressFEA {
  constructor(config = {}) {
    this.nx = config.nx || 24;
    this.nz = config.nz || 24;
    this.Lx = config.Lx || 5.8;
    this.Lz = config.Lz || 5.8;
    this.thickness = config.thickness || 1.0;

    this.E = config.youngsModulus || 17000; // MPa (FR4)
    this.nu = config.poisson || 0.17;
    this.cteSubstrate = config.cteSubstrate || 14e-6; // 1/°C
    this.cteDie = config.cteDie || 3e-6;
    this.tRef = config.tRef || 25; // stress-free temperature

    // Plate bending stiffness D = E*t^3 / (12*(1-nu^2))
    this.D = this.E * Math.pow(this.thickness, 3) / (12 * (1 - this.nu * this.nu));

    // Nodal arrays (Nx * Nz)
    this.w = new Float32Array(this.nx * this.nz); // displacement
    this.wOld = new Float32Array(this.nx * this.nz);
    this.temperature = new Float32Array(this.nx * this.nz);
    this.temperature.fill(this.tRef);
  }

  setTemperatureField(gridX, gridZ, temp) {
    if (gridX < 0 || gridX >= this.nx || gridZ < 0 || gridZ >= this.nz) return;
    this.temperature[gridZ * this.nx + gridX] = temp;
  }

  setRectTemp(z1, x1, z2, x2, temp) {
    for (let gz = z1; gz <= z2; gz++)
      for (let gx = x1; gx <= x2; gx++)
        this.setTemperatureField(gx, gz, temp);
  }

  fillTemperature(temp) {
    this.temperature.fill(temp);
  }

  // CTE mismatch thermal strain => equivalent pressure load
  _computeThermalLoad() {
    const load = new Float32Array(this.nx * this.nz);
    const dx = this.Lx / (this.nx - 1);
    const dz = this.Lz / (this.nz - 1);

    for (let iz = 1; iz < this.nz - 1; iz++) {
      for (let ix = 1; ix < this.nx - 1; ix++) {
        const idx = iz * this.nx + ix;
        const dT = this.temperature[idx] - this.tRef;

        // Thermal moment (CTE mismatch induces bending moment)
        const alphaEff = this.cteSubstrate + (this.cteDie - this.cteSubstrate) * 0.3;
        const thermalStrain = alphaEff * dT;

        // Equivalent pressure from biaxial bending
        // p = D * (1+nu) * alpha * nabla^2(T)
        const d2Tdx2 = (this.temperature[iz * this.nx + (ix + 1)] - 2 * this.temperature[idx] + this.temperature[iz * this.nx + (ix - 1)]) / (dx * dx);
        const d2Tdz2 = (this.temperature[(iz + 1) * this.nx + ix] - 2 * this.temperature[idx] + this.temperature[(iz - 1) * this.nx + ix]) / (dz * dz);
        const p = this.D * (1 + this.nu) * this.cteSubstrate * (d2Tdx2 + d2Tdz2);

        load[idx] = p * 0.001; // scale to mm
      }
    }
    return load;
  }

  step(dt) {
    // Iterative solver: central difference on Kirchhoff plate equation
    // D * nabla^4(w) = p  => solve via Gauss-Seidel
    const dx = this.Lx / (this.nx - 1);
    const dz = this.Lz / (this.nz - 1);
    const load = this._computeThermalLoad();

    // Store old displacement for convergence check
    for (let i = 0; i < this.w.length; i++) this.wOld[i] = this.w[i];

    const maxIter = Math.min(Math.ceil(dt * 60), 50);
    const factor = 1 / (2 / (dx * dx * dx * dx) + 2 / (dz * dz * dz * dz) + 2 / (dx * dx * dz * dz));

    for (let iter = 0; iter < maxIter; iter++) {
      for (let iz = 1; iz < this.nz - 1; iz++) {
        for (let ix = 1; ix < this.nx - 1; ix++) {
          const idx = iz * this.nx + ix;
          if (this.w[idx] > 0.5) continue; // clamp growth

          const w = this.w;
          const w_ij = w[idx];
          const w_xx = (w[iz * this.nx + (ix + 1)] - 2 * w_ij + w[iz * this.nx + (ix - 1)]) / (dx * dx);
          const w_zz = (w[(iz + 1) * this.nx + ix] - 2 * w_ij + w[(iz - 1) * this.nx + ix]) / (dz * dz);
          const w_xxxx = (w[iz * this.nx + (ix + 2)] - 4 * w[iz * this.nx + (ix + 1)] + 6 * w_ij - 4 * w[iz * this.nx + (ix - 1)] + w[iz * this.nx + (ix - 2)]) / (dx * dx * dx * dx);
          const w_zzzz = (w[(iz + 2) * this.nx + ix] - 4 * w[(iz + 1) * this.nx + ix] + 6 * w_ij - 4 * w[(iz - 1) * this.nx + ix] + w[(iz - 2) * this.nx + ix]) / (dz * dz * dz * dz);
          const w_xxzz = (w[(iz + 1) * this.nx + (ix + 1)] - 2 * w[(iz + 1) * this.nx + ix] + w[(iz + 1) * this.nx + (ix - 1)] - 2 * w[iz * this.nx + (ix + 1)] + 4 * w_ij - 2 * w[iz * this.nx + (ix - 1)] + w[(iz - 1) * this.nx + (ix + 1)] - 2 * w[(iz - 1) * this.nx + ix] + w[(iz - 1) * this.nx + (ix - 1)]) / (dx * dx * dz * dz);

          const residual = this.D * (w_xxxx + 2 * w_xxzz + w_zzzz) - load[idx];
          const diag = this.D * (6 / (dx * dx * dx * dx) + 6 / (dz * dz * dz * dz) + 8 / (dx * dx * dz * dz));
          this.w[idx] -= 0.3 * residual / diag;
          this.w[idx] = Math.max(this.w[idx], -0.3); // keep physical
        }
      }
    }
  }

  getDisplacement(gridX, gridZ) {
    if (gridX < 0 || gridX >= this.nx || gridZ < 0 || gridZ >= this.nz) return 0;
    return this.w[gridZ * this.nx + gridX];
  }

  getMaxDisplacement() {
    let max = 0;
    for (let i = 0; i < this.w.length; i++) if (Math.abs(this.w[i]) > max) max = Math.abs(this.w[i]);
    return max;
  }

  getStress(gridX, gridZ) {
    // Bending stress sigma = E * (t/2) * kappa / (1-nu^2)
    if (gridX < 0 || gridX >= this.nx || gridZ < 0 || gridZ >= this.nz) return 0;
    const dx = this.Lx / (this.nx - 1);
    const idx = gridZ * this.nx + gridX;
    const w_ij = this.w[idx];

    let curvature = 0;
    if (gridX > 0 && gridX < this.nx - 1) {
      curvature = (this.w[gridZ * this.nx + (gridX + 1)] - 2 * w_ij + this.w[gridZ * this.nx + (gridX - 1)]) / (dx * dx);
    }
    return this.E * (this.thickness / 2) * Math.abs(curvature) / (1 - this.nu * this.nu) * 1e-3; // MPa
  }

  reset() {
    this.w.fill(0);
    this.temperature.fill(this.tRef);
  }
}
