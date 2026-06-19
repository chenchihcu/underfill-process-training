import { SPEC, isWithin, requireControlled } from './spec.js';

export const REASON_CODES = Object.freeze({
  FILLET_HEIGHT: 'FILLET_HEIGHT_OUT_OF_RANGE',
  FILLET_PERIMETER: 'FILLET_PERIMETER_INCOMPLETE',
  FILLET_CRACK: 'FILLET_CRACK_PRESENT',
  FILLET_CONTAMINATION: 'FILLET_CONTAMINATION_PRESENT',
  FILLET_CLEARANCE: 'FILLET_CLEARANCE_BREACH',
  VOID_AREA: 'VOID_INDIVIDUAL_JOINT_AREA_EXCEEDED',
  VOID_TOPOLOGY: 'VOID_TOPOLOGY_REJECTED',
  VOID_LOCATION: 'VOID_LOCATION_REJECTED',
  CSAM: 'CSAM_DISPOSITION_REJECTED',
  INVALID: 'INSPECTION_INPUT_INVALID'
});

export function evaluateInspection(input) {
  const reasons = [];
  const fillet = SPEC.inspectionControls.fillet;
  const voidRule = SPEC.inspectionControls.void;
  requireControlled(fillet.heightPercent, 'fillet height');
  requireControlled(fillet.perimeterPercent, 'fillet perimeter');
  requireControlled(voidRule.individualJointAreaPercent, 'void area');
  requireControlled(voidRule.topologyRule, 'void topology');
  requireControlled(voidRule.locationRule, 'void location');
  requireControlled(SPEC.inspectionControls.csam.dispositionRule, 'CSAM disposition');

  if (!isWithin(input.filletHeightPercent, fillet.heightPercent)) reasons.push(REASON_CODES.FILLET_HEIGHT);
  if (!isWithin(input.perimeterPercent, fillet.perimeterPercent)) reasons.push(REASON_CODES.FILLET_PERIMETER);
  if (input.crack) reasons.push(REASON_CODES.FILLET_CRACK);
  if (input.contamination) reasons.push(REASON_CODES.FILLET_CONTAMINATION);
  if (input.clearanceBreach) reasons.push(REASON_CODES.FILLET_CLEARANCE);

  if (!Array.isArray(input.voids) || input.voids.length === 0) {
    reasons.push(REASON_CODES.INVALID);
  } else {
    if (input.voids.some((joint) => !isWithin(joint.areaPercent, voidRule.individualJointAreaPercent))) {
      reasons.push(REASON_CODES.VOID_AREA);
    }
    if (input.voids.some((joint) => joint.topologyAcceptable !== true)) reasons.push(REASON_CODES.VOID_TOPOLOGY);
    if (input.voids.some((joint) => joint.locationAcceptable !== true)) reasons.push(REASON_CODES.VOID_LOCATION);
  }
  if (input.csamAcceptable !== true) reasons.push(REASON_CODES.CSAM);

  return {
    result: reasons.length === 0 ? 'pass' : 'reject',
    reasonCodes: [...new Set(reasons)],
    specVersion: SPEC.metadata.specVersion
  };
}
