// 太鼓の達人練習画面 - メインスクリプト

// プリセット定義
let PRESETS = {};

// presets.jsonを読み込む関数
async function loadPresetsFromJson() {
    try {
        const response = await fetch('presets.json');
        if (!response.ok) throw new Error('プリセットJSONの取得に失敗しました');
        const json = await response.json();
        // idをキーにしたオブジェクトへ変換
        PRESETS = {};
        json.forEach(preset => {
            PRESETS[preset.id] = {
                name: preset.name,
                bpm: preset.bpm,
                // 古い形式と新しい形式の両方をサポート
                noteType: preset.noteType,
                renCount: preset.renCount,
                restCount: preset.restCount,
                patterns: preset.patterns, // 新しいパターン配列
                offset: preset.offset
            };
        });
    } catch (e) {
        console.error('プリセットの読み込みエラー:', e);
    }
}

// プリセットごとの最高スコア管理
class PresetScoreManager {
    constructor() {
        this.loadScores();
    }

    getScoreKey(presetId) {
        return `taiko_preset_score_${presetId}`;
    }

    getScore(presetId) {
        const key = this.getScoreKey(presetId);
        const saved = localStorage.getItem(key);
        return saved ? parseInt(saved) : 0;
    }

    setScore(presetId, score) {
        const key = this.getScoreKey(presetId);
        const currentBest = this.getScore(presetId);
        if (score > currentBest) {
            localStorage.setItem(key, score.toString());
            return true; // 新しい記録
        }
        return false; // 記録更新なし
    }

    loadScores() {
        // 初期化時に全プリセットのスコアを読み込み
        Object.keys(PRESETS).forEach(presetId => {
            this.getScore(presetId);
        });
    }
}

// グローバルスコアマネージャー
const presetScoreManager = new PresetScoreManager();

// 自己ベスト記録管理（永続保存）
class AllTimeBestManager {
    getScoreKey(presetId) {
        return `taiko_all_time_best_${presetId}`;
    }
    getScore(presetId) {
        const key = this.getScoreKey(presetId);
        const saved = localStorage.getItem(key);
        return saved ? parseInt(saved) : 0;
    }
    setScore(presetId, score) {
        const key = this.getScoreKey(presetId);
        const currentBest = this.getScore(presetId);
        if (score > currentBest) {
            localStorage.setItem(key, score.toString());
            return true;
        }
        return false;
    }
}
const allTimeBestManager = new AllTimeBestManager();

// 今回のセッションのベスト記録管理（リセットされる）
class CurrentSessionBestManager {
    constructor() {
        this.sessionBests = {};
    }

    getScore(presetId) {
        return this.sessionBests[presetId] || 0;
    }

    setScore(presetId, score) {
        const currentBest = this.getScore(presetId);
        if (score > currentBest) {
            this.sessionBests[presetId] = score;
            return true;
        }
        return false;
    }

    // セッション開始時にリセット
    resetSession(presetId) {
        this.sessionBests[presetId] = 0;
    }
}
const currentSessionBestManager = new CurrentSessionBestManager();

class TaikoPractice {
    constructor(settings) {
        // 設定値を引数から受け取る
        const bpm = settings?.bpm || 120;
        const noteType = settings?.noteType || '16th';
        const renCount = settings?.renCount || 5;
        const restCount = settings.restCount !== undefined ? settings.restCount : 3;
        const offset = settings?.offset !== undefined ? settings.offset : 0; // 0msも正しく受け取る

        // デバッグ用：コンストラクタでの設定値を確認
        // console.log('TaikoPractice constructor - settings:', settings);
        // console.log('TaikoPractice constructor - offset:', offset, 'Type:', typeof offset);

        // 定数設定
        const AUDIO_OFFSET = 400; // 音の再生オフセット（ミリ秒、マイナスで早く再生）
        const BEATS_TO_REACH = 6; // ノーツが判定ラインに到達するまでの拍数

        this.score = 0;
        this.combo = 0;
        this.bpm = bpm;
        this.noteType = noteType;
        this.noteSpeed = 400; // 音符が流れる速度（ピクセル/秒）

        // 音符の種類に応じて間隔を設定（実際のゲームループではgetAdjustedNoteInterval()を使用）
        this.noteInterval = this.getAdjustedNoteInterval();

        this.notes = [];
        this.lines = []; // ガイドライン表示用
        this.lastLineTime = 0; // 最後にガイドラインを生成した時間
        this.nextGuideLineTime = 0; // 次のガイドライン生成時間（高精度管理）
        this.guideLineBeatIndex = 0; // ガイドラインの拍インデックス（4分音符として管理）
        this.isPlaying = false;
        this.noteIndex = 0;
        this.sixteenthNoteCount = 0; // 16分音符のカウンター（0-3）
        this.lastNoteTime = 0;
        this.noteSerial = 0; // ノーツ生成ごとにインクリメント

        // フレーム時間管理（FPS計測は削除）
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

        // パターン管理：新しい形式（patterns）と古い形式（renCount/restCount）の両方をサポート
        this.patterns = settings?.patterns || null; // 新しいパターン配列
        this.renCount = renCount;
        this.restCount = restCount;
        this.cycleCount = 0; // 連打・休みサイクル用カウンター

        // パターン配列用の新しい変数
        this.currentPatternIndex = 0; // 現在実行中のパターンのインデックス
        this.patternNoteIndex = 0; // 現在のパターン内でのノーツインデックス
        this.totalPatternNotes = 0; // パターン全体のノーツ数（計算用）
        this.patternCycleCount = 0; // パターンのサイクル数

        // メトロノーム用タイマー
        this.metronomeLastTime = 0;
        this.metronomeInterval = (60 / this.bpm) * 1000; // 4分音符（拍）ごと

        // キーリピート防止用（最適化）
        this.lastKeyPressTime = 0;
        this.keyPressCooldown = 2; // 2msのクールダウン（より反応性を向上）

        // スコア算出機能用の変数
        this.recentNotes = []; // 直近100ノーツの記録
        this.recentScore = 0; // 直近100ノーツのスコア
        this.currentPreset = 'custom'; // 現在のプリセット

        this.renPos = 1; // 連打サイクル内の打数（1始まり）

        // パターン配列の場合は、全体のノーツ数を計算
        if (this.patterns) {
            this.calculateTotalPatternNotes();
        }

        // 今回のセッションのベスト記録をリセット
        currentSessionBestManager.resetSession(this.currentPreset);

        this.scoreGraphHistory = [];
        this.scoreGraphBuffer = [];

        this.init();
    }

    // パターン配列のノーツ総数と各パターンの拍数を計算
    calculateTotalPatternNotes() {
        if (!this.patterns) return;

        this.totalPatternNotes = this.patterns.reduce((total, pattern) => {
            if (pattern.type === 'hit') {
                return total + pattern.count;
            }
            return total;
        }, 0);

        // 各パターンの拍数を計算（浮動小数点誤差を最小化）
        this.patternBeats = this.patterns.map(pattern => {
            let noteTypeMultiplier;
            switch (pattern.noteType) {
                case '24th': noteTypeMultiplier = 1 / 6; break;
                case '16th': noteTypeMultiplier = 1 / 4; break;
                case '12th': noteTypeMultiplier = 1 / 3; break;
                case '8th': noteTypeMultiplier = 1 / 2; break;
                case '6th': noteTypeMultiplier = 2 / 3; break;
                case '4th': noteTypeMultiplier = 1; break;
                default: noteTypeMultiplier = 1 / 4; break;
            }
            return Math.round(pattern.count * noteTypeMultiplier * 1000) / 1000; // このパターンの合計拍数
        });

        // 各パターンの累積拍数を計算（開始拍を決めるため）
        this.patternStartBeats = [0]; // 最初のパターンは0拍目から
        for (let i = 1; i < this.patternBeats.length; i++) {
            this.patternStartBeats[i] = Math.round((this.patternStartBeats[i - 1] + this.patternBeats[i - 1]) * 1000) / 1000;
        }

        // パターン全体の拍数を計算
        this.totalPatternBeats = Math.round(this.patternBeats.reduce((total, beats) => total + beats, 0) * 1000) / 1000;

        console.log('パターン拍数:', this.patternBeats);
        console.log('パターン開始拍:', this.patternStartBeats);
        console.log('パターン全体拍数:', this.totalPatternBeats);
    }

