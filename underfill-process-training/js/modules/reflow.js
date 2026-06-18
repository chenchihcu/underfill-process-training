import * as THREE from 'three';
import * as SCENE from '../scene.js';
import { createControlPanel, setStatus } from '../ui.js';
import { matGold, matComponent, matSilver, matHotSolder } from '../helpers/materials.js';
import * as Analytics from '../data/analytics.js';
import { HeatSolver } from '../physics/heat-2d.js';

const PCB_W = 30, PCB_D = 30, PCB_H = 1.5;
const PAD_SIZE = 1.2;
const COMP_SIZE = 8;

const PROFILE_ZONES = [
  { name: 'Preheat', start: 0, end: 0.3, temp: [30, 150], desc: 'Solvent evaporation, 1.5-2\u00B0C/s' },
  { name: 'Soak', start: 0.3, end: 0.55, temp: [150, 180], desc: 'Activation, uniform heating' },
  { name: 'Reflow', start: 0.55, end: 0.8, temp: [180, 245, 230], desc: 'Peak 245\u00B0C, solder melts' },
  { name: 'Cooling', start: 0.8, end: 1.0, temp: [230, 80], desc: 'Cooling 2-4\u00B0C/s, joints solidify' },
];

export class ReflowModule {
  constructor() {
    this.group = new THREE.Group();
    this.joints = [];
    this.jointProfiles = [];
    this.component = null;
    this.pcbMesh = null;
    this.playing = false;
    this.progress = 0;
    this.speed = 1;
    this.thermalProfile = null;
    this.currentTemp = 30;
    this.hazeParticles = null;
    this._peakTemp = 245;
    this._timeAboveLiquidus = 0;
    this.heatSolver = null;
    this._prevTemp = 30;
  }

  create() {
    SCENE.addToScene(this.group);
    this._buildPCB();
    this._initHeatSolver();
    this._buildPads();
    this._buildJoints();
    this._buildComponent();
    this._buildHazeParticles();
    this._buildThermalProfile();
    this._buildUI();
    this._updateScene(0);
  }

  _buildPCB() {
    const segs = 16;
    const geo = new THREE.PlaneGeometry(PCB_W, PCB_D, segs, segs);
    geo.rotateX(-Math.PI / 2);
    const colors = new Float32Array(geo.attributes.position.count * 3);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const pcb = new THREE.Mesh(
      geo,
      new THREE.MeshPhysicalMaterial({
        color: 0x1a5c2a,
        roughness: 0.65,
        metalness: 0.05,
        clearcoat: 0.15,
        clearcoatRoughness: 0.4,
        vertexColors: true,
      })
    );
    pcb.position.y = PCB_H / 2;
    this.pcbMesh = pcb;
    this.group.add(pcb);

    // Bottom solid fill
    const bottom = new THREE.Mesh(
      new THREE.BoxGeometry(PCB_W, PCB_H * 0.5, PCB_D),
      new THREE.MeshPhysicalMaterial({
        color: 0x1a5c2a, roughness: 0.7, metalness: 0.05,
      })
    );
    bottom.position.y = PCB_H * 0.25;
    this.group.add(bottom);
  }

