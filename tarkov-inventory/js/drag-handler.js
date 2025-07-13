

function DragHandler(inventorySystem) {
    this.inventorySystem = inventorySystem;
    this.draggedItem = null;
    this.dragOffset = { x: 0, y: 0 };
    this.isDragging = false;
    this.currentDragItem = null;
    this.currentDragElement = null;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.originalItemState = null;
    this.init();
}

DragHandler.prototype.init = function () {
    this.setupPaletteDrag();
    this.setupRotationHandler();
};

DragHandler.prototype.setupRotationHandler = function () {
    var self = this;
    document.addEventListener('keydown', function (e) {
        if (e.key.toLowerCase() === 'r' && self.isDragging && self.currentDragItem) {
            e.preventDefault();
            self.rotateCurrentItem();
        }
    });
};

DragHandler.prototype.rotateCurrentItem = function () {
    if (!this.currentDragItem || !this.currentDragElement) return;
    var currentSize = window.parseSize(this.currentDragItem.size);
    var rotatedSize = { width: currentSize.height, height: currentSize.width };
    this.currentDragItem.size = rotatedSize.width + 'x' + rotatedSize.height;
    var grid = document.getElementById('inventoryGrid');
    var gridRect = grid.getBoundingClientRect();
    var x = (typeof this.lastMouseX !== 'undefined') ? this.lastMouseX : gridRect.width / 2;
    var y = (typeof this.lastMouseY !== 'undefined') ? this.lastMouseY : gridRect.height / 2;
    var col = Math.floor(x / this.inventorySystem.cellSize - (rotatedSize.width / 2) + 0.5);
    var row = Math.floor(y / this.inventorySystem.cellSize - (rotatedSize.height / 2) + 0.5);
    var left = col * (this.inventorySystem.cellSize + this.inventorySystem.gridGap);
    var top = row * (this.inventorySystem.cellSize + this.inventorySystem.gridGap);
    this.currentDragElement.style.width = (rotatedSize.width * this.inventorySystem.cellSize + (rotatedSize.width - 1) * this.inventorySystem.gridGap) + 'px';
    this.currentDragElement.style.height = (rotatedSize.height * this.inventorySystem.cellSize + (rotatedSize.height - 1) * this.inventorySystem.gridGap) + 'px';
    this.currentDragElement.style.left = left + 'px';
    this.currentDragElement.style.top = top + 'px';
    var itemType = window.getItemType(this.currentDragItem.id);
    if (window.getItemConfig(itemType)) {
        var currentRotation = parseInt(this.currentDragElement.dataset.rotation || '0');
        var newRotation = (currentRotation === 0) ? 90 : 0;
        this.currentDragElement.dataset.rotation = newRotation.toString();
        this.currentDragItem.rotation = newRotation.toString();
        var scale = 1.0; // スケールを常に1.0固定にする
        this.currentDragElement.dataset.scale = scale.toString();
        this.currentDragItem.scale = scale.toString();
        window.setItemImage(this.currentDragElement, itemType, newRotation, scale);
        setTimeout(function () {
            var img = this.currentDragElement.querySelector('.item-image');
            if (img) {
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.minWidth = '100%';
                img.style.minHeight = '100%';
            }
        }.bind(this), 10);
    }
};

DragHandler.prototype.setupPaletteDrag = function () {
    // パレットアイテムも自前ドラッグに
    document.querySelectorAll('.item').forEach(item => {
        item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const size = window.parseSize(item.dataset.size);
            const content = item.querySelector('.item-content').textContent;
            this.startNewItemDrag(e, {
                id: item.dataset.itemId,
                size: item.dataset.size,
                content: content
            });
        });
    });
};