    // パターン配列に基づいてノーツ生成を制御（新しい形式）
    shouldGenerateNoteFromPattern() {
        if (!this.patterns || this.patterns.length === 0) return false;

        const currentPattern = this.patterns[this.currentPatternIndex];
        if (!currentPattern) return false;

        // 現在のパターンが 'hit' タイプかどうか確認
        if (currentPattern.type === 'hit') {
            return this.patternNoteIndex < currentPattern.count;
        }

        // 'rest' タイプの場合は生成しない
        return false;
    }

    // パターンの現在の音符タイプを取得
    getCurrentPatternNoteType() {
        if (!this.patterns || this.patterns.length === 0) return this.noteType;

        const currentPattern = this.patterns[this.currentPatternIndex];
        return currentPattern ? currentPattern.noteType : this.noteType;
    }

    // パターンの進行を管理
    advancePattern() {
        if (!this.patterns || this.patterns.length === 0) return;

        const currentPattern = this.patterns[this.currentPatternIndex];
        if (!currentPattern) return;

        this.patternNoteIndex++;

        // 現在のパターンが完了したら次のパターンに進む
        if (this.patternNoteIndex >= currentPattern.count) {
            const oldPatternIndex = this.currentPatternIndex;
            this.currentPatternIndex = (this.currentPatternIndex + 1) % this.patterns.length;
            this.patternNoteIndex = 0;

            // パターンが一周したらサイクル数を増やす
            if (this.currentPatternIndex === 0) {
                this.patternCycleCount++;
                console.log(`パターンサイクル完了: ${this.patternCycleCount}サイクル目開始`);
            }

            console.log(`パターン進行: ${oldPatternIndex + 1} → ${this.currentPatternIndex + 1} (サイクル${this.patternCycleCount})`);
        }
    }

    // 連打数・休み数に基づいてノーツ生成を制御
    shouldGenerateNote() {
        // 新しいパターン配列がある場合はそちらを使用
        if (this.patterns && this.patterns.length > 0) {
            return this.shouldGenerateNoteFromPattern();
        }

        // 従来の形式の場合
        // cycleCountが連打数未満のときだけノーツ生成
        return this.cycleCount < this.renCount;
    }

    // BPMに応じてノーツ生成タイミングを調整
    getAdjustedNoteInterval() {
        // 基準BPM（120）での間隔を基準とする
        const baseBpm = 120;
        const baseInterval = (60 / baseBpm) * 1000; // 4分音符の基準間隔

        // 現在の音符タイプを取得（パターン配列対応）
        const currentNoteType = this.patterns && this.patterns.length > 0
            ? this.getCurrentPatternNoteType()
            : this.noteType;

        // 音符の種類に応じて基準間隔を調整
        let noteTypeMultiplier;
        switch (currentNoteType) {
            case '24th':
                noteTypeMultiplier = 1 / 6; // 24分音符
                break;
            case '16th':
                noteTypeMultiplier = 1 / 4; // 16分音符
                break;
            case '12th':
                noteTypeMultiplier = 1 / 3; // 12分音符（3連符）
                break;
            case '8th':
                noteTypeMultiplier = 1 / 2; // 8分音符
                break;
            case '6th':
                noteTypeMultiplier = 2 / 3; // 6分音符（3連符）
                break;
            case '4th':
                noteTypeMultiplier = 1; // 4分音符
                break;
            default:
                noteTypeMultiplier = 1 / 4; // デフォルトは16分音符
        }

        // BPMの比率に応じて間隔を調整
        const bpmRatio = this.bpm / baseBpm;
        const adjustedInterval = (baseInterval * noteTypeMultiplier) / bpmRatio;

        return adjustedInterval;
    }





