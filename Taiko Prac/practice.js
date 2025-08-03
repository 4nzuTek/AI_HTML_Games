// 太鼓の達人練習画面 - メインスクリプト

class TaikoPractice {
    constructor() {
        // 定数設定
        const AUDIO_OFFSET = 450; // 音の再生オフセット（ミリ秒、マイナスで早く再生）

        this.score = 0;
        this.combo = 0;
        this.bpm = 120;
        this.noteSpeed = 400; // 音符が流れる速度（ピクセル/秒）
        this.noteInterval = (60 / this.bpm) * 1000; // 音符の間隔（ミリ秒）
        this.notes = [];
        this.isPlaying = false;
        this.noteIndex = 0;
        this.lastNoteTime = 0;
        this.lastBeatTime = 0; // ビート音の最後の時間

        // FPS計測用
        this.frameCount = 0;
        this.lastFpsTime = 0;
        this.currentFps = 0;
        this.lastFrameTime = 0; // 前回のフレームの開始時間

        // 判定ライン設定（一か所で管理）
        this.judgmentLineX = 50; // 判定ラインの円の中心X座標（judgment-circleの中心）
        this.judgmentRange = 60; // 判定範囲
        this.judgmentPerfect = 5; // PERFECT判定範囲（より厳密に）
        this.judgmentGreat = 15; // GREAT判定範囲
        this.judgmentGood = 25; // GOOD判定範囲

        // 音声設定
        this.audioContext = null;
        this.audioOffset = AUDIO_OFFSET; // 音のオフセットを保存
        this.initAudio();

        this.init();
    }

    updateFPS() {
        this.frameCount++;
        const currentTime = Date.now();

        // 1秒ごとにFPSを更新
        if (currentTime - this.lastFpsTime >= 1000) {
            this.currentFps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsTime = currentTime;

            // FPSをコンソールに表示
            console.log(`現在のFPS: ${this.currentFps}`);

            // 画面上のFPS表示を更新
            if (this.fpsElement) {
                this.fpsElement.textContent = `FPS: ${this.currentFps}`;
            }
        }
    }

    initAudio() {
        try {
            // Web Audio APIの初期化
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('音声システムを初期化しました');
        } catch (error) {
            console.error('音声システムの初期化に失敗:', error);
        }
    }

