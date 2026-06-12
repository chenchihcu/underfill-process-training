import * as THREE from 'three';
import * as SCENE from '../scene.js';
import { createControlPanel, setStatus } from '../ui.js';
import { matUnderfill, matUnderfillCured, matFillet, matDroplet, matSilver, matGold } from '../helpers/materials.js';
import * as MATDB from '../data/materials.js';
import * as Analytics from '../data/analytics.js';
import { SPHSolver } from '../physics/sph-2d.js';
import { createParticleSystem, updateParticleSystem, buildObstacleList } from '../physics/integration.js';

const PCB_W = 50, PCB_D = 50, PCB_H = 1.5;
const COMP_W = 18, COMP_D = 18, COMP_H = 2;
const GAP = 0.5;
const BALL_R = 0.35;
const BALLS_X = 6, BALLS_Z = 6;
const NEEDLE_LEN = 4, NEEDLE_R = 0.25;
const PATH_OFFSET = 2.5;
const SPH_PARTICLES = 800;

const PATHS = {
  I: {
    label: 'I-Type (Single Edge)',
    waypoints2D: [[-7, -(COMP_D/2 + PATH_OFFSET)], [7, -(COMP_D/2 + PATH_OFFSET)]],
  },
  L: {
    label: 'L-Type (Two Edges)',
    waypoints2D: [
      [-7, -(COMP_D/2 + PATH_OFFSET)],
      [7, -(COMP_D/2 + PATH_OFFSET)],
      [COMP_W/2 + PATH_OFFSET, -7],
      [COMP_W/2 + PATH_OFFSET, 7],
    ],
  },
  U: {
    label: 'U-Type (Three Edges)',
    waypoints2D: [
      [-7, -(COMP_D/2 + PATH_OFFSET)],
      [7, -(COMP_D/2 + PATH_OFFSET)],
      [COMP_W/2 + PATH_OFFSET, -7],
      [COMP_W/2 + PATH_OFFSET, 7],
      [7, COMP_D/2 + PATH_OFFSET],
      [-7, COMP_D/2 + PATH_OFFSET],
    ],
  },
};

export class UnderfillModule {
  constructor() {
    this.group = new THREE.Group();
    this.needleGroup = new THREE.Group();
    this.needle = null;
    this.sphSolver = null;
    this.sphParticles = null;
    this.particles = null;
    this.fillets = [];
    this.voidGroup = new THREE.Group();
    this.droplet = null;
    this.crossSection = null;

    this.pathKey = 'L';
    this.playing = false;
    this.speed = 1;
    this.progress = 0;
    this.pressure = 0.25;
    this.temp = 80;
    this.needleHeight = 0.3;
    this.showCrossSection = false;
    this.showXRay = false;

    this.segLens = [];
    this.totalPathLen = 0;
    this._voidsGenerated = false;
    this._materialPresetName = 'UF3808';
  }

  create() {
    SCENE.addToScene(this.group);
    this._buildPCB();
    this._buildBGA();
    this._buildNeedle();
    this._initSolver();
    this._buildSPHParticles();
    this._buildDroplet();
    this._buildParticles();
    this._buildVoids();
    this._buildCrossSection();
    this._buildFloor();
    this._computePathLengths();
    this._injectParticles();
    this._buildUI();

    this._applyMaterialPreset(this._materialPresetName);
    this.progress = 0;
    this._updateScene(0);
  }

  _buildPCB() {
    const g = new THREE.Group();

    // PCB body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(PCB_W, PCB_H, PCB_D),
      new THREE.MeshPhysicalMaterial({
        color: 0x1a5c2a, roughness: 0.6, metalness: 0.05,
        clearcoat: 0.2, clearcoatRoughness: 0.3,
      })
    );
    body.position.y = PCB_H / 2;
    g.add(body);

    // PCB edge bevel
    const bevel = new THREE.Mesh(
      new THREE.BoxGeometry(PCB_W, 0.04, PCB_D),
      new THREE.MeshPhysicalMaterial({
        color: 0x0d3a1a, roughness: 1.0, metalness: 0,
        transparent: true, opacity: 0.15,
      })
    );
    bevel.position.y = PCB_H + 0.02;
    g.add(bevel);