    updateFPS() {
        // FPS表示は削除
        // この関数は残しておくが、何もしない
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
            } else {
                // 音声コンテキストの最適化設定
                if (this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }

                // 低遅延設定を確認
                // console.log('音声コンテキスト状態:', this.audioContext.state);
                // console.log('音声コンテキストサンプルレート:', this.audioContext.sampleRate);
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

            // 現在の時間を取得（より高精度なタイマーを使用）
            const currentTime = this.audioContext.currentTime;

            // AudioBufferSourceNodeを作成（最適化）
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();

            // 音声データを設定
            source.buffer = audioBuffer;

            // 音量設定（即座に設定）
            gainNode.gain.setValueAtTime(0.3, currentTime);

            // 接続（最適化された順序）
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            // 太鼓の音は即座に再生（オフセットなし）
            source.start(currentTime);

            // 音声再生完了後のクリーンアップは最小限に
            source.onended = null; // クリーンアップを無効化してパフォーマンス向上
        } catch (error) {
            console.error('太鼓の音の再生に失敗:', error);
        }
    }

    init() {
        // スコアとコンボの要素は存在しない場合があるため、nullチェック付きで初期化
        this.scoreElement = document.getElementById('score');
        this.comboElement = document.getElementById('combo');
        this.comboDisplayElement = document.getElementById('comboDisplay');
        this.noteContainer = document.getElementById('noteContainer');
        // 既存のガイドラインをリセット
        if (this.noteContainer) {
            const oldLines = this.noteContainer.querySelectorAll('.guide-line');
            oldLines.forEach(el => el.remove());
        }
        this.lines = [];
        this.lastLineTime = 0;

        // 初期化時にコンボ表示を非表示にする
        if (this.comboDisplayElement) {
            this.comboDisplayElement.textContent = '';
        }
        const comboLabel = document.querySelector('.combo-label');
        if (comboLabel) {
            comboLabel.style.display = 'none';
        }

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
        // FPS表示は削除
        // この関数は残しておくが、何もしない
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

        // キーボードイベントハンドラーを作成（最適化版）
        this.keydownHandler = (e) => {
            const currentTime = performance.now();
            if (currentTime - this.lastKeyPressTime < this.keyPressCooldown) {
                return;
            }
            // JKグループ
            if (e.code === 'KeyJ' || e.code === 'KeyK') {
                e.preventDefault();
                if (e.repeat) return;
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }
                // J: ドン, K: カツ
                const noteType = e.code === 'KeyJ' ? 'don' : 'ka';
                this.playTaikoSound(noteType);
                const color = noteType === 'don' ? '#FF4444' : '#4444FF';
                requestAnimationFrame(() => this.flashJudgmentCircle(color));
                requestAnimationFrame(() => this.handleTaikoClick(noteType, 'JK'));
                this.lastKeyPressTime = currentTime;
            } else if (e.code === 'KeyD' || e.code === 'KeyF') {
                e.preventDefault();
                if (e.repeat) return;
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }
                // D: カツ, F: ドン
                const noteType = e.code === 'KeyD' ? 'ka' : 'don';
                this.playTaikoSound(noteType);
                const color = noteType === 'don' ? '#FF4444' : '#4444FF';
                requestAnimationFrame(() => this.flashJudgmentCircle(color));
                requestAnimationFrame(() => this.handleTaikoClick(noteType, 'DF'));
                this.lastKeyPressTime = currentTime;
            } else if (e.code === 'ArrowLeft') {
                this.audioOffset -= 5;
                if (this.fpsElement) {
                    this.fpsElement.textContent = `FPS: ${this.currentFps} | Offset: ${this.audioOffset}ms`;
                }
            } else if (e.code === 'ArrowRight') {
                this.audioOffset += 5;
                if (this.fpsElement) {
                    this.fpsElement.textContent = `FPS: ${this.currentFps} | Offset: ${this.audioOffset}ms`;
                }
            } else if (e.code === 'Escape') {
                e.preventDefault();
                backToTitleUnified();
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
        this.startTime = Date.now(); // デバッグ用：ゲーム開始時間を記録

        // 1000ms後に最初のノーツ生成とメトロノーム再生を開始
        setTimeout(() => {
            this.startTime = Date.now(); // デバッグ用：実際のノーツ生成開始時間を記録
            this.lastNoteTime = this.startTime;
            this.lastLineTime = this.lastNoteTime;
            this.metronomeLastTime = this.lastNoteTime; // メトロノームも初期化

            // 最初のメトロノーム音を鳴らす
            this.playBeatSound();
            // 最初のガイドラインを生成
            this.createGuideLine();
            // ガイドライン用タイミングを初期化（4分音符として）
            this.guideLineBeatIndex = 1; // 次のガイドラインは1拍目

            // 最初のノーツを生成（オフセットが正の場合は遅らせる）
            if (this.audioOffset > 0) {
                setTimeout(() => {
                    if (this.shouldGenerateNote()) {
                        this.createNote();
                    }
                    // サイクルカウンターを進める（パターン配列の場合は従来の管理を行わない）
                    if (!this.patterns || this.patterns.length === 0) {
                        // 従来の形式の場合のみサイクル管理を行う
                        if (this.restCount === 0) {
                            this.cycleCount = (this.cycleCount + 1) % this.renCount;
                        } else {
                            this.cycleCount = (this.cycleCount + 1) % (this.renCount + this.restCount);
                        }
                    }
                }, this.audioOffset);
            } else {
                if (this.shouldGenerateNote()) {
                    this.createNote();
                }
                // サイクルカウンターを進める（パターン配列の場合は従来の管理を行わない）
                if (!this.patterns || this.patterns.length === 0) {
                    // 従来の形式の場合のみサイクル管理を行う
                    if (this.restCount === 0) {
                        this.cycleCount = (this.cycleCount + 1) % this.renCount;
                    } else {
                        this.cycleCount = (this.cycleCount + 1) % (this.renCount + this.restCount);
                    }
                }
            }

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
        // FPS更新は削除

        // 拍ごとにメトロノーム音を鳴らす（最初の1000msは除外）
        if (currentTime >= 1000 && currentTime - this.metronomeLastTime >= this.metronomeInterval) {
            // オフセットが負の場合はメトロノームを遅くする
            if (this.audioOffset < 0) {
                setTimeout(() => {
                    this.playBeatSound();
                }, -this.audioOffset);
            } else {
                this.playBeatSound();
            }
            this.metronomeLastTime += this.metronomeInterval;
        }

        // ノーツ生成タイミング管理（最初の1000msは除外）
        if (currentTime >= 1000) {
            let shouldGenerateNow = false;

            if (this.patterns && this.patterns.length > 0) {
                // パターン配列の場合：拍境界でノーツを生成
                const beatDuration = (60 / this.bpm) * 1000; // 1拍の長さ（ms）
                const elapsedTime = currentTime - this.startTime;
                const elapsedBeats = elapsedTime / beatDuration; // 経過拍数

                // 現在のパターン内での期待ノーツ位置を計算
                const currentPattern = this.patterns[this.currentPatternIndex];
                if (currentPattern && currentPattern.type === 'hit') {
                    // 拍数計算を整数ベースで行い、浮動小数点誤差を最小化
                    const cycleBeats = this.patternCycleCount * this.totalPatternBeats;
                    let patternBeats = 0;

                    // 現在のパターンまでの累積拍数を計算
                    for (let i = 0; i < this.currentPatternIndex; i++) {
                        patternBeats += this.patternBeats[i];
                    }

                    // 現在のパターン内での音符間隔（拍）
                    let noteTypeMultiplier;
                    switch (currentPattern.noteType) {
                        case '24th': noteTypeMultiplier = 1 / 6; break;
                        case '16th': noteTypeMultiplier = 1 / 4; break;
                        case '12th': noteTypeMultiplier = 1 / 3; break;
                        case '8th': noteTypeMultiplier = 1 / 2; break;
                        case '6th': noteTypeMultiplier = 2 / 3; break;
                        case '4th': noteTypeMultiplier = 1; break;
                        default: noteTypeMultiplier = 1 / 4; break;
                    }

                    // 次のノーツの期待拍位置（サイクル数 + パターン内位置）
                    const nextNoteBeat = cycleBeats + patternBeats + (this.patternNoteIndex * noteTypeMultiplier);

                    // 期待拍位置の時間に達していればノーツ生成（許容誤差5ms）
                    const tolerance = 5; // 5msの許容誤差
                    const expectedTime = this.startTime + (nextNoteBeat * beatDuration);
                    if (currentTime >= expectedTime - tolerance) {
                        shouldGenerateNow = true;
                        // 次回のチェック時間を正確に設定
                        this.lastNoteTime = expectedTime;
                    }
                } else if (currentPattern && currentPattern.type === 'rest') {
                    // restタイプのパターンの場合、時間だけ進める（重複計算を避ける）
                    const cycleBeats = this.patternCycleCount * this.totalPatternBeats;
                    let patternBeats = 0;

                    for (let i = 0; i < this.currentPatternIndex; i++) {
                        patternBeats += this.patternBeats[i];
                    }

                    // restパターンの完了時間を計算
                    const restEndBeat = cycleBeats + patternBeats + this.patternBeats[this.currentPatternIndex];
                    const expectedTime = this.startTime + (restEndBeat * beatDuration);

                    if (currentTime >= expectedTime) {
                        // restパターンが完了したら次のパターンに進む
                        const oldPatternIndex = this.currentPatternIndex;
                        this.currentPatternIndex = (this.currentPatternIndex + 1) % this.patterns.length;
                        this.patternNoteIndex = 0;

                        // パターンが一周したらサイクル数を増やす
                        if (this.currentPatternIndex === 0) {
                            this.patternCycleCount++;
                            console.log(`パターンサイクル完了: ${this.patternCycleCount}サイクル目開始`);
                        }

                        console.log(`パターン進行(rest): ${oldPatternIndex + 1} → ${this.currentPatternIndex + 1} (サイクル${this.patternCycleCount})`);
                    }
                }
            } else {
                // 従来の形式の場合
                const adjustedInterval = this.getAdjustedNoteInterval();
                // 許容誤差5msを追加してタイミングのブレを軽減
                const tolerance = 5;
                if (currentTime - this.lastNoteTime >= adjustedInterval - tolerance) {
                    shouldGenerateNow = true;
                    this.lastNoteTime += adjustedInterval;
                }
            }

            if (shouldGenerateNow) {
                // ノーツ生成を即座に実行（オフセットは音の再生タイミングのみに影響）
                if (this.patterns && this.patterns.length > 0) {
                    this.createNote();
                } else if (this.shouldGenerateNote()) {
                    this.createNote();
                }
                // サイクルカウンターを進める（パターン配列の場合は従来の管理を行わない）
                if (!this.patterns || this.patterns.length === 0) {
                    // 従来の形式の場合のみサイクル管理を行う
                    if (this.restCount === 0) {
                        this.cycleCount = (this.cycleCount + 1) % this.renCount;
                    } else {
                        this.cycleCount = (this.cycleCount + 1) % (this.renCount + this.restCount);
                    }
                }
            }

            // === ガイドライン生成（4分音符としてノーツと同じ処理） ===
            if (this.patterns && this.patterns.length > 0) {
                // パターン配列の場合：4分音符の拍境界でガイドラインを生成
                const beatDuration = (60 / this.bpm) * 1000; // 1拍の長さ（ms）
                const elapsedTime = currentTime - this.startTime;
                const elapsedBeats = elapsedTime / beatDuration; // 経過拍数

                // ガイドラインの期待拍位置（4分音符として）
                const nextGuideLineBeat = this.guideLineBeatIndex;

                // 期待拍位置の時間に達していればガイドライン生成（許容誤差5ms）
                const tolerance = 5; // 5msの許容誤差
                const expectedTime = this.startTime + (nextGuideLineBeat * beatDuration);
                if (currentTime >= expectedTime - tolerance) {
                    this.createGuideLine();
                    this.guideLineBeatIndex++;
                }
            } else {
                // 従来の形式の場合：4分音符間隔でガイドライン生成
                const beatDuration = (60 / this.bpm) * 1000; // 1拍の長さ（ms）
                const tolerance = 5;
                if (currentTime - this.lastLineTime >= beatDuration - tolerance) {
                    this.createGuideLine();
                    this.lastLineTime += beatDuration;
                }
            }
        }

        // 音符の移動
        this.updateNotes(currentTime);

        // 判定ラインを過ぎた音符の削除
        this.removePassedNotes();
        this.removePassedLines();

        // 定期的に判定ラインの位置を確認（1秒に1回）
        if (currentTime % 1000 < 16) { // 約1秒ごと
            this.updateJudgmentLinePosition();
        }

        // より高精度なタイミング管理のため、次のフレームを即座に要求
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
        note.style.transform = 'translate(-50%, -50%)'; // 中心揃え
        // 連番をz-indexに使う（新しいノーツほどz-indexが小さい）
        note.style.zIndex = String(1000000 - this.noteSerial);
        this.noteSerial++;

        this.noteContainer.appendChild(note);

        // 連打サイクル内の打数を記録（パターン配列対応）
        const renPos = this.renPos;

        // デバッグ用：ノーツ生成タイミングを拍数で表示
        if (this.patterns && this.patterns.length > 0) {
            const currentTime = Date.now();
            const elapsedTime = currentTime - this.startTime;
            const beatDuration = (60 / this.bpm) * 1000; // 1拍の長さ（ms）
            const currentBeat = (elapsedTime / beatDuration); // 0拍目から開始（1秒待機後）
            const currentPattern = this.patterns[this.currentPatternIndex];

            // 現在のパターン内の位置を記録（進行前）
            const currentNoteInPattern = this.patternNoteIndex + 1;
            const totalNotes = currentPattern?.count || 0;

            // console.log(`ノーツ${this.noteSerial}: ${currentBeat.toFixed(3)}拍目 - ${currentPattern?.noteType || 'unknown'} (パターン${this.currentPatternIndex + 1}の${currentNoteInPattern}/${totalNotes})`);

            // パターンを進行（ノーツ生成後に進行）
            this.advancePattern();
        } else {
            // 従来の形式の場合
            this.renPos++;
            if (this.renPos > this.renCount) this.renPos = 1;
        }

        // ノーツ生成時の拍数を計算
        const currentTime = Date.now();
        const elapsedTime = currentTime - this.startTime;
        const beatDuration = (60 / this.bpm) * 1000;
        const createdBeat = elapsedTime / beatDuration;

        this.notes.push({
            element: note,
            type: noteType,
            centerX: 1920, // ノーツの中心X座標（画面右端から開始）
            hit: false,
            createdAt: Date.now(), // ノーツの生成時間を記録
            createdBeat: createdBeat, // ノーツ生成時の拍数を記録
            renPos: renPos // 連打サイクル内の打数
        });
    }

    // 拍ごとのガイドラインを生成
    createGuideLine() {
        const line = document.createElement('div');
        line.className = 'guide-line';
        line.style.transform = `translateX(1920px)`;
        this.noteContainer.appendChild(line);

        this.lines.push({
            element: line,
            centerX: 1920
        });
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
                note.element.style.left = `${note.centerX}px`; // ノーツの中心座標を直接使用
                note.element.style.transform = 'translate(-50%, -50%)'; // 中心揃え

                // 判定ライン通過時刻を検出（判定ラインを通過した瞬間）
                if (note.centerX <= this.judgmentLineX && !note.judgmentLinePassed) { // 判定ラインよりも左に移動したら通過
                    note.judgmentLinePassed = true;

                    // 現在時刻を拍数に変換
                    const currentTime = Date.now();
                    const elapsedTime = currentTime - this.startTime;
                    const beatDuration = (60 / this.bpm) * 1000;
                    const currentBeat = elapsedTime / beatDuration;

                    // 期待される拍数を計算（シンプルな方法）
                    const expectedBeat = note.createdBeat + this.beatsToReach;

                    // 最終的な誤差を計算
                    const finalBeatError = currentBeat - expectedBeat;
                    const finalTimeError = finalBeatError * beatDuration;

                    console.log(`🎯 判定ライン通過: ノーツ${note.element.textContent} - 期待${expectedBeat.toFixed(3)}拍目, 実際${currentBeat.toFixed(3)}拍目, 最終誤差${finalBeatError.toFixed(4)}拍(${finalTimeError.toFixed(1)}ms)`);
                }
            }

            // 判定線を更新（ヒットしていないノーツのみ）
            if (!note.hit) {
                this.updateJudgmentLine(note);
            }
        });

        // ガイドラインを移動
        this.lines.forEach(line => {
            const deltaX = (this.noteSpeed * deltaTime) / 1000;
            line.centerX -= deltaX;
            line.element.style.transform = `translateX(${line.centerX}px)`;

            // ガイドラインの判定ライン通過時刻を検出
            if (line.centerX <= this.judgmentLineX && !line.judgmentLinePassed) { // 判定ラインよりも左に移動したら通過
                line.judgmentLinePassed = true;

                // 現在時刻を拍数に変換
                const currentTime = Date.now();
                const elapsedTime = currentTime - this.startTime;
                const beatDuration = (60 / this.bpm) * 1000;
                const currentBeat = elapsedTime / beatDuration;

                // ガイドラインは4分音符なので、期待拍数は整数
                const expectedBeat = Math.round(currentBeat);
                const finalBeatError = currentBeat - expectedBeat;
                const finalTimeError = finalBeatError * beatDuration;

                console.log(`📏 ガイドライン通過: 期待${expectedBeat}拍目, 実際${currentBeat.toFixed(3)}拍目, 最終誤差${finalBeatError.toFixed(4)}拍(${finalTimeError.toFixed(1)}ms)`);
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

            // 判定ラインを過ぎたかどうかを座標で判定
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

    removePassedLines() {
        this.lines = this.lines.filter(line => {
            if (line.centerX < -100) {
                line.element.remove();
                return false;
            }
            return true;
        });
    }

    handleTaikoClick(type, keyGroup) {
        // 判定（運指情報も渡す）
        this.checkJudgment(type, keyGroup);
    }

    checkJudgment(type, keyGroup) {
        let hitNote = null;
        let closestDistance = Infinity;
        const judgmentRangeMs = 100;
        const judgmentRangePixels = this.convertMsToDistance(judgmentRangeMs);
        for (let note of this.notes) {
            const noteCenterX = note.centerX;
            const distance = Math.abs(noteCenterX - this.judgmentCenterX);
            if (note.type === type && distance <= judgmentRangePixels && !note.hit) {
                if (distance < closestDistance) {
                    hitNote = note;
                    closestDistance = distance;
                }
            }
        }
        if (hitNote) {
            this.hitNote(hitNote, type, keyGroup);
        }
    }

    hitNote(note, type, keyGroup) {
        const judgment = this.getJudgment(note);
        // === 詳細ログ ===
        // console.log('[判定ログ]', { ... }); // ←削除
        // === ここまで ===
        if (judgment !== '不可') {
            note.hit = true;
            note.element.classList.add('hit');
            this.startHitEffect(note);
        }
        const judgmentText = this.getJudgmentText(note);
        this.showJudgment(judgmentText);
        this.addScore(judgment, keyGroup, note.renPos);
        if (judgment !== '不可') {
            this.combo++;
        } else {
            this.combo = 0;
        }
        this.updateScoreChip(judgment, keyGroup, note.renPos);
        this.updateCombo();

        // 連打セクション終了時に運指判定をチェック
        this.checkFingeringSection(keyGroup, note.renPos);
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

    addScore(judgment, keyGroup, renPos) {
        // 直近100ノーツと同じロジックでスコア計算
        let noteScore = 10000;
        let multiplier = 1.0;
        switch (judgment) {
            case '良':
                multiplier = 1.0;
                break;
            case '可':
                multiplier = 0.7;
                break;
            case '不可':
                multiplier = 0.0;
                break;
            default:
                multiplier = 0.0;
                break;
        }
        // 運指ペナルティ
        if (keyGroup && renPos > 0) {
            const isOddHit = renPos % 2 === 1;
            const isEvenHit = renPos % 2 === 0;
            if ((isOddHit && keyGroup === 'DF') || (isEvenHit && keyGroup === 'JK')) {
                multiplier *= 0.8;
            }
        }
        // 連続ペナルティ
        if (this.recentNotes.length > 0) {
            const prevNote = this.recentNotes[this.recentNotes.length - 1];
            if (prevNote && keyGroup === prevNote.keyGroup && renPos !== 1) {
                multiplier *= 0.5;
            }
        }
        noteScore *= multiplier;
        const thisNoteScore = Math.round(noteScore);
        this.score += thisNoteScore;
        this.updateScore();
        // 直近100ノーツのスコアを更新（実際に加算されたスコアを渡す）
        this.updateRecentScore(judgment, keyGroup, renPos, thisNoteScore);
        // 10ノーツ区間バッファに「このノーツで加算したスコア」をpush
        if (!this.scoreGraphBuffer) this.scoreGraphBuffer = [];
        this.scoreGraphBuffer.push(thisNoteScore);
        if (this.scoreGraphBuffer.length === 10) {
            let sectionScore = this.scoreGraphBuffer.reduce((a, b) => a + b, 0);
            this.scoreGraphHistory.push({ total: this.score, diff: sectionScore });
            if (this.scoreGraphHistory.length > 20) this.scoreGraphHistory.shift();
            this.scoreGraphBuffer = [];
            drawScoreGraph(this.scoreGraphHistory);
            console.log(`[10ノーツ区間スコア] #${this.scoreGraphHistory.length}: ${sectionScore}点 (累計: ${this.score}点)`);
        }
    }

    // 直近100ノーツのスコア算出機能
    updateRecentScore(judgment, keyGroup, renPos, actualScore) {
        this.recentNotes.push({
            judgment: judgment,
            keyGroup: keyGroup,
            renPos: renPos,
            score: actualScore,
            timestamp: Date.now()
        });
        if (this.recentNotes.length > 100) {
            this.recentNotes.shift();
        }
        this.calculateRecentScore();
    }

    calculateRecentScore() {
        if (this.recentNotes.length === 0) {
            this.recentScore = 0;
            this.updateRecentScoreDisplay();
            return;
        }
        // 実際に加算されたスコアの合計を計算
        const totalScore = this.recentNotes.reduce((sum, note) => sum + (note.score || 0), 0);
        this.recentScore = totalScore;
        this.updateRecentScoreDisplay();
    }

    updateRecentScoreDisplay() {
        const recentScoreElement = document.getElementById('recent-score');
        if (recentScoreElement) {
            recentScoreElement.textContent = this.recentScore.toLocaleString();
        }

        // 今回のセッションのベスト記録を更新
        const sessionBestUpdated = currentSessionBestManager.setScore(this.currentPreset, this.recentScore);
        const sessionBest = currentSessionBestManager.getScore(this.currentPreset);
        document.getElementById('current-session-best').textContent = sessionBest.toLocaleString();

        // 自己ベスト記録を更新
        const allTimeBestUpdated = allTimeBestManager.setScore(this.currentPreset, this.recentScore);
        const allTimeBest = allTimeBestManager.getScore(this.currentPreset);
        document.getElementById('all-time-best').textContent = allTimeBest.toLocaleString();
    }

    // スコアチップの更新
    updateScoreChip(judgment, keyGroup, renPos) {
        const fingeringStatus = document.getElementById('fingering-status');
        const consecutiveStatus = document.getElementById('consecutive-status');
        const multiplierStatus = document.getElementById('multiplier-status');
        if (!fingeringStatus || !consecutiveStatus || !multiplierStatus) return;
        let fingeringText = '-';
        let fingeringClass = '';
        if (keyGroup && renPos > 0) {
            const isOddHit = renPos % 2 === 1;
            const isEvenHit = renPos % 2 === 0;
            if ((isOddHit && keyGroup === 'JK') || (isEvenHit && keyGroup === 'DF')) {
                fingeringText = '正解';
                fingeringClass = 'correct';
            } else {
                fingeringText = '間違い';
                fingeringClass = 'incorrect';
            }
        }
        // 連続判定
        let consecutiveText = '-';
        let consecutiveClass = '';
        if (renPos === 1) {
            consecutiveText = 'OK';
            consecutiveClass = 'correct';
        } else if (this.recentNotes.length >= 2) {
            const currentNote = this.recentNotes[this.recentNotes.length - 1];
            const previousNote = this.recentNotes[this.recentNotes.length - 2];
            if (currentNote.keyGroup && previousNote.keyGroup &&
                currentNote.keyGroup === previousNote.keyGroup) {
                consecutiveText = '連続';
                consecutiveClass = 'warning';
            } else {
                consecutiveText = 'OK';
                consecutiveClass = 'correct';
            }
        }

        // 倍率計算
        let multiplier = 1.0;
        let multiplierText = '1.0x';
        let multiplierClass = '';

        // 判定による倍率
        switch (judgment) {
            case '良':
                multiplier *= 1.0;
                break;
            case '可':
                multiplier *= 0.7;
                break;
            case '不可':
                multiplier *= 0.0;
                break;
            default:
                multiplier *= 0.0;
                break;
        }

        // 運指による倍率
        if (fingeringText === '間違い') {
            multiplier *= 0.8;
        }

        // 連続による倍率
        if (consecutiveText === '連続') {
            multiplier *= 0.5;
        }

        multiplierText = multiplier.toFixed(1) + 'x';

        if (multiplier >= 1.0) {
            multiplierClass = 'correct';
        } else if (multiplier >= 0.5) {
            multiplierClass = 'warning';
        } else {
            multiplierClass = 'incorrect';
        }

        // 表示を更新
        fingeringStatus.textContent = fingeringText;
        fingeringStatus.className = `detail-value ${fingeringClass}`;

        consecutiveStatus.textContent = consecutiveText;
        consecutiveStatus.className = `detail-value ${consecutiveClass}`;

        multiplierStatus.textContent = multiplierText;
        multiplierStatus.className = `detail-value ${multiplierClass}`;
    }

    missNote() {
        this.combo = 0;
        this.updateCombo();
        this.showJudgment('不可\n+100ms');
        this.updateScoreChip('不可', null, 0);
        this.updateRecentScore('不可', null, 0, 0);
        // 10ノーツ区間バッファにも0点を追加
        if (!this.scoreGraphBuffer) this.scoreGraphBuffer = [];
        this.scoreGraphBuffer.push(0);
        if (this.scoreGraphBuffer.length === 10) {
            let sectionScore = this.scoreGraphBuffer.reduce((a, b) => a + b, 0);
            this.scoreGraphHistory.push({ total: this.score, diff: sectionScore });
            if (this.scoreGraphHistory.length > 20) this.scoreGraphHistory.shift();
            this.scoreGraphBuffer = [];
            drawScoreGraph(this.scoreGraphHistory);
            console.log(`[10ノーツ区間スコア] #${this.scoreGraphHistory.length}: ${sectionScore}点 (累計: ${this.score}点)`);
        }
    }

    updateScore() {
        // スコア表示要素が存在する場合のみ更新
        if (this.scoreElement) {
            this.scoreElement.textContent = this.score.toLocaleString();
        }
    }

    updateCombo() {
        // コンボ表示要素が存在する場合のみ更新
        if (this.comboElement) {
            this.comboElement.textContent = this.combo;
        }

        // 新しいコンボ表示要素も更新（9コンボまでは非表示）
        if (this.comboDisplayElement) {
            if (this.combo <= 9) {
                this.comboDisplayElement.textContent = '';
            } else {
                this.comboDisplayElement.textContent = this.combo;
            }
        }

        // 「コンボ」テキストも9コンボまでは非表示
        const comboLabel = document.querySelector('.combo-label');
        if (comboLabel) {
            if (this.combo <= 9) {
                comboLabel.style.display = 'none';
            } else {
                comboLabel.style.display = 'block';
            }
        }

        // コンボ表示を削除（50、100、200、300、400以降の100の倍数のコンボの時だけ表示）
        // if ((this.combo === 50) || (this.combo >= 100 && this.combo % 100 === 0)) {
        //     this.showComboMessage(`${this.combo}コンボ！`);
        // }
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
            // console.log('タブが非アクティブになりました。ゲームを一時停止します。');
        } else {
            // タブがアクティブになった時
            this.isTabActive = true;
            if (this.pauseStartTime > 0) {
                // 一時停止時間を累積に加算
                const pauseDuration = Date.now() - this.pauseStartTime;
                this.totalPauseTime += pauseDuration;
                this.pauseStartTime = 0;
                // console.log(`タブがアクティブになりました。一時停止時間: ${pauseDuration}ms`);
            }
        }
    }

    // ゲームインスタンスを完全にクリーンアップするメソッド
    cleanup() {
        // ガイドラインを削除
        if (this.lines) {
            this.lines.forEach(line => {
                if (line.element && line.element.parentNode) {
                    line.element.remove();
                }
            });
            this.lines = [];
        }
        this.lastLineTime = 0;
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

        // 運指OKメッセージをクリア
        const fingeringMessages = document.querySelectorAll('.fingering-ok-message');
        fingeringMessages.forEach(el => el.remove());

        // console.log('ゲームインスタンスのクリーンアップが完了しました');
    }

    // 連打セクションの運指判定をチェック
    checkFingeringSection(keyGroup, renPos) {
        // 連打セクションの最後のノーツ（renPos === this.renCount）の場合のみチェック
        if (renPos === this.renCount) {
            // 直近の連打数分のノーツを取得
            const recentNotes = this.recentNotes.slice(-this.renCount);

            // 連打数分のノーツが揃っているかチェック
            if (recentNotes.length === this.renCount) {
                let isPerfectFingering = true;

                // 各ノーツの運指をチェック
                for (let i = 0; i < recentNotes.length; i++) {
                    const note = recentNotes[i];
                    const expectedKeyGroup = (i % 2 === 0) ? 'JK' : 'DF'; // 奇数番目はJK、偶数番目はDF

                    if (note.keyGroup !== expectedKeyGroup) {
                        isPerfectFingering = false;
                        break;
                    }
                }

                // 運指が完璧な場合は「運指OK」を表示
                if (isPerfectFingering) {
                    this.showFingeringOK();
                }
            }
        }
    }

    // 1セクションの長さを計算（ミリ秒）
    calculateSectionDuration() {
        // 1拍あたりの時間（ミリ秒）
        const beatDuration = (60 / this.bpm) * 1000;

        // 音符の種類に応じた倍率
        let noteTypeMultiplier;
        switch (this.noteType) {
            case '24th':
                noteTypeMultiplier = 1 / 6; // 24分音符
                break;
            case '16th':
                noteTypeMultiplier = 1 / 4; // 16分音符
                break;
            case '12th':
                noteTypeMultiplier = 1 / 3; // 12分音符（3連符）
                break;
            case '8th':
                noteTypeMultiplier = 1 / 2; // 8分音符
                break;
            case '6th':
                noteTypeMultiplier = 2 / 3; // 6分音符（3連符）
                break;
            case '4th':
                noteTypeMultiplier = 1; // 4分音符
                break;
            default:
                noteTypeMultiplier = 1 / 4; // デフォルトは16分音符
        }

        // 1ノーツあたりの時間
        const noteDuration = beatDuration * noteTypeMultiplier;

        // 休み0の場合は連打が永遠に続くので、連打数分の時間を返す
        if (this.restCount === 0) {
            return noteDuration * this.renCount;
        }

        // 1セクションの長さ（連打数 + 休み数）
        const sectionNoteCount = this.renCount + this.restCount;
        const sectionDuration = noteDuration * sectionNoteCount;

        return sectionDuration;
    }

    // 運指OKメッセージを表示
    showFingeringOK() {
        // 既存の運指OKメッセージを削除
        const existingMessages = document.querySelectorAll('.fingering-ok-message');
        existingMessages.forEach(element => element.remove());

        const fingeringElement = document.createElement('div');
        fingeringElement.className = 'fingering-ok-message';
        fingeringElement.textContent = '運指OK';

        // 判定ラインの上に表示
        const judgmentLine = document.querySelector('.judgment-line');
        if (judgmentLine) {
            judgmentLine.appendChild(fingeringElement);
        } else {
            document.body.appendChild(fingeringElement);
        }

        // 1セクションの長さの0.3倍の時間だけ表示
        const sectionDuration = this.calculateSectionDuration();
        const displayDuration = sectionDuration * 0.6;

        setTimeout(() => {
            fingeringElement.remove();
        }, displayDuration);
    }

    // スコアチップの初期化
    initializeScoreChip() {
        const fingeringStatus = document.getElementById('fingering-status');
        const consecutiveStatus = document.getElementById('consecutive-status');
        const multiplierStatus = document.getElementById('multiplier-status');
        if (fingeringStatus) fingeringStatus.textContent = '-';
        if (consecutiveStatus) consecutiveStatus.textContent = '-';
        if (multiplierStatus) multiplierStatus.textContent = '1.0x';
    }
}

// ===== ここから統合UI用の追加コード =====
// グローバル音声管理
let globalAudioContext = null;
let globalDonAudioBuffer = null;
let globalKatsuAudioBuffer = null;
let globalMetronomeAudioBuffer = null;
let globalAudioBuffers = null; // 音声ファイルのArrayBufferを保存

// 音声ファイルをグローバルにロード（最適化版）
async function loadGlobalAudioFiles() {
    try {
        // 音声ファイルを並列で読み込み（高速化）
        const [donResponse, katsuResponse, metronomeResponse] = await Promise.all([
            fetch('Assets/SFX/Don.wav'),
            fetch('Assets/SFX/Katsu.wav'),
            fetch('Assets/SFX/metronome.wav')
        ]);

        // ArrayBufferを並列で取得
        const [donArrayBuffer, katsuArrayBuffer, metronomeArrayBuffer] = await Promise.all([
            donResponse.arrayBuffer(),
            katsuResponse.arrayBuffer(),
            metronomeResponse.arrayBuffer()
        ]);

        // AudioContextの初期化はユーザージェスチャー後に延期
        // console.log('音声ファイルの読み込みが完了しました（AudioContextは後で初期化）');
        return { donArrayBuffer, katsuArrayBuffer, metronomeArrayBuffer };
    } catch (error) {
        console.error('音声ファイルの読み込みに失敗:', error);
        return null;
    }
}

// AudioContextの初期化（ユーザージェスチャー後に呼び出し）
async function initializeAudioContext(audioBuffers) {
    if (!audioBuffers) return false;

    try {
        // Web Audio APIの初期化（最適化設定）
        globalAudioContext = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint: 'interactive', // 低遅延モード
            sampleRate: 44100 // 標準サンプルレート
        });

        // AudioBufferを並列でデコード（高速化）
        [globalDonAudioBuffer, globalKatsuAudioBuffer, globalMetronomeAudioBuffer] = await Promise.all([
            globalAudioContext.decodeAudioData(audioBuffers.donArrayBuffer),
            globalAudioContext.decodeAudioData(audioBuffers.katsuArrayBuffer),
            globalAudioContext.decodeAudioData(audioBuffers.metronomeArrayBuffer)
        ]);

        // 音声コンテキストを開始（事前に開始して遅延を減らす）
        if (globalAudioContext.state === 'suspended') {
            await globalAudioContext.resume();
        }

        // console.log('グローバル音声ファイルの読み込みが完了しました（最適化版）');
        return true;
    } catch (error) {
        console.error('AudioContextの初期化に失敗:', error);
        return false;
    }
}

