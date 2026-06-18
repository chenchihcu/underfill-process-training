const STAGES = [
  { key: 'spi', label: 'Solder Paste Print', module: 'spi', duration: 6, color: '#3B82F6' },
  { key: 'reflow', label: 'Reflow Soldering', module: 'reflow', duration: 10, color: '#d97706' },
  { key: 'underfill', label: 'Underfill Dispense', module: 'underfill', duration: 8, color: '#10B981' },
  { key: 'void', label: 'Void Inspection', module: 'void', duration: 5, color: '#EF4444' },
  { key: 'bga', label: 'BGA Cross-Section', module: 'bga', duration: 4, color: '#a78bfa' },
];

let currentStageIdx = -1;
let running = false;
let stageProgress = 0;
let handoffData = {};
let onStageChange = null;
let onComplete = null;

export function getStages() { return STAGES; }
export function getCurrentStage() { return currentStageIdx >= 0 ? STAGES[currentStageIdx] : null; }
export function getCurrentStageIdx() { return currentStageIdx; }
export function getStageProgress() { return stageProgress; }
export function isRunning() { return running; }
export function getHandoffData() { return handoffData; }

export function setCallbacks(callbacks) {
  if (callbacks.onStageChange) onStageChange = callbacks.onStageChange;
  if (callbacks.onComplete) onComplete = callbacks.onComplete;
}

export function start(initialHandoff = {}) {
  handoffData = { ...initialHandoff, lotId: 'LOT-' + Date.now().toString(36).toUpperCase() };
  currentStageIdx = 0;
  stageProgress = 0;
  running = true;
  if (onStageChange) onStageChange(STAGES[0], handoffData);
  return STAGES[0];
}

export function update(dt) {
  if (!running || currentStageIdx < 0 || currentStageIdx >= STAGES.length) return null;

  const stage = STAGES[currentStageIdx];
  stageProgress += dt / stage.duration;
  if (stageProgress >= 1) {
    stageProgress = 1;
    // Collect handoff data
    handoffData[stage.key] = { completed: true, timestamp: Date.now() };
    currentStageIdx++;
    if (currentStageIdx >= STAGES.length) {
      running = false;
      if (onComplete) onComplete(handoffData);
      return null;
    }
    stageProgress = 0;
    const next = STAGES[currentStageIdx];
    if (onStageChange) onStageChange(next, handoffData);
    return next;
  }
  return null;
}

export function stop() {
  running = false;
  currentStageIdx = -1;
  stageProgress = 0;
}

export function reset() {
  stop();
  handoffData = {};
}