    playBeatSound() {
        if (!this.audioContext) return;

        try {
            // オシレーターを作成（高音の「ぴ」音）
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            // 音色設定
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime); // 800Hz

            // 音量エンベロープ設定
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

            // 接続
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            // 音を再生
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.1);
        } catch (error) {
            console.error('ビート音の再生に失敗:', error);
        }
    }

    init() {
        this.scoreElement = document.getElementById('score');
        this.comboElement = document.getElementById('combo');
        this.noteContainer = document.getElementById('noteContainer');

        // FPS表示要素を作成
        this.createFpsDisplay();

        this.setupEventListeners();

        // 判定ラインの位置を確実に設定してからゲームを開始
        setTimeout(() => {
            this.updateJudgmentLinePosition();
            this.startGame();
        }, 100);
    }

    createFpsDisplay() {
        // FPS表示要素を作成
        this.fpsElement = document.createElement('div');
        this.fpsElement.id = 'fps-display';
        this.fpsElement.style.position = 'fixed';
        this.fpsElement.style.top = '10px';
        this.fpsElement.style.right = '10px';
        this.fpsElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.fpsElement.style.color = 'white';
        this.fpsElement.style.padding = '5px 10px';
        this.fpsElement.style.borderRadius = '5px';
        this.fpsElement.style.fontFamily = 'monospace';
        this.fpsElement.style.fontSize = '14px';
        this.fpsElement.style.zIndex = '1000';
        this.fpsElement.textContent = 'FPS: 0';

        document.body.appendChild(this.fpsElement);
    }

    setupEventListeners() {
        // キーボードイベント
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();

                // 音声コンテキストを開始（ブラウザの制限により必要）
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }

                this.handleTaikoClick();
            }
        });

        // ウィンドウサイズ変更時に判定ラインの位置を更新
        window.addEventListener('resize', () => {
            this.updateJudgmentLinePosition();
        });
    }

    startGame() {
        this.isPlaying = true;
        this.lastNoteTime = Date.now();
        this.gameLoop();
    }

    gameLoop() {
        if (!this.isPlaying) return;

        const currentTime = Date.now();

        // FPS計測
        this.updateFPS();

        // 新しい音符を生成
        if (currentTime - this.lastNoteTime >= this.noteInterval) {
            this.createNote();
            this.lastNoteTime = currentTime;
        }

        // BPMに合わせてビート音を再生
        if (currentTime - this.lastBeatTime >= this.noteInterval) {
            // オフセット遅延してビート音を再生
            setTimeout(() => {
                this.playBeatSound();
            }, this.audioOffset);
            this.lastBeatTime = currentTime;
        }

        // 音符の移動
        this.updateNotes(currentTime);

        // 判定ラインを過ぎた音符の削除
        this.removePassedNotes();

        // 定期的に判定ラインの位置を確認（1秒に1回）
        if (currentTime % 1000 < 16) { // 約1秒ごと
            this.updateJudgmentLinePosition();
        }

        requestAnimationFrame(() => this.gameLoop());
    }

    createNote() {
        const noteTypes = ['don', 'ka'];
        const noteType = noteTypes[this.noteIndex % 2]; // ドンとカツを交互に
        const noteText = noteType === 'don' ? 'ドン' : 'カツ';

        const note = document.createElement('div');
        note.className = `note ${noteType}`;
        note.textContent = noteText;
        note.style.left = '1920px'; // 画面右端から開始（ノーツの中心が画面右端に来るように）
        note.style.top = '50%';
        note.style.transform = 'translateY(-50%)';

        this.noteContainer.appendChild(note);

        this.notes.push({
            element: note,
            type: noteType,
            centerX: 1920, // ノーツの中心X座標（画面右端から開始）
            hit: false,
            createdAt: Date.now() // ノーツの生成時間を記録
        });

        this.noteIndex++;
    }

    updateNotes(currentTime) {
        // 実際のフレーム間隔を使用してdeltaTimeを計算
        const deltaTime = this.lastFrameTime > 0 ? (currentTime - this.lastFrameTime) : 16.67; // 初回は16.67msを使用

        this.notes.forEach(note => {
            // ヒットしたノーツは移動しない
            if (!note.hit) {
                // 残り距離を計算
                const remainingDistance = note.centerX - this.judgmentLineX;

                // 残り時間を計算（4拍で到達する予定）
                const beatsToReach = 4;
                const secondsPerBeat = 60 / this.bpm;
                const totalTime = beatsToReach * secondsPerBeat;

                // ノーツが生成されてからの経過時間を計算
                const noteAge = (currentTime - note.createdAt) / 1000;
                const remainingTime = totalTime - noteAge;

                // このフレームでの移動量を計算
                let deltaX;
                if (remainingTime > 0 && remainingDistance > 0) {
                    // 残り時間と残り距離から、このフレームでの移動量を計算
                    const speedForThisFrame = remainingDistance / remainingTime;
                    deltaX = speedForThisFrame * (deltaTime / 1000);
                } else {
                    // フォールバック: 通常のスピード計算
                    deltaX = (this.noteSpeed * deltaTime) / 1000;
                }

                note.centerX -= deltaX; // 左に移動
                note.element.style.left = `${note.centerX - 40}px`; // ノーツの中心から40px左（ノーツの左端）
            }

            // 判定線を更新（ヒットしていないノーツのみ）
            if (!note.hit) {
                this.updateJudgmentLine(note);
            }
        });
        this.lastFrameTime = currentTime; // 現在のフレーム時間を更新
    }

    updateJudgmentLine(note) {
        // 判定線を非表示にする（コメントアウト）
        /*
        // ノーツの中心位置を直接使用
        const noteCenterX = note.centerX;

        // 判定線の要素を取得または作成
        let judgmentLine = note.element.querySelector('.note-judgment-line');
        if (!judgmentLine) {
            judgmentLine = document.createElement('div');
            judgmentLine.className = 'note-judgment-line';
            note.element.appendChild(judgmentLine);
        }

        // 判定線の位置を設定（ノーツの中心からの相対位置）
        judgmentLine.style.left = `${40 + (noteCenterX - this.judgmentLineX)}px`;

        // 判定精度に応じて色を変更
        if (Math.abs(noteCenterX - this.judgmentLineX) <= this.judgmentPerfect) {
            judgmentLine.style.backgroundColor = '#00FF00'; // 緑（PERFECT）
        } else if (Math.abs(noteCenterX - this.judgmentLineX) <= this.judgmentGreat) {
            judgmentLine.style.backgroundColor = '#FFFF00'; // 黄（GREAT）
        } else if (Math.abs(noteCenterX - this.judgmentLineX) <= this.judgmentGood) {
            judgmentLine.style.backgroundColor = '#FFA500'; // 橙（GOOD）
        } else {
            judgmentLine.style.backgroundColor = '#FF0000'; // 赤（BAD）
        }
        */
    }

    removePassedNotes() {
        this.notes = this.notes.filter(note => {
            // ヒットしたノーツは削除しない（エフェクトが完了するまで）
            if (note.hit) {
                return true;
            }

            // ノーツの中心位置を直接使用
            const noteCenterX = note.centerX;

            if (noteCenterX < this.judgmentLineX - 300) { // 判定ラインの300px手前
                console.log(`=== ノーツ削除情報 ===`);
                console.log(`ノーツタイプ: ${note.type}`);
                console.log(`ノーツ中心座標: ${note.centerX}`);
                console.log(`表示位置 left: ${note.element.style.left}`);
                console.log(`中心位置: ${noteCenterX}px`);
                console.log(`判定ライン位置: ${this.judgmentLineX}px`);
                console.log(`判定ラインとの差: ${noteCenterX - this.judgmentLineX}px`);
                console.log(`削除理由: 判定ラインを過ぎた`);
                console.log(`ヒット状態: ${note.hit ? 'ヒット済み' : '未ヒット'}`);
                console.log(`====================`);

                this.missNote();
                note.element.remove();
                return false;
            }
            return true;
        });
    }

    handleTaikoClick() {
        // 判定
        this.checkJudgment();
    }

    checkJudgment() {
        let hitNote = null;
        let closestDistance = Infinity;

        for (let note of this.notes) {
            // ノーツの中心位置を直接使用
            const noteCenterX = note.centerX;
            const distance = Math.abs(noteCenterX - this.judgmentLineX);

            if (distance <= this.judgmentRange && !note.hit) {
                if (distance < closestDistance) {
                    hitNote = note;
                    closestDistance = distance;
                }
            }
        }

        if (hitNote) {
            this.hitNote(hitNote);
        } else {
            this.showJudgment('MISS');
        }
    }

    hitNote(note) {
        note.hit = true;
        note.element.classList.add('hit');

        // 判定表示（数値）
        const judgmentText = this.getJudgmentText(note);
        this.showJudgment(judgmentText);

        // スコア加算
        const judgment = this.getJudgment(note);
        this.addScore(judgment);

        // コンボ加算
        this.combo++;
        this.updateCombo();

        // ヒットエフェクトを開始
        this.startHitEffect(note);
    }

    startHitEffect(note) {
        // ノーツの移動を停止（hitフラグで判定）
        note.hit = true;

        // 初期状態を設定
        let scale = 1.0;
        let opacity = 1.0;
        const duration = 500; // 500ms
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;

            if (progress >= 1) {
                // アニメーション完了
                note.element.remove();
                return;
            }

            // スケールを1.0から2.0に拡大
            scale = 1.0 + progress;
            // 透明度を1.0から0.0に減少
            opacity = 1.0 - progress;

            // スタイルを適用
            note.element.style.transform = `translateY(-50%) scale(${scale})`;
            note.element.style.opacity = opacity;

            requestAnimationFrame(animate);
        };

        animate();
    }

    getJudgment(note) {
        // ノーツの中心位置を直接使用
        const noteCenterX = note.centerX;
        const distance = noteCenterX - this.judgmentLineX; // 前後のずれを計算

        if (Math.abs(distance) <= this.judgmentPerfect) return 'PERFECT';
        if (Math.abs(distance) <= this.judgmentGreat) return 'GREAT';
        if (Math.abs(distance) <= this.judgmentGood) return 'GOOD';
        return 'BAD';
    }

    getJudgmentText(note) {
        // ノーツの中心位置を直接使用
        const noteCenterX = note.centerX;
        const distance = noteCenterX - this.judgmentLineX; // 前後のずれを計算

        // 距離をミリ秒に変換
        // 4拍で判定ラインに到達するので、1拍あたりの移動距離を計算
        const beatsToReach = 4;
        const secondsPerBeat = 60 / this.bpm;
        const totalTime = beatsToReach * secondsPerBeat;
        const totalDistance = 1920 - this.judgmentLineX; // 生成位置から判定ラインまでの距離
        const pixelsPerSecond = totalDistance / totalTime;
        const millisecondsPerPixel = 1000 / pixelsPerSecond;

        const offsetMs = Math.round(distance * millisecondsPerPixel);

        if (offsetMs > 0) {
            return `+${offsetMs}ms`; // 判定ラインより後（右側）
        } else if (offsetMs < 0) {
            return `${offsetMs}ms`; // 判定ラインより前（左側）
        } else {
            return '0ms'; // 完全に一致
        }
    }

    showJudgment(judgment) {
        const judgmentElement = document.createElement('div');
        judgmentElement.className = 'judgment';
        judgmentElement.textContent = judgment;

        // 判定ラインの上に表示
        const judgmentLine = document.querySelector('.judgment-line');
        if (judgmentLine) {
            judgmentLine.appendChild(judgmentElement);
        } else {
            document.body.appendChild(judgmentElement);
        }

        setTimeout(() => {
            judgmentElement.remove();
        }, 500);
    }

    addScore(judgment) {
        const scoreMap = {
            'PERFECT': 1000,
            'GREAT': 500,
            'GOOD': 100,
            'BAD': 50
        };

        this.score += scoreMap[judgment] || 0;
        this.updateScore();
    }

    missNote() {
        this.combo = 0;
        this.updateCombo();
        this.showJudgment('MISS');
    }

    updateScore() {
        this.scoreElement.textContent = this.score.toLocaleString();
    }

    updateCombo() {
        this.comboElement.textContent = this.combo;
    }

    updateJudgmentLinePosition() {
        // 判定ラインの実際の位置を動的に取得
        const judgmentLine = document.querySelector('.judgment-line');
        const judgmentCircle = document.querySelector('.judgment-circle');

        if (judgmentLine && judgmentCircle) {
            try {
                const lineRect = judgmentLine.getBoundingClientRect();
                const circleRect = judgmentCircle.getBoundingClientRect();
                const gameArea = document.querySelector('.game-area');
                const gameRect = gameArea.getBoundingClientRect();

                // judgment-circleの中心位置を計算
                this.judgmentLineX = circleRect.left - gameRect.left + circleRect.width / 2;
                console.log(`判定ラインの位置: ${this.judgmentLineX}px (動的取得)`);

                // 判定ラインの位置が変更されたらスピードを再計算
                this.calculateNoteSpeed();
            } catch (error) {
                console.error('判定ラインの位置取得でエラー:', error);
                this.judgmentLineX = 50; // フォールバック値
                this.calculateNoteSpeed();
            }
        } else {
            // 要素が見つからない場合は固定値を使用
            this.judgmentLineX = 50;
            console.log('判定ライン要素が見つかりません。固定値を使用: 50px');
            this.calculateNoteSpeed();
        }
    }

    setBPM(newBpm) {
        this.bpm = newBpm;
        this.noteInterval = (60 / this.bpm) * 1000; // 音符の間隔（ミリ秒）を更新
        this.calculateNoteSpeed(); // スピードを再計算
        console.log(`BPMを${newBpm}に変更しました`);
    }

    calculateNoteSpeed() {
        // 4拍でジャッジラインに到達するスピードを計算
        const beatsToReach = 4; // 4拍
        const secondsPerBeat = 60 / this.bpm; // 1拍あたりの秒数
        const totalTime = beatsToReach * secondsPerBeat; // 4拍分の時間

        // ノーツの移動距離（ノーツ生成位置からジャッジラインまで）
        const noteStartX = 1920; // ノーツの生成位置（画面右端）
        const distance = noteStartX - this.judgmentLineX; // 生成位置 - ジャッジライン位置

        // 必要なスピード（ピクセル/秒）
        this.noteSpeed = distance / totalTime;

        console.log(`BPM: ${this.bpm}, 4拍時間: ${totalTime}秒, 距離: ${distance}px, スピード: ${this.noteSpeed}px/秒`);
        console.log(`ノーツ生成位置: ${noteStartX}px, ジャッジライン位置: ${this.judgmentLineX}px`);
    }
}

// タイトルに戻る関数
function backToTitle() {
    window.location.href = 'index.html';
}

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function () {
    console.log('太鼓の達人練習画面が読み込まれました');

    // 練習ゲームを開始
    const game = new TaikoPractice();

    // グローバル変数として保存（デバッグ用）
    window.taikoGame = game;

    // コンソールからBPM変更をテストできるように
    console.log('BPM変更テスト: window.taikoGame.setBPM(120) などで実行してください');
});