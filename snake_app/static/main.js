/**
 * Snake AI — Main Frontend
 * Dual-game race mode, Web Audio sounds, particle effects, rAF game loop
 */

// ─── CONSTANTS ──────────────────────────────────────────────────────────────
const GRID_SIZE  = 10;
const CELL_SIZE  = 38;
const CANVAS_SIZE = GRID_SIZE * CELL_SIZE;
const SPEED_MAP  = [null, 500, 350, 250, 180, 130, 90, 60, 35, 20, 10];

// ─── SETTINGS ───────────────────────────────────────────────────────────────
const settings = {
    sound:     localStorage.getItem('snd')  !== '0',
    particles: localStorage.getItem('ptcl') !== '0',
    fps:       localStorage.getItem('fps')  === '1',
    eyes:      localStorage.getItem('eyes') !== '0',
    muted:     localStorage.getItem('mute') === '1',
};

// ─── SOUND MANAGER ──────────────────────────────────────────────────────────
class SoundManager {
    constructor() {
        this.ctx = null;
        this._init();
    }
    _init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch(e) { /* no audio */ }
    }
    _resume() {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }
    _tone(freq, type, vol, start, dur, endFreq) {
        if (!this.ctx || settings.muted || !settings.sound) return;
        this._resume();
        const osc  = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + start);
        if (endFreq) osc.frequency.linearRampToValueAtTime(endFreq, this.ctx.currentTime + start + dur);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + start + dur);
        osc.start(this.ctx.currentTime + start);
        osc.stop(this.ctx.currentTime + start + dur + 0.01);
    }
    eat()     { this._tone(520,'sine',0.12,0,0.06,760); this._tone(760,'sine',0.08,0.05,0.08); }
    start()   { this._tone(440,'sine',0.1,0,0.1); this._tone(550,'sine',0.1,0.1,0.1); this._tone(660,'sine',0.12,0.2,0.15); }
    gameOver(){ this._tone(300,'sawtooth',0.06,0,0.15,200); this._tone(200,'sawtooth',0.05,0.14,0.2,130); }
    click()   { this._tone(600,'sine',0.05,0,0.04); }
    countdown(){ this._tone(880,'sine',0.1,0,0.1); }
    go()      { this._tone(660,'sine',0.12,0,0.05); this._tone(880,'sine',0.12,0.06,0.1); this._tone(1100,'sine',0.14,0.16,0.2); }
    winner()  {
        [0,0.12,0.22,0.32,0.42].forEach((t,i) => {
            const notes = [523,659,784,880,1047];
            this._tone(notes[i],'sine',0.12,t,0.18);
        });
    }
}

const sound = new SoundManager();

// ─── PARTICLE SYSTEM ─────────────────────────────────────────────────────────
class ParticleSystem {
    constructor() {
        this.pools = { single: [], astar: [], rl: [] };
        this.COLORS = ['#C9E4DE','#C6DEF1','#DBCDF0','#F2C6DE','#FAEDCB','#F7D9C4'];
    }
    _get(canvasKey) {
        return this.pools[canvasKey] || (this.pools[canvasKey] = []);
    }
    spawn(canvasKey, cx, cy, count) {
        if (!settings.particles) return;
        const pool = this._get(canvasKey);
        for (let i = 0; i < (count || 6); i++) {
            const angle = (Math.random() * Math.PI * 2);
            const speed = 1.5 + Math.random() * 2.5;
            pool.push({
                x: cx, y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1.5,
                r: 3 + Math.random() * 3,
                alpha: 1,
                color: this.COLORS[Math.floor(Math.random() * this.COLORS.length)],
                life: 1
            });
        }
    }
    update(canvasKey) {
        const pool = this._get(canvasKey);
        for (let i = pool.length - 1; i >= 0; i--) {
            const p = pool[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.12;
            p.life -= 0.03;
            p.alpha = p.life;
            if (p.life <= 0) pool.splice(i, 1);
        }
    }
    draw(canvasKey, ctx) {
        const pool = this._get(canvasKey);
        pool.forEach(p => {
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }
    hasParticles(canvasKey) { return this._get(canvasKey).length > 0; }
}

const particles = new ParticleSystem();

// ─── CONFETTI ────────────────────────────────────────────────────────────────
class Confetti {
    constructor() {
        this.canvas  = document.getElementById('confettiCanvas');
        this.ctx     = this.canvas.getContext('2d');
        this.pieces  = [];
        this.running = false;
        this.COLORS  = ['#C9E4DE','#C6DEF1','#DBCDF0','#F2C6DE','#FAEDCB','#F7D9C4',
                         '#5aaa92','#5a96c9','#8c6bbf','#c96b9a','#c9a84c'];
    }
    burst() {
        this.canvas.style.display = 'block';
        this.canvas.width  = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.pieces = [];
        for (let i = 0; i < 120; i++) {
            this.pieces.push({
                x: Math.random() * this.canvas.width,
                y: -10 - Math.random() * 100,
                vx: (Math.random() - 0.5) * 4,
                vy: 2 + Math.random() * 4,
                r: 4 + Math.random() * 6,
                color: this.COLORS[Math.floor(Math.random() * this.COLORS.length)],
                rot: Math.random() * Math.PI * 2,
                rotV: (Math.random() - 0.5) * 0.2,
                shape: Math.random() > 0.5 ? 'rect' : 'circle'
            });
        }
        this.running = true;
        this._loop();
        setTimeout(() => { this.running = false; this.canvas.style.display = 'none'; }, 3500);
    }
    _loop() {
        if (!this.running) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.pieces.forEach(p => {
            p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.rot += p.rotV;
            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(p.rot);
            this.ctx.fillStyle = p.color;
            if (p.shape === 'circle') {
                this.ctx.beginPath(); this.ctx.arc(0,0,p.r,0,Math.PI*2); this.ctx.fill();
            } else {
                this.ctx.fillRect(-p.r/2, -p.r/4, p.r, p.r/2);
            }
            this.ctx.restore();
        });
        requestAnimationFrame(() => this._loop());
    }
}

const confetti = new Confetti();

// ─── CANVAS RENDERER ─────────────────────────────────────────────────────────
class GameRenderer {
    constructor(canvasId, theme, particleKey) {
        this.canvas     = document.getElementById(canvasId);
        this.ctx        = this.canvas.getContext('2d');
        this.theme      = theme; // 'astar' | 'rl'
        this.pKey       = particleKey;
        this.foodAnim   = 0;   // food pulse phase
        this.eatAnim    = 0;   // head eat squash (0..1)
        this.animTime   = 0;
        this._prevFood  = null;
        this._prevScore = 0;
    }

    get colors() {
        if (this.theme === 'rl') return {
            head:      '#5a96c9', headBorder: '#3d76a9',
            body:      'rgba(198,222,241,', bodyBorder: 'rgba(90,150,201,',
            food: '#DBCDF0', foodBorder: '#c8b0e0',
            grid: '#E6E1D9', bg: '#F7F4EF'
        };
        return { // astar / default
            head:      '#5aaa92', headBorder: '#3d8a72',
            body:      'rgba(201,228,222,', bodyBorder: 'rgba(90,170,146,',
            food: '#F2C6DE', foodBorder: '#e0a8c8',
            grid: '#E6E1D9', bg: '#F7F4EF'
        };
    }

    render(state, dt) {
        if (!state) return;
        this.animTime += dt || 16;
        this.foodAnim  = Math.sin(this.animTime * 0.003) * 0.5 + 0.5;

        // Detect food eaten
        const food = state.food;
        if (this._prevFood && (food[0] !== this._prevFood[0] || food[1] !== this._prevFood[1])) {
            // food was eaten → spawn particles at old food pos
            const fx = this._prevFood[0] * CELL_SIZE + CELL_SIZE / 2;
            const fy = this._prevFood[1] * CELL_SIZE + CELL_SIZE / 2;
            particles.spawn(this.pKey, fx, fy, 8);
            this.eatAnim = 1;
            sound.eat();
        }
        this._prevFood = [...food];
        if (this.eatAnim > 0) this.eatAnim = Math.max(0, this.eatAnim - 0.08);

        const c = this.ctx;
        const col = this.colors;

        // Background
        c.fillStyle = col.bg;
        c.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        // Grid
        c.strokeStyle = col.grid;
        c.lineWidth = 0.5;
        for (let i = 0; i <= GRID_SIZE; i++) {
            c.beginPath(); c.moveTo(i * CELL_SIZE, 0); c.lineTo(i * CELL_SIZE, CANVAS_SIZE); c.stroke();
            c.beginPath(); c.moveTo(0, i * CELL_SIZE); c.lineTo(CANVAS_SIZE, i * CELL_SIZE); c.stroke();
        }

        // Particles under snake
        particles.update(this.pKey);
        particles.draw(this.pKey, c);

        // Food
        const fxc = food[0] * CELL_SIZE + CELL_SIZE / 2;
        const fyc = food[1] * CELL_SIZE + CELL_SIZE / 2;
        const fScale = 1 + this.foodAnim * 0.08;
        const fR = (CELL_SIZE / 2 - 4) * fScale;

        // Glow
        const grd = c.createRadialGradient(fxc, fyc, 0, fxc, fyc, fR * 2.2);
        grd.addColorStop(0, col.food + 'cc');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = grd;
        c.beginPath(); c.arc(fxc, fyc, fR * 2.2, 0, Math.PI * 2); c.fill();

        c.fillStyle = col.food;
        c.strokeStyle = col.foodBorder;
        c.lineWidth = 1.5;
        c.beginPath(); c.arc(fxc, fyc, fR, 0, Math.PI * 2); c.fill(); c.stroke();

        // Snake
        const { snake } = state;
        const dir = this._getDir(snake);

        snake.forEach((seg, i) => {
            const x = seg[0] * CELL_SIZE + 2;
            const y = seg[1] * CELL_SIZE + 2;
            let w = CELL_SIZE - 4;
            const t = i / Math.max(1, snake.length - 1);

            if (i === 0) {
                // Head with squash on eat
                const s = i === 0 && this.eatAnim > 0
                    ? 1 + this.eatAnim * 0.25
                    : 1;
                c.save();
                c.translate(x + w/2, y + w/2);
                c.scale(s, 1/s);
                c.translate(-(x + w/2), -(y + w/2));
                c.fillStyle = col.head;
                c.strokeStyle = col.headBorder;
                c.lineWidth = 1.5;
                roundRect(c, x, y, w, w, 6);
                c.fill(); c.stroke();

                // Eyes
                if (settings.eyes) this._drawEyes(c, seg, dir, w);
                c.restore();
            } else {
                const alpha = Math.max(0.35, 1 - t * 0.6);
                c.fillStyle = col.body + (alpha + 0.2) + ')';
                c.strokeStyle = col.bodyBorder + (alpha * 0.5) + ')';
                c.lineWidth = 1;
                roundRect(c, x, y, w, w, 3);
                c.fill(); c.stroke();
            }
        });
    }

    _getDir(snake) {
        if (snake.length < 2) return [1, 0];
        return [snake[0][0] - snake[1][0], snake[0][1] - snake[1][1]];
    }

    _drawEyes(c, seg, dir, w) {
        const hx = seg[0] * CELL_SIZE + 2;
        const hy = seg[1] * CELL_SIZE + 2;
        const cx = hx + w/2, cy = hy + w/2;

        // Compute eye offsets based on direction
        const perp = [-dir[1], dir[0]];
        const eyeR = 2.5;
        const offset = 5;
        const fwdOff = 3;

        const e1x = cx + dir[0] * fwdOff + perp[0] * offset;
        const e1y = cy + dir[1] * fwdOff + perp[1] * offset;
        const e2x = cx + dir[0] * fwdOff - perp[0] * offset;
        const e2y = cy + dir[1] * fwdOff - perp[1] * offset;

        [e1x, e2x].forEach((ex, i) => {
            const ey = i === 0 ? e1y : e2y;
            c.fillStyle = '#fff';
            c.beginPath(); c.arc(ex, ey, eyeR, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#2F2B28';
            c.beginPath(); c.arc(ex + dir[0] * 0.8, ey + dir[1] * 0.8, eyeR * 0.55, 0, Math.PI * 2); c.fill();
        });
    }
}

function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r);
    c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r);
    c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r);
    c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r);
    c.closePath();
}

