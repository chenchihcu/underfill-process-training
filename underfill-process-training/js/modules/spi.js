import * as THREE from 'three';
import * as SCENE from '../scene.js';
import { createControlPanel, setStatus } from '../ui.js';
import { matGold, matSilver } from '../helpers/materials.js';
import * as Analytics from '../data/analytics.js';

const PCB_W = 40, PCB_D = 40, PCB_H = 1.5;
const PAD_SIZE = 1.2, PAD_GAP = 0.4;
const PASTE_HEIGHT = 0.22;
const STENCIL_THICK = 0.15;

export class SPIModule {
  constructor() {
    this.group = new THREE.Group();
    this.pasteDeposits = [];
    this.squeegee = null;
    this.squeegeeBlade = null;
    this.stencil = null;
    this.stencilHoles = [];
    this.particles = null;
    this.crossSection = null;
    this.playing = false;
    this.progress = 0;
    this.speed = 1;
    this.volume = 100;
    this.defectMode = 'none';
    this.showCrossSection = false;
    this._initialized = false;
  }

  create() {
    SCENE.addToScene(this.group);
    this._buildPCB();
    this._buildPads();
    this._buildPaste();
    this._buildStencil();
    this._buildSqueegee();
    this._buildParticles();
    this._buildCrossSection();
    this._buildUI();
    this._initialized = true;
    this.progress = 0;
    this._updateScene(0);
  }

  _buildPCB() {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(PCB_W, PCB_H, PCB_D),
      new THREE.MeshPhysicalMaterial({
        color: 0x1a5c2a, roughness: 0.6, metalness: 0.05,
        clearcoat: 0.15, clearcoatRoughness: 0.4,
      })
    );
    body.position.y = PCB_H / 2;
    this.group.add(body);

