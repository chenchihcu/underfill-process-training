import { SPEC, formatRule, sourceFor } from './spec.js';
import { evaluateInspection } from './acceptance.js';
import { recommendComponent } from './recommendation.js';
import { createRecord, exportCsv, exportJson, importRecords, listRecords, migrateLegacyProgress, saveRecord } from './records.js';
import { getLanguage, onLanguageChange, setLanguage, t, translatePage } from './i18n.js';

const build = { appVersion: __APP_VERSION__, buildCommit: __BUILD_COMMIT__ };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

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

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => { toast.hidden = true; }, 3200);
}

function localLabel(zh, en) { return getLanguage() === 'zh-Hant' ? zh : en; }

function showSource(rule) {
  const source = sourceFor(rule);
  if (!source) return;
  const roleLabels = {
    'primary controlled authority':['主要受控依據','Primary controlled authority'],
    'secondary where primary is silent':['主要文件未定義時的次要依據','Secondary where the primary source is silent'],
    'package strategy where primary is silent':['主要文件未定義時的封裝策略依據','Package strategy where the primary source is silent'],
    'explanation and visualization only':['僅供說明與視覺化','Explanation and visualization only']
  };
  const role = roleLabels[source.role]?.[getLanguage() === 'zh-Hant' ? 0 : 1] || source.role;
  const labels = getLanguage() === 'zh-Hant'
    ? [['規則 ID', source.ruleId], ['文件', source.title], ['角色', role], ['參考位置', source.reference], ['檔案', source.location]]
    : [['Rule ID', source.ruleId], ['Document', source.title], ['Role', role], ['Reference', source.reference], ['File', source.location]];
  const details = $('#sourceDetails');
  details.replaceChildren(...labels.flatMap(([term, definition]) => [element('dt', { text: term }), element('dd', { text: definition })]));
  $('#sourceDialog').showModal();
}

function specItem(label, value, rule) {
  const button = element('button', { type: 'button', className: 'source-button', text: t('app.source') });
  button.addEventListener('click', () => showSource(rule));
  return element('article', { className: 'spec-item' }, [element('span', { text: label }), element('strong', { text: value }), button]);
}

function renderSpecifications() {
  const material = SPEC.materialControls;
  const process = SPEC.processControls;
  const inspection = SPEC.inspectionControls;
  const groups = [
    {
      title: t('spec.material'),
      items: [
        specItem(localLabel('冷凍儲存', 'Frozen storage'), formatRule(material.storageTemperature), material.storageTemperature),
        specItem(localLabel('可使用時間', 'Pot life'), `${formatRule(material.potLife)} · ${material.potLife.condition}`, material.potLife),
        ...Object.entries(material.thawing).map(([volume, rule]) => specItem(`${volume} cc ${localLabel('回溫', 'thaw')}`, formatRule(rule), rule))
      ]
    },
    {
      title: t('spec.process'),
      items: [
        specItem(localLabel('預熱目標', 'Preheat target'), formatRule(process.preheatTarget), process.preheatTarget),
        specItem(localLabel('工程容許範圍', 'Engineering tolerance'), formatRule(process.preheatTolerance), process.preheatTolerance),
        specItem(localLabel('點膠壓力', 'Dispense pressure'), formatRule(process.dispensePressure), process.dispensePressure),
        specItem(localLabel('針頭間距', 'Needle clearance'), formatRule(process.needleClearance), process.needleClearance),
        ...process.cureProfiles.map((rule) => specItem(localLabel('固化設定', 'Cure profile'), `${rule.temperature} °C · ≥ ${rule.minimumMinutes} min`, rule))
      ]
    },
    {
      title: t('spec.inspection'),
      items: [
        specItem(localLabel('Fillet 高度', 'Fillet height'), formatRule(inspection.fillet.heightPercent), inspection.fillet.heightPercent),
        specItem(localLabel('周邊連續率', 'Perimeter continuity'), formatRule(inspection.fillet.perimeterPercent), inspection.fillet.perimeterPercent),
        specItem(localLabel('單一焊點 Void', 'Individual-joint void'), formatRule(inspection.void.individualJointAreaPercent), inspection.void.individualJointAreaPercent),
        specItem(localLabel('Void 型態', 'Void topology'), localLabel('依受控處置規則', 'Controlled disposition rule'), inspection.void.topologyRule),
        specItem(localLabel('CSAM', 'CSAM'), localLabel('依範圍與處置規則', 'Extent and disposition rule'), inspection.csam.dispositionRule)
      ]
    }
  ];
  const container = $('#specCards');
  container.replaceChildren(...groups.map((group) => element('section', { className: 'spec-section' }, [element('h3', { text: group.title }), element('div', { className: 'spec-grid' }, group.items)])));
}

