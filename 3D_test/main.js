// ===== Mini FPS with Photon Fusion =====
// Photon Configuration
const PHOTON_APP_ID = "d2b05894-f70e-4fbd-b86e-f96c9837017f";
let photonClient = null;
let isHost = false;
let connectedPlayers = new Map();
let nextPlayerColorIndex = 0; // Host manages color assignment order

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
const MOUSE_SENSITIVITY = 0.002; // Standard FPS sensitivity

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
    if (e.code === 'KeyT') {
        // Debug: Show current angles (Quaternion-based)
        console.log(`Debug - Yaw: ${(yawObject.rotation.y * 180 / Math.PI).toFixed(1)}°, Pitch: ${(pitchObject.rotation.x * 180 / Math.PI).toFixed(1)}°`);

        // Safety check and auto-correction
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

    // Stage switching (only when playing)
    if (pointerLocked && !isPaused) {
        switch (e.code) {
            case 'Digit1':
                StageCreator.createBasicArena();
                console.log('🏗️ Switched to Basic Arena');
                break;
            case 'Digit2':
                StageCreator.createUrbanMap();
                console.log('🏙️ Switched to Urban Map');
                break;
            case 'Digit3':
                StageCreator.createForestMap();
                console.log('🌲 Switched to Forest Map');
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
                                console.log(`✅ Cubemap skybox loaded: ${ext.toUpperCase()}`);
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
                                    console.log(`✅ Equirectangular skybox loaded: ${filename}.${ext.toUpperCase()}`);
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
        console.log('🌈 No skybox files found, using gradient sky');
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
    console.log('🌈 Using fallback gradient sky');
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
        console.log(`🚫 Filtered extreme movement: X=${movementX}, Y=${movementY}`);
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
            console.log(`🚫 Filtered sudden acceleration: ${acceleration.toFixed(1)}`);
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
        velocity: direction.clone().multiplyScalar(BULLET_SPEED),
        birthTime: now,
        isBullet: true
    };

    scene.add(bullet);
    bullets.push(bullet);

    // Send network shoot event
    if (networkManager.isJoinedToRoom()) {
        networkManager.sendShootEvent(camera.position, direction);
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
            console.log("Initializing P2P connection...");
            this.updateConnectionStatus("Initializing P2P...");

            // Create PeerJS instance with random ID
            this.playerId = 'fps-' + Math.random().toString(36).substr(2, 9);
            this.peer = new Peer(this.playerId);

            this.peer.on('open', (id) => {
                console.log('P2P connection established with ID:', id);
                this.playerId = id;
                this.isConnected = true;
                this.updateConnectionStatus("Ready to connect");
                createRoomBtn.disabled = false;
                joinRoomBtn.disabled = false;
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
        console.log('Incoming connection from:', conn.peer);

        conn.on('open', () => {
            console.log('Connection opened with:', conn.peer);
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
            console.log(`📤 Host welcome: sending position (${playerPosition.x.toFixed(1)}, ${playerPosition.y.toFixed(1)}, ${playerPosition.z.toFixed(1)}) to ${conn.peer}`);
        });

        conn.on('data', (data) => {
            this.handleNetworkMessage(data, conn.peer);
        });

        conn.on('close', () => {
            console.log('Connection closed with:', conn.peer);
            this.connections.delete(conn.peer);
            this.removeNetworkPlayer(conn.peer);
        });
    }

    async createRoom(roomId, playerName) {
        if (!this.isConnected) return false;

        try {
            console.log(`Creating room: ${roomId} as ${playerName}`);
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
            console.log(`Joining room: ${roomId} as ${playerName}`);
            this.updateConnectionStatus(`Connecting to room ${roomId}...`);
            this.playerName = playerName;
            this.currentRoom = roomId;

            // Connect to room host using predictable ID
            const hostPeerId = `fps-room-${roomId}`;
            const conn = this.peer.connect(hostPeerId);

            conn.on('open', () => {
                console.log('Connected to room:', roomId);
                this.connections.set(hostPeerId, conn);
                this.updateConnectionStatus(`Joined room ${roomId}!`);
                this.showGameStartButton();

                // Send join message
                conn.send({
                    type: 'playerJoin',
                    playerName: this.playerName,
                    playerId: this.playerId
                });
            });

            conn.on('data', (data) => {
                this.handleNetworkMessage(data, hostPeerId);
            });

            conn.on('close', () => {
                console.log('Disconnected from room');
                this.connections.delete(hostPeerId);
                this.updateConnectionStatus("Disconnected from room");
            });

            conn.on('error', (err) => {
                console.error('Connection error:', err);
                this.updateConnectionStatus(`Failed to join room ${roomId}: ${err.message}`);
            });

            return true;
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

        // Check only rooms 1-10 for active hosts (reduced to minimize errors)
        const promises = [];
        for (let i = 1; i <= 10; i++) {
            promises.push(this.checkRoomExists(i));
        }

        await Promise.allSettled(promises);
        this.updateRoomsList();
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
            }, 1000); // Reduced timeout for faster searching

            testConn.on('open', () => {
                clearTimeout(timeout);
                // Room exists, add to available rooms
                this.availableRooms.set(roomId, {
                    hostName: 'Host',
                    playerCount: '?',
                    peerId: hostPeerId
                });
                testConn.close();
                resolve(true);
            });

            testConn.on('error', (err) => {
                clearTimeout(timeout);
                // Suppress "Could not connect" errors as they're expected
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

    handleNetworkMessage(data, peerId) {
        switch (data.type) {
            case 'playerJoin':
                console.log(`${data.playerName} joined the game`);

                // Don't create network player for yourself
                if (peerId === this.playerId) {
                    console.log(`🚫 Ignoring own playerJoin message`);
                    break;
                }

                // If this is the host, assign color to new player BEFORE creating
                let assignedColorIndex = data.colorIndex;
                if (this.isHost) {
                    // Assign color to new player (skip 0 for host)
                    assignedColorIndex = nextPlayerColorIndex + 1; // Host is 0, guests start from 1
                    nextPlayerColorIndex++;
                    console.log(`🎯 Host assigning color index ${assignedColorIndex} to ${data.playerName}`);
                }

                this.createNetworkPlayer(peerId, data.playerName, assignedColorIndex);

                // If this is the host, send back host info AND all existing players to the new player
                if (this.isHost) {
                    const conn = this.connections.get(peerId);
                    if (conn && conn.open) {
                        // Send host info (always color index 0)
                        console.log(`📤 Host sending own info to ${data.playerName}: color index 0`);
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
                        console.log(`📤 Host sending own position to ${data.playerName}: (${playerPosition.x.toFixed(1)}, ${playerPosition.y.toFixed(1)}, ${playerPosition.z.toFixed(1)})`);

                        // Send info about all other existing players with their assigned colors AND positions
                        connectedPlayers.forEach((player, existingPeerId) => {
                            if (existingPeerId !== peerId && player.userData.playerName) {
                                console.log(`📤 Host sending existing player ${player.userData.playerName} info: color index ${player.userData.colorIndex}`);
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
                                    console.log(`📤 Host sending existing player ${player.userData.playerName} position: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`);
                                }
                            }
                        });

                        // IMPORTANT: Send the new player's own color assignment back to them
                        console.log(`📤 Host sending new player ${data.playerName} their own color: index ${assignedColorIndex}`);
                        conn.send({
                            type: 'playerColorAssignment',
                            colorIndex: assignedColorIndex
                        });
                    }
                }
                break;
            case 'playerColorAssignment':
                console.log(`🎨 Received color assignment: index ${data.colorIndex}`);
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
                        console.log(`🎨 Updated own player body color to #${newColor.toString(16)}`);
                    }
                }
                break;
            case 'playerUpdate':
                this.handlePlayerUpdate(data, peerId);
                break;
            case 'playerShoot':
                this.handlePlayerShoot(data, peerId);
                break;
        }
    }

    handlePlayerUpdate(data, peerId) {
        if (peerId === this.playerId) return; // Ignore own updates

        // Only update existing players - don't create unknown players
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

        // Create network bullet
        const bullet = new THREE.Mesh(bulletGeo, bulletMat);
        bullet.position.set(data.ox, data.oy, data.oz);

        const direction = new THREE.Vector3(data.dx, data.dy, data.dz);
        bullet.userData = {
            velocity: direction.multiplyScalar(BULLET_SPEED),
            birthTime: performance.now() / 1000,
            isBullet: true,
            isNetworkBullet: true
        };

        scene.add(bullet);
        bullets.push(bullet);
    }

    createNetworkPlayer(peerId, playerName = 'Player', assignedColorIndex = null) {
        // Check if player already exists
        if (connectedPlayers.has(peerId)) {
            console.warn(`⚠️ Player ${peerId} (${playerName}) already exists! Skipping creation.`);
            return;
        }

        console.log(`✨ Creating new network player: ${playerName} (ID: ${peerId})`);

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
            console.log(`🎨 Player ${playerName} assigned color index ${colorIndex} by host (received: ${assignedColorIndex})`);
        } else {
            // Fallback for host or when no color assigned
            colorIndex = connectedPlayers.size % playerColors.length;
            console.log(`🎨 Player ${playerName} using fallback color index ${colorIndex} (assignedColorIndex was: ${assignedColorIndex})`);
        }

        const playerColor = playerColors[colorIndex];
        console.log(`   Color: #${playerColor.toString(16)}`);

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

        console.log(`🎨 Created player ${playerName} with color index ${colorIndex} (${playerColor.toString(16)})`);

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

        console.log(`📊 Total connected players: ${connectedPlayers.size}`);
        console.log(`🎮 All player IDs:`, Array.from(connectedPlayers.keys()));
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
        console.log('🏗️ Creating basic arena stage...');

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

        console.log(`✅ Basic arena created with ${stageObjects.length} objects`);
    }

    static createUrbanMap() {
        console.log('🏙️ Creating urban map stage...');

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

        console.log(`✅ Urban map created with ${stageObjects.length} objects`);
    }

    static createForestMap() {
        console.log('🌲 Creating forest map stage...');

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

        console.log(`✅ Forest map created with ${stageObjects.length} objects`);
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
            console.warn('Could not save player name:', e);
        }
    },

    load() {
        try {
            return localStorage.getItem(this.KEY) || '';
        } catch (e) {
            console.warn('Could not load player name:', e);
            return '';
        }
    }
};