    // Copper traces on surface
    const traceMat = new THREE.MeshPhysicalMaterial({
      color: 0xcd7f32, roughness: 0.3, metalness: 0.85,
    });
    for (let i = 0; i < 12; i++) {
      const trace = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.015, PCB_D * 0.6 + Math.random() * PCB_D * 0.3),
        traceMat
      );
      trace.position.set(
        -PCB_W * 0.35 + i * (PCB_W * 0.6 / 11),
        PCB_H + 0.008,
        (Math.random() - 0.5) * PCB_D * 0.3
      );
      trace.rotation.y = (Math.random() - 0.5) * 0.1;
      g.add(trace);
    }

    // Horizontal traces
    for (let i = 0; i < 8; i++) {
      const trace = new THREE.Mesh(
        new THREE.BoxGeometry(PCB_W * 0.5, 0.015, 0.08),
        traceMat
      );
      trace.position.set(
        (Math.random() - 0.5) * PCB_W * 0.4,
        PCB_H + 0.008,
        -PCB_D * 0.3 + i * (PCB_D * 0.5 / 7)
      );
      g.add(trace);
    }

    g.position.y = 0;
    this.group.add(g);
  }

  _buildBGA() {
    const g = new THREE.Group();
    const bgaMat = new THREE.MeshPhysicalMaterial({
      color: 0x222222, roughness: 0.5, metalness: 0.15, clearcoat: 0.1,
    });

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(COMP_W, COMP_H, COMP_D), bgaMat);
    body.position.y = GAP + COMP_H / 2;
    g.add(body);

    // Top marking
    const topMat = new THREE.MeshPhysicalMaterial({
      color: 0x1a1a1a, roughness: 0.35, metalness: 0.05, clearcoat: 0.3, clearcoatRoughness: 0.15,
    });
    const top = new THREE.Mesh(new THREE.PlaneGeometry(COMP_W * 0.4, COMP_D * 0.4), topMat);
    top.position.y = GAP + COMP_H + 0.01;
    top.rotation.x = -Math.PI / 2;
    g.add(top);

    // Pin 1 dot
    const dotMat = new THREE.MeshPhysicalMaterial({
      color: 0xffd700, roughness: 0.3, metalness: 0.8,
    });
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), dotMat);
    dot.position.set(-COMP_W * 0.35, GAP + COMP_H + 0.012, -COMP_D * 0.35);
    dot.rotation.x = -Math.PI / 2;
    g.add(dot);

    // Solder balls with reflections
    const ballMat = new THREE.MeshPhysicalMaterial({
      color: 0xd0d0d0, roughness: 0.15, metalness: 0.9,
      clearcoat: 0.05, envMapIntensity: 1.5,
    });
    const spacingX = (COMP_W * 0.7) / (BALLS_X - 1);
    const spacingZ = (COMP_D * 0.7) / (BALLS_Z - 1);
    const startX = -COMP_W * 0.35;
    const startZ = -COMP_D * 0.35;

    for (let iz = 0; iz < BALLS_Z; iz++) {
      for (let ix = 0; ix < BALLS_X; ix++) {
        // Skip center 4 balls for thermal relief pattern
        if (iz >= 2 && iz <= 3 && ix >= 2 && ix <= 3) continue;

        const ball = new THREE.Mesh(
          new THREE.SphereGeometry(BALL_R, 16, 16),
          ballMat
        );
        ball.position.set(
          startX + ix * spacingX,
          GAP / 2,
          startZ + iz * spacingZ
        );
        // Slightly flatten (real BGA balls are slightly compressed)
        ball.scale.y = 0.85;
        g.add(ball);
      }
    }

    g.position.set(0, PCB_H, 0);
    this.group.add(g);
  }

  _computeDistances(pathType, positions) {
    const minX = -COMP_W * 0.46;
    const maxX = COMP_W * 0.46;
    const minZ = -COMP_D * 0.46;
    const maxZ = COMP_D * 0.46;

    return positions.map(v => {
      let dist;
      if (pathType === 'I') {
        dist = (v.z - minZ) / (maxZ - minZ);
      } else if (pathType === 'L') {
        const dz = (v.z - minZ) / (maxZ - minZ);
        const dx = (maxX - v.x) / (maxX - minX);
        dist = Math.min(dz, dx);
      } else {
        const dzB = (v.z - minZ) / (maxZ - minZ);
        const dxL = (v.x - minX) / (maxX - minX);
        const dxR = (maxX - v.x) / (maxX - minX);
        dist = Math.min(dzB, dxL, dxR);
      }
      return Math.max(0, Math.min(1, dist));
    });
  }

  _buildFlowMesh() {
    const segs = GRID_SEGMENTS;
    const w = COMP_W * 0.92;
    const d = COMP_D * 0.92;
    const hw = w / 2, hd = d / 2;

    // Build geometry with distance attribute
    const geo = new THREE.BufferGeometry();
    const positions = [];
    const distances = [];
    const indices = [];
    const uvs = [];

    for (let iz = 0; iz <= segs; iz++) {
      for (let ix = 0; ix <= segs; ix++) {
        const x = -hw + (ix / segs) * w;
        const z = -hd + (iz / segs) * d;
        positions.push(x, 0, z);
        distances.push(0); // placeholder, computed below
        uvs.push(ix / segs, iz / segs);
      }
    }

    for (let iz = 0; iz < segs; iz++) {
      for (let ix = 0; ix < segs; ix++) {
        const a = iz * (segs + 1) + ix;
        const b = a + 1;
        const c = (iz + 1) * (segs + 1) + ix;
        const d2 = c + 1;
        indices.push(a, c, b, b, c, d2);
      }
    }

    geo.setIndex(indices);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

    const posArr = geo.attributes.position.array;
    const posVecs = [];
    for (let i = 0; i < posArr.length; i += 3) {
      posVecs.push({ x: posArr[i], z: posArr[i+2] });
    }
    const dists = this._computeDistances(this.pathKey, posVecs);
    geo.setAttribute('aDistance', new THREE.Float32BufferAttribute(dists, 1));

    this.flowUniforms = {
      uProgress: { value: 0 },
      uMeniscusWidth: { value: 0.08 },
      uColorSource: { value: new THREE.Color(0xd4702a) },
      uColorFront: { value: new THREE.Color(0xff8833) },
      uColorEmpty: { value: new THREE.Color(0x1a2530) },
      uOpacity: { value: 0.75 },
      uTime: { value: 0 },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.flowUniforms,
      vertexShader: flowVertShader,
      fragmentShader: flowFragShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
    });

    this.flowMesh = new THREE.Mesh(geo, mat);
    this.flowMesh.position.set(0, PCB_H + GAP * 0.05, 0);
    this.group.add(this.flowMesh);
  }

  _buildDroplet() {
    // Small droplet at needle tip
    this.droplet = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 12),
      matDroplet.clone()
    );
    this.droplet.visible = false;
    this.droplet.position.set(0, 0, 0);
    this.group.add(this.droplet);
  }

  _buildParticles() {
    const count = 120;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i*3] = (Math.random() - 0.5) * COMP_W;
      pos[i*3+1] = (Math.random() - 0.5) * GAP * 0.6;
      pos[i*3+2] = (Math.random() - 0.5) * COMP_D;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xff9933,
      size: 0.06,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.particles = new THREE.Points(geo, mat);
    this.particles.position.set(0, PCB_H + GAP * 0.1, 0);
    this.group.add(this.particles);
  }

  _buildVoids() {
    this.voidGroup = new THREE.Group();
    this.group.add(this.voidGroup);
  }

  _buildCrossSection() {
    // Semi-transparent cross-section plane
    const planeMat = new THREE.MeshPhysicalMaterial({
      color: 0x4488ff,
      roughness: 0.3,
      metalness: 0.0,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(PCB_W * 1.2, PCB_H + GAP + COMP_H + 4),
      planeMat
    );
    plane.position.set(0, PCB_H + GAP / 2, 0);
    plane.rotation.y = 0;
    plane.visible = false;
    plane.userData.isCrossSection = true;
    this.crossSection = plane;
    this.group.add(plane);

    // Section line
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.3,
    });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -2, -PCB_D * 0.8),
      new THREE.Vector3(0, PCB_H + GAP + COMP_H + 3, -PCB_D * 0.8),
    ]);
    const line = new THREE.Line(lineGeo, lineMat);
    line.userData.isCrossSection = true;
    line.visible = false;
    this.group.add(line);
  }

  _buildFloor() {
    // Subtle reflective floor disk
    const floorMat = new THREE.MeshPhysicalMaterial({
      color: 0x0a1220,
      roughness: 0.8,
      metalness: 0.0,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(35, 32),
      floorMat
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.5;
    this.group.add(floor);
  }

  _initSolver() {
    const hw = COMP_W * 0.46, hd = COMP_D * 0.46;
    // Build obstacle list from BGA balls
    const spacingX = (COMP_W * 0.7) / (BALLS_X - 1);
    const spacingZ = (COMP_D * 0.7) / (BALLS_Z - 1);
    const startX = -COMP_W * 0.35;
    const startZ = -COMP_D * 0.35;
    const obstacles = [];
    for (let iz = 0; iz < BALLS_Z; iz++) {
      for (let ix = 0; ix < BALLS_X; ix++) {
        if (iz >= 2 && iz <= 3 && ix >= 2 && ix <= 3) continue;
        obstacles.push({ x: startX + ix * spacingX, z: startZ + iz * spacingZ });
      }
    }

    this.sphSolver = new SPHSolver({
      h: 0.5,
      restDensity: 1.0,
      stiffness: 8.0,
      viscosity: 0.6,
      capillaryForce: 2.5,
      maxParticles: SPH_PARTICLES,
      bounds: { xMin: -hw, xMax: hw, zMin: -hd, zMax: hd },
      obstacles: buildObstacleList(obstacles, BALL_R * 0.85),
    });
  }

  _buildSPHParticles() {
    this.sphParticles = createParticleSystem(SPH_PARTICLES);
    this.sphParticles.position.set(0, PCB_H + GAP * 0.05, 0);
    this.group.add(this.sphParticles);
  }

  _buildNeedle() {
    this.needle = new THREE.Group();
    const needleMat = new THREE.MeshPhysicalMaterial({
      color: 0x8899aa, roughness: 0.12, metalness: 0.85,
      clearcoat: 0.1, envMapIntensity: 1.2,
    });

    // Shaft
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(NEEDLE_R, NEEDLE_R, NEEDLE_LEN, 16),
      needleMat
    );
    shaft.position.y = NEEDLE_LEN / 2;
    this.needle.add(shaft);

    // Tip
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(NEEDLE_R, 0.5, 16),
      needleMat
    );
    tip.position.y = -0.25;
    this.needle.add(tip);

    // Threaded collar detail
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(NEEDLE_R * 1.5, 0.06, 8, 16),
      new THREE.MeshPhysicalMaterial({
        color: 0x667788, roughness: 0.3, metalness: 0.7,
      })
    );
    collar.position.y = 1.5;
    collar.rotation.x = Math.PI / 2;
    this.needle.add(collar);

    // Tip glow
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 8),
      new THREE.MeshBasicMaterial({
        color: 0xff6633,
        transparent: true,
        opacity: 0.6,
      })
    );
    glow.position.y = -NEEDLE_LEN - 0.15;
    this.needle.add(glow);

    this.needleGroup.add(this.needle);
    this.needleGroup.position.set(0, NEEDLE_LEN + 18, 0);
    this.group.add(this.needleGroup);
  }

  _computePathLengths() {
    const wp = PATHS[this.pathKey].waypoints2D;
    this.segLens = [];
    let total = 0;
    for (let i = 1; i < wp.length; i++) {
      const dx = wp[i][0] - wp[i-1][0];
      const dz = wp[i][1] - wp[i-1][1];
      const len = Math.sqrt(dx*dx + dz*dz);
      this.segLens.push(len);
      total += len;
    }
    this.totalPathLen = total;
  }

  _applyMaterialPreset(name) {
    this._materialPresetName = name;
    const p = MATDB.getPreset('underfill', name);
    if (!p) return;

    this.fillets.forEach(f => {
      if (f.material) f.material.color.set(p.color);
    });
  }

  _injectParticles() {
    if (!this.sphSolver) return;
    this.sphSolver.reset();
    const hw = COMP_W * 0.46, hd = COMP_D * 0.46;
    // Seed particles along dispensing edge(s) based on path type
    const spacing = 0.35;
    switch (this.pathKey) {
      case 'I':
        this.sphSolver.addRectGrid(-hw * 0.8, hw * 0.8, -hd, -hd + spacing * 3, spacing);
        break;
      case 'L':
        this.sphSolver.addRectGrid(-hw * 0.8, hw * 0.8, -hd, -hd + spacing * 3, spacing);
        this.sphSolver.addRectGrid(hw - spacing * 3, hw, -hd * 0.8, hd * 0.8, spacing);
        break;
      case 'U':
        this.sphSolver.addRectGrid(-hw * 0.8, hw * 0.8, -hd, -hd + spacing * 3, spacing);
        this.sphSolver.addRectGrid(hw - spacing * 3, hw, -hd * 0.8, hd * 0.8, spacing);
        this.sphSolver.addRectGrid(-hw * 0.8, hw * 0.8, hd - spacing * 3, hd, spacing);
        break;
    }
  }

  _getPathPosition(t) {
    const wp = PATHS[this.pathKey].waypoints2D;
    if (t <= 0) return { x: wp[0][0], z: wp[0][1], segIdx: 0 };
    if (t >= 1) return { x: wp[wp.length-1][0], z: wp[wp.length-1][1], segIdx: this.segLens.length - 1 };

    const dist = t * this.totalPathLen;
    let acc = 0;
    for (let i = 0; i < this.segLens.length; i++) {
      if (acc + this.segLens[i] >= dist) {
        const localT = (dist - acc) / this.segLens[i];
        const x = wp[i][0] + (wp[i+1][0] - wp[i][0]) * localT;
        const z = wp[i][1] + (wp[i+1][1] - wp[i][1]) * localT;
        return { x, z, segIdx: i, localT };
      }
      acc += this.segLens[i];
    }
    return { x: wp[wp.length-1][0], z: wp[wp.length-1][1], segIdx: this.segLens.length - 1 };
  }

  _rebuildFlowDistances() {
    if (!this.flowMesh) return;
    const posArr = this.flowMesh.geometry.attributes.position.array;
    const posVecs = [];
    for (let i = 0; i < posArr.length; i += 3) {
      posVecs.push({ x: posArr[i], z: posArr[i+2] });
    }
    const dists = this._computeDistances(this.pathKey, posVecs);
    this.flowMesh.geometry.attributes.aDistance.array.set(dists);
    this.flowMesh.geometry.attributes.aDistance.needsUpdate = true;
  }

  _buildUI() {
    const panel = document.getElementById('controlsContent');
    const underfillPresets = MATDB.getAllPresets('underfill');
    createControlPanel(panel, {
      groups: [{
        title: 'Material',
        items: [{
          type: 'material',
          category: 'underfill',
          _db: MATDB,
          label: 'Underfill',
          key: 'mat',
          presets: underfillPresets,
          value: this._materialPresetName,
          showParams: true,
          onChange: (val) => { this._applyMaterialPreset(val); },
        }]
      }, {
        title: 'Playback',
        items: [{
          type: 'buttons',
          buttons: [
            { label: '\u25B6', style: 'primary', key: 'play', onClick: () => {
              this.playing = !this.playing;
              this._refreshBtn('play', this.playing ? '\u23F8' : '\u25B6');
              if (this.playing && this.progress >= 1) { this.progress = 0; this._updateScene(0); }
              setStatus(this.playing ? 'Running' : 'Paused', '');
            }},
            { label: '\u23F9', key: 'reset', onClick: () => {
              this.playing = false; this.progress = 0;
              if (this.sphSolver) { this.sphSolver.reset(); this._injectParticles(); }
              this._updateScene(0);
              this._refreshBtn('play', '\u25B6');
              this._voidsGenerated = false;
              setStatus('Reset', '');
            }},
          ]
        }, {
          type: 'slider', label: 'Speed', key: 'speed', min: 0.1, max: 4, step: 0.1, value: 1, unit: '\u00D7',
          onChange: v => { this.speed = v; },
        }]
      }, {
        title: 'Process',
        items: [{
          type: 'select', label: 'Path', key: 'path',
          options: [
            { value: 'I', label: 'I-Type (Single Edge)' },
            { value: 'L', label: 'L-Type (Two Edges)' },
            { value: 'U', label: 'U-Type (Three Edges)' },
          ],
          value: 'L',
          onChange: v => {
            this.pathKey = v;
            this._computePathLengths();
            this.progress = 0;
            this._injectParticles();
            this._updateScene(0);
          },
        }, {
          type: 'slider', label: 'Pressure', key: 'pressure', min: 0.1, max: 0.5, step: 0.01, value: 0.25, unit: 'MPa',
          onChange: v => { this.pressure = v; this._updateHUD(); },
        }, {
          type: 'slider', label: 'Preheat', key: 'temp', min: 60, max: 110, step: 1, value: 80, unit: '\u00B0C',
          onChange: v => { this.temp = v; this._updateHUD(); },
        }, {
          type: 'slider', label: 'Height', key: 'needleH', min: 0.1, max: 0.8, step: 0.05, value: 0.3, unit: 'mm',
          onChange: v => { this.needleHeight = v; },
        }]
      }, {
        title: 'View',
        items: [{
          type: 'buttons',
          buttons: [
            { label: 'Top', onClick: () => SCENE.setCameraPreset('top', true) },
            { label: 'Side', onClick: () => SCENE.setCameraPreset('side', true) },
            { label: '45\u00B0', onClick: () => SCENE.setCameraPreset('angle', true) },
            { label: 'Close', onClick: () => SCENE.setCameraPreset('close', true) },
            { label: 'Slice', onClick: () => {
              this.showCrossSection = !this.showCrossSection;
              if (this.crossSection) this.crossSection.visible = this.showCrossSection;
              this._refreshBtnActive('slice', this.showCrossSection);
              if (this.showCrossSection) SCENE.setCameraPreset('cross', true);
            }},
          ]
        }, {
          type: 'legend',
          entries: [
            { color: '#e8842e', label: 'Underfill' },
            { color: '#ff9933', label: 'Flow Front' },
            { color: '#d0d0d0', label: 'Solder Ball' },
            { color: '#ff4444', label: 'Void' },
            { color: '#4488ff', label: 'Section' },
          ]
        }]
      }]
    });
  }

  _refreshBtn(key, label) {
    const btn = document.querySelector(`.btn[data-key="${key}"]`);
    if (btn) btn.textContent = label;
  }

  _refreshBtnActive(key, active) {
    const btns = document.querySelectorAll('.btn');
    btns.forEach(b => {
      if (b.textContent === 'Slice') b.classList.toggle('active', active);
    });
  }

  _updateHUD() {
    const t = document.getElementById('hudTemp');
    const p = document.getElementById('hudPressure');
    if (t) t.textContent = `${this.temp.toFixed(0)}\u00B0C`;
    if (p) p.textContent = `${this.pressure.toFixed(2)} MPa`;
  }

  update(dt, time) {
    if (!this.playing) return;

    this.progress += dt * 0.12 * this.speed;
    if (this.progress >= 1) {
      this.progress = 1;
      this.playing = false;
      this._refreshBtn('play', '\u25B6');
      setStatus('Complete', 'Underfill process finished');
      SCENE.setBloomStrength(0.05);
    }
    this._updateScene(this.progress);
    Analytics.push('Underfill Dispensing', {
      temp: this.temp,
      pressure: this.pressure,
      progress: this.progress,
    });

    // Step SPH solver during dispensing + capillary flow phases
    if (this.progress > 0.08 && this.progress < 1 && this.sphSolver) {
      const simDt = dt * this.speed * 1.5;
      this.sphSolver.step(simDt);
      updateParticleSystem(this.sphParticles, this.sphSolver);
    }
  }

  _updateScene(t) {
    t = Math.max(0, Math.min(t, 1));

    const descendT = 0.10;
    const dispenseStart = descendT;
    const dispenseEnd = 0.70;
    const fillEnd = 0.85;
    const filletEnd = 0.94;
    const cureEnd = 1.0;

    this._updateNeedle(t, descendT, dispenseStart, dispenseEnd);
    this._updateSPH(t, dispenseStart, dispenseEnd);
    this._updateDroplet(t, dispenseStart, dispenseEnd);
    this._updateParticles(t, dispenseStart, dispenseEnd);
    this._updateVoids(t, dispenseStart, dispenseEnd);
    this._updateFillets(t, fillEnd, filletEnd);
    this._updateColor(t, filletEnd, cureEnd);
    this._updateHUD();
    this._updateBloom(t, dispenseStart, dispenseEnd, cureEnd);
    this._updateStatus(t);
  }

  _updateNeedle(t, descendT, dispenseStart, dispenseEnd) {
    const h = this.needleHeight;
    const approachY = this.needleGroup.position.y || 22;
    const descendY = PCB_H + GAP + COMP_H + 1.5;
    const dispenseY = PCB_H + h + 0.1;

    let posY, posX, posZ;

    if (t < descendT) {
      const lt = t / descendT;
      const ease = lt < 0.5 ? 2 * lt * lt : 1 - Math.pow(-2 * lt + 2, 2) / 2;
      posY = approachY + (descendY - approachY) * ease;
      const wp = PATHS[this.pathKey].waypoints2D;
      posX = wp[0][0];
      posZ = wp[0][1];
      // Subtle vibration during descent
      posX += Math.sin(t * 120) * 0.02;
    } else if (t < dispenseEnd) {
      const lt = (t - descendT) / (dispenseEnd - descendT);
      const ease = lt < 0.5 ? 2 * lt * lt : 1 - Math.pow(-2 * lt + 2, 2) / 2;
      posY = descendY + (dispenseY - descendY) * Math.min(ease * 2.5, 1);
      const pathPos = this._getPathPosition(Math.min(ease, 1));
      posX = pathPos.x;
      posZ = pathPos.z;
      // Subtle vibration during dispensing
      posX += Math.sin(t * 200 + 1) * 0.015;
      posZ += Math.sin(t * 180 + 2) * 0.015;
    } else {
      const lastWp = PATHS[this.pathKey].waypoints2D;
      const last = lastWp[lastWp.length - 1];
      posX = last[0];
      posZ = last[1];
      const retract = (t - dispenseEnd) / (1 - dispenseEnd);
      const ease = 1 - Math.pow(1 - Math.min(retract * 2, 1), 2);
      posY = dispenseY + (approachY - dispenseY) * ease;
    }

    this.needleGroup.position.set(posX, posY, posZ);
  }

  _updateSPH(t, dispenseStart, dispenseEnd) {
    if (!this.sphSolver || !this.sphParticles) return;
    // Inject particles during dispensing phase
    if (t > dispenseStart && t < dispenseEnd && this.sphSolver.count < SPH_PARTICLES * 0.8) {
      const rate = 3;
      for (let i = 0; i < rate; i++) {
        const hw = COMP_W * 0.46, hd = COMP_D * 0.46;
        if (this.pathKey === 'I') {
          this.sphSolver.addParticle((Math.random() - 0.5) * hw * 1.6, -hd + Math.random() * 0.3);
        } else if (this.pathKey === 'L') {
          this.sphSolver.addParticle(
            -hw + Math.random() * (hw * 2),
            -hd + Math.random() * 0.3
          );
        } else {
          this.sphSolver.addParticle(
            -hw + Math.random() * (hw * 2),
            -hd + Math.random() * 0.3
          );
          this.sphSolver.addParticle(
            hw - 0.6 + Math.random() * 0.3,
            -hd * 0.8 + Math.random() * hd * 1.6
          );
        }
      }
    }
    // Visibility
    this.sphParticles.visible = t > dispenseStart - 0.02 && t < 0.95;
  }

  _updateDroplet(t, dispenseStart, dispenseEnd) {
    if (!this.droplet) return;
    const active = t > dispenseStart && t < dispenseEnd;
    this.droplet.visible = active;

    if (active) {
      const lt = (t - dispenseStart) / (dispenseEnd - dispenseStart);
      const wobble = Math.sin(lt * 30) * 0.02;
      const scale = 0.6 + Math.sin(lt * 20) * 0.15;

      this.droplet.position.copy(this.needleGroup.position);
      this.droplet.position.y -= NEEDLE_LEN + 0.5;
      this.droplet.position.x += wobble;
      this.droplet.scale.setScalar(scale);
    }
  }

  _updateParticles(t, dispenseStart, dispenseEnd) {
    if (!this.particles) return;
    const active = t > dispenseStart && t < dispenseEnd + 0.15;
    this.particles.visible = active;
    if (!active) return;

    const flowT = (t - dispenseStart) / (dispenseEnd - dispenseStart);
    const spread = Math.min(flowT * 1.3, 1);
    const pos = this.particles.geometry.attributes.position.array;
    const hw = COMP_W * 0.4 * spread;
    const hd = COMP_D * 0.4 * spread;

    for (let i = 0; i < pos.length / 3; i++) {
      const idx = i * 3;
      if (this.pathKey === 'I') {
        pos[idx] = (Math.random() - 0.5) * hw * 1.6;
        pos[idx+2] = -hd + Math.random() * hd * 2 * spread;
      } else if (this.pathKey === 'L') {
        pos[idx] = -hw + Math.random() * hw * 2 * spread;
        pos[idx+2] = -hd + Math.random() * hd * 2 * spread;
      } else {
        pos[idx] = (Math.random() - 0.5) * hw * 2 * spread;
        pos[idx+2] = (Math.random() - 0.5) * hd * 2 * spread;
      }
      pos[idx+1] = (Math.random() - 0.5) * GAP * 0.5;
    }
    this.particles.geometry.attributes.position.needsUpdate = true;
    this.particles.material.opacity = 0.3 + 0.3 * (1 - flowT);
    this.particles.material.size = 0.04 + 0.04 * (1 - flowT);
  }

  _updateVoids(t, dispenseStart, dispenseEnd) {
    const show = t > dispenseStart + 0.2;
    this.voidGroup.visible = show;

    if (show && !this._voidsGenerated) {
      this._voidsGenerated = true;
      const voidMat = new THREE.MeshPhysicalMaterial({
        color: 0xff4444, roughness: 0.3, metalness: 0,
        transparent: true, opacity: 0.18, clearcoat: 0.1,
      });
      const chainMat = new THREE.MeshPhysicalMaterial({
        color: 0xff6644, transparent: true, opacity: 0.15,
      });

      const count = this.pressure > 0.3 ? 8 : this.temp < 75 ? 6 : 3;
      for (let i = 0; i < count; i++) {
        const r = 0.06 + Math.random() * 0.18;
        const v = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 10), voidMat);
        const angle = Math.random() * Math.PI * 2;
        const dist = 2 + Math.random() * (COMP_W * 0.3);
        v.position.set(
          Math.cos(angle) * dist,
          PCB_H + GAP * 0.15 + Math.random() * GAP * 0.7,
          Math.sin(angle) * dist
        );
        this.voidGroup.add(v);
      }

      // Flow convergence voids (chain along flow path)
      if (this.pressure > 0.32 || this.temp < 78) {
        for (let i = 0; i < 4; i++) {
          const c = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), chainMat);
          c.position.set(
            -2 + i * 1.4 + (Math.random() - 0.5) * 0.5,
            PCB_H + GAP * 0.2 + Math.random() * GAP * 0.6,
            (Math.random() - 0.5) * 3
          );
          this.voidGroup.add(c);
        }
      }
    }
  }

  _updateFillets(t, fillEnd, filletEnd) {
    if (t > fillEnd && this.fillets.length === 0) {
      const fm = matFillet.clone();
      const d = COMP_W / 2, g = GAP;

      for (const s of ['bottom', 'right', 'top', 'left']) {
        let px, py, pz, rotY = 0;
        if (s === 'bottom') { px = 0; py = PCB_H; pz = -d; }
        else if (s === 'right') { px = d; py = PCB_H; pz = 0; rotY = Math.PI / 2; }
        else if (s === 'top') { px = 0; py = PCB_H; pz = d; rotY = Math.PI; }
        else { px = -d; py = PCB_H; pz = 0; rotY = -Math.PI / 2; }

        const w = (s === 'bottom' || s === 'top') ? COMP_W * 0.85 : g * 0.6;
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(w, g * 0.7, (s === 'left' || s === 'right') ? COMP_D * 0.85 : g * 0.6),
          fm
        );
        mesh.position.set(px, py + g * 0.15, pz);
        mesh.rotation.y = rotY;
        this.group.add(mesh);
        this.fillets.push(mesh);
      }
    }

    for (const f of this.fillets) {
      if (t < fillEnd) { f.visible = false; continue; }
      f.visible = true;
      const ft = Math.min((t - fillEnd) / (filletEnd - fillEnd), 1);
      const eased = ft < 0.5 ? 2 * ft * ft : -1 + (4 - 2 * ft) * ft;
      f.scale.set(eased, eased, eased);
    }
  }

  _updateColor(t, filletEnd, cureEnd) {
    // Color transition handled during cure via fillet materials
    if (t < filletEnd) return;
    const ct = Math.min((t - filletEnd) / (cureEnd - filletEnd), 1);
    const ease = ct < 0.5 ? 2 * ct * ct : -1 + (4 - 2 * ct) * ct;

    this.fillets.forEach(f => {
      if (f.material) {
        f.material.color.lerp(new THREE.Color(0x7a4a2a), ease * 0.4);
      }
    });

    // Dim particle emissive during cure
    if (this.sphParticles) {
      this.sphParticles.material.opacity = 0.85 - ease * 0.3;
    }
  }

  _updateBloom(t, dispenseStart, dispenseEnd, cureEnd) {
    if (t < dispenseStart) SCENE.setBloomStrength(0.05);
    else if (t < dispenseEnd) SCENE.setBloomStrength(0.12 + 0.08 * Math.sin(t * 10));
    else if (t < cureEnd) SCENE.setBloomStrength(0.08);
    else SCENE.setBloomStrength(0.05);
  }

  _updateStatus(t) {
    if (t === 0) setStatus('Ready', 'Press \u25B6 to start');
    else if (t < 0.10) setStatus('Descending', 'Needle approaching PCB');
    else if (t < 0.70) setStatus(`Dispensing (${this.pathKey}-Type)`,
      `Press: ${this.pressure.toFixed(2)} MPa | Temp: ${this.temp.toFixed(0)}\u00B0C`);
    else if (t < 0.85) setStatus('Capillary Flow', 'Underfill spreading via capillary action');
    else if (t < 0.94) setStatus('Fillet Formation', 'Surface tension building edge fillet');
    else if (t < 1) setStatus('Curing', 'Cross-linking polymer \u2014 cooling');
    else setStatus('Complete', 'Underfill dispensing finished');
  }

  destroy() {
    if (this.sphParticles && this.sphParticles.parent) {
      this.sphParticles.parent.remove(this.sphParticles);
      if (this.sphParticles.geometry) this.sphParticles.geometry.dispose();
      if (this.sphParticles.material) this.sphParticles.material.dispose();
    }
    this.sphSolver = null;
    for (const f of this.fillets) {
      if (f.parent) f.parent.remove(f);
      if (f.geometry) f.geometry.dispose();
      if (f.material) f.material.dispose();
    }
    this.fillets = [];
    if (this.voidGroup.parent) this.voidGroup.parent.remove(this.voidGroup);
    this.voidGroup = new THREE.Group();
    this._voidsGenerated = false;
  }
}
