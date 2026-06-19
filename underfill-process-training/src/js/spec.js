import spec from '../data/process-spec.v1.json';

export const SPEC = Object.freeze(spec);

export function sourceFor(rule) {
  if (!rule?.source || !SPEC.sources[rule.source]) return null;
  return { ...SPEC.sources[rule.source], reference: rule.reference || '', ruleId: rule.id || '' };
}

export function requireControlled(rule, name = 'rule') {
  if (!rule || rule.status !== 'controlled') {
    throw new Error(`${name} is unavailable because it is not controlled.`);
  }
  return rule;
}

export function formatRule(rule) {
  requireControlled(rule);
  const precision = Number.isInteger(rule.precision) ? rule.precision : 0;
  if (Object.hasOwn(rule, 'value')) return `${Number(rule.value).toFixed(precision)} ${rule.unit}`;
  if (rule.min === rule.max) return `${Number(rule.min).toFixed(precision)} ${rule.unit}`;
  return `${Number(rule.min).toFixed(precision)}–${Number(rule.max).toFixed(precision)} ${rule.unit}`;
}

export function isWithin(value, rule) {
  requireControlled(rule);
  const number = Number(value);
  return Number.isFinite(number) && number >= rule.min && number <= rule.max;
}