// ─── SINGLE GAME STATE ────────────────────────────────────────────────────────
let gameState   = null;
let isRunning   = false;
let rafId       = null;
let lastStep    = 0;
let lastRender  = 0;
let startTime   = null;
let elapsed     = 0;
let scoreHistory = [];
let rewardHistory = [];
let bestScore    = 0;

const renderer = new GameRenderer('gameCanvas', 'astar', 'single');

// ─── RACE STATE ───────────────────────────────────────────────────────────────
let raceMode     = false;
let raceRunning  = false;
let raceRafId    = null;
let raceLastStep = { astar: 0, rl: 0 };
let raceStates   = { astar: null, rl: null };
let raceOver     = { astar: false, rl: false };
let raceScoreHistory = { astar: [], rl: [] };
let raceRecord   = { astar: 0, rl: 0 };
let raceLastRender = 0;

const astarRenderer = new GameRenderer('astarCanvas', 'astar', 'astar');
const rlRenderer    = new GameRenderer('rlCanvas',    'rl',    'rl');

// ─── FPS ─────────────────────────────────────────────────────────────────────
let fpsFrames = 0, fpsLast = 0, fpsVal = 0;
const fpsEl = document.getElementById('fpsCounter');

function tickFPS(now) {
    fpsFrames++;
    if (now - fpsLast > 1000) {
        fpsVal   = fpsFrames;
        fpsFrames = 0;
        fpsLast  = now;
        if (settings.fps) fpsEl.textContent = fpsVal + ' FPS';
    }
}

// ─── DOM REFS ─────────────────────────────────────────────────────────────────
const algorithmSelect = document.getElementById('algorithm');
const resetBtn        = document.getElementById('resetBtn');
const stepBtn         = document.getElementById('stepBtn');
const runBtn          = document.getElementById('runBtn');
const stopBtn         = document.getElementById('stopBtn');
const speedSlider     = document.getElementById('speedSlider');
const speedLabel      = document.getElementById('speedLabel');
const trainBtn        = document.getElementById('trainBtn');
const compareBtn      = document.getElementById('compareBtn');
const compareDetailedBtn = document.getElementById('compareDetailedBtn');
const scoreEl      = document.getElementById('score');
const stepsEl      = document.getElementById('steps');
const timeEl       = document.getElementById('time');
const efficiencyEl = document.getElementById('efficiency');
const gameStatusEl = document.getElementById('gameStatus');
const algoTagEl    = document.getElementById('algoTag');
const algoInfoEl   = document.getElementById('algoInfo');
const overlayMsg   = document.getElementById('overlayMsg');
const overlayText  = document.getElementById('overlayText');
const bestEl       = document.getElementById('bestScore');
const bestValEl    = document.getElementById('bestScoreVal');

const avgDecisionEl       = document.getElementById('avgDecision');
const astarDecisionTimeEl = document.getElementById('astarDecisionTime');
const rlDecisionTimeEl    = document.getElementById('rlDecisionTime');
const winnerModalEl       = document.getElementById('winnerModal');
const winnerModalBadgeEl  = document.getElementById('winnerModalBadge');
const winnerModalAlgoEl   = document.getElementById('winnerModalAlgo');
const winnerModalScoresEl = document.getElementById('winnerModalScores');

const raceModeToggle  = document.getElementById('raceModeToggle');
const singleControls  = document.getElementById('singleControls');
const raceControls    = document.getElementById('raceControls');
const singleArea      = document.getElementById('singleArea');
const raceArea        = document.getElementById('raceArea');
const raceResetBtn    = document.getElementById('raceResetBtn');
const raceStartBtn    = document.getElementById('raceStartBtn');
const raceStopBtn     = document.getElementById('raceStopBtn');
const raceSpeedSlider = document.getElementById('raceSpeedSlider');
const raceSpeedLabel  = document.getElementById('raceSpeedLabel');
const raceRecordEl    = document.getElementById('raceRecord');
const astarScoreEl    = document.getElementById('astarScore');
const rlScoreEl       = document.getElementById('rlScore');
const astarStepsEl    = document.getElementById('astarSteps');
const rlStepsEl       = document.getElementById('rlSteps');
const astarStatusEl   = document.getElementById('astarStatus');
const rlStatusEl      = document.getElementById('rlStatus');
const liveDiffEl      = document.getElementById('liveDiff');
const diffValEl       = document.getElementById('diffVal');
const raceBannerEl    = document.getElementById('raceBanner');
const astarBoardEl    = document.getElementById('astarBoard');
const rlBoardEl       = document.getElementById('rlBoard');
const astarOverlayEl  = document.getElementById('astarOverlay');
const rlOverlayEl     = document.getElementById('rlOverlay');
const astarOverlayText = document.getElementById('astarOverlayText');
const rlOverlayText   = document.getElementById('rlOverlayText');

// ─── DECISION TIME TRACKING ───────────────────────────────────────────────────
let decisionTimes = [];

function updateDecisionTime(ms) {
    if (!avgDecisionEl) return;
    decisionTimes.push(ms);
    if (decisionTimes.length > 50) decisionTimes.shift();
    const avg = decisionTimes.reduce((a, b) => a + b, 0) / decisionTimes.length;
    avgDecisionEl.textContent = avg.toFixed(2) + 'ms';
}

