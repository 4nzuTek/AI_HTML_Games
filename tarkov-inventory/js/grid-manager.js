function GridManager() {
    this.gridSize = window.GRID_CONFIG.size;
    this.cellSize = window.GRID_CONFIG.cellSize;
    this.gridGap = window.GRID_CONFIG.gridGap;
}

GridManager.prototype.createGrid = function () {
    var grid = document.getElementById('inventoryGrid');
    grid.style.position = 'relative';
    for (var row = 0; row < this.gridSize; row++) {
        for (var col = 0; col < this.gridSize; col++) {
            var cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            grid.appendChild(cell);
        }
    }
};

GridManager.prototype.getCell = function (row, col) {
    return document.querySelector('[data-row="' + row + '"][data-col="' + col + '"]');
};

GridManager.prototype.isCellOccupied = function (row, col) {
    var cell = this.getCell(row, col);
    return cell && cell.classList.contains('occupied');
};

GridManager.prototype.setCellOccupied = function (row, col, occupied) {
    var cell = this.getCell(row, col);
    if (cell) {
        if (occupied) {
            cell.classList.add('occupied');
        } else {
            cell.classList.remove('occupied');
        }
    }
};

GridManager.prototype.canPlaceItem = function (row, col, size, ignoreItemId) {
    var parsedSize = window.parseSize(size);
    for (var r = row; r < row + parsedSize.height; r++) {
        for (var c = col; c < col + parsedSize.width; c++) {
            if (r < 0 || c < 0 || r >= this.gridSize || c >= this.gridSize) {
                return false;
            }
            var cell = this.getCell(r, c);
            if (cell && cell.classList.contains('occupied')) {
                if (ignoreItemId) {
                    var overlap = false;
                    document.querySelectorAll('.placed-item').forEach(function (el) {
                        if (el.dataset.itemId === ignoreItemId) {
                            var s = window.parseSize(el.dataset.size);
                            var baseRow = parseInt(el.dataset.row);
                            var baseCol = parseInt(el.dataset.col);
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
};

GridManager.prototype.highlightDropZone = function (row, col, size) {
    this.clearDropZoneHighlight();
    var parsedSize = window.parseSize(size);
    for (var r = row; r < row + parsedSize.height && r < this.gridSize; r++) {
        for (var c = col; c < col + parsedSize.width && c < this.gridSize; c++) {
            var cell = this.getCell(r, c);
            if (cell && !this.isCellOccupied(r, c)) {
                cell.classList.add('drag-over');
            }
        }
    }
};

GridManager.prototype.clearDropZoneHighlight = function () {
    document.querySelectorAll('.grid-cell.drag-over').forEach(function (cell) {
        cell.classList.remove('drag-over');
    });
};

window.GridManager = GridManager; 