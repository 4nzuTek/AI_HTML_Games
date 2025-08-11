// ===== Mini FPS =====
// Config
const WORLD_SIZE = 120;
const PLAYER_EYE_HEIGHT = 1.7;
const WALK_SPEED = 6;            // m/s
const SPRINT_MULTIPLIER = 1.6;
const JUMP_SPEED = 6.5;
const GRAVITY = 18;              // m/s^2
const FIRE_COOLDOWN_S = 0.08;    // seconds per shot (faster full-auto)
const MAG_SIZE = 30;
const RESERVE_START = 300;
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
let isThirdPerson = false;

// Input
const keyState = new Map();
let mouseDown = false;

window.addEventListener('keydown', (e) => {
    keyState.set(e.code, true);
    if (e.code === 'KeyP') toggleViewMode();
    if (e.code === 'KeyR') reload();
    if (e.code === 'Escape') {
        if (pointerLocked) {
            document.exitPointerLock(); // Release pointer lock
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
const walls = [];
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

// Bullets
const bullets = [];
const bulletGeo = new THREE.SphereGeometry(0.06, 8, 8);
const bulletMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x332200 });
const BULLET_SPEED = 225; // m/s (5x faster)
const BULLET_LIFETIME = 3; // seconds

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

    // Create bullet
    const bullet = new THREE.Mesh(bulletGeo, bulletMat);
    bullet.position.copy(camera.position);

    // Calculate shooting direction from camera
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(camera.quaternion);

    bullet.userData = {
        velocity: direction.multiplyScalar(BULLET_SPEED),
        birthTime: now,
        isBullet: true
    };

    scene.add(bullet);
    bullets.push(bullet);
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
    yaw = 0; pitch = 0;
    isThirdPerson = false;
    playerPosition.set(0, PLAYER_EYE_HEIGHT, 0);
    playerVelocity.set(0, 0, 0);
    playerBody.visible = false;

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
        updateBullets(delta);

        // Full-auto shooting
        if (mouseDown && pointerLocked) {
            attemptShoot();
        }

        // Update player body position and rotation
        playerBody.position.copy(playerPosition);
        playerBody.position.y = playerPosition.y - PLAYER_EYE_HEIGHT; // adjust for eye height offset
        playerBody.rotation.y = yaw; // body follows yaw rotation
    }

    // Camera positioning
    if (isThirdPerson) {
        // Third person camera behind player with pitch support
        const cameraDistance = 4;
        const cameraHeight = 2;

        // Calculate camera position considering both yaw and pitch
        const cameraOffset = new THREE.Vector3(
            Math.sin(yaw) * Math.cos(pitch) * cameraDistance,
            cameraHeight - Math.sin(pitch) * cameraDistance,
            Math.cos(yaw) * Math.cos(pitch) * cameraDistance
        );
        camera.position.copy(playerPosition).add(cameraOffset);

        // Look at a point in front of the player considering pitch
        const lookAtTarget = playerPosition.clone().add(new THREE.Vector3(
            -Math.sin(yaw) * Math.cos(pitch),
            Math.sin(pitch),
            -Math.cos(yaw) * Math.cos(pitch)
        ));
        camera.lookAt(lookAtTarget);
    } else {
        // First person camera
        camera.position.copy(playerPosition);
        camera.rotation.set(pitch, yaw, 0, 'YXZ');
    }

    renderer.render(scene, camera);
}
animate();