const ALGO_INFO = {
    astar: {
        title: 'A* PATHFINDING',
        body: 'Finds optimal path to food using Manhattan heuristic. Enhanced with flood-fill survival check to avoid self-trapping.',
        tags: ['Optimal', 'No Training', 'Flood-Fill Safety']
    },
    rl: {
        title: 'Q-LEARNING RL',
        body: 'Learns through trial and error using 11-feature binary state. Epsilon-greedy exploration with proper decay schedule.',
        tags: ['Learns from Experience', 'Trained Policy', 'Fast Inference']
    }
};

// ─── INIT ─────────────────────────────────────────────────────────────────────
function init() {
    applySettings();
    setupEventListeners();
    handleReset();
    loadHistoryFromDB();
    startRenderLoop();
    initRewardChart();
}

function applySettings() {
    document.getElementById('settingSound').checked     = settings.sound;
    document.getElementById('settingParticles').checked = settings.particles;
    document.getElementById('settingFPS').checked       = settings.fps;
    document.getElementById('settingEyes').checked      = settings.eyes;
    document.getElementById('muteBtn').classList.toggle('muted', settings.muted);
    if (settings.fps) fpsEl.style.display = 'block';
}

function setupEventListeners() {
    resetBtn.addEventListener('click', () => { sound.click(); handleReset(); });
    stepBtn.addEventListener('click',  () => { sound.click(); handleStep(); });
    runBtn.addEventListener('click',   () => { sound.click(); handleRun(); });
    stopBtn.addEventListener('click',  () => { sound.click(); handleStop(); });
    trainBtn.addEventListener('click', () => { sound.click(); trainRL(); });
    document.getElementById('resetQBtn')?.addEventListener('click', () => {
        sound.click();
        if (!confirm('Wipe the Q-table and start fresh?')) return;
        fetch('/api/reset_qtable', { method: 'POST' })
            .then(() => {
                rewardHistory = [];
                rewardChart.load([], [], [], 2000);
                setStatus(gameStatusEl, '● Q-TABLE RESET', 'ready');
            });
    });
    compareBtn.addEventListener('click', () => { sound.click(); runComparison(10); });
    compareDetailedBtn.addEventListener('click', () => { sound.click(); runComparison(50); });

    speedSlider.addEventListener('input', () => {
        speedLabel.textContent = speedSlider.value + '×';
    });

    algorithmSelect.addEventListener('change', () => {
        updateAlgoInfo();
        if (!isRunning) handleReset();
    });

    // Mode toggle
    raceModeToggle.addEventListener('change', () => {
        raceMode = raceModeToggle.checked;
        singleControls.style.display = raceMode ? 'none' : '';
        raceControls.style.display   = raceMode ? '' : 'none';
        singleArea.style.display     = raceMode ? 'none' : '';
        raceArea.style.display       = raceMode ? '' : 'none';
        if (raceMode) initRace();
    });

    // Race controls
    document.getElementById('closeWinnerModal')?.addEventListener('click', () => {
        if (winnerModalEl) winnerModalEl.style.display = 'none';
    });
    raceResetBtn.addEventListener('click', () => { sound.click(); initRace(); });
    raceStartBtn.addEventListener('click', () => { sound.click(); startRaceWithCountdown(); });
    raceStopBtn.addEventListener('click',  () => { sound.click(); stopRace(); });
    raceSpeedSlider.addEventListener('input', () => {
        raceSpeedLabel.textContent = raceSpeedSlider.value + '×';
    });

    // Mute
    document.getElementById('muteBtn').addEventListener('click', () => {
        settings.muted = !settings.muted;
        localStorage.setItem('mute', settings.muted ? '1' : '0');
        document.getElementById('muteBtn').classList.toggle('muted', settings.muted);
        sound.click();
    });

    // Settings panel
    document.getElementById('settingsBtn').addEventListener('click', () => {
        sound.click();
        const p = document.getElementById('settingsPanel');
        p.style.display = p.style.display === 'none' ? 'block' : 'none';
    });
    document.getElementById('closeSettings').addEventListener('click', () => {
        document.getElementById('settingsPanel').style.display = 'none';
    });

    document.getElementById('settingSound').addEventListener('change', e => {
        settings.sound = e.target.checked;
        localStorage.setItem('snd', settings.sound ? '1' : '0');
    });
    document.getElementById('settingParticles').addEventListener('change', e => {
        settings.particles = e.target.checked;
        localStorage.setItem('ptcl', settings.particles ? '1' : '0');
    });
    document.getElementById('settingFPS').addEventListener('change', e => {
        settings.fps = e.target.checked;
        localStorage.setItem('fps', settings.fps ? '1' : '0');
        fpsEl.style.display = settings.fps ? 'block' : 'none';
    });
    document.getElementById('settingEyes').addEventListener('change', e => {
        settings.eyes = e.target.checked;
        localStorage.setItem('eyes', settings.eyes ? '1' : '0');
    });

    // Keyboard
    document.addEventListener('keydown', e => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        switch (e.key) {
            case ' ': e.preventDefault();
                if (!raceMode) { isRunning ? handleStop() : handleRun(); }
                break;
            case 'r': case 'R':
                if (!raceMode) handleReset(); else initRace(); break;
            case 's': case 'S':
                if (!raceMode) handleStep(); break;
            case 'm': case 'M':
                document.getElementById('muteBtn').click(); break;
            case '1':
                if (raceMode) { raceModeToggle.checked = false; raceModeToggle.dispatchEvent(new Event('change')); } break;
            case '2':
                if (!raceMode) { raceModeToggle.checked = true; raceModeToggle.dispatchEvent(new Event('change')); } break;
        }
    });
}

// ─── RENDER LOOP ──────────────────────────────────────────────────────────────
function startRenderLoop() {
    function loop(now) {
        rafId = requestAnimationFrame(loop);
        tickFPS(now);
        const dt = now - lastRender;
        lastRender = now;

        if (!raceMode) {
            // Single mode: render always for particle/food animation
            if (gameState) renderer.render(gameState, dt);
        } else {
            // Race mode
            if (raceStates.astar) astarRenderer.render(raceStates.astar, dt);
            if (raceStates.rl)    rlRenderer.render(raceStates.rl, dt);
        }
    }
    rafId = requestAnimationFrame(loop);
}

// ─── SINGLE GAME ──────────────────────────────────────────────────────────────
async function handleReset() {
    handleStop();
    const algorithm = algorithmSelect.value;
    try {
        const resp = await fetch('/api/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game_id: 'main', algorithm })
        });
        gameState = await resp.json();
        renderer.theme = algorithm === 'rl' ? 'rl' : 'astar';
        renderer._prevFood = gameState.food ? [...gameState.food] : null;
        renderer.eatAnim  = 0;
        decisionTimes = [];
        if (avgDecisionEl) avgDecisionEl.textContent = '—';
        resetTimerUI();
        updateUI();
        setStatus(gameStatusEl, '● READY', 'ready');
        hideOverlay();
        setButtons({ running: false, gameOver: false });
    } catch (e) {
        console.error('Reset error:', e);
        setStatus(gameStatusEl, '● ERROR', 'gameover');
    }
}

async function handleStep() {
    if (isRunning || !gameState || gameState.game_over) return;
    await performStep();
}

async function performStep() {
    if (!gameState || gameState.game_over) return;
    const algorithm = algorithmSelect.value;
    try {
        const resp = await fetch('/api/step', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game_id: 'main', algorithm })
        });
        gameState = await resp.json();
        if (gameState.decision_time_ms !== undefined) updateDecisionTime(gameState.decision_time_ms);
        updateUI();
        updateTimerUI();
        if (gameState.game_over) {
            onGameOver();
        } else {
            setStatus(gameStatusEl, '● PLAYING', 'playing');
        }
    } catch (e) {
        console.error('Step error:', e);
        handleStop();
    }
}

function onGameOver() {
    const s = gameState.score;
    scoreHistory.push(s);
    if (scoreHistory.length > 20) scoreHistory.shift();
    if (s > bestScore) {
        bestScore = s;
        bestValEl.textContent = bestScore;
        bestEl.style.display = '';
    }
    drawHistoryChart();
    showOverlay(overlayMsg, overlayText, `GAME OVER  ·  ${s} pts`, 'var(--rose-dark)');
    setStatus(gameStatusEl, '● GAME OVER', 'gameover');
    sound.gameOver();
    handleStop();
}

let stepTimer = null;

function handleRun() {
    if (isRunning || !gameState || gameState.game_over) return;
    isRunning = true;
    startTime = Date.now() - elapsed * 1000;
    setStatus(gameStatusEl, '● PLAYING', 'playing');
    setButtons({ running: true, gameOver: false });
    sound.start();
    _startStepTimer();
}

