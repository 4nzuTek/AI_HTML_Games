// ===== Photon Fusion を使ったミニFPS =====
// Photon設定
const PHOTON_APP_ID = "d2b05894-f70e-4fbd-b86e-f96c9837017f";
let photonClient = null;
let isHost = false;
let connectedPlayers = new Map();
let nextPlayerColorIndex = 0; // Host manages color assignment order

// ゲーム設定
const WORLD_SIZE = 120;
const PLAYER_EYE_HEIGHT = 1.7;
const WALK_SPEED = 6;            // 歩行速度 m/s
const SPRINT_MULTIPLIER = 1.6;   // 走行速度倍率
const JUMP_SPEED = 6.5;          // ジャンプ力
const GRAVITY = 18;              // 重力 m/s^2
const FIRE_COOLDOWN_S = 0.08;    // 発射間隔（秒） フルオート射撃
const MAG_SIZE = 30;             // マガジン弾数
const RESERVE_START = 300;       // 初期予備弾数
const RELOAD_TIME_S = 1.1;       // リロード時間（秒）
const MOUSE_SENSITIVITY = 0.002; // マウス感度（標準FPS感度）

// ダメージ方向インジケーター設定
const DAMAGE_INDICATOR_DURATION = 2.0; // インジケーター表示時間（秒）
const DAMAGE_INDICATOR_RADIUS = 80;    // インジケーターの半径（ピクセル）
const DAMAGE_INDICATOR_DISTANCE = 100; // 画面中心からの距離（ピクセル）

// ヒットマーカー設定
const HITMARKER_DURATION = 0.15; // ヒットマーカー表示時間（秒）
const HITMARKER_SIZE = 60;      // ヒットマーカーサイズ（ピクセル）
const HITMARKER_THICKNESS = 4;  // ヒットマーカーの線の太さ（ピクセル）
const HITMARKER_GAP = 12;       // 中心の空白部分のサイズ（ピクセル）

// 反動設定（調整可能）
const RECOIL_INTENSITY = 0.015;  // 基本反動の強さ（ラジアン）
const RECOIL_EASING_SPEED = 30.0; // 反動到達速度（大きいほど速い）
const RECOIL_EASE_IN_POWER = 5.0;  // イーズイン強度（大きいほど急激な開始）
const RECOIL_EASE_OUT_POWER = 0.3; // イーズアウト強度（小さいほど滑らかな終了）

// ランダム反動設定
const RECOIL_INTENSITY_VARIATION = 0.3; // 反動強度の変動幅（±30%）
const RECOIL_HORIZONTAL_MAX = 0.008; // 最大左右反動（ラジアン）

// 反動蓄積設定（連射時）
const RECOIL_BUILDUP_MIN_MULTIPLIER = 1.0; // 最小反動倍率（100%）
const RECOIL_BUILDUP_MAX_MULTIPLIER = 3.0; // 最大反動倍率（300%）
const RECOIL_BUILDUP_RATE = 2.0; // 1発毎の反動蓄積速度
const RECOIL_BUILDUP_DECAY_RATE = 3.0; // 射撃停止時の反動減衰速度
const RECOIL_BUILDUP_DECAY_DELAY = 0.3; // 減衰開始までの遅延（秒）

// ゲーム状態
let isPaused = true;
let isGameOver = false;
let pointerLocked = false;
let isReloading = false;
let magazine = MAG_SIZE;
let reserveAmmo = RESERVE_START;
let health = 100;
let lastShotAt = 0;
let isThirdPerson = false;

// ダメージ方向インジケーター管理
let damageIndicators = [];

// ヒットマーカー管理
let hitmarkers = [];

// 反動状態
let targetRecoil = 0;         // 目標反動量（縦方向）
let currentRecoil = 0;        // 現在のスムージングされた反動量（縦方向）
let targetHorizontalRecoil = 0; // 目標水平反動量
let currentHorizontalRecoil = 0; // 現在のスムージングされた水平反動量

// 反動蓄積状態
let recoilBuildup = 0;        // 現在の反動蓄積レベル（0から1）
let lastShotTime = 0;         // 最後の射撃時刻（減衰計算用）

// デバッグ設定
let isDebugMenuOpen = false;
let isInvincible = false;

// ダメージ方向インジケータークラス
class DamageIndicator {
    constructor(attackDirection, damage) {
        this.attackDirection = attackDirection.clone().normalize(); // 攻撃方向ベクトル
        this.damage = damage;
        this.birthTime = performance.now() / 1000;
        this.element = this.createIndicatorElement();
        this.updatePosition();
        document.body.appendChild(this.element);
    }

    // インジケーター要素を作成
    createIndicatorElement() {
        const container = document.createElement('div');
        container.className = 'damage-indicator';

        // 円形の背景を作成（円周を表示）
        const circle = document.createElement('div');
        circle.className = 'damage-indicator-circle';
        container.appendChild(circle);

        // 円周上の三角形を作成
        const triangle = document.createElement('div');
        triangle.className = 'damage-indicator-triangle';
        container.appendChild(triangle);

        return container;
    }

    // インジケーターの位置を更新
    updatePosition() {
        const now = performance.now() / 1000;
        const age = now - this.birthTime;
        const lifeRatio = Math.min(1, age / DAMAGE_INDICATOR_DURATION);

        // フェードアウト効果
        const opacity = 1 - lifeRatio;
        this.element.style.opacity = opacity.toString();

        // カメラの前方ベクトルを取得
        const cameraForward = new THREE.Vector3(0, 0, -1);
        cameraForward.applyQuaternion(camera.quaternion);

        // カメラの右方向ベクトルを取得
        const cameraRight = new THREE.Vector3(1, 0, 0);
        cameraRight.applyQuaternion(camera.quaternion);

        // カメラの上方向ベクトルを取得
        const cameraUp = new THREE.Vector3(0, 1, 0);
        cameraUp.applyQuaternion(camera.quaternion);

        // 攻撃方向を正規化
        const attackDir = this.attackDirection.clone().normalize();

        // 攻撃方向をカメラ座標系に変換
        const dotForward = attackDir.dot(cameraForward);
        const dotRight = attackDir.dot(cameraRight);
        const dotUp = attackDir.dot(cameraUp);

        // 画面座標を計算
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        // 距離を計算（ダメージに応じて変化）
        const distance = DAMAGE_INDICATOR_DISTANCE + (this.damage * 2);

        // ダメージに応じてサイズを変更
        const baseSize = window.innerHeight * 0.3; // 30vh
        const size = baseSize + (this.damage * 2);
        this.element.style.width = size + 'px';
        this.element.style.height = size + 'px';

        // インジケーターの位置を画面の真ん中に固定（サイズ変更後のサイズで計算）
        const indicatorX = (window.innerWidth / 2) - (size / 2);
        const indicatorY = (window.innerHeight / 2) - (size / 2);

        this.element.style.left = indicatorX + 'px';
        this.element.style.top = indicatorY + 'px';

        // 円の中心座標を計算
        const circleCenterX = indicatorX + (size / 2);
        const circleCenterY = indicatorY + (size / 2);

        // 攻撃方向の角度を計算（-πからπの範囲）- 右に90度ずらす
        const angle = Math.atan2(dotRight, dotForward) + Math.PI / 2;

        // 円周上の点の位置を計算
        const circleRadius = size * 0.5; // 円の半径（サイズ変更後のサイズで計算）
        const triangleHeight = 24; // 三角形の高さ（px）
        const triangleX = Math.cos(angle) * (circleRadius + triangleHeight * 0.5); // 円周上 + 三角形の高さの半分
        const triangleY = Math.sin(angle) * (circleRadius + triangleHeight * 0.5); // 円周上 + 三角形の高さの半分

        // 三角形の実際の中心座標を計算
        const triangleActualX = circleCenterX + triangleX;
        const triangleActualY = circleCenterY + triangleY;

        // 円周上の三角形を取得して位置と回転を更新
        const triangle = this.element.children[1]; // 円周上の三角形
        const triangleAngle = (angle * 180 / Math.PI) + 90; // 三角形を外側に向ける（90度追加）
        triangle.style.transform = `translate(calc(-50% + ${triangleX}px), calc(-33.33% + ${triangleY}px)) rotate(${triangleAngle}deg)`;



        // ダメージに応じて色を変更
        const intensity = Math.min(255, 100 + (this.damage * 15));
        const circle = this.element.children[0]; // 円形の背景
        const triangleElement = this.element.children[1]; // 円周上の三角形

        // 円形の背景の色を更新
        circle.style.boxShadow = `0 0 ${10 + this.damage}px rgba(${intensity}, 0, 0, ${opacity * 0.3})`;

        // 円周上の三角形の色を更新
        triangleElement.style.borderBottomColor = `rgba(${intensity}, 0, 0, ${opacity * 0.9})`;
        triangleElement.style.filter = `drop-shadow(0 0 ${4 + this.damage}px rgba(${intensity}, 0, 0, ${opacity * 0.7}))`;
    }

    // インジケーターを削除
    destroy() {
        if (this.element && this.element.parentNode) {
            // トランジション効果を無効にして即座に非表示
            this.element.style.transition = 'none';
            this.element.style.opacity = '0';
            this.element.style.display = 'none';

            // DOMから削除
            this.element.parentNode.removeChild(this.element);
        }
    }

    // インジケーターが期限切れかチェック
    isExpired() {
        const now = performance.now() / 1000;
        return (now - this.birthTime) > DAMAGE_INDICATOR_DURATION;
    }
}

// ダメージ方向インジケーターを追加
function addDamageIndicator(attackPosition, damage) {
    // 攻撃方向を計算（プレイヤー位置から攻撃位置へのベクトル）
    const attackDirection = new THREE.Vector3();
    attackDirection.subVectors(playerPosition, attackPosition);

    // 攻撃方向が有効な場合のみインジケーターを作成
    if (attackDirection.length() > 0.1) {
        const indicator = new DamageIndicator(attackDirection, damage);
        damageIndicators.push(indicator);

        // 被ダメージ側の向いている方角を計算
        const playerYaw = yawObject.rotation.y * 180 / Math.PI;
        const playerPitch = pitchObject.rotation.x * 180 / Math.PI;

        // 攻撃側の座標
        const attackerX = attackPosition.x.toFixed(2);
        const attackerY = attackPosition.y.toFixed(2);
        const attackerZ = attackPosition.z.toFixed(2);

        // 被ダメージ側の座標
        const victimX = playerPosition.x.toFixed(2);
        const victimY = playerPosition.y.toFixed(2);
        const victimZ = playerPosition.z.toFixed(2);


    }
}

// ダメージ方向インジケーターを更新
function updateDamageIndicators() {
    for (let i = damageIndicators.length - 1; i >= 0; i--) {
        const indicator = damageIndicators[i];

        if (indicator.isExpired()) {
            indicator.destroy();
            damageIndicators.splice(i, 1);
        } else {
            indicator.updatePosition();
        }
    }
}



// 入力管理
const keyState = new Map();
let mouseDown = false;

window.addEventListener('keydown', (e) => {
    keyState.set(e.code, true);
    if (e.code === 'KeyP') toggleDebugMenu();
    if (e.code === 'KeyR') reload();
    if (e.code === 'KeyT') {
        // 安全チェックと自動修正
        if (isNaN(yawObject.rotation.y) || isNaN(pitchObject.rotation.x)) {
            console.warn('🔧 Detected NaN angles, resetting to safe values');
            yawObject.rotation.y = 0;
            pitchObject.rotation.x = 0;
        }
    }
    if (e.code === 'Escape') {
        if (pointerLocked) {
            document.exitPointerLock(); // Release pointer lock
        }
    }

    // Debug collision toggle (works anytime)
    if (e.code === 'Digit1') {
        DEBUG_COLLISION = !DEBUG_COLLISION;

        // Clear existing debug hitboxes when turning off
        if (!DEBUG_COLLISION) {
            debugHitboxes.forEach(hitbox => scene.remove(hitbox));
            debugHitboxes.length = 0;
        }

        // Show user feedback
        const message = document.createElement('div');
        message.className = 'system-message';
        message.style.color = DEBUG_COLLISION ? '#00ff00' : '#ff6666';
        message.textContent = `デバッグ当たり判定: ${DEBUG_COLLISION ? 'ON' : 'OFF'}`;
        document.body.appendChild(message);

        setTimeout(() => {
            document.body.removeChild(message);
        }, 2000);
        return; // Don't process stage switching when using debug toggle
    }

    // Stage switching (only when playing)
    if (pointerLocked && !isPaused) {
        switch (e.code) {
            case 'Digit2':
                StageCreator.createUrbanMap();
                break;
            case 'Digit3':
                StageCreator.createForestMap();
                break;
            case 'Digit4':
                StageCreator.createBasicArena();
                break;
        }
    }
});
window.addEventListener('keyup', (e) => keyState.set(e.code, false));

// Mouse input for full-auto
window.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouseDown = true;
});
window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouseDown = false;
});

