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
        this.isDragging = false; // ドラッグ状態を追跡
        this.currentDragItem = null; // 現在ドラッグ中のアイテム情報
        this.init();
    }

    init() {
        this.createGrid();
        this.setupDragAndDrop();
        this.loadInitialItems();
        this.setupPaletteDrag(); // 追加
        this.setupRotationHandler(); // 回転機能を追加
        this.setupContextMenu(); // コンテキストメニュー機能を追加
    }

    setupRotationHandler() {
        // Rキーで回転するイベントリスナーを追加
        document.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'r' && this.isDragging && this.currentDragItem) {
                e.preventDefault();
                this.rotateCurrentItem();
            }
        });
    }

    setupContextMenu() {
        // コンテキストメニューの要素を取得
        this.contextMenu = document.getElementById('contextMenu');
        this.contextMenuTarget = null;

        // 配置されたアイテムに右クリックイベントを追加
        document.addEventListener('contextmenu', (e) => {
            const placedItem = e.target.closest('.placed-item');
            if (placedItem) {
                e.preventDefault();
                this.showContextMenu(e, placedItem);
            }
        });

        // コンテキストメニューのクリックイベント
        this.contextMenu.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action === 'delete' && this.contextMenuTarget) {
                this.deleteItem(this.contextMenuTarget);
            }
            this.hideContextMenu();
        });

        // 他の場所をクリックしたらメニューを隠す
        document.addEventListener('click', (e) => {
            if (!this.contextMenu.contains(e.target)) {
                this.hideContextMenu();
            }
        });
    }

    showContextMenu(e, itemElement) {
        this.contextMenuTarget = itemElement;
        this.contextMenu.style.display = 'block';

        // メニューの位置を設定
        const x = e.clientX;
        const y = e.clientY;

        // 画面の端に当たらないように調整
        let menuX = x;
        let menuY = y;

        // メニューを一時的に表示してサイズを取得
        this.contextMenu.style.left = '0px';
        this.contextMenu.style.top = '0px';
        const rect = this.contextMenu.getBoundingClientRect();

        if (x + rect.width > window.innerWidth) {
            menuX = x - rect.width;
        }

        if (y + rect.height > window.innerHeight) {
            menuY = y - rect.height;
        }

        this.contextMenu.style.left = menuX + 'px';
        this.contextMenu.style.top = menuY + 'px';
    }

    hideContextMenu() {
        this.contextMenu.style.display = 'none';
        this.contextMenuTarget = null;
    }

    deleteItem(itemElement) {
        const itemId = itemElement.dataset.itemId;
        const row = parseInt(itemElement.dataset.row);
        const col = parseInt(itemElement.dataset.col);
        const size = this.parseSize(itemElement.dataset.size);

        // セルの占有状態を解除
        for (let r = row; r < row + size.height; r++) {
            for (let c = col; c < col + size.width; c++) {
                this.setCellOccupied(r, c, false);
            }
        }

        // アイテム情報を削除
        this.placedItems.delete(itemId);

        // DOM要素を削除
        if (itemElement.parentNode) {
            itemElement.parentNode.removeChild(itemElement);
        }
    }

    rotateCurrentItem() {
        if (!this.currentDragItem) return;

        // サイズを回転（幅と高さを入れ替え）
        const currentSize = this.parseSize(this.currentDragItem.size);
        const rotatedSize = {
            width: currentSize.height,
            height: currentSize.width
        };

        // 新しいサイズ文字列を作成
        this.currentDragItem.size = `${rotatedSize.width}x${rotatedSize.height}`;

        // 直近のマウス座標を取得
        const grid = document.getElementById('inventoryGrid');
        const gridRect = grid.getBoundingClientRect();
        const x = (typeof this.lastMouseX !== 'undefined') ? this.lastMouseX : gridRect.width / 2;
        const y = (typeof this.lastMouseY !== 'undefined') ? this.lastMouseY : gridRect.height / 2;
        // 新しいサイズで中心を合わせる
        const col = Math.floor(x / this.cellSize - (rotatedSize.width / 2) + 0.5);
        const row = Math.floor(y / this.cellSize - (rotatedSize.height / 2) + 0.5);
        const left = col * (this.cellSize + this.gridGap);
        const top = row * (this.cellSize + this.gridGap);
        this.currentDragElement.style.width = `${rotatedSize.width * this.cellSize + (rotatedSize.width - 1) * this.gridGap}px`;
        this.currentDragElement.style.height = `${rotatedSize.height * this.cellSize + (rotatedSize.height - 1) * this.gridGap}px`;
        this.currentDragElement.style.left = `${left}px`;
        this.currentDragElement.style.top = `${top}px`;

        // 銃アイテムの場合は画像の回転も更新
        if (this.currentDragItem.id === 'gun') {
            const currentRotation = parseInt(this.currentDragElement.dataset.rotation || '0');
            const newRotation = (currentRotation === 0) ? 90 : 0;
            this.currentDragElement.dataset.rotation = newRotation.toString();
            setGunImage(this.currentDragElement, newRotation);
        }

        // シャドウアイテムも更新
        if (this.shadowItem) {
            this.updateShadowItemSize(rotatedSize);
        }
    }

    updateDraggedElementSize(size) {
        // ドラッグ中の要素を更新
        const draggedElements = document.querySelectorAll('.placed-item');
        draggedElements.forEach(element => {
            if (element.classList.contains('cannot-place') || element.style.pointerEvents === 'none') {
                element.style.width = `${size.width * this.cellSize + (size.width - 1) * this.gridGap}px`;
                element.style.height = `${size.height * this.cellSize + (size.height - 1) * this.gridGap}px`;
            }
        });
    }

    updateDraggedElementSizeAndPosition(size) {
        // ドラッグ中の要素を更新（サイズと位置）
        const draggedElements = document.querySelectorAll('.placed-item');
        draggedElements.forEach(element => {
            if (element.classList.contains('cannot-place') || element.style.pointerEvents === 'none') {
                // 要素の中心位置を計算
                const centerX = parseFloat(element.style.left) + parseFloat(element.style.width) / 2;
                const centerY = parseFloat(element.style.top) + parseFloat(element.style.height) / 2;

                // 新しいサイズで要素を更新
                element.style.width = `${size.width * this.cellSize + (size.width - 1) * this.gridGap}px`;
                element.style.height = `${size.height * this.cellSize + (size.height - 1) * this.gridGap}px`;

                // 中心位置を維持して新しい位置を計算
                const newLeft = centerX - (size.width * this.cellSize + (size.width - 1) * this.gridGap) / 2;
                const newTop = centerY - (size.height * this.cellSize + (size.height - 1) * this.gridGap) / 2;

                element.style.left = `${newLeft}px`;
                element.style.top = `${newTop}px`;
            }
        });

        // パレットからのドラッグ要素も更新
        if (this.currentDragElement) {
            // 要素の中心位置を計算
            const centerX = parseFloat(this.currentDragElement.style.left) + parseFloat(this.currentDragElement.style.width) / 2;
            const centerY = parseFloat(this.currentDragElement.style.top) + parseFloat(this.currentDragElement.style.height) / 2;

            // 新しいサイズで要素を更新
            this.currentDragElement.style.width = `${size.width * this.cellSize + (size.width - 1) * this.gridGap}px`;
            this.currentDragElement.style.height = `${size.height * this.cellSize + (size.height - 1) * this.gridGap}px`;

            // 中心位置を維持して新しい位置を計算
            const newLeft = centerX - (size.width * this.cellSize + (size.width - 1) * this.gridGap) / 2;
            const newTop = centerY - (size.height * this.cellSize + (size.height - 1) * this.gridGap) / 2;

            this.currentDragElement.style.left = `${newLeft}px`;
            this.currentDragElement.style.top = `${newTop}px`;

            // シャドウアイテムも更新
            if (this.shadowItem) {
                this.updateShadowItemSize(size);
            }
        }
    }

    updateShadowItemSize(size) {
        if (this.shadowItem) {
            this.shadowItem.style.width = `${size.width * this.cellSize + (size.width - 1) * this.gridGap}px`;
            this.shadowItem.style.height = `${size.height * this.cellSize + (size.height - 1) * this.gridGap}px`;
        }
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
        });

        grid.addEventListener('dragleave', () => {
            this.clearDropZoneHighlight();
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

        // 銃アイテムの場合は画像をセット
        if (item.id === 'gun') {
            const rotation = (parseInt(item.rotation) === 90) ? 90 : 0;
            itemElement.dataset.rotation = rotation;
            setGunImage(itemElement, rotation);
        } else {
            itemElement.textContent = item.content;
        }

        // ドラッグ移動のためのマウスイベントを追加
        itemElement.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // 左クリックのみ
                this.startItemDrag(e, itemElement);
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
            content: item.content
        });
    }

    startItemDrag(e, itemElement) {
        // 右クリックの場合は何もしない
        if (e.button !== 0) {
            return;
        }

        e.preventDefault();

        // ドラッグ開始位置を記録
        const startX = e.clientX;
        const startY = e.clientY;
        let hasMoved = false;
        const moveThreshold = 3; // 3px以上移動したらドラッグとみなす

        const moveHandler = (e) => {
            const deltaX = Math.abs(e.clientX - startX);
            const deltaY = Math.abs(e.clientY - startY);

            // 一定距離以上移動したらドラッグ開始
            if (!hasMoved && (deltaX > moveThreshold || deltaY > moveThreshold)) {
                hasMoved = true;
                this.startItemMove(e, itemElement);
                document.removeEventListener('mousemove', moveHandler);
                document.removeEventListener('mouseup', upHandler);
            }
        };

        const upHandler = (e) => {
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
            // 移動していない場合は何もしない（単発クリック）
        };

        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', upHandler);
    }

    startItemMove(e, itemElement) {
        const rect = itemElement.getBoundingClientRect();
        this.dragOffset = {
            x: rect.width / 2,
            y: rect.height / 2
        };
        itemElement.style.zIndex = '1000';
        itemElement.style.opacity = '0.8';
        const size = this.parseSize(itemElement.dataset.size);
        const itemId = itemElement.dataset.itemId;
        this.currentDragItem = {
            id: itemId,
            size: itemElement.dataset.size,
            content: itemElement.textContent
        };
        this.isDragging = true;
        this.currentDragElement = itemElement;
        // 銃アイテムの場合はimgタグを必ず入れる
        if (itemId && itemId.includes('gun')) {
            const rotation = (parseInt(itemElement.dataset.rotation) === 90) ? 90 : 0;
            setGunImage(itemElement, rotation);
        }
        // 直近のマウス座標を保存
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        const moveHandler = (e) => {
            const grid = document.getElementById('inventoryGrid');
            const gridRect = grid.getBoundingClientRect();
            const x = e.clientX - gridRect.left;
            const y = e.clientY - gridRect.top;
            this.lastMouseX = x;
            this.lastMouseY = y;
            const currentSize = this.parseSize(this.currentDragItem.size);
            // グリッド座標
            const col = Math.floor(x / this.cellSize - (currentSize.width / 2) + 0.5);
            const row = Math.floor(y / this.cellSize - (currentSize.height / 2) + 0.5);
            // ピクセル座標
            const left = col * (this.cellSize + this.gridGap);
            const top = row * (this.cellSize + this.gridGap);
            itemElement.style.width = `${currentSize.width * this.cellSize + (currentSize.width - 1) * this.gridGap}px`;
            itemElement.style.height = `${currentSize.height * this.cellSize + (currentSize.height - 1) * this.gridGap}px`;
            itemElement.style.left = `${left}px`;
            itemElement.style.top = `${top}px`;
            // 置けるかどうかで色を変える
            if (this.canPlaceItem(row, col, currentSize.width + 'x' + currentSize.height, itemId)) {
                itemElement.classList.remove('cannot-place');
            } else {
                itemElement.classList.add('cannot-place');
            }
        };
        const upHandler = (e) => {
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
            const grid = document.getElementById('inventoryGrid');
            const gridRect = grid.getBoundingClientRect();
            const x = e.clientX - gridRect.left;
            const y = e.clientY - gridRect.top;
            const currentSize = this.parseSize(this.currentDragItem.size);
            const col = Math.floor(x / this.cellSize - (currentSize.width / 2) + 0.5);
            const row = Math.floor(y / this.cellSize - (currentSize.height / 2) + 0.5);
            if (this.canPlaceItem(row, col, currentSize.width + 'x' + currentSize.height, itemId)) {
                this.moveItemWithRotation(itemElement, row, col, currentSize);
            } else {
                this.resetItemPosition(itemElement);
            }
            itemElement.style.zIndex = '';
            itemElement.style.opacity = '';
            itemElement.classList.remove('cannot-place'); // ここで必ず色を戻す
            this.isDragging = false;
            this.currentDragItem = null;
            this.currentDragElement = null;
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

    moveItemWithRotation(itemElement, newRow, newCol, newSize) {
        const itemId = itemElement.dataset.itemId;
        const oldRow = parseInt(itemElement.dataset.row);
        const oldCol = parseInt(itemElement.dataset.col);
        const oldSize = this.parseSize(itemElement.dataset.size);

        // 古い位置を解放
        for (let r = oldRow; r < oldRow + oldSize.height; r++) {
            for (let c = oldCol; c < oldCol + oldSize.width; c++) {
                this.setCellOccupied(r, c, false);
            }
        }

        // 新しい位置を占有
        for (let r = newRow; r < newRow + newSize.height; r++) {
            for (let c = newCol; c < newCol + newSize.width; c++) {
                this.setCellOccupied(r, c, true);
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
            // 回転状態も保存
            if (itemElement.dataset.rotation) {
                itemInfo.rotation = itemElement.dataset.rotation;
            }
        }
        // 銃アイテムの場合はimgの回転も反映
        if (itemElement.dataset.itemId && itemElement.dataset.itemId.includes('gun')) {
            const img = itemElement.querySelector('img.item-image');
            if (img && itemElement.dataset.rotation) {
                img.style.transform = `rotate(${itemElement.dataset.rotation}deg)`;
            }
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
            { id: 'food', row: 0, col: 3, size: '1x2', content: '食料' },
            { id: 'gun', row: 3, col: 0, size: '2x1', content: '銃' }
        ];

        initialItems.forEach(item => {
            if (this.canPlaceItem(item.row, item.col, item.size)) {
                this.placeItem(item.row, item.col, {
                    id: item.id,
                    size: item.size,
                    content: item.content,
                    rotation: item.rotation || '0'
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

    // --- Remove shadow item (placement preview) feature ---
    // Delete showShadowItem, removeShadowItem, and all their calls
    // --- Remove shadow item (placement preview) feature ---

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
        dragElem.style.position = 'absolute';
        dragElem.style.pointerEvents = 'none';
        // 銃アイテムの場合はimgタグを必ず入れる
        if (item.id === 'gun') {
            const rotation = (parseInt(item.rotation) === 90) ? 90 : 0;
            setGunImage(dragElem, rotation);
        } else {
            dragElem.textContent = item.content;
        }
        grid.appendChild(dragElem);

        // ドラッグ状態を設定
        this.isDragging = true;
        this.currentDragItem = { ...item };
        this.currentDragElement = dragElem;

        // ドラッグ開始時のオフセット
        const gridRect = grid.getBoundingClientRect();
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        const updateDragElem = (x, y) => {
            this.lastMouseX = x;
            this.lastMouseY = y;
            const currentSize = this.parseSize(this.currentDragItem.size);
            // グリッド座標
            const col = Math.floor(x / this.cellSize - (currentSize.width / 2) + 0.5);
            const row = Math.floor(y / this.cellSize - (currentSize.height / 2) + 0.5);
            // ピクセル座標
            const left = col * (this.cellSize + this.gridGap);
            const top = row * (this.cellSize + this.gridGap);
            // サイズ
            dragElem.style.width = `${currentSize.width * this.cellSize + (currentSize.width - 1) * this.gridGap}px`;
            dragElem.style.height = `${currentSize.height * this.cellSize + (currentSize.height - 1) * this.gridGap}px`;
            dragElem.style.left = `${left}px`;
            dragElem.style.top = `${top}px`;
            // 置けるかどうかで色を変える
            if (this.canPlaceItem(row, col, currentSize.width + 'x' + currentSize.height)) {
                dragElem.classList.remove('cannot-place');
            } else {
                dragElem.classList.add('cannot-place');
            }
            // シャドウも更新
            // this.showShadowItem(row, col, currentSize); // REMOVE
        };
        const moveHandler = (e2) => {
            const x = e2.clientX - gridRect.left;
            const y = e2.clientY - gridRect.top;
            updateDragElem(x, y);
        };
        const upHandler = (e2) => {
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
            // this.removeShadowItem(); // REMOVE
            // ドロップ位置を計算
            const currentSize = this.parseSize(this.currentDragItem.size);
            const x = e2.clientX - gridRect.left;
            const y = e2.clientY - gridRect.top;
            const col = Math.floor(x / this.cellSize - (currentSize.width / 2) + 0.5);
            const row = Math.floor(y / this.cellSize - (currentSize.height / 2) + 0.5);
            if (this.canPlaceItem(row, col, currentSize.width + 'x' + currentSize.height)) {
                // 回転後のサイズでアイテムを配置
                const rotatedItem = {
                    id: this.currentDragItem.id,
                    size: this.currentDragItem.size,
                    content: this.currentDragItem.content
                };
                this.placeItem(row, col, rotatedItem);
            }
            if (dragElem.parentNode) dragElem.parentNode.removeChild(dragElem);
            dragElem.classList.remove('cannot-place'); // ここで必ず色を戻す
            this.isDragging = false;
            this.currentDragItem = null;
            this.currentDragElement = null;
        };
        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', upHandler);
        // 最初の位置を即時反映
        updateDragElem(e.clientX - gridRect.left, e.clientY - gridRect.top);
    }
}

// 銃画像をセットし、回転も適用する共通関数（0か90のみ）
function setGunImage(element, rotation) {
    element.innerHTML = '';
    const img = document.createElement('img');
    img.src = 'images/Gun.png';
    img.className = 'item-image';
    img.style.transform = (rotation === 90) ? 'rotate(90deg)' : 'rotate(0deg)';
    element.appendChild(img);
}

// ページ読み込み時にインベントリシステムを初期化
document.addEventListener('DOMContentLoaded', () => {
    new InventorySystem();
}); 