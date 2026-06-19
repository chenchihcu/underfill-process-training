import { SPEC } from './spec.js';
import { estimateFlow } from './training-estimate.js';
import { getLanguage, onLanguageChange, setLanguage, t, translatePage } from './i18n.js';
import { SIMULATIONS, authorityLabel, moduleById, textFor } from './experience.js';
import { createSimulationState, transition } from './simulation-state.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const local = (value) => textFor(value,getLanguage());
let module = moduleById(new URLSearchParams(location.search).get('module')) || SIMULATIONS.modules[0];
let state = createSimulationState(module);
let engine = null;
let animationFrame = 0;
let previousTimestamp = 0;

const phraseMap = {
  nominal:['標準情境','Nominal'], 'air-lock':['Air Lock 鎖氣','Air lock'], overflow:['溢流','Overflow'],
  insufficient:['缺膏','Insufficient paste'], bridge:['橋接','Bridge'], 'over-bend':['過度彎折','Over-bend'], misalignment:['偏位','Misalignment'],
  'fast-ramp':['升溫過快','Fast ramp'], 'slow-cooling':['冷卻過慢','Slow cooling'], 'no-underfill':['無 Underfill','No underfill'], 'edge-fatigue':['外圈疲勞','Edge fatigue'],
  racing:['Racing Effect','Racing effect'], starvation:['局部缺膠','Starvation'], 'l-path':['L 型','L path'], 'i-path':['I 型','I path'], 'u-air-lock':['U 型鎖氣','U-path air lock'],
  'interface-band':['界面帶狀 Void','Interface-band void'], 'edge-connected':['外緣連通','Edge-connected'], 'fast-cooling':['冷卻過快','Fast cooling'], 'thin-board':['薄板翹曲','Thin-board warpage'],
  normal:['一般材質','Normal'], flow:['流前','Flow front'], 'cross-section':['剖面','Cross-section'], 'height-map':['高度圖','Height map'], defects:['缺陷','Defects'],
  strain:['應變','Strain'], clearance:['間距','Clearance'], temperature:['溫度','Temperature'], profile:['熱曲線','Thermal profile'], stress:['應力','Stress'], velocity:['速度','Velocity'], venting:['排氣','Venting'], xray:['X-Ray','X-Ray'], csam:['CSAM','CSAM'], displacement:['位移','Displacement']
};

function phrase(id){const value=phraseMap[id];return value?value[getLanguage()==='zh-Hant'?0:1]:id.replaceAll('-',' ').replace(/\b\w/g,(letter)=>letter.toUpperCase());}
function controlValues(){return{temperature:Number($('#temperature').value),pressure:Number($('#pressure').value),clearance:Number($('#clearance').value)};}
function setRange(input,output,rule,step){input.min=String(rule.min);input.max=String(rule.max);input.step=String(step);input.value=String((rule.min+rule.max)/2);output.value=input.value;}

function populateModuleSelect(){const select=$('#moduleSelect');select.replaceChildren(...SIMULATIONS.modules.map((candidate)=>new Option(local(candidate.name),candidate.id)));select.value=module.id;}
function populateScenarios(){const scenario=$('#scenarioSelect');scenario.replaceChildren(...module.scenarios.map((id)=>new Option(phrase(id),id)));scenario.value=state.scenario;const overlay=$('#overlaySelect');overlay.replaceChildren(...module.overlays.map((id)=>new Option(phrase(id),id)));overlay.value=state.overlay;}
function renderPhaseTrack(){const track=$('#phaseTrack');track.replaceChildren(...module.phases.map((phase,index)=>{const node=document.createElement('span');node.className=`phase-node${index<=state.phaseIndex?' active':''}`;node.title=local(phase.label);return node;}));}

function updateFallback(){const width=3.6*state.progress;$('#fallbackUnderfill').setAttribute('d',`M270 305 H${270+width} V347 H270 Z`);const nozzle=$('#fallbackNozzle');nozzle.setAttribute('transform',`translate(${Math.min(410,state.progress*3.5)} 0)`);$('#fallbackTitle').textContent=`${local(module.name)} — 2D cross-section`;}

function renderState(){
  $('#progress').value=String(Math.round(state.progress));$('#progressValue').value=String(Math.round(state.progress));$('#timelineStatus').textContent=state.status.toUpperCase();
  $('#phaseIndex').textContent=String(state.phaseIndex+1).padStart(2,'0');$('#phaseName').textContent=local(module.phases[state.phaseIndex].label);renderPhaseTrack();
  const illustrative=SPEC.trainingModels.flowEstimate.illustrativeInputs;
  const estimate=estimateFlow({temperatureC:$('#temperature').value,gapMm:$('#clearance').value,viscosityPaS:illustrative.viscosityPaS.value,distanceMm:illustrative.distanceMm.value});
  $('#estimateValue').textContent=`${estimate.valueSeconds} s`;$('#modelVersion').textContent=estimate.model.version;$('#modelSpec').textContent=SPEC.metadata.specVersion;
  $('#moduleName').textContent=local(module.name);$('#moduleSummary').textContent=local(module.summary);$('#moduleAuthority').textContent=authorityLabel(module.authority,getLanguage());
  $('#renderStatus').textContent=`${module.authority.toUpperCase()} · ${SIMULATIONS.modelVersion} · ${SPEC.metadata.specVersion}`;
  $('#twinVersion').textContent=SIMULATIONS.modelVersion;updateFallback();
  engine?.update({module,state,controls:controlValues()});
  const diagnostics=engine?.diagnostics();if(diagnostics){$('#rendererType').textContent=diagnostics.renderer;$('#objectCount').textContent=String(diagnostics.objects);}
}

