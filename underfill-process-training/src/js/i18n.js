const zh = {
  'app.title':'Underfill 製程學習與工程決策支援','app.subtitle':'受控規格、檢驗紀錄與工程模擬','app.training':'訓練','app.controlled':'受控決策支援','app.spec':'規格','app.version':'版本','app.source':'來源','app.close':'關閉','app.save':'記錄檢驗','app.exportJson':'匯出 JSON','app.exportCsv':'匯出 CSV','app.import':'匯入 JSON','app.storageWarning':'資料只儲存在此瀏覽器。請定期匯出，清除瀏覽器資料會造成紀錄遺失。',
  'nav.overview':'總覽','nav.learning':'製程訓練','nav.specifications':'受控規格','nav.recommendation':'封裝建議','nav.inspection':'檢驗判定','nav.records':'檢驗紀錄','nav.simulator':'九模組 3D 模擬器',
  'overview.title':'從學習到可追溯的工程判定','overview.body':'訓練內容與受控工程規則明確分離。只有附有版本與來源的規格能產生工程判定。','overview.card1':'受控規格','overview.card2':'明確記錄','overview.card3':'工程模擬','overview.card4':'訓練估算','overview.trainingNotice':'SPI、FPCA 與 Reflow 目前是深度訓練模組，不提供生產放行判定。',
  'spec.title':'受控製程規格','spec.material':'材料與回溫','spec.process':'點膠與固化','spec.inspection':'檢驗標準','spec.unavailable':'規格未受控，無法使用。',
  'learning.title':'Underfill 製程訓練路徑','learning.subtitle':'每個階段都區分概念、受控規則與現場追溯要求。','learning.objective':'學習目標','learning.actions':'關鍵操作','learning.risk':'常見失效風險',
  'recommendation.title':'封裝 Underfill 建議','recommendation.package':'封裝類型','recommendation.pitch':'Pitch (mm)','recommendation.ball':'球徑 (mm)','recommendation.standoff':'Standoff (mm)','recommendation.width':'封裝寬度 (mm)','recommendation.length':'封裝長度 (mm)','recommendation.clearance':'邊緣空間 (mm)','recommendation.reliability':'可靠度等級','recommendation.environment':'使用環境','recommendation.material':'材料','recommendation.profile':'製程設定檔','recommendation.full':'全填充 QFN','recommendation.run':'產生建議','recommendation.missing':'資料不足','recommendation.validation':'必要驗證','recommendation.rationale':'判定依據',
  'validation.confirm-process-window':'確認製程窗口','validation.document-risk-assessment':'完成風險評估','validation.run-product-validation':'執行產品驗證','validation.approve-reliability-plan':'核准可靠度計畫',
  'inspection.title':'Visual / X-Ray / CSAM 檢驗','inspection.sample':'樣品 ID','inspection.batch':'批次 ID','inspection.lot':'材料批號','inspection.fillet':'Fillet 高度 (%)','inspection.perimeter':'周邊連續率 (%)','inspection.crack':'發現裂紋','inspection.contamination':'發現污染','inspection.clearance':'侵犯安全間距','inspection.void':'單一焊點 Void 面積 (%)','inspection.topology':'Void 型態可接受','inspection.location':'Void 位置可接受','inspection.csam':'CSAM 判定可接受','inspection.csamDisposition':'CSAM 說明','inspection.notes':'備註','inspection.preview':'即時預覽（不會建立紀錄）','inspection.pass':'通過','inspection.reject':'不通過','inspection.saved':'檢驗紀錄已儲存','inspection.requiredTrace':'製程追溯輸入',
  'records.title':'本機檢驗紀錄','records.total':'總數','records.pass':'通過','records.reject':'不通過','records.empty':'尚無紀錄','records.imported':'匯入完成',
  'reason.FILLET_HEIGHT_OUT_OF_RANGE':'Fillet 高度超出範圍','reason.FILLET_PERIMETER_INCOMPLETE':'Fillet 周邊不連續','reason.FILLET_CRACK_PRESENT':'發現 Fillet 裂紋','reason.FILLET_CONTAMINATION_PRESENT':'發現 Fillet 污染','reason.FILLET_CLEARANCE_BREACH':'Fillet 侵犯安全間距','reason.VOID_INDIVIDUAL_JOINT_AREA_EXCEEDED':'單一焊點 Void 面積超標','reason.VOID_TOPOLOGY_REJECTED':'Void 型態不接受','reason.VOID_LOCATION_REJECTED':'Void 位置不接受','reason.CSAM_DISPOSITION_REJECTED':'CSAM 處置不接受','reason.INSPECTION_INPUT_INVALID':'檢驗輸入不完整',
  'sim.title':'Underfill / SMT 工程模擬器','sim.module':'模組','sim.controlled':'受控 Underfill 模組','sim.trainingOnly':'深度訓練模組：不得用於生產放行','sim.fallback':'3D 無法啟動，已切換為可操作的 2D 剖面。','sim.reset':'重設視角','sim.processView':'製程視角','sim.crossView':'側面剖視','sim.topView':'俯視','sim.estimate':'訓練估算','sim.notCalibrated':'未經生產校準，不輸出 PASS/REJECT。','sim.back':'返回訓練首頁','sim.temperature':'溫度 (°C)','sim.pressure':'壓力 (MPa)','sim.clearance':'針頭間距 (mm)','sim.progress':'模擬進度','sim.scale':'尺寸示意（mm）',
  'decision.mandatory':'必須使用 Underfill','decision.recommended-after-validation':'完成風險與可靠度驗證後建議使用','decision.conditional':'條件式使用','decision.discouraged':'不建議全填充','decision.insufficient-evidence':'資料不足，禁止工程判定'
};

