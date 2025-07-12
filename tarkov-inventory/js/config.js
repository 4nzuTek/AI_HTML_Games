// アイテム設定管理
var ITEM_CONFIGS = {
    gun: {
        imagePath: 'images/Gun.png',
        defaultRotation: 0,
        defaultScale: 1.0
    },
    medkit: {
        imagePath: 'images/medical_kit.png',
        defaultRotation: 0,
        defaultScale: 1.0
    }
};

// グリッド設定
var GRID_CONFIG = {
    size: 10,
    cellSize: 40,
    gridGap: 1
};

// 初期アイテム設定
var INITIAL_ITEMS = [
    { id: 'medkit', row: 0, col: 0, size: '2x2', content: '医療キット' },
    { id: 'ammo', row: 2, col: 2, size: '1x1', content: '弾薬' },
    { id: 'food', row: 0, col: 3, size: '1x2', content: '食料' },
    { id: 'gun', row: 3, col: 0, size: '2x1', content: '銃' }
];

window.ITEM_CONFIGS = ITEM_CONFIGS;
window.GRID_CONFIG = GRID_CONFIG;
window.INITIAL_ITEMS = INITIAL_ITEMS; 