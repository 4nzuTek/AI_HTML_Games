// 太鼓の達人練習画面 - メインスクリプト

class TaikoPractice {
    constructor(settings) {
        // 設定値を引数から受け取る
        const bpm = settings?.bpm || 120;
        const noteType = settings?.noteType || '16th';
        const renCount = settings?.renCount || 4;
        const restCount = settings?.restCount || 1;
        const offset = settings?.offset !== undefined ? settings.offset : 0; // 0msも正しく受け取る

        // デバッグ用：コンストラクタでの設定値を確認
        console.log('TaikoPractice constructor - settings:', settings);
        console.log('TaikoPractice constructor - offset:', offset, 'Type:', typeof offset);

        // 定数設定
        const AUDIO_OFFSET = 400; // 音の再生オフセット（ミリ秒、マイナスで早く再生）
        const BEATS_TO_REACH = 8; // ノーツが判定ラインに到達するまでの拍数

        this.score = 0;
        this.combo = 0;
        this.bpm = bpm;
        this.noteType = noteType;
        this.noteSpeed = 400; // 音符が流れる速度（ピクセル/秒）

        // 音符の種類に応じて間隔を設定
        this.noteInterval = this.calculateNoteInterval();

        this.notes = [];
        this.isPlaying = false;
        this.noteIndex = 0;
        this.sixteenthNoteCount = 0; // 16分音符のカウンター（0-3）
        this.lastNoteTime = 0;
        this.noteSerial = 0; // ノーツ生成ごとにインクリメント

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
        this.audioOffset = offset; // オフセットを保存
        this.beatsToReach = BEATS_TO_REACH; // ノーツ到達拍数を保存
        this.initAudio();

        this.renCount = renCount;
        this.restCount = restCount;
        this.cycleCount = 0; // 連打・休みサイクル用カウンター
        // メトロノーム用タイマー
        this.metronomeLastTime = 0;
        this.metronomeInterval = (60 / this.bpm) * 1000; // 4分音符（拍）ごと

        this.init();
    }

    // 音符の種類に応じて間隔を計算
    calculateNoteInterval() {
        const baseInterval = (60 / this.bpm) * 1000; // 4分音符の間隔

        switch (this.noteType) {
            case '16th':
                return baseInterval / 4; // 16分音符
            case '8th':
                return baseInterval / 2; // 8分音符
            case '4th':
                return baseInterval; // 4分音符
            default:
                return baseInterval / 4; // デフォルトは16分音符
        }
    }

    // 連打数・休み数に基づいてノーツ生成を制御
    shouldGenerateNote() {
        // cycleCountが連打数未満のときだけノーツ生成
        return this.cycleCount < this.renCount;
    }

    // BPMに応じてノーツ生成タイミングを調整
    getAdjustedNoteInterval() {
        // 基準BPM（120）での間隔を基準とする
        const baseBpm = 120;
        const baseInterval = (60 / baseBpm) * 1000 / 4; // 16分音符の基準間隔

        // BPMの比率に応じて間隔を調整
        const bpmRatio = this.bpm / baseBpm;
        const adjustedInterval = baseInterval / bpmRatio;

        return adjustedInterval;
    }





    updateFPS() {
        this.frameCount++;
        const currentTime = Date.now();

        // 1秒ごとにFPSを更新
        if (currentTime - this.lastFpsTime >= 1000) {
            this.currentFps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsTime = currentTime;

            // FPSとオフセットを画面上に表示
            if (this.fpsElement) {
                this.fpsElement.textContent = `FPS: ${this.currentFps} | Offset: ${this.audioOffset}ms`;
            }
        }
    }

    initAudio() {
        try {
            // Web Audio APIの初期化
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            // 音声システムを初期化しました
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
        // デバッグ用：FPS表示作成時のaudioOffset値を確認
        console.log('createFpsDisplay - this.audioOffset:', this.audioOffset, 'Type:', typeof this.audioOffset);

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
        this.fpsElement.textContent = 'FPS: 0 | Offset: ' + this.audioOffset + 'ms';

        document.body.appendChild(this.fpsElement);
    }

    setupEventListeners() {
        // キーボードイベント
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyF' || e.code === 'KeyJ') {
                e.preventDefault();

                // 音声コンテキストを開始（ブラウザの制限により必要）
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }

                // 判定円の色を一瞬変える（ドン用：赤）
                this.flashJudgmentCircle('#FF4444');

                this.handleTaikoClick('don');
            } else if (e.code === 'KeyD' || e.code === 'KeyK') {
                e.preventDefault();

                // 音声コンテキストを開始（ブラウザの制限により必要）
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }

