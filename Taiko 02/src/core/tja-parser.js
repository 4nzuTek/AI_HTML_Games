export function createTjaParser() {
    // ノートタイプ
    const NOTE_TYPES = {
        '0': 'none',
        '1': 'don',    // ドン（赤）
        '2': 'ka',     // カッ（青）
        '3': 'don',    // 大ドン（赤）
        '4': 'ka',     // 大カッ（青）
        '5': 'balloon', // 風船
        '6': 'drumroll', // 連打
        '7': 'drumroll_end', // 連打終了
        '8': 'balloon_end' // 風船終了
    };

    // TJAファイルを解析
    function parseTja(content) {
        const lines = content.split('\n');
        const song = {
            title: '',
            subtitle: '',
            bpm: 120,
            offset: 0,
            wave: '',
            courses: {},
            // ドンカマ2000対応の追加データ
            bpmChanges: [],
            measureChanges: [],
            scrollChanges: [],
            gogoEvents: [],
            barlineEvents: []
        };

        let currentCourse = null;
        let currentNotes = [];
        let measureLength = 4; // デフォルト4拍子
        let currentBpm = song.bpm;
        let currentScroll = 1.0; // デフォルトスクロール速度
        let time = 0;
        let isGogo = false; // GOGO状態
        let barlineVisible = true; // 小節線表示状態

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line.startsWith('TITLE:')) {
                song.title = line.substring(6).trim();
            } else if (line.startsWith('SUBTITLE:')) {
                song.subtitle = line.substring(9).trim();
            } else if (line.startsWith('BPM:')) {
                song.bpm = parseFloat(line.substring(4));
                currentBpm = song.bpm;
                // 初期BPM変化を記録
                song.bpmChanges.push({
                    time: 0,
                    bpm: currentBpm
                });
            } else if (line.startsWith('OFFSET:')) {
                song.offset = parseFloat(line.substring(7));
            } else if (line.startsWith('WAVE:')) {
                song.wave = line.substring(5).trim();
            } else if (line.startsWith('COURSE:')) {
                if (currentCourse) {
                    song.courses[currentCourse.name] = {
                        ...currentCourse,
                        notes: parseNotes(currentNotes, song.bpmChanges, song.measureChanges, song.scrollChanges, song.gogoEvents, song.barlineEvents)
                    };
                }
                currentCourse = {
                    name: line.substring(7).trim(),
                    level: 0,
                    balloon: []
                };
                currentNotes = [];
                time = 0;
                // コース開始時に状態をリセット
                currentBpm = song.bpm;
                currentScroll = 1.0;
                measureLength = 4;
                isGogo = false;
                barlineVisible = true;
            } else if (line.startsWith('LEVEL:')) {
                if (currentCourse) {
                    currentCourse.level = parseInt(line.substring(6));
                }
            } else if (line.startsWith('BALLOON:')) {
                if (currentCourse) {
                    currentCourse.balloon = line.substring(8).split(',').map(x => parseInt(x.trim()));
                }
            } else if (line.startsWith('BPMCHANGE:')) {
                // BPM変更コマンド
                const bpmChange = parseFloat(line.substring(10));
                if (!isNaN(bpmChange) && bpmChange > 0) {
                    currentBpm = bpmChange;
                    song.bpmChanges.push({
                        time: time,
                        bpm: currentBpm
                    });
                    console.log(`TJAパーサー: BPM変更: ${currentBpm} (時間: ${time.toFixed(3)}s)`);
                }
            } else if (line.startsWith('MEASURE:')) {
                // 小節長変更コマンド
                const measureStr = line.substring(8).trim();
                const measureParts = measureStr.split('/');
                if (measureParts.length === 2) {
                    const numerator = parseFloat(measureParts[0]);
                    const denominator = parseFloat(measureParts[1]);
                    if (!isNaN(numerator) && !isNaN(denominator) && denominator > 0) {
                        measureLength = numerator / denominator * 4; // 4/4を基準に変換
                        song.measureChanges.push({
                            time: time,
                            measure: measureLength,
                            original: measureStr
                        });
                        console.log(`TJAパーサー: 小節長変更: ${measureStr} (${measureLength.toFixed(3)}) (時間: ${time.toFixed(3)}s)`);
                    }
                }
            } else if (line.startsWith('SCROLL:')) {
                // スクロール速度変更コマンド
                const scrollSpeed = parseFloat(line.substring(7));
                if (!isNaN(scrollSpeed) && scrollSpeed > 0) {
                    currentScroll = scrollSpeed;
                    song.scrollChanges.push({
                        time: time,
                        scroll: currentScroll
                    });
                    console.log(`TJAパーサー: スクロール速度変更: ${currentScroll} (時間: ${time.toFixed(3)}s)`);
                }
            } else if (line.startsWith('GOGOSTART')) {
                // GOGO開始
                isGogo = true;
                song.gogoEvents.push({
                    time: time,
                    type: 'start'
                });
                console.log(`TJAパーサー: GOGO開始 (時間: ${time.toFixed(3)}s)`);
            } else if (line.startsWith('GOGOEND')) {
                // GOGO終了
                isGogo = false;
                song.gogoEvents.push({
                    time: time,
                    type: 'end'
                });
                console.log(`TJAパーサー: GOGO終了 (時間: ${time.toFixed(3)}s)`);
            } else if (line.startsWith('BARLINEOFF')) {
                // 小節線非表示
                barlineVisible = false;
                song.barlineEvents.push({
                    time: time,
                    visible: false
                });
                console.log(`TJAパーサー: 小節線非表示 (時間: ${time.toFixed(3)}s)`);
            } else if (line.startsWith('BARLINEON')) {
                // 小節線表示
                barlineVisible = true;
                song.barlineEvents.push({
                    time: time,
                    visible: true
                });
                console.log(`TJAパーサー: 小節線表示 (時間: ${time.toFixed(3)}s)`);
            } else if (line.startsWith('#')) {
                // コメント行は無視
            } else if (line.includes(',')) {
                // ノート行
                const parts = line.split(',');
                const notes = parts[0];
                let measure = measureLength; // 現在の小節長を使用

                // 小節長の解析を改善
                if (parts[1]) {
                    const measureStr = parts[1].trim();
                    if (measureStr !== '') {
                        const parsedMeasure = parseFloat(measureStr);
                        if (!isNaN(parsedMeasure) && parsedMeasure > 0) {
                            measure = parsedMeasure;
                        } else {
                            console.warn(`TJAパーサー: 無効な小節長: "${measureStr}", 現在の小節長${measureLength}を使用`);
                        }
                    }
                }

                // 空行の場合は時間のみ進める
                if (notes.length === 0 || notes.trim() === '') {
                    const timeIncrement = (60 / currentBpm) * measure;
                    if (!isNaN(timeIncrement)) {
                        time += timeIncrement;
                    }
                    continue;
                }

                if (notes.length > 0 && notes.trim() !== '') {
                    // 時間計算の安全性チェック
                    if (isNaN(currentBpm) || currentBpm <= 0) {
                        console.warn(`TJAパーサー: 無効なBPM: ${currentBpm}, スキップ`);
                        continue;
                    }

                    const noteTime = (60 / currentBpm) * (measure / notes.length);
                    let addedNotes = 0;

                    // デバッグ情報
                    if (isNaN(time) || isNaN(noteTime)) {
                        console.warn(`TJAパーサー: 時間計算エラー - time: ${time}, noteTime: ${noteTime}, currentBpm: ${currentBpm}, measure: ${measure}, notes.length: ${notes.length}`);
                    }

                    for (let j = 0; j < notes.length; j++) {
                        const noteType = notes[j];
                        if (noteType !== '0' && NOTE_TYPES[noteType]) {
                            // 連打終了や風船終了は通常のノートとして扱わない
                            if (noteType !== '7' && noteType !== '8') {
                                // 連打ノートは通常のドンとして扱う
                                const finalType = noteType === '6' ? 'don' : NOTE_TYPES[noteType];
                                const noteTimeValue = time + j * noteTime;

                                // 時間値の安全性チェック
                                if (!isNaN(noteTimeValue)) {
                                    currentNotes.push({
                                        time: noteTimeValue,
                                        type: finalType,
                                        originalType: noteType,
                                        // ドンカマ2000対応の追加情報
                                        bpm: currentBpm,
                                        scroll: currentScroll,
                                        measure: measure,
                                        isGogo: isGogo,
                                        barlineVisible: barlineVisible
                                    });
                                    addedNotes++;
                                } else {
                                    console.warn(`TJAパーサー: 無効なノート時間: ${noteTimeValue}, スキップ`);
                                }
                            }
                        }
                    }

                    if (addedNotes > 0) {
                        console.log(`TJAパーサー: ノート行処理: "${notes}", 追加ノート数=${addedNotes}, 時間=${time.toFixed(3)}s, BPM=${currentBpm}, スクロール=${currentScroll}, 小節長=${measure.toFixed(3)}`);
                    }

                    const timeIncrement = (60 / currentBpm) * measure;
                    if (!isNaN(timeIncrement)) {
                        time += timeIncrement;
                    } else {
                        console.warn(`TJAパーサー: 無効な時間増分: ${timeIncrement}, スキップ`);
                    }
                }
            }
        }

        // 最後のコースを追加
        if (currentCourse) {
            song.courses[currentCourse.name] = {
                ...currentCourse,
                notes: parseNotes(currentNotes, song.bpmChanges, song.measureChanges, song.scrollChanges, song.gogoEvents, song.barlineEvents)
            };
        }

        // ドンカマ2000対応の統計情報を出力
        console.log(`TJAパーサー: ドンカマ2000対応統計:`);
        console.log(`  BPM変化数: ${song.bpmChanges.length}`);
        console.log(`  小節長変化数: ${song.measureChanges.length}`);
        console.log(`  スクロール変化数: ${song.scrollChanges.length}`);
        console.log(`  GOGOイベント数: ${song.gogoEvents.length}`);
        console.log(`  小節線イベント数: ${song.barlineEvents.length}`);

        return song;
    }

    // ノートを時間順にソート
    function parseNotes(notes, bpmChanges, measureChanges, scrollChanges, gogoEvents, barlineEvents) {
        // 元のノートの詳細情報をログ出力
        const originalTypeStats = {};
        notes.forEach(note => {
            originalTypeStats[note.originalType] = (originalTypeStats[note.originalType] || 0) + 1;
        });
        console.log(`TJAパーサー: 元のノートタイプ統計:`, originalTypeStats);

        const filteredNotes = notes
            .filter(note => note.type !== 'none' && note.type !== 'balloon' && !isNaN(note.time))
            .sort((a, b) => a.time - b.time);

        console.log(`TJAパーサー: 元のノート数=${notes.length}, フィルタ後=${filteredNotes.length}`);
        if (filteredNotes.length > 0) {
            console.log(`TJAパーサー: 最初のノート時間=${filteredNotes[0].time.toFixed(3)}s, 最後のノート時間=${filteredNotes[filteredNotes.length - 1].time.toFixed(3)}s`);

            // ノートタイプの統計
            const typeStats = {};
            filteredNotes.forEach(note => {
                typeStats[note.type] = (typeStats[note.type] || 0) + 1;
            });
            console.log(`TJAパーサー: ノートタイプ統計:`, typeStats);
        } else {
            console.log(`TJAパーサー: 有効なノートが見つかりません`);
        }

        return filteredNotes;
    }

    // ファイルを読み込んで解析
    async function loadTjaFile(url) {
        try {
            const response = await fetch(url);
            const content = await response.text();
            return parseTja(content);
        } catch (error) {
            console.error('TJAファイル読み込みエラー:', error);
            return null;
        }
    }

    return {
        parseTja,
        loadTjaFile
    };
}
