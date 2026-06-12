import * as SCENE from './scene.js';
import { createControlPanel, setStatus } from './ui.js';
import * as Analytics from './data/analytics.js';
import * as FlowController from './data/flow-controller.js';
import * as DefectLab from './training/defect-lab.js';
import { UnderfillModule } from './modules/underfill.js';
import { SPIModule } from './modules/spi.js';
import { FPCAModule } from './modules/fpca.js';
import { ReflowModule } from './modules/reflow.js';
import { BGAModule } from './modules/bga.js';
import { FlowLabModule } from './modules/flow-lab.js';
import { PatternLabModule } from './modules/pattern-lab.js';
import { VoidModule } from './modules/void.js';
import { WarpageModule } from './modules/warpage.js';

const modules = {
  underfill: UnderfillModule,
  spi: SPIModule,
  fpca: FPCAModule,
  reflow: ReflowModule,
  bga: BGAModule,
  'flow-lab': FlowLabModule,
  'pattern-lab': PatternLabModule,
  void: VoidModule,
  warpage: WarpageModule,
};

let currentModule = null;
let lastTime = 0;
let analyticsWidget = null;
let analyticsShown = false;
let flowRunning = false;
let _kpiTimer = null;

function init() {
  try {
    const splash = document.getElementById('splash');
    const viewport = document.getElementById('viewport');

    if (!viewport) {
      showError('Viewport element not found', 'The page structure may be corrupted.');
      return;
    }

    SCENE.initScene(viewport);
    document.getElementById('moduleSelect')?.addEventListener('change', (e) => {
      switchModule(e.target.value);
    });

    switchModule('underfill');
    animate(performance.now());

    // Analytics dashboard
    const toggle = document.getElementById('analyticsToggle');
    const dashboard = document.getElementById('analyticsDashboard');
    const exportBtn = document.getElementById('exportCSVBtn');
    if (toggle && dashboard) {
      toggle.addEventListener('click', () => {
        analyticsShown = !analyticsShown;
        dashboard.style.display = analyticsShown ? 'block' : 'none';
        if (analyticsShown) {
          Analytics.enabled = true;
          _rebuildAnalytics();
        } else {
          Analytics.enabled = false;
          if (analyticsWidget) Analytics.destroyChartWidget(analyticsWidget);
        }
      });
    }
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const name = document.getElementById('moduleSelect').value;
        const names = {
          underfill: 'Underfill', spi: 'SPI', fpca: 'FPCA', reflow: 'Reflow',
          bga: 'BGA', 'flow-lab': 'FlowLab', 'pattern-lab': 'PatternLab',
          void: 'Void', warpage: 'Warpage',
        };
        Analytics.exportCSV(names[name] || name);
      });
    }

    // Flow chain
    const flowBtn = document.getElementById('flowBtn');
    const flowTimeline = document.getElementById('flowTimeline');
    if (flowBtn) {
      flowBtn.addEventListener('click', () => {
        flowRunning = !flowRunning;
        if (flowRunning) {
          flowBtn.textContent = '⏹ Stop';
          flowBtn.style.borderColor = '#ef4444';
          flowBtn.style.color = '#ef4444';
          flowTimeline.style.display = 'block';
          _buildFlowTimeline();
          const first = FlowController.start();
          FlowController.setCallbacks({
            onStageChange: (stage, data) => {
              switchModule(stage.module);
              _updateFlowTimeline(stage.key);
              setStatus(`Flow: ${stage.label}`, `Lot: ${data.lotId}`);
            },
            onComplete: (data) => {
              flowRunning = false;
              flowBtn.textContent = '▶ Flow';
              flowBtn.style.borderColor = '#475569';
              flowBtn.style.color = '#22c55e';
              setStatus('Flow Complete', `Lot ${data.lotId} finished. ${Object.keys(data).length - 1} stages OK`);
              _updateFlowTimeline(null, true);
            },
          });
          switchModule(first.module);
          _updateFlowTimeline(first.key);
          setStatus('Flow Started', `Lot: ${FlowController.getHandoffData().lotId}`);
        } else {
          FlowController.stop();
          flowBtn.textContent = '▶ Flow';
          flowBtn.style.borderColor = '#475569';
          flowBtn.style.color = '#22c55e';
          flowTimeline.style.display = 'none';
          setStatus('Flow Stopped', '');
        }
      });
    }

    // Quiz / Defect Lab
    const quizBtn = document.getElementById('quizBtn');
    if (quizBtn) {
      quizBtn.addEventListener('click', () => {
        const name = document.getElementById('moduleSelect').value;
        if (DefectLab.isActive()) {
          DefectLab.hide();
          quizBtn.textContent = '✎ Quiz';
          quizBtn.style.borderColor = '#475569';
        } else {
          DefectLab.show(name);
          quizBtn.textContent = '✕ Close';
          quizBtn.style.borderColor = '#ef4444';
        }
      });
    }

    if (splash) setTimeout(() => splash.classList.add('hidden'), 300);
    setStatus('Ready', 'Select a module to begin');
  } catch (e) {
    showError('Initialization failed: ' + e.message, 'Check the browser console (F12) for more details.');
    console.error(e);
  }
}

function showError(msg, detail) {
  if (window.showSplashError) {
    window.showSplashError(msg, detail);
  } else {
    document.body.innerHTML = '<div style="padding:40px;color:#ef4444;font-size:18px;">' + msg + '</div>';
  }
}