// UI elements
const hudHealthEl = document.getElementById('health');
const hudAmmoEl = document.getElementById('ammo');
const hudReserveEl = document.getElementById('reserve');
const hudTargetsEl = document.getElementById('targets');
const banner = document.getElementById('banner');
const bannerText = document.getElementById('banner-text');
const bannerBtn = document.getElementById('banner-btn');
const connectionStatus = document.getElementById('connection-status');
const roomIdInput = document.getElementById('room-id');
const playerNameInput = document.getElementById('player-name');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const availableRoomsSelect = document.getElementById('available-rooms');
const refreshRoomsBtn = document.getElementById('refresh-rooms-btn');
const autoMatchBtn = document.getElementById('auto-match-btn');

banner.style.display = 'block';

// Three.js setup
const scene = new THREE.Scene();

// Create gradient skybox
function createGradientSky() {
    const skyGeometry = new THREE.SphereGeometry(500, 32, 15);

    // Create gradient texture
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');

    // Create vertical gradient (ground to sky)
    const gradient = context.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, '#87CEEB');    // Sky blue (top)
    gradient.addColorStop(0.3, '#98D8E8'); // Light blue
    gradient.addColorStop(0.7, '#B0E0E6'); // Powder blue
    gradient.addColorStop(1, '#F0F8FF');   // Alice blue (horizon)

    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);

    const texture = new THREE.CanvasTexture(canvas);
    const skyMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.BackSide // Render inside the sphere
    });

    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    return sky;
}

// Skybox loader utility
class SkyboxLoader {
    // Check if files exist before attempting to load
    static async checkFileExists(url) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    static async loadCubemap(basePath, fileNames = ['px', 'nx', 'py', 'ny', 'pz', 'nz']) {
        const loader = new THREE.CubeTextureLoader();

        // Try different extensions in order of preference
        const extensions = ['png', 'jpg', 'jpeg', 'webp'];

        for (const ext of extensions) {
            const urls = fileNames.map(name => `${basePath}/${name}.${ext}`);

            // Check if all files exist before attempting to load
            const allExist = await Promise.all(urls.map(url => this.checkFileExists(url)));

            if (allExist.every(exists => exists)) {
                try {
                    return await new Promise((resolve, reject) => {
                        loader.load(urls,
                            (texture) => {
                                resolve(texture);
                            },
                            undefined,
                            reject
                        );
                    });
                } catch (error) {
                    // If load fails despite files existing, continue to next format
                }
            }
        }

        throw new Error('No compatible cubemap format found');
    }

    static async loadEquirectangular(basePath) {
        const loader = new THREE.TextureLoader();

        // Try different extensions and common filenames
        const extensions = ['png', 'jpg', 'jpeg', 'webp'];
        const filenames = ['sky', 'skybox', 'panorama', 'equirectangular'];

        for (const filename of filenames) {
            for (const ext of extensions) {
                const imagePath = `${basePath}/${filename}.${ext}`;

                // Check if file exists before attempting to load
                if (await this.checkFileExists(imagePath)) {
                    try {
                        return await new Promise((resolve, reject) => {
                            loader.load(imagePath,
                                (texture) => {
                                    texture.mapping = THREE.EquirectangularReflectionMapping;
                                    resolve(texture);
                                },
                                undefined,
                                reject
                            );
                        });
                    } catch (error) {
                        // If load fails despite file existing, continue to next combination
                    }
                }
            }
        }

        throw new Error('No compatible equirectangular format found');
    }

    static async loadSkybox() {
        // Quick folder existence check first
        const cubemapExists = await this.checkFileExists('assets/skybox/cubemap/px.png') ||
            await this.checkFileExists('assets/skybox/cubemap/px.jpg');

        if (cubemapExists) {
            try {
                const texture = await this.loadCubemap('assets/skybox/cubemap');
                return texture;
            } catch (e) {
                // Silent fail
            }
        }

        // Quick equirectangular check
        const equirectangularExists = await this.checkFileExists('assets/skybox/equirectangular/sky.png') ||
            await this.checkFileExists('assets/skybox/equirectangular/sky.jpg');

        if (equirectangularExists) {
            try {
                const texture = await this.loadEquirectangular('assets/skybox/equirectangular');
                return texture;
            } catch (e) {
                // Silent fail
            }
        }

        // Fallback to gradient
        return null;
    }
}

// Try to load skybox, fallback to gradient
SkyboxLoader.loadSkybox().then(texture => {
    if (texture) {
        scene.background = texture;
    } else {
        // Fallback: Add gradient sky
        const sky = createGradientSky();
        scene.add(sky);
    }
}).catch((error) => {
    // Error fallback: Add gradient sky (silent)
    const sky = createGradientSky();
    scene.add(sky);
});

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, PLAYER_EYE_HEIGHT, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 18, 10);
scene.add(dirLight);

// World
const groundGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 1, 1);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a1f2b, metalness: 0.1, roughness: 0.95 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
scene.add(new THREE.GridHelper(WORLD_SIZE, WORLD_SIZE / 2, 0x2f3b52, 0x1f2937));

// Simple walls (boundaries visual)
const walls = [];
const stageObjects = []; // Stage geometry and objects
const wallMat = new THREE.MeshStandardMaterial({ color: 0x222a38, metalness: 0.05, roughness: 1.0 });
const half = WORLD_SIZE / 2;
for (const [x, z, rot] of [
    [0, -half, 0],
    [0, half, 0],
    [-half, 0, Math.PI / 2],
    [half, 0, Math.PI / 2],
]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(WORLD_SIZE, 3, 0.5), wallMat);
    wall.position.set(x, 1.5, z);
    wall.rotation.y = rot;
    wall.userData.isWall = true;
    scene.add(wall);
    walls.push(wall);
}

// Targets
const targets = [];
function spawnTargets(count = 12) {
    for (const t of targets) scene.remove(t);
    targets.length = 0;
    const targetGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.2, 16);
    const targetMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.1, roughness: 0.6 });
    for (let i = 0; i < count; i++) {
        const t = new THREE.Mesh(targetGeo, targetMat);
        const [x, z] = randomXZInsideWorld(6);
        t.position.set(x, 0.6, z);
        t.userData.isTarget = true;
        scene.add(t);
        targets.push(t);
    }
    updateUI();
}

function randomXZInsideWorld(margin = 0) {
    const bound = WORLD_SIZE / 2 - margin;
    const x = (Math.random() * 2 - 1) * bound;
    const z = (Math.random() * 2 - 1) * bound;
    return [x, z];
}

// Player body (visible in third person)
const playerBody = new THREE.Group();
const bodyGeo = new THREE.CapsuleGeometry(0.25, 0.9, 4, 8); // reduced height from 1.2 to 0.9
const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a9eff, metalness: 0.1, roughness: 0.8 });
const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
bodyMesh.position.y = 0.45; // adjusted center position
playerBody.add(bodyMesh);

// Head
const headGeo = new THREE.SphereGeometry(0.25, 16, 16);
const headMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, metalness: 0.05, roughness: 0.9 });
const headMesh = new THREE.Mesh(headGeo, headMat);
headMesh.position.y = 1.35; // adjusted to sit properly on smaller body
playerBody.add(headMesh);

playerBody.position.set(0, 0, 0);
playerBody.visible = false; // initially hidden (first person)
scene.add(playerBody);

// Player (first-person camera position)
const playerPosition = new THREE.Vector3(0, PLAYER_EYE_HEIGHT, 0);
const playerVelocity = new THREE.Vector3(0, 0, 0);

// Quaternion-based camera control (no gimbal lock possible)
const cameraQuaternion = new THREE.Quaternion();
const pitchObject = new THREE.Object3D();
const yawObject = new THREE.Object3D();

// Setup quaternion-based camera control
yawObject.add(pitchObject);
yawObject.position.copy(playerPosition);

// Fixed mouse movement with strict filtering
let lastValidMovement = { x: 0, y: 0, time: 0 };

function onMouseMove(e) {
    if (!pointerLocked) return;

    const movementX = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
    const movementY = e.movementY || e.mozMovementY || e.webkitMovementY || 0;
    const now = performance.now();

    // Multiple filtering layers

    // Filter 1: Extreme values (>100px/frame)
    if (Math.abs(movementX) > 100 || Math.abs(movementY) > 100) {
        return;
    }

    // Filter 2: Sudden acceleration detection
    const timeDelta = now - lastValidMovement.time;
    if (timeDelta > 0 && timeDelta < 50) { // Less than 50ms between movements
        const acceleration = Math.hypot(
            Math.abs(movementX - lastValidMovement.x),
            Math.abs(movementY - lastValidMovement.y)
        );
        if (acceleration > 150) {
            return;
        }
    }

    // Record this movement for next frame's acceleration check
    lastValidMovement = { x: movementX, y: movementY, time: now };

    // Apply movement
    yawObject.rotation.y -= movementX * MOUSE_SENSITIVITY;
    pitchObject.rotation.x -= movementY * MOUSE_SENSITIVITY;

    // Limit pitch
    const maxPitch = Math.PI / 2 - 0.1;
    pitchObject.rotation.x = Math.max(-maxPitch, Math.min(maxPitch, pitchObject.rotation.x));
}
document.addEventListener('mousemove', onMouseMove);

// Bullets
const bullets = [];
const BULLET_SPEED = 225; // m/s (高速テスト - 補間効果確認用)
const BULLET_LIFETIME = 3; // seconds
const BULLET_BASE_LENGTH = 3.0; // Base length for bullets
const BULLET_SPEED_SCALE = 0.02; // How much speed affects length

// Function to create bullet geometry based on speed
function createBulletGeometry(speed) {
    // Length scales with speed for realistic bullet trail effect
    const length = BULLET_BASE_LENGTH + (speed * BULLET_SPEED_SCALE);
    return new THREE.CylinderGeometry(0.01, 0.01, length, 8);
}

// Make it bright and glowing for visibility
const bulletMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xffaa00,
    emissiveIntensity: 0.3
});

// Shooting (full-auto when mouse held)
function attemptShoot() {
    if (isPaused || isReloading) return;
    const now = performance.now() / 1000;
    if (now - lastShotAt < FIRE_COOLDOWN_S) return;
    if (magazine <= 0) {
        reload();
        return;
    }
    lastShotAt = now;
    magazine -= 1;

    // Calculate shooting direction from camera
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(camera.quaternion);

    // Create bullet with speed-based geometry
    const bulletGeo = createBulletGeometry(BULLET_SPEED);
    const bullet = new THREE.Mesh(bulletGeo, bulletMat);
    bullet.position.copy(camera.position);

    // Orient bullet to point in the direction of travel
    // Default cylinder points along Y axis, rotate to align with direction
    const quaternion = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    quaternion.setFromUnitVectors(up, direction);
    bullet.setRotationFromQuaternion(quaternion);

    bullet.userData = {
        velocity: direction.clone().multiplyScalar(BULLET_SPEED),
        birthTime: now,
        isBullet: true
    };

    scene.add(bullet);
    bullets.push(bullet);

    // Apply recoil
    applyRecoil();

    // Send network shoot event
    if (networkManager.isJoinedToRoom()) {
        networkManager.sendShootEvent(camera.position, direction);
    }

    updateUI();
}

// 射撃時に反動を適用
function applyRecoil() {
    const oldTarget = targetRecoil;
    const oldHorizontalTarget = targetHorizontalRecoil;
    const oldBuildup = recoilBuildup;

    // 射撃時刻と蓄積を更新
    const currentTime = performance.now() / 1000;
    lastShotTime = currentTime;

    // 反動蓄積を増加
    recoilBuildup = Math.min(1, recoilBuildup + RECOIL_BUILDUP_RATE * (1 / 60)); // 蓄積速度は60FPSを想定

    // 蓄積倍率を計算（最小値と最大値の間で補間）
    const buildupMultiplier = RECOIL_BUILDUP_MIN_MULTIPLIER +
        (RECOIL_BUILDUP_MAX_MULTIPLIER - RECOIL_BUILDUP_MIN_MULTIPLIER) * recoilBuildup;

    // 反動強度のランダム変動（デフォルト±30%）
    const randomMultiplier = 1 + (Math.random() - 0.5) * 2 * RECOIL_INTENSITY_VARIATION;

    // 基本反動に蓄積倍率を適用
    const baseVerticalRecoil = RECOIL_INTENSITY * buildupMultiplier * randomMultiplier;
    const baseHorizontalRecoil = RECOIL_HORIZONTAL_MAX * buildupMultiplier;

    // ランダム水平反動（左右）
    const horizontalRecoil = (Math.random() - 0.5) * 2 * baseHorizontalRecoil;

    // 目標反動に加算（スムージに適用される）
    targetRecoil += baseVerticalRecoil;
    targetHorizontalRecoil += horizontalRecoil;


}

