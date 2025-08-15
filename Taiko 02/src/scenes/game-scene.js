export function createGameScene(gameState, Input, Audio, TjaParser, onGameEnd) {
    let isActive = false;
    let songData = null;
    let audioBuffer = null;
    let gameTime = 0;
    let songStartTime = 0;
    let isPlaying = false;
    let notes = [];
    let activeNotes = [];
    let hitNotes = [];
    let missedNotes = [];
    let score = 0;
    let combo = 0;
    let maxCombo = 0;
    let totalNotes = 0;
    let hitCount = 0;
    let perfectCount = 0;
    let goodCount = 0;
    let badCount = 0;
    let missCount = 0;

    // 判定ウィンドウ（カスタム基準）
    const JUDGMENT_WINDOWS = {
        perfect: 0.067, // 良（Perfect）: ±67ms
        good: 0.133,    // 可（Good）: ±133ms
        bad: 0.133 + (0.020) // 不可（Bad）: 可+20ms（調整可能）
    };

    // スコア計算
    const SCORE_VALUES = {
        perfect: 100,
        good: 50,
        bad: 0
    };

    // 太鼓の達人風のレイアウト
    const NOTE_LANE_Y = 500; // 判定ラインのY座標
    const NOTE_RADIUS = 25; // ノートの半径
    const JUDGMENT_RADIUS = 30; // 判定円の半径
    const JUDGMENT_X = 400; // 判定ラインのX座標（画面左寄り）
    const NOTE_SPAWN_X = 1500; // ノート生成位置（画面外右端）
    const BEATS_TO_JUDGMENT = 6; // 生成から判定枠までの拍数

    async function enter() {
        isActive = true;

        // UI要素の非表示
        document.getElementById('menu').style.display = 'none';
        document.getElementById('songSelect').classList.add('hidden');

        // ゲーム状態リセット
        gameTime = 0;
        songStartTime = 0;
        isPlaying = false;
        notes = [];
        activeNotes = [];
        hitNotes = [];
        missedNotes = [];
        score = 0;
        combo = 0;
        maxCombo = 0;
        totalNotes = 0;
        hitCount = 0;
        perfectCount = 0;
        goodCount = 0;
        badCount = 0;
        missCount = 0;

        // 曲データ読み込み
        try {
            // gameStateから正しいファイルパスを取得
            const songPath = gameState.selectedSongTjaPath || `Songs/${gameState.selectedSong}/${gameState.selectedSong}.tja`;
            const audioPath = gameState.selectedSongAudioPath || `Songs/${gameState.selectedSong}/${gameState.selectedSong}.ogg`;

            console.log(`TJAファイル読み込み: ${songPath}`);
            console.log(`音声ファイル読み込み: ${audioPath}`);

            songData = await TjaParser.loadTjaFile(songPath);
            audioBuffer = await Audio.loadSong(audioPath);

            if (songData && audioBuffer) {
                console.log('曲データ読み込み成功:', songData);
                console.log('オフセット:', songData.offset);
                console.log('BPM:', songData.bpm);

                // 選択された難易度のノートを取得
                const course = songData.courses[gameState.selectedDifficulty];
                if (course) {
                    notes = course.notes.map(note => ({
                        ...note,
                        time: note.time, // オフセットは後で適用
                        hit: false,
                        missed: false
                    }));
                    totalNotes = notes.length;
                    console.log(`難易度 ${gameState.selectedDifficulty} のノート数:`, totalNotes);
                }

                // ゲーム開始
                Audio.resume();
                const startDelay = 2; // 2秒の準備時間

                // 6拍分のオーディオ遅延を計算
                const beatsPerSecond = songData.bpm / 60;
                const timeToJudgment = BEATS_TO_JUDGMENT / beatsPerSecond;
                const audioDelay = startDelay + timeToJudgment; // 6拍分の遅延を追加

                // 曲のオフセットを考慮した遅延計算
                const finalAudioDelay = audioDelay + songData.offset; // オフセットを足す

                // オフセットが負の場合は、ノーツ生成も遅らせる必要がある
                const gameStartDelay = songData.offset < 0 ? audioDelay - songData.offset : audioDelay;

                // ゲーム開始時間を設定（オフセットが負の場合はノーツ生成を遅らせる）
                songStartTime = Audio.now() + gameStartDelay;

                // オーディオ再生は曲のオフセットを考慮して遅らせる
                Audio.playSong(audioBuffer, finalAudioDelay);
                isPlaying = true;

                // 最初のノートが生成される時間を計算
                const firstNoteTime = notes[0]?.time || 0;
                const firstNoteSpawnTime = firstNoteTime - timeToJudgment;

                console.log(`ゲーム開始: songStartTime=${songStartTime}, offset=${songData.offset}, BPM=${songData.bpm}`);
                console.log(`譜面データ: 最初のノート時間=${notes[0]?.time.toFixed(3)}s, 最後のノート時間=${notes[notes.length - 1]?.time.toFixed(3)}s, 総ノート数=${notes.length}`);
                console.log(`6拍の時間: ${timeToJudgment.toFixed(3)}s`);
                console.log(`オーディオ遅延時間: ${audioDelay.toFixed(3)}s (準備時間: ${startDelay}s + 6拍分: ${timeToJudgment.toFixed(3)}s)`);
                console.log(`曲オフセット適用後のオーディオ遅延: ${finalAudioDelay.toFixed(3)}s (元の遅延: ${audioDelay.toFixed(3)}s + オフセット: ${songData.offset.toFixed(3)}s)`);
                console.log(`ゲーム開始遅延: ${gameStartDelay.toFixed(3)}s (オフセットが負の場合はノーツ生成も遅延)`);

                // 譜面データの詳細をログ出力
                if (notes.length > 0) {
                    console.log(`最初の5つのノート:`, notes.slice(0, 5).map(n => ({ type: n.type, time: n.time.toFixed(3) })));
                    console.log(`最後の5つのノート:`, notes.slice(-5).map(n => ({ type: n.type, time: n.time.toFixed(3) })));
                }

                console.log(`最初のノート生成時間: ${firstNoteSpawnTime.toFixed(3)}s, 最初のノート到着時間: ${firstNoteTime.toFixed(3)}s`);


            }
        } catch (error) {
            console.error('曲の読み込みに失敗:', error);
            alert('曲の読み込みに失敗しました');
            onGameEnd();
        }
    }

    function leave() {
        isActive = false;
        isPlaying = false;
    }

    function update(dt) {
        if (!isPlaying) return;

        gameTime = Audio.now() - songStartTime;

        // オフセットを適用した実際のゲーム時間
        const adjustedGameTime = gameTime - songData.offset;

        // デバッグ: 最初の数秒間のみログ出力
        if (gameTime < 5 && gameTime > 0) {
            // console.log(`時間更新: gameTime=${gameTime.toFixed(3)}s, adjustedGameTime=${adjustedGameTime.toFixed(3)}s, offset=${songData.offset}`);
        }

        // ノートの更新
        updateNotes(adjustedGameTime);

        // 入力判定
        updateInput(adjustedGameTime);

        // 判定表示の更新
        updateJudgments(dt);

        // ゲーム終了判定
        if (gameTime > 120 && activeNotes.length === 0) {
            endGame();
        }
    }

    function updateNotes(adjustedGameTime) {
        // ユーザー設定のオフセットを適用
        const userOffset = (gameState.noteOffset || 0) / 1000; // ミリ秒を秒に変換
        const adjustedTimeWithOffset = adjustedGameTime + userOffset;

        // 新しいノートをアクティブに追加
        for (let i = 0; i < notes.length; i++) {
            const note = notes[i];
            if (!note.hit && !note.missed && !activeNotes.includes(note)) {
                // 拍数ベースでノートの流れを制御
                const beatsPerSecond = songData.bpm / 60;
                const timeToJudgment = BEATS_TO_JUDGMENT / beatsPerSecond;
                const noteArrivalTime = note.time;
                const noteSpawnTime = noteArrivalTime - timeToJudgment; // ノートが生成される時間

                // ノートが生成される時間からアクティブにする（時間順に順番に生成）
                // ノートが生成される時間からアクティブにする（時間順に順番に生成）
                // 現在の時間がノート生成時間に達した時のみ生成
                if (adjustedTimeWithOffset >= noteSpawnTime && adjustedTimeWithOffset < noteSpawnTime + 0.1 && !activeNotes.includes(note)) {
                    activeNotes.push(note);
                    // console.log(`ノート生成: ${note.type}, 譜面時間: ${note.time.toFixed(3)}s, 生成時間: ${noteSpawnTime.toFixed(3)}s, 到着時間: ${noteArrivalTime.toFixed(3)}s, 現在時間: ${adjustedTimeWithOffset.toFixed(3)}s, 6拍時間: ${timeToJudgment.toFixed(3)}s`);
                }
            }
        }

        // ミスしたノートを処理（不可ヒット済みのノーツは除外）
        for (let i = activeNotes.length - 1; i >= 0; i--) {
            const note = activeNotes[i];
            const beatsPerSecond = songData.bpm / 60;
            const timeToJudgment = BEATS_TO_JUDGMENT / beatsPerSecond;
            const noteArrivalTime = note.time;

            // 不可ヒット済みのノーツはミス判定から除外
            if (note.badHit) continue;

            // 判定枠を通過してから一定時間後にミスとする
            if (adjustedTimeWithOffset > noteArrivalTime + JUDGMENT_WINDOWS.bad) {
                // 遅くの方の不可ヒットもノーツを残す
                note.badHit = true; // 不可ヒット済みフラグを設定
                missedNotes.push({
                    note: note,
                    time: adjustedGameTime,
                    type: 'miss'
                });
                // activeNotesから削除しない（見た目用に残す）
                combo = 0;
                missCount++;

                // ミス判定が出た時にヒット判定をクリア
                hitNotes = [];

                updateAccuracy();
            }
        }
    }

    function updateInput(adjustedGameTime) {
        // ドン判定（1回の入力で1回のみ判定）
        if (Input.isPressed('don')) {
            checkNoteHit('don', adjustedGameTime);
            return; // 1回の入力で1つのアクションのみ処理
        }

        // カッ判定（1回の入力で1回のみ判定）
        if (Input.isPressed('ka')) {
            checkNoteHit('ka', adjustedGameTime);
            return; // 1回の入力で1つのアクションのみ処理
        }
    }

    function checkNoteHit(inputType, adjustedGameTime) {
        let bestNote = null;
        let bestTimeDiff = Infinity;

        // ユーザー設定のオフセットを適用
        const userOffset = (gameState.noteOffset || 0) / 1000; // ミリ秒を秒に変換
        const adjustedTimeWithOffset = adjustedGameTime + userOffset;

        // 判定対象のノートを取得（ヒット済み・ミス済み・不可ヒット済みを除外）
        const judgmentNotes = activeNotes.filter(note => !note.hit && !note.missed && !note.badHit);

        // 判定枠に到着するタイミングを基準に判定
        // 最も近いノーツ1つのみを選択（タイプに関係なく）
        for (let i = 0; i < judgmentNotes.length; i++) {
            const note = judgmentNotes[i];
            const beatsPerSecond = songData.bpm / 60;
            const timeToJudgment = BEATS_TO_JUDGMENT / beatsPerSecond;
            const noteArrivalTime = note.time;
            const timeDiff = Math.abs(noteArrivalTime - adjustedTimeWithOffset);

            // より近いノーツが見つかった場合のみ更新
            if (timeDiff < bestTimeDiff) {
                bestTimeDiff = timeDiff;
                bestNote = note;
            }
        }

        // デバッグ: 判定対象ノートの情報
        if (bestNote) {
            console.log(`判定対象: ${bestNote.type}, 譜面時間: ${bestNote.time.toFixed(3)}s, 時間差: ${(bestTimeDiff * 1000).toFixed(1)}ms, ヒット済み: ${bestNote.hit}, ミス済み: ${bestNote.missed}`);
        }

        // 既に判定済みのノーツがある場合は処理をスキップ
        if (!bestNote) {
            // 空打ち
            combo = 0;
            console.log(`空打ち: ${inputType}, ゲーム時間: ${adjustedGameTime.toFixed(3)}s, オフセット: ${userOffset.toFixed(3)}s`);
            return;
        }

        // 最も近いノーツ1つのみを判定
        if (bestNote && bestTimeDiff <= JUDGMENT_WINDOWS.bad) {
            // 判定
            let judgment = 'bad';
            if (bestTimeDiff <= JUDGMENT_WINDOWS.perfect) {
                judgment = 'perfect';
                perfectCount++;
                console.log(`良判定: 時間差 ${(bestTimeDiff * 1000).toFixed(1)}ms`);
            } else if (bestTimeDiff <= JUDGMENT_WINDOWS.good) {
                judgment = 'good';
                goodCount++;
                console.log(`可判定: 時間差 ${(bestTimeDiff * 1000).toFixed(1)}ms`);
            } else {
                judgment = 'bad';
                badCount++;
                console.log(`不可判定: 時間差 ${(bestTimeDiff * 1000).toFixed(1)}ms`);
            }

            // 不可判定の場合はノーツを削除せず、見た目のみの役割にする
            if (judgment === 'bad') {
                // 不可判定の場合はノーツを削除せず、見た目のみの役割にする
                bestNote.badHit = true; // 不可ヒット済みフラグを設定
                console.log(`不可判定: ノーツを削除せず見た目のみの役割に, 時間差: ${(bestTimeDiff * 1000).toFixed(1)}ms, 譜面時間: ${bestNote.time.toFixed(3)}s`);
            } else {
                // 良・可判定の場合は通常通りノーツを削除
                bestNote.hit = true;
                const beforeCount = activeNotes.length;
                const noteIndex = activeNotes.indexOf(bestNote);
                if (noteIndex !== -1) {
                    activeNotes.splice(noteIndex, 1);
                    console.log(`ノート削除成功: ${beforeCount} -> ${activeNotes.length}, 判定: ${judgment}, 時間差: ${(bestTimeDiff * 1000).toFixed(1)}ms, 譜面時間: ${bestNote.time.toFixed(3)}s`);
                } else {
                    console.log(`ノート削除失敗: ノートが見つかりません, 判定: ${judgment}, 時間差: ${(bestTimeDiff * 1000).toFixed(1)}ms, 譜面時間: ${bestNote.time.toFixed(3)}s`);
                }
            }

            // スコアとコンボ更新
            score += SCORE_VALUES[judgment];
            combo++;
            if (combo > maxCombo) maxCombo = combo;
            hitCount++;

            // 判定表示（前の判定を消して新しい判定のみ表示）
            hitNotes = [{
                note: bestNote,
                time: adjustedGameTime,
                type: judgment,
                timeDiff: bestTimeDiff * 1000 // ミリ秒単位で保存
            }];

            // ヒット判定が出た時にミス判定をクリア
            missedNotes = [];

            // 効果音再生（無効化）
            // if (inputType === 'don') {
            //     Audio.playDon();
            // } else {
            //     Audio.playKa();
            // }

            updateAccuracy();

            // デバッグ情報
            const beatsPerSecond = songData.bpm / 60;
            const timeToJudgment = BEATS_TO_JUDGMENT / beatsPerSecond;
            const noteArrivalTime = bestNote.time;
            console.log(`判定: ${judgment}, 譜面時間: ${bestNote.time.toFixed(3)}s, 時間差: ${(bestTimeDiff * 1000).toFixed(1)}ms, 判定枠: 良±${(JUDGMENT_WINDOWS.perfect * 1000).toFixed(1)}ms, 可±${(JUDGMENT_WINDOWS.good * 1000).toFixed(1)}ms, ノート到着時間: ${noteArrivalTime.toFixed(3)}s, ゲーム時間: ${adjustedGameTime.toFixed(3)}s, オフセット: ${userOffset.toFixed(3)}s`);
        } else {
            // 判定範囲外（空打ち）
            combo = 0;
            if (bestNote) {
                console.log(`判定範囲外: ${inputType}, 時間差: ${(bestTimeDiff * 1000).toFixed(1)}ms, 判定枠: 可±${(JUDGMENT_WINDOWS.good * 1000).toFixed(1)}ms, ゲーム時間: ${adjustedGameTime.toFixed(3)}s, オフセット: ${userOffset.toFixed(3)}s`);
            } else {
                console.log(`判定範囲外: ${inputType}, 対象ノーツなし, ゲーム時間: ${adjustedGameTime.toFixed(3)}s, オフセット: ${userOffset.toFixed(3)}s`);
            }
        }
    }

    function updateJudgments(dt) {
        // 古い判定表示を削除
        hitNotes = hitNotes.filter(hit => gameTime - hit.time < 1.0);
        missedNotes = missedNotes.filter(miss => gameTime - miss.time < 1.0);
    }

    function updateAccuracy() {
        const total = perfectCount + goodCount + badCount + missCount;
        if (total > 0) {
            const accuracy = ((perfectCount + goodCount) / total) * 100;
            gameState.accuracy = Math.round(accuracy);
        }
        gameState.score = score;
        gameState.combo = combo;
    }

    function endGame() {
        isPlaying = false;

        // 結果表示（カスタム基準）
        const accuracy = totalNotes > 0 ? Math.round((hitCount / totalNotes) * 100) : 0;
        const result = `ゲーム終了!\n\nスコア: ${score}\n最大コンボ: ${maxCombo}\n精度: ${accuracy}%\n\n良: ${perfectCount}\n可: ${goodCount}\n不可: ${badCount}\nMISS: ${missCount}`;

        alert(result);
        onGameEnd();
    }

    function render(ctx) {
        // 背景描画
        ctx.fillStyle = '#14141a';
        ctx.fillRect(0, 0, 1280, 720);

        // オフセット適用後のゲーム時間
        const adjustedGameTime = gameTime - (songData ? songData.offset : 0);

        // 判定円の描画（太鼓の達人風）
        ctx.strokeStyle = '#e7e7ee';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(JUDGMENT_X, NOTE_LANE_Y, JUDGMENT_RADIUS, 0, Math.PI * 2);
        ctx.stroke();

        // ノート描画（右から左に流れる）- 新しいノートから描画（奥）（不可ヒット済みも含む）
        const sortedNotes = [...activeNotes].filter(note => !note.hit && !note.missed).sort((a, b) => b.time - a.time);
        for (let i = 0; i < sortedNotes.length; i++) {
            const note = sortedNotes[i];

            // ユーザー設定のオフセットを適用
            const userOffset = (gameState.noteOffset || 0) / 1000; // ミリ秒を秒に変換
            const adjustedTimeWithOffset = adjustedGameTime + userOffset;

            // 拍数ベースでノートの位置を計算
            const beatsPerSecond = songData.bpm / 60;
            const timeToJudgment = BEATS_TO_JUDGMENT / beatsPerSecond;
            const timeUntilArrival = note.time - adjustedTimeWithOffset;

            let noteX;
            if (timeUntilArrival > timeToJudgment) {
                // まだ生成されていない
                noteX = NOTE_SPAWN_X;
            } else if (timeUntilArrival > 0) {
                // 判定枠に向かって移動中
                const progress = 1 - (timeUntilArrival / timeToJudgment);
                noteX = NOTE_SPAWN_X + (JUDGMENT_X - NOTE_SPAWN_X) * progress;
            } else {
                // 判定枠を通過して左に流れ続ける（元の速度を維持）
                const passedTime = Math.abs(timeUntilArrival);
                const originalSpeed = (NOTE_SPAWN_X - JUDGMENT_X) / timeToJudgment; // 元の速度を計算
                const passedDistance = passedTime * originalSpeed;
                noteX = JUDGMENT_X - passedDistance;

                // 判定枠到着の瞬間をログ出力（最初の1回のみ）
                if (timeUntilArrival > -0.016 && !note.arrivalLogged) { // 16ms以内の初回のみ
                    console.log(`判定枠到着: ${note.type}, 譜面時間: ${note.time.toFixed(3)}s, ゲーム時間: ${adjustedTimeWithOffset.toFixed(3)}s, 座標: ${noteX.toFixed(0)}px, 時間差: ${timeUntilArrival.toFixed(3)}s`);
                    note.arrivalLogged = true;
                }
            }

            if (noteX >= -50 && noteX <= 1600) {
                // ノートの色
                ctx.fillStyle = note.type === 'don' ? '#ff6b6b' : '#4ecdc4';

                // 円形のノートを描画
                ctx.beginPath();
                ctx.arc(noteX, NOTE_LANE_Y, NOTE_RADIUS, 0, Math.PI * 2);
                ctx.fill();

                // ノートの枠線
                ctx.strokeStyle = '#e7e7ee';
                ctx.lineWidth = 2;
                ctx.stroke();

                // ノートの種類を表示
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 16px ui-sans-serif, system-ui';
                ctx.textAlign = 'center';
                ctx.fillText(note.type === 'don' ? 'ドン' : 'カッ', noteX, NOTE_LANE_Y + 5);
            }
        }

        // デバッグ: アクティブノートの情報表示
        if (activeNotes.length > 0) {
            ctx.fillStyle = '#ffff00';
            ctx.font = '12px ui-sans-serif, system-ui';
            ctx.textAlign = 'left';
            ctx.fillText(`アクティブノート数: ${activeNotes.length}`, 20, 160);

            for (let i = 0; i < Math.min(activeNotes.length, 3); i++) {
                const note = activeNotes[i];
                const userOffset = (gameState.noteOffset || 0) / 1000;
                const adjustedTimeWithOffset = adjustedGameTime + userOffset;
                const beatsPerSecond = songData.bpm / 60;
                const timeToJudgment = BEATS_TO_JUDGMENT / beatsPerSecond;
                const noteArrivalTime = note.time;
                const timeUntilArrival = note.time - adjustedTimeWithOffset;

                let debugNoteX;
                if (timeUntilArrival > timeToJudgment) {
                    debugNoteX = NOTE_SPAWN_X;
                } else if (timeUntilArrival > 0) {
                    const progress = 1 - (timeUntilArrival / timeToJudgment);
                    debugNoteX = NOTE_SPAWN_X + (JUDGMENT_X - NOTE_SPAWN_X) * progress;
                } else {
                    const passedTime = Math.abs(timeUntilArrival);
                    const originalSpeed = (NOTE_SPAWN_X - JUDGMENT_X) / timeToJudgment; // 元の速度を計算
                    const passedDistance = passedTime * originalSpeed;
                    debugNoteX = JUDGMENT_X - passedDistance;
                }

                ctx.fillText(`ノート${i + 1}: ${note.type}, 到着時間: ${noteArrivalTime.toFixed(2)}s, X位置: ${debugNoteX.toFixed(0)}px, 残り時間: ${timeUntilArrival.toFixed(2)}s`, 20, 180 + i * 15);
            }
        }

        // 判定表示
        renderJudgments(ctx);

        // ゲーム情報表示
        renderGameInfo(ctx, adjustedGameTime);

        // 操作説明
        renderControls(ctx);
    }

    function renderJudgments(ctx) {
        const judgmentY = NOTE_LANE_Y - 80;

        // ヒット判定（最新の判定が手前に表示されるように逆順で描画）
        for (let i = hitNotes.length - 1; i >= 0; i--) {
            const hit = hitNotes[i];
            const age = gameTime - hit.time;
            if (age < 1.0) {
                const alpha = 1.0 - age;
                const y = judgmentY - age * 30;

                // 判定テキストと色を設定
                let judgmentText;
                let fillStyle;
                let strokeStyle = '#000000'; // 黒い縁取り

                switch (hit.type) {
                    case 'perfect':
                        judgmentText = '良';
                        // 黄色からオレンジのグラデーション
                        const perfectGradient = ctx.createLinearGradient(JUDGMENT_X - 20, y - 20, JUDGMENT_X - 20, y + 20);
                        perfectGradient.addColorStop(0, '#FFD700'); // 明るい黄色
                        perfectGradient.addColorStop(1, '#FFA500'); // オレンジ
                        fillStyle = perfectGradient;
                        break;
                    case 'good':
                        judgmentText = '可';
                        fillStyle = '#FFFFFF'; // 白色
                        break;
                    case 'bad':
                        judgmentText = '不可';
                        // 青からシアンのグラデーション
                        const badGradient = ctx.createLinearGradient(JUDGMENT_X - 20, y - 20, JUDGMENT_X - 20, y + 20);
                        badGradient.addColorStop(0, '#0066CC'); // 濃い青
                        badGradient.addColorStop(1, '#00CCFF'); // シアン
                        fillStyle = badGradient;
                        break;
                    default:
                        judgmentText = hit.type.toUpperCase();
                        fillStyle = '#4ecdc4';
                }

                ctx.globalAlpha = alpha;
                ctx.font = 'bold 32px ui-sans-serif, system-ui';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                // 縁取りを描画
                ctx.strokeStyle = strokeStyle;
                ctx.lineWidth = 3;
                ctx.strokeText(judgmentText, JUDGMENT_X, y);

                // 文字を描画
                ctx.fillStyle = fillStyle;
                ctx.fillText(judgmentText, JUDGMENT_X, y);

                // 時間差の情報を表示
                if (hit.timeDiff !== undefined) {
                    const sign = hit.timeDiff >= 0 ? '+' : '';
                    ctx.font = 'bold 16px ui-sans-serif, system-ui';
                    ctx.fillStyle = '#FFFFFF';
                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = 1;
                    ctx.strokeText(`${sign}${hit.timeDiff.toFixed(0)}ms`, JUDGMENT_X, y + 25);
                    ctx.fillText(`${sign}${hit.timeDiff.toFixed(0)}ms`, JUDGMENT_X, y + 25);
                }

                ctx.globalAlpha = 1.0;
            }
        }

        // ミス判定（最新の判定が手前に表示されるように逆順で描画）
        for (let i = missedNotes.length - 1; i >= 0; i--) {
            const miss = missedNotes[i];
            const age = gameTime - miss.time;
            if (age < 1.0) {
                const alpha = 1.0 - age;
                const y = judgmentY - age * 30;

                ctx.globalAlpha = alpha;
                ctx.font = 'bold 32px ui-sans-serif, system-ui';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                // 縁取りを描画
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 3;
                ctx.strokeText('不可', JUDGMENT_X, y);

                // 文字を描画（青からシアンのグラデーション）
                const missGradient = ctx.createLinearGradient(JUDGMENT_X - 20, y - 20, JUDGMENT_X - 20, y + 20);
                missGradient.addColorStop(0, '#0066CC'); // 濃い青
                missGradient.addColorStop(1, '#00CCFF'); // シアン
                ctx.fillStyle = missGradient;
                ctx.fillText('不可', JUDGMENT_X, y);

                ctx.globalAlpha = 1.0;
            }
        }
    }

    function renderGameInfo(ctx, adjustedGameTime) {
        // スコア表示
        ctx.fillStyle = '#e7e7ee';
        ctx.font = 'bold 24px ui-sans-serif, system-ui';
        ctx.textAlign = 'left';
        ctx.fillText(`スコア: ${score}`, 20, 40);

        // コンボ表示
        if (combo > 0) {
            ctx.fillStyle = '#6be675';
            ctx.font = 'bold 32px ui-sans-serif, system-ui';
            ctx.textAlign = 'center';
            ctx.fillText(`${combo} COMBO`, 640, 100);
        }

        // 精度表示
        ctx.fillStyle = '#e7e7ee';
        ctx.font = '18px ui-sans-serif, system-ui';
        ctx.textAlign = 'right';
        ctx.fillText(`精度: ${gameState.accuracy}%`, 1260, 40);

        // 残りノート数
        ctx.textAlign = 'right';
        ctx.fillText(`残り: ${activeNotes.length}`, 1260, 70);

        // デバッグ情報
        if (songData) {
            ctx.fillStyle = '#ffff00';
            ctx.font = '14px ui-sans-serif, system-ui';
            ctx.textAlign = 'left';
            ctx.fillText(`ゲーム時間: ${gameTime.toFixed(2)}s`, 20, 80);
            ctx.fillText(`調整時間: ${adjustedGameTime.toFixed(2)}s`, 20, 100);
            ctx.fillText(`オフセット: ${songData.offset}s`, 20, 120);
            ctx.fillText(`BPM: ${songData.bpm}`, 20, 140);
            ctx.fillText(`ユーザーオフセット: ${(gameState.noteOffset || 0)}ms`, 20, 160);

            // 拍数計算のデバッグ
            const beatsPerSecond = songData.bpm / 60;
            const timeToJudgment = BEATS_TO_JUDGMENT / beatsPerSecond;
            ctx.fillText(`6拍の時間: ${timeToJudgment.toFixed(3)}s`, 20, 180);
        }
    }

    function renderControls(ctx) {
        // 操作説明
        ctx.fillStyle = '#e7e7ee';
        ctx.font = '16px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('D/F: ドン（赤）  J/K: カッ（青）', 640, 680);
    }

    return {
        enter,
        leave,
        update,
        render
    };
}