import * as THREE from 'three';
import * as SCENE from '../scene.js';
import { createControlPanel, setStatus } from '../ui.js';

const PATTERNS = {
  I: {
    label: 'I-Type',
    paths: [[{ x: -1.5, z: 0 }, { x: 1.5, z: 0 }]],
  },
  L: {
    label: 'L-Type',
    paths: [
      [{ x: -1.5, z: -1.5 }, { x: 1.5, z: -1.5 }],
      [{ x: 1.5, z: -1.5 }, { x: 1.5, z: 1.5 }],
    ],
  },
  U: {
    label: 'U-Type',
    paths: [
      [{ x: -1.5, z: -1.5 }, { x: 1.5, z: -1.5 }],
      [{ x: 1.5, z: -1.5 }, { x: 1.5, z: 1.5 }],
      [{ x: 1.5, z: 1.5 }, { x: -1.5, z: 1.5 }],
    ],
  },
};

const COLORS = { I: 0x60a5fa, L: 0x22c55e, U: 0xf59e0b };

export class PatternLabModule {
  constructor() {
    this.group = new THREE.Group();
    this.stations = {};
    this.playing = false;
    this.progress = 0;
    this.speed = 1;
  }

  create() {
    SCENE.addToScene(this.group);
    this._buildStations();
    this._buildUI();
    SCENE.setCameraPreset('top');
  }

