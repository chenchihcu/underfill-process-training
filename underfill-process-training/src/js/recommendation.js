import { SPEC, requireControlled } from './spec.js';

const REQUIRED_INPUTS = ['packageType', 'pitchMm', 'ballSizeMm', 'standoffMm', 'packageWidthMm', 'packageLengthMm', 'edgeClearanceMm', 'reliabilityClass', 'environment', 'material', 'processProfile'];

export function recommendComponent(input) {
  const missingInputs = REQUIRED_INPUTS.filter((key) => input[key] === '' || input[key] === null || input[key] === undefined);
  const rule = SPEC.componentStrategy[input.packageType];
  if (!rule) {
    return { decision: 'insufficient-evidence', ruleIds: [], missingInputs: [...new Set(['packageType', ...missingInputs])], validation: [], specVersion: SPEC.metadata.specVersion };
  }
  requireControlled(rule, 'component strategy');
  const decision = input.packageType === 'QFN' && input.fullUnderfill ? rule.fullUnderfillDecision : rule.decision;
  const validation = decision === 'mandatory' ? ['confirm-process-window'] : ['document-risk-assessment', 'run-product-validation', 'approve-reliability-plan'];
  return {
    decision: missingInputs.length ? 'insufficient-evidence' : decision,
    proposedDecision: decision,
    ruleIds: [rule.id],
    missingInputs,
    validation,
    source: rule.source,
    reference: rule.reference,
    specVersion: SPEC.metadata.specVersion
  };
}
