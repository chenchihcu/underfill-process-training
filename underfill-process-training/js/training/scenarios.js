export const SCENARIOS = [
  {
    id: 'spi-low-volume',
    module: 'spi',
    label: 'Low Paste Volume',
    question: 'Identify the defect in the SPI inspection:',
    options: ['Normal volume', 'Low volume (< 70%)', 'Bridging', 'Missing deposit'],
    answer: 1,
    hint: 'Check the paste deposit height — if it\'s below 70% of stencil thickness, it\'s a low volume defect.',
    severity: 'major',
  },
  {
    id: 'spi-bridge',
    module: 'spi',
    label: 'Solder Bridging',
    question: 'What defect is visible between adjacent pads?',
    options: ['Cold solder', 'Solder bridging', 'Tombstoning', 'Solder ball'],
    answer: 1,
    hint: 'Look for paste deposits that connect two adjacent pads.',
    severity: 'critical',
  },
  {
    id: 'spi-shift',
    module: 'spi',
    label: 'Paste Shift',
    question: 'What type of misalignment is shown?',
    options: ['Rotation', 'Translation (X/Y shift)', 'Skew', 'No defect'],
    answer: 1,
    hint: 'The paste deposit center is offset from the pad center.',
    severity: 'major',
  },
  {
    id: 'underfill-void',
    module: 'underfill',
    label: 'Underfill Voids',
    question: 'What type of void is this?',
    options: ['Air trap (corner)', 'Outgassing (die center cluster)', 'Moisture (irregular)', 'No void'],
    answer: 0,
    hint: 'Large spherical voids at the package corners indicate air entrapment.',
    severity: 'major',
  },
  {
    id: 'underfill-incomplete',
    module: 'underfill',
    label: 'Incomplete Fill',
    question: 'What underfill defect is shown?',
    options: ['Complete fill', 'Incomplete fill (flow stopped early)', 'Fillet crack', 'Delamination'],
    answer: 1,
    hint: 'The flow front stopped before reaching the opposite edge of the die.',
    severity: 'critical',
  },
  {
    id: 'underfill-fillet',
    module: 'underfill',
    label: 'Fillet Geometry',
    question: 'Is this fillet geometry acceptable?',
    options: ['Yes — proper concave shape', 'No — insufficient height', 'No — excessive width', 'Cannot determine'],
    answer: 1,
    hint: 'Check the fillet contact angle and height relative to the package edge.',
    severity: 'minor',
  },
  {
    id: 'reflow-tombstone',
    module: 'reflow',
    label: 'Tombstoning',
    question: 'What component defect occurred during reflow?',
    options: ['Normal joint', 'Tombstoning (component standing)', 'Solder balling', 'Cold joint'],
    answer: 1,
    hint: 'One end of the component lifted off the pad due to uneven wetting.',
    severity: 'critical',
  },
  {
    id: 'reflow-cold',
    module: 'reflow',
    label: 'Cold Joint',
    question: 'What type of solder joint defect is this?',
    options: ['Good joint', 'Cold joint (insufficient heat)', 'Head-in-pillow', 'Solder splash'],
    answer: 1,
    hint: 'Look for a dull, grainy surface — the solder did not fully reflow.',
    severity: 'major',
  },
  {
    id: 'reflow-overheat',
    module: 'reflow',
    label: 'Overheated Joint',
    question: 'What does an overheated joint look like?',
    options: ['Shiny, smooth surface', 'Dark, oxidized with intermetallic growth', 'Perfect spherical shape', 'No visible change'],
    answer: 1,
    hint: 'Excessive temperature causes oxidation and excessive IMC formation.',
    severity: 'major',
  },
  {
    id: 'void-airtrap',
    module: 'void',
    label: 'Air Trap Voids',
    question: 'What void type is shown (large, corner-located)?',
    options: ['Outgassing', 'Air trap', 'Moisture-induced', 'Kirkendall'],
    answer: 1,
    hint: 'Large spherical voids concentrated at the package corners.',
    severity: 'major',
  },
  {
    id: 'void-outgassing',
    module: 'void',
    label: 'Outgassing Voids',
    question: 'What void type is concentrated near the die center?',
    options: ['Air trap', 'Outgassing (flux/residual solvent)', 'Moisture popcorning', 'Shrinkage void'],
    answer: 1,
    hint: 'Small clustered voids near the die center — caused by flux/residual outgassing.',
    severity: 'major',
  },
  {
    id: 'warpage-critical',
    module: 'warpage',
    label: 'Critical Warpage',
    question: 'Is this level of warpage acceptable?',
    options: ['Yes — within spec', 'No — exceeds acceptable limit', 'Marginal — needs review', 'Cannot determine'],
    answer: 1,
    hint: 'Check if the warpage exceeds 0.25mm (red zone on the color map).',
    severity: 'critical',
  },
];

export function getScenariosForModule(moduleKey) {
  return SCENARIOS.filter(s => s.module === moduleKey);
}

export function getRandomScenario(moduleKey) {
  const list = getScenariosForModule(moduleKey);
  if (list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

const STORAGE_KEY = 'smt3d_training_score';

export function loadScore() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { correct: 0, total: 0, history: [] };
  } catch { return { correct: 0, total: 0, history: [] }; }
}

export function saveScore(result) {
  const score = loadScore();
  score.total++;
  if (result.correct) score.correct++;
  score.history.push({
    scenarioId: result.scenarioId,
    correct: result.correct,
    timestamp: Date.now(),
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(score));
  return score;
}
