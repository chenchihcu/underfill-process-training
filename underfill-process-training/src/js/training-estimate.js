import { SPEC } from './spec.js';

export function estimateFlow({ temperatureC, gapMm, viscosityPaS, distanceMm }) {
  const safeGap = Math.max(Number(gapMm), 0.01);
  const safeViscosity = Math.max(Number(viscosityPaS), 0.01);
  const thermalFactor = Math.max(0.25, 1 + (Number(temperatureC) - 25) * 0.018);
  const seconds = (Number(distanceMm) * safeViscosity) / (safeGap ** 2 * thermalFactor * 18);
  return {
    kind: 'training-estimate',
    valueSeconds: Math.max(0, Number(seconds.toFixed(1))),
    result: null,
    model: SPEC.trainingModels.flowEstimate
  };
}