// 安全なシンプルイージングで反動を更新
function updateRecoil(delta) {
    const oldCurrent = currentRecoil;
    const oldCurrentHorizontal = currentHorizontalRecoil;
    const oldPitch = pitchObject.rotation.x;
    const oldYaw = yawObject.rotation.y;

    // === 縦方向反動 ===
    // 安全：目標値へのシンプル補間
    const diff = targetRecoil - currentRecoil;

    // NaN防止の安全チェック（縦方向）
    if (isNaN(currentRecoil) || isNaN(targetRecoil) || isNaN(diff)) {
        console.warn('🚨 縦方向反動計算でNaNを検出！ リセットします...');
        currentRecoil = 0;
        targetRecoil = 0;
        return;
    }

    // シンプルイージング：目標から遠い時は速く、近い時は遅く
    let speed = RECOIL_EASING_SPEED;
    if (Math.abs(diff) > 0.01) {
        speed *= 2.0; // 「ガク」効果のための速いスタート
    } else {
        speed *= 0.5; // 滑らかな終了のための遅いフィニッシュ
    }

    currentRecoil += diff * speed * delta;

    // 安全範囲制限
    currentRecoil = Math.max(0, Math.min(10, currentRecoil));

    // スムージな縦反動をピッチに適用
    const recoilPitch = currentRecoil;
    const lastRecoil = pitchObject.userData.lastRecoil || 0;
    const pitchDelta = recoilPitch - lastRecoil;

    // ピッチ計算の安全チェック
    if (isNaN(recoilPitch) || isNaN(lastRecoil) || isNaN(pitchDelta)) {
        console.warn('🚨 ピッチ計算でNaNを検出！ ピッチデータをリセットします...');
        pitchObject.userData.lastRecoil = 0;
        return;
    }

    // カメラピッチに適用
    pitchObject.rotation.x += pitchDelta;

    // 最終ピッチの安全チェック
    if (isNaN(pitchObject.rotation.x)) {
        console.warn('🚨 最終ピッチでNaNを検出！ リセットします...');
        pitchObject.rotation.x = 0;
        pitchObject.userData.lastRecoil = 0;
        return;
    }

    // 次フレーム用に保存
    pitchObject.userData.lastRecoil = recoilPitch;

    // 過回転防止のためピッチを制限
    const maxPitch = Math.PI / 2 - 0.1;
    pitchObject.rotation.x = Math.max(-maxPitch, Math.min(maxPitch, pitchObject.rotation.x));

    // === 水平反動 ===
    const horizontalDiff = targetHorizontalRecoil - currentHorizontalRecoil;

    // NaN防止の安全チェック（水平）
    if (isNaN(currentHorizontalRecoil) || isNaN(targetHorizontalRecoil) || isNaN(horizontalDiff)) {
        console.warn('🚨 水平反動計算でNaNを検出！ リセットします...');
        currentHorizontalRecoil = 0;
        targetHorizontalRecoil = 0;
        return;
    }

    // 水平方向も同じイージング速度を使用
    currentHorizontalRecoil += horizontalDiff * speed * delta;

    // 水平反動の安全範囲制限
    currentHorizontalRecoil = Math.max(-1, Math.min(1, currentHorizontalRecoil));

    // 水平反動をヨーに適用
    const recoilYaw = currentHorizontalRecoil;
    const lastHorizontalRecoil = yawObject.userData.lastHorizontalRecoil || 0;
    const yawDelta = recoilYaw - lastHorizontalRecoil;

    // ヨー計算の安全チェック
    if (isNaN(recoilYaw) || isNaN(lastHorizontalRecoil) || isNaN(yawDelta)) {
        console.warn('🚨 ヨー計算でNaNを検出！ ヨーデータをリセットします...');
        yawObject.userData.lastHorizontalRecoil = 0;
        return;
    }

    // カメラヨーに適用
    yawObject.rotation.y += yawDelta;

    // 最終ヨーの安全チェック
    if (isNaN(yawObject.rotation.y)) {
        console.warn('🚨 最終ヨーでNaNを検出！ リセットします...');
        yawObject.rotation.y = 0;
        yawObject.userData.lastHorizontalRecoil = 0;
        return;
    }

    // 次フレーム用に保存
    yawObject.userData.lastHorizontalRecoil = recoilYaw;

    // === 反動蓄積の減衰 ===
    const currentTime = performance.now() / 1000;
    const timeSinceLastShot = currentTime - lastShotTime;

    // 遅延後に減衰を適用
    if (timeSinceLastShot > RECOIL_BUILDUP_DECAY_DELAY && recoilBuildup > 0) {
        const oldRecoilBuildup = recoilBuildup;
        recoilBuildup = Math.max(0, recoilBuildup - RECOIL_BUILDUP_DECAY_RATE * delta);


    }


}

function reload() {
    if (isReloading) return;
    if (magazine >= MAG_SIZE) return;
    if (reserveAmmo <= 0) return;

    isReloading = true;

    // クロスヘアを非表示
    const crosshair = document.getElementById('crosshair');
    if (crosshair) {
        crosshair.style.display = 'none';
    }

    // リロードゲージを表示
    const reloadContainer = document.getElementById('reload-container');
    const reloadProgress = document.querySelector('.reload-progress');
    if (reloadContainer && reloadProgress) {
        reloadContainer.style.display = 'block';
        reloadProgress.style.width = '0%';

        // リロードゲージをアニメーション
        const startTime = performance.now();
        const reloadDuration = RELOAD_TIME_S * 1000;

        function updateReloadProgress() {
            if (!isReloading) return;

            const elapsed = performance.now() - startTime;
            const progress = Math.min(100, (elapsed / reloadDuration) * 100);

            reloadProgress.style.width = progress + '%';

            if (progress < 100) {
                requestAnimationFrame(updateReloadProgress);
            }
        }

        updateReloadProgress();
    }

    setTimeout(() => {
        const need = MAG_SIZE - magazine;
        const take = Math.min(need, reserveAmmo);
        magazine += take;
        reserveAmmo -= take;
        isReloading = false;

        // クロスヘアを再表示
        if (crosshair) {
            crosshair.style.display = 'block';
        }

        // リロードゲージを非表示
        if (reloadContainer) {
            reloadContainer.style.display = 'none';
        }

        updateUI();
    }, RELOAD_TIME_S * 1000);
}

// PeerJS P2P Network System (no server required)
class NetworkManager {
    constructor() {
        this.peer = null;
        this.connections = new Map();
        this.isConnected = false;
        this.currentRoom = null;
        this.playerName = "";
        this.playerId = null;
        this.isHost = false;
        this.availableRooms = new Map(); // roomId -> {hostName, playerCount}
        this.lastUpdateFrame = -1;
    }

    async initialize() {
        try {
            this.updateConnectionStatus("Initializing P2P...");

            // Disable buttons during initialization
            createRoomBtn.disabled = true;
            joinRoomBtn.disabled = true;
            autoMatchBtn.disabled = true;

            // Create PeerJS instance with random ID
            this.playerId = 'fps-' + Math.random().toString(36).substr(2, 9);
            this.peer = new Peer(this.playerId);

            this.peer.on('open', (id) => {
                this.playerId = id;
                this.isConnected = true;
                this.updateConnectionStatus("Ready to connect");
                createRoomBtn.disabled = false;
                joinRoomBtn.disabled = false;
                autoMatchBtn.disabled = false;
            });

            this.peer.on('connection', (conn) => {
                this.handleIncomingConnection(conn);
            });

            this.peer.on('error', (err) => {
                // Suppress "Could not connect" errors during room discovery
                if (!err.message.includes('Could not connect')) {
                    console.error('PeerJS error:', err);
                    this.updateConnectionStatus("Connection error: " + err.message);
                }
            });

        } catch (error) {
            console.error("Failed to initialize P2P:", error);
            this.updateConnectionStatus("Connection failed");
        }
    }

    handleIncomingConnection(conn) {
        conn.on('open', () => {
            this.connections.set(conn.peer, conn);
            this.updateConnectionStatus(`Connected with ${conn.peer}`);

            // Send welcome message with host player info
            conn.send({
                type: 'playerJoin',
                playerName: this.playerName,
                playerId: this.playerId,
                colorIndex: 0  // Host is always blue (index 0)
            });

            // Send host's current position to new connection
            conn.send({
                type: 'playerUpdate',
                x: playerPosition.x,
                y: playerPosition.y,
                z: playerPosition.z,
                yaw: yawObject.rotation.y,
                pitch: pitchObject.rotation.x,
                timestamp: Date.now()
            });
        });

        conn.on('data', (data) => {
            this.handleNetworkMessage(data, conn.peer);
        });

        conn.on('close', () => {
            this.connections.delete(conn.peer);
            this.removeNetworkPlayer(conn.peer);
        });
    }

    async createRoom(roomId, playerName) {
        if (!this.isConnected) return false;

        try {
            this.playerName = playerName;
            this.currentRoom = roomId;
            this.isHost = true;

            // Create a predictable peer ID based on room number
            const hostPeerId = `fps-room-${roomId}`;

            // Destroy current peer and create new one with room-specific ID
            if (this.peer) {
                this.peer.destroy();
            }

            this.peer = new Peer(hostPeerId);

            this.peer.on('open', (id) => {
                this.playerId = id;
                this.updateConnectionStatus(`Room ${roomId} created! Others can join room ${roomId}`);
                this.showGameStartButton();

                // Register room as available
                this.availableRooms.set(roomId, {
                    hostName: playerName,
                    playerCount: 1,
                    peerId: hostPeerId
                });
            });

            this.peer.on('connection', (conn) => {
                this.handleIncomingConnection(conn);
            });

            this.peer.on('error', (err) => {
                // Only log non-connection errors
                if (!err.message.includes('Could not connect')) {
                    console.error('PeerJS error:', err);
                    this.updateConnectionStatus("Room creation failed: " + err.message);
                }
            });

            return true;
        } catch (error) {
            console.error("Failed to create room:", error);
            this.updateConnectionStatus("Failed to create room");
            return false;
        }
    }

    async joinRoom(roomId, playerName) {
        if (!this.isConnected) return false;

        try {
            this.updateConnectionStatus(`Connecting to room ${roomId}...`);
            this.playerName = playerName;
            this.currentRoom = roomId;

            // Connect to room host using predictable ID
            const hostPeerId = `fps-room-${roomId}`;
            const conn = this.peer.connect(hostPeerId);

            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    console.log(`⏰ Join room timeout for room ${roomId}`);
                    resolve(false);
                }, 5000); // 5 second timeout

                conn.on('open', () => {
                    clearTimeout(timeout);
                    this.connections.set(hostPeerId, conn);
                    this.updateConnectionStatus(`Joined room ${roomId}!`);
                    this.showGameStartButton();

                    // Send join message
                    conn.send({
                        type: 'playerJoin',
                        playerName: this.playerName,
                        playerId: this.playerId
                    });

                    resolve(true);
                });

                conn.on('data', (data) => {
                    this.handleNetworkMessage(data, hostPeerId);
                });

                conn.on('close', () => {
                    clearTimeout(timeout);
                    this.connections.delete(hostPeerId);
                    this.updateConnectionStatus("Disconnected from room");
                    resolve(false);
                });

