(function() {
    'use strict';

    // ======================================================================
    // CONFIG
    // ======================================================================
    const CONFIG = {
        LS_KEY: 'underfill_dashboard',
        FILLET_PASS_MIN: 50,
        FILLET_PASS_MAX: 75,
        VOID_THRESHOLD: 25,
        HISTORY_MAX: 60,
        COMPONENTS: {
            bga:   { dieSize: '> 25mm', ballPitch: '0.8mm', action: 'Mandatory', actionClass: 'status-mandatory', preheat: 85, speed: 15 },
            wlcsp: { dieSize: '5-12mm', ballPitch: '0.4mm', action: 'Recommended', actionClass: 'status-recommended', preheat: 80, speed: 20 },
            flipchip: { dieSize: '15-20mm', ballPitch: '0.5mm', action: 'Core', actionClass: 'status-core', preheat: 90, speed: 12 },
            qfn:   { dieSize: '3-8mm', ballPitch: '0.6mm', action: 'Recommended', actionClass: 'status-recommended', preheat: 85, speed: 18 }
        },
        TROUBLESHOOTING: [
            { keywords: ['incomplete', 'penetration', 'capillary'], symptom: 'Incomplete penetration under die', action: 'Increase preheat to 85°C. Verify UF 3808 pot life < 24h.' },
            { keywords: ['voiding', 'bubble', 'void'], symptom: 'Excessive voiding (> 25%)', action: 'Bake substrate 100°C/1.5h. Set needle height to 0.1mm.' },
            { keywords: ['fillet low', 'starved'], symptom: 'Fillet height < 50% (starved)', action: 'Increase pressure to 0.3 MPa or reduce line speed to 15 mm/s.' },
            { keywords: ['fillet high', 'overflow', 'excessive'], symptom: 'Fillet height > 75% (overflow)', action: 'Decrease pressure or increase line speed. Verify needle height at 0.1mm.' },
            { keywords: ['clogging', 'nozzle', 'clog'], symptom: 'Needle clogging', action: 'Clean nozzle with solvent. Verify needle offset. Keep nozzle < 40°C.' },
            { keywords: ['tailing', 'stringing', 'viscosity'], symptom: 'Stringing on exit', action: 'Defrost UF 3808 at room temp for 2h min. Do not heat syringe directly.' },
            { keywords: ['delamination', 'peeling', 'adhesion'], symptom: 'Delamination after thermal cycling', action: 'Implement plasma cleaning. Cure at 130°C/8min or 150°C/5min.' }
        ],
        QUIZ: [
            { q: 'What is the recommended cure temperature and time for Loctite UF 3808?', options: ['130°C / 8 min', '150°C / 10 min', '120°C / 12 min', '100°C / 15 min'], answer: 0 },
            { q: 'What is the acceptable fillet height range per industry standard?', options: ['25-50% of component height', '50-75% of component height', '75-100% of component height', '30-60% of component height'], answer: 1 },
            { q: 'Which dispense pattern is recommended for most underfill applications?', options: ['I-Shape', 'U-Shape', 'L-Shape', 'S-Shape'], answer: 2 },
            { q: 'What is the maximum acceptable voiding percentage per IPC-A-610?', options: ['10%', '15%', '25%', '50%'], answer: 2 },
            { q: 'What is the optimal needle height for UF 3808 dispensing?', options: ['0.05 mm', '0.10 mm', '0.25 mm', '0.50 mm'], answer: 1 }
        ],
        I18N: {
            en: {
                standby: 'STANDBY', running: 'RUNNING', completed: 'COMPLETED',
                pass: 'PASS', reject: 'REJECT',
                start: 'Start', reset: 'Reset', save: 'Save', load: 'Load', set: 'Set', clear: 'clear',
                noEntries: 'No entries yet.', noProfiles: '-- Saved Profiles --',
                searchPlaceholder: 'Search (e.g. voiding, clog, incomplete)...',
                emptySearch: 'Type a symptom to search.',
                noResults: 'No results found.',
                batchSet: 'Batch: ',
                statusOnline: 'Online',
                flowRate: 'Flow Rate', capillaryPressure: 'Capillary Pressure',
                predictedFillet: 'Predicted Fillet', predictedVoid: 'Predicted Voiding',
                question: 'Question', of: 'of', score: 'Score',
                restart: 'Restart Quiz', next: 'Next',
                kbPlaceholder: 'Search knowledge base...'
            },
            zh: {
                standby: '待機', running: '執行中', completed: '已完成',
                pass: '合格', reject: '不合格',
                start: '啟動', reset: '重置', save: '儲存', load: '載入', set: '設定', clear: '清除',
                noEntries: '尚無記錄。', noProfiles: '-- 已儲存設定 --',
                searchPlaceholder: '搜尋（例：voiding, clog, incomplete）...',
                emptySearch: '輸入症狀進行搜尋。',
                noResults: '無相符結果。',
                batchSet: '批次：',
                statusOnline: '在線',
                flowRate: '流速', capillaryPressure: '毛細壓力',
                predictedFillet: '預測 fillet', predictedVoid: '預測 voiding',
                question: '題目', of: '/', score: '分數',
                restart: '重新測驗', next: '下一題',
                kbPlaceholder: '搜尋知識庫...'
            }
        }
    };

    // ======================================================================
    // STATE (persisted via LocalStorage)
    // ======================================================================
    function defaultState() {
        return {
            checklist: [false, false, false, false],
            profiles: [],
            defectPass: 0,
            defectReject: 0,
            history: [],
            batchId: ''
        };
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(CONFIG.LS_KEY);
            if (raw) {
                const saved = JSON.parse(raw);
                return { ...defaultState(), ...saved };
            }
        } catch (_) { /* ignore corrupt data */ }
        return defaultState();
    }

    function saveState() {
        try {
            localStorage.setItem(CONFIG.LS_KEY, JSON.stringify(state));
        } catch (_) { /* storage full or unavailable */ }
    }

    let state = loadState();

    // ======================================================================
    // DOM REFS
    // ======================================================================
    const $ = (id) => document.getElementById(id);
    const $$ = (sel) => document.querySelectorAll(sel);

    const dom = {};
    function cacheDom() {
        dom.clock = $('system-clock');
        dom.componentSelect = $('component-type');
        dom.specDieSize = $('spec-die-size');
        dom.specBallPitch = $('spec-ball-pitch');
        dom.specAction = $('spec-action');
        dom.preheatSlider = $('preheat-temp');
        dom.valPreheat = $('val-preheat');
        dom.speedSlider = $('line-speed');
        dom.valSpeed = $('val-speed');
        dom.needleSlider = $('needle-height');
        dom.valNeedle = $('val-needle');
        dom.pressureSlider = $('dispense-pressure');
        dom.valPressure = $('val-pressure');
        dom.canvas = $('dispense-canvas');
        dom.ctx = dom.canvas ? dom.canvas.getContext('2d') : null;
        dom.simStatus = $('sim-status');
        dom.btnPlay = $('btn-play-sim');
        dom.btnReset = $('btn-reset-sim');
        dom.pathBtns = $$('.path-tabs .tab-btn');
        dom.filletSlider = $('fillet-height');
        dom.valFillet = $('val-fillet');
        dom.filletBadge = $('fillet-badge');
        dom.dynamicFillet = $('dynamic-fillet-slope');
        dom.voidingSlider = $('voiding-ratio');
        dom.valVoiding = $('val-voiding');
        dom.xrayBadge = $('xray-badge');
        dom.bubbleContainer = $('bubble-container');
        dom.chkItems = $$('.chk-item');
        dom.progressBar = $('header-progress-bar');
        dom.progressText = $('header-progress-text');
        dom.searchInput = $('ts-search-input');
        dom.btnSearch = $('btn-ts-search');
        dom.resultsContainer = $('ts-results');
        dom.profileName = $('profile-name');
        dom.btnSaveProfile = $('btn-save-profile');
        dom.btnLoadProfile = $('btn-load-profile');
        dom.profileList = $('profile-list');
        dom.batchId = $('batch-id');
        dom.btnSetBatch = $('btn-set-batch');
        dom.batchDisplay = $('batch-display');
        dom.historyCanvas = $('history-chart');
        dom.historyCtx = dom.historyCanvas ? dom.historyCanvas.getContext('2d') : null;
        dom.langToggle = $('lang-toggle');
        dom.defectPass = $('defect-pass-count');
        dom.defectReject = $('defect-reject-count');
        dom.logContainer = $('log-container');
        dom.btnClearLog = $('btn-clear-log');
        dom.btnClearHistory = $('btn-clear-history');
        dom.cureCards = $$('.cure-card');
        // New DOM refs
        dom.sidebar = $('sidebar');
        dom.sidebarToggle = $('sidebar-toggle');
        dom.navItems = $$('.nav-item');
        dom.capCanvas = $('capillary-canvas');
        dom.capCtx = dom.capCanvas ? dom.capCanvas.getContext('2d') : null;
        dom.capGap = $('cap-gap');
        dom.capVisc = $('cap-visc');
        dom.valGap = $('val-gap');
        dom.valVisc = $('val-visc');
        dom.capFlowRate = $('cap-flow-rate');
        dom.capPressureVal = $('cap-pressure-val');
        dom.propCards = $$('.prop-card');
        dom.flowStages = $$('.flow-stage');
        dom.slPreheat = $('sl-preheat');
        dom.slSpeed = $('sl-speed');
        dom.slPressure = $('sl-pressure');
        dom.slNeedle = $('sl-needle');
        dom.simlabPreheat = $('simlab-preheat');
        dom.simlabSpeed = $('simlab-speed');
        dom.simlabPressure = $('simlab-pressure');
        dom.simlabNeedle = $('simlab-needle');
        dom.predFillet = $('pred-fillet');
        dom.predVoid = $('pred-void');
        dom.heatmapCanvas = $('heatmap-canvas');
        dom.heatmapCtx = dom.heatmapCanvas ? dom.heatmapCanvas.getContext('2d') : null;
        dom.sensitivityCanvas = $('sensitivity-canvas');
        dom.sensitivityCtx = dom.sensitivityCanvas ? dom.sensitivityCanvas.getContext('2d') : null;
        dom.defectCards = $$('.defect-card');
        dom.quizQuestion = $('quiz-question');
        dom.quizOptions = $('quiz-options');
        dom.quizFeedback = $('quiz-feedback');
        dom.quizNext = $('quiz-next');
        dom.quizCurrent = $('quiz-current');
        dom.quizTotal = $('quiz-total');
        dom.quizCard = $('quiz-card');
        dom.quizScorecard = $('quiz-scorecard');
        dom.scorePct = $('score-pct');
        dom.scoreDetail = $('score-detail');
        dom.quizRestart = $('quiz-restart');
        dom.kbSearch = $('kb-search');
        dom.kbCards = $$('.kb-card');
    }

    // ======================================================================
    // I18N
    // ======================================================================
    let lang = 'en';

    function t(key) {
        return CONFIG.I18N[lang]?.[key] ?? CONFIG.I18N.en[key] ?? key;
    }

    function applyI18n() {
        if (!dom.simStatus) return;
        const statusMap = { standby: t('standby'), running: t('running'), completed: t('completed') };
        const current = dom.simStatus.dataset.state || 'standby';
        dom.simStatus.textContent = statusMap[current] || t('standby');
        dom.langToggle.textContent = lang === 'en' ? 'ZH' : 'EN';
        dom.langToggle.title = lang === 'en' ? '切換至中文' : 'Switch to English';
        if (dom.filletBadge) {
            const isPass = dom.filletBadge.classList.contains('status-pass');
            dom.filletBadge.textContent = isPass ? t('pass') : t('reject');
        }
        if (dom.xrayBadge) {
            const isPass = dom.xrayBadge.classList.contains('status-pass');
            dom.xrayBadge.textContent = isPass ? t('pass') : t('reject');
        }
        if (dom.searchInput) dom.searchInput.placeholder = t('searchPlaceholder');
        if (dom.btnPlay) dom.btnPlay.innerHTML = `<span class="material-icons-round">play_arrow</span> ${t('start')}`;
        if (dom.btnReset) dom.btnReset.innerHTML = `<span class="material-icons-round">replay</span> ${t('reset')}`;
        if (dom.btnSaveProfile) dom.btnSaveProfile.textContent = t('save');
        if (dom.btnLoadProfile) dom.btnLoadProfile.textContent = t('load');
        if (dom.btnSetBatch) dom.btnSetBatch.textContent = t('set');
        if (dom.kbSearch) dom.kbSearch.placeholder = t('kbPlaceholder');
        if (dom.quizNext) dom.quizNext.textContent = t('next');
        if (dom.quizRestart) dom.quizRestart.textContent = t('restart');
        renderLog();
    }

    // ======================================================================
    // 1. SYSTEM CLOCK
    // ======================================================================
    function updateClock() {
        if (!dom.clock) return;
        const now = new Date();
        dom.clock.textContent = now.toLocaleTimeString('en-GB');
    }

    // ======================================================================
    // 2. COMPONENT MATRIX
    // ======================================================================
    function updateComponentSpecs(type) {
        const cfg = CONFIG.COMPONENTS[type];
        if (!cfg) return;
        dom.specDieSize.textContent = cfg.dieSize;
        dom.specBallPitch.textContent = cfg.ballPitch;
        dom.specAction.textContent = cfg.action;
        dom.specAction.className = 'spec-val action-tag ' + cfg.actionClass;
        dom.preheatSlider.value = cfg.preheat;
        dom.valPreheat.textContent = cfg.preheat;
        dom.speedSlider.value = cfg.speed;
        dom.valSpeed.textContent = cfg.speed;
        recordHistoryPoint();
    }

    // ======================================================================
    // 3. CURE CARD
    // ======================================================================
    function initCureCards() {
        dom.cureCards.forEach(card => {
            card.addEventListener('click', function() {
                dom.cureCards.forEach(c => c.classList.remove('active'));
                this.classList.add('active');
                log(`${this.dataset.temp}°C / ${this.dataset.time}min cure selected`);
            });
        });
    }

    // ======================================================================
    // 4. CANVAS SIMULATOR (requestAnimationFrame)
    // ======================================================================
    const SIM = {
        pathType: 'L',
        progress: 0,
        running: false,
        rafId: null,
        startTime: 0,
        dieX: 125, dieY: 75, dieSize: 200,
        ballCols: 8, ballRows: 8
    };

    function getPathCoords(type) {
        const o = 8, dx = SIM.dieX, dy = SIM.dieY, ds = SIM.dieSize;
        switch (type) {
            case 'L': return [
                { x: dx + ds + o, y: dy - o },
                { x: dx - o, y: dy - o },
                { x: dx - o, y: dy + ds + o }
            ];
            case 'I': return [
                { x: dx - o, y: dy - o },
                { x: dx - o, y: dy + ds + o }
            ];
            case 'U': return [
                { x: dx + ds + o, y: dy - o },
                { x: dx + ds + o, y: dy + ds + o },
                { x: dx - o, y: dy + ds + o },
                { x: dx - o, y: dy - o }
            ];
            default: return [];
        }
    }

    function posOnPath(coords, t) {
        if (coords.length < 2) return coords[0] || { x: 0, y: 0 };
        if (t <= 0) return coords[0];
        if (t >= 1) return coords[coords.length - 1];
        const segs = coords.length - 1;
        const segRange = 1 / segs;
        const idx = Math.min(Math.floor(t / segRange), segs - 1);
        const localT = (t - idx * segRange) / segRange;
        return {
            x: coords[idx].x + (coords[idx + 1].x - coords[idx].x) * localT,
            y: coords[idx].y + (coords[idx + 1].y - coords[idx].y) * localT
        };
    }

    function drawStaticDie() {
        const ctx = dom.ctx, c = dom.canvas;
        if (!ctx || !c) return;
        ctx.clearRect(0, 0, c.width, c.height);
        const dx = SIM.dieX, dy = SIM.dieY, ds = SIM.dieSize;

        // Grid
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let x = 0; x < c.width; x += 20) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, c.height); ctx.stroke();
        }
        for (let y = 0; y < c.height; y += 20) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(c.width, y); ctx.stroke();
        }

        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.font = '10px Inter';
        ctx.fillText('SUBSTRATE (FR4)', 15, 25);

        // Margin guide
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.strokeRect(dx - 20, dy - 20, ds + 40, ds + 40);

        // Balls
        const sp = ds / (SIM.ballCols + 1);
        ctx.fillStyle = '#44445A';
        for (let i = 1; i <= SIM.ballCols; i++) {
            for (let j = 1; j <= SIM.ballRows; j++) {
                ctx.beginPath();
                ctx.arc(dx + i * sp, dy + j * sp, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Die
        ctx.fillStyle = 'rgba(45,45,59,0.55)';
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 2;
        ctx.fillRect(dx, dy, ds, ds);
        ctx.strokeRect(dx, dy, ds, ds);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '12px Outfit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SILICON DIE', dx + ds / 2, dy + ds / 2);
    }

    function drawFlow(type, t) {
        const ctx = dom.ctx;
        if (!ctx) return;
        const dx = SIM.dieX, dy = SIM.dieY, ds = SIM.dieSize;
        ctx.fillStyle = 'rgba(0,242,254,0.25)';
        ctx.strokeStyle = 'rgba(0,242,254,0.4)';
        ctx.lineWidth = 1;

        if (type === 'L') {
            const fo = t * 130;
            ctx.beginPath();
            ctx.moveTo(dx, dy);
            ctx.lineTo(dx + ds, dy);
            ctx.lineTo(dx + ds, dy + fo * 0.4);
            ctx.quadraticCurveTo(dx + fo, dy + fo, dx + fo * 0.4, dy + ds);
            ctx.lineTo(dx, dy + ds);
            ctx.closePath(); ctx.fill(); ctx.stroke();
        } else if (type === 'I') {
            const fo = t * 160;
            ctx.beginPath();
            ctx.moveTo(dx, dy);
            ctx.lineTo(dx + fo, dy);
            ctx.lineTo(dx + fo, dy + ds);
            ctx.lineTo(dx, dy + ds);
            ctx.closePath(); ctx.fill(); ctx.stroke();
        } else if (type === 'U') {
            const fo = t * 110;
            ctx.beginPath();
            ctx.moveTo(dx, dy);
            ctx.lineTo(dx + ds, dy);
            ctx.lineTo(dx + ds, dy + ds);
            ctx.lineTo(dx, dy + ds);
            ctx.lineTo(dx + fo, dy + ds - fo);
            ctx.lineTo(dx + ds - fo, dy + ds - fo);
            ctx.lineTo(dx + ds - fo, dy + fo);
            ctx.lineTo(dx + fo, dy + fo);
            ctx.closePath(); ctx.fill(); ctx.stroke();
        }
    }

    function drawDispenseBead(coords, t) {
        const ctx = dom.ctx;
        if (!ctx) return;
        ctx.strokeStyle = 'rgba(0,242,254,0.8)';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(coords[0].x, coords[0].y);

        const segs = coords.length - 1;
        const segRange = 1 / segs;
        const curIdx = Math.min(Math.floor(t / segRange), segs - 1);
        for (let i = 1; i <= curIdx; i++) {
            if (coords[i]) ctx.lineTo(coords[i].x, coords[i].y);
        }
        const pos = posOnPath(coords, t);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();

        // Needle glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00F2FE';
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#08080C';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    function simFrame(timestamp) {
        if (!SIM.running) return;
        const elapsed = timestamp - SIM.startTime;
        const speed = parseInt(dom.speedSlider?.value || 15);
        const duration = 3000 + (30 - speed) * 100;
        const progress = Math.min(elapsed / duration, 1);
        SIM.progress = progress;

        const coords = getPathCoords(SIM.pathType);
        drawStaticDie();
        drawFlow(SIM.pathType, progress);
        drawDispenseBead(coords, progress);

        if (progress < 1) {
            SIM.rafId = requestAnimationFrame(simFrame);
        } else {
            SIM.running = false;
            setSimStatus('completed');
            dom.btnPlay.disabled = false;
            log('Dispense completed');
        }
    }

    function setSimStatus(state) {
        if (!dom.simStatus) return;
        dom.simStatus.textContent = t(state);
        dom.simStatus.className = 'status-text' + (state !== 'standby' ? ' ' + state : '');
        dom.simStatus.dataset.state = state;
    }

    function runSimulation() {
        if (SIM.running || !dom.ctx) return;
        SIM.running = true;
        SIM.startTime = performance.now();
        dom.btnPlay.disabled = true;
        setSimStatus('running');
        log('Dispense started (' + SIM.pathType + '-shape)');
        SIM.rafId = requestAnimationFrame(simFrame);
    }

    function resetSimulation() {
        if (SIM.rafId) cancelAnimationFrame(SIM.rafId);
        SIM.running = false;
        SIM.progress = 0;
        dom.btnPlay.disabled = false;
        setSimStatus('standby');
        drawStaticDie();
    }

    function initSimulator() {
        if (!dom.ctx || !dom.canvas) return;
        dom.canvas.width = 450;
        dom.canvas.height = 350;
        dom.pathBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                if (SIM.running) return;
                dom.pathBtns.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                SIM.pathType = this.dataset.path;
                resetSimulation();
            });
        });
        dom.btnPlay.addEventListener('click', runSimulation);
        dom.btnReset.addEventListener('click', resetSimulation);
        resetSimulation();
    }

    // ======================================================================
    // 5. FILLET INSPECTOR + DEFECT COUNTER
    // ======================================================================
    function updateFillet(value) {
        dom.valFillet.textContent = value;
        const pass = value >= CONFIG.FILLET_PASS_MIN && value <= CONFIG.FILLET_PASS_MAX;
        dom.filletBadge.textContent = pass ? t('pass') : t('reject');
        dom.filletBadge.className = 'quality-badge status-' + (pass ? 'pass' : 'reject');
        dom.dynamicFillet.className = 'fillet-slope dynamic ' + (pass ? 'pass' : 'failed');
        const scale = Math.max(0.1, value / 65);
        dom.dynamicFillet.style.transform = 'scale(' + scale + ')';
        if (pass) { state.defectPass++; } else { state.defectReject++; }
        updateDefectDisplay();
        saveState();
    }

    function updateDefectDisplay() {
        dom.defectPass.textContent = state.defectPass;
        dom.defectReject.textContent = state.defectReject;
    }

    // ======================================================================
    // 6. X-RAY VOIDING ANALYZER
    // ======================================================================
    const BUBBLES = [
        { top: '25%', left: '20%', baseSize: 22 },
        { top: '15%', left: '65%', baseSize: 14 },
        { top: '65%', left: '30%', baseSize: 28 },
        { top: '50%', left: '70%', baseSize: 16 },
        { top: '75%', left: '60%', baseSize: 12 },
        { top: '35%', left: '45%', baseSize: 18 }
    ];

    function initBubbles() {
        if (!dom.bubbleContainer) return;
        dom.bubbleContainer.innerHTML = '';
        BUBBLES.forEach((b, i) => {
            const el = document.createElement('div');
            el.className = 'xray-bubble';
            el.id = 'bubble-' + i;
            el.style.cssText = 'position:absolute;top:' + b.top + ';left:' + b.left + ';';
            dom.bubbleContainer.appendChild(el);
        });
    }

    function updateVoiding(value) {
        dom.valVoiding.textContent = value;
        const pass = value <= CONFIG.VOID_THRESHOLD;
        dom.xrayBadge.textContent = pass ? t('pass') : t('reject');
        dom.xrayBadge.className = 'quality-badge status-' + (pass ? 'pass' : 'reject');
        BUBBLES.forEach((b, i) => {
            const el = document.getElementById('bubble-' + i);
            if (!el) return;
            const mult = value / 12;
            const size = Math.round(b.baseSize * mult);
            el.style.width = size + 'px';
            el.style.height = size + 'px';
            el.style.marginTop = (-size / 2) + 'px';
            el.style.marginLeft = (-size / 2) + 'px';
            el.classList.toggle('failed', !pass);
        });
        if (!pass) { state.defectReject++; } else { state.defectPass++; }
        updateDefectDisplay();
        saveState();
    }

    // ======================================================================
    // 7. CHECKLIST + LOCALSTORAGE
    // ======================================================================
    function updateChecklist() {
        dom.chkItems.forEach((item, i) => {
            item.checked = state.checklist[i] || false;
        });
        recalcProgress();
    }

    function recalcProgress() {
        let checked = 0;
        dom.chkItems.forEach((item, i) => {
            if (item.checked) { checked++; state.checklist[i] = true; }
            else { state.checklist[i] = false; }
        });
        const pct = Math.round((checked / dom.chkItems.length) * 100);
        dom.progressBar.style.width = pct + '%';
        dom.progressText.textContent = checked + '/' + dom.chkItems.length;
        saveState();
    }

    function initChecklist() {
        updateChecklist();
        dom.chkItems.forEach(item => {
            item.addEventListener('change', function() {
                recalcProgress();
                const label = this.parentElement.querySelector('.chk-label');
                if (label) log('Checklist: ' + (this.checked ? '✓ ' : '✗ ') + label.textContent);
            });
        });
    }

    // ======================================================================
    // 8. TROUBLESHOOTING SEARCH
    // ======================================================================
    function performSearch() {
        const query = dom.searchInput.value.trim().toLowerCase();
        if (!query) {
            dom.resultsContainer.innerHTML =
                '<div class="ts-empty-state"><span class="material-icons-round">info</span><span>' + t('emptySearch') + '</span></div>';
            return;
        }
        const matches = CONFIG.TROUBLESHOOTING.filter(item =>
            item.keywords.some(kw => query.includes(kw) || kw.includes(query)) ||
            item.symptom.toLowerCase().includes(query) ||
            item.action.toLowerCase().includes(query)
        );
        if (matches.length) {
            dom.resultsContainer.innerHTML = '';
            matches.forEach(m => {
                const el = document.createElement('div');
                el.className = 'ts-result-item';
                const hl = (text) => {
                    const re = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
                    return text.replace(re, '<span class="highlight">$1</span>');
                };
                el.innerHTML =
                    '<div class="ts-symptom">Symptom: ' + hl(m.symptom) + '</div>' +
                    '<div class="ts-action"><strong>Action:</strong> ' + hl(m.action) + '</div>';
                dom.resultsContainer.appendChild(el);
            });
        } else {
            dom.resultsContainer.innerHTML =
                '<div class="ts-empty-state"><span class="material-icons-round">warning</span><span>' + t('noResults') + '</span></div>';
        }
    }

    function initSearch() {
        dom.btnSearch.addEventListener('click', performSearch);
        dom.searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') performSearch(); });
        dom.searchInput.addEventListener('input', function() { if (!this.value.trim()) performSearch(); });
    }

    // ======================================================================
    // 9. PROFILE SAVE/LOAD
    // ======================================================================
    function renderProfileList() {
        dom.profileList.innerHTML = '<option value="">' + t('noProfiles') + '</option>';
        state.profiles.forEach((p, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = p.name;
            dom.profileList.appendChild(opt);
        });
    }

    function saveProfile() {
        const name = dom.profileName.value.trim();
        if (!name) { dom.profileName.focus(); return; }
        const data = {
            name: name,
            preheat: dom.preheatSlider.value,
            speed: dom.speedSlider.value,
            needle: dom.needleSlider.value,
            pressure: dom.pressureSlider.value,
            component: dom.componentSelect.value
        };
        const existing = state.profiles.findIndex(p => p.name === name);
        if (existing >= 0) state.profiles[existing] = data;
        else state.profiles.push(data);
        saveState();
        renderProfileList();
        dom.profileName.value = '';
        log('Profile saved: ' + name);
    }

    function loadProfile() {
        const idx = dom.profileList.value;
        if (idx === '') return;
        const data = state.profiles[parseInt(idx)];
        if (!data) return;
        dom.componentSelect.value = data.component;
        updateComponentSpecs(data.component);
        dom.preheatSlider.value = data.preheat;
        dom.valPreheat.textContent = data.preheat;
        dom.speedSlider.value = data.speed;
        dom.valSpeed.textContent = data.speed;
        dom.needleSlider.value = data.needle;
        dom.valNeedle.textContent = parseFloat(data.needle).toFixed(2);
        dom.pressureSlider.value = data.pressure;
        dom.valPressure.textContent = parseFloat(data.pressure).toFixed(2);
        log('Profile loaded: ' + data.name);
    }

    function initProfiles() {
        dom.btnSaveProfile.addEventListener('click', saveProfile);
        dom.btnLoadProfile.addEventListener('click', loadProfile);
        renderProfileList();
    }

    // ======================================================================
    // 10. HISTORY CHART
    // ======================================================================
    function recordHistoryPoint() {
        state.history.push({
            preheat: parseInt(dom.preheatSlider.value),
            speed: parseInt(dom.speedSlider.value),
            time: Date.now()
        });
        if (state.history.length > CONFIG.HISTORY_MAX) state.history.shift();
        saveState();
        drawHistoryChart();
    }

    function drawHistoryChart() {
        const ctx = dom.historyCtx, c = dom.historyCanvas;
        if (!ctx || !c) return;
        const data = state.history;
        ctx.clearRect(0, 0, c.width, c.height);

        if (data.length < 2) {
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.font = '12px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('Adjust parameters to build history', c.width / 2, c.height / 2);
            return;
        }

        const pad = { top: 10, right: 10, bottom: 20, left: 30 };
        const w = c.width - pad.left - pad.right;
        const h = c.height - pad.top - pad.bottom;

        function drawLine(values, color) {
            const min = Math.min(...values), max = Math.max(...values);
            const range = max - min || 1;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            values.forEach((v, i) => {
                const x = pad.left + (i / (values.length - 1)) * w;
                const y = pad.top + h - ((v - min) / range) * h;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            });
            ctx.stroke();
        }

        const preheatVals = data.map(d => d.preheat);
        const speedVals = data.map(d => d.speed);
        drawLine(preheatVals, '#00F2FE');
        drawLine(speedVals, '#00FF87');

        // Labels
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '9px Inter';
        ctx.textAlign = 'left';
        ctx.fillText('Preheat °C (cyan)', pad.left, 10);
        ctx.fillText('Speed mm/s (green)', pad.left + 100, 10);

        // Axis
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.left, pad.top);
        ctx.lineTo(pad.left, pad.top + h);
        ctx.lineTo(pad.left + w, pad.top + h);
        ctx.stroke();
    }

    function initHistory() {
        drawHistoryChart();
        dom.preheatSlider.addEventListener('change', recordHistoryPoint);
        dom.speedSlider.addEventListener('change', recordHistoryPoint);
        if (dom.btnClearHistory) {
            dom.btnClearHistory.addEventListener('click', function() {
                state.history = [];
                saveState();
                drawHistoryChart();
                log('History cleared');
            });
        }
    }

    // ======================================================================
    // 11. OPERATOR LOG
    // ======================================================================
    const MAX_LOG = 50;
    const sessionLog = [];

    function log(msg) {
        const time = new Date().toLocaleTimeString('en-GB');
        sessionLog.push({ time, msg });
        if (sessionLog.length > MAX_LOG) sessionLog.shift();
        renderLog();
    }

    function renderLog() {
        if (!dom.logContainer) return;
        if (sessionLog.length === 0) {
            dom.logContainer.innerHTML = '<span class="log-empty">' + t('noEntries') + '</span>';
            return;
        }
        dom.logContainer.innerHTML = sessionLog.map(e =>
            '<div class="log-entry"><span class="log-time">' + e.time + '</span><span class="log-msg">' + e.msg + '</span></div>'
        ).join('');
        dom.logContainer.scrollTop = dom.logContainer.scrollHeight;
    }

    function initLog() {
        log('Dashboard initialized');
        log('Material: Loctite UF 3808');
        if (state.batchId) log('Batch: ' + state.batchId);
        dom.btnClearLog.addEventListener('click', function() {
            sessionLog.length = 0;
            renderLog();
        });
    }

    // ======================================================================
    // 12. BATCH TRACKING
    // ======================================================================
    function initBatch() {
        if (state.batchId) {
            dom.batchId.value = state.batchId;
            dom.batchDisplay.textContent = CONFIG.I18N.en.batchSet + state.batchId;
            dom.batchDisplay.classList.add('active');
        }
        dom.btnSetBatch.addEventListener('click', function() {
            const val = dom.batchId.value.trim();
            if (!val) return;
            state.batchId = val;
            dom.batchDisplay.textContent = t('batchSet') + val;
            dom.batchDisplay.classList.add('active');
            saveState();
            log('Batch set: ' + val);
        });
        dom.batchId.addEventListener('keypress', e => {
            if (e.key === 'Enter') dom.btnSetBatch.click();
        });
    }

    // ======================================================================
    // 13. LANGUAGE TOGGLE
    // ======================================================================
    function initLangToggle() {
        dom.langToggle.addEventListener('click', function() {
            lang = lang === 'en' ? 'zh' : 'en';
            applyI18n();
            renderProfileList();
            performSearch();
            updateFillet(parseInt(dom.filletSlider?.value || 65));
            updateVoiding(parseInt(dom.voidingSlider?.value || 12));
            log('Language: ' + (lang === 'en' ? 'English' : '中文'));
        });
    }

    // ======================================================================
    // 14. KEYBOARD SHORTCUTS
    // ======================================================================
    function initKeyboard() {
        document.addEventListener('keydown', e => {
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    if (!SIM.running) runSimulation();
                    break;
                case 'r':
                case 'R':
                    resetSimulation();
                    break;
                case 's':
                case 'S':
                    dom.searchInput?.focus();
                    break;
            }
        });
    }

    // ======================================================================
    // 15. REPORT EXPORT
    // ======================================================================
    function exportReport() {
        let report = '=== Underfill Dashboard Report ===\n';
        report += 'Date: ' + new Date().toLocaleString() + '\n';
        report += 'Batch: ' + (state.batchId || 'N/A') + '\n';
        report += 'Component: ' + dom.componentSelect?.value + '\n';
        report += 'Parameters: Preheat=' + dom.preheatSlider?.value + '°C, Speed=' + dom.speedSlider?.value + 'mm/s\n';
        report += 'Needle: ' + dom.needleSlider?.value + 'mm, Pressure=' + dom.pressureSlider?.value + 'MPa\n';
        report += 'Fillet: ' + dom.filletSlider?.value + '% (' + dom.filletBadge?.textContent + ')\n';
        report += 'Voiding: ' + dom.voidingSlider?.value + '% (' + dom.xrayBadge?.textContent + ')\n';
        report += 'Defects: PASS=' + state.defectPass + ' REJECT=' + state.defectReject + '\n';
        report += 'Checklist: ' + dom.progressText?.textContent + '\n';
        report += '\n--- Operator Log ---\n';
        sessionLog.forEach(e => { report += '[' + e.time + '] ' + e.msg + '\n'; });
        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'underfill_report_' + new Date().toISOString().slice(0, 10) + '.txt';
        a.click();
        URL.revokeObjectURL(url);
        log('Report exported');
    }

    // ======================================================================
    // 17. ROUTER (view switching)
    // ======================================================================
    let currentView = 'dashboard';

    function switchView(viewId) {
        if (viewId === currentView) return;
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const target = document.getElementById('view-' + viewId);
        if (target) target.classList.add('active');
        dom.navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewId);
        });
        currentView = viewId;
        // Close sidebar on mobile
        if (window.innerWidth <= 1100) {
            dom.sidebar.classList.remove('open');
            const overlay = document.querySelector('.sidebar-overlay');
            if (overlay) overlay.classList.remove('active');
        }
        // Init view-specific canvas sizing
        if (viewId === 'theory') initCapillaryCanvas();
        if (viewId === 'simulator') { initHeatmapCanvas(); drawHeatmap(); drawSensitivity(); }
        log('View: ' + viewId);
    }

    function initRouter() {
        dom.navItems.forEach(item => {
            item.addEventListener('click', function() {
                switchView(this.dataset.view);
            });
        });
        // Sidebar toggle
        if (dom.sidebarToggle) {
            dom.sidebarToggle.addEventListener('click', function() {
                dom.sidebar.classList.toggle('open');
                let overlay = document.querySelector('.sidebar-overlay');
                if (!overlay && dom.sidebar.classList.contains('open')) {
                    overlay = document.createElement('div');
                    overlay.className = 'sidebar-overlay active';
                    overlay.addEventListener('click', function() {
                        dom.sidebar.classList.remove('open');
                        this.classList.remove('active');
                    });
                    document.querySelector('.app-layout').appendChild(overlay);
                } else if (overlay) {
                    overlay.classList.toggle('active');
                }
            });
        }
    }

    // ======================================================================
    // 18. THEORY MODULE — Capillary Flow Animation
    // ======================================================================
    const CAP = { running: false, rafId: null, progress: 0 };

    function initCapillaryCanvas() {
        if (!dom.capCtx || !dom.capCanvas) return;
        dom.capCanvas.width = dom.capCanvas.parentElement.clientWidth - 4 || 420;
        dom.capCanvas.height = 220;
        drawCapillaryFrame(0);
    }

    function drawCapillaryFrame(t) {
        const ctx = dom.capCtx, c = dom.capCanvas;
        if (!ctx) return;
        const w = c.width, h = c.height;
        ctx.clearRect(0, 0, w, h);

        // Gap height from slider
        const gapVal = parseInt(dom.capGap?.value || 50);
        const viscVal = parseInt(dom.capVisc?.value || 348);
        const gapPx = 15 + (gapVal / 100) * 40;

        // Die block (top)
        const dieY = 30, dieH = 50;
        ctx.fillStyle = '#2D2D3B';
        ctx.fillRect(60, dieY, 200, dieH);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.strokeRect(60, dieY, 200, dieH);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '10px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('SILICON DIE', 160, dieY + dieH / 2 + 3);

        // Substrate (bottom)
        const subY = dieY + dieH + gapPx;
        ctx.fillStyle = '#15251D';
        ctx.fillRect(40, subY, 240, 12);
        ctx.strokeStyle = 'rgba(0,255,135,0.2)';
        ctx.strokeRect(40, subY, 240, 12);

        // Gap label
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = '9px Inter';
        ctx.textAlign = 'left';
        ctx.fillText('Gap: ' + gapVal + ' µm', 270, dieY + dieH + gapPx / 2 + 3);

        // Flow front (capillary action - moving from left to right)
        const maxFlow = 200;
        const flowX = 60 + t * maxFlow;

        // Underfill flow area
        ctx.fillStyle = 'rgba(0, 242, 254, 0.25)';
        ctx.fillRect(60, dieY + dieH, flowX - 60, gapPx);

        // Flow front curve
        if (flowX > 60 && flowX < 260) {
            ctx.beginPath();
            ctx.moveTo(flowX, dieY + dieH);
            ctx.quadraticCurveTo(flowX + 5, dieY + dieH + gapPx / 2, flowX, dieY + dieH + gapPx);
            ctx.lineTo(60, dieY + dieH + gapPx);
            ctx.lineTo(60, dieY + dieH);
            ctx.closePath();
            ctx.fillStyle = 'rgba(0, 242, 254, 0.35)';
            ctx.fill();
        }

        if (flowX >= 260) {
            ctx.fillStyle = 'rgba(0, 242, 254, 0.2)';
            ctx.fillRect(60, dieY + dieH, maxFlow, gapPx);
            ctx.fillStyle = 'rgba(0, 255, 135, 0.2)';
            ctx.font = '11px Outfit';
            ctx.textAlign = 'center';
            ctx.fillText('COMPLETE', 160, dieY + dieH + gapPx / 2 + 4);
        }

        // Flow direction arrow
        if (t < 1) {
            ctx.fillStyle = '#00F2FE';
            ctx.beginPath();
            const ax = flowX, ay = dieY + dieH + gapPx / 2;
            ctx.moveTo(ax + 4, ay);
            ctx.lineTo(ax - 2, ay - 4);
            ctx.lineTo(ax - 2, ay + 4);
            ctx.closePath();
            ctx.fill();
        }

        // Labels
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.font = '9px Inter';
        ctx.textAlign = 'left';
        ctx.fillText('Needle', 10, dieY + dieH / 2);
        ctx.fillText('PCB Substrate', 10, subY + 10);

        // Compute flow physics
        const flowSpeed = (100 / gapVal) * (348 / viscVal) * 1.5;
        const capPress = (2 * 0.032 * Math.cos(20 * Math.PI / 180)) / (gapVal / 1000000);
        if (dom.capFlowRate) dom.capFlowRate.textContent = flowSpeed.toFixed(1);
        if (dom.capPressureVal) dom.capPressureVal.textContent = Math.round(capPress);
    }

    function runCapillaryAnim() {
        if (CAP.running) return;
        CAP.running = true;
        CAP.progress = 0;
        const visc = parseInt(dom.capVisc?.value || 348);
        const gap = parseInt(dom.capGap?.value || 50);
        const duration = 3000 * (visc / 348) * (50 / gap);

        function frame(timestamp) {
            if (!CAP.start) CAP.start = timestamp;
            const elapsed = timestamp - CAP.start;
            CAP.progress = Math.min(elapsed / duration, 1);
            drawCapillaryFrame(CAP.progress);
            if (CAP.progress < 1) {
                CAP.rafId = requestAnimationFrame(frame);
            } else {
                CAP.running = false;
                CAP.start = 0;
            }
        }
        CAP.start = 0;
        CAP.rafId = requestAnimationFrame(frame);
    }

    function initTheory() {
        // Process flow stage clicks
        dom.flowStages.forEach(stage => {
            stage.addEventListener('click', function() {
                dom.flowStages.forEach(s => s.classList.remove('active'));
                this.classList.add('active');
            });
        });
        // Activate first stage by default
        if (dom.flowStages.length) dom.flowStages[0].classList.add('active');

        // Capillary controls
        if (dom.capGap) {
            dom.capGap.addEventListener('input', function() {
                dom.valGap.textContent = this.value;
                if (!CAP.running) drawCapillaryFrame(CAP.progress);
            });
        }
        if (dom.capVisc) {
            dom.capVisc.addEventListener('input', function() {
                dom.valVisc.textContent = this.value;
                if (!CAP.running) drawCapillaryFrame(CAP.progress);
            });
        }
        // Auto-run capillary
        setTimeout(runCapillaryAnim, 500);
        dom.capCanvas?.addEventListener('click', runCapillaryAnim);

        // Flip cards
        dom.propCards.forEach(card => {
            card.addEventListener('click', function() {
                this.classList.toggle('flipped');
            });
        });
    }

    // ======================================================================
    // 19. SIMULATOR LAB MODULE
    // ======================================================================
    function initSimulatorLab() {
        if (!dom.slPreheat) return;
        const updateSimlab = () => {
            const preheat = parseInt(dom.slPreheat.value);
            const speed = parseInt(dom.slSpeed.value);
            const pressure = parseFloat(dom.slPressure.value);
            const needle = parseFloat(dom.slNeedle.value);
            dom.simlabPreheat.textContent = preheat;
            dom.simlabSpeed.textContent = speed;
            dom.simlabPressure.textContent = pressure.toFixed(2);
            dom.simlabNeedle.textContent = needle.toFixed(2);

            // Prediction model
            const filletRaw = 50 + (preheat - 70) * 0.4 - (speed - 5) * 0.6 + (pressure - 0.1) * 30 - (needle - 0.05) * 40;
            const fillet = Math.max(0, Math.min(100, Math.round(filletRaw)));
            const filletPass = fillet >= CONFIG.FILLET_PASS_MIN && fillet <= CONFIG.FILLET_PASS_MAX;
            dom.predFillet.innerHTML = fillet + '% <span class="pred-status ' + (filletPass ? 'pass' : 'fail') + '">' + (filletPass ? t('pass') : t('reject')) + '</span>';

            const voidRaw = 30 - (preheat - 70) * 0.3 + (speed - 5) * 0.2 - (pressure - 0.1) * 15 + (needle - 0.05) * 20;
            const voidPct = Math.max(0, Math.min(50, Math.round(voidRaw)));
            const voidPass = voidPct <= CONFIG.VOID_THRESHOLD;
            dom.predVoid.innerHTML = voidPct + '% <span class="pred-status ' + (voidPass ? 'pass' : 'fail') + '">' + (voidPass ? t('pass') : t('reject')) + '</span>';

            drawHeatmap();
            drawSensitivity();
        };

        dom.slPreheat.addEventListener('input', updateSimlab);
        dom.slSpeed.addEventListener('input', updateSimlab);
        dom.slPressure.addEventListener('input', updateSimlab);
        dom.slNeedle.addEventListener('input', updateSimlab);
        updateSimlab();
    }

    function initHeatmapCanvas() {
        if (!dom.heatmapCtx || !dom.heatmapCanvas) return;
        const rect = dom.heatmapCanvas.parentElement.getBoundingClientRect();
        dom.heatmapCanvas.width = Math.min(400, rect.width - 4);
        dom.heatmapCanvas.height = 300;
    }

    function drawHeatmap() {
        const ctx = dom.heatmapCtx, c = dom.heatmapCanvas;
        if (!ctx) return;
        const w = c.width, h = c.height;
        ctx.clearRect(0, 0, w, h);

        const pad = { top: 30, right: 20, bottom: 30, left: 40 };
        const pw = w - pad.left - pad.right;
        const ph = h - pad.top - pad.bottom;

        // Draw heatmap cells
        const cellsX = 20, cellsY = 15;
        const cellW = pw / cellsX, cellH = ph / cellsY;

        for (let i = 0; i < cellsX; i++) {
            for (let j = 0; j < cellsY; j++) {
                const preheat = 70 + (i / cellsX) * 30;
                const speed = 5 + (j / cellsY) * 25;
                const filletRaw = 50 + (preheat - 70) * 0.4 - (speed - 5) * 0.6;
                const fillet = Math.max(0, Math.min(100, filletRaw));
                const pass = fillet >= CONFIG.FILLET_PASS_MIN && fillet <= CONFIG.FILLET_PASS_MAX;
                const ratio = pass ? (fillet - 50) / 25 : (fillet < 50 ? fillet / 50 : (100 - fillet) / 25);
                const x = pad.left + i * cellW;
                const y = pad.top + j * cellH;

                if (pass) {
                    const g = Math.round(135 + 120 * (1 - ratio));
                    ctx.fillStyle = 'rgb(0, ' + g + ', ' + Math.round(80 + 100 * ratio) + ')';
                } else {
                    const r = Math.round(200 + 55 * (1 - ratio));
                    ctx.fillStyle = 'rgb(' + r + ', ' + Math.round(60 - 40 * ratio) + ', ' + Math.round(60 - 40 * ratio) + ')';
                }
                ctx.fillRect(x, y, cellW + 0.5, cellH + 0.5);
            }
        }

        // Current position marker
        const curPreheat = parseInt(dom.slPreheat?.value || 85);
        const curSpeed = parseInt(dom.slSpeed?.value || 15);
        const cx = pad.left + ((curPreheat - 70) / 30) * pw;
        const cy = pad.top + ((curSpeed - 5) / 25) * ph;
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();

        // Axis labels
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '9px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Preheat (°C)', w / 2, h - 4);
        ctx.textAlign = 'right';
        for (let i = 0; i <= 3; i++) {
            const val = 70 + i * 10;
            const x = pad.left + (i / 3) * pw;
            ctx.fillText(val, x, pad.top - 6);
        }
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.save();
        ctx.translate(12, pad.top + ph / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Speed (mm/s)', 0, 0);
        ctx.restore();
        ctx.textBaseline = 'alphabetic';
    }

    function drawSensitivity() {
        const ctx = dom.sensitivityCtx, c = dom.sensitivityCanvas;
        if (!ctx) return;
        const rect = c.parentElement.getBoundingClientRect();
        c.width = Math.min(400, rect.width - 4);
        c.height = 200;
        const w = c.width, h = c.height;
        ctx.clearRect(0, 0, w, h);

        const labels = ['Preheat', 'Speed', 'Pressure', 'Needle'];
        const values = [
            Math.round(parseInt(dom.slPreheat?.value || 85) * 0.8),
            Math.round((30 - parseInt(dom.slSpeed?.value || 15)) * 2.5),
            Math.round(parseFloat(dom.slPressure?.value || 0.3) * 200),
            Math.round((0.5 - parseFloat(dom.slNeedle?.value || 0.1)) * 150)
        ];
        const maxVal = Math.max(...values, 1);
        const barW = Math.min(60, (w - 60) / labels.length - 10);
        const pad = { top: 15, bottom: 30, left: 10, right: 10 };
        const chartH = h - pad.top - pad.bottom;

        labels.forEach((label, i) => {
            const x = pad.left + i * (barW + 12) + 30;
            const barH = (values[i] / maxVal) * chartH;
            const y = pad.top + chartH - barH;

            const grad = ctx.createLinearGradient(x, y, x, pad.top + chartH);
            grad.addColorStop(0, '#00F2FE');
            grad.addColorStop(1, 'rgba(0,242,254,0.3)');
            ctx.fillStyle = grad;
            ctx.fillRect(x, y, barW, barH);

            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '9px Inter';
            ctx.textAlign = 'center';
            ctx.fillText(values[i], x + barW / 2, y - 4);
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.fillText(label, x + barW / 2, pad.top + chartH + 14);
        });

        // Title
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = '9px Inter';
        ctx.textAlign = 'left';
        ctx.fillText('Relative Impact on Quality', pad.left, 10);
    }

    // ======================================================================
    // 20. ACADEMY MODULE — Defect Cards & Quiz
    // ======================================================================
    function initAcademy() {
        dom.defectCards.forEach(card => {
            card.addEventListener('click', function() {
                this.classList.toggle('expanded');
            });
        });
        dom.quizNext?.addEventListener('click', function() {
            quizState.current++;
            renderQuizQuestion();
        });
        dom.quizRestart?.addEventListener('click', initQuiz);
        initQuiz();
    }

    // Quiz Engine
    let quizState = { current: 0, score: 0, answered: false };

    function initQuiz() {
        if (!dom.quizQuestion) return;
        quizState = { current: 0, score: 0, answered: false };
        dom.quizTotal.textContent = CONFIG.QUIZ.length;
        dom.quizCard.style.display = 'block';
        dom.quizScorecard.style.display = 'none';
        renderQuizQuestion();
    }

    function renderQuizQuestion() {
        const q = CONFIG.QUIZ[quizState.current];
        if (!q) return;
        dom.quizCurrent.textContent = quizState.current + 1;
        dom.quizQuestion.textContent = q.q;
        dom.quizOptions.innerHTML = '';
        dom.quizFeedback.textContent = '';
        dom.quizFeedback.className = 'quiz-feedback';
        dom.quizNext.style.display = 'none';
        quizState.answered = false;

        q.options.forEach((opt, i) => {
            const el = document.createElement('div');
            el.className = 'quiz-option';
            el.textContent = opt;
            el.dataset.index = i;
            el.addEventListener('click', function() {
                if (quizState.answered) return;
                quizState.answered = true;
                const selected = parseInt(this.dataset.index);
                const correct = selected === q.answer;
                if (correct) quizState.score++;
                document.querySelectorAll('.quiz-option').forEach(o => {
                    const idx = parseInt(o.dataset.index);
                    o.classList.add(idx === q.answer ? 'correct' : 'wrong');
                    if (idx === q.answer) o.classList.add('selected');
                });
                this.classList.add('selected');
                dom.quizFeedback.textContent = correct
                    ? (lang === 'en' ? '✓ Correct!' : '✓ 正確！')
                    : (lang === 'en' ? '✗ Incorrect. The answer is: ' + q.options[q.answer] : '✗ 不正確。答案是：' + q.options[q.answer]);
                dom.quizFeedback.className = 'quiz-feedback ' + (correct ? 'correct' : 'wrong');

                if (quizState.current < CONFIG.QUIZ.length - 1) {
                    dom.quizNext.style.display = 'block';
                    dom.quizNext.textContent = t('next');
                } else {
                    setTimeout(showQuizScore, 800);
                }
            });
            dom.quizOptions.appendChild(el);
        });
    }

    function showQuizScore() {
        dom.quizCard.style.display = 'none';
        dom.quizScorecard.style.display = 'flex';
        const pct = Math.round((quizState.score / CONFIG.QUIZ.length) * 100);
        dom.scorePct.textContent = pct + '%';
        const detail = lang === 'en'
            ? 'You got ' + quizState.score + ' of ' + CONFIG.QUIZ.length + ' correct.'
            : '你答對了 ' + quizState.score + ' / ' + CONFIG.QUIZ.length + ' 題。';
        dom.scoreDetail.textContent = detail;
        // Color the score circle
        const circle = dom.scorePct.parentElement;
        circle.style.borderColor = pct >= 80 ? 'var(--color-green)' : pct >= 50 ? 'var(--color-amber)' : 'var(--color-red)';
        dom.scorePct.style.color = pct >= 80 ? 'var(--color-green)' : pct >= 50 ? 'var(--color-amber)' : 'var(--color-red)';
    }

    // ======================================================================
    // 21. KNOWLEDGE MODULE
    // ======================================================================
    function initKnowledge() {
        if (!dom.kbSearch) return;
        dom.kbSearch.addEventListener('input', function() {
            const q = this.value.trim().toLowerCase();
            dom.kbCards.forEach(card => {
                const keywords = (card.dataset.keywords || '').toLowerCase();
                const text = card.textContent.toLowerCase();
                const match = !q || keywords.includes(q) || text.includes(q);
                card.classList.toggle('hidden', !match);
            });
        });
    }

    // ======================================================================
    // 22. PWA REGISTRATION
    // ======================================================================
    function registerSW() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(() => {});
        }
    }

    // ======================================================================
    // 23. INIT
    // ======================================================================
    document.addEventListener('DOMContentLoaded', function() {
        cacheDom();
        applyI18n();
        updateClock();
        setInterval(updateClock, 1000);

        dom.componentSelect.addEventListener('change', e => updateComponentSpecs(e.target.value));
        dom.preheatSlider.addEventListener('input', e => { dom.valPreheat.textContent = e.target.value; });
        dom.speedSlider.addEventListener('input', e => { dom.valSpeed.textContent = e.target.value; });
        dom.needleSlider.addEventListener('input', e => { dom.valNeedle.textContent = parseFloat(e.target.value).toFixed(2); });
        dom.pressureSlider.addEventListener('input', e => { dom.valPressure.textContent = parseFloat(e.target.value).toFixed(2); });
        updateComponentSpecs(dom.componentSelect.value);

        initCureCards();
        initSimulator();
        initBubbles();
        initChecklist();
        initSearch();
        initProfiles();
        initHistory();
        initBatch();
        initLangToggle();
        initKeyboard();
        initLog();
        initRouter();
        initTheory();
        initSimulatorLab();
        initAcademy();
        initKnowledge();
        registerSW();

        updateDefectDisplay();

        dom.filletSlider.addEventListener('input', e => updateFillet(parseInt(e.target.value)));
        updateFillet(parseInt(dom.filletSlider.value));

        dom.voidingSlider.addEventListener('input', e => updateVoiding(parseInt(e.target.value)));
        updateVoiding(parseInt(dom.voidingSlider.value));

        document.addEventListener('keydown', e => {
            if (e.ctrlKey && e.key === 'e') { e.preventDefault(); exportReport(); }
        });

        document.dispatchEvent(new Event('contentLoaded'));
    });
})();