// Button event handlers
createRoomBtn.onclick = () => {
    const roomId = parseInt(roomIdInput.value);
    const playerName = playerNameInput.value.trim();
    if (roomId && roomId >= 1 && roomId <= 9999 && playerName) {
        PlayerNameStorage.save(playerName); // Save player name
        networkManager.createRoom(roomId, playerName);
    } else {
        alert('Please enter a room number (1-9999) and player name');
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

    console.log('PeerJS loaded successfully');

    // Load and restore saved player name
    const savedPlayerName = PlayerNameStorage.load();
    if (savedPlayerName) {
        playerNameInput.value = savedPlayerName;
        console.log('Restored player name:', savedPlayerName);
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

    if (!isPaused) {
        // Only update player movement and shooting when not paused
        moveAndCollide(delta);

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

        // Occasional debug logging (reduced frequency)
        if (Math.random() < 0.001) { // 0.1% chance to log
            console.log(`Camera angles - Yaw: ${(yawObject.rotation.y * 180 / Math.PI).toFixed(1)}°, Pitch: ${(pitchObject.rotation.x * 180 / Math.PI).toFixed(1)}°`);
        }

        // Method 1: Try simple euler application first
        camera.rotation.order = 'YXZ';
        camera.rotation.y = yawObject.rotation.y;
        camera.rotation.x = pitchObject.rotation.x;
        camera.rotation.z = 0;

        // Check for NaN in camera rotation
        if (isNaN(camera.rotation.x) || isNaN(camera.rotation.y) || isNaN(camera.rotation.z)) {
            console.error('🚨 NaN detected in camera rotation!');
            camera.rotation.set(0, 0, 0);
            yawObject.rotation.y = 0;
            pitchObject.rotation.x = 0;
        }
    }

    renderer.render(scene, camera);
}
animate();