                conn.on('error', (err) => {
                    clearTimeout(timeout);
                    console.error('Connection error:', err);
                    this.updateConnectionStatus(`Failed to join room ${roomId}: ${err.message}`);
                    resolve(false);
                });
            });

        } catch (error) {
            console.error("Failed to join room:", error);
            this.updateConnectionStatus("Failed to join room");
            return false;
        }
    }

    async refreshAvailableRooms() {
        // Try to detect available rooms by attempting connections to common room IDs
        this.updateConnectionStatus("Searching for rooms...");
        this.availableRooms.clear();

        // Check rooms 1-10 for active hosts (limited range)
        const promises = [];
        for (let i = 1; i <= 10; i++) {
            promises.push(this.checkRoomExists(i));
        }

        // Wait for all room checks to complete
        await Promise.allSettled(promises);

        // Add a small delay to ensure all results are processed
        await new Promise(resolve => setTimeout(resolve, 500));

        this.updateRoomsList();

        // Debug log
        console.log(`🔍 Room search completed. Found ${this.availableRooms.size} rooms:`, Array.from(this.availableRooms.keys()));
    }

    async checkRoomExists(roomId) {
        return new Promise((resolve) => {
            const hostPeerId = `fps-room-${roomId}`;
            const testConn = this.peer.connect(hostPeerId);

            const timeout = setTimeout(() => {
                if (testConn) {
                    testConn.close();
                }
                resolve(false);
            }, 1500); // Increased timeout for more reliable detection

            testConn.on('open', () => {
                clearTimeout(timeout);
                // Room exists, add to available rooms
                this.availableRooms.set(roomId, {
                    hostName: 'Host',
                    playerCount: '?',
                    peerId: hostPeerId
                });
                console.log(`✅ Found room ${roomId}`);
                testConn.close();
                resolve(true);
            });

            testConn.on('error', (err) => {
                clearTimeout(timeout);
                // 「Could not connect」エラーは予期されるものなので抑制
                if (!err.message.includes('Could not connect')) {
                    console.warn(`Room ${roomId} check failed:`, err.message);
                }
                resolve(false);
            });
        });
    }

    updateRoomsList() {
        // Clear current options except the first one
        availableRoomsSelect.innerHTML = '<option value="">Select a room to join...</option>';

        if (this.availableRooms.size === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No rooms found';
            option.disabled = true;
            availableRoomsSelect.appendChild(option);
        } else {
            this.availableRooms.forEach((room, roomId) => {
                const option = document.createElement('option');
                option.value = roomId;
                option.textContent = `Room ${roomId} - Host: ${room.hostName}`;
                availableRoomsSelect.appendChild(option);
            });
        }

        this.updateConnectionStatus(`Found ${this.availableRooms.size} available rooms`);
    }

    updateConnectionStatus(message) {
        if (connectionStatus) {
            connectionStatus.textContent = message;
        }
    }

    showGameStartButton() {
        document.getElementById('connection-panel').style.display = 'none';
        bannerBtn.style.display = 'block';
        bannerBtn.textContent = 'Start Game';
    }

    // Auto match functionality
    async autoMatch(playerName) {
        this.updateConnectionStatus("Searching for available rooms...");

        try {
            // First, refresh available rooms
            await this.refreshAvailableRooms();

            // Additional wait to ensure all room checks are complete
            await new Promise(resolve => setTimeout(resolve, 1000));

            console.log(`🎯 Auto match decision: Found ${this.availableRooms.size} rooms`);

            if (this.availableRooms.size > 0) {
                // Join the first available room
                const firstRoomId = Array.from(this.availableRooms.keys())[0];
                this.updateConnectionStatus(`Joining room ${firstRoomId}...`);
                console.log(`🎯 Auto match: Joining existing room ${firstRoomId}`);

                const success = await this.joinRoom(firstRoomId, playerName);
                if (success) {
                    this.updateConnectionStatus(`Auto-joined room ${firstRoomId}!`);
                    this.showGameStartButton();
                } else {
                    this.updateConnectionStatus("Failed to join room");
                    this.resetAutoMatchButton();
                }
            } else {
                // No rooms available, create a new one starting from 1
                const newRoomId = await this.findNextAvailableRoomId();
                this.updateConnectionStatus(`Creating new room ${newRoomId}...`);
                console.log(`🎯 Auto match: Creating new room ${newRoomId} (no existing rooms found)`);

                const success = await this.createRoom(newRoomId, playerName);
                if (success) {
                    this.updateConnectionStatus(`Created room ${newRoomId}! Waiting for players...`);
                    this.showGameStartButton();
                } else {
                    this.updateConnectionStatus("Failed to create room");
                    this.resetAutoMatchButton();
                }
            }
        } catch (error) {
            console.error("Auto match failed:", error);
            this.updateConnectionStatus("Auto match failed");
            this.resetAutoMatchButton();
        }
    }

    resetAutoMatchButton() {
        if (autoMatchBtn) {
            autoMatchBtn.disabled = false;
            autoMatchBtn.textContent = 'Auto Match';
        }
    }

    // Find the next available room ID starting from 1 (max 10)
    async findNextAvailableRoomId() {
        // First check if we already found some rooms and find the next available ID
        if (this.availableRooms.size > 0) {
            const existingRoomIds = Array.from(this.availableRooms.keys()).sort((a, b) => a - b);
            console.log(`🔍 Existing room IDs: ${existingRoomIds.join(', ')}`);

            // Find the first gap in room IDs starting from 1 (max 10)
            for (let i = 1; i <= Math.min(10, Math.max(...existingRoomIds) + 1); i++) {
                if (!existingRoomIds.includes(i)) {
                    console.log(`🎯 Found available room ID: ${i}`);
                    return i;
                }
            }
        }

        // If no existing rooms found, start from 1
        console.log(`🎯 No existing rooms found, starting from room ID 1`);
        return 1;
    }

    // Network message handling
    sendPlayerUpdate(position, rotation) {
        if (!this.currentRoom || this.connections.size === 0) return;

        const data = {
            type: 'playerUpdate',
            x: position.x,
            y: position.y,
            z: position.z,
            yaw: rotation.yaw,
            pitch: rotation.pitch,
            timestamp: Date.now()
        };

        // Send to all connected peers
        this.connections.forEach(conn => {
            if (conn.open) {
                conn.send(data);
            }
        });
    }

    sendShootEvent(origin, direction) {
        if (!this.currentRoom || this.connections.size === 0) return;

        const data = {
            type: 'playerShoot',
            ox: origin.x, oy: origin.y, oz: origin.z,
            dx: direction.x, dy: direction.y, dz: direction.z,
            timestamp: Date.now()
        };

        // Send to all connected peers
        this.connections.forEach(conn => {
            if (conn.open) {
                conn.send(data);
            }
        });
    }

    sendPlayerDamageEvent(targetPlayerId, damage, attackPosition = null) {
        if (!this.currentRoom || this.connections.size === 0) return;

        const data = {
            type: 'playerDamage',
            targetPlayerId: targetPlayerId,
            damage: damage,
            attackerId: this.playerId,
            timestamp: Date.now()
        };

        // 攻撃位置が指定されている場合は追加
        if (attackPosition) {
            data.attackPosition = {
                x: attackPosition.x,
                y: attackPosition.y,
                z: attackPosition.z
            };
        }

        // Send to all connected peers
        this.connections.forEach(conn => {
            if (conn.open) {
                conn.send(data);
            }
        });
    }

    sendPlayerRespawnEvent(newPosition) {
        if (!this.currentRoom || this.connections.size === 0) return;

        const data = {
            type: 'playerRespawn',
            playerId: this.playerId,
            x: newPosition.x,
            y: newPosition.y,
            z: newPosition.z,
            timestamp: Date.now()
        };

        // Send to all connected peers
        this.connections.forEach(conn => {
            if (conn.open) {
                conn.send(data);
            }
        });
    }

    sendBloodEffectEvent(position, isLargeSplatter) {
        if (!this.currentRoom || this.connections.size === 0) return;

        const data = {
            type: 'playerBloodEffect',
            playerId: this.playerId,
            x: position.x,
            y: position.y,
            z: position.z,
            isLargeSplatter: isLargeSplatter,
            timestamp: Date.now()
        };

        // Send to all connected peers
        this.connections.forEach(conn => {
            if (conn.open) {
                conn.send(data);
            }
        });
    }

    handleNetworkMessage(data, peerId) {
        switch (data.type) {
            case 'playerJoin':
                // Don't create network player for yourself
                if (peerId === this.playerId) {
                    break;
                }

                // If this is the host, assign color to new player BEFORE creating
                let assignedColorIndex = data.colorIndex;
                if (this.isHost) {
                    // Assign color to new player (skip 0 for host)
                    assignedColorIndex = nextPlayerColorIndex + 1; // Host is 0, guests start from 1
                    nextPlayerColorIndex++;
                }

                this.createNetworkPlayer(peerId, data.playerName, assignedColorIndex);

                // If this is the host, send back host info AND all existing players to the new player
                if (this.isHost) {
                    const conn = this.connections.get(peerId);
                    if (conn && conn.open) {
                        // Send host info (always color index 0)
                        conn.send({
                            type: 'playerJoin',
                            playerName: this.playerName,
                            playerId: this.playerId,
                            colorIndex: 0
                        });

                        // Send host's current position
                        conn.send({
                            type: 'playerUpdate',
                            x: playerPosition.x,
                            y: playerPosition.y,
                            z: playerPosition.z,
                            yaw: yawObject.rotation.y,
                            pitch: pitchObject.rotation.x,
                            timestamp: Date.now()
                        });

                        // Send info about all other existing players with their assigned colors AND positions
                        connectedPlayers.forEach((player, existingPeerId) => {
                            if (existingPeerId !== peerId && player.userData.playerName) {
                                conn.send({
                                    type: 'playerJoin',
                                    playerName: player.userData.playerName,
                                    playerId: existingPeerId,
                                    colorIndex: player.userData.colorIndex
                                });

                                // Send current position of existing player
                                if (player.userData.networkData) {
                                    const pos = player.userData.networkData.targetPosition || player.position;
                                    const yaw = player.userData.networkData.targetYaw || player.rotation.y;
                                    conn.send({
                                        type: 'playerUpdate',
                                        x: pos.x,
                                        y: pos.y,
                                        z: pos.z,
                                        yaw: yaw,
                                        pitch: 0,
                                        timestamp: Date.now()
                                    });
                                }
                            }
                        });

                        // IMPORTANT: Send the new player's own color assignment back to them
                        conn.send({
                            type: 'playerColorAssignment',
                            colorIndex: assignedColorIndex
                        });
                    }
                }
                break;
            case 'playerColorAssignment':
                // Update own player body color if it exists
                if (playerBody && playerBody.children.length > 0) {
                    const playerColors = [
                        0x4a9eff, // Blue (1st player - host)
                        0xff4a4a, // Red (2nd player)
                        0x4aff4a, // Green (3rd player)
                        0xffff4a, // Yellow (4th player)
                        0xff4aff, // Magenta (5th player)
                        0x4affff, // Cyan (6th player)
                        0xff9f4a, // Orange (7th player)
                        0x9f4aff  // Purple (8th player)
                    ];
                    const newColor = playerColors[data.colorIndex % playerColors.length];
                    const bodyMesh = playerBody.children[0]; // First child is the body mesh
                    if (bodyMesh && bodyMesh.material) {
                        bodyMesh.material.color.setHex(newColor);
                    }
                }
                break;
            case 'playerUpdate':
                this.handlePlayerUpdate(data, peerId);
                break;
            case 'playerShoot':
                this.handlePlayerShoot(data, peerId);
                break;
            case 'playerDamage':
                this.handlePlayerDamage(data, peerId);
                break;
            case 'playerRespawn':
                this.handlePlayerRespawn(data, peerId);
                break;
            case 'playerBloodEffect':
                this.handlePlayerBloodEffect(data, peerId);
                break;
        }
    }

    handlePlayerUpdate(data, peerId) {
        if (peerId === this.playerId) return; // Ignore own updates

        // 既存プレイヤーのみ更新 - 未知のプレイヤーは作成しない
        if (!connectedPlayers.has(peerId)) {
            console.warn(`Received update for unknown player: ${peerId}`);
            return;
        }

        const player = connectedPlayers.get(peerId);
        if (player) {
            // Store target position for smooth interpolation
            const targetPos = new THREE.Vector3(data.x, data.y - PLAYER_EYE_HEIGHT, data.z);

            // Initialize interpolation data if not exists
            if (!player.userData.networkData) {
                player.userData.networkData = {
                    targetPosition: targetPos,
                    targetYaw: data.yaw,
                    lastUpdateTime: performance.now()
                };
                player.position.copy(targetPos);
                player.rotation.y = data.yaw;
            } else {
                // Update targets for interpolation
                player.userData.networkData.targetPosition = targetPos;
                player.userData.networkData.targetYaw = data.yaw;
                player.userData.networkData.lastUpdateTime = performance.now();
            }
        }
    }

    handlePlayerShoot(data, peerId) {
        if (peerId === this.playerId) return; // Ignore own shots

        const direction = new THREE.Vector3(data.dx, data.dy, data.dz);

        // Create network bullet with speed-based geometry
        const bulletGeo = createBulletGeometry(BULLET_SPEED);
        const bullet = new THREE.Mesh(bulletGeo, bulletMat);
        bullet.position.set(data.ox, data.oy, data.oz);

        // Orient network bullet to point in the direction of travel
        const quaternion = new THREE.Quaternion();
        const up = new THREE.Vector3(0, 1, 0);
        quaternion.setFromUnitVectors(up, direction);
        bullet.setRotationFromQuaternion(quaternion);

        bullet.userData = {
            velocity: direction.multiplyScalar(BULLET_SPEED),
            birthTime: performance.now() / 1000,
            isBullet: true,
            isNetworkBullet: true,
            shooterId: peerId  // Track who shot this bullet
        };

        scene.add(bullet);
        bullets.push(bullet);
    }

    handlePlayerDamage(data, peerId) {
        // Handle damage received from network
        if (data.targetPlayerId === this.playerId) {
            // This player was hit

            // 攻撃位置が送信されている場合はインジケーターを表示
            let attackPosition = null;
            if (data.attackPosition) {
                attackPosition = new THREE.Vector3(data.attackPosition.x, data.attackPosition.y, data.attackPosition.z);
            }

            applyDamageToPlayer(data.damage, attackPosition);
        }
    }

    handlePlayerRespawn(data, peerId) {
        // Handle respawn from network
        if (peerId === this.playerId) return; // Ignore own respawn

        // Update network player position if they exist
        const player = connectedPlayers.get(peerId);
        if (player) {
            const newPos = new THREE.Vector3(data.x, data.y - PLAYER_EYE_HEIGHT, data.z);
            player.position.copy(newPos);

            // Update network data for smooth interpolation
            if (player.userData.networkData) {
                player.userData.networkData.targetPosition = newPos;
            }
        }
    }

    handlePlayerBloodEffect(data, peerId) {
        // Handle blood effect from network
        if (peerId === this.playerId) return; // Ignore own blood effects

        const bloodPosition = new THREE.Vector3(data.x, data.y, data.z);

        // Create blood effect for other players
        if (data.isLargeSplatter) {
            createBloodSplatter(bloodPosition);
        } else {
            createSmallBloodEffect(bloodPosition);
        }
    }

    createNetworkPlayer(peerId, playerName = 'Player', assignedColorIndex = null) {
        // プレイヤーが既に存在するかチェック
        if (connectedPlayers.has(peerId)) {
            console.warn(`⚠️ Player ${peerId} (${playerName}) already exists! Skipping creation.`);
            return;
        }

        const networkPlayer = new THREE.Group();

        // Store player name and color index for future reference
        networkPlayer.userData.playerName = playerName;
        networkPlayer.userData.colorIndex = assignedColorIndex !== null ? assignedColorIndex : connectedPlayers.size;

        // Define unique colors for different players
        const playerColors = [
            0x4a9eff, // Blue (1st player - host)
            0xff4a4a, // Red (2nd player)
            0x4aff4a, // Green (3rd player)
            0xffff4a, // Yellow (4th player)
            0xff4aff, // Magenta (5th player)
            0x4affff, // Cyan (6th player)
            0xff9f4a, // Orange (7th player)
            0x9f4aff  // Purple (8th player)
        ];

        // Use assigned color index or default to current player count
        let colorIndex;
        if (assignedColorIndex !== null && assignedColorIndex !== undefined) {
            colorIndex = assignedColorIndex % playerColors.length;
        } else {
            // Fallback for host or when no color assigned
            colorIndex = connectedPlayers.size % playerColors.length;
        }

        const playerColor = playerColors[colorIndex];

        // Create unique material for this player
        const uniqueBodyMat = new THREE.MeshStandardMaterial({
            color: playerColor,
            metalness: 0.1,
            roughness: 0.8
        });

        // Create player body with unique color
        const body = new THREE.Mesh(bodyGeo, uniqueBodyMat);
        body.position.y = 0.45;
        networkPlayer.add(body);

        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.35;
        networkPlayer.add(head);

        // Add name tag with billboard effect - ADD DIRECTLY TO SCENE, NOT TO PLAYER GROUP
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;
        context.fillStyle = 'rgba(0,0,0,0.8)';
        context.fillRect(0, 0, 256, 64);
        context.fillStyle = 'white';
        context.font = '20px Arial';
        context.textAlign = 'center';
        context.fillText(playerName, 128, 40);

        const texture = new THREE.CanvasTexture(canvas);
        const nameTag = new THREE.Mesh(
            new THREE.PlaneGeometry(2, 0.5),
            new THREE.MeshBasicMaterial({ map: texture, transparent: true })
        );

        // Mark as nameplate for billboard update and link to player
        nameTag.userData.isNameplate = true;
        nameTag.userData.playerId = peerId;

        // Add nameplate directly to scene (not to player group)
        scene.add(nameTag);

        // Store reference to nameplate in network player
        networkPlayer.userData.nameTag = nameTag;

        scene.add(networkPlayer);
        connectedPlayers.set(peerId, networkPlayer);
    }

    removeNetworkPlayer(peerId) {
        const player = connectedPlayers.get(peerId);
        if (player) {
            // Remove nameplate if it exists
            if (player.userData.nameTag) {
                scene.remove(player.userData.nameTag);
            }
            scene.remove(player);
            connectedPlayers.delete(peerId);
        }
    }

    isJoinedToRoom() {
        return this.currentRoom && this.connections.size > 0;
    }

    // Update network players with smooth interpolation
    updateNetworkPlayers(delta) {
        connectedPlayers.forEach((player, peerId) => {
            if (player.userData.networkData) {
                const data = player.userData.networkData;
                const interpolationSpeed = 8; // Higher = faster interpolation

                // Smooth position interpolation
                player.position.lerp(data.targetPosition, interpolationSpeed * delta);

                // Smooth rotation interpolation
                const currentYaw = player.rotation.y;
                const targetYaw = data.targetYaw;
                const yawDiff = targetYaw - currentYaw;

                // Handle rotation wrapping (avoid spinning the long way around)
                let adjustedYawDiff = yawDiff;
                if (Math.abs(yawDiff) > Math.PI) {
                    adjustedYawDiff = yawDiff > 0 ? yawDiff - 2 * Math.PI : yawDiff + 2 * Math.PI;
                }

                player.rotation.y += adjustedYawDiff * interpolationSpeed * delta;
            }
        });
    }
}

