// キャンバスとコンテキストの取得
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ゲーム状態
let gameRunning = false;
let gameStartTime = 0;
let survivalTime = 0.00;
let mouseNearPlayer = false; // マウスが自機に近いかどうか
let highScore = 0.00; // ハイスコア

// プレイヤー（宇宙船）
const player = {
    x: 360,
    y: 600,
    radius: 10,
    speed: 6
};

// 弾幕配列
let bullets = [];

// キー入力状態（削除予定）

// 弾幕生成タイマー
let bulletSpawnTimer = 0;
let bulletSpawnInterval = 30;

// 弾幕パターン
const bulletPatterns = ['straight', 'spiral', 'circle', 'random'];

// 初期化
function init() {
    loadHighScore(); // ハイスコアを読み込み
    resetGame();
    setupEventListeners();
    gameLoop();
}

// ゲームリセット
function resetGame() {
    gameRunning = false;
    gameStartTime = 0;
    survivalTime = 0.00;
    mouseNearPlayer = false;
    player.x = 360;
    player.y = 600;
    bullets = [];
    bulletSpawnTimer = 0;
    bulletSpawnInterval = 30; // リセット時に間隔も元に戻す
    updateUI();
}

// イベントリスナーの設定
function setupEventListeners() {
    // マウスイベント
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        if (gameRunning) {
            player.x = mouseX;
            player.y = mouseY;

            // 境界内に制限
            player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
            player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));
        } else {
            // ゲーム開始前はマウスが自機に近いかチェック
            const distance = Math.sqrt(
                Math.pow(mouseX - player.x, 2) +
                Math.pow(mouseY - player.y, 2)
            );
            mouseNearPlayer = distance <= player.radius * 4; // 判定範囲を広く
        }
    });

    // ゲーム開始（プレイヤー自機の近くをクリックする必要がある）
    canvas.addEventListener('click', (e) => {
        if (!gameRunning) {
            const rect = canvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;

            // プレイヤー自機との距離を計算
            const distance = Math.sqrt(
                Math.pow(clickX - player.x, 2) +
                Math.pow(clickY - player.y, 2)
            );

            // プレイヤー自機の半径の4倍以内をクリックした場合のみゲーム開始
            if (distance <= player.radius * 4) {
                gameRunning = true;
                gameStartTime = Date.now();
            }
        }
    });
}

// プレイヤーの移動（マウス追従のみ）
function updatePlayer() {
    // マウス追従はmousemoveイベントで処理済み
}

// 弾幕の生成
function spawnBullets() {
    bulletSpawnTimer++;
    if (bulletSpawnTimer >= bulletSpawnInterval) {
        const pattern = bulletPatterns[Math.floor(Math.random() * bulletPatterns.length)];
        createBulletPattern(pattern);
        bulletSpawnTimer = 0;

        // 時間経過とともに生成頻度を上げる
        if (bulletSpawnInterval > 10) {
            bulletSpawnInterval -= 0.1;
        }
    }
}

// 弾幕パターンの作成
function createBulletPattern(pattern) {
    const baseX = Math.random() * canvas.width;
    const baseY = -20;

    switch (pattern) {
        case 'straight':
            // 直線下降
            for (let i = 0; i < 3; i++) {
                bullets.push({
                    x: baseX + i * 30,
                    y: baseY,
                    vx: 0,
                    vy: 3 + Math.random() * 2,
                    radius: 3
                });
            }
            break;

        case 'spiral':
            // 螺旋パターン
            for (let i = 0; i < 5; i++) {
                const angle = (i / 5) * Math.PI * 2;
                bullets.push({
                    x: baseX + Math.cos(angle) * 20,
                    y: baseY + i * 10,
                    vx: Math.cos(angle) * 2,
                    vy: 3 + Math.random() * 2,
                    radius: 3,
                    angle: angle,
                    spiralRadius: 20
                });
            }
            break;

        case 'circle':
            // 円形パターン
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                bullets.push({
                    x: baseX,
                    y: baseY,
                    vx: Math.cos(angle) * 3,
                    vy: Math.sin(angle) * 3 + 2,
                    radius: 3
                });
            }
            break;

        case 'random':
            // ランダムパターン
            for (let i = 0; i < 4; i++) {
                bullets.push({
                    x: baseX + Math.random() * 100 - 50,
                    y: baseY,
                    vx: (Math.random() - 0.5) * 4,
                    vy: 2 + Math.random() * 3,
                    radius: 3
                });
            }
            break;
    }
}