// 設定の保存・復元
function getPracticeSettings() {
    const bpm = parseInt(document.getElementById('bpm-setting').value) || 120;
    const noteType = document.getElementById('note-type').value || '16th';
    const renCount = parseInt(document.getElementById('ren-count').value) || 5;
    const restCountValue = document.getElementById('rest-count').value;
    const restCount = restCountValue !== '' ? parseInt(restCountValue) : 3;
    const offset = parseInt(document.getElementById('offset-setting').value) || 0;

    // 現在選択されているプリセットのパターン配列を取得
    const currentPresetId = getCurrentPresetId();
    const currentPreset = PRESETS[currentPresetId];
    const patterns = currentPreset?.patterns || null; // パターン配列があれば取得

    // デバッグ用：HTMLのinput要素から取得した値を確認
    const offsetElement = document.getElementById('offset-setting');
    // console.log('getPracticeSettings - offset input element:', offsetElement);
    // console.log('getPracticeSettings - offset input value:', offsetElement?.value, 'Type:', typeof offsetElement?.value);
    // console.log('getPracticeSettings - parsed offset:', offset, 'Type:', typeof offset);

    return { bpm, noteType, renCount, restCount, offset, patterns };
}
function saveSettings() {
    const settings = getPracticeSettings();
    localStorage.setItem('taikoPracticeSettings', JSON.stringify(settings));
    // console.log('設定を保存しました:', settings);
}
function loadSettings() {
    // localStorageから保存された設定を読み込む
    const saved = localStorage.getItem('taikoPracticeSettings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            // console.log('loadSettings - 保存された設定を読み込みました:', settings);

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
                renCountElement.value = settings.renCount || 5;
                renCountElement.setAttribute('value', settings.renCount || 5);
            }
            if (restCountElement) {
                restCountElement.value = settings.restCount !== undefined ? settings.restCount : 3;
                restCountElement.setAttribute('value', settings.restCount !== undefined ? settings.restCount : 3);
            }
            if (offsetElement) {
                offsetElement.value = settings.offset || 0;
                offsetElement.setAttribute('value', settings.offset || 0);
            }

            // 設定表示を更新
            updateSettingsDisplay();
        } catch (error) {
            console.error('設定の読み込みに失敗しました:', error);
        }
    } else {
        // console.log('loadSettings - 保存された設定が見つかりません。デフォルト値を使用します。');
        // デフォルト値でも設定表示を更新
        updateSettingsDisplay();
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

    // スコアチップを初期化
    if (window.taikoGame) {
        window.taikoGame.initializeScoreChip();
    }
}
// 設定表示を更新する関数
function updateSettingsDisplay() {
    const settings = getPracticeSettings();

    // 音符の種類の表示名を取得
    const noteTypeNames = {
        '24th': '24分音符',
        '16th': '16分音符',
        '12th': '12分音符',
        '8th': '8分音符',
        '6th': '6分音符',
        '4th': '4分音符'
    };

    // 設定表示要素を更新
    const bpmElement = document.getElementById('current-bpm');
    const noteElement = document.getElementById('current-note');
    const renElement = document.getElementById('current-ren');
    const restElement = document.getElementById('current-rest');
    const offsetElement = document.getElementById('current-offset');

    if (bpmElement) bpmElement.textContent = settings.bpm;
    if (noteElement) noteElement.textContent = noteTypeNames[settings.noteType] || settings.noteType;
    if (renElement) renElement.textContent = `${settings.renCount}連`;
    if (restElement) restElement.textContent = settings.restCount;
    if (offsetElement) offsetElement.textContent = `${settings.offset}ms`;
}

