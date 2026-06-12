import * as THREE from 'three';

const CATEGORIES = {};

// ── Underfill ──────────────────────────────────────────────
CATEGORIES.underfill = {
  label: 'Underfill',
  properties: [
    { key: 'viscosity', label: 'Viscosity', unit: 'mPa·s', range: [100, 800] },
    { key: 'surfaceTension', label: 'Surface Tension', unit: 'mN/m', range: [20, 50] },
    { key: 'cte1', label: 'CTE (α1)', unit: 'ppm/°C', range: [15, 50] },
    { key: 'tg', label: 'Tg', unit: '°C', range: [120, 180] },
    { key: 'cureTemp', label: 'Cure Temp', unit: '°C', range: [130, 170] },
    { key: 'cureTime', label: 'Cure Time', unit: 'min', range: [2, 15] },
    { key: 'filler', label: 'Filler', unit: '%', range: [0, 70] },
  ],
  presets: {
    UF3808: {
      viscosity: 380, surfaceTension: 35, cte1: 28, tg: 155,
      cureTemp: 150, cureTime: 5, filler: 65,
      color: '#e8842e', curedColor: '#7a4a2a', emissive: '#ff8800',
      flowOpacity: 0.75, curedOpacity: 0.88,
      flowSpeed: 0.12,
    },
    UF3810: {
      viscosity: 280, surfaceTension: 32, cte1: 32, tg: 140,
      cureTemp: 145, cureTime: 4, filler: 60,
      color: '#d47a30', curedColor: '#6e4424', emissive: '#ee7711',
      flowOpacity: 0.72, curedOpacity: 0.85,
      flowSpeed: 0.16,
    },
    FP4549: {
      viscosity: 450, surfaceTension: 38, cte1: 25, tg: 165,
      cureTemp: 155, cureTime: 6, filler: 68,
      color: '#cc7722', curedColor: '#6b3f1a', emissive: '#ff9900',
      flowOpacity: 0.78, curedOpacity: 0.90,
      flowSpeed: 0.10,
    },
    LowCTE: {
      viscosity: 500, surfaceTension: 40, cte1: 18, tg: 175,
      cureTemp: 160, cureTime: 8, filler: 70,
      color: '#b86b20', curedColor: '#5a3515', emissive: '#dd8800',
      flowOpacity: 0.70, curedOpacity: 0.92,
      flowSpeed: 0.09,
    },
    FastFlow: {
      viscosity: 180, surfaceTension: 28, cte1: 42, tg: 125,
      cureTemp: 140, cureTime: 3, filler: 50,
      color: '#f09840', curedColor: '#885a2e', emissive: '#ffaa33',
      flowOpacity: 0.68, curedOpacity: 0.82,
      flowSpeed: 0.22,
    },
  },
};

// ── Solder Paste ───────────────────────────────────────────
CATEGORIES.solderPaste = {
  label: 'Solder Paste',
  properties: [
    { key: 'viscosity', label: 'Viscosity', unit: 'Pa·s', range: [600, 1200] },
    { key: 'metalLoad', label: 'Metal Load', unit: '%', range: [85, 92] },
    { key: 'particleSize', label: 'Particle Size', unit: 'µm', range: [20, 45] },
    { key: 'fluxActivity', label: 'Flux Activity', unit: '', range: [0, 3] },
    { key: 'meltingPoint', label: 'Melting Point', unit: '°C', range: [178, 227] },
  ],
  presets: {
    SAC305: {
      viscosity: 900, metalLoad: 88.5, particleSize: 25, fluxActivity: 2,
      meltingPoint: 217, color: '#8a8a8a', emissive: '#ffaa33',
      hotColor: '#ffaa33',
    },
    SAC405: {
      viscosity: 850, metalLoad: 89, particleSize: 25, fluxActivity: 2,
      meltingPoint: 217, color: '#909090', emissive: '#ff9933',
      hotColor: '#ff9933',
    },
    SnPb63_37: {
      viscosity: 950, metalLoad: 87, particleSize: 30, fluxActivity: 1,
      meltingPoint: 183, color: '#7a7a7a', emissive: '#dd8844',
      hotColor: '#dd8844',
    },
    LeadFree_HighTemp: {
      viscosity: 1000, metalLoad: 86, particleSize: 28, fluxActivity: 2,
      meltingPoint: 227, color: '#888888', emissive: '#cc7733',
      hotColor: '#cc7733',
    },
  },
};

