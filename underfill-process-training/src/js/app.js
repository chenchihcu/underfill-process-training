import { SPEC, formatRule, sourceFor } from './spec.js';
import { evaluateInspection } from './acceptance.js';
import { recommendComponent } from './recommendation.js';
import { createRecord, exportCsv, exportJson, importRecords, listRecords, migrateLegacyProgress, saveRecord } from './records.js';
import { getLanguage, onLanguageChange, setLanguage, t, translatePage } from './i18n.js';
import { MEDIA, SIMULATIONS, TRAINING, authorityLabel, mediaById, textFor, validateExperience } from './experience.js';

const build = { appVersion: __APP_VERSION__, buildCommit: __BUILD_COMMIT__ };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
let selectedTopicId = TRAINING.topics[0].id;
let currentRecords = [];

function element(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(options).forEach(([key, value]) => {
    if (key === 'className') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('data-')) node.setAttribute(key, value);
    else node[key] = value;
  });
  node.append(...children.filter(Boolean));
  return node;
}

const language = () => getLanguage();
const local = (value) => textFor(value, language());
const localLabel = (zh, en) => language() === 'zh-Hant' ? zh : en;

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => { toast.hidden = true; }, 3200);
}

function showSource(rule) {
  const source = sourceFor(rule);
  if (!source) return;
  const roleLabels = {
    'primary controlled authority':['主要受控依據','Primary controlled authority'],
    'secondary where primary is silent':['主要文件未定義時的次要依據','Secondary where the primary source is silent'],
    'package strategy where primary is silent':['主要文件未定義時的封裝策略依據','Package strategy where the primary source is silent'],
    'explanation and visualization only':['僅供說明與視覺化','Explanation and visualization only']
  };
  const role = roleLabels[source.role]?.[language() === 'zh-Hant' ? 0 : 1] || source.role;
  const labels = language() === 'zh-Hant'
    ? [['規則 ID', source.ruleId], ['文件', source.title], ['角色', role], ['參考位置', source.reference], ['檔案', source.location]]
    : [['Rule ID', source.ruleId], ['Document', source.title], ['Role', role], ['Reference', source.reference], ['File', source.location]];
  $('#sourceDetails').replaceChildren(...labels.flatMap(([term, definition]) => [element('dt', { text: term }), element('dd', { text: definition })]));
  $('#sourceDialog').showModal();
}

function specItem(label, value, rule) {
  const button = element('button', { type: 'button', className: 'source-button', text: t('app.source') });
  button.addEventListener('click', () => showSource(rule));
  return element('article', { className: 'spec-item', 'data-search':`${label} ${value} ${rule.id}`.toLowerCase(), 'data-authority':rule.status }, [element('span', { text: label }), element('strong', { text: value }), button]);
}

function specificationGroups() {
  const material = SPEC.materialControls;
  const process = SPEC.processControls;
  const inspection = SPEC.inspectionControls;
  return [
    { title: t('spec.material'), items: [
      specItem(localLabel('冷凍儲存', 'Frozen storage'), formatRule(material.storageTemperature), material.storageTemperature),
      specItem(localLabel('可使用時間', 'Pot life'), `${formatRule(material.potLife)} · ${material.potLife.condition}`, material.potLife),
      ...Object.entries(material.thawing).map(([volume, rule]) => specItem(`${volume} cc ${localLabel('回溫', 'thaw')}`, formatRule(rule), rule))
    ]},
    { title: t('spec.process'), items: [
      specItem(localLabel('預熱目標', 'Preheat target'), formatRule(process.preheatTarget), process.preheatTarget),
      specItem(localLabel('工程容許範圍', 'Engineering tolerance'), formatRule(process.preheatTolerance), process.preheatTolerance),
      specItem(localLabel('點膠壓力', 'Dispense pressure'), formatRule(process.dispensePressure), process.dispensePressure),
      specItem(localLabel('針頭間距', 'Needle clearance'), formatRule(process.needleClearance), process.needleClearance),
      ...process.cureProfiles.map((rule) => specItem(localLabel('固化設定', 'Cure profile'), `${rule.temperature} °C · ≥ ${rule.minimumMinutes} min`, rule))
    ]},
    { title: t('spec.inspection'), items: [
      specItem(localLabel('Fillet 高度', 'Fillet height'), formatRule(inspection.fillet.heightPercent), inspection.fillet.heightPercent),
      specItem(localLabel('周邊連續率', 'Perimeter continuity'), formatRule(inspection.fillet.perimeterPercent), inspection.fillet.perimeterPercent),
      specItem(localLabel('單一焊點 Void', 'Individual-joint void'), formatRule(inspection.void.individualJointAreaPercent), inspection.void.individualJointAreaPercent),
      specItem(localLabel('Void 型態', 'Void topology'), localLabel('依受控處置規則', 'Controlled disposition rule'), inspection.void.topologyRule),
      specItem(localLabel('Void 位置', 'Void location'), localLabel('依受控處置規則', 'Controlled disposition rule'), inspection.void.locationRule),
      specItem('CSAM', localLabel('依範圍與處置規則', 'Extent and disposition rule'), inspection.csam.dispositionRule)
    ]}
  ];
}