const en = {
  'app.title':'Underfill Process Learning & Engineering Decision Support','app.subtitle':'Controlled specifications, inspection records, and engineering simulation','app.training':'Training','app.controlled':'Controlled decision support','app.spec':'Specification','app.version':'Version','app.source':'Source','app.close':'Close','app.save':'Record inspection','app.exportJson':'Export JSON','app.exportCsv':'Export CSV','app.import':'Import JSON','app.storageWarning':'Records stay in this browser. Export regularly; clearing browser data will remove them.',
  'nav.overview':'Overview','nav.learning':'Process training','nav.specifications':'Controlled specifications','nav.recommendation':'Package recommendation','nav.inspection':'Inspection decision','nav.records':'Inspection records','nav.simulator':'Nine-module 3D simulator',
  'overview.title':'From learning to traceable engineering decisions','overview.body':'Training content and controlled engineering rules are separated. Only versioned, sourced specifications can produce engineering decisions.','overview.card1':'Controlled data','overview.card2':'Explicit records','overview.card3':'Engineering simulation','overview.card4':'Training estimates','overview.trainingNotice':'SPI, FPCA, and Reflow are currently deep training modules and cannot release production.',
  'spec.title':'Controlled process specification','spec.material':'Material and thawing','spec.process':'Dispensing and curing','spec.inspection':'Inspection criteria','spec.unavailable':'The specification is not controlled and cannot be used.',
  'learning.title':'Underfill process training path','learning.subtitle':'Each stage separates concepts, controlled rules, and shop-floor traceability.','learning.objective':'Learning objective','learning.actions':'Key actions','learning.risk':'Common failure risk',
  'recommendation.title':'Package Underfill recommendation','recommendation.package':'Package type','recommendation.pitch':'Pitch (mm)','recommendation.ball':'Ball size (mm)','recommendation.standoff':'Standoff (mm)','recommendation.width':'Package width (mm)','recommendation.length':'Package length (mm)','recommendation.clearance':'Edge clearance (mm)','recommendation.reliability':'Reliability class','recommendation.environment':'Environment','recommendation.material':'Material','recommendation.profile':'Process profile','recommendation.full':'Full-underfill QFN','recommendation.run':'Generate recommendation','recommendation.missing':'Missing inputs','recommendation.validation':'Required validation','recommendation.rationale':'Decision rationale',
  'validation.confirm-process-window':'Confirm process window','validation.document-risk-assessment':'Document risk assessment','validation.run-product-validation':'Run product validation','validation.approve-reliability-plan':'Approve reliability plan',
  'inspection.title':'Visual / X-Ray / CSAM inspection','inspection.sample':'Sample ID','inspection.batch':'Batch ID','inspection.lot':'Material lot','inspection.fillet':'Fillet height (%)','inspection.perimeter':'Perimeter continuity (%)','inspection.crack':'Crack present','inspection.contamination':'Contamination present','inspection.clearance':'Clearance breach','inspection.void':'Individual-joint void area (%)','inspection.topology':'Void topology acceptable','inspection.location':'Void location acceptable','inspection.csam':'CSAM disposition acceptable','inspection.csamDisposition':'CSAM disposition','inspection.notes':'Notes','inspection.preview':'Live preview (does not create a record)','inspection.pass':'Pass','inspection.reject':'Reject','inspection.saved':'Inspection record saved','inspection.requiredTrace':'Process trace inputs',
  'records.title':'Local inspection records','records.total':'Total','records.pass':'Pass','records.reject':'Reject','records.empty':'No records yet','records.imported':'Import complete',
  'reason.FILLET_HEIGHT_OUT_OF_RANGE':'Fillet height is outside the controlled range','reason.FILLET_PERIMETER_INCOMPLETE':'Fillet perimeter is incomplete','reason.FILLET_CRACK_PRESENT':'Fillet crack is present','reason.FILLET_CONTAMINATION_PRESENT':'Fillet contamination is present','reason.FILLET_CLEARANCE_BREACH':'Fillet breaches clearance','reason.VOID_INDIVIDUAL_JOINT_AREA_EXCEEDED':'An individual-joint void exceeds the limit','reason.VOID_TOPOLOGY_REJECTED':'Void topology is rejected','reason.VOID_LOCATION_REJECTED':'Void location is rejected','reason.CSAM_DISPOSITION_REJECTED':'CSAM disposition is rejected','reason.INSPECTION_INPUT_INVALID':'Inspection input is incomplete',
  'sim.title':'Underfill / SMT Engineering Simulator','sim.module':'Module','sim.controlled':'Controlled Underfill module','sim.trainingOnly':'Deep training module: not for production release','sim.fallback':'3D could not start; an interactive 2D cross-section is active.','sim.reset':'Reset camera','sim.processView':'Process view','sim.crossView':'Side cross-section','sim.topView':'Top view','sim.estimate':'Training estimate','sim.notCalibrated':'Not production calibrated; no PASS/REJECT is produced.','sim.back':'Back to training','sim.temperature':'Temperature (°C)','sim.pressure':'Pressure (MPa)','sim.clearance':'Needle clearance (mm)','sim.progress':'Simulation progress','sim.scale':'Illustrative dimensions (mm)',
  'decision.mandatory':'Underfill is mandatory','decision.recommended-after-validation':'Recommended after risk and reliability validation','decision.conditional':'Conditionally applicable','decision.discouraged':'Full underfill is discouraged','decision.insufficient-evidence':'Insufficient evidence; engineering decision is blocked'
};

export const dictionaries = Object.freeze({ 'zh-Hant': zh, en });
const storage = typeof localStorage === 'undefined' ? { getItem: () => null, setItem: () => {} } : localStorage;
let language = storage.getItem('underfill-language') || 'zh-Hant';
const listeners = new Set();

export function t(key) { return dictionaries[language][key] ?? `[${key}]`; }
export function getLanguage() { return language; }
export function setLanguage(next) {
  if (!dictionaries[next]) throw new Error(`Unsupported language: ${next}`);
  language = next;
  storage.setItem('underfill-language', next);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next;
    translatePage();
  }
  listeners.forEach((listener) => listener(next));
}
export function onLanguageChange(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export function translatePage(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((element) => { element.textContent = t(element.dataset.i18n); });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((element) => { element.placeholder = t(element.dataset.i18nPlaceholder); });
}
export function missingKeys() {
  const all = new Set([...Object.keys(zh), ...Object.keys(en)]);
  return [...all].filter((key) => !Object.hasOwn(zh, key) || !Object.hasOwn(en, key));
}
