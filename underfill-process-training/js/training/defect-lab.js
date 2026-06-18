import { getRandomScenario, saveScore, loadScore } from './scenarios.js';

let overlay = null;
let currentScenario = null;
let quizActive = false;
let currentModule = null;

export function isActive() { return quizActive; }

export function show(moduleName) {
  currentModule = moduleName;
  const scenario = getRandomScenario(moduleName);
  if (!scenario) return;

  currentScenario = scenario;
  quizActive = true;

  if (!overlay) _buildOverlay();
  overlay.style.display = 'flex';
  _renderQuestion(scenario);
}

export function hide() {
  quizActive = false;
  if (overlay) overlay.style.display = 'none';
  currentScenario = null;
}

export function destroy() {
  hide();
  if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  overlay = null;
}

function _buildOverlay() {
  overlay = document.createElement('div');
  overlay.id = 'defectLabOverlay';
  overlay.style.cssText = `
    display:none;
    position:absolute;inset:0;z-index:200;
    background:rgba(15,23,42,0.4);
    align-items:center;justify-content:center;
    backdrop-filter:blur(4px);
  `;
  overlay.innerHTML = `
    <div id="quizCard" style="
      background:#F1F5F9;border:1px solid #E2E8F0;border-radius:16px;
      padding:24px;max-width:480px;width:90%;
      box-shadow:0 20px 60px rgba(15,23,42,0.1);
    ">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span id="quizModule" style="font-size:11px;color:#3B82F6;text-transform:uppercase;letter-spacing:0.5px;"></span>
        <span id="quizSeverity" style="font-size:10px;padding:2px 8px;border-radius:4px;font-weight:600;"></span>
      </div>
      <div id="quizQuestion" style="font-size:15px;color:#0F172A;font-weight:600;margin-bottom:16px;line-height:1.5;"></div>
      <div id="quizOptions" style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px;"></div>
      <div id="quizResult" style="display:none;padding:12px;border-radius:8px;margin-bottom:12px;font-size:13px;line-height:1.5;"></div>
      <div id="quizHint" style="display:none;padding:10px;background:rgba(96,165,250,0.1);border-radius:8px;font-size:12px;color:#93c5fd;margin-bottom:12px;line-height:1.4;"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button id="quizNextBtn" style="display:none;padding:8px 20px;border:1px solid #CBD5E1;border-radius:8px;background:transparent;color:#64748B;font-size:13px;cursor:pointer;">Next</button>
        <button id="quizCloseBtn" style="padding:8px 20px;border:1px solid #CBD5E1;border-radius:8px;background:rgba(96,165,250,0.15);color:#3B82F6;font-size:13px;cursor:pointer;">Close</button>
      </div>
      <div style="margin-top:12px;display:flex;justify-content:space-between;font-size:11px;color:#CBD5E1;">
        <span id="quizScoreDisplay"></span>
      </div>
    </div>
  `;
  document.getElementById('viewport').appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hide();
  });
  document.getElementById('quizCloseBtn').addEventListener('click', hide);
  document.getElementById('quizNextBtn').addEventListener('click', _nextScenario);
}

function _renderQuestion(scenario) {
  const score = loadScore();
  document.getElementById('quizModule').textContent = `${scenario.module.toUpperCase()} · ${scenario.label}`;
  document.getElementById('quizQuestion').textContent = scenario.question;

  const sevEl = document.getElementById('quizSeverity');
  sevEl.textContent = scenario.severity.toUpperCase();
  sevEl.style.background = scenario.severity === 'critical' ? 'rgba(239,68,68,0.2)' :
    scenario.severity === 'major' ? 'rgba(245,158,11,0.2)' : 'rgba(96,165,250,0.2)';
  sevEl.style.color = scenario.severity === 'critical' ? '#EF4444' :
    scenario.severity === 'major' ? '#d97706' : '#3B82F6';

  const optionsEl = document.getElementById('quizOptions');
  optionsEl.innerHTML = '';
  scenario.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.textContent = String.fromCharCode(65 + i) + '. ' + opt;
    btn.style.cssText = `
      padding:10px 14px;border:1px solid #E2E8F0;border-radius:8px;
      background:rgba(255,255,255,0.9);color:#0F172A;font-size:13px;
      cursor:pointer;text-align:left;transition:all .15s;
    `;
    btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(59,130,246,0.12)'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(255,255,255,0.9)'; });
    btn.addEventListener('click', () => _submitAnswer(i, scenario, optionsEl.querySelectorAll('button')));
    optionsEl.appendChild(btn);
  });

  document.getElementById('quizResult').style.display = 'none';
  document.getElementById('quizHint').style.display = 'none';
  document.getElementById('quizNextBtn').style.display = 'none';
  document.getElementById('quizScoreDisplay').textContent =
    `Score: ${score.correct}/${score.total} (${score.total > 0 ? Math.round(score.correct/score.total*100) : 0}%)`;
}

function _submitAnswer(selected, scenario, buttons) {
  buttons.forEach((b, i) => {
    b.style.cursor = 'default';
    b.replaceWith(b.cloneNode(true));
  });

  const correct = selected === scenario.answer;
  const result = saveScore({ correct, scenarioId: scenario.id });

  const resultEl = document.getElementById('quizResult');
  resultEl.style.display = 'block';
  if (correct) {
    resultEl.style.background = 'rgba(34,197,94,0.15)';
    resultEl.style.border = '1px solid rgba(34,197,94,0.3)';
    resultEl.style.color = '#10B981';
    resultEl.innerHTML = '✓ Correct! ' + scenario.options[scenario.answer];
  } else {
    resultEl.style.background = 'rgba(239,68,68,0.15)';
    resultEl.style.border = '1px solid rgba(239,68,68,0.3)';
    resultEl.style.color = '#EF4444';
    resultEl.innerHTML = `✗ Incorrect. The answer was: ${scenario.options[scenario.answer]}`;
  }

  const hintEl = document.getElementById('quizHint');
  hintEl.style.display = 'block';
  hintEl.textContent = '💡 ' + scenario.hint;

  document.getElementById('quizScoreDisplay').textContent =
    `Score: ${result.correct}/${result.total} (${Math.round(result.correct/result.total*100)}%)`;

  document.getElementById('quizNextBtn').style.display = 'inline-block';
}

function _nextScenario() {
  if (currentModule) show(currentModule);
}
