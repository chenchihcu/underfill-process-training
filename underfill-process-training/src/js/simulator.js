import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SPEC } from './spec.js';
import { estimateFlow } from './training-estimate.js';
import { getLanguage, onLanguageChange, setLanguage, t, translatePage } from './i18n.js';

const $ = (selector) => document.querySelector(selector);
const MODULES = {
  underfill: { name: 'Underfill Dispensing', authority: 'controlled', accent: 0xd97721 },
  spi: { name: 'SPI — Solder Paste Inspection', authority: 'training-only', accent: 0x2f80ed },
  fpca: { name: 'Flexible Printed Circuit Assembly', authority: 'training-only', accent: 0x8f5bd7 },
  reflow: { name: 'Reflow Thermal Profile', authority: 'training-only', accent: 0xe74c3c },
  bga: { name: 'BGA Cross-Section', authority: 'controlled', accent: 0x607d8b },
  flow: { name: 'Capillary Flow Lab', authority: 'experimental', accent: 0xd97721 },
  pattern: { name: 'Dispensing Pattern Lab', authority: 'controlled', accent: 0xd97721 },
  void: { name: 'Per-Joint Void Inspection', authority: 'controlled', accent: 0x34495e },
  warpage: { name: 'Warpage Analysis', authority: 'experimental', accent: 0xe67e22 }
};
const dimensions = { boardX: 30, boardZ: 24, boardY: 0.8, packageX: 12, packageZ: 12, packageY: 0.8, standoff: 0.35, ballDiameter: 0.45, pitch: 1.6 };
let renderer;
let scene;
let camera;
let controls;
let modelRoot;
let animationId;

function material(color, options = {}) { return new THREE.MeshStandardMaterial({ color, roughness: .55, metalness: .08, ...options }); }
function mesh(geometry, color, options) { return new THREE.Mesh(geometry, material(color, options)); }
function addBox(parent, size, position, color, options) { const object = mesh(new THREE.BoxGeometry(...size), color, options); object.position.set(...position); parent.add(object); return object; }

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
}

function addBoard(root, warped = false) {
  if (!warped) {
    addBox(root, [dimensions.boardX, dimensions.boardY, dimensions.boardZ], [0, 0, 0], 0x176f65);
    addBox(root, [dimensions.boardX, .06, dimensions.boardZ], [0, .43, 0], 0x2a8b78);
  } else {
    for (let index = -10; index <= 10; index += 1) {
      const x = index * 1.42;
      const y = Math.abs(index / 10) ** 2 * .9;
      const segment = addBox(root, [1.5, dimensions.boardY, dimensions.boardZ], [x, y, 0], 0x176f65);
      segment.rotation.z = index * .006;
    }
  }
  for (const [x,z] of [[-13,-10],[-13,10],[13,-10],[13,10]]) {
    const hole = mesh(new THREE.CylinderGeometry(.55,.55,.9,24),0x153739,{metalness:.35});
    hole.position.set(x,.02,z);
    root.add(hole);
  }
  for (let index=-4; index<=4; index+=1) {
    addBox(root,[7,.025,.10],[-9,.47,index*1.25],0xc58b35,{metalness:.65});
    addBox(root,[7,.025,.10],[9,.47,index*1.25],0xc58b35,{metalness:.65});
  }
}

function addPadsAndBalls(root, { paste = false, voids = false } = {}) {
  const random = seededRandom(3808);
  const ballY = dimensions.boardY / 2 + dimensions.ballDiameter / 2 + .06;
  for (let row = -3; row <= 3; row += 1) {
    for (let column = -3; column <= 3; column += 1) {
      const x = column * dimensions.pitch;
      const z = row * dimensions.pitch;
      const pad = mesh(new THREE.CylinderGeometry(.33, .33, .06, 24), 0xc98b2f, { metalness: .65 });
      pad.rotation.x = Math.PI / 2;
      pad.position.set(x, .46, z);
      root.add(pad);
      if (paste) {
        const volume = .18 + random() * .16;
        const deposit = addBox(root, [.55, volume, .55], [x, .5 + volume / 2, z], random() > .88 ? 0xd35400 : 0xadb5bd, { metalness: .4 });
        deposit.userData.trainingOnly = true;
      } else {
        const ball = mesh(new THREE.SphereGeometry(dimensions.ballDiameter / 2, 20, 14), 0xb7c1c5, { metalness: .72, roughness: .25 });
        ball.scale.y = 1.22;
        ball.position.set(x, ballY, z);
        root.add(ball);
        if (voids && random() > .82) {
          const defect = mesh(new THREE.SphereGeometry(.07 + random() * .05, 14, 10), 0x263238, { roughness: .9 });
          defect.position.set(x + (random() - .5) * .12, ballY + (random() - .5) * .12, z);
          root.add(defect);
        }
      }
    }
  }
}

