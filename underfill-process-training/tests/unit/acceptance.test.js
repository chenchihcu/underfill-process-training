import { describe, expect, it } from 'vitest';
import { evaluateInspection, REASON_CODES } from '../../src/js/acceptance.js';

const passing = { filletHeightPercent:60, perimeterPercent:100, crack:false, contamination:false, clearanceBreach:false, voids:[{jointId:'J1',areaPercent:25,topologyAcceptable:true,locationAcceptable:true}], csamAcceptable:true };

describe('inspection acceptance engine', () => {
  it('passes controlled boundary values per individual joint', () => {
    expect(evaluateInspection(passing)).toMatchObject({ result:'pass', reasonCodes:[] });
  });
  it('rejects one bad joint instead of averaging total area', () => {
    const result = evaluateInspection({ ...passing, voids:[{jointId:'J1',areaPercent:2,topologyAcceptable:true,locationAcceptable:true},{jointId:'J2',areaPercent:25.1,topologyAcceptable:true,locationAcceptable:true}] });
    expect(result.result).toBe('reject');
    expect(result.reasonCodes).toContain(REASON_CODES.VOID_AREA);
  });
  it('returns deterministic fillet, topology, location, and CSAM reasons', () => {
    const result = evaluateInspection({ ...passing, filletHeightPercent:49, perimeterPercent:99, crack:true, contamination:true, clearanceBreach:true, voids:[{jointId:'J1',areaPercent:10,topologyAcceptable:false,locationAcceptable:false}], csamAcceptable:false });
    expect(result.reasonCodes).toEqual([REASON_CODES.FILLET_HEIGHT,REASON_CODES.FILLET_PERIMETER,REASON_CODES.FILLET_CRACK,REASON_CODES.FILLET_CONTAMINATION,REASON_CODES.FILLET_CLEARANCE,REASON_CODES.VOID_TOPOLOGY,REASON_CODES.VOID_LOCATION,REASON_CODES.CSAM]);
  });
});