// Stage Creator System
class StageCreator {
    static createBasicArena() {
        // Clear existing stage objects
        stageObjects.forEach(obj => scene.remove(obj));
        stageObjects.length = 0;

        // Central platform
        const platformGeo = new THREE.CylinderGeometry(8, 8, 1, 32);
        const platformMat = new THREE.MeshStandardMaterial({
            color: 0x4a90a4,
            metalness: 0.2,
            roughness: 0.7
        });
        const platform = new THREE.Mesh(platformGeo, platformMat);
        platform.position.set(0, 0.5, 0);
        platform.receiveShadow = true;
        platform.castShadow = true;
        scene.add(platform);
        stageObjects.push(platform);

        // Corner boxes for cover
        const boxGeo = new THREE.BoxGeometry(3, 2, 3);
        const boxMat = new THREE.MeshStandardMaterial({
            color: 0x8b7355,
            metalness: 0.1,
            roughness: 0.9
        });

        const corners = [
            [12, 1, 12],
            [-12, 1, 12],
            [12, 1, -12],
            [-12, 1, -12]
        ];

        corners.forEach(([x, y, z]) => {
            const box = new THREE.Mesh(boxGeo, boxMat);
            box.position.set(x, y, z);
            box.receiveShadow = true;
            box.castShadow = true;
            scene.add(box);
            stageObjects.push(box);
        });

        // Elevated walkways
        const walkwayGeo = new THREE.BoxGeometry(20, 0.5, 2);
        const walkwayMat = new THREE.MeshStandardMaterial({
            color: 0x666666,
            metalness: 0.3,
            roughness: 0.6
        });

        const walkways = [
            [0, 3, 15],
            [0, 3, -15],
            [15, 3, 0],
            [-15, 3, 0]
        ];

        walkways.forEach(([x, y, z]) => {
            const walkway = new THREE.Mesh(walkwayGeo, walkwayMat);
            walkway.position.set(x, y, z);
            if (x !== 0) walkway.rotation.y = Math.PI / 2;
            walkway.receiveShadow = true;
            walkway.castShadow = true;
            scene.add(walkway);
            stageObjects.push(walkway);
        });
    }

    static createUrbanMap() {
        // Clear existing stage objects
        stageObjects.forEach(obj => scene.remove(obj));
        stageObjects.length = 0;

        // Buildings
        const buildingMat = new THREE.MeshStandardMaterial({
            color: 0x404040,
            metalness: 0.1,
            roughness: 0.8
        });

        const buildings = [
            [10, 4, 10, 3, 8, 3],  // [x, y, z, width, height, depth]
            [-8, 3, 12, 4, 6, 2],
            [15, 2.5, -5, 2, 5, 4],
            [-12, 3, -8, 3, 6, 3],
            [5, 2, -15, 6, 4, 2],
            [-15, 1.5, 5, 2, 3, 5]
        ];

        buildings.forEach(([x, y, z, w, h, d]) => {
            const buildingGeo = new THREE.BoxGeometry(w, h, d);
            const building = new THREE.Mesh(buildingGeo, buildingMat);
            building.position.set(x, y, z);
            building.receiveShadow = true;
            building.castShadow = true;
            scene.add(building);
            stageObjects.push(building);
        });

        // Street barriers
        const barrierGeo = new THREE.BoxGeometry(0.5, 1, 3);
        const barrierMat = new THREE.MeshStandardMaterial({
            color: 0xff6b35,
            metalness: 0.2,
            roughness: 0.7
        });

        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const radius = 18;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            const barrier = new THREE.Mesh(barrierGeo, barrierMat);
            barrier.position.set(x, 0.5, z);
            barrier.rotation.y = angle;
            barrier.receiveShadow = true;
            barrier.castShadow = true;
            scene.add(barrier);
            stageObjects.push(barrier);
        }
    }

    static createForestMap() {
        // Clear existing stage objects
        stageObjects.forEach(obj => scene.remove(obj));
        stageObjects.length = 0;

        // Tree trunks
        const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 6, 8);
        const trunkMat = new THREE.MeshStandardMaterial({
            color: 0x8b4513,
            metalness: 0.0,
            roughness: 1.0
        });

        // Tree canopies
        const canopyGeo = new THREE.SphereGeometry(2.5, 8, 6);
        const canopyMat = new THREE.MeshStandardMaterial({
            color: 0x228b22,
            metalness: 0.0,
            roughness: 0.9
        });

        // Generate random tree positions
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 8 + Math.random() * 12;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            // Tree trunk
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.set(x, 3, z);
            trunk.receiveShadow = true;
            trunk.castShadow = true;
            scene.add(trunk);
            stageObjects.push(trunk);

            // Tree canopy
            const canopy = new THREE.Mesh(canopyGeo, canopyMat);
            canopy.position.set(x, 7 + Math.random() * 1, z);
            canopy.receiveShadow = true;
            canopy.castShadow = true;
            scene.add(canopy);
            stageObjects.push(canopy);
        }

        // Rock formations
        const rockGeo = new THREE.DodecahedronGeometry(1.5);
        const rockMat = new THREE.MeshStandardMaterial({
            color: 0x696969,
            metalness: 0.1,
            roughness: 0.9
        });

        for (let i = 0; i < 8; i++) {
            const x = (Math.random() - 0.5) * 30;
            const z = (Math.random() - 0.5) * 30;

            const rock = new THREE.Mesh(rockGeo, rockMat);
            rock.position.set(x, 0.75, z);
            rock.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            rock.receiveShadow = true;
            rock.castShadow = true;
            scene.add(rock);
            stageObjects.push(rock);
        }
    }
}

// Initialize network manager
const networkManager = new NetworkManager();

// Player name storage utility
const PlayerNameStorage = {
    KEY: 'fps_game_player_name',

    save(playerName) {
        try {
            localStorage.setItem(this.KEY, playerName);
        } catch (e) {
            console.warn('プレイヤー名を保存できませんでした:', e);
        }
    },

    load() {
        try {
            return localStorage.getItem(this.KEY) || '';
        } catch (e) {
            console.warn('プレイヤー名を読み込めませんでした:', e);
            return '';
        }
    }
};

// Button event handlers
createRoomBtn.onclick = () => {
    const roomId = parseInt(roomIdInput.value);
    const playerName = playerNameInput.value.trim();
    if (roomId && roomId >= 1 && roomId <= 10 && playerName) {
        PlayerNameStorage.save(playerName); // Save player name
        networkManager.createRoom(roomId, playerName);
    } else {
        alert('Please enter a room number (1-10) and player name');
    }
};

joinRoomBtn.onclick = () => {
    const selectedRoom = availableRoomsSelect.value;
    const playerName = playerNameInput.value.trim();
    if (selectedRoom && playerName) {
        PlayerNameStorage.save(playerName); // Save player name
        networkManager.joinRoom(parseInt(selectedRoom), playerName);
    } else {
        alert('Please select a room and enter player name');
    }
};

refreshRoomsBtn.onclick = () => {
    networkManager.refreshAvailableRooms();
};

// Auto match button event handler
autoMatchBtn.onclick = () => {
    const playerName = playerNameInput.value.trim();
    if (!playerName) {
        alert('Please enter your player name first');
        return;
    }

    autoMatchBtn.disabled = true;
    autoMatchBtn.textContent = 'Searching...';
    networkManager.autoMatch(playerName);
};

// Enable/disable join button based on room selection
availableRoomsSelect.onchange = () => {
    joinRoomBtn.disabled = !availableRoomsSelect.value;
};

// Pause / Resume and pointer lock
bannerBtn.onclick = () => {
    if (isGameOver) {
        resetGame();
    }
    requestPointerLockAndStart();
};

function requestPointerLockAndStart() {
    renderer.domElement.requestPointerLock();
}

document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === renderer.domElement;
    if (pointerLocked) {
        banner.style.display = 'none';
        isPaused = false;
    } else {
        isPaused = true;
        banner.style.display = 'block';
        bannerText.textContent = isGameOver ? 'Game Over' : 'Paused';
        bannerBtn.textContent = isGameOver ? 'Play Again' : 'Resume';
    }
});

function toggleViewMode() {
    if (isPaused || isGameOver) return;
    isThirdPerson = !isThirdPerson;
    playerBody.visible = isThirdPerson;
}

function togglePause() {
    if (isGameOver) return;
    if (isPaused) {
        requestPointerLockAndStart();
    } else {
        document.exitPointerLock();
    }
}