function renderSpecifications() {
  const query = ($('#specSearch')?.value || '').trim().toLowerCase();
  const authority = $('#specAuthority')?.value || 'all';
  const sections = specificationGroups().map((group) => {
    const items = group.items.filter((item) => (!query || item.dataset.search.includes(query)) && (authority === 'all' || item.dataset.authority === authority));
    return items.length ? element('section', { className:'spec-section' }, [element('h3', { text:group.title }), element('div', { className:'spec-grid' }, items)]) : null;
  }).filter(Boolean);
  $('#specCards').replaceChildren(...(sections.length ? sections : [element('div',{className:'spec-empty',text:t('spec.empty')})]));
}

function moduleHref(id) { return `./simulation.html?module=${encodeURIComponent(id)}`; }

function renderOverview() {
  $('#topicPath').replaceChildren(...TRAINING.topics.map((topic, index) => {
    const button = element('button', { type:'button', className:'path-card' }, [
      element('span',{className:'path-number',text:String(index + 1).padStart(2,'0')}),
      element('strong',{text:local(topic.title)}),
      element('small',{text:authorityLabel(topic.authority,language())})
    ]);
    button.addEventListener('click', () => openTopic(topic.id));
    return button;
  }));
  $('#moduleGrid').replaceChildren(...SIMULATIONS.modules.map((module) => element('a', { className:'module-card', href:moduleHref(module.id), style:`--module-accent:${module.accent}` }, [
    element('span',{className:'module-glyph',text:module.id.slice(0,3).toUpperCase()}),
    element('span',{},[element('strong',{text:local(module.name)}),element('small',{text:authorityLabel(module.authority,language())})]),
    element('span',{className:'authority-dot','aria-label':module.authority})
  ])));
}

function openTopic(id) {
  selectedTopicId = id;
  showSection('learning');
  renderLearning();
  $('#topicWorkspace').scrollIntoView({block:'start',behavior:'smooth'});
}

function showMedia(item) {
  if (!item?.localPath) return;
  $('#mediaDialogImage').src = item.localPath;
  $('#mediaDialogImage').alt = local(item.alt);
  $('#mediaDialogTitle').textContent = item.sourceTitle;
  $('#mediaDialogCaption').textContent = local(item.caption);
  $('#mediaDialogSource').href = item.sourceUrl;
  $('#mediaDialogSource').textContent = `${t('app.source')}: ${item.owner}`;
  $('#mediaDialog').showModal();
}

function localizedList(title, items, className = '') {
  return element('section',{className:`content-card ${className}`.trim()},[element('h4',{text:title}),element('ul',{},items.map((item)=>element('li',{text:local(item)})))]);
}

