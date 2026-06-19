import { describe, expect, it } from 'vitest';
import { dictionaries, missingKeys } from '../../src/js/i18n.js';
import { estimateFlow } from '../../src/js/training-estimate.js';

describe('localization and training model gates', () => {
  it('keeps complete bilingual dictionaries', () => { expect(missingKeys()).toEqual([]); expect(Object.keys(dictionaries.en).length).toBeGreaterThan(70); });
  it('never turns a heuristic into PASS or REJECT', () => expect(estimateFlow({temperatureC:85,gapMm:.35,viscosityPaS:8,distanceMm:12})).toMatchObject({kind:'training-estimate',result:null,model:{calibrated:false}}));
});