function _startStepTimer() {
    const ms = SPEED_MAP[parseInt(speedSlider.value)] || 130;
    stepTimer = setTimeout(async function tick() {
        if (!isRunning || !gameState || gameState.game_over) return;
        await performStep();
        if (isRunning && gameState && !gameState.game_over) {
            const nextMs = SPEED_MAP[parseInt(speedSlider.value)] || 130;
            stepTimer = setTimeout(tick, nextMs);
        }
    }, ms);
}

function handleStop() {
    isRunning = false;
    if (stepTimer) { clearTimeout(stepTimer); stepTimer = null; }
    if (gameState && !gameState.game_over) {
        setStatus(gameStatusEl, '● PAUSED', 'paused');
    }
    setButtons({ running: false, gameOver: gameState?.game_over || false });
}

function setButtons({ running, gameOver }) {
    runBtn.disabled   = running || gameOver;
    stopBtn.disabled  = !running;
    stepBtn.disabled  = running || gameOver;
    resetBtn.disabled = false;
    algorithmSelect.disabled = running;
}

// ─── RACE MODE ────────────────────────────────────────────────────────────────
async function initRace() {
    stopRace();
    raceBannerEl.style.display = 'none';
    astarOverlayEl.style.display = 'none';
    rlOverlayEl.style.display  = 'none';
    liveDiffEl.style.display   = 'none';
    raceOver = { astar: false, rl: false };
    astarBoardEl.classList.remove('leading', 'leading-rl');
    rlBoardEl.classList.remove('leading', 'leading-rl');

    try {
        const [rA, rR] = await Promise.all([
            fetch('/api/reset', { method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ game_id:'astar', algorithm:'astar' }) }),
            fetch('/api/reset', { method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ game_id:'rl',    algorithm:'rl' }) })
        ]);
        raceStates.astar = await rA.json();
        raceStates.rl    = await rR.json();
        astarRenderer._prevFood = raceStates.astar.food ? [...raceStates.astar.food] : null;
        rlRenderer._prevFood    = raceStates.rl.food    ? [...raceStates.rl.food]    : null;
        astarRenderer.eatAnim = 0;
        rlRenderer.eatAnim    = 0;
        updateRaceUI();
        setStatus(astarStatusEl, '● READY', 'ready');
        setStatus(rlStatusEl,    '● READY', 'ready');
        raceStartBtn.disabled = false;
        raceStopBtn.disabled  = true;
    } catch (e) {
        console.error('Race init error:', e);
    }
}

async function startRaceWithCountdown() {
    raceStartBtn.disabled = true;
    const overlay  = document.getElementById('countdownOverlay');
    const numEl    = document.getElementById('countdownNum');
    overlay.style.display = 'flex';

    for (const n of ['3','2','1']) {
        numEl.textContent = n;
        numEl.style.animation = 'none';
        void numEl.offsetWidth;
        numEl.style.animation = '';
        sound.countdown();
        await sleep(800);
    }
    numEl.textContent = 'GO!';
    numEl.style.animation = 'none'; void numEl.offsetWidth; numEl.style.animation = '';
    sound.go();
    await sleep(500);
    overlay.style.display = 'none';

    startRace();
}

function startRace() {
    raceRunning = true;
    raceOver    = { astar: false, rl: false };
    raceLastStep = { astar: 0, rl: 0 };
    raceStopBtn.disabled  = false;
    raceStartBtn.disabled = true;
    liveDiffEl.style.display = '';
    setStatus(astarStatusEl, '● RACING', 'playing');
    setStatus(rlStatusEl,    '● RACING', 'playing');
    _raceLoop();
}

let _raceStepTimer = null;

async function _raceLoop() {
    if (!raceRunning) return;

    await Promise.all(
        ['astar', 'rl']
            .filter(a => !raceOver[a])
            .map(a => _raceStep(a))
    );

    updateRaceUI();
    updateLeadIndicator();

    if (raceOver.astar && raceOver.rl) {
        endRace();
        return;
    }
    if (!raceRunning) return;

    const ms = SPEED_MAP[parseInt(raceSpeedSlider.value)] || 130;
    _raceStepTimer = setTimeout(_raceLoop, ms);
}

async function _raceStep(algo) {
    try {
        const resp = await fetch('/api/step', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game_id: algo, algorithm: algo })
        });
        const state = await resp.json();
        raceStates[algo] = state;
        if (state.game_over && !raceOver[algo]) {
            raceOver[algo] = true;
            sound.gameOver();
            const overlayEl  = algo === 'astar' ? astarOverlayEl  : rlOverlayEl;
            const overlayTxt = algo === 'astar' ? astarOverlayText : rlOverlayText;
            showOverlay(overlayEl, overlayTxt, `DONE  ·  ${state.score} pts`, 'var(--rose-dark)');
            setStatus(algo === 'astar' ? astarStatusEl : rlStatusEl, '● DONE', 'gameover');
        }
    } catch (e) { /* ignore */ }
}

function updateLeadIndicator() {
    const aS   = raceStates.astar?.score || 0;
    const rS   = raceStates.rl?.score    || 0;
    const diff = aS - rS;

    astarBoardEl.classList.remove('leading', 'leading-rl');
    rlBoardEl.classList.remove('leading', 'leading-rl');

    if (diff > 0) {
        astarBoardEl.classList.add('leading');
        diffValEl.textContent = `A* +${diff}`;
        liveDiffEl.style.display = '';
    } else if (diff < 0) {
        rlBoardEl.classList.add('leading', 'leading-rl');
        diffValEl.textContent = `RL +${Math.abs(diff)}`;
        liveDiffEl.style.display = '';
    } else if (aS > 0) {
        // both scored but equal — show tied only when there's actually a score
        diffValEl.textContent = 'TIED';
        liveDiffEl.style.display = '';
    } else {
        // both at 0, race just started — hide the box
        liveDiffEl.style.display = 'none';
    }
}

function stopRace() {
    raceRunning = false;
    if (_raceStepTimer) { clearTimeout(_raceStepTimer); _raceStepTimer = null; }
    raceStopBtn.disabled  = true;
    raceStartBtn.disabled = false;
    if (!raceOver.astar) setStatus(astarStatusEl, '● PAUSED', 'paused');
    if (!raceOver.rl)    setStatus(rlStatusEl,    '● PAUSED', 'paused');
}

function endRace() {
    raceRunning = false;
    raceStopBtn.disabled  = true;
    raceStartBtn.disabled = false;
    liveDiffEl.style.display = 'none';
    astarBoardEl.classList.remove('leading', 'leading-rl');
    rlBoardEl.classList.remove('leading', 'leading-rl');

    const aS = raceStates.astar?.score || 0;
    const rS = raceStates.rl?.score    || 0;

    if (aS > rS) {
        raceRecord.astar++;
        raceBannerEl.className = 'race-winner-banner astar';
        raceBannerEl.textContent = 'A* PATHFINDING WINS';
        sound.winner();
        confetti.burst();
    } else if (rS > aS) {
        raceRecord.rl++;
        raceBannerEl.className = 'race-winner-banner rl';
        raceBannerEl.textContent = 'Q-LEARNING WINS';
        sound.winner();
        confetti.burst();
    } else {
        raceBannerEl.className = 'race-winner-banner tie';
        raceBannerEl.textContent = 'TIE — EQUAL PERFORMANCE';
    }
    raceBannerEl.style.display = 'block';
    updateRaceRecord();
    drawRaceChart();
    showWinnerModal(aS, rS);
}

function showWinnerModal(aScore, rlScore) {
    if (!winnerModalEl) return;
    winnerModalBadgeEl.className = 'winner-badge';
    if (aScore > rlScore) {
        winnerModalBadgeEl.textContent = 'WINNER';
        winnerModalAlgoEl.textContent  = 'A* Pathfinding';
    } else if (rlScore > aScore) {
        winnerModalBadgeEl.textContent = 'WINNER';
        winnerModalBadgeEl.classList.add('rl-winner');
        winnerModalAlgoEl.textContent  = 'Q-Learning';
    } else {
        winnerModalBadgeEl.textContent = 'TIE';
        winnerModalBadgeEl.classList.add('tie-result');
        winnerModalAlgoEl.textContent  = 'Equal Performance';
    }
    winnerModalScoresEl.textContent = `Score: ${aScore} vs ${rlScore}`;
    winnerModalEl.style.display = 'flex';
}