// ── Solder Ball (BGA) ──────────────────────────────────────
CATEGORIES.solderBall = {
  label: 'Solder Ball',
  properties: [
    { key: 'alloy', label: 'Alloy', unit: '', range: [0, 1] },
    { key: 'diameter', label: 'Diameter', unit: 'mm', range: [0.3, 0.8] },
    { key: 'standoff', label: 'Standoff', unit: 'mm', range: [0.2, 0.6] },
  ],
  presets: {
    SAC305_Ball: {
      alloy: 'SAC305', diameter: 0.45, standoff: 0.25, color: '#d0d0d0',
      emissive: '#ffaa33', meltingPoint: 217,
    },
    SAC405_Ball: {
      alloy: 'SAC405', diameter: 0.45, standoff: 0.25, color: '#c8c8c8',
      emissive: '#ff9933', meltingPoint: 217,
    },
    SnPb_Ball: {
      alloy: 'Sn63Pb37', diameter: 0.5, standoff: 0.28, color: '#b0b0b0',
      emissive: '#dd8844', meltingPoint: 183,
    },
    Micro_Ball: {
      alloy: 'SAC305', diameter: 0.3, standoff: 0.18, color: '#d5d5d5',
      emissive: '#ffaa33', meltingPoint: 217,
    },
  },
};

// ── Substrate / PCB ────────────────────────────────────────
CATEGORIES.substrate = {
  label: 'Substrate',
  properties: [
    { key: 'cte', label: 'CTE', unit: 'ppm/°C', range: [12, 60] },
    { key: 'tg', label: 'Tg', unit: '°C', range: [130, 280] },
    { key: 'modulus', label: 'Modulus', unit: 'GPa', range: [15, 30] },
    { key: 'thickness', label: 'Thickness', unit: 'mm', range: [0.8, 3.2] },
  ],
  presets: {
    FR4: {
      cte: 14, tg: 140, modulus: 24, thickness: 1.6,
      color: '#1a5c2a', solderMask: '#2d7a3e',
    },
    HDI: {
      cte: 12, tg: 180, modulus: 28, thickness: 1.0,
      color: '#1a5c2a', solderMask: '#2d7a3e',
    },
    Flex_PI: {
      cte: 20, tg: 280, modulus: 3, thickness: 0.1,
      color: '#cc8833', solderMask: '#dd9933',
    },
    Ceramic: {
      cte: 7, tg: 350, modulus: 300, thickness: 0.8,
      color: '#334455', solderMask: '#445566',
    },
    MetalCore: {
      cte: 6, tg: 200, modulus: 70, thickness: 1.6,
      color: '#555555', solderMask: '#666666',
    },
  },
};

// ── Die ─────────────────────────────────────────────────────
CATEGORIES.die = {
  label: 'Die',
  properties: [
    { key: 'cte', label: 'CTE', unit: 'ppm/°C', range: [2.6, 4.0] },
    { key: 'thickness', label: 'Thickness', unit: 'mm', range: [0.2, 0.8] },
  ],
  presets: {
    Silicon: { cte: 2.6, thickness: 0.4, color: '#475569', opacity: 0.15 },
    GaAs: { cte: 5.7, thickness: 0.3, color: '#3a3f4a', opacity: 0.12 },
    SiC: { cte: 4.0, thickness: 0.5, color: '#2a3040', opacity: 0.10 },
  },
};

