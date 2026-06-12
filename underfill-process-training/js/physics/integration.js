import * as THREE from 'three';

export function createParticleSystem(maxParticles) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(maxParticles * 3);
  const col = new Float32Array(maxParticles * 3);
  const sizes = new Float32Array(maxParticles);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geo.setDrawRange(0, 0);

  const mat = new THREE.PointsMaterial({
    size: 0.1,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  return new THREE.Points(geo, mat);
}

export function updateParticleSystem(points, solver) {
  const data = solver.getParticleData();
  const pos = points.geometry.attributes.position.array;
  const col = points.geometry.attributes.color.array;
  const sizes = points.geometry.attributes.size.array;
  for (let i = 0; i < data.count; i++) {
    const ix = i * 3;
    pos[ix] = data.positions[ix];
    pos[ix + 1] = data.positions[ix + 1];
    pos[ix + 2] = data.positions[ix + 2];
    col[ix] = data.colors[ix];
    col[ix + 1] = data.colors[ix + 1];
    col[ix + 2] = data.colors[ix + 2];
    sizes[i] = data.sizes[i];
  }
  points.geometry.attributes.position.needsUpdate = true;
  points.geometry.attributes.color.needsUpdate = true;
  points.geometry.attributes.size.needsUpdate = true;
  points.geometry.setDrawRange(0, data.count);
}

export function createObstacles(ballPositions, ballRadius) {
  const geo = new THREE.SphereGeometry(ballRadius, 12, 12);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xd0d0d0, roughness: 0.15, metalness: 0.9,
    envMapIntensity: 1.0,
  });
  const group = new THREE.Group();
  for (const bp of ballPositions) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(bp.x, 0, bp.z);
    mesh.scale.y = 0.85;
    group.add(mesh);
  }
  return group;
}

export function buildObstacleList(ballPositions, ballRadius) {
  return ballPositions.map(bp => ({ x: bp.x, z: bp.z, r: ballRadius }));
}
