import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const palette = Object.freeze({
  board:0x0f766e, mask:0x27a58f, substrate:0xd8b36b, copper:0xc88732, package:0x213a4c,
  die:0x7895a5, solder:0xcbd5da, resin:0xe47a16, steel:0x879da6, dark:0x091b22,
  blue:0x38bdf8, purple:0xa78bfa, red:0xf05252, amber:0xf59e0b, green:0x2dd4a6
});

function material(color,options={}){
  const {clearcoat,clearcoatRoughness,transmission,...standardOptions}=options;
  return new THREE.MeshStandardMaterial({color,roughness:.42,metalness:.08,...standardOptions});
}
function rounded(size,position,color,options={}){const mesh=new THREE.Mesh(new RoundedBoxGeometry(size[0],size[1],size[2],4,.12),material(color,options));mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;}
function box(size,position,color,options={}){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material(color,options));mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;}
function cylinder(radius,height,position,color,options={}){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,32),material(color,options));mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;}

function addBoard(root,{wide=false}={}){
  const group=new THREE.Group();group.name='pcb-stack';root.add(group);
  const x=wide?34:30,z=wide?18:24;
  const substrate=rounded([x,.82,z],[0,0,0],palette.substrate,{roughness:.58});
  const mask=rounded([x,.11,z],[0,.46,0],palette.board,{roughness:.31,clearcoat:.42});group.add(substrate,mask);
  for(let index=-4;index<=4;index+=1){group.add(box([7,.025,.1],[-9,.53,index*1.25],palette.copper,{metalness:.7,roughness:.22}),box([7,.025,.1],[9,.53,index*1.25],palette.copper,{metalness:.7,roughness:.22}));}
  for(const [xPos,zPos] of [[-13,-10],[-13,10],[13,-10],[13,10]]){const hole=cylinder(.52,.95,[xPos,.02,zPos],0x15383a,{metalness:.38});group.add(hole);}
  return group;
}

function addBalls(root,{rows=7,columns=7,spread=1.6,color=palette.solder}={}){
  const geometry=new THREE.SphereGeometry(.25,24,16);const mat=material(color,{metalness:.68,roughness:.2});const balls=new THREE.InstancedMesh(geometry,mat,rows*columns);balls.castShadow=true;balls.receiveShadow=true;const matrix=new THREE.Matrix4();let index=0;
  for(let row=0;row<rows;row+=1)for(let column=0;column<columns;column+=1){matrix.makeScale(1,1.18,1);matrix.setPosition((column-(columns-1)/2)*spread,.84,(row-(rows-1)/2)*spread);balls.setMatrixAt(index++,matrix);}
  balls.instanceMatrix.needsUpdate=true;balls.name='solder-ball-array';root.add(balls);return balls;
}

function addPackage(root,{transparent=false}={}){
  const group=new THREE.Group();group.name='package-stack';root.add(group);
  const packageMesh=rounded([12,.88,12],[0,1.52,0],palette.package,{roughness:.3,clearcoat:.28,transparent,opacity:transparent?.38:1});
  const die=rounded([6,.48,6],[0,2.25,0],palette.die,{metalness:.23,roughness:.2,clearcoat:.5,transparent,opacity:transparent?.66:1});
  const pinOne=cylinder(.22,.08,[-5.15,2.02,-5.15],palette.amber,{emissive:0x6f3100,emissiveIntensity:.25});group.add(packageMesh,die,pinOne);return{group,packageMesh,die};
}

function addUnderfill(root){
  const fluid=rounded([11.5,.28,11.5],[0,1.05,0],palette.resin,{transparent:true,opacity:.8,roughness:.24,transmission:.06});fluid.scale.x=.01;fluid.position.x=-5.7;
  const fillet=rounded([.58,.72,12.5],[-6.15,1.12,0],palette.resin,{transparent:true,opacity:.88});root.add(fluid,fillet);return{fluid,fillet};
}

