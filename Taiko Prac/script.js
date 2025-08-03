// 太鼓の達人練習ツール - メインスクリプト

// 練習開始ボタンのクリックイベント
function startPractice() {
    // ボタンのアニメーション効果
    const button = document.querySelector('.start-button');
    button.style.transform = 'scale(0.95)';

    setTimeout(() => {
        button.style.transform = 'scale(1)';
        // 練習画面に遷移
        console.log('練習開始ボタンがクリックされました');
        window.location.href = 'practice.html';
    }, 150);
}

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function () {
    console.log('太鼓の達人練習ツールが読み込まれました');

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