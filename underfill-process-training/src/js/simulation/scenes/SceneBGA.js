import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';

export class SceneBGA extends SceneBase {
  constructor() {
    super('BGA 封裝結構', 'BGA Package 3D 剖面結構');
    this._objects = [];
    this._autoRotate = false;
    this._hoveredObj = null;
  }

  init(scene, camera) {
    super.init(scene, camera);
    camera.position.set(12, 8, 14);
    camera.lookAt(0, 0, 0);
    this._buildScene();
  }

  _buildScene() {
    const scene = this._scene;
    const baseColor = 0x2563EB;

    // Grid helper
    const grid = new THREE.GridHelper(20, 20, 0x94A3B8, 0xE2E8F0);
    grid.position.y = -3;
    scene.add(grid);

    // Ambient + directional lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);

    // Substrate
    this._substrate = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.4, 10),
      new THREE.MeshStandardMaterial({ color: 0x1E3A5F, roughness: 0.6, metalness: 0.2 })
    );
    this._substrate.position.y = 0;
    scene.add(this._substrate);

    // Substrate pads (top surface)
    const padMat = new THREE.MeshStandardMaterial({ color: 0xC0A060, roughness: 0.3, metalness: 0.7 });
    for (let ix = -2; ix <= 2; ix++) {
      for (let iz = -2; iz <= 2; iz++) {
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 12), padMat);
        pad.position.set(ix * 1.2, 0.25, iz * 1.2);
        scene.add(pad);
      }
    }

    // Die (Silicon)
    this._die = new THREE.Mesh(
      new THREE.BoxGeometry(5, 0.6, 5),
      new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.2,
        metalness: 0.8,
        transparent: true,
        opacity: 0.85
      })
    );
    this._die.position.y = 0.8;
    scene.add(this._die);

    // Die top label surface
    const dieLabel = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 4.6),
      new THREE.MeshBasicMaterial({ color: 0x475569 })
    );
    dieLabel.rotation.x = -Math.PI / 2;
    dieLabel.position.y = 1.1;
    scene.add(dieLabel);

    // BGA Solder Balls
    const ballMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, roughness: 0.3, metalness: 0.6 });
    this._ballGroup = new THREE.Group();
    const spacing = 1.2;
    const count = 5;
    const offset = (count - 1) * spacing / 2;
    for (let ix = 0; ix < count; ix++) {
      for (let iz = 0; iz < count; iz++) {
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), ballMat);
        ball.position.set(ix * spacing - offset, 0.55, iz * spacing - offset);
        this._ballGroup.add(ball);
      }
    }
    scene.add(this._ballGroup);

    // Underfill Fillet (ring around die bottom)
    const filletShape = new THREE.Shape();
    const r = 2.8;
    const w = 0.6;
    filletShape.moveTo(r, 0);
    filletShape.quadraticCurveTo(r + w, 0, r + w, w);
    filletShape.quadraticCurveTo(r + w, w * 1.5, r, w * 1.5);
    filletShape.lineTo(r, 0);

    const filletMat = new THREE.MeshStandardMaterial({
      color: 0x3B82F6,
      transparent: true,
      opacity: 0.5,
      roughness: 0.4,
      side: THREE.DoubleSide
    });

    this._filletMeshes = [];
    [-Math.PI / 2, 0, Math.PI / 2, Math.PI].forEach(angle => {
      const fillet = new THREE.Mesh(
        new THREE.ShapeGeometry(filletShape),
        filletMat
      );
      fillet.rotation.y = angle;
      fillet.position.set(0, 0.35, 0);
      scene.add(fillet);
      this._filletMeshes.push(fillet);
    });

    // Dimension arrows (roughly)
    this._createDimensionLabels(scene);

    // Store references for parameter updates
    this._objects = [this._substrate, this._die, this._ballGroup, ...this._filletMeshes];
  }

  _createDimensionLabels(scene) {
    // Sprite-based dimension labels
    const labels = [
      { text: 'Die', pos: [0, 1.6, 2.8] },
      { text: 'Substrate', pos: [0, -0.3, 5.2] },
      { text: 'BGA Ball', pos: [3.2, 0.5, 3.2] },
      { text: 'Underfill', pos: [-3.8, 0.6, 0] },
    ];
    labels.forEach(({ text, pos }) => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.fillRect(0, 0, 256, 64);
      ctx.fillStyle = '#1E293B';
      ctx.font = 'bold 28px "Microsoft JhengHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(text, 128, 40);
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(pos[0], pos[1], pos[2]);
      sprite.scale.set(2, 0.5, 1);
      scene.add(sprite);
    });
  }

  update(dt) {
    super.update(dt);
    if (this._autoRotate) {
      this._scene.rotation.y += dt * 0.3;
    }
  }

  getParams() {
    return [
      { key: 'dieSize', label: 'Die Size', type: 'slider', min: 3, max: 8, step: 0.5, default: 5, unit: 'mm' },
      { key: 'ballDia', label: 'Ball Dia', type: 'slider', min: 0.2, max: 0.6, step: 0.05, default: 0.3, unit: 'mm' },
      { key: 'pitch', label: 'Pitch', type: 'slider', min: 0.8, max: 1.6, step: 0.1, default: 1.2, unit: 'mm' },
      { key: 'standoff', label: 'Standoff', type: 'slider', min: 0.3, max: 1.0, step: 0.05, default: 0.55, unit: 'mm' },
      { key: 'autoRotate', label: 'Auto Rotate', type: 'select', default: 'off',
        options: [{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }] },
    ];
  }

  setParam(name, value) {
    if (name === 'dieSize' && this._die) {
      const s = parseFloat(value);
      this._die.scale.set(s / 5, 1, s / 5);
    }
    if (name === 'ballDia' && this._ballGroup) {
      const d = parseFloat(value);
      this._ballGroup.children.forEach(child => {
        if (child.isMesh) child.scale.set(d / 0.3, d / 0.3, d / 0.3);
      });
    }
    if (name === 'autoRotate') {
      this._autoRotate = value === 'on';
    }
  }
}