function resetGame() {
    isGameOver = false;
    health = 100;
    magazine = MAG_SIZE;
    reserveAmmo = RESERVE_START;
    yawObject.rotation.y = 0;
    pitchObject.rotation.x = 0;
    isThirdPerson = false;
    playerPosition.set(0, PLAYER_EYE_HEIGHT, 0);
    playerVelocity.set(0, 0, 0);
    playerBody.visible = false;
    isRespawning = false; // リスポーンフラグもリセット

    // リロード状態をリセット
    isReloading = false;

    // クロスヘアを表示
    const crosshair = document.getElementById('crosshair');
    if (crosshair) {
        crosshair.style.display = 'block';
    }

    // リロードゲージを非表示
    const reloadContainer = document.getElementById('reload-container');
    if (reloadContainer) {
        reloadContainer.style.display = 'none';
    }

    // ダメージ方向インジケーターをクリア
    damageIndicators.forEach(indicator => indicator.destroy());
    damageIndicators.length = 0;

    // ヒットマーカーをクリア
    hitmarkers.forEach(hitmarker => hitmarker.destroy());
    hitmarkers.length = 0;

    // 反動状態を安全にリセット
    targetRecoil = 0;
    currentRecoil = 0;
    targetHorizontalRecoil = 0;
    currentHorizontalRecoil = 0;
    recoilBuildup = 0;
    lastShotTime = 0;
    if (pitchObject && pitchObject.userData) {
        pitchObject.userData.lastRecoil = 0;
    }
    if (yawObject && yawObject.userData) {
        yawObject.userData.lastHorizontalRecoil = 0;
    }

    // カメラ角度を安全にリセット
    yawObject.rotation.y = 0;
    pitchObject.rotation.x = 0;

    // Clear bullets
    for (const bullet of bullets) {
        scene.remove(bullet);
    }
    bullets.length = 0;

    spawnTargets(12);
    updateUI();
}

function updateUI() {
    if (hudHealthEl) hudHealthEl.textContent = String(health);
    if (hudAmmoEl) hudAmmoEl.textContent = String(magazine);
    if (hudReserveEl) hudReserveEl.textContent = String(reserveAmmo);
    if (hudTargetsEl) hudTargetsEl.textContent = String(targets.length);
}

// Damage and respawn constants
const DAMAGE_PER_HIT = 10;
const RESPAWN_RADIUS_MIN = 8;
const RESPAWN_RADIUS_MAX = 15;
const DAMAGE_FLASH_DURATION = 200; // milliseconds
let damageFlashTime = 0;
let isRespawning = false; // フラグでリスポーン重複を防ぐ

// Debug collision visualization (set to true to see hitboxes)
let DEBUG_COLLISION = false;
let debugHitboxes = [];

// Blood splatter effect system
const bloodParticles = [];
const BLOOD_PARTICLE_COUNT = 15; // 血しぶきの粒子数
const BLOOD_PARTICLE_LIFETIME = 1.5; // 血しぶきの持続時間（秒）

// Create blood splatter effect (for death)
function createBloodSplatter(position) {
    // Blood particle material (red, emissive)
    const bloodMaterial = new THREE.MeshBasicMaterial({
        color: 0xcc0000,
        transparent: true,
        opacity: 0.8
    });

    // Create multiple blood particles
    for (let i = 0; i < BLOOD_PARTICLE_COUNT; i++) {
        // Random particle size
        const size = 0.05 + Math.random() * 0.1; // 5-15cm particles
        const bloodGeo = new THREE.SphereGeometry(size, 8, 6);
        const bloodParticle = new THREE.Mesh(bloodGeo, bloodMaterial.clone());

        // Position at death location
        bloodParticle.position.copy(position);

        // Random velocity for splatter effect
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 6, // Horizontal spread
            Math.random() * 4 + 2,     // Upward velocity
            (Math.random() - 0.5) * 6  // Horizontal spread
        );

        // Store particle data
        bloodParticle.userData = {
            velocity: velocity,
            birthTime: performance.now() / 1000,
            originalOpacity: bloodParticle.material.opacity,
            isBloodParticle: true
        };

        scene.add(bloodParticle);
        bloodParticles.push(bloodParticle);
    }
}

// Create small blood effect (for damage)
function createSmallBloodEffect(position) {
    // Smaller blood particle material
    const bloodMaterial = new THREE.MeshBasicMaterial({
        color: 0xaa0000,
        transparent: true,
        opacity: 0.6
    });

    // Create fewer, smaller particles
    const smallParticleCount = 5;
    for (let i = 0; i < smallParticleCount; i++) {
        // Smaller particle size
        const size = 0.02 + Math.random() * 0.05; // 2-7cm particles
        const bloodGeo = new THREE.SphereGeometry(size, 6, 4);
        const bloodParticle = new THREE.Mesh(bloodGeo, bloodMaterial.clone());

        // Position at damage location
        bloodParticle.position.copy(position);

        // Smaller, more contained velocity
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 2, // Smaller horizontal spread
            Math.random() * 2 + 0.5,   // Lower upward velocity
            (Math.random() - 0.5) * 2  // Smaller horizontal spread
        );

        // Store particle data
        bloodParticle.userData = {
            velocity: velocity,
            birthTime: performance.now() / 1000,
            originalOpacity: bloodParticle.material.opacity,
            isBloodParticle: true
        };

        scene.add(bloodParticle);
        bloodParticles.push(bloodParticle);
    }
}

// Update blood particles
function updateBloodParticles(delta) {
    const now = performance.now() / 1000;

    for (let i = bloodParticles.length - 1; i >= 0; i--) {
        const particle = bloodParticles[i];
        const userData = particle.userData;
        const age = now - userData.birthTime;

        // Remove old particles
        if (age > BLOOD_PARTICLE_LIFETIME) {
            scene.remove(particle);
            particle.geometry.dispose();
            particle.material.dispose();
            bloodParticles.splice(i, 1);
            continue;
        }

        // Update particle physics
        const velocity = userData.velocity;

        // Apply gravity
        velocity.y -= 15 * delta; // Gravity

        // Update position
        particle.position.add(velocity.clone().multiplyScalar(delta));

        // Fade out over time
        const lifeRatio = age / BLOOD_PARTICLE_LIFETIME;
        const opacity = userData.originalOpacity * (1 - lifeRatio);
        particle.material.opacity = Math.max(0, opacity);

        // Stop at ground level
        if (particle.position.y < 0.1) {
            particle.position.y = 0.1;
            velocity.y = 0;
            velocity.x *= 0.8; // Friction
            velocity.z *= 0.8; // Friction
        }
    }
}

// Debug function to visualize hitboxes
function showDebugHitbox(position, radius, height, color = 0xff0000, temporary = true) {
    if (!DEBUG_COLLISION) return;

    // Create wireframe cylinder for body collision
    const bodyGeo = new THREE.CylinderGeometry(radius, radius, height, 8);
    const bodyMat = new THREE.MeshBasicMaterial({
        color: color,
        wireframe: true,
        transparent: true,
        opacity: 0.5
    });
    const bodyDebug = new THREE.Mesh(bodyGeo, bodyMat);
    bodyDebug.position.copy(position);
    scene.add(bodyDebug);
    debugHitboxes.push(bodyDebug);

    // Auto-remove after time if temporary
    if (temporary) {
        setTimeout(() => {
            scene.remove(bodyDebug);
            const index = debugHitboxes.indexOf(bodyDebug);
            if (index > -1) debugHitboxes.splice(index, 1);
        }, 1000);
    }

    return bodyDebug;
}

// Function to update persistent debug hitboxes
function updateDebugHitboxes() {
    if (!DEBUG_COLLISION) return;

    // Clear old persistent hitboxes
    debugHitboxes.forEach(hitbox => {
        if (hitbox.userData.isPersistent) {
            scene.remove(hitbox);
        }
    });
    debugHitboxes = debugHitboxes.filter(hitbox => !hitbox.userData.isPersistent);

    // Show own player hitbox
    const bodyHeight = 0.9;
    const playerRadius = 0.25;
    const bodyBottom = playerPosition.y - PLAYER_EYE_HEIGHT + 0.45;
    const bodyCenter = bodyBottom + bodyHeight / 2;
    const headCenter = playerPosition.y - PLAYER_EYE_HEIGHT + 1.35;

    // Body hitbox
    const bodyHitbox = showDebugHitbox(
        new THREE.Vector3(playerPosition.x, bodyCenter, playerPosition.z),
        playerRadius,
        bodyHeight,
        0x00ff00,
        false
    );
    if (bodyHitbox) bodyHitbox.userData.isPersistent = true;

    // Head hitbox
    const headHitbox = showDebugHitbox(
        new THREE.Vector3(playerPosition.x, headCenter, playerPosition.z),
        playerRadius,
        playerRadius * 2,
        0x00ffff,
        false
    );
    if (headHitbox) headHitbox.userData.isPersistent = true;

    // Show network players hitboxes
    connectedPlayers.forEach((player, playerId) => {
        const playerWorldPos = new THREE.Vector3();
        player.getWorldPosition(playerWorldPos);

        const bodyBottom = playerWorldPos.y + 0.45 - bodyHeight / 2;
        const bodyCenter = bodyBottom + bodyHeight / 2;
        const headCenter = playerWorldPos.y + 1.35;

        // Network player body hitbox
        const netBodyHitbox = showDebugHitbox(
            new THREE.Vector3(playerWorldPos.x, bodyCenter, playerWorldPos.z),
            playerRadius,
            bodyHeight,
            0xff4444,
            false
        );
        if (netBodyHitbox) netBodyHitbox.userData.isPersistent = true;

        // Network player head hitbox
        const netHeadHitbox = showDebugHitbox(
            new THREE.Vector3(playerWorldPos.x, headCenter, playerWorldPos.z),
            playerRadius,
            playerRadius * 2,
            0xff8844,
            false
        );
        if (netHeadHitbox) netHeadHitbox.userData.isPersistent = true;
    });
}

// Damage visual feedback
function showDamageFlash() {
    damageFlashTime = performance.now();
    // Create red overlay effect
    const overlay = document.createElement('div');
    overlay.className = 'damage-flash';
    document.body.appendChild(overlay);

    setTimeout(() => {
        overlay.style.opacity = '0';
        setTimeout(() => {
            // 要素が存在するかチェックしてから削除
            if (overlay.parentNode) {
                document.body.removeChild(overlay);
            }
        }, 200);
    }, 50);
}

// Random respawn position
function getRandomRespawnPosition() {
    const angle = Math.random() * Math.PI * 2;
    const radius = RESPAWN_RADIUS_MIN + Math.random() * (RESPAWN_RADIUS_MAX - RESPAWN_RADIUS_MIN);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    // Make sure position is within world bounds
    const bound = WORLD_SIZE / 2 - 3;
    const clampedX = Math.max(-bound, Math.min(bound, x));
    const clampedZ = Math.max(-bound, Math.min(bound, z));

    return new THREE.Vector3(clampedX, PLAYER_EYE_HEIGHT, clampedZ);
}

// Handle player death and respawn
function handlePlayerDeath() {

    // Create blood splatter effect at death location for other players to see
    if (networkManager.isJoinedToRoom()) {
        networkManager.sendBloodEffectEvent(playerPosition.clone(), true); // true = large splatter
    }

    // Reset health
    health = 100;

    // Reset ammo to maximum
    magazine = MAG_SIZE;
    reserveAmmo = RESERVE_START;
    isReloading = false; // リロード状態もリセット

    // Get random respawn position
    const respawnPos = getRandomRespawnPosition();
    playerPosition.copy(respawnPos);

    // Reset velocity
    playerVelocity.set(0, 0, 0);

    // Reset camera rotation
    yawObject.rotation.y = Math.random() * Math.PI * 2; // Random starting direction
    pitchObject.rotation.x = 0;

    // Reset recoil
    targetRecoil = 0;
    currentRecoil = 0;
    targetHorizontalRecoil = 0;
    currentHorizontalRecoil = 0;
    recoilBuildup = 0;

    // ダメージ方向インジケーターを完全にクリア
    damageIndicators.forEach(indicator => indicator.destroy());
    damageIndicators.length = 0;

    // 画面上のすべてのダメージ方向インジケーター要素を強制削除
    const allDamageIndicators = document.querySelectorAll('[style*="z-index: 9998"]');
    allDamageIndicators.forEach(element => element.remove());

    // 精密削除 - ダメージインジケーターのみを削除
    const allFixedElements = document.querySelectorAll('div[style*="position: fixed"]');
    allFixedElements.forEach(element => {
        const style = element.style.cssText || '';
        const id = element.id || '';

        // 削除対象の条件
        const isDamageIndicator = style.includes('position: fixed') &&
            (style.includes('width: 30vh') || style.includes('width: 306.2px')) &&
            (style.includes('height: 30vh') || style.includes('height: 306.2px')) &&
            style.includes('z-index: 9998');

        // 除外対象
        const isDebugMenu = id === 'debug-menu';
        const isDamageFlash = style.includes('background-color: rgba(255, 0, 0, 0.3)');
        const isRespawnMessage = style.includes('color: white') && style.includes('fontSize: 24px');

        if (isDamageIndicator && !isDebugMenu && !isDamageFlash && !isRespawnMessage) {
            element.remove();
        }
    });

    // Send respawn event to network
    if (networkManager.isJoinedToRoom()) {
        networkManager.sendPlayerRespawnEvent(respawnPos);
    }

    // リスポーン完了 - フラグをリセット
    isRespawning = false;

    // Show respawn message
    const message = document.createElement('div');
    message.className = 'respawn-message';
    message.textContent = 'リスポーンしました！';
    document.body.appendChild(message);

    setTimeout(() => {
        document.body.removeChild(message);
    }, 2000);

    updateUI();
}