                // 判定円の色を一瞬変える（カツ用：青）
                this.flashJudgmentCircle('#4444FF');

                this.handleTaikoClick('ka');
            } else if (e.code === 'ArrowLeft') {
                // 左矢印でオフセットを-5ms
                this.audioOffset -= 5;
                if (this.fpsElement) {
                    this.fpsElement.textContent = `FPS: ${this.currentFps} | Offset: ${this.audioOffset}ms`;
                }
            } else if (e.code === 'ArrowRight') {
                // 右矢印でオフセットを+5ms
                this.audioOffset += 5;
                if (this.fpsElement) {
                    this.fpsElement.textContent = `FPS: ${this.currentFps} | Offset: ${this.audioOffset}ms`;
                }
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
        this.metronomeLastTime = this.lastNoteTime; // メトロノームも初期化
        this.gameLoop();
    }

    gameLoop() {
        if (!this.isPlaying) return;

        const currentTime = Date.now();

        // FPS計測
        this.updateFPS();

        // 拍ごとにメトロノーム音を鳴らす
        if (currentTime - this.metronomeLastTime >= this.metronomeInterval) {
            setTimeout(() => {
                this.playBeatSound();
            }, this.audioOffset);
            this.metronomeLastTime += this.metronomeInterval;
        }

        // ノーツ生成タイミング管理
        const adjustedInterval = this.getAdjustedNoteInterval();
        if (currentTime - this.lastNoteTime >= adjustedInterval) {
            // 連打数・休み数に応じてノーツ生成
            if (this.shouldGenerateNote()) {
                this.createNote();
            }
            // サイクルカウンターを進める
            this.cycleCount = (this.cycleCount + 1) % (this.renCount + this.restCount);
            // 正確なタイミングを保つため、次の音符のタイミングを計算
            this.lastNoteTime += adjustedInterval;
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
        const noteType = noteTypes[Math.floor(Math.random() * 2)]; // ドンとカツをランダムに
        const noteText = noteType === 'don' ? 'ドン' : 'カツ';

        const note = document.createElement('div');
        note.className = `note ${noteType}`;
        note.textContent = noteText;
        note.style.left = '1920px'; // 画面右端から開始（ノーツの中心が画面右端に来るように）
        note.style.top = '50%';
        note.style.transform = 'translateY(-50%)';
        // 連番をz-indexに使う（新しいノーツほどz-indexが小さい）
        note.style.zIndex = String(1000000 - this.noteSerial);
        this.noteSerial++;

        this.noteContainer.appendChild(note);

        this.notes.push({
            element: note,
            type: noteType,
            centerX: 1920, // ノーツの中心X座標（画面右端から開始）
            hit: false,
            createdAt: Date.now() // ノーツの生成時間を記録
        });

        // this.noteIndex++; // ランダム生成のため不要
    }

    updateNotes(currentTime) {
        // 実際のフレーム間隔を使用してdeltaTimeを計算
        const deltaTime = this.lastFrameTime > 0 ? (currentTime - this.lastFrameTime) : 16.67; // 初回は16.67msを使用

        this.notes.forEach(note => {
            // ヒットしたノーツは移動しない
            if (!note.hit) {
                // このフレームでの移動量を計算（固定速度を使用）
                const deltaX = (this.noteSpeed * deltaTime) / 1000;

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
                // ノーツ削除情報（削除）

                // ノーツが左端まで行って消える時に不可を表示
                this.missNote();
                note.element.remove();
                return false;
            }
            return true;
        });
    }

    handleTaikoClick(type) {
        // 判定
        this.checkJudgment(type);
    }

    checkJudgment(type) {
        let hitNote = null;
        let closestDistance = Infinity;

        // 100msに対応する判定範囲を計算
        const judgmentRangeMs = 100;
        const judgmentRangePixels = this.convertMsToDistance(judgmentRangeMs);

        for (let note of this.notes) {
            // ノーツの中心位置を直接使用
            const noteCenterX = note.centerX;
            const distance = Math.abs(noteCenterX - this.judgmentLineX);

            // ノーツのタイプと入力タイプが一致し、判定範囲内で、まだヒットしていない場合
            if (note.type === type && distance <= judgmentRangePixels && !note.hit) {
                if (distance < closestDistance) {
                    hitNote = note;
                    closestDistance = distance;
                }
            }
        }

        if (hitNote) {
            this.hitNote(hitNote, type);
        }
        // missの表示は削除（removePassedNotesで表示する）
    }

    hitNote(note, type) {
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
        let translateY = 0;
        let opacity = 1.0;
        const duration = 200; // 0.2秒
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;

            if (progress >= 1) {
                // アニメーション完了
                note.element.remove();
                return;
            }

            // 上にぴょこっと上がる（0pxから-30pxへ）
            translateY = -30 * progress;
            // 透明度を1.0から0.0に減少
            opacity = 1.0 - progress;

            // スタイルを適用（スケールはそのまま1.0）
            note.element.style.transform = `translateY(calc(-50% + ${translateY}px)) scale(1.0)`;
            note.element.style.opacity = opacity;

            requestAnimationFrame(animate);
        };

        animate();
    }

    getJudgment(note) {
        // ノーツの中心位置を直接使用
        const noteCenterX = note.centerX;
        const distance = noteCenterX - this.judgmentLineX; // 前後のずれを計算

        // 距離をミリ秒に変換
        const offsetMs = this.convertDistanceToMs(distance);

        // 新しい判定基準（33ms, 66ms, 100ms）
        if (Math.abs(offsetMs) <= 33) return '良';
        if (Math.abs(offsetMs) <= 66) return '可';
        if (Math.abs(offsetMs) <= 100) return '不可';
        return 'BAD';
    }

    convertDistanceToMs(distance) {
        // 設定された拍数で判定ラインに到達するので、1拍あたりの移動距離を計算
        const secondsPerBeat = 60 / this.bpm;
        const totalTime = this.beatsToReach * secondsPerBeat;
        const totalDistance = 1920 - this.judgmentLineX; // 生成位置から判定ラインまでの距離
        const pixelsPerSecond = totalDistance / totalTime;
        const millisecondsPerPixel = 1000 / pixelsPerSecond;

        return Math.round(distance * millisecondsPerPixel);
    }

    convertMsToDistance(milliseconds) {
        // 設定された拍数で判定ラインに到達するので、1拍あたりの移動距離を計算
        const secondsPerBeat = 60 / this.bpm;
        const totalTime = this.beatsToReach * secondsPerBeat;
        const totalDistance = 1920 - this.judgmentLineX; // 生成位置から判定ラインまでの距離
        const pixelsPerSecond = totalDistance / totalTime;
        const pixelsPerMillisecond = pixelsPerSecond / 1000;

        return Math.round(milliseconds * pixelsPerMillisecond);
    }

    getJudgmentText(note) {
        // ノーツの中心位置を直接使用
        const noteCenterX = note.centerX;
        const distance = noteCenterX - this.judgmentLineX; // 前後のずれを計算

        // 距離をミリ秒に変換
        const offsetMs = this.convertDistanceToMs(distance);
        const judgment = this.getJudgment(note);

        // 判定とタイミングを組み合わせて表示
        if (offsetMs > 0) {
            return `${judgment}\n-${offsetMs}ms`; // 早押し（+ms）
        } else if (offsetMs < 0) {
            return `${judgment}\n+${-offsetMs}ms`; // 遅押し（-ms）
        } else {
            return `${judgment}\n0ms`;
        }
    }

    showJudgment(judgment) {
        // 既存の判定チップを削除
        const existingJudgments = document.querySelectorAll('.judgment');
        existingJudgments.forEach(element => element.remove());

        const judgmentElement = document.createElement('div');
        judgmentElement.className = 'judgment';

        // 判定文字列から判定部分を抽出（改行前の部分）
        const judgmentType = judgment.split('\n')[0];

        // 判定に応じて色と枠の色を設定
        let colorClass = '';
        let borderColor = '#FFD700'; // デフォルト（黄色）

        if (judgmentType === '良') {
            colorClass = 'judgment-good';
            borderColor = '#FFD700'; // 黄色
        } else if (judgmentType === '可') {
            colorClass = 'judgment-acceptable';
            borderColor = '#FFFFFF'; // 白
        } else if (judgmentType === '不可') {
            colorClass = 'judgment-bad';
            borderColor = '#4169E1'; // 青
        }

        if (colorClass) {
            judgmentElement.classList.add(colorClass);
        }

        // 枠の色を動的に設定
        judgmentElement.style.borderColor = borderColor;

        // 改行がある場合は分割して表示、ない場合はそのまま表示
        if (judgment.includes('\n')) {
            const lines = judgment.split('\n');
            judgmentElement.innerHTML = lines.map(line => `<div>${line}</div>`).join('');
        } else {
            judgmentElement.textContent = judgment;
        }

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
            '良': 1000,
            '可': 500,
            '不可': 100,
            'BAD': 50
        };

        this.score += scoreMap[judgment] || 0;
        this.updateScore();
    }

    missNote() {
        this.combo = 0;
        this.updateCombo();
        this.showJudgment('不可');
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
                // 判定ラインの位置を動的取得

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
            // 判定ライン要素が見つかりません。固定値を使用: 50px
            this.calculateNoteSpeed();
        }
    }

    setBPM(newBpm) {
        this.bpm = newBpm;
        this.noteInterval = this.calculateNoteInterval(); // 音符の間隔を再計算
        this.calculateNoteSpeed(); // スピードを再計算
        this.metronomeInterval = (60 / this.bpm) * 1000; // メトロノームも再計算
        // BPMを変更しました
    }

    calculateNoteSpeed() {
        // 設定された拍数でジャッジラインに到達するスピードを計算
        const secondsPerBeat = 60 / this.bpm; // 1拍あたりの秒数
        const totalTime = this.beatsToReach * secondsPerBeat; // 設定された拍数分の時間

        // ノーツの移動距離（ノーツ生成位置からジャッジラインまで）
        const noteStartX = 1920; // ノーツの生成位置（画面右端）
        const distance = noteStartX - this.judgmentLineX; // 生成位置 - ジャッジライン位置

        // 必要なスピード（ピクセル/秒）
        this.noteSpeed = distance / totalTime;

        // BPMとスピード計算情報（削除）
    }

    flashJudgmentCircle(color) {
        const judgmentCircle = document.querySelector('.judgment-circle');
        if (judgmentCircle) {
            // 既存のタイマーをクリア
            if (this.flashTimer) {
                clearTimeout(this.flashTimer);
            }

            // 元の色を保存（初回のみ）
            if (!this.originalBackground) {
                this.originalBackground = judgmentCircle.style.background || 'radial-gradient(circle, rgba(255, 215, 0, 0.4) 0%, rgba(255, 215, 0, 0.2) 70%, transparent 100%)';
            }

            // 色を変更
            judgmentCircle.style.background = color;
            judgmentCircle.style.transition = 'background 0.3s ease-out';

            // 少し待ってからフェードで戻す
            this.flashTimer = setTimeout(() => {
                judgmentCircle.style.background = this.originalBackground;
            }, 100); // 100ms後にフェード開始
        }
    }
}