function addNozzle(root){
  const group=new THREE.Group();group.name='dispense-nozzle';const barrel=cylinder(.38,4.5,[0,2.3,0],palette.steel,{metalness:.82,roughness:.2});const tip=new THREE.Mesh(new THREE.CylinderGeometry(.34,.09,1.45,32),material(0x697f88,{metalness:.84,roughness:.18}));tip.position.y=-.67;group.add(barrel,tip);group.position.set(-7,4,-5.2);root.add(group);return group;
}

function commonAssembly(root,{transparent=false}={}){const board=addBoard(root);const balls=addBalls(root);const packageParts=addPackage(root,{transparent});return{board,balls,...packageParts};}

function createUnderfillScene(root){const refs=commonAssembly(root);Object.assign(refs,addUnderfill(root));refs.nozzle=addNozzle(root);return refs;}

function createSpiScene(root){
  const refs={board:addBoard(root)};refs.paste=[];const pasteMaterial=material(0xaeb8bd,{metalness:.55,roughness:.28});for(let row=-3;row<=3;row+=1)for(let column=-3;column<=3;column+=1){const pad=cylinder(.35,.05,[column*1.6,.57,row*1.6],palette.copper,{metalness:.72,roughness:.22});const deposit=new THREE.Mesh(new RoundedBoxGeometry(.55,.22,.55,2,.08),pasteMaterial.clone());deposit.position.set(column*1.6,.69,row*1.6);deposit.castShadow=true;root.add(pad,deposit);refs.paste.push(deposit);}refs.scanner=box([15,.18,.8],[0,4,-7],palette.blue,{emissive:palette.blue,emissiveIntensity:.25,transparent:true,opacity:.85});root.add(refs.scanner);return refs;
}

function createFpcaScene(root){
  const refs={board:addBoard(root,{wide:true})};const geometry=new THREE.PlaneGeometry(20,8,40,10);const flex=new THREE.Mesh(geometry,material(0xd6a532,{side:THREE.DoubleSide,metalness:.12,roughness:.44}));flex.rotation.x=-Math.PI/2;flex.position.set(0,1.2,-4);flex.castShadow=true;root.add(flex);refs.flex=flex;refs.original=Float32Array.from(geometry.attributes.position.array);refs.component=rounded([5,.8,3],[0,1.8,-4],palette.package);root.add(refs.component);return refs;
}

function createReflowScene(root){
  const refs={};refs.zones=[];const zoneColors=[0x2f8dd6,0xeab308,0xf97316,0xef4444,0x7c3aed];for(let index=0;index<5;index+=1){const zone=rounded([6,.22,20],[-12+index*6,-.1,0],zoneColors[index],{transparent:true,opacity:.22,emissive:zoneColors[index],emissiveIntensity:.06});root.add(zone);refs.zones.push(zone);}root.add(box([34,.25,1.1],[0,.2,-8.5],0x41535a,{metalness:.55}),box([34,.25,1.1],[0,.2,8.5],0x41535a,{metalness:.55}));refs.carrier=new THREE.Group();refs.carrier.add(addBoard(new THREE.Group(),{wide:true}));const boardGroup=refs.carrier.children[0];addBalls(boardGroup,{rows:4,columns:6,spread:1.5});addPackage(boardGroup);refs.carrier.scale.setScalar(.6);root.add(refs.carrier);return refs;
}

function createBgaScene(root){
  const refs=commonAssembly(root,{transparent:true});Object.assign(refs,addUnderfill(root));refs.arrows=[];for(const x of [-5,-2.5,0,2.5,5]){const arrow=new THREE.ArrowHelper(new THREE.Vector3(x/8,1,0).normalize(),new THREE.Vector3(x,.55,0),3,0x38bdf8,.55,.25);root.add(arrow);refs.arrows.push(arrow);}return refs;
}

function createFlowScene(root){const refs=commonAssembly(root,{transparent:true});Object.assign(refs,addUnderfill(root));refs.vent=new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(4,1.3,0),4,0x45deb6,.7,.3);root.add(refs.vent);return refs;}

