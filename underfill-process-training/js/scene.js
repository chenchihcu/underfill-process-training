import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

let scene, camera, renderer, controls, composer;
let bloomPass;
let list = [];
let _cameraAnimId = null;

export function initScene(container) {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080c18);

  camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 0.1, 500);
  camera.position.set(50, 35, 50);
  camera.lookAt(0, 2, 0);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // Post-processing
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(container.clientWidth, container.clientHeight),
    0.15,  // strength
    0.4,   // radius
    0.85   // threshold
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 2, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 12;
  controls.maxDistance = 120;
  controls.maxPolarAngle = Math.PI / 2.1;
  controls.update();

  // Environment map (for PBR reflections)
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileCubemapShader();
  const envScene = new RoomEnvironment(renderer);
  const envMap = pmrem.fromScene(envScene, 0.04).texture;
  scene.environment = envMap;
  scene.environmentIntensity = 0.6;
  pmrem.dispose();

  // Lighting
  const ambient = new THREE.AmbientLight(0x446688, 0.35);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0x8899cc, 0x445566, 0.5);
  scene.add(hemi);

  // Key light (warm, main)
  const key = new THREE.DirectionalLight(0xffeedd, 3.0);
  key.position.set(35, 45, 25);
  key.castShadow = true;
  key.shadow.mapSize.width = 2048;
  key.shadow.mapSize.height = 2048;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 100;
  key.shadow.camera.left = -40;
  key.shadow.camera.right = 40;
  key.shadow.camera.top = 40;
  key.shadow.camera.bottom = -40;
  key.shadow.bias = -0.001;
  key.shadow.radius = 4;
  scene.add(key);

  // Fill light (cool)
  const fill = new THREE.DirectionalLight(0x88bbff, 0.8);
  fill.position.set(-30, 20, -25);
  scene.add(fill);

  // Rim light (warm back)
  const rim = new THREE.DirectionalLight(0xff8844, 1.2);
  rim.position.set(-10, 5, -45);
  scene.add(rim);

  // Top accent
  const top = new THREE.DirectionalLight(0xffffff, 0.3);
  top.position.set(0, 50, 0);
  scene.add(top);

  // Subtle grid
  const grid = new THREE.GridHelper(60, 30, 0x1a2a3a, 0x0f1a2a);
  grid.position.y = -0.5;
  scene.add(grid);

  // Resize
  const handleResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
  };
  window.addEventListener('resize', handleResize);

  return { scene, camera, renderer, controls, composer, key, bloomPass };
}

export function getScene() { return scene; }
export function getCamera() { return camera; }
export function getRenderer() { return renderer; }
export function getControls() { return controls; }
export function getComposer() { return composer; }
export function getBloomPass() { return bloomPass; }

export function setBloomStrength(s) {
  if (bloomPass) bloomPass.strength = s;
}

export function addToScene(obj) {
  if (obj) scene.add(obj);
  list.push(obj);
  return obj;
}

export function removeFromScene(obj) {
  if (!obj) return;
  scene.remove(obj);
  const idx = list.indexOf(obj);
  if (idx >= 0) list.splice(idx, 1);
  disposeObject(obj);
}

function disposeObject(obj) {
  if (!obj) return;
  if (obj.children) {
    for (const c of [...obj.children]) disposeObject(c);
  }
  if (obj.geometry) obj.geometry.dispose();
  if (obj.material) {
    if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
    else obj.material.dispose();
  }
}

export function clearScene() {
  for (const obj of [...list]) {
    scene.remove(obj);
    disposeObject(obj);
  }
  list = [];
  // Restore grid
  const grid = new THREE.GridHelper(60, 30, 0x1a2a3a, 0x0f1a2a);
  grid.position.y = -0.5;
  scene.add(grid);
}

export function render() {
  controls.update();
  composer.render();
}

export function setBloomTargets(objects) {
  // Mark objects for bloom by setting userData
  if (!bloomPass || !objects) return;
  // Bloom pass affects all objects above threshold luminance
  // We can adjust per-object emissive values instead
}

export function setCameraPreset(name, animate = false) {
  const presets = {
    top: { pos: [0, 55, 0.1], target: [0, 0, 0] },
    side: { pos: [55, 5, 0], target: [0, 0, 0] },
    front: { pos: [0, 5, 55], target: [0, 0, 0] },
    angle: { pos: [40, 25, 40], target: [0, 0, 0] },
    close: { pos: [22, 12, 22], target: [0, 2, 0] },
    cross: { pos: [0, 25, 0.1], target: [0, 1, 0] },
    needle: { pos: [12, 8, 18], target: [0, 3, 0] },
  };
  const p = presets[name];
  if (!p) return;

  if (animate) {
    // Cancel any in-flight camera animation
    if (_cameraAnimId) cancelAnimationFrame(_cameraAnimId);

    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const endPos = new THREE.Vector3(p.pos[0], p.pos[1], p.pos[2]);
    const endTarget = new THREE.Vector3(p.target[0], p.target[1], p.target[2]);
    let t = 0;
    const duration = 120;

    function step() {
      t++;
      const f = Math.min(t / duration, 1);
      const ease = f < 0.5 ? 2 * f * f : -1 + (4 - 2 * f) * f;
      camera.position.lerpVectors(startPos, endPos, ease);
      controls.target.lerpVectors(startTarget, endTarget, ease);
      controls.update();
      if (f < 1) _cameraAnimId = requestAnimationFrame(step);
      else _cameraAnimId = null;
    }
    _cameraAnimId = requestAnimationFrame(step);
  } else {
    camera.position.set(p.pos[0], p.pos[1], p.pos[2]);
    controls.target.set(p.target[0], p.target[1], p.target[2]);
    controls.update();
  }
}