// Apply damage to player
function applyDamageToPlayer(damage, attackPosition = null) {
    // プレイヤーがすでにリスポーン中の場合はダメージを無視
    if (isRespawning) {
        return;
    }

    // 無敵状態の場合はHPを減らさない
    if (isInvincible) {
        console.log(`🛡️ 無敵状態のためダメージを無効化: ${damage}`);
        // ダメージ演出とインジケーターは表示する
        showDamageFlash();
        if (attackPosition) {
            addDamageIndicator(attackPosition, damage);
        }
        return;
    }

    health -= damage;

    // Show damage feedback
    showDamageFlash();

    // ダメージ方向インジケーターを表示（攻撃位置が分かる場合）
    if (attackPosition) {
        addDamageIndicator(attackPosition, damage);
    }

    // Create small blood effect when taking damage (but not dying)
    // Only for network - other players will see our blood
    if (health > 0 && networkManager.isJoinedToRoom()) {
        networkManager.sendBloodEffectEvent(playerPosition.clone(), false); // false = small effect
    }

    // Check if player died
    if (health <= 0 && !isRespawning) {
        health = 0;
        isRespawning = true; // リスポーンフラグを設定
        updateUI();
        setTimeout(handlePlayerDeath, 100); // 短い演出遅延（0.1秒）
    } else {
        updateUI();
    }
}

// Check if bullet hits player
function checkBulletPlayerCollision(bullet, bulletPrevPos, bulletNewPos) {
    // Skip own bullets (no self-damage)
    if (!bullet.userData.isNetworkBullet) {
        return false;
    }

    // プレイヤーがリスポーン中は当たり判定を無効化
    if (isRespawning) {
        return false;
    }

    // Use EXACT model dimensions for collision
    const playerRadius = 0.25; // Matches CapsuleGeometry radius exactly
    const bodyHeight = 0.9; // Matches CapsuleGeometry height exactly
    const headRadius = 0.25; // Matches SphereGeometry radius exactly

    // Calculate exact positions based on model setup
    const bodyBottom = playerPosition.y - PLAYER_EYE_HEIGHT + 0.45; // Body mesh position.y = 0.45
    const bodyTop = bodyBottom + bodyHeight;
    const headCenter = playerPosition.y - PLAYER_EYE_HEIGHT + 1.35; // Head mesh position.y = 1.35
    const headTop = headCenter + headRadius;
    const headBottom = headCenter - headRadius;

    // Multiple interpolation steps to prevent high-speed pass-through
    const bulletTravel = bulletNewPos.clone().sub(bulletPrevPos);
    const travelDistance = bulletTravel.length();

    // Calculate number of interpolation steps based on bullet speed
    // More steps for faster bullets or longer distances
    const maxStepSize = 0.1; // Maximum step size (10cm)
    const numSteps = Math.max(1, Math.ceil(travelDistance / maxStepSize));
    const stepVector = bulletTravel.clone().divideScalar(numSteps);

    // Check collision at each interpolation step
    for (let step = 0; step <= numSteps; step++) {
        const interpolatedPos = bulletPrevPos.clone().add(stepVector.clone().multiplyScalar(step));

        // Check collision with body (capsule) at this interpolated position
        if (interpolatedPos.y >= bodyBottom && interpolatedPos.y <= bodyTop) {
            const distanceToPlayer = interpolatedPos.distanceTo(new THREE.Vector3(playerPosition.x, interpolatedPos.y, playerPosition.z));
            if (distanceToPlayer < playerRadius) {
                // Show debug visualization when hit
                showDebugHitbox(
                    new THREE.Vector3(playerPosition.x, bodyBottom + bodyHeight / 2, playerPosition.z),
                    playerRadius,
                    bodyHeight,
                    0x00ff00
                );
                return true;
            }
        }

        // Check collision with head (sphere) at this interpolated position
        if (interpolatedPos.y >= headBottom && interpolatedPos.y <= headTop) {
            const distanceToHead = interpolatedPos.distanceTo(new THREE.Vector3(playerPosition.x, headCenter, playerPosition.z));
            if (distanceToHead < headRadius) {
                // Show debug visualization when hit
                showDebugHitbox(
                    new THREE.Vector3(playerPosition.x, headCenter, playerPosition.z),
                    headRadius,
                    headRadius * 2,
                    0x00ffff
                );
                return true;
            }
        }
    }

    // Also check raycast collision for fast-moving bullets
    const direction = bulletNewPos.clone().sub(bulletPrevPos).normalize();
    const distance = bulletPrevPos.distanceTo(bulletNewPos);
    raycaster.set(bulletPrevPos, direction);
    raycaster.far = distance;

    // Create temporary collision objects matching exact model geometry
    // Body capsule collision
    const tempBodyGeo = new THREE.CylinderGeometry(playerRadius, playerRadius, bodyHeight, 8);
    const tempBodyMat = new THREE.MeshBasicMaterial({ visible: false });
    const tempBody = new THREE.Mesh(tempBodyGeo, tempBodyMat);
    tempBody.position.copy(playerPosition);
    tempBody.position.y = bodyBottom + bodyHeight / 2; // Center the cylinder

    // Head sphere collision
    const tempHeadGeo = new THREE.SphereGeometry(headRadius, 8, 6);
    const tempHeadMat = new THREE.MeshBasicMaterial({ visible: false });
    const tempHead = new THREE.Mesh(tempHeadGeo, tempHeadMat);
    tempHead.position.copy(playerPosition);
    tempHead.position.y = headCenter;

    const bodyHits = raycaster.intersectObject(tempBody, false);
    const headHits = raycaster.intersectObject(tempHead, false);
    const hitPlayer = bodyHits.length > 0 || headHits.length > 0;

    if (hitPlayer) {
        // Show debug visualization when hit
        showDebugHitbox(
            new THREE.Vector3(playerPosition.x, bodyBottom + bodyHeight / 2, playerPosition.z),
            playerRadius,
            bodyHeight,
            0xffff00  // Yellow for raycast hits
        );
    }

    // Clean up temporary objects
    tempBodyGeo.dispose();
    tempBodyMat.dispose();
    tempHeadGeo.dispose();
    tempHeadMat.dispose();

    return hitPlayer;
}

// Bullet update and collision
const raycaster = new THREE.Raycaster();

function updateBullets(delta) {
    const now = performance.now() / 1000;
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        const userData = bullet.userData;

        // Remove old bullets
        if (now - userData.birthTime > BULLET_LIFETIME) {
            scene.remove(bullet);
            bullets.splice(i, 1);
            continue;
        }

        // Store previous position for interpolated collision
        const prevPos = bullet.position.clone();
        const newPos = prevPos.clone().add(userData.velocity.clone().multiplyScalar(delta));

        // Raycast from previous to new position for precise collision
        const direction = newPos.clone().sub(prevPos).normalize();
        const distance = prevPos.distanceTo(newPos);
        raycaster.set(prevPos, direction);
        raycaster.far = distance;

        // Check wall collision first (highest priority)
        const wallHits = raycaster.intersectObjects(walls, false);
        if (wallHits.length > 0) {
            // Hit wall - stop bullet at hit point
            scene.remove(bullet);
            bullets.splice(i, 1);
            continue;
        }

        // Check player collision (only for network bullets)
        if (checkBulletPlayerCollision(bullet, prevPos, newPos)) {
            // 攻撃位置を計算（弾丸の前の位置から）
            const attackPosition = prevPos.clone();
            applyDamageToPlayer(DAMAGE_PER_HIT, attackPosition);
            scene.remove(bullet);
            bullets.splice(i, 1);
            continue;
        }

        // Check collision with network players (only for own bullets)
        if (!userData.isNetworkBullet) {
            let hitNetworkPlayer = false;
            connectedPlayers.forEach((player, playerId) => {
                if (hitNetworkPlayer) return; // Already hit someone

                const playerWorldPos = new THREE.Vector3();
                player.getWorldPosition(playerWorldPos);

                // Use EXACT model dimensions for network player collision
                const playerRadius = 0.25; // Matches CapsuleGeometry radius exactly
                const bodyHeight = 0.9; // Matches CapsuleGeometry height exactly
                const headRadius = 0.25; // Matches SphereGeometry radius exactly

                // Calculate exact positions based on network player model
                // Network player model: body mesh at y=0.45, head mesh at y=1.35 (relative to player group)
                const bodyBottom = playerWorldPos.y + 0.45 - bodyHeight / 2; // Body center is at 0.45
                const bodyTop = bodyBottom + bodyHeight;
                const headCenter = playerWorldPos.y + 1.35; // Head center is at 1.35
                const headTop = headCenter + headRadius;
                const headBottom = headCenter - headRadius;

                let hitThisPlayer = false;

                // Check collision with body (capsule)
                // Multiple interpolation steps for network players too
                const networkBulletTravel = newPos.clone().sub(prevPos);
                const networkTravelDistance = networkBulletTravel.length();
                const networkMaxStepSize = 0.1; // Same step size as local player
                const networkNumSteps = Math.max(1, Math.ceil(networkTravelDistance / networkMaxStepSize));
                const networkStepVector = networkBulletTravel.clone().divideScalar(networkNumSteps);

                // Check collision at each interpolation step for network players
                for (let netStep = 0; netStep <= networkNumSteps && !hitThisPlayer; netStep++) {
                    const netInterpolatedPos = prevPos.clone().add(networkStepVector.clone().multiplyScalar(netStep));

                    // Check collision with body (capsule)
                    if (netInterpolatedPos.y >= bodyBottom && netInterpolatedPos.y <= bodyTop) {
                        const distanceToPlayer = netInterpolatedPos.distanceTo(new THREE.Vector3(playerWorldPos.x, netInterpolatedPos.y, playerWorldPos.z));
                        if (distanceToPlayer < playerRadius) {
                            // Show debug visualization when hit
                            showDebugHitbox(
                                new THREE.Vector3(playerWorldPos.x, bodyBottom + bodyHeight / 2, playerWorldPos.z),
                                playerRadius,
                                bodyHeight,
                                0xff0000
                            );
                            hitThisPlayer = true;
                            break;
                        }
                    }

                    // Check collision with head (sphere)
                    if (netInterpolatedPos.y >= headBottom && netInterpolatedPos.y <= headTop) {
                        const distanceToHead = netInterpolatedPos.distanceTo(new THREE.Vector3(playerWorldPos.x, headCenter, playerWorldPos.z));
                        if (distanceToHead < headRadius) {
                            // Show debug visualization when hit
                            showDebugHitbox(
                                new THREE.Vector3(playerWorldPos.x, headCenter, playerWorldPos.z),
                                headRadius,
                                headRadius * 2,
                                0xff6600
                            );
                            hitThisPlayer = true;
                            break;
                        }
                    }
                }

                if (hitThisPlayer) {
                    // Send damage event to network
                    if (networkManager.isJoinedToRoom()) {
                        // 攻撃位置を送信（弾丸の前の位置から）
                        networkManager.sendPlayerDamageEvent(playerId, DAMAGE_PER_HIT, prevPos);
                    }

                    scene.remove(bullet);
                    bullets.splice(i, 1);

                    // ヒットマーカーを表示（ネットワークプレイヤーに当たった時）
                    addHitmarker();

                    hitNetworkPlayer = true;
                }
            });

            if (hitNetworkPlayer) continue;
        }

        // Check target collision with interpolation
        let hitTarget = false;
        for (let j = targets.length - 1; j >= 0; j--) {
            const target = targets[j];

            // Check if bullet path passes through target
            const targetHits = raycaster.intersectObject(target, false);
            if (targetHits.length > 0) {
                scene.remove(target);
                scene.remove(bullet);
                targets.splice(j, 1);
                bullets.splice(i, 1);
                updateUI();

                // ヒットマーカーを表示（敵に当たった時）
                addHitmarker();

                hitTarget = true;
                break;
            }

            // Also check proximity at new position as fallback
            const distanceToTarget = newPos.distanceTo(target.position);
            if (distanceToTarget < 0.5) {
                scene.remove(target);
                scene.remove(bullet);
                targets.splice(j, 1);
                bullets.splice(i, 1);
                updateUI();

                // ヒットマーカーを表示（敵に当たった時）
                addHitmarker();

                hitTarget = true;
                break;
            }
        }

        if (hitTarget) continue;

        // Move bullet to new position
        bullet.position.copy(newPos);

        // Check world bounds (remove bullets that go too far)
        if (Math.abs(bullet.position.x) > WORLD_SIZE / 2 + 10 ||
            Math.abs(bullet.position.z) > WORLD_SIZE / 2 + 10 ||
            bullet.position.y < -5 || bullet.position.y > 50) {
            scene.remove(bullet);
            bullets.splice(i, 1);
        }
    }
}

