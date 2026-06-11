import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SceneBGA } from './scenes/SceneBGA.js';
import { SceneFlow } from './scenes/SceneFlow.js';
import { ScenePattern } from './scenes/ScenePattern.js';
import { SceneVoid } from './scenes/SceneVoid.js';
import { SceneWarpage } from './scenes/SceneWarpage.js';

const SCENE_REGISTRY = {
  bga: SceneBGA,
  flow: SceneFlow,
  pattern: ScenePattern,
  void: SceneVoid,
  warp: SceneWarpage,
};

let renderer, scene, camera, controls;
let activeScene = null;
let sceneContainer, sidebarNav, paramContainer, controlsContainer, statusEl;

function init() {
  sceneContainer = document.getElementById('scene-container');
  sidebarNav = document.getElementById('scene-nav');
  paramContainer = document.getElementById('param-panel');
  controlsContainer = document.getElementById('controls-bar');
  statusEl = document.getElementById('scene-status');

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  sceneContainer.appendChild(renderer.domElement);

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xF8FAFC);

  // Camera
  camera = new THREE.PerspectiveCamera(45, sceneContainer.clientWidth / sceneContainer.clientHeight, 0.1, 100);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 3;
  controls.maxDistance = 30;
  controls.target.set(0, 1, 0);

  // Scene list nav
  buildSceneNav();

  // Controls bar
  buildControlsBar();

  // Resize handler
  window.addEventListener('resize', onResize);

  // Start with Scene 1 (BGA)
  switchScene('bga');

  // Animation loop
  animate();
}

function buildSceneNav() {
  const scenes = [
    { id: 'bga', label: '1. BGA 封裝結構' },
    { id: 'flow', label: '2. 毛細流動模擬' },
    { id: 'pattern', label: '3. 點膠 Pattern 3D' },
    { id: 'void', label: '4. Void 生成模擬' },
    { id: 'warp', label: '5. Warpage 變形模擬' },
  ];

  sidebarNav.innerHTML = '';
  scenes.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'scene-nav-btn' + (s.disabled ? ' scene-nav-btn--disabled' : '');
    btn.dataset.scene = s.id;
    btn.textContent = s.label;
    if (!s.disabled) {
      btn.addEventListener('click', () => switchScene(s.id));
    }
    sidebarNav.appendChild(btn);
  });
}

function buildControlsBar() {
  controlsContainer.innerHTML = '';

  const bar = document.createElement('div');
  bar.className = 'control-bar';

  const btnPlay = makeBtn('▶', 'Play', () => { if (activeScene) activeScene.play(); updateStatus(); });
  const btnPause = makeBtn('⏸', 'Pause', () => { if (activeScene) activeScene.pause(); updateStatus(); });
  const btnReset = makeBtn('⏹', 'Reset', () => { if (activeScene) activeScene.reset(); });

  const speedGroup = document.createElement('div');
  speedGroup.className = 'ctrl-speed';
  const speedLbl = document.createElement('span');
  speedLbl.textContent = 'Speed';
  const speedSlider = document.createElement('input');
  speedSlider.type = 'range';
  speedSlider.className = 'ctrl-speed-slider';
  speedSlider.min = 0.1;
  speedSlider.max = 5;
  speedSlider.step = 0.1;
  speedSlider.value = 1;
  const speedVal = document.createElement('span');
  speedVal.className = 'ctrl-speed-val';
  speedVal.textContent = '1.0x';
  speedSlider.addEventListener('input', () => {
    const v = parseFloat(speedSlider.value);
    speedVal.textContent = v.toFixed(1) + 'x';
    if (activeScene) activeScene.setSpeed(v);
  });
  speedGroup.append(speedLbl, speedSlider, speedVal);

  const sceneLabel = document.createElement('span');
  sceneLabel.className = 'ctrl-scene-label';
  sceneLabel.id = 'scene-label';
  sceneLabel.textContent = 'BGA 封裝結構';

  bar.append(btnPlay, btnPause, btnReset, speedGroup, sceneLabel);
  controlsContainer.appendChild(bar);
}

function makeBtn(text, title, onClick) {
  const btn = document.createElement('button');
  btn.className = 'ctrl-btn';
  btn.textContent = text;
  btn.title = title;
  btn.addEventListener('click', onClick);
  return btn;
}

function switchScene(id) {
  if (activeScene) {
    activeScene.destroy();
  }

  const SceneClass = SCENE_REGISTRY[id];
  if (!SceneClass) return;

  activeScene = new SceneClass();
  activeScene.init(scene, camera);

  const label = document.getElementById('scene-label');
  if (label) label.textContent = activeScene.name;

  // Update nav active state
  document.querySelectorAll('.scene-nav-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(`.scene-nav-btn[data-scene="${id}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  // Build param panel
  buildParamPanel(activeScene.getParams());

  updateStatus();
  controls.target.set(0, 1, 0);
}

function buildParamPanel(params) {
  paramContainer.innerHTML = '';

  if (!params || params.length === 0) {
    paramContainer.innerHTML = '<div class="param-empty">無可調參數</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  params.forEach(cfg => {
    const group = document.createElement('div');
    group.className = 'param-group';

    const labelRow = document.createElement('div');
    labelRow.className = 'param-label-row';

    const label = document.createElement('span');
    label.className = 'param-label';
    label.textContent = cfg.label;

    const valueSpan = document.createElement('span');
    valueSpan.className = 'param-val';
    labelRow.append(label, valueSpan);

    let input;
    if (cfg.type === 'slider') {
      input = document.createElement('input');
      input.type = 'range';
      input.className = 'param-slider';
      input.min = cfg.min;
      input.max = cfg.max;
      input.step = cfg.step || 1;
      input.value = cfg.default ?? cfg.min;
      valueSpan.textContent = formatParamVal(cfg, parseFloat(input.value));
      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        valueSpan.textContent = formatParamVal(cfg, v);
        if (activeScene) activeScene.setParam(cfg.key, v);
      });
    } else if (cfg.type === 'select') {
      input = document.createElement('select');
      input.className = 'param-select';
      cfg.options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        input.appendChild(o);
      });
      input.value = cfg.default ?? cfg.options[0].value;
      valueSpan.textContent = cfg.options.find(o => o.value === input.value)?.label || input.value;
      input.addEventListener('change', () => {
        valueSpan.textContent = cfg.options.find(o => o.value === input.value)?.label || input.value;
        if (activeScene) activeScene.setParam(cfg.key, input.value);
      });
    }

    if (input) {
      group.appendChild(labelRow);
      group.appendChild(input);
      fragment.appendChild(group);
    }
  });

  paramContainer.appendChild(fragment);
}

function formatParamVal(cfg, val) {
  if (cfg.unit) return val + cfg.unit;
  if (cfg.step < 1) return val.toFixed(2);
  return Math.round(val).toString();
}

function updateStatus() {
  if (!statusEl || !activeScene) return;
  statusEl.textContent = activeScene.isAnimating() ? '模擬中' : '已暫停';
}

function onResize() {
  const w = sceneContainer.clientWidth;
  const h = sceneContainer.clientHeight;
  renderer.setSize(w, h);
  if (camera) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

let lastTime = 0;

function animate(time) {
  requestAnimationFrame(animate);

  const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0.016;
  lastTime = time;

  if (controls) controls.update();

  if (activeScene) {
    activeScene.update(dt);
  }

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

document.addEventListener('DOMContentLoaded', init);