const LESSONS = [
  { title:['製程目的與封裝策略','Purpose and package strategy'], objective:['理解 Underfill 如何分散焊點的熱機械應力，並先確認封裝是否適用。','Understand how Underfill redistributes solder-joint thermomechanical stress and first determine package applicability.'], actions:[['辨識 WLCSP、Flip Chip、BGA 與 QFN','Identify WLCSP, Flip Chip, BGA, and QFN'],['先完成封裝與可靠度風險評估','Complete package and reliability risk assessment first']], risks:[['未經評估即全填充 QFN','Full-underfill QFN without validation'],['將訓練建議誤當生產放行','Treating training guidance as production release']] },
  { title:['材料收料、儲存與回溫','Incoming material, storage, and thawing'], objective:['維持材料履歷並避免冷凝、錯誤回溫與重複冷凍。','Maintain material genealogy and prevent condensation, incorrect thawing, and refreezing.'], actions:[['核對批號、效期、CoA 與外觀','Verify lot, expiry, CoA, and appearance'],['依容器容量選擇受控回溫時間','Select controlled thaw time by container volume'],['記錄材料批號與開封時間','Record material lot and opening time']], risks:[['冷凝水造成流動或附著異常','Condensation causing flow or adhesion defects'],['超過可使用時間仍上線','Using material beyond pot life']], rule:'storageTemperature' },
  { title:['PCB 前處理與 Plasma','PCB preparation and plasma'], objective:['建立潔淨、可潤濕且可追溯的表面狀態。','Create a clean, wettable, traceable surface condition.'], actions:[['確認烘烤與清潔需求','Confirm bake and cleaning requirements'],['記錄 Plasma recipe 與完成時間','Record plasma recipe and completion time'],['控制 Plasma 到點膠的 staging','Control staging from plasma to dispense']], risks:[['表面再污染造成流痕與空洞','Surface recontamination causing flow striation and voids'],['使用未受控的 Plasma 數值','Using unsourced plasma parameters']] },
  { title:['預熱與設備設定','Preheat and equipment setup'], objective:['讓材料黏度與基板溫度進入受控窗口。','Bring material viscosity and substrate temperature into the controlled window.'], actions:[['量測實際板溫，不只讀取機台設定值','Measure actual board temperature, not only machine setpoint'],['確認針頭 Gauge、Z 間距與邊緣距離','Confirm needle gauge, Z clearance, and edge distance'],['執行首件重量與流率確認','Verify first-piece weight and flow rate']], risks:[['把目標範圍與容許範圍混為一談','Confusing target and accepted ranges'],['壓力或間距超出受控範圍','Pressure or clearance outside the controlled window']], rule:'preheatTarget' },
  { title:['點膠路徑與毛細流動','Dispense path and capillary flow'], objective:['理解 I/L/U 路徑、延遲與流動前緣如何影響空氣排出。','Understand how I/L/U paths, delay, and flow-front behavior affect air evacuation.'], actions:[['依封裝幾何選擇路徑並保留排氣方向','Choose a path from package geometry and preserve an air exit'],['記錄壓力、速度、重量、流率與延遲','Record pressure, speed, weight, flow, and delay'],['觀察 flow front，不用估算值放行','Observe the flow front; never release from a heuristic estimate']], risks:[['兩個流動前緣包住空氣','Converging flow fronts trap air'],['Racing effect 造成局部缺膠','Racing effect causes local starvation']], rule:'dispensePressure' },
  { title:['固化與熱歷程','Cure and thermal history'], objective:['使用受控溫度與最短時間完成固化，並保留熱歷程。','Use controlled temperature and minimum time while retaining thermal history.'], actions:[['選擇已核准的固化 profile','Select an approved cure profile'],['確認產品實際溫度與持溫時間','Confirm actual product temperature and dwell time'],['避免自行外插新的溫時組合','Do not extrapolate new time-temperature combinations']], risks:[['固化不足造成黏著與可靠度失效','Under-cure causing adhesion and reliability failure'],['過度熱負荷造成翹曲或材料劣化','Excess thermal load causing warpage or material degradation']], rule:'cureProfiles' },
  { title:['Visual、X-Ray 與 CSAM','Visual, X-Ray, and CSAM'], objective:['以每顆焊點與完整 Fillet 條件進行判定，不使用總面積捷徑。','Decide per solder joint and complete fillet criteria, never total-area shortcuts.'], actions:[['確認 Fillet 高度與 100% 周邊連續','Confirm fillet height and 100% perimeter continuity'],['逐顆記錄 Void 面積、型態與位置','Record void area, topology, and location per joint'],['記錄 CSAM 範圍與處置','Record CSAM extent and disposition']], risks:[['總面積平均掩蓋單顆超標','Total-area averaging hides a failed joint'],['畫面預覽被誤算為檢驗樣品','A preview is miscounted as an inspected sample']], rule:'fillet' },
  { title:['異常分析與閉環改善','Defect analysis and closed-loop improvement'], objective:['從材料、表面、設備、路徑、固化與檢驗證據建立可驗證根因。','Build a verifiable root cause from material, surface, equipment, path, cure, and inspection evidence.'], actions:[['先保全批次與製程履歷','Preserve lot and process genealogy first'],['比較預期與觀察結果並建立假設','Compare expected and observed behavior and form hypotheses'],['使用受控試驗驗證，不盲目調參','Validate through controlled trials, not blind parameter changes']], risks:[['未校準公式輸出假性 PASS/REJECT','Uncalibrated formulas produce false PASS/REJECT'],['調參後沒有重新驗證與文件化','Changes lack revalidation and documentation']] }
];