async function switchModule(id){
  const select=$('#moduleSelect');select.dataset.ready='';delete select.dataset.error;module=moduleById(id)||SIMULATIONS.modules[0];state=createSimulationState(module);populateScenarios();renderState();
  try{if(engine)await engine.setModule(module);}
  catch(error){
    console.warn(`3D module ${module.id} unavailable; using 2D fallback.`,error.message);select.dataset.error=error.message;
    try{engine?.dispose();}catch(disposeError){console.warn('3D cleanup failed.',disposeError.message);}engine=null;
    try{createFallback();}catch(fallbackError){console.error('2D fallback failed.',fallbackError);}
  }
  finally{renderState();select.dataset.ready=module.id;}
  const url=new URL(location.href);url.searchParams.set('module',module.id);history.replaceState(null,'',url);
}

function timelineLoop(timestamp){const elapsed=previousTimestamp?Math.min(100,timestamp-previousTimestamp):0;previousTimestamp=timestamp;if(state.status==='running'){state=transition(state,{type:'tick',delta:elapsed/120},module);renderState();}animationFrame=requestAnimationFrame(timelineLoop);}
function act(action){state=transition(state,action,module);renderState();}

function initializeControls(){
  setRange($('#temperature'),$('#temperatureValue'),SPEC.processControls.preheatTolerance,1);setRange($('#pressure'),$('#pressureValue'),SPEC.processControls.dispensePressure,.01);setRange($('#clearance'),$('#clearanceValue'),SPEC.processControls.needleClearance,.1);
  populateModuleSelect();populateScenarios();
  ['temperature','pressure','clearance'].forEach((id)=>{$(`#${id}`).addEventListener('input',()=>{$(`#${id}Value`).value=$(`#${id}`).value;renderState();});});
  $('#progress').addEventListener('input',()=>act({type:'seek',value:$('#progress').value}));$('#moduleSelect').addEventListener('change',(event)=>switchModule(event.target.value));
  $('#scenarioSelect').addEventListener('change',(event)=>act({type:'scenario',value:event.target.value}));$('#overlaySelect').addEventListener('change',(event)=>act({type:'overlay',value:event.target.value}));
  $('#playTimeline').addEventListener('click',()=>act({type:'play'}));$('#pauseTimeline').addEventListener('click',()=>act({type:'pause'}));$('#stepTimeline').addEventListener('click',()=>act({type:'step'}));$('#resetTimeline').addEventListener('click',()=>act({type:'reset'}));
  $$('.view-button').forEach((button)=>button.addEventListener('click',()=>{$$('.view-button').forEach((candidate)=>candidate.classList.toggle('active',candidate===button));engine?.setView(button.dataset.view);}));
  $('#resetCamera').addEventListener('click',()=>engine?.fitCamera());
  const toggleControls=(open)=>{const controls=$('#simControls');controls.classList.toggle('open',open);$('#controlsToggle').setAttribute('aria-expanded',String(open));$('#controlsToggle').textContent=open?t('sim.hideControls'):t('sim.showControls');};
  $('#controlsToggle').addEventListener('click',()=>toggleControls(!$('#simControls').classList.contains('open')));$('#closeControls').addEventListener('click',()=>toggleControls(false));
  $('#languageSelect').value=getLanguage();$('#languageSelect').addEventListener('change',(event)=>setLanguage(event.target.value));onLanguageChange(()=>{translatePage();populateModuleSelect();populateScenarios();renderState();$('#controlsToggle').textContent=$('#simControls').classList.contains('open')?t('sim.hideControls'):t('sim.showControls');});translatePage();
}

function createFallback(){
  $('#viewport').hidden=true;$('#fallback').hidden=false;$('#rendererType').textContent='SVG 2D';
  const group=$('#fallbackBalls');group.replaceChildren(...Array.from({length:7},(_,index)=>{const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');circle.setAttribute('cx',String(310+index*47));circle.setAttribute('cy','330');circle.setAttribute('r','16');return circle;}));renderState();$('#moduleSelect').dataset.ready=module.id;
}

async function initializeEngine(){
  if(new URLSearchParams(location.search).get('fallback')==='1')throw new Error('Forced fallback');
  const {createSimulatorEngine}=await import('./simulator-engine.js');engine=await createSimulatorEngine($('#viewport'));await engine.setModule(module);$('#rendererType').textContent='WebGL · PBR';renderState();$('#moduleSelect').dataset.ready=module.id;
}

function registerServiceWorker(){if('serviceWorker'in navigator&&!import.meta.env.DEV)navigator.serviceWorker.register('./sw.js');}

initializeControls();
initializeEngine().catch((error)=>{console.warn('3D unavailable; using 2D fallback.',error.message);createFallback();});
renderState();animationFrame=requestAnimationFrame(timelineLoop);registerServiceWorker();
window.addEventListener('beforeunload',()=>{cancelAnimationFrame(animationFrame);engine?.dispose();});