  _buildStations() {
    const spacing = 6;
    const keys = Object.keys(PATTERNS);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const station = this._buildStation(key, (i - 1) * spacing);
      this.stations[key] = station;
    }
  }

  _buildStation(type, offsetX) {
    const g = new THREE.Group();

    // PCB
    const pcb = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.15, 4),
      new THREE.MeshPhysicalMaterial({
        color: 0x1a3a2a, roughness: 0.6, metalness: 0.05,
        clearcoat: 0.1,
      })
    );
    pcb.position.y = 0.075;
    g.add(pcb);

    // Component outline
    const compLine = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(2.4, 0.01, 2.4)),
      new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.3 })
    );
    compLine.position.y = 0.16;
    g.add(compLine);

    // Ghost path
    const ghostMat = new THREE.LineBasicMaterial({
      color: COLORS[type],
      transparent: true,
      opacity: 0.2,
    });
    const pattern = PATTERNS[type];
    const pathPoints = [];
    for (const seg of pattern.paths) {
      for (const p of seg) {
        pathPoints.push(new THREE.Vector3(p.x, 0.16, p.z));
      }
    }
    const ghostGeo = new THREE.BufferGeometry().setFromPoints(pathPoints);
    const ghostLine = new THREE.Line(ghostGeo, ghostMat);
    g.add(ghostLine);

    // Needle
    const needleMat = new THREE.MeshPhysicalMaterial({
      color: 0x94a3b8, metalness: 0.7, roughness: 0.3,
    });
    const needle = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.6, 8), needleMat);
    tube.position.y = 0.3;
    needle.add(tube);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 8),
      new THREE.MeshPhysicalMaterial({ color: 0x6b7280, metalness: 0.5 }));
    tip.position.y = 0.03;
    needle.add(tip);

    const startPos = pattern.paths[0][0];
    needle.position.set(startPos.x, 0.16 + 0.12, startPos.z);
    g.add(needle);

    // Deposited trail group
    const trailGroup = new THREE.Group();
    g.add(trailGroup);

    // Label
    const label = this._makeLabel(PATTERNS[type].label, COLORS[type]);
    label.position.set(0, 0.7, 0);
    label.scale.set(1.8, 0.4, 1);
    g.add(label);

    // Position station
    g.position.set(offsetX, 0, 0);
    this.group.add(g);

    return { group: g, needle, trailGroup, pathPoints, label, progress: 0, segIdx: 0, segT: 0 };
  }

  _makeLabel(text, color) {
    const hex = '#' + new THREE.Color(color).getHexString();
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = hex;
    ctx.font = 'Bold 22px "Microsoft JhengHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 40);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  }

  _buildUI() {
    const panel = document.getElementById('controlsContent');
    createControlPanel(panel, {
      groups: [{
        title: 'Pattern Lab',
        items: [{
          type: 'buttons',
          buttons: [
            { label: '\u25B6 Run All', style: 'primary', key: 'play', onClick: () => {
              this.playing = !this.playing;
              this._refreshBtn('play', this.playing ? '\u23F8' : '\u25B6 Run All');
              if (this.playing) {
                for (const k of Object.keys(this.stations)) {
                  const s = this.stations[k];
                  s.progress = 0; s.segIdx = 0; s.segT = 0;
                  const pattern = PATTERNS[k];
                  const startPos = pattern.paths[0][0];
                  s.needle.position.set(startPos.x, 0.16 + 0.12, startPos.z);
                  while (s.trailGroup.children.length) {
                    s.trailGroup.remove(s.trailGroup.children[0]);
                  }
                }
              }
            }},
            { label: '\u23F9 Reset', key: 'reset', onClick: () => {
              this.playing = false; this.progress = 0;
              this._refreshBtn('play', '\u25B6 Run All');
              for (const k of Object.keys(this.stations)) {
                const s = this.stations[k];
                s.progress = 0; s.segIdx = 0; s.segT = 0;
                const pattern = PATTERNS[k];
                const startPos = pattern.paths[0][0];
                s.needle.position.set(startPos.x, 0.16 + 0.12, startPos.z);
                while (s.trailGroup.children.length) {
                  s.trailGroup.remove(s.trailGroup.children[0]);
                }
              }
              setStatus('Reset', '');
            }},
          ]
        }, {
          type: 'slider', label: 'Speed', key: 'speed', min: 0.2, max: 3, step: 0.1, value: 1, unit: '\u00D7',
          onChange: v => { this.speed = v; },
        }, {
          type: 'legend',
          entries: [
            { color: '#3B82F6', label: 'I-Type' },
            { color: '#10B981', label: 'L-Type' },
            { color: '#d97706', label: 'U-Type' },
          ]
        }]
      }, {
        title: 'View',
        items: [{
          type: 'buttons',
          buttons: [
            { label: 'Top', onClick: () => SCENE.setCameraPreset('top', true) },
            { label: '45\u00B0', onClick: () => SCENE.setCameraPreset('angle', true) },
            { label: 'Close', onClick: () => SCENE.setCameraPreset('close', true) },
          ]
        }]
      }]
    });
  }

  _refreshBtn(key, label) {
    const btn = document.querySelector(`.btn[data-key="${key}"]`);
    if (btn) btn.textContent = label;
  }

  update(dt, time) {
    if (!this.playing) return;

    this.progress += dt * 0.15 * this.speed;
    if (this.progress >= 1) {
      this.progress = 1;
      this.playing = false;
      this._refreshBtn('play', '\u25B6 Run All');
      setStatus('Pattern Complete', 'I/L/U comparison finished');
      return;
    }

    const eased = this.progress < 0.5 ? 0.5 * Math.pow(2 * this.progress, 0.8) : 1 - 0.5 * Math.pow(2 * (1 - this.progress), 0.8);

    for (const k of Object.keys(this.stations)) {
      this._updateStation(k, eased);
    }

    setStatus(`Pattern Comparison (${Math.round(eased * 100)}%)`, '');
  }

  _updateStation(type, t) {
    const station = this.stations[type];
    if (!station) return;
    const pattern = PATTERNS[type];

    // Determine which segment and local progress
    const totalSegLen = pattern.paths.reduce((sum, seg) => {
      const dx = seg[1].x - seg[0].x;
      const dz = seg[1].z - seg[0].z;
      return sum + Math.sqrt(dx * dx + dz * dz);
    }, 0);

    let acc = 0;
    let segIdx = 0;
    let localT = 0;
    const targetDist = t * totalSegLen;

    for (let i = 0; i < pattern.paths.length; i++) {
      const dx = pattern.paths[i][1].x - pattern.paths[i][0].x;
      const dz = pattern.paths[i][1].z - pattern.paths[i][0].z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (acc + len >= targetDist || i === pattern.paths.length - 1) {
        segIdx = i;
        localT = len > 0 ? (targetDist - acc) / len : 0;
        break;
      }
      acc += len;
    }

    localT = Math.min(Math.max(localT, 0), 1);

    // Needle position
    const seg = pattern.paths[segIdx];
    const nx = seg[0].x + (seg[1].x - seg[0].x) * localT;
    const nz = seg[0].z + (seg[1].z - seg[0].z) * localT;
    station.needle.position.set(nx, 0.16 + 0.12, nz);

    // Trail
    const trailMat = station._trailMat || new THREE.MeshBasicMaterial({
      color: COLORS[type],
      transparent: true,
      opacity: 0.8,
    });
    station._trailMat = trailMat;

    // Build full trail up to current point
    while (station.trailGroup.children.length) {
      const c = station.trailGroup.children[0];
      station.trailGroup.remove(c);
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }

    // Add completed segments
    for (let i = 0; i < segIdx; i++) {
      const s = pattern.paths[i];
      const midX = (s[0].x + s[1].x) / 2;
      const midZ = (s[0].z + s[1].z) / 2;
      const dx = s[1].x - s[0].x;
      const dz = s[1].z - s[0].z;
      const len = Math.sqrt(dx * dx + dz * dz);
      const trail = new THREE.Mesh(
        new THREE.PlaneGeometry(len, 0.04),
        trailMat
      );
      trail.position.set(midX, 0.17, midZ);
      trail.rotation.y = -Math.atan2(dz, dx);
      trail.rotation.x = -Math.PI / 2;
      station.trailGroup.add(trail);
    }

    // Add partial segment
    if (localT > 0.01 && segIdx < pattern.paths.length) {
      const s = pattern.paths[segIdx];
      const dx = seg[1].x - seg[0].x;
      const dz = seg[1].z - seg[0].z;
      const len = Math.sqrt(dx * dx + dz * dz);
      const partialLen = len * localT;
      const midX = seg[0].x + dx * localT * 0.5;
      const midZ = seg[0].z + dz * localT * 0.5;
      const trail = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.max(partialLen, 0.01), 0.04),
        trailMat
      );
      trail.position.set(midX, 0.17, midZ);
      trail.rotation.y = -Math.atan2(dz, dx);
      trail.rotation.x = -Math.PI / 2;
      station.trailGroup.add(trail);
    }
  }

  destroy() {
    this.stations = {};
  }
}
