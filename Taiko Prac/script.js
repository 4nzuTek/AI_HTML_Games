// 太鼓の達人練習ツール - メインスクリプト

// 練習開始ボタンのクリックイベント
function startPractice() {
    // 設定を取得
    const settings = getPracticeSettings();

    // 設定をURLパラメータとして渡す
    const params = new URLSearchParams({
        bpm: settings.bpm,
        noteType: settings.noteType,
        renCount: settings.renCount,
        restCount: settings.restCount,
        offset: settings.offset
    });

    // ボタンのアニメーション効果
    const button = document.querySelector('.start-button');
    button.style.transform = 'scale(0.95)';

    setTimeout(() => {
        button.style.transform = 'scale(1)';
        // 練習画面に遷移（設定付き）
        console.log('練習開始ボタンがクリックされました');
        window.location.href = `practice.html?${params.toString()}`;
    }, 150);
}

// 練習設定を取得
function getPracticeSettings() {
    const bpm = parseInt(document.getElementById('bpm-setting').value) || 120;
    const noteType = document.getElementById('note-type').value || '16th';
    const renCount = parseInt(document.getElementById('ren-count').value) || 4;
    const restCount = parseInt(document.getElementById('rest-count').value) || 1;
    const offset = parseInt(document.getElementById('offset-setting').value) || 400;

    return {
        bpm: bpm,
        noteType: noteType,
        renCount: renCount,
        restCount: restCount,
        offset: offset
    };
}

// 設定を保存
function saveSettings() {
    const settings = getPracticeSettings();
    localStorage.setItem('taikoPracticeSettings', JSON.stringify(settings));
}

// 設定を読み込み
function loadSettings() {
    const saved = localStorage.getItem('taikoPracticeSettings');
    if (saved) {
        const settings = JSON.parse(saved);
        document.getElementById('bpm-setting').value = settings.bpm || 120;
        document.getElementById('note-type').value = settings.noteType || '16th';
        document.getElementById('ren-count').value = settings.renCount || 4;
        document.getElementById('rest-count').value = settings.restCount || 1;
        document.getElementById('offset-setting').value = settings.offset || 400;
    }
}

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function () {
    console.log('太鼓の達人練習ツールが読み込まれました');

    // 保存された設定を読み込み
    loadSettings();

    // 設定変更時に自動保存
    document.getElementById('bpm-setting').addEventListener('change', saveSettings);
    document.getElementById('note-type').addEventListener('change', saveSettings);
    document.getElementById('ren-count').addEventListener('change', saveSettings);
    document.getElementById('rest-count').addEventListener('change', saveSettings);
    document.getElementById('offset-setting').addEventListener('change', saveSettings);

    // キーボードショートカットの設定
    document.addEventListener('keydown', function (event) {
        // Enterキーで練習開始
        if (event.key === 'Enter') {
            startPractice();
        }

        // ESCキーでタイトルに戻る（将来的に実装）
        if (event.key === 'Escape') {
            console.log('ESCキーが押されました');
        }
    });

    // タッチデバイス対応
    const startButton = document.querySelector('.start-button');
    if (startButton) {
        startButton.addEventListener('touchstart', function (e) {
            e.preventDefault();
            this.style.transform = 'scale(0.95)';
        });

        startButton.addEventListener('touchend', function (e) {
            e.preventDefault();
            this.style.transform = 'scale(1)';
            startPractice();
        });
    }
});

// 将来的に実装予定の機能
const TaikoPracticeTool = {
    // 練習設定
    settings: {
        difficulty: 'normal',
        speed: 1.0,
        song: null
    },

    // 練習画面への遷移
    navigateToPractice: function () {
        // 練習画面の実装予定
        console.log('練習画面に遷移します');
    },

    // 設定の保存
    saveSettings: function () {
        localStorage.setItem('taikoSettings', JSON.stringify(this.settings));
    },

    // 設定の読み込み
    loadSettings: function () {
        const saved = localStorage.getItem('taikoSettings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
        }
    }
};

// 初期設定の読み込み
TaikoPracticeTool.loadSettings(); 