function tubePath(points,color){const curve=new THREE.CatmullRomCurve3(points.map((point)=>new THREE.Vector3(...point)));const geometry=new THREE.TubeGeometry(curve,96,.16,12,false);const tube=new THREE.Mesh(geometry,material(color,{emissive:color,emissiveIntensity:.18,transparent:true,opacity:.92}));tube.castShadow=true;return tube;}
function createPatternScene(root){const refs=commonAssembly(root);refs.paths={
  'l-path':tubePath([[-6.6,.62,-6.5],[-6.6,.62,6.5],[0,.62,6.5],[6.6,.62,6.5]],palette.amber),
  'i-path':tubePath([[-6.6,.62,-6.5],[-6.6,.62,6.5]],palette.blue),
  'u-air-lock':tubePath([[-6.6,.62,-6.5],[-6.6,.62,6.5],[6.6,.62,6.5],[6.6,.62,-6.5]],palette.red)
};Object.values(refs.paths).forEach((path)=>root.add(path));refs.flowFront=rounded([.3,.2,10],[-5.7,1.05,0],palette.resin,{transparent:true,opacity:.65});root.add(refs.flowFront);return refs;}

function createVoidScene(root){
  const refs=commonAssembly(root,{transparent:true});refs.packageMesh.material.opacity=.16;refs.voids=[];for(const [x,z,size] of [[-3.2,-3.2,.18],[0,0,.26],[3.2,1.6,.2],[-1.6,3.2,.16]]){const defect=new THREE.Mesh(new THREE.SphereGeometry(size,20,14),material(0xf8fafc,{emissive:0xe2e8f0,emissiveIntensity:.42,transparent:true,opacity:.88}));defect.position.set(x,.87,z);root.add(defect);refs.voids.push(defect);}refs.scanPlane=rounded([13,.05,13],[0,1.95,0],0x60a5fa,{transparent:true,opacity:.08,emissive:0x60a5fa,emissiveIntensity:.35});root.add(refs.scanPlane);return refs;
}

function createWarpageScene(root){
  const refs={strips:[]};for(let index=-10;index<=10;index+=1){const strip=rounded([1.55,.8,24],[index*1.42,0,0],palette.board,{roughness:.34});root.add(strip);refs.strips.push(strip);}refs.package=rounded([12,.9,12],[0,1.45,0],palette.package);refs.die=rounded([6,.5,6],[0,2.2,0],palette.die);root.add(refs.package,refs.die);refs.heatPlane=rounded([31,.06,24],[0,-.55,0],palette.red,{transparent:true,opacity:.08,emissive:palette.red,emissiveIntensity:.2});root.add(refs.heatPlane);return refs;
}

const builders={underfill:createUnderfillScene,spi:createSpiScene,fpca:createFpcaScene,reflow:createReflowScene,bga:createBgaScene,flow:createFlowScene,pattern:createPatternScene,void:createVoidScene,warpage:createWarpageScene};