function renderTopicWorkspace(topic) {
  const primaryMedia = topic.mediaIds.map(mediaById).find((item) => item?.localPath);
  const mediaNode = primaryMedia ? element('div',{className:'topic-media'},[
    element('img',{src:primaryMedia.localPath,alt:local(primaryMedia.alt),loading:'lazy'}),
    (() => { const button=element('button',{type:'button'},[element('span',{text:local(primaryMedia.caption)})]); button.addEventListener('click',()=>showMedia(primaryMedia)); return button; })()
  ]) : element('div',{className:'topic-media'},[element('span',{text:localLabel('工程視覺建構中','Engineering visual in development')})]);
  const hero = element('div',{className:'topic-hero'},[
    element('div',{},[
      element('span',{className:'authority-chip',text:authorityLabel(topic.authority,language())}),
      element('h3',{text:local(topic.title)}),
      element('p',{text:local(topic.summary)})
    ]),
    mediaNode
  ]);
  const principle = element('section',{className:'principle-card'},[element('h4',{text:t('learning.principle')}),element('p',{text:local(topic.principle)})]);
  const content = element('div',{className:'topic-columns'},[
    localizedList(t('learning.actions'),topic.actions),
    localizedList(t('learning.evidence'),topic.evidence,'evidence-card'),
    localizedList(t('learning.risk'),topic.failureModes,'failure-card')
  ]);
  const caseStudy = element('section',{className:'case-card'},[
    element('div',{},[element('h4',{text:t('learning.case')}),element('p',{text:local(topic.caseStudy.prompt)})]),
    element('div',{},[element('h4',{text:t('learning.resolution')}),element('p',{text:local(topic.caseStudy.resolution)})])
  ]);
  const feedback = element('p',{className:'quiz-feedback',text:t('learning.quizIdle')});
  const optionNodes = topic.quiz.options.map((option,index) => {
    const button = element('button',{type:'button',className:'quiz-option',text:local(option)});
    button.addEventListener('click',()=>{
      optionNodes.forEach((candidate,optionIndex)=>candidate.classList.toggle('correct',optionIndex===topic.quiz.answerIndex));
      button.classList.toggle('wrong',index!==topic.quiz.answerIndex);
      feedback.textContent = `${index === topic.quiz.answerIndex ? t('learning.correct') : t('learning.tryAgain')} ${local(topic.quiz.explanation)}`;
    });
    return button;
  });
  const quiz = element('section',{className:'quiz-card'},[element('p',{className:'eyebrow',text:'KNOWLEDGE CHECK'}),element('h4',{text:local(topic.quiz.question)}),element('div',{className:'quiz-options'},optionNodes),feedback]);
  const references = topic.mediaIds.map(mediaById).filter((item)=>item?.kind==='reference').map((item)=>element('a',{className:'rule-pill',href:item.sourceUrl,target:'_blank',rel:'noreferrer',text:item.owner}));
  const footer = element('div',{className:'topic-footer'},[
    element('div',{className:'rule-pills'},[...topic.controlledRuleIds.map((id)=>element('span',{className:'rule-pill',text:id})),...references]),
    element('a',{className:'button button-primary',href:moduleHref(topic.moduleId),text:t('learning.openSimulator')})
  ]);
  $('#topicWorkspace').replaceChildren(hero,principle,content,caseStudy,quiz,footer);
}

function renderLearning() {
  if (!TRAINING.topics.some((topic)=>topic.id===selectedTopicId)) selectedTopicId=TRAINING.topics[0].id;
  $('#topicNav').replaceChildren(...TRAINING.topics.map((topic,index)=>{
    const button=element('button',{type:'button',className:`lesson-card${topic.id===selectedTopicId?' active':''}`},[
      element('span',{className:'lesson-number',text:String(index+1).padStart(2,'0')}),element('strong',{text:local(topic.title)})
    ]);
    button.addEventListener('click',()=>{selectedTopicId=topic.id;renderLearning();});
    return button;
  }));
  renderTopicWorkspace(TRAINING.topics.find((topic)=>topic.id===selectedTopicId));
}

