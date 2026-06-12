import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';

const PATTERNS = {
  I: {
    label: 'I 型 (直線)',
    paths: [
      [{ x: -1.5, y: 0, z: 0 }, { x: 1.5, y: 0, z: 0 }]
    ]
  },
  L: {
    label: 'L 型 (轉角)',
    paths: [
      [{ x: -1.5, y: 0, z: -1.5 }, { x: 1.5, y: 0, z: -1.5 }],
      [{ x: 1.5, y: 0, z: -1.5 }, { x: 1.5, y: 0, z: 1.5 }]
    ]
  },
  U: {
    label: 'U 型 (三邊)',
    paths: [
      [{ x: -1.5, y: 0, z: -1.5 }, { x: 1.5, y: 0, z: -1.5 }],
      [{ x: 1.5, y: 0, z: -1.5 }, { x: 1.5, y: 0, z: 1.5 }],
      [{ x: 1.5, y: 0, z: 1.5 }, { x: -1.5, y: 0, z: 1.5 }]
    ]
  }
};

export class ScenePattern extends SceneBase {
  constructor() {
    super('點膠 Pattern 3D', 'I/L/U 點膠路徑 3D 可視化');
    this._currentPattern = 'L';
    this._needle = null;
    this._needlePath = [];
    this._needleProgress = 0;
    this._depositedLines = [];
    this._params = {
      needleGap: 0.15,
      speed: 1.0
    };
  }