function updateRaceUI() {
    if (raceStates.astar) {
        animateMetric(astarScoreEl, raceStates.astar.score);
        astarStepsEl.textContent = raceStates.astar.steps;
        if (astarDecisionTimeEl && raceStates.astar.decision_time_ms !== undefined) {
            astarDecisionTimeEl.textContent = raceStates.astar.decision_time_ms.toFixed(2) + 'ms';
        }
    }
    if (raceStates.rl) {
        animateMetric(rlScoreEl, raceStates.rl.score);
        rlStepsEl.textContent = raceStates.rl.steps;
        if (rlDecisionTimeEl && raceStates.rl.decision_time_ms !== undefined) {
            rlDecisionTimeEl.textContent = raceStates.rl.decision_time_ms.toFixed(2) + 'ms';
        }
    }
}

function updateRaceRecord() {
    raceRecordEl.innerHTML = `A* <strong>${raceRecord.astar}</strong> — <strong>${raceRecord.rl}</strong> RL`;
}

// ─── UI HELPERS ───────────────────────────────────────────────────────────────
function updateUI() {
    if (!gameState) return;
    animateMetric(scoreEl, gameState.score);
    stepsEl.textContent = gameState.steps;
    efficiencyEl.textContent = gameState.steps > 0
        ? (gameState.score / gameState.steps * 100).toFixed(1) + '%'
        : '—';
}

function animateMetric(el, val) {
    if (parseInt(el.textContent) !== val) {
        el.textContent = val;
        el.classList.remove('bump');
        void el.offsetWidth;
        el.classList.add('bump');
    }
}

function setStatus(el, text, type) {
    el.textContent = text;
    el.className = `status-bar status-${type}`;
}

function showOverlay(container, textEl, text, color) {
    textEl.textContent = text;
    textEl.style.color = color || 'var(--text)';
    container.style.display = 'flex';
}

function hideOverlay() { overlayMsg.style.display = 'none'; }

function updateAlgoInfo() {
    const alg  = algorithmSelect.value;
    const info = ALGO_INFO[alg];
    algoTagEl.textContent = alg === 'astar' ? 'A*' : 'RL';
    algoTagEl.className = `algo-tag algo-tag-${alg}`;
    algoInfoEl.querySelector('.algo-info-title').textContent = info.title;
    algoInfoEl.querySelector('.algo-info-body').textContent  = info.body;
    const tagsRow = algoInfoEl.querySelector('.algo-tags-row');
    tagsRow.innerHTML = info.tags.map(t => `<span class="tag">${t}</span>`).join('');
    renderer.theme = alg === 'rl' ? 'rl' : 'astar';
}

// ─── TIMER ────────────────────────────────────────────────────────────────────
function resetTimerUI() {
    startTime = null; elapsed = 0;
    timeEl.textContent = '0.0s';
}
function updateTimerUI() {
    if (!startTime) startTime = Date.now();
    elapsed = (Date.now() - startTime) / 1000;
    timeEl.textContent = elapsed.toFixed(1) + 's';
}

// ─── CHARTS ───────────────────────────────────────────────────────────────────
function drawHistoryChart() {
    const c  = document.getElementById('historyChart');
    const cx = c.getContext('2d');
    const W = c.width, H = c.height;
    cx.fillStyle = '#F2F6F4';
    cx.fillRect(0, 0, W, H);
    if (!scoreHistory.length) {
        cx.fillStyle = '#6F6660'; cx.font = '12px Inter,system-ui';
        cx.textAlign = 'center';
        cx.fillText('Play games to see history', W/2, H/2+4);
        return;
    }
    const max  = Math.max(...scoreHistory, 1);
    const barW = Math.max(4, Math.floor((W-20)/scoreHistory.length)-2);
    const tot  = scoreHistory.length * (barW+2);
    const sx   = Math.max(5, (W-tot)/2);
    const grad = cx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(90,170,146,0.9)');
    grad.addColorStop(1, 'rgba(201,228,222,0.5)');
    scoreHistory.forEach((s, i) => {
        const h  = Math.max(3, (s/max)*(H-16));
        const x  = sx + i*(barW+2);
        const y  = H-8-h;
        const al = 0.35 + 0.65*(i/scoreHistory.length);
        cx.fillStyle = `rgba(90,170,146,${al})`;
        roundRect(cx, x, y, barW, h, 2);
        cx.fill();
    });
    const last = scoreHistory[scoreHistory.length-1];
    cx.fillStyle = '#5aaa92'; cx.font = 'bold 11px Inter,system-ui';
    cx.textAlign = 'right';
    cx.fillText(`Latest: ${last}`, W-6, 14);
}

// ─── INTERACTIVE REWARD CHART ────────────────────────────────────────────────
class InteractiveChart {
    constructor(canvasId, tooltipId) {
        this.canvas  = document.getElementById(canvasId);
        this.cx      = this.canvas.getContext('2d');
        this.tooltip = document.getElementById(tooltipId);
        this.data      = [];   // score per sample
        this.rewards   = [];   // total reward per sample
        this.epsilons  = [];   // epsilon per sample
        this.totalEpisodes = 2000;
        this.hoverIdx      = -1;
        this.animProgress  = 0;     // 0..1 for draw-in animation
        this.animId        = null;

        // zoom state
        this.zoomStart = null;      // data index
        this.zoomEnd   = null;
        this.isDragging = false;
        this.dragStartX = null;

        this._bindEvents();
    }

    // ── padding ─────────────────────────────────────────────────────────────
    get pad() { return { top: 22, right: 14, bottom: 24, left: 36 }; }

    // ── load new data and animate in ────────────────────────────────────────
    load(scores, rewards, epsilons, totalEpisodes) {
        this.data          = scores   || [];
        this.rewards       = rewards  || [];
        this.epsilons      = epsilons || [];
        this.totalEpisodes = totalEpisodes || 2000;
        this.hoverIdx      = -1;
        this.zoomStart     = null;
        this.zoomEnd       = null;
        this._cancelAnim();
        this.animProgress  = 0;
        this._animate();
    }

    // ── visible data range (respects zoom) ──────────────────────────────────
    _range() {
        const lo = this.zoomStart !== null ? this.zoomStart : 0;
        const hi = this.zoomEnd   !== null ? this.zoomEnd   : this.data.length - 1;
        return [lo, hi];
    }

    // ── map data index → canvas x ───────────────────────────────────────────
    _xOf(i) {
        const { left, right } = { left: this.pad.left, right: this.canvas.width - this.pad.right };
        const [lo, hi] = this._range();
        return left + ((i - lo) / Math.max(1, hi - lo)) * (right - left);
    }

    // ── map score value → canvas y ──────────────────────────────────────────
    _yOf(v) {
        const { top, bottom } = { top: this.pad.top, bottom: this.canvas.height - this.pad.bottom };
        const [lo, hi] = this._range();
        const slice    = this.data.slice(lo, hi + 1);
        const minV     = Math.min(...slice, 0);
        const maxV     = Math.max(...slice, 1);
        return bottom - ((v - minV) / (maxV - minV)) * (bottom - top);
    }

    // ── canvas x → nearest data index ───────────────────────────────────────
    _idxAt(canvasX) {
        const left  = this.pad.left;
        const right = this.canvas.width - this.pad.right;
        const [lo, hi] = this._range();
        const t = Math.max(0, Math.min(1, (canvasX - left) / (right - left)));
        return Math.round(lo + t * (hi - lo));
    }

    // ── animation loop ───────────────────────────────────────────────────────
    _animate() {
        const step = () => {
            this.animProgress = Math.min(1, this.animProgress + 0.035);
            this.draw();
            if (this.animProgress < 1) this.animId = requestAnimationFrame(step);
        };
        this.animId = requestAnimationFrame(step);
    }
    _cancelAnim() {
        if (this.animId) { cancelAnimationFrame(this.animId); this.animId = null; }
    }

