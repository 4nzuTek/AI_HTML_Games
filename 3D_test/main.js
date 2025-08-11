// ===== Mini FPS =====
// Config
const WORLD_SIZE = 120;
const PLAYER_EYE_HEIGHT = 1.7;
const WALK_SPEED = 6;            // m/s
const SPRINT_MULTIPLIER = 1.6;
const JUMP_SPEED = 6.5;
const GRAVITY = 18;              // m/s^2
const FIRE_COOLDOWN_S = 0.12;    // seconds per shot
const MAG_SIZE = 12;
const RESERVE_START = 36;
const RELOAD_TIME_S = 1.1;
const MOUSE_SENSITIVITY = 0.002;

// State
let isPaused = true;
let isGameOver = false;
let pointerLocked = false;
let isReloading = false;
let magazine = MAG_SIZE;
let reserveAmmo = RESERVE_START;
let health = 100;
let lastShotAt = 0;

// Input
const keyState = new Map();
window.addEventListener('keydown', (e) => {
    keyState.set(e.code, true);
    if (e.code === 'KeyP') togglePause();
    if (e.code === 'KeyR') reload();
});
window.addEventListener('keyup', (e) => keyState.set(e.code, false));

// UI elements
const hudHealthEl = document.getElementById('health');
const hudAmmoEl = document.getElementById('ammo');
const hudReserveEl = document.getElementById('reserve');
const hudTargetsEl = document.getElementById('targets');
const banner = document.getElementById('banner');
const bannerText = document.getElementById('banner-text');
const bannerBtn = document.getElementById('banner-btn');
banner.style.display = 'block';
bannerText.textContent = 'FPS Demo - Click Play to start';
bannerBtn.textContent = 'Play';

// Three.js setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f1117);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
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
    scene.add(wall);
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

// Player (first-person camera only)
const playerPosition = new THREE.Vector3(0, PLAYER_EYE_HEIGHT, 0);
const playerVelocity = new THREE.Vector3(0, 0, 0);
let yaw = 0;
let pitch = 0;

// Pointer lock look
function onMouseMove(e) {
    if (!pointerLocked) return;
    yaw -= e.movementX * MOUSE_SENSITIVITY;
    pitch -= e.movementY * MOUSE_SENSITIVITY;
    const maxPitch = Math.PI / 2 - 0.01;
    pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));
}
document.addEventListener('mousemove', onMouseMove);

// Shooting
const raycaster = new THREE.Raycaster();
document.addEventListener('mousedown', (e) => {
    if (!pointerLocked || e.button !== 0) return;
    attemptShoot();
});

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

    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const hits = raycaster.intersectObjects(targets, false);
    if (hits.length > 0) {
        const hit = hits[0].object;
        const idx = targets.indexOf(hit);
        if (idx >= 0) {
            scene.remove(hit);
            targets.splice(idx, 1);
        }
    }
    updateUI();
}

function reload() {
    if (isReloading) return;
    if (magazine >= MAG_SIZE) return;
    if (reserveAmmo <= 0) return;
    isReloading = true;
    setTimeout(() => {
        const need = MAG_SIZE - magazine;
        const take = Math.min(need, reserveAmmo);
        magazine += take;
        reserveAmmo -= take;
        isReloading = false;
        updateUI();
    }, RELOAD_TIME_S * 1000);
}

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
    yaw = 0; pitch = 0;
    playerPosition.set(0, PLAYER_EYE_HEIGHT, 0);
    playerVelocity.set(0, 0, 0);
    spawnTargets(12);
    updateUI();
}

function updateUI() {
    if (hudHealthEl) hudHealthEl.textContent = String(health);
    if (hudAmmoEl) hudAmmoEl.textContent = String(magazine);
    if (hudReserveEl) hudReserveEl.textContent = String(reserveAmmo);
    if (hudTargetsEl) hudTargetsEl.textContent = String(targets.length);
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
    // Rotate input by +yaw to align with view direction
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
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

// Resize handling
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Main loop
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (!isPaused) {
        moveAndCollide(delta);
    }

    // camera pose
    camera.position.copy(playerPosition);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');

    renderer.render(scene, camera);
}
animate();


