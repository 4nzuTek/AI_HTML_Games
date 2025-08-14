// 画面管理クラス
class ScreenManager {
    constructor() {
        this.currentScreen = 'title';
        this.initializeScreenNavigation();
    }

    // 画面遷移の初期化
    initializeScreenNavigation() {
        // タイトル画面から各画面への遷移
        document.getElementById('challengeMenuBtn').addEventListener('click', () => {
            this.showScreen('challenge');
        });

        document.getElementById('randomMenuBtn').addEventListener('click', () => {
            this.showScreen('random');
        });

        document.getElementById('shopMenuBtn').addEventListener('click', () => {
            this.showScreen('shop');
        });

        // 各画面からタイトルへの戻るボタン
        document.getElementById('backToTitleBtn').addEventListener('click', () => {
            this.showScreen('title');
        });

        document.getElementById('backToTitleBtn2').addEventListener('click', () => {
            this.showScreen('title');
        });

        document.getElementById('backToTitleBtn3').addEventListener('click', () => {
            this.showScreen('title');
        });
    }

    // 画面表示切り替え
    showScreen(screenName) {
        // すべての画面を非表示
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // 指定された画面を表示
        document.getElementById(screenName + 'Screen').classList.add('active');
        this.currentScreen = screenName;
    }
}

// ゲーム状態管理
class GameState {
    constructor() {
        this.currentX = 0;
        this.currentY = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.handCount = 5;
        this.maxHand = 5;
        this.gameMode = 'challenge'; // 'challenge' または 'random'
        this.isGameActive = false;
        this.usedFunctions = [];
        this.ownedFunctions = [];
        this.currentFilter = 'all';
    }

    // 座標の距離を計算
    calculateDistance() {
        return Math.sqrt(Math.pow(this.targetX - this.currentX, 2) + Math.pow(this.targetY - this.currentY, 2));
    }

    // 完全一致判定
    isExactMatch() {
        return this.currentX === this.targetX && this.currentY === this.targetY;
    }

    // 関数を適用
    applyFunction(func) {
        if (this.handCount <= 0) {
            return false;
        }

        // X座標の計算
        let newX = this.currentX;
        switch (func.xOperator) {
            case '+':
                newX += func.xValue;
                break;
            case '-':
                newX -= func.xValue;
                break;
            case '*':
                newX *= func.xValue;
                break;
            case '/':
                newX = Math.round(newX / func.xValue);
                break;
            case '^':
                newX = Math.round(Math.pow(newX, func.xValue));
                break;
        }

        // Y座標の計算
        let newY = this.currentY;
        switch (func.yOperator) {
            case '+':
                newY += func.yValue;
                break;
            case '-':
                newY -= func.yValue;
                break;
            case '*':
                newY *= func.yValue;
                break;
            case '/':
                newY = Math.round(newY / func.yValue);
                break;
            case '^':
                newY = Math.round(Math.pow(newY, func.yValue));
                break;
        }

        this.currentX = newX;
        this.currentY = newY;
        this.handCount--;

        // 使用した関数を移動
        this.usedFunctions.push(func);
        this.ownedFunctions = this.ownedFunctions.filter(f => f.id !== func.id);

        return true;
    }

    // ゲームリセット
    reset() {
        this.currentX = 0;
        this.currentY = 0;
        this.handCount = this.maxHand;
        this.usedFunctions = [];
        this.isGameActive = false;
    }

    // フィルター適用
    getFilteredFunctions() {
        return this.ownedFunctions;
    }

    // X系関数を取得
    getXFunctions() {
        return this.ownedFunctions;
    }

    // Y系関数を取得
    getYFunctions() {
        return this.ownedFunctions;
    }
}

// 関数クラス
class Function {
    constructor(id, xOperator, xValue, yOperator, yValue, rarity = 'common') {
        this.id = id;
        this.xOperator = xOperator;
        this.xValue = xValue;
        this.yOperator = yOperator;
        this.yValue = yValue;
        this.rarity = rarity; // 'common', 'rare', 'epic', 'legendary'
    }

    // 関数の文字列表現を取得
    getDisplayText() {
        const xText = `X${this.xOperator} ${this.xValue}`;
        const yText = `Y${this.yOperator} ${this.yValue}`;
        return `${xText} , ${yText}`;
    }