    // ── main draw ────────────────────────────────────────────────────────────
    draw() {
        const { canvas: c, cx } = this;
        const W = c.width, H = c.height;
        const { top, right: rPad, bottom: bPad, left } = this.pad;
        const right  = W - rPad;
        const bottom = H - bPad;

        if (!this.data.length) {
            cx.fillStyle = '#F7F4EF';
            cx.fillRect(0, 0, W, H);
            cx.fillStyle = '#6F6660';
            cx.font = '12px Inter,system-ui';
            cx.textAlign = 'center';
            cx.fillText('Train the RL agent to see results', W / 2, H / 2 + 4);
            return;
        }

        const [lo, hi] = this._range();
        const slice    = this.data.slice(lo, hi + 1);
        const minV     = Math.min(...slice, 0);
        const maxV     = Math.max(...slice, 1);

        // compute all points
        const pts = this.data.slice(lo, hi + 1).map((v, i) => [
            this._xOf(lo + i),
            this._yOf(v)
        ]);

        // animate: only draw up to animProgress fraction
        const drawUpTo = Math.floor(pts.length * this.animProgress);
        const visiblePts = pts.slice(0, Math.max(2, drawUpTo));

        // ── background ──────────────────────────────────────────────────────
        cx.fillStyle = '#F7F4EF';
        cx.fillRect(0, 0, W, H);

        // ── axis lines ──────────────────────────────────────────────────────
        cx.strokeStyle = '#E6E1D9';
        cx.lineWidth = 1;
        cx.beginPath(); cx.moveTo(left, top); cx.lineTo(left, bottom); cx.stroke();
        cx.beginPath(); cx.moveTo(left, bottom); cx.lineTo(right, bottom); cx.stroke();

        // ── axis labels ─────────────────────────────────────────────────────
        cx.fillStyle = '#6F6660';
        cx.font = '10px Inter,system-ui';

        // y-axis: max at top, min at bottom
        cx.textAlign = 'right';
        cx.fillText(maxV, left - 4, top + 4);
        cx.fillText(minV, left - 4, bottom);

        // x-axis: episode range
        const epsPerSample = this.totalEpisodes / (this.data.length - 1 || 1);
        cx.textAlign = 'left';
        cx.fillText((lo * epsPerSample).toLocaleString(undefined, { maximumFractionDigits: 0 }), left, H - 6);
        cx.textAlign = 'right';
        cx.fillText((hi * epsPerSample).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' eps', right, H - 6);

        // ── zoom hint ───────────────────────────────────────────────────────
        if (this.zoomStart !== null) {
            cx.textAlign = 'center';
            cx.fillStyle = '#8c6bbf';
            cx.font = 'bold 9px Inter,system-ui';
            cx.fillText('ZOOMED  ·  dbl-click to reset', (left + right) / 2, top - 6);
        }

        // ── gradient fill ───────────────────────────────────────────────────
        const grad = cx.createLinearGradient(0, top, 0, bottom);
        grad.addColorStop(0, 'rgba(201,228,222,0.75)');
        grad.addColorStop(1, 'rgba(201,228,222,0.04)');

        cx.beginPath();
        cx.moveTo(visiblePts[0][0], bottom);
        visiblePts.forEach(([x, y]) => cx.lineTo(x, y));
        cx.lineTo(visiblePts[visiblePts.length - 1][0], bottom);
        cx.closePath();
        cx.fillStyle = grad;
        cx.fill();

        // ── hover highlight: brighter area left of cursor ───────────────────
        if (this.hoverIdx >= lo && this.hoverIdx <= hi && this.animProgress === 1) {
            const hx = this._xOf(this.hoverIdx);
            const brightGrad = cx.createLinearGradient(0, top, 0, bottom);
            brightGrad.addColorStop(0, 'rgba(201,228,222,0.4)');
            brightGrad.addColorStop(1, 'rgba(201,228,222,0.0)');
            cx.save();
            cx.beginPath();
            cx.rect(left, top, hx - left, bottom - top);
            cx.clip();
            cx.beginPath();
            cx.moveTo(visiblePts[0][0], bottom);
            visiblePts.forEach(([x, y]) => cx.lineTo(x, y));
            cx.lineTo(visiblePts[visiblePts.length - 1][0], bottom);
            cx.closePath();
            cx.fillStyle = brightGrad;
            cx.fill();
            cx.restore();
        }

        // ── accuracy line (reward, normalised to same y scale) ───────────────
        const hasRewards = this.rewards.length === this.data.length
                        && this.rewards.some(r => r !== null);
        if (hasRewards) {
            const rewSlice  = this.rewards.slice(lo, hi + 1);
            const rewMin    = Math.min(...rewSlice);
            const rewMax    = Math.max(...rewSlice, rewMin + 1);
            const rewPts    = rewSlice.map((r, i) => [
                this._xOf(lo + i),
                bottom - ((r - rewMin) / (rewMax - rewMin)) * (bottom - top)
            ]).slice(0, Math.max(2, drawUpTo));

            cx.beginPath();
            cx.moveTo(rewPts[0][0], rewPts[0][1]);
            rewPts.forEach(([x, y]) => cx.lineTo(x, y));
            cx.strokeStyle = '#5a96c9';
            cx.lineWidth   = 1.5;
            cx.lineJoin    = 'round';
            cx.globalAlpha = 0.7;
            cx.setLineDash([4, 3]);
            cx.stroke();
            cx.setLineDash([]);
            cx.globalAlpha = 1;

            // dot on accuracy line at hover
            if (this.hoverIdx >= lo && this.hoverIdx <= hi && this.animProgress === 1) {
                const hi2 = this.hoverIdx - lo;
                if (hi2 < rewPts.length) {
                    const [ax, ay] = rewPts[hi2];
                    cx.fillStyle   = '#5a96c9';
                    cx.strokeStyle = '#fff';
                    cx.lineWidth   = 2;
                    cx.beginPath(); cx.arc(ax, ay, 3.5, 0, Math.PI * 2); cx.fill(); cx.stroke();
                }
            }
        }

        // ── score line ───────────────────────────────────────────────────────
        cx.beginPath();
        cx.moveTo(visiblePts[0][0], visiblePts[0][1]);
        visiblePts.forEach(([x, y]) => cx.lineTo(x, y));
        cx.strokeStyle = '#5aaa92';
        cx.lineWidth = 2;
        cx.lineJoin = 'round';
        cx.stroke();

        // ── legend ───────────────────────────────────────────────────────────
        cx.font = 'bold 9px Inter,system-ui';
        cx.textAlign = 'left';
        // score dot
        cx.fillStyle = '#5aaa92';
        cx.beginPath(); cx.arc(left + 4, top + 8, 3, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = '#6F6660';
        cx.fillText('Score', left + 10, top + 12);
        if (hasRewards) {
            cx.strokeStyle = '#5a96c9'; cx.lineWidth = 1.5;
            cx.setLineDash([4, 3]);
            cx.beginPath(); cx.moveTo(left + 52, top + 8); cx.lineTo(left + 62, top + 8); cx.stroke();
            cx.setLineDash([]);
            cx.fillStyle = '#6F6660';
            cx.fillText('Accuracy', left + 64, top + 12);
        }

        // ── drag-select region ───────────────────────────────────────────────
        if (this.isDragging && this.dragStartX !== null && this.hoverIdx >= 0) {
            const x1 = Math.min(this.dragStartX, this._xOf(this.hoverIdx));
            const x2 = Math.max(this.dragStartX, this._xOf(this.hoverIdx));
            cx.fillStyle = 'rgba(198,222,241,0.25)';
            cx.fillRect(x1, top, x2 - x1, bottom - top);
            cx.strokeStyle = '#5a96c9';
            cx.lineWidth = 1;
            cx.strokeRect(x1, top, x2 - x1, bottom - top);
        }

        // ── vertical tracking line + dot ─────────────────────────────────────
        if (this.hoverIdx >= lo && this.hoverIdx <= hi && this.animProgress === 1) {
            const hx = this._xOf(this.hoverIdx);
            const hy = this._yOf(this.data[this.hoverIdx]);

            cx.strokeStyle = 'rgba(90,170,146,0.35)';
            cx.lineWidth = 1;
            cx.setLineDash([3, 3]);
            cx.beginPath(); cx.moveTo(hx, top); cx.lineTo(hx, bottom); cx.stroke();
            cx.setLineDash([]);

            cx.fillStyle   = '#5aaa92';
            cx.strokeStyle = '#fff';
            cx.lineWidth   = 2;
            cx.beginPath(); cx.arc(hx, hy, 4.5, 0, Math.PI * 2); cx.fill(); cx.stroke();
        }

        // ── update HTML stats bar ────────────────────────────────────────────
        this._updateStatsBar(slice, lo, epsPerSample);
    }

    _updateStatsBar(slice, lo, epsPerSample) {
        const el = document.getElementById('rewardStats');
        if (!el || !slice.length) return;
        el.style.display = 'flex';

        const avg      = slice.reduce((a, b) => a + b, 0) / slice.length;
        const best     = Math.max(...slice);
        const bestIdx  = lo + slice.indexOf(best);
        const last10   = slice.slice(-Math.min(10, slice.length));
        const first10  = slice.slice(0, Math.min(10, slice.length));
        const avgLast  = last10.reduce((a, b) => a + b, 0)  / last10.length;
        const avgFirst = first10.reduce((a, b) => a + b, 0) / first10.length;

        const trend      = avgLast > avgFirst * 1.1 ? '↑ Improving'
                         : avgLast < avgFirst * 0.9 ? '↓ Declining'
                         : '→ Stable';
        const trendColor = avgLast > avgFirst * 1.1 ? 'var(--menthe-dark)'
                         : avgLast < avgFirst * 0.9 ? 'var(--rose-dark)'
                         : 'var(--jaune-dark)';

        document.getElementById('rsAvg').textContent   = avg.toFixed(1);
        document.getElementById('rsBest').textContent  =
            `${best}  (ep ${Math.round(bestIdx * epsPerSample).toLocaleString()})`;
        const trendEl = document.getElementById('rsTrend');
        trendEl.textContent  = trend;
        trendEl.style.color  = trendColor;
    }

    // ── tooltip ──────────────────────────────────────────────────────────────
    _showTooltip(idx) {
        if (idx < 0 || idx >= this.data.length) { this._hideTooltip(); return; }
        const epsPerSample = this.totalEpisodes / (this.data.length - 1 || 1);
        const ep      = Math.round(idx * epsPerSample);
        const score   = this.data[idx];
        const eps     = this.epsilons[idx] ?? Math.max(0.05, 1.0 - (ep / this.totalEpisodes) * 0.95);
        const reward  = this.rewards[idx];

        this.tooltip.querySelector('.rt-episode').textContent = `Episode ${ep.toLocaleString()}`;
        this.tooltip.querySelector('.rt-score').textContent   = `Score: ${score}`;
        this.tooltip.querySelector('.rt-epsilon').textContent =
            reward !== null && reward !== undefined
                ? `Accuracy: ${reward > 0 ? '+' : ''}${reward.toFixed(1)}  ·  ε = ${(+eps).toFixed(3)}`
                : `ε = ${(+eps).toFixed(3)}`;
        this.tooltip.classList.add('visible');
        this.tooltip.style.display = 'block';
    }

    _hideTooltip() {
        this.tooltip.classList.remove('visible');
        setTimeout(() => {
            if (!this.tooltip.classList.contains('visible')) {
                this.tooltip.style.display = 'none';
            }
        }, 150);
    }

    _positionTooltip(canvasX, canvasY) {
        const wrap   = this.canvas.parentElement;
        const rect   = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        // convert canvas coords back to CSS pixel offset within wrapper
        const cssX   = canvasX / scaleX;
        const cssY   = canvasY / scaleX;
        const ttW    = this.tooltip.offsetWidth  || 120;
        const ttH    = this.tooltip.offsetHeight || 60;
        const wrapW  = wrap.clientWidth;

        let tx = cssX + 12;
        let ty = cssY - ttH / 2;
        if (tx + ttW > wrapW - 4) tx = cssX - ttW - 12;
        if (ty < 4) ty = 4;

        this.tooltip.style.left = tx + 'px';
        this.tooltip.style.top  = ty + 'px';
    }

    // ── event binding ────────────────────────────────────────────────────────
    _bindEvents() {
        const c = this.canvas;

        c.addEventListener('mousemove', e => {
            const rect   = c.getBoundingClientRect();
            const scaleX = c.width / rect.width;
            const cx_pos = (e.clientX - rect.left) * scaleX;
            const cy_pos = (e.clientY - rect.top)  * scaleX;

            if (!this.data.length || this.animProgress < 1) return;

            const idx = this._idxAt(cx_pos);
            if (idx !== this.hoverIdx) {
                this.hoverIdx = idx;
                this.draw();
            }
            this._showTooltip(idx);
            this._positionTooltip(cx_pos / scaleX, cy_pos / scaleX);

            if (this.isDragging) this.draw();
        });

        c.addEventListener('mouseleave', () => {
            this.hoverIdx = -1;
            this.isDragging = false;
            this.dragStartX = null;
            this.draw();
            this._hideTooltip();
        });

        c.addEventListener('mousedown', e => {
            if (!this.data.length || this.animProgress < 1) return;
            const rect   = c.getBoundingClientRect();
            const scaleX = c.width / rect.width;
            const cx_pos = (e.clientX - rect.left) * scaleX;
            this.isDragging = true;
            this.dragStartX = cx_pos;
            this._dragStartIdx = this._idxAt(cx_pos);
        });

        c.addEventListener('mouseup', e => {
            if (!this.isDragging) return;
            const rect   = c.getBoundingClientRect();
            const scaleX = c.width / rect.width;
            const cx_pos = (e.clientX - rect.left) * scaleX;
            const endIdx = this._idxAt(cx_pos);
            const startIdx = this._dragStartIdx;

            const lo = Math.min(startIdx, endIdx);
            const hi = Math.max(startIdx, endIdx);
            if (hi - lo > 1) {
                this.zoomStart = lo;
                this.zoomEnd   = hi;
            }
            this.isDragging  = false;
            this.dragStartX  = null;
            this._dragStartIdx = null;
            this.draw();
        });

        c.addEventListener('dblclick', () => {
            this.zoomStart = null;
            this.zoomEnd   = null;
            this.draw();
        });
    }
}

// instantiate after DOM ready — called in init()
let rewardChart = null;

function initRewardChart() {
    rewardChart = new InteractiveChart('rewardChart', 'rewardTooltip');
}

function drawRewardChart() {
    if (!rewardChart) return;
    // rewardHistory is now an array of {score, reward, epsilon, episode} objects
    const scores    = rewardHistory.map(h => typeof h === 'object' ? h.score  : h);
    const rewards   = rewardHistory.map(h => typeof h === 'object' ? h.reward : null);
    const epsilons  = rewardHistory.map(h => typeof h === 'object' ? h.epsilon : null);
    rewardChart.load(scores, rewards, epsilons, 2000);
}

function drawRaceChart() {
    const c  = document.getElementById('raceChart');
    const cx = c.getContext('2d');
    const W = c.width, H = c.height;
    cx.clearRect(0,0,W,H);
    const aS = raceStates.astar?.score || 0;
    const rS = raceStates.rl?.score    || 0;
    const total = aS + rS || 1;
    const aH = (aS / total) * (H - 20);
    const rH = (rS / total) * (H - 20);
    // A* bar
    cx.fillStyle = '#C9E4DE';
    roundRect(cx, 4, H-10-aH, W/2-8, Math.max(aH,4), 4);
    cx.fill();
    // RL bar
    cx.fillStyle = '#C6DEF1';
    roundRect(cx, W/2+4, H-10-rH, W/2-8, Math.max(rH,4), 4);
    cx.fill();
    cx.fillStyle = '#6F6660'; cx.font = '9px Inter,system-ui'; cx.textAlign = 'center';
    cx.fillText('A*', W/4, H-1);
    cx.fillText('RL', W*3/4, H-1);
}

// ─── TRAINING ─────────────────────────────────────────────────────────────────
async function trainRL() {
    const panel       = document.getElementById('trainingPanel');
    const progressFill = document.getElementById('progressFill');
    const episodeCount = document.getElementById('trainingEpisodeCount');
    const msgEl        = document.getElementById('trainingMessage');
    const epsilonEl    = document.getElementById('trainingEpsilon');

    panel.style.display = 'block';
    progressFill.style.width = '0%';
    progressFill.classList.remove('complete');
    episodeCount.textContent = '0 / 2000 episodes';
    msgEl.textContent = 'Training in progress...';
    epsilonEl.textContent = 'ε = 1.000';
    trainBtn.disabled = true;
    rewardHistory = [];

    let fakeProgress = 0;
    const fakeTimer = setInterval(() => {
        fakeProgress = Math.min(fakeProgress + Math.random() * 4, 88);
        progressFill.style.width = fakeProgress + '%';
        episodeCount.textContent = `~${Math.round(fakeProgress*20)} / 2000 episodes`;
    }, 300);

    try {
        const resp = await fetch('/api/train', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ episodes: 2000 })
        });
        const result = await resp.json();
        clearInterval(fakeTimer);
        progressFill.style.width = '100%';
        progressFill.classList.add('complete');
        const totalEp   = result.total_episodes || result.episodes_trained || 2000;
        const trainedEp = result.episodes_trained || 2000;
        const trainTime = result.training_time || 0;
        const finalEps  = result.final_epsilon  || 0.05;
        episodeCount.textContent = `${trainedEp} / ${trainedEp} episodes`;
        msgEl.textContent = `✓ Complete — ${trainTime}s  |  ${totalEp} total eps`;
        epsilonEl.textContent = `ε = ${finalEps.toFixed(3)}`;
        if (result.history && result.history.length) {
            rewardHistory = result.history;
            drawRewardChart();
        }
        sound.start();
        setTimeout(() => { trainBtn.disabled = false; }, 800);
    } catch (e) {
        clearInterval(fakeTimer);
        console.error('Training error:', e);
        msgEl.textContent = '✗ Training failed — check server logs';
        progressFill.style.width = '0%';
        trainBtn.disabled = false;
    }
}

