import { SongLoader } from '../core/song-loader.js';

export function createMenuScene(gameState, onSongSelect) {
    let isActive = false;
    let selectedSongIndex = 0;
    let selectedDifficultyIndex = 1; // Normal
    let songs = [];
    let songInfos = []; // SongLoaderから取得した曲情報
    let difficulties = ['Easy', 'Normal', 'Hard', 'Oni'];
    let currentState = 'menu'; // 'menu', 'songSelect', 'difficultySelect'
    let songLoader = new SongLoader();
    let isLoading = false;

    // 曲リストを動的に読み込み
    async function loadSongs() {
        if (isLoading) return;

        isLoading = true;
        try {
            console.log('メニューシーン: 曲の読み込み開始');
            songInfos = await songLoader.loadSongs();

            // 曲名のリストを作成
            songs = songInfos.map(song => song.title || song.folderName);

            console.log('メニューシーン: 読み込み完了', {
                songCount: songs.length,
                songs: songs,
                songInfos: songInfos.map(s => ({ folderName: s.folderName, title: s.title }))
            });

            // 曲が見つからない場合は固定リストを使用
            if (songs.length === 0) {
                songs = ['ペットショップ大戦'];
                console.log('メニューシーン: 利用可能な曲がないため、固定リストを使用');
            }
        } catch (error) {
            console.error('メニューシーン: 曲の読み込みに失敗', error);
            // エラーの場合は固定リストを使用
            songs = ['ペットショップ大戦', 'いただきバベル', 'ハロー！ハロウィン'];
            console.log('メニューシーン: エラーにより固定曲リストを使用:', songs);
        } finally {
            isLoading = false;
        }
    }

    // 選択された曲の情報を取得
    function getSelectedSongInfo() {
        if (selectedSongIndex >= 0 && selectedSongIndex < songInfos.length) {
            return songInfos[selectedSongIndex];
        }
        return null;
    }

    // オフセット設定の読み込み
    function loadOffsetSettings() {
        const savedOffset = localStorage.getItem('taikoNoteOffset');
        if (savedOffset !== null) {
            gameState.noteOffset = parseInt(savedOffset);
        } else {
            gameState.noteOffset = 0;
        }

        // UIへの反映はmain.jsで処理されるため、ここでは何もしない
    }

    // オフセット設定の保存
    function saveOffsetSettings() {
        localStorage.setItem('taikoNoteOffset', gameState.noteOffset.toString());
    }

    function enter() {
        isActive = true;

        // UI要素の表示/非表示
        document.getElementById('menu').style.display = 'flex';
        document.getElementById('songSelect').classList.add('hidden');

        // 曲リストとオフセット設定を読み込み
        loadSongs();
        loadOffsetSettings();

        // 保存された難易度を読み込んで初期選択位置を設定
        const savedDifficulty = localStorage.getItem('taikoLastDifficulty');
        if (savedDifficulty !== null) {
            const difficultyIndex = difficulties.indexOf(savedDifficulty);
            if (difficultyIndex !== -1) {
                selectedDifficultyIndex = difficultyIndex;
            }
        }

        // 保存された曲を読み込んで初期選択位置を設定
        const savedSong = localStorage.getItem('taikoLastSong');
        if (savedSong !== null) {
            const songIndex = songs.findIndex(song => song === savedSong);
            if (songIndex !== -1) {
                selectedSongIndex = songIndex;
            }
        }

        // オフセット設定はmain.jsで処理されるため、ここでは何もしない
    }

    function leave() {
        isActive = false;
        // オフセット設定はmain.jsで処理されるため、ここでは何もしない
    }

    function update(dt) {
        // キーボード入力処理
        if (currentState === 'menu') {
            // メニュー画面ではEnterキーで曲選択へ
            if (window.Input && window.Input.isPressed('Enter')) {
                console.log('メニューシーン: メインメニューでEnterキーが押されました');
                currentState = 'songSelect';
            }
        } else if (currentState === 'songSelect') {
            // 曲選択画面
            if (window.Input && window.Input.isPressed('ArrowUp')) {
                selectedSongIndex = (selectedSongIndex - 1 + songs.length) % songs.length;
                console.log(`メニューシーン: 曲選択 - 上矢印キー、選択曲: ${songs[selectedSongIndex]}`);
            } else if (window.Input && window.Input.isPressed('ArrowDown')) {
                selectedSongIndex = (selectedSongIndex + 1) % songs.length;
                console.log(`メニューシーン: 曲選択 - 下矢印キー、選択曲: ${songs[selectedSongIndex]}`);
            } else if (window.Input && window.Input.isPressed('Enter')) {
                console.log('メニューシーン: 曲選択でEnterキーが押されました - 難易度選択へ');
                currentState = 'difficultySelect';
            } else if (window.Input && window.Input.isPressed('Escape')) {
                console.log('メニューシーン: 曲選択でEscapeキーが押されました - メインメニューへ');
                currentState = 'menu';
            }
        } else if (currentState === 'difficultySelect') {
            // 難易度選択画面
            if (window.Input && window.Input.isPressed('ArrowLeft')) {
                selectedDifficultyIndex = (selectedDifficultyIndex - 1 + difficulties.length) % difficulties.length;
                console.log(`メニューシーン: 難易度選択 - 左矢印キー、選択難易度: ${difficulties[selectedDifficultyIndex]}`);
            } else if (window.Input && window.Input.isPressed('ArrowRight')) {
                selectedDifficultyIndex = (selectedDifficultyIndex + 1) % difficulties.length;
                console.log(`メニューシーン: 難易度選択 - 右矢印キー、選択難易度: ${difficulties[selectedDifficultyIndex]}`);
            } else if (window.Input && window.Input.isPressed('Enter')) {
                console.log('メニューシーン: 難易度選択でEnterキーが押されました - ゲーム開始処理を開始');
                // ゲーム開始
                console.log('メニューシーン: Enterキーが押されました - ゲーム開始処理を開始');
                const selectedSongInfo = getSelectedSongInfo();
                console.log('メニューシーン: 選択された曲情報:', selectedSongInfo);

                if (selectedSongInfo) {
                    gameState.selectedSong = selectedSongInfo.folderName;
                    gameState.selectedDifficulty = difficulties[selectedDifficultyIndex];
                    gameState.selectedSongTjaPath = selectedSongInfo.tjaPath;
                    gameState.selectedSongAudioPath = selectedSongInfo.audioPath;

                    // 選択された難易度と曲を保存
                    localStorage.setItem('taikoLastDifficulty', gameState.selectedDifficulty);
                    localStorage.setItem('taikoLastSong', gameState.selectedSong);

                    console.log(`メニューシーン: ゲーム開始`, {
                        song: gameState.selectedSong,
                        difficulty: gameState.selectedDifficulty,
                        tjaPath: gameState.selectedSongTjaPath,
                        audioPath: gameState.selectedSongAudioPath
                    });

                    console.log('メニューシーン: onSongSelect()を呼び出します');
                    onSongSelect();
                    console.log('メニューシーン: onSongSelect()の呼び出し完了');
                } else {
                    console.error('メニューシーン: 選択された曲の情報が見つかりません');
                }
            } else if (window.Input && window.Input.isPressed('Escape')) {
                console.log('メニューシーン: 難易度選択でEscapeキーが押されました - 曲選択へ');
                currentState = 'songSelect';
            }
        }
    }

    function render(ctx) {
        // 背景描画
        ctx.fillStyle = '#14141a';
        ctx.fillRect(0, 0, 1280, 720);

        if (currentState === 'menu') {
            renderMenu(ctx);
        } else if (currentState === 'songSelect') {
            renderSongSelect(ctx);
        } else if (currentState === 'difficultySelect') {
            renderDifficultySelect(ctx);
        }

        // デバッグ情報表示
        ctx.fillStyle = '#ffff00';
        ctx.font = '12px ui-sans-serif, system-ui';
        ctx.textAlign = 'left';
        ctx.fillText(`現在の状態: ${currentState}`, 20, 20);
        ctx.fillText(`選択曲インデックス: ${selectedSongIndex}`, 20, 35);
        ctx.fillText(`選択難易度インデックス: ${selectedDifficultyIndex}`, 20, 50);
        ctx.fillText(`曲数: ${songs.length}`, 20, 65);
        ctx.fillText(`読み込み中: ${isLoading}`, 20, 80);
    }

    function renderMenu(ctx) {
        // タイトル描画
        ctx.fillStyle = '#e7e7ee';
        ctx.font = 'bold 48px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('太鼓の達人クローン', 640, 200);

        // サブタイトル
        ctx.font = '24px ui-sans-serif, system-ui';
        ctx.fillStyle = '#6be675';
        ctx.fillText('Web版', 640, 250);

        // オフセット情報表示（プレイヤー目線で正負を逆に表示）
        ctx.font = '16px ui-sans-serif, system-ui';
        ctx.fillStyle = '#4ecdc4';
        ctx.fillText(`ノートオフセット: ${-(gameState.noteOffset || 0)}ms`, 640, 350);

        // 曲の読み込み状況表示
        if (isLoading) {
            ctx.fillStyle = '#ffd93d';
            ctx.fillText('曲を読み込み中...', 640, 380);
        } else {
            ctx.fillStyle = '#6be675';
            ctx.fillText(`利用可能な曲: ${songs.length}曲`, 640, 380);
        }

        // 操作説明
        ctx.font = '16px ui-sans-serif, system-ui';
        ctx.fillStyle = '#e7e7ee';
        ctx.fillText('Enter: スタート', 640, 420);
        ctx.fillStyle = '#6be675';
        ctx.fillText('D/F: ドン（赤）  J/K: カッ（青）', 640, 450);
        ctx.fillText('モバイル: スワイプで操作', 640, 480);
    }

    function renderSongSelect(ctx) {
        // タイトル描画
        ctx.fillStyle = '#e7e7ee';
        ctx.font = 'bold 36px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('曲選択', 640, 100);

        if (isLoading) {
            ctx.fillStyle = '#ffd93d';
            ctx.font = '20px ui-sans-serif, system-ui';
            ctx.fillText('曲を読み込み中...', 640, 300);
            return;
        }

        // 曲リスト描画
        for (let i = 0; i < songs.length; i++) {
            const song = songs[i];
            const songInfo = songInfos[i];
            const y = 200 + i * 60;
            const isSelected = i === selectedSongIndex;

            if (isSelected) {
                ctx.fillStyle = '#6be675';
                ctx.fillRect(200, y - 25, 880, 50);
            }

            ctx.fillStyle = isSelected ? '#14141a' : '#e7e7ee';
            ctx.font = 'bold 24px ui-sans-serif, system-ui';
            ctx.textAlign = 'left';
            ctx.fillText(song, 220, y + 8);

            // サブタイトル表示
            if (songInfo && songInfo.subtitle && songInfo.subtitle !== '--') {
                ctx.font = '16px ui-sans-serif, system-ui';
                ctx.fillStyle = isSelected ? '#14141a' : '#888';
                ctx.fillText(songInfo.subtitle, 220, y + 30);
            }
        }

        // 操作説明
        ctx.font = '16px ui-sans-serif, system-ui';
        ctx.fillStyle = '#e7e7ee';
        ctx.textAlign = 'center';
        ctx.fillText('↑↓: 曲選択  Enter: 決定  Esc: 戻る', 640, 500);
    }

    function renderDifficultySelect(ctx) {
        // タイトル描画
        ctx.fillStyle = '#e7e7ee';
        ctx.font = 'bold 36px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('難易度選択', 640, 100);

        // 選択曲表示
        ctx.font = '20px ui-sans-serif, system-ui';
        ctx.fillStyle = '#6be675';
        ctx.fillText(`選択曲: ${songs[selectedSongIndex]}`, 640, 150);

        // 難易度リスト描画
        for (let i = 0; i < difficulties.length; i++) {
            const difficulty = difficulties[i];
            const x = 300 + i * 200;
            const y = 300;
            const isSelected = i === selectedDifficultyIndex;

            if (isSelected) {
                ctx.fillStyle = '#6be675';
                ctx.fillRect(x - 80, y - 25, 160, 50);
            }

            ctx.fillStyle = isSelected ? '#14141a' : '#e7e7ee';
            ctx.font = 'bold 20px ui-sans-serif, system-ui';
            ctx.textAlign = 'center';
            ctx.fillText(difficulty, x, y + 8);
        }

        // 操作説明
        ctx.font = '16px ui-sans-serif, system-ui';
        ctx.fillStyle = '#e7e7ee';
        ctx.fillText('←→: 難易度選択  Enter: ゲーム開始  Esc: 戻る', 640, 500);
    }

    return {
        enter,
        leave,
        update,
        render
    };
}
