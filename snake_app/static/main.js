/**
 * Snake Game AI — Frontend JS
 * Fixed: training display, comparison, persistent history via TinyDB API
 */

const GRID_SIZE = 10;
const CELL_SIZE = 30;
const CANVAS_SIZE = GRID_SIZE * CELL_SIZE;
const SPEED_MAP = [null, 500, 350, 250, 180, 130, 90, 60, 35, 20, 10];

let currentGameState = null;
let isRunning = false;
let runTimer = null;
let startTime = null;
let elapsedTime = 0;
let scoreHistory = [];   // In-session scores for chart
let rewardHistory = [];  // Training reward curve

// DOM refs
const canvas   = document.getElementById('gameCanvas');
const ctx      = canvas.getContext('2d');
const algorithmSelect    = document.getElementById('algorithm');
const resetBtn           = document.getElementById('resetBtn');
const stepBtn            = document.getElementById('stepBtn');
const runBtn             = document.getElementById('runBtn');
const stopBtn            = document.getElementById('stopBtn');
const speedSlider        = document.getElementById('speedSlider');
const speedLabel         = document.getElementById('speedLabel');
const trainBtn           = document.getElementById('trainBtn');
const compareBtn         = document.getElementById('compareBtn');
const compareDetailedBtn = document.getElementById('compareDetailedBtn');
const scoreEl      = document.getElementById('score');
const stepsEl      = document.getElementById('steps');
const timeEl       = document.getElementById('time');
const efficiencyEl = document.getElementById('efficiency');
const gameStatusEl = document.getElementById('gameStatus');
const algoTag      = document.getElementById('algoTag');
const algoInfo     = document.getElementById('algoInfo');
const overlayMsg   = document.getElementById('overlayMsg');
const overlayText  = document.getElementById('overlayText');

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

// ===== INIT =====
function init() {
    setupEventListeners();
    handleReset();
    loadHistoryFromDB();  // Load persistent history on startup
}

function setupEventListeners() {
    resetBtn.addEventListener('click', handleReset);
    stepBtn.addEventListener('click', handleStep);
    runBtn.addEventListener('click', handleRun);
    stopBtn.addEventListener('click', handleStop);
    trainBtn.addEventListener('click', trainRL);
    compareBtn.addEventListener('click', () => runComparison(10));
    compareDetailedBtn.addEventListener('click', () => runComparison(50));
    speedSlider.addEventListener('input', () => {
        speedLabel.textContent = speedSlider.value + '×';
        if (isRunning) { clearInterval(runTimer); startRunLoop(); }
    });
    algorithmSelect.addEventListener('change', () => {
        updateAlgoInfo();
        if (!isRunning) handleReset();
    });
}

function updateAlgoInfo() {
    const alg = algorithmSelect.value;
    const info = ALGO_INFO[alg];
    algoTag.textContent = alg === 'astar' ? 'A*' : 'RL';
    algoInfo.querySelector('.algo-info-title').textContent = info.title;
    algoInfo.querySelector('.algo-info-body').textContent = info.body;
    const tagsRow = algoInfo.querySelector('.algo-tags-row');
    tagsRow.innerHTML = info.tags.map(t => `<span class="tag">${t}</span>`).join('');
}

// ===== PERSISTENT HISTORY =====
async function loadHistoryFromDB() {
    try {
        const resp = await fetch('/api/history?limit=20');
        const data = await resp.json();
        // Do not pre-load scoreHistory from DB — chart tracks current session only
        // Restore last training info if available
        if (data.last_training && data.last_training.episodes) {
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
            if (lt.history && lt.history.length) {
                rewardHistory = lt.history.map(h => h.score);
                drawRewardChart();
            }
        }
    } catch (e) {
        console.warn('Could not load history:', e);
    }
}

// ===== GAME CONTROLS =====
async function handleReset() {
    handleStop();
    const algorithm = algorithmSelect.value;
    try {
        const resp = await fetch('/api/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game_id: 'main', algorithm })
        });
        currentGameState = await resp.json();
        resetTimer();
        updateUI();
        setStatus('● READY', 'ready');
        hideOverlay();
        setButtons({ running: false, gameOver: false });
    } catch (e) {
        console.error('Reset error:', e);
        setStatus('● ERROR', 'gameover');
    }
}

async function handleStep() {
    if (isRunning || !currentGameState || currentGameState.game_over) return;
    await performStep();
}