function renderExperienceSearch() {
  const input=$('#experienceSearch');
  const container=$('#searchResults');
  const query=input.value.trim().toLocaleLowerCase(language());
  if (!query) { container.hidden=true; container.replaceChildren(); return; }
  const topicMatches=TRAINING.topics.filter((topic)=>`${local(topic.title)} ${local(topic.summary)} ${local(topic.principle)}`.toLocaleLowerCase(language()).includes(query)).slice(0,6);
  const moduleMatches=SIMULATIONS.modules.filter((module)=>`${local(module.name)} ${local(module.summary)}`.toLocaleLowerCase(language()).includes(query)).slice(0,3);
  const results=[
    ...topicMatches.map((topic)=>({title:local(topic.title),meta:t('nav.learning'),action:()=>openTopic(topic.id)})),
    ...moduleMatches.map((module)=>({title:local(module.name),meta:t('nav.simulator'),href:moduleHref(module.id)}))
  ];
  const nodes=results.map((result)=>{
    if(result.href) return element('a',{className:'search-result',href:result.href},[element('span',{},[element('strong',{text:result.title}),element('small',{text:result.meta})])]);
    const button=element('button',{type:'button',className:'search-result'},[element('span',{},[element('strong',{text:result.title}),element('small',{text:result.meta})])]);
    button.addEventListener('click',result.action);return button;
  });
  container.replaceChildren(...(nodes.length?nodes:[element('div',{className:'search-result',text:t('overview.noResults')})]));container.hidden=false;
}

