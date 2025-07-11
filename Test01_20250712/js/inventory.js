class InventorySystem {
    constructor() {
        this.gridSize = 10;
        this.cellSize = 40;
        this.gridGap = 1; // gap: 1px
        this.inventory = [];
        this.placedItems = new Map();
        this.draggedItem = null;
        this.dragOffset = { x: 0, y: 0 };
        // this.gridPadding = 10; // 不要
        // this.gridBorder = 2;   // 不要
        this.shadowItem = null;
        this.init();
    }

    init() {
        this.createGrid();
        this.setupDragAndDrop();
        this.loadInitialItems();
        this.setupPaletteDrag(); // 追加
    }

    createGrid() {
        const grid = document.getElementById('inventoryGrid');
        grid.style.position = 'relative';

        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                grid.appendChild(cell);
            }
        }
    }

    setupDragAndDrop() {
        // アイテムパレットからのドラッグ開始
        document.querySelectorAll('.item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                this.draggedItem = {
                    id: item.dataset.itemId,
                    size: item.dataset.size,
                    content: item.querySelector('.item-content').textContent
                };
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                this.draggedItem = null;
            });
        });

        // グリッドへのドロップ処理
        const grid = document.getElementById('inventoryGrid');

        grid.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (!this.draggedItem) return;
            const rect = grid.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const size = this.parseSize(this.draggedItem.size);
            // 中央を持つ方式
            const col = Math.floor(x / this.cellSize - (size.width / 2) + 0.5);
            const row = Math.floor(y / this.cellSize - (size.height / 2) + 0.5);
            this.showShadowItem(row, col);
        });

        grid.addEventListener('dragleave', () => {
            this.clearDropZoneHighlight();
            this.removeShadowItem();
        });

        grid.addEventListener('drop', (e) => {
            e.preventDefault();

            if (!this.draggedItem) return;

            const rect = grid.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const size = this.parseSize(this.draggedItem.size);
            const col = Math.floor(x / this.cellSize - (size.width / 2) + 0.5);
            const row = Math.floor(y / this.cellSize - (size.height / 2) + 0.5);

            if (this.canPlaceItem(row, col, this.draggedItem.size)) {
                this.placeItem(row, col, this.draggedItem);
            }

            this.clearDropZoneHighlight();
            this.removeShadowItem();
        });

        // 配置されたアイテムの移動
        grid.addEventListener('mousedown', (e) => {
            const placedItem = e.target.closest('.placed-item');
            if (placedItem) {
                this.startItemMove(e, placedItem);
            }
        });
    }

    highlightDropZone(row, col) {
        this.clearDropZoneHighlight();

        const size = this.parseSize(this.draggedItem.size);
        for (let r = row; r < row + size.height && r < this.gridSize; r++) {
            for (let c = col; c < col + size.width && c < this.gridSize; c++) {
                const cell = this.getCell(r, c);
                if (cell && !this.isCellOccupied(r, c)) {
                    cell.classList.add('drag-over');
                }
            }
        }
    }

    clearDropZoneHighlight() {
        document.querySelectorAll('.grid-cell.drag-over').forEach(cell => {
            cell.classList.remove('drag-over');
        });
    }

    canPlaceItem(row, col, size, ignoreItemId = null) {
        const parsedSize = this.parseSize(size);

        for (let r = row; r < row + parsedSize.height; r++) {
            for (let c = col; c < col + parsedSize.width; c++) {
                if (r < 0 || c < 0 || r >= this.gridSize || c >= this.gridSize) {
                    return false;
                }
                // ignoreItemIdが指定されている場合は、そのアイテムのセルは無視
                const cell = this.getCell(r, c);
                if (cell && cell.classList.contains('occupied')) {
                    if (ignoreItemId) {
                        // そのセルにあるアイテムがignoreItemIdならOK
                        let overlap = false;
                        document.querySelectorAll('.placed-item').forEach(el => {
                            if (el.dataset.itemId === ignoreItemId) {
                                const s = this.parseSize(el.dataset.size);
                                const baseRow = parseInt(el.dataset.row);
                                const baseCol = parseInt(el.dataset.col);
                                if (r >= baseRow && r < baseRow + s.height && c >= baseCol && c < baseCol + s.width) {
                                    overlap = true;
                                }
                            }
                        });
                        if (!overlap) return false;
                    } else {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    placeItem(row, col, item) {
        const size = this.parseSize(item.size);
        const itemId = `${item.id}_${Date.now()}`;

        // セルを占有状態にする
        for (let r = row; r < row + size.height; r++) {
            for (let c = col; c < col + size.width; c++) {
                this.setCellOccupied(r, c, true);
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
        itemElement.textContent = item.content;

        document.getElementById('inventoryGrid').appendChild(itemElement);

        // アイテム情報を保存
        this.placedItems.set(itemId, {
            id: item.id,
            row: row,
            col: col,
            size: item.size,
            content: item.content
        });
    }

    startItemMove(e, itemElement) {
        e.preventDefault();
        const rect = itemElement.getBoundingClientRect();
        this.dragOffset = {
            x: rect.width / 2,
            y: rect.height / 2
        };
        itemElement.style.zIndex = '1000';
        itemElement.style.opacity = '0.8';
        const size = this.parseSize(itemElement.dataset.size);
        const itemId = itemElement.dataset.itemId;
        const moveHandler = (e) => {
            const grid = document.getElementById('inventoryGrid');
            const gridRect = grid.getBoundingClientRect();
            const x = e.clientX - gridRect.left;
            const y = e.clientY - gridRect.top;
            // 中央を持つ方式
            const col = Math.floor(x / this.cellSize - (size.width / 2) + 0.5);
            const row = Math.floor(y / this.cellSize - (size.height / 2) + 0.5);
            this.showShadowItem(row, col, size, itemId);
            // gap補正
            const left = col * (this.cellSize + this.gridGap);
            const top = row * (this.cellSize + this.gridGap);
            itemElement.style.left = `${left}px`;
            itemElement.style.top = `${top}px`;
        };
        const upHandler = (e) => {
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
            this.removeShadowItem();
            const grid = document.getElementById('inventoryGrid');
            const gridRect = grid.getBoundingClientRect();
            const x = e.clientX - gridRect.left;
            const y = e.clientY - gridRect.top;
            // 中央を持つ方式
            const col = Math.floor(x / this.cellSize - (size.width / 2) + 0.5);
            const row = Math.floor(y / this.cellSize - (size.height / 2) + 0.5);
            if (this.canPlaceItem(row, col, size.width + 'x' + size.height, itemId)) {
                this.moveItem(itemElement, row, col);
            } else {
                this.resetItemPosition(itemElement);
            }
            itemElement.style.zIndex = '';
            itemElement.style.opacity = '';
        };
        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', upHandler);
    }

    moveItem(itemElement, newRow, newCol) {
        const itemId = itemElement.dataset.itemId;
        const oldRow = parseInt(itemElement.dataset.row);
        const oldCol = parseInt(itemElement.dataset.col);
        const size = this.parseSize(itemElement.dataset.size);

        // 古い位置を解放
        for (let r = oldRow; r < oldRow + size.height; r++) {
            for (let c = oldCol; c < oldCol + size.width; c++) {
                this.setCellOccupied(r, c, false);
            }
        }

        // 新しい位置を占有
        for (let r = newRow; r < newRow + size.height; r++) {
            for (let c = newCol; c < newCol + size.width; c++) {
                this.setCellOccupied(r, c, true);
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
    }

    resetItemPosition(itemElement) {
        const row = parseInt(itemElement.dataset.row);
        const col = parseInt(itemElement.dataset.col);
        const size = this.parseSize(itemElement.dataset.size);

        itemElement.style.left = `${col * (this.cellSize + this.gridGap)}px`;
        itemElement.style.top = `${row * (this.cellSize + this.gridGap)}px`;
    }

    loadInitialItems() {
        // 初期アイテムを配置
        const initialItems = [
            { id: 'medkit', row: 0, col: 0, size: '2x2', content: '医療キット' },
            { id: 'ammo', row: 2, col: 2, size: '1x1', content: '弾薬' },
            { id: 'food', row: 0, col: 3, size: '1x2', content: '食料' }
        ];

        initialItems.forEach(item => {
            if (this.canPlaceItem(item.row, item.col, item.size)) {
                this.placeItem(item.row, item.col, {
                    id: item.id,
                    size: item.size,
                    content: item.content
                });
            }
        });
    }

    parseSize(sizeStr) {
        const [width, height] = sizeStr.split('x').map(Number);
        return { width, height };
    }

    getCell(row, col) {
        return document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    }

    isCellOccupied(row, col) {
        const cell = this.getCell(row, col);
        return cell && cell.classList.contains('occupied');
    }

    setCellOccupied(row, col, occupied) {
        const cell = this.getCell(row, col);
        if (cell) {
            if (occupied) {
                cell.classList.add('occupied');
            } else {
                cell.classList.remove('occupied');
            }
        }
    }

    showShadowItem(row, col, sizeOverride = null, ignoreItemId = null) {
        this.removeShadowItem();
        let size, canPlace;
        if (sizeOverride) {
            size = sizeOverride;
        } else if (this.draggedItem) {
            size = this.parseSize(this.draggedItem.size);
        } else {
            return;
        }
        if (ignoreItemId) {
            canPlace = this.canPlaceItem(row, col, size.width + 'x' + size.height, ignoreItemId);
        } else {
            canPlace = this.canPlaceItem(row, col, size.width + 'x' + size.height);
        }
        const grid = document.getElementById('inventoryGrid');
        const shadow = document.createElement('div');
        shadow.className = 'shadow-item ' + (canPlace ? 'can-place' : 'cannot-place');
        shadow.style.width = `${size.width * this.cellSize + (size.width - 1) * this.gridGap}px`;
        shadow.style.height = `${size.height * this.cellSize + (size.height - 1) * this.gridGap}px`;
        shadow.style.left = `${col * (this.cellSize + this.gridGap)}px`;
        shadow.style.top = `${row * (this.cellSize + this.gridGap)}px`;
        grid.appendChild(shadow);
        this.shadowItem = shadow;
    }
    removeShadowItem() {
        if (this.shadowItem && this.shadowItem.parentNode) {
            this.shadowItem.parentNode.removeChild(this.shadowItem);
        }
        this.shadowItem = null;
    }

    setupPaletteDrag() {
        // パレットアイテムも自前ドラッグに
        document.querySelectorAll('.item').forEach(item => {
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const size = this.parseSize(item.dataset.size);
                const content = item.querySelector('.item-content').textContent;
                this.startNewItemDrag(e, {
                    id: item.dataset.itemId,
                    size: item.dataset.size,
                    content: content
                });
            });
        });
    }
    startNewItemDrag(e, item) {
        // パレットから新規追加用の自前ドラッグ
        const grid = document.getElementById('inventoryGrid');
        // ドラッグ用の仮アイテムを作成
        const size = this.parseSize(item.size);
        const dragElem = document.createElement('div');
        dragElem.className = 'placed-item';
        dragElem.style.width = `${size.width * this.cellSize + (size.width - 1) * this.gridGap}px`;
        dragElem.style.height = `${size.height * this.cellSize + (size.height - 1) * this.gridGap}px`;
        dragElem.style.position = 'absolute';
        dragElem.style.pointerEvents = 'none';
        dragElem.textContent = item.content;
        grid.appendChild(dragElem);
        // ドラッグ開始時のオフセット
        const gridRect = grid.getBoundingClientRect();
        const x0 = e.clientX - gridRect.left;
        const y0 = e.clientY - gridRect.top;
        const dragOffset = {
            x: (size.width / 2) * this.cellSize,
            y: (size.height / 2) * this.cellSize
        };
        const moveHandler = (e2) => {
            const x = e2.clientX - gridRect.left;
            const y = e2.clientY - gridRect.top;
            // 中央を持つ方式
            const col = Math.floor(x / this.cellSize - (size.width / 2) + 0.5);
            const row = Math.floor(y / this.cellSize - (size.height / 2) + 0.5);
            this.showShadowItem(row, col, size);
            // アイテム自体も中央を持つ
            const left = col * (this.cellSize + this.gridGap);
            const top = row * (this.cellSize + this.gridGap);
            dragElem.style.left = `${left}px`;
            dragElem.style.top = `${top}px`;
        };
        const upHandler = (e2) => {
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
            this.removeShadowItem();
            // ドロップ位置を計算
            const x = e2.clientX - gridRect.left;
            const y = e2.clientY - gridRect.top;
            const col = Math.floor(x / this.cellSize - (size.width / 2) + 0.5);
            const row = Math.floor(y / this.cellSize - (size.height / 2) + 0.5);
            if (this.canPlaceItem(row, col, size.width + 'x' + size.height)) {
                this.placeItem(row, col, item);
            }
            if (dragElem.parentNode) dragElem.parentNode.removeChild(dragElem);
        };
        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', upHandler);
        // 最初の位置を即時反映
        moveHandler(e);
    }
}

// ページ読み込み時にインベントリシステムを初期化
document.addEventListener('DOMContentLoaded', () => {
    new InventorySystem();
}); 