// ツールチップ管理クラス
function TooltipManager() {
    this.tooltip = null;
    this.timeout = null;
    this.init();
}

TooltipManager.prototype.init = function () {
    this.tooltip = document.getElementById('tooltip');
    this.setupEventListeners();
};

TooltipManager.prototype.setupEventListeners = function () {
    // パレットアイテムのマウスオーバー
    document.addEventListener('mouseover', (e) => {
        const item = e.target.closest('.item');
        if (item) {
            this.showTooltip(e, item.dataset.itemId, true);
        }
    });

    // 配置されたアイテムのマウスオーバー
    document.addEventListener('mouseover', (e) => {
        const placedItem = e.target.closest('.placed-item');
        if (placedItem) {
            // ドラッグ中のアイテムは除外
            if (placedItem.classList.contains('dragging') ||
                (window.inventorySystem && window.inventorySystem.dragHandler && window.inventorySystem.dragHandler.isDragging)) {
                return;
            }
            const itemId = this.getItemIdFromPlacedItem(placedItem);
            if (itemId) {
                this.showTooltip(e, itemId, false);
            }
        }
    });

    // マウスアウト時の処理
    document.addEventListener('mouseout', (e) => {
        const item = e.target.closest('.item');
        const placedItem = e.target.closest('.placed-item');

        if (item || placedItem) {
            this.hideTooltip();
        }
    });

    // マウス移動時の処理
    document.addEventListener('mousemove', (e) => {
        // マウス座標を保存
        window.lastMouseX = e.clientX;
        window.lastMouseY = e.clientY;

        if (this.tooltip && this.tooltip.classList.contains('show')) {
            this.updateTooltipPosition(e);
        }
    });

    // ドラッグ開始時にツールチップを非表示
    document.addEventListener('mousedown', (e) => {
        const item = e.target.closest('.item');
        const placedItem = e.target.closest('.placed-item');
        if (item || placedItem) {
            this.hideTooltip();
        }
    });

    // ドラッグ中はツールチップを非表示に保つ
    document.addEventListener('mousemove', (e) => {
        if (window.inventorySystem && window.inventorySystem.dragHandler && window.inventorySystem.dragHandler.isDragging) {
            this.hideTooltip();
        }
    });

    // コンテキストメニュー表示時にツールチップを非表示
    document.addEventListener('contextmenu', (e) => {
        const placedItem = e.target.closest('.placed-item');
        if (placedItem) {
            this.hideTooltip();
        }
    });

    // ドラッグ終了時にツールチップの状態をリセット
    document.addEventListener('mouseup', (e) => {
        if (window.inventorySystem && window.inventorySystem.dragHandler && !window.inventorySystem.dragHandler.isDragging) {
            // ドラッグ終了後、少し遅延させてからツールチップを有効にする
            setTimeout(() => {
                this.timeout = null;
            }, 100);
        }
    });

    // コンテキストメニューが非表示になった時にツールチップの状態をリセット
    document.addEventListener('click', (e) => {
        if (window.inventorySystem && window.inventorySystem.contextMenu) {
            const contextMenu = window.inventorySystem.contextMenu.contextMenu;
            if (contextMenu.style.display === 'none' && !contextMenu.contains(e.target)) {
                setTimeout(() => {
                    this.timeout = null;
                }, 100);
            }
        }
    });
};

TooltipManager.prototype.getItemIdFromPlacedItem = function (placedItem) {
    // 配置されたアイテムのIDから元のアイテムIDを取得
    const itemId = placedItem.dataset.itemId;
    if (itemId) {
        // itemIdの形式は "originalId_timestamp" なので、元のIDを抽出
        const originalId = itemId.split('_')[0];
        return originalId;
    }
    return null;
};

TooltipManager.prototype.showTooltip = function (event, itemId, isPaletteItem) {
    // ドラッグ中はツールチップを表示しない
    if (window.inventorySystem && window.inventorySystem.dragHandler && window.inventorySystem.dragHandler.isDragging) {
        return;
    }

    // コンテキストメニューが表示されている場合はツールチップを表示しない
    if (window.inventorySystem && window.inventorySystem.contextMenu &&
        window.inventorySystem.contextMenu.contextMenu.style.display === 'block') {
        return;
    }

    // 既存のタイムアウトをクリア
    if (this.timeout) {
        clearTimeout(this.timeout);
    }

    // ツールチップを即座に表示
    this.timeout = setTimeout(() => {
        const itemInfo = window.ITEM_INFO[itemId];
        if (itemInfo) {
            this.updateTooltipContent(itemInfo);
            this.updateTooltipPosition(event);
            this.tooltip.classList.add('show');
        }
    }, 0);
};

TooltipManager.prototype.hideTooltip = function () {
    if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
    }
    this.tooltip.classList.remove('show');
};

TooltipManager.prototype.resetTooltipState = function () {
    // ツールチップの状態をリセット
    if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
    }
    this.tooltip.classList.remove('show');

    // 現在のマウス位置でツールチップを再チェック
    setTimeout(() => {
        const mouseEvent = new MouseEvent('mouseover', {
            clientX: window.lastMouseX || 0,
            clientY: window.lastMouseY || 0
        });
        document.elementFromPoint(mouseEvent.clientX, mouseEvent.clientY)?.dispatchEvent(mouseEvent);
    }, 50);
};

TooltipManager.prototype.updateTooltipContent = function (itemInfo) {
    const tooltipImage = document.getElementById('tooltipImage');
    const tooltipTitle = document.getElementById('tooltipTitle');
    const tooltipDescription = document.getElementById('tooltipDescription');

    tooltipTitle.textContent = itemInfo.name;
    tooltipDescription.textContent = itemInfo.description;

    if (itemInfo.imagePath) {
        tooltipImage.src = itemInfo.imagePath;
        tooltipImage.style.display = 'block';
    } else {
        tooltipImage.style.display = 'none';
    }
};

TooltipManager.prototype.updateTooltipPosition = function (event) {
    const offset = 15; // マウスカーソルからのオフセット
    let x = event.clientX + offset;
    let y = event.clientY + offset;

    // 画面右端を超えないように調整
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const windowWidth = window.innerWidth;

    if (x + tooltipRect.width > windowWidth) {
        x = event.clientX - tooltipRect.width - offset;
    }

    // 画面下端を超えないように調整
    const windowHeight = window.innerHeight;
    if (y + tooltipRect.height > windowHeight) {
        y = event.clientY - tooltipRect.height - offset;
    }

    this.tooltip.style.left = x + 'px';
    this.tooltip.style.top = y + 'px';
};

// グローバルに公開
window.TooltipManager = TooltipManager; 