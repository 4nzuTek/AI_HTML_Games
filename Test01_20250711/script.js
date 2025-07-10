const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let x = canvas.width / 2;
let y = canvas.height - 30;
const ballSpeed = 1; // ボールスピードを一つの変数で制御
let dx = ballSpeed;
let dy = -ballSpeed;
const ballRadius = 10;

const paddleHeight = 10;
const paddleWidth = 75;
let paddleX = (canvas.width - paddleWidth) / 2;

let rightPressed = false;
let leftPressed = false;

const brickRowCount = 3;
const brickColumnCount = 5;
const brickWidth = 75;
const brickHeight = 20;
const brickPadding = 10;
const brickOffsetTop = 30;
const brickOffsetLeft = 30;

let score = 0;
let gameRunning = false; // Game state flag

const bricks = [];
function initBricks() {
    for (let c = 0; c < brickColumnCount; c++) {
        bricks[c] = [];
        for (let r = 0; r < brickRowCount; r++) {
            bricks[c][r] = { x: 0, y: 0, status: 1 };
        }
    }
}
initBricks(); // Initialize bricks on game load

document.addEventListener('keydown', keyDownHandler, false);
document.addEventListener('keyup', keyUpHandler, false);
document.addEventListener('mousemove', mouseMoveHandler, false);
canvas.addEventListener('click', clickHandler, false); // Add click listener for game start

function keyDownHandler(e) {
    if (e.key == 'Right' || e.key == 'ArrowRight') {
        rightPressed = true;
    }
    else if (e.key == 'Left' || e.key == 'ArrowLeft') {
        leftPressed = true;
    }
}

function keyUpHandler(e) {
    if (e.key == 'Right' || e.key == 'ArrowRight') {
        rightPressed = false;
    }
    else if (e.key == 'Left' || e.key == 'ArrowLeft') {
        leftPressed = false;
    }
}

function mouseMoveHandler(e) {
    const relativeX = e.clientX - canvas.offsetLeft;
    if (relativeX > 0 && relativeX < canvas.width) {
        paddleX = relativeX - paddleWidth / 2;
    }
}

function clickHandler() {
    if (!gameRunning) {
        gameRunning = true;
        // Optionally, start the game loop here if it's not already running via requestAnimationFrame
        // For now, requestAnimationFrame(draw) is called continuously, so just setting gameRunning is enough.
    }
}

function resetGame() {
    x = canvas.width / 2;
    y = canvas.height - 30;
    dx = ballSpeed;
    dy = -ballSpeed;
    paddleX = (canvas.width - paddleWidth) / 2;
    score = 0;
    initBricks(); // Re-initialize bricks for a new game
    gameRunning = false; // Set game to not running, waiting for click
}

function collisionDetection() {
    for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
            const b = bricks[c][r];
            if (b.status == 1) {
                if (x > b.x && x < b.x + brickWidth && y > b.y && y < b.y + brickHeight) {
                    dy = -dy;
                    b.status = 0;
                    score++;
                    if (score == brickRowCount * brickColumnCount) {
                        alert("YOU WIN, CONGRATULATIONS!");
                        resetGame(); // Reset game instead of reloading
                    }
                }
            }
        }
    }
}

function drawBall() {
    ctx.beginPath();
    ctx.arc(x, y, ballRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#0095DD';
    ctx.fill();
    ctx.closePath();
}

function drawPaddle() {
    ctx.beginPath();
    ctx.rect(paddleX, canvas.height - paddleHeight, paddleWidth, paddleHeight);
    ctx.fillStyle = '#0095DD';
    ctx.fill();
    ctx.closePath();
}

function drawBricks() {
    for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
            if (bricks[c][r].status == 1) {
                const brickX = (c * (brickWidth + brickPadding)) + brickOffsetLeft;
                const brickY = (r * (brickHeight + brickPadding)) + brickOffsetTop;
                bricks[c][r].x = brickX;
                bricks[c][r].y = brickY;
                ctx.beginPath();
                ctx.rect(brickX, brickY, brickWidth, brickHeight);
                ctx.fillStyle = '#0095DD';
                ctx.fill();
                ctx.closePath();
            }
        }
    }
}

function drawScore() {
    ctx.font = "16px Arial";
    ctx.fillStyle = "#0095DD";
    ctx.fillText("Score: " + score, 8, 20);
}

function drawStartMessage() {
    ctx.font = "24px Arial";
    ctx.fillStyle = "#0095DD";
    ctx.textAlign = "center";
    ctx.fillText("Click to Start", canvas.width / 2, canvas.height / 2);
    ctx.textAlign = "left"; // Reset text alignment for other drawings
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBricks();
    drawBall();
    drawPaddle();
    drawScore();

    if (!gameRunning) {
        drawStartMessage();
        requestAnimationFrame(draw); // Keep drawing to show message
        return; // Stop game logic if not running
    }

    collisionDetection();

    if (x + dx > canvas.width - ballRadius || x + dx < ballRadius) {
        dx = -dx;
    }
    if (y + dy < ballRadius) {
        dy = -dy;
    } else if (y + dy > canvas.height - paddleHeight - ballRadius + 5) { // パドルの上端で判定
        if (x > paddleX && x < paddleX + paddleWidth) {
            // まず通常の反射を行う
            dy = -dy;

            // パドルのどの部分に当たったかを計算（0.0 から 1.0 の値）
            const hitPosition = (x - paddleX) / paddleWidth;

            // パドル位置による角度調整（-80度から+80度の範囲に制限）
            const maxAngleAdjustment = 80;
            const angleAdjustment = (hitPosition - 0.5) * 2 * maxAngleAdjustment;

            // 現在の速度を計算
            const speed = Math.sqrt(dx * dx + dy * dy);

            // 現在の角度を計算（上向きを基準とする）
            const currentAngle = Math.atan2(dx, -dy) * 180 / Math.PI;

            // 調整後の角度を計算
            let newAngle = currentAngle + angleAdjustment;

            // 角度を制限：-75度から+75度の範囲に制限（下向きを防ぐ）
            const minAngle = -75;
            const maxAngle = 75;
            newAngle = Math.max(minAngle, Math.min(maxAngle, newAngle));

            const newAngleRad = newAngle * Math.PI / 180;

            // 新しい速度ベクトルを計算
            dx = speed * Math.sin(newAngleRad);
            dy = -speed * Math.cos(newAngleRad);

            // 下向きの動きを完全に防ぐクリッピング
            if (dy > 0) {
                dy = -Math.abs(dy);
            }

            // 最小速度を保証
            const minSpeed = ballSpeed;
            if (Math.abs(dx) < minSpeed) {
                dx = dx > 0 ? minSpeed : -minSpeed;
            }
            if (Math.abs(dy) < minSpeed) {
                dy = -minSpeed; // 必ず上向きにする
            }
        } else if (y + dy > canvas.height - paddleHeight - ballRadius + 40) { // ゲームオーバー判定（パドル上端より5ピクセル下）
            alert('GAME OVER. Your score: ' + score);
            resetGame(); // Reset game instead of reloading
        }
    }

    if (rightPressed && paddleX < canvas.width - paddleWidth) {
        paddleX += 7;
    } else if (leftPressed && paddleX > 0) {
        paddleX -= 7;
    }

    x += dx;
    y += dy;
    requestAnimationFrame(draw);
}

draw();