function switchModule(name) {
  try {
    if (currentModule) {
      currentModule.destroy();
      currentModule = null;
    }
    SCENE.clearScene();
    const controls = SCENE.getControls();
    if (controls) {
      controls.target.set(0, 2, 0);
      controls.update();
    }

    Analytics.clearModule(name);
    if (analyticsWidget) Analytics.destroyChartWidget(analyticsWidget);
    analyticsWidget = null;

    const ModuleClass = modules[name];
    if (!ModuleClass) return;

    currentModule = new ModuleClass();
    currentModule.create();

    const names = {
      underfill: 'Underfill Dispensing',
      spi: 'SPI - Solder Paste Inspection',
      fpca: 'FPC Assembly',
      reflow: 'Reflow Soldering',
      bga: 'BGA Cross-Section',
      'flow-lab': 'Capillary Flow',
      'pattern-lab': 'Dispensing Pattern Lab',
      void: 'Void Simulation',
      warpage: 'Warpage Analysis',
    };
    setStatus(names[name] || name, 'Ready');
    if (analyticsShown) _rebuildAnalytics();
  } catch (e) {
    showError('Module load failed: ' + e.message, 'Error in ' + name);
    console.error(e);
  }
}

function _buildFlowTimeline() {
  const container = document.getElementById('flowStages');
  if (!container) return;
  container.innerHTML = '';
  FlowController.getStages().forEach((stage, i) => {
    const el = document.createElement('div');
    el.id = 'flow-stage-' + stage.key;
    el.style.cssText = 'flex:1;padding:3px 4px;border-radius:4px;font-size:10px;text-align:center;background:rgba(71,85,105,0.3);color:#64748b;transition:all .3s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    el.textContent = stage.label;
    container.appendChild(el);
  });
}

function _updateFlowTimeline(activeKey, allDone = false) {
  FlowController.getStages().forEach((stage, i) => {
    const el = document.getElementById('flow-stage-' + stage.key);
    if (!el) return;
    if (allDone) {
      el.style.background = 'rgba(34,197,94,0.2)';
      el.style.color = '#22c55e';
    } else if (stage.key === activeKey) {
      el.style.background = stage.color + '33';
      el.style.color = stage.color;
      el.style.borderLeft = '2px solid ' + stage.color;
    } else if (FlowController.getHandoffData()[stage.key]) {
      el.style.background = 'rgba(34,197,94,0.15)';
      el.style.color = '#22c55e';
    } else {
      el.style.background = 'rgba(71,85,105,0.3)';
      el.style.color = '#64748b';
    }
  });
}

function _rebuildAnalytics() {
  if (analyticsWidget) Analytics.destroyChartWidget(analyticsWidget);
  analyticsWidget = null;
  const container = document.getElementById('chartContainer');
  const kpiContainer = document.getElementById('kpiContainer');
  if (!container) return;
  Analytics.enabled = true;

  const name = document.getElementById('moduleSelect').value;
  const label = document.getElementById('moduleSelect').selectedOptions[0]?.textContent || name;

  // Determine chart keys per module
  const chartKeys = {
    underfill: ['temp', 'pressure', 'progress'],
    spi: ['pressure', 'volume'],
    fpca: ['stress', 'temp'],
    reflow: ['temp'],
    void: ['count'],
    warpage: ['temp', 'warpage'],
    bga: [],
    'flow-lab': ['fill'],
    'pattern-lab': [],
  };
  const keys = chartKeys[name] || [];
  if (keys.length > 0) {
    analyticsWidget = Analytics.createChartWidget(container, label, keys, label);
  }

  // Update KPIs periodically
  if (kpiContainer) {
    if (_kpiTimer) clearTimeout(_kpiTimer);
    const updateKPIs = () => {
      if (!analyticsShown) { _kpiTimer = null; return; }
      kpiContainer.innerHTML = '';
      for (const k of keys) {
        const s = Analytics.getStats(label, k);
        if (!s) continue;
        const card = document.createElement('div');
        card.style.cssText = 'background:rgba(31,41,55,0.8);border-radius:6px;padding:6px 8px;';
        const color = { temp: '#f59e0b', pressure: '#60a5fa', progress: '#22c55e', volume: '#a78bfa', stress: '#ef4444', count: '#f59e0b', fill: '#22c55e', warpage: '#ef4444' }[k] || '#94a3b8';
        card.innerHTML = `
          <div style="font-size:10px;color:#64748b;text-transform:uppercase;">${k}</div>
          <div style="font-size:16px;font-weight:700;color:${color};">${s.latest.toFixed(1)}</div>
          <div style="font-size:9px;color:#475569;">min ${s.min.toFixed(1)} · max ${s.max.toFixed(1)}</div>
        `;
        kpiContainer.appendChild(card);
      }
      setTimeout(updateKPIs, 500);
    };
    _kpiTimer = setTimeout(updateKPIs, 500);
  }
}

function animate(time) {
  requestAnimationFrame(animate);
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;

  try {
    const hasWork = (currentModule && currentModule.update) || flowRunning;
    if (!hasWork) {
      SCENE.render();
      return;
    }

    if (currentModule && currentModule.update) {
      currentModule.update(dt, time);
    }

    // Flow chain auto-advance
    if (flowRunning) {
      const next = FlowController.update(dt);
      if (next) {
        // Auto-play the new module
        if (currentModule) currentModule.playing = true;
      }
    }

    SCENE.render();
  } catch (e) {
    console.warn('Render error:', e);
  }

  if (Math.floor(time / 500) !== Math.floor((time - dt * 1000) / 500)) {
    const fps = Math.round(1 / Math.max(dt, 0.001));
    const el = document.getElementById('fpsDisplay');
    if (el) el.textContent = fps + ' FPS';
  }
}

document.addEventListener('DOMContentLoaded', init);