function lessonRuleValue(ruleName) {
  if (!ruleName) return '';
  if (ruleName === 'storageTemperature') return formatRule(SPEC.materialControls.storageTemperature);
  if (ruleName === 'preheatTarget') return formatRule(SPEC.processControls.preheatTarget);
  if (ruleName === 'dispensePressure') return formatRule(SPEC.processControls.dispensePressure);
  if (ruleName === 'cureProfiles') return SPEC.processControls.cureProfiles.map((rule) => `${rule.temperature} °C ≥ ${rule.minimumMinutes} min`).join(' · ');
  if (ruleName === 'fillet') return `${formatRule(SPEC.inspectionControls.fillet.heightPercent)} · ${formatRule(SPEC.inspectionControls.fillet.perimeterPercent)}`;
  return '';
}

function renderLearning() {
  const languageIndex = getLanguage() === 'zh-Hant' ? 0 : 1;
  const cards = LESSONS.map((lesson, index) => {
    const list = (items) => element('ul', {}, items.map((item) => element('li', { text:item[languageIndex] })));
    const content = [element('h4',{text:t('learning.objective')}),element('p',{text:lesson.objective[languageIndex]}),element('h4',{text:t('learning.actions')}),list(lesson.actions),element('h4',{text:t('learning.risk')}),list(lesson.risks)];
    const ruleValue = lessonRuleValue(lesson.rule);
    if (ruleValue) content.push(element('div',{className:'lesson-spec',text:`${SPEC.metadata.specVersion} · ${ruleValue}`}));
    return element('details',{className:'lesson-card',open:index===0},[element('summary',{},[element('span',{className:'lesson-number',text:String(index+1).padStart(2,'0')}),document.createTextNode(lesson.title[languageIndex])]),element('div',{className:'lesson-content'},content)]);
  });
  $('#lessonGrid').replaceChildren(...cards);
}