  _initHeatSolver() {
    const nx = 20, nz = 20;
    this.heatSolver = new HeatSolver({
      nx, nz,
      cellSize: PCB_W / nx,
      ovenProfile: (t) => this._getProfileTemp(t),
      ambientTemp: 30,
      liquidus: 183,
    });

    // Material map: high alpha for Cu pads, lower for FR4
    const cols = 5, rows = 5;
    const span = (cols - 1) * (PAD_SIZE + 0.4);
    const start = -span / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = start + c * (PAD_SIZE + 0.4);
        const pz = start + r * (PAD_SIZE + 0.4);
        const gx = Math.floor((px / PCB_W + 0.5) * nx);
        const gz = Math.floor((pz / PCB_D + 0.5) * nz);
        this.heatSolver.setRect(
          Math.max(0, gx - 1), Math.max(0, gz - 1),
          Math.min(nx - 1, gx + 1), Math.min(nz - 1, gz + 1),
          1.8 // copper thermal diffusivity
        );
      }
    }

    this._solverGridPositions = [];
    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const x = (ix / nx - 0.5) * PCB_W;
        const z = (iz / nz - 0.5) * PCB_D;
        this._solverGridPositions.push({ ix, iz, x, z });
      }
    }
  }

  _updatePCBGradient(t) {
    if (!this.pcbMesh || !this.heatSolver) return;
    const pos = this.pcbMesh.geometry.attributes.position;
    const col = this.pcbMesh.geometry.attributes.color;
    const grid = this.heatSolver.getTemperatureGrid();
    const nx = grid.nx, nz = grid.nz;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const gx = Math.min(nx - 1, Math.max(0, Math.floor((x / PCB_W + 0.5) * nx)));
      const gz = Math.min(nz - 1, Math.max(0, Math.floor((z / PCB_D + 0.5) * nz)));
      const temp = grid.data[gz * nx + gx];
      const localHeat = Math.min(Math.max((temp - 30) / 220, 0), 1);
      const hue = 0.3 - localHeat * 0.25;
      const sat = 0.5 + localHeat * 0.3;
      const light = 0.25 + localHeat * 0.35;
      const c = new THREE.Color().setHSL(hue, sat, light);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }

  _buildPads() {
    const cols = 5, rows = 5;
    const span = (cols - 1) * (PAD_SIZE + 0.4);
    const start = -span / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const pad = new THREE.Mesh(
          new THREE.BoxGeometry(PAD_SIZE, 0.05, PAD_SIZE),
          matGold
        );
        pad.position.set(start + c * (PAD_SIZE + 0.4), PCB_H, start + r * (PAD_SIZE + 0.4));
        this.group.add(pad);
      }
    }
  }

  _buildJoints() {
    const cols = 5, rows = 5;
    const span = (cols - 1) * (PAD_SIZE + 0.4);
    const start = -span / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const profile = this._makeJointProfile(0);
        const geo = new THREE.LatheGeometry(profile, 12);
        const mat = matSilver.clone();
        const joint = new THREE.Mesh(geo, mat);
        const x = start + c * (PAD_SIZE + 0.4);
        const z = start + r * (PAD_SIZE + 0.4);
        joint.position.set(x, PCB_H + 0.05, z);
        // Add slight random variation
        const randScale = 0.9 + Math.random() * 0.2;
        joint.scale.set(randScale, 0.8 + Math.random() * 0.4, randScale);
        joint.position.x += (Math.random() - 0.5) * 0.06;
        joint.position.z += (Math.random() - 0.5) * 0.06;
        this.group.add(joint);
        this.joints.push(joint);
        this.jointProfiles.push({ r, c, baseScale: randScale });
      }
    }
  }

  _makeJointProfile(t) {
    const pts = [];
    const segments = 8;
    const baseR = 0.18;
    const topR = 0.28;
    const height = 0.3;

    // t = 0: cylinder; t = 1: fillet with concave meniscus
    const wetting = Math.min(t * 1.2, 1);
    const rBot = baseR + (topR - baseR) * wetting * 0.3;
    const rTop = topR - wetting * 0.08;
    const h = height + wetting * 0.06;
    const waistIn = wetting * 0.03;

    for (let i = 0; i <= segments; i++) {
      const frac = i / segments;
      const y = frac * h;
      let r;
      if (frac < 0.2) {
        // Base — slightly wider
        r = rBot + (rTop - rBot) * (frac / 0.2) * 0.5;
      } else if (frac < 0.7) {
        // Body — slight waist
        const mid = (frac - 0.2) / 0.5;
        r = rBot + (rTop - rBot) * 0.5 - Math.sin(mid * Math.PI) * waistIn;
      } else {
        // Top — meniscus curve
        const topFrac = (frac - 0.7) / 0.3;
        r = rTop + (rTop * 0.3) * (1 - Math.cos(topFrac * Math.PI * 0.5)) * wetting;
      }
      pts.push(new THREE.Vector2(Math.max(r, 0.01), y));
    }
    return pts;
  }

  _rebuildJointGeo(t) {
    const profile = this._makeJointProfile(t);
    for (let i = 0; i < this.joints.length; i++) {
      const j = this.joints[i];
      const oldGeo = j.geometry;
      const newGeo = new THREE.LatheGeometry(profile, 12);
      j.geometry = newGeo;
      oldGeo.dispose();
    }
  }

  _buildComponent() {
    const comp = new THREE.Mesh(
      new THREE.BoxGeometry(COMP_SIZE, 1.5, COMP_SIZE),
      matComponent
    );
    comp.position.set(0, PCB_H + 0.15 + 0.75, 0);
    this.component = comp;
    this.group.add(comp);
  }

  _buildHazeParticles() {
    const count = 300;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * PCB_W * 0.8;
      pos[i * 3 + 1] = Math.random() * 3;
      pos[i * 3 + 2] = (Math.random() - 0.5) * PCB_D * 0.8;
      sizes[i] = 0.02 + Math.random() * 0.04;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      color: 0xff6633,
      size: 0.04,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.hazeParticles = new THREE.Points(geo, mat);
    this.group.add(this.hazeParticles);
  }

  _buildThermalProfile() {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 160;
    canvas.id = 'profileCanvas';
    canvas.style.cssText = 'width:100%;border-radius:8px;border:1px solid #E2E8F0;background:#F8FAFC;';
    this.thermalProfile = canvas;
    this._drawProfile(0, null, null);
  }

  _drawProfile(t, setpointTemps, measuredTemps) {
    const ctx = this.thermalProfile.getContext('2d');
    const w = 300, h = 160;
    ctx.clearRect(0, 0, w, h);

    const pad = { left: 30, right: 10, top: 10, bottom: 20 };
    const gw = w - pad.left - pad.right;
    const gh = h - pad.top - pad.bottom;

    // Grid lines
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    for (let temp = 50; temp <= 250; temp += 50) {
      const y = pad.top + gh * (1 - (temp - 30) / 220);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + gw, y);
      ctx.stroke();
    }
    ctx.strokeStyle = '#E2E8F0';
    ctx.strokeRect(pad.left, pad.top, gw, gh);

    // Y-axis labels
    ctx.fillStyle = '#64748B';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    for (let temp = 50; temp <= 250; temp += 50) {
      const y = pad.top + gh * (1 - (temp - 30) / 220);
      ctx.fillText(temp + '\u00B0C', pad.left - 4, y + 3);
    }

    // Zone backgrounds
    const zoneColors = ['#3b82f6', '#10B981', '#EF4444', '#3B82F6'];
    const zoneLabels = ['PRE', 'SOAK', 'REF', 'COOL'];
    for (let zi = 0; zi < PROFILE_ZONES.length; zi++) {
      const z = PROFILE_ZONES[zi];
      const x1 = pad.left + z.start * gw;
      const x2 = pad.left + z.end * gw;
      ctx.fillStyle = zoneColors[zi] + '22';
      ctx.fillRect(x1, pad.top, x2 - x1, gh);
      ctx.fillStyle = zoneColors[zi];
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(zoneLabels[zi], (x1 + x2) / 2, pad.top + gh + 12);
    }

    // Setpoint profile (thick line)
    const steps = 100;
    const spTemps = setpointTemps || [];
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const tt = i / steps;
      const temp = spTemps[i] !== undefined ? spTemps[i] : this._getProfileTemp(tt);
      const x = pad.left + (i / steps) * gw;
      const y = pad.top + gh * (1 - (temp - 30) / 220);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Measured profile overlay (thin, slightly offset for realism)
    if (measuredTemps && measuredTemps.length > 1) {
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      for (let i = 0; i < measuredTemps.length; i++) {
        const x = pad.left + (i / (measuredTemps.length - 1)) * gw;
        const y = pad.top + gh * (1 - (measuredTemps[i] - 30) / 220);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Cursor
    if (t > 0) {
      const cx = pad.left + t * gw;
      const cy = pad.top + gh * (1 - (this.currentTemp - 30) / 220);
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d9770644';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(cx, pad.top);
      ctx.lineTo(cx, pad.top + gh);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#d97706';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(Math.round(this.currentTemp) + '\u00B0C', cx + 6, cy - 4);
    }

    // Peak temp marker
    if (measuredTemps && measuredTemps.length > 0) {
      const peakVal = Math.max(...measuredTemps);
      const peakIdx = measuredTemps.indexOf(peakVal);
      const px = pad.left + (peakIdx / (measuredTemps.length - 1)) * gw;
      const py = pad.top + gh * (1 - (peakVal - 30) / 220);
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#EF4444';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Peak ' + Math.round(peakVal) + '\u00B0C', px, py - 8);
    }
  }

  _getProfileTemp(t) {
    for (const z of PROFILE_ZONES) {
      if (t >= z.start && t <= z.end) {
        const lt = (t - z.start) / (z.end - z.start);
        const temps = z.temp;
        if (temps.length === 3 && lt > 0.5) {
          const t2 = (lt - 0.5) * 2;
          return temps[1] + (temps[2] - temps[1]) * t2;
        }
        return temps[0] + (temps[temps.length - 1] - temps[0]) * lt;
      }
    }
    return 30;
  }

  _buildUI() {
    const panel = document.getElementById('controlsContent');

    createControlPanel(panel, {
      groups: [{
        title: 'Reflow Profile',
        items: [{
          type: 'buttons',
          buttons: [
            { label: '\u25B6 Run', style: 'primary', key: 'play', onClick: () => {
              this.playing = !this.playing;
              this._refreshBtn('play', this.playing ? '\u23F8' : '\u25B6 Run');
              if (this.playing && this.progress >= 1) { this.progress = 0; this._timeAboveLiquidus = 0; }
            }},
            { label: '\u23F9 Reset', key: 'reset', onClick: () => {
              this.playing = false; this.progress = 0; this._updateScene(0);
              this._refreshBtn('play', '\u25B6 Run');
              this._timeAboveLiquidus = 0;
              SCENE.setBloomStrength(0.05);
              setStatus('Reset', '');
            }},
          ]
        }, {
          type: 'slider', label: 'Speed', key: 'speed', min: 0.2, max: 3, step: 0.1, value: 1, unit: '\u00D7',
          onChange: v => { this.speed = v; },
        }, {
          type: 'slider', label: 'Peak Temp', key: 'peak', min: 210, max: 260, step: 1, value: 245, unit: '\u00B0C',
          onChange: v => {
            this._peakTemp = parseFloat(v);
            PROFILE_ZONES[2].temp[1] = this._peakTemp;
          },
        }]
      }, {
        title: 'Status',
        items: [{
          type: 'label', text: 'Ready'
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
        }, {
          type: 'legend',
          entries: [
            { color: '#ffd700', label: 'Cu Pad' },
            { color: '#ffaa33', label: 'Molten Solder' },
            { color: '#c0c0c0', label: 'Solid Joint' },
            { color: '#2a2a2a', label: 'Component' },
            { color: '#d97706', label: 'Thermal Profile' },
          ]
        }]
      }]
    });

    const profileContainer = document.createElement('div');
    profileContainer.className = 'ctrl-group';
    profileContainer.appendChild(this.thermalProfile);
    panel.appendChild(profileContainer);
  }

  _refreshBtn(key, label) {
    const btn = document.querySelector(`.btn[data-key="${key}"]`);
    if (btn) btn.textContent = label;
  }

  _updateZoneLabel(text) {
    const labels = document.querySelectorAll('.ctrl-group .ctrl-row span');
    for (const l of labels) {
      if (l.textContent === 'Ready' || l.textContent.startsWith('Zone:') || l.textContent.startsWith('Temp:') || l.textContent.startsWith('TAL:')) {
        l.textContent = text;
        break;
      }
    }
  }

  update(dt, time) {
    if (!this.playing) return;

    this._prevTemp = this.currentTemp;
    this.progress += dt * 0.08 * this.speed;
    if (this.progress >= 1) {
      this.progress = 1;
      this.playing = false;
      this._refreshBtn('play', '\u25B6 Run');
      SCENE.setBloomStrength(0.05);
      setStatus('Reflow Complete', 'Joints formed \u2713');
      return;
    }

    // Step solver
    if (this.heatSolver) this.heatSolver.step(dt, this.progress);

    this._updateScene(this.progress);
    Analytics.push('Reflow', {
      temp: this.currentTemp,
      tal: this._timeAboveLiquidus || 0,
      progress: this.progress,
    });
  }

  _updateScene(t) {
    if (this.heatSolver) {
      const maxT = this.heatSolver.getMaxTemperature();
      this.currentTemp = Math.max(maxT, this._getProfileTemp(t) * 0.6);
    } else {
      this.currentTemp = this._getProfileTemp(t);
    }

    // Track time above liquidus (183°C for SAC305)
    if (this.currentTemp >= 183 && this._prevTemp >= 183) {
      this._timeAboveLiquidus += 0.016;
    }
    if (this.currentTemp < 183) {
      this._timeAboveLiquidus = Math.max(0, this._timeAboveLiquidus - 0.005);
    }

    // Generate synthetic measured temps (slightly lagged from setpoint)
    const steps = 100;
    const measuredTemps = [];
    for (let i = 0; i <= steps; i++) {
      const tt = (i / steps) * t;
      const setpoint = this._getProfileTemp(tt);
      const lag = Math.min(tt * 0.3, 0.04);
      const noise = (Math.random() - 0.5) * 2;
      measuredTemps.push(setpoint * (1 - lag) + noise);
    }
    const setpointTemps = [];
    for (let i = 0; i <= steps; i++) {
      setpointTemps.push(this._getProfileTemp(i / steps));
    }

    this._drawProfile(t, setpointTemps, measuredTemps);
    this._updatePCBGradient(t);
    this._updateHaze(t);
    this._updateJoints(t);
    this._updateComponent(t);
    this._updateBloom(t);
    this._updateStatus(t);
  }

  _updateHaze(t) {
    if (!this.hazeParticles) return;
    const active = t > 0.1 && t < 0.85;
    this.hazeParticles.visible = active;
    if (!active) {
      this.hazeParticles.material.opacity = 0;
      return;
    }

    const intensity = t < 0.55 ? t / 0.55 : (1 - (t - 0.55) / 0.3) * 0.7;
    this.hazeParticles.material.opacity = 0.3 * intensity;

    const pos = this.hazeParticles.geometry.attributes.position.array;
    const sizes = this.hazeParticles.geometry.attributes.size.array;
    for (let i = 0; i < pos.length / 3; i++) {
      pos[i * 3 + 1] += 0.008 + intensity * 0.015;
      pos[i * 3] += Math.sin(performance.now() * 0.001 + i) * 0.002;
      if (pos[i * 3 + 1] > 4) {
        pos[i * 3 + 1] = 0;
        pos[i * 3] = (Math.random() - 0.5) * PCB_W * 0.8;
        pos[i * 3 + 2] = (Math.random() - 0.5) * PCB_D * 0.8;
      }
    }
    this.hazeParticles.geometry.attributes.position.needsUpdate = true;
  }

  _updateJoints(t) {
    if (t < 0.55) {
      // Pre-reflow: paste state
      this._rebuildJointGeo(0);
      for (const j of this.joints) {
        j.material.color.setHex(0xc0c0c0);
        j.material.emissive.setHex(0x000000);
        j.material.emissiveIntensity = 0;
        j.material.metalness = 0.4;
        j.position.y = PCB_H + 0.05;
      }
    } else if (t < 0.8) {
      // Reflow: melting
      const reflowT = (t - 0.55) / 0.25;
      const ease = reflowT < 0.5 ? 2 * reflowT * reflowT : -1 + (4 - 2 * reflowT) * reflowT;
      this._rebuildJointGeo(ease);

      for (let i = 0; i < this.joints.length; i++) {
        const j = this.joints[i];
        const meltColor = new THREE.Color(0xffaa33);
        const silver = new THREE.Color(0xc0c0c0);
        j.material.color.lerpColors(silver, meltColor, ease);
        j.material.emissive.setHex(0xff5500);
        j.material.emissiveIntensity = 0.15 + ease * 0.35;
        j.material.metalness = 0.5 + ease * 0.4;

        // Corner joints cool slightly faster
        const profile = this.jointProfiles[i];
        const isCorner = (profile.r === 0 || profile.r === 4) && (profile.c === 0 || profile.c === 4);
        const tempOffset = isCorner ? 0.85 : 1;
        j.material.emissiveIntensity *= tempOffset;

        j.position.y = PCB_H + 0.05 + ease * 0.15;
      }
    } else {
      // Cooling: solidification
      const coolT = (t - 0.8) / 0.2;
      const ease = coolT < 0.5 ? 2 * coolT * coolT : -1 + (4 - 2 * coolT) * coolT;
      this._rebuildJointGeo(1);

      for (let i = 0; i < this.joints.length; i++) {
        const j = this.joints[i];
        const coolColor = new THREE.Color(0xd0d0d0);
        const hotColor = new THREE.Color(0xffaa33);
        j.material.color.lerpColors(hotColor, coolColor, ease);
        j.material.emissive.setHex(0xff5500);
        j.material.emissiveIntensity = (0.5 - ease * 0.5) * 0.3;
        j.material.metalness = 0.9 - ease * 0.2;
        j.material.roughness = 0.15 + ease * 0.1;
      }
    }
  }

  _updateComponent(t) {
    if (!this.component) return;
    if (t < 0.55) {
      this.component.position.y = PCB_H + 0.15 + 0.75;
      this.component.rotation.z = 0;
      this.component.rotation.x = 0;
    } else if (t < 0.8) {
      const reflowT = (t - 0.55) / 0.25;
      const ease = reflowT < 0.5 ? 2 * reflowT * reflowT : -1 + (4 - 2 * reflowT) * reflowT;
      // Settle
      const settle = ease * 0.08;
      this.component.position.y = PCB_H + 0.15 + 0.75 - settle;
      // Surface tension wobble
      const wobble = Math.sin(ease * 20) * 0.003 * (1 - ease);
      this.component.rotation.z = wobble;
      this.component.rotation.x = wobble * 0.7;
    } else {
      this.component.position.y = PCB_H + 0.15 + 0.67;
      this.component.rotation.z = 0;
      this.component.rotation.x = 0;
    }
  }

  _updateBloom(t) {
    if (t < 0.55) SCENE.setBloomStrength(0.05);
    else if (t < 0.8) {
      const peak = (t - 0.55) / 0.25;
      const ease = peak < 0.5 ? 2 * peak * peak : -1 + (4 - 2 * peak) * peak;
      SCENE.setBloomStrength(0.05 + ease * 0.28);
    } else if (t < 0.9) {
      SCENE.setBloomStrength(0.15 * (1 - (t - 0.8) / 0.1));
    } else {
      SCENE.setBloomStrength(0.05);
    }
  }

  _updateStatus(t) {
    const zone = PROFILE_ZONES.find(z => t >= z.start && t <= z.end) || PROFILE_ZONES[0];
    const tal = this._timeAboveLiquidus.toFixed(1);
    this._updateZoneLabel(`Zone: ${zone.name} | ${Math.round(this.currentTemp)}\u00B0C | TAL: ${tal}s`);

    setStatus(
      t < 0.3 ? `Preheat: ${Math.round(this.currentTemp)}\u00B0C` :
      t < 0.55 ? `Soak: ${Math.round(this.currentTemp)}\u00B0C` :
      t < 0.8 ? `Reflow: ${Math.round(this.currentTemp)}\u00B0C` :
      `Cooling: ${Math.round(this.currentTemp)}\u00B0C`,
      `Time above liquidus: ${tal}s`
    );
  }

  destroy() {
    this.heatSolver = null;
    this.joints = [];
    this.jointProfiles = [];
  }
}
