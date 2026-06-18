import * as THREE from 'three';
import * as SCENE from '../scene.js';
import { createControlPanel, setStatus } from '../ui.js';
import * as Analytics from '../data/analytics.js';

const VOID_COLORS = {
  airtrap: 0xef4444,
  outgassing: 0xf59e0b,
  moisture: 0xf97316,
};

const VOID_LABELS = {
  airtrap: 'Air Trap',
  outgassing: 'Outgassing',
  moisture: 'Moisture',
};

export class VoidModule {
  constructor() {
    this.group = new THREE.Group();
    this.voids = [];
    this.voidSeeds = [];
    this.voidLabel = null;
    this.playing = false;
    this.progress = 0;
    this.speed = 1;
    this.voidType = 'airtrap';
    this.params = { stagingTime: 4 };
  }

  create() {
    SCENE.addToScene(this.group);
    this._buildScene();
    this._buildUI();
    SCENE.setCameraPreset('angle');
  }

  _buildScene() {
    // Substrate
    const sub = new THREE.Mesh(
      new THREE.BoxGeometry(6, 0.15, 6),
      new THREE.MeshPhysicalMaterial({
        color: 0x1e3a5f, roughness: 0.5, metalness: 0.1,
        clearcoat: 0.1,
      })
    );
    sub.position.y = 0;
    this.group.add(sub);

    // Die (transparent)
    const die = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.4, 4),
      new THREE.MeshPhysicalMaterial({
        color: 0x475569,
        transparent: true,
        opacity: 0.15,
        roughness: 0.1,
        metalness: 0.3,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    die.position.y = 0.4;
    this.group.add(die);

    // Die edge
    const dieEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(4, 0.4, 4)),
      new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.3 })
    );
    dieEdge.position.y = 0.4;
    this.group.add(dieEdge);

    // Cross-section plane
    const crossMat = new THREE.MeshBasicMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
    });
    const cross = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 0.5), crossMat);
    cross.rotation.y = Math.PI / 4;
    cross.position.set(0, 0.2, 0);
    this.group.add(cross);

    // Labels
    this._addLabel('Die', 0, 0.8, 2.3);
    this._addLabel('Substrate', 0, -0.2, 3.3);

    // Void count label
    this.voidLabel = this._makeTextSprite('Voids: 0');
    this.voidLabel.position.set(0, 1.2, 0);
    this.voidLabel.scale.set(2.5, 0.6, 1);
    this.group.add(this.voidLabel);

    // Pre-generate seed positions
    for (let i = 0; i < 8; i++) {
      this.voidSeeds.push({
        x: (Math.random() - 0.5) * 2.8,
        z: (Math.random() - 0.5) * 2.8,
        birthTime: Math.random() * 3,
        size: 0.05 + Math.random() * 0.08,
        drift: new THREE.Vector2((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1),
      });
    }
  }

  _addLabel(text, x, y, z) {
    const s = this._makeTextSprite(text);
    s.position.set(x, y, z);
    s.scale.set(1.5, 0.4, 1);
    this.group.add(s);
  }

  _makeTextSprite(text) {
    if (!this._texCanvas) {
      this._texCanvas = document.createElement('canvas');
      this._texCanvas.width = 256;
      this._texCanvas.height = 64;
      this._texCtx = this._texCanvas.getContext('2d');
      this._texTexture = new THREE.CanvasTexture(this._texCanvas);
      this._texTexture.needsUpdate = true;
    }
    const ctx = this._texCtx;
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = '#93c5fd';
    ctx.font = 'Bold 24px "Microsoft JhengHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 38);
    this._texTexture.needsUpdate = true;
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: this._texTexture, transparent: true, depthTest: false }));
  }

  _buildUI() {
    const panel = document.getElementById('controlsContent');
    createControlPanel(panel, {
      groups: [{
        title: 'Void Simulation',
        items: [{
          type: 'buttons',
          buttons: [
            { label: '\u25B6 Generate', style: 'primary', key: 'play', onClick: () => {
              this.playing = !this.playing;
              this._refreshBtn('play', this.playing ? '\u23F8' : '\u25B6 Generate');
            }},
            { label: '\u23F9 Reset', key: 'reset', onClick: () => {
              this.playing = false; this.progress = 0;
              this._refreshBtn('play', '\u25B6 Generate');
              this._clearVoids();
              this._updateVoidLabel();
              SCENE.setBloomStrength(0.05);
              setStatus('Reset', '');
            }},
          ]
        }, {
          type: 'slider', label: 'Speed', key: 'speed', min: 0.2, max: 3, step: 0.1, value: 1, unit: '\u00D7',
          onChange: v => { this.speed = v; },
        }]
      }, {
        title: 'Parameters',
        items: [{
          type: 'select', label: 'Void Type', key: 'voidType',
          options: [
            { value: 'airtrap', label: 'Air Trap (corner)' },
            { value: 'outgassing', label: 'Outgassing (cluster)' },
            { value: 'moisture', label: 'Moisture (irregular)' },
          ],
          value: 'airtrap',
          onChange: v => { this.voidType = v; this._clearVoids(); },
        }, {
          type: 'slider', label: 'Staging Time', key: 'staging', min: 1, max: 12, step: 0.5, value: 4, unit: 'hr',
          onChange: v => { this.params.stagingTime = parseFloat(v); },
        }, {
          type: 'legend',
          entries: [
            { color: '#ef4444', label: 'Air Trap' },
            { color: '#d97706', label: 'Outgassing' },
            { color: '#f97316', label: 'Moisture' },
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

  _clearVoids() {
    for (const v of this.voids) {
      if (v.mesh.parent) v.mesh.parent.remove(v.mesh);
      if (v.mesh.geometry) v.mesh.geometry.dispose();
      if (v.mesh.material) v.mesh.material.dispose();
    }
    this.voids = [];
  }

  _spawnVoid() {
    if (this.voids.length > 40) return;

    const color = VOID_COLORS[this.voidType] || 0xef4444;
    const seed = this.voidSeeds[Math.floor(Math.random() * this.voidSeeds.length)];
    const size = seed.size * (0.5 + Math.random() * 0.5);

    let x = seed.x + (Math.random() - 0.5) * 0.5;
    let z = seed.z + (Math.random() - 0.5) * 0.5;

    // Type-specific positioning
    if (this.voidType === 'airtrap') {
      // Cluster near corners
      const corner = Math.floor(Math.random() * 4);
      const signX = corner < 2 ? -1 : 1;
      const signZ = corner % 2 === 0 ? -1 : 1;
      x = signX * (1.5 + Math.random() * 0.8);
      z = signZ * (1.5 + Math.random() * 0.8);
    } else if (this.voidType === 'outgassing') {
      // Cluster near die center
      x = (Math.random() - 0.5) * 1.2;
      z = (Math.random() - 0.5) * 1.2;
    }

    const geo = new THREE.SphereGeometry(size, 12, 12);
    const mat = new THREE.MeshPhysicalMaterial({
      color: color,
      transparent: true,
      opacity: 0.7,
      roughness: 0.1,
      metalness: 0,
      clearcoat: 0.2,
      emissive: color,
      emissiveIntensity: 0.15,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.2, z);
    this.group.add(mesh);

    this.voids.push({
      mesh,
      life: 0,
      maxLife: 4 + Math.random() * 3,
      drift: new THREE.Vector2((Math.random() - 0.5) * 0.015, (Math.random() - 0.5) * 0.015),
    });
  }

  _updateVoidLabel() {
    if (!this.voidLabel) return;
    const count = this.voids.length;
    const typeLabel = VOID_LABELS[this.voidType] || 'Void';
    const text = `${typeLabel}: ${count}`;
    const ctx = this._texCtx;
    if (ctx) {
      ctx.clearRect(0, 0, 256, 64);
      ctx.fillStyle = '#93c5fd';
      ctx.font = 'Bold 24px "Microsoft JhengHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(text, 128, 38);
      this._texTexture.needsUpdate = true;
    }
  }

  update(dt, time) {
    if (!this.playing) return;

    this.progress += dt * 0.08 * this.speed;

    // Spawn rate based on staging time
    const spawnRate = 0.3 + (this.params.stagingTime / 12) * 0.7;
    if (Math.random() < dt * this.speed * spawnRate * 0.4) {
      this._spawnVoid();
    }

    // Update existing voids
    const toRemove = [];
    for (let i = 0; i < this.voids.length; i++) {
      const v = this.voids[i];
      v.life += dt * this.speed;
      v.mesh.position.x += v.drift.x * dt * this.speed;
      v.mesh.position.z += v.drift.y * dt * this.speed;
      v.mesh.position.y = 0.2 + Math.sin(v.life * 2) * 0.008;

      const grow = 1 + v.life * 0.2;
      v.mesh.scale.set(grow, grow, grow);
      v.mesh.material.opacity = Math.max(0, 1 - v.life / v.maxLife);

      // Bloom modulation per void
      v.mesh.material.emissiveIntensity = 0.1 + Math.sin(v.life * 3) * 0.05;

      if (v.life > v.maxLife || v.mesh.material.opacity <= 0) {
        toRemove.push(i);
      }
    }

    // Remove expired
    for (const i of toRemove.reverse()) {
      const v = this.voids[i];
      if (v.mesh.parent) v.mesh.parent.remove(v.mesh);
      v.mesh.geometry.dispose();
      v.mesh.material.dispose();
      this.voids.splice(i, 1);
    }

    // Bloom based on void density
    const density = Math.min(this.voids.length / 20, 1);
    SCENE.setBloomStrength(0.05 + density * 0.08);

    this._updateVoidLabel();
    Analytics.push('Void', {
      count: this.voids.length,
      progress: this.progress,
    });

    setStatus(`${VOID_LABELS[this.voidType]} Forming`,
      `Count: ${this.voids.length} | Staging: ${this.params.stagingTime}h`);
  }

  destroy() {
    this._clearVoids();
    this.voidSeeds = [];
  }
}