    // Edge bevel
    const bevel = new THREE.Mesh(
      new THREE.BoxGeometry(PCB_W, 0.04, PCB_D),
      new THREE.MeshPhysicalMaterial({
        color: 0x0d3a1a, roughness: 1, metalness: 0,
        transparent: true, opacity: 0.12,
      })
    );
    bevel.position.y = PCB_H + 0.02;
    this.group.add(bevel);
  }

  _buildPads() {
    const cols = 7, rows = 7;
    const span = (cols - 1) * (PAD_SIZE + PAD_GAP);
    const start = -span / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const pad = new THREE.Mesh(
          new THREE.BoxGeometry(PAD_SIZE, 0.05, PAD_SIZE),
          matGold
        );
        pad.position.set(start + c * (PAD_SIZE + PAD_GAP), PCB_H, start + r * (PAD_SIZE + PAD_GAP));
        this.group.add(pad);
      }
    }
  }

  _buildPaste() {
    const cols = 7, rows = 7;
    const span = (cols - 1) * (PAD_SIZE + PAD_GAP);
    const start = -span / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Use cylinder with rounded top via lathe profile
        const shape = new THREE.Shape();
        const hw = PAD_SIZE * 0.42;
        shape.moveTo(-hw, -PASTE_HEIGHT / 2);
        shape.lineTo(-hw, PASTE_HEIGHT / 3);
        shape.quadraticCurveTo(-hw * 0.5, PASTE_HEIGHT / 2 + 0.02, 0, PASTE_HEIGHT / 2);
        shape.quadraticCurveTo(hw * 0.5, PASTE_HEIGHT / 2 + 0.02, hw, PASTE_HEIGHT / 3);
        shape.lineTo(hw, -PASTE_HEIGHT / 2);
        shape.closePath();

        const geo = new THREE.ShapeGeometry(shape);
        const paste = new THREE.Mesh(
          geo,
          new THREE.MeshPhysicalMaterial({
            color: 0x8a8a8a,
            roughness: 0.4,
            metalness: 0.7,
            clearcoat: 0.05,
            clearcoatRoughness: 0.3,
          })
        );
        paste.position.set(start + c * (PAD_SIZE + PAD_GAP), PCB_H + PASTE_HEIGHT / 2, start + r * (PAD_SIZE + PAD_GAP));
        paste.rotation.x = -Math.PI / 2;
        paste.userData = { baseH: PASTE_HEIGHT, row: r, col: c, baseScale: 1 };
        this.group.add(paste);
        this.pasteDeposits.push(paste);
      }
    }
  }

  _updatePasteShape() {
    const volFactor = this.volume / 100;
    const isDefective = this.defectMode !== 'none';

    for (const p of this.pasteDeposits) {
      const r = p.userData.row;
      const c = p.userData.col;
      let h = PASTE_HEIGHT * volFactor;
      let color = new THREE.Color(0x8a8a8a);
      let emissiveColor = new THREE.Color(0x000000);

      if (this.defectMode === 'low') {
        h *= 0.8;
        if (h < 0.12) { color.setHex(0xff6666); emissiveColor.setHex(0xff2222); }
      } else if (this.defectMode === 'high') {
        h *= 1.4;
        if (h > 0.28) { color.setHex(0xff6666); emissiveColor.setHex(0xff2222); }
      } else if (this.defectMode === 'bridge') {
        const edge = Math.abs(r - 3) > 2 || Math.abs(c - 3) > 2;
        if (edge && Math.random() > 0.6) {
          h *= 1.8;
          color.setHex(0xff4444);
          emissiveColor.setHex(0xff0000);
        }
      } else if (this.defectMode === 'shift') {
        color.setHex(0xff6666);
        emissiveColor.setHex(0xff2222);
      }

      p.scale.y = h / PASTE_HEIGHT;
      p.material.color.copy(color);
      p.material.emissive.copy(emissiveColor);
      p.material.emissiveIntensity = emissiveColor.getHex() !== 0 ? 0.4 : 0;
    }
  }

  _buildStencil() {
    const g = new THREE.Group();
    const stencilMat = new THREE.MeshPhysicalMaterial({
      color: 0x607080,
      roughness: 0.25,
      metalness: 0.85,
      clearcoat: 0.1,
      envMapIntensity: 1.0,
      transparent: true,
      opacity: 0.6,
    });

    const stencil = new THREE.Mesh(
      new THREE.BoxGeometry(PCB_W * 0.9, STENCIL_THICK, PCB_D * 0.9),
      stencilMat
    );
    stencil.position.set(0, PCB_H + PASTE_HEIGHT + STENCIL_THICK / 2, 0);
    g.add(stencil);
    this.stencil = g;
    g.visible = false;
    this.group.add(g);

    // Laser-cut apertures
    const cols = 7, rows = 7;
    const span = (cols - 1) * (PAD_SIZE + PAD_GAP);
    const start = -span / 2;
    this.stencilHoles = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const hole = new THREE.Mesh(
          new THREE.CylinderGeometry(PAD_SIZE * 0.42, PAD_SIZE * 0.42, STENCIL_THICK + 0.02, 16),
          new THREE.MeshPhysicalMaterial({
            color: 0x1a2530,
            roughness: 0.8,
            metalness: 0,
            side: THREE.DoubleSide,
          })
        );
        hole.position.set(start + c * (PAD_SIZE + PAD_GAP), PCB_H + PASTE_HEIGHT + STENCIL_THICK / 2, start + r * (PAD_SIZE + PAD_GAP));
        hole.rotation.x = Math.PI / 2;
        g.add(hole);
        this.stencilHoles.push(hole);
      }
    }
  }

  _buildSqueegee() {
    const g = new THREE.Group();

    // Blade body
    const bladeMat = new THREE.MeshPhysicalMaterial({
      color: 0x3a3a3a,
      roughness: 0.9,
      metalness: 0,
      clearcoat: 0,
    });
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(PCB_W * 0.7, 0.1, 3.5),
      bladeMat
    );
    blade.position.set(0, 0, 0);
    g.add(blade);
    this.squeegeeBlade = blade;

    // Blade edge (rubber tip)
    const tipMat = new THREE.MeshPhysicalMaterial({
      color: 0x222222,
      roughness: 0.95,
      metalness: 0,
    });
    const tip = new THREE.Mesh(
      new THREE.BoxGeometry(PCB_W * 0.68, 0.03, 3.3),
      tipMat
    );
    tip.position.set(0, -0.06, 0);
    g.add(tip);

    // Holder arm
    const holderMat = new THREE.MeshPhysicalMaterial({
      color: 0x667788,
      roughness: 0.2,
      metalness: 0.8,
      clearcoat: 0.1,
      envMapIntensity: 1.0,
    });
    const holder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.12, 4, 6),
      holderMat
    );
    holder.position.set(0, 2, 0);
    holder.rotation.z = 0.3;
    g.add(holder);

    // Pressure gauge ring on top
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.04, 8, 16),
      new THREE.MeshPhysicalMaterial({ color: 0x4488ff, emissive: 0x4488ff, emissiveIntensity: 0.2 })
    );
    ring.position.set(0, 3.8, 0);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);

    this.squeegee = g;
    g.visible = false;
    this.group.add(g);
  }

  _buildParticles() {
    const count = 200;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * PCB_W * 0.6;
      pos[i * 3 + 1] = Math.random() * 2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * PCB_D * 0.4;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xddaa55,
      size: 0.03,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.particles = new THREE.Points(geo, mat);
    this.particles.visible = false;
    this.group.add(this.particles);
  }

  _buildCrossSection() {
    const planeMat = new THREE.MeshPhysicalMaterial({
      color: 0x4488ff,
      roughness: 0.3,
      metalness: 0,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(PCB_W * 1.2, PCB_H + 5),
      planeMat
    );
    plane.position.set(0, PCB_H / 2, 0);
    plane.rotation.y = 0;
    plane.visible = false;
    plane.userData.isCrossSection = true;
    this.crossSection = plane;
    this.group.add(plane);

    const lineMat = new THREE.LineBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.25,
    });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -2, -PCB_D * 0.8),
      new THREE.Vector3(0, PCB_H + 4, -PCB_D * 0.8),
    ]);
    const line = new THREE.Line(lineGeo, lineMat);
    line.userData.isCrossSection = true;
    line.visible = false;
    this.group.add(line);
  }

  _buildUI() {
    const panel = document.getElementById('controlsContent');
    createControlPanel(panel, {
      groups: [{
        title: 'SPI Simulation',
        items: [{
          type: 'buttons',
          buttons: [
            { label: '\u25B6 Print', style: 'primary', key: 'play', onClick: () => {
              this.playing = !this.playing;
              this._refreshBtn('play', this.playing ? '\u23F8 Stop' : '\u25B6 Print');
              if (this.playing && this.progress >= 1) { this.progress = 0; this._updateScene(0); }
              setStatus(this.playing ? 'Printing...' : 'Paused', '');
            }},
            { label: '\u23F9 Reset', key: 'reset', onClick: () => {
              this.playing = false; this.progress = 0;
              this._updateScene(0);
              this._refreshBtn('play', '\u25B6 Print');
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
          type: 'slider', label: 'Volume', key: 'volume', min: 50, max: 150, step: 1, value: 100, unit: '%',
          onChange: v => { this.volume = v; if (!this.playing) this._updatePasteShape(); },
        }, {
          type: 'select', label: 'Defect', key: 'defect',
          options: [
            { value: 'none', label: 'None' },
            { value: 'low', label: 'Low Volume (80%)' },
            { value: 'high', label: 'High Volume (140%)' },
            { value: 'bridge', label: 'Bridging Risk' },
            { value: 'shift', label: 'Print Shift' },
          ],
          value: 'none',
          onChange: v => { this.defectMode = v; this._updatePasteShape(); },
        }, {
          type: 'legend',
          entries: [
            { color: '#8a8a8a', label: 'Solder Paste' },
            { color: '#ffd700', label: 'Cu Pad' },
            { color: '#10B981', label: 'OK' },
            { color: '#EF4444', label: 'Defect' },
          ]
        }]
      }, {
        title: 'View',
        items: [{
          type: 'buttons',
          buttons: [
            { label: 'Top', onClick: () => SCENE.setCameraPreset('top', true) },
            { label: '45\u00B0', onClick: () => SCENE.setCameraPreset('angle', true) },
            { label: 'Side', onClick: () => SCENE.setCameraPreset('side', true) },
            { label: 'Slice', onClick: () => {
              this.showCrossSection = !this.showCrossSection;
              if (this.crossSection) {
                this.crossSection.visible = this.showCrossSection;
                this.crossSection.children?.forEach?.(c => c.visible = this.showCrossSection);
              }
              this._refreshSliceActive();
              if (this.showCrossSection) SCENE.setCameraPreset('cross', true);
            }},
          ]
        }]
      }]
    });
  }

  _refreshBtn(key, label) {
    const btn = document.querySelector(`.btn[data-key="${key}"]`);
    if (btn) btn.textContent = label;
  }

  _refreshSliceActive() {
    document.querySelectorAll('.btn').forEach(b => {
      if (b.textContent === 'Slice') b.classList.toggle('active', this.showCrossSection);
    });
  }

  _checkDefects() {
    if (this.defectMode !== 'none') {
      setStatus(`Warning: ${this.defectMode} detected`, 'See red deposits above');
    }
  }

  update(dt, time) {
    if (!this.playing || !this._initialized) return;
    this.progress += dt * 0.3 * this.speed;
    if (this.progress >= 1) {
      this.progress = 1;
      this.playing = false;
      this._refreshBtn('play', '\u25B6 Print');
      SCENE.setBloomStrength(0.05);
      this._checkDefects();
      return;
    }
    this._updateScene(this.progress);
    Analytics.push('SPI', {
      pressure: 0.15 + this.progress * 0.2,
      volume: this.volume / 100,
      progress: this.progress,
    });
  }

  _updateScene(t) {
    const descendT = 0.05;
    const printStart = 0.08;
    const printEnd = 0.65;
    const separateStart = 0.68;
    const separateEnd = 0.82;
    const inspectStart = 0.85;

    this._updateSqueegee(t, descendT, printStart, printEnd, separateStart, separateEnd);
    this._updateStencil(t, printStart, separateStart, separateEnd);
    this._updatePasteDeposits(t, printStart, printEnd);
    this._updateParticles(t, separateStart, separateEnd);
    this._updateBloom(t, printStart, separateEnd);
    this._updateStatus(t);
  }

  _updateSqueegee(t, descendT, printStart, printEnd, separateStart, separateEnd) {
    if (!this.squeegee) return;

    if (t > descendT && t < separateEnd) {
      this.squeegee.visible = true;

      if (t < printStart) {
        // Descend
        const lt = (t - descendT) / (printStart - descendT);
        const ease = lt < 0.5 ? 2 * lt * lt : 1 - Math.pow(-2 * lt + 2, 2) / 2;
        this.squeegee.position.x = -PCB_W * 0.4;
        this.squeegee.position.y = PCB_H + PASTE_HEIGHT + 0.5 + (1 - ease) * 4;
        this.squeegee.position.z = 0;
        this.squeegeeBlade.rotation.z = -0.05;
      } else if (t < printEnd) {
        // Printing stroke
        const lt = (t - printStart) / (printEnd - printStart);
        const ease = lt < 0.5 ? 2 * lt * lt : 1 - Math.pow(-2 * lt + 2, 2) / 2;
        this.squeegee.position.x = -PCB_W * 0.4 + ease * PCB_W * 0.8;
        this.squeegee.position.y = PCB_H + PASTE_HEIGHT + 0.05 + 0.15 * (1 - ease);
        this.squeegee.position.z = 0;
        // Blade angle changes during stroke
        this.squeegeeBlade.rotation.z = -0.1 + ease * 0.15;
      } else {
        // Lift
        const lt = (t - printEnd) / (separateEnd - printEnd);
        const ease = lt < 0.5 ? 2 * lt * lt : 1 - Math.pow(-2 * lt + 2, 2) / 2;
        this.squeegee.position.y = PCB_H + PASTE_HEIGHT + 0.2 + ease * 3;
        this.squeegeeBlade.rotation.z = 0.05;
      }
    } else {
      this.squeegee.visible = false;
    }
  }

  _updateStencil(t, printStart, separateStart, separateEnd) {
    if (!this.stencil) return;
    if (t > printStart && t < separateEnd) {
      this.stencil.visible = true;
      if (t >= separateStart) {
        // Peeling effect - stencil lifts with slight rotation
        const lt = (t - separateStart) / (separateEnd - separateStart);
        const ease = lt < 0.5 ? 2 * lt * lt : 1 - Math.pow(-2 * lt + 2, 2) / 2;
        this.stencil.position.y = PCB_H + PASTE_HEIGHT + STENCIL_THICK / 2 + ease * 2.5;
        this.stencil.rotation.x = ease * 0.08;
      } else {
        this.stencil.position.y = PCB_H + PASTE_HEIGHT + STENCIL_THICK / 2;
        this.stencil.rotation.x = 0;
      }
    } else {
      this.stencil.visible = false;
    }
  }

  _updatePasteDeposits(t, printStart, printEnd) {
    if (t < printStart) {
      for (const p of this.pasteDeposits) {
        p.visible = false;
        p.scale.y = 0.01;
      }
      return;
    }

    const fillT = Math.min((t - printStart) / (printEnd - printStart), 1);
    const eased = fillT < 0.5 ? 2 * fillT * fillT : -1 + (4 - 2 * fillT) * fillT;
    const volFactor = this.volume / 100;

    for (const p of this.pasteDeposits) {
      p.visible = true;
      p.scale.y = Math.max(0.01, eased * volFactor);
    }

    if (t > printEnd) {
      this._updatePasteShape();
    }
  }

  _updateParticles(t, separateStart, separateEnd) {
    if (!this.particles) return;
    const active = t >= separateStart && t < separateEnd + 0.1;
    this.particles.visible = active;
    if (!active) {
      this.particles.material.opacity = 0;
      return;
    }

    const lt = (t - separateStart) / (separateEnd - separateStart);
    this.particles.material.opacity = 0.4 * (1 - lt);

    const pos = this.particles.geometry.attributes.position.array;
    for (let i = 0; i < pos.length / 3; i++) {
      pos[i * 3] += (Math.random() - 0.5) * 0.05;
      pos[i * 3 + 1] += 0.01 + Math.random() * 0.02;
      if (pos[i * 3 + 1] > 3) pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] += (Math.random() - 0.5) * 0.05;
    }
    this.particles.geometry.attributes.position.needsUpdate = true;
  }

  _updateBloom(t, printStart, separateEnd) {
    if (t < printStart) SCENE.setBloomStrength(0.05);
    else if (t < 0.65) SCENE.setBloomStrength(0.1);
    else if (t < separateEnd) SCENE.setBloomStrength(0.08);
    else SCENE.setBloomStrength(0.05);
  }

  _updateStatus(t) {
    if (t === 0) setStatus('Ready', 'Press \u25B6 to start');
    else if (t < 0.08) setStatus('Descending', 'Squeegee approaching stencil');
    else if (t < 0.65) setStatus(`Printing (${Math.round(t * 100)}%)`, `${this.volume}% volume | Defect: ${this.defectMode}`);
    else if (t < 0.82) setStatus('Stencil Separation', 'Peeling stencil from substrate');
    else setStatus('Inspection', 'SPI height map analysis');
  }

  destroy() {
    this.pasteDeposits = [];
    this.stencilHoles = [];
  }
}
