import { describe, expect, it } from 'vitest';
import { MEDIA, SIMULATIONS, TRAINING, authorityLabel, validateExperience } from '../../src/js/experience.js';

describe('experience manifests', () => {
  it('retain the fixed bilingual ten-topic and nine-module contracts', () => {
    expect(TRAINING.topics).toHaveLength(10);
    expect(SIMULATIONS.modules).toHaveLength(9);
    expect(MEDIA.items.length).toBeGreaterThanOrEqual(5);
    for (const topic of TRAINING.topics) {
      expect(topic.title['zh-Hant']).toBeTruthy();
      expect(topic.title.en).toBeTruthy();
      expect(topic.actions.length).toBeGreaterThanOrEqual(2);
      expect(topic.evidence.length).toBeGreaterThanOrEqual(2);
      expect(topic.failureModes.length).toBeGreaterThanOrEqual(2);
    }
    expect(validateExperience()).toEqual({topics:10,modules:9,media:MEDIA.items.length});
  });

  it('keeps non-controlled authority labels explicit', () => {
    expect(authorityLabel('training-only','zh-Hant')).toContain('訓練');
    expect(authorityLabel('experimental','en')).toContain('Experimental');
  });
});
