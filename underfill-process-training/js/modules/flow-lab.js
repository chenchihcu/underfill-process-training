import * as THREE from 'three';
import * as SCENE from '../scene.js';
import { createControlPanel, setStatus } from '../ui.js';
import * as Analytics from '../data/analytics.js';

export class FlowLabModule {
  constructor() {
    this.group = new THREE.Group();
    this.fillMesh = null;
    this.frontLine = null;
    this.particles = null;
    this.infoSprite = null;
    this.arrow = null;
    this.flowUniforms = null;
    this.progress = 0;
    this.playing = false;
    this.speed = 1;
    this.params = { viscosity: 0.5, temperature: 80, gap: 0.08 };
  }

  create() {
    SCENE.addToScene(this.group);
    this._buildScene();
    this._buildUI();
    SCENE.setCameraPreset('side');
  }

  _buildScene() {
    // Substrate (translucent)
    const subMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e3a5f,
      transparent: true,
      opacity: 0.25,
      roughness: 0.3,
      metalness: 0.1,
      side: THREE.DoubleSide,
      clearcoat: 0.1,
    });
    const substrate = new THREE.Mesh(new THREE.BoxGeometry(6, 0.15, 6), subMat);
    substrate.position.y = 0;
    this.group.add(substrate);

    // Substrate outline
    const subEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(6, 0.15, 6)),
      new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.3 })
    );
    subEdge.position.y = 0;
    this.group.add(subEdge);

    // Die (semi-transparent)
    const dieMat = new THREE.MeshPhysicalMaterial({
      color: 0x475569,
      transparent: true,
      opacity: 0.25,
      roughness: 0.1,
      metalness: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const die = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 4), dieMat);
    die.position.y = 0.4;
    this.group.add(die);

    // Die outline
    const dieEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(4, 0.4, 4)),
      new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.4 })
    );
    dieEdge.position.y = 0.4;
    this.group.add(dieEdge);

    // Gap visualization
    const gapMat = new THREE.MeshBasicMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
    });
    this.gapBox = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.02, 3.8), gapMat);
    this.gapBox.position.y = 0.2;
    this.group.add(this.gapBox);

    // Flow fill mesh (ShaderMaterial with progress)
    this.flowUniforms = {
      uProgress: { value: 0 },
      uColorFill: { value: new THREE.Color(0x3b82f6) },
      uColorFront: { value: new THREE.Color(0x60a5fa) },
      uTime: { value: 0 },
    };
    const flowMat = new THREE.ShaderMaterial({
      uniforms: this.flowUniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uProgress;
        uniform vec3 uColorFill;
        uniform vec3 uColorFront;
        uniform float uTime;
        varying vec2 vUv;

        void main() {
          vec2 centered = vUv - 0.5;
          float dist = length(centered);
          float filled = 1.0 - smoothstep(0.0, 0.5, dist - uProgress * 0.5);

          float frontGlow = exp(-pow((dist - uProgress * 0.5) * 20.0, 2.0));
          vec3 glow = uColorFront * frontGlow * 0.5;

          float ripple = sin(dist * 30.0 - uTime * 2.0) * 0.05;
          vec3 col = mix(vec3(0.02, 0.05, 0.1), uColorFill, filled) + glow + ripple;

          float alpha = filled * 0.65 + frontGlow * 0.3;
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.fillMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), flowMat);
    this.fillMesh.rotation.x = -Math.PI / 2;
    this.fillMesh.position.y = 0.2;
    this.group.add(this.fillMesh);

    // Flow front indicator line
    const frontMat = new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    this.frontLine = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 0.04), frontMat);
    this.frontLine.rotation.x = -Math.PI / 2;
    this.frontLine.position.y = 0.21;
    this.group.add(this.frontLine);

    // Flow direction arrow
    this.arrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(-2, 0.25, 0), 1.5, 0x3b82f6, 0.4, 0.3
    );
    this.group.add(this.arrow);

    // Particles
    this._initParticles();

    // Labels
    this._addLabel('Die', 0, 0.8, 2.3);
    this._addLabel('Substrate', 0, -0.2, 3.3);
    this._addLabel('Gap', 0.3, 0.35, 2.4);

    // Info sprite
    this.infoSprite = this._makeTextSprite('Fill: 0%');
    this.infoSprite.position.set(0, 0.9, 0);
    this.infoSprite.scale.set(2.5, 0.6, 1);
    this.group.add(this.infoSprite);
  }

  _initParticles() {
    const count = 800;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const offsets = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 3.4;
      pos[i * 3 + 1] = 0.2 + (Math.random() - 0.5) * 0.02;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 3.4;
      sizes[i] = 0.02 + Math.random() * 0.03;
      offsets[i] = Math.random();
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    geo.setAttribute('offset', new THREE.Float32BufferAttribute(offsets, 1));

    const mat = new THREE.PointsMaterial({
      color: 0x60a5fa,
      size: 0.04,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.particles = new THREE.Points(geo, mat);
    this.group.add(this.particles);
    this._particleGeo = geo;
    this._offsets = offsets;
  }

  _addLabel(text, x, y, z) {
    const s = this._makeTextSprite(text);
    s.position.set(x, y, z);
    s.scale.set(1.5, 0.4, 1);
    this.group.add(s);
  }

  _makeTextSprite(text) {
    if (!this._texCanvas) {
      this._texCanvas = document.createElement('canvas');
      this._texCanvas.width = 256;
      this._texCanvas.height = 64;
      this._texCtx = this._texCanvas.getContext('2d');
      this._texTexture = new THREE.CanvasTexture(this._texCanvas);
      this._texTexture.needsUpdate = true;
    }
    const ctx = this._texCtx;
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = '#93c5fd';
    ctx.font = 'Bold 24px "Microsoft JhengHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 38);
    this._texTexture.needsUpdate = true;
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: this._texTexture, transparent: true, depthTest: false }));
  }

  _buildUI() {
    const panel = document.getElementById('controlsContent');
    createControlPanel(panel, {
      groups: [{
        title: 'Capillary Flow',
        items: [{
          type: 'buttons',
          buttons: [
            { label: '\u25B6 Flow', style: 'primary', key: 'play', onClick: () => {
              this.playing = !this.playing;
              this._refreshBtn('play', this.playing ? '\u23F8' : '\u25B6 Flow');
              if (this.playing && this.progress >= 1) this.progress = 0;
            }},
            { label: '\u23F9 Reset', key: 'reset', onClick: () => {
              this.playing = false; this.progress = 0;
              this._updateScene(0);
              this._refreshBtn('play', '\u25B6 Flow');
            }},
          ]
        }, {
          type: 'slider', label: 'Speed', key: 'speed', min: 0.2, max: 3, step: 0.1, value: 1, unit: '\u00D7',
          onChange: v => { this.speed = v; },
        }]
      }, {
        title: 'Parameters',
        items: [{
          type: 'slider', label: 'Viscosity', key: 'viscosity', min: 0.1, max: 1, step: 0.05, value: 0.5,
          onChange: v => { this.params.viscosity = parseFloat(v); },
        }, {
          type: 'slider', label: 'Temperature', key: 'temp', min: 65, max: 95, step: 1, value: 80, unit: '\u00B0C',
          onChange: v => { this.params.temperature = parseFloat(v); },
        }, {
          type: 'slider', label: 'Gap', key: 'gap', min: 0.03, max: 0.15, step: 0.01, value: 0.08, unit: 'mm',
          onChange: v => {
            this.params.gap = parseFloat(v);
            if (this.gapBox) this.gapBox.scale.y = parseFloat(v) / 0.08;
          },
        }, {
          type: 'legend',
          entries: [
            { color: '#3b82f6', label: 'Underfill Flow' },
            { color: '#60a5fa', label: 'Flow Front' },
            { color: '#475569', label: 'Die' },
          ]
        }]
      }, {
        title: 'View',
        items: [{
          type: 'buttons',
          buttons: [
            { label: 'Side', onClick: () => SCENE.setCameraPreset('side', true) },
            { label: 'Top', onClick: () => SCENE.setCameraPreset('top', true) },
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

  update(dt, time) {
    if (!this.playing) return;

    const speedFactor = (1 - this.params.viscosity * 0.5) * (1 + (this.params.temperature - 65) / 60);
    const advance = dt * 0.12 * this.speed * speedFactor;

    this.progress += advance;
    if (this.progress >= 1) {
      this.progress = 1;
      this.playing = false;
      this._refreshBtn('play', '\u25B6 Flow');
      setStatus('Flow Complete', 'Capillary fill finished');
      return;
    }

    this._updateScene(this.progress);
    if (this.flowUniforms) this.flowUniforms.uTime.value = time * 0.001;
  }

  _updateScene(t) {
    if (!this.fillMesh) return;

    const eased = t < 0.5 ? 0.5 * Math.pow(2 * t, 0.8) : 1 - 0.5 * Math.pow(2 * (1 - t), 0.8);
    if (this.flowUniforms) this.flowUniforms.uProgress.value = eased;

    // Front line position
    if (this.frontLine) {
      const x = -1.9 + eased * 3.8;
      this.frontLine.position.x = x;
      this.frontLine.material.opacity = 0.4 + Math.sin(performance.now() * 0.004) * 0.3;
    }

    // Particles
    if (this.particles && this._particleGeo) {
      const pos = this._particleGeo.attributes.position.array;
      for (let i = 0; i < pos.length / 3; i++) {
        const baseX = (this._offsets[i] - 0.5) * 3.4;
        const targetX = baseX + eased * 3.4 - 1.7;
        pos[i * 3] += (targetX - pos[i * 3]) * 0.03;
        pos[i * 3 + 2] += Math.sin(performance.now() * 0.001 + i) * 0.001;
      }
      this._particleGeo.attributes.position.needsUpdate = true;
      this.particles.material.opacity = 0.2 + eased * 0.3;
    }

    // Info
    if (this.infoSprite && this._texCtx) {
      const pct = Math.round(eased * 100);
      this._texCtx.clearRect(0, 0, 256, 64);
      this._texCtx.fillStyle = '#93c5fd';
      this._texCtx.font = 'Bold 24px "Microsoft JhengHei", sans-serif';
      this._texCtx.textAlign = 'center';
      this._texCtx.fillText(`Fill: ${pct}%`, 128, 38);
      this._texTexture.needsUpdate = true;
    }

    // Arrow
    if (this.arrow) {
      this.arrow.position.x = -2 + eased * 2;
    }

    Analytics.push('FlowLab', {
      fill: eased * 100,
      progress: this.progress,
    });

    setStatus(`Filling ${Math.round(eased * 100)}%`,
      `Viscosity: ${this.params.viscosity.toFixed(2)} | Temp: ${this.params.temperature}\u00B0C`);
  }

  destroy() {
    this._particleGeo = null;
    this._offsets = null;
  }
}
