import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';

export class SceneFlow extends SceneBase {
  constructor() {
    super('毛細流動模擬', 'Underfill 毛細流動 3D 模擬');
    this._particles = null;
    this._fillMesh = null;
    this._progress = 0;
    this._fillDir = 1;
    this._params = {
      viscosity: 0.5,
      temperature: 80,
      gap: 0.08,
      speed: 1.0
    };
  }

  init(scene, camera) {
    super.init(scene, camera);
    camera.position.set(8, 6, 10);
    camera.lookAt(0, 0, 0);
    this._buildScene();
  }

  _buildScene() {
    const scene = this._scene;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dl = new THREE.DirectionalLight(0xffffff, 0.8);
    dl.position.set(8, 15, 10);
    scene.add(dl);
    scene.add(new THREE.DirectionalLight(0xffffff, 0.3).position.set(-5, 5, -5));

    // Grid
    const grid = new THREE.GridHelper(14, 14, 0x94A3B8, 0xE2E8F0);
    grid.position.y = -1.5;
    scene.add(grid);

    // Substrate (translucent)
    const subMat = new THREE.MeshStandardMaterial({
      color: 0x1E3A5F,
      transparent: true,
      opacity: 0.3,
      roughness: 0.3,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    const substrate = new THREE.Mesh(new THREE.BoxGeometry(6, 0.15, 6), subMat);
    substrate.position.y = 0;
    scene.add(substrate);

    // Substrate outline
    const subEdge = new THREE.EdgesGeometry(new THREE.BoxGeometry(6, 0.15, 6));
    const subLine = new THREE.LineSegments(subEdge, new THREE.LineBasicMaterial({ color: 0x3B82F6, transparent: true, opacity: 0.4 }));
    subLine.position.y = 0;
    scene.add(subLine);

    // Die (semi-transparent to see flow inside)
    const dieMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      transparent: true,
      opacity: 0.3,
      roughness: 0.1,
      metalness: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const die = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 4), dieMat);
    die.position.y = 0.4;
    scene.add(die);

    // Die outline
    const dieEdge = new THREE.EdgesGeometry(new THREE.BoxGeometry(4, 0.4, 4));
    const dieLine = new THREE.LineSegments(dieEdge, new THREE.LineBasicMaterial({ color: 0x94A3B8 }));
    dieLine.position.y = 0.4;
    scene.add(dieLine);

    // Gap visualization (thin box showing the gap between die and substrate)
    const gapMat = new THREE.MeshBasicMaterial({
      color: 0xDBEAFE,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide
    });
    this._gapBox = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.01, 3.8), gapMat);
    this._gapBox.position.y = 0.2;
    scene.add(this._gapBox);

    // Flow fill mesh (will grow along the gap)
    const flowMat = new THREE.MeshPhysicalMaterial({
      color: 0x3B82F6,
      transparent: true,
      opacity: 0.6,
      roughness: 0.2,
      metalness: 0.0,
      clearcoat: 0.1,
      side: THREE.DoubleSide,
    });
    this._fillMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), flowMat);
    this._fillMesh.rotation.x = -Math.PI / 2;
    this._fillMesh.position.y = 0.2;
    this._fillMesh.material.clippingPlanes = [];

    // Flow front indicator (moving line)
    const frontMat = new THREE.MeshBasicMaterial({
      color: 0x60A5FA,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    this._frontLine = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 0.04), frontMat);
    this._frontLine.rotation.x = -Math.PI / 2;
    this._frontLine.position.y = 0.21;
    scene.add(this._frontLine);
    scene.add(this._fillMesh);

    // Flow direction arrow
    this._arrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(-2, 0.25, 0), 1.5, 0x3B82F6, 0.4, 0.3
    );
    scene.add(this._arrow);

    // Dimension labels (sprites)
    this._addLabel('Die', 0, 0.8, 2.3);
    this._addLabel('Substrate', 0, -0.2, 3.3);
    this._addLabel('Gap', 0.3, 0.35, 2.4);

    // Flow info text sprite
    this._infoSprite = this._makeTextSprite('Fill: 0%');
    this._infoSprite.position.set(0, 0.9, 0);
    this._infoSprite.scale.set(2.5, 0.6, 1);
    scene.add(this._infoSprite);

    // Particle system for flow visualization
    this._initParticles(scene);
  }

  _initParticles(scene) {
    const count = 800;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const offsets = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 3.4;
      positions[i * 3 + 1] = 0.2 + (Math.random() - 0.5) * 0.02;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 3.4;
      sizes[i] = 0.02 + Math.random() * 0.03;
      offsets[i] = Math.random();
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('offset', new THREE.BufferAttribute(offsets, 1));

    const mat = new THREE.PointsMaterial({
      color: 0x60A5FA,
      size: 0.04,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this._particles = new THREE.Points(geo, mat);
    scene.add(this._particles);
    this._particleGeo = geo;
  }

  _addLabel(text, x, y, z) {
    const sprite = this._makeTextSprite(text);
    sprite.position.set(x, y, z);
    sprite.scale.set(1.5, 0.4, 1);
    this._scene.add(sprite);
  }

  _makeTextSprite(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 24px "Microsoft JhengHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 38);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  }

  update(dt) {
    super.update(dt);

    if (!this._animating) return;

    const speed = this._params.speed * (1 - this._params.viscosity * 0.5) * (1 + (this._params.temperature - 65) / 60);
    const advance = dt * 0.15 * speed;

    this._progress += advance * this._fillDir;

    if (this._progress > 1) {
      this._progress = 1;
      this._fillDir = 0;
    }
    if (this._progress < 0) {
      this._progress = 0;
      this._fillDir = 1;
    }

    this._updateFlowMesh();
    this._updateParticles(dt);
    this._updateFrontLine();
    this._updateInfo();
  }

  _updateFlowMesh() {
    if (!this._fillMesh) return;

    // Scale the fill mesh to show progress
    const scale = Math.max(0.01, this._progress);
    this._fillMesh.scale.x = scale;
    this._fillMesh.scale.y = scale;
    this._fillMesh.material.opacity = 0.3 + this._progress * 0.4;

    // Color shift: blue → green as fill progresses
    const r = 0.23 - this._progress * 0.15;
    const g = 0.5 + this._progress * 0.3;
    const b = 0.96 - this._progress * 0.3;
    this._fillMesh.material.color.setRGB(r, g, b);
  }

  _updateParticles(dt) {
    if (!this._particles || !this._particleGeo) return;
    const positions = this._particleGeo.attributes.position.array;
    const offsets = this._particleGeo.attributes.offset.array;

    for (let i = 0; i < positions.length / 3; i++) {
      // Particles move in the direction of flow
      const baseX = (offsets[i] - 0.5) * 3.4;
      const targetX = baseX + this._progress * 3.4 - 1.7;
      positions[i * 3] += (targetX - positions[i * 3]) * dt * 0.5;
      positions[i * 3 + 2] += (Math.sin(this._elapsed + i) * 0.001);
    }
    this._particleGeo.attributes.position.needsUpdate = true;
  }

  _updateFrontLine() {
    if (!this._frontLine) return;
    const x = -1.9 + this._progress * 3.8;
    this._frontLine.position.x = x;
    // Pulse opacity
    this._frontLine.material.opacity = 0.4 + Math.sin(this._elapsed * 4) * 0.3;
  }

  _updateInfo() {
    if (!this._infoSprite) return;
    const pct = Math.round(this._progress * 100);
    const tex = this._makeTextSprite(`Fill: ${pct}%`);
    this._infoSprite.material = tex.material;
    this._infoSprite.material.map = tex.material.map;
  }

  getParams() {
    return [
      { key: 'viscosity', label: 'Viscosity (黏度)', type: 'slider', min: 0.1, max: 1.0, step: 0.05, default: 0.5, unit: '' },
      { key: 'temperature', label: 'Temp (溫度)', type: 'slider', min: 65, max: 95, step: 1, default: 80, unit: '°C' },
      { key: 'gap', label: 'Gap (間隙)', type: 'slider', min: 0.03, max: 0.15, step: 0.01, default: 0.08, unit: 'mm' },
      { key: 'speed', label: 'Speed (速度)', type: 'slider', min: 0.2, max: 3.0, step: 0.1, default: 1.0, unit: 'x' },
    ];
  }

  setParam(name, value) {
    this._params[name] = parseFloat(value);

    // Visual feedback for gap change
    if (name === 'gap' && this._gapBox) {
      const g = parseFloat(value);
      this._gapBox.scale.y = g / 0.08;
      this._gapBox.material.opacity = 0.1 + g * 1.5;
    }
  }

  play() {
    super.play();
    this._fillDir = 1;
  }

  reset() {
    super.reset();
    this._progress = 0;
    this._fillDir = 1;
    this._updateFlowMesh();
    this._updateFrontLine();
    this._updateInfo();

    // Reset particles
    if (this._particleGeo) {
      const positions = this._particleGeo.attributes.position.array;
      const offsets = this._particleGeo.attributes.offset.array;
      for (let i = 0; i < positions.length / 3; i++) {
        positions[i * 3] = (offsets[i] - 0.5) * 3.4;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 3.4;
      }
      this._particleGeo.attributes.position.needsUpdate = true;
    }
  }
}
