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
        const BEATS_TO_REACH = 6; // ノーツが判定ラインに到達するまでの拍数

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

        // タブ非アクティブ時の時間管理
        this.isTabActive = true; // タブがアクティブかどうか
        this.pauseStartTime = 0; // 一時停止開始時間
        this.totalPauseTime = 0; // 累積一時停止時間

        // 判定ライン設定（一か所で管理）
        this.judgmentLineX = 50; // 速度計算用：判定ラインの左端位置
        this.judgmentCenterX = 50; // 判定計算用：円の中心位置
        this.judgmentRange = 60; // 判定範囲
        this.judgmentPerfect = 5; // PERFECT判定範囲（より厳密に）
        this.judgmentGreat = 15; // GREAT判定範囲
        this.judgmentGood = 25; // GOOD判定範囲

        // 音声設定
        this.audioContext = null;
        this.audioOffset = offset; // オフセットを保存
        this.beatsToReach = BEATS_TO_REACH; // ノーツ到達拍数を保存
        this.metronomeVolume = 0.5; // メトロノームの音量（0.0-1.0）
        this.initAudio();

        this.renCount = renCount;
        this.restCount = restCount;
        this.cycleCount = 0; // 連打・休みサイクル用カウンター
        // メトロノーム用タイマー
        this.metronomeLastTime = 0;
        this.metronomeInterval = (60 / this.bpm) * 1000; // 4分音符（拍）ごと

        // キーリピート防止用
        this.lastKeyPressTime = 0;
        this.keyPressCooldown = 5; // 5msのクールダウン

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
            // グローバルにロードされた音声コンテキストとバッファを使用
            this.audioContext = globalAudioContext;
            this.donAudioBuffer = globalDonAudioBuffer;
            this.katsuAudioBuffer = globalKatsuAudioBuffer;
            this.metronomeAudioBuffer = globalMetronomeAudioBuffer;

            if (!this.audioContext || !this.donAudioBuffer || !this.katsuAudioBuffer) {
                console.warn('グローバル音声ファイルがまだロードされていません');
            }
        } catch (error) {
            console.error('音声システムの初期化に失敗:', error);
        }
    }

    playBeatSound() {
        if (!this.audioContext || !this.metronomeAudioBuffer) return;

        try {
            // AudioBufferSourceNodeを作成
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();

            // 音声データを設定
            source.buffer = this.metronomeAudioBuffer;

            // 音量設定（メトロノーム音を少し小さくして太鼓の音とバランスを取る）
            gainNode.gain.setValueAtTime(this.metronomeVolume * 0.7, this.audioContext.currentTime);

            // 接続
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            // メトロノーム音を再生
            source.start(0);

            // 音声再生完了後にクリーンアップ
            source.onended = () => {
                // クリーンアップは不要
            };
        } catch (error) {
            console.error('メトロノーム音の再生に失敗:', error);
        }
    }

    playTaikoSound(type) {
        if (!this.audioContext || !this.donAudioBuffer || !this.katsuAudioBuffer) return;

        try {
            let audioBuffer;
            if (type === 'don') {
                audioBuffer = this.donAudioBuffer;
            } else if (type === 'ka') {
                audioBuffer = this.katsuAudioBuffer;
            } else {
                return;
            }

            // 現在の時間を取得
            const currentTime = this.audioContext.currentTime;

            // AudioBufferSourceNodeを作成
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();

            // 音声データを設定
            source.buffer = audioBuffer;

            // 音量設定
            gainNode.gain.setValueAtTime(0.3, currentTime);

            // 接続
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            // 太鼓の音はオフセットなしで即座に再生
            source.start(currentTime);

            // 音声再生完了後にクリーンアップ
            source.onended = () => {
                // クリーンアップは不要（メトロノーム音に影響しない）
            };
        } catch (error) {
            console.error('太鼓の音の再生に失敗:', error);
        }
    }

    init() {
        this.scoreElement = document.getElementById('score');
        this.comboElement = document.getElementById('combo');
        this.comboDisplayElement = document.getElementById('comboDisplay');
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
        // 既存のイベントリスナーを削除（重複防止）
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
        }
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
        if (this.visibilityHandler) {
            document.removeEventListener('visibilitychange', this.visibilityHandler);
        }

        // キーボードイベントハンドラーを作成
        this.keydownHandler = (e) => {
            // キーリピート防止
            const currentTime = Date.now();
            if (currentTime - this.lastKeyPressTime < this.keyPressCooldown) {
                return;
            }

            if (e.code === 'KeyF' || e.code === 'KeyJ') {
                e.preventDefault();

                // キーリピート防止のため、repeatフラグをチェック
                if (e.repeat) {
                    return;
                }

                // 音声コンテキストを開始（ブラウザの制限により必要）
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }

                // 太鼓の音を再生（ドン）
                this.playTaikoSound('don');

                // 判定円の色を一瞬変える（ドン用：赤）
                this.flashJudgmentCircle('#FF4444');

                this.handleTaikoClick('don');

                // 最後のキー押下時間を更新
                this.lastKeyPressTime = currentTime;
            } else if (e.code === 'KeyD' || e.code === 'KeyK') {
                e.preventDefault();

                // キーリピート防止のため、repeatフラグをチェック
                if (e.repeat) {
                    return;
                }

                // 音声コンテキストを開始（ブラウザの制限により必要）
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }

                // 太鼓の音を再生（カツ）
                this.playTaikoSound('ka');

                // 判定円の色を一瞬変える（カツ用：青）
                this.flashJudgmentCircle('#4444FF');

                this.handleTaikoClick('ka');

                // 最後のキー押下時間を更新
                this.lastKeyPressTime = currentTime;
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
        };

        // イベントリスナーを登録
        document.addEventListener('keydown', this.keydownHandler);

        // ウィンドウサイズ変更時に判定ラインの位置を更新
        this.resizeHandler = () => {
            this.updateJudgmentLinePosition();
        };
        window.addEventListener('resize', this.resizeHandler);

        // タブの可視性変更イベントを監視
        this.visibilityHandler = () => {
            this.handleVisibilityChange();
        };
        document.addEventListener('visibilitychange', this.visibilityHandler);
    }

    startGame() {
        this.isPlaying = true;
        this.totalPauseTime = 0; // 一時停止時間をリセット

        // 1000ms後に最初のノーツ生成とメトロノーム再生を開始
        setTimeout(() => {
            this.lastNoteTime = Date.now();
            this.metronomeLastTime = this.lastNoteTime; // メトロノームも初期化

            // 最初のメトロノーム音を鳴らす
            setTimeout(() => {
                this.playBeatSound();
            }, this.audioOffset);

            // 最初のノーツを生成
            if (this.shouldGenerateNote()) {
                this.createNote();
            }
            this.cycleCount = (this.cycleCount + 1) % (this.renCount + this.restCount);

            // ゲームループを開始
            this.gameLoop();
        }, 1000);
    }

    gameLoop() {
        if (!this.isPlaying) return;

        // タブが非アクティブの場合は一時停止
        if (!this.isTabActive) {
            requestAnimationFrame(() => this.gameLoop());
            return;
        }

        const currentTime = Date.now() - this.totalPauseTime;

        // FPS計測
        this.updateFPS();

        // 拍ごとにメトロノーム音を鳴らす（最初の1000msは除外）
        if (currentTime >= 1000 && currentTime - this.metronomeLastTime >= this.metronomeInterval) {
            setTimeout(() => {
                this.playBeatSound();
            }, this.audioOffset);
            this.metronomeLastTime += this.metronomeInterval;
        }

        // ノーツ生成タイミング管理（最初の1000msは除外）
        if (currentTime >= 1000) {
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

            // 判定ラインを過ぎた距離を計算
            const distancePastLine = this.judgmentLineX - noteCenterX;

            // 距離をミリ秒に変換
            const timePastLine = this.convertDistanceToMs(distancePastLine);

            // +100msを過ぎたら不可判定を表示（ノーツは削除しない）
            if (timePastLine > 100 && !note.missed) {
                // ノーツが判定ラインを+100ms過ぎたら不可を表示
                this.missNote();
                note.missed = true; // 不可判定済みフラグを設定
            }

            // 画面左端まで行ったら削除
            if (noteCenterX < -100) {
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
            const distance = Math.abs(noteCenterX - this.judgmentCenterX); // 円の中心基準で判定

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
        // 判定に応じてヒットエフェクトを即座に開始（ラグを最小化）
        const judgment = this.getJudgment(note);
        if (judgment !== '不可') {
            // 良・可の場合は右上に飛ぶエフェクトを即座に開始
            note.hit = true;
            note.element.classList.add('hit');
            this.startHitEffect(note);
        }

        // 判定表示（数値）
        const judgmentText = this.getJudgmentText(note);
        this.showJudgment(judgmentText);

        // スコア加算
        this.addScore(judgment);

        // 判定に応じてコンボを処理
        if (judgment === '不可') {
            // 不可の場合はコンボをリセット
            this.combo = 0;
        } else {
            // 良・可の場合はコンボを加算
            this.combo++;
        }
        this.updateCombo();
    }

    startHitEffect(note) {
        // 初期状態を設定
        let translateX = 0;
        let translateY = 0;
        let opacity = 1.0;
        const duration = 150; // 0.15秒（さらに高速化）
        const startTime = performance.now(); // より高精度なタイマーを使用

        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = elapsed / duration;

            if (progress >= 1) {
                // アニメーション完了
                note.element.remove();
                return;
            }

            // 右上に吹っ飛ぶ（X: 0pxから+600px、Y: 0pxから-400px）
            translateX = 1200 * progress;
            translateY = -800 * progress;
            // 透明度を1.0から0.0に減少
            opacity = 1.0 - progress;

            // スタイルを適用（右上に高速で移動）
            note.element.style.transform = `translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px)) scale(1.0)`;
            note.element.style.opacity = opacity;

            requestAnimationFrame(animate);
        };

        // 即座にアニメーション開始
        requestAnimationFrame(animate);
    }



    getJudgment(note) {
        // ノーツの中心位置を直接使用
        const noteCenterX = note.centerX;
        const distance = noteCenterX - this.judgmentCenterX; // 前後のずれを計算（円の中心基準）

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
        const distance = noteCenterX - this.judgmentCenterX; // 前後のずれを計算（円の中心基準）

        // 距離をミリ秒に変換
        const offsetMs = this.convertDistanceToMs(distance);
        const judgment = this.getJudgment(note);

        // 判定とタイミングを組み合わせて表示（2行表示）
        if (offsetMs > 0) {
            return `${judgment}\n-${offsetMs}ms`; // 早押し
        } else if (offsetMs < 0) {
            return `${judgment}\n+${-offsetMs}ms`; // 遅押し
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

        // 判定に応じて色を設定（枠線なし）
        let colorClass = '';

        if (judgmentType === '良') {
            colorClass = 'judgment-good';
        } else if (judgmentType === '可') {
            colorClass = 'judgment-acceptable';
        } else if (judgmentType === '不可') {
            colorClass = 'judgment-bad';
        }

        if (colorClass) {
            judgmentElement.classList.add(colorClass);
        }

        // 枠線を削除
        judgmentElement.style.border = 'none';

        // 固定幅を設定（+100msが入るサイズ）
        judgmentElement.style.width = '120px';
        judgmentElement.style.textAlign = 'center';

        // 2行表示（判定とタイミングを分けて表示）
        if (judgment.includes('\n')) {
            const lines = judgment.split('\n');
            judgmentElement.innerHTML = lines.map(line => {
                // 2行目（誤差表示）は小さく、ボールドにしない
                if (line.includes('ms')) {
                    return `<div style="font-size: 0.8em; font-weight: normal;">${line}</div>`;
                } else {
                    // 1行目（判定）は2倍サイズ、ボールド、上にぴょこっとアニメーション
                    return `<div style="font-size: 2em; font-weight: bold; animation: judgmentPop 0.1s ease-out forwards;">${line}</div>`;
                }
            }).join('');
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
        this.showJudgment('不可\n+100ms');
    }

    updateScore() {
        this.scoreElement.textContent = this.score.toLocaleString();
    }

    updateCombo() {
        this.comboElement.textContent = this.combo;

        // 新しいコンボ表示要素も更新
        if (this.comboDisplayElement) {
            this.comboDisplayElement.textContent = this.combo;
        }

        // 50、100、200、300、400以降の100の倍数のコンボの時だけ表示
        if ((this.combo === 50) || (this.combo >= 100 && this.combo % 100 === 0)) {
            this.showComboMessage(`${this.combo}コンボ！`);
        }
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
                const circleCenterX = circleRect.left - gameRect.left + circleRect.width / 2;

                // 速度計算用：判定ラインの左端位置（ノーツが到達する位置）
                const lineWidth = lineRect.width;
                this.judgmentLineX = circleCenterX - (lineWidth / 2) + (lineWidth / 2);

                // 判定計算用：円の中心位置（視覚的な判定基準）
                this.judgmentCenterX = circleCenterX;

                // 判定ラインの位置が変更されたらスピードを再計算
                this.calculateNoteSpeed();
            } catch (error) {
                console.error('判定ラインの位置取得でエラー:', error);
                this.judgmentLineX = 50; // フォールバック値
                this.judgmentCenterX = 50; // フォールバック値
                this.calculateNoteSpeed();
            }
        } else {
            // 要素が見つからない場合は固定値を使用
            this.judgmentLineX = 50;
            this.judgmentCenterX = 50;
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

    showComboMessage(message) {
        // 既存のコンボメッセージを削除
        const existingMessages = document.querySelectorAll('.combo-message');
        existingMessages.forEach(element => element.remove());

        const comboElement = document.createElement('div');
        comboElement.className = 'combo-message';
        comboElement.textContent = message;

        // コンボカバーをノーツより手前に表示するため、z-indexを設定
        comboElement.style.zIndex = '2000000';

        // 判定ラインの上、精度チップよりも上に表示
        const judgmentLine = document.querySelector('.judgment-line');
        if (judgmentLine) {
            judgmentLine.appendChild(comboElement);
        } else {
            document.body.appendChild(comboElement);
        }

        // 1.5秒後に自動削除
        setTimeout(() => {
            comboElement.remove();
        }, 1500);
    }

    // タブの可視性変更を処理
    handleVisibilityChange() {
        if (document.hidden) {
            // タブが非アクティブになった時
            this.isTabActive = false;
            this.pauseStartTime = Date.now();
            console.log('タブが非アクティブになりました。ゲームを一時停止します。');
        } else {
            // タブがアクティブになった時
            this.isTabActive = true;
            if (this.pauseStartTime > 0) {
                // 一時停止時間を累積に加算
                const pauseDuration = Date.now() - this.pauseStartTime;
                this.totalPauseTime += pauseDuration;
                this.pauseStartTime = 0;
                console.log(`タブがアクティブになりました。一時停止時間: ${pauseDuration}ms`);
            }
        }
    }

    // ゲームインスタンスを完全にクリーンアップするメソッド
    cleanup() {
        // ゲームループを停止
        this.isPlaying = false;

        // イベントリスナーを削除
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
            this.keydownHandler = null;
        }
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
            this.resizeHandler = null;
        }
        if (this.visibilityHandler) {
            document.removeEventListener('visibilitychange', this.visibilityHandler);
            this.visibilityHandler = null;
        }

        // FPS表示要素を削除
        if (this.fpsElement) {
            this.fpsElement.remove();
            this.fpsElement = null;
        }

        // 既存のノーツをすべて削除
        if (this.notes) {
            this.notes.forEach(note => {
                if (note.element && note.element.parentNode) {
                    note.element.remove();
                }
            });
            this.notes = [];
        }

        // 判定表示をクリア
        const judgments = document.querySelectorAll('.judgment');
        judgments.forEach(el => el.remove());

        // コンボメッセージをクリア
        const comboMessages = document.querySelectorAll('.combo-message');
        comboMessages.forEach(el => el.remove());

        console.log('ゲームインスタンスのクリーンアップが完了しました');
    }
}