DragHandler.prototype.startNewItemDrag = function (e, item) {
    // パレットから新規追加用の自前ドラッグ
    const grid = document.getElementById('inventoryGrid');
    // ドラッグ用の仮アイテムを作成
    const size = window.parseSize(item.size);
    const dragElem = document.createElement('div');
    dragElem.className = 'placed-item dragging';
    dragElem.style.position = 'absolute';
    dragElem.style.pointerEvents = 'none';
    dragElem.dataset.size = item.size; // サイズ情報を設定

    // アイテムタイプを取得して画像を設定
    const itemType = window.getItemType(item.id);
    const config = window.getItemConfig(itemType);
    if (config) {
        const rotation = (parseInt(item.rotation) === 90) ? 90 : 0;
        const scale = 1.0; // スケールを常に1.0固定にする
        window.setItemImage(dragElem, itemType, rotation, scale);
    } else {
        dragElem.textContent = item.content;
    }

    grid.appendChild(dragElem);

    // ドラッグ状態を設定
    this.isDragging = true;
    this.currentDragItem = {
        ...item,
        rotation: '0', // 初期回転状態を設定
        scale: '1.0'   // 初期スケールを設定
    };
    this.currentDragElement = dragElem;

    // ドラッグ開始時のオフセット
    const gridRect = grid.getBoundingClientRect();
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    const updateDragElem = (x, y) => {
        this.lastMouseX = x;
        this.lastMouseY = y;
        const currentSize = window.parseSize(this.currentDragItem.size);
        // グリッド座標
        const col = Math.floor(x / this.inventorySystem.cellSize - (currentSize.width / 2) + 0.5);
        const row = Math.floor(y / this.inventorySystem.cellSize - (currentSize.height / 2) + 0.5);
        // ピクセル座標
        const left = col * (this.inventorySystem.cellSize + this.inventorySystem.gridGap);
        const top = row * (this.inventorySystem.cellSize + this.inventorySystem.gridGap);
        // サイズ
        dragElem.style.width = `${currentSize.width * this.inventorySystem.cellSize + (currentSize.width - 1) * this.inventorySystem.gridGap}px`;
        dragElem.style.height = `${currentSize.height * this.inventorySystem.cellSize + (currentSize.height - 1) * this.inventorySystem.gridGap}px`;
        dragElem.style.left = `${left}px`;
        dragElem.style.top = `${top}px`;
        // 置けるかどうかで色を変える
        if (this.inventorySystem.gridManager.canPlaceItem(row, col, currentSize.width + 'x' + currentSize.height)) {
            dragElem.classList.remove('cannot-place');
        } else {
            dragElem.classList.add('cannot-place');
        }
    };
    const moveHandler = (e2) => {
        const x = e2.clientX - gridRect.left;
        const y = e2.clientY - gridRect.top;
        updateDragElem(x, y);
    };
    const upHandler = (e2) => {
        document.removeEventListener('mousemove', moveHandler);
        document.removeEventListener('mouseup', upHandler);
        // ドロップ位置を計算
        if (!this.currentDragItem) {
            if (dragElem.parentNode) dragElem.parentNode.removeChild(dragElem);
            dragElem.classList.remove('cannot-place');
            this.isDragging = false;
            this.currentDragElement = null;
            return;
        }
        const currentSize = window.parseSize(this.currentDragItem.size);
        const x = e2.clientX - gridRect.left;
        const y = e2.clientY - gridRect.top;
        const col = Math.floor(x / this.inventorySystem.cellSize - (currentSize.width / 2) + 0.5);
        const row = Math.floor(y / this.inventorySystem.cellSize - (currentSize.height / 2) + 0.5);
        if (this.inventorySystem.gridManager.canPlaceItem(row, col, currentSize.width + 'x' + currentSize.height)) {
            // 回転後のサイズでアイテムを配置
            const rotatedItem = {
                id: this.currentDragItem.id,
                size: this.currentDragItem.size,
                content: this.currentDragItem.content,
                rotation: this.currentDragItem.rotation || '0' // 回転状態も渡す
            };
            this.inventorySystem.placeItem(row, col, rotatedItem);
        }
        if (dragElem.parentNode) dragElem.parentNode.removeChild(dragElem);
        dragElem.classList.remove('cannot-place'); // ここで必ず色を戻す
        dragElem.classList.remove('dragging');
        this.isDragging = false;
        this.currentDragItem = null;
        this.currentDragElement = null;

        // ツールチップマネージャーにドラッグ終了を通知
        if (window.inventorySystem && window.inventorySystem.tooltipManager) {
            window.inventorySystem.tooltipManager.resetTooltipState();
        }
    };
    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', upHandler);
    // 最初の位置を即時反映
    updateDragElem(e.clientX - gridRect.left, e.clientY - gridRect.top);
};

DragHandler.prototype.startItemDrag = function (e, itemElement) {
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
};