async function performStep() {
    if (!currentGameState || currentGameState.game_over) return;
    const algorithm = algorithmSelect.value;
    try {
        const resp = await fetch('/api/step', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game_id: 'main', algorithm })
        });
        currentGameState = await resp.json();
        updateUI();
        updateTimer();
        if (currentGameState.game_over) {
            onGameOver();
        } else {
            setStatus('● PLAYING', 'playing');
        }
    } catch (e) {
        console.error('Step error:', e);
        handleStop();
    }
}

function onGameOver() {
    // Push to score history and persist
    scoreHistory.push(currentGameState.score);
    if (scoreHistory.length > 20) scoreHistory.shift();
    drawHistoryChart();
    showOverlay(`GAME OVER  —  ${currentGameState.score} pts`, '#c96b9a');
    setStatus('● GAME OVER', 'gameover');
    handleStop();
}

async function handleRun() {
    if (isRunning || !currentGameState || currentGameState.game_over) return;
    isRunning = true;
    startTime = Date.now() - elapsedTime * 1000;
    setStatus('● PLAYING', 'playing');
    setButtons({ running: true, gameOver: false });
    startRunLoop();
}

function startRunLoop() {
    const interval = SPEED_MAP[parseInt(speedSlider.value)] || 130;
    runTimer = setInterval(async () => {
        if (!currentGameState || currentGameState.game_over) {
            handleStop();
            return;
        }
        await performStep();
    }, interval);
}

function handleStop() {
    isRunning = false;
    if (runTimer) { clearInterval(runTimer); runTimer = null; }
    if (currentGameState && !currentGameState.game_over) {
        setStatus('● PAUSED', 'paused');
    }
    setButtons({ running: false, gameOver: currentGameState?.game_over || false });
}

function setButtons({ running, gameOver }) {
    runBtn.disabled  = running || gameOver;
    stopBtn.disabled = !running;
    stepBtn.disabled = running || gameOver;
    resetBtn.disabled = false;
    algorithmSelect.disabled = running;
}

