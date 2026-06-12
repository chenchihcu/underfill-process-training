import * as THREE from 'three';
import * as MAT from './materials.js';

export function createPCB(w, h, d) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), MAT.matPCB);
  body.position.y = h / 2;
  g.add(body);
  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.05, d),
    new THREE.MeshBasicMaterial({ color: 0x0a3a1a, transparent: true, opacity: 0.3 })
  );
  edge.position.y = h + 0.03;
  g.add(edge);
  return g;
}

export function createCopperTraces(w, d, count = 8) {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const t = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.7, 0.02, 0.08),
      MAT.matCopper
    );
    const row = Math.floor(i / 2);
    const col = i % 2;
    t.position.set(-w * 0.25 + col * w * 0.5, 0.02, -d * 0.3 + row * d * 0.2);
    g.add(t);
  }
  return g;
}

export function createBGAComponent(sizeX, sizeY, sizeZ, ballCountX, ballCountZ, ballR, gap) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(sizeX, sizeY, sizeZ),
    MAT.matComponent
  );
  body.position.y = gap + sizeY / 2;
  g.add(body);
  const topMark = new THREE.Mesh(
    new THREE.PlaneGeometry(sizeX * 0.5, sizeZ * 0.5),
    MAT.matComponentTop
  );
  topMark.position.y = gap + sizeY + 0.01;
  topMark.rotation.x = -Math.PI / 2;
  g.add(topMark);

  const spacingX = (sizeX * 0.7) / (ballCountX - 1 || 1);
  const spacingZ = (sizeZ * 0.7) / (ballCountZ - 1 || 1);
  const startX = -sizeX * 0.35;
  const startZ = -sizeZ * 0.35;
  for (let iz = 0; iz < ballCountZ; iz++) {
    for (let ix = 0; ix < ballCountX; ix++) {
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(ballR, 12, 12),
        MAT.matSilver
      );
      ball.position.set(startX + ix * spacingX, gap / 2, startZ + iz * spacingZ);
      g.add(ball);
    }
  }
  return g;
}

export function createNeedle(len = 3, r = 0.25, tipR = 0.08, tipLen = 0.6) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, len, 12),
    MAT.matNeedle
  );
  shaft.position.y = len / 2;
  g.add(shaft);
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(r, tipLen, 12),
    MAT.matNeedle
  );
  tip.position.y = -tipLen / 2;
  g.add(tip);
  return g;
}

export function createFilletEdge(w, gap, depth = 2, segments = 8) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(depth * 0.5, gap * 0.6, 0, gap);
  shape.lineTo(0, 0);
  const extrude = new THREE.ExtrudeGeometry(shape, {
    steps: 1, depth, bevelEnabled: false
  });
  const m = new THREE.Mesh(extrude, MAT.matFillet);
  m.position.x = -w / 2;
  return m;
}

export function createFlowParticles(count = 80) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 20;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 20;
    sizes[i] = 0.05 + Math.random() * 0.1;
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.PointsMaterial({
    color: 0xff8833, size: 0.12, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  return new THREE.Points(g, mat);
}

export function createSolderPasteDeposit(w, h, d) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), MAT.matSolderPaste);
}

export function createStencil(w, h, d, apertures) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), MAT.matStencil);
  g.add(base);
  if (apertures) {
    for (const ap of apertures) {
      const hole = new THREE.Mesh(
        new THREE.BoxGeometry(ap.w, h * 1.1, ap.d),
        new THREE.MeshBasicMaterial({ color: 0x000000 })
      );
      hole.position.set(ap.x, 0, ap.z);
      g.add(hole);
    }
  }
  return g;
}

export function createFPC(w, h, d, bendAmount = 0) {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(w, h, d);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const bend = bendAmount * Math.sin((z / d + 0.5) * Math.PI);
    pos.setY(i, pos.getY(i) + bend);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, MAT.matFPC);
  g.add(mesh);
  return g;
}

export function createReflowJoints(count, spread, gap) {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const joint = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.25, gap * 0.6, 8),
      MAT.matSilver
    );
    joint.position.set(
      (Math.random() - 0.5) * spread,
      0,
      (Math.random() - 0.5) * spread
    );
    g.add(joint);
  }
  return g;
}