DragHandler.prototype.startItemMove = function (e, itemElement) {
    const rect = itemElement.getBoundingClientRect();
    this.dragOffset = {
        x: rect.width / 2,
        y: rect.height / 2
    };

    // ドラッグ開始前の元の状態を保存
    this.originalItemState = {
        row: parseInt(itemElement.dataset.row),
        col: parseInt(itemElement.dataset.col),
        size: itemElement.dataset.size,
        rotation: itemElement.dataset.rotation || '0',
        scale: itemElement.dataset.scale || '1.0'
    };

    itemElement.style.zIndex = '1000';
    itemElement.style.opacity = '0.8';
    itemElement.classList.add('dragging');
    const size = window.parseSize(itemElement.dataset.size);
    const itemId = itemElement.dataset.itemId;
    this.currentDragItem = {
        id: itemId,
        size: itemElement.dataset.size,
        content: itemElement.textContent,
        rotation: itemElement.dataset.rotation || '0',
        scale: itemElement.dataset.scale || '1.0'
    };
    this.isDragging = true;
    this.currentDragElement = itemElement;

    // アイテムタイプを取得して画像を設定
    const itemType = window.getItemType(itemId);
    const config = window.getItemConfig(itemType);
    if (config) {
        const rotation = (parseInt(itemElement.dataset.rotation) === 90) ? 90 : 0;
        const scale = 1.0; // スケールを常に1.0固定にする
        window.setItemImage(itemElement, itemType, rotation, scale);
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
        const currentSize = window.parseSize(this.currentDragItem.size);
        // グリッド座標
        const col = Math.floor(x / this.inventorySystem.cellSize - (currentSize.width / 2) + 0.5);
        const row = Math.floor(y / this.inventorySystem.cellSize - (currentSize.height / 2) + 0.5);
        // ピクセル座標
        const left = col * (this.inventorySystem.cellSize + this.inventorySystem.gridGap);
        const top = row * (this.inventorySystem.cellSize + this.inventorySystem.gridGap);
        itemElement.style.width = `${currentSize.width * this.inventorySystem.cellSize + (currentSize.width - 1) * this.inventorySystem.gridGap}px`;
        itemElement.style.height = `${currentSize.height * this.inventorySystem.cellSize + (currentSize.height - 1) * this.inventorySystem.gridGap}px`;
        itemElement.style.left = `${left}px`;
        itemElement.style.top = `${top}px`;
        // 置けるかどうかで色を変える
        if (this.inventorySystem.gridManager.canPlaceItem(row, col, currentSize.width + 'x' + currentSize.height, itemId)) {
            itemElement.classList.remove('cannot-place');
        } else {
            itemElement.classList.add('cannot-place');
        }
    };
    const upHandler = (e) => {
        document.removeEventListener('mousemove', moveHandler);
        document.removeEventListener('mouseup', upHandler);
        if (!this.currentDragItem) {
            itemElement.style.zIndex = '';
            itemElement.style.opacity = '';
            itemElement.classList.remove('cannot-place');
            this.isDragging = false;
            this.currentDragElement = null;
            this.originalItemState = null;
            return;
        }
        const grid = document.getElementById('inventoryGrid');
        const gridRect = grid.getBoundingClientRect();
        const x = e.clientX - gridRect.left;
        const y = e.clientY - gridRect.top;
        const currentSize = window.parseSize(this.currentDragItem.size);
        const col = Math.floor(x / this.inventorySystem.cellSize - (currentSize.width / 2) + 0.5);
        const row = Math.floor(y / this.inventorySystem.cellSize - (currentSize.height / 2) + 0.5);
        if (this.inventorySystem.gridManager.canPlaceItem(row, col, currentSize.width + 'x' + currentSize.height, itemId)) {
            this.inventorySystem.moveItemWithRotation(itemElement, row, col, currentSize);
        } else {
            this.inventorySystem.resetItemPosition(itemElement);
        }
        itemElement.style.zIndex = '';
        itemElement.style.opacity = '';
        itemElement.classList.remove('cannot-place'); // ここで必ず色を戻す
        itemElement.classList.remove('dragging');
        this.isDragging = false;
        this.currentDragItem = null;
        this.currentDragElement = null;
        // 元の状態をクリア
        this.originalItemState = null;

        // ツールチップマネージャーにドラッグ終了を通知
        if (window.inventorySystem && window.inventorySystem.tooltipManager) {
            window.inventorySystem.tooltipManager.resetTooltipState();
        }
    };
    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', upHandler);
};

window.DragHandler = DragHandler; 