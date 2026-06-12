import * as THREE from 'three';
import * as SCENE from '../scene.js';
import { createControlPanel, setStatus } from '../ui.js';

export class BGAModule {
  constructor() {
    this.group = new THREE.Group();
    this.substrate = null;
    this.die = null;
    this.ballGroup = null;
    this.fillets = [];
    this.labels = [];
    this._autoRotate = false;
  }

  create() {
    SCENE.addToScene(this.group);
    this._buildScene();
    this._buildUI();
    SCENE.setCameraPreset('angle');
  }

  _buildScene() {
    this._buildSubstrate();
    this._buildPads();
    this._buildDie();
    this._buildBalls();
    this._buildUnderfill();
    this._buildLabels();
  }

  _buildSubstrate() {
    const sub = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.4, 10),
      new THREE.MeshPhysicalMaterial({
        color: 0x1a3a5f, roughness: 0.5, metalness: 0.15,
        clearcoat: 0.1, clearcoatRoughness: 0.4,
      })
    );
    sub.position.y = 0.2;
    this.substrate = sub;
    this.group.add(sub);

    // Edge
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(10, 0.4, 10)),
      new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.15 })
    );
    edge.position.y = 0.2;
    this.group.add(edge);
  }

  _buildPads() {
    const padMat = new THREE.MeshPhysicalMaterial({
      color: 0xc0a060, roughness: 0.2, metalness: 0.8,
      envMapIntensity: 1.2,
    });
    for (let ix = -2; ix <= 2; ix++) {
      for (let iz = -2; iz <= 2; iz++) {
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 12), padMat);
        pad.position.set(ix * 1.2, 0.42, iz * 1.2);
        this.group.add(pad);
      }
    }
  }

  _buildDie() {
    const die = new THREE.Mesh(
      new THREE.BoxGeometry(5, 0.6, 5),
      new THREE.MeshPhysicalMaterial({
        color: 0x334155,
        roughness: 0.15,
        metalness: 0.8,
        transparent: true,
        opacity: 0.85,
        clearcoat: 0.1,
        envMapIntensity: 1.0,
      })
    );
    die.position.y = 0.8;
    this.die = die;
    this.group.add(die);

    // Die top marking
    const topLabel = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 4.6),
      new THREE.MeshBasicMaterial({ color: 0x475569 })
    );
    topLabel.rotation.x = -Math.PI / 2;
    topLabel.position.y = 1.1;
    this.group.add(topLabel);

    // Die edge
    const dieEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(5, 0.6, 5)),
      new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.3 })
    );
    dieEdge.position.y = 0.8;
    this.group.add(dieEdge);
  }

  _buildBalls() {
    const ballMat = new THREE.MeshPhysicalMaterial({
      color: 0x94a3b8, roughness: 0.2, metalness: 0.8,
      clearcoat: 0.05, envMapIntensity: 1.5,
    });
    this.ballGroup = new THREE.Group();
    const spacing = 1.2;
    const count = 5;
    const offset = (count - 1) * spacing / 2;
    for (let ix = 0; ix < count; ix++) {
      for (let iz = 0; iz < count; iz++) {
        const ball = new THREE.Mesh(
          new THREE.SphereGeometry(0.3, 16, 16),
          ballMat
        );
        ball.position.set(ix * spacing - offset, 0.55, iz * spacing - offset);
        this.ballGroup.add(ball);
      }
    }
    this.group.add(this.ballGroup);
  }

  _buildUnderfill() {
    const filletMat = new THREE.MeshPhysicalMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.4,
      roughness: 0.3,
      metalness: 0,
      clearcoat: 0.2,
      side: THREE.DoubleSide,
    });

    const shape = new THREE.Shape();
    const r = 2.8;
    const w = 0.6;
    shape.moveTo(r, 0);
    shape.quadraticCurveTo(r + w, 0, r + w, w);
    shape.quadraticCurveTo(r + w, w * 1.5, r, w * 1.5);
    shape.lineTo(r, 0);

    this.fillets = [];
    for (const angle of [-Math.PI / 2, 0, Math.PI / 2, Math.PI]) {
      const fillet = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        filletMat
      );
      fillet.rotation.y = angle;
      fillet.position.set(0, 0.35, 0);
      this.group.add(fillet);
      this.fillets.push(fillet);
    }
  }

  _buildLabels() {
    const entries = [
      { text: 'Die', pos: [0, 1.6, 2.8], scale: 2 },
      { text: 'Substrate', pos: [0, -0.2, 5.2], scale: 2 },
      { text: 'BGA Ball', pos: [3.5, 0.5, 3.5], scale: 2 },
      { text: 'Underfill', pos: [-3.8, 0.6, 0], scale: 2 },
    ];
    for (const { text, pos, scale } of entries) {
      const sprite = this._makeLabel(text);
      sprite.position.set(pos[0], pos[1], pos[2]);
      sprite.scale.set(scale, scale * 0.3, 1);
      this.group.add(sprite);
      this.labels.push(sprite);
    }
  }

  _makeLabel(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = '#93c5fd';
    ctx.font = 'Bold 28px "Microsoft JhengHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 40);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  }

  _buildUI() {
    const panel = document.getElementById('controlsContent');
    createControlPanel(panel, {
      groups: [{
        title: 'BGA Package',
        items: [{
          type: 'buttons',
          buttons: [
            { label: 'Auto Rotate', key: 'rotate', onClick: () => {
              this._autoRotate = !this._autoRotate;
              const btn = document.querySelector('.btn[data-key="rotate"]');
              if (btn) btn.classList.toggle('active', this._autoRotate);
            }},
            { label: 'Reset View', onClick: () => SCENE.setCameraPreset('angle', true) },
          ]
        }]
      }, {
        title: 'Parameters',
        items: [{
          type: 'slider', label: 'Die Size', key: 'dieSize', min: 3, max: 8, step: 0.5, value: 5, unit: 'mm',
          onChange: v => { if (this.die) { const s = parseFloat(v) / 5; this.die.scale.set(s, 1, s); } },
        }, {
          type: 'slider', label: 'Ball Dia', key: 'ballDia', min: 0.2, max: 0.6, step: 0.05, value: 0.3, unit: 'mm',
          onChange: v => { if (this.ballGroup) { const d = parseFloat(v) / 0.3; this.ballGroup.children.forEach(c => { if (c.isMesh) c.scale.set(d, d, d); }); } },
        }, {
          type: 'slider', label: 'Pitch', key: 'pitch', min: 0.8, max: 1.6, step: 0.1, value: 1.2, unit: 'mm',
          onChange: v => { this._rebuildBallPositions(parseFloat(v)); },
        }, {
          type: 'legend',
          entries: [
            { color: '#334155', label: 'Die (Silicon)' },
            { color: '#94a3b8', label: 'Solder Ball' },
            { color: '#1a3a5f', label: 'Substrate' },
            { color: '#3b82f6', label: 'Underfill' },
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

  _rebuildBallPositions(pitch) {
    if (!this.ballGroup) return;
    const count = 5;
    const offset = (count - 1) * pitch / 2;
    let idx = 0;
    for (let ix = 0; ix < count; ix++) {
      for (let iz = 0; iz < count; iz++) {
        const ball = this.ballGroup.children[idx];
        if (ball) {
          ball.position.set(ix * pitch - offset, 0.55, iz * pitch - offset);
        }
        idx++;
      }
    }
  }

  update(dt, time) {
    if (this._autoRotate) {
      this.group.rotation.y += dt * 0.3;
    }
  }

  destroy() {
    this.fillets = [];
    this.labels = [];
  }
}