// 弾幕の更新
function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];

        // 螺旋パターンの特別処理
        if (bullet.spiralRadius !== undefined) {
            bullet.angle += 0.1;
            bullet.x += Math.cos(bullet.angle) * 0.5;
            bullet.y += bullet.vy;
        } else {
            // 通常の移動
            bullet.x += bullet.vx;
            bullet.y += bullet.vy;
        }

        // 画面外に出た弾を削除
        if (bullet.y > canvas.height + 20 ||
            bullet.x < -20 ||
            bullet.x > canvas.width + 20) {
            bullets.splice(i, 1);
            continue;
        }

        // プレイヤーとの衝突判定
        const distance = Math.sqrt(
            Math.pow(bullet.x - player.x, 2) +
            Math.pow(bullet.y - player.y, 2)
        );

        if (distance < bullet.radius + player.radius) {
            gameOver();
            return;
        }
    }
}

// ハイスコアの読み込み
function loadHighScore() {
    const saved = localStorage.getItem('bulletHellHighScore');
    if (saved) {
        highScore = parseFloat(saved);
    }
}

// ハイスコアの保存
function saveHighScore(score) {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('bulletHellHighScore', highScore.toString());
        return true; // 新しいハイスコア
    }
    return false; // ハイスコア更新なし
}

// ゲームオーバー
function gameOver() {
    const finalTime = (Date.now() - gameStartTime) / 1000;
    const isNewRecord = saveHighScore(finalTime);

    let message = `GAME OVER. Survival Time: ${finalTime.toFixed(2)}s`;
    if (isNewRecord) {
        message += '\n🎉 NEW HIGH SCORE! 🎉';
    }

    alert(message);
    resetGame();
}

// UI更新
function updateUI() {
    if (gameRunning) {
        survivalTime = (Date.now() - gameStartTime) / 1000; // 小数点以下も含める
    }
    document.getElementById('score').textContent = survivalTime.toFixed(2); // 0.01秒まで表示
    document.getElementById('highscore').textContent = highScore.toFixed(2); // ハイスコア表示
}

// 描画関数
function draw() {
    // 背景をクリア
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // プレイヤー（宇宙船）を描画
    let currentRadius = player.radius;
    let currentColor = '#00FF00';

    if (!gameRunning && mouseNearPlayer) {
        // ゲーム開始前でマウスが近い場合は滑らかな変化
        const time = Date.now() * 0.02;
        const scale = Math.sin(time) * 0.3 + 1.0; // 0.7倍〜1.3倍の滑らかな変化
        const colorBlend = Math.sin(time) * 0.5 + 0.5; // 0〜1の滑らかな変化

        // 緑色と黄色の滑らかなブレンド
        const green = Math.floor(255 * (1 - colorBlend));
        const red = Math.floor(255 * colorBlend);
        currentColor = `rgb(${red}, 255, ${green})`;

        currentRadius = player.radius * scale; // 滑らかなサイズ変化
    }

    ctx.fillStyle = currentColor;
    ctx.beginPath();
    ctx.arc(player.x, player.y, currentRadius, 0, Math.PI * 2);
    ctx.fill();

    // 弾幕を描画
    ctx.fillStyle = '#FF0000';
    bullets.forEach(bullet => {
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fill();
    });

    // ゲーム停止時のメッセージ
    if (!gameRunning) {
        ctx.fillStyle = '#FFF';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Click near the player to Start', canvas.width / 2, canvas.height / 2);
        ctx.font = '16px Arial';
        ctx.fillText('Use Mouse to Move', canvas.width / 2, canvas.height / 2 + 40);
    }
}

// ゲームループ
function gameLoop() {
    if (gameRunning) {
        updatePlayer();
        spawnBullets();
        updateBullets();
        updateUI();
    }

    draw();
    requestAnimationFrame(gameLoop);
}

// ゲーム開始
init(); 