function showSection(sectionId) {
  $$('.page').forEach((page)=>{page.hidden=page.id!==sectionId;page.classList.toggle('active',page.id===sectionId);});
  $$('.nav-item[data-section]').forEach((item)=>{const active=item.dataset.section===sectionId;item.classList.toggle('active',active);if(active)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');});
  history.replaceState(null,'',`#${sectionId}`);
  $('#main').focus({preventScroll:true});
  if(sectionId==='records') renderRecords();
}

function initializeNavigation() {
  $$('.nav-item[data-section]').forEach((button)=>button.addEventListener('click',()=>showSection(button.dataset.section)));
  $$('[data-jump]').forEach((button)=>button.addEventListener('click',()=>showSection(button.dataset.jump)));
  const initial=location.hash.slice(1);if(initial&&document.getElementById(initial))showSection(initial);
}

function formObject(form) { return Object.fromEntries(new FormData(form).entries()); }

function renderRecommendation(result) {
  const panel=$('#recommendationResult');panel.hidden=false;
  const missingKeyMap={packageType:'package',pitchMm:'pitch',ballSizeMm:'ball',standoffMm:'standoff',packageWidthMm:'width',packageLengthMm:'length',edgeClearanceMm:'clearance',reliabilityClass:'reliability',environment:'environment',material:'material',processProfile:'profile'};
  const missingLabels=result.missingInputs.map((key)=>missingKeyMap[key]?t(`recommendation.${missingKeyMap[key]}`):key);
  const validationLabels=result.validation.map((key)=>t(`validation.${key}`));
  panel.replaceChildren(element('p',{className:'eyebrow',text:result.specVersion}),element('h3',{text:t(`decision.${result.decision}`)}),element('p',{text:`${t('recommendation.rationale')}: ${result.ruleIds.join(', ')||'—'}`}),element('p',{text:`${t('recommendation.missing')}: ${missingLabels.join(', ')||'—'}`}),element('p',{text:`${t('recommendation.validation')}: ${validationLabels.join(', ')||'—'}`}));
  panel.className=`result-panel ${result.decision==='insufficient-evidence'||result.decision==='discouraged'?'result-reject':'result-pass'}`;
}

function initializeRecommendation() {
  $('#recommendationForm').addEventListener('submit',(event)=>{event.preventDefault();const values=formObject(event.currentTarget);values.fullUnderfill=event.currentTarget.elements.fullUnderfill.checked;renderRecommendation(recommendComponent(values));});
}

const traceLabels={needleGauge:['針頭 Gauge','Needle gauge'],edgeDistanceMm:['邊緣距離 (mm)','Edge distance (mm)'],dispenseDelaySec:['點膠延遲 (s)','Dispense delay (s)'],dispensedWeightMg:['點膠重量 (mg)','Dispensed weight (mg)'],flowRateMgSec:['流率 (mg/s)','Flow rate (mg/s)'],stagingMinutes:['Staging (min)','Staging (min)'],plasmaRecipe:['Plasma Recipe','Plasma recipe']};
function renderTraceFields(){const fields=SPEC.processControls.requiredTraceInputs.filter((key)=>key!=='materialLot').map((key)=>{const label=element('label');label.append(element('span',{text:traceLabels[key]?.[language()==='zh-Hant'?0:1]||key}),element('input',{name:key,required:true,maxLength:120}));return label;});$('#traceFields').replaceChildren(...fields);}
function inspectionInput(form){const data=formObject(form);return{...data,crack:form.elements.crack.checked,contamination:form.elements.contamination.checked,clearanceBreach:form.elements.clearanceBreach.checked,voids:[{jointId:'J1',areaPercent:Number(data.voidAreaPercent),topologyAcceptable:form.elements.topologyAcceptable.checked,locationAcceptable:form.elements.locationAcceptable.checked}],csamAcceptable:form.elements.csamAcceptable.checked};}

function updateInspectionVisuals(input,evaluation){
  const fillet=Number(input.filletHeightPercent)||0;const voidArea=Number(input.voids[0].areaPercent)||0;
  const componentTop=115;const componentBottom=240;const y=componentBottom-(componentBottom-componentTop)*Math.max(0,Math.min(100,fillet))/100;
  $('#previewFillet').setAttribute('d',`M490 ${componentBottom} C535 ${componentBottom} 548 ${Math.max(y,145)} 556 270 H490Z`);
  $('#filletPercentLabel').textContent=`${fillet}%`;$('#filletPercentLabel').setAttribute('y',String(Math.max(y-10,90)));
  $('#voidIndicator').setAttribute('r',String(7+Math.sqrt(Math.max(0,voidArea))*4));$('#voidPercentLabel').textContent=`${voidArea}%`;
  const csamOk=input.csamAcceptable;$('#csamDefect').setAttribute('opacity',csamOk?'.08':'.82');$('#csamLabel').textContent=csamOk?'INTERFACE':'DELAMINATION';
  $('#filletVisual').classList.toggle('alarm',evaluation.result==='reject');
}

function updateInspectionPreview(){const input=inspectionInput($('#inspectionForm'));const evaluation=evaluateInspection(input);const preview=$('#inspectionPreview');preview.className=`preview-card ${evaluation.result}`;preview.replaceChildren(element('strong',{text:t('inspection.preview')}),document.createTextNode(` — ${t(`inspection.${evaluation.result}`)}`),element('div',{text:evaluation.reasonCodes.map((code)=>t(`reason.${code}`)).join(' · ')||SPEC.metadata.specVersion}));updateInspectionVisuals(input,evaluation);return evaluation;}

function initializeInspectionVisuals(){
  const balls=Array.from({length:7},(_,index)=>{const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');circle.setAttribute('cx',String(190+index*43));circle.setAttribute('cy','255');circle.setAttribute('r','15');return circle;});$('#previewBalls').replaceChildren(...balls);
  const xrayBalls=[];for(let row=0;row<7;row+=1)for(let column=0;column<10;column+=1){const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');circle.setAttribute('cx',String(125+column*43));circle.setAttribute('cy',String(78+row*38));circle.setAttribute('r','11');circle.setAttribute('fill','#73808a');circle.setAttribute('stroke','#dbe4e8');circle.setAttribute('stroke-width','2');xrayBalls.push(circle);}$('#xrayBalls').replaceChildren(...xrayBalls);
  $$('.visual-tabs button').forEach((button)=>button.addEventListener('click',()=>{$$('.visual-tabs button').forEach((candidate)=>candidate.classList.toggle('active',candidate===button));$$('.inspection-svg').forEach((visual)=>visual.classList.toggle('active',visual.id.toLowerCase().startsWith(button.dataset.visual)));}));
}

function initializeInspection(){const form=$('#inspectionForm');const fillet=SPEC.inspectionControls.fillet.heightPercent;form.elements.filletHeightPercent.value=String((fillet.min+fillet.max)/2);form.elements.perimeterPercent.value=String(SPEC.inspectionControls.fillet.perimeterPercent.max);form.elements.voidAreaPercent.value=String(SPEC.inspectionControls.void.individualJointAreaPercent.max/2);form.addEventListener('input',updateInspectionPreview);form.addEventListener('change',updateInspectionPreview);form.addEventListener('submit',async(event)=>{event.preventDefault();const button=$('#recordInspectionButton');button.disabled=true;try{const input=inspectionInput(form);const record=createRecord(input,evaluateInspection(input),build);await saveRecord(record);showToast(t('inspection.saved'));await renderRecords();}catch(error){showToast(error.message);}finally{button.disabled=false;}});updateInspectionPreview();}

function resultBadge(result){return element('span',{className:`result-badge ${result}`,text:t(`inspection.${result}`)});}
function filteredRecords(){const query=($('#recordsSearch')?.value||'').trim().toLowerCase();const filter=$('#recordsFilter')?.value||'all';return currentRecords.filter((record)=>(filter==='all'||record.result===filter)&&(!query||`${record.recordId} ${record.sampleId} ${record.batchId} ${record.specVersion}`.toLowerCase().includes(query)));}
function renderRecordRows(){const records=filteredRecords();const rows=records.length?records.map((record)=>element('tr',{},[element('td',{text:record.recordId.slice(0,8)}),element('td',{text:record.sampleId}),element('td',{text:record.batchId}),element('td',{text:record.specVersion}),element('td',{},[resultBadge(record.result)]),element('td',{text:new Date(record.timestamp).toLocaleString(language())})])):[element('tr',{},[element('td',{text:t('records.empty'),colSpan:6})])];$('#recordRows').replaceChildren(...rows);}
async function renderRecords(){currentRecords=await listRecords();const pass=currentRecords.filter((record)=>record.result==='pass').length;$('#recordBadge').textContent=String(currentRecords.length);$('#totalCount').textContent=String(currentRecords.length);$('#passCount').textContent=String(pass);$('#rejectCount').textContent=String(currentRecords.length-pass);renderRecordRows();return currentRecords;}
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const anchor=element('a',{href:url,download:name});document.body.append(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);}
function initializeRecords(){$('#exportJson').addEventListener('click',async()=>download('underfill-inspections.json',exportJson(await listRecords()),'application/json'));$('#exportCsv').addEventListener('click',async()=>download('underfill-inspections.csv',exportCsv(await listRecords()),'text/csv;charset=utf-8'));$('#importJson').addEventListener('change',async(event)=>{try{const parsed=JSON.parse(await event.target.files[0].text());await importRecords(parsed.records);showToast(`${t('records.imported')}: ${parsed.records.length}`);await renderRecords();}catch(error){showToast(error.message);}event.target.value='';});$('#recordsSearch').addEventListener('input',renderRecordRows);$('#recordsFilter').addEventListener('change',renderRecordRows);}

async function registerServiceWorker(){if(!('serviceWorker'in navigator)||import.meta.env.DEV)return;const registration=await navigator.serviceWorker.register('./sw.js');registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)$('#updateNotice').hidden=false;});});$('#reloadApp').addEventListener('click',()=>location.reload());}

