const STATES = Object.freeze(['ready','running','paused','inspection','complete']);

export function createSimulationState(module, initial = {}) {
  return {
    moduleId: module.id,
    status: 'ready',
    phaseIndex: 0,
    progress: 0,
    scenario: initial.scenario || module.scenarios[0],
    overlay: initial.overlay || module.overlays[0]
  };
}

export function transition(state, action, module) {
  if (!STATES.includes(state.status)) throw new Error(`Invalid simulation status: ${state.status}`);
  if (action.type === 'play') return {...state,status:state.progress >= 100 ? 'running' : 'running',progress:state.progress >= 100 ? 0 : state.progress,phaseIndex:state.progress >= 100 ? 0 : state.phaseIndex};
  if (action.type === 'pause') return {...state,status:'paused'};
  if (action.type === 'reset') return createSimulationState(module,{scenario:state.scenario,overlay:state.overlay});
  if (action.type === 'scenario') return {...state,scenario:module.scenarios.includes(action.value) ? action.value : module.scenarios[0]};
  if (action.type === 'overlay') return {...state,overlay:module.overlays.includes(action.value) ? action.value : module.overlays[0]};
  if (action.type === 'seek') {
    const progress = Math.max(0,Math.min(100,Number(action.value) || 0));
    const phaseIndex = Math.min(module.phases.length - 1, Math.floor(progress / (100 / module.phases.length)));
    return {...state,progress,phaseIndex,status:progress >= 100 ? 'complete' : state.status === 'running' ? 'running' : 'paused'};
  }
  if (action.type === 'step') return transition(state,{type:'seek',value:state.progress + 100 / module.phases.length},module);
  if (action.type === 'tick') {
    if (state.status !== 'running') return state;
    const progress = Math.min(100,state.progress + Math.max(0,Number(action.delta) || 0));
    const phaseIndex = Math.min(module.phases.length - 1, Math.floor(progress / (100 / module.phases.length)));
    return {...state,progress,phaseIndex,status:progress >= 100 ? 'complete' : 'running'};
  }
  return state;
}