function initializeNavigation() {
  $$('.nav-item[data-section]').forEach((button) => button.addEventListener('click', () => {
    $$('.page').forEach((page) => { page.hidden = true; page.classList.remove('active'); });
    $$('.nav-item[data-section]').forEach((item) => { item.classList.remove('active'); item.removeAttribute('aria-current'); });
    const page = document.getElementById(button.dataset.section);
    page.hidden = false;
    page.classList.add('active');
    button.classList.add('active');
    button.setAttribute('aria-current', 'page');
    $('#main').focus({ preventScroll: true });
    history.replaceState(null, '', `#${button.dataset.section}`);
    if (button.dataset.section === 'records') renderRecords();
  }));
  const initial = location.hash.slice(1);
  const initialButton = initial && $(`.nav-item[data-section="${CSS.escape(initial)}"]`);
  if (initialButton) initialButton.click();
}

function formObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function renderRecommendation(result) {
  const panel = $('#recommendationResult');
  panel.hidden = false;
  const missingKeyMap = {packageType:'package',pitchMm:'pitch',ballSizeMm:'ball',standoffMm:'standoff',packageWidthMm:'width',packageLengthMm:'length',edgeClearanceMm:'clearance',reliabilityClass:'reliability',environment:'environment',material:'material',processProfile:'profile'};
  const missingLabels = result.missingInputs.map((key) => missingKeyMap[key] ? t(`recommendation.${missingKeyMap[key]}`) : key);
  const validationLabels = result.validation.map((key) => t(`validation.${key}`));
  panel.replaceChildren(
    element('h3', { text: t(`decision.${result.decision}`) }),
    element('p', { text: `${t('recommendation.rationale')}: ${result.ruleIds.join(', ') || '—'} · ${result.specVersion}` }),
    element('p', { text: `${t('recommendation.missing')}: ${missingLabels.join(', ') || '—'}` }),
    element('p', { text: `${t('recommendation.validation')}: ${validationLabels.join(', ') || '—'}` })
  );
  panel.className = `result-panel ${result.decision === 'insufficient-evidence' || result.decision === 'discouraged' ? 'result-reject' : 'result-pass'}`;
}

function initializeRecommendation() {
  $('#recommendationForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const values = formObject(event.currentTarget);
    values.fullUnderfill = event.currentTarget.elements.fullUnderfill.checked;
    renderRecommendation(recommendComponent(values));
  });
}

const traceLabels = {
  needleGauge: ['針頭 Gauge', 'Needle gauge'], edgeDistanceMm: ['邊緣距離 (mm)', 'Edge distance (mm)'], dispenseDelaySec: ['點膠延遲 (s)', 'Dispense delay (s)'], dispensedWeightMg: ['點膠重量 (mg)', 'Dispensed weight (mg)'], flowRateMgSec: ['流率 (mg/s)', 'Flow rate (mg/s)'], stagingMinutes: ['Staging (min)', 'Staging (min)'], plasmaRecipe: ['Plasma Recipe', 'Plasma recipe']
};

function renderTraceFields() {
  const fields = SPEC.processControls.requiredTraceInputs.filter((key) => key !== 'materialLot').map((key) => {
    const label = element('label');
    label.append(element('span', { text: traceLabels[key]?.[getLanguage() === 'zh-Hant' ? 0 : 1] || key }), element('input', { name: key, required: true, maxLength: 120 }));
    return label;
  });
  $('#traceFields').replaceChildren(...fields);
}

function inspectionInput(form) {
  const data = formObject(form);
  return {
    ...data,
    crack: form.elements.crack.checked,
    contamination: form.elements.contamination.checked,
    clearanceBreach: form.elements.clearanceBreach.checked,
    voids: [{ jointId: 'J1', areaPercent: Number(data.voidAreaPercent), topologyAcceptable: form.elements.topologyAcceptable.checked, locationAcceptable: form.elements.locationAcceptable.checked }],
    csamAcceptable: form.elements.csamAcceptable.checked
  };
}