// 練習開始
function startPracticeUnified() {
    saveSettings();
    const settings = getPracticeSettings();

    // デバッグ用：設定値を確認
    // console.log('Practice settings:', settings);
    // console.log('Offset value:', settings.offset, 'Type:', typeof settings.offset);

    // AudioContextが初期化されていない場合は初期化を試行
    if (!globalAudioContext && globalAudioBuffers) {
        // console.warn('AudioContextが初期化されていません。ユーザージェスチャー後に初期化してください。');
        return;
    }

    // 音声コンテキストを再開（ブラウザの制限により必要）
    if (globalAudioContext && globalAudioContext.state === 'suspended') {
        globalAudioContext.resume();
    }

    // 既存のゲーム状態を完全リセット
    if (window.taikoGame) {
        window.taikoGame.cleanup();
    }

    // スコア・コンボをリセット（要素が存在する場合のみ）
    const scoreElement = document.getElementById('score');
    const comboElement = document.getElementById('combo');
    const comboDisplayElement = document.getElementById('comboDisplay');
    if (scoreElement) scoreElement.textContent = '0';
    if (comboElement) comboElement.textContent = '0';
    if (comboDisplayElement) comboDisplayElement.textContent = '';

    // コンボ表示を非表示にする
    const comboLabel = document.querySelector('.combo-label');
    if (comboLabel) {
        comboLabel.style.display = 'none';
    }

    // 設定表示を更新
    updateSettingsDisplay();

    // 現在のプリセットを設定
    const currentPreset = getCurrentPresetId();

    // 今回のセッションのベスト記録をリセット
    currentSessionBestManager.resetSession(currentPreset);
    document.getElementById('current-session-best').textContent = '0';

    // TaikoPracticeインスタンスを新規生成し直す
    window.taikoGame = new TaikoPractice(settings);
    window.taikoGame.currentPreset = currentPreset; // プリセットIDを設定
    // 直近100ノーツの記録をリセット
    window.taikoGame.recentNotes = [];
    window.taikoGame.recentScore = 0;
    document.getElementById('recent-score').textContent = '0';
    showPracticeScreen();
    // 練習開始時にグラフもリセット
    window.taikoGame.scoreGraphHistory = [];
    window.taikoGame.scoreGraphBuffer = [];
    drawScoreGraph([]);
}
// 練習終了（タイトルに戻る）
function backToTitleUnified() {
    if (window.taikoGame) {
        // 練習終了時にスコアを保存
        const currentPreset = getCurrentPresetId();
        if (currentPreset && window.taikoGame.recentScore > 0) {
            // 自己ベスト記録を更新
            const isNewAllTimeBest = allTimeBestManager.setScore(currentPreset, window.taikoGame.recentScore);
            if (isNewAllTimeBest) {
                // console.log(`新しい自己ベスト達成！プリセット: ${currentPreset}, スコア: ${window.taikoGame.recentScore}`);
                // タイトル画面の自己ベスト表示を更新
                const presetScore = document.getElementById('current-preset-score');
                if (presetScore) {
                    presetScore.textContent = `自己ベスト: ${window.taikoGame.recentScore.toLocaleString()}`;
                }
            }
        }
        window.taikoGame.cleanup();
    }
    showTitleScreen();
}

