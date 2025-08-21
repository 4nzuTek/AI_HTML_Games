// 曲情報を動的に読み込むためのユーティリティ
export class SongLoader {
    constructor() {
        this.songs = [];
        this.isLoaded = false;
    }

    // Songsフォルダから曲情報を動的に読み込む
    async loadSongs() {
        try {
            // 曲フォルダのリストを取得（実際の実装ではサーバーサイドのAPIが必要）
            // ここでは既知の曲リストを使用
            const songFolders = [
                'ペットショップ大戦',
                'ハロー！ハロウィン',
                'いただきバベル (Prod. ケンモチヒデフミ)',
                'ドンカマ2000'
            ];

            console.log('SongLoader: 読み込み開始 - 対象フォルダ:', songFolders);
            this.songs = [];

            for (const folderName of songFolders) {
                try {
                    console.log(`SongLoader: ${folderName} の読み込みを開始`);
                    const songInfo = await this.loadSongInfo(folderName);
                    if (songInfo) {
                        this.songs.push(songInfo);
                        console.log(`SongLoader: ${folderName} の読み込み成功`, songInfo);
                    } else {
                        console.warn(`SongLoader: ${folderName} の読み込み失敗 - songInfoがnull`);
                    }
                } catch (error) {
                    console.error(`SongLoader: 曲の読み込みに失敗: ${folderName}`, error);
                    // エラーの詳細を出力
                    if (error.message) {
                        console.error(`SongLoader: エラーメッセージ: ${error.message}`);
                    }
                    if (error.stack) {
                        console.error(`SongLoader: エラースタック: ${error.stack}`);
                    }
                }
            }

            this.isLoaded = true;
            console.log(`SongLoader: 曲の読み込み完了: ${this.songs.length}曲`, this.songs.map(s => s.folderName));
            return this.songs;
        } catch (error) {
            console.error('SongLoader: 曲の読み込みに失敗:', error);
            return [];
        }
    }

    // 個別の曲情報を読み込む
    async loadSongInfo(folderName) {
        try {
            // URLエンコーディングを適用して日本語ファイル名に対応
            const encodedFolderName = encodeURIComponent(folderName);
            const encodedFileName = encodeURIComponent(folderName);

            const tjaPath = `Songs/${encodedFolderName}/${encodedFileName}.tja`;
            const audioPath = `Songs/${encodedFolderName}/${encodedFileName}.ogg`;

            console.log(`SongLoader: TJAファイル読み込み試行: ${tjaPath}`);
            console.log(`SongLoader: 元のフォルダ名: ${folderName}, エンコード後: ${encodedFolderName}`);

            // TJAファイルを読み込んで基本情報を取得
            const response = await fetch(tjaPath);
            console.log(`SongLoader: レスポンスステータス: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'レスポンステキストを取得できません');
                console.error(`SongLoader: レスポンスエラー詳細:`, {
                    status: response.status,
                    statusText: response.statusText,
                    url: response.url,
                    errorText: errorText.substring(0, 200)
                });
                throw new Error(`TJAファイルが見つかりません: ${tjaPath} (ステータス: ${response.status} ${response.statusText})`);
            }

            const tjaContent = await response.text();
            console.log(`SongLoader: TJAファイル読み込み成功: ${folderName}, サイズ: ${tjaContent.length}文字`);
            console.log(`SongLoader: TJAファイルの最初の100文字:`, tjaContent.substring(0, 100));

            const songInfo = this.parseSongInfo(tjaContent, folderName, tjaPath, audioPath);
            console.log(`SongLoader: 解析結果:`, songInfo);

            return songInfo;
        } catch (error) {
            console.error(`SongLoader: 曲情報の読み込みに失敗: ${folderName}`, error);
            console.error(`SongLoader: エラーの詳細:`, {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            return null;
        }
    }

    // TJAファイルから基本情報を解析
    parseSongInfo(tjaContent, folderName, tjaPath, audioPath) {
        const lines = tjaContent.split('\n');
        let title = folderName;
        let subtitle = '';
        let bpm = 120;
        let offset = 0;
        let courses = {};

        console.log(`SongLoader: TJAファイル解析開始: ${folderName}, 行数: ${lines.length}`);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            // 最初の数行をデバッグ出力
            if (i < 10) {
                console.log(`SongLoader: 行${i + 1}: "${trimmedLine}"`);
            }

            // 文字化けを考慮して、より柔軟な解析を行う
            if (trimmedLine.includes('TITLE:')) {
                const titleMatch = trimmedLine.match(/TITLE:(.+)/);
                if (titleMatch) {
                    title = titleMatch[1].trim();
                    // 文字化けしている場合は、フォルダ名を使用
                    if (title.includes('') || title.length === 0) {
                        title = folderName;
                    }
                }
                console.log(`SongLoader: タイトル検出: "${title}"`);
            } else if (trimmedLine.includes('SUBTITLE:')) {
                const subtitleMatch = trimmedLine.match(/SUBTITLE:(.+)/);
                if (subtitleMatch) {
                    subtitle = subtitleMatch[1].trim();
                }
                console.log(`SongLoader: サブタイトル検出: "${subtitle}"`);
            } else if (trimmedLine.includes('BPM:')) {
                const bpmMatch = trimmedLine.match(/BPM:(\d+(?:\.\d+)?)/);
                if (bpmMatch) {
                    bpm = parseFloat(bpmMatch[1]) || 120;
                }
                console.log(`SongLoader: BPM検出: ${bpm}`);
            } else if (trimmedLine.includes('OFFSET:')) {
                const offsetMatch = trimmedLine.match(/OFFSET:(-?\d+(?:\.\d+)?)/);
                if (offsetMatch) {
                    offset = parseFloat(offsetMatch[1]) || 0;
                }
                console.log(`SongLoader: オフセット検出: ${offset}`);
            } else if (trimmedLine.includes('COURSE:')) {
                const courseMatch = trimmedLine.match(/COURSE:(.+)/);
                if (courseMatch) {
                    const courseName = courseMatch[1].trim();
                    courses[courseName] = { level: 0 };
                    console.log(`SongLoader: コース検出: ${courseName}`);
                }
            } else if (trimmedLine.includes('LEVEL:')) {
                const levelMatch = trimmedLine.match(/LEVEL:(\d+)/);
                if (levelMatch) {
                    const level = parseInt(levelMatch[1]) || 0;
                    const courseNames = Object.keys(courses);
                    if (courseNames.length > 0) {
                        const lastCourse = courseNames[courseNames.length - 1];
                        courses[lastCourse].level = level;
                        console.log(`SongLoader: レベル設定: ${lastCourse} = ${level}`);
                    }
                }
            }
        }

        const result = {
            folderName,
            title,
            subtitle,
            bpm,
            offset,
            courses,
            tjaPath,
            audioPath
        };

        console.log(`SongLoader: 解析完了:`, result);
        return result;
    }

    // 曲リストを取得
    getSongs() {
        return this.songs;
    }

    // 特定の曲を取得
    getSong(folderName) {
        return this.songs.find(song => song.folderName === folderName);
    }

    // 曲が読み込まれているかチェック
    isSongsLoaded() {
        return this.isLoaded;
    }
}
