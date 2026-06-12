import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';

export class SceneWarpage extends SceneBase {
  constructor() {
    super('Warpage 變形模擬', '固化收縮與 CTE 不匹配導致的翹曲變形');
    this._params = {
      cteMismatch: 25,
      tgOffset: 0,
      cureTemp: 150,
    };
    this._tempCycle = 0;
    this._meshOriginal = null;
    this._colorBar = null;
  }

  init(scene, camera) {
    super.init(scene, camera);
    camera.position.set(10, 8, 12);
    camera.lookAt(0, 0, 0);
    this._buildScene();
  }

  _buildScene() {
    const scene = this._scene;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dl = new THREE.DirectionalLight(0xffffff, 0.8);
    dl.position.set(8, 15, 8);
    scene.add(dl);

    // Grid
    const grid = new THREE.GridHelper(16, 16, 0x94A3B8, 0xE2E8F0);
    grid.position.y = -1;
    scene.add(grid);

    // Package base (substrate)
    const subMat = new THREE.MeshStandardMaterial({
      color: 0x1E3A5F,
      roughness: 0.5,
      metalness: 0.2,
      flatShading: true
    });
    this._package = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 6), subMat);
    this._package.position.y = 0;
    scene.add(this._package);

    // Warpage overlay (color-coded deformation indicator)
    const warpGeo = new THREE.PlaneGeometry(5.8, 5.8, 20, 20);
    const warpMat = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
      wireframe: false
    });
    this._warpMesh = new THREE.Mesh(warpGeo, warpMat);
    this._warpMesh.rotation.x = -Math.PI / 2;
    this._warpMesh.position.y = 0.16;
    scene.add(this._warpMesh);

    // Store original vertex positions
    const pos = this._warpMesh.geometry.attributes.position;
    this._originalPos = new Float32Array(pos.array);

    // Die on top
    const dieMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.3,
      metalness: 0.5,
      transparent: true,
      opacity: 0.4
    });
    const die = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 3), dieMat);
    die.position.y = 0.3;
    scene.add(die);

    // Temperature indicator
    this._tempLabel = this._makeTextSprite('Temp: 25°C | Warpage: 0.00mm');
    this._tempLabel.position.set(0, 1.8, 0);
    this._tempLabel.scale.set(4, 0.6, 1);
    scene.add(this._tempLabel);

    // Color legend
    this._buildColorLegend(scene);
  }

  _makeTextSprite(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 64);
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 22px "Microsoft JhengHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 256, 40);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  }

  _buildColorLegend(scene) {
    const colors = [
      { pos: 0, color: '#3B82F6' },
      { pos: 0.33, color: '#10B981' },
      { pos: 0.66, color: '#F59E0B' },
      { pos: 1, color: '#EF4444' }
    ];

    const barWidth = 3;
    const barHeight = 0.15;
    const segments = 60;
    const barGeo = new THREE.PlaneGeometry(barWidth, barHeight, segments, 1);
    const colors_arr = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const c1 = this._hexToRGB(colors[0].color);
      const c2 = this._hexToRGB(colors[1].color);
      const c3 = this._hexToRGB(colors[2].color);
      const c4 = this._hexToRGB(colors[3].color);
      let r, g, b;
      if (t < 0.33) {
        const lt = t / 0.33;
        r = c1.r + (c2.r - c1.r) * lt;
        g = c1.g + (c2.g - c1.g) * lt;
        b = c1.b + (c2.b - c1.b) * lt;
      } else if (t < 0.66) {
        const lt = (t - 0.33) / 0.33;
        r = c2.r + (c3.r - c2.r) * lt;
        g = c2.g + (c3.g - c2.g) * lt;
        b = c2.b + (c3.b - c2.b) * lt;
      } else {
        const lt = (t - 0.66) / 0.34;
        r = c3.r + (c4.r - c3.r) * lt;
        g = c3.g + (c4.g - c3.g) * lt;
        b = c3.b + (c4.b - c3.b) * lt;
      }
      colors_arr.push(r, g, b);
      colors_arr.push(r, g, b);
    }
    barGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors_arr, 3));
    const barMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const bar = new THREE.Mesh(barGeo, barMat);
    bar.position.set(0, -0.2, 3.5);
    bar.rotation.x = -Math.PI / 2;
    scene.add(bar);

    // Legend labels
    const addLegendLabel = (text, x) => {
      const s = this._makeTextSprite(text);
      s.position.set(x, -0.1, 3.5);
      s.scale.set(0.8, 0.2, 1);
      scene.add(s);
    };
    addLegendLabel('Low', -1.5);
    addLegendLabel('High', 1.5);
  }

  _hexToRGB(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return { r, g, b };
  }

  update(dt) {
    super.update(dt);
    if (!this._animating) return;

    // Simulate temperature cycle (25°C → 165°C → 25°C)
    this._tempCycle += dt * 0.3;
    const cycleT = (Math.sin(this._tempCycle - Math.PI / 2) + 1) / 2;
    const temp = 25 + cycleT * (this._params.cureTemp - 25);

    // Calculate warpage based on CTE mismatch and temperature
    const cteFactor = this._params.cteMismatch / 100;
    const tgEffect = Math.max(0, (temp - (120 + this._params.tgOffset)) / 50);
    const warpAmount = cteFactor * cycleT * 0.3 + tgEffect * 0.15;

    this._deformPackage(temp, warpAmount);
    this._updateLabel(temp, warpAmount);
  }

  _deformPackage(temp, warpAmount) {
    if (!this._warpMesh) return;

    const pos = this._warpMesh.geometry.attributes.position;
    const arr = pos.array;

    for (let i = 0; i < arr.length / 3; i++) {
      const ix = i * 3;
      const x = this._originalPos[ix];
      const z = this._originalPos[ix + 2];

      // Parabolic deformation: max at center, zero at edges
      const dist = Math.sqrt(x * x + z * z) / 2.9;
      const deform = warpAmount * (1 - dist * dist) * (1 + Math.sin(temp * 0.02) * 0.1);

      arr[ix + 1] = this._originalPos[ix + 1] + deform;

      // Color mapping: blue → green → yellow → red
      const t = Math.min(1, deform / 0.3);
      const color = new THREE.Color();
      if (t < 0.33) color.setHSL(0.6 - t * 0.6, 0.8, 0.5);
      else if (t < 0.66) color.setHSL(0.4 - (t - 0.33) * 0.6, 0.8, 0.5);
      else color.setHSL(0.1 - (t - 0.66) * 0.3, 0.9, 0.5);
      arr[ix] = x;
      arr[ix + 2] = z;
    }

    pos.needsUpdate = true;
    this._warpMesh.geometry.computeVertexNormals();

    // Rotate package slightly to visualize warpage
    if (this._package) {
      this._package.rotation.x = warpAmount * 0.3;
      this._package.rotation.z = -warpAmount * 0.2;
    }
  }

  _updateLabel(temp, warpAmount) {
    if (!this._tempLabel) return;
    const tempRounded = Math.round(temp);
    const warpRounded = (warpAmount * 100).toFixed(2);
    this._tempLabel.material = this._makeTextSprite(
      `Temp: ${tempRounded}°C | Warpage: ${warpRounded}mm`
    ).material;
  }

  getParams() {
    return [
      { key: 'cteMismatch', label: 'CTE Mismatch (%)', type: 'slider', min: 0, max: 50, step: 1, default: 25, unit: '%' },
      { key: 'tgOffset', label: 'Tg Offset (°C)', type: 'slider', min: -30, max: 30, step: 1, default: 0, unit: '°C' },
      { key: 'cureTemp', label: 'Cure Temp (°C)', type: 'slider', min: 130, max: 170, step: 1, default: 150, unit: '°C' },
    ];
  }

  setParam(name, value) {
    this._params[name] = parseFloat(value);
  }

  reset() {
    super.reset();
    this._tempCycle = 0;
    if (this._warpMesh) {
      const pos = this._warpMesh.geometry.attributes.position;
      for (let i = 0; i < pos.array.length; i++) {
        pos.array[i] = this._originalPos[i];
      }
      pos.needsUpdate = true;
    }
    if (this._package) {
      this._package.rotation.x = 0;
      this._package.rotation.z = 0;
    }
    this._updateLabel(25, 0);
  }
}
