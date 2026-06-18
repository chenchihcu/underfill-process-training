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
        dom.ctx = null; // 3D: acquired lazily if 2D fallback needed
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
        dom.historyCtx = null; // 3D
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
        dom.capCtx = null; // 3D
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
        dom.heatmapCtx = null; // 3D
        dom.sensitivityCanvas = $('sensitivity-canvas');
        dom.sensitivityCtx = null; // 3D
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
        ctx.shadowColor = '#3B82F6';
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#F8FAFC';
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
        if (hist3D) draw3DHistory(); else drawHistoryChart();
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
        drawLine(preheatVals, '#3B82F6');
        drawLine(speedVals, '#10B981');

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
        if (hist3D) draw3DHistory(); else drawHistoryChart();
        dom.preheatSlider.addEventListener('change', recordHistoryPoint);
        dom.speedSlider.addEventListener('change', recordHistoryPoint);
        if (dom.btnClearHistory) {
            dom.btnClearHistory.addEventListener('click', function() {
                state.history = [];
                saveState();
                if (hist3D) draw3DHistory(); else drawHistoryChart();
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
                    if (disp3D && !D3D.running) run3DDispense();
                    else if (!SIM.running) runSimulation();
                    break;
                case 'r':
                case 'R':
                    if (disp3D) reset3DDispense();
                    else resetSimulation();
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
        ctx.fillStyle = '#CBD5E1';
        ctx.fillRect(60, dieY, 200, dieH);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.strokeRect(60, dieY, 200, dieH);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '10px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('SILICON DIE', 160, dieY + dieH / 2 + 3);

        // Substrate (bottom)
        const subY = dieY + dieH + gapPx;
        ctx.fillStyle = '#D1FAE5';
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
            ctx.fillStyle = '#3B82F6';
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
        if (dom.flowStages.length) dom.flowStages[0].classList.add('active');

        // Capillary label controls (3D rendering handled by init3DCapillary)
        if (dom.capGap) dom.capGap.addEventListener('input', function() {
            dom.valGap.textContent = this.value;
        });
        if (dom.capVisc) dom.capVisc.addEventListener('input', function() {
            dom.valVisc.textContent = this.value;
        });

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

            if (!heat3D) drawHeatmap();
            if (!sens3D) drawSensitivity();
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
            grad.addColorStop(0, '#3B82F6');
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
    // 24. THREE.JS 3D ENGINE
    // ======================================================================
    const T3D = {};

    async function ensure3D(canvasId, opts = {}) {
        if (T3D[canvasId]) return T3D[canvasId];
        let THREE;
        try { THREE = await import('three'); } catch (e) { console.warn('Three.js not available, using 2D fallback'); return null; }
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        const w = canvas.clientWidth || canvas.width || 400;
        const h = canvas.clientHeight || canvas.height || 300;
        canvas.width = w; canvas.height = h;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0D0D11);

        const camera = new THREE.PerspectiveCamera(opts.fov || 40, w / h, 0.1, 100);
        if (opts.camPos) camera.position.set(...opts.camPos);
        else camera.position.set(0, 4, 7);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;

        scene.add(new THREE.AmbientLight(0x404060, 0.6));
        const dl = new THREE.DirectionalLight(0xffffff, 1.8);
        dl.position.set(5, 12, 8); dl.castShadow = true;
        dl.shadow.mapSize.width = 1024; dl.shadow.mapSize.height = 1024;
        scene.add(dl);
        const fl = new THREE.DirectionalLight(0x00F2FE, 0.5);
        fl.position.set(-4, 3, -6); scene.add(fl);
        const hl = new THREE.PointLight(0x00FF87, 0.3, 20);
        hl.position.set(0, 5, 0); scene.add(hl);

        const eng = { THREE, scene, camera, renderer, canvas, objects: [], animId: null, clock: new THREE.Clock() };
        T3D[canvasId] = eng;
        return eng;
    }

    function startLoop(eng, fn) {
        function loop(t) { fn(t, eng.clock.getElapsedTime()); eng.renderer.render(eng.scene, eng.camera); eng.animId = requestAnimationFrame(loop); }
        eng.clock.start(); eng.animId = requestAnimationFrame(loop);
    }
    function stopLoop(eng) { if (eng.animId) { cancelAnimationFrame(eng.animId); eng.animId = null; } }

    function dispose3D(eng) {
        stopLoop(eng);
        eng.objects.forEach(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        eng.renderer.dispose();
        delete T3D[eng.canvas.id];
    }

    // ---- 3D Dispense Simulator ----
    let disp3D = null;
    const D3D = { pathType: 'L', progress: 0, running: false, startTime: 0, flowMesh: null, needleMesh: null, beadGroup: null };

    async function init3DDispense() {
        const canvas = document.getElementById('dispense-canvas');
        if (!canvas) return;
        disp3D = await ensure3D('dispense-canvas', { fov: 35, camPos: [-1, 6, 9] });
        const T = disp3D.THREE, sc = disp3D.scene, cam = disp3D.camera;

        // Substrate plane
        const subGeo = new T.BoxGeometry(8, 0.2, 8);
        const subMat = new T.MeshStandardMaterial({ color: 0x2a2a3a, metalness: 0.3, roughness: 0.8 });
        const sub = new T.Mesh(subGeo, subMat); sub.receiveShadow = true;
        sc.add(sub); disp3D.objects.push(sub);

        // Die
        const dieGeo = new T.BoxGeometry(3.6, 0.3, 3.6);
        const dieMat = new T.MeshPhysicalMaterial({ color: 0x3a3a4a, metalness: 0.2, roughness: 0.6, transparent: true, opacity: 0.7 });
        const die = new T.Mesh(dieGeo, dieMat); die.position.y = 0.45; die.castShadow = true;
        sc.add(die); disp3D.objects.push(die);

        // BGA balls
        const ballMat = new T.MeshStandardMaterial({ color: 0xffb300, metalness: 0.7, roughness: 0.3 });
        for (let i = 0; i < 6; i++) {
            for (let j = 0; j < 6; j++) {
                const ball = new T.Mesh(new T.SphereGeometry(0.12, 12, 12), ballMat);
                ball.position.set(-1.5 + i * 0.6, 0.3, -1.5 + j * 0.6);
                ball.castShadow = true;
                sc.add(ball); disp3D.objects.push(ball);
            }
        }

        // Flow fill mesh (underfill)
        const flowGeo = new T.BoxGeometry(0.01, 0.15, 3.4);
        const flowMat = new T.MeshPhysicalMaterial({
            color: 0x00F2FE, transparent: true, opacity: 0.35, metalness: 0.1, roughness: 0.2
        });
        const flow = new T.Mesh(flowGeo, flowMat);
        flow.position.set(-1.8, 0.3, 0);
        sc.add(flow); disp3D.objects.push(flow);
        D3D.flowMesh = flow;

        // Needle
        const nMat = new T.MeshStandardMaterial({ color: 0x888899, metalness: 0.8, roughness: 0.2 });
        const needle = new T.Mesh(new T.CylinderGeometry(0.06, 0.08, 0.6, 8), nMat);
        needle.position.set(-1.8, 1.2, 0);
        sc.add(needle); disp3D.objects.push(needle);
        D3D.needleMesh = needle;

        // Bead path group
        const bg = new T.Group();
        sc.add(bg); disp3D.objects.push(bg);
        D3D.beadGroup = bg;

        // Grid helper
        const grid = new T.GridHelper(8, 16, 0x333355, 0x222244);
        grid.position.y = -0.1;
        sc.add(grid);

        cam.position.set(-1, 6, 9); cam.lookAt(0, 0, 0);

        // Start continuous loop
        startLoop(disp3D, (t, dt) => {
            if (D3D.running) {
                const elapsed = t - D3D.startTime;
                const speed = parseInt(dom.speedSlider?.value || 15);
                const duration = 3000 + (30 - speed) * 100;
                D3D.progress = Math.min(elapsed / duration, 1);
                update3DDispense(D3D.progress);
                if (D3D.progress >= 1) {
                    D3D.running = false;
                    setSimStatus('completed');
                    if (dom.btnPlay) dom.btnPlay.disabled = false;
                }
            }
        });

        // Wire controls
        dom.pathBtns?.forEach(btn => {
            btn.addEventListener('click', function() {
                if (D3D.running) return;
                dom.pathBtns.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                D3D.pathType = this.dataset.path;
                reset3DDispense();
            });
        });
        if (dom.btnPlay) dom.btnPlay.addEventListener('click', run3DDispense);
        if (dom.btnReset) dom.btnReset.addEventListener('click', reset3DDispense);
        reset3DDispense();
    }

    function get3DPathCoords(type) {
        if (type === 'L') return [{ x: 1.8, y: 0, z: -1.8 }, { x: -1.8, y: 0, z: -1.8 }, { x: -1.8, y: 0, z: 1.8 }];
        if (type === 'I') return [{ x: -1.8, y: 0, z: -1.8 }, { x: -1.8, y: 0, z: 1.8 }];
        if (type === 'U') return [{ x: 1.8, y: 0, z: -1.8 }, { x: 1.8, y: 0, z: 1.8 }, { x: -1.8, y: 0, z: 1.8 }, { x: -1.8, y: 0, z: -1.8 }];
        return [];
    }

    function posOn3DPath(coords, t) {
        if (coords.length < 2) return coords[0] || { x: 0, y: 0, z: 0 };
        if (t <= 0) return coords[0];
        if (t >= 1) return coords[coords.length - 1];
        const segs = coords.length - 1;
        const sr = 1 / segs;
        const idx = Math.min(Math.floor(t / sr), segs - 1);
        const lt = (t - idx * sr) / sr;
        return {
            x: coords[idx].x + (coords[idx + 1].x - coords[idx].x) * lt,
            y: 0,
            z: coords[idx].z + (coords[idx + 1].z - coords[idx].z) * lt
        };
    }

    function update3DDispense(progress) {
        if (!D3D.flowMesh) return;
        const T = disp3D.THREE;
        const maxW = 3.4;
        const w = maxW * progress;
        D3D.flowMesh.scale.x = w / 3.4;
        D3D.flowMesh.position.x = -1.8 + (w / 2);

        // Update needle position along path
        const coords = get3DPathCoords(D3D.pathType);
        const pos = posOn3DPath(coords, progress);
        D3D.needleMesh.position.set(pos.x, 1.2, pos.z);

        // Draw bead trail
        D3D.beadGroup.children.forEach(c => { c.geometry?.dispose(); });
        D3D.beadGroup.clear();
        if (progress > 0.01) {
            const steps = Math.max(2, Math.floor(progress * 40));
            const pts = [];
            for (let i = 0; i <= steps; i++) {
                const p = posOn3DPath(coords, (i / steps) * progress);
                pts.push(new T.Vector3(p.x, 0.35, p.z));
            }
            if (pts.length > 1) {
                const curve = new T.CatmullRomCurve3(pts);
                const tube = new T.Mesh(
                    new T.TubeGeometry(curve, 20, 0.03, 6, false),
                    new T.MeshBasicMaterial({ color: 0x00F2FE, transparent: true, opacity: 0.7 })
                );
                D3D.beadGroup.add(tube);
            }
        }
    }

    function run3DDispense() {
        if (D3D.running || !disp3D) return;
        D3D.running = true;
        D3D.startTime = performance.now();
        D3D.progress = 0;
        if (dom.btnPlay) dom.btnPlay.disabled = true;
        setSimStatus('running');
    }

    function reset3DDispense() {
        D3D.running = false;
        D3D.progress = 0;
        if (dom.btnPlay) dom.btnPlay.disabled = false;
        setSimStatus('standby');
        update3DDispense(0);
        if (D3D.beadGroup) { D3D.beadGroup.children.forEach(c => { c.geometry?.dispose(); }); D3D.beadGroup.clear(); }
    }

    // ---- 3D Capillary Flow ----
    let cap3D = null;
    const CAP3D = { progress: 0, running: false, start: 0, flowMesh: null, arrowMesh: null };

    async function init3DCapillary() {
        const canvas = document.getElementById('capillary-canvas');
        if (!canvas) return;
        cap3D = await ensure3D('capillary-canvas', { fov: 35, camPos: [0, 3, 7] });
        const T = cap3D.THREE, sc = cap3D.scene;

        // Substrate
        const sub = new T.Mesh(
            new T.BoxGeometry(7, 0.15, 0.8),
            new T.MeshStandardMaterial({ color: 0x2a2a3a, metalness: 0.3, roughness: 0.7 })
        );
        sub.position.set(0, -0.1, 0); sub.receiveShadow = true;
        sc.add(sub); cap3D.objects.push(sub);

        // Die (slightly elevated to show gap)
        const die = new T.Mesh(
            new T.BoxGeometry(4, 0.25, 0.6),
            new T.MeshPhysicalMaterial({ color: 0x3a3a4a, metalness: 0.2, roughness: 0.6, transparent: true, opacity: 0.75 })
        );
        die.position.set(0, 0.3, 0); die.castShadow = true;
        sc.add(die); cap3D.objects.push(die);

        // Gap indicator
        const gapMat = new T.MeshBasicMaterial({ color: 0x00F2FE, transparent: true, opacity: 0.08, side: T.DoubleSide });
        const gapGeo = new T.PlaneGeometry(0.01, 0.08);
        const gapVis = new T.Mesh(gapGeo, gapMat);
        gapVis.position.set(2.2, 0.17, 0.02);
        sc.add(gapVis); cap3D.objects.push(gapVis);

        // Flow mesh
        const flowMat = new T.MeshPhysicalMaterial({
            color: 0x00F2FE, transparent: true, opacity: 0.3, metalness: 0.1, roughness: 0.3, side: T.DoubleSide
        });
        const flow = new T.Mesh(new T.BoxGeometry(0.01, 0.08, 0.5), flowMat);
        flow.position.set(-2, 0.17, 0);
        sc.add(flow); cap3D.objects.push(flow);
        CAP3D.flowMesh = flow;

        // Glow arrow
        const arrowMat = new T.MeshBasicMaterial({ color: 0x00F2FE, transparent: true, opacity: 0.6 });
        const arrow = new T.Mesh(new T.ConeGeometry(0.08, 0.15, 4), arrowMat);
        arrow.rotation.x = Math.PI / 2;
        arrow.position.set(-2, 0.22, 0);
        sc.add(arrow); cap3D.objects.push(arrow);
        CAP3D.arrowMesh = arrow;

        // Labels via sprites? For simplicity, use CSS overlay or skip 3D labels
        const grid = new T.GridHelper(7, 14, 0x333355, 0x222244);
        grid.position.y = -0.15;
        sc.add(grid);

        cap3D.camera.position.set(0, 2.5, 6);
        cap3D.camera.lookAt(0, 0.1, 0);

        startLoop(cap3D, (t, dt) => {
            if (CAP3D.running) {
                const elapsed = t - CAP3D.start;
                const visc = parseInt(dom.capVisc?.value || 348);
                const gap = parseInt(dom.capGap?.value || 50);
                const duration = 3000 * (visc / 348) * (50 / gap);
                CAP3D.progress = Math.min(elapsed / duration, 1);
                update3DCapillary(CAP3D.progress);
                if (CAP3D.progress >= 1) {
                    CAP3D.running = false;
                    CAP3D.start = 0;
                }
            }
        });

        // Wire controls
        if (dom.capGap) dom.capGap.addEventListener('input', function() {
            dom.valGap.textContent = this.value;
            if (!CAP3D.running) update3DCapillary(CAP3D.progress);
        });
        if (dom.capVisc) dom.capVisc.addEventListener('input', function() {
            dom.valVisc.textContent = this.value;
            if (!CAP3D.running) update3DCapillary(CAP3D.progress);
        });

        setTimeout(() => { if (!CAP3D.running) { CAP3D.running = true; CAP3D.start = performance.now(); CAP3D.progress = 0; } }, 500);
        canvas.addEventListener('click', () => { if (!CAP3D.running) { CAP3D.running = true; CAP3D.start = performance.now(); CAP3D.progress = 0; } });
        update3DCapillary(0);
    }

    function update3DCapillary(progress) {
        if (!CAP3D.flowMesh || !CAP3D.arrowMesh) return;
        const maxW = 3.8;
        const w = maxW * progress;
        CAP3D.flowMesh.scale.x = w / 0.01;
        CAP3D.flowMesh.position.x = -2 + (w / 2);
        CAP3D.arrowMesh.position.x = -2 + w;

        // Update labels
        const visc = parseInt(dom.capVisc?.value || 348);
        const gap = parseInt(dom.capGap?.value || 50);
        const flowSpeed = (100 / gap) * (348 / visc) * 1.5;
        const capPress = (2 * 0.032 * Math.cos(20 * Math.PI / 180)) / (gap / 1000000);
        if (dom.capFlowRate) dom.capFlowRate.textContent = flowSpeed.toFixed(1);
        if (dom.capPressureVal) dom.capPressureVal.textContent = Math.round(capPress);
    }

    // ---- 3D Heatmap (Surface Plot) ----
    let heat3D = null;

    async function init3DHeatmap() {
        const canvas = document.getElementById('heatmap-canvas');
        if (!canvas) return;
        heat3D = await ensure3D('heatmap-canvas', { fov: 40, camPos: [3, 4, 6] });
        const T = heat3D.THREE, sc = heat3D.scene;

        const gridSize = 20, segs = 15;
        const geo = new T.PlaneGeometry(gridSize, gridSize, segs, segs);
        geo.rotateX(-Math.PI / 2);

        const pos = geo.attributes.position;
        const colors = new Float32Array(pos.count * 3);
        const color = new T.Color();

        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i), z = pos.getZ(i);
            const nx = (x + gridSize / 2) / gridSize, nz = (z + gridSize / 2) / gridSize;
            const h = Math.sin(nx * Math.PI * 3) * Math.cos(nz * Math.PI * 3) * 0.3 + 0.5;
            pos.setY(i, h * 1.5);
            color.setHSL(0.55 - h * 0.4, 0.8, 0.15 + h * 0.5);
            colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
        }
        geo.setAttribute('color', new T.BufferAttribute(colors, 3));
        pos.needsUpdate = true;
        geo.computeVertexNormals();

        const mat = new T.MeshStandardMaterial({
            vertexColors: true, roughness: 0.5, metalness: 0.1, flatShading: false, side: T.DoubleSide
        });
        const surface = new T.Mesh(geo, mat);
        surface.position.set(0, 0, 0);
        sc.add(surface); heat3D.objects.push(surface);

        // Marker sphere
        const marker = new T.Mesh(
            new T.SphereGeometry(0.25, 16, 16),
            new T.MeshBasicMaterial({ color: 0xffffff })
        );
        marker.position.set(-3, 1.5, -3);
        sc.add(marker); heat3D.objects.push(marker);

        sc.add(new T.GridHelper(20, 20, 0x333355, 0x222244));

        heat3D.camera.position.set(3, 4, 6);
        heat3D.camera.lookAt(0, 0.5, 0);

        // Slow orbit
        heat3D.orbitAngle = 0;
        startLoop(heat3D, (t, dt) => {
            heat3D.orbitAngle += dt * 0.15;
            const rad = 6;
            heat3D.camera.position.x = Math.sin(heat3D.orbitAngle) * rad;
            heat3D.camera.position.z = Math.cos(heat3D.orbitAngle) * rad;
            heat3D.camera.position.y = 3 + Math.sin(heat3D.orbitAngle * 0.5) * 0.5;
            heat3D.camera.lookAt(0, 0.5, 0);
        });
    }

    // ---- 3D Sensitivity Chart ----
    let sens3D = null;

    async function init3DSensitivity() {
        const canvas = document.getElementById('sensitivity-canvas');
        if (!canvas) return;
        sens3D = await ensure3D('sensitivity-canvas', { fov: 40, camPos: [4, 3, 6] });
        const T = sens3D.THREE, sc = sens3D.scene;
        const labels = ['Preheat', 'Speed', 'Pressure', 'Needle'];
        const barMat = [
            new T.MeshPhysicalMaterial({ color: 0x00F2FE, metalness: 0.3, roughness: 0.2, emissive: 0x00F2FE, emissiveIntensity: 0.15 }),
            new T.MeshPhysicalMaterial({ color: 0x00FF87, metalness: 0.3, roughness: 0.2, emissive: 0x00FF87, emissiveIntensity: 0.15 }),
            new T.MeshPhysicalMaterial({ color: 0xFFB300, metalness: 0.3, roughness: 0.2, emissive: 0xFFB300, emissiveIntensity: 0.15 }),
            new T.MeshPhysicalMaterial({ color: 0xFF3B30, metalness: 0.3, roughness: 0.2, emissive: 0xFF3B30, emissiveIntensity: 0.15 })
        ];

        for (let i = 0; i < 4; i++) {
            const val = [0.45, 0.3, 0.15, 0.1][i];
            const bar = new T.Mesh(new T.BoxGeometry(0.6, val * 3, 0.6), barMat[i]);
            bar.position.set(-1.5 + i * 1.0, val * 1.5, 0);
            sc.add(bar); sens3D.objects.push(bar);
        }

        sc.add(new T.GridHelper(5, 10, 0x333355, 0x222244));
        sens3D.camera.position.set(3, 2.5, 4);
        sens3D.camera.lookAt(0, 0.5, 0);
        startLoop(sens3D, () => {});
    }

    // ---- 3D History Chart ----
    let hist3D = null;

    async function init3DHistory() {
        const canvas = document.getElementById('history-chart');
        if (!canvas) return;
        hist3D = await ensure3D('history-chart', { fov: 40, camPos: [0, 3, 6] });
        const T = hist3D.THREE, sc = hist3D.scene;
        sc.add(new T.GridHelper(6, 12, 0x333355, 0x222244));
        hist3D.camera.position.set(0, 2.5, 5);
        hist3D.camera.lookAt(0, 0, 0);
        draw3DHistory();
        startLoop(hist3D, () => {});
    }

    function draw3DHistory() {
        if (!hist3D) return;
        const T = hist3D.THREE, sc = hist3D.scene;
        // Remove old lines
        hist3D.objects.forEach(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); sc.remove(o); });
        hist3D.objects = [];

        const data = state.history;
        if (data.length < 2) return;

        const pad = 1.5;
        function makeLine(values, color) {
            const min = Math.min(...values), max = Math.max(...values);
            const range = max - min || 1;
            const pts = values.map((v, i) => new T.Vector3(
                -pad + (i / (values.length - 1)) * pad * 2,
                0.1 + ((v - min) / range) * 2.5,
                0
            ));
            const curve = new T.CatmullRomCurve3(pts);
            const tube = new T.Mesh(
                new T.TubeGeometry(curve, 32, 0.04, 6, false),
                new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 })
            );
            sc.add(tube); hist3D.objects.push(tube);
        }

        const preheatVals = data.map(d => d.preheat);
        const speedVals = data.map(d => d.speed);
        makeLine(preheatVals, 0x00F2FE);
        makeLine(speedVals, 0x00FF87);
    }

    function recordAndDraw3DHistory() {
        recordHistoryPoint();
        draw3DHistory();
    }

    // ---- 3D Tutorial Charts ----
    async function init3DTutorialCharts() {
        const charts = [
            { id: 'tchartVisco', type: 'line', data: genViscoData(), color: 0x00F2FE },
            { id: 'tchartReliab', type: 'bar', data: genReliabData(), color: 0x00FF87 },
            { id: 'tchartVoid', type: 'bar', data: genVoidData(), color: 0xFFB300 },
            { id: 'tchartCure', type: 'line', data: genCureData(), color: 0xFF3B30 }
        ];
        for (const cfg of charts) {
            const canvas = document.getElementById(cfg.id);
            if (!canvas) continue;
            const eng = await ensure3D(cfg.id, { fov: 40, camPos: [2, 3, 5] });
            const T = eng.THREE, sc = eng.scene;
            sc.add(new T.GridHelper(5, 10, 0x333355, 0x222244));

            if (cfg.type === 'bar' && cfg.data) {
                const n = cfg.data.length;
                cfg.data.forEach((v, i) => {
                    const h = (v / Math.max(...cfg.data)) * 2.5;
                    const mat = new T.MeshPhysicalMaterial({
                        color: cfg.color, transparent: true, opacity: 0.8,
                        metalness: 0.1, roughness: 0.3
                    });
                    const bar = new T.Mesh(new T.BoxGeometry(0.4, h || 0.05, 0.4), mat);
                    bar.position.set(-1.5 + (i / (n - 1)) * 3, (h || 0.05) / 2, 0);
                    sc.add(bar); eng.objects.push(bar);
                });
            } else if (cfg.type === 'line' && cfg.data) {
                const min = Math.min(...cfg.data), max = Math.max(...cfg.data);
                const range = max - min || 1;
                const pts = cfg.data.map((v, i) => new T.Vector3(
                    -1.5 + (i / (cfg.data.length - 1)) * 3,
                    0.1 + ((v - min) / range) * 2,
                    0
                ));
                const curve = new T.CatmullRomCurve3(pts);
                const tube = new T.Mesh(
                    new T.TubeGeometry(curve, 32, 0.05, 6, false),
                    new T.MeshBasicMaterial({ color: cfg.color })
                );
                sc.add(tube); eng.objects.push(tube);

                // Dots
                pts.forEach(p => {
                    const dot = new T.Mesh(
                        new T.SphereGeometry(0.08, 8, 8),
                        new T.MeshBasicMaterial({ color: cfg.color })
                    );
                    dot.position.copy(p);
                    sc.add(dot); eng.objects.push(dot);
                });
            }

            eng.camera.position.set(2, 2.5, 4);
            eng.camera.lookAt(0, 0.5, 0);
            startLoop(eng, () => {});
        }
    }

    function genViscoData() {
        const d = [];
        for (let t = 25; t <= 120; t += 5) d.push(1200 * Math.exp(-0.017 * (t - 25)) + 150);
        return d;
    }
    function genReliabData() { return [1200, 850, 600, 400, 200]; }  // cycles
    function genVoidData() { return [5, 12, 8, 15, 3, 10]; }  // area %
    function genCureData() {
        const d = [];
        for (let t = 0; t <= 10; t += 0.5) d.push(180 - 80 * Math.exp(-0.3 * t));
        return d;
    }

    // ======================================================================
    // 25. TUTORIAL INTERACTIVE MODULE
    // ======================================================================
    const TUT = { flowStep: 0 };

    function initTutorial() {
        const tabs = document.querySelectorAll('.tut-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                tutGoPanel(this.dataset.tpanel);
            });
        });
        if (document.getElementById('tpanel-flow')) {
            buildTFlow();
            document.getElementById('tnext')?.addEventListener('click', () => tutGoStep(TUT.flowStep + 1));
            document.getElementById('tprev')?.addEventListener('click', () => tutGoStep(TUT.flowStep - 1));
            document.getElementById('treset')?.addEventListener('click', () => tutGoStep(0));
        }
        // Phys sliders
        ['mu','L','h','theta','gamma','T'].forEach(id => {
            const el = document.getElementById('tphys-' + id);
            const val = document.getElementById('tval-' + id);
            if (el && val) el.addEventListener('input', function() {
                val.textContent = this.value;
                calcTPhys();
            });
        });
        calcTPhys();
        tutSelMethod(0);
        tutShowVoid(0);
        tutSelRole(0, document.querySelector('.trolebtn'));
        // Fit form
        if (document.getElementById('tfit-pkg')) tutEvalFit();
        // Decision tree
        renderTTree();
        // Risk meter (lazy init on tab show)
        setTimeout(() => {
            if (document.getElementById('tpanel-risk')) tutEvalRisk();
        }, 100);
    }

    function tutGoPanel(id) {
        document.querySelectorAll('.tpanel').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.tut-tab').forEach(t => t.classList.remove('active'));
        const panel = document.getElementById('tpanel-' + id);
        const tab = document.querySelector('.tut-tab[data-tpanel="' + id + '"]');
        if (panel) panel.classList.add('active');
        if (tab) tab.classList.add('active');
    }

    // ---- Flow Stepper ----
    const TFLOW_STEPS = [
        { phase: 0, title: '1. IQC 來料檢驗', desc: '核對 UF 材料批號、效期、黏度與外觀。確認 CoA 符合規格，冷藏 2-10°C，FIFO 先進先出。' },
        { phase: 0, title: '2. 回溫 (Thawing)', desc: '針頭朝下直立靜置室溫 2h 以上。禁強制加熱、禁劇烈搖晃。回溫後 4h 內用完，不回凍。' },
        { phase: 0, title: '3. 預烤 (Baking)', desc: 'PCB 與元件 100°C / 1.5h 烘烤驅出水氣。防止氣化型空洞。' },
        { phase: 0, title: '4. 助焊劑檢查', desc: '確認 Flux 殘留量與活性。殘留過多 → 腐蝕/空洞風險。' },
        { phase: 0, title: '5. Staging', desc: '預烤後 4-8h 內完成點膠。超時需重烘烤。' },
        { phase: 1, title: '6. Plasma 清潔', desc: 'Ar/O₂ plasma 30-60s 活化表面，降低接觸角 θ。Fine pitch < 50µm 建議使用。' },
        { phase: 1, title: '7. 預熱 (Preheat)', desc: '基板預熱至 70-100°C，降低膠體黏度提升毛細力。' },
        { phase: 1, title: '8. 點膠 + Dwell', desc: 'L 型路徑為首選。針頭高度 0.10mm，壓力 0.3MPa。充填完成後停留 5-10s 讓 fillet 成形。' },
        { phase: 2, title: '9. 固化 (Cure)', desc: '130°C / 8min 或 150°C / 5min。須確認爐溫 profile 均勻。' },
        { phase: 2, title: '10. 後固化檢查', desc: '目視 fillet 高度 50-75% 元件高。無溢膠、無 fillet 缺損。' },
        { phase: 3, title: '11. X-Ray 檢驗', desc: '確認空洞率 ≤ 25% 總面積。注意空洞型態（散佈/界面/連通）。' },
        { phase: 3, title: '12. CSAM / 截面', desc: '必要時以超音波掃描確認分層與填膠完整率。可靠性驗證。' }
    ];

    function buildTFlow() {
        const phaseBar = document.getElementById('tphasebar');
        const stepper = document.getElementById('tstepper');
        if (!stepper) return;
        phaseBar.innerHTML = '';
        stepper.innerHTML = '';
        const phases = ['準備', '點膠流動', '固化', '驗證'];
        phases.forEach((p, i) => {
            const seg = document.createElement('div');
            seg.className = 'tphaseseg p' + i;
            seg.textContent = p;
            phaseBar.appendChild(seg);
        });
        TFLOW_STEPS.forEach((s, i) => {
            const dot = document.createElement('div');
            dot.className = 'tdot';
            dot.textContent = i + 1;
            dot.addEventListener('click', () => tutGoStep(i));
            stepper.appendChild(dot);
        });
        tutGoStep(0);
    }

    function tutGoStep(n) {
        const steps = TFLOW_STEPS;
        if (n < 0) n = 0;
        if (n >= steps.length) n = steps.length - 1;
        TUT.flowStep = n;
        const dots = document.querySelectorAll('.tdot');
        dots.forEach((d, i) => {
            d.className = 'tdot';
            if (i < n) d.classList.add('done');
            if (i === n) d.classList.add('cur');
        });
        const body = document.getElementById('tstepbody');
        if (body) {
            body.innerHTML = '<h3>' + steps[n].title + '</h3><p>' + steps[n].desc + '</p>';
        }
        // Update phasebar
        const segs = document.querySelectorAll('.tphaseseg');
        segs.forEach((s, i) => s.classList.toggle('on', i === steps[n].phase));
        // Update scene
        tutUpdateScene(n);
    }

    function tutUpdateScene(n) {
        const svg = document.getElementById('tflowSvg');
        if (!svg) return;
        const scenes = ['tscenePkg', 'tsceneIQC', 'tsceneThaw', 'tsceneBake', 'tscenePkg',
                        'tsceneStage', 'tscenePlasma', 'tscenePkg', 'tscenePkg', 'tscenePkg',
                        'tscenePkg', 'tscenePkg'];
        ['tscenePkg','tsceneIQC','tsceneThaw','tsceneBake','tscenePlasma','tsceneStage'].forEach(id => {
            const g = document.getElementById(id);
            if (g) g.setAttribute('opacity', '0');
        });
        const show = document.getElementById(scenes[n] || 'tscenePkg');
        if (show) show.setAttribute('opacity', '1');
        document.getElementById('tscenecap').textContent = '步驟 ' + (n + 1) + '/' + TFLOW_STEPS.length + '：' + TFLOW_STEPS[n].title;
    }

    // ---- Phys Simulator ----
    function calcTPhys() {
        const mu = parseFloat(document.getElementById('tphys-mu')?.value || 348);
        const L = parseFloat(document.getElementById('tphys-L')?.value || 12);
        const h = parseFloat(document.getElementById('tphys-h')?.value || 80);
        const theta = parseFloat(document.getElementById('tphys-theta')?.value || 25);
        const gamma = parseFloat(document.getElementById('tphys-gamma')?.value || 35);
        const T = parseFloat(document.getElementById('tphys-T')?.value || 85);
        const t = (3 * mu * L * L) / (h * gamma * Math.cos(theta * Math.PI / 180));
        const result = document.getElementById('tphysResult');
        if (!result) return;
        const rating = t < 30 ? 'low' : t < 60 ? 'mid' : 'high';
        const labels = { low: '✓ 充填快（' + t.toFixed(1) + 's）', mid: '⚡ 中等（' + t.toFixed(1) + 's）', high: '✗ 充填慢（' + t.toFixed(1) + 's）' };
        result.innerHTML = labels[rating];
        result.className = 'tresult t-' + rating;
    }

    // ---- Method Selector ----
    const TMETHODS = [
        { name: 'CUF (毛細式)', desc: '最成熟、應用最廣。利用毛細力吸入間隙，晶片預先迴焊。需預烤與 plasma，fillet 50-75%。' },
        { name: 'NUF (無流動式)', desc: '預成型膠膜貼附於基板，晶片壓合時同時填膠與固化。適用薄型封裝，無毛細流動問題。' },
        { name: 'WUF (助焊劑式)', desc: '膠體兼具助焊劑功能，迴焊與填膠一次完成。簡化流程但材料選擇受限。' },
        { name: 'MUF (壓縮成型)', desc: '將底部填膠與封膠整合為一體。適用 PoP、大 die。高可靠性但成本較高。' },
        { name: '邊角膠 (Corner Bond)', desc: '僅在晶片角落點膠固定，不填滿間隙。用於降低應力但非 full underfill。' }
    ];

    function tutSelMethod(i) {
        document.querySelectorAll('.tmcard').forEach((c, idx) => c.classList.toggle('sel', idx === i));
        const detail = document.getElementById('tmdetail');
        if (detail && TMETHODS[i]) {
            detail.innerHTML = '<h3>' + TMETHODS[i].name + '</h3><p>' + TMETHODS[i].desc + '</p>';
        }
    }

    // ---- Void Classifier ----
    const TVOIDS = [
        { title: '均勻填充', desc: '膠體均勻分佈於晶片下方，無明顯空洞。fillet 完整，高度 50-75%。為理想狀態。', color: 'var(--color-green)' },
        { title: '散佈型空洞', desc: '多個微小空洞隨機分佈，面積比 < 10%。通常因微量水氣或助焊劑殘留。可接受範圍內。', color: 'var(--color-amber)' },
        { title: '界面型空洞', desc: '空洞位於膠體與晶片/基板界面。因潤濕不良或 plasma 不足。需改善表面活化。', color: 'var(--color-amber)' },
        { title: '環狀連通空洞', desc: '空洞在 bump 陣列周圍形成環狀連通。典型因流前對撞鎖氣或填充路徑不當。須重新設計點膠路徑。', color: '#EF4444' },
        { title: '角落型空洞', desc: '空洞集中於 die 角落。因末端排氣不順或 fillet 成形過快。調整 dwell 時間或預熱。', color: '#EF4444' },
        { title: '充填不足', desc: '大面積未填滿。因黏度過高、standoff 過小或預熱不足。須降黏或提升預熱溫度。', color: '#EF4444' }
    ];

    function tutShowVoid(i) {
        const v = TVOIDS[i];
        const el = document.getElementById('tvresult');
        if (el && v) {
            el.innerHTML = '<h3 style="color:' + v.color + '">' + v.title + '</h3><p>' + v.desc + '</p>';
        }
    }

    // ---- Role Switcher ----
    const TROLES = [
        { title: '👷 作業員 — 操作要點', items: ['材料取用：FIFO 先進先出，批號登錄', '回溫：針頭朝下直立，室溫 2h 以上', '預烤：100°C / 1.5h，使用計時器', '點膠：確認針頭高度 0.10mm，路徑 L 型', '檢驗：目視 fillet 均勻，無溢膠'] },
        { title: '🔧 製程工程師 — 參數設計', items: ['預熱溫度：70-100°C，依膠體 TDS', '點膠壓力：0.1-0.5 MPa，依黏度調整', '固化 Profile：130°C/8min 或 150°C/5min', 'DOE 驗證：黏度 × 溫度 × 壓力', '首件確認：X-Ray + 切片分析'] },
        { title: '📋 品質工程師 — 檢驗標準', items: ['IPC-A-610：空洞 ≤ 25% 面積', 'Fillet 高度：50-75% 元件高', 'CSAM：無分層、無界面空洞', '可靠度：TCT 1000 循環後無裂紋', 'SPC 監控：黏度、fillet、空洞率'] },
        { title: '⚙️ 設備工程師 — 設備維護', items: ['點膠閥校準：每班次確認 offset', '針頭清潔：每 10 片更換/清潔', '烘箱溫度均勻性：±3°C', 'Plasma 功率確認：RF 匹配', 'X-Ray 設備：每日開機 calibration'] }
    ];

    function tutSelRole(i, btn) {
        document.querySelectorAll('.trolebtn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        const r = TROLES[i];
        const el = document.getElementById('trolebody');
        if (el && r) {
            el.innerHTML = '<h3>' + r.title + '</h3><ul>' + r.items.map(item => '<li>' + item + '</li>').join('') + '</ul>';
        }
    }

    // ---- Risk Calculator ----
    function tutEvalRisk() {
        const riskMeter = document.getElementById('triskMeter');
        if (!riskMeter) return;
        const dims = [
            { id: 'tr-die', label: 'Die 尺寸', min: 0, max: 100, val: 60 },
            { id: 'tr-so', label: 'Standoff', min: 0, max: 100, val: 40 },
            { id: 'tr-pitch', label: 'Bump Pitch', min: 0, max: 100, val: 30 },
            { id: 'tr-rel', label: '可靠度要求', min: 0, max: 100, val: 80 },
            { id: 'tr-moist', label: '吸濕風險', min: 0, max: 100, val: 50 },
            { id: 'tr-takt', label: '節拍壓力', min: 0, max: 100, val: 45 }
        ];
        riskMeter.innerHTML = '';
        dims.forEach(d => {
            const item = document.createElement('div');
            item.className = 'trisk-item';
            item.innerHTML = '<label>' + d.label + ' <span id="' + d.id + '-v">' + d.val + '</span></label>' +
                '<input type="range" min="' + d.min + '" max="' + d.max + '" value="' + d.val + '" ' +
                'id="' + d.id + '" class="trange" oninput="tutUpdateRisk()">';
            riskMeter.appendChild(item);
        });
        tutUpdateRisk();
    }

    function tutUpdateRisk() {
        const ids = ['tr-die','tr-so','tr-pitch','tr-rel','tr-moist','tr-takt'];
        let sum = 0;
        ids.forEach(id => {
            const el = document.getElementById(id);
            const v = el ? parseInt(el.value) : 50;
            document.getElementById(id + '-v').textContent = v;
            sum += v;
        });
        const avg = sum / ids.length;
        const needle = document.getElementById('triskNeedle');
        if (needle) needle.style.left = avg + '%';
        const result = document.getElementById('triskResult');
        if (result) {
            if (avg < 35) { result.innerHTML = '✓ 低風險 — 建議導入'; result.className = 'tresult'; result.style.borderColor = 'var(--color-green)'; }
            else if (avg < 65) { result.innerHTML = '⚡ 中風險 — 需評估對策'; result.className = 'tresult'; result.style.borderColor = 'var(--color-amber)'; }
            else { result.innerHTML = '✗ 高風險 — 不建議導入'; result.className = 'tresult'; result.style.borderColor = '#EF4444'; }
        }
        // Update radar
        tutUpdateRadar(ids.map(id => (parseInt(document.getElementById(id)?.value || 50) / 100)));
    }

    function tutUpdateRadar(vals) {
        const poly = document.getElementById('tradarPoly');
        if (!poly) return;
        const cx = 150, cy = 120, r = 80;
        const pts = vals.map((v, i) => {
            const ang = (Math.PI * 2 * i) / vals.length - Math.PI / 2;
            return (cx + Math.cos(ang) * r * v) + ',' + (cy + Math.sin(ang) * r * v);
        }).join(' ');
        poly.setAttribute('points', pts);
    }

    // ---- Fit Evaluator ----
    function tutEvalFit() {
        const pkg = document.getElementById('tfit-pkg')?.value || 'fc';
        const size = document.getElementById('tfit-size')?.value || 'med';
        const so = document.getElementById('tfit-so')?.value || 'med';
        const rel = document.getElementById('tfit-rel')?.value || 'high';
        const pitch = document.getElementById('tfit-pitch')?.value || 'std';
        const cost = document.getElementById('tfit-cost')?.value || 'med';
        let score = 0;
        if (pkg === 'fc' || pkg === 'wlcsp') score += 2;
        if (size === 'large') score += 2; else if (size === 'med') score += 1;
        if (so === 'low') score += 2; else if (so === 'med') score += 1;
        if (rel === 'high') score += 2;
        if (pitch === 'fine') score += 1;
        if (cost === 'low') score += 1;
        const verdict = document.getElementById('tfitVerdict');
        if (!verdict) return;
        if (score >= 7) { verdict.innerHTML = '✅ 強烈建議導入 Underfill'; verdict.className = 'tverdict ok'; }
        else if (score >= 4) { verdict.innerHTML = '⚡ 可導入，建議進一步評估'; verdict.className = 'tverdict maybe'; }
        else { verdict.innerHTML = '✗ 不建議導入 Underfill'; verdict.className = 'tverdict no'; }
    }

    // ---- Decision Tree ----
    const TTREE = {
        q: '封裝類型是否有暴露焊點？（如 Flip Chip / BGA）',
        y: { q: '可靠度要求是否為高標準？（車規/工規）',
            y: { q: '晶片尺寸是否 > 15mm？',
                y: { outcome: '✅ 建議導入 CUF + Plasma 清潔。大 die 須 L 型路徑並控制 fillet。', ok: true },
                n: { outcome: '✅ 建議導入 CUF。中等 die 使用標準 L 路徑即可。', ok: true } },
            n: { q: '使用環境是否為消費級？',
                y: { outcome: '✅ 可導入 CUF 或邊角膠，視成本而定。', ok: true },
                n: { outcome: '⚡ 視具體條件，建議做可靠度驗證後決定。', ok: false } } },
        n: { q: '是否需要機械強度補強？',
            y: { outcome: '⚡ 建議邊角膠或底部填充脂，非 full underfill。', ok: false },
            n: { outcome: '✗ 不建議導入 Underfill。使用一般組裝流程即可。', ok: false } }
    };

    let ttreePath = [];

    function renderTTree(node, container) {
        const treeEl = document.getElementById('ttree');
        if (!treeEl) return;
        if (!node) node = TTREE;
        const pathStr = ttreePath.length ? '路徑：' + ttreePath.join(' → ') : '';
        if (node.q) {
            treeEl.innerHTML = '<div class="tnode">' +
                (pathStr ? '<div class="tpath">' + pathStr + '</div>' : '') +
                '<div class="tq">' + node.q + '</div>' +
                '<div class="topts">' +
                '<button class="tbtn" onclick="tutAnsTree(true,\'是\')">是 (Yes)</button>' +
                '<button class="tbtn tbtn-ghost" onclick="tutAnsTree(false,\'否\')">否 (No)</button>' +
                '</div></div>';
        } else if (node.outcome) {
            treeEl.innerHTML = '<div class="tnode">' +
                (pathStr ? '<div class="tpath">' + pathStr + '</div>' : '') +
                '<div class="toutcome" style="background:' + (node.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)') + ';color:' + (node.ok ? 'var(--color-green)' : '#EF4444') + '">' +
                node.outcome + '</div>' +
                '<button class="tbtn tbtn-ghost" style="margin-top:8px" onclick="tutResetTree()">重新開始</button></div>';
        }
    }

    function tutAnsTree(dir, label) {
        ttreePath.push(label);
        let node = TTREE;
        for (const step of ttreePath) {
            node = step === '是' ? node.y : node.n;
            if (!node) break;
        }
        renderTTree(node);
    }
    function tutResetTree() { ttreePath = []; renderTTree(TTREE); }

    // Expose tutorial functions globally (called from HTML onclick/oninput)
    window.tutGoPanel = tutGoPanel;
    window.tutSelMethod = tutSelMethod;
    window.tutShowVoid = tutShowVoid;
    window.tutSelRole = tutSelRole;
    window.tutEvalFit = tutEvalFit;
    window.tutEvalRisk = tutEvalRisk;
    window.tutUpdateRisk = tutUpdateRisk;
    window.tutAnsTree = tutAnsTree;
    window.tutResetTree = tutResetTree;

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
        (async () => {
            await init3DDispense();
            if (!disp3D) { initSimulator(); } // fallback
        })();
        initBubbles();
        initChecklist();
        initSearch();
        initProfiles();
        (async () => {
            await init3DHistory();
            if (!hist3D) { initHistory(); }
        })();
        initBatch();
        initLangToggle();
        initKeyboard();
        initLog();
        initRouter();
        initTheory();
        (async () => { await init3DCapillary(); })();
        initSimulatorLab();
        (async () => { await init3DHeatmap(); })();
        (async () => { await init3DSensitivity(); })();
        initAcademy();
        initKnowledge();
        (async () => { await init3DTutorialCharts(); })();
        initTutorial();
        registerSW();

        updateDefectDisplay();

        dom.filletSlider.addEventListener('input', e => updateFillet(parseInt(e.target.value)));
        updateFillet(parseInt(dom.filletSlider.value));

        dom.voidingSlider.addEventListener('input', e => updateVoiding(parseInt(e.target.value)));
        updateVoiding(parseInt(dom.voidingSlider.value));

        document.addEventListener('keydown', e => {
            if (e.ctrlKey && e.key === 'e') { e.preventDefault(); exportReport(); }
        });

        // 3D resize handler
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                Object.values(T3D).forEach(eng => {
                    const w = eng.canvas.clientWidth || 400;
                    const h = eng.canvas.clientHeight || 300;
                    eng.renderer.setSize(w, h);
                    eng.camera.aspect = w / h;
                    eng.camera.updateProjectionMatrix();
                });
            }, 200);
        });

        document.dispatchEvent(new Event('contentLoaded'));
    });
})();
