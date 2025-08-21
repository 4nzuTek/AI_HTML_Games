import { SongLoader } from '../core/song-loader.js';

export function createSongSelectScene(gameState, onBack, onSongSelected) {
    let isActive = false;
    let songLoader = new SongLoader();
    let songs = [];
    let isLoading = false;

    async function enter() {
        isActive = true;

        // UI要素の表示/非表示
        document.getElementById('menu').style.display = 'none';
        document.getElementById('songSelect').classList.remove('hidden');

        // 曲の読み込み
        await loadSongs();

        // ボタンイベント設定
        const backBtn = document.getElementById('backBtn');
        backBtn.onclick = onBack;

        // 動的に曲リストを生成
        updateSongList();
    }

    async function loadSongs() {
        if (isLoading) return;

        isLoading = true;
        try {
            songs = await songLoader.loadSongs();
            console.log('曲選択シーン: 曲の読み込み完了', songs);
        } catch (error) {
            console.error('曲選択シーン: 曲の読み込みに失敗', error);
            songs = [];
        } finally {
            isLoading = false;
        }
    }

    function updateSongList() {
        const songListContainer = document.querySelector('.song-list');
        if (!songListContainer) return;

        // 既存の曲リストをクリア
        songListContainer.innerHTML = '';

        if (isLoading) {
            // 読み込み中の表示
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'loading';
            loadingDiv.textContent = '曲を読み込み中...';
            songListContainer.appendChild(loadingDiv);
            return;
        }

        if (songs.length === 0) {
            // 曲が見つからない場合の表示
            const noSongsDiv = document.createElement('div');
            noSongsDiv.className = 'no-songs';
            noSongsDiv.textContent = '曲が見つかりません';
            songListContainer.appendChild(noSongsDiv);
            return;
        }

        // 曲リストを動的に生成
        songs.forEach(song => {
            const songItem = createSongItem(song);
            songListContainer.appendChild(songItem);
        });
    }

    function createSongItem(song) {
        const songItem = document.createElement('div');
        songItem.className = 'song-item';
        songItem.dataset.song = song.folderName;

        // 曲タイトル
        const titleDiv = document.createElement('div');
        titleDiv.className = 'song-title';
        titleDiv.textContent = song.title;
        songItem.appendChild(titleDiv);

        // サブタイトル
        if (song.subtitle && song.subtitle !== '--') {
            const subtitleDiv = document.createElement('div');
            subtitleDiv.className = 'song-subtitle';
            subtitleDiv.textContent = song.subtitle;
            songItem.appendChild(subtitleDiv);
        }

        // 難易度情報
        const difficultyDiv = document.createElement('div');
        difficultyDiv.className = 'song-difficulty';

        // 各難易度のレベルを表示
        const courseOrder = ['Easy', 'Normal', 'Hard', 'Oni'];
        courseOrder.forEach(courseName => {
            if (song.courses[courseName]) {
                const level = song.courses[courseName].level;
                const difficultySpan = document.createElement('span');
                difficultySpan.className = `difficulty ${courseName.toLowerCase()}`;

                let displayName = courseName;
                if (courseName === 'Easy') displayName = '易';
                else if (courseName === 'Normal') displayName = '普';
                else if (courseName === 'Hard') displayName = '難';
                else if (courseName === 'Oni') displayName = '鬼';

                difficultySpan.textContent = `${displayName}: ${level}`;
                difficultyDiv.appendChild(difficultySpan);
            }
        });

        songItem.appendChild(difficultyDiv);

        // クリックイベント
        songItem.onclick = () => {
            selectSong(song);
        };

        return songItem;
    }

    function selectSong(song) {
        const difficulties = Object.keys(song.courses);

        if (difficulties.length === 0) {
            alert('この曲には難易度が設定されていません');
            return;
        }

        // 難易度選択ダイアログ
        let defaultDifficulty = 'Normal';
        if (gameState.selectedDifficulty && song.courses[gameState.selectedDifficulty]) {
            defaultDifficulty = gameState.selectedDifficulty;
        }

        const difficultyOptions = difficulties.map(course => {
            let displayName = course;
            if (course === 'Easy') displayName = '易';
            else if (course === 'Normal') displayName = '普';
            else if (course === 'Hard') displayName = '難';
            else if (course === 'Oni') displayName = '鬼';
            return `${displayName} (${song.courses[course].level})`;
        }).join('\n');

        const difficultyIndex = prompt(
            `${song.title}の難易度を選択してください:\n${difficultyOptions}`,
            difficulties.indexOf(defaultDifficulty) + 1
        );

        const selectedIndex = parseInt(difficultyIndex) - 1;
        if (selectedIndex >= 0 && selectedIndex < difficulties.length) {
            const selectedDifficulty = difficulties[selectedIndex];

            // 選択された難易度を保存
            gameState.selectedDifficulty = selectedDifficulty;
            gameState.selectedSong = song.folderName;
            gameState.selectedSongTjaPath = song.tjaPath;
            gameState.selectedSongAudioPath = song.audioPath;

            localStorage.setItem('taikoLastDifficulty', selectedDifficulty);
            localStorage.setItem('taikoLastSong', song.folderName);

            onSongSelected(song.folderName, selectedDifficulty);
        }
    }

    function leave() {
        isActive = false;

        // イベントリスナーを削除
        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.onclick = null;
        }

        // 動的に生成された曲アイテムのイベントリスナーを削除
        const songItems = document.querySelectorAll('.song-item');
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

        if (isLoading) {
            ctx.fillText('曲を読み込み中...', 640, 150);
        } else if (songs.length === 0) {
            ctx.fillText('曲が見つかりません', 640, 150);
        } else {
            ctx.fillText(`曲をクリックして難易度を選択してください (${songs.length}曲)`, 640, 150);
        }
    }

    return {
        enter,
        leave,
        update,
        render
    };
}