function addPackage(root) {
  const packageY = dimensions.boardY / 2 + dimensions.ballDiameter + dimensions.standoff + dimensions.packageY / 2;
  addBox(root, [dimensions.packageX, dimensions.packageY, dimensions.packageZ], [0, packageY, 0], 0x263f50);
  addBox(root, [6, .45, 6], [0, packageY + .62, 0], 0x718b98, { metalness: .25 });
  const pinOne = mesh(new THREE.CylinderGeometry(.22,.22,.08,20),0xf4a261,{emissive:0x6f3100,emissiveIntensity:.2});
  pinOne.position.set(-5.2,packageY+.44,-5.2);
  root.add(pinOne);
  return packageY;
}

function addLabel(root, text, position) {
  const canvas=document.createElement('canvas');
  canvas.width=512;
  canvas.height=96;
  const context=canvas.getContext('2d');
  context.fillStyle='rgba(255,255,255,.92)';
  context.roundRect(4,4,504,88,18);
  context.fill();
  context.strokeStyle='#7fa39f';
  context.lineWidth=3;
  context.stroke();
  context.fillStyle='#123a3a';
  context.font='700 30px Segoe UI';
  context.textAlign='center';
  context.textBaseline='middle';
  context.fillText(text,256,48);
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthTest:false}));
  sprite.position.set(...position);
  sprite.scale.set(6.4,1.2,1);
  root.add(sprite);
}

function addDimensionLabels(root) {
  addLabel(root,'PCB 30 × 24 mm',[-9,1.1,11.8]);
  addLabel(root,'PACKAGE 12 mm',[0,3.3,0]);
  addLabel(root,'STANDOFF 0.35 mm',[8.4,1.25,0]);
}

function addUnderfill(root, progress, accent) {
  const width = Math.max(.15, dimensions.packageX * progress / 100);
  const x = -dimensions.packageX / 2 + width / 2;
  addBox(root, [width, .24, dimensions.packageZ - .25], [x, .84, 0], accent, { transparent: true, opacity: .74, roughness: .38 });
  addBox(root, [.5, .42, dimensions.packageZ + .6], [-dimensions.packageX / 2 - .12, .74, 0], accent, { transparent: true, opacity: .82 });
}

function addNozzle(root, clearance) {
  const x = -dimensions.packageX / 2 - 1.2;
  const tipY = 1.15 + clearance;
  const body = mesh(new THREE.CylinderGeometry(.36, .36, 4.2, 24), 0x899ca3, { metalness: .72 });
  body.position.set(x, tipY + 2.1, -dimensions.packageZ / 2 + .5);
  root.add(body);
  const tip = mesh(new THREE.CylinderGeometry(.34, .10, 1.3, 24), 0x61757d, { metalness: .78 });
  tip.position.set(x, tipY - .65, -dimensions.packageZ / 2 + .5);
  root.add(tip);
}

function addPattern(root, progress, accent) {
  const points = [new THREE.Vector3(-6.6,.55,-6.5),new THREE.Vector3(-6.6,.55,6.5),new THREE.Vector3(0,.55,6.5),new THREE.Vector3(6.6,.55,6.5)];
  const curve = new THREE.CatmullRomCurve3(points);
  const tube = mesh(new THREE.TubeGeometry(curve, Math.max(8, Math.round(progress)), .16, 12, false), accent, { transparent: true, opacity: .85 });
  tube.geometry.setDrawRange(0, Math.floor(tube.geometry.index.count * progress / 100));
  root.add(tube);
}

function addReflowZones(root, temperature) {
  const colors = [0x3498db,0xf1c40f,0xe67e22,0xe74c3c,0x9b59b6];
  colors.forEach((color, index) => {
    const zone = addBox(root, [5.4,.12,dimensions.boardZ + 3], [-12 + index * 6,.05,0], color, { transparent:true,opacity:.16 });
    zone.userData.temperature = Math.round(25 + (temperature - 25) * (index + 1) / colors.length);
  });
}

function addFpca(root, progress) {
  const geometry = new THREE.PlaneGeometry(18, 7, 18, 4);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    positions.setZ(index, Math.sin((x + progress / 12) * .45) * .45);
  }
  geometry.computeVertexNormals();
  const flex = mesh(geometry, 0xd8a631, { side: THREE.DoubleSide, metalness:.1 });
  flex.rotation.x = -Math.PI / 2;
  flex.position.set(0,2,-7);
  root.add(flex);
  addBox(root,[5,.7,3],[0,1.1,-3.5],0x35495e);
}

function buildModule(name) {
  if (modelRoot) scene.remove(modelRoot);
  modelRoot = new THREE.Group();
  scene.add(modelRoot);
  const config = MODULES[name];
  const progress = Number($('#progress').value);
  const clearance = Number($('#clearance').value);
  const temperature = Number($('#temperature').value);
  addBoard(modelRoot, name === 'warpage');
  if (name === 'spi') addPadsAndBalls(modelRoot, { paste: true });
  else addPadsAndBalls(modelRoot, { voids: name === 'void' });
  if (name !== 'spi') addPackage(modelRoot);
  if (['underfill','flow','pattern'].includes(name)) addUnderfill(modelRoot, progress, config.accent);
  if (name === 'underfill') addNozzle(modelRoot, clearance);
  if (name === 'pattern') addPattern(modelRoot, progress, config.accent);
  if (name === 'reflow') addReflowZones(modelRoot, temperature);
  if (name === 'fpca') addFpca(modelRoot, progress);
  if (name === 'bga') modelRoot.rotation.y = Math.PI / 10;
  addDimensionLabels(modelRoot);
  setCameraView(document.querySelector('.view-button.active')?.dataset.view || 'process');
  updateStatus(name);
}