    // HTML表示用の文字列を取得
    getHTMLText() {
        const xText = `<span class="x-coord">X</span><span class="operator">${this.xOperator}</span> ${this.xValue}`;
        const yText = `<span class="y-coord">Y</span><span class="operator">${this.yOperator}</span> ${this.yValue}`;
        return `${xText} , ${yText}`;
    }

    // X系関数の表示用文字列
    getXDisplayText() {
        return `X${this.xOperator} ${this.xValue}`;
    }

    // Y系関数の表示用文字列
    getYDisplayText() {
        return `Y${this.yOperator} ${this.yValue}`;
    }
}

// ゲーム管理クラス
class GameManager {
    constructor(gameMode, elementIds) {
        this.gameState = new GameState();
        this.gameState.gameMode = gameMode;
        this.elementIds = elementIds;
        this.initializeEventListeners();
        this.generateFunctions();
        this.updateDisplay();
    }

    // イベントリスナーの初期化
    initializeEventListeners() {
        // ゲーム開始
        document.getElementById(this.elementIds.startBtn).addEventListener('click', () => {
            this.startGame();
        });

        // リスタート
        document.getElementById(this.elementIds.restartBtn).addEventListener('click', () => {
            this.restartGame();
        });
    }

    // 関数生成
    generateFunctions() {
        const operators = ['+', '-', '*', '/', '^'];
        const values = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        const rarities = ['common', 'rare', 'epic', 'legendary'];

        this.gameState.ownedFunctions = [];

        // より多くの関数を生成（100個程度）
        for (let i = 0; i < 100; i++) {
            const xOperator = operators[Math.floor(Math.random() * operators.length)];
            const yOperator = operators[Math.floor(Math.random() * operators.length)];
            const xValue = values[Math.floor(Math.random() * values.length)];
            const yValue = values[Math.floor(Math.random() * values.length)];
            const rarity = rarities[Math.floor(Math.random() * rarities.length)];

            const func = new Function(i, xOperator, xValue, yOperator, yValue, rarity);
            this.gameState.ownedFunctions.push(func);
        }
    }

    // ターゲット座標生成
    generateTarget() {
        if (this.gameState.gameMode === 'challenge') {
            // チャレンジモード：固定ターゲット（段階的に難しく）
            const stage = Math.floor(Math.random() * 5) + 1;
            this.gameState.targetX = (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * stage * 10);
            this.gameState.targetY = (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * stage * 10);
        } else {
            // ランダムハントモード：ランダムターゲット
            this.gameState.targetX = (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 50);
            this.gameState.targetY = (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 50);
        }
    }

    // ゲーム開始
    startGame() {
        this.gameState.reset();
        this.generateTarget();
        this.generateFunctions();
        this.gameState.isGameActive = true;
        this.updateDisplay();
        this.renderUsedFunctionCards();
        this.renderOwnedFunctionCards();
    }

    // ゲーム終了
    endGame() {
        this.gameState.isGameActive = false;
        this.showResult();
    }

    // 使用した関数カードのレンダリング
    renderUsedFunctionCards() {
        const container = document.getElementById(this.elementIds.usedFunctionCards);
        container.innerHTML = '';

        this.gameState.usedFunctions.forEach(func => {
            const card = document.createElement('div');
            card.className = 'function-card used';
            card.innerHTML = `
                <div class="function-text">${func.getXDisplayText()}</div>
                <div class="function-text">${func.getYDisplayText()}</div>
                <div class="rarity">${this.getRarityText(func.rarity)}</div>
            `;
            container.appendChild(card);
        });
    }

    // 所持関数カードのレンダリング
    renderOwnedFunctionCards() {
        const container = document.getElementById(this.elementIds.ownedFunctionCards);
        container.innerHTML = '';

        // 関数をソート：記号順、その中でも数値順
        const sortedFunctions = [...this.gameState.ownedFunctions].sort((a, b) => {
            // まずX演算子で比較
            const xOperatorOrder = { '+': 1, '-': 2, '*': 3, '/': 4, '^': 5 };
            const xOrderA = xOperatorOrder[a.xOperator] || 0;
            const xOrderB = xOperatorOrder[b.xOperator] || 0;

            if (xOrderA !== xOrderB) {
                return xOrderA - xOrderB;
            }

            // X演算子が同じ場合はX値で比較
            if (a.xValue !== b.xValue) {
                return a.xValue - b.xValue;
            }

            // Xが同じ場合はY演算子で比較
            const yOrderA = xOperatorOrder[a.yOperator] || 0;
            const yOrderB = xOperatorOrder[b.yOperator] || 0;

            if (yOrderA !== yOrderB) {
                return yOrderA - yOrderB;
            }

            // Y演算子も同じ場合はY値で比較
            return a.yValue - b.yValue;
        });

        sortedFunctions.forEach(func => {
            const card = document.createElement('div');
            card.className = 'function-card';
            card.innerHTML = `
                <div class="function-text">${func.getXDisplayText()}</div>
                <div class="function-text">${func.getYDisplayText()}</div>
                <div class="rarity">${this.getRarityText(func.rarity)}</div>
            `;

            card.addEventListener('click', () => {
                if (this.gameState.isGameActive) {
                    this.useFunction(func);
                }
            });

            container.appendChild(card);
        });
    }

