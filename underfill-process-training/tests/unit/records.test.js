import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createRecord, exportCsv, exportJson, importRecords, listRecords, saveRecord } from '../../src/js/records.js';
import { evaluateInspection } from '../../src/js/acceptance.js';

const input = { sampleId:'S-1',batchId:'<img src=x onerror=alert(1)>',materialLot:'LOT-1',filletHeightPercent:60,perimeterPercent:100,crack:false,contamination:false,clearanceBreach:false,voids:[{jointId:'J1',areaPercent:10,topologyAcceptable:true,locationAcceptable:true}],csamAcceptable:true,csamDisposition:'Accept',notes:'<script>unsafe</script>',needleGauge:'25G',edgeDistanceMm:'0.4',dispenseDelaySec:'2',dispensedWeightMg:'2.1',flowRateMgSec:'0.3',stagingMinutes:'20',plasmaRecipe:'P1'};

beforeEach(async () => { await new Promise((resolve) => { const request=indexedDB.deleteDatabase('underfill-training'); request.onsuccess=request.onerror=request.onblocked=()=>resolve(); }); });
describe('inspection records', () => {
  it('preserves user text as data and exports versioned JSON/CSV', () => {
    const record=createRecord(input,evaluateInspection(input),{appVersion:'3.0.0',buildCommit:'abc'});
    expect(record.batchId).toContain('<img');
    expect(JSON.parse(exportJson([record])).records[0].specVersion).toBe(record.specVersion);
    expect(exportCsv([record])).toContain('"<img src=x onerror=alert(1)>"');
  });
  it('stores one record and rejects a duplicate ID on import', async () => {
    const record=createRecord(input,evaluateInspection(input),{});
    await saveRecord(record);
    expect(await listRecords()).toHaveLength(1);
    await expect(importRecords([record])).rejects.toThrow(/Duplicate/);
  });
});
