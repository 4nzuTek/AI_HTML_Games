// 依存ファイルのimport/exportを削除
// window経由でグローバル参照
function InventorySystem() {
    this.gridSize = window.GRID_CONFIG.size;
    this.cellSize = window.GRID_CONFIG.cellSize;
    this.gridGap = window.GRID_CONFIG.gridGap;
    this.inventory = [];
    this.placedItems = new Map();
    this.shadowItem = null;
    this.gridManager = new window.GridManager();
    this.dragHandler = new window.DragHandler(this);
    this.contextMenu = new window.ContextMenu(this);
    this.init();
}

InventorySystem.prototype.init = function () {
    this.gridManager.createGrid();
    this.setupDragAndDrop();
    this.loadInitialItems();
};

InventorySystem.prototype.setupDragAndDrop = function () {
    // ドラッグハンドラーでパレットドラッグを設定
    this.dragHandler.setupPaletteDrag();

    // 配置されたアイテムの移動
    const grid = document.getElementById('inventoryGrid');
    grid.addEventListener('mousedown', (e) => {
        const placedItem = e.target.closest('.placed-item');
        if (placedItem) {
            this.dragHandler.startItemMove(e, placedItem);
        }
    });
};

InventorySystem.prototype.placeItem = function (row, col, item) {
    const size = window.parseSize(item.size);
    const itemId = `${item.id}_${Date.now()}`;

    // セルを占有状態にする
    for (let r = row; r < row + size.height; r++) {
        for (let c = col; c < col + size.width; c++) {
            this.gridManager.setCellOccupied(r, c, true);
        }
    }

    // アイテム要素を作成
    const itemElement = document.createElement('div');
    itemElement.className = 'placed-item';
    itemElement.dataset.itemId = itemId;
    itemElement.dataset.row = row;
    itemElement.dataset.col = col;
    itemElement.dataset.size = item.size;
    itemElement.style.width = `${size.width * this.cellSize + (size.width - 1) * this.gridGap}px`;
    itemElement.style.height = `${size.height * this.cellSize + (size.height - 1) * this.gridGap}px`;
    itemElement.style.left = `${col * (this.cellSize + this.gridGap)}px`;
    itemElement.style.top = `${row * (this.cellSize + this.gridGap)}px`;

    // アイテムタイプを取得して画像を設定
    const itemType = window.getItemType(item.id);
    const config = window.getItemConfig(itemType);

    if (config) {
        // 画像アイテムの場合
        const rotation = (parseInt(item.rotation) === 90) ? 90 : 0;
        const scale = 1.0; // スケールを常に1.0固定にする
        itemElement.dataset.rotation = rotation;
        itemElement.dataset.scale = scale;
        window.setItemImage(itemElement, itemType, rotation, scale);
    } else {
        // テキストアイテムの場合
        itemElement.textContent = item.content;
    }

    // ドラッグ移動のためのマウスイベントを追加
    itemElement.addEventListener('mousedown', (e) => {
        if (e.button === 0) { // 左クリックのみ
            this.dragHandler.startItemDrag(e, itemElement);
        } else if (e.button === 2) { // 右クリックの場合は何もしない
            e.preventDefault();
            e.stopPropagation();
        }
    });

    document.getElementById('inventoryGrid').appendChild(itemElement);

    // アイテム情報を保存
    this.placedItems.set(itemId, {
        id: item.id,
        row: row,
        col: col,
        size: item.size,
        content: item.content,
        rotation: item.rotation || '0',
        scale: item.scale || '1.0'
    });
};

InventorySystem.prototype.moveItem = function (itemElement, newRow, newCol) {
    const itemId = itemElement.dataset.itemId;
    const oldRow = parseInt(itemElement.dataset.row);
    const oldCol = parseInt(itemElement.dataset.col);
    const size = window.parseSize(itemElement.dataset.size);

    // 古い位置を解放
    for (let r = oldRow; r < oldRow + size.height; r++) {
        for (let c = oldCol; c < oldCol + size.width; c++) {
            this.gridManager.setCellOccupied(r, c, false);
        }
    }

    // 新しい位置を占有
    for (let r = newRow; r < newRow + size.height; r++) {
        for (let c = newCol; c < newCol + size.width; c++) {
            this.gridManager.setCellOccupied(r, c, true);
        }
    }

    // アイテム位置を更新
    itemElement.dataset.row = newRow;
    itemElement.dataset.col = newCol;
    itemElement.style.left = `${newCol * (this.cellSize + this.gridGap)}px`;
    itemElement.style.top = `${newRow * (this.cellSize + this.gridGap)}px`;

    // アイテム情報を更新
    const itemInfo = this.placedItems.get(itemId);
    if (itemInfo) {
        itemInfo.row = newRow;
        itemInfo.col = newCol;
    }
};

