export function createInput(win, canvas) {
    const state = new Map();
    const keyStates = new Map(); // キーごとの状態を管理
    const pressedKeys = new Map(); // 各キーの押下状態を管理
    const keyMap = new Map([
        ['KeyF', 'don'],      // ドン（赤）
        ['KeyJ', 'don'],      // ドン（赤）
        ['KeyD', 'ka'],       // カッ（青）
        ['KeyK', 'ka'],       // カッ（青）
        ['Space', 'don'],     // スペースでもドン
        ['Enter', 'Enter'],   // Enterキー
        ['ArrowUp', 'ArrowUp'],     // 上矢印
        ['ArrowDown', 'ArrowDown'], // 下矢印
        ['ArrowLeft', 'ArrowLeft'], // 左矢印
        ['ArrowRight', 'ArrowRight'], // 右矢印
        ['Escape', 'Escape'], // Escapeキー
    ]);

    // キーボードイベント
    win.addEventListener('keydown', (e) => {
        const action = keyMap.get(e.code);
        if (action) {
            keyStates.set(e.code, true);
            state.set(action, true);
            pressedKeys.set(e.code, true);
            e.preventDefault();
        }
    });

    win.addEventListener('keyup', (e) => {
        const action = keyMap.get(e.code);
        if (action) {
            keyStates.set(e.code, false);
            pressedKeys.set(e.code, false);

            // 同じアクションの他のキーが押されているかチェック
            let hasOtherKey = false;
            for (const [keyCode, keyAction] of keyMap) {
                if (keyAction === action && keyCode !== e.code && keyStates.get(keyCode)) {
                    hasOtherKey = true;
                    break;
                }
            }

            // 他のキーが押されていない場合のみアクションをfalseにする
            if (!hasOtherKey) {
                state.set(action, false);
            }
            e.preventDefault();
        }
    });

    // タッチイベント（モバイル対応）
    let touchStartY = 0;
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        touchStartY = touch.clientY;
    });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        const deltaY = touchStartY - touch.clientY;

        // 上から下へのスワイプでドン、下から上へのスワイプでカッ
        if (Math.abs(deltaY) > 50) {
            if (deltaY > 0) {
                state.set('don', true);
                setTimeout(() => state.set('don', false), 50);
            } else {
                state.set('ka', true);
                setTimeout(() => state.set('ka', false), 50);
            }
        }
    });

    return {
        isDown(name) {
            return !!state.get(name);
        },

        isPressed(name) {
            const wasPressed = this._wasPressed || new Map();
            let isPressed = false;

            // 指定されたアクションのキーが新しく押されたかチェック
            for (const [keyCode, keyAction] of keyMap) {
                if (keyAction === name) {
                    const isKeyPressed = pressedKeys.get(keyCode);
                    const wasKeyPressed = wasPressed.get(keyCode);

                    if (isKeyPressed && !wasKeyPressed) {
                        isPressed = true;
                        break;
                    }
                }
            }

            // 現在の状態を保存
            if (!this._wasPressed) this._wasPressed = new Map();
            for (const [keyCode, keyAction] of keyMap) {
                if (keyAction === name) {
                    this._wasPressed.set(keyCode, pressedKeys.get(keyCode) || false);
                }
            }

            return isPressed;
        },

        update() {
            // 入力状態の更新（必要に応じて）
        }
    };
}