// ===== ここから統合UI用の追加コード =====
// 設定の保存・復元
function getPracticeSettings() {
    const bpm = parseInt(document.getElementById('bpm-setting').value) || 120;
    const noteType = document.getElementById('note-type').value || '16th';
    const renCount = parseInt(document.getElementById('ren-count').value) || 4;
    const restCount = parseInt(document.getElementById('rest-count').value) || 1;
    const offset = parseInt(document.getElementById('offset-setting').value) || 0;

    // デバッグ用：HTMLのinput要素から取得した値を確認
    const offsetElement = document.getElementById('offset-setting');
    console.log('getPracticeSettings - offset input element:', offsetElement);
    console.log('getPracticeSettings - offset input value:', offsetElement?.value, 'Type:', typeof offsetElement?.value);
    console.log('getPracticeSettings - parsed offset:', offset, 'Type:', typeof offset);

    return { bpm, noteType, renCount, restCount, offset };
}
function saveSettings() {
    const settings = getPracticeSettings();
    localStorage.setItem('taikoPracticeSettings', JSON.stringify(settings));
}
function loadSettings() {
    // デバッグ用：localStorageをクリアしてデフォルト値から開始
    localStorage.removeItem('taikoPracticeSettings');
    console.log('loadSettings - localStorage cleared, using default values');

    // 以下はlocalStorageから復元する処理だが、クリアしたので実行されない
    const saved = localStorage.getItem('taikoPracticeSettings');
    if (saved) {
        const settings = JSON.parse(saved);

        // デバッグ用：localStorageから読み込んだ値を確認
        console.log('loadSettings - saved settings:', settings);

        const bpmElement = document.getElementById('bpm-setting');
        const noteTypeElement = document.getElementById('note-type');
        const renCountElement = document.getElementById('ren-count');
        const restCountElement = document.getElementById('rest-count');
        const offsetElement = document.getElementById('offset-setting');

        if (bpmElement) {
            bpmElement.value = settings.bpm || 120;
            bpmElement.setAttribute('value', settings.bpm || 120);
        }
        if (noteTypeElement) {
            noteTypeElement.value = settings.noteType || '16th';
            noteTypeElement.setAttribute('value', settings.noteType || '16th');
        }
        if (renCountElement) {
            renCountElement.value = settings.renCount || 4;
            renCountElement.setAttribute('value', settings.renCount || 4);
        }
        if (restCountElement) {
            restCountElement.value = settings.restCount || 1;
            restCountElement.setAttribute('value', settings.restCount || 1);
        }
        if (offsetElement) {
            offsetElement.value = settings.offset || 0;
            offsetElement.setAttribute('value', settings.offset || 0);
            console.log('loadSettings - offset element after setting:', offsetElement.value, 'attribute:', offsetElement.getAttribute('value'));
        }
    }
}
// UI切り替え
function showTitleScreen() {
    document.querySelector('.title-screen').style.display = '';
    document.querySelector('.practice-screen').style.display = 'none';
}
function showPracticeScreen() {
    document.querySelector('.title-screen').style.display = 'none';
    document.querySelector('.practice-screen').style.display = '';
}
// 練習開始
function startPracticeUnified() {
    saveSettings();
    const settings = getPracticeSettings();

    // デバッグ用：設定値を確認
    console.log('Practice settings:', settings);
    console.log('Offset value:', settings.offset, 'Type:', typeof settings.offset);

    // 既存のゲーム状態を完全リセット
    if (window.taikoGame) {
        window.taikoGame.isPlaying = false;
        // 既存のノーツをすべて削除
        const noteContainer = document.getElementById('noteContainer');
        if (noteContainer) {
            noteContainer.innerHTML = '';
        }
        // 判定表示をクリア
        const judgments = document.querySelectorAll('.judgment');
        judgments.forEach(el => el.remove());
    }

    // スコア・コンボをリセット
    const scoreElement = document.getElementById('score');
    const comboElement = document.getElementById('combo');
    if (scoreElement) scoreElement.textContent = '0';
    if (comboElement) comboElement.textContent = '0';

    // TaikoPracticeインスタンスを新規生成し直す
    window.taikoGame = new TaikoPractice(settings);
    showPracticeScreen();
}
// 練習終了（タイトルに戻る）
function backToTitleUnified() {
    if (window.taikoGame) window.taikoGame.isPlaying = false;
    showTitleScreen();
}
// 設定変更時に自動保存
['bpm-setting', 'note-type', 'ren-count', 'rest-count', 'offset-setting'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', saveSettings);
});
// ボタンイベント
window.addEventListener('DOMContentLoaded', function () {
    loadSettings();
    showTitleScreen();
    document.getElementById('startPracticeBtn').onclick = startPracticeUnified;
    // 練習画面の「タイトルに戻る」ボタンも統合用に上書き
    const backBtn = document.querySelector('.back-button');
    if (backBtn) backBtn.onclick = backToTitleUnified;
});
// ===== ここまで統合UI用の追加コード =====