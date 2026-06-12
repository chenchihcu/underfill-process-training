import * as THREE from 'three';
import * as SCENE from '../scene.js';
import { createControlPanel, setStatus } from '../ui.js';
import * as Analytics from '../data/analytics.js';
import { StressFEA } from '../physics/stress-fea.js';

export class WarpageModule {
  constructor() {
    this.group = new THREE.Group();
    this.warpMesh = null;
    this.packageMesh = null;
    this.tempLabel = null;
    this.originalPos = null;
    this.params = { cteMismatch: 25, tgOffset: 0, cureTemp: 150 };
    this.tempCycle = 0;
    this.playing = false;
    this.progress = 0;
    this.speed = 1;
    this.stressSolver = null;
  }

  create() {
    SCENE.addToScene(this.group);
    this._buildScene();
    this._initStressSolver();
    this._buildUI();
    SCENE.setCameraPreset('angle');
  }

  _buildScene() {
    // Package base
    const subMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e3a5f,
      roughness: 0.5,
      metalness: 0.15,
      flatShading: true,
      clearcoat: 0.1,
    });
    this.packageMesh = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 6), subMat);
    this.packageMesh.position.y = 0;
    this.group.add(this.packageMesh);

    // Warpage overlay mesh (deformable plane)
    const warpGeo = new THREE.PlaneGeometry(5.8, 5.8, 24, 24);
    warpGeo.rotateX(-Math.PI / 2);

    const colors = new Float32Array(warpGeo.attributes.position.count * 3);
    warpGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const warpMat = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
      vertexColors: true,
    });
    this.warpMesh = new THREE.Mesh(warpGeo, warpMat);
    this.warpMesh.position.y = 0.16;
    this.group.add(this.warpMesh);

    // Store original vertex positions
    const pos = this.warpMesh.geometry.attributes.position;
    this.originalPos = new Float32Array(pos.array);

    // Die on top
    const dieMat = new THREE.MeshPhysicalMaterial({
      color: 0x475569,
      roughness: 0.3,
      metalness: 0.5,
      transparent: true,
      opacity: 0.35,
      clearcoat: 0.05,
    });
    const die = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 3), dieMat);
    die.position.y = 0.3;
    this.group.add(die);

    // Temperature / warpage label
    this.tempLabel = this._makeTextSprite('Temp: 25\u00B0C | Warpage: 0.00mm');
    this.tempLabel.position.set(0, 1.8, 0);
    this.tempLabel.scale.set(4, 0.6, 1);
    this.group.add(this.tempLabel);

    // Color legend bar
    this._buildColorLegend();
  }

  _initStressSolver() {
    this.stressSolver = new StressFEA({
      nx: 24, nz: 24,
      Lx: 5.8, Lz: 5.8,
      thickness: 1.0,
      youngsModulus: 17000,
      poisson: 0.17,
      cteSubstrate: 14e-6,
      cteDie: 3e-6,
      tRef: 25,
    });
  }

  _makeTextSprite(text) {
    if (!this._texCanvas) {
      this._texCanvas = document.createElement('canvas');
      this._texCanvas.width = 512;
      this._texCanvas.height = 64;
      this._texCtx = this._texCanvas.getContext('2d');
      this._texTexture = new THREE.CanvasTexture(this._texCanvas);
      this._texTexture.needsUpdate = true;
    }
    const ctx = this._texCtx;
    ctx.clearRect(0, 0, 512, 64);
    ctx.fillStyle = '#93c5fd';
    ctx.font = 'Bold 22px "Microsoft JhengHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 256, 40);
    this._texTexture.needsUpdate = true;
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: this._texTexture, transparent: true, depthTest: false }));
  }

  _buildColorLegend() {
    const colors = [
      { pos: 0, hex: '#3b82f6' },
      { pos: 0.33, hex: '#10b981' },
      { pos: 0.66, hex: '#f59e0b' },
      { pos: 1, hex: '#ef4444' },
    ];

    const barWidth = 3;
    const barHeight = 0.15;
    const segs = 60;
    const barGeo = new THREE.PlaneGeometry(barWidth, barHeight, segs, 1);
    const cArr = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const c = new THREE.Color();
      if (t < 0.33) c.lerpColors(new THREE.Color(colors[0].hex), new THREE.Color(colors[1].hex), t / 0.33);
      else if (t < 0.66) c.lerpColors(new THREE.Color(colors[1].hex), new THREE.Color(colors[2].hex), (t - 0.33) / 0.33);
      else c.lerpColors(new THREE.Color(colors[2].hex), new THREE.Color(colors[3].hex), (t - 0.66) / 0.34);
      cArr.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    barGeo.setAttribute('color', new THREE.Float32BufferAttribute(cArr, 3));
    const barMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const bar = new THREE.Mesh(barGeo, barMat);
    bar.position.set(0, -0.15, 3.5);
    bar.rotation.x = -Math.PI / 2;
    this.group.add(bar);

    const addLabel = (text, x) => {
      const s = this._makeTextSprite(text);
      s.position.set(x, -0.05, 3.5);
      s.scale.set(0.8, 0.2, 1);
      this.group.add(s);
    };
    addLabel('Low', -1.5);
    addLabel('High', 1.5);
  }

  _buildUI() {
    const panel = document.getElementById('controlsContent');
    createControlPanel(panel, {
      groups: [{
        title: 'Warpage Simulation',
        items: [{
          type: 'buttons',
          buttons: [
            { label: '\u25B6 Cycle', style: 'primary', key: 'play', onClick: () => {
              this.playing = !this.playing;
              this._refreshBtn('play', this.playing ? '\u23F8' : '\u25B6 Cycle');
              if (this.playing && this.progress >= 1) { this.progress = 0; this._resetMesh(); }
            }},
            { label: '\u23F9 Reset', key: 'reset', onClick: () => {
              this.playing = false; this.progress = 0;
              this._resetMesh();
              if (this.stressSolver) this.stressSolver.reset();
              this._refreshBtn('play', '\u25B6 Cycle');
              this._updateLabel(25, 0);
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
          type: 'slider', label: 'CTE Mismatch', key: 'cte', min: 0, max: 50, step: 1, value: 25, unit: '%',
          onChange: v => { this.params.cteMismatch = parseFloat(v); },
        }, {
          type: 'slider', label: 'Tg Offset', key: 'tg', min: -30, max: 30, step: 1, value: 0, unit: '\u00B0C',
          onChange: v => { this.params.tgOffset = parseFloat(v); },
        }, {
          type: 'slider', label: 'Cure Temp', key: 'cure', min: 130, max: 170, step: 1, value: 150, unit: '\u00B0C',
          onChange: v => { this.params.cureTemp = parseFloat(v); },
        }, {
          type: 'legend',
          entries: [
            { color: '#3b82f6', label: 'Low Strain' },
            { color: '#10b981', label: 'Medium' },
            { color: '#f59e0b', label: 'High' },
            { color: '#ef4444', label: 'Critical' },
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
          ]
        }]
      }]
    });
  }

  _refreshBtn(key, label) {
    const btn = document.querySelector(`.btn[data-key="${key}"]`);
    if (btn) btn.textContent = label;
  }

  _resetMesh() {
    if (!this.warpMesh || !this.originalPos) return;
    const pos = this.warpMesh.geometry.attributes.position;
    for (let i = 0; i < pos.array.length; i++) {
      pos.array[i] = this.originalPos[i];
    }
    pos.needsUpdate = true;
    this.warpMesh.geometry.computeVertexNormals();
    if (this.packageMesh) {
      this.packageMesh.rotation.x = 0;
      this.packageMesh.rotation.z = 0;
    }
  }

  _deformMesh(temp, warpAmount) {
    if (!this.warpMesh || !this.originalPos || !this.stressSolver) return;

    const pos = this.warpMesh.geometry.attributes.position;
    const col = this.warpMesh.geometry.attributes.color;
    const arr = pos.array;
    const nx = this.stressSolver.nx, nz = this.stressSolver.nz;

    for (let i = 0; i < arr.length / 3; i++) {
      const ix = i * 3;
      const x = this.originalPos[ix];
      const z = this.originalPos[ix + 2];
      const gx = Math.min(nx - 1, Math.max(0, Math.floor((x / 5.8 + 0.5) * nx)));
      const gz = Math.min(nz - 1, Math.max(0, Math.floor((z / 5.8 + 0.5) * nz)));
      const d = this.stressSolver.getDisplacement(gx, gz);
      const deform = d * 0.3 + warpAmount * 0.02 * Math.sin(x * 0.5 + z * 0.5 + temp * 0.01);

      arr[ix + 1] = this.originalPos[ix + 1] + deform;

      const t = Math.min(1, Math.abs(deform) / 0.25);
      const c = new THREE.Color();
      if (t < 0.33) c.setHSL(0.6 - t * 0.6, 0.8, 0.5);
      else if (t < 0.66) c.setHSL(0.4 - (t - 0.33) * 0.6, 0.8, 0.5);
      else c.setHSL(0.1 - (t - 0.66) * 0.3, 0.9, 0.5);
      col.setXYZ(i, c.r, c.g, c.b);
    }

    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.warpMesh.geometry.computeVertexNormals();

    if (this.packageMesh) {
      this.packageMesh.rotation.x = warpAmount * 0.3;
      this.packageMesh.rotation.z = -warpAmount * 0.2;
    }
  }

  _updateLabel(temp, warpAmount) {
    if (!this.tempLabel || !this._texCtx) return;
    const text = `Temp: ${Math.round(temp)}\u00B0C | Warpage: ${(warpAmount * 100).toFixed(2)}mm`;
    this._texCtx.clearRect(0, 0, 512, 64);
    this._texCtx.fillStyle = '#93c5fd';
    this._texCtx.font = 'Bold 22px "Microsoft JhengHei", sans-serif';
    this._texCtx.textAlign = 'center';
    this._texCtx.fillText(text, 256, 40);
    this._texTexture.needsUpdate = true;
  }

  update(dt, time) {
    if (!this.playing) return;

    this.progress += dt * 0.06 * this.speed;
    if (this.progress >= 1) {
      this.progress = 0; // Loop the cycle
    }

    const cycleT = (Math.sin(this.progress * Math.PI * 2 - Math.PI / 2) + 1) / 2;
    const temp = 25 + cycleT * (this.params.cureTemp - 25);

    // Feed temperature to FEA solver
    if (this.stressSolver) {
      this.stressSolver.fillTemperature(temp);
      this.stressSolver.step(dt);

      // CTE mismatch / tg effect mapped to extra deformation
      const cteFactor = this.params.cteMismatch / 100;
      const tgEffect = Math.max(0, (temp - (120 + this.params.tgOffset)) / 50);
      const warpAmount = cteFactor * cycleT * 0.3 + tgEffect * 0.15;

      // Read FEA max displacement
      const feaWarp = this.stressSolver.getMaxDisplacement();
      const combinedWarp = warpAmount + feaWarp * 0.5;

      this._deformMesh(temp, Math.min(combinedWarp, 0.5));
      this._updateLabel(temp, combinedWarp);

      // Bloom based on stress
      const maxStress = this.stressSolver.getStress(
        Math.floor(this.stressSolver.nx / 2),
        Math.floor(this.stressSolver.nz / 2)
      );
      const stress = Math.min(Math.abs(maxStress) / 50, 1);
      SCENE.setBloomStrength(0.05 + stress * 0.12);

      Analytics.push('Warpage', {
        temp: temp,
        warpage: combinedWarp * 100,
        feaDisplacement: feaWarp * 100,
        stress: Math.round(maxStress || 0),
        progress: this.progress,
      });

      setStatus(`Cycle: ${Math.round(temp)}\u00B0C`,
        `FEA Warpage: ${(combinedWarp * 100).toFixed(2)}mm | Stress: ${Math.round(maxStress || 0)}MPa`);
    }
  }

  destroy() {
    this.stressSolver = null;
    this.originalPos = null;
  }
}