// ===== TRAINING =====
async function trainRL() {
    const panel = document.getElementById('trainingPanel');
    const progressFill = document.getElementById('progressFill');
    const episodeCount  = document.getElementById('trainingEpisodeCount');
    const msgEl         = document.getElementById('trainingMessage');
    const epsilonEl     = document.getElementById('trainingEpsilon');

    panel.style.display = 'block';
    progressFill.style.width = '0%';
    episodeCount.textContent = '0 / 2000 episodes';
    msgEl.textContent = 'Training in progress...';
    epsilonEl.textContent = 'ε = 1.000';
    trainBtn.disabled = true;
    rewardHistory = [];

    // Animate progress bar while waiting (training is sync on server)
    let fakeProgress = 0;
    const fakeTimer = setInterval(() => {
        fakeProgress = Math.min(fakeProgress + Math.random() * 4, 88);
        progressFill.style.width = fakeProgress + '%';
        episodeCount.textContent = `~${Math.round(fakeProgress * 20)} / 2000 episodes`;
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

        // FIX: use correct field names from API response
        const totalEp    = result.total_episodes || result.episodes_trained || 2000;
        const trainedEp  = result.episodes_trained || 2000;
        const trainTime  = result.training_time || 0;
        const finalEps   = result.final_epsilon || 0.05;

        episodeCount.textContent = `${trainedEp} / ${trainedEp} episodes`;
        msgEl.textContent = `✓ Complete — ${trainTime}s  |  ${totalEp} total episodes`;
        epsilonEl.textContent = `ε = ${finalEps.toFixed(3)}`;

        // Draw reward curve
        if (result.history && result.history.length > 0) {
            rewardHistory = result.history.map(h => h.score);
            drawRewardChart();
        }

        setTimeout(() => { trainBtn.disabled = false; }, 800);
    } catch (e) {
        clearInterval(fakeTimer);
        console.error('Training error:', e);
        msgEl.textContent = '✗ Training failed — check server logs';
        progressFill.style.width = '0%';
        trainBtn.disabled = false;
    }
}

// ===== COMPARISON =====
async function runComparison(numGames) {
    const panel   = document.getElementById('comparisonResults');
    const tbody   = document.getElementById('statsBody');
    const banner  = document.getElementById('winnerBanner');
    const gamesCountEl = document.getElementById('gamesCount');

    compareBtn.disabled = true;
    compareDetailedBtn.disabled = true;
    panel.style.display = 'block';
    banner.className = 'winner-banner';
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--secondary)">
        Running ${numGames} games per algorithm…</td></tr>`;

    try {
        const resp = await fetch('/api/compare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ num_games: numGames })
        });

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const result = await resp.json();

        gamesCountEl.textContent = `${numGames} games each`;
        displayResults(result);

    } catch (e) {
        console.error('Compare error:', e);
        tbody.innerHTML = `<tr><td colspan="4" style="color:var(--rose-dark);padding:16px">
            ✗ Error running comparison: ${e.message}</td></tr>`;
    } finally {
        compareBtn.disabled = false;
        compareDetailedBtn.disabled = false;
    }
}

function displayResults(result) {
    const stats  = result.statistics;
    const winner = result.winner;
    const tbody  = document.getElementById('statsBody');
    const banner = document.getElementById('winnerBanner');

    if (!stats || !stats.astar || !stats.rl) {
        tbody.innerHTML = `<tr><td colspan="4" style="color:var(--secondary);padding:16px">No data available</td></tr>`;
        return;
    }

    tbody.innerHTML = '';

    const metrics = [
        { key: 'avg_score',    label: 'Avg Score',    higherBetter: true,  fmt: v => v.toFixed(2) },
        { key: 'max_score',    label: 'Max Score',    higherBetter: true,  fmt: v => v },
        { key: 'min_score',    label: 'Min Score',    higherBetter: true,  fmt: v => v },
        { key: 'success_rate', label: 'Success Rate', higherBetter: true,  fmt: v => v.toFixed(1) + '%' },
        { key: 'avg_steps',    label: 'Avg Steps',    higherBetter: false, fmt: v => v.toFixed(0) },
    ];

    metrics.forEach(m => {
        const aVal = stats.astar[m.key];
        const rVal = stats.rl[m.key];
        if (aVal === undefined || rVal === undefined) return;
        const aWins = m.higherBetter ? aVal >= rVal : aVal <= rVal;
        const tied  = aVal === rVal;

        const row = tbody.insertRow();
        row.innerHTML = `
            <td style="color:var(--secondary);font-size:12px;font-weight:600">${m.label}</td>
            <td>${m.fmt(aVal)}</td>
            <td>${m.fmt(rVal)}</td>
            <td class="winner-cell ${tied ? 'winner-tie' : aWins ? 'winner-astar' : 'winner-rl'}">
                ${tied ? 'TIE' : aWins ? 'A*' : 'RL'}</td>`;
    });

    if (winner === 'astar') {
        banner.className = 'winner-banner astar';
        banner.textContent = '🏆 WINNER: A* PATHFINDING';
    } else if (winner === 'rl') {
        banner.className = 'winner-banner rl';
        banner.textContent = '🏆 WINNER: Q-LEARNING RL';
    } else {
        banner.className = 'winner-banner tie';
        banner.textContent = '🤝 TIE — EQUAL PERFORMANCE';
    }
}

// ===== UI UPDATE =====
function updateUI() {
    if (!currentGameState) return;
    scoreEl.textContent = currentGameState.score;
    stepsEl.textContent = currentGameState.steps;
    efficiencyEl.textContent = currentGameState.steps > 0
        ? (currentGameState.score / currentGameState.steps * 100).toFixed(1) + '%'
        : '—';
    drawGame();
}

function setStatus(text, type) {
    gameStatusEl.textContent = text;
    gameStatusEl.className = `status-bar status-${type}`;
}

function showOverlay(text, color) {
    overlayText.textContent = text;
    overlayText.style.color = color || 'var(--text)';
    overlayMsg.style.display = 'flex';
}

function hideOverlay() { overlayMsg.style.display = 'none'; }

// ===== CANVAS DRAWING =====
function drawGame() {
    if (!currentGameState) return;

    ctx.fillStyle = '#F7F4EF';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.strokeStyle = '#E6E1D9';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.beginPath(); ctx.moveTo(i * CELL_SIZE, 0); ctx.lineTo(i * CELL_SIZE, CANVAS_SIZE); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * CELL_SIZE); ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE); ctx.stroke();
    }

    const { snake, food } = currentGameState;

    // Food — rose circle
    const fx = food[0] * CELL_SIZE + CELL_SIZE / 2;
    const fy = food[1] * CELL_SIZE + CELL_SIZE / 2;
    ctx.fillStyle = '#F2C6DE';
    ctx.strokeStyle = '#e0a8c8';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(fx, fy, CELL_SIZE / 2 - 4, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Snake — mint
    snake.forEach((seg, i) => {
        const x = seg[0] * CELL_SIZE + 2;
        const y = seg[1] * CELL_SIZE + 2;
        const w = CELL_SIZE - 4;
        const t = i / Math.max(1, snake.length - 1);

        if (i === 0) {
            ctx.fillStyle = '#5aaa92';
            ctx.strokeStyle = '#3d8a72';
        } else {
            const alpha = 1 - t * 0.5;
            ctx.fillStyle = `rgba(201,228,222,${alpha + 0.3})`;
            ctx.strokeStyle = `rgba(90,170,146,${alpha * 0.6})`;
        }
        ctx.lineWidth = 1;
        roundRect(ctx, x, y, w, w, i === 0 ? 5 : 3);
        ctx.fill(); ctx.stroke();
    });
}

function roundRect(cx, x, y, w, h, r) {
    cx.beginPath();
    cx.moveTo(x + r, y);
    cx.lineTo(x + w - r, y); cx.arcTo(x + w, y, x + w, y + r, r);
    cx.lineTo(x + w, y + h - r); cx.arcTo(x + w, y + h, x + w - r, y + h, r);
    cx.lineTo(x + r, y + h); cx.arcTo(x, y + h, x, y + h - r, r);
    cx.lineTo(x, y + r); cx.arcTo(x, y, x + r, y, r);
    cx.closePath();
}

// ===== HISTORY CHART =====
function drawHistoryChart() {
    const c = document.getElementById('historyChart');
    const cx = c.getContext('2d');
    const W = c.width, H = c.height;

    cx.fillStyle = '#F2F6F4';
    cx.fillRect(0, 0, W, H);

    if (!scoreHistory || scoreHistory.length < 1) {
        cx.fillStyle = '#6F6660';
        cx.font = '12px Inter, system-ui';
        cx.textAlign = 'center';
        cx.fillText('Play games to see history', W / 2, H / 2 + 4);
        return;
    }

    const max = Math.max(...scoreHistory, 1);
    const barW = Math.max(4, Math.floor((W - 20) / scoreHistory.length) - 2);
    const totalW = scoreHistory.length * (barW + 2);
    const startX = Math.max(5, (W - totalW) / 2);

    scoreHistory.forEach((score, i) => {
        const h = Math.max(3, (score / max) * (H - 16));
        const x = startX + i * (barW + 2);
        const y = H - 8 - h;
        const alpha = 0.35 + 0.65 * (i / scoreHistory.length);
        cx.fillStyle = `rgba(90,170,146,${alpha})`;
        roundRect(cx, x, y, barW, h, 2);
        cx.fill();
    });

    // Latest score label
    const last = scoreHistory[scoreHistory.length - 1];
    cx.fillStyle = '#5aaa92';
    cx.font = 'bold 11px Inter, system-ui';
    cx.textAlign = 'right';
    cx.fillText(`Latest: ${last}`, W - 6, 14);
}

// ===== REWARD CHART =====
function drawRewardChart() {
    const c = document.getElementById('rewardChart');
    const cx = c.getContext('2d');
    const W = c.width, H = c.height;

    cx.fillStyle = '#F7F4EF';
    cx.fillRect(0, 0, W, H);

    if (!rewardHistory || rewardHistory.length < 2) return;

    const max = Math.max(...rewardHistory, 1);
    const pts = rewardHistory.map((v, i) => [
        (i / (rewardHistory.length - 1)) * (W - 20) + 10,
        H - 10 - (v / max) * (H - 20)
    ]);

    const grad = cx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(201,228,222,0.8)');
    grad.addColorStop(1, 'rgba(201,228,222,0.05)');

    cx.beginPath();
    cx.moveTo(pts[0][0], H - 10);
    pts.forEach(([x, y]) => cx.lineTo(x, y));
    cx.lineTo(pts[pts.length - 1][0], H - 10);
    cx.closePath();
    cx.fillStyle = grad;
    cx.fill();

    cx.beginPath();
    cx.moveTo(pts[0][0], pts[0][1]);
    pts.forEach(([x, y]) => cx.lineTo(x, y));
    cx.strokeStyle = '#5aaa92';
    cx.lineWidth = 2;
    cx.stroke();

    // Label
    cx.fillStyle = '#6F6660';
    cx.font = '10px Inter, system-ui';
    cx.textAlign = 'left';
    cx.fillText(`Score curve over ${rewardHistory.length * 100} episodes`, 10, 12);
}

// ===== TIMER =====
function resetTimer() {
    startTime = null;
    elapsedTime = 0;
    timeEl.textContent = '0.0s';
}

function updateTimer() {
    if (!startTime) startTime = Date.now();
    elapsedTime = (Date.now() - startTime) / 1000;
    timeEl.textContent = elapsedTime.toFixed(1) + 's';
}

// ===== BOOT =====
document.addEventListener('DOMContentLoaded', () => {
    drawHistoryChart();
    init();
});