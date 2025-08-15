export function createSongSelectScene(gameState, onBack, onSongSelected) {
    let isActive = false;

    function enter() {
        isActive = true;

        // UI要素の表示/非表示
        document.getElementById('menu').style.display = 'none';
        document.getElementById('songSelect').classList.remove('hidden');

        // ボタンイベント設定
        const backBtn = document.getElementById('backBtn');
        const songItems = document.querySelectorAll('.song-item');

        backBtn.onclick = onBack;

        songItems.forEach(item => {
            item.onclick = () => {
                const songName = item.dataset.song;
                const difficulties = item.querySelectorAll('.difficulty');

                // 難易度選択ダイアログ（最後にプレイした難易度を初期位置に）
                let defaultDifficulty = '1';
                if (gameState.selectedDifficulty === 'Hard') defaultDifficulty = '2';
                else if (gameState.selectedDifficulty === 'Oni') defaultDifficulty = '3';

                const difficulty = prompt(
                    `${songName}の難易度を選択してください:\n1: 普通\n2: 難しい\n3: 鬼`,
                    defaultDifficulty
                );

                let selectedDifficulty = 'Normal';
                if (difficulty === '2') selectedDifficulty = 'Hard';
                else if (difficulty === '3') selectedDifficulty = 'Oni';

                // 選択された難易度を保存
                gameState.selectedDifficulty = selectedDifficulty;
                localStorage.setItem('taikoLastDifficulty', selectedDifficulty);

                onSongSelected(songName, selectedDifficulty);
            };
        });
    }

    function leave() {
        isActive = false;

        // イベントリスナーを削除
        const backBtn = document.getElementById('backBtn');
        const songItems = document.querySelectorAll('.song-item');

        backBtn.onclick = null;
        songItems.forEach(item => {
            item.onclick = null;
        });
    }

    function update(dt) {
        // 曲選択シーンでは特別な更新処理は不要
    }

    function render(ctx) {
        // 背景描画
        ctx.fillStyle = '#14141a';
        ctx.fillRect(0, 0, 1280, 720);

        // タイトル描画
        ctx.fillStyle = '#e7e7ee';
        ctx.font = 'bold 36px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('曲選択', 640, 100);

        // 説明
        ctx.font = '16px ui-sans-serif, system-ui';
        ctx.fillStyle = '#e7e7ee';
        ctx.fillText('曲をクリックして難易度を選択してください', 640, 150);
    }

    return {
        enter,
        leave,
        update,
        render
    };
}
