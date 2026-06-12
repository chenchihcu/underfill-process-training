import * as THREE from 'three';
import * as SCENE from '../scene.js';
import { createControlPanel, setStatus } from '../ui.js';
import { matFPC, matStiffener, matCarrier, matSilver, matCopper, stressColor } from '../helpers/materials.js';
import * as Analytics from '../data/analytics.js';

const FPC_W = 40, FPC_D = 30, FPC_H = 0.15;
const CARRIER_W = 46, CARRIER_D = 36, CARRIER_H = 3;

export class FPCAModule {
  constructor() {
    this.group = new THREE.Group();
    this.fpc = null;
    this.carrier = null;
    this.stiffener = null;
    this.adhesive = null;
    this.bendIndicator = null;
    this.bendGlow = null;
    this.particles = null;
    this.heatGlow = null;
    this.stressColors = null;
    this.playing = false;
    this.progress = 0;
    this.speed = 1;
    this.showCarrier = true;
    this.bendAmount = 0;
    this._prebaking = false;
  }

  create() {
    SCENE.addToScene(this.group);
    this._buildCarrier();
    this._buildFPC();
    this._buildAdhesive();
    this._buildStiffener();
    this._buildBendIndicator();
    this._buildBendGlow();
    this._buildPads();
    this._buildParticles();
    this._buildHeatGlow();
    this._buildUI();
    this._updateScene(0);
    this._initStressColors();
  }

  _buildCarrier() {
    const g = new THREE.Group();

    const carrier = new THREE.Mesh(
      new THREE.BoxGeometry(CARRIER_W, CARRIER_H, CARRIER_D),
      matCarrier
    );
    carrier.position.y = CARRIER_H / 2;
    g.add(carrier);

    // Pocket recess
    const pocket = new THREE.Mesh(
      new THREE.BoxGeometry(FPC_W + 2, CARRIER_H * 0.25, FPC_D + 2),
      new THREE.MeshPhysicalMaterial({
        color: 0x444444, roughness: 0.8, metalness: 0.1,
      })
    );
    pocket.position.y = CARRIER_H - 0.05;
    g.add(pocket);

    // Vacuum holes along perimeter
    const vacMat = new THREE.MeshPhysicalMaterial({
      color: 0x222222, roughness: 0.9, metalness: 0,
    });
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const r = FPC_W * 0.42;
      const hole = new THREE.Mesh(
        new THREE.CircleGeometry(0.1, 8),
        vacMat
      );
      hole.position.set(Math.cos(angle) * r, CARRIER_H - 0.02, Math.sin(angle) * r * (FPC_D / FPC_W));
      hole.rotation.x = -Math.PI / 2;
      g.add(hole);
    }

