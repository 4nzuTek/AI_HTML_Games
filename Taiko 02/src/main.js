import { createInput } from './core/input.js';
import { createAudio } from './core/audio.js';
import { createTjaParser } from './core/tja-parser.js';
import { createGameScene } from './scenes/game-scene.js';
import { createMenuScene } from './scenes/menu-scene.js';
import { createSongSelectScene } from './scenes/song-select-scene.js';

// Canvas初期化
const canvas = document.getElementById('game');
const ctx = fitCanvas(canvas);

// コアシステム初期化
const Input = createInput(window, canvas);
const Audio = createAudio();
const TjaParser = createTjaParser();

// グローバルに公開（メニューシーンで使用）
window.Input = Input;

// シーン管理
let currentScene = null;
let nextScene = null;

// ゲーム状態
const gameState = {
    score: 0,
    combo: 0,
    accuracy: 100,
    selectedSong: null,
    selectedDifficulty: 'Normal',
    noteOffset: 0 // ノートオフセット設定（ミリ秒）
};

// ローカルストレージから設定を読み込み
function loadSettings() {
    const savedOffset = localStorage.getItem('taikoNoteOffset');
    const savedDifficulty = localStorage.getItem('taikoLastDifficulty');

    if (savedOffset !== null) {
        gameState.noteOffset = parseInt(savedOffset);
    }
    if (savedDifficulty !== null) {
        gameState.selectedDifficulty = savedDifficulty;
    }
}

// 設定をローカルストレージに保存
function saveSettings() {
    localStorage.setItem('taikoNoteOffset', gameState.noteOffset.toString());
    localStorage.setItem('taikoLastDifficulty', gameState.selectedDifficulty);
}

// 設定を読み込み
loadSettings();

// オフセット入力のイベントリスナー
document.addEventListener('DOMContentLoaded', () => {
    const offsetInput = document.getElementById('offsetInput');
    if (offsetInput) {
        // 保存された値を設定（プレイヤー目線で正負を逆に表示）
        offsetInput.value = -gameState.noteOffset;

        // 値が変更された時の処理（プレイヤー目線で正負を逆に処理）
        offsetInput.addEventListener('input', (e) => {
            const value = parseInt(e.target.value) || 0;
            gameState.noteOffset = Math.max(-3000, Math.min(3000, -value));
            saveSettings();
        });
    }
});

// シーン初期化
const scenes = {
    menu: createMenuScene(gameState, () => switchScene('game')),
    game: createGameScene(gameState, Input, Audio, TjaParser, () => switchScene('menu'))
};

// シーン切り替え
function switchScene(sceneName) {
    if (currentScene) {
        currentScene.leave();
    }
    currentScene = scenes[sceneName];
    if (currentScene) {
        currentScene.enter();
    }
}

// ゲームループ（FPS制限なし）
let last = performance.now();
function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    update(dt);
    render(ctx);
    requestAnimationFrame(loop);
}

function update(dt) {
    Input.update(dt);
    if (currentScene) {
        currentScene.update(dt);
    }
}

function render(ctx) {
    ctx.clearRect(0, 0, 1280, 720);
    if (currentScene) {
        currentScene.render(ctx);
    }
}

// Canvas調整関数
function fitCanvas(canvas, baseW = 1280, baseH = 720) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.min(innerWidth / baseW, innerHeight / baseH);

    canvas.style.width = baseW * scale + 'px';
    canvas.style.height = baseH * scale + 'px';
    canvas.width = Math.round(baseW * scale * dpr);
    canvas.height = Math.round(baseH * scale * dpr);

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);

    addEventListener('resize', () => fitCanvas(canvas, baseW, baseH), { passive: true });
    return ctx;
}

// ゲーム開始
switchScene('menu');
requestAnimationFrame(loop);
