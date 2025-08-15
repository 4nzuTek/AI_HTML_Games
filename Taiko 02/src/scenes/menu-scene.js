export function createMenuScene(gameState, onSongSelect) {
    let isActive = false;
    let selectedSongIndex = 0;
    let selectedDifficultyIndex = 1; // Normal
    let songs = [];
    let difficulties = ['Easy', 'Normal', 'Hard', 'Oni'];
    let currentState = 'menu'; // 'menu', 'songSelect', 'difficultySelect'

    // 曲の定義（フォルダ名とファイル名のマッピング）
    const songDefinitions = [
        {
            displayName: 'ペットショップ大戦',
            folderName: 'ペットショップ大戦',
            fileName: 'ペットショップ大戦.tja',
            audioFile: 'ペットショップ大戦.ogg'
        },
        {
            displayName: 'いただきバベル',
            folderName: 'いただきバベル (Prod. ケンモチヒデフミ)',
            fileName: 'いただきバベル (Prod. ケンモチヒデフミ).tja',
            audioFile: 'いただきバベル (Prod. ケンモチヒデフミ).ogg'
        },
        {
            displayName: 'ハロー！ハロウィン',
            folderName: 'ハロー！ハロウィン',
            fileName: 'ハロー！ハロウィン.tja',
            audioFile: 'ハロー！ハロウィン.ogg'
        }
    ];

    // 曲名からファイルパスを取得する関数
    function getSongPaths(displayName) {
        const songDef = songDefinitions.find(def => def.displayName === displayName);
        if (songDef) {
            return {
                tjaPath: `Songs/${songDef.folderName}/${songDef.fileName}`,
                audioPath: `Songs/${songDef.folderName}/${songDef.audioFile}`
            };
        }
        return null;
    }

    // 曲リストを動的に読み込み
    async function loadSongs() {
        try {
            // 各曲のTJAファイルの存在を確認
            const availableSongs = [];
            for (const songDef of songDefinitions) {
                try {
                    const response = await fetch(`Songs/${songDef.folderName}/${songDef.fileName}`);
                    if (response.ok) {
                        availableSongs.push(songDef.displayName);
                        console.log(`曲が見つかりました: ${songDef.displayName}`);
                    } else {
                        console.log(`曲が見つかりません: ${songDef.displayName}`);
                    }
                } catch (error) {
                    console.log(`曲の確認中にエラー: ${songDef.displayName}`, error);
                }
            }

            songs = availableSongs;
            console.log('利用可能な曲:', songs);

            // 曲が見つからない場合は固定リストを使用
            if (songs.length === 0) {
                songs = ['ペットショップ大戦'];
                console.log('利用可能な曲がないため、固定リストを使用');
            }
        } catch (error) {
            // エラーの場合は固定リストを使用
            songs = ['ペットショップ大戦', 'いただきバベル', 'ハロー！ハロウィン'];
            console.log('エラーにより固定曲リストを使用:', songs);
        }
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
                currentState = 'songSelect';
            }
        } else if (currentState === 'songSelect') {
            // 曲選択画面
            if (window.Input && window.Input.isPressed('ArrowUp')) {
                selectedSongIndex = (selectedSongIndex - 1 + songs.length) % songs.length;
            } else if (window.Input && window.Input.isPressed('ArrowDown')) {
                selectedSongIndex = (selectedSongIndex + 1) % songs.length;
            } else if (window.Input && window.Input.isPressed('Enter')) {
                currentState = 'difficultySelect';
            } else if (window.Input && window.Input.isPressed('Escape')) {
                currentState = 'menu';
            }
        } else if (currentState === 'difficultySelect') {
            // 難易度選択画面
            if (window.Input && window.Input.isPressed('ArrowLeft')) {
                selectedDifficultyIndex = (selectedDifficultyIndex - 1 + difficulties.length) % difficulties.length;
            } else if (window.Input && window.Input.isPressed('ArrowRight')) {
                selectedDifficultyIndex = (selectedDifficultyIndex + 1) % difficulties.length;
            } else if (window.Input && window.Input.isPressed('Enter')) {
                // ゲーム開始
                gameState.selectedSong = songs[selectedSongIndex];
                gameState.selectedDifficulty = difficulties[selectedDifficultyIndex];

                // 選択された難易度を保存
                localStorage.setItem('taikoLastDifficulty', gameState.selectedDifficulty);

                // ファイルパス情報を追加
                const songPaths = getSongPaths(gameState.selectedSong);
                if (songPaths) {
                    gameState.selectedSongTjaPath = songPaths.tjaPath;
                    gameState.selectedSongAudioPath = songPaths.audioPath;
                }

                console.log(`ゲーム開始: ${gameState.selectedSong} (${gameState.selectedDifficulty})`);
                console.log(`TJAファイル: ${gameState.selectedSongTjaPath}`);
                console.log(`音声ファイル: ${gameState.selectedSongAudioPath}`);
                onSongSelect();
            } else if (window.Input && window.Input.isPressed('Escape')) {
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

        // 曲リスト描画
        for (let i = 0; i < songs.length; i++) {
            const song = songs[i];
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