// ─── COMPARISON ───────────────────────────────────────────────────────────────
async function runComparison(numGames) {
    const panel   = document.getElementById('comparisonResults');
    const tbody   = document.getElementById('statsBody');
    const banner  = document.getElementById('winnerBanner');
    const gamesEl = document.getElementById('gamesCount');

    compareBtn.disabled = true;
    compareDetailedBtn.disabled = true;
    compareBtn.textContent = 'Running…';
    panel.style.display = 'block';
    banner.className = 'winner-banner';
    banner.textContent = '';
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--secondary)">
        <div class="loading-spinner"></div>
        Running ${numGames} games per algorithm…<br>
        <small style="color:var(--secondary)">This may take 10–30 seconds</small>
    </td></tr>`;

    try {
        const resp = await fetch('/api/compare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ num_games: numGames })
        });
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.error || `HTTP ${resp.status}`);
        gamesEl.textContent = `${numGames} games each`;
        displayResults(result);
        loadAnalyticsCharts();
    } catch (e) {
        console.error('Compare error:', e);
        tbody.innerHTML = `<tr><td colspan="4" style="color:var(--rose-dark);padding:16px;text-align:center">
            ✗ Error: ${e.message}<br><small>Check the server console for details</small>
        </td></tr>`;
        banner.textContent = '';
    } finally {
        compareBtn.disabled = false;
        compareDetailedBtn.disabled = false;
        compareBtn.textContent = 'Compare ×10';
    }
}

function displayResults(result) {
    const stats  = result.statistics;
    const winner = result.winner;
    const tbody  = document.getElementById('statsBody');
    const banner = document.getElementById('winnerBanner');

    if (!stats?.astar || !stats?.rl) {
        tbody.innerHTML = `<tr><td colspan="4" style="color:var(--secondary);padding:16px">No data</td></tr>`;
        return;
    }
    tbody.innerHTML = '';
    const metrics = [
        { key:'avg_score',    label:'Avg Score',    hi:true,  fmt: v => v.toFixed(2) },
        { key:'max_score',    label:'Max Score',    hi:true,  fmt: v => v },
        { key:'min_score',    label:'Min Score',    hi:true,  fmt: v => v },
        { key:'success_rate', label:'Success Rate', hi:true,  fmt: v => v.toFixed(1)+'%' },
        { key:'avg_steps',    label:'Avg Steps',    hi:false, fmt: v => v.toFixed(0) },
    ];
    metrics.forEach(m => {
        const aV = stats.astar[m.key], rV = stats.rl[m.key];
        if (aV === undefined || rV === undefined) return;
        const aWins = m.hi ? aV >= rV : aV <= rV;
        const tied  = aV === rV;
        const row = tbody.insertRow();
        row.innerHTML = `
            <td style="color:var(--secondary);font-size:12px;font-weight:600">${m.label}</td>
            <td>${m.fmt(aV)}</td>
            <td>${m.fmt(rV)}</td>
            <td class="winner-cell ${tied?'winner-tie':aWins?'winner-astar':'winner-rl'}">
                ${tied?'TIE':aWins?'A*':'RL'}</td>`;
    });
    if (winner === 'astar') {
        banner.className = 'winner-banner astar';
        banner.textContent = 'WINNER: A* PATHFINDING';
        sound.winner();
    } else if (winner === 'rl') {
        banner.className = 'winner-banner rl';
        banner.textContent = 'WINNER: Q-LEARNING RL';
        sound.winner();
    } else {
        banner.className = 'winner-banner tie';
        banner.textContent = 'TIE — EQUAL PERFORMANCE';
    }
}

// ─── PERSISTENT HISTORY ───────────────────────────────────────────────────────
async function loadHistoryFromDB() {
    try {
        const resp = await fetch('/api/history?limit=20');
        const data = await resp.json();
        if (data.last_training?.episodes) {
            const lt = data.last_training;
            const panel = document.getElementById('trainingPanel');
            panel.style.display = 'block';
            document.getElementById('progressFill').style.width = '100%';
            document.getElementById('trainingEpisodeCount').textContent =
                `${lt.episodes} / ${lt.episodes} episodes`;
            document.getElementById('trainingMessage').textContent =
                `✓ Last trained: ${lt.episodes} ep in ${lt.training_time}s`;
            document.getElementById('trainingEpsilon').textContent =
                `ε = ${(lt.final_epsilon || 0.05).toFixed(3)}`;
            if (lt.history?.length) {
                rewardHistory = lt.history;
                drawRewardChart();
            }
        }
    } catch (e) { console.warn('Could not load history:', e); }
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── ANALYTICS CHARTS ─────────────────────────────────────────────────────────
let distributionChart = null;
let historyLineChart  = null;

async function loadAnalyticsCharts() {
    // Wait for Chart.js CDN to be ready (it's loaded async from CDN)
    if (typeof Chart === 'undefined') {
        setTimeout(loadAnalyticsCharts, 200);
        return;
    }
    try {
        // Fetch each algorithm separately so the limit applies independently —
        // avoids one algorithm crowding out the other in the top-50 results.
        const [astarResp, rlResp] = await Promise.all([
            fetch('/api/history?algorithm=astar&limit=50'),
            fetch('/api/history?algorithm=rl&limit=50'),
        ]);
        const astarJson = await astarResp.json();
        const rlJson    = await rlResp.json();

        // Summaries come back in every response regardless of algorithm filter
        if (astarJson.astar_summary) {
            document.getElementById('astarAvg').textContent  = astarJson.astar_summary.avg_score  != null ? astarJson.astar_summary.avg_score  : '—';
            document.getElementById('astarBest').textContent = astarJson.astar_summary.max_score  != null ? astarJson.astar_summary.max_score  : '—';
        }
        if (rlJson.rl_summary) {
            document.getElementById('rlAvg').textContent  = rlJson.rl_summary.avg_score  != null ? rlJson.rl_summary.avg_score  : '—';
            document.getElementById('rlBest').textContent = rlJson.rl_summary.max_score  != null ? rlJson.rl_summary.max_score  : '—';
        }

        const astarScores = (astarJson.scores || []).map(s => s.score);
        const rlScores    = (rlJson.scores    || []).map(s => s.score);

        drawDistributionChart(astarScores, rlScores);
        drawHistoryLineChart(astarScores, rlScores);
    } catch (e) {
        console.error('Analytics load error:', e);
    }
}

function drawDistributionChart(astarScores, rlScores) {
    const ctx = document.getElementById('distributionChart');
    if (!ctx) return;

    function bucket(scores) {
        const b = [0, 0, 0, 0];
        scores.forEach(s => {
            if      (s <= 5)  b[0]++;
            else if (s <= 10) b[1]++;
            else if (s <= 15) b[2]++;
            else              b[3]++;
        });
        return b;
    }

    const astarBuckets = bucket(astarScores);
    const rlBuckets    = bucket(rlScores);

    if (distributionChart) distributionChart.destroy();

    distributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['0–5', '6–10', '11–15', '16+'],
            datasets: [
                {
                    label: 'A*', data: astarBuckets, backgroundColor: '#5aaa92',
                    borderColor: '#4a9a82', borderWidth: 1, borderRadius: 4,
                    barPercentage: 0.8, categoryPercentage: 0.7
                },
                {
                    label: 'RL', data: rlBuckets, backgroundColor: '#5a96c9',
                    borderColor: '#4a86b9', borderWidth: 1, borderRadius: 4,
                    barPercentage: 0.8, categoryPercentage: 0.7
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { boxWidth: 12, padding: 16, font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label(ctx) {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(0) : 0;
                            return `${ctx.dataset.label}: ${ctx.raw} games (${pct}%)`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMax: Math.max(...astarBuckets, ...rlBuckets, 5) * 1.2,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: { stepSize: 1, font: { size: 11 } }
                },
                x: { grid: { display: false }, ticks: { font: { size: 11 } } }
            }
        }
    });
}

function drawHistoryLineChart(astarData, rlData) {
    const ctx = document.getElementById('historyLineChart');
    if (!ctx) return;

    const maxLen = Math.max(astarData.length, rlData.length, 1);
    const labels    = Array.from({ length: maxLen }, (_, i) => i + 1);

    if (historyLineChart) historyLineChart.destroy();

    historyLineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'A*', data: astarData,
                    borderColor: '#5aaa92', backgroundColor: 'rgba(90,170,146,0.1)',
                    fill: true, tension: 0.3, pointRadius: 3
                },
                {
                    label: 'RL', data: rlData,
                    borderColor: '#5a96c9', backgroundColor: 'rgba(90,150,201,0.1)',
                    fill: true, tension: 0.3, pointRadius: 3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { title: { display: true, text: 'Game #', font: { size: 11 } }, grid: { display: false } }
            }
        }
    });
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    drawHistoryChart();
    init();
    loadAnalyticsCharts();
    document.getElementById('refreshAnalyticsBtn').addEventListener('click', loadAnalyticsCharts);
    // draw empty state placeholder after chart is instantiated
    setTimeout(() => rewardChart && rewardChart.draw(), 0);
});