function updateInspectionPreview() {
  const evaluation = evaluateInspection(inspectionInput($('#inspectionForm')));
  const preview = $('#inspectionPreview');
  preview.className = `preview-card ${evaluation.result}`;
  preview.replaceChildren(element('strong', { text: t('inspection.preview') }), document.createTextNode(` — ${t(`inspection.${evaluation.result}`)}`), element('div', { text: evaluation.reasonCodes.map((code) => t(`reason.${code}`)).join(' · ') || SPEC.metadata.specVersion }));
  return evaluation;
}

function initializeInspection() {
  const form = $('#inspectionForm');
  form.addEventListener('input', updateInspectionPreview);
  form.addEventListener('change', updateInspectionPreview);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('#recordInspectionButton');
    button.disabled = true;
    try {
      const input = inspectionInput(form);
      const record = createRecord(input, evaluateInspection(input), build);
      await saveRecord(record);
      showToast(t('inspection.saved'));
      await renderRecords();
    } catch (error) {
      showToast(error.message);
    } finally {
      button.disabled = false;
    }
  });
  updateInspectionPreview();
}

function resultBadge(result) { return element('span', { className: `result-badge ${result}`, text: t(`inspection.${result}`) }); }

async function renderRecords() {
  const records = await listRecords();
  const pass = records.filter((record) => record.result === 'pass').length;
  $('#recordBadge').textContent = String(records.length);
  $('#totalCount').textContent = String(records.length);
  $('#passCount').textContent = String(pass);
  $('#rejectCount').textContent = String(records.length - pass);
  const rows = records.length ? records.map((record) => element('tr', {}, [
    element('td', { text: record.recordId.slice(0, 8) }), element('td', { text: record.sampleId }), element('td', { text: record.batchId }), element('td', { text: record.specVersion }), element('td', {}, [resultBadge(record.result)]), element('td', { text: new Date(record.timestamp).toLocaleString(getLanguage()) })
  ])) : [element('tr', {}, [element('td', { text: t('records.empty'), colSpan: 6 })])];
  $('#recordRows').replaceChildren(...rows);
  return records;
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = element('a', { href: url, download: name });
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function initializeRecords() {
  $('#exportJson').addEventListener('click', async () => download('underfill-inspections.json', exportJson(await listRecords()), 'application/json'));
  $('#exportCsv').addEventListener('click', async () => download('underfill-inspections.csv', exportCsv(await listRecords()), 'text/csv;charset=utf-8'));
  $('#importJson').addEventListener('change', async (event) => {
    try {
      const parsed = JSON.parse(await event.target.files[0].text());
      await importRecords(parsed.records);
      showToast(`${t('records.imported')}: ${parsed.records.length}`);
      await renderRecords();
    } catch (error) { showToast(error.message); }
    event.target.value = '';
  });
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const registration = await navigator.serviceWorker.register('./sw.js');
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) $('#updateNotice').hidden = false;
    });
  });
  $('#reloadApp').addEventListener('click', () => location.reload());
}

async function initialize() {
  $('#specVersion').textContent = SPEC.metadata.specVersion;
  $('#appVersion').textContent = `${build.appVersion} · ${build.buildCommit.slice(0, 8)}`;
  $('#overviewSpec').textContent = SPEC.metadata.specVersion;
  $('#languageSelect').value = getLanguage();
  $('#languageSelect').addEventListener('change', (event) => setLanguage(event.target.value));
  onLanguageChange(() => { renderSpecifications(); renderLearning(); renderTraceFields(); updateInspectionPreview(); renderRecords(); });
  translatePage();
  renderSpecifications();
  renderLearning();
  renderTraceFields();
  initializeNavigation();
  initializeRecommendation();
  initializeInspection();
  initializeRecords();
  await migrateLegacyProgress();
  await renderRecords();
  await registerServiceWorker();
}

initialize().catch((error) => { console.error(error); showToast(error.message); });
