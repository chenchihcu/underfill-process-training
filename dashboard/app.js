/**
 * Underfill Smart Dispensing & Quality Control Dashboard
 * Application Logic & Simulations
 */

document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------------------------
    // 1. System Clock
    // ----------------------------------------------------------------------
    const clockElement = document.getElementById('system-clock');
    function updateClock() {
        const now = new Date();
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        const secs = String(now.getSeconds()).padStart(2, '0');
        clockElement.textContent = `${hrs}:${mins}:${secs}`;
    }
    setInterval(updateClock, 1000);
    updateClock();

    // ----------------------------------------------------------------------
    // 2. Component Selection Matrix & Sliders
    // ----------------------------------------------------------------------
    const componentTypeSelect = document.getElementById('component-type');
    const specDieSize = document.getElementById('spec-die-size');
    const specBallPitch = document.getElementById('spec-ball-pitch');
    const specAction = document.getElementById('spec-action');
    
    // Slider Elements
    const preheatSlider = document.getElementById('preheat-temp');
    const valPreheat = document.getElementById('val-preheat');
    const speedSlider = document.getElementById('line-speed');
    const valSpeed = document.getElementById('val-speed');
    const needleSlider = document.getElementById('needle-height');
    const valNeedle = document.getElementById('val-needle');
    const pressureSlider = document.getElementById('dispense-pressure');
    const valPressure = document.getElementById('val-pressure');

    // Component configurations
    const componentsConfig = {
        bga: {
            dieSize: '> 25mm',
            ballPitch: '0.8mm',
            action: 'Mandatory',
            actionClass: 'status-mandatory',
            preheat: 85,
            speed: 15
        },
        wlcsp: {
            dieSize: '5mm - 12mm',
            ballPitch: '0.4mm',
            action: 'Recommended',
            actionClass: 'status-recommended',
            preheat: 80,
            speed: 20
        },
        flipchip: {
            dieSize: '15mm - 20mm',
            ballPitch: '0.5mm',
            action: 'Core',
            actionClass: 'status-core',
            preheat: 90,
            speed: 12
        },
        qfn: {
            dieSize: '3mm - 8mm',
            ballPitch: '0.6mm',
            action: 'Recommended',
            actionClass: 'status-recommended',
            preheat: 85,
            speed: 18
        }
    };

    function updateComponentSpecs(type) {
        const config = componentsConfig[type];
        if (!config) return;

        specDieSize.textContent = config.dieSize;
        specBallPitch.textContent = config.ballPitch;
        specAction.textContent = config.action;
        
        // Reset classes
        specAction.className = 'spec-val action-tag ' + config.actionClass;
        
        // Update slider values to default preset
        preheatSlider.value = config.preheat;
        valPreheat.textContent = config.preheat;
        
        speedSlider.value = config.speed;
        valSpeed.textContent = config.speed;
    }

    componentTypeSelect.addEventListener('change', (e) => {
        updateComponentSpecs(e.target.value);
    });

    // Sliders event listeners
    preheatSlider.addEventListener('input', (e) => {
        valPreheat.textContent = e.target.value;
    });

    speedSlider.addEventListener('input', (e) => {
        valSpeed.textContent = e.target.value;
    });

    needleSlider.addEventListener('input', (e) => {
        valNeedle.textContent = parseFloat(e.target.value).toFixed(2);
    });

    pressureSlider.addEventListener('input', (e) => {
        valPressure.textContent = parseFloat(e.target.value).toFixed(2);
    });

    // ----------------------------------------------------------------------
    // 3. Canvas Dispensing Simulator
    // ----------------------------------------------------------------------
    const canvas = document.getElementById('dispense-canvas');
    const ctx = canvas.getContext('2d');
    const simStatusText = document.getElementById('sim-status');
    const btnPlay = document.getElementById('btn-play-sim');
    const btnReset = document.getElementById('btn-reset-sim');
    const pathBtns = document.querySelectorAll('.path-tabs .tab-btn');

    let currentPathType = 'L'; // L, I, U
    let simInterval = null;
    let simProgress = 0; // 0 to 1
    let isSimulating = false;

    // Simulation geometries
    const dieX = 125;
    const dieY = 75;
    const dieSize = 200;
    const ballCols = 8;
    const ballRows = 8;

    function drawStaticDie() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Substrate base background grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        const gridSize = 20;
        for (let x = 0; x < canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        // Substrate label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.font = '10px Inter';
        ctx.fillText('SUBSTRATE (FR4)', 15, 25);

        // Outer margin guide
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.strokeRect(dieX - 20, dieY - 20, dieSize + 40, dieSize + 40);

        // 1. Draw Ball Array (Underfill balls)
        const spacing = dieSize / (ballCols + 1);
        ctx.fillStyle = '#44445A';
        for (let i = 1; i <= ballCols; i++) {
            for (let j = 1; j <= ballRows; j++) {
                ctx.beginPath();
                ctx.arc(dieX + i * spacing, dieY + j * spacing, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 2. Draw Die Block (semi-transparent so we can see balls and underfill flow)
        ctx.fillStyle = 'rgba(45, 45, 59, 0.55)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.fillRect(dieX, dieY, dieSize, dieSize);
        ctx.strokeRect(dieX, dieY, dieSize, dieSize);

        // Die core label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '12px Outfit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SILICON DIE', dieX + dieSize / 2, dieY + dieSize / 2);
    }

    // Dynamic fluid and needle path variables
    function getPathCoordinates(type) {
        const offset = 8; // distance between needle and die edge
        switch (type) {
            case 'L':
                return [
                    { x: dieX + dieSize + offset, y: dieY - offset }, // start at top right
                    { x: dieX - offset, y: dieY - offset },          // move to top left
                    { x: dieX - offset, y: dieY + dieSize + offset }  // move down to bottom left
                ];
            case 'I':
                return [
                    { x: dieX - offset, y: dieY - offset },          // start at top left
                    { x: dieX - offset, y: dieY + dieSize + offset }  // move down to bottom left
                ];
            case 'U':
                return [
                    { x: dieX + dieSize + offset, y: dieY - offset }, // start at top right
                    { x: dieX + dieSize + offset, y: dieY + dieSize + offset }, // move down to bottom right
                    { x: dieX - offset, y: dieY + dieSize + offset },          // move left to bottom left
                    { x: dieX - offset, y: dieY - offset }                    // move up to top left
                ];
            default:
                return [];
        }
    }

    // Get position along multi-segment path based on progress (0.0 to 1.0)
    function getPositionOnPath(coords, progress) {
        if (coords.length < 2) return coords[0] || { x: 0, y: 0 };
        if (progress <= 0) return coords[0];
        if (progress >= 1) return coords[coords.length - 1];

        const totalSegments = coords.length - 1;
        const segmentProgressRange = 1 / totalSegments;
        const segmentIndex = Math.floor(progress / segmentProgressRange);
        
        const segmentStart = coords[segmentIndex];
        const segmentEnd = coords[segmentIndex + 1];
        
        const progressInSegment = (progress - (segmentIndex * segmentProgressRange)) / segmentProgressRange;
        
        return {
            x: segmentStart.x + (segmentEnd.x - segmentStart.x) * progressInSegment,
            y: segmentStart.y + (segmentEnd.y - segmentStart.y) * progressInSegment
        };
    }

    function runSimulation() {
        if (isSimulating) return;
        isSimulating = true;
        simStatusText.textContent = 'RUNNING';
        simStatusText.className = 'status-text running';
        btnPlay.disabled = true;

        const coords = getPathCoordinates(currentPathType);
        simProgress = 0;

        // Fetch speed value (lower speed = slower animation)
        const speedVal = parseInt(speedSlider.value);
        const steps = 150 - (speedVal * 3); // Dynamic steps based on speed
        const intervalMs = 30;

        simInterval = setInterval(() => {
            simProgress += 1 / steps;
            if (simProgress >= 1) {
                simProgress = 1;
                clearInterval(simInterval);
                isSimulating = false;
                simStatusText.textContent = 'COMPLETED';
                simStatusText.className = 'status-text completed';
                btnPlay.disabled = false;
            }

            drawSimulationFrame(coords, simProgress);
        }, intervalMs);
    }

    function drawSimulationFrame(coords, progress) {
        // Clear and redraw static die
        drawStaticDie();

        // 1. Draw Cured / Flowing Fluid (Capillary simulation)
        // Underfill creeps from the dispense side inwards
        ctx.fillStyle = 'rgba(0, 242, 254, 0.25)';
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
        ctx.lineWidth = 1;

        if (currentPathType === 'L') {
            // L-shape flow expands from top and left edges towards bottom right
            const flowOffset = progress * 130;
            ctx.beginPath();
            ctx.moveTo(dieX, dieY);
            ctx.lineTo(dieX + dieSize, dieY);
            ctx.lineTo(dieX + dieSize, dieY + flowOffset * 0.4);
            ctx.quadraticCurveTo(dieX + flowOffset, dieY + flowOffset, dieX + flowOffset * 0.4, dieY + dieSize);
            ctx.lineTo(dieX, dieY + dieSize);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else if (currentPathType === 'I') {
            // I-shape flow expands from left edge towards right edge
            const flowOffset = progress * 160;
            ctx.beginPath();
            ctx.moveTo(dieX, dieY);
            ctx.lineTo(dieX + flowOffset, dieY);
            ctx.lineTo(dieX + flowOffset, dieY + dieSize);
            ctx.lineTo(dieX, dieY + dieSize);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else if (currentPathType === 'U') {
            // U-shape flow expands from top, right, bottom edges towards center-left
            const flowOffset = progress * 110;
            ctx.beginPath();
            ctx.moveTo(dieX, dieY);
            ctx.lineTo(dieX + dieSize, dieY);
            ctx.lineTo(dieX + dieSize, dieY + dieSize);
            ctx.lineTo(dieX, dieY + dieSize);
            ctx.lineTo(dieX + flowOffset, dieY + dieSize - flowOffset);
            ctx.lineTo(dieX + dieSize - flowOffset, dieY + dieSize - flowOffset);
            ctx.lineTo(dieX + dieSize - flowOffset, dieY + flowOffset);
            ctx.lineTo(dieX + flowOffset, dieY + flowOffset);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        // 2. Draw dispensed bead (line of glue on substrate)
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.8)';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(coords[0].x, coords[0].y);
        
        const currentPos = getPositionOnPath(coords, progress);
        
        // Trace current segment line
        const totalSegments = coords.length - 1;
        const segmentProgressRange = 1 / totalSegments;
        const currentSegmentIndex = Math.floor(progress / segmentProgressRange);

        for (let i = 1; i <= currentSegmentIndex; i++) {
            if (coords[i]) {
                ctx.lineTo(coords[i].x, coords[i].y);
            }
        }
        ctx.lineTo(currentPos.x, currentPos.y);
        ctx.stroke();

        // 3. Draw dispensing needle glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00F2FE';
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(currentPos.x, currentPos.y, 6, 0, Math.PI * 2);
        ctx.fill();

        // Inner needle core nozzle
        ctx.shadowBlur = 0; // reset glow
        ctx.fillStyle = '#08080C';
        ctx.beginPath();
        ctx.arc(currentPos.x, currentPos.y, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    function initSimulator() {
        clearInterval(simInterval);
        isSimulating = false;
        simProgress = 0;
        simStatusText.textContent = 'STANDBY';
        simStatusText.className = 'status-text';
        btnPlay.disabled = false;
        drawStaticDie();
    }

    // Bind tab clicks
    pathBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (isSimulating) return; // Prevent changing path mid-sim
            pathBtns.forEach(b => b.classList.remove('active'));
            const targetBtn = e.currentTarget;
            targetBtn.classList.add('active');
            currentPathType = targetBtn.dataset.path;
            initSimulator();
        });
    });

    btnPlay.addEventListener('click', runSimulation);
    btnReset.addEventListener('click', initSimulator);

    // Initial setup
    initSimulator();

    // ----------------------------------------------------------------------
    // 4. Fillet Height Inspector
    // ----------------------------------------------------------------------
    const filletSlider = document.getElementById('fillet-height');
    const valFillet = document.getElementById('val-fillet');
    const filletBadge = document.getElementById('fillet-badge');
    const dynamicFilletSlope = document.getElementById('dynamic-fillet-slope');

    function updateFilletDisplay(value) {
        valFillet.textContent = value;
        
        // Standard range 50% - 75%
        if (value >= 50 && value <= 75) {
            filletBadge.textContent = 'PASS';
            filletBadge.className = 'quality-badge status-pass';
            dynamicFilletSlope.className = 'fillet-slope dynamic pass';
        } else {
            filletBadge.textContent = 'REJECT';
            filletBadge.className = 'quality-badge status-reject';
            dynamicFilletSlope.className = 'fillet-slope dynamic failed';
        }

        // Adjust visually the width and height of the dynamic fillet slope based on ratio
        // Scale 0.1 to 1.5
        const scaleVal = Math.max(0.1, value / 65);
        dynamicFilletSlope.style.transform = `scale(${scaleVal})`;
    }

    filletSlider.addEventListener('input', (e) => {
        updateFilletDisplay(parseInt(e.target.value));
    });

    // Initial run
    updateFilletDisplay(parseInt(filletSlider.value));

    // ----------------------------------------------------------------------
    // 5. X-Ray Voiding Analyzer
    // ----------------------------------------------------------------------
    const voidingSlider = document.getElementById('voiding-ratio');
    const valVoiding = document.getElementById('val-voiding');
    const xrayBadge = document.getElementById('xray-badge');
    const bubbleContainer = document.getElementById('bubble-container');

    // Create 6 random bubbles with fixed base styles but adjustable sizes
    const bubbles = [
        { top: '25%', left: '20%', baseSize: 22 },
        { top: '15%', left: '65%', baseSize: 14 },
        { top: '65%', left: '30%', baseSize: 28 },
        { top: '50%', left: '70%', baseSize: 16 },
        { top: '75%', left: '60%', baseSize: 12 },
        { top: '35%', left: '45%', baseSize: 18 }
    ];

    function initXrayBubbles() {
        bubbleContainer.innerHTML = '';
        bubbles.forEach((b, idx) => {
            const bubbleEl = document.createElement('div');
            bubbleEl.className = 'xray-bubble';
            bubbleEl.id = `bubble-${idx}`;
            bubbleEl.style.position = 'absolute';
            bubbleEl.style.top = b.top;
            bubbleEl.style.left = b.left;
            bubbleContainer.appendChild(bubbleEl);
        });
    }

    function updateVoidingDisplay(value) {
        valVoiding.textContent = value;
        
        const isPass = value <= 25;
        if (isPass) {
            xrayBadge.textContent = 'PASS';
            xrayBadge.className = 'quality-badge status-pass';
        } else {
            xrayBadge.textContent = 'REJECT';
            xrayBadge.className = 'quality-badge status-reject';
        }

        // Update each bubble's style and size dynamically
        // At 0%, bubbles should shrink to near invisibility
        // At 50%, bubbles should grow to maximum
        bubbles.forEach((b, idx) => {
            const bubbleEl = document.getElementById(`bubble-${idx}`);
            if (bubbleEl) {
                const multiplier = value / 12; // Base ratio is 12%
                const size = Math.round(b.baseSize * multiplier);
                
                bubbleEl.style.width = `${size}px`;
                bubbleEl.style.height = `${size}px`;
                bubbleEl.style.marginTop = `${-size/2}px`;
                bubbleEl.style.marginLeft = `${-size/2}px`;

                if (!isPass) {
                    bubbleEl.classList.add('failed');
                } else {
                    bubbleEl.classList.remove('failed');
                }
            }
        });
    }

    voidingSlider.addEventListener('input', (e) => {
        updateVoidingDisplay(parseInt(e.target.value));
    });

    // Initial run
    initXrayBubbles();
    updateVoidingDisplay(parseInt(voidingSlider.value));

    // ----------------------------------------------------------------------
    // 6. Daily Checklist & Progress Calculation
    // ----------------------------------------------------------------------
    const checklistItems = document.querySelectorAll('.chk-item');
    const headerProgressBar = document.getElementById('header-progress-bar');
    const headerProgressText = document.getElementById('header-progress-text');

    function calculateProgress() {
        const total = checklistItems.length;
        let checkedCount = 0;
        
        checklistItems.forEach(item => {
            if (item.checked) {
                checkedCount++;
            }
        });

        const percent = Math.round((checkedCount / total) * 100);
        headerProgressBar.style.width = `${percent}%`;
        headerProgressText.textContent = `${checkedCount}/${total}`;
    }

    checklistItems.forEach(item => {
        item.addEventListener('change', calculateProgress);
    });

    // Initial run
    calculateProgress();

    // ----------------------------------------------------------------------
    // 7. Troubleshooting TS-Log Finder (5-8 Common Issues)
    // ----------------------------------------------------------------------
    const searchInput = document.getElementById('ts-search-input');
    const btnSearch = document.getElementById('btn-ts-search');
    const resultsContainer = document.getElementById('ts-results');

    const tsDatabase = [
        {
            keywords: ['incomplete', 'penetration', 'underfill', 'capillary', '滲透', '不全'],
            symptom: 'Capillary Action: Incomplete penetration underneath Silicon Die',
            action: 'Board preheat temperature may be too low or glue viscosity increased. Verify preheat is set to 85°C. Check UF 3808 Life (Must be < 24h).'
        },
        {
            keywords: ['voiding', 'bubble', 'air', 'void', '空洞', '氣泡'],
            symptom: 'X-Ray Voiding Alert: Excessive air bubbles / voids detected (> 25%)',
            action: 'Moisture trapped on substrate. Bake substrate prior to dispensing to evaporate water content. Adjust needle height to 0.1mm to prevent air entrainment.'
        },
        {
            keywords: ['fillet too low', 'starved', 'low', '高度不足', '缺膠'],
            symptom: 'Fillet Inspector Reject: Fillet height ratio is < 50% (Starved Fillet)',
            action: 'Dispensed glue volume is insufficient. Action: Increase dispensing pressure (optimal 0.3 MPa) or decrease line speed (optimal 15 mm/s).'
        },
        {
            keywords: ['fillet overflow', 'excessive', 'high', '溢膠', '過多'],
            symptom: 'Fillet Inspector Reject: Fillet height ratio is > 75% (Overflow Fillet)',
            action: 'Too much glue dispensed. Action: Decrease dispensing pressure or increase line speed. Verify needle height is at 0.1mm.'
        },
        {
            keywords: ['clogging', 'nozzle', 'clog', '堵塞', '堵針'],
            symptom: 'Needle Clogging: Fluid curing/stalling inside dispenser tip',
            action: 'Clean nozzle immediately using solvent. Verify needle offset. Check heater temperature; ensure nozzle is not exposed to stray heat above 40°C.'
        },
        {
            keywords: ['tailing', 'stringing', 'viscosity', '拉絲', '拉尾'],
            symptom: 'Stringing & Tailings: High viscosity causing glue strings on exit',
            action: 'Ensure UF 3808 has fully defrosted at room temperature for at least 2 hours. Do not attempt to heat syringe directly.'
        },
        {
            keywords: ['delamination', 'peeling', 'adhesion', '分層', '剝離'],
            symptom: 'Package Integrity: Underfill delamination after thermal cycling',
            action: 'Contaminated substrate surface. Implement Plasma Cleaning prior to dispensing. Verify cure profile matches 130°C for 8 minutes or 150°C for 5 minutes.'
        }
    ];

    function performSearch() {
        const query = searchInput.value.trim().toLowerCase();
        if (!query) {
            // Show empty state
            resultsContainer.innerHTML = `
                <div class="ts-empty-state">
                    <span class="material-icons-round">info</span>
                    <span>Type a symptom to fetch troubleshooting solutions.</span>
                </div>
            `;
            return;
        }

        // Filter database
        const matches = tsDatabase.filter(item => {
            return item.keywords.some(kw => query.includes(kw) || kw.includes(query)) ||
                   item.symptom.toLowerCase().includes(query) ||
                   item.action.toLowerCase().includes(query);
        });

        if (matches.length > 0) {
            resultsContainer.innerHTML = '';
            matches.forEach(match => {
                const matchEl = document.createElement('div');
                matchEl.className = 'ts-result-item';
                matchEl.innerHTML = `
                    <div class="ts-symptom">Symptom: ${match.symptom}</div>
                    <div class="ts-action"><strong>Recommended Action:</strong> ${match.action}</div>
                `;
                resultsContainer.appendChild(matchEl);
            });
        } else {
            resultsContainer.innerHTML = `
                <div class="ts-empty-state">
                    <span class="material-icons-round">warning</span>
                    <span>No troubleshooting logs found for "${searchInput.value}". Try "voiding", "incomplete", or "clog".</span>
                </div>
            `;
        }
    }

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    btnSearch.addEventListener('click', performSearch);
    
    // Quick search trigger when users search empty it resets
    searchInput.addEventListener('input', (e) => {
        if (!e.target.value.trim()) {
            performSearch();
        }
    });
});