function renderLocalizedExperience(){translatePage();renderOverview();renderLearning();renderSpecifications();renderTraceFields();updateInspectionPreview();renderRecordRows();}

async function initialize(){
  validateExperience();$('#specVersion').textContent=SPEC.metadata.specVersion;$('#appVersion').textContent=`${build.appVersion} · ${build.buildCommit.slice(0,8)}`;$('#languageSelect').value=language();
  $('#languageSelect').addEventListener('change',(event)=>setLanguage(event.target.value));onLanguageChange(renderLocalizedExperience);
  $('#specSearch').addEventListener('input',renderSpecifications);$('#specAuthority').addEventListener('change',renderSpecifications);$('#experienceSearch').addEventListener('input',renderExperienceSearch);
  document.addEventListener('keydown',(event)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();showSection('overview');$('#experienceSearch').focus();}});
  $('#closeSource').addEventListener('click',()=>$('#sourceDialog').close());$('#closeMedia').addEventListener('click',()=>$('#mediaDialog').close());
  initializeNavigation();initializeRecommendation();initializeInspectionVisuals();renderTraceFields();initializeInspection();initializeRecords();renderLocalizedExperience();
  await migrateLegacyProgress();await renderRecords();await registerServiceWorker();
}

initialize().catch((error)=>{console.error(error);showToast(error.message);});
