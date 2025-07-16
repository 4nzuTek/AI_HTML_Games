function ContextMenu(inventorySystem) {
    this.inventorySystem = inventorySystem;
    this.contextMenu = document.getElementById('contextMenu');
    this.contextMenuTarget = null;
    this.init();
}

ContextMenu.prototype.init = function () {
    var self = this;
    document.addEventListener('contextmenu', function (e) {
        var placedItem = e.target.closest('.placed-item');
        if (placedItem) {
            e.preventDefault();
            self.showContextMenu(e, placedItem);
        }
    });
    this.contextMenu.addEventListener('click', function (e) {
        var action = e.target.dataset.action;
        if (action === 'delete' && self.contextMenuTarget) {
            self.deleteItem(self.contextMenuTarget);
        }
        self.hideContextMenu();
    });
    document.addEventListener('click', function (e) {
        if (!self.contextMenu.contains(e.target)) {
            self.hideContextMenu();
        }
    });
};

ContextMenu.prototype.showContextMenu = function (e, itemElement) {
    this.contextMenuTarget = itemElement;
    this.contextMenu.style.display = 'block';
    var x = e.clientX;
    var y = e.clientY;
    var menuX = x;
    var menuY = y;
    this.contextMenu.style.left = '0px';
    this.contextMenu.style.top = '0px';
    var rect = this.contextMenu.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) menuX = x - rect.width;
    if (y + rect.height > window.innerHeight) menuY = y - rect.height;
    this.contextMenu.style.left = menuX + 'px';
    this.contextMenu.style.top = menuY + 'px';
};

ContextMenu.prototype.hideContextMenu = function () {
    this.contextMenu.style.display = 'none';
    this.contextMenuTarget = null;
};

ContextMenu.prototype.deleteItem = function (itemElement) {
    var itemId = itemElement.dataset.itemId;
    var row = parseInt(itemElement.dataset.row);
    var col = parseInt(itemElement.dataset.col);
    var size = this.inventorySystem.parseSize(itemElement.dataset.size);
    for (var r = row; r < row + size.height; r++) {
        for (var c = col; c < col + size.width; c++) {
            this.inventorySystem.gridManager.setCellOccupied(r, c, false);
        }
    }
    this.inventorySystem.placedItems.delete(itemId);
    if (itemElement.parentNode) {
        itemElement.parentNode.removeChild(itemElement);
    }
};

window.ContextMenu = ContextMenu; 