import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';

export class SceneVoid extends SceneBase {
  constructor() {
    super('Void 生成模擬', 'Air Lock / 氣泡生成過程 3D 模擬');
    this._voids = [];
    this._params = {
      speed: 1.0,
      stagingTime: 4,
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
    dl.position.set(8, 15, 8);
    scene.add(dl);

    // Grid
    const grid = new THREE.GridHelper(12, 12, 0x94A3B8, 0xE2E8F0);
    grid.position.y = -1;
    scene.add(grid);

    // Substrate
    const sub = new THREE.Mesh(
      new THREE.BoxGeometry(6, 0.15, 6),
      new THREE.MeshStandardMaterial({ color: 0x1E3A5F, roughness: 0.5 })
    );
    sub.position.y = 0;
    scene.add(sub);

    // Die (transparent for void visibility)
    const die = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.4, 4),
      new THREE.MeshStandardMaterial({
        color: 0x475569,
        transparent: true,
        opacity: 0.2,
        roughness: 0.1,
        metalness: 0.3,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    die.position.y = 0.4;
    scene.add(die);

    // Die edge
    const dieEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(4, 0.4, 4)),
      new THREE.LineBasicMaterial({ color: 0x94A3B8, transparent: true, opacity: 0.3 })
    );
    dieEdge.position.y = 0.4;
    scene.add(dieEdge);

    // Cross-section plane (semi-transparent clippable wall)
    const crossMat = new THREE.MeshBasicMaterial({
      color: 0xDBEAFE,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
    });
    const cross = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 0.5), crossMat);
    cross.rotation.y = Math.PI / 4;
    cross.position.set(0, 0.2, 0);
    scene.add(cross);

    // Labels
    this._addLabel('Die', 0, 0.8, 2.3);
    this._addLabel('Substrate', 0, -0.2, 3.3);

    // Void count display
    this._voidLabel = this._makeTextSprite('Voids: 0');
    this._voidLabel.position.set(0, 1.2, 0);
    this._voidLabel.scale.set(2.5, 0.6, 1);
    scene.add(this._voidLabel);

    // Initial void seeds
    this._voidSeeds = [];
    for (let i = 0; i < 5; i++) {
      this._voidSeeds.push({
        x: (Math.random() - 0.5) * 2.5,
        z: (Math.random() - 0.5) * 2.5,
        birthTime: Math.random() * 3,
        size: 0.05 + Math.random() * 0.08,
        drift: new THREE.Vector2((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1)
      });
    }
  }

  _makeTextSprite(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 26px "Microsoft JhengHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 40);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  }

  _addLabel(text, x, y, z) {
    const s = this._makeTextSprite(text);
    s.position.set(x, y, z);
    s.scale.set(1.5, 0.4, 1);
    this._scene.add(s);
  }

  update(dt) {
    super.update(dt);
    if (!this._animating) return;

    const speed = this._params.speed;

    // Generate new voids based on staging time (longer staging = more voids)
    const spawnRate = 0.3 + (this._params.stagingTime / 12) * 0.7;
    if (Math.random() < dt * speed * spawnRate * 0.3) {
      this._spawnVoid();
    }

    // Update existing voids
    const toRemove = [];
    this._voids.forEach((v, i) => {
      v.life += dt * speed;
      v.mesh.position.x += v.drift.x * dt * speed;
      v.mesh.position.z += v.drift.y * dt * speed;
      v.mesh.position.y = 0.2 + Math.sin(v.life * 2) * 0.01;

      // Grow void
      const grow = 1 + v.life * 0.3;
      v.mesh.scale.set(grow, grow, grow);
      v.mesh.material.opacity = Math.max(0, 1 - v.life / 6);

      // Mark for removal
      if (v.life > 6 || v.mesh.material.opacity <= 0) {
        toRemove.push(i);
      }
    });

    // Remove expired voids
    toRemove.reverse().forEach(i => {
      this._scene.remove(this._voids[i].mesh);
      this._voids.splice(i, 1);
    });

    this._updateVoidLabel();
  }

  _spawnVoid() {
    if (this._voids.length > 30) return;

    const seed = this._voidSeeds[Math.floor(Math.random() * this._voidSeeds.length)];
    const size = seed.size * (0.5 + Math.random() * 0.5);

    const geo = new THREE.SphereGeometry(size, 16, 16);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xEF4444,
      transparent: true,
      opacity: 0.7,
      roughness: 0.1,
      metalness: 0.0,
      clearcoat: 0.3,
      envMapIntensity: 0.5
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      seed.x + (Math.random() - 0.5) * 0.5,
      0.2,
      seed.z + (Math.random() - 0.5) * 0.5
    );

    this._scene.add(mesh);
    this._voids.push({
      mesh,
      life: 0,
      drift: new THREE.Vector2((Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02)
    });
  }

  _updateVoidLabel() {
    if (!this._voidLabel) return;
    const count = this._voids.length;
    this._voidLabel.material = this._makeTextSprite(`Voids: ${count}`).material;
  }

  getParams() {
    return [
      { key: 'speed', label: 'Speed', type: 'slider', min: 0.2, max: 3.0, step: 0.1, default: 1.0, unit: 'x' },
      { key: 'stagingTime', label: 'Staging Time', type: 'slider', min: 1, max: 12, step: 0.5, default: 4, unit: 'hr' },
    ];
  }

  setParam(name, value) {
    this._params[name] = parseFloat(value);
  }

  reset() {
    super.reset();
    this._voids.forEach(v => this._scene.remove(v.mesh));
    this._voids = [];
    this._updateVoidLabel();
  }
}