// 現在のプリセットIDを取得
function getCurrentPresetId() {
    const presetSelect = document.getElementById('preset-select');
    return presetSelect ? presetSelect.value : 'custom';
}
// プリセット機能の実装
function loadPreset(presetId) {
    const preset = PRESETS[presetId];
    if (!preset) return;

    // 設定値をプリセットに更新
    document.getElementById('bpm-setting').value = preset.bpm;
    document.getElementById('note-type').value = preset.noteType;
    document.getElementById('ren-count').value = preset.renCount;
    document.getElementById('rest-count').value = preset.restCount;
    document.getElementById('offset-setting').value = preset.offset;

    // プリセットドロップダウンの値を更新
    const presetSelect = document.getElementById('preset-select');
    if (presetSelect) {
        presetSelect.value = presetId;
    }

    // 設定項目の有効/無効を切り替え
    const isCustom = presetId === 'custom';
    const settingInputs = ['bpm-setting', 'note-type', 'ren-count', 'rest-count', 'offset-setting'];
    const settingGroups = document.querySelectorAll('.setting-group');

    settingInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.disabled = !isCustom;
        }
    });

    settingGroups.forEach(group => {
        if (isCustom) {
            group.classList.remove('disabled');
        } else {
            group.classList.add('disabled');
        }
    });

    // プリセット情報を更新
    document.getElementById('current-preset-name').textContent = preset.name;
    const allTimeBest = allTimeBestManager.getScore(presetId);
    document.getElementById('current-preset-score').textContent = `自己ベスト: ${allTimeBest.toLocaleString()}`;

    // 自己ベスト記録の表示（練習画面用）
    document.getElementById('all-time-best').textContent = allTimeBest.toLocaleString();

    // 今回のセッションのベスト記録の表示
    const sessionBest = currentSessionBestManager.getScore(presetId);
    document.getElementById('current-session-best').textContent = sessionBest.toLocaleString();

    // 設定を保存
    saveSettings();
    updateSettingsDisplay();
}