function setCameraView(view='process') {
  const box = new THREE.Box3().setFromObject(modelRoot);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const distance = Math.max(size.x, size.y * 3, size.z) * 1.08;
  if (view === 'cross') camera.position.set(center.x + distance,center.y + distance * .18,center.z + distance * .06);
  else if (view === 'top') camera.position.set(center.x,center.y + distance * 1.15,center.z + .01);
  else camera.position.set(center.x + distance * .72,center.y + distance * .52,center.z + distance * .78);
  camera.near = Math.max(.01, distance / 100);
  camera.far = distance * 10;
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
}

function fitCamera() { setCameraView(document.querySelector('.view-button.active')?.dataset.view || 'process'); }

function updateStatus(name) {
  const config = MODULES[name];
  $('#moduleName').textContent = config.name;
  $('#renderStatus').textContent = `${dimensions.packageX} mm · ${config.authority.toUpperCase()} · ${SPEC.metadata.specVersion}`;
  $('#moduleAuthority').textContent = config.authority === 'training-only' ? t('sim.trainingOnly') : config.authority === 'controlled' ? t('sim.controlled') : t('sim.notCalibrated');
  const estimate = estimateFlow({ temperatureC: $('#temperature').value, gapMm: dimensions.standoff, viscosityPaS: 8, distanceMm: dimensions.packageX });
  $('#estimateValue').textContent = `${estimate.valueSeconds} s`;
  $('#modelVersion').textContent = estimate.model.version;
  updateFallback(name);
}

function updateFallback(name) {
  $('#fallbackTitle').textContent = `${MODULES[name].name} — 2D cross-section`;
  const progress = Number($('#progress').value);
  $('#fallbackUnderfill').setAttribute('d', `M270 305 H${270 + 3.6 * progress} V347 H270 Z`);
}

function createFallback() {
  $('#viewport').hidden = true;
  $('#fallback').hidden = false;
  const group = $('#fallbackBalls');
  group.replaceChildren(...Array.from({ length: 7 }, (_, index) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', String(310 + index * 47)); circle.setAttribute('cy', '330'); circle.setAttribute('r', '16'); return circle;
  }));
  updateStatus($('#moduleSelect').value);
}

function initializeThree() {
  if (new URLSearchParams(location.search).get('fallback') === '1') throw new Error('Forced fallback');
  const viewport = $('#viewport');
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeaf1f0);
  camera = new THREE.PerspectiveCamera(38, viewport.clientWidth / viewport.clientHeight, .1, 500);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewport.append(renderer.domElement);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 8;
  controls.maxDistance = 90;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x315b58, 2.4));
  const key = new THREE.DirectionalLight(0xffffff, 3.2); key.position.set(14,24,12); key.castShadow = true; scene.add(key);
  const fill = new THREE.DirectionalLight(0x9fe5dc, 1.2); fill.position.set(-16,8,-12); scene.add(fill);
  const grid = new THREE.GridHelper(50,50,0x8aa8a4,0xcbdad8); grid.position.y = -.45; scene.add(grid);
  buildModule('underfill');
  const animate = () => { animationId = requestAnimationFrame(animate); controls.update(); renderer.render(scene,camera); };
  animate();
  const resize = () => { if (!renderer) return; camera.aspect = viewport.clientWidth / viewport.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(viewport.clientWidth,viewport.clientHeight); };
  new ResizeObserver(resize).observe(viewport);
}

function initializeControls() {
  ['temperature','pressure','clearance','progress'].forEach((id) => {
    const input = $(`#${id}`); const output = $(`#${id}Value`);
    input.addEventListener('input', () => { output.value = input.value; if (renderer) buildModule($('#moduleSelect').value); else updateStatus($('#moduleSelect').value); });
  });
  $('#moduleSelect').addEventListener('change', (event) => renderer ? buildModule(event.target.value) : updateStatus(event.target.value));
  document.querySelectorAll('.view-button').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('.view-button').forEach((candidate) => candidate.classList.toggle('active',candidate===button));
    if (renderer) setCameraView(button.dataset.view);
  }));
  $('#resetCamera').addEventListener('click', () => { if (renderer) fitCamera(); });
  $('#languageSelect').value = getLanguage();
  $('#languageSelect').addEventListener('change', (event) => setLanguage(event.target.value));
  onLanguageChange(() => updateStatus($('#moduleSelect').value));
  translatePage();
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator && !import.meta.env.DEV) navigator.serviceWorker.register('./sw.js');
}

initializeControls();
try { initializeThree(); } catch (error) { console.warn('3D unavailable; using 2D fallback.', error.message); createFallback(); }
registerServiceWorker();
window.addEventListener('beforeunload', () => { if (animationId) cancelAnimationFrame(animationId); renderer?.dispose(); });
