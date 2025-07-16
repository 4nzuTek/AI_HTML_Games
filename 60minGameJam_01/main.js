// --- 設定値 ---
const FRICTION = 0.995;      // 摩擦係数（1.0で摩擦なし、0.99で強い摩擦）
const MIN_BALL_SPEED = 1.0;  // ボールの最低速度
const MAX_BALL_SPEED = 10;   // ボールの最高速度
const BOUNCE_POWER = 1.5;    // パドル反発力（大きいほど強く跳ね返る）
const PADDLE_FREEZE_TIME = 0.01; // パドル凍結時間（秒）
const BOUNCE_NOISE_DEG = 8; // 反発時のノイズ角度（度数、0でノイズなし）

// --- 定数 ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// パドル（横長の棒）
const paddle = {
    x: 1200 / 2,
    y: 720 - 40,
    width: 100,
    height: 18,
    prevX: 1200 / 2,
    prevY: 720 - 40,
    vx: 0,
    vy: 0,
    angle: 0, // 角度（ラジアン）
};

let isRotateMode = false;
let lastMouseX = paddle.x;
let isPaddleFrozen = false;
let paddleFreezeTimer = null;
let frozenCursorX = null;
let frozenCursorY = null;
let needSyncCursor = false;
let isGameOver = false;
let minBallSpeed = MIN_BALL_SPEED; // 現在の最低速度
const MIN_BALL_SPEED_INCREASE_PER_SEC = 0.1; // 1秒あたりの増加量
let lastSpeedUpdateTime = Date.now();
let score = 0;
let highScore = Number(localStorage.getItem('highScore') || 0);
let isWaitingStart = true;