// プリセットドロップダウンのイベントリスナーを設定
function setupPresetDropdown() {
    const presetSelect = document.getElementById('preset-select');
    if (presetSelect) {
        presetSelect.addEventListener('change', () => {
            const presetId = presetSelect.value;
            loadPreset(presetId);
        });
    }
}

// 設定変更時に自動保存と表示更新
['bpm-setting', 'note-type', 'ren-count', 'rest-count', 'offset-setting'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        // changeイベント（値が確定した時）
        el.addEventListener('change', () => {
            saveSettings();
            updateSettingsDisplay();
        });
        // inputイベント（入力中も保存）
        el.addEventListener('input', () => {
            saveSettings();
            updateSettingsDisplay();
        });
        // blurイベント（フォーカスが外れた時）
        el.addEventListener('blur', () => {
            saveSettings();
            updateSettingsDisplay();
        });
    }
});
// ボタンイベント
window.addEventListener('DOMContentLoaded', async function () {
    // タイトル画面で音声ファイルをロード（AudioContextは後で初期化）
    // console.log('音声ファイルをロード中...');
    globalAudioBuffers = await loadGlobalAudioFiles();
    if (globalAudioBuffers) {
        // console.log('音声ファイルのロードが完了しました');
    } else {
        // console.error('音声ファイルのロードに失敗しました');
    }

    await loadPresetsFromJson(); // presets.jsonを読み込む
    loadSettings();
    setupPresetDropdown(); // プリセットドロップダウンの設定
    loadPreset('custom'); // デフォルトでカスタムプリセットを読み込み
    showTitleScreen();

    // 練習開始ボタンのイベントハンドラーを修正
    document.getElementById('startPracticeBtn').onclick = async () => {
        // ユーザージェスチャー後にAudioContextを初期化
        if (globalAudioBuffers && !globalAudioContext) {
            // console.log('AudioContextを初期化中...');
            const audioInitialized = await initializeAudioContext(globalAudioBuffers);
            if (!audioInitialized) {
                // console.error('AudioContextの初期化に失敗しました');
                return;
            }
        }
        startPracticeUnified();
    };

    // 練習画面の「タイトルに戻る」ボタンも統合用に上書き
    const backBtn = document.querySelector('.back-button');
    if (backBtn) backBtn.onclick = backToTitleUnified;

    // タイトル画面でスペースキーで練習開始（AudioContext初期化付き）
    document.addEventListener('keydown', async (e) => {
        if (e.code === 'Space' && document.querySelector('.title-screen').style.display !== 'none') {
            e.preventDefault();
            // ユーザージェスチャー後にAudioContextを初期化
            if (globalAudioBuffers && !globalAudioContext) {
                // console.log('AudioContextを初期化中...');
                const audioInitialized = await initializeAudioContext(globalAudioBuffers);
                if (!audioInitialized) {
                    // console.error('AudioContextの初期化に失敗しました');
                    return;
                }
            }
            startPracticeUnified();
        }
    });
});
// ===== ここまで統合UI用の追加コード =====

// スコアグラフ描画関数
function drawScoreGraph(history) {
    const canvas = document.getElementById('score-graph');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // 軸
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(90, 30);
    ctx.lineTo(90, 330);
    ctx.lineTo(930, 330);
    ctx.stroke();
    // ラベル（削除）
    // ctx.fillStyle = '#333';
    // ctx.font = '24px sans-serif';
    // ctx.fillText('100%', 20, 60);
    // ctx.fillText('0%', 40, 330);
    // 折れ線
    ctx.strokeStyle = '#FFD600';
    ctx.lineWidth = 4;
    ctx.beginPath();
    let maxScore = 100000;
    let n = history.length;
    for (let i = 0; i < n; i++) {
        let percent = Math.max(0, Math.min(1, history[i].diff / maxScore));
        let x = 90 + (i * ((840) / 19));
        let y = 330 - percent * 300;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
}