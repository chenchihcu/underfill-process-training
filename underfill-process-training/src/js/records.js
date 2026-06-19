import { SPEC } from './spec.js';

export const RECORD_SCHEMA_VERSION = 1;
const DB_NAME = 'underfill-training';
const STORE = 'inspections';

function cleanText(value, maxLength, required = false) {
  const text = String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (required && !text) throw new Error('A required identifier is missing.');
  if (text.length > maxLength) throw new Error(`Text exceeds ${maxLength} characters.`);
  return text;
}

export function validateRecord(record) {
  if (!record || record.schemaVersion !== RECORD_SCHEMA_VERSION) throw new Error('Unsupported inspection record schema.');
  if (!record.recordId || !record.sampleId || !record.batchId || !record.timestamp) throw new Error('Inspection record identifiers are incomplete.');
  if (!['pass', 'reject'].includes(record.result)) throw new Error('Inspection result is invalid.');
  if (!Array.isArray(record.reasonCodes) || !Array.isArray(record.measurements?.voids)) throw new Error('Inspection measurements are invalid.');
  return true;
}

export function createRecord(input, evaluation, build = {}) {
  const record = {
    schemaVersion: RECORD_SCHEMA_VERSION,
    recordId: input.recordId || crypto.randomUUID(),
    sampleId: cleanText(input.sampleId, 80, true),
    batchId: cleanText(input.batchId, 80, true),
    materialLot: cleanText(input.materialLot, 80),
    timestamp: input.timestamp || new Date().toISOString(),
    appVersion: build.appVersion || 'development',
    buildCommit: build.buildCommit || 'local-development',
    specVersion: SPEC.metadata.specVersion,
    measurements: {
      filletHeightPercent: Number(input.filletHeightPercent),
      perimeterPercent: Number(input.perimeterPercent),
      crack: Boolean(input.crack),
      contamination: Boolean(input.contamination),
      clearanceBreach: Boolean(input.clearanceBreach),
      voids: input.voids.map((joint, index) => ({
        jointId: cleanText(joint.jointId || `J${index + 1}`, 40, true),
        areaPercent: Number(joint.areaPercent),
        topologyAcceptable: joint.topologyAcceptable === true,
        locationAcceptable: joint.locationAcceptable === true
      })),
      csamAcceptable: input.csamAcceptable === true,
      csamDisposition: cleanText(input.csamDisposition, 120)
    },
    trace: Object.fromEntries(SPEC.processControls.requiredTraceInputs.map((key) => [key, cleanText(input[key], 120)])),
    result: evaluation.result,
    reasonCodes: [...evaluation.reasonCodes],
    notes: cleanText(input.notes, 1000)
  };
  validateRecord(record);
  return record;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        const store = database.createObjectStore(STORE, { keyPath: 'recordId' });
        store.createIndex('timestamp', 'timestamp');
        store.createIndex('result', 'result');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transaction(mode, operation) {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let output;
    try { output = operation(store); } catch (error) { database.close(); reject(error); return; }
    tx.oncomplete = () => { database.close(); resolve(output); };
    tx.onerror = () => { database.close(); reject(tx.error); };
    tx.onabort = () => { database.close(); reject(tx.error || new Error('Inspection storage transaction aborted.')); };
  }));
}

export async function saveRecord(record) {
  validateRecord(record);
  return transaction('readwrite', (store) => {
    const request = store.add(record);
    request.onerror = () => {
      if (request.error?.name === 'ConstraintError') request.transaction.abort();
    };
    return record;
  });
}

export async function listRecords() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => database.close();
  });
}

export async function importRecords(records) {
  if (!Array.isArray(records)) throw new Error('Import must contain an array of inspection records.');
  records.forEach(validateRecord);
  const existing = new Set((await listRecords()).map((record) => record.recordId));
  const duplicate = records.find((record) => existing.has(record.recordId));
  if (duplicate) throw new Error(`Duplicate inspection record: ${duplicate.recordId}`);
  for (const record of records) await saveRecord(record);
  return records.length;
}

export function exportJson(records) {
  records.forEach(validateRecord);
  return JSON.stringify({ exportSchema: 1, exportedAt: new Date().toISOString(), records }, null, 2);
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

export function exportCsv(records) {
  records.forEach(validateRecord);
  const headers = ['recordId','sampleId','batchId','materialLot','timestamp','specVersion','result','reasonCodes','filletHeightPercent','perimeterPercent','maximumVoidPercent','csamAcceptable','notes'];
  const rows = records.map((record) => {
    const maximumVoid = Math.max(...record.measurements.voids.map((joint) => joint.areaPercent));
    const values = [record.recordId, record.sampleId, record.batchId, record.materialLot, record.timestamp, record.specVersion, record.result, record.reasonCodes.join('|'), record.measurements.filletHeightPercent, record.measurements.perimeterPercent, maximumVoid, record.measurements.csamAcceptable, record.notes];
    return values.map(csvCell).join(',');
  });
  return [headers.map(csvCell).join(','), ...rows].join('\r\n');
}

export async function migrateLegacyProgress() {
  const marker = 'underfill-progress-migrated-v1';
  if (localStorage.getItem(marker)) return;
  const legacy = localStorage.getItem('underfillTrainingProgress') || localStorage.getItem('progress');
  if (legacy) localStorage.setItem('underfill-training-progress-v1', legacy);
  localStorage.setItem(marker, 'true');
}