    // Alignment pins
    const pinMat = new THREE.MeshPhysicalMaterial({
      color: 0x8899aa, roughness: 0.2, metalness: 0.8, envMapIntensity: 1.0,
    });
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const pin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, 0.6, 8),
        pinMat
      );
      pin.position.set(dx * FPC_W * 0.42, CARRIER_H + 0.3, dz * FPC_D * 0.42);
      g.add(pin);
    }

    this.carrier = g;
    this.group.add(g);
  }

  _buildFPC() {
    const segX = 32, segZ = 24;
    const geo = new THREE.BufferGeometry();
    const positions = [];
    const uvs = [];
    const indices = [];
    const hw = FPC_W / 2, hd = FPC_D / 2;

    for (let iz = 0; iz <= segZ; iz++) {
      for (let ix = 0; ix <= segX; ix++) {
        const x = -hw + (ix / segX) * FPC_W;
        const z = -hd + (iz / segZ) * FPC_D;
        const bend = 0.6 * Math.sin((z / FPC_D + 0.5) * Math.PI);
        positions.push(x, bend, z);
        uvs.push(ix / segX, iz / segZ);
      }
    }

    for (let iz = 0; iz < segZ; iz++) {
      for (let ix = 0; ix < segX; ix++) {
        const a = iz * (segX + 1) + ix;
        const b = a + 1;
        const c = (iz + 1) * (segX + 1) + ix;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    geo.setIndex(indices);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();

    // Vertex colors for stress map
    const vertCount = positions.length / 3;
    const colors = new Float32Array(vertCount * 3);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.stressColors = colors;

    const fpcMat = matFPC.clone();
    fpcMat.vertexColors = true;

    const fpc = new THREE.Mesh(geo, fpcMat);
    fpc.position.y = CARRIER_H + FPC_H / 2;
    this.fpc = fpc;
    this.group.add(fpc);
  }

  _initStressColors() {
    if (!this.stressColors) return;
    this.stressColors.fill(0);
    if (this.fpc) {
      this.fpc.geometry.attributes.color.needsUpdate = true;
    }
  }

  _updateStressColors(bendAmt) {
    if (!this.fpc || !this.stressColors) return;
    const pos = this.fpc.geometry.attributes.position;
    const maxBend = 2.5;
    const normalizedBend = Math.min(bendAmt / maxBend, 1);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const distFromCenter = Math.sqrt((x / (FPC_W / 2)) ** 2 + (z / (FPC_D / 2)) ** 2) / Math.SQRT2;
      const strain = normalizedBend * (0.3 + 0.7 * distFromCenter);
      const c = stressColor(strain);
      this.stressColors[i * 3] = c.r;
      this.stressColors[i * 3 + 1] = c.g;
      this.stressColors[i * 3 + 2] = c.b;
    }
    this.fpc.geometry.attributes.color.needsUpdate = true;
  }

  _buildAdhesive() {
    const adhesive = new THREE.Mesh(
      new THREE.BoxGeometry(12.5, 0.04, 8.5),
      new THREE.MeshPhysicalMaterial({
        color: 0xccaa55,
        roughness: 0.6,
        metalness: 0,
        transparent: true,
        opacity: 0,
        clearcoat: 0.2,
      })
    );
    adhesive.position.set(-FPC_W * 0.25, CARRIER_H + FPC_H + 0.01, FPC_D * 0.2);
    this.adhesive = adhesive;
    this.group.add(adhesive);
  }

  _buildStiffener() {
    const stiff = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.2, 8),
      matStiffener
    );
    stiff.position.set(-FPC_W * 0.25, CARRIER_H + FPC_H + 0.15, FPC_D * 0.2);
    this.stiffener = stiff;
    this.group.add(stiff);
  }

  _buildPads() {
    const padMat = matCopper;
    for (const [x, z] of [[-6, 4], [0, 4], [6, 4], [-6, -4], [0, -4], [6, -4]]) {
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.04, 1.8),
        padMat
      );
      pad.position.set(x, CARRIER_H + FPC_H + 0.02, z);
      this.group.add(pad);
    }
  }

  _buildBendIndicator() {
    const g = new THREE.Group();

    // 3D arc (tube)
    const curvePoints = [];
    const r = 3;
    const segments = 16;
    for (let a = 0; a <= Math.PI / 2; a += Math.PI / 2 / segments) {
      curvePoints.push(new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), 0));
    }
    const curve = new THREE.CatmullRomCurve3(curvePoints);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, segments, 0.03, 6, false),
      new THREE.MeshPhysicalMaterial({
        color: 0x60a5fa,
        roughness: 0.3,
        metalness: 0.5,
        emissive: 0x60a5fa,
        emissiveIntensity: 0.1,
        transparent: true,
        opacity: 0.8,
      })
    );
    g.add(tube);

    // Radius label
    const label = this._makeTextSprite('R \u2265 1.0mm', '#60a5fa');
    label.position.set(r + 1.5, r, 0);
    label.scale.set(3, 1.5, 1);
    g.add(label);
    g.userData.label = label;

    g.position.set(FPC_W * 0.35, CARRIER_H + 1, FPC_D * 0.35);
    g.visible = false;
    this.bendIndicator = g;
    this.group.add(g);
  }

  _buildBendGlow() {
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 12, 12),
      new THREE.MeshBasicMaterial({
        color: 0xff4444,
        transparent: true,
        opacity: 0,
      })
    );
    glow.position.set(FPC_W * 0.35, CARRIER_H + 2.5, FPC_D * 0.35);
    this.bendGlow = glow;
    this.group.add(glow);
  }

  _buildParticles() {
    const count = 80;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * CARRIER_W * 0.8;
      pos[i * 3 + 1] = CARRIER_H + Math.random() * 0.3;
      pos[i * 3 + 2] = (Math.random() - 0.5) * CARRIER_D * 0.8;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x60a5fa,
      size: 0.03,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.particles = new THREE.Points(geo, mat);
    this.group.add(this.particles);
  }

  _buildHeatGlow() {
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(FPC_W * 0.6, FPC_D * 0.6),
      new THREE.MeshBasicMaterial({
        color: 0xff4400,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    glow.position.set(0, CARRIER_H + FPC_H + 0.02, 0);
    glow.rotation.x = -Math.PI / 2;
    this.heatGlow = glow;
    this.group.add(glow);
  }

  _makeTextSprite(text, color) {
    if (!this._texCanvas) {
      this._texCanvas = document.createElement('canvas');
      this._texCanvas.width = 256;
      this._texCanvas.height = 128;
      this._texCtx = this._texCanvas.getContext('2d');
      this._texTexture = new THREE.CanvasTexture(this._texCanvas);
      this._texTexture.needsUpdate = true;
    }
    const ctx = this._texCtx;
    ctx.clearRect(0, 0, 256, 128);
    ctx.fillStyle = color || '#ffffff';
    ctx.font = 'Bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 64);
    this._texTexture.needsUpdate = true;
    const mat = new THREE.SpriteMaterial({ map: this._texTexture, transparent: true, depthTest: false });
    return new THREE.Sprite(mat);
  }

  _buildUI() {
    const panel = document.getElementById('controlsContent');
    createControlPanel(panel, {
      groups: [{
        title: 'FPC Assembly',
        items: [{
          type: 'buttons',
          buttons: [
            { label: '\u25B6 Simulate', style: 'primary', key: 'play', onClick: () => {
              this.playing = !this.playing;
              this._refreshBtn('play', this.playing ? '\u23F8 Stop' : '\u25B6 Simulate');
              if (this.playing) { this.progress = 0; }
            }},
            { label: '\u23F9 Reset', key: 'reset', onClick: () => {
              this.playing = false; this.progress = 0; this._updateScene(0);
              this._refreshBtn('play', '\u25B6 Simulate');
              this._initStressColors();
              setStatus('Reset', '');
            }},
          ]
        }, {
          type: 'slider', label: 'Speed', key: 'speed', min: 0.2, max: 3, step: 0.1, value: 1, unit: '\u00D7',
          onChange: v => { this.speed = v; },
        }]
      }, {
        title: 'Design',
        items: [{
          type: 'select', label: 'Carrier', key: 'carrier',
          options: [
            { value: 'yes', label: 'With Carrier' },
            { value: 'no', label: 'Without Carrier' },
          ],
          value: 'yes',
          onChange: v => { this.showCarrier = v === 'yes'; if (this.carrier) this.carrier.visible = this.showCarrier; },
        }, {
          type: 'slider', label: 'Bend Radius', key: 'bend', min: 0, max: 100, step: 1, value: 50, unit: '%',
          onChange: v => {
            this.bendAmount = (v / 100) * 2.5;
            this._updateFPCBend();
            this._updateStressColors(this.bendAmount);
          },
        }, {
          type: 'legend',
          entries: [
            { color: '#cc8833', label: 'FPC Substrate' },
            { color: '#ddcc88', label: 'Stiffener' },
            { color: '#808080', label: 'Carrier Jig' },
            { color: '#60a5fa', label: 'Bend Radius' },
            { color: '#ef4444', label: 'Stress \u2265 Limit' },
          ]
        }]
      }, {
        title: 'Pre-bake',
        items: [{
          type: 'label', text: 'FPC moisture removed at 120\u00B0C / 2-4h'
        }, {
          type: 'buttons',
          buttons: [
            { label: 'Start Pre-bake', key: 'prebake', onClick: () => {
              if (this._prebaking) return;
              this._prebaking = true;
              this._doPrebake();
            }},
          ]
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
          ]
        }]
      }]
    });
  }

  async _doPrebake() {
    const btn = document.querySelector('.btn[data-key="prebake"]');
    if (btn) btn.disabled = true;

    // Animate heat glow over 3 seconds
    const duration = 120;
    for (let i = 0; i <= duration; i++) {
      if (!this._prebaking) break;
      const t = i / duration;
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      if (this.heatGlow) {
        this.heatGlow.material.opacity = ease * 0.3;
        this.heatGlow.scale.setScalar(1 + ease * 0.15);
      }
      SCENE.setBloomStrength(0.08 + ease * 0.1);
      setStatus('Pre-baking...', `120\u00B0C | ${Math.round(ease * 100)}%`);
      await this._wait(16);
    }

    SCENE.setBloomStrength(0.05);
    if (this.heatGlow) this.heatGlow.material.opacity = 0;
    this._prebaking = false;
    if (btn) btn.disabled = false;
    setStatus('Pre-bake Complete', 'Moisture removed \u2713');
  }

  _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _refreshBtn(key, label) {
    const btn = document.querySelector(`.btn[data-key="${key}"]`);
    if (btn) btn.textContent = label;
  }

  _updateFPCBend() {
    if (!this.fpc) return;
    const geo = this.fpc.geometry;
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      const x = pos.getX(i);
      const baseY = 0;
      const bend = this.bendAmount * Math.sin((z / FPC_D + 0.5) * Math.PI);
      const twist = this.bendAmount * 0.15 * Math.sin((x / FPC_W) * Math.PI * 2);
      pos.setY(i, baseY + bend + twist);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  update(dt, time) {
    if (!this.playing) return;
    this.progress += dt * 0.2 * this.speed;
    if (this.progress >= 1) {
      this.progress = 1;
      this.playing = false;
      this._refreshBtn('play', '\u25B6 Simulate');
      SCENE.setBloomStrength(0.05);
      setStatus('Assembly Complete', 'FPC mounted on carrier');
      return;
    }
    this._updateScene(this.progress);
    const stressLvl = Math.min(this.bendAmount || 0, 1);
    Analytics.push('FPCA', {
      stress: stressLvl,
      temp: 25 + this.progress * 130,
      progress: this.progress,
    });
  }

  _updateScene(t) {
    if (!this.fpc) return;

    const bendAmt = t * 2.5;
    this.bendAmount = bendAmt;
    this._updateFPCBend();
    this._updateStressColors(bendAmt);

    // Bloom modulation: increase during high-stress phases
    const stressLevel = Math.min(bendAmt / 2.5, 1);
    SCENE.setBloomStrength(0.05 + stressLevel * 0.12);

    // Bend indicator
    if (this.bendIndicator) {
      this.bendIndicator.visible = t > 0.3;
      const scale = 0.5 + t * 0.5;
      this.bendIndicator.scale.setScalar(scale);
      // Update radius text
      const currentR = Math.max(0.1, 3 * (1 - bendAmt / 3));
      const label = this.bendIndicator.userData.label;
      if (label && this._texCtx) {
        const color = currentR < 1 ? '#ef4444' : '#60a5fa';
        this._texCtx.clearRect(0, 0, 256, 128);
        this._texCtx.fillStyle = color;
        this._texCtx.font = 'Bold 28px sans-serif';
        this._texCtx.textAlign = 'center';
        this._texCtx.fillText(`R ${currentR.toFixed(1)}mm`, 128, 64);
        this._texTexture.needsUpdate = true;
        label.material.color.set(currentR < 1 ? '#ef4444' : '#60a5fa');
      }
    }

    // Bend glow warning
    if (this.bendGlow) {
      const danger = bendAmt > 1.8;
      this.bendGlow.visible = danger;
      if (danger) {
        this.bendGlow.material.opacity = 0.2 + Math.sin(performance.now() * 0.008) * 0.15;
        this.bendGlow.scale.setScalar(1 + Math.sin(performance.now() * 0.005) * 0.2);
      }
    }

    // Carrier visibility
    if (this.carrier) {
      this.carrier.visible = this.showCarrier && t > 0.1;
      // Vacuum particle engagement
      if (this.particles) {
        this.particles.material.opacity = t > 0.1 && t < 0.5 ? 0.3 * (1 - (t - 0.1) / 0.4) : 0;
        if (t > 0.1 && t < 0.5) {
          const pos = this.particles.geometry.attributes.position.array;
          for (let i = 0; i < pos.length / 3; i++) {
            pos[i * 3 + 1] -= 0.005;
            if (pos[i * 3 + 1] < CARRIER_H) pos[i * 3 + 1] = CARRIER_H + 0.3;
          }
          this.particles.geometry.attributes.position.needsUpdate = true;
        }
      }
    }

    // FPC placement
    this.fpc.position.y = CARRIER_H + FPC_H / 2 + (t > 0.1 ? 0 : 5 * (1 - t / 0.1));
    this.fpc.visible = t > 0.02;

    // Adhesive and stiffener
    if (this.adhesive) {
      if (t > 0.35 && t < 0.55) {
        this.adhesive.visible = true;
        this.adhesive.material.opacity = (t - 0.35) / 0.2;
      } else if (t >= 0.55) {
        this.adhesive.material.opacity = 1;
      } else {
        this.adhesive.visible = false;
      }
    }

    if (this.stiffener) {
      this.stiffener.visible = t > 0.5;
      const stiffT = Math.min((t - 0.5) / 0.15, 1);
      const ease = stiffT < 0.5 ? 2 * stiffT * stiffT : -1 + (4 - 2 * stiffT) * stiffT;
      this.stiffener.position.y = CARRIER_H + FPC_H + 0.05 + ease * 0.12;
      // Squeeze-out effect
      this.stiffener.scale.y = 0.5 + ease * 0.5;
    }

    setStatus(
      t < 0.1 ? 'Placing FPC...' :
      t < 0.3 ? 'Aligning...' :
      t < 0.5 ? 'Carrier Engagement' :
      t < 0.65 ? 'Stiffener Bonding' :
      t < 0.85 ? 'Inspecting Bend Radius' :
      'Complete',
      `Bend: ${(bendAmt * 10).toFixed(1)}mm | Stress: ${Math.round(stressLevel * 100)}%`
    );
  }

  destroy() {
    this._prebaking = false;
  }
}