// ── Encapsulant ─────────────────────────────────────────────
CATEGORIES.encapsulant = {
  label: 'Encapsulant',
  properties: [
    { key: 'viscosity', label: 'Viscosity', unit: 'mPa·s', range: [100, 600] },
    { key: 'cte1', label: 'CTE (α1)', unit: 'ppm/°C', range: [15, 45] },
    { key: 'tg', label: 'Tg', unit: '°C', range: [140, 200] },
  ],
  presets: {
    MoldCompound: {
      viscosity: 300, cte1: 12, tg: 170, color: '#1a1a2e', opacity: 0.9,
    },
    GlobTop: {
      viscosity: 450, cte1: 25, tg: 150, color: '#2a1a0e', opacity: 0.85,
    },
  },
};

// ── Adhesive (FPCA) ─────────────────────────────────────────
CATEGORIES.adhesive = {
  label: 'Adhesive',
  properties: [
    { key: 'viscosity', label: 'Viscosity', unit: 'Pa·s', range: [10, 100] },
    { key: 'cureTemp', label: 'Cure Temp', unit: '°C', range: [80, 180] },
    { key: 'cte', label: 'CTE', unit: 'ppm/°C', range: [30, 80] },
  ],
  presets: {
    ACA: {
      viscosity: 40, cureTemp: 150, cte: 50, color: '#888844', opacity: 0.6,
    },
    NCP: {
      viscosity: 25, cureTemp: 130, cte: 60, color: '#777744', opacity: 0.55,
    },
    Film: {
      viscosity: 0, cureTemp: 160, cte: 40, color: '#666633', opacity: 0.7,
    },
  },
};

// ── Stencil ─────────────────────────────────────────────────
CATEGORIES.stencil = {
  label: 'Stencil',
  properties: [
    { key: 'thickness', label: 'Thickness', unit: 'mm', range: [0.1, 0.3] },
    { key: 'material', label: 'Material', unit: '', range: [0, 2] },
  ],
  presets: {
    Stainless: { thickness: 0.15, material: 'SUS304', color: '#607080' },
    Nickel: { thickness: 0.12, material: 'Electroform Ni', color: '#8090a0' },
    Thick: { thickness: 0.25, material: 'SUS304', color: '#5a6a7a' },
  },
};

// ── API ─────────────────────────────────────────────────────

export function getCategories() {
  return Object.keys(CATEGORIES);
}

export function getCategory(cat) {
  return CATEGORIES[cat] || null;
}

export function getPresetNames(cat) {
  const c = CATEGORIES[cat];
  return c ? Object.keys(c.presets) : [];
}

export function getPreset(cat, name) {
  const c = CATEGORIES[cat];
  return c ? (c.presets[name] || null) : null;
}

export function getAllPresets(cat) {
  const c = CATEGORIES[cat];
  if (!c) return [];
  return Object.entries(c.presets).map(([key, val]) => ({
    key, label: key.replace(/_/g, ' '), ...val,
  }));
}

export function buildMaterial(cat, presetName, overrides = {}) {
  const params = getPreset(cat, presetName);
  if (!params) return null;

  const merged = { ...params, ...overrides };
  const color = new THREE.Color(merged.color);

  const mat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: overrides.roughness ?? 0.3,
    metalness: overrides.metalness ?? 0.05,
    transparent: overrides.transparent ?? (merged.opacity !== undefined && merged.opacity < 1),
    opacity: merged.opacity ?? 0.8,
    clearcoat: overrides.clearcoat ?? 0.15,
    clearcoatRoughness: overrides.clearcoatRoughness ?? 0.3,
    side: overrides.side ?? THREE.DoubleSide,
  });

  if (merged.emissive) {
    mat.emissive = new THREE.Color(merged.emissive);
    mat.emissiveIntensity = overrides.emissiveIntensity ?? 0.1;
  }

  return mat;
}

export function formatParamValue(cat, key, value) {
  const c = CATEGORIES[cat];
  if (!c) return String(value);
  const prop = c.properties.find(p => p.key === key);
  return prop ? `${value} ${prop.unit}`.trim() : String(value);
}