export async function createSimulatorEngine(viewport){
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x0a252a);scene.fog=new THREE.Fog(0x0a252a,42,90);
  const camera=new THREE.PerspectiveCamera(36,viewport.clientWidth/viewport.clientHeight,.05,350);
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});const gl=renderer.getContext();const rendererInfo=gl.getExtension('WEBGL_debug_renderer_info');const gpuName=rendererInfo?gl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL):'';const adaptiveQuality=/swiftshader|llvmpipe|software/i.test(gpuName);renderer.setPixelRatio(Math.min(devicePixelRatio,adaptiveQuality?1:1.5));renderer.setSize(viewport.clientWidth,viewport.clientHeight);renderer.shadowMap.enabled=!adaptiveQuality;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;viewport.append(renderer.domElement);
  const pmrem=new THREE.PMREMGenerator(renderer);const environment=pmrem.fromScene(new RoomEnvironment(renderer),.04);scene.environment=environment.texture;pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xd7fff8,0x081d22,2.3));const key=new THREE.DirectionalLight(0xffffff,4.2);key.position.set(15,26,14);key.castShadow=true;key.shadow.mapSize.set(1024,1024);scene.add(key);const rim=new THREE.DirectionalLight(0x45e6d0,2.2);rim.position.set(-20,10,-16);scene.add(rim);const warm=new THREE.PointLight(0xff9f43,18,35);warm.position.set(10,8,-10);scene.add(warm);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(45,96),material(0x0d3034,{roughness:.72,metalness:.08}));floor.rotation.x=-Math.PI/2;floor.position.y=-.55;floor.receiveShadow=true;scene.add(floor);const grid=new THREE.GridHelper(70,70,0x2f7770,0x173f40);grid.position.y=-.5;grid.material.opacity=.32;grid.material.transparent=true;scene.add(grid);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.minDistance=8;controls.maxDistance=75;controls.maxPolarAngle=Math.PI*.49;
  let root=null;let refs={};let currentModule=null;let currentView='process';let renderFrame=0;

  function disposeObject(object){object.traverse((node)=>{node.geometry?.dispose();if(Array.isArray(node.material))node.material.forEach((entry)=>entry.dispose());else node.material?.dispose();});}
  function clear(){if(!root)return;scene.remove(root);disposeObject(root);root=null;refs={};}
  function objectCount(){let count=0;scene.traverse(()=>{count+=1;});return count;}
  function fit(view=currentView){if(!root)return;currentView=view;const box3=new THREE.Box3().setFromObject(root);const size=box3.getSize(new THREE.Vector3());const center=box3.getCenter(new THREE.Vector3());const distance=Math.max(size.x,size.y*4,size.z)*1.15;if(view==='cross')camera.position.set(center.x+distance,center.y+distance*.16,center.z+.8);else if(view==='top')camera.position.set(center.x,center.y+distance*1.15,center.z+.01);else camera.position.set(center.x+distance*.68,center.y+distance*.5,center.z+distance*.74);camera.near=Math.max(.02,distance/150);camera.far=distance*12;camera.updateProjectionMatrix();controls.target.copy(center);controls.update();}
  async function setModule(module){clear();currentModule=module;root=new THREE.Group();root.name=`module-${module.id}`;scene.add(root);refs=(builders[module.id]||createUnderfillScene)(root);fit(currentView);}
  function setOverlay(overlay){if(!root)return;root.traverse((node)=>{if(!node.material)return;const materials=Array.isArray(node.material)?node.material:[node.material];for(const mat of materials){mat.wireframe=overlay==='cross-section'&&node.name!=='solder-ball-array';if(overlay==='stress'||overlay==='strain'||overlay==='temperature'||overlay==='velocity'||overlay==='displacement'){mat.emissive?.setHex(palette.amber);mat.emissiveIntensity=.12;}else if(mat.emissive){mat.emissiveIntensity=Math.min(mat.emissiveIntensity,.08);}}});}
  function update({module,state,controls:inputs}){
    if(!root||module.id!==currentModule?.id)return;const progress=state.progress/100;const scenario=state.scenario;setOverlay(state.overlay);
    if(module.id==='underfill'){refs.fluid.scale.x=Math.max(.01,progress);refs.fluid.position.x=-5.7+5.7*progress;refs.fillet.scale.y=.3+.7*progress;const pathProgress=Math.min(1,progress*1.4);refs.nozzle.position.x=-7+13*Math.min(pathProgress,.5)*2;refs.nozzle.position.z=-5.2+10*Math.max(0,pathProgress-.5)*2;if(scenario==='air-lock')refs.fluid.scale.z=.58;else refs.fluid.scale.z=1;if(scenario==='overflow')refs.fillet.scale.set(1.7,1.25,1.1);else refs.fillet.scale.x=1;}
    if(module.id==='spi'){refs.scanner.position.z=-7+14*progress;refs.paste.forEach((deposit,index)=>{const insufficient=scenario==='insufficient'&&index%8===0;const bridge=scenario==='bridge'&&index%9===0;deposit.scale.y=(.45+.55*progress)*(insufficient ? .35 : 1);deposit.scale.x=bridge?2.3:1;deposit.material.color.setHex(insufficient?palette.red:bridge?palette.amber:0xaeb8bd);});}
    if(module.id==='fpca'){const positions=refs.flex.geometry.attributes.position;const amplitude=(scenario==='over-bend'?1.25:.45)*progress;for(let index=0;index<positions.count;index+=1){const x=refs.original[index*3];const y=refs.original[index*3+1];positions.setXYZ(index,x,y,Math.sin(x*.45+progress*3)*amplitude);}positions.needsUpdate=true;refs.flex.geometry.computeVertexNormals();refs.component.position.x=scenario==='misalignment'?progress*2.2:0;}
    if(module.id==='reflow'){refs.carrier.position.x=-14+28*progress;refs.zones.forEach((zone,index)=>{const active=Math.min(4,Math.floor(progress*5))===index;zone.material.opacity=active?.48:.18;zone.material.emissiveIntensity=active?.35:.05;});refs.carrier.rotation.z=scenario==='fast-ramp'?Math.sin(progress*18)*.025:0;}
    if(module.id==='bga'){refs.packageMesh.position.y=1.52+progress*.65;refs.die.position.y=2.25+progress*.85;refs.fluid.visible=scenario!=='no-underfill';refs.fillet.visible=scenario!=='no-underfill';refs.arrows.forEach((arrow,index)=>arrow.setColor(new THREE.Color(scenario==='edge-fatigue'&&Math.abs(index-2)>1?palette.red:palette.blue)));}
    if(module.id==='flow'){const speed=scenario==='racing'?Math.min(1,progress*1.65):scenario==='starvation'?progress*.55:progress;refs.fluid.scale.x=Math.max(.01,speed);refs.fluid.position.x=-5.7+5.7*speed;refs.fluid.scale.z=scenario==='racing'?.42:1;refs.fillet.scale.y=.2+speed*.8;refs.vent.setLength(2+progress*3,.7,.3);}
    if(module.id==='pattern'){Object.entries(refs.paths).forEach(([id,path])=>{path.visible=id===scenario;path.geometry.setDrawRange(0,Math.floor(path.geometry.index.count*progress));});refs.flowFront.scale.x=.1+progress*38;refs.flowFront.position.x=-5.7+progress*5.7;refs.flowFront.material.color.setHex(scenario==='u-air-lock'?palette.red:palette.resin);}
    if(module.id==='void'){refs.voids.forEach((defect,index)=>{const severe=scenario!=='nominal';defect.scale.setScalar((.55+progress*.45)*(severe&&index<2?1.8:1));defect.visible=state.overlay!=='normal';});refs.scanPlane.material.opacity=state.overlay==='xray'?.25:state.overlay==='csam'?.14:.05;refs.scanPlane.material.color.setHex(state.overlay==='csam'?palette.green:palette.blue);}
    if(module.id==='warpage'){const factor=(scenario==='thin-board'?1.45:scenario==='fast-cooling'?1.15:.72)*progress;refs.strips.forEach((strip,index)=>{const normalized=(index-10)/10;strip.position.y=normalized*normalized*factor;strip.rotation.z=normalized*.035*factor;strip.material.color.setHex(state.overlay==='stress'?palette.amber:palette.board);});refs.package.position.y=1.45+factor*.12;refs.die.position.y=2.2+factor*.12;refs.heatPlane.material.opacity=.06+progress*.2;}
    warm.intensity=12+Number(inputs.temperature||0)/10;root.rotation.y+=(state.status==='running'?.0007:0);
  }
  function animate(){renderFrame=requestAnimationFrame(animate);if(document.visibilityState==='visible'){controls.update();renderer.render(scene,camera);}}animate();
  const resize=()=>{const width=viewport.clientWidth,height=viewport.clientHeight;if(!width||!height)return;camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height);};const observer=new ResizeObserver(resize);observer.observe(viewport);
  return{setModule,update,setView:(view)=>fit(view),fitCamera:()=>fit(currentView),diagnostics:()=>({renderer:`WebGL · PBR${adaptiveQuality?' · Adaptive':''}`,objects:objectCount()}),dispose:()=>{cancelAnimationFrame(renderFrame);observer.disconnect();clear();controls.dispose();environment.dispose();renderer.dispose();renderer.domElement.remove();}};
}