  init(scene, camera) {
    super.init(scene, camera);
    camera.position.set(6, 5, 8);
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
    scene.add(new THREE.DirectionalLight(0xffffff, 0.3).position.set(-4, 5, -4));

    // Grid
    const grid = new THREE.GridHelper(12, 12, 0x94A3B8, 0xE2E8F0);
    grid.position.y = -0.5;
    scene.add(grid);

    // Substrate
    const subMat = new THREE.MeshStandardMaterial({ color: 0x1E3A5F, roughness: 0.5, metalness: 0.2 });
    const sub = new THREE.Mesh(new THREE.BoxGeometry(5, 0.15, 5), subMat);
    sub.position.y = 0;
    scene.add(sub);

    // BGA outline on substrate
    const bgaRing = new THREE.Mesh(
      new THREE.RingGeometry(1.8, 2, 32),
      new THREE.MeshBasicMaterial({ color: 0x60A5FA, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
    );
    bgaRing.rotation.x = -Math.PI / 2;
    bgaRing.position.y = 0.1;
    scene.add(bgaRing);

    // Die indicator
    const dieOutline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(2.4, 0.05, 2.4)),
      new THREE.LineBasicMaterial({ color: 0x94A3B8, transparent: true, opacity: 0.5 })
    );
    dieOutline.position.y = 0.1;
    scene.add(dieOutline);

    // Needle body
    const needleMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, metalness: 0.7, roughness: 0.3 });
    this._needle = new THREE.Group();

    const needleTube = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.8, 12), needleMat);
    needleTube.position.y = 0.4;
    this._needle.add(needleTube);

    const needleTip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 12), new THREE.MeshStandardMaterial({ color: 0x6B7280, metalness: 0.5 }));
    needleTip.position.y = 0.04;
    this._needle.add(needleTip);

    // Needle mount visual
    const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.1, 12), needleMat);
    mount.position.y = 0.8;
    this._needle.add(mount);

    this._needle.position.set(0, 0.15, -1.5);
    scene.add(this._needle);

    // Path guides (ghost paths)
    this._ghostLines = [];
    scene.add(this._ghostGroup = new THREE.Group());

    // Label
    this._patternLabel = this._makeTextSprite('L 型');
    this._patternLabel.position.set(0, 1.5, 0);
    this._patternLabel.scale.set(2.5, 0.6, 1);
    scene.add(this._patternLabel);

    // Build initial pattern
    this._buildPattern('L');
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

  _buildPattern(type) {
    const pattern = PATTERNS[type];
    if (!pattern) return;

    this._currentPattern = type;

    // Clear ghost paths
    while (this._ghostGroup.children.length) {
      this._ghostGroup.remove(this._ghostGroup.children[0]);
    }
    this._ghostLines = [];

    // Clear deposited lines
    if (this._depositedLines) {
      this._depositedLines.forEach(l => this._scene.remove(l));
    }
    this._depositedLines = [];

    // Build ghost paths
    const ghostMat = new THREE.LineBasicMaterial({
      color: 0x93C5FD,
      transparent: true,
      opacity: 0.3,
      linewidth: 1
    });

    this._needlePath = [];
    pattern.paths.forEach((segment, si) => {
      const points = segment.map(p => new THREE.Vector3(p.x, 0.15, p.z));
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geo, ghostMat);
      this._ghostGroup.add(line);
      this._ghostLines.push(line);

      // Collect path order
      if (si === 0) {
        this._needlePath.push(points[0]);
      }
      this._needlePath.push(points[1]);
    });

    // Update label
    this._patternLabel.material = this._makeTextSprite(pattern.label).material;

    // Reset animation
    this._needleProgress = 0;
    this._depositIndex = 0;
    this._segmentProgress = 0;
    this._needle.position.copy(this._needlePath[0] || new THREE.Vector3(0, 0.15, 0));
  }

  update(dt) {
    super.update(dt);

    if (!this._animating || this._needlePath.length < 2) return;

    const speed = this._params.speed * 0.3;
    this._segmentProgress += dt * speed;

    if (this._segmentProgress >= 1) {
      this._segmentProgress = 0;
      this._depositIndex++;
      if (this._depositIndex >= this._needlePath.length - 1) {
        this._depositIndex = 0;
        this._segmentProgress = 0;
        // Clear deposited lines for loop
        this._depositedLines.forEach(l => this._scene.remove(l));
        this._depositedLines = [];
      }
    }

    const i = this._depositIndex;
    const p0 = this._needlePath[i];
    const p1 = this._needlePath[i + 1];
    if (!p0 || !p1) return;

    const t = this._segmentProgress;
    const pos = new THREE.Vector3().lerpVectors(p0, p1, t);

    // Move needle
    this._needle.position.copy(pos);
    this._needle.position.y = 0.15 + this._params.needleGap;

    // Add deposited glue trail
    if (this._depositedLines.length === 0 || this._segmentProgress > 0.01) {
      this._updateDepositedLine(i, t);
    }
  }

  _updateDepositedLine(segIndex, t) {
    // Remove last deposited line if exists for this segment
    const existingIdx = this._depositedLines.findIndex(l => l.userData.segIndex === segIndex);
    if (existingIdx >= 0) {
      this._scene.remove(this._depositedLines[existingIdx]);
      this._depositedLines.splice(existingIdx, 1);
    }

    const p0 = this._needlePath[segIndex];
    const p1 = this._needlePath[segIndex + 1];
    if (!p0 || !p1) return;

    const mid = new THREE.Vector3().lerpVectors(p0, p1, t);
    mid.y = 0.16;

    const points = [p0.clone(), mid];
    const geo = new THREE.BufferGeometry().setFromPoints(points);

    // Color based on freshness
    const depositMat = new THREE.LineBasicMaterial({
      color: 0x3B82F6,
      linewidth: 2,
      transparent: true,
      opacity: 0.9
    });
    const line = new THREE.Line(geo, depositMat);
    line.userData.segIndex = segIndex;
    this._scene.add(line);
    this._depositedLines.push(line);
  }

  getParams() {
    return [
      {
        key: 'pattern', label: 'Pattern 選擇', type: 'select', default: 'L',
        options: [
          { value: 'I', label: 'I 型 (直線)' },
          { value: 'L', label: 'L 型 (轉角)' },
          { value: 'U', label: 'U 型 (三邊)' }
        ]
      },
      { key: 'needleGap', label: 'Needle Gap', type: 'slider', min: 0.05, max: 0.3, step: 0.01, default: 0.15, unit: 'mm' },
      { key: 'speed', label: 'Speed', type: 'slider', min: 0.2, max: 3.0, step: 0.1, default: 1.0, unit: 'x' },
    ];
  }

  setParam(name, value) {
    if (name === 'pattern') {
      this._buildPattern(value);
      this.play();
    } else if (name === 'needleGap') {
      this._params.needleGap = parseFloat(value);
    } else if (name === 'speed') {
      this._params.speed = parseFloat(value);
    }
  }

  play() {
    super.play();
  }

  reset() {
    super.reset();
    this._depositIndex = 0;
    this._segmentProgress = 0;
    this._depositedLines.forEach(l => this._scene.remove(l));
    this._depositedLines = [];
    if (this._needlePath.length > 0) {
      this._needle.position.copy(this._needlePath[0]);
      this._needle.position.y = 0.15 + this._params.needleGap;
    }
  }
}
