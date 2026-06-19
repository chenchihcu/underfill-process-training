import { describe, expect, it } from 'vitest';
import { recommendComponent } from '../../src/js/recommendation.js';

const complete = { packageType:'WLCSP',pitchMm:.4,ballSizeMm:.25,standoffMm:.2,packageWidthMm:8,packageLengthMm:8,edgeClearanceMm:1,reliabilityClass:'Industrial',environment:'Thermal cycling',material:'UF3808',processProfile:'UF-Standard',fullUnderfill:false };
describe('component recommendation', () => {
  it.each([['WLCSP','mandatory'],['FLIP_CHIP','mandatory'],['BGA','recommended-after-validation'],['QFN','conditional']])('%s maps to controlled matrix decision', (packageType,decision) => {
    expect(recommendComponent({ ...complete, packageType })).toMatchObject({ decision, missingInputs:[] });
  });
  it('discourages full-underfill QFN', () => expect(recommendComponent({ ...complete, packageType:'QFN', fullUnderfill:true }).decision).toBe('discouraged'));
  it('blocks the decision when required evidence is missing', () => expect(recommendComponent({ packageType:'BGA' })).toMatchObject({ decision:'insufficient-evidence', proposedDecision:'recommended-after-validation' }));
});