    // レアリティのテキスト取得
    getRarityText(rarity) {
        const rarityTexts = {
            'common': 'コモン',
            'rare': 'レア',
            'epic': 'エピック',
            'legendary': 'レジェンド'
        };
        return rarityTexts[rarity] || 'コモン';
    }

    // 関数使用
    useFunction(func) {
        if (this.gameState.applyFunction(func)) {
            this.updateDisplay();
            this.renderUsedFunctionCards();
            this.renderOwnedFunctionCards();

            // ゲーム終了条件チェック
            if (this.gameState.isExactMatch()) {
                setTimeout(() => this.endGame(), 500);
            } else if (this.gameState.handCount <= 0) {
                setTimeout(() => this.endGame(), 500);
            }
        }
    }

    // 表示更新
    updateDisplay() {
        // 現在位置
        document.getElementById(this.elementIds.currentX).textContent = this.gameState.currentX;
        document.getElementById(this.elementIds.currentY).textContent = this.gameState.currentY;

        // ターゲット座標
        document.getElementById(this.elementIds.targetX).textContent = this.gameState.targetX;
        document.getElementById(this.elementIds.targetY).textContent = this.gameState.targetY;

        // 残りハンド
        document.getElementById(this.elementIds.handCount).textContent = this.gameState.handCount;

        // 開始ボタンの状態
        const startBtn = document.getElementById(this.elementIds.startBtn);
        startBtn.disabled = this.gameState.isGameActive;
        startBtn.textContent = this.gameState.isGameActive ? 'ゲーム中...' : 'ゲーム開始';
    }

    // 結果表示
    showResult() {
        const resultArea = document.getElementById(this.elementIds.resultArea);
        const resultMessage = document.getElementById(this.elementIds.resultMessage);

        resultArea.classList.remove('hidden');

        if (this.gameState.isExactMatch()) {
            resultMessage.textContent = '🎉 クリア！ターゲット座標に到達しました！';
            resultMessage.className = 'result-success';
        } else {
            const distance = this.gameState.calculateDistance();
            resultMessage.textContent = `❌ ゲームオーバー！距離: ${distance.toFixed(2)}`;
            resultMessage.className = 'result-failure';
        }
    }

    // ゲームリスタート
    restartGame() {
        document.getElementById(this.elementIds.resultArea).classList.add('hidden');
        this.startGame();
    }
}

// アプリケーション初期化
class App {
    constructor() {
        this.screenManager = new ScreenManager();
        this.challengeGame = new GameManager('challenge', {
            currentX: 'currentX',
            currentY: 'currentY',
            targetX: 'targetX',
            targetY: 'targetY',
            handCount: 'handCount',
            usedFunctionCards: 'usedFunctionCards',
            ownedFunctionCards: 'ownedFunctionCards',
            resultArea: 'resultArea',
            resultMessage: 'resultMessage',
            startBtn: 'startBtn',
            restartBtn: 'restartBtn'
        });
        this.randomGame = new GameManager('random', {
            currentX: 'currentX2',
            currentY: 'currentY2',
            targetX: 'targetX2',
            targetY: 'targetY2',
            handCount: 'handCount2',
            usedFunctionCards: 'usedFunctionCards2',
            ownedFunctionCards: 'ownedFunctionCards2',
            resultArea: 'resultArea2',
            resultMessage: 'resultMessage2',
            startBtn: 'startBtn2',
            restartBtn: 'restartBtn2'
        });
    }
}

// ゲーム開始
document.addEventListener('DOMContentLoaded', () => {
    new App();
});
