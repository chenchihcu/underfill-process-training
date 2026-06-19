import { describe, expect, it } from 'vitest';
import modules from '../../src/data/simulation-modules.v1.json';
import { createSimulationState, transition } from '../../src/js/simulation-state.js';

describe('simulation timeline state', () => {
  const module = modules.modules[0];

  it('plays, pauses, steps, and resets deterministically', () => {
    let state = createSimulationState(module);
    state = transition(state,{type:'play'},module);
    state = transition(state,{type:'tick',delta:30},module);
    expect(state.status).toBe('running');
    expect(state.progress).toBe(30);
    state = transition(state,{type:'pause'},module);
    state = transition(state,{type:'step'},module);
    expect(state.progress).toBe(55);
    state = transition(state,{type:'reset'},module);
    expect(state).toMatchObject({status:'ready',progress:0,phaseIndex:0});
  });

  it('clamps seek and validates module scenarios and overlays', () => {
    let state = createSimulationState(module);
    state = transition(state,{type:'seek',value:150},module);
    expect(state).toMatchObject({status:'complete',progress:100});
    state = transition(state,{type:'scenario',value:'not-real'},module);
    state = transition(state,{type:'overlay',value:'not-real'},module);
    expect(state.scenario).toBe(module.scenarios[0]);
    expect(state.overlay).toBe(module.overlays[0]);
  });
});
