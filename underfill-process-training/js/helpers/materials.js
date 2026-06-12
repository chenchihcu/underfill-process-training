import * as THREE from 'three';

// High-quality PBR materials for the simulation

export const matPCB = new THREE.MeshPhysicalMaterial({
  color: 0x1a5c2a,
  roughness: 0.65,
  metalness: 0.05,
  clearcoat: 0.15,
  clearcoatRoughness: 0.4,
});

export const matPCBSolderMask = new THREE.MeshPhysicalMaterial({
  color: 0x2d7a3e,
  roughness: 0.75,
  metalness: 0.02,
  clearcoat: 0.2,
  clearcoatRoughness: 0.3,
});

export const matCopper = new THREE.MeshPhysicalMaterial({
  color: 0xcd7f32,
  roughness: 0.3,
  metalness: 0.85,
  clearcoat: 0.1,
});

export const matGold = new THREE.MeshPhysicalMaterial({
  color: 0xffd700,
  roughness: 0.2,
  metalness: 0.9,
  clearcoat: 0.05,
  envMapIntensity: 1.5,
});

export const matSilver = new THREE.MeshPhysicalMaterial({
  color: 0xd0d0d0,
  roughness: 0.2,
  metalness: 0.9,
  clearcoat: 0.05,
  envMapIntensity: 1.8,
});

export const matComponent = new THREE.MeshPhysicalMaterial({
  color: 0x222222,
  roughness: 0.55,
  metalness: 0.15,
  clearcoat: 0.1,
  clearcoatRoughness: 0.3,
});

export const matComponentTop = new THREE.MeshPhysicalMaterial({
  color: 0x1a1a1a,
  roughness: 0.4,
  metalness: 0.05,
  clearcoat: 0.25,
  clearcoatRoughness: 0.2,
});

export const matNeedle = new THREE.MeshPhysicalMaterial({
  color: 0x8899aa,
  roughness: 0.15,
  metalness: 0.8,
  clearcoat: 0.1,
  envMapIntensity: 1.2,
});

export const matUnderfill = new THREE.MeshPhysicalMaterial({
  color: 0xe8842e,
  roughness: 0.3,
  metalness: 0.0,
  transparent: true,
  opacity: 0.75,
  clearcoat: 0.25,
  clearcoatRoughness: 0.2,
  envMapIntensity: 0.3,
  side: THREE.DoubleSide,
});

export const matUnderfillCured = new THREE.MeshPhysicalMaterial({
  color: 0x7a4a2a,
  roughness: 0.45,
  metalness: 0.0,
  transparent: true,
  opacity: 0.88,
  clearcoat: 0.35,
  clearcoatRoughness: 0.15,
  side: THREE.DoubleSide,
});

export const matFillet = new THREE.MeshPhysicalMaterial({
  color: 0xe8842e,
  roughness: 0.25,
  metalness: 0.0,
  transparent: true,
  opacity: 0.85,
  clearcoat: 0.4,
  clearcoatRoughness: 0.15,
  envMapIntensity: 0.2,
});

export const matVoid = new THREE.MeshPhysicalMaterial({
  color: 0xff4444,
  roughness: 0.3,
  metalness: 0.0,
  transparent: true,
  opacity: 0.2,
  clearcoat: 0.1,
});

export const matStencil = new THREE.MeshPhysicalMaterial({
  color: 0x607080,
  roughness: 0.25,
  metalness: 0.85,
  clearcoat: 0.1,
  envMapIntensity: 1.0,
});

export const matSolderPaste = new THREE.MeshPhysicalMaterial({
  color: 0x8a8a8a,
  roughness: 0.5,
  metalness: 0.75,
  clearcoat: 0.05,
});

export const matSqueegee = new THREE.MeshPhysicalMaterial({
  color: 0x3a3a3a,
  roughness: 0.9,
  metalness: 0.0,
  clearcoat: 0.0,
});

export const matFPC = new THREE.MeshPhysicalMaterial({
  color: 0xcc8833,
  roughness: 0.7,
  metalness: 0.0,
  clearcoat: 0.05,
  side: THREE.DoubleSide,
});

export const matStiffener = new THREE.MeshPhysicalMaterial({
  color: 0xddcc88,
  roughness: 0.6,
  metalness: 0.0,
  clearcoat: 0.1,
});

export const matCarrier = new THREE.MeshPhysicalMaterial({
  color: 0x7a7a7a,
  roughness: 0.5,
  metalness: 0.4,
  clearcoat: 0.1,
});

export const matUnderfillFlow = new THREE.MeshPhysicalMaterial({
  color: 0xe8842e,
  roughness: 0.2,
  metalness: 0.0,
  transparent: true,
  opacity: 0.6,
  clearcoat: 0.3,
  clearcoatRoughness: 0.1,
  envMapIntensity: 0.4,
  side: THREE.DoubleSide,
});

// Flow front material (brighter, glowing)
export const matFlowFront = new THREE.MeshPhysicalMaterial({
  color: 0xff9933,
  roughness: 0.1,
  metalness: 0.0,
  transparent: true,
  opacity: 0.7,
  emissive: 0xff8800,
  emissiveIntensity: 0.2,
  clearcoat: 0.2,
});

// Hot solder (during reflow)
export const matHotSolder = new THREE.MeshPhysicalMaterial({
  color: 0xffaa33,
  roughness: 0.1,
  metalness: 0.95,
  emissive: 0xff5500,
  emissiveIntensity: 0.3,
  clearcoat: 0.05,
});

// Droplet material
export const matDroplet = new THREE.MeshPhysicalMaterial({
  color: 0xe8842e,
  roughness: 0.05,
  metalness: 0.0,
  transparent: true,
  opacity: 0.8,
  clearcoat: 0.5,
  clearcoatRoughness: 0.05,
  envMapIntensity: 0.5,
});

// Stress colors for FPC bending
export function stressColor(t) {
  const c = new THREE.Color();
  if (t < 0.33) c.setHSL(0.55, 0.9, 0.4 + t * 0.6); // blue-green
  else if (t < 0.66) c.setHSL(0.3 - (t - 0.33) * 0.5, 0.9, 0.6);
  else c.setHSL(0.05, 0.9, 0.5 + (t - 0.66) * 0.3); // red
  return c;
}
