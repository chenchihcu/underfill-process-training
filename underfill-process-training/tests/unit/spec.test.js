import { describe, expect, it } from 'vitest';
import { SPEC, formatRule, requireControlled } from '../../src/js/spec.js';

describe('controlled process specification', () => {
  it('contains the approved engineering baseline', () => {
    expect(SPEC.materialControls.storageTemperature).toMatchObject({ min:-25, max:-15, unit:'°C' });
    expect(SPEC.materialControls.potLife.value).toBe(72);
    expect(SPEC.materialControls.thawing['10']).toMatchObject({ min:60, max:60 });
    expect(SPEC.materialControls.thawing['30']).toMatchObject({ min:90, max:90 });
    expect(SPEC.materialControls.thawing['55']).toMatchObject({ min:120, max:180 });
    expect(SPEC.processControls.preheatTarget).toMatchObject({ min:75, max:90 });
    expect(SPEC.processControls.dispensePressure).toMatchObject({ min:.1, max:.35 });
    expect(SPEC.processControls.needleClearance).toMatchObject({ min:.2, max:.5 });
    expect(SPEC.processControls.cureProfiles).toEqual(expect.arrayContaining([expect.objectContaining({temperature:130,minimumMinutes:8}),expect.objectContaining({temperature:150,minimumMinutes:5})]));
  });

  it('fails closed for disputed or training-only rules', () => {
    expect(() => requireControlled({ status:'disputed' }, 'test')).toThrow(/unavailable/);
    expect(() => formatRule({ status:'training-only', min:1, max:2, unit:'x' })).toThrow();
  });
});