// Movement helpers
function moveAndCollide(delta) {
    // horizontal move in camera yaw space
    let inputX = 0, inputZ = 0;
    if (keyState.get('KeyW')) inputZ -= 1;
    if (keyState.get('KeyS')) inputZ += 1;
    if (keyState.get('KeyA')) inputX -= 1;
    if (keyState.get('KeyD')) inputX += 1;
    const len = Math.hypot(inputX, inputZ) || 1;
    inputX /= len; inputZ /= len;

    const speed = WALK_SPEED * (keyState.get('ShiftLeft') || keyState.get('ShiftRight') ? SPRINT_MULTIPLIER : 1);
    // Rotate input by yaw to align with view direction
    const sin = Math.sin(yawObject.rotation.y), cos = Math.cos(yawObject.rotation.y);
    const moveX = (inputX * cos + inputZ * sin) * speed * delta;
    const moveZ = (-inputX * sin + inputZ * cos) * speed * delta;

    playerPosition.x += moveX;
    playerPosition.z += moveZ;

    // world bounds
    const margin = 2.0;
    const bound = WORLD_SIZE / 2 - margin;
    playerPosition.x = Math.max(-bound, Math.min(bound, playerPosition.x));
    playerPosition.z = Math.max(-bound, Math.min(bound, playerPosition.z));

    // gravity & jump
    const onGround = playerPosition.y <= PLAYER_EYE_HEIGHT + 0.001;
    if (onGround) {
        playerPosition.y = PLAYER_EYE_HEIGHT;
        playerVelocity.y = 0;
        if (keyState.get('Space')) {
            playerVelocity.y = JUMP_SPEED;
        }
    } else {
        playerVelocity.y -= GRAVITY * delta;
    }
    playerPosition.y += playerVelocity.y * delta;
    if (playerPosition.y < PLAYER_EYE_HEIGHT) {
        playerPosition.y = PLAYER_EYE_HEIGHT;
        playerVelocity.y = 0;
    }
}

// Init
resetGame();

// Create default stage
StageCreator.createBasicArena();

// Initialize P2P when page loads
window.addEventListener('load', () => {
    // Check if PeerJS is loaded
    if (typeof Peer === 'undefined') {
        console.error('PeerJS not loaded');
        connectionStatus.textContent = 'PeerJS failed to load';
        return;
    }

    // Load and restore saved player name
    const savedPlayerName = PlayerNameStorage.load();
    if (savedPlayerName) {
        playerNameInput.value = savedPlayerName;
    } else {
        // Set default name for new users
        playerNameInput.value = 'Player1';
    }

    networkManager.initialize();

    // Add info message about manual room refresh
    setTimeout(() => {
        if (connectionStatus.textContent === 'Ready to connect') {
            connectionStatus.textContent = 'Ready! Click "Refresh Rooms" to find available rooms';
        }
    }, 2000);
});

// Resize handling
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Billboard function to make nameplates always face the camera
function updateNameplateBillboards() {
    connectedPlayers.forEach((player, peerId) => {
        // Get the nameplate from the stored reference
        const nameTag = player.userData.nameTag;
        if (nameTag) {
            // Update nameplate position to follow player (with height offset)
            const playerWorldPos = new THREE.Vector3();
            player.getWorldPosition(playerWorldPos);
            nameTag.position.copy(playerWorldPos);
            nameTag.position.y += 2; // Height offset above player

            // Calculate direction vector from nameplate to camera
            const direction = new THREE.Vector3();
            direction.subVectors(camera.position, nameTag.position);

            // Calculate only Y-axis rotation (horizontal rotation) to face camera
            const horizontalDirection = new THREE.Vector3(direction.x, 0, direction.z);
            horizontalDirection.normalize();

            // Calculate angle and apply rotation
            const angle = Math.atan2(horizontalDirection.x, horizontalDirection.z);

            // Set rotation directly - only rotate around Y axis to keep upright
            nameTag.rotation.set(0, angle, 0);
        }
    });
}

// Main loop
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    // Always update bullets and network players (even when paused)
    updateBullets(delta);
    networkManager.updateNetworkPlayers(delta);
    updateNameplateBillboards();
    updateBloodParticles(delta); // 血しぶきパーティクルを更新
    updateDamageIndicators(); // ダメージ方向インジケーターを更新
    updateHitmarkers(); // ヒットマーカーを更新

    // Update debug collision visualization
    if (DEBUG_COLLISION) {
        updateDebugHitboxes();
    }

    if (!isPaused) {
        // Only update player movement and shooting when not paused
        moveAndCollide(delta);

        // Update recoil recovery
        updateRecoil(delta);

        // Full-auto shooting
        if (mouseDown && pointerLocked) {
            attemptShoot();
        }

        // Update player body position and rotation
        playerBody.position.copy(playerPosition);
        playerBody.position.y = playerPosition.y - PLAYER_EYE_HEIGHT; // adjust for eye height offset
        playerBody.rotation.y = yawObject.rotation.y; // body follows yaw rotation

        // Send network updates
        if (networkManager.isJoinedToRoom()) {
            // Send player position update at 20fps (every 3 frames at 60fps)
            if (Math.floor(performance.now() / 1000 * 20) !== networkManager.lastUpdateFrame) {
                networkManager.lastUpdateFrame = Math.floor(performance.now() / 1000 * 20);
                networkManager.sendPlayerUpdate(playerPosition, { yaw: yawObject.rotation.y, pitch: pitchObject.rotation.x });
            }
        }
    }

    // Update yaw object position
    yawObject.position.copy(playerPosition);

    // Camera positioning with quaternion-based control
    if (isThirdPerson) {
        // Third person camera behind player
        const cameraDistance = 4;

        // Get camera direction from quaternion objects
        const direction = new THREE.Vector3(0, 0, 1);
        direction.applyQuaternion(pitchObject.quaternion);
        direction.applyQuaternion(yawObject.quaternion);

        // Position camera behind player
        camera.position.copy(playerPosition).add(direction.multiplyScalar(-cameraDistance));
        camera.position.y += 2; // Height offset

        // Look at player
        camera.lookAt(playerPosition);
    } else {
        // First person camera - debug quaternion application
        camera.position.copy(playerPosition);



        // Method 1: Try simple euler application first
        camera.rotation.order = 'YXZ';
        camera.rotation.y = yawObject.rotation.y;
        camera.rotation.x = pitchObject.rotation.x;
        camera.rotation.z = 0;

        // カメラ回転のNaNをチェック
        if (isNaN(camera.rotation.x) || isNaN(camera.rotation.y) || isNaN(camera.rotation.z)) {
            console.error('🚨 カメラ回転でNaNを検出！');
            camera.rotation.set(0, 0, 0);
            yawObject.rotation.y = 0;
            pitchObject.rotation.x = 0;
        }
    }

    renderer.render(scene, camera);
}
animate();

// デバッグメニューを作成
function createDebugMenu() {
    // 既存のデバッグメニューがあれば削除
    const existingMenu = document.getElementById('debug-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    const menu = document.createElement('div');
    menu.id = 'debug-menu';

    // タイトル
    const title = document.createElement('h3');
    title.textContent = 'デバッグメニュー';
    menu.appendChild(title);

    // 無敵状態のチェックボックス
    const invincibleContainer = document.createElement('div');
    invincibleContainer.style.marginBottom = '10px';

    const invincibleCheckbox = document.createElement('input');
    invincibleCheckbox.type = 'checkbox';
    invincibleCheckbox.id = 'invincible-checkbox';
    invincibleCheckbox.checked = isInvincible;
    invincibleCheckbox.addEventListener('change', (e) => {
        isInvincible = e.target.checked;
        console.log(`🛡️ 無敵状態: ${isInvincible ? 'ON' : 'OFF'}`);
    });

    const invincibleLabel = document.createElement('label');
    invincibleLabel.htmlFor = 'invincible-checkbox';
    invincibleLabel.textContent = '無敵状態';
    invincibleLabel.style.marginLeft = '8px';
    invincibleLabel.style.cursor = 'pointer';

    invincibleContainer.appendChild(invincibleCheckbox);
    invincibleContainer.appendChild(invincibleLabel);
    menu.appendChild(invincibleContainer);

    // 閉じるボタン
    const closeButton = document.createElement('button');
    closeButton.textContent = '閉じる (P)';
    closeButton.addEventListener('click', toggleDebugMenu);
    menu.appendChild(closeButton);

    document.body.appendChild(menu);
    return menu;
}

// デバッグメニューの表示/非表示を切り替え
function toggleDebugMenu() {
    const menu = document.getElementById('debug-menu');
    if (!menu) {
        createDebugMenu();
        return;
    }

    isDebugMenuOpen = !isDebugMenuOpen;
    menu.style.display = isDebugMenuOpen ? 'block' : 'none';

    if (isDebugMenuOpen) {
        console.log('🔧 デバッグメニューを開きました');
    }
}

// デバッグメニューを初期化
let debugMenu = null;
document.addEventListener('DOMContentLoaded', () => {
    debugMenu = createDebugMenu();
});

// ヒットマーカークラス
class Hitmarker {
    constructor() {
        this.birthTime = performance.now() / 1000;
        this.element = this.createHitmarkerElement();

        // DOMに追加する前に要素が正しく作成されているかチェック
        if (this.element && document.body) {
            document.body.appendChild(this.element);
        } else {
            throw new Error('ヒットマーカー要素の作成に失敗しました');
        }
    }

    // ヒットマーカー要素を作成
    createHitmarkerElement() {
        const container = document.createElement('div');
        container.className = 'hitmarker';

        // 交差部分が消えたバツマークを作成（4つの線）
        const lineLength = (HITMARKER_SIZE - HITMARKER_GAP) / 2;
        const horizontalOffset = 4; // 左右の間隔を広げるオフセット
        const lines = [
            // 左上から右下への線（上半分）
            {
                top: '0',
                left: `calc(50% + ${horizontalOffset}px)`,
                width: HITMARKER_THICKNESS + 'px',
                height: lineLength + 'px',
                transform: 'translateX(-50%) rotate(45deg)',
                transformOrigin: 'bottom center'
            },
            // 左上から右下への線（下半分）
            {
                bottom: '0',
                left: `calc(50% + ${horizontalOffset}px)`,
                width: HITMARKER_THICKNESS + 'px',
                height: lineLength + 'px',
                transform: 'translateX(-50%) rotate(-45deg)',
                transformOrigin: 'top center'
            },
            // 右上から左下への線（上半分）
            {
                top: '0',
                left: `calc(50% - ${horizontalOffset}px)`,
                width: HITMARKER_THICKNESS + 'px',
                height: lineLength + 'px',
                transform: 'translateX(-50%) rotate(-45deg)',
                transformOrigin: 'bottom center'
            },
            // 右上から左下への線（下半分）
            {
                bottom: '0',
                left: `calc(50% - ${horizontalOffset}px)`,
                width: HITMARKER_THICKNESS + 'px',
                height: lineLength + 'px',
                transform: 'translateX(-50%) rotate(45deg)',
                transformOrigin: 'top center'
            }
        ];

        lines.forEach(lineStyle => {
            const line = document.createElement('div');
            line.className = 'hitmarker-line';

            // 各線のスタイルを適用
            Object.assign(line.style, lineStyle);

            container.appendChild(line);
        });

        return container;
    }

    // ヒットマーカーを更新
    update() {
        const now = performance.now() / 1000;
        const age = now - this.birthTime;
        const lifeRatio = Math.min(1, age / HITMARKER_DURATION);

        // フェードアウト効果
        const opacity = 1 - lifeRatio;
        this.element.style.opacity = opacity.toString();

        // サイズの変化（少し大きくなる）
        const scale = 1 + (lifeRatio * 0.2);
        this.element.style.transform = `translate(-50%, -50%) scale(${scale})`;
    }

    // ヒットマーカーを削除
    destroy() {
        if (this.element && this.element.parentNode) {
            // トランジション効果を無効にして即座に非表示
            this.element.style.transition = 'none';
            this.element.style.opacity = '0';
            this.element.style.display = 'none';

            // DOMから削除
            this.element.parentNode.removeChild(this.element);
        }
    }

    // ヒットマーカーが期限切れかチェック
    isExpired() {
        const now = performance.now() / 1000;
        return (now - this.birthTime) > HITMARKER_DURATION;
    }
}

// ヒットマーカーを追加
function addHitmarker() {
    try {
        const hitmarker = new Hitmarker();
        hitmarkers.push(hitmarker);
    } catch (error) {
        console.error('❌ ヒットマーカー作成エラー:', error);
    }
}

// ヒットマーカーを更新
function updateHitmarkers() {
    for (let i = hitmarkers.length - 1; i >= 0; i--) {
        const hitmarker = hitmarkers[i];

        try {
            if (hitmarker.isExpired()) {
                hitmarker.destroy();
                hitmarkers.splice(i, 1);
            } else {
                hitmarker.update();
            }
        } catch (error) {
            console.error('❌ ヒットマーカー更新エラー:', error);
            // エラーが発生したヒットマーカーを削除
            hitmarkers.splice(i, 1);
        }
    }
}