function showGameOverDialog() {
    // ダイアログの重複生成防止
    if (document.getElementById('gameOverDialog')) return;
    let isNewHighScore = false;
    // ハイスコア更新判定
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('highScore', String(highScore));
        isNewHighScore = true;
    }
    const dialog = document.createElement('div');
    dialog.id = 'gameOverDialog';
    dialog.style.position = 'fixed';
    dialog.style.left = '0';
    dialog.style.top = '0';
    dialog.style.width = '100vw';
    dialog.style.height = '100vh';
    dialog.style.background = 'rgba(0,0,0,0.7)';
    dialog.style.display = 'flex';
    dialog.style.flexDirection = 'column';
    dialog.style.justifyContent = 'center';
    dialog.style.alignItems = 'center';
    dialog.style.zIndex = '1000';
    dialog.innerHTML = `
        <div style="background:#222;padding:32px 48px;border-radius:16px;box-shadow:0 0 32px #000;text-align:center;">
            <h2 style="color:#fff;margin-bottom:24px;">ゲームオーバー</h2>
            <div style=\"color:#fff;font-size:1.3em;margin-bottom:${isNewHighScore ? '12px' : '24px'};\">Score: ${score.toFixed(0)}</div>
            ${isNewHighScore ? `<div style=\"color:#ff0;font-size:1.1em;margin-bottom:24px;\">High Score: ${highScore.toFixed(0)}</div>` : ''}
            <button id=\"retryBtn\" style=\"font-size:1.2em;padding:8px 32px;border-radius:8px;border:none;background:#0ff;color:#222;cursor:pointer;\">リトライ</button>
        </div>
    `;
    document.body.appendChild(dialog);
    document.getElementById('retryBtn').onclick = () => {
        dialog.remove();
        restartGame();
    };
}

function showStartOverlay() {
    if (document.getElementById('startOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'startOverlay';
    overlay.style.position = 'fixed';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(0,0,0,0.5)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '1000';
    overlay.style.cursor = 'pointer';
    overlay.innerHTML = `<div style="color:#fff;font-size:2.2em;font-family:'Press Start 2P',Consolas,monospace;text-shadow:0 2px 8px #000,0 0 32px #0ff;user-select:none;">クリックしてスタート</div>`;
    overlay.onclick = () => {
        overlay.remove();
        isWaitingStart = false;
        // ボールを発射（真下にゆっくり）
        ball.vx = 0;
        ball.vy = 1;
    };
    document.body.appendChild(overlay);
}

function restartGame() {
    // ボールとパドルの初期化
    ball.x = canvas.width / 2; // 画面中央
    ball.y = canvas.height * 1 / 5; // 画面中央
    ball.vx = 0;  // 停止
    ball.vy = 1;
    paddle.x = 1200 / 2;
    paddle.y = canvas.height * 1 / 2;
    paddle.angle = 0;
    isGameOver = false;
    isPaddleFrozen = false;
    needSyncCursor = false;
    minBallSpeed = MIN_BALL_SPEED;
    lastSpeedUpdateTime = Date.now();
    score = 0;
    isWaitingStart = true;
    showStartOverlay();
}

// --- Pointer Lock（マウス固定） ---
function requestPointerLock() {
    canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;
    if (canvas.requestPointerLock) canvas.requestPointerLock();
}
function exitPointerLock() {
    document.exitPointerLock = document.exitPointerLock || document.mozExitPointerLock;
    if (document.exitPointerLock) document.exitPointerLock();
}

document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== canvas) {
        isRotateMode = false;
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') {
        if (!isRotateMode) {
            isRotateMode = true;
            requestPointerLock();
        }
    }
});
document.addEventListener('keyup', (e) => {
    if (e.key === 'r' || e.key === 'R') {
        isRotateMode = false;
        exitPointerLock();
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (isPaddleFrozen) {
        // 凍結中はパドル座標を固定
        if (frozenCursorX !== null && frozenCursorY !== null) {
            paddle.x = frozenCursorX;
            paddle.y = frozenCursorY;
        }
        return;
    }
    if (needSyncCursor) {
        // 凍結解除後、最初のマウス移動でパドルをカーソル位置に同期
        const rect = canvas.getBoundingClientRect();
        paddle.x = e.clientX - rect.left;
        paddle.y = e.clientY - rect.top;
        needSyncCursor = false;
        return;
    }
    if (isRotateMode && document.pointerLockElement === canvas) {
        // 回転モード：マウスの移動量でパドルを回転
        paddle.angle += e.movementX * 0.01; // 回転感度
    } else if (!isRotateMode) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        paddle.x = mx;
        paddle.y = my;
    }
});

// ボール
const ball = {
    x: 1200 / 2,
    y: 720 / 2,
    prevX: 1200 / 2,
    prevY: 720 / 2,
    radius: 16,
    vx: 4,
    vy: -3,
};

// --- パドル線分の両端座標を計算する関数 ---
function getPaddleEndpoints(paddle) {
    const hw = paddle.width / 2;
    const angle = paddle.angle;
    return {
        x1: paddle.x + Math.cos(angle) * hw,
        y1: paddle.y + Math.sin(angle) * hw,
        x2: paddle.x - Math.cos(angle) * hw,
        y2: paddle.y - Math.sin(angle) * hw,
    };
}

// --- 点(px,py)から線分(x1,y1)-(x2,y2)への最近点・距離を計算 ---
function closestPointOnSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return { x: x1, y: y1, dist: Math.hypot(px - x1, py - y1) };
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    const dist = Math.hypot(px - projX, py - projY);
    return { x: projX, y: projY, dist };
}

// --- ベクトルを法線で反射させる関数 ---
function reflectVector(vx, vy, nx, ny) {
    // 法線ベクトルは正規化されている前提
    const dot = vx * nx + vy * ny;
    return {
        vx: vx - 2 * dot * nx,
        vy: vy - 2 * dot * ny,
    };
}

// --- 更新処理 ---
function update() {
    if (isGameOver) return;
    if (isWaitingStart) return;
    // ボールの前回位置を保存
    ball.prevX = ball.x;
    ball.prevY = ball.y;
    // パドル速度計算
    paddle.vx = paddle.x - paddle.prevX;
    paddle.vy = paddle.y - paddle.prevY;
    paddle.prevX = paddle.x;
    paddle.prevY = paddle.y;
    // ボール移動
    ball.x += ball.vx;
    ball.y += ball.vy;
    // 摩擦適用
    ball.vx *= FRICTION;
    ball.vy *= FRICTION;
    // --- MIN_BALL_SPEEDを時間経過で上昇 ---
    const now = Date.now();
    const dt = (now - lastSpeedUpdateTime) / 1000;
    if (dt > 0) {
        minBallSpeed += MIN_BALL_SPEED_INCREASE_PER_SEC * dt;
        lastSpeedUpdateTime = now;
    }
    // 速度制限（最高・最低速度）
    let speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (speed > MAX_BALL_SPEED) {
        ball.vx = (ball.vx / speed) * MAX_BALL_SPEED;
        ball.vy = (ball.vy / speed) * MAX_BALL_SPEED;
        speed = MAX_BALL_SPEED;
    }
    if (speed < minBallSpeed) {
        ball.vx = (ball.vx / speed) * minBallSpeed;
        ball.vy = (ball.vy / speed) * minBallSpeed;
        speed = minBallSpeed;
    }
    // 壁反射
    if (ball.x - ball.radius < 0 || ball.x + ball.radius > canvas.width) {
        isGameOver = true;
        showGameOverDialog();
        return;
    }
    if (ball.y - ball.radius < 0 || ball.y + ball.radius > canvas.height) {
        isGameOver = true;
        showGameOverDialog();
        return;
    }
    // --- パドル（棒）とボールの衝突判定・反射 ---
    const { x1, y1, x2, y2 } = getPaddleEndpoints(paddle);
    const closest = closestPointOnSegment(ball.x, ball.y, x1, y1, x2, y2);
    if (closest.dist < ball.radius) {
        // パドル線分の法線ベクトル
        const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
        let nx = dy / len, ny = -dx / len; // 法線（正規化）
        // ボール中心→パドル最近点の方向で法線を決定
        const toBallX = ball.x - closest.x;
        const toBallY = ball.y - closest.y;
        if (nx * toBallX + ny * toBallY < 0) {
            nx = -nx;
            ny = -ny;
        }
        // ボール速度・パドル速度を法線方向に分解
        const vBallN = ball.vx * nx + ball.vy * ny;
        const vPadN = paddle.vx * nx + paddle.vy * ny;
        // 法線方向は反射（-vBallN）＋パドルの法線速度を加味
        const newVn = (-vBallN + vPadN) * BOUNCE_POWER;
        // 接線方向はそのまま
        const tx = dx / len, ty = dy / len;
        const vBallT = ball.vx * tx + ball.vy * ty;
        // 合成して新しい速度ベクトル
        let newVx = newVn * nx + vBallT * tx;
        let newVy = newVn * ny + vBallT * ty;
        // --- ノイズ角度を加える ---
        if (BOUNCE_NOISE_DEG > 0) {
            const noiseRad = (Math.random() - 0.5) * 2 * (BOUNCE_NOISE_DEG * Math.PI / 180);
            const speed = Math.sqrt(newVx * newVx + newVy * newVy);
            const angle = Math.atan2(newVy, newVx) + noiseRad;
            newVx = Math.cos(angle) * speed;
            newVy = Math.sin(angle) * speed;
        }
        ball.vx = newVx;
        ball.vy = newVy;
        // 少し外側に押し出す
        ball.x = closest.x + nx * (ball.radius + 1);
        ball.y = closest.y + ny * (ball.radius + 1);
        // パドル凍結処理
        if (!isPaddleFrozen) {
            isPaddleFrozen = true;
            if (paddleFreezeTimer) clearTimeout(paddleFreezeTimer);
            // カーソル座標を記録
            frozenCursorX = paddle.x;
            frozenCursorY = paddle.y;
            paddleFreezeTimer = setTimeout(() => {
                isPaddleFrozen = false;
                needSyncCursor = true;
            }, PADDLE_FREEZE_TIME * 1000);
        }
    }
    // --- ここまで ---
    // スコア加算（前回位置からの移動距離を加算）
    score += Math.hypot(ball.x - ball.prevX, ball.y - ball.prevY);
}

// --- 描画処理 ---
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // --- Score/High Score（左下、最背面） ---
    ctx.save();
    ctx.font = 'bold 18px "Press Start 2P", "Consolas", monospace';
    ctx.fillStyle = '#ff0';
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 4;
    const highScoreText = `High Score: ${highScore.toFixed(0)}`;
    const x = 32;
    const y = canvas.height - 64;
    ctx.strokeText(highScoreText, x, y);
    ctx.fillText(highScoreText, x, y);
    ctx.restore();

    ctx.save();
    ctx.font = 'bold 32px "Press Start 2P", "Consolas", monospace';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 4;
    const scoreText = `Score: ${score.toFixed(0)}`;
    const y2 = canvas.height - 32;
    ctx.strokeText(scoreText, x, y2);
    ctx.fillText(scoreText, x, y2);
    ctx.restore();
    // --- Ball Speed（左上、最背面） ---
    ctx.save();
    ctx.font = '28px Consolas, monospace'; // ピコピコフォント風、細め
    ctx.fillStyle = '#888'; // 明るい灰色
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 4;
    const ballSpeedText = `Ball Speed : ${minBallSpeed.toFixed(2)}`;
    ctx.strokeText(ballSpeedText, 32, 48);
    ctx.fillText(ballSpeedText, 32, 48);
    ctx.restore();
    if (isGameOver) {
        // ゲームオーバー時は画面を暗くする
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    // --- 壁（赤色の点線）を描画 ---
    ctx.save();
    ctx.strokeStyle = '#f00';
    ctx.lineWidth = 8;
    ctx.setLineDash([16, 12]); // 赤の点線
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(canvas.width, 0);
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]); // リセット
    ctx.restore();

    // パドル（横長の棒、回転対応）
    ctx.save();
    ctx.translate(paddle.x, paddle.y);
    ctx.rotate(paddle.angle);
    ctx.beginPath();
    ctx.rect(-paddle.width / 2, -paddle.height / 2, paddle.width, paddle.height);
    ctx.fillStyle = '#0ff';
    ctx.shadowColor = '#0ff';
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // ボール
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#0ff';
    ctx.lineWidth = 2;
    ctx.stroke();
}

// --- ゲームループ ---
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// 最初の初期化
restartGame();

gameLoop(); 