// ===== ここから統合UI用の追加コード =====
// グローバル音声管理
let globalAudioContext = null;
let globalDonAudioBuffer = null;
let globalKatsuAudioBuffer = null;
let globalMetronomeAudioBuffer = null;

// 音声ファイルをグローバルにロード
async function loadGlobalAudioFiles() {
    try {
        // Web Audio APIの初期化
        globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Don、Katsu、メトロノームの音声ファイルを読み込み
        const donResponse = await fetch('Assets/SFX/Don.wav');
        const katsuResponse = await fetch('Assets/SFX/Katsu.wav');
        const metronomeResponse = await fetch('Assets/SFX/metronome.wav');

        const donArrayBuffer = await donResponse.arrayBuffer();
        const katsuArrayBuffer = await katsuResponse.arrayBuffer();
        const metronomeArrayBuffer = await metronomeResponse.arrayBuffer();

        // AudioBufferに変換
        globalDonAudioBuffer = await globalAudioContext.decodeAudioData(donArrayBuffer);
        globalKatsuAudioBuffer = await globalAudioContext.decodeAudioData(katsuArrayBuffer);
        globalMetronomeAudioBuffer = await globalAudioContext.decodeAudioData(metronomeArrayBuffer);

        console.log('グローバル音声ファイルの読み込みが完了しました');
        return true;
    } catch (error) {
        console.error('グローバル音声ファイルの読み込みに失敗:', error);
        return false;
    }
}

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
    console.log('設定を保存しました:', settings);
}
function loadSettings() {
    // localStorageから保存された設定を読み込む
    const saved = localStorage.getItem('taikoPracticeSettings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            console.log('loadSettings - 保存された設定を読み込みました:', settings);

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
            }
        } catch (error) {
            console.error('設定の読み込みに失敗しました:', error);
        }
    } else {
        console.log('loadSettings - 保存された設定が見つかりません。デフォルト値を使用します。');
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

    // 音声コンテキストを再開（ブラウザの制限により必要）
    if (globalAudioContext && globalAudioContext.state === 'suspended') {
        globalAudioContext.resume();
    }

    // 既存のゲーム状態を完全リセット
    if (window.taikoGame) {
        window.taikoGame.cleanup();
    }

    // スコア・コンボをリセット
    const scoreElement = document.getElementById('score');
    const comboElement = document.getElementById('combo');
    const comboDisplayElement = document.getElementById('comboDisplay');
    if (scoreElement) scoreElement.textContent = '0';
    if (comboElement) comboElement.textContent = '0';
    if (comboDisplayElement) comboDisplayElement.textContent = '0';

    // TaikoPracticeインスタンスを新規生成し直す
    window.taikoGame = new TaikoPractice(settings);
    showPracticeScreen();
}
// 練習終了（タイトルに戻る）
function backToTitleUnified() {
    if (window.taikoGame) {
        window.taikoGame.cleanup();
    }
    showTitleScreen();
}
// 設定変更時に自動保存
['bpm-setting', 'note-type', 'ren-count', 'rest-count', 'offset-setting'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        // changeイベント（値が確定した時）
        el.addEventListener('change', saveSettings);
        // inputイベント（入力中も保存）
        el.addEventListener('input', saveSettings);
        // blurイベント（フォーカスが外れた時）
        el.addEventListener('blur', saveSettings);
    }
});
// ボタンイベント
window.addEventListener('DOMContentLoaded', async function () {
    // タイトル画面で音声ファイルをロード
    console.log('音声ファイルをロード中...');
    const audioLoaded = await loadGlobalAudioFiles();
    if (audioLoaded) {
        console.log('音声ファイルのロードが完了しました');
    } else {
        console.error('音声ファイルのロードに失敗しました');
    }

    loadSettings();
    showTitleScreen();
    document.getElementById('startPracticeBtn').onclick = startPracticeUnified;
    // 練習画面の「タイトルに戻る」ボタンも統合用に上書き
    const backBtn = document.querySelector('.back-button');
    if (backBtn) backBtn.onclick = backToTitleUnified;
});
// ===== ここまで統合UI用の追加コード =====