InventorySystem.prototype.moveItemWithRotation = function (itemElement, newRow, newCol, newSize) {
    const itemId = itemElement.dataset.itemId;
    const oldRow = parseInt(itemElement.dataset.row);
    const oldCol = parseInt(itemElement.dataset.col);
    const oldSize = window.parseSize(itemElement.dataset.size);

    // 古い位置を解放
    for (let r = oldRow; r < oldRow + oldSize.height; r++) {
        for (let c = oldCol; c < oldCol + oldSize.width; c++) {
            this.gridManager.setCellOccupied(r, c, false);
        }
    }

    // 新しい位置を占有
    for (let r = newRow; r < newRow + newSize.height; r++) {
        for (let c = newCol; c < newCol + newSize.width; c++) {
            this.gridManager.setCellOccupied(r, c, true);
        }
    }

    // アイテムのサイズと位置を更新
    itemElement.dataset.row = newRow;
    itemElement.dataset.col = newCol;
    itemElement.dataset.size = `${newSize.width}x${newSize.height}`;
    itemElement.style.width = `${newSize.width * this.cellSize + (newSize.width - 1) * this.gridGap}px`;
    itemElement.style.height = `${newSize.height * this.cellSize + (newSize.height - 1) * this.gridGap}px`;
    itemElement.style.left = `${newCol * (this.cellSize + this.gridGap)}px`;
    itemElement.style.top = `${newRow * (this.cellSize + this.gridGap)}px`;

    // アイテム情報を更新
    const itemInfo = this.placedItems.get(itemId);
    if (itemInfo) {
        itemInfo.row = newRow;
        itemInfo.col = newCol;
        itemInfo.size = `${newSize.width}x${newSize.height}`;
        // 回転状態とスケールも保存
        if (itemElement.dataset.rotation) {
            itemInfo.rotation = itemElement.dataset.rotation;
        }
        if (itemElement.dataset.scale) {
            itemInfo.scale = itemElement.dataset.scale;
        }
    }

    // アイテムタイプを取得して画像を再設定
    const itemType = window.getItemType(itemId);
    const config = window.getItemConfig(itemType);
    if (config) {
        const rotation = parseInt(itemElement.dataset.rotation || '0');
        const scale = parseFloat(itemElement.dataset.scale || '1.0');
        window.setItemImage(itemElement, itemType, rotation, scale);
    }
};

InventorySystem.prototype.resetItemPosition = function (itemElement) {
    // 保存された元の状態を使用
    if (this.dragHandler.originalItemState) {
        const originalState = this.dragHandler.originalItemState;
        const size = window.parseSize(originalState.size);

        // データ属性を元の状態に復元
        itemElement.dataset.row = originalState.row;
        itemElement.dataset.col = originalState.col;
        itemElement.dataset.size = originalState.size;
        itemElement.dataset.rotation = originalState.rotation;
        itemElement.dataset.scale = originalState.scale;

        // 位置を復元
        itemElement.style.left = `${originalState.col * (this.cellSize + this.gridGap)}px`;
        itemElement.style.top = `${originalState.row * (this.cellSize + this.gridGap)}px`;

        // サイズを復元
        itemElement.style.width = `${size.width * this.cellSize + (size.width - 1) * this.gridGap}px`;
        itemElement.style.height = `${size.height * this.cellSize + (size.height - 1) * this.gridGap}px`;

        // アイテムタイプを取得して画像を復元
        const itemType = window.getItemType(itemElement.dataset.itemId);
        const config = window.getItemConfig(itemType);
        if (config) {
            const rotation = parseInt(originalState.rotation);
            const scale = parseFloat(originalState.scale);
            window.setItemImage(itemElement, itemType, rotation, scale);
        }

        // 元の状態をクリア
        this.dragHandler.originalItemState = null;
    } else {
        // フォールバック: 現在のデータ属性を使用
        const row = parseInt(itemElement.dataset.row);
        const col = parseInt(itemElement.dataset.col);
        const size = window.parseSize(itemElement.dataset.size);

        // 位置を復元
        itemElement.style.left = `${col * (this.cellSize + this.gridGap)}px`;
        itemElement.style.top = `${row * (this.cellSize + this.gridGap)}px`;

        // サイズを復元
        itemElement.style.width = `${size.width * this.cellSize + (size.width - 1) * this.gridGap}px`;
        itemElement.style.height = `${size.height * this.cellSize + (size.height - 1) * this.gridGap}px`;

        // アイテムタイプを取得して画像を復元
        const itemType = window.getItemType(itemElement.dataset.itemId);
        const config = window.getItemConfig(itemType);
        if (config) {
            const rotation = parseInt(itemElement.dataset.rotation || '0');
            const scale = parseFloat(itemElement.dataset.scale || '1.0');
            window.setItemImage(itemElement, itemType, rotation, scale);
        }
    }
};

InventorySystem.prototype.loadInitialItems = function () {
    // 初期アイテムを配置
    window.INITIAL_ITEMS.forEach(item => {
        if (this.gridManager.canPlaceItem(item.row, item.col, item.size)) {
            this.placeItem(item.row, item.col, {
                id: item.id,
                size: item.size,
                content: item.content,
                rotation: item.rotation || '0'
            });
        }
    });
};

// ユーティリティ関数のエイリアス（後方互換性のため）
InventorySystem.prototype.parseSize = function (sizeStr) {
    return window.parseSize(sizeStr);
};

// ページ読み込み時にインベントリシステムを初期化
window.InventorySystem = InventorySystem;

document.addEventListener('DOMContentLoaded', function () {
    new window.InventorySystem();